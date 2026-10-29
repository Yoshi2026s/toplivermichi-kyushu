/* 海域・海洋敵は本版の新規創作。実際の生息域や航路を再現したものではない。 */
const OCEAN_THEMES = [
  {id:"OC01",name:"九州",hub:"KY02",quest:"M02",q:6,color:"#4D8491",accent:"#E88470",forms:["灯魚","風クラゲ","玄海ガニ","潮ウミガメ","響海竜"],areas:["玄界灘の灯路","関門の返し潮","博多沖の風波","壱岐水道の青道","五島の入江","有明の干潟沖","天草の島影","豊後水道の朝凪"]},
  {id:"OC02",name:"瀬戸内・四国",hub:"NW37",quest:"N37",q:29,color:"#83B9AE",accent:"#D5B34C",forms:["凪魚","渦クラゲ","島ガニ","帆ウミガメ","橋海竜"],areas:["燧灘の小さな帆","備讃の橋影","播磨灘の便り","鳴門の渦待ち","紀伊水道の遠声","土佐湾の白波","宇和海の真珠潮","安芸灘の島明かり"]},
  {id:"OC03",name:"近畿・東海",hub:"NW28",quest:"N28",q:35,color:"#4F7CB5",accent:"#F4ECD8",forms:["灯台魚","真珠クラゲ","窯ガニ","祈りウミガメ","岬海竜"],areas:["大阪湾の返事","明石の灯台道","和歌の浦の夕波","熊野灘の祈り","伊勢湾の貝明かり","志摩沖の真珠道","遠州灘の砂音","駿河湾の深い青"]},
  {id:"OC04",name:"北陸・日本海",hub:"NW15",quest:"N15",q:43,color:"#526F9B",accent:"#D4B483",forms:["銀雪魚","硝子クラゲ","雪ガニ","北灯ウミガメ","白波海竜"],areas:["若狭の硝子潮","越前沖の白波","加賀の金灯","能登の岬便り","富山湾の深灯","佐渡海峡の舟歌","越後沖の雪解け","但馬の夕凪"]},
  {id:"OC05",name:"関東沿岸",hub:"NW14",quest:"N14",q:46,color:"#6E608A",accent:"#E88470",forms:["航灯魚","星クラゲ","波止場ガニ","港ウミガメ","汽笛海竜"],areas:["相模湾の潮時計","東京湾の星明かり","三浦沖の白灯","房総の岬道","九十九里の砂波","鹿島灘の朝風","常陸沖の梅潮","銚子の返し波"]},
  {id:"OC06",name:"東北・北海道",hub:"NW04",quest:"N04",q:51,color:"#6CA4B8",accent:"#DBE8E5",forms:["氷晶魚","雪灯クラゲ","北海ガニ","星待ちウミガメ","銀河海竜"],areas:["仙台湾の七夕潮","三陸の岩波","宮古沖の川便り","津軽海峡の灯","陸奥湾の山車影","秋田沖の竿燈","庄内沖の舟歌","石狩湾の雪明かり","噴火湾の星待ち"]},
  {id:"OC07",name:"南西諸島",hub:"NW47",quest:"N47",q:29,color:"#399B9A",accent:"#F3B783",forms:["珊瑚魚","瑠璃クラゲ","月砂ガニ","黒潮ウミガメ","虹海竜"],areas:["薩南の黒潮便り","奄美の珊瑚影","沖縄本島の風路","慶良間の瑠璃潮","久米島の白砂沖","宮古の月明かり","八重山の星砂道","与那国の夕波"]},
  {id:"OC08",name:"小笠原・外洋",hub:"NW13",quest:"N13",q:48,color:"#335C89",accent:"#83B9AE",forms:["外洋魚","群星クラゲ","島影ガニ","帆風ウミガメ","羅針海竜"],areas:["伊豆七島の帆風","八丈沖の青い窓","父島の小さな港","母島の森の便り","聟島の渡り鳥道","硫黄列島の遠灯","小笠原海台の深青","外洋の終わらない返事"]}
];
const OCEAN_SPECIES = ["魚","クラゲ","カニ","ウミガメ","海竜"];
const OCEAN_STAGES = ["ひな","若波","潮色","波紋","渦巻","深青","蒼星","月詠","古潮","海王"];
const OCEAN_AREAS = {}, OCEAN_ROUTES = {}, OCEAN_ENEMY_COUNT=3250;
let oceanAreaNumber=0;
for(let region=0;region<OCEAN_THEMES.length;region++){
  const theme=OCEAN_THEMES[region],routeId=`VOY${String(region+1).padStart(2,"0")}`,mapId=`OCEAN-M${region+1}`;
  const route={id:routeId,theme:theme.id,name:`${theme.name}・島影を巡る航路`,hub:theme.hub,quest:theme.quest,mapId,areas:[],bgm:`sea_RG${String(region+1).padStart(2,"0")}`};
  OCEAN_ROUTES[routeId]=route;
  for(let local=0;local<theme.areas.length;local++){
    const id=`OCEAN-A${String(++oceanAreaNumber).padStart(2,"0")}`;
    const area={id,name:theme.areas[local],themeId:theme.id,region,hub:theme.hub,routeId,q:theme.q+Math.floor(local/3),mapId,
      lore:`${theme.name}の創作海域。${theme.areas[local]}の航路Eと海辺Sで、魚・クラゲ・カニ・ウミガメ・海竜の声を調べる。港は安全。`,
      rescueStory:`${theme.areas[local]}の波間で、流された小舟を見つけた。船頭の合図を待って綱を渡すと、旅人は「この海の灯りに助けられた」と地図へ帰り道を書き込んだ。`,
      treasureStory:`救助した旅人の地図には、${theme.areas[local]}の灯台から見える島影が描かれていた。満ち引きを待ってたどり着いた漂着箱には、次の航海への資金が入っていた。`};
    route.areas.push(id);OCEAN_AREAS[id]=area;
    AREAS[id]={...area,prefix:area.name,list:Array.from({length:50},(_,i)=>[1,Math.min(5,1+Math.floor(i%10/2))]),combatDomain:"sea"};
  }
  /* 28区画の環状航路：港1＋指定海面27。未指定の水面は歩けない。 */
  const points=[];
  for(let x=3;x<=11;x++)points.push([x,3]);
  for(let y=4;y<=9;y++)points.push([11,y]);
  for(let x=10;x>=3;x--)points.push([x,9]);
  for(let y=8;y>=4;y--)points.push([3,y]);
  if(points.length!==28)throw Error("航路区画数の定義不足");
  const w=15,h=13,tiles=Array.from({length:h},()=>Array(w).fill("~")),byCell={},objects=[];
  for(let i=0;i<points.length;i++){
    const [x,y]=points[i];tiles[y][x]=i===0?"P":i%5===0?"S":"E";
    if(i>0){const aid=route.areas[Math.min(route.areas.length-1,Math.floor((i-1)*route.areas.length/27))];byCell[`${x},${y}`]=aid;const a=OCEAN_AREAS[aid];if(!a.point)a.point=[x,y];}
  }
  objects.push({id:`${routeId}_port`,type:"door",walk:true,fieldExit:true,oceanReturn:true,x:3,y:3,label:`${HUBS[theme.hub].name}の安全な港へ戻る`,to:theme.hub,tx:MAPS[theme.hub].safeAnchor[0],ty:MAPS[theme.hub].safeAnchor[1]});
  const used=new Set(points.map(p=>p.join(",")));
  for(const aid of route.areas){
    const a=OCEAN_AREAS[aid],p=a.point;
    const around=[[p[0]+1,p[1]],[p[0]-1,p[1]],[p[0],p[1]+1],[p[0],p[1]-1]];
    const mark=around.find(([x,y])=>x>0&&x<w-1&&y>0&&y<h-1&&!used.has(`${x},${y}`));
    if(!mark)throw Error(`海域案内の配置不足: ${aid}`);
    used.add(mark.join(","));tiles[mark[1]][mark[0]]=".";
    a.marker=mark;
    objects.push({id:`${aid}_marker`,type:"oceanEvent",x:mark[0],y:mark[1],label:`${a.name}：救助・調査・灯台`,oceanArea:aid});
  }
  route.points=points;route.destination=points[14];
  MAPS[mapId]={hub:theme.hub,name:route.name,kind:"field",combatDomain:"sea",oceanRoute:routeId,w,h,tiles,objects,zones:{},safeAnchor:[3,3],townMap:theme.hub,encountersByCell:byCell};
  const town=MAPS[theme.hub],queue=[town.safeAnchor],seen=new Set([town.safeAnchor.join(",")]);let dock=null;
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];
    if(i>0&&!town.objects.some(o=>o.x===x&&o.y===y)){dock=[x,y];break;}
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(seen.has(k)||!".,w=".includes(town.tiles[ny]?.[nx]||""))continue;seen.add(k);if(!town.objects.some(o=>o.x===nx&&o.y===ny&&!o.walk))queue.push([nx,ny]);}
  }
  if(!dock)throw Error(`港の配置不足: ${theme.hub}`);
  route.dock=dock;
  town.objects.push({id:`${routeId}_dock`,type:"door",walk:true,fieldExit:true,oceanRoute:routeId,x:dock[0],y:dock[1],label:`${theme.name}の港 → 航海（${QUESTS[theme.quest].name}完了で解放）`,to:mapId,tx:3,ty:3});
}
