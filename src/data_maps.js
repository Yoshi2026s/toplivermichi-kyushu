/* 全国の街と街外を分離する地形データ。既存の拠点・依頼・出入口IDを保ち、
   MAPだけを作り直す。街と室内には遭遇区域を一切置かない。 */
const MAP_LAYOUT_VERSION = 3;
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
  const stamp=()=>{if(t!=='w')return nationalMapRect(tiles,t,x-wide+1,y-wide+1,wide*2-1,wide*2-1);for(let yy=y-wide+1;yy<=y+wide-1;yy++)for(let xx=x-wide+1;xx<=x+wide-1;xx++)if(xx>0&&yy>0&&xx<tiles[0].length-1&&yy<tiles.length-1)tiles[yy][xx]='~='.includes(tiles[yy][xx])?'=':'w';};
  stamp(); const goX=()=>{while(x!==tx){x+=Math.sign(tx-x);stamp();}};
  const goY=()=>{while(y!==ty){y+=Math.sign(ty-y);stamp();}};
  if(bend){goY();goX();}else{goX();goY();}
}
function nationalMapZone(tiles,tag,cx,cy,seed){
  const rx=4+seed%2,ry=3+Math.floor(seed/3)%2;
  for(let y=cy-ry;y<=cy+ry;y++) for(let x=cx-rx;x<=cx+rx;x++){
    const distance=((x-cx)/rx)**2+((y-cy)/ry)**2,clipped=distance>1+Math.sin(x*1.7+y+seed)*.10||'~T='.includes(tiles[y]?.[x]);
    if(!clipped&&tiles[y]?.[x]!==undefined&&x>0&&x<tiles[0].length-1&&y>0&&y<tiles.length-1) tiles[y][x]=tag;
  }
}

/* Parcels are reserved before roads. Entrances face their own sidewalk, never a carved-through wall. */
function nationalTownPlan(hub,terrain,w,h,cx,cy,residents){
 const seed=nationalMapSeed(hub),tiles=Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>x===0||y===0||x===w-1||y===h-1?'W':'.'));
 const rect=(t,x,y,ww,hh)=>nationalMapRect(tiles,t,x,y,ww,hh);
 // A main avenue, two shopping streets, narrow residential lanes and a waterfront promenade.
 rect(',',cx-1,1,3,h-2);rect(',',1,cy-1,w-2,3);rect(',',2,cy-9,w-4,3);rect(',',2,h-6,w-4,2);
 for(const side of [-1,1])rect(',',cx+side*8,cy-10,1,14);
 rect(',',cx-3,cy,7,4);
 const plots=[],buildings=[];
 for(let row=0;row<2;row++)for(let col=0;col<4;col++){
  const i=row*4+col,side=col%2?1:-1,distance=col<2?4:11,offset=(seed>>>i)&1,width=5-((seed>>>(i+8))&1),x=cx+side*(distance+offset),front=cy-2-row*8;
  const plot={x:x-2,y:front-4,w:width,h:5,door:[x,front],district:row?'residential':'market',style:(seed>>>(i+16))%4};plots.push(plot);
  rect('c',plot.x,plot.y,plot.w,3);rect('#',plot.x,plot.y+3,plot.w,2);tiles[front][x]=',';
  // Each threshold opens into the street immediately south of its facade.
  rect(',',x-1,front+1,3,1);
  buildings.push({...plot,service:null,objectId:null});
 }
 const available=[0,1,2,3,5,6,7],objects=[],occupied=new Set(),put=(o,x,y,site)=>{const key=x+','+y;if(occupied.has(key))throw Error('Town object overlap: '+hub+'/'+o.id);occupied.add(key);tiles[y][x]=',';objects.push({...o,x,y,site});};
 const service=residents.filter(o=>['shop','inn','door'].includes(o.type));
 service.sort((a,b)=>['shop','inn','door'].indexOf(a.type)-['shop','inn','door'].indexOf(b.type));
 for(const o of service){const p=available.shift(),b=buildings[p];b.service=o.type;b.objectId=o.id;put(o,...b.door,'building');}
 // Reserve a proper civic entrance for the job center installed by data_extras.
 buildings[4].service='jobcenter';buildings[4].objectId=hub+'_jobcenter';
 const npcSpots=[[cx-2,cy+1],[cx+2,cy+1],[cx-5,cy-1],[cx+5,cy-1],[cx-11,cy-1],[cx+11,cy-1],[cx-2,cy-7],[cx+2,cy-7],[cx-5,cy-9],[cx+5,cy-9]];
 const smallSpots=[[cx+5,cy+2],[cx+7,cy+2],[cx-5,cy+3],[cx+5,cy+3],[cx-7,cy+2],[cx+9,cy+2],[cx-10,cy+3],[cx+11,cy+3]];
 let ni=0,si=0,bi=0;
 for(const o of residents.filter(o=>!service.includes(o))){
  if(o.type==='npc'){const p=npcSpots[ni++];if(!p)throw Error('Town NPC capacity: '+hub);put(o,...p,'sidewalk');}
  else if(o.type==='box'){const x=cx+(bi%2?-10:10),y=cy+3;bi++;put(o,x,y,'courtyard');rect(',',x-1,y,3,1);}
  else{let p=smallSpots[si++];while(p&&occupied.has(p.join(',')))p=smallSpots[si++];if(!p)throw Error('Town service capacity: '+hub);put(o,...p,o.type==='rest'?'garden':'civic-square');}
 }
 // Trees and trimmed hedges belong to parks, outside the carriageway and entrances.
 for(const side of [-1,1]){
  const x=cx+side*(w/2-3|0);for(let y=4;y<cy-10;y+=3)if(tiles[y]?.[x]==='.')tiles[y][x]='T';
  for(let y=cy+2;y<h-2;y++)if(tiles[y]?.[cx+side*14]==='.')tiles[y][cx+side*14]='f';
 }
 for(let i=0;i<8;i++){const x=3+i*2,y=2+((seed>>>(i+16))&1);if(tiles[y]?.[x]==='.')tiles[y][x]=i%2?'T':'f';}
 // A quay or a park basin gives every optional sea-route entrance an actual waterside site.
 const harborX=terrain==='coast'?cx:6;
 rect('~',terrain==='coast'?1:3,h-4,terrain==='coast'?w-2:7,3);rect('=',harborX,h-4,2,2);
 rect(',',harborX-1,h-5,4,1);
 put({id:hub+'_station',type:'station',label:'新幹線駅（訪問済みの街へ）'},1,cy,'station-platform');
 for(const b of buildings)if(!b.service)tiles[b.door[1]][b.door[0]]='#';
 return {tiles,objects,buildings,reserveSites:{jobcenter:buildings[4].door,harbor:[harborX,h-4]},districts:{plaza:[cx-3,cy,7,4],market:[2,cy-6,w-4,8],residential:[2,cy-14,w-4,7],promenade:[2,h-6,w-4,2]}};
}

for(const [hub,hubData] of Object.entries(HUBS)){
  const old=MAPS[hub];
  const prefId=Object.entries(NATIONAL_IMPLEMENTED_HUBS).find(([,ids])=>ids.includes(hub))?.[0];
  const seed=nationalMapSeed(hub),[terrain,fieldName]=NATIONAL_LANDSCAPES[prefId]||["plain",`${hubData.name}の街外`];
  const fieldId=`${hub}-field`;
  const w=hub==="KY01"?40:36+(seed%4)*2,h=28+(Math.floor(seed/7)%3)*2;
  const cx=hub==="KY01"?19:Math.floor(w/2),cy=hub==="KY01"?19:h-9;
  const outdoor=old.objects.filter(o=>['sign','boss','tower'].includes(o.type)),gates=old.objects.filter(o=>o.type==='gate');
  const residents=old.objects.filter(o=>!['sign','boss','tower','gate'].includes(o.type));
  if(!residents.some(o=>o.type==='shop')){const shopId='SH_'+hub;SHOPS[shopId]={name:hubData.name+'の旅支度店',items:[...new Set([...SHOPS.SH01.items,...SHOPS.SH02.items])]};residents.push({id:hub+'_supply',type:'shop',label:hubData.name+'の旅支度店（道具・装備）',shop:shopId,npc:'shigeru'});}
  const plan=nationalTownPlan(hub,terrain,w,h,cx,cy,residents),town=plan.tiles,objects=plan.objects;
  const fw=40+(seed%5)*2,fh=30+(Math.floor(seed/11)%3)*2,fx=Math.floor(fw/2);
  const entrance=[fx,fh-4],back=[fx,fh-2];
  objects.push({id:`${hub}_field_exit`,x:cx,y:1,type:"door",walk:true,fieldExit:true,label:`街の出口 → ${fieldName}（戦闘エリア）`,to:fieldId,tx:entrance[0],ty:entrance[1]});
  town[1][cx]=",";
  MAPS[hub]={...old,name:hubData.name,kind:"town",layoutVersion:MAP_LAYOUT_VERSION,w,h,tiles:town,objects,zones:{},safeAnchor:[cx,cy],fieldMap:fieldId,terrain,buildings:plan.buildings,districts:plan.districts,reserveSites:plan.reserveSites};
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
    nationalMapPath(field,last,zonePoints[z],"w",1,!!((seed+z)%2));last=zonePoints[z];
  }
  const bossPoint=[zonePoints[2][0],3];
  nationalMapPath(field,last,bossPoint,"w",1,true);
  nationalMapPath(field,back,entrance,"w",1);
  const trailCells=field.map(row=>row.map(t=>'w='.includes(t)));
  for(let z=0;z<3;z++) nationalMapZone(field,String(z+1),...zonePoints[z],seed+z*17);
  const fieldObjects=[];
  let bossIndex=0,towerIndex=0;
  for(const original of outdoor){
    const o={...original};
    if(o.type==="sign"){
      const zone=Math.max(0,Math.min(2,Number(String(o.area).match(/A(\d+)$/)?.[1]||1)-1));
      o.x=zonePoints[zone][0]+2;o.y=zonePoints[zone][1]+2;
      nationalMapPath(field,zonePoints[zone],[o.x,o.y],"w",1);
    }else if(o.type==="boss"){
      o.x=bossPoint[0]+bossIndex*3;o.y=bossPoint[1];bossIndex++;
      o.label=`${BOSSES[o.boss]?.name||"地域ボス"}の待機地点（街外の奥地）`;o.walk=true;
      field[o.y][o.x]="w";
    }else{
      o.x=bossPoint[0]+towerIndex*3;o.y=1;towerIndex++;
      field[o.y][o.x]=".";
    }
    fieldObjects.push(o);
  }
  fieldObjects.push({id:`${hub}_town_exit`,x:back[0],y:back[1],type:"door",walk:true,fieldExit:true,label:`${hubData.name}へ戻る（安全な街）`,to:hub,tx:cx,ty:2});
  for(let i=0;i<gates.length;i++){
    const original=gates[i],x=i%2?fw-3:2,y=fh-6-Math.floor(i/2)*3;
    nationalMapPath(field,entrance,[x,y],"w",1,false);
    field[y][x+(x<fw/2?1:-1)]="w";
    fieldObjects.push({...original,x,y,walk:true,fieldRoute:true,toHub:original.to,label:`街外の道 → ${HUBS[original.to].name}方面`});
  }
  MAPS[fieldId]={hub,name:`${hubData.name}・街外／${fieldName}`,kind:"field",layoutVersion:MAP_LAYOUT_VERSION,w:fw,h:fh,tiles:field,objects:fieldObjects,zones:{...old.zones},safeAnchor:entrance,townMap:hub,terrain,trailCells};
  NATIONAL_MAP_PAIRS[hub]={town:hub,field:fieldId,prefId,terrain};
}
/* 旧街MAPの座標は使わず、移動先の中央広場へ着く。室内からは入った扉の前へ戻す。 */
for(const r of NATIONAL_ROUTES){r.mode="walk";r.firstArrival=`${HUBS[r.from].name}の街外の道`;}
for(const m of Object.values(MAPS)) for(const o of m.objects){
  if(o.fieldRoute){
    const target=MAPS[HUBS[o.toHub].fieldMap],back=target.objects.find(g=>g.fieldRoute&&g.toHub===m.hub);
    if(!back)throw new Error(`街外の帰路がありません: ${m.hub} → ${o.toHub}`);
    o.to=HUBS[o.toHub].fieldMap;o.tx=back.x+(back.x<target.w/2?1:-1);o.ty=back.y;
  }
  if(o.type==="gate"&&MAPS[o.to]?.kind==="town") [o.tx,o.ty]=MAPS[o.to].safeAnchor;
  if(m.kind==="in"&&o.type==="door"&&MAPS[o.to]?.kind==="town"){
    const entrance=MAPS[o.to].objects.find(x=>x.type==="door"&&x.to===Object.keys(MAPS).find(id=>MAPS[id]===m));
    if(entrance){o.tx=entrance.x;o.ty=entrance.y+1;}else [o.tx,o.ty]=MAPS[o.to].safeAnchor;
  }
}
