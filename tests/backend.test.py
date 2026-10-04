import base64
import importlib.util
import io
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
import tempfile
import unittest

test_data = Path(__file__).resolve().parent / 'backend-sandbox'
test_data.mkdir(exist_ok=True)
os.environ['YINK_DATA'] = str(test_data)
os.environ['YINK_ORIGIN'] = 'https://leekquant.tech'
spec = importlib.util.spec_from_file_location('app', Path(__file__).resolve().parents[1] / 'server/app.py')
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


class Backend(unittest.TestCase):
    def request(self, path, data=None, cookie='', csrf='', ip='203.0.113.1', origin=app.ORIGIN, remote='127.0.0.1', raw=None):
        body = raw if raw is not None else json.dumps(data).encode() if data is not None else b''
        url = urlsplit(path)
        env = {'PATH_INFO':url.path,'QUERY_STRING':url.query,'REQUEST_METHOD':'POST' if data is not None or raw is not None else 'GET', 'REMOTE_ADDR':remote,'HTTP_X_REAL_IP':ip,'HTTP_ORIGIN':origin,'HTTP_COOKIE':cookie,'HTTP_X_CSRF_TOKEN':csrf,'CONTENT_TYPE':'application/json','CONTENT_LENGTH':str(len(body)), 'wsgi.input':io.BytesIO(body)}
        output = {}
        def start(status, headers): output.update(status=int(status.split()[0]),headers=dict(headers))
        output['body'] = b''.join(app.application(env,start))
        if output['headers']['Content-Type'].startswith('application/json'): output['json']=json.loads(output['body'])
        return output

    def setUp(self):
        with app.connect() as db:
            for table in ('settings','visits','visit_days','events','bans','sessions','limits','ip_notes','security_days','admin_audit'): db.execute('DELETE FROM '+table)
        (test_data / 'setup-token').write_text('test-setup-only')

    def login(self):
        result=self.request('/api/admin/setup',{'password':'test-long-password','token':'test-setup-only'})
        self.assertEqual(result['status'],200)
        return result['headers']['Set-Cookie'].split(';')[0], result['json']['csrf']

    def test_auth_and_session(self):
        self.assertEqual(self.request('/api/admin/dashboard')['status'],401)
        self.assertEqual(self.request('/api/admin/setup',{'password':'a','token':'wrong'})['status'],403)
        cookie,csrf=self.login()
        self.assertIn('HttpOnly', self.request('/api/admin/login',{'password':'test-long-password'})['headers']['Set-Cookie'])
        self.assertEqual(self.request('/api/admin/setup',{'password':'test-long-password','token':'test-setup-only'})['status'],409)
        self.assertEqual(self.request('/api/admin/login',{'password':'incorrect'})['status'],401)
        self.assertEqual(self.request('/api/admin/dashboard',cookie=cookie)['status'],200)
        self.assertEqual(self.request('/api/admin/logout',{},cookie=cookie)['status'],403)
        self.assertEqual(self.request('/api/admin/logout',{},cookie=cookie,csrf=csrf)['status'],200)
        self.assertEqual(self.request('/api/admin/dashboard',cookie=cookie)['status'],401)

    def test_visit_generated_private_preview_and_ban(self):
        cookie,csrf=self.login()
        for _ in range(2): self.assertEqual(self.request('/api/visit',{})['status'],200)
        meta={'symbol':'<script>unsafe</script>','width':1920,'height':2400,'layers':5,'markers':0,'secret':'discarded'}
        png=b'\x89PNG\r\n\x1a\n'+b'\0\0\0\rIHDR'+(100).to_bytes(4,'big')*2
        result=self.request('/api/generated',{'metadata':meta,'thumbnail':'data:image/png;base64,'+base64.b64encode(png).decode()})
        self.assertEqual(result['status'],200)
        stats=self.request('/api/admin/dashboard',cookie=cookie)['json']
        self.assertEqual(stats['summary']['visits'],2);self.assertEqual(stats['summary']['generated'],1)
        self.assertNotIn('secret',stats['events'][0]['metadata'])
        event=stats['events'][0]['id']
        self.assertEqual(self.request('/api/admin/preview/'+str(event))['status'],401)
        self.assertEqual(self.request('/api/admin/preview/'+str(event),cookie=cookie)['body'],png)
        self.assertEqual(self.request('/api/admin/ban',{'ip':'203.0.113.1','blocked':True},cookie=cookie,csrf=csrf)['status'],200)
        self.assertEqual(self.request('/api/access')['status'],403)
        self.assertEqual(self.request('/api/visit',{})['status'],403)
        self.assertEqual(self.request('/api/admin/ban',{'ip':'203.0.113.1','blocked':False},cookie=cookie,csrf=csrf)['status'],200)
        self.assertEqual(self.request('/api/access')['status'],200)

    def test_input_origin_spoofing_and_limits(self):
        self.assertEqual(self.request('/api/visit',{},origin='https://evil.test')['status'],403)
        self.assertEqual(self.request('/api/generated',{'metadata':{'width':-1}})['status'],400)
        self.assertEqual(self.request('/api/visit',raw=b'{broken')['status'],400)
        self.assertEqual(self.request('/api/visit',raw=b'x'*250001)['status'],413)
        self.request('/api/visit',{},ip='198.51.100.2',remote='198.51.100.3')
        with app.connect() as db: self.assertEqual(db.execute('SELECT ip FROM visits').fetchone()[0],'198.51.100.3')
        for _ in range(120): self.request('/api/visit',{},ip='203.0.113.8')
        self.assertEqual(self.request('/api/visit',{},ip='203.0.113.8')['status'],429)
        self.login()
        for _ in range(7): self.request('/api/admin/login',{'password':'incorrect'},ip='203.0.113.5')
        self.assertEqual(self.request('/api/admin/login',{'password':'incorrect'},ip='203.0.113.5')['status'],401)
        self.assertEqual(self.request('/api/admin/login',{'password':'incorrect'},ip='203.0.113.5')['status'],429)

    def test_retention(self):
        cookie,csrf=self.login()
        with app.connect() as db:
            db.execute("DELETE FROM settings WHERE key='cleanup'")
            db.execute("INSERT INTO events(ip,created,metadata) VALUES ('old',1,'{}')")
            db.execute("INSERT INTO visit_days VALUES ('old',1,100,1,2)")
        data=self.request('/api/admin/dashboard',cookie=cookie)['json']
        self.assertEqual(data['summary']['visits'],0);self.assertEqual(data['summary']['generated'],0)

    def test_notes_search_csv_and_audit(self):
        cookie,csrf=self.login()
        self.request('/api/visit',{})
        endpoint='/api/admin/note'
        note={'ip':'203.0.113.1','note':'=HYPERLINK("bad")'}
        self.assertEqual(self.request(endpoint,note)['status'],401)
        self.assertEqual(self.request(endpoint,note,cookie=cookie)['status'],403)
        self.assertEqual(self.request(endpoint,note,cookie=cookie,csrf=csrf,origin='https://evil.test')['status'],403)
        self.assertEqual(self.request(endpoint,note,cookie=cookie,csrf=csrf)['status'],200)
        self.assertEqual(self.request('/api/admin/visitors?q=HYPERLINK',cookie=cookie)['json']['total'],1)
        self.assertEqual(self.request('/api/admin/visitors?q=%25',cookie=cookie)['json']['total'],0)
        detail=self.request('/api/admin/ip?ip=203.0.113.1',cookie=cookie)['json']
        self.assertEqual(detail['note'],note['note']);self.assertEqual(detail['visits'],1)
        exported=self.request('/api/admin/export?type=visitors',cookie=cookie)
        self.assertEqual(exported['status'],200)
        self.assertTrue(exported['body'].startswith(b'\xef\xbb\xbf'))
        import csv
        values=list(csv.reader(io.StringIO(exported['body'].decode('utf-8-sig'))))
        self.assertEqual(values[1][1],"'"+note['note'])
        self.assertEqual(self.request(endpoint,{'ip':'bad','note':'x'},cookie=cookie,csrf=csrf)['status'],400)
        self.assertEqual(self.request(endpoint,{'ip':note['ip'],'note':'x'*501},cookie=cookie,csrf=csrf)['status'],400)
        logs=self.request('/api/admin/dashboard',cookie=cookie)['json']['audit']
        self.assertEqual(logs[0]['action'],'note');self.assertNotIn('password',str(logs))
        self.request(endpoint,{'ip':note['ip'],'note':''},cookie=cookie,csrf=csrf)
        self.assertEqual(self.request('/api/admin/ip?ip=203.0.113.1',cookie=cookie)['json']['note'],'')

    def test_range_stats_trend_and_pagination(self):
        cookie,csrf=self.login()
        now=int(app.time.time());day=now//86400
        with app.connect() as db:
            db.execute("INSERT OR REPLACE INTO settings VALUES ('tracking_start',?)",(str(day-29),))
            for offset,count in ((0,3),(1,5),(10,9)):
                timestamp=(day-offset)*86400+100
                db.execute('INSERT INTO visit_days VALUES (?,?,?,?,?)',('203.0.113.1',day-offset,count,timestamp,timestamp))
            db.execute('INSERT INTO visits VALUES (?,?,?,?)',('203.0.113.1',(day-10)*86400,now,17))
            for offset,ip in ((0,'203.0.113.1'),(1,'203.0.113.1'),(0,'203.0.113.99')):
                db.execute('INSERT INTO events(ip,created,metadata) VALUES (?,?,?)',(ip,(day-offset)*86400+100,json.dumps({'symbol':'TEST','style':'ink2','ratio':'1:1'})))
        data=self.request('/api/admin/dashboard?days=7',cookie=cookie)['json']
        self.assertEqual(data['summary']['visits'],8);self.assertEqual(data['summary']['ips'],1)
        self.assertEqual(data['summary']['generated'],3);self.assertEqual(data['summary']['exportRate'],100)
        self.assertEqual(data['summary']['generationIps'],2);self.assertEqual(data['summary']['returningIps'],1)
        self.assertEqual(len(data['trend']),7);self.assertEqual(data['trend'][-1]['visits'],3)
        self.assertEqual(data['previous']['visits'],9);self.assertEqual(data['breakdown']['style'][0]['count'],3)
        self.assertEqual(self.request('/api/admin/dashboard?days=30',cookie=cookie)['json']['previous'],None)
        self.assertEqual(self.request('/api/admin/dashboard?start=2020-01-01&end=2020-01-02',cookie=cookie)['status'],400)
        self.assertEqual(self.request('/api/admin/dashboard?days=999',cookie=cookie)['status'],400)
        with app.connect() as db:
            for i in range(30):db.execute('INSERT INTO visit_days VALUES (?,?,?,?,?)',(f'198.51.100.{i}',day,1,now,now))
        first=self.request('/api/admin/visitors?days=7',cookie=cookie)['json']
        second=self.request('/api/admin/visitors?days=7&page=2',cookie=cookie)['json']
        self.assertEqual(first['total'],31);self.assertEqual(len(first['rows']),25);self.assertEqual(len(second['rows']),6)
        self.assertFalse({r['ip'] for r in first['rows']} & {r['ip'] for r in second['rows']})
        self.assertEqual(self.request('/api/admin/visitors?sort=sql',cookie=cookie)['status'],400)
        self.assertEqual(self.request('/api/admin/events?page=0',cookie=cookie)['status'],400)
        self.assertEqual(self.request('/api/admin/export?type=events')['status'],401)

    def test_security_signals_and_persistent_note(self):
        cookie,csrf=self.login()
        self.request('/api/admin/note',{'ip':'203.0.113.55','note':'维护测试'},cookie=cookie,csrf=csrf)
        self.request('/api/admin/ban',{'ip':'203.0.113.55','blocked':True,'reason':'test'},cookie=cookie,csrf=csrf)
        self.request('/api/access',ip='203.0.113.55')
        self.request('/api/admin/login',{'password':'wrong'},ip='203.0.113.56')
        data=self.request('/api/admin/dashboard',cookie=cookie)['json']
        self.assertEqual(data['securityTotals']['blocked'],1);self.assertEqual(data['securityTotals']['login_failed'],1)
        self.assertEqual(data['bans'][0]['note'],'维护测试')
        self.assertEqual(self.request('/api/admin/ban',{'ip':'203.0.113.55','blocked':'false'},cookie=cookie,csrf=csrf)['status'],400)
        with app.connect() as db:
            db.execute("DELETE FROM settings WHERE key='cleanup'")
            db.execute("INSERT INTO admin_audit(created,actor,action,target,detail) VALUES (1,'old','note','old','old')")
            db.execute("INSERT INTO security_days VALUES ('old',1,'blocked',10,1)")
        data=self.request('/api/admin/dashboard',cookie=cookie)['json']
        self.assertNotIn('old',str(data['security']));self.assertNotIn('old',str(data['audit']))
        self.assertEqual(self.request('/api/admin/ip?ip=203.0.113.55',cookie=cookie)['json']['note'],'维护测试')

    def test_schema_upgrade_preserves_existing_data(self):
        cookie,csrf=self.login()
        self.request('/api/visit',{})
        self.request('/api/admin/note',{'ip':'203.0.113.1','note':'保留备注'},cookie=cookie,csrf=csrf)
        app.init();app.init()
        result=self.request('/api/admin/dashboard',cookie=cookie)
        self.assertEqual(result['status'],200)
        self.assertEqual(result['json']['summary']['visits'],1)
        self.assertEqual(result['json']['visitors'][0]['note'],'保留备注')


if __name__=='__main__': unittest.main()
