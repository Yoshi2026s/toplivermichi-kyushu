/* Painted materials follow the immutable logical map; no collision or save data is changed. */
const WORLD_ART=(()=>{
 const legacy=ART.mapLayer,cache=new Map(),patterns=new Map(),LIMIT=32*1024*1024;
 let atlas=null,bytes=0,error=null;
 const loaded=typeof Image==='undefined'?Promise.resolve(false):new Promise(resolve=>{const img=new Image();img.onload=()=>{atlas=img;resolve(true);};img.onerror=()=>{error='world-materials';resolve(false);};img.src='__WORLD_MATERIALS_DATA_URI__';});
 const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 function material(g,index){if(!patterns.has(index)){
  const organic=[0,3,10,11].includes(index),size=organic?384:128,c=make(size*(organic?2:1),size*(organic?2:1)),p=c.getContext('2d'),cw=atlas.width/4,ch=atlas.height/3;
  p.imageSmoothingEnabled=true;p.imageSmoothingQuality='high';
  for(let row=0;row<(organic?2:1);row++)for(let col=0;col<(organic?2:1);col++){p.save();p.translate(col?size*2:0,row?size*2:0);p.scale(col?-1:1,row?-1:1);p.drawImage(atlas,index%4*cw,Math.floor(index/4)*ch,cw,ch,0,0,size,size);p.restore();}patterns.set(index,c);
 }return g.createPattern(patterns.get(index),'repeat');}

 function base(m,t,x,y){
  if(m.combatDomain==='sea')return t==='P'?9:t==='.'?0:t==='S'?2:3;
  if(t==='~'||t==='=')return 3;if(t==='c')return 6;if(t==='#')return 7;if(t==='W')return 8;if(t==='f')return 4;
  if(m.kind==='town')return t===','?1:t==='w'?2:0;
  if(t==='w'||t===','||m.trailCells?.[y]?.[x])return 2;
  if('123'.includes(t))return m.terrain==='forest'?10:m.terrain==='mountain'?0:m.terrain==='coast'&&t==='2'?2:11;
  return m.terrain==='forest'?10:m.terrain==='mountain'?8:0;
 }

 function mapLayer(id,frame=0){const m=MAPS[id];if(!atlas||m.kind==='in')return legacy(id,frame);
  if(cache.has(id)){const c=cache.get(id);cache.delete(id);cache.set(id,c);return c;}
  const ratio=m.w*m.h*64*64*4>LIMIT?2:4,tile=16*ratio,c=make(m.w*tile,m.h*tile),g=c.getContext('2d');c.artScale=ratio;
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  const at=(x,y)=>m.tiles[y]?.[x]||'T';
  // One shared pattern per material continues across neighboring cells, without tile seams.
  for(let index=0;index<12;index++){g.beginPath();let used=false;for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++)if(base(m,at(x,y),x,y)===index){g.rect(x*tile,y*tile,tile,tile);used=true;}if(used){g.save();g.clip();g.fillStyle=material(g,index);g.fillRect(0,0,c.width,c.height);g.restore();}}
  for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){const t=at(x,y),X=x*tile,Y=y*tile;
   if(t==='W'){g.fillStyle='#718186';g.fillRect(X,Y,tile,tile);g.strokeStyle='#394d59';g.lineWidth=ratio*.6;for(let row=0;row<3;row++){g.beginPath();g.moveTo(X,Y+row*tile/3);g.lineTo(X+tile,Y+row*tile/3);g.stroke();for(let col=0;col<2;col++){const xx=X+(col*.5+(row%2?.25:0))*tile;g.beginPath();g.moveTo(xx,Y+row*tile/3);g.lineTo(xx,Y+(row+1)*tile/3);g.stroke();}}g.fillStyle='#dae2d0';g.fillRect(X,Y,tile,ratio);}
   if(t==='f'){g.fillStyle='#123b2b55';g.fillRect(X,Y+tile*.65,tile,tile*.35);g.strokeStyle='#b1c98b';g.lineWidth=ratio*.7;g.strokeRect(X+ratio,Y+ratio,tile-ratio*2,tile*.75);}
   if(m.kind==='field'&&'123'.includes(t)&&!m.trailCells?.[y]?.[x]){g.fillStyle=t==='1'?'#bfcf6818':t==='2'?'#65934418':'#967c6020';g.fillRect(X,Y,tile,tile);}
   if(t==='T'){
    g.fillStyle='#142d2d66';g.beginPath();g.ellipse(X+tile*.55,Y+tile*.63,tile*.46,tile*.36,0,0,Math.PI*2);g.fill();
    g.save();g.beginPath();g.ellipse(X+tile*.48,Y+tile*.45,tile*.47,tile*.44,0,0,Math.PI*2);g.clip();g.fillStyle=material(g,m.terrain==='mountain'?5:4);g.fillRect(X,Y,tile,tile);const light=g.createLinearGradient(X,Y,X+tile,Y+tile);light.addColorStop(0,'#e0f4a62b');light.addColorStop(1,'#072b3655');g.fillStyle=light;g.fillRect(X,Y,tile,tile);g.restore();
   }
   if(',w23'.includes(t)){g.lineWidth=Math.max(1,ratio*.45);for(const[dx,dy,a,b]of [[0,-1,[0,0],[1,0]],[0,1,[0,1],[1,1]],[-1,0,[0,0],[0,1]],[1,0,[1,0],[1,1]]])if(!',w23='.includes(at(x+dx,y+dy))){g.strokeStyle=dy===1?'#40594399':'#f4e2b6b0';g.beginPath();g.moveTo(X+a[0]*tile,Y+a[1]*tile);g.lineTo(X+b[0]*tile,Y+b[1]*tile);g.stroke();}}
   if(t==='~'){for(const[dx,dy,a,b]of [[0,-1,[0,0],[1,0]],[0,1,[0,1],[1,1]],[-1,0,[0,0],[0,1]],[1,0,[1,0],[1,1]]])if(!'~='.includes(at(x+dx,y+dy))){g.strokeStyle='#d8f6e8c9';g.lineWidth=ratio*1.2;g.beginPath();g.moveTo(X+a[0]*tile,Y+a[1]*tile);g.lineTo(X+b[0]*tile,Y+b[1]*tile);g.stroke();}}
   if(t==='='){g.save();g.translate(X,Y);if(at(x-1,y)==='='||at(x+1,y)==='='){g.translate(tile,0);g.rotate(Math.PI/2);}g.fillStyle=material(g,9);g.fillRect(ratio*1.5,0,tile-ratio*3,tile);g.fillStyle='#edd4a7';g.fillRect(ratio,0,ratio,tile);g.fillStyle='#665139';g.fillRect(tile-ratio*2,0,ratio,tile);g.restore();}

   if(t==='c'||t==='#'){if(at(x,y+1)!==t){g.fillStyle=t==='c'?'#593d3270':'#24323470';g.fillRect(X,Y+tile-ratio*2,tile,ratio*2);}if(at(x,y-1)!==t){g.fillStyle='#fff0c16b';g.fillRect(X,Y,tile,ratio*.6);}}
   if(m.combatDomain==='sea'&&'ESP'.includes(t)){g.save();g.strokeStyle='#fff3c5cc';g.lineWidth=ratio*.6;g.setLineDash([ratio*1.2,ratio*1.4]);for(const[dx,dy]of [[0,1],[0,-1],[1,0],[-1,0]])if('ESP'.includes(at(x+dx,y+dy))){g.beginPath();g.moveTo(X+tile/2,Y+tile/2);g.lineTo(X+(dx+1)*tile/2,Y+(dy+1)*tile/2);g.stroke();}g.restore();}
   if(m.combatDomain!=='sea'&&!'.1TfW,w23~=#c'.includes(t))g.drawImage(ART.tile(t,0),X,Y,tile,tile);
  }
  for(const b of m.buildings||[]){
   const X=b.x*tile,Y=b.y*tile,W=b.w*tile,H=b.h*tile,cx=(b.door[0]+.5)*tile,dy=b.door[1]*tile;
   g.fillStyle='#132a3938';g.fillRect(X+ratio,Y+H,W,ratio*2);
   g.fillStyle=['#6f32351e','#754c1720','#253c4326','#57443b20'][b.style];g.fillRect(X,Y,W,tile*3);
   g.strokeStyle='#563a33';g.lineWidth=ratio*1.2;g.strokeRect(X+ratio*.5,Y+ratio*.5,W-ratio,tile*3-ratio);
   g.strokeStyle='#f5d9a077';g.lineWidth=ratio*.6;g.beginPath();g.moveTo(X+ratio,Y+tile*.4);g.lineTo(X+W-ratio,Y+tile*.4);g.stroke();
   g.fillStyle='#dfcba7';g.fillRect(cx-tile*.5,dy,tile,tile);g.fillStyle=b.service?'#233b43':'#70523c';g.fillRect(cx-tile*.29,dy+tile*.1,tile*.58,tile*.85);g.strokeStyle='#a4895a';g.lineWidth=ratio*.6;g.strokeRect(cx-tile*.29,dy+tile*.1,tile*.58,tile*.85);
   if(!b.service){g.fillStyle='#dfc98b';g.beginPath();g.arc(cx+tile*.17,dy+tile*.59,ratio*.7,0,Math.PI*2);g.fill();}
   if(b.service){const label=({shop:'道具店',inn:'宿屋',jobcenter:'職業窓口',door:'入口'})[b.service],tw=Math.max(tile*1.4,label.length*tile*.34);g.fillStyle='#142d3ee8';g.fillRect(cx-tw/2,dy-tile*1.72,tw,tile*.52);g.strokeStyle='#e0bf80';g.lineWidth=ratio*.4;g.strokeRect(cx-tw/2,dy-tile*1.72,tw,tile*.52);g.fillStyle='#fff0c8';g.font='600 '+tile*.32+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(label,cx,dy-tile*1.45);}
  }
  // Broad, static daylight and soft cloud shadows add depth without per-frame work.
  const glow=g.createLinearGradient(0,0,c.width,c.height);glow.addColorStop(0,'#fff1c31f');glow.addColorStop(.5,'#fff9e500');glow.addColorStop(1,'#0a344827');g.fillStyle=glow;g.fillRect(0,0,c.width,c.height);
  cache.set(id,c);bytes+=c.width*c.height*4;while(cache.size>1&&(bytes>LIMIT||cache.size>4)){const key=cache.keys().next().value,old=cache.get(key);bytes-=old.width*old.height*4;cache.delete(key);}return c;
 }
 ART.mapLayer=mapLayer;
 return {loaded,mapLayer,ready:()=>!!atlas,stats:()=>({bytes,limit:LIMIT,entries:cache.size,materials:patterns.size,error})};
})();
