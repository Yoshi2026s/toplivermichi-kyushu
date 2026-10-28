/* 唐津の探索区域。敵の基本種は既存50種を共有し、区域IDと表示名を分ける。 */
const SAGA_AREA_DEFS = [
  ["KY03-A1","海辺の小径",9,"唐津小径","海辺の小径に残った呼びかけが、波の間隔に遅れて返る。","KY02-A1"],
  ["KY03-A2","潮見の路地",10,"唐津路地","路地の音声案内が重なり、聞き手の返事より先に声が響く。","KY02-A2"],
  ["KY03-A3","見晴らし台",11,"唐津見晴らし","高台で試した中継音が風に散り、途切れた返事を繰り返す。","KY02-A3"]
];
for(const [id,name,q,prefix,lore,base] of SAGA_AREA_DEFS){
  AREAS[id]={name,q,prefix,motif:"潮風の線と石畳の点模様",lore,list:AREAS[base].list.map(([profile,rarity])=>[profile,rarity])};
}
