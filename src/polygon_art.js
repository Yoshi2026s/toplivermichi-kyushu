/* Shared two-head, flat-shaded polygon models. Geometry is drawn once per pose, then cached. */
const POLY_ART=(()=>{
 const shades=new Map(),cache=new Map(),LIMIT=384,TAU=Math.PI*2;
 const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
 const color=(hex,k)=>{k=Math.round(k*100)/100;const key=hex+'|'+k;if(shades.has(key))return shades.get(key);const n=parseInt(String(hex).replace('#',''),16),tone='#'+[16,8,0].map(s=>Math.max(0,Math.min(255,Math.round(((n>>s)&255)*k))).toString(16).padStart(2,'0')).join('');shades.set(key,tone);if(shades.size>2048)shades.delete(shades.keys().next().value);return tone;};
 function keep(key,make){if(cache.has(key))return cache.get(key);const c=make();cache.set(key,c);if(cache.size>LIMIT)cache.delete(cache.keys().next().value);return c;}
 function phase(distance,moving,still=false){return !moving||still?0:1+Math.floor(((Math.max(0,distance)||0)%32)/4);}
 function pose(frame){const t=(frame-1)*TAU/8;return frame?{stride:Math.sin(t)*.14,lift:Math.cos(t)*.07,bob:(1-Math.cos(t*2))*.025}:{stride:0,lift:0,bob:0};}
 function mesh(){const faces=[];
  const tri=(a,b,c,tone)=>faces.push({v:[a,b,c],tone});
  const quad=(a,b,c,d,tone)=>{tri(a,b,c,tone);tri(a,c,d,color(tone,.98));};
  function box(x,y,z,w,h,d,tone){const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2,y+b*h/2,z+c*d/2]);for(const f of [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]])quad(...f.map(i=>v[i]),tone);}
  function sphere(x,y,z,rx,ry,rz,tone,cap=1){const slices=8,rings=3;for(let j=0;j<rings;j++)for(let i=0;i<slices;i++){const p=(u,v)=>{const a=u*TAU/slices,b=v*Math.PI*cap/rings;return [x+Math.sin(b)*Math.cos(a)*rx,y+Math.cos(b)*ry,z+Math.sin(b)*Math.sin(a)*rz];};quad(p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1),tone);}}
  return {faces,tri,quad,box,sphere};
 }
 function paint(model,w,h,dir=0,person=false,svg=false){const c=document.createElement('canvas');c.width=w;c.height=h;if(person)c.artScale=4;const g=c.getContext('2d'),yaw=[0,Math.PI,Math.PI/2,-Math.PI/2][dir]||0,cs=Math.cos(yaw),sn=Math.sin(yaw),sx=person?25:w/2.9,sy=person?36:h/2.7;
  const rotate=([x,y,z])=>[x*cs+z*sn,y,-x*sn+z*cs];
  const faces=model.faces.map(f=>{const v=f.v.map(rotate),a=v[0],b=v[1],d=v[2],u=b.map((x,i)=>x-a[i]),q=d.map((x,i)=>x-a[i]);const n=[u[1]*q[2]-u[2]*q[1],u[2]*q[0]-u[0]*q[2],u[0]*q[1]-u[1]*q[0]],len=Math.hypot(...n)||1,light=.68+.3*Math.max(0,(-n[0]*.45+n[1]*.65-n[2]*.6)/len);return {v,depth:v.reduce((a,p)=>a+p[2]-.17*p[1],0),tone:color(f.tone,light)};}).sort((a,b)=>b.depth-a.depth);
  if(svg)c.polySvg='';
  for(const f of faces){const points=svg?[]:null;g.beginPath();f.v.forEach(([x,y,z],i)=>{const px=w/2+x*sx,py=h*.955-y*sy+z*sy*.19;if(points)points.push(px.toFixed(2)+','+py.toFixed(2));if(i)g.lineTo(px,py);else g.moveTo(px,py);});g.closePath();g.fillStyle=f.tone;g.fill();g.strokeStyle=f.tone;g.lineWidth=.3;g.stroke();if(svg)c.polySvg+='<polygon points="'+points.join(' ')+'" fill="'+f.tone+'" stroke="'+f.tone+'" stroke-width=".3"/>';}return c;
 }
 function person(id,hair='#303448',coat='#8c4c53',dir=0,frame=0,opt={}){const moving=['hero','moe','partner'].includes(id)||typeof CHARS!=='undefined'&&Object.prototype.hasOwnProperty.call(CHARS,id);const f=moving&&frame>0?1+(Math.floor(frame)-1)%8:0;
  return keep(JSON.stringify(['person',id,hair,coat,dir,f,!!opt.long,opt.ribbon]),()=>{const m=mesh(),p=pose(f),seed=hash(id),skin=['#f0c7a3','#e0af8d','#eac09f'][seed%3],dark='#253345',gold='#e4bf72';
   for(const side of [-1,1]){const step=p.stride*side,lift=Math.max(0,p.lift*side);m.box(side*.18,.22+lift,step,.22,.30,.24,dark);m.box(side*.18,.075+lift,step-.04,.27,.14,.37,'#514443');}
   m.box(0,.70+p.bob,0,.67,.72,.43,coat);m.quad([-.34,.45,-.24],[.34,.45,-.24],[.40,.35,-.24],[-.40,.35,-.24],color(coat,.82));
   if(opt.long)m.box(0,.34,0,.76,.16,.46,coat);
   m.box(0,.63+p.bob,-.23,.10,.57,.025,'#eadcc5');m.box(0,.48+p.bob,-.25,.70,.09,.03,'#70513a');m.box(.06,.48+p.bob,-.28,.12,.08,.03,gold);
   for(const side of [-1,1]){const swing=-p.stride*side;m.box(side*.43,.73+p.bob,swing,.19,.51,.23,coat);m.box(side*.44,.43+p.bob,swing,.21,.22,.22,skin);}
   if(opt.long)m.box(0,1.36,.33,.96,.85,.25,hair);
   m.sphere(0,1.55+p.bob,0,.62,.57,.54,skin);m.box(-.60,1.53+p.bob,0,.17,.22,.20,skin);m.box(.60,1.53+p.bob,0,.17,.22,.20,skin);
   m.sphere(0,1.62+p.bob,.01,.65,.61,.57,hair,.52);
   for(const side of [-1,1]){m.box(side*.22,1.49+p.bob,-.535,.12,.17,.03,'#fcf6e8');m.box(side*.21,1.48+p.bob,-.558,.065,.12,.02,'#243143');m.box(side*.22-.018,1.515+p.bob,-.571,.023,.035,.01,'#ffffff');}
   if(dir>1){const side=dir===2?1:-1;m.box(side*.50,1.49+p.bob,-.35,.025,.18,.15,'#fcf6e8');m.box(side*.517,1.48+p.bob,-.36,.025,.12,.085,'#243143');}
   m.tri([-.07,1.41+p.bob,-.53],[.07,1.41+p.bob,-.53],[0,1.35+p.bob,-.64],color(skin,.9));m.box(0,1.25+p.bob,-.48,.15,.028,.02,'#9d665f');
   m.tri([-.56,1.76+p.bob,-.34],[-.10,1.95+p.bob,-.52],[-.18,1.66+p.bob,-.52],hair);m.tri([-.10,1.95+p.bob,-.52],[.47,1.83+p.bob,-.40],[.10,1.70+p.bob,-.56],color(hair,1.13));
   if(opt.ribbon)m.box(.51,1.85+p.bob,0,.25,.16,.12,opt.ribbon);
   if(seed%3===1)m.box(0,.97+p.bob,-.29,.69,.12,.10,gold);
   return paint(m,64,96,dir,true);
  });
 }
 function portrait(canvas,cid,gender,full=false){if(!canvas)return;const female=gender?gender==='女性':cid==='hero'?typeof G!=='undefined'&&G.st?.profile.gender==='女性':cid==='moe'?typeof G!=='undefined'&&G.st?.heroine?.gender!=='男性':['mio','kayo','tsumugi'].includes(cid);
  const ch=typeof CHARS!=='undefined'?CHARS[cid]:null,painted=person(cid,cid==='hero'?(female?'#945b45':'#242c3a'):cid==='moe'?'#494064':ch?.hair||'#343449',cid==='hero'?'#b84b4b':cid==='moe'?'#eee0c5':ch?.coat||'#547b80',0,0,{long:female,ribbon:cid==='moe'?'#d68d92':null});const g=canvas.getContext('2d');g.clearRect(0,0,canvas.width,canvas.height);g.imageSmoothingEnabled=true;const k=Math.min(canvas.width/64,canvas.height/96);g.drawImage(painted,(canvas.width-64*k)/2,(canvas.height-96*k)/2,64*k,96*k);
 }
 function creature(id,shape,tone='#83b9ae',size=64,frame=0,boss=false,stage=1,pattern=0){return keep(JSON.stringify(['creature',id,shape,tone,size,frame%2,boss,stage,pattern]),()=>{const m=mesh(),seed=hash(id+shape),bob=frame%2*.035,accent=color(tone,1.3),skin=tone;
  m.sphere(0,.63+bob,0,.48,.48,.37,tone);for(const x of [-.25,.25])m.box(x,.14,0,.27,.19,.38,color(tone,.7));
  m.sphere(0,1.48+bob,0,.66,.64,.54,skin);m.sphere(-.60,.68+bob,0,.19,.22,.20,accent);m.sphere(.60,.68+bob,0,.19,.22,.20,accent);
  const long=/rabbit|alpaca|deer|dragon|鹿|竜/.test(shape),bird=/bird|owl|penguin|鳥/.test(shape),fin=/seal|otter|fish|水|波|海/.test(shape);
  for(const side of [-1,1]){const y=long?2.4:2.06;m.tri([side*.30,1.91+bob,0],[side*.64,y+bob,-.04],[side*.55,1.65+bob,0],accent);}
  for(const x of [-.23,.23]){m.box(x,1.47+bob,-.52,.15,.21,.04,'#fbf1d5');m.box(x,1.46+bob,-.55,.075,.15,.03,'#27384b');m.box(x-.02,1.52+bob,-.57,.035,.045,.01,'#ffffff');}
  m.tri([-.10,1.27+bob,-.53],[.10,1.27+bob,-.53],[0,1.17+bob,bird?-.85:-.62],bird?'#e2b65e':color(tone,.55));
  if(/turtle/.test(shape))m.box(0,.65,-.40,.58,.46,.13,accent);if(/otter/.test(shape))m.box(0,1.24+bob,-.54,.38,.13,.10,'#eadfbc');
  for(let i=0;i<pattern;i++)m.box(-.25+(i%4)*.16,1.72-Math.floor(i/4)*.13,-.53,.075,.07,.04,accent);
  if(fin)for(const side of [-1,1])m.tri([side*.35,.60,0],[side*.92,.36,0],[side*.43,.27,-.15],accent);
  if(boss||stage>=8){for(let i=-1;i<=1;i++)m.tri([i*.26-.14,2.0,-.1],[i*.26,2.34,-.05],[i*.26+.14,2.0,-.1],'#e6bd69');}
  if(stage>=5)m.box(0,.95,-.40,.50,.10,.06,'#4d8491');m.box((seed%3-1)*.20,1.82,-.50,.13,.12,.04,accent);
  return paint(m,size,size,0,false,String(id).startsWith('pet/'));
 });}
 function petSvg(id,stage=1){return keep('petSvg/'+id+'/'+stage,()=>{const s=PET_SPECIES[id]||PET_SPECIES.PT01;const canvas=creature('pet/'+id,s.shape,s.color,96,0,false,stage);return '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" role="img" aria-label="'+s.name+' 成長'+stage+'">'+canvas.polySvg+'</svg>';});}
 function title(canvas){if(!canvas)return;const scene=keep('title-scene',()=>{const c=document.createElement('canvas');c.width=960;c.height=640;const g=c.getContext('2d'),sky=g.createLinearGradient(0,0,0,640);sky.addColorStop(0,'#0e2239');sky.addColorStop(1,'#56898e');g.fillStyle=sky;g.fillRect(0,0,960,640);const polygon=(points,tone)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=tone;g.fill();};for(let i=0;i<30;i++){g.fillStyle='#e6d6ae';g.fillRect((i*137+43)%960,30+(i*71)%260,2,2);}polygon([[460,350],[700,120],[960,350]],'#294f68');polygon([[700,120],[775,350],[960,350]],'#1e3c56');polygon([[0,370],[300,185],[520,380]],'#3e6975');polygon([[300,185],[370,380],[520,380]],'#244c60');polygon([[0,360],[960,345],[960,640],[0,640]],'#477f8c');for(let i=0;i<12;i++)polygon([[i*95,400+i%3*23],[i*95+130,395+i%3*23],[i*95+60,425+i%3*23]],i%2?'#6aa4a6':'#376778');polygon([[380,460],[960,390],[960,640],[280,640]],'#4b6463');polygon([[380,460],[960,490],[960,640]],'#334d55');g.drawImage(person('hero','#243044','#b84b4b',0,0),560,255,180,270);g.drawImage(person('moe','#47395f','#eee0c5',0,0,{long:true,ribbon:'#d68d92'}),740,270,170,255);return c;});canvas.getContext('2d').drawImage(scene,0,0,canvas.width,canvas.height);}
 ART.person=person;ART.enemy=(profile,species,attr,area,frame=0,size=32,boss=false)=>creature(profile+'/'+area,species,({水:'#659cb5',熱:'#c87568',電:'#d7b65f',光:'#d9cc98',無:'#91a0a9'})[attr]||'#8da594',size,frame,boss);
 return {person,portrait,title,phase,pose,creature,petSvg,ready:()=>true,stats:()=>({entries:cache.size,limit:LIMIT}),geometry:{headHeights:2,canvas:[64,96],foot:92}};
})();
