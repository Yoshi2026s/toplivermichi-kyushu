/* 全国の探索拠点。後続版の復元ではなく、この版で新たに制作した旅の土台。 */
const NATIONWIDE_CITY = {
  JP01:"札幌市",JP02:"青森市",JP03:"盛岡市",JP04:"仙台市",JP05:"秋田市",JP06:"山形市",JP07:"福島市",
  JP08:"水戸市",JP09:"宇都宮市",JP10:"前橋市",JP11:"さいたま市",JP12:"千葉市",JP13:"新宿区",JP14:"横浜市",
  JP15:"新潟市",JP16:"富山市",JP17:"金沢市",JP18:"福井市",JP19:"甲府市",JP20:"長野市",JP21:"岐阜市",JP22:"静岡市",JP23:"名古屋市",
  JP24:"津市",JP25:"大津市",JP26:"京都市",JP27:"大阪市",JP28:"神戸市",JP29:"奈良市",JP30:"和歌山市",
  JP31:"鳥取市",JP32:"松江市",JP33:"岡山市",JP34:"広島市",JP35:"山口市",JP36:"徳島市",JP37:"高松市",JP38:"松山市",JP39:"高知市",
  JP44:"大分市",JP45:"宮崎市",JP46:"鹿児島市",JP47:"那覇市"
};
/* 既存の阿蘇市から南九州・沖縄を巡り、中国・四国・本州を経て北海道へ続く旅程。 */
const NATIONWIDE_ORDER = [44,45,46,47,35,34,33,32,31,39,38,37,36,28,27,26,25,24,29,30,23,21,22,19,20,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1];
const nationwideHub = n=>`NW${String(n).padStart(2,"0")}`;
const nationwidePref = n=>`JP${String(n).padStart(2,"0")}`;
const nationwideGatePoint = i=>({x:3+i*3,y:19});
for(const n of NATIONWIDE_ORDER){
  const prefId=nationwidePref(n),pref=NATIONAL_PREFECTURES.find(p=>p.id===prefId),hub=nationwideHub(n),city=NATIONWIDE_CITY[prefId];
  if(!pref||!city) throw new Error(`全国拠点の定義不足: ${prefId}`);
  HUBS[hub]={name:city,pref:pref.name,prefId,map:hub};
  NATIONAL_IMPLEMENTED_HUBS[prefId]=[hub];
  INN_PRICE[hub]=16;
  const zones={};
  for(let z=1;z<=3;z++){
    const area=`${hub}-A${z}`,base=AREAS[`KY08-A${z}`];
    zones[String(z)]=area;
    AREAS[area]={...base,name:`${city}・探索区域${z}`,prefix:`${city}の声`,lore:`${pref.name}を巡る新しい旅の探索区域。`,list:base.list.map(row=>[...row])};
  }
  MAPS[hub]={hub,name:city,kind:"out",w:32,h:24,safeAnchor:[15,18],
    tiles:buildMap(32,24,[[".",1,1,30,22],["1",3,3,7,5],["2",22,3,7,5],["3",12,2,8,5],[",",1,18,30,2]]),
    objects:[
      {id:`${hub}_sign1`,x:8,y:8,type:"sign",label:"探索区域1の案内",area:zones["1"]},
      {id:`${hub}_sign2`,x:23,y:8,type:"sign",label:"探索区域2の案内",area:zones["2"]},
      {id:`${hub}_sign3`,x:16,y:7,type:"sign",label:"探索区域3の案内",area:zones["3"]},
      {id:`${hub}_inn`,x:11,y:16,type:"inn",label:`${city}の宿屋`},
      {id:`${hub}_rest`,x:20,y:16,type:"rest",label:"休憩所（日付を進める）"},
      {id:`${hub}_board`,x:13,y:15,type:"board",label:"編成ボード"},
      {id:`${hub}_record`,x:18,y:15,type:"shelf",label:"旅の記録"}
    ],zones};
}
for(let i=0;i<NATIONWIDE_ORDER.length;i++){
  const from=i===0?"KY08":nationwideHub(NATIONWIDE_ORDER[i-1]);
  const to=nationwideHub(NATIONWIDE_ORDER[i]);
  const fromMap=MAPS[from],toMap=MAPS[to];
  const forward=nationwideGatePoint(fromMap.objects.filter(o=>o.type==="gate"&&o.id.startsWith("nw_gate_")).length);
  const backward=nationwideGatePoint(toMap.objects.filter(o=>o.type==="gate"&&o.id.startsWith("nw_gate_")).length);
  const gateId=`nw_gate_${from}_${to}`;
  fromMap.objects.push({id:gateId,x:forward.x,y:forward.y,type:"gate",label:`${HUBS[to].name}への交通路`,to,tx:toMap.safeAnchor[0],ty:toMap.safeAnchor[1]});
  toMap.objects.push({id:`nw_gate_${to}_${from}`,x:backward.x,y:backward.y,type:"gate",label:`${HUBS[from].name}への交通路`,to:from,tx:fromMap.safeAnchor[0],ty:fromMap.safeAnchor[1]});
  NATIONAL_ROUTES.push({id:`RT-${from}-${to}`,from,to,mode:"transit",status:"playable",unlock:i===0?"asoClear":"always",firstArrival:`${HUBS[from].name}の交通路`,firstGateId:gateId});
}
/* 旧来の候補リストは移動可能な拠点を未収録と誤表示するため空にする。 */
FUTURE_HUBS.length=0;

