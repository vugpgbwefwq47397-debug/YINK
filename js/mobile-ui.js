(function(root){
  'use strict';
  if(!root.matchMedia)return;
  const narrow=root.matchMedia('(max-width:680px)');
  const reduced=root.matchMedia('(prefers-reduced-motion:reduce)');
  const html=document.documentElement;
  const editor=document.getElementById('editor-section');
  const nav=document.getElementById('mobile-editor-nav');
  const drag=document.getElementById('mobile-canvas-drag');
  if(!editor||!nav||!drag)return;
  const buttons=['canvas','add','layers'].map(name=>document.getElementById('mobile-panel-'+name));
  let panel='canvas',observer=null;
  function showPanel(name,scroll){
    if(!['canvas','add','layers'].includes(name))return;
    panel=name;editor.setAttribute('data-mobile-panel',name);
    buttons.forEach((button,index)=>button.setAttribute('aria-pressed',String(['canvas','add','layers'][index]===name)));
    if(scroll&&narrow.matches)nav.scrollIntoView({block:'nearest',behavior:reduced.matches?'auto':'smooth'});
  }
  function canDrag(){return !narrow.matches||drag.checked;}
  function syncDrag(){editor.setAttribute('data-mobile-drag',String(drag.checked));}
  function reveal(){
    html.setAttribute('data-mobile-motion',narrow.matches&&!reduced.matches?'on':'off');
    if(!narrow.matches||reduced.matches||!root.IntersectionObserver){
      html.setAttribute('data-mobile-motion','off');return;
    }
    if(!observer)observer=new root.IntersectionObserver(entries=>{
      entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}});
    },{threshold:0,rootMargin:'0px 0px -35px 0px'});
    document.querySelectorAll('.workspace,.studio-section,.style-section,.editor-section,.data-section,.poster-section').forEach(section=>{
      if(!section.classList.contains('mobile-reveal')){section.classList.add('mobile-reveal');observer.observe(section);}
    });
  }
  buttons.forEach((button,index)=>button.addEventListener('click',()=>showPanel(['canvas','add','layers'][index])));
  drag.checked=false;drag.addEventListener('change',syncDrag);
  function listen(query,callback){if(query.addEventListener)query.addEventListener('change',callback);else query.addListener(callback);}
  listen(narrow,()=>{showPanel(panel);reveal();});listen(reduced,reveal);
  html.classList.add('mobile-ready');showPanel(panel);syncDrag();reveal();
  const ns=root.YINK=root.YINK||{};ns.MobileUI={showPanel,canDrag,isMobile:()=>narrow.matches};
})(window);
