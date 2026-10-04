const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../server/admin.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const nodes=new Map(),storage=new Map(),requests=[];
class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.value='';this.hidden=false;this.disabled=false;this.checked=false;this.style={};this.classes=new Set();this.classList={add:c=>this.classes.add(c),remove:c=>this.classes.delete(c)};}
  set textContent(value){this.text=String(value);this.children=[];} get textContent(){return (this.text||'')+this.children.map(c=>c.textContent).join('');}
  set innerHTML(value){throw new Error('Unsafe HTML insertion');}
  append(...items){this.children.push(...items);} replaceChildren(...items){this.text='';this.children=items;}
  setAttribute(k,v){this.attrs[k]=String(v);} focus(){document.activeElement=this;} remove(){this.removed=true;}
  click(){if(this.onclick)return this.onclick({target:this});}
  querySelectorAll(){return this.children.flatMap(c=>[c,...c.querySelectorAll()]);}
}
for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes.set(id,new Element());
nodes.get('visitor-state').value='all';nodes.get('visitor-sort').value='last';nodes.get('dashboard').hidden=true;nodes.get('ip-modal').hidden=true;
const pages=['overview','visitors','exports','security'].map(page=>{const b=new Element('button');b.dataset.page=page;return b;});
const periods=['1','7','30','custom'].map(days=>{const b=new Element('button');b.dataset.days=days;return b;});
const document={getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag),documentElement:new Element('html'),body:new Element('body'),activeElement:null,hidden:false,contains:e=>!e.removed,querySelectorAll:q=>q==='[data-page]'?pages:q==='[data-days]'?periods:[],addEventListener(){}};
let interval,unauthorized=false,delayedDetail=null;
const visitor={ip:'203.0.113.2',note:'<img src=x onerror=alert(1)>',count:8,generated:2,security:0,last:1791100000,blocked:false};
const event={id:1,ip:visitor.ip,created:1791100000,preview:false,metadata:{symbol:'TEST',style:'ink2',ratio:'1:1',width:1000,height:1000,layers:5,markers:0}};
const data={csrf:'test-csrf',summary:{visits:8,ips:1,generated:2,exportRate:100,exportingVisitors:1,returningIps:0},today:{visits:8,ips:1,generated:2},previous:null,range:{start:'2026-09-28',end:'2026-10-04'},trend:[{date:'2026-10-04',visits:8,ips:1,generated:2}],breakdown:{symbol:[{label:'TEST',count:2}],style:[{label:'ink2',count:2}],ratio:[{label:'1:1',count:2}],kind:[{label:'editor',count:2}]},visitors:[visitor],visitorPage:{total:1,page:1,pageSize:25},events:[event],eventTotal:1,banTotal:0,bans:[],securityTotals:{},security:[],alerts:[],audit:[]};
async function fetch(url,options={}){
  requests.push({url,options});const parsed=new URL(url,'https://local.test');
  if(unauthorized&&parsed.pathname!='/api/admin/status')return {ok:false,status:401,json:async()=>({error:'请先登录'})};
  let result={ok:true};
  if(parsed.pathname.endsWith('/status'))result={ready:true};
  else if(parsed.pathname.endsWith('/dashboard'))result=data;
  else if(parsed.pathname.endsWith('/visitors'))result={rows:[visitor],total:1,page:1,pageSize:25};
  else if(parsed.pathname.endsWith('/events'))result={rows:[event],total:1,page:1,pageSize:25};
  else if(parsed.pathname.endsWith('/ip')){result={...visitor,visits:8,events:[event],first:1791100000};if(delayedDetail)await delayedDetail;}
  else if(parsed.pathname.endsWith('/note')){visitor.note=JSON.parse(options.body).note;result={note:visitor.note,updated:1791100001};}
  return {ok:true,status:200,json:async()=>result,blob:async()=>new Blob(['test CSV'])};
}
vm.runInNewContext(script,{document,Node:Element,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},fetch,URLSearchParams,URL,Blob,Intl,Date,confirm:()=>true,setTimeout:fn=>fn(),setInterval:fn=>{interval=fn;}});
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
(async()=>{
 await flush();assert.equal(nodes.get('dashboard').hidden,false);assert.equal(nodes.get('metrics').children.length,4);
 assert.match(nodes.get('visitors').textContent,/<img src=x onerror=alert\(1\)>/,'Untrusted note is rendered literally');
 assert.match(nodes.get('styles').textContent,/水墨风 2/);
 nodes.get('theme').click();assert.equal(document.documentElement.dataset.theme,'dark');assert.equal(storage.get('yink.admin.theme'),'dark');
 pages[1].click();assert.equal(nodes.get('page-overview').hidden,true);assert.equal(nodes.get('page-visitors').hidden,false);
 nodes.get('visitor-search').value='团队';await nodes.get('visitor-filter').onsubmit({preventDefault(){}});await flush();assert.ok(requests.some(r=>decodeURIComponent(r.url).includes('q=团队')));
 const detailButton=nodes.get('visitors').children[0].children[7].children[0];detailButton.click();await flush();assert.equal(nodes.get('ip-modal').hidden,false);assert.equal(nodes.get('detail-note').value,visitor.note);
 nodes.get('detail-note').value='团队测试';await nodes.get('note-form').onsubmit({preventDefault(){}});await flush();
 const noteRequest=requests.find(r=>r.url==='/api/admin/note');assert.equal(noteRequest.options.headers['X-CSRF-Token'],'test-csrf');assert.equal(visitor.note,'团队测试');assert.match(nodes.get('note-status').textContent,/已保存/);
 nodes.get('close-detail').click();assert.equal(nodes.get('ip-modal').hidden,true);
 let release;delayedDetail=new Promise(resolve=>{release=resolve;});nodes.get('visitors').children[0].children[7].children[0].click();await flush();nodes.get('close-detail').click();release();await flush();assert.equal(nodes.get('ip-modal').hidden,true);delayedDetail=null;
 unauthorized=true;await nodes.get('refresh').click();await flush();assert.equal(nodes.get('dashboard').hidden,true);assert.equal(nodes.get('auth').hidden,false);assert.equal(nodes.get('refresh').disabled,false);
 const before=requests.length;nodes.get('auto-refresh').checked=true;interval();assert.equal(requests.length,before,'Signed-out page must not poll statistics');
 console.log('Admin UI interaction tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
