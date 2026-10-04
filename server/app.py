"""YINK hosted telemetry/admin. Standard-library WSGI app; run behind Gunicorn/Nginx."""
import base64
import csv
from datetime import date, timedelta
import hashlib
import hmac
import ipaddress
import io
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
from http.cookies import SimpleCookie
from urllib.parse import parse_qs

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get('YINK_DATA', ROOT / 'data'))
ORIGIN = os.environ.get('YINK_ORIGIN', 'https://leekquant.tech')
SECURE = ORIGIN.startswith('https:')
RETENTION = 30 * 86400


def connect():
    db = sqlite3.connect(DATA / 'yink.sqlite', timeout=10)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    return db


def init():
    DATA.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS visits (ip TEXT PRIMARY KEY, first INTEGER, last INTEGER, count INTEGER);
        CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, ip TEXT, created INTEGER, metadata TEXT, thumbnail BLOB);
        CREATE TABLE IF NOT EXISTS bans (ip TEXT PRIMARY KEY, reason TEXT, created INTEGER);
        CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER, csrf TEXT);
        CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, window INTEGER, count INTEGER, updated INTEGER);
        CREATE TABLE IF NOT EXISTS visit_days (ip TEXT, day INTEGER, count INTEGER, first INTEGER, last INTEGER, PRIMARY KEY(ip,day));
        CREATE INDEX IF NOT EXISTS events_created ON events(created);
        CREATE INDEX IF NOT EXISTS events_ip ON events(ip);
        CREATE INDEX IF NOT EXISTS visit_days_day ON visit_days(day);
        CREATE TABLE IF NOT EXISTS ip_notes (ip TEXT PRIMARY KEY, note TEXT NOT NULL, updated INTEGER);
        CREATE TABLE IF NOT EXISTS security_days (ip TEXT, day INTEGER, kind TEXT, count INTEGER, last INTEGER, PRIMARY KEY(ip,day,kind));
        CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY, created INTEGER, actor TEXT, action TEXT, target TEXT, detail TEXT);
        ''')
        if not db.execute("SELECT 1 FROM settings WHERE key='tracking_start'").fetchone():
            earliest = db.execute('SELECT MIN(day) FROM (SELECT MIN(day) AS day FROM visit_days UNION ALL SELECT MIN(created/86400) AS day FROM events)').fetchone()[0]
            db.execute("INSERT OR IGNORE INTO settings VALUES ('tracking_start',?)",(str(earliest if earliest is not None else int(time.time())//86400),))
        if not db.execute("SELECT 1 FROM settings WHERE key='password'").fetchone():
            token_file = DATA / 'setup-token'
            try:
                with token_file.open('x', encoding='utf-8') as handle:
                    handle.write(secrets.token_urlsafe(32))
                os.chmod(token_file, 0o600)
            except FileExistsError:
                pass


init()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    result = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600000)
    return salt + ':' + result.hex()


def real_ip(env):
    # The service listens only on loopback. Nginx replaces this header, never appends user input.
    address = env.get('REMOTE_ADDR', '')
    if address in ('127.0.0.1', '::1'):
        address = env.get('HTTP_X_REAL_IP', address)
    try:
        return str(ipaddress.ip_address(address))
    except ValueError:
        return 'unknown'


def limited(db, key, maximum, period):
    window = int(time.time()) // period
    db.execute('INSERT INTO limits VALUES (?, ?, 1, ?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END, window=excluded.window, updated=excluded.updated', (key, window, int(time.time())))
    return db.execute('SELECT count FROM limits WHERE key=?', (key,)).fetchone()[0] > maximum


def clean_metadata(raw):
    if not isinstance(raw, dict):
        raise ValueError('记录格式无效')
    allowed = ('symbol', 'name', 'start', 'end', 'style', 'ratio', 'kind')
    data = {key: str(raw.get(key, ''))[:100] for key in allowed}
    for key in ('width', 'height', 'layers', 'markers'):
        val = raw.get(key, 0)
        if not isinstance(val, int) or isinstance(val, bool) or not 0 <= val <= 100000:
            raise ValueError('尺寸或数量无效')
        data[key] = val
    return data


def security_record(db, ip, kind, now):
    db.execute('INSERT INTO security_days VALUES (?,?,?,1,?) ON CONFLICT(ip,day,kind) DO UPDATE SET count=count+1,last=excluded.last', (ip, now//86400, kind, now))


def audit(db, actor, action, target, detail, now):
    db.execute('INSERT INTO admin_audit(created,actor,action,target,detail) VALUES (?,?,?,?,?)', (now, actor, action, target, detail))


def report_range(query, now):
    today = now // 86400
    epoch = date(1970, 1, 1)
    if query.get('start') or query.get('end'):
        start = (date.fromisoformat(query.get('start', [''])[0]) - epoch).days
        end = (date.fromisoformat(query.get('end', [''])[0]) - epoch).days
    else:
        days = int(query.get('days', ['30'])[0])
        if days not in (1, 7, 30): raise ValueError('Invalid report range')
        start, end = today - days + 1, today
    if start > end or start < today - 29 or end > today:
        raise ValueError('Report range outside retention')
    return start, end


def date_string(day):
    return (date(1970, 1, 1) + timedelta(days=day)).isoformat()


def report_summary(db, start, end):
    visits = db.execute('SELECT COALESCE(SUM(count),0),COUNT(DISTINCT ip) FROM visit_days WHERE day BETWEEN ? AND ?', (start,end)).fetchone()
    events = db.execute('SELECT COUNT(*),COUNT(DISTINCT ip) FROM events WHERE created>=? AND created<?', (start*86400,(end+1)*86400)).fetchone()
    # An exporting IP must also have a recorded visit in this period to count in the rate.
    exporting_visitors = db.execute('SELECT COUNT(DISTINCT e.ip) FROM events e WHERE e.created>=? AND e.created<? AND EXISTS(SELECT 1 FROM visit_days v WHERE v.ip=e.ip AND v.day BETWEEN ? AND ?)', (start*86400,(end+1)*86400,start,end)).fetchone()[0]
    returning = db.execute('SELECT COUNT(DISTINCT v.ip) FROM visit_days v JOIN visits a ON a.ip=v.ip WHERE v.day BETWEEN ? AND ? AND a.first<?', (start,end,start*86400)).fetchone()[0]
    return {'visits':visits[0], 'ips':visits[1], 'generated':events[0], 'generationIps':events[1], 'exportingVisitors':exporting_visitors, 'returningIps':returning, 'exportRate':round(exporting_visitors/visits[1]*100,1) if visits[1] else 0}


def report_trend(db, start, end, ip=None):
    filter_ip = ' AND ip=?' if ip else ''
    visit_params = (start,end,ip) if ip else (start,end)
    event_params = (start*86400,(end+1)*86400,ip) if ip else (start*86400,(end+1)*86400)
    visits = {r['day']:dict(r) for r in db.execute('SELECT day,SUM(count) AS visits,COUNT(DISTINCT ip) AS ips FROM visit_days WHERE day BETWEEN ? AND ?'+filter_ip+' GROUP BY day', visit_params)}
    events = {r['day']:r['generated'] for r in db.execute('SELECT created/86400 AS day,COUNT(*) AS generated FROM events WHERE created>=? AND created<?'+filter_ip+' GROUP BY day', event_params)}
    return [{'date':date_string(day), 'visits':visits.get(day,{}).get('visits',0), 'ips':visits.get(day,{}).get('ips',0), 'generated':events.get(day,0)} for day in range(start,end+1)]


def visitor_rows(db, start, end, query, paginated=True):
    search = query.get('q', [''])[0].strip()[:100]
    state = query.get('state', ['all'])[0]
    order = query.get('sort', ['last'])[0]
    if state not in ('all','blocked','active') or order not in ('last','count','generated'): raise ValueError('Invalid visitor filter')
    page = int(query.get('page', ['1'])[0])
    if not 1 <= page <= 1000000: raise ValueError('Invalid page')
    pattern = '%'+search.replace('\\','\\\\').replace('%','\\%').replace('_','\\_')+'%'
    where = " WHERE (v.ip LIKE ? ESCAPE '\\' OR COALESCE(n.note,'') LIKE ? ESCAPE '\\')"
    if state == 'blocked': where += ' AND b.ip IS NOT NULL'
    if state == 'active': where += ' AND b.ip IS NULL'
    cte = '''WITH v AS (SELECT ip,SUM(count) AS count,MIN(first) AS first,MAX(last) AS last FROM visit_days WHERE day BETWEEN ? AND ? GROUP BY ip),
      e AS (SELECT ip,COUNT(*) AS generated FROM events WHERE created>=? AND created<? GROUP BY ip),
      s AS (SELECT ip,SUM(count) AS security FROM security_days WHERE day BETWEEN ? AND ? GROUP BY ip) '''
    joins = ' FROM v LEFT JOIN e ON e.ip=v.ip LEFT JOIN s ON s.ip=v.ip LEFT JOIN bans b ON b.ip=v.ip LEFT JOIN ip_notes n ON n.ip=v.ip'
    params = (start,end,start*86400,(end+1)*86400,start,end,pattern,pattern)
    total = db.execute(cte+'SELECT COUNT(*)'+joins+where,params).fetchone()[0]
    limit = 25 if paginated else 10000
    offset = (page-1)*limit if paginated else 0
    rows = [dict(r) for r in db.execute(cte+'''SELECT v.*,COALESCE(e.generated,0) AS generated,COALESCE(s.security,0) AS security,
      COALESCE(n.note,'') AS note,COALESCE(b.reason,'') AS reason,b.ip IS NOT NULL AS blocked'''+joins+where+' ORDER BY '+{'last':'v.last','count':'v.count','generated':'COALESCE(e.generated,0)'}[order]+' DESC,v.ip LIMIT ? OFFSET ?',params+(limit,offset))]
    return {'rows':rows,'total':total,'page':page,'pageSize':limit}


def event_rows(db, start, end, ip=None, limit=50, offset=0):
    clause = ' AND ip=?' if ip else ''
    params = (start*86400,(end+1)*86400)+( (ip,) if ip else () )
    total = db.execute('SELECT COUNT(*) FROM events WHERE created>=? AND created<?'+clause,params).fetchone()[0]
    rows = [dict(r) for r in db.execute('SELECT id,ip,created,metadata,thumbnail IS NOT NULL AS preview FROM events WHERE created>=? AND created<?'+clause+' ORDER BY created DESC,id DESC LIMIT ? OFFSET ?',params+(limit,offset))]
    for row in rows: row['metadata'] = json.loads(row['metadata'])
    return rows,total


def breakdown(db, start, end):
    buckets = {key:{} for key in ('symbol','style','ratio','kind')}
    for row in db.execute('SELECT metadata FROM events WHERE created>=? AND created<?',(start*86400,(end+1)*86400)):
        metadata = json.loads(row[0])
        for key, values in buckets.items():
            label = str(metadata.get(key) or '未指定')[:100]
            values[label] = values.get(label,0)+1
    result = {}
    for key, values in buckets.items():
        ranked = sorted(values.items(),key=lambda v:(-v[1],v[0]))
        rows = [{'label':label,'count':count} for label,count in ranked[:8]]
        if len(ranked)>8: rows.append({'label':'其他','count':sum(v[1] for v in ranked[8:])})
        result[key] = rows
    return result


def csv_response(rows):
    stream = io.StringIO(newline='')
    writer = csv.writer(stream)
    for row in rows:
        # Prevent spreadsheet formulas from executing when opening exported user-controlled values.
        writer.writerow(["'"+value if isinstance(value,str) and value.lstrip().startswith(('=','+','-','@')) else value for value in row])
    return ('\ufeff'+stream.getvalue()).encode('utf-8')


def application(env, start_response):
    path = env.get('PATH_INFO', '/')
    method = env.get('REQUEST_METHOD', 'GET')
    headers = [('Cache-Control', 'no-store'), ('X-Content-Type-Options', 'nosniff'), ('X-Frame-Options', 'DENY')]
    status = '200 OK'
    content_type = 'application/json; charset=utf-8'

    def finish(data, code=200, ctype=None):
        labels = {200:'OK', 400:'Bad Request', 401:'Unauthorized', 403:'Forbidden', 404:'Not Found', 409:'Conflict', 413:'Payload Too Large', 429:'Too Many Requests', 500:'Internal Server Error'}
        body = data if isinstance(data, bytes) else json.dumps(data, ensure_ascii=False).encode()
        start_response(f'{code} {labels.get(code, "Error")}', headers + [('Content-Type', ctype or content_type), ('Content-Length', str(len(body)))])
        return [body]

    if path == '/api/health':
        return finish({'ok':True, 'service':'YINK'})
    if path in ('/admin01', '/admin01/'):
        return finish((ROOT / 'admin.html').read_bytes(), ctype='text/html; charset=utf-8')
    if path == '/privacy':
        return finish((ROOT / 'privacy.html').read_bytes(), ctype='text/html; charset=utf-8')
    if not path.startswith('/api/'):
        return finish({'error':'没有此页面'}, 404)

    ip = real_ip(env)
    try:
        with connect() as db:
            now = int(time.time())
            # Bounded retention, including session/rate-limit cleanup. Runs at most once per hour.
            last = db.execute("SELECT value FROM settings WHERE key='cleanup'").fetchone()
            if not last or int(last[0]) < now - 3600:
                db.execute('DELETE FROM events WHERE created < ?', (now-RETENTION,))
                db.execute('DELETE FROM visits WHERE last < ?', (now-RETENTION,))
                db.execute('DELETE FROM visit_days WHERE day < ?', ((now-RETENTION)//86400,))
                db.execute('DELETE FROM sessions WHERE expires < ?', (now,))
                db.execute('DELETE FROM limits WHERE updated < ?', (now-48*3600,))
                db.execute('DELETE FROM security_days WHERE day < ?', ((now-RETENTION)//86400,))
                db.execute('DELETE FROM admin_audit WHERE created < ?', (now-RETENTION,))
                db.execute("INSERT OR REPLACE INTO settings VALUES ('cleanup', ?)", (str(now),))

            if path == '/api/access':
                blocked = db.execute('SELECT 1 FROM bans WHERE ip=?', (ip,)).fetchone()
                if blocked: security_record(db, ip, 'blocked', now)
                return finish({'ok':not bool(blocked)}, 403 if blocked else 200)

            public = path in ('/api/visit', '/api/generated')
            if public and db.execute('SELECT 1 FROM bans WHERE ip=?', (ip,)).fetchone():
                security_record(db, ip, 'blocked', now)
                return finish({'error':'此 IP 已限制访问'}, 403)
            if method == 'POST':
                if env.get('HTTP_ORIGIN') != ORIGIN:
                    if public: security_record(db, ip, 'origin', now)
                    return finish({'error':'来源无效'}, 403)
                try:
                    length = int(env.get('CONTENT_LENGTH', 0))
                except ValueError:
                    return finish({'error':'请求长度无效'}, 400)
                if not 0 < length <= 250000:
                    return finish({'error':'请求过大或为空'}, 413)
                if not env.get('CONTENT_TYPE', '').startswith('application/json'):
                    return finish({'error':'请使用 JSON'}, 400)
                try:
                    body = json.loads(env['wsgi.input'].read(length))
                    if not isinstance(body, dict): raise ValueError()
                except (ValueError, UnicodeError):
                    return finish({'error':'JSON 无效'}, 400)

            if public:
                if method != 'POST': return finish({'error':'请求方式无效'}, 400)
                if limited(db, 'public:'+ip, 120, 3600):
                    security_record(db, ip, 'rate', now)
                    return finish({'error':'请求过于频繁'}, 429)
                if path == '/api/visit':
                    db.execute('INSERT INTO visits VALUES (?, ?, ?, 1) ON CONFLICT(ip) DO UPDATE SET last=excluded.last, count=count+1', (ip, now, now))
                    db.execute('INSERT INTO visit_days VALUES (?, ?, 1, ?, ?) ON CONFLICT(ip,day) DO UPDATE SET last=excluded.last, count=count+1', (ip, now//86400, now, now))
                    return finish({'ok':True})
                if limited(db, 'generated:'+ip, 30, 3600):
                    security_record(db, ip, 'rate', now)
                    return finish({'error':'生成记录频率已达上限'}, 429)
                metadata = clean_metadata(body.get('metadata'))
                thumbnail = None
                value = body.get('thumbnail')
                if value:
                    if not isinstance(value, str) or not value.startswith('data:image/png;base64,'):
                        raise ValueError('预览格式无效')
                    thumbnail = base64.b64decode(value.split(',',1)[1], validate=True)
                    if len(thumbnail) > 170000 or len(thumbnail) < 24 or thumbnail[:8] != b'\x89PNG\r\n\x1a\n':
                        raise ValueError('预览大小或格式无效')
                    width = int.from_bytes(thumbnail[16:20], 'big'); height = int.from_bytes(thumbnail[20:24], 'big')
                    if not 1 <= width <= 400 or not 1 <= height <= 400:
                        raise ValueError('预览尺寸过大')
                db.execute('INSERT INTO events(ip,created,metadata,thumbnail) VALUES (?,?,?,?)', (ip, now, json.dumps(metadata, ensure_ascii=False), thumbnail))
                return finish({'ok':True})

            if path == '/api/admin/status':
                ready = bool(db.execute("SELECT 1 FROM settings WHERE key='password'").fetchone())
                return finish({'ready':ready})
            if path in ('/api/admin/login', '/api/admin/setup'):
                if method != 'POST': return finish({'error':'请求方式无效'}, 400)
                if limited(db, 'login:'+ip, 8, 900):
                    security_record(db, ip, 'login_rate', now)
                    return finish({'error':'尝试过多，请 15 分钟后重试'}, 429)
                stored = db.execute("SELECT value FROM settings WHERE key='password'").fetchone()
                password = body.get('password', '')
                if not isinstance(password, str) or len(password) > 200:
                    return finish({'error':'密码无效'}, 400)
                if path.endswith('/setup'):
                    token_file = DATA / 'setup-token'
                    if stored: return finish({'error':'管理员已初始化'}, 409)
                    token = body.get('token','')
                    if not isinstance(token, str) or not token_file.exists() or not hmac.compare_digest(token, token_file.read_text().strip()):
                        security_record(db, ip, 'login_failed', now)
                        return finish({'error':'初始化码无效'}, 403)
                    if len(password) < 12: return finish({'error':'密码至少 12 个字符'}, 400)
                    db.execute("INSERT INTO settings VALUES ('password', ?)", (password_hash(password),))
                    # Setup code is invalid forever once the password exists.
                else:
                    if not stored: return finish({'error':'管理员尚未初始化'}, 409)
                    if not hmac.compare_digest(password_hash(password, stored[0].split(':')[0]), stored[0]):
                        security_record(db, ip, 'login_failed', now)
                        return finish({'error':'密码错误'}, 401)
                token = secrets.token_urlsafe(32); csrf = secrets.token_urlsafe(24)
                db.execute('INSERT INTO sessions VALUES (?,?,?)', (digest(token), now+8*3600, csrf))
                audit(db, ip, 'setup' if path.endswith('/setup') else 'login', ip, '管理员登录', now)
                headers.append(('Set-Cookie', f'yink_admin={token}; HttpOnly; Path=/api/admin; SameSite=Strict; Max-Age=28800' + ('; Secure' if SECURE else '')))
                return finish({'ok':True, 'csrf':csrf})

            cookie = SimpleCookie()
            try: cookie.load(env.get('HTTP_COOKIE',''))
            except Exception: pass
            token = cookie.get('yink_admin')
            session = db.execute('SELECT * FROM sessions WHERE token=? AND expires>?', (digest(token.value) if token else '', now)).fetchone()
            if not session: return finish({'error':'请先登录'}, 401)
            if method == 'POST' and not hmac.compare_digest(env.get('HTTP_X_CSRF_TOKEN',''), session['csrf']):
                return finish({'error':'操作校验失败，请重新登录'}, 403)
            query = parse_qs(env.get('QUERY_STRING',''), keep_blank_values=True)
            if path == '/api/admin/dashboard' and method == 'GET':
                start,end = report_range(query,now)
                summary = report_summary(db,start,end)
                today_summary = report_summary(db,now//86400,now//86400)
                summary['today'] = today_summary['generated']
                previous_start,previous_end = start-(end-start+1),start-1
                coverage = db.execute("SELECT value FROM settings WHERE key='tracking_start'").fetchone()
                coverage_start = int(coverage[0]) if coverage else now//86400
                previous = report_summary(db,previous_start,previous_end) if previous_start>=max(now//86400-29,coverage_start) else None
                visitor_data = visitor_rows(db,start,end,query)
                events,event_total = event_rows(db,start,end,limit=25)
                bans = [dict(row) for row in db.execute("SELECT b.*,COALESCE(n.note,'') AS note FROM bans b LEFT JOIN ip_notes n ON n.ip=b.ip ORDER BY b.created DESC LIMIT 200")]
                security = [dict(row) for row in db.execute("SELECT s.ip,s.kind,SUM(s.count) AS count,MAX(s.last) AS last,COALESCE(n.note,'') AS note FROM security_days s LEFT JOIN ip_notes n ON n.ip=s.ip WHERE s.day BETWEEN ? AND ? GROUP BY s.ip,s.kind ORDER BY last DESC LIMIT 100",(start,end))]
                alerts = [dict(row) for row in db.execute("SELECT v.ip,v.day,SUM(v.count) AS count,COALESCE(n.note,'') AS note FROM visit_days v LEFT JOIN ip_notes n ON n.ip=v.ip WHERE v.day BETWEEN ? AND ? GROUP BY v.ip,v.day HAVING SUM(v.count)>=60 ORDER BY count DESC LIMIT 20",(start,end))]
                security_totals = {r['kind']:r['count'] for r in db.execute('SELECT kind,SUM(count) AS count FROM security_days WHERE day BETWEEN ? AND ? GROUP BY kind',(start,end))}
                logs = [dict(row) for row in db.execute('SELECT * FROM admin_audit WHERE created>=? AND created<? ORDER BY id DESC LIMIT 100',(start*86400,(end+1)*86400))]
                return finish({'summary':summary,'today':today_summary,'previous':previous,'range':{'start':date_string(start),'end':date_string(end),'timezone':'UTC'},'trend':report_trend(db,start,end),'breakdown':breakdown(db,start,end),'visitors':visitor_data['rows'],'visitorPage':{k:v for k,v in visitor_data.items() if k!='rows'},'events':events,'eventTotal':event_total,'bans':bans,'banTotal':db.execute('SELECT COUNT(*) FROM bans').fetchone()[0],'security':security,'securityTotals':security_totals,'alerts':alerts,'audit':logs,'csrf':session['csrf']})
            if path == '/api/admin/visitors' and method == 'GET':
                start,end = report_range(query,now)
                return finish(visitor_rows(db,start,end,query))
            if path == '/api/admin/events' and method == 'GET':
                start,end = report_range(query,now)
                page = int(query.get('page',['1'])[0])
                if not 1<=page<=1000000: raise ValueError('Invalid page')
                rows,total = event_rows(db,start,end,limit=25,offset=(page-1)*25)
                return finish({'rows':rows,'total':total,'page':page,'pageSize':25})
            if path == '/api/admin/ip' and method == 'GET':
                address = str(ipaddress.ip_address(query.get('ip',[''])[0]))
                start,end = report_range(query,now)
                row = db.execute('SELECT * FROM ip_notes WHERE ip=?',(address,)).fetchone()
                ban = db.execute('SELECT * FROM bans WHERE ip=?',(address,)).fetchone()
                visits = db.execute('SELECT COALESCE(SUM(count),0),MIN(first),MAX(last) FROM visit_days WHERE ip=? AND day BETWEEN ? AND ?',(address,start,end)).fetchone()
                events,total = event_rows(db,start,end,address,20)
                return finish({'ip':address,'note':row['note'] if row else '', 'updated':row['updated'] if row else None,'blocked':bool(ban),'reason':ban['reason'] if ban else '', 'visits':visits[0],'first':visits[1],'last':visits[2],'generated':total,'events':events,'trend':report_trend(db,start,end,address)})
            if path == '/api/admin/note' and method == 'POST':
                address = str(ipaddress.ip_address(body.get('ip','')))
                note = body.get('note')
                if not isinstance(note,str) or len(note)>500 or '\x00' in note: raise ValueError('Invalid note')
                note = note.strip()
                if note: db.execute('INSERT INTO ip_notes VALUES (?,?,?) ON CONFLICT(ip) DO UPDATE SET note=excluded.note,updated=excluded.updated',(address,note,now))
                else: db.execute('DELETE FROM ip_notes WHERE ip=?',(address,))
                audit(db,ip,'note',address,'更新备注' if note else '清除备注',now)
                return finish({'ok':True,'ip':address,'note':note,'updated':now})
            if path == '/api/admin/export' and method == 'GET':
                start,end = report_range(query,now)
                kind = query.get('type',['visitors'])[0]
                if kind=='visitors':
                    data = visitor_rows(db,start,end,query,False)
                    rows = [['IP','备注','页面访问','导出次数','安全拦截','首次访问（北京时间）','最近访问（北京时间）','已限制','原因']]
                    for r in data['rows']:
                        rows.append([r['ip'],r['note'],r['count'],r['generated'],r['security'],time.strftime('%Y-%m-%d %H:%M:%S',time.gmtime(r['first']+28800)),time.strftime('%Y-%m-%d %H:%M:%S',time.gmtime(r['last']+28800)),bool(r['blocked']),r['reason']])
                elif kind=='events':
                    records,_ = event_rows(db,start,end,limit=10000)
                    rows = [['ID','IP','时间（北京时间）','股票','名称','风格','比例','宽','高','模块','标点','区间开始','区间结束','类型']]
                    for r in records:
                        m=r['metadata'];rows.append([r['id'],r['ip'],time.strftime('%Y-%m-%d %H:%M:%S',time.gmtime(r['created']+28800))]+[m.get(k,'') for k in ('symbol','name','style','ratio','width','height','layers','markers','start','end','kind')])
                else: raise ValueError('Invalid export type')
                headers.append(('Content-Disposition',f'attachment; filename="YINK-{kind}-{date_string(start)}-{date_string(end)}.csv"'))
                return finish(csv_response(rows),ctype='text/csv; charset=utf-8')
            if path.startswith('/api/admin/preview/') and method == 'GET':
                try: event_id = int(path.rsplit('/',1)[-1])
                except ValueError: return finish({'error':'记录不存在'},404)
                row = db.execute('SELECT thumbnail FROM events WHERE id=?',(event_id,)).fetchone()
                if row and row[0]: return finish(row[0], ctype='image/png')
                return finish({'error':'此记录没有分享预览'},404)
            if path == '/api/admin/ban' and method == 'POST':
                address = str(ipaddress.ip_address(body.get('ip','')))
                if not isinstance(body.get('blocked'),bool): raise ValueError('Invalid blocked status')
                if body.get('blocked') is True:
                    db.execute('INSERT OR REPLACE INTO bans VALUES (?,?,?)',(address,str(body.get('reason','管理员限制'))[:160],now))
                else: db.execute('DELETE FROM bans WHERE ip=?',(address,))
                audit(db,ip,'ban' if body['blocked'] else 'unban',address,str(body.get('reason','管理员限制'))[:160] if body['blocked'] else '解除限制',now)
                return finish({'ok':True})
            if path == '/api/admin/logout' and method == 'POST':
                db.execute('DELETE FROM sessions WHERE token=?',(session['token'],))
                audit(db,ip,'logout',ip,'管理员退出',now)
                headers.append(('Set-Cookie','yink_admin=; HttpOnly; Path=/api/admin; SameSite=Strict; Max-Age=0' + ('; Secure' if SECURE else '')))
                return finish({'ok':True})
            return finish({'error':'没有此接口'},404)
    except (ValueError, TypeError):
        return finish({'error':'请求内容无效'},400)
    except Exception:
        # Do not expose SQL, filesystem paths, secrets, or submitted passwords.
        return finish({'error':'服务暂不可用'},500)


if __name__ == '__main__':
    from wsgiref.simple_server import make_server
    make_server('127.0.0.1', int(os.environ.get('PORT','8766')), application).serve_forever()
