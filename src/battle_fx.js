/* Presentation only. Actual combat outcomes arrive as transient action receipts. */
const BATTLE_FX=(()=>{
 const TAU=Math.PI*2,clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>1-(1-clamp(v))**3;
 const palettes={fire:['#ffac66','#eb5d63','#ffe4aa'],water:['#89e7ec','#448bcf','#dcffff'],lightning:['#ffeb98','#8779ed','#fffbd5'],wind:['#b8f0b6','#57bba1','#e9ffe0'],earth:['#e5bd85','#a57859','#ffe5af'],sound:['#e6b5ef','#9984d7','#fff0fe'],light:['#fff0ac','#dca56c','#ffffff'],neutral:['#c6e2ed','#6e9fb8','#ffffff'],heal:['#adf1c4','#60b7a5','#f1ffe0'],ward:['#b7caff','#8b93d6','#e5edff'],mp:['#c6bbff','#8c81d7','#e7eaff']};
 const attrTheme={熱:'fire',水:'water',電:'lightning',風:'wind',土:'earth',音:'sound',光:'light',無:'neutral'};
 const jobTheme={J01:'earth',J02:'lightning',J03:'heal',J04:'water',J05:'lightning',J06:'fire',J07:'wind',J08:'sound',J09:'earth',J10:'sound',J11:'water',J12:'wind',J13:'heal',J14:'sound',J15:'lightning',J16:'wind',J17:'light',J18:'heal',J19:'light',J20:'wind',J21:'light',J22:'sound'};
 let active=null;
 function theme(meta){const act=meta?.action||{},job=act.job||meta?.job;return act.type==='attack'?'neutral':act.type==='meter'||act.type==='signature'?'light':jobTheme[job]||'sound';}
 function describe(before,run){
  const meta=before.fx||{},base=theme(meta),events=[];
  for(const [i,v]of(meta.events||[]).entries()){
   if(!['hit','miss','heal','revive','mp','ward','guard','charge'].includes(v.kind))continue;
   if(v.side!=='party'&&v.side!=='enemy')continue;
   const target=v.side==='enemy'?run.enemies.find(e=>e.slot===v.slot):run.party[v.slot];if(!target)continue;
   const kind=v.kind==='hit'?(v.counter?'impact':meta.action?.type==='attack'?'slash':'spell'):v.kind;
   const color=['heal','revive'].includes(kind)?'heal':kind==='mp'?'mp':['ward','guard'].includes(kind)?'ward':v.counter?(attrTheme[v.attr]||'fire'):base;
   events.push({...v,kind,theme:color,delay:v.counter?300+(i%3)*20:80+(i%3)*24,critical:!!v.critical,amount:Math.max(0,Number(v.amount)||0)});
  }
  if(!events.some(e=>!e.counter)&&['comment','family','rest','skill','inherit','extra','signature','meter'].includes(meta.action?.type))events.push({side:'party',slot:meta.actor,kind:'aura',theme:base,delay:20});
  return {actor:meta.actor??0,theme:base,burst:['signature','meter'].includes(meta.action?.type),events:events.slice(0,24)};
 }
 const circle=(g,x,y,r,color,width=1)=>{g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.arc(x,y,Math.max(.1,r),0,TAU);g.stroke();};
 const line=(g,points,color,width)=>{g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();};
 function star(g,x,y,r,color,rotation=0){g.save();g.translate(x,y);g.rotate(rotation);g.fillStyle=color;g.beginPath();for(let i=0;i<8;i++){const a=i*TAU/8,rr=i%2?r*.25:r;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();g.fill();g.restore();}
 function glow(g,x,y,r,colors,alpha=.6){const grad=g.createRadialGradient(x,y,0,x,y,Math.max(1,r));grad.addColorStop(0,colors[2]);grad.addColorStop(.18,colors[0]);grad.addColorStop(1,colors[1]+'00');g.save();g.globalAlpha*=alpha;g.fillStyle=grad;g.fillRect(x-r,y-r,r*2,r*2);g.restore();}
 function seal(g,x,y,r,t,c){
  g.save();g.translate(x,y);g.scale(1,.42);g.rotate(t*.8);circle(g,0,0,r,c[0],1.2);circle(g,0,0,r*.77,c[1],1);
  for(let i=0;i<8;i++){const a=i*TAU/8;star(g,Math.cos(a)*r,Math.sin(a)*r,3,c[2],a);}
  const pts=[];for(let i=0;i<=6;i++){const a=i*TAU/3;pts.push([Math.cos(a)*r*.65,Math.sin(a)*r*.65]);}line(g,pts,c[0],1);g.restore();
 }
 function particles(g,x,y,t,c,count=18,style='spark'){
  const p=ease(t);g.save();g.globalAlpha*=1-clamp((t-.55)/.45);
  for(let i=0;i<count;i++){const a=i*2.39996+(i%3)*.2,dist=(10+(i*17%39))*p,xx=x+Math.cos(a)*dist,yy=y+Math.sin(a)*dist*(style==='rise'?.35:.7)-(style==='rise'?t*45:0)+t*t*14;
   if(style==='rise'){star(g,xx,yy,2+(i%3),c[i%3],t+i);}else{line(g,[[xx,yy],[xx-Math.cos(a)*(3+6*(1-t)),yy-Math.sin(a)*5]],c[i%3],i%3===0?2:1);}
  }g.restore();
 }
 function beam(g,from,to,p,c){
  const t=ease(p),x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t-Math.sin(t*Math.PI)*24;
  g.save();g.globalAlpha*=Math.min(1,p*5);for(let i=6;i>=0;i--){const tt=Math.max(0,t-i*.035);glow(g,from.x+(to.x-from.x)*tt,from.y+(to.y-from.y)*tt-Math.sin(tt*Math.PI)*24,5+i*.4,c,(7-i)/12);}star(g,x,y,7,c[2],p*4);g.restore();
 }
 function elemental(g,x,y,p,c,style){
  glow(g,x,y,55*(.6+p),c,.36*(1-p));
  if(style==='lightning'){
   for(let branch=0;branch<3;branch++){const pts=[];for(let i=0;i<8;i++)pts.push([x+(i%2?1:-1)*(4+(i*7+branch*13)%16)+branch*8-8,y-65+i*12]);line(g,pts,c[1],5);line(g,pts,c[2],1.5);}circle(g,x,y,20+p*20,c[0],2);
  }else if(style==='fire'){
   for(let i=0;i<8;i++){const a=i*2.4,xx=x+Math.cos(a)*(10+p*24),yy=y+Math.sin(a)*12-p*(24+i%3*7);g.fillStyle=c[i%2];g.beginPath();g.moveTo(xx-5,yy+8);g.quadraticCurveTo(xx-8,yy,xx+Math.sin(p*8+i)*6,yy-15);g.quadraticCurveTo(xx+10,yy+2,xx+5,yy+8);g.fill();}particles(g,x,y,p,c,20,'rise');
  }else if(style==='water'){
   for(let i=0;i<4;i++){g.save();g.translate(x,y-5-i*9*p);g.scale(1,.35);circle(g,0,0,12+p*40+i*4,c[i%3],2);g.restore();}for(let i=0;i<8;i++){g.fillStyle=c[i%3];g.beginPath();g.ellipse(x+Math.sin(i*3)*p*38,y-Math.sin(p*Math.PI)*(12+i*4),2,4,0,0,TAU);g.fill();}
  }else if(style==='wind'||style==='sound'){
   for(let i=0;i<4;i++){g.strokeStyle=c[i%3];g.lineWidth=2;g.beginPath();g.ellipse(x,y-i*6,10+p*42+i*3,6+p*15,p*2+i*.4,i*.5,i*.5+Math.PI*1.6);g.stroke();}particles(g,x,y,p,c,12);
  }else if(style==='earth'){
   for(let i=0;i<6;i++){const xx=x+(i-2.5)*11,yy=y+18,hh=Math.sin(p*Math.PI)*(18+i%3*10);g.fillStyle=c[i%2];g.beginPath();g.moveTo(xx-6,yy);g.lineTo(xx-3,yy-hh);g.lineTo(xx+2,yy-hh-7);g.lineTo(xx+6,yy);g.fill();line(g,[[xx-2,yy-hh],[xx+1,yy-4]],c[2],1);}particles(g,x,y,p,c,14);
  }else{
   line(g,[[x-44,y+10],[x+44,y-10]],c[1],5*(1-p)+1);line(g,[[x,y-48],[x,y+36]],c[0],4*(1-p)+1);star(g,x,y,35*(1-p)+5,c[2],p*.7);circle(g,x,y,10+ease(p)*38,c[0],2);particles(g,x,y,p,c,22);
  }
 }
 function draw(g,event,ms){
  const elapsed=ms-event.delay;if(elapsed<0||elapsed>470)return;
  const p=elapsed/470,c=palettes[event.theme]||palettes.neutral,{x,y}=event.target,from=event.from||{x,y:y+60};
  g.save();g.globalAlpha=1-clamp((p-.65)/.35);
  if(['spell','slash','impact'].includes(event.kind)){
   if(event.kind==='spell'&&p<.34){seal(g,from.x,from.y,20+ease(p/.34)*14,p,c);beam(g,from,{x,y},p/.34,c);}
   const q=clamp((p-(event.kind==='spell'?.3:.06))/(event.kind==='spell'?.7:.94));
   if(q>0){
    if(event.kind==='slash'){
     g.save();g.translate(x,y);g.rotate(-.65);const reach=20+ease(q)*28;
     for(let i=0;i<3;i++){g.strokeStyle=c[i];g.lineWidth=[11,5,1.7][i]*(1-q*.65);g.beginPath();g.ellipse(0,0,reach,reach*.3,0,Math.PI*.12,Math.PI*(.3+1.45*ease(q)));g.stroke();}g.restore();
     if(event.critical){line(g,[[x-30,y-26],[x+30,y+26]],'#ffe1a1',3*(1-q));star(g,x,y,20*(1-q)+4,'#fff3c5');}particles(g,x,y,q,c,event.critical?28:18);
    }else elemental(g,x,y,q,c,event.theme);
   }
  }else if(['heal','revive','mp','aura'].includes(event.kind)){
   seal(g,x,y+12,18+ease(p)*20,p,c);glow(g,x,y,28,c,.22);particles(g,x,y,p,c,20,'rise');
   if(event.kind==='revive'){line(g,[[x,y+16],[x,y-44*p]],c[2],3*(1-p)+1);circle(g,x,y,8+ease(p)*25,c[0],2);}
  }else if(['guard','ward'].includes(event.kind)){
   const r=15+ease(p)*14;g.save();g.translate(x,y);g.fillStyle=c[1]+'40';g.strokeStyle=c[0];g.lineWidth=2;g.beginPath();g.moveTo(0,-r);g.lineTo(r,-r*.6);g.lineTo(r*.8,r*.35);g.quadraticCurveTo(r*.6,r*.8,0,r);g.quadraticCurveTo(-r*.6,r*.8,-r*.8,r*.35);g.lineTo(-r,-r*.6);g.closePath();g.fill();g.stroke();line(g,[[-r*.5,-2],[0,r*.35],[r*.55,-r*.4]],c[2],2);g.restore();particles(g,x,y,p,c,8);
  }else if(event.kind==='charge'){
   seal(g,x,y+12,28*(1-p*.4),p,c);for(let i=0;i<12;i++){const a=i*TAU/12,rr=36*(1-p);star(g,x+Math.cos(a)*rr,y+Math.sin(a)*rr*.7,2,c[i%3],p);}glow(g,x,y,14+p*15,c,.4);
  }else if(event.kind==='miss'){
   for(let i=0;i<3;i++)line(g,[[x-28+p*14,y+i*5],[x-13+p*14,y+i*5-7]],'#d6e9ed',1);
  }
  if(p>.18&&event.kind!=='charge'&&event.kind!=='aura'){
   const text=event.kind==='miss'?'MISS':event.kind==='guard'?'GUARD':event.kind==='ward'?'防護':event.kind==='revive'?'復帰':event.amount>0?(['heal','mp'].includes(event.kind)?'+':'−')+event.amount:'';
   if(text){g.font='800 '+(event.critical?22:18)+'px "Quest Gothic", sans-serif';g.textAlign='center';g.lineWidth=4;g.strokeStyle='#142532';const yy=y-17-ease((p-.18)/.82)*22;g.strokeText(text,x,yy);g.fillStyle=event.counter?'#ffa399':['heal','revive','mp'].includes(event.kind)?c[0]:c[2];g.fillText(text,x,yy);if(event.critical){g.font='800 10px "Quest Gothic", sans-serif';g.fillStyle='#ffe1a1';g.fillText('CRITICAL',x,yy-20);}}
  }
  g.restore();
 }
 function cancel(){if(!active)return;cancelAnimationFrame(active.raf);active.canvas.remove();for(const a of active.animations)a.cancel();active=null;}
 function play(before,run){
  cancel();if(reducedMotion()||document.hidden||G.screen!=='battle'||G.sheet||G.dlg)return;
  const scene=document.querySelector('.battle');if(!scene)return;const rect=scene.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
  const model=describe(before,run);if(!model.events.length)return;
  const center=el=>{if(!el)return null;const r=el.getBoundingClientRect();return{x:r.left-rect.left+r.width/2,y:r.top-rect.top+r.height/2};};
  const actorEl=document.querySelector('.pcard[data-i="'+model.actor+'"]'),origin=center(actorEl);const targets=[];
  for(const e of model.events){const el=document.querySelector(e.side==='enemy'?'#ec'+e.slot+' .esprite':'.pcard[data-i="'+e.slot+'"]'),target=center(el);if(!target)continue;
   const source=e.counter?center(document.querySelector('#ec'+e.source+' .esprite')):origin;
   targets.push({...e,target,from:source||target,el});}
  if(!targets.length)return;
  const canvas=document.createElement('canvas'),dpr=Math.min(2,window.devicePixelRatio||1);canvas.className='battle-fx-layer';canvas.setAttribute('aria-hidden','true');canvas.width=Math.ceil(rect.width*dpr);canvas.height=Math.ceil(rect.height*dpr);canvas.style.width=rect.width+'px';canvas.style.height=rect.height+'px';scene.appendChild(canvas);
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const state=G.st,animations=[],token={canvas,animations,raf:0};active=token;
  // Short lunge/recoil runs on the existing card, without changing layout or hitboxes.
  if(actorEl?.animate&&targets.some(e=>!e.counter&&['slash','spell'].includes(e.kind)))animations.push(actorEl.animate([{transform:'translateY(0)',filter:'brightness(1)'},{transform:'translateY(-4px)',filter:'brightness(1.35)'},{transform:'translateY(0)',filter:'brightness(1)'}],{duration:320,easing:'ease-out'}));
  for(const e of targets)if(e.el.animate&&['slash','spell','impact','miss'].includes(e.kind))animations.push(e.el.animate(e.kind==='miss'?[{transform:'translateX(0)'},{transform:'translateX(9px)',opacity:.5},{transform:'translateX(0)',opacity:1}]:[{transform:'translateX(0)',filter:'brightness(1)'},{transform:'translateX(-3px)',filter:'brightness(1.6)'},{transform:'translateX(3px)',filter:'brightness(1.1)'},{transform:'translateX(0)',filter:'brightness(1)'}],{delay:e.delay+(e.kind==='spell'?140:30),duration:240,easing:'ease-out'}));
  let start;
  function frame(now){
   if(active!==token)return;
   if(G.st!==state||state.run!==run||G.screen!=='battle'||G.sheet||G.dlg||document.hidden||reducedMotion()||!scene.isConnected){cancel();return;}
   if(start==null)start=now;const elapsed=now-start;ctx.clearRect(0,0,rect.width,rect.height);
   if(model.burst&&elapsed<500&&origin){ctx.save();ctx.globalAlpha=.4*(1-elapsed/500);seal(ctx,origin.x,origin.y,30+elapsed/10,elapsed/500,palettes.light);ctx.restore();}
   for(const e of targets)draw(ctx,e,elapsed);
   if(elapsed>=820){cancel();return;}token.raf=requestAnimationFrame(frame);
  }
  token.raf=requestAnimationFrame(frame);
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 return{describe,draw,play,cancel,themes:Object.keys(palettes),isActive:()=>!!active};
})();
