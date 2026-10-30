/* ===== art: ドット素材をコードで生成（16色パレット基調・新規デザイン） ===== */
const ART = (()=>{
  const cache = {};
  // 地図は1枚が大きいため、直近2地域の4コマ分だけを保持する。
  const mapCache = new Map(), MAP_CACHE_LIMIT = 8;
  function mk(w,h){ const c=document.createElement("canvas"); c.width=w; c.height=h; const g=c.getContext("2d"); g.imageSmoothingEnabled=false; return [c,g]; }
  const px=(g,x,y,w,h,col)=>{ g.fillStyle=col; g.fillRect(x,y,w,h); };
  function seeded(str){ let h=2166136261; for(const ch of String(str)){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); } return ()=>{ h^=h<<13; h^=h>>>17; h^=h<<5; return ((h>>>0)%10000)/10000; }; }
  function hex(c){ const n=parseInt(c.slice(1),16); return [n>>16&255,n>>8&255,n&255]; }
  function mix(a,b,t){ const A=hex(a),B=hex(b); return "#"+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,"0")).join(""); }
  const dark=(c,t=.3)=>mix(c,PAL.ink,t), light=(c,t=.3)=>mix(c,PAL.cream,t);
  /* 透明部分に接する画素を濃紺の輪郭にする */
  function outline(c, col=PAL.ink){
    const g=c.getContext("2d"), w=c.width, h=c.height, d=g.getImageData(0,0,w,h), a=d.data, src=new Uint8ClampedArray(a);
    const op=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&src[(y*w+x)*4+3]>200;
    const [r,gg,b]=hex(col);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const i=(y*w+x)*4; if(src[i+3]>200) continue;
      if(op(x-1,y)||op(x+1,y)||op(x,y-1)||op(x,y+1)){ a[i]=r;a[i+1]=gg;a[i+2]=b;a[i+3]=255; } }
    g.putImageData(d,0,0);
  }

  /* ---- 地形 16×16（周囲のタイルを見て縁を描く） ---- */
  const WATER="~=", SOLID="#cT";
  function drawTile(g, X, Y, t, nb, frame, seed){
    const r=seeded(seed); const P=(x,y,w,h,c)=>px(g,X+x,Y+y,w,h,c);
    const grass=()=>{ P(0,0,16,16,PAL.leaf);
      for(let i=0;i<5;i++){ const x=Math.floor(r()*14), y=Math.floor(r()*13); P(x,y+1,1,2,PAL.forest); P(x+1,y,1,2,PAL.forest); }
      if(r()<.18){ const x=2+Math.floor(r()*11), y=2+Math.floor(r()*11); P(x,y,1,1,r()<.5?PAL.coral:PAL.cream); P(x-1,y+1,1,1,PAL.forest); }
      if(r()<.3){ P(Math.floor(r()*15),Math.floor(r()*15),1,1,"#7E9A63"); } };
    switch(t){
      case ".": grass(); break;
      case ",": { P(0,0,16,16,PAL.sand);
        for(let y=0;y<16;y+=4) for(let x=((y/4)%2)*3-3;x<16;x+=6){ P(x+1,y+1,4,2,"#DFC394"); P(x,y+3,6,1,"#BE9E6E"); }
        if(r()<.3) P(Math.floor(r()*14),Math.floor(r()*14),2,1,PAL.skin);
        const g2=(d)=>!",=w123".includes(nb(d[0],d[1]))&&!WATER.includes(nb(d[0],d[1]))&&!SOLID.includes(nb(d[0],d[1]));
        if(g2([0,-1])) for(let x=0;x<16;x+=2) P(x,0,1,1+((x>>1)%2),PAL.leaf);
        if(g2([0,1])) for(let x=1;x<16;x+=2) P(x,15-((x>>1)%2),1,1+((x>>1)%2),PAL.leaf);
        if(g2([-1,0])) for(let y=0;y<16;y+=2) P(0,y,1+((y>>1)%2),1,PAL.leaf);
        if(g2([1,0])) for(let y=1;y<16;y+=2) P(15-((y>>1)%2),y,1+((y>>1)%2),1,PAL.leaf);
        break; }
      case "~": { P(0,0,16,16,PAL.sea);
        const o=frame%4; for(let k=0;k<3;k++){ const yy=(k*5+3)%16, xx=(k*7+o*2+Math.floor(seed.length))%16; P(xx,yy,4,1,PAL.aqua); P((xx+4)%16,yy+1,2,1,"#5E9AA5"); }
        if(o===1||o===3) P((seed.length*3+o)%15,(seed.length*5)%15,1,1,PAL.cream);
        const land=d=>!WATER.includes(nb(d[0],d[1]));
        if(land([0,-1])){ P(0,0,16,2,PAL.aqua); for(let x=(o%2);x<16;x+=3) P(x,2,1,1,PAL.cream); }
        if(land([-1,0])){ P(0,0,2,16,PAL.aqua); for(let y=(o%2);y<16;y+=3) P(2,y,1,1,PAL.cream); }
        if(land([1,0])){ P(14,0,2,16,PAL.aqua); for(let y=(o%2);y<16;y+=3) P(13,y,1,1,PAL.cream); }
        if(land([0,1])) P(0,15,16,1,PAL.aqua);
        break; }
      case "T": { grass();
        const above=nb(0,-1)==="T", below=nb(0,1)==="T";
        P(2,13,12,3,"rgba(16,24,32,.35)");
        if(!below){ P(7,10,2,5,PAL.brown); P(8,10,1,5,dark(PAL.brown)); }
        const top = above?0:1, bot = below?16:12;
        P(1,top+1,14,bot-top-2,PAL.forest); P(2,top,12,bot-top,PAL.forest);
        for(let i=0;i<7;i++){ const x=2+Math.floor(r()*10), y=top+1+Math.floor(r()*(bot-top-4)); P(x,y,3,2,PAL.leaf); P(x,y,1,1,"#7E9A63"); }
        P(3,top+1,2,1,"#7E9A63"); if(!below) P(2,bot-1,12,1,dark(PAL.forest,.4));
        break; }
      case "#": { const isWall=true; P(0,0,16,16,PAL.sand);
        P(0,0,16,2,PAL.brown); P(0,0,1,16,PAL.brown); P(15,0,1,16,dark(PAL.brown));
        const kind=Math.floor(r()*3);
        if(kind===0){ P(3,4,10,7,PAL.cream); P(4,5,8,5,PAL.navy); P(8,5,1,5,PAL.cream); P(4,7,8,1,PAL.cream); P(5,5,2,1,PAL.sea); }
        else if(kind===1){ P(2,4,12,9,PAL.brown); for(let x=3;x<14;x+=2) P(x,5,1,7,dark(PAL.brown)); }
        else { P(3,4,4,6,PAL.navy); P(9,4,4,6,PAL.navy); P(3,4,4,1,PAL.cream); P(9,4,4,1,PAL.cream); P(4,5,1,1,PAL.gold); P(10,5,1,1,PAL.gold); }
        if(nb(0,1)!=="#"){ P(0,13,16,3,dark(PAL.brown,.2)); P(0,15,16,1,PAL.ink); }
        if(isWall&&r()<.2) P(1,11,2,2,PAL.leaf);
        break; }
      case "c": { P(0,0,16,16,PAL.red);
        for(let y=1;y<14;y+=4){ for(let x=((y>>2)%2)*2;x<16;x+=4){ P(x,y,3,1,PAL.coral); P(x,y+2,4,1,dark(PAL.red,.35)); } }
        P(0,14,16,2,PAL.ink); P(0,13,16,1,dark(PAL.red,.5));
        break; }
      case "w": { P(0,0,16,16,PAL.sand);
        for(let y=0;y<16;y+=4){ P(0,y+3,16,1,"#BE9E6E"); const o=((y>>2)%2)*8+(seed.length%4); P(o%16,y,1,3,"#BE9E6E"); }
        if(nb(0,-1)==="#"){ P(0,0,16,3,dark(PAL.sand,.25)); }
        break; }
      case "=": { P(0,0,16,16,PAL.sea); P((frame%4)*3,5,3,1,PAL.aqua);
        P(1,0,14,16,PAL.brown); for(let y=0;y<16;y+=3){ P(1,y,14,1,dark(PAL.brown,.35)); P(2,y+1,12,1,light(PAL.brown,.15)); }
        P(1,0,1,16,PAL.ink); P(14,0,1,16,PAL.ink); break; }
      case "1": { // 広場外れ・遊歩道：背の高い草（揺れる2コマ）＋金の縁札
        P(0,0,16,16,PAL.forest); const sw=(frame>>1)%2;
        for(let i=0;i<9;i++){ const x=Math.floor(r()*15), y=3+Math.floor(r()*11); P(x+(y<8?sw:0),y-3,1,4,PAL.leaf); P(x+1,y-1,1,3,"#7E9A63"); P(x,y,2,1,dark(PAL.forest,.3)); }
        if(nb(0,-1)!=="1"){ for(let x=1;x<16;x+=4) P(x,0,2,1,PAL.gold); }
        if(nb(-1,0)!=="1"){ for(let y=1;y<16;y+=4) P(0,y,1,2,PAL.gold); }
        break; }
      case "2": { // 通り・倉庫街：石畳と雨だれ
        P(0,0,16,16,PAL.slate);
        for(let y=0;y<16;y+=4) for(let x=((y>>2)%2)*4-4;x<16;x+=8){ P(x+1,y+1,6,2,PAL.mist); P(x+1,y+1,6,1,light(PAL.mist,.25)); }
        if(r()<.35){ const x=2+Math.floor(r()*9),y=3+Math.floor(r()*9); P(x,y,4,2,PAL.sea); P(x+1,y,1,1,PAL.aqua); }
        { const d=(frame+seed.length)%4; P(5+d*2,(d*4+2)%16,1,2,PAL.aqua); }
        if(nb(0,-1)!=="2"){ for(let x=0;x<16;x+=4) P(x+1,0,2,1,PAL.coral); }
        break; }
      case "3": { // 丘・段丘：夕景の草地と等高線
        P(0,0,16,16,PAL.violet);
        for(let y=2;y<16;y+=5) for(let x=0;x<16;x++) P(x,y+((x>>2)%2),1,1,"#8B7DB0");
        for(let i=0;i<3;i++){ const x=Math.floor(r()*14),y=Math.floor(r()*14); P(x,y,2,1,dark(PAL.violet,.3)); }
        if(r()<.25){ const x=2+Math.floor(r()*11),y=2+Math.floor(r()*11); P(x,y,3,2,PAL.mist); P(x,y,2,1,light(PAL.mist,.3)); }
        if((frame+seed.length)%4===0) P(seed.length%14,(seed.length*3)%14,1,1,PAL.gold);
        break; }
      default: P(0,0,16,16,PAL.ink);
    }
  }
  /* マップ全体を1枚へ事前描画（水と草の4コマ） */
  function mapLayer(mapId, frame){
    const key=`m${mapId}${frame%4}`;
    if(mapCache.has(key)){ const layer=mapCache.get(key); mapCache.delete(key); mapCache.set(key,layer); return layer; }
    const m=MAPS[mapId]; const [c,g]=mk(m.w*16,m.h*16);
    const at=(x,y)=> (x<0||y<0||x>=m.w||y>=m.h) ? (m.kind==="in"?"#":"T") : m.tiles[y][x];
    for(let y=0;y<m.h;y++) for(let x=0;x<m.w;x++) drawTile(g,x*16,y*16,at(x,y),(dx,dy)=>at(x+dx,y+dy),frame%4,`${mapId}${x},${y}`);
    mapCache.set(key,c);
    if(mapCache.size>MAP_CACHE_LIMIT)mapCache.delete(mapCache.keys().next().value);
    return c;
  }
  function tile(t, frame){ const key=`t${t}${frame}`; if(cache[key]) return cache[key]; const [c,g]=mk(16,16); drawTile(g,0,0,t,()=>t,frame,"x"+t); cache[key]=c; return c; }

  /* ---- 人物 16×24（dir 0下 1上 2左 3右／frame 0～3の歩行） ---- */
  function person(id, hair, coat, dir, frame, opt={}){
    frame = frame%4;
    const key=`p${id}${hair}${coat}${dir}${frame}${opt.long?1:0}${opt.ribbon||""}`; if(cache[key]) return cache[key];
    const [c,g]=mk(16,24);
    if(dir===3){ const src=person(id,hair,coat,2,frame,opt); g.translate(16,0); g.scale(-1,1); g.drawImage(src,0,0); cache[key]=c; return c; }
    const step = frame===1?1: frame===3?-1:0; // 1:左足前 -1:右足前
    const bob = step?1:0;
    const skin=PAL.skin, skinS=dark(PAL.skin,.18), coatS=dark(coat,.28), coatL=light(coat,.2), hairL=light(hair,.25), pants=PAL.navy, shoe=PAL.brown;
    const Y=bob; // 歩行中は1ドット上下
    // 脚
    if(dir===2){
      px(g,6+step,18-0,2,4,pants); px(g,8-step,18,2,4,dark(pants,.3)); px(g,6+step,22,3,1,shoe); px(g,8-step,22,2,1,dark(shoe));
    } else {
      px(g,5,18,2,4-(step===1?1:0),pants); px(g,9,18,2,4-(step===-1?1:0),pants);
      px(g,5,22-(step===1?1:0),2,1,shoe); px(g,9,22-(step===-1?1:0),2,1,shoe);
    }
    // 胴と腕
    px(g,4,11-Y+1,8,7,coat); px(g,4,11-Y+1,8,1,coatL); px(g,10,12-Y+1,2,6,coatS);
    if(dir===2){ px(g,6+step*-1,13-Y+1,2,4,coatS); px(g,6+step*-1,17-Y+1,2,1,skin); }
    else {
      px(g,3,12-Y+1+(step===1?1:0),1,5,coat); px(g,12,12-Y+1+(step===-1?1:0),1,5,coatS);
      px(g,3,17-Y+1+(step===1?1:0),1,1,skin); px(g,12,17-Y+1+(step===-1?1:0),1,1,skinS);
      if(dir===0){ px(g,7,12-Y+1,2,2,light(coat,.45)); }
    }
    // 頭
    const hy=3-Y+1;
    px(g,5,hy+1,6,7,skin); px(g,10,hy+2,1,5,skinS);
    px(g,4,hy-1,8,3,hair); px(g,5,hy-2,6,1,hair); px(g,5,hy-1,3,1,hairL);
    if(dir===0){
      px(g,4,hy+1,1,3,hair); px(g,11,hy+1,1,3,hair); px(g,5,hy+1,6,1,hair); px(g,6,hy+2,1,1,hair);
      px(g,6,hy+4,1,2,PAL.ink); px(g,9,hy+4,1,2,PAL.ink); px(g,6,hy+4,1,1,PAL.navy);
      px(g,5,hy+6,1,1,PAL.coral); px(g,10,hy+6,1,1,PAL.coral); px(g,7,hy+7,2,1,dark(PAL.coral,.2));
      if(opt.long){ px(g,4,hy+4,1,6,hair); px(g,11,hy+4,1,6,hair); px(g,3,hy+5,1,4,dark(hair,.2)); px(g,12,hy+5,1,4,dark(hair,.2)); }
    } else if(dir===1){
      px(g,4,hy+1,8,6,hair); px(g,5,hy+1,3,1,hairL); px(g,10,hy+2,1,4,dark(hair,.25));
      if(opt.long){ px(g,4,hy+7,8,4,hair); px(g,10,hy+7,2,4,dark(hair,.25)); } else px(g,5,hy+7,6,1,dark(hair,.2));
    } else {
      px(g,7,hy+1,5,6,hair); px(g,4,hy+1,2,1,hair); px(g,8,hy+1,2,1,hairL);
      px(g,5,hy+4,1,2,PAL.ink); px(g,4,hy+5,1,1,skin); px(g,5,hy+6,1,1,PAL.coral);
      if(opt.long){ px(g,8,hy+7,4,4,hair); px(g,11,hy+6,1,5,dark(hair,.25)); }
    }
    if(opt.ribbon){ const rx = dir===2?9:dir===1?4:9; px(g,rx,hy-2,3,2,opt.ribbon); px(g,rx+1,hy-2,1,2,dark(opt.ribbon,.3)); }
    outline(c);
    // 影（輪郭の外）
    g.globalCompositeOperation="destination-over"; px(g,4,22,8,2,"rgba(16,24,32,.35)"); g.globalCompositeOperation="source-over";
    cache[key]=c; return c;
  }

  /* ---- 物体 16×24 ---- */
  function object(type, frame){
    frame=frame%4;
    const key=`o${type}${frame}`; if(cache[key]) return cache[key];
    const [c,g]=mk(16,24); let ol=true;
    switch(type){
      case "box": px(g,2,13,12,9,PAL.brown); px(g,2,13,12,1,light(PAL.brown,.3)); px(g,2,11,12,3,PAL.gold); px(g,2,11,12,1,light(PAL.gold,.4)); px(g,7,13,2,4,PAL.cream); px(g,11,14,2,7,dark(PAL.brown));
        if(frame%2) px(g,12,9,1,1,PAL.cream); break;
      case "boxOpen": px(g,2,14,12,8,PAL.brown); px(g,3,15,10,2,dark(PAL.brown,.5)); px(g,1,8,14,3,PAL.gold); px(g,1,8,14,1,light(PAL.gold,.4)); break;
      case "landmark":
      case "sign": px(g,7,14,2,9,PAL.brown); px(g,1,7,14,8,PAL.cream); px(g,1,7,14,1,light(PAL.cream,.5)); px(g,3,9,10,1,PAL.slate); px(g,3,11,7,1,PAL.slate); px(g,11,11,2,2,PAL.red); break;
      case "bench": px(g,1,14,14,3,PAL.brown); px(g,1,14,14,1,light(PAL.brown,.3)); px(g,2,17,2,5,dark(PAL.brown)); px(g,12,17,2,5,dark(PAL.brown)); px(g,1,10,14,2,PAL.sand); break;
      case "tower": ol=false; px(g,7,0,2,24,PAL.mist); px(g,8,0,1,24,dark(PAL.mist,.3)); for(let y=3;y<24;y+=5){ px(g,4,y,8,1,PAL.mist); px(g,5,y+1,1,3,PAL.slate); px(g,10,y+1,1,3,PAL.slate); }
        px(g,6,0,4,2,frame%2?PAL.coral:PAL.red); if(frame%2){ px(g,4,0,1,1,PAL.gold); px(g,11,1,1,1,PAL.gold); } break;
      case "boss": ol=false; for(let i=0;i<6;i++){ const a=(i/6)*Math.PI*2+frame*0.5; px(g,7+Math.round(Math.cos(a)*6),16+Math.round(Math.sin(a)*4),2,2,i%2?PAL.gold:PAL.coral); } px(g,7,15,2,2,PAL.cream); break;
      case "gate": px(g,2,7,2,16,PAL.red); px(g,12,7,2,16,PAL.red); px(g,0,5,16,2,PAL.ink); px(g,1,4,14,2,PAL.red); px(g,1,4,14,1,PAL.coral); px(g,4,9,8,4,PAL.cream); px(g,5,10,6,1,PAL.slate); px(g,5,12,4,1,PAL.slate); break;
      case "station": px(g,1,3,14,3,PAL.navy); px(g,3,2,10,1,PAL.gold); px(g,2,7,12,13,PAL.cream); px(g,4,8,8,5,PAL.sea); px(g,7,8,2,5,PAL.navy); px(g,2,15,12,2,PAL.aqua); px(g,4,20,2,3,PAL.slate); px(g,10,20,2,3,PAL.slate); px(g,0,23,16,1,PAL.brown); break;
      case "rest": px(g,1,13,14,9,PAL.violet); px(g,1,13,14,1,light(PAL.violet,.3)); px(g,1,11,6,4,PAL.cream); px(g,8,16,7,1,dark(PAL.violet,.3)); px(g,1,21,14,1,dark(PAL.violet,.5)); break;
      case "shelf": px(g,1,3,14,19,PAL.brown); for(let y=8;y<22;y+=5) px(g,2,y,12,1,dark(PAL.brown,.5)); px(g,3,4,3,4,PAL.coral); px(g,8,5,2,3,PAL.gold); px(g,9,9,3,4,PAL.aqua); px(g,3,15,4,3,PAL.cream); px(g,10,15,2,3,PAL.violet); break;
      case "board": px(g,1,5,14,13,PAL.forest); px(g,1,5,14,1,PAL.brown); px(g,0,4,16,1,PAL.brown); px(g,3,7,4,4,PAL.cream); px(g,9,8,4,3,PAL.gold); px(g,4,13,7,1,PAL.cream); px(g,7,18,2,5,PAL.brown); break;
      case "door": px(g,3,4,10,20,PAL.brown); px(g,4,5,8,18,dark(PAL.brown,.35)); px(g,5,6,6,6,PAL.navy); px(g,5,6,6,1,PAL.sea); px(g,10,15,1,2,PAL.gold); break;
      case "shop": ol=false; px(g,0,9,16,5,PAL.sand); px(g,0,9,16,1,light(PAL.sand,.4)); px(g,0,14,16,1,PAL.ink); for(let x=0;x<16;x+=4){ px(g,x,3,2,5,PAL.red); px(g,x+2,3,2,5,PAL.cream); } px(g,0,8,16,1,PAL.ink);
        px(g,2,10,2,2,PAL.coral); px(g,6,10,3,2,PAL.aqua); px(g,11,10,2,2,PAL.gold); break;
      case "inn": ol=false; px(g,0,9,16,5,PAL.brown); px(g,0,9,16,1,light(PAL.brown,.4)); px(g,0,14,16,1,PAL.ink);
        for(let x=0;x<16;x+=4){ px(g,x,2,3,7,PAL.navy); px(g,x+1,3,1,5,PAL.sea); } px(g,0,1,16,1,PAL.ink);
        px(g,6,3,4,4,PAL.cream); px(g,7,4,2,1,PAL.red); px(g,7,5,1,1,PAL.red);
        px(g,13,10,2,3,frame%2?PAL.gold:PAL.coral); break;
      default: px(g,4,10,8,8,PAL.gold);
    }
    if(ol) outline(c);
    cache[key]=c; return c;
  }

  /* ---- ノイズ体 32×32（ボス64×64）：輪郭×属性の模様×エリア小物、3段の陰影 ---- */
  const SHAPES = {
    "反響体":"ring","風環体":"ring","回転体":"ring","光膜体":"panel","投影体":"panel","文字体":"glyph",
    "水紋体":"drop","微粒体":"cloud","鉱殻体":"crystal","火花体":"spark","容器体":"jar","機材体":"box","紙積体":"box",
    "灯籠体":"lantern","配線体":"coil","布帯体":"ribbon","紙片体":"sheet","歯車体":"gear","音符体":"note"
  };
  const ATTR_COL = { "音":[PAL.violet,PAL.cream], "光":[PAL.gold,PAL.cream], "電":[PAL.aqua,PAL.gold], "熱":[PAL.red,PAL.gold],
    "水":[PAL.sea,PAL.aqua], "風":[PAL.leaf,PAL.cream], "土":[PAL.brown,PAL.sand], "無":[PAL.slate,PAL.mist] };
  function inside(shape,x,y,S){
    const u=(x+0.5)/S*2-1, v=(y+0.5)/S*2-1;
    switch(shape){
      case "ring": { const d=Math.hypot(u,v*1.1); return d<0.86 && d>0.34; }
      case "panel": return Math.abs(u)<0.74 && Math.abs(v)<0.62 && !(v>0.45&&Math.abs(u)>0.5);
      case "glyph": return (Math.abs(u)<0.78&&Math.abs(v+0.45)<0.17)||(Math.abs(u)<0.17&&Math.abs(v)<0.78)||(Math.abs(u-0.38)<0.16&&v>0&&v<0.78)||(Math.abs(v-0.2)<0.15&&Math.abs(u)<0.58);
      case "drop": return Math.hypot(u,(v-0.18)*1.05)<0.64 || (Math.abs(u)<0.64*(1-(v+0.85)/0.6) && v<-0.2 && v>-0.88);
      case "cloud": return Math.hypot(u+0.36,v)<0.44||Math.hypot(u-0.36,v)<0.44||Math.hypot(u,v+0.26)<0.47||Math.hypot(u,v-0.2)<0.4;
      case "crystal": return Math.abs(u)*1.1+Math.abs(v)*0.75<0.8;
      case "spark": { const a=Math.atan2(v,u), d=Math.hypot(u,v); return d < 0.44+0.34*Math.abs(Math.cos(a*3)); }
      case "jar": return (Math.abs(u)<0.62&&v>-0.35&&v<0.78) || (Math.abs(u)<0.32&&v<=-0.35&&v>-0.72);
      case "box": return Math.abs(u)<0.72&&Math.abs(v)<0.64;
      case "lantern": return (Math.hypot(u*0.8,v*0.62)<0.56) || (Math.abs(u)<0.13&&v<-0.6&&v>-0.88);
      case "coil": { const d=Math.hypot(u,v); const a=Math.atan2(v,u); return d<0.84 && (d<0.28 || Math.abs(((d*5 - a/Math.PI) % 2 + 2)%2 - 1) < 0.62); }
      case "ribbon": return Math.abs(v - 0.35*Math.sin(u*3.2)) < 0.28 && Math.abs(u)<0.88;
      case "sheet": return Math.abs(u+v*0.25)<0.62 && Math.abs(v)<0.74 && !(u>0.3&&v<-0.4);
      case "gear": { const a=Math.atan2(v,u), d=Math.hypot(u,v); return d<(Math.cos(a*8)>0?0.82:0.68) && d>0.2; }
      case "note": return Math.hypot(u+0.25,(v-0.45)*1.3)<0.36 || (Math.abs(u-0.04)<0.12&&v>-0.78&&v<0.45) || (Math.abs(v+0.7)<0.12&&u>0&&u<0.58);
      default: return Math.hypot(u,v)<0.7;
    }
  }
  const DECOR = {
    "KY01-A1":g=>{ px(g,2,2,1,7,PAL.ink); px(g,3,2,4,3,PAL.red); px(g,3,2,4,1,PAL.coral); },
    "KY01-A2":g=>{ px(g,1,2,9,2,PAL.red); px(g,1,4,9,1,PAL.ink); px(g,2,5,1,2,PAL.aqua); px(g,6,6,1,2,PAL.aqua); },
    "KY01-A3":g=>{ px(g,3,1,1,7,PAL.mist); px(g,1,3,5,1,PAL.mist); px(g,2,1,3,1,PAL.coral); },
    "KY02-A1":g=>{ px(g,2,2,5,1,PAL.sand); px(g,3,3,3,2,PAL.sand); px(g,26,2,3,3,PAL.gold); px(g,27,3,1,1,PAL.cream); },
    "KY02-A2":g=>{ px(g,1,1,7,6,PAL.brown); px(g,1,1,7,1,PAL.sand); px(g,4,1,1,6,dark(PAL.brown,.4)); px(g,2,3,2,2,PAL.cream); },
    "KY02-A3":g=>{ for(let i=0;i<5;i++) px(g,1+i,6-i,1,1,PAL.gold); px(g,1,6,6,1,PAL.gold); px(g,1,7,2,2,PAL.cream); }
  };
  function enemy(profileId, species, attr, area, frame, size=32, boss=false){
    frame=frame%2;
    const key=`e${profileId}${area}${frame}${size}`; if(cache[key]) return cache[key];
    const [c,g]=mk(size,size); const S=size;
    const shape=boss?(profileId==="LB01"?"cloud":"lantern"):(SHAPES[species]||"drop");
    const [base,accent]=boss?(profileId==="LB01"?[PAL.violet,PAL.cream]:[PAL.red,PAL.gold]):(ATTR_COL[attr]||ATTR_COL["無"]);
    const hi=light(base,.35), sh=dark(base,.35), off=frame;
    const ins=(x,y)=> x>=0&&y>=0&&x<S&&y<S && inside(shape,x,y-off,S);
    // 陰影（左上から光）
    for(let y=0;y<S;y++) for(let x=0;x<S;x++){
      if(!ins(x,y)) continue;
      let col=base;
      const lightSide = !ins(x-2,y-2), darkSide = !ins(x+2,y+2);
      if(lightSide&&!darkSide) col=hi; else if(darkSide&&!lightSide) col=sh;
      const u=x/S, v=(y-off)/S;
      switch(attr){
        case "音": if(Math.round(Math.hypot(u-.5,v-.5)*S)%5===0) col=accent; break;
        case "光": if((x+y+frame)%7===0) col=accent; break;
        case "電": if(((x>>1)+(y>>1)+frame)%4===0 && y%4<2) col=accent; break;
        case "熱": if(y < S*0.45 && (x*7+y*3+frame*5)%11===0) col=accent; break;
        case "水": if((y+Math.round(2*Math.sin(x/3+frame)))%6===0) col=accent; break;
        case "風": if((x-y+64+frame*2)%9===0) col=accent; break;
        case "土": if(x%6===0||y%6===0) col=dark(base,.45); break;
        default: if(x%5===2&&y%5===2) col=accent;
      }
      if(boss && (x+y+frame)%9===0) col=accent;
      px(g,x,y,1,1,col);
    }
    // 光沢
    for(let y=0;y<S;y++){ let done=false; for(let x=0;x<S;x++){ if(ins(x,y)&&ins(x+1,y)&&ins(x,y+1)&&!ins(x-1,y-1)&&y>S*0.15){ px(g,x+1,y+1,Math.max(1,S/16),Math.max(1,S/32),PAL.cream); done=true; break; } } if(done) break; }
    // 目
    const ey=Math.floor(S*0.42)+off, ex=Math.floor(S*0.34), es=Math.max(2,S/16);
    const eye=(x)=>{ if(ins(x,ey)&&ins(x+es,ey)&&ins(x,ey+es)){ px(g,x,ey,es,es+1,PAL.cream); px(g,x+(frame?es/2:0),ey+es/2,es/2,es/2+1,PAL.ink); } };
    eye(ex); eye(S-ex-es);
    outline(c);
    if(!boss){ (DECOR[area]||(()=>{}))(g); }
    else { for(let i=0;i<7;i++){ const a=i/7*Math.PI*2+frame*.4; px(g,S/2+Math.round(Math.cos(a)*S*0.46)-1,S/2+Math.round(Math.sin(a)*S*0.46)-1,3,3,i%2?PAL.gold:PAL.coral); } }
    cache[key]=c; return c;
  }
  /* 白く光る被弾コマ */
  function flashOf(img){ const k=img; if(img._flash) return img._flash; const [c,g]=mk(img.width,img.height); g.drawImage(img,0,0); g.globalCompositeOperation="source-in"; px(g,0,0,c.width,c.height,PAL.cream); img._flash=c; return c; }

  /* ---- 戦闘の背景 160×64（エリアごと、帯の面塗りとディザ） ---- */
  function band(g,y,h,c1,c2){ px(g,0,y,160,h,c1); for(let x=0;x<160;x+=2) for(let k=0;k<2;k++) px(g,x+(k%2),y+h-2+k,1,1,c2); }
  function stage(areaId, frame){
    frame=frame%4; const key=`s${areaId}${frame}`; if(cache[key]) return cache[key];
    const [c,g]=mk(160,64); const r=seeded(areaId);
    const sky = { "KY01-A1":[PAL.sea,PAL.aqua,PAL.cream], "KY01-A2":[PAL.slate,PAL.mist,PAL.mist], "KY01-A3":[PAL.violet,PAL.coral,PAL.gold],
      "KY02-A1":[PAL.navy,PAL.sea,PAL.aqua], "KY02-A2":[PAL.slate,PAL.violet,PAL.mist], "KY02-A3":[PAL.ink,PAL.navy,PAL.violet] }[areaId] || [PAL.navy,PAL.slate,PAL.mist];
    band(g,0,14,sky[0],sky[1]); band(g,14,10,sky[1],sky[2]); band(g,24,10,sky[2],sky[2]);
    if(areaId==="KY02-A3"||areaId==="KY01-A3"){ for(let i=0;i<14;i++) px(g,Math.floor(r()*160),Math.floor(r()*20),1,1,PAL.cream); }
    const sil=dark(sky[0],.55);
    switch(areaId){
      case "KY01-A1": for(let i=0;i<9;i++){ const h=8+Math.floor(r()*14); px(g,i*18,34-h,15,h,sil); px(g,i*18+3,34-h+3,2,2,PAL.gold); } px(g,20,22,2,12,PAL.ink); px(g,17,21,8,2,PAL.gold); break;
      case "KY01-A2": for(let i=0;i<6;i++){ px(g,i*28,12,24,22,dark(PAL.brown,.3)); px(g,i*28-2,10,28,3,PAL.red); px(g,i*28+4,18,6,6,PAL.gold); } for(let k=0;k<20;k++) px(g,(k*17+frame*3)%160,(k*11+frame*5)%34,1,2,PAL.aqua); break;
      case "KY01-A3": px(g,0,26,160,8,dark(PAL.violet,.3)); px(g,120,2,2,30,PAL.mist); for(let y=6;y<32;y+=6) px(g,116,y,10,1,PAL.mist); px(g,119,0,4,3,frame%2?PAL.coral:PAL.red); break;
      case "KY02-A1": px(g,0,28,160,6,PAL.sea); for(let i=0;i<8;i++) px(g,(i*23+frame*2)%160,30,6,1,PAL.aqua); px(g,30,22,22,6,PAL.ink); px(g,38,14,2,8,PAL.ink); px(g,100,24,16,4,PAL.ink); break;
      case "KY02-A2": for(let i=0;i<5;i++){ px(g,i*34,10,30,24,dark(PAL.slate,.4)); px(g,i*34,10,30,2,PAL.mist); px(g,i*34+10,20,10,14,PAL.ink); } px(g,140,0,2,30,PAL.gold); px(g,120,2,26,2,PAL.gold); break;
      case "KY02-A3": px(g,0,24,160,10,dark(PAL.forest,.4)); px(g,78,4,8,26,PAL.cream); px(g,78,4,8,3,PAL.red); px(g,79,1,6,3,PAL.gold);
        { const a=frame*0.6; for(let k=0;k<30;k++){ const t=k/30; px(g,82+Math.round(Math.cos(a)*70*t),5+Math.round(Math.sin(a)*8*t),1,1,PAL.gold); } } break;
      default: break;
    }
    // 地面（遠近の線）
    const ground = areaId.endsWith("A2")?PAL.slate: areaId.endsWith("A3")?dark(PAL.violet,.2): PAL.forest;
    px(g,0,34,160,30,ground); for(let y=36,k=1;y<64;y+=k,k++) px(g,0,y,160,1,dark(ground,.25));
    for(let x=-40;x<=200;x+=24){ for(let y=34;y<64;y++){ const xx=Math.round(80+(x-80)*(1+(y-34)/12)); if(xx>=0&&xx<160) px(g,xx,y,1,1,dark(ground,.25)); } }
    cache[key]=c; return c;
  }
  return { tile, mapLayer, person, object, enemy, flashOf, stage };
})();
