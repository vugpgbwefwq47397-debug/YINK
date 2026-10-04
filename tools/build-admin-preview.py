"""Create a labelled admin UI demo using only fictional data and in-page mock API."""
from datetime import datetime, timezone
import json
from pathlib import Path

root=Path(__file__).resolve().parent.parent
today=int(datetime.now(timezone.utc).timestamp())//86400
visitors=[{'ip':f'203.0.113.{i+10}','note':['团队测试','日常使用','需观察',''][i%4],'count':(8-i)*13,'generated':max(0,8-i),'security':3 if i==2 else 0,'first':today*86400+100,'last':today*86400+3600-i*300,'blocked':i==2} for i in range(8)]
trend=[{'date':datetime.fromtimestamp((today-i)*86400,timezone.utc).date().isoformat(),'visits':80+i*13+(i%3)*17,'ips':8,'generated':3+i%5} for i in range(6,-1,-1)]
events=[{'id':i+1,'ip':v['ip'],'created':v['last'],'preview':False,'metadata':{'symbol':['AAPL','600519','00700','NVDA'][i%4],'name':'示例作品','style':['ink','ink2','standard'][i%3],'ratio':'4:5','width':2000,'height':2500,'layers':6,'markers':2,'start':'2026-09-01','end':'2026-09-30','kind':'editor'}} for i,v in enumerate(visitors)]
payload={'csrf':'preview-only','summary':{'visits':sum(r['visits'] for r in trend),'ips':8,'generated':sum(r['generated'] for r in trend),'exportRate':75.0,'exportingVisitors':6,'returningIps':3},'today':trend[-1],'previous':None,'range':{'start':trend[0]['date'],'end':trend[-1]['date']},'trend':trend,'breakdown':{'symbol':[{'label':'AAPL','count':12},{'label':'600519','count':8},{'label':'NVDA','count':6}],'style':[{'label':'ink2','count':14},{'label':'ink','count':8},{'label':'standard','count':4}],'ratio':[{'label':'4:5','count':18},{'label':'1:1','count':8}],'kind':[{'label':'editor','count':26}]},'visitors':visitors,'visitorPage':{'total':8,'page':1,'pageSize':25},'events':events,'eventTotal':8,'bans':[{'ip':visitors[2]['ip'],'note':'需观察','reason':'示例限制','created':today*86400}],'banTotal':1,'securityTotals':{'blocked':3,'login_failed':2},'security':[{'ip':visitors[2]['ip'],'kind':'blocked','count':3,'note':'需观察'}],'alerts':[{'ip':v['ip'],'day':today,'count':v['count'],'note':v['note']} for v in visitors if v['count']>=60],'audit':[{'created':today*86400,'actor':'192.0.2.1','action':'note','target':visitors[0]['ip'],'detail':'示例操作'}]}
mock='''<script>
const demoData=DEMO_JSON;
window.fetch=async function(url,options={}) {
 const q=new URL(url,location.href),name=q.pathname.split('/').pop();let result={ok:true};
 if(name==='status')result={ready:true};
 if(name==='dashboard')result=demoData;
 if(name==='visitors'){const search=q.searchParams.get('q')||'',state=q.searchParams.get('state');const rows=demoData.visitors.filter(v=>(v.ip.includes(search)||v.note.includes(search))&&(!state||state==='all'||(state==='blocked')===v.blocked));result={rows,total:rows.length,page:1,pageSize:25};}
 if(name==='events')result={rows:demoData.events,total:8,page:1,pageSize:25};
 if(name==='ip'){const v=demoData.visitors.find(v=>v.ip===q.searchParams.get('ip'));result={...v,visits:v.count,events:demoData.events.filter(e=>e.ip===v.ip),reason:'示例限制'};}
 if(name==='note'){const body=JSON.parse(options.body),v=demoData.visitors.find(v=>v.ip===body.ip);v.note=body.note;result={note:v.note,updated:Math.floor(Date.now()/1000)};}
 if(name==='ban'){const body=JSON.parse(options.body),v=demoData.visitors.find(v=>v.ip===body.ip);if(v)v.blocked=body.blocked;demoData.bans=demoData.visitors.filter(v=>v.blocked).map(v=>({...v,reason:'示例限制',created:Math.floor(Date.now()/1000)}));demoData.banTotal=demoData.bans.length;}
 return {ok:true,status:200,json:async()=>structuredClone(result),blob:async()=>new Blob(['界面演示，非真实统计'],{type:'text/csv'})};
};
</script>'''.replace('DEMO_JSON',json.dumps(payload,ensure_ascii=False))
html=(root/'server/admin.html').read_text(encoding='utf-8')
html=html.replace("url('/assets/fonts/ChillGSans.otf')","url('../assets/fonts/ChillGSans.otf')").replace('src="/assets/yink-icon.svg"','src="../assets/yink-icon.svg"')
html=html.replace('<main class="main">','<main class="main"><div class="notice">界面演示 · 全部为虚构示例数据，操作仅在当前页面模拟，不连接真实后台。</div>')
html=html.replace('<script>\n\'use strict\';',mock+'<script>\n\'use strict\';')
output=root/'dist/YINK-admin-preview.html';output.write_text(html,encoding='utf-8')
print('Demo generated:',output)
