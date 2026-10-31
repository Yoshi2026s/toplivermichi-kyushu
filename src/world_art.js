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

 function regionalPlant(g,p,x,y,t,seed,low=false){
  g.save();g.translate(x,y);g.scale(t,t);
  const oval=(x,y,rx,ry,c)=>{g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();};
  const line=(points,c,w)=>{g.strokeStyle=c;g.lineWidth=w;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();};
  const fruit=['apple','peach','citrus','plum','grape'].includes(p.plant),pink=['plum','peach'].includes(p.plant);
  if(low){
   const color=p.plant==='safflower'?'#da8c47':pink?'#dca6ba':p.plant==='grape'?'#8d709e':p.plant==='tea'?'#5e8a45':'#8fa963';
   for(let i=0;i<5;i++){const xx=.17+i*.15,yy=.55+Math.sin(seed+i*2)*.13;line([[xx,yy+.12],[xx,yy-.1]],'#4c7450',.025);oval(xx-.035,yy,.07,.026,'#7e9e58');oval(xx+.03,yy-.06,.06,.025,'#557f44');if(fruit||p.plant==='safflower')oval(xx,yy-.12,.045,.04,color);}
  }else{
   oval(.52,.86,.4,.12,'#173b3455');line([[.5,.86],[.49,.25]],p.plant==='birch'?'#eee9d1':'#776044',.075);
   if(p.plant==='palm'){
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;g.strokeStyle=i%2?'#567f46':'#80a356';g.lineWidth=.065;g.beginPath();g.moveTo(.5,.25);g.quadraticCurveTo(.5+Math.cos(a)*.32,.25+Math.sin(a)*.23,.5+Math.cos(a)*.48,.37+Math.sin(a)*.31);g.stroke();}
   }else if(['bamboo','reed'].includes(p.plant)){
    for(let i=0;i<4;i++){const xx=.2+i*.2;line([[xx,.9],[xx+.025,.16+(i%2)*.1]],'#688c4c',.045);for(let j=0;j<3;j++){const yy=.3+j*.18;line([[xx-.025,yy],[xx+.065,yy]],'#c5cd85',.02);oval(xx+.1,yy-.03,.13,.035,'#527c4b');}}
   }else if(['pine','cedar'].includes(p.plant)){
    for(let i=0;i<3;i++){g.fillStyle=['#52735d','#3e6854','#64836a'][i];g.beginPath();g.moveTo(.5,.03+i*.16);g.lineTo(.08-i*.01,.55+i*.13);g.lineTo(.91+i*.01,.55+i*.13);g.closePath();g.fill();}
   }else{
    const color=pink?'#c990a6':p.plant==='ginkgo'?'#c4b85d':p.plant==='maple'?'#b77b58':p.plant==='willow'?'#85a176':'#648b5c';
    for(const [xx,yy,r]of [[.28,.4,.24],[.66,.4,.27],[.48,.22,.27],[.45,.51,.3]])oval(xx,yy,r,r*.78,color);
    oval(.35,.25,.16,.1,pink?'#e7bacb':'#a7b77a');
    if(p.plant==='willow')for(let i=0;i<7;i++)line([[.16+i*.1,.37],[.13+i*.1,.73]],'#7c9b6b',.035);
    if(fruit)for(let i=0;i<5;i++)oval(.22+i*.13,.39+Math.sin(i*4+seed)*.14,.045,.045,p.plant==='apple'?'#c65b4b':p.plant==='citrus'?'#e8aa4b':p.plant==='grape'?'#8f6a9a':'#e8bbbd');
    if(p.plant==='birch')for(let i=0;i<4;i++)line([[.47,.58+i*.06],[.52,.59+i*.06]],'#666c62',.018);
   }
  }
  g.restore();
 }
 function regionalEmblem(g,p,cx,y,t){
  g.save();g.translate(cx,y);g.scale(t,t);g.lineCap='round';g.lineJoin='round';g.strokeStyle=p.accent;g.fillStyle=p.accent;g.lineWidth=.07;
  const path=points=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();};
  const disk=(x,y,r,c)=>{g.fillStyle=c;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();};
  switch(p.feature){
   case 'clock':disk(0,0,.29,'#f6e7bd');g.strokeStyle='#4c6269';path([[0,-.18],[0,0],[.14,.08]]);g.strokeRect(-.32,-.32,.64,.64);break;
   case 'steam':for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(i*.23,.27);g.bezierCurveTo(i*.23-.18,.05,i*.23+.18,-.12,i*.23,-.35);g.stroke();}break;
   case 'sail':g.fillStyle='#f6ead1';g.beginPath();g.moveTo(-.03,-.38);g.lineTo(-.03,.19);g.lineTo(-.38,.19);g.closePath();g.fill();g.fillStyle=p.accent;g.beginPath();g.moveTo(.03,-.3);g.lineTo(.4,.18);g.lineTo(.03,.18);g.fill();path([[-.44,.28],[.32,.28],[.45,.2]]);break;
   case 'streamer':for(let i=-1;i<=1;i++){g.strokeStyle=i===0?'#d3ae5d':p.accent;path([[i*.24,-.3],[i*.24,.15],[i*.24+.1,.38]]);}break;
   case 'lantern':for(let i=-1;i<=1;i++){disk(i*.29,Math.abs(i)*.1,.115,i?'#d8a553':p.accent);g.fillStyle='#554943';g.fillRect(i*.29-.1,Math.abs(i)*.1-.14,.2,.035);g.fillRect(i*.29-.1,Math.abs(i)*.1+.1,.2,.035);}break;
   case 'bridge':path([[-.5,.25],[-.4,-.03],[0,-.23],[.4,-.03],[.5,.25]]);path([[-.4,.25],[-.4,-.03]]);path([[.4,.25],[.4,-.03]]);path([[0,.25],[0,-.23]]);break;
   case 'chimney':g.fillRect(-.33,-.35,.18,.65);g.fillRect(.05,-.23,.2,.53);disk(-.23,-.48,.1,'#b8b8a4');disk(-.13,-.65,.13,'#d3d0ba');break;
   case 'mountain':case 'volcano':case 'dune':path([[-.52,.28],[-.14,-.25],[.05,-.13],[.2,-.29],[.53,.28]]);if(p.feature==='volcano'){g.strokeStyle='#dfcead';path([[.06,-.37],[.13,-.5],[.02,-.65]]);}break;
   case 'gate':g.fillRect(-.35,-.18,.08,.5);g.fillRect(.27,-.18,.08,.5);g.fillRect(-.49,-.28,.98,.09);g.fillRect(-.42,-.06,.84,.07);break;
   case 'pagoda':for(let i=0;i<3;i++){const w=.42-i*.1,y=.25-i*.23;path([[-w,y],[0,y-.2],[w,y]]);g.fillRect(-w*.5,y-.03,w,.12);}break;
   case 'tower':for(let i=-1;i<=1;i++){g.fillRect(i*.25-.08,-.3-Math.abs(i)*.1,.16,.65);g.fillStyle='#efe1af';g.fillRect(i*.25-.025,-.2,.03,.25);g.fillStyle=p.accent;}break;
   case 'pottery':g.beginPath();g.moveTo(-.15,-.33);g.bezierCurveTo(-.1,-.05,-.43,-.03,-.29,.28);g.lineTo(.29,.28);g.bezierCurveTo(.43,-.03,.1,-.05,.15,-.33);g.closePath();g.fill();g.strokeStyle='#e7e3c7';path([[-.22,.08],[.22,.08]]);break;
   case 'shisa':disk(-.22,.03,.17,p.accent);disk(.22,.03,.17,p.accent);g.fillRect(-.36,.16,.72,.12);disk(-.27,-.08,.09,'#d1a36e');disk(.27,-.08,.09,'#d1a36e');disk(-.22,.01,.025,'#fff0c8');disk(.22,.01,.025,'#fff0c8');break;
   case 'fruit':for(let i=-1;i<=1;i++)disk(i*.23,Math.abs(i)*.12,.15,p.accent);path([[0,-.14],[.13,-.3]]);break;
   case 'flower':case 'sun':for(let i=0;i<8;i++)disk(Math.cos(i*Math.PI/4)*.23,Math.sin(i*Math.PI/4)*.23,.08,p.accent);disk(0,0,.13,'#e1c67e');break;
   case 'crest':g.strokeStyle='#dfbf66';path([[-.4,.22],[-.24,-.24],[0,.08],[.24,-.24],[.4,.22]]);path([[-.36,.22],[.36,.22]]);break;
   case 'garden':path([[-.4,.27],[.4,.27]]);disk(0,-.02,.22,p.accent);path([[0,.22],[0,.08]]);break;
   case 'stone':g.fillRect(-.25,-.25,.5,.52);g.strokeStyle='#d5d5ba';path([[-.2,-.1],[.2,-.1]]);break;
   default:for(let i=-1;i<=1;i++){g.beginPath();g.moveTo(i*.18,-.32);g.quadraticCurveTo(i*.18-.22,0,i*.18,.3);g.quadraticCurveTo(i*.18+.22,0,i*.18,-.32);g.fill();}
  }
  g.restore();
 }

 function serviceFacade(g,b,t){
  if(!b.service)return;const x=b.x*t,y=b.y*t,w=b.w*t,cx=(b.door[0]+.5)*t;
  g.save();g.lineWidth=t*.04;
  if(b.service==='shop'){
   g.fillStyle='#f3ddb2';g.fillRect(x,y+2.82*t,w,.52*t);
   for(let i=0;i<b.w*3;i++){g.fillStyle=i%2?'#fff0c7':'#c15466';g.fillRect(x+i*t/3,y+2.82*t,t/3,.55*t);g.beginPath();g.arc(x+(i+.5)*t/3,y+3.37*t,t/6,0,Math.PI);g.fill();}
   for(const side of [-1,1]){const xx=cx+side*1.5*t;g.fillStyle='#735240';g.fillRect(xx-.4*t,y+4.15*t,.8*t,.65*t);g.strokeStyle='#e2bf83';g.strokeRect(xx-.4*t,y+4.15*t,.8*t,.65*t);for(let i=0;i<3;i++){g.fillStyle=['#66c1b1','#debd65','#d57b8a'][i];g.fillRect(xx+(-.3+i*.23)*t,y+3.97*t,.15*t,.22*t);}}
  }else if(b.service==='inn'){
   g.fillStyle='#5b5557';g.fillRect(x+w*.76,y+.2*t,.48*t,1.4*t);g.fillStyle='#ddd1b7';g.fillRect(x+w*.73,y+.16*t,.54*t,.16*t);
   g.fillStyle='#314a79';g.fillRect(cx-.8*t,y+2.9*t,1.6*t,.6*t);g.fillStyle='#ffe5a0';g.beginPath();g.arc(cx,y+3.17*t,.23*t,0,Math.PI*2);g.fill();g.fillStyle='#314a79';g.beginPath();g.arc(cx+.12*t,y+3.08*t,.2*t,0,Math.PI*2);g.fill();
   for(const side of [-1,1]){g.fillStyle='#efb96c';g.fillRect(cx+side*1.2*t-.15*t,y+3.6*t,.3*t,.42*t);g.strokeStyle='#7e5542';g.strokeRect(cx+side*1.2*t-.15*t,y+3.6*t,.3*t,.42*t);}
  }else if(b.service==='jobcenter'){
   g.fillStyle='#367c7c';g.fillRect(x,y+2.75*t,w,.3*t);g.fillStyle='#e7dcbd';g.fillRect(cx-1.6*t,y+3.4*t,.8*t,.95*t);g.strokeStyle='#77553b';g.strokeRect(cx-1.6*t,y+3.4*t,.8*t,.95*t);g.fillStyle='#4d6a77';for(let i=0;i<3;i++)g.fillRect(cx-1.5*t,y+(3.55+i*.22)*t,.55*t,.05*t);
  }else{g.fillStyle='#759e8a';g.fillRect(cx-.65*t,y+3*t,1.3*t,.3*t);}
  g.restore();
 }
 function regionalBuilding(g,m,b,t,index){
  const p=m.regional;if(!p)return;
  const X=b.x*t,Y=b.y*t,W=b.w*t,H=b.h*t,traditional=['machiya','kura','castle','rural','onsen','tropical'].includes(p.architecture);
  g.save();g.translate(X,Y);
  // Walls and roofs occupy the existing blocked parcel, including all visible eaves.
  const wall=g.createLinearGradient(0,3*t,0,H);wall.addColorStop(0,p.wall);wall.addColorStop(1,p.architecture==='brick'?'#936a55':p.wall);g.fillStyle=material(g,traditional?9:7);g.fillRect(0,0,W,H);g.fillStyle=wall;g.globalAlpha=traditional?.76:.74;g.fillRect(0,0,W,H);g.globalAlpha=1;
  if(p.architecture==='brick'){
   g.strokeStyle='#ebc5a34f';g.lineWidth=t*.012;for(let r=0;r<9;r++){const yy=3*t+r*t*.23;g.beginPath();g.moveTo(0,yy);g.lineTo(W,yy);g.stroke();for(let c=0;c<b.w*3;c++){const xx=c*t*.4+(r%2)*t*.2;g.beginPath();g.moveTo(xx,yy);g.lineTo(xx,yy+t*.23);g.stroke();}}
  }
  if(['machiya','rural','onsen'].includes(p.architecture)){
   g.fillStyle='#594c3c';for(let i=0;i<=b.w;i++)g.fillRect(i*t-.025*t,3*t,.05*t,2*t);g.fillRect(0,3.9*t,W,.07*t);
  }
  if(p.architecture==='stone'||p.architecture==='castle'||p.architecture==='kura'){
   g.fillStyle='#66716a';g.fillRect(0,4.7*t,W,.3*t);g.strokeStyle='#dad8bd';g.lineWidth=t*.015;for(let i=0;i<b.w*2;i++)g.strokeRect(i*t*.5,4.7*t,.5*t,.3*t);
  }
  for(const side of [-1,1]){
   const xx=(b.door[0]-b.x+.5+side*1.25)*t;if(xx<.4*t||xx>W-.4*t)continue;
   const ww=.72*t,yy=3.22*t,hh=.98*t;g.fillStyle='#4a5551';g.fillRect(xx-ww/2-.05*t,yy-.05*t,ww+.1*t,hh+.1*t);g.fillStyle=p.architecture==='urban'?'#81acb7':'#486f78';g.fillRect(xx-ww/2,yy,ww,hh);
   g.strokeStyle=traditional?'#68553d':'#ecdfba';g.lineWidth=t*.035;
   const n=p.architecture==='machiya'?7:2;for(let i=1;i<n;i++){g.beginPath();g.moveTo(xx-ww/2+ww*i/n,yy);g.lineTo(xx-ww/2+ww*i/n,yy+hh);g.stroke();}
   g.beginPath();g.moveTo(xx-ww/2,yy+hh*.55);g.lineTo(xx+ww/2,yy+hh*.55);g.stroke();g.fillStyle='#e8d7a9';g.fillRect(xx-ww/2-.08*t,yy+hh,.88*t,.08*t);
   if(p.architecture==='port'){g.fillStyle=p.accent;g.fillRect(xx-.6*t,4.48*t,1.2*t,.1*t);for(let i=0;i<5;i++)g.fillRect(xx-.55*t+i*.25*t,4.15*t,.035*t,.35*t);}
  }
  g.fillStyle=material(g,6);g.fillRect(0,0,W,3*t);g.fillStyle=p.roof+'b0';g.fillRect(0,0,W,3*t);
  const ridge=p.architecture==='urban'?.45:traditional?.2:.05,eave=p.architecture==='urban'?2.4:2.75;
  if(p.architecture!=='urban'){
   const roof=g.createLinearGradient(0,0,0,3*t);roof.addColorStop(0,p.roof+'20');roof.addColorStop(1,'#243c4270');g.fillStyle=roof;
   g.beginPath();g.moveTo(0,eave*t);g.lineTo(W*.17,ridge*t);g.lineTo(W*.83,ridge*t);g.lineTo(W,eave*t);g.closePath();g.fill();
   g.save();g.clip();g.strokeStyle=p.architecture==='tropical'?'#f5d8ad77':'#c8d3c735';g.lineWidth=t*.016;
   for(let i=0;i<b.w*5;i++){g.beginPath();g.moveTo(i*t*.24,0);g.lineTo(i*t*.24-t*.4,3*t);g.stroke();}
   for(let r=0;r<7;r++){g.beginPath();g.moveTo(0,r*t*.4);g.lineTo(W,r*t*.4);g.stroke();}g.restore();
  }else{
   g.fillStyle='#b5c6c5';g.fillRect(.1*t,.14*t,W-.2*t,.15*t);for(let i=0;i<b.w;i++){g.fillStyle='#66949f';g.fillRect((i+.12)*t,.6*t,.76*t,1.4*t);g.fillStyle='#cfdbcd';g.fillRect((i+.15)*t,.7*t,.07*t,1.2*t);}g.fillStyle=p.accent;g.fillRect(0,2.25*t,W,.18*t);
  }
  g.fillStyle='#24373577';g.fillRect(0,2.8*t,W,.2*t);g.fillStyle=p.architecture==='tropical'?'#f0e1bf':p.accent;g.fillRect(0,2.76*t,W,.065*t);
  if(['castle','onsen'].includes(p.architecture)){
   const ww=W*.48;g.fillStyle=p.wall;g.fillRect((W-ww)/2,.25*t,ww,.9*t);g.fillStyle=p.roof;g.beginPath();g.moveTo((W-ww)/2-.2*t,1.16*t);g.lineTo(W/2,0);g.lineTo((W+ww)/2+.2*t,1.16*t);g.closePath();g.fill();g.strokeStyle=p.accent;g.lineWidth=.05*t;g.stroke();
  }
  if(p.architecture==='kura'){g.strokeStyle='#f6ebd5';g.lineWidth=.09*t;g.strokeRect(.12*t,.18*t,W-.24*t,2.55*t);}
  if(p.architecture==='port'||p.architecture==='brick'){
   g.fillStyle=p.wall;g.beginPath();g.moveTo(W/2-.6*t,1.55*t);g.lineTo(W/2,.5*t);g.lineTo(W/2+.6*t,1.55*t);g.closePath();g.fill();g.strokeStyle='#e5d5ad';g.lineWidth=.05*t;g.stroke();
  }
  // A civic roof ornament and repeated local motifs are readable at the normal camera scale.
  if(index<2||index===4)regionalEmblem(g,p,W/2,p.architecture==='urban'?1.25*t:1.65*t,.9*t);
  if(p.architecture==='onsen'){
   g.strokeStyle='#f6f0d26b';g.lineWidth=.09*t;for(let i=0;i<3;i++){g.beginPath();g.moveTo((b.w-.6-i*.23)*t,.8*t);g.bezierCurveTo((b.w-1-i*.23)*t,.5*t,(b.w-.5-i*.23)*t,.3*t,(b.w-.8-i*.23)*t,.05*t);g.stroke();}
  }
  g.restore();
 }
 function regionalGround(g,m,t){
  const p=m.regional;if(!p)return;
  for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){
   const cell=m.tiles[y][x],seed=x*17+y*31;
   if(m.kind==='town'&&cell===','){
    g.save();g.translate(x*t,y*t);g.strokeStyle=p.architecture==='brick'?'#744e3844':'#3c5b5b33';g.lineWidth=t*.012;
    if(p.architecture==='brick')for(let row=0;row<4;row++){g.beginPath();g.moveTo(0,row*t*.25);g.lineTo(t,row*t*.25);g.stroke();g.beginPath();g.moveTo((row%2?.3:.65)*t,row*t*.25);g.lineTo((row%2?.3:.65)*t,(row+1)*t*.25);g.stroke();}
    else if(['urban','stone','kura'].includes(p.architecture)){g.strokeRect(0,0,t,t);g.beginPath();g.moveTo(0,.5*t);g.lineTo(t,.5*t);g.stroke();}
    else if(p.architecture==='tropical'){g.beginPath();g.moveTo(t*.5,0);g.lineTo(t,t*.5);g.lineTo(t*.5,t);g.lineTo(0,t*.5);g.closePath();g.stroke();}
    g.restore();
   }
   if(m.kind==='town'&&cell==='.'){
    g.fillStyle=({birch:'#cad6bb44',palm:'#b5bf6a55',bamboo:'#49754d55',grass:'#8f9f5666',tea:'#4f783c66',maple:'#a4a36e44',ginkgo:'#b8af6c44',cedar:'#386f5944'})[p.plant]||'#7eab7655';g.fillRect(x*t,y*t,t,t);
   }
   if(cell==='T')regionalPlant(g,p,x*t,y*t,t,seed);
   else if(cell==='.'&&m.kind==='town'&&seed%4===0&&!m.objects.some(o=>o.x===x&&o.y===y))regionalPlant(g,p,x*t,y*t,t,seed,true);
  }
  // Distant silhouettes stay on the blocked northern boundary; they cannot cover a route.
  g.save();g.beginPath();for(let x=0;x<m.w;x++)if(['W','T'].includes(m.tiles[0][x]))g.rect(x*t,0,t,t);g.clip();
  const sky=g.createLinearGradient(0,0,0,t);sky.addColorStop(0,'#b9d6cf');sky.addColorStop(1,p.accent);g.fillStyle=sky;g.fillRect(0,0,m.w*t,t);
  g.fillStyle=p.scenery==='snow'||p.scenery==='fuji'?'#819c9b':'#62857d';
  for(let x=0;x<m.w;x+=4){g.beginPath();g.moveTo((x-1)*t,t);g.lineTo((x+1.4)*t,.1*t);g.lineTo((x+4)*t,t);g.fill();if(['snow','fuji'].includes(p.scenery)){g.fillStyle='#ecebd8';g.beginPath();g.moveTo((x+.75)*t,.35*t);g.lineTo((x+1.4)*t,.1*t);g.lineTo((x+2)*t,.35*t);g.fill();g.fillStyle='#819c9b';}}
  if(['sea','lake','river'].includes(p.scenery)){g.fillStyle=p.accent;g.fillRect(0,t*.62,m.w*t,t*.38);g.strokeStyle='#dce8c788';g.lineWidth=t*.025;for(let x=0;x<m.w;x+=2){g.beginPath();g.moveTo(x*t,t*.79);g.lineTo((x+.8)*t,t*.79);g.stroke();}}
  if(p.scenery==='city'){g.fillStyle='#496b76';for(let x=0;x<m.w;x++)g.fillRect(x*t,t*(.1+(x*7%5)*.1),t*.7,t);}
  g.restore();
 }

 function mapLayer(id,frame=0){const m=MAPS[id];if(!atlas||m.kind==='in')return legacy(id,frame);
  if(cache.has(id)){const c=cache.get(id);cache.delete(id);cache.set(id,c);return c;}
  const ratio=m.w*m.h*64*64*4>LIMIT?2:4,tile=16*ratio,c=make(m.w*tile,m.h*tile),g=c.getContext('2d');c.artScale=ratio;
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  const at=(x,y)=>m.tiles[y]?.[x]||'T';
  // One shared pattern per material continues across neighboring cells, without tile seams.
  for(let index=0;index<12;index++){g.beginPath();let used=false;for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++)if(base(m,at(x,y),x,y)===index){g.rect(x*tile,y*tile,tile,tile);used=true;}if(used){g.save();g.clip();g.fillStyle=material(g,index);g.fillRect(0,0,c.width,c.height);g.restore();}}
  for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){const t=at(x,y),X=x*tile,Y=y*tile;
   if(m.regional&&m.kind==='town'&&t===','){g.fillStyle=m.regional.paving+'bb';g.fillRect(X,Y,tile,tile);}
   if(m.regional&&t==='~'){g.fillStyle=m.regional.accent+'44';g.fillRect(X,Y,tile,tile);}
   if(t==='W'){g.fillStyle='#718186';g.fillRect(X,Y,tile,tile);g.strokeStyle='#394d59';g.lineWidth=ratio*.6;for(let row=0;row<3;row++){g.beginPath();g.moveTo(X,Y+row*tile/3);g.lineTo(X+tile,Y+row*tile/3);g.stroke();for(let col=0;col<2;col++){const xx=X+(col*.5+(row%2?.25:0))*tile;g.beginPath();g.moveTo(xx,Y+row*tile/3);g.lineTo(xx,Y+(row+1)*tile/3);g.stroke();}}g.fillStyle='#dae2d0';g.fillRect(X,Y,tile,ratio);}
   if(t==='f'){g.fillStyle='#123b2b55';g.fillRect(X,Y+tile*.65,tile,tile*.35);g.strokeStyle='#b1c98b';g.lineWidth=ratio*.7;g.strokeRect(X+ratio,Y+ratio,tile-ratio*2,tile*.75);}
   if(m.kind==='field'&&'123'.includes(t)&&!m.trailCells?.[y]?.[x]){g.fillStyle=t==='1'?'#bfcf6818':t==='2'?'#65934418':'#967c6020';g.fillRect(X,Y,tile,tile);}
   if(t==='T'&&!m.regional){
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
  regionalGround(g,m,tile);
  for(const [index,b] of (m.buildings||[]).entries()){
   const X=b.x*tile,Y=b.y*tile,W=b.w*tile,H=b.h*tile,cx=(b.door[0]+.5)*tile,dy=b.door[1]*tile;
   g.fillStyle='#132a3938';g.fillRect(X+ratio,Y+H,W,ratio*2);
   g.fillStyle=['#6f32351e','#754c1720','#253c4326','#57443b20'][b.style];g.fillRect(X,Y,W,tile*3);
   g.strokeStyle='#563a33';g.lineWidth=ratio*1.2;g.strokeRect(X+ratio*.5,Y+ratio*.5,W-ratio,tile*3-ratio);
   g.strokeStyle='#f5d9a077';g.lineWidth=ratio*.6;g.beginPath();g.moveTo(X+ratio,Y+tile*.4);g.lineTo(X+W-ratio,Y+tile*.4);g.stroke();
   regionalBuilding(g,m,b,tile,index);
   serviceFacade(g,b,tile);
   g.fillStyle='#dfcba7';g.fillRect(cx-tile*.5,dy,tile,tile);g.fillStyle=b.service?'#233b43':'#70523c';g.fillRect(cx-tile*.29,dy+tile*.1,tile*.58,tile*.85);g.strokeStyle='#a4895a';g.lineWidth=ratio*.6;g.strokeRect(cx-tile*.29,dy+tile*.1,tile*.58,tile*.85);
   if(!b.service){g.fillStyle='#dfc98b';g.beginPath();g.arc(cx+tile*.17,dy+tile*.59,ratio*.7,0,Math.PI*2);g.fill();}
   if(b.service){const label=({shop:'わくわく道具店',inn:'ほっと宿屋',jobcenter:'おしごと広場',door:'ようこそ！'})[b.service],tw=Math.max(tile*1.4,label.length*tile*.34);g.fillStyle=b.service==='shop'?'#b84b60':'#286b70';g.fillRect(cx-tw/2-2,dy-tile*1.72-2,tw+4,tile*.62);g.strokeStyle='#e0bf80';g.lineWidth=ratio*.4;g.strokeRect(cx-tw/2,dy-tile*1.72,tw,tile*.52);g.fillStyle='#fff0c8';g.font='800 '+tile*.32+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(label,cx,dy-tile*1.45);}
  }
  // Broad, static daylight and soft cloud shadows add depth without per-frame work.
  const glow=g.createLinearGradient(0,0,c.width,c.height);glow.addColorStop(0,'#fff1c31f');glow.addColorStop(.5,'#fff9e500');glow.addColorStop(1,'#0a344827');g.fillStyle=glow;g.fillRect(0,0,c.width,c.height);
  cache.set(id,c);bytes+=c.width*c.height*4;while(cache.size>1&&(bytes>LIMIT||cache.size>4)){const key=cache.keys().next().value,old=cache.get(key);bytes-=old.width*old.height*4;cache.delete(key);}return c;
 }
 ART.mapLayer=mapLayer;
 return {loaded,mapLayer,ready:()=>!!atlas,stats:()=>({bytes,limit:LIMIT,entries:cache.size,materials:patterns.size,error})};
})();
