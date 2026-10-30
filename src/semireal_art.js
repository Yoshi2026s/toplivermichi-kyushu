/* Embedded painted party art. Presentation only: no saved identifiers change. */
const SEMIREAL_ART=(()=>{
 const fallback=ART.person,cache=new Map(),images={};
 const sources={front:'__PARTY_FRONT_DATA_URI__',back:'__PARTY_BACK_DATA_URI__',side:'__PARTY_SIDE_DATA_URI__',down:'__PARTY_DOWN_DATA_URI__',npc:'__NPC_FRONT_DATA_URI__'};
 const indices={naoki:4,kohei:5,mio:6,kayo:7,tsumugi:8,makoto:9,gaku:10};
 function index(id,opt={}){
  if(id==='hero'||id==='hero-preview')return opt.long?1:0;
  if(['moe','partner','partner-preview'].includes(id))return opt.long?2:3;
  return indices[id]??null;
 }
 // MAP residents use the same painted proportions and foot anchor as the party.
 function npcIndex(id){
  const named={akari:0,ryosuke:1,chiyo:2,sota:3,shigeru:4,misuzu:5,innkeeper:10};
  if(Object.prototype.hasOwnProperty.call(named,id))return named[id];
  if(typeof NPCS!=='undefined'&&Object.prototype.hasOwnProperty.call(NPCS,id))return 6+(Number(String(id).match(/\d+/)?.[0]||0)%2);
  return null;
 }
 function ready(side){return !!images[side]?.complete&&images[side].naturalWidth>0;}
 function person(id,hair,coat,dir=0,frame=0,opt={}){
  const partyIndex=index(id,opt),resident=partyIndex===null?npcIndex(id):null;
  const i=partyIndex??resident,side=resident!==null?'npc':dir===1?'back':dir>1?'side':'down';
  if(i===null||!ready(side))return fallback(id,hair,coat,dir,frame,opt);
  const walkFrame=resident===null&&frame>0?1+(Math.floor(frame)-1)%8:0;
  const key=[side,i,dir,walkFrame].join('|');if(cache.has(key))return cache.get(key);
  const c=document.createElement('canvas');c.width=64;c.height=96;c.artScale=4;
  const g=c.getContext('2d'),[x,y,w,h]=SEMIREAL_FRAMES[side][i];
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  if(dir===3&&!walkFrame){g.translate(64,0);g.scale(-1,1);}
  // Preserve natural proportions and the original foot anchor / collision grid.
  const dh=88,dw=w/h*dh;
  g.drawImage(images[side],x,y,w,h,(64-dw)/2,93-dh,dw,dh);
  const result=WALK_ART.render(c,dir,walkFrame);
  cache.set(key,result);if(cache.size>192)cache.delete(cache.keys().next().value);return result;
 }
 function portrait(canvas,cid,gender,full=false){
  if(!canvas)return;const female=gender?gender==='女性':cid==='hero'?G.st?.profile.gender==='女性':cid==='moe'?G.st?.heroine?.gender!=='男性':false;
  const i=index(cid,{long:female}),g=canvas.getContext('2d');g.clearRect(0,0,canvas.width,canvas.height);
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  if(i===null||!ready('front')){g.drawImage(fallback(cid,'#343044',cid==='hero'?'#a54742':'#e6dcc5',0,0,{long:female}),0,0,canvas.width,canvas.height);return;}
  const [x,y,w,h]=SEMIREAL_FRAMES.front[i],crop=full?h:h*.56;
  const scale=Math.min((canvas.width-4)/w,(canvas.height-4)/crop),dw=w*scale,dh=crop*scale;
  g.drawImage(images.front,x,y,w,crop,(canvas.width-dw)/2,canvas.height-dh,dw,dh);
 }
 function refresh(){
  cache.clear();if(typeof drawMiniSprites==='function')drawMiniSprites();
  const c=document.querySelector('#heroPrev');
  if(c&&G.screen==='new'&&G.newGame){const n=G.newGame,p=n.step===2,gender=p?n.heroine?.gender:n.gender;if(gender)portrait(c,p?'moe':'hero',gender,true);}
 }
 if(typeof Image!=='undefined')for(const side of Object.keys(sources)){
  const img=new Image();images[side]=img;img.onload=refresh;img.src=sources[side];
 }
 ART.person=person;
 return {portrait,index,npcIndex,ready,stats:()=>({entries:cache.size})};
})();
