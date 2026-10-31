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

/* Regional scenery is an original fantasy interpretation, not a geographic reconstruction.
   Visual metadata never changes collision, destinations, encounters or stored positions. */
const REGIONAL_TOWNS = {
 JP01:['赤れんがと白樺の街','brick','#52656b','#b6755a','#bd937d','birch','clock','snow','#4e7483'],
 JP02:['りんご並木の海峡街','port','#536a78','#eee1bd','#b6b6a2','apple','sail','sea','#c44c45'],
 JP03:['石と清流の城下町','castle','#4e5961','#e1dcd1','#9eada9','pine','bridge','ridge','#647c8c'],
 JP04:['杜の並木と七夕飾り','machiya','#456b60','#efe5c9','#b7b798','zelkova','streamer','grove','#318e80'],
 JP05:['杉の町家と竿燈の灯り','machiya','#4c5257','#d4c8ab','#a6a192','cedar','lantern','grove','#d4ae54'],
 JP06:['山あいの蔵と紅花','kura','#5b6272','#eee8d5','#b8ada1','safflower','flower','ridge','#cc7250'],
 JP07:['果樹と山裾の宿場','rural','#6b5750','#e5d7b9','#bfb58d','peach','fruit','ridge','#d7929b'],
 JP08:['梅の白壁と庭園','kura','#52645e','#f0e8da','#b9b8a5','plum','flower','grove','#a95570'],
 JP09:['大谷石と緑の街路','stone','#5a6770','#bbbda2','#b0b39c','maple','stone','ridge','#6d886c'],
 JP10:['川風とれんがの街','brick','#665447','#c29677','#c0b0a0','willow','bridge','river','#4e989d'],
 JP11:['蔵と盆栽の路地','kura','#566269','#f1e7ce','#bcb29b','bonsai','garden','grove','#5c8061'],
 JP12:['海風と港の並木','port','#487886','#efe4c7','#d2c3a2','pine','sail','sea','#65aab2'],
 JP13:['高層の輪郭と都会の庭','urban','#3b546c','#b7c8cf','#9eaeb8','ginkgo','tower','city','#4a9fad'],
 JP14:['赤れんがと洋館の港','port','#55616b','#c78a6f','#b2a192','plane','clock','sea','#327f94'],
 JP15:['白壁の港と柳並木','kura','#565e6a','#eee6d4','#b8b5ad','willow','sail','river','#668e9b'],
 JP16:['立山を望む水の街','stone','#55737e','#e1e5d6','#a1b7b6','cedar','bridge','snow','#5eabb3'],
 JP17:['格子の茶屋と金色の庭','machiya','#4e505d','#c6a57c','#b6ae99','pine','garden','grove','#c8a350'],
 JP18:['石垣と山あいの街','castle','#556669','#e5e4d4','#a8b4ad','cedar','stone','ridge','#698a82'],
 JP19:['ぶどう棚と山の城下町','castle','#635d69','#e6ddc6','#bcac98','grape','fruit','ridge','#927292'],
 JP20:['白樺と山門の宿場','rural','#63594f','#e3d9c5','#b8b3a6','birch','gate','snow','#6d8e76'],
 JP21:['川辺の格子と鵜飼い灯','machiya','#525f64','#c8b08b','#b4b3a3','willow','lantern','river','#cf9b57'],
 JP22:['茶の緑と富士見の街','rural','#586d5d','#e5e0bd','#b6b994','tea','mountain','fuji','#729555'],
 JP23:['金の屋根飾りと城下町','castle','#436d68','#e3dcc0','#b2b3a0','ginkgo','crest','city','#d6b45f'],
 JP24:['伊勢路の木組みと松','machiya','#685648','#e3d7bb','#bdb194','pine','gate','sea','#af8556'],
 JP25:['湖風の白壁と葦原','kura','#54727d','#eee9d6','#b4c1b2','reed','sail','lake','#6bafbb'],
 JP26:['京格子と竹の路地','machiya','#505961','#e1cfae','#adae9b','bamboo','lantern','grove','#b15c4e'],
 JP27:['水都の橋と商いの街','urban','#4d6470','#e0d3b6','#b4aaa0','ginkgo','bridge','river','#bd754e'],
 JP28:['山手の洋館と港','port','#536f6b','#ead7c9','#c2aea3','plane','sail','ridge','#9e514d'],
 JP29:['古都の木組みと若草','machiya','#594d45','#dfc6a0','#b7ac90','maple','pagoda','grove','#a66a43'],
 JP30:['城下の白壁とみかん','castle','#536d69','#e5dfc5','#b7b49d','citrus','crest','grove','#dc9b50'],
 JP31:['砂丘色の街と海松','rural','#8b7155','#e6d3a6','#d6c092','pine','dune','dune','#a88d60'],
 JP32:['湖畔の黒瓦と夕映え','castle','#475963','#e4dfca','#b3b2ab','pine','sail','lake','#bc8c78'],
 JP33:['白桃と白壁の街','kura','#66727a','#f1e6cc','#c6b8a2','peach','fruit','grove','#d78e98'],
 JP34:['川筋の街と島の稜線','urban','#547477','#e4dac8','#b1beb4','maple','bridge','sea','#aa6454'],
 JP35:['白壁の小路と緑の山','machiya','#675a4b','#eee2c7','#bfb19d','bamboo','pagoda','ridge','#a0684e'],
 JP36:['藍の家並みと川風','machiya','#3e637b','#dce1d7','#acb6ac','reed','streamer','river','#4d82a2'],
 JP37:['松の庭と瀬戸内の港','castle','#61746c','#e8e0c7','#c3bda5','pine','garden','sea','#83a478'],
 JP38:['温泉の木造館とみかん','onsen','#696153','#e8ceaa','#c7b59b','citrus','steam','ridge','#d29148'],
 JP39:['漆喰の城下町と清流','castle','#52676c','#f0e5cc','#b6b7a6','cedar','crest','river','#4d9b93'],
 JP40:['海風の商都','port','#477c83','#ece1c3','#c2baa3','pine','sail','sea','#4d9ea1'],
 JP41:['白壁と松の城下町','kura','#66736f','#ece6d0','#bfbba4','pine','pottery','grove','#7296a0'],
 JP42:['洋館と灯りの港町','port','#527e77','#ead6b5','#b9a89d','camphor','lantern','sea','#bc795e'],
 JP43:['石垣の城下と草原','castle','#3f5355','#d3d7c3','#a7b0a0','camphor','crest','ridge','#699079'],
 JP44:['湯けむりと石の街路','onsen','#686f69','#e3dcc7','#b8bbb1','bamboo','steam','ridge','#71a6a0'],
 JP45:['椰子並木と南国の光','tropical','#a97652','#eee0b9','#d6c6a0','palm','sun','sea','#59a9a5'],
 JP46:['火山の稜線と石造り','stone','#59656d','#b9b9a6','#a5b0a6','palm','volcano','volcano','#8b7973'],
 JP47:['赤瓦と珊瑚色の海','tropical','#ad5238','#eee0b7','#d8c9a6','palm','shisa','sea','#4aaea8']
};
const REGIONAL_CITY_OVERRIDES={
 KY01:['博多の格子と海風','machiya','#566a70','#e5d4b7','#bdb79f','camphor','streamer','sea','#697da1'],
 KY02:['れんが倉庫と工房の港','brick','#4a6067','#ab725a','#aaa99e','plane','chimney','sea','#4e8c9b'],
 KY03:['松原と陶器の城下町','castle','#607f7c','#eee3c8','#c8bca0','pine','pottery','sea','#5d9da1'],
 KY04:['水路と白壁の蔵通り','kura','#56656d','#f0e6d1','#bcb8ab','willow','bridge','river','#7c9c91'],
 KY05:['海軍色の洋館と入り江','port','#435a73','#e2d9c5','#aeaeb0','camphor','sail','sea','#617c9f'],
 KY06:['異国の洋館と港の灯り','port','#4e7b6f','#f1d9ba','#bfae9c','camphor','lantern','ridge','#bf775f'],
 KY07:['黒瓦と石垣の城下町','castle','#34494b','#e4e0c7','#a4ada0','camphor','crest','ridge','#6b9273'],
 KY08:['草原と山並みの木造宿','rural','#655143','#d2bc8c','#b8b58e','grass','mountain','volcano','#7b985b']
};
function regionalTownProfile(hub,prefId){
 const row=REGIONAL_CITY_OVERRIDES[hub]||REGIONAL_TOWNS[prefId];
 if(!row)throw Error('Missing regional town: '+hub);
 const [name,architecture,roof,wall,paving,plant,feature,scenery,accent]=row;
 return {id:hub,name,architecture,roof,wall,paving,plant,feature,scenery,accent};
}

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
  const fieldId=`${hub}-field`,regional=regionalTownProfile(hub,prefId);
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
  MAPS[hub]={...old,name:hubData.name,kind:"town",layoutVersion:MAP_LAYOUT_VERSION,w,h,tiles:town,objects,zones:{},safeAnchor:[cx,cy],fieldMap:fieldId,terrain,regional,buildings:plan.buildings,districts:plan.districts,reserveSites:plan.reserveSites};
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
  MAPS[fieldId]={hub,name:`${hubData.name}・街外／${fieldName}`,kind:"field",layoutVersion:MAP_LAYOUT_VERSION,w:fw,h:fh,tiles:field,objects:fieldObjects,zones:{...old.zones},safeAnchor:entrance,townMap:hub,terrain,regional,trailCells};
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
