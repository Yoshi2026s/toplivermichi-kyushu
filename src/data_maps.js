/* 全国の街と街外を分離する地形データ。既存の拠点・依頼・出入口IDを保ち、
   MAPだけを作り直す。街と室内には遭遇区域を一切置かない。 */
const MAP_LAYOUT_VERSION = 2;
const NATIONAL_MAP_PAIRS = {};
const NATIONAL_LANDSCAPES = {
  JP01:["forest","白樺と星明かりの原野"], JP02:["coast","りんご畑と海峡の道"],
  JP03:["mountain","銀河を望む山裾"], JP04:["forest","杜と七夕の小径"],
  JP05:["forest","杉林と竿燈の野道"], JP06:["river","最上川の舟歌道"],
  JP07:["mountain","果樹園と磐梯の裾野"], JP08:["plain","梅林を渡る野道"],
  JP09:["forest","杉並木と滝の谷"], JP10:["mountain","湯けむりの山道"],
  JP11:["river","川舟と欅の堤"], JP12:["coast","潮風の岬道"],
  JP13:["river","星を映す河川敷"], JP14:["coast","灯台と潮騒の丘"],
  JP15:["plain","稲穂と雪解けの原"], JP16:["mountain","立山を望む水辺道"],
  JP17:["river","金箔の光を映す川原"], JP18:["mountain","化石の眠る谷道"],
  JP19:["mountain","ぶどう畑と水晶の丘"], JP20:["forest","白樺の高原道"],
  JP21:["river","鵜飼い火の川辺"], JP22:["plain","茶畑と富士見の丘"],
  JP23:["river","窯の火を結ぶ河畔"], JP24:["coast","真珠と祈りの海辺道"],
  JP25:["lake","湖風の葦原"], JP26:["forest","竹林と古道の奥"],
  JP27:["river","水都を巡る堤道"], JP28:["mountain","港を見下ろす山手道"],
  JP29:["forest","若草と古木の森"], JP30:["forest","熊野へ続く杉の古道"],
  JP31:["coast","風紋の砂丘道"], JP32:["lake","夕日を映す湖畔道"],
  JP33:["plain","白桃の実る野道"], JP34:["coast","島影を望む海辺道"],
  JP35:["mountain","石灰岩の台地道"], JP36:["river","渦の音を運ぶ川辺"],
  JP37:["plain","ため池と麦穂の道"], JP38:["mountain","みかん畑の段々道"],
  JP39:["river","清流と龍馬風の堤"], JP40:["coast","玄界灘の風を渡る道"],
  JP41:["plain","松原と焼物の野道"], JP42:["coast","入り江と祈りの坂"],
  JP43:["mountain","石垣と草千里の山裾"], JP44:["mountain","湯けむりと石仏の山道"],
  JP45:["forest","神話の森と日向の道"], JP46:["mountain","火山灰と黒潮の裾野"],
  JP47:["coast","珊瑚の海と風の道"]
};
function nationalMapSeed(id){ let n=2166136261; for(const c of id){n^=c.charCodeAt(0);n=Math.imul(n,16777619);} return n>>>0; }
function nationalMapRect(tiles,t,x,y,w,h){
  for(let yy=Math.max(1,y);yy<Math.min(tiles.length-1,y+h);yy++)
    for(let xx=Math.max(1,x);xx<Math.min(tiles[yy].length-1,x+w);xx++) tiles[yy][xx]=t;
}
function nationalMapPath(tiles,from,to,t=",",wide=1,bend=false){
  let [x,y]=from; const [tx,ty]=to;
  const stamp=()=>nationalMapRect(tiles,t,x-wide+1,y-wide+1,wide*2-1,wide*2-1);
  stamp(); const goX=()=>{while(x!==tx){x+=Math.sign(tx-x);stamp();}};
  const goY=()=>{while(y!==ty){y+=Math.sign(ty-y);stamp();}};
  if(bend){goY();goX();}else{goX();goY();}
}
function nationalMapZone(tiles,tag,cx,cy,seed){
  const rx=4+seed%2,ry=3+Math.floor(seed/3)%2;
  for(let y=cy-ry;y<=cy+ry;y++) for(let x=cx-rx;x<=cx+rx;x++){
    const clipped=Math.abs(x-cx)===rx&&Math.abs(y-cy)===ry;
    if(!clipped&&tiles[y]?.[x]!==undefined&&x>0&&x<tiles[0].length-1&&y>0&&y<tiles.length-1) tiles[y][x]=tag;
  }
}
for(const [hub,hubData] of Object.entries(HUBS)){
  const old=MAPS[hub];
  const prefId=Object.entries(NATIONAL_IMPLEMENTED_HUBS).find(([,ids])=>ids.includes(hub))?.[0];
  const seed=nationalMapSeed(hub),[terrain,fieldName]=NATIONAL_LANDSCAPES[prefId]||["plain",`${hubData.name}の街外`];
  const fieldId=`${hub}-field`;
  const w=hub==="KY01"?40:36+(seed%4)*2,h=28+(Math.floor(seed/7)%3)*2;
  const cx=hub==="KY01"?19:Math.floor(w/2),cy=hub==="KY01"?19:h-9;
  const town=buildMap(w,h,[[".",1,1,w-2,h-2]]);
  /* 地方ごとの市街景観。道路は後で通し、建物や水面による行き止まりを防ぐ。 */
  if(terrain==="coast"){
    nationalMapRect(town,"~",1,h-5,w-2,4);
    nationalMapRect(town,",",2,h-6,w-4,2);
    for(let x=5+(seed%3);x<w-4;x+=7) nationalMapRect(town,"=",x,h-5,2,3);
  }else if(terrain==="river"){
    const riverX=6+seed%4;
    nationalMapRect(town,"~",riverX,1,3,h-2);
    nationalMapRect(town,"=",riverX,cy-1,3,3);
    nationalMapRect(town,"=",riverX,8,3,2);
  }else if(terrain==="lake"){
    nationalMapRect(town,"~",2,3,8,7);
    nationalMapRect(town,",",2,11,10,2);
  }else if(terrain==="mountain"){
    for(let r=0;r<3;r++) nationalMapRect(town,"T",2+r*2,2+r*3,5,2);
    nationalMapRect(town,"T",w-8,2,6,6+seed%4);
  }else if(terrain==="forest"){
    for(let x=2;x<w-3;x+=6) nationalMapRect(town,"T",x,3+(x%3),3,3);
    nationalMapRect(town,"~",w-9,3,5,4);
  }else{
    nationalMapRect(town,"~",2,3,5,4);
    for(let x=10;x<w-3;x+=7) nationalMapRect(town,"T",x,3,2,4);
  }
  /* 各街の庭園・並木の区画も固定シードで変える。同じ地方の街でも
     木立、路地、広場の並びが重ならない。 */
  for(let row=0;row<2;row++) for(let col=0;col<6;col++){
    const garden=nationalMapSeed(`${hub}:garden:${row}:${col}`);
    const x=3+col*5,y=3+row*4;
    if(x+2<w-2) nationalMapRect(town,garden%3===0?",":garden%3===1?".":"T",x,y,2+garden%2,2);
  }
  const residentialBlocks=[[cx-13,5],[cx+8,6],[cx-13,11],[cx+8,12],[cx-13,cy+2],[cx+8,cy+2]];
  const houseFronts=[];
  for(let i=0;i<residentialBlocks.length;i++){
    let [x,y]=residentialBlocks[i];x+=Math.floor(seed/(i+3))%2;
    if(y+4>=h-1||[0,1,2,3].some(d=>town[y+d]?.slice(x,x+5).includes("~"))) continue;
    nationalMapRect(town,"c",x,y,5,1);
    nationalMapRect(town,"#",x,y+1,5,2);
    houseFronts.push([x+2,y+3]);
  }
  const outdoor=old.objects.filter(o=>["sign","boss","tower"].includes(o.type));
  const gates=old.objects.filter(o=>o.type==="gate");
  const residents=old.objects.filter(o=>!["sign","boss","tower","gate"].includes(o.type));
  /* 旅の途中でも回復道具を補充できるよう、道具店がなかった街にも
     既存の販売システムを使う支店を設ける。買い物は街の安全地帯で行う。 */
  if(!residents.some(o=>o.type==="shop")){
    const shopId=`SH_${hub}`;
    SHOPS[shopId]={name:`${hubData.name}の旅支度店`,items:[...new Set([...SHOPS.SH01.items,...SHOPS.SH02.items])]};
    residents.push({id:`${hub}_supply`,type:"shop",label:`${hubData.name}の旅支度店（道具・装備）`,shop:shopId,npc:"shigeru"});
  }
  const slots=[[-7,-3],[7,-3],[-4,-6],[4,-6],[-10,3],[10,3],[-5,3],[5,3],[-12,-8],[12,-8],[-12,0],[12,0],[-2,5],[2,5],[-7,-10],[7,-10],[-10,-5],[10,-5]];
  const objects=[];
  for(let i=0;i<residents.length;i++){
    const o={...residents[i]},[dx,dy]=slots[i]||[-12+(i%7)*4,-12-Math.floor(i/7)*2];
    o.x=Math.max(3,Math.min(w-4,cx+dx));o.y=Math.max(4,Math.min(h-3,cy+dy));
    if(["door","inn","shop"].includes(o.type)){
      nationalMapRect(town,"#",o.x-2,o.y-3,5,3);
      nationalMapRect(town,"c",o.x-2,o.y-4,5,1);
    }
    objects.push(o);
  }
  /* 中央広場、街道、街の出口をつなぐ。全サービスへ枝道を用意する。 */
  nationalMapRect(town,",",cx-2,2,5,h-5);
  nationalMapRect(town,",",1,cy-1,w-2,3);
  nationalMapRect(town,",",cx-6,cy-2,13,5);
  for(const front of houseFronts) nationalMapPath(town,[cx,cy],front,",",1,false);
  for(const o of objects) nationalMapPath(town,[cx,cy],[o.x,o.y],",",1,!!(seed%2));
  for(let i=0;i<gates.length;i++){
    const o={...gates[i],x:i%2?w-2:1,y:cy+(i>1?3:0)};
    nationalMapRect(town,",",Math.max(1,o.x-1),o.y-1,3,3);objects.push(o);
  }
  const fw=40+(seed%5)*2,fh=30+(Math.floor(seed/11)%3)*2,fx=Math.floor(fw/2);
  const entrance=[fx,fh-4],back=[fx,fh-2];
  objects.push({id:`${hub}_field_exit`,x:cx,y:1,type:"door",walk:true,fieldExit:true,label:`街の出口 → ${fieldName}（戦闘エリア）`,to:fieldId,tx:entrance[0],ty:entrance[1]});
  town[1][cx]=",";
  MAPS[hub]={...old,name:hubData.name,kind:"town",layoutVersion:MAP_LAYOUT_VERSION,w,h,tiles:town,objects,zones:{},safeAnchor:[cx,cy],fieldMap:fieldId,terrain};
  hubData.fieldMap=fieldId;
  /* 街外は海岸・川・山・森・湖・野原の6種。県ごとの寸法と曲がり方を加え、
     3探索区域へ進み、奥地のボスに至る歩ける地形を作る。 */
  const field=buildMap(fw,fh,[[".",1,1,fw-2,fh-2]]);
  if(terrain==="coast"){
    const side=seed%2;
    for(let y=1;y<fh-1;y++){
      const width=4+Math.floor((Math.sin((y+seed%11)/4)+1)*2);
      nationalMapRect(field,"~",side?fw-width-1:1,y,width,1);
    }
    for(let x=5;x<fw-5;x+=8) nationalMapRect(field,"T",x,3+(x%7),2,3);
  }else if(terrain==="river"){
    for(let y=1;y<fh-1;y++){
      const x=fx+Math.round(Math.sin((y+seed%5)/4)*4);
      nationalMapRect(field,"~",x,y,3,1);
    }
    nationalMapRect(field,"T",3,3,6,8);
    nationalMapRect(field,"T",fw-9,fh-13,6,8);
  }else if(terrain==="mountain"){
    for(let y=4;y<fh-4;y+=6){
      const length=11+(seed+y)%7;
      nationalMapRect(field,"T",(y/2)%2?2:fw-length-2,y,length,2);
      nationalMapRect(field,"T",(y/2)%2?2:fw-length,y+2,length-3,1);
    }
    nationalMapRect(field,"~",fw-10,3,6,4);
  }else if(terrain==="forest"){
    for(let y=3;y<fh-4;y+=7) for(let x=3;x<fw-4;x+=8){
      nationalMapRect(field,"T",x+(y%3),y,4,4+((seed+x)%3));
    }
    nationalMapRect(field,"~",3,fh-10,5,5);
  }else if(terrain==="lake"){
    for(let y=8;y<fh-9;y++){
      const inset=Math.abs(y-Math.floor(fh/2))>4?3:0;
      nationalMapRect(field,"~",fx-6+inset,y,13-inset*2,1);
    }
    nationalMapRect(field,"T",2,2,7,5);
    nationalMapRect(field,"T",fw-9,3,6,7);
  }else{
    for(let x=5;x<fw-5;x+=9) nationalMapRect(field,"T",x,5+(x%4),2,5+(seed%4));
    nationalMapRect(field,"~",fw-11,fh-12,7,4);
    nationalMapRect(field,"~",3,3,4,4);
  }
  const zonePoints=[
    [8+seed%4,fh-10-(seed%3)],
    [fw-10-(Math.floor(seed/3)%4),Math.floor(fh/2)+seed%3],
    [fx+Math.floor(seed/5)%5-2,7+Math.floor(seed/13)%3]
  ];
  let last=entrance;
  for(let z=0;z<3;z++){
    nationalMapPath(field,last,zonePoints[z],",",2,!!((seed+z)%2));last=zonePoints[z];
  }
  const bossPoint=[zonePoints[2][0],3];
  nationalMapPath(field,last,bossPoint,",",2,true);
  nationalMapPath(field,back,entrance,",",2);
  for(let z=0;z<3;z++) nationalMapZone(field,String(z+1),...zonePoints[z],seed+z*17);
  const fieldObjects=[];
  let bossIndex=0,towerIndex=0;
  for(const original of outdoor){
    const o={...original};
    if(o.type==="sign"){
      const zone=Math.max(0,Math.min(2,Number(String(o.area).match(/A(\d+)$/)?.[1]||1)-1));
      o.x=zonePoints[zone][0]+2;o.y=zonePoints[zone][1]+2;
    }else if(o.type==="boss"){
      o.x=bossPoint[0]+bossIndex*3;o.y=bossPoint[1];bossIndex++;
      o.label=`${BOSSES[o.boss]?.name||"地域ボス"}の待機地点（街外の奥地）`;o.walk=true;
      field[o.y][o.x]=",";
    }else{
      o.x=bossPoint[0]+towerIndex*3;o.y=1;towerIndex++;
      field[o.y][o.x]=".";
    }
    fieldObjects.push(o);
  }
  fieldObjects.push({id:`${hub}_town_exit`,x:back[0],y:back[1],type:"door",walk:true,fieldExit:true,label:`${hubData.name}へ戻る（安全な街）`,to:hub,tx:cx,ty:2});
  MAPS[fieldId]={hub,name:`${hubData.name}・街外／${fieldName}`,kind:"field",layoutVersion:MAP_LAYOUT_VERSION,w:fw,h:fh,tiles:field,objects:fieldObjects,zones:{...old.zones},safeAnchor:entrance,townMap:hub,terrain};
  NATIONAL_MAP_PAIRS[hub]={town:hub,field:fieldId,prefId,terrain};
}
/* 旧街MAPの座標は使わず、移動先の中央広場へ着く。室内からは入った扉の前へ戻す。 */
for(const m of Object.values(MAPS)) for(const o of m.objects){
  if(o.type==="gate"&&MAPS[o.to]?.kind==="town") [o.tx,o.ty]=MAPS[o.to].safeAnchor;
  if(m.kind==="in"&&o.type==="door"&&MAPS[o.to]?.kind==="town"){
    const entrance=MAPS[o.to].objects.find(x=>x.type==="door"&&x.to===Object.keys(MAPS).find(id=>MAPS[id]===m));
    if(entrance){o.tx=entrance.x;o.ty=entrance.y+1;}else [o.tx,o.ty]=MAPS[o.to].safeAnchor;
  }
}
