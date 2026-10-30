/* Detailed art uses twice the pixels; gameplay stays on the original 16px grid. */
const ART_HD=(()=>{
 const R=2, maps=new Map(), people=new Map(), objects=new Map(), enemies=new Map();
 const MAP_BYTES=32*1024*1024;let mapBytes=0;
 const oldTile=ART.tile,oldObject=ART.object;
 const themes={coast:['#739878','#38584b','#327c91','#96d6cf'],forest:['#527a60','#294c40','#397a88','#90c7bc'],mountain:['#7a907e','#455a52','#597f9a','#b7d6dc'],river:['#6f9666','#355d48','#3b83a1','#a3d8ce'],lake:['#718f7e','#355952','#517c9c','#b7d8d5'],plain:['#86a56d','#47684b','#428e9b','#a6d3c0']};
 const mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.imageSmoothingEnabled=false;return[c,g];};
 const P=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));};
 const rgb=c=>{const n=parseInt(c.slice(1),16);return[n>>16&255,n>>8&255,n&255];};
 const mix=(a,b,t)=>{const A=rgb(a),B=rgb(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*Math.max(0,Math.min(1,t))).toString(16).padStart(2,'0')).join('');};
 const light=(c,t=.25)=>mix(c,'#fff0cf',t),dark=(c,t=.3)=>mix(c,'#142532',t);
 function rng(seed){let n=2166136261;for(const c of String(seed)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};}
 const ellipse=(g,x,y,rx,ry,c)=>{g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();};
 const poly=(g,points,c)=>{g.fillStyle=c;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();};
 function cached(cache,key,limit,make){if(cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);return v;}const v=make();cache.set(key,v);if(cache.size>limit)cache.delete(cache.keys().next().value);return v;}
 function grass(g,r,theme){
  P(g,0,0,32,32,theme[0]);
  const colors=[dark(theme[0],.08),light(theme[0],.08),light(theme[0],.19),dark(theme[0],.16)];
  for(let i=0;i<25;i++){const x=1+Math.floor(r()*29),y=1+Math.floor(r()*29);P(g,x,y,1+r()*2,1,colors[i%4]);if(i%5===0){P(g,x,y-2,1,3,colors[3]);P(g,x+1,y-1,1,2,colors[2]);}}
  if(r()<.16){const x=4+Math.floor(r()*24),y=6+Math.floor(r()*22);P(g,x,y,1,4,theme[1]);ellipse(g,x,y-1,2,2,r()<.5?'#ecd5b2':'#dba6a3');P(g,x,y-1,1,1,'#f6dc8f');}
 }
 function tile(g,X,Y,t,nb,frame,seed,terrain='plain'){
  const r=rng(seed),th=themes[terrain]||themes.plain;g.save();g.translate(X,Y);
  switch(t){
   case '.':case '1':case 'T':{
    grass(g,r,th);
    if(t==='1'){for(let i=0;i<16;i++){const x=2+Math.floor(r()*27),y=6+Math.floor(r()*24),s=(frame%2&&i%3===0)?1:0;P(g,x+s,y-5,1,6,th[1]);P(g,x+1+s,y-3,1,4,light(th[0],.4));P(g,x-1,y-1,1,2,light(th[0],.2));}if(nb(0,-1)!=='1')P(g,0,0,32,1,'#c2b46f');}
    if(t==='T'){
     ellipse(g,17,28,13,3,'#18372e77');P(g,14,18,5,13,'#5e4738');P(g,15,20,1,10,'#b29362');P(g,18,22,1,8,'#302f2c');
     const base=terrain==='mountain'?'#3b645c':terrain==='coast'?'#42735b':'#34694b';
     if(terrain==='mountain'){
      poly(g,[[16,1],[25,14],[22,14],[30,25],[3,25],[9,14],[6,14]],dark(base,.13));
      poly(g,[[16,2],[17,13],[8,14]],light(base,.36));poly(g,[[15,12],[16,23],[5,24]],light(base,.19));
      for(let y=8;y<26;y+=5){P(g,12-(y>>2),y,7,1,light(base,.3));P(g,20,y+2,4,1,dark(base,.3));}
     }else{
      for(const [cx,cy,rx,ry]of [[16,9,10,8],[9,15,8,8],[23,15,8,8],[16,19,12,9]])ellipse(g,cx,cy,rx,ry,dark(base,.15));
      for(const [cx,cy,rx,ry]of [[13,7,7,5],[7,13,5,5],[20,11,7,6],[13,18,9,6]])ellipse(g,cx,cy,rx,ry,base);
      for(let i=0;i<36;i++){const x=4+Math.floor(r()*24),y=4+Math.floor(r()*21);if(((x-16)/13)**2+((y-14)/11)**2<1)P(g,x,y,2,1,i%4?light(base,.12+r()*.3):dark(base,.22));}
      P(g,10,4,5,1,light(base,.48));P(g,5,12,3,1,light(base,.38));
     }
    }
    break;
   }
   case ',':case '2':case 'w':{
    const base=t==='2'?'#819198':t==='w'?'#b7a88b':'#b4ac96';P(g,0,0,32,32,dark(base,.3));
    for(let row=0;row<2;row++)for(let col=-1;col<3;col++){
     const x=col*16+(row%2)*8,y=row*16,v=r(),c=mix(dark(base,.09),light(base,.22),v);
     poly(g,[[x+2,y+1],[x+14,y+1],[x+15,y+3],[x+15,y+13],[x+13,y+15],[x+2,y+15],[x+1,y+13],[x+1,y+3]],c);
     P(g,x+3,y+1,10,1,light(c,.28));P(g,x+1,y+3,1,9,light(c,.12));P(g,x+3,y+14,10,1,dark(c,.18));
     for(let i=0;i<5;i++)P(g,x+3+r()*10,y+3+r()*9,1,1,i%2?light(c,.12):dark(c,.1));
     if(v<.12){P(g,x+1,y+12,2,2,'#667d59');P(g,x+3,y+14,3,1,'#7f9563');}
    }
    const edge=(dx,dy)=>'.T1'.includes(nb(dx,dy));
    if(edge(0,-1)){P(g,0,0,32,2,th[1]);for(let x=2;x<32;x+=5)P(g,x,1,2,2,th[0]);}
    if(edge(0,1))P(g,0,30,32,2,th[1]);if(edge(-1,0))P(g,0,0,2,32,th[1]);if(edge(1,0))P(g,30,0,2,32,th[1]);
    if(t==='2'&&r()<.24){ellipse(g,18,20,8,3,th[2]);P(g,13+frame,19,7,1,th[3]);}
    break;
   }
   case '~':case '=':{
    P(g,0,0,32,32,th[2]);
    for(let y=0;y<32;y++)P(g,0,y,32,1,mix(th[2],dark(th[2],.25),(Math.sin(y/6+frame*.4)+1)*.12));
    for(let i=0;i<9;i++){const x=(Math.floor(r()*28)+frame*2)%29,y=3+Math.floor(r()*26);P(g,x,y,3+r()*5,1,i%3?light(th[2],.21):th[3]);P(g,x+2,y+1,2,1,dark(th[2],.1));}
    const land=(dx,dy)=>!'~='.includes(nb(dx,dy));
    if(land(0,-1)){P(g,0,0,32,3,'#c2bca1');P(g,0,3,32,3,th[3]);for(let x=0;x<32;x+=4)P(g,x+(frame%2),6,2,1,'#dfebe0');P(g,0,7,32,2,dark(th[2],.1));}
    if(land(-1,0)){P(g,0,0,3,32,'#b2b49a');P(g,3,0,3,32,th[3]);}
    if(land(1,0)){P(g,29,0,3,32,'#b2b49a');P(g,26,0,3,32,th[3]);}
    if(land(0,1)){P(g,0,29,32,3,'#9fa88e');P(g,0,26,32,3,th[3]);}
    if(t==='='){
     P(g,2,0,28,32,'#604d3d');for(let y=0;y<32;y+=6){P(g,4,y+1,24,4,'#9c7d55');P(g,4,y+1,24,1,'#ccac75');P(g,6,y+3,17,1,'#876a4c');}P(g,2,0,2,32,'#d0b27b');P(g,28,0,2,32,'#4e4439');for(let y=3;y<32;y+=12){P(g,1,y,3,3,'#d5ba82');P(g,28,y,3,3,'#d5ba82');}
    }
    break;
   }
   case '#':{
    P(g,0,0,32,32,'#c6b38f');for(let y=0;y<32;y+=8){P(g,0,y+7,32,1,'#ad9877');for(let x=(y%16?8:0);x<32;x+=16)P(g,x,y,1,7,'#b39d7a');}
    P(g,0,0,32,4,'#6b5946');P(g,0,4,32,2,'#a28b66');
    P(g,5,8,22,17,'#695b48');P(g,7,9,18,14,'#294a5b');
    P(g,8,10,7,10,'#78afb3');P(g,17,10,7,10,'#426f86');P(g,8,10,6,2,'#c7e0d0');P(g,9,12,2,5,'#9ac6c1');
    P(g,15,9,2,14,'#d2b98c');P(g,7,16,18,2,'#c2a477');P(g,4,24,24,2,'#ecdbaf');P(g,5,26,22,2,'#938266');
    if(r()<.35){P(g,7,25,18,4,'#6c5942');for(let i=0;i<6;i++){P(g,8+i*3,24,2,2,th[1]);P(g,9+i*3,23,1,1,i%2?'#d7a4a1':'#e9d4a0');}}
    if(nb(-1,0)!=='#'){P(g,0,0,3,32,'#a58b67');P(g,0,3,1,29,'#e7d4a5');}if(nb(1,0)!=='#')P(g,29,0,3,32,'#897455');
    if(nb(0,1)!=='#'){P(g,0,29,32,3,'#7a766b');P(g,0,29,32,1,'#afa68a');}break;
   }
   case 'c':{
    P(g,0,0,32,32,'#503d40');for(let y=0;y<32;y+=8)for(let x=-8+(y%16?8:0);x<32;x+=16){P(g,x+1,y+1,14,6,'#9e5d54');P(g,x+3,y+1,9,1,'#d29171');P(g,x+2,y+2,2,3,'#b7735f');P(g,x+12,y+3,2,4,'#754b47');P(g,x+3,y+7,10,1,'#3f353b');}
    if(nb(0,-1)!=='c'){P(g,0,0,32,2,'#e3ac80');P(g,0,2,32,1,'#be7d62');}if(nb(0,1)!=='c'){P(g,0,27,32,2,'#d6a178');P(g,0,29,32,3,'#3b3538');}break;
   }
   case '3':{
    P(g,0,0,32,32,'#777898');for(let i=0;i<30;i++){const x=r()*30,y=r()*31;P(g,x,y,2,1,i%3?'#8e91aa':'#606c86');}for(let i=0;i<3;i++){const x=3+r()*23,y=3+r()*23;poly(g,[[x,y+4],[x+2,y],[x+6,y-1],[x+9,y+4],[x+7,y+6],[x+1,y+6]],'#a3b0b2');P(g,x+3,y+1,3,1,'#d0d3c3');}break;
   }
   default:g.drawImage(oldTile(t,frame),0,0,32,32);
  }
  if(!'#cT~='.includes(t)){
   if('#cT'.includes(nb(0,-1)))P(g,0,0,32,5,'#112b3428');if('#cT'.includes(nb(-1,0)))P(g,0,0,4,32,'#112b341f');
  }
  g.restore();
 }
 function mapLayer(id,frame){
  const key=id+'/'+frame%4;if(maps.has(key)){const c=maps.get(key);maps.delete(key);maps.set(key,c);return c;}
  const m=MAPS[id],[c,g]=mk(m.w*32,m.h*32);c.artScale=R;
  const at=(x,y)=>x<0||y<0||x>=m.w||y>=m.h?(m.kind==='in'?'#':'T'):m.tiles[y][x];
  for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++)tile(g,x*32,y*32,at(x,y),(dx,dy)=>at(x+dx,y+dy),frame%4,id+':'+x+','+y,m.terrain);
  const shade=g.createLinearGradient(0,0,c.width,c.height);shade.addColorStop(0,'#f3d9a00b');shade.addColorStop(1,'#071d3020');g.fillStyle=shade;g.fillRect(0,0,c.width,c.height);
  maps.set(key,c);mapBytes+=c.width*c.height*4;
  while(maps.size>1&&(maps.size>8||mapBytes>MAP_BYTES)){const first=maps.keys().next().value,old=maps.get(first);mapBytes-=old.width*old.height*4;maps.delete(first);}
  return c;
 }
 function person(id,hair,coat,dir,frame,opt={}){
  frame%=4;const key=JSON.stringify([id,hair,coat,dir,frame,opt.long,opt.ribbon]);
  return cached(people,key,256,()=>{
   const[c,g]=mk(32,48);c.artScale=R;
   if(dir===3){g.translate(32,0);g.scale(-1,1);g.drawImage(person(id,hair,coat,2,frame,opt),0,0);return c;}
   const r=rng(id),variant=Math.floor(r()*3),step=frame===1?2:frame===3?-2:0,bob=step?1:0,skin='#e6b38a',skinSh='#c78c71',ink='#1a2630';
   ellipse(g,16,45,10,2,'#0d1e2a44');
   // Boots, trousers, a layered coat and a small leather travel bag.
   for(const [x,s]of [[11,step],[19,-step]]){P(g,x,35,4,9-Math.max(0,s),dark(PAL.navy,.1));P(g,x,42-Math.max(0,s),5,3,'#503f39');P(g,x,42-Math.max(0,s),4,1,'#a38766');P(g,x+1,37,1,4,'#52616c');}
   const Y=y=>y-bob;
   poly(g,[[9,Y(24)],[22,Y(24)],[25,Y(37)],[20,Y(40)],[10,Y(39)],[7,Y(36)]],dark(coat,.35));
   P(g,10,Y(25),12,11,coat);P(g,10,Y(25),3,11,light(coat,.22));P(g,20,Y(26),3,10,dark(coat,.23));P(g,11,Y(37),10,1,light(coat,.16));
   if(dir!==1){poly(g,[[13,Y(24)],[16,Y(28)],[19,Y(24)]],'#e5d6b1');P(g,16,Y(28),1,10,dark(coat,.42));for(let y=29;y<37;y+=4)P(g,17,Y(y),1,1,'#e5c37d');}
   const arm=dir===2?12:7;P(g,arm-step/2,Y(26),4,9,coat);P(g,arm-step/2,Y(35),3,3,skin);P(g,arm-step/2,Y(34),4,1,light(coat,.3));
   if(dir!==2){P(g,23+step/2,Y(26),3,8,dark(coat,.18));P(g,23+step/2,Y(34),3,3,skinSh);}
   if(dir!==1){for(let i=0;i<13;i++)P(g,11+Math.floor(i*.6),Y(25+i),1,1,'#b79861');P(g,21,Y(32),6,7,'#72533d');P(g,21,Y(32),6,2,'#b08d59');P(g,24,Y(34),1,2,'#e0c587');}
   // Hair silhouette, rounded face, lashes, eye highlights and a short fringe.
   if(opt.long){P(g,7,Y(11),18,18,dark(hair,.24));P(g,8,Y(21),3,10,hair);P(g,22,Y(21),3,9,dark(hair,.15));}
   ellipse(g,16,Y(14),10,11,ink);ellipse(g,16,Y(13),9,10,hair);
   if(dir===1){ellipse(g,16,Y(15),8,9,hair);P(g,10,Y(8),7,2,light(hair,.25));P(g,21,Y(13),2,8,dark(hair,.3));P(g,11,Y(24),10,1,dark(hair,.28));}
   else{
    ellipse(g,16,Y(16),7.5,9,skin);P(g,22,Y(14),2,8,skinSh);P(g,10,Y(20),2,2,'#d99b84');P(g,20,Y(20),2,2,'#cf947d');
    poly(g,[[7,Y(12)],[9,Y(5)],[17,Y(3)],[24,Y(9)],[25,Y(16)],[21,Y(13)],[20,Y(10)],[17,Y(14)],[15,Y(10)],[11,Y(14)]],hair);
    P(g,10,Y(7),7,1,light(hair,.34));P(g,9,Y(8),4,1,light(hair,.24));P(g,21,Y(10),2,4,dark(hair,.2));
    if(dir===2){P(g,9,Y(16),3,4,'#f1e5ca');P(g,9,Y(17),2,3,ink);P(g,10,Y(16),1,1,'#ffffff');P(g,7,Y(20),2,1,skin);P(g,11,Y(23),3,1,'#986457');P(g,20,Y(13),4,11,hair);}
    else{for(const x of [11,19]){P(g,x,Y(16),3,4,'#f2e5ce');P(g,x+1,Y(17),2,3,ink);P(g,x+1,Y(16),1,1,'#ffffff');P(g,x-1,Y(15),4,1,dark(hair,.3));}P(g,15,Y(22),3,1,'#a36c5e');P(g,16,Y(20),1,1,'#f8c5a0');}
   }
   if(opt.ribbon){const x=dir===2?21:23;poly(g,[[x,Y(8)],[x-4,Y(5)],[x-4,Y(11)],[x,Y(9)],[x+4,Y(5)],[x+4,Y(11)]],opt.ribbon);P(g,x-1,Y(8),2,2,light(opt.ribbon,.45));P(g,x+1,Y(10),2,5,dark(opt.ribbon,.15));}
   if(!opt.long&&variant===1)P(g,15,Y(3),5,1,light(hair,.18));return c;
  });
 }
 function object(type,frame=0){return cached(objects,type+'/'+frame%4,96,()=>{
  const[c,g]=mk(32,48);c.artScale=R;g.drawImage(oldObject(type,frame),0,0,32,48);
  switch(type){
   case 'shop':case 'inn':{
    g.clearRect(0,0,32,48);P(g,2,18,28,13,'#876548');P(g,2,18,28,2,'#caa578');P(g,4,21,24,8,'#b59768');P(g,4,28,24,2,'#654b3b');
    for(let x=0;x<32;x+=8){poly(g,[[x+2,5],[x+8,5],[x+10,17],[x,17]],type==='shop'?(x%16?'#ecd8b3':'#a85e58'):(x%16?'#526c7d':'#273b51'));ellipse(g,x+4,17,4,2,type==='shop'?(x%16?'#d7c19a':'#854951'):'#304c63');}
    P(g,1,5,30,2,'#d1b38a');P(g,1,19,1,15,'#624b39');P(g,30,19,1,15,'#624b39');
    if(type==='shop'){for(let i=0;i<5;i++){ellipse(g,6+i*5,22,2,2,['#d3a866','#8cad78','#c97768','#a8c4b1','#dfc88e'][i]);}}
    else{P(g,12,9,9,6,'#f0deba');P(g,15,10,3,1,'#9e625a');P(g,15,12,1,2,'#9e625a');ellipse(g,27,24,3,4,'#e9bf73');P(g,26,21,1,5,'#ffdf9b');}
    break;
   }
   case 'box':case 'boxOpen':{
    g.clearRect(0,0,32,48);P(g,4,28,24,16,'#704f3b');P(g,5,30,22,11,'#9c744a');for(let x=7;x<27;x+=6)P(g,x,29,1,13,'#684936');P(g,4,27,24,3,'#d7b775');P(g,5,28,22,1,'#f1d79a');P(g,5,41,22,2,'#bc9658');P(g,6,28,2,15,'#d3b370');P(g,24,28,2,15,'#ba945c');P(g,14,28,5,7,'#e6cf8a');P(g,16,31,1,2,'#5c4e37');if(type==='boxOpen'){P(g,6,25,20,5,'#302f30');poly(g,[[3,23],[7,17],[29,17],[27,23]],'#d5b875');}break;
   }
   case 'sign':case 'board':case 'landmark':P(g,6,17,19,1,'#f3ddaa');P(g,6,19,1,8,'#dac18d');P(g,25,19,1,8,'#675342');break;
   case 'station':P(g,9,17,5,4,'#cae5d7');P(g,18,17,3,4,'#a8d0cf');P(g,4,37,24,1,'#d8e7d3');break;
   case 'gate':P(g,3,9,26,1,'#e9b17c');P(g,5,16,1,26,'#d99b72');P(g,26,16,1,26,'#713e44');break;
   case 'bench':for(let y=21;y<32;y+=4)P(g,4,y,24,1,'#c8a579');P(g,6,34,2,9,'#5e5650');P(g,25,34,2,9,'#5e5650');break;
   case 'boss':{
    g.clearRect(0,0,32,48);ellipse(g,16,37,13,5,'#e8b26825');ellipse(g,16,36,10,3,'#5c5267');ellipse(g,16,34,10,3,'#b8a479');for(let i=0;i<8;i++){const a=i*Math.PI/4+frame*.25;P(g,15+Math.cos(a)*10,25+Math.sin(a)*6,2,2,i%2?'#f2cd7d':'#a9d9c7');}poly(g,[[16,13],[20,22],[16,29],[12,22]],'#e9d19b');P(g,15,17,2,7,'#fff1c8');break;
   }
  }return c;
 });}
 const shapes={'反響体':'ring','風環体':'ring','回転体':'ring','光膜体':'panel','投影体':'panel','文字体':'glyph','水紋体':'drop','微粒体':'cloud','鉱殻体':'crystal','火花体':'spark','容器体':'jar','機材体':'box','紙積体':'box','灯籠体':'lantern','配線体':'coil','布帯体':'ribbon','紙片体':'sheet','歯車体':'gear','音符体':'note'};
 const attrs={'音':['#8370a8','#efd5a3'],'光':['#bca05a','#fff0b6'],'電':['#4c9e98','#f7d778'],'熱':['#b75a59','#f4c477'],'水':['#4b91aa','#b5e4d4'],'風':['#729d76','#e4dfb4'],'土':['#a88865','#e6cba0'],'無':['#7d96a2','#d5e2db']};
 function inside(shape,u,v){const d=Math.hypot(u,v),a=Math.atan2(v,u);switch(shape){
  case 'ring':return Math.hypot(u,v*1.05)<.72&&Math.hypot(u,v*1.05)>.35;
  case 'gear':return d<(Math.cos(a*10)>.15?.76:.64)&&d>.23;
  case 'crystal':return Math.abs(u)*.9+Math.abs(v)*.7<.72;
  case 'cloud':return Math.hypot(u+.3,v)<.41||Math.hypot(u-.3,v)<.41||Math.hypot(u,v+.25)<.43||Math.hypot(u,v-.15)<.42;
  case 'drop':return Math.hypot(u,(v-.16)*1.1)<.6||v<-.14&&v>-.85&&Math.abs(u)<(.85+v)*.72;
  case 'spark':return d<.42+.3*Math.pow(Math.abs(Math.cos(a*3)),3);
  case 'panel':case 'box':return Math.abs(u)<.65&&Math.abs(v)<.59;
  case 'jar':return Math.abs(u)<.58&&v>-.35&&v<.7||Math.abs(u)<.3&&v>-.69&&v<-.3;
  case 'lantern':return Math.hypot(u*.85,v*.75)<.57;
  case 'coil':return d<.73&&(d<.22||Math.abs(Math.sin(d*12-a*2))<.75);
  case 'ribbon':return Math.abs(v-.25*Math.sin(u*4))<.24&&Math.abs(u)<.82;
  case 'sheet':return Math.abs(u+v*.2)<.55&&Math.abs(v)<.69;
  case 'glyph':return Math.abs(v+.4)<.13&&Math.abs(u)<.7||Math.abs(u)<.15&&Math.abs(v)<.7||Math.abs(v-.2)<.13&&Math.abs(u)<.55||u>.24&&u<.42&&v>0&&v<.65;
  case 'note':return Math.hypot(u+.22,(v-.4)*1.25)<.3||Math.abs(u)<.1&&v>-.7&&v<.4||Math.abs(v+.6)<.13&&u>0&&u<.55;
  default:return d<.65;
 }}
 function enemy(profile,species,attr,area,frame,size=32,boss=false){
  const key=JSON.stringify([profile,species,attr,area,frame%2,size,boss]);return cached(enemies,key,160,()=>{
   const[c,g]=mk(size,size),r=rng(profile+area),kind=Math.floor(r()*4),colors=boss?Object.values(attrs)[Math.floor(r()*8)]:(attrs[attr]||attrs['無']),[rawBase,accent]=colors;
   const base=mix(rawBase,accent,.04+r()*.17);
   const shape=boss?['lantern','cloud','crystal','gear'][kind]:(shapes[species]||'drop'),S=size,bob=frame%2*.018;
   // Limbs and fins extend each creature beyond its material core.
   g.save();g.scale(S/64,S/64);
   if(['cloud','drop','spark','crystal'].includes(shape)){
    for(const side of [-1,1]){const x=32+side*17;poly(g,[[x,35],[x+side*10,41+frame%2],[x+side*5,46],[x-side*2,41]],dark(base,.12));ellipse(g,x+side*7,43+frame%2,3,2,light(base,.15));}
   }
   if(['ring','gear','coil'].includes(shape)){for(const side of [-1,1]){P(g,30+side*14,47,4,8,dark(base,.25));ellipse(g,32+side*14,55,5,2,accent);}}
   if(boss){g.strokeStyle=accent;g.lineWidth=.65;g.globalAlpha=.4;g.beginPath();g.ellipse(32,32,29,28,0,0,Math.PI*2);g.stroke();g.globalAlpha=1;}
   g.restore();
   const mask=(x,y)=>inside(shape,(x+.5)/S*2-1,(y+.5)/S*2-1-bob);
   // Pixel-built rim, volumetric shading, reflected light and distinct material seams.
   for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    if(!mask(x,y)){if(mask(x-1,y)||mask(x+1,y)||mask(x,y-1)||mask(x,y+1))P(g,x,y,1,1,'#1b2b39');continue;}
    const u=x/S,v=y/S,shine=Math.exp(-((u-.32)**2+(v-.25)**2)*30);
    let shade=.62-v*.6-u*.2+shine*.28;
    let col=shade>0?light(base,shade):dark(base,-shade+.05);
    if(!mask(x+2,y+2))col=dark(base,.36);else if(!mask(x-2,y-2))col=light(base,.5);
    const unit=Math.max(1,S/32),xx=Math.floor(x/unit),yy=Math.floor(y/unit);
    if(['jar','lantern'].includes(shape)&&Math.abs(Math.sin(x/S*Math.PI*8))<.12)col=mix(col,accent,.25);
    if(shape==='crystal'){col=mix(col,accent,(u<v?.05:.25));if(Math.abs(u-.5)<.025||Math.abs(v-u-.1)<.02)col=light(accent,.15);}
    if(['gear','panel','box'].includes(shape)&&yy%8===0)col=dark(base,.3);
    if(['sheet','glyph'].includes(shape)&&(yy%7===3&&xx%9<6))col=mix(col,accent,.5);
    if(['panel','box','gear','jar'].includes(shape)&&Math.abs(u-.28)<.012&&v>.2&&v<.7)col=light(accent,.25);
    if(shape==='cloud'&&Math.sin(u*28+v*15)> .82)col=mix(col,accent,.12);
    if(shape==='spark'&&Math.sin(u*19-v*21)> .94)col=light(accent,.35);
    if(shape==='drop'&&Math.abs(v-.67-Math.sin(u*7)*.025)<.013)col=light(accent,.2);
    P(g,x,y,1,1,col);
   }
   const q=S/64;g.save();g.scale(q,q);
   // Engraved seams, inset gemstones and a soft reflected rim.
   if(['crystal','panel','box','jar','gear','lantern'].includes(shape)){
    for(const side of [-1,1]){poly(g,[[32+side*12,23],[32+side*15,27],[32+side*12,31],[32+side*9,27]],dark(base,.5));poly(g,[[32+side*12,24],[32+side*14,27],[32+side*12,29],[32+side*10,27]],accent);}
   }
   if(['drop','cloud','spark'].includes(shape)){ellipse(g,24,21,4,2,'#fff2d34d');ellipse(g,21,25,1.3,1.8,'#fff9e77a');}

   if(['box','panel'].includes(shape)){for(const x of [17,42]){P(g,x,50,5,7,dark(base,.35));P(g,x-2,56,9,2,accent);}P(g,31,6,2,8,'#9eaea7');ellipse(g,32,6,3,3,accent);for(const x of [15,46])for(const y of [17,45]){ellipse(g,x,y,1.4,1.4,light(accent));}}
   if(['cloud','drop','spark'].includes(shape)){for(let i=0;i<4;i++){const x=8+r()*48,y=6+r()*43;if(Math.abs(x-32)>16){ellipse(g,x,y,1+r()*2,1+r()*2,light(base,.45));}}}
   if(shape==='lantern'){P(g,23,11,18,3,dark(base,.4));P(g,24,49,16,3,dark(base,.4));P(g,31,52,2,6,accent);for(const x of [26,31,36])P(g,x,57,1,4,light(accent,.2));}
   if(['ring','gear','coil'].includes(shape))for(let i=0;i<8;i++){const a=i*Math.PI/4;ellipse(g,32+Math.cos(a)*18,32+Math.sin(a)*18,1.6,1.6,accent);}
   if(shape==='jar'){P(g,24,11,16,3,accent);P(g,25,14,14,2,dark(base,.4));P(g,21,48,22,2,accent);}
   // Expressive eyes sit on a central plate on hollow species.
   if(['ring','gear','coil'].includes(shape)){ellipse(g,32,33,10,8,dark(base,.2));ellipse(g,31,31,8,6,base);}
   const ey=shape==='note'?43:shape==='ribbon'?31:shape==='glyph'?35:30+frame%2;
   for(const x of [24,38]){P(g,x-1,ey-2,7,1,dark(base,.6));ellipse(g,x+2,ey+2,3.5,4.5,'#f2e8cd');ellipse(g,x+3,ey+3,2,3,'#233342');P(g,x+2,ey,1,2,'#fffdf0');}
   P(g,30,ey+11,5,1,dark(base,.6));P(g,22,ey+8,3,1,light(accent,.3));P(g,43,ey+8,2,1,light(accent,.3));
   if(boss){
    poly(g,[[18,15],[16,4],[25,10],[32,1],[39,10],[48,4],[46,15]],'#c6a362');P(g,19,14,26,2,'#f5d697');ellipse(g,32,10,2.5,3,light(base,.55));
    for(let i=0;i<6;i++){const a=i*Math.PI/3+frame*.15,x=32+Math.cos(a)*27,y=34+Math.sin(a)*24;poly(g,[[x,y-3],[x+2,y],[x,y+3],[x-2,y]],i%2?accent:light(base,.45));}
    for(const x of [8,53]){P(g,x,24,2,22,dark(base,.2));P(g,x,25,2,10,accent);}
   }
   g.restore();return c;
  });
 }
 ART.person=person;ART.object=object;ART.enemy=enemy;ART.mapLayer=mapLayer;
 return {ratio:R,tile,mapLayer,person,enemy,stats:()=>({mapBytes,mapFrames:maps.size,people:people.size,enemies:enemies.size})};
})();
