(function(root){
  'use strict';
  const ns=root.YINK=root.YINK||{};
  // Explicit host allowlist: local/offline copies never send telemetry.
  if(!root.location || root.location.protocol!=='https:' || root.location.hostname!=='leekquant.tech')return;
  function send(path,data){return fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),keepalive:JSON.stringify(data).length<60000}).catch(function(){});}
  send('visit',{});
  ns.recordGeneration=function(canvas,artwork,kind){
    try{
      const source=artwork.source||artwork,security=source.security||{},bars=source.bars||[],layers=artwork.layers||[],kline=layers.find(function(l){return l.type==='kline';}),style=kline&&kline.style||artwork.klineStyle||{},trade=source.trade||{},events=trade.events||[];
      const metadata={symbol:String(security.symbol||''),name:String(security.name||''),start:String(bars[0]&&bars[0].date||''),end:String(bars.length&&bars[bars.length-1].date||''),style:String(style.renderer||artwork.options&&artwork.options.template||artwork.template||'standard'),ratio:String(artwork.ratio||kind||''),kind:kind||'editor',width:canvas.width,height:canvas.height,layers:layers.length,markers:events.length||(trade.buy?2:0)};
      const payload={metadata:metadata};
      send('generated',payload);
    }catch(error){/* Analytics must never interrupt local export. */}
  };
})(window);
