/* Soft illustrated two-head figures from the approved sample. Embedded, decoded once, cached poses. */
const SOFT_ART=(()=>{
 const cache=new Map(),LIMIT=128,TAU=Math.PI*2,images={},errors=[];
 const sources={front:'__SOFT_FRONT_DATA_URI__',back:'__SOFT_BACK_DATA_URI__',side:'__SOFT_SIDE_DATA_URI__',npc:'__SOFT_NPC_DATA_URI__',pets:'__SOFT_PETS_DATA_URI__',enemies:'__SOFT_ENEMIES_DATA_URI__'};
 const loaded=Promise.all(Object.entries(sources).map(([key,src])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images[key]=image;resolve();};image.onerror=()=>{errors.push(key);reject(new Error('Character artwork could not load: '+key));};image.src=src;})));
 const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
 function keep(key,make){if(cache.has(key)){const c=cache.get(key);cache.delete(key);cache.set(key,c);return c;}const c=make();cache.set(key,c);if(cache.size>LIMIT)cache.delete(cache.keys().next().value);return c;}
 function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 function phase(distance,moving,still=false){return !moving||still?0:1+Math.floor(((Math.max(0,distance)||0)%32)/4);}
 function pose(frame){const t=(frame-1)*TAU/8;return frame?{stride:Math.sin(t)*.14,lift:Math.cos(t)*.07,bob:(1-Math.cos(t*2))*.025}:{stride:0,lift:0,bob:0};}
 const party={hero:0,moe:2,partner:2,naoki:4,kohei:5,mio:6,kayo:7,tsumugi:8,makoto:9,gaku:10},named={akari:0,ryosuke:1,chiyo:2,sota:3,shigeru:4,misuzu:5};
 function identity(id,opt={}){if(Object.prototype.hasOwnProperty.call(party,id))return {key:'front',index:id==='hero'?(opt.long?1:0):id==='moe'||id==='partner'?(opt.long?2:3):party[id],moving:true};return {key:'npc',index:named[id]??(6+hash(id)%6),moving:false};}
 function drawPerson(g,id,dir,frame,opt={}){const who=identity(id,opt),key=who.moving?['front','back','side','side'][dir]||'front':who.key,img=images[key];if(!img)return;const sx=who.index%4*192,sy=Math.floor(who.index/4)*256,p=pose(frame),mirror=who.moving&&dir===3;
  g.save();if(mirror){g.translate(64,0);g.scale(-1,1);}g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.filter='contrast(1.16) saturate(1.12)';
  if(!frame){g.drawImage(img,sx,sy,192,256,0,0,64,96);}else{
   // Three cached layers keep the face stable; feet alternate without costly per-frame mesh warping.
   const bob=p.bob*18;g.drawImage(img,sx,sy,192,184,0,-bob,64,69);
   g.drawImage(img,sx,sy+184,192,24,p.stride*2,69-bob,64,9);
   for(let side=0;side<2;side++){const sign=side?1:-1,lift=Math.max(0,p.lift*sign)*13;g.drawImage(img,sx+side*96,sy+208,96,48,side*32+p.stride*sign*5,78-lift,32,18);}
  }g.restore();
 }
 function person(id,hair,coat,dir=0,frame=0,opt={}){const who=identity(id,opt),f=who.moving&&frame>0?1+(Math.floor(frame)-1)%8:0;return keep(JSON.stringify(['person',id,dir,f,!!opt.long,opt.ribbon]),()=>{const c=canvas(64,96);c.artScale=4;drawPerson(c.getContext('2d'),id,dir,f,opt);const hd=canvas(192,288),g=hd.getContext('2d');g.scale(3,3);drawPerson(g,id,dir,f,opt);c.mapImage=hd;return c;});}
 function portrait(c,cid,gender,full=false){if(!c)return;const female=gender?gender==='女性':cid==='hero'?typeof G!=='undefined'&&G.st?.profile.gender==='女性':cid==='moe'?typeof G!=='undefined'&&G.st?.heroine?.gender!=='男性':['mio','kayo','tsumugi'].includes(cid);const g=c.getContext('2d');g.clearRect(0,0,c.width,c.height);const k=Math.min(c.width/64,c.height/96);g.save();g.translate((c.width-64*k)/2,(c.height-96*k)/2);g.scale(k,k);drawPerson(g,cid,0,0,{long:female});g.restore();}
 function creatureIndex(shape){if(/fish|魚/.test(shape))return 8;if(/turtle|亀/.test(shape))return 9;if(/bird|owl|penguin|鳥/.test(shape))return 10;if(/dragon|竜/.test(shape))return 11;if(/菌|mushroom/.test(shape))return 1;if(/鉱|殻|岩|rock/.test(shape))return 2;if(/鐘|鈴|bell/.test(shape))return 3;if(/火|熱|flame/.test(shape))return 4;if(/霊|反響|ghost/.test(shape))return 5;if(/電|光|spark/.test(shape))return 6;if(/水|波|drop/.test(shape))return 7;return hash(shape)%8;}
 function creature(id,shape,tone='#83b9ae',size=64,frame=0,boss=false,stage=1,pattern=0){return keep(JSON.stringify(['creature',id,shape,tone,size,frame%2,boss,stage,pattern]),()=>{const pet=String(id).startsWith('pet/'),index=pet?Math.max(0,Math.min(21,parseInt(String(id).slice(-2),10)-1)):creatureIndex(shape),cols=pet?6:4,img=images[pet?'pets':'enemies'],c=canvas(size,size),g=c.getContext('2d');if(!img)return c;const pad=boss||stage>=8?size*.13:size*.05,bob=frame%2*size*.012;
  const otter=!pet&&shape==='otter',source=otter?images.pets:img,cell=otter?6:index,columns=otter?6:cols;
  g.imageSmoothingEnabled=true;g.drawImage(source,cell%columns*192,Math.floor(cell/columns)*192,192,192,pad,pad-bob,size-pad*2,size-pad*2);
  if(!pet){g.globalCompositeOperation='source-atop';g.globalAlpha=.17;g.fillStyle=tone;g.fillRect(0,0,size,size);g.globalAlpha=1;g.globalCompositeOperation='source-over';}
  if(stage>=5){g.fillStyle='#538ba0';g.beginPath();g.ellipse(size*.50,size*.78,size*.16,size*.035,0,0,TAU);g.fill();g.fillStyle='#f2d290';g.beginPath();g.arc(size*.5,size*.79,size*.035,0,TAU);g.fill();}
  if(boss||stage>=8){g.fillStyle='#f2ce7e';g.strokeStyle='#795b38';g.lineWidth=Math.max(.7,size/120);g.beginPath();for(const [i,[x,y]]of [[.35,.20],[.33,.08],[.43,.13],[.5,.025],[.57,.13],[.67,.08],[.65,.20]].entries()){if(i)g.lineTo(x*size,y*size);else g.moveTo(x*size,y*size);}g.closePath();g.fill();g.stroke();}
  if(pattern){g.fillStyle=tone;g.strokeStyle='#f6e5b9';g.lineWidth=size*.009;g.beginPath();g.arc(size*.77,size*.76,size*.05,0,TAU);g.fill();g.stroke();g.fillStyle='#fff5dc';for(let i=0;i<pattern;i++)g.fillRect(size*(.745+i%4*.014),size*(.74+Math.floor(i/4)*.025),size*.009,size*.015);}
  return c;});}
 function petSvg(id,stage=1){stage=Math.max(1,Math.min(10,Math.floor(Number(stage)||1)));return keep('petSvg/'+id+'/'+stage,()=>{const s=PET_SPECIES[id]||PET_SPECIES.PT01,c=creature('pet/'+id,s.shape,s.color,96,0,false,stage);return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="'+s.name+' ★'+s.rarity+' 成長'+stage+'" data-pet-rarity="'+s.rarity+'">'+petRarityFrame(id)+'<image width="96" height="96" xlink:href="'+c.toDataURL('image/png')+'"/>'+petRarityAccessory(id,stage)+'<circle cx="79" cy="80" r="13" fill="#173149" stroke="#edce87" stroke-width="2"/><text x="79" y="85" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="700" fill="#fff0c9">'+stage+'</text></svg>';});}
 function title(c){if(!c)return;c.getContext('2d').clearRect(0,0,c.width,c.height);c.style.backgroundImage='url("__TITLE_DAWN_DATA_URI__")';}

 ART.person=person;ART.enemy=(profile,species,attr,area,frame=0,size=32,boss=false)=>creature(profile+'/'+area,species,({水:'#659cb5',熱:'#c87568',電:'#d7b65f',光:'#d9cc98',無:'#91a0a9'})[attr]||'#8da594',size,frame,boss);
 return {person,portrait,title,phase,pose,creature,petSvg,loaded,ready:key=>!!images[({down:'front',npc:'npc'})[key]||key]||!key&&Object.keys(images).length===6,stats:()=>({entries:cache.size,limit:LIMIT,decoded:Object.keys(images).length,errors:[...errors]}),geometry:{headHeights:2,canvas:[64,96],foot:92}};
})();
