const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../js/hosted.js'),'utf8');
function context(hostname, protocol) {
  const calls=[];
  const document={body:{append(){throw new Error('Hosted statistics must not add page UI');}},createElement(){throw new Error('Hosted statistics must not create page elements or thumbnails');}};
  const window={location:{hostname,protocol}};
  vm.runInNewContext(source,{window,document,fetch(path,options){calls.push({path,payload:JSON.parse(options.body)});return Promise.resolve();}});
  return {window,calls};
}
for (const [host,protocol] of [['127.0.0.1','http:'],['leekquant.tech','file:'],['example.test','https:']]) {
  const c=context(host,protocol);assert.equal(c.calls.length,0);assert.equal(c.window.YINK.recordGeneration,undefined);
}
const c=context('leekquant.tech','https:');
assert.deepEqual(c.calls[0],{path:'/api/visit',payload:{}});
const artwork={ratio:'4:5',source:{security:{symbol:'QA'},bars:[{date:'2026-01-01',close:987654},{date:'2026-01-02',close:987654}],trade:{capital:987654,events:[{quantity:987654}]}},layers:[{type:'kline',style:{renderer:'ink2'}},{type:'text',text:'PRIVATE-TEXT'},{type:'image',src:'PRIVATE-ASSET'}]};
c.window.YINK.recordGeneration({width:1920,height:2400},artwork,'editor');
assert.equal(c.calls[1].payload.metadata.style,'ink2');assert.equal(c.calls[1].payload.thumbnail,undefined);
const serialized=JSON.stringify(c.calls[1]);for(const secret of ['987654','PRIVATE-TEXT','PRIVATE-ASSET'])assert.ok(!serialized.includes(secret));
c.window.YINK.recordGeneration({width:1920,height:2400},{options:{template:'obsidian'}},'share');
assert.equal(c.calls[2].payload.metadata.style,'obsidian');
assert.ok(c.calls.every(call=>call.payload.thumbnail===undefined));
console.log('Hosted privacy and export telemetry tests passed');
