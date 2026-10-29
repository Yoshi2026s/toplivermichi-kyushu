/* ===== data: 福岡編と佐賀・唐津編 ===== */
const GAME_VERSION = "5.29-dev";
const SCHEMA_VERSION = 5;

const PAL = {
  ink:"#101820", navy:"#23364D", slate:"#455A68", mist:"#8B9BA0",
  cream:"#F4ECD8", sand:"#D4B483", skin:"#E4A56B", brown:"#945B45",
  red:"#B84B4B", coral:"#E88470", gold:"#D5B34C", leaf:"#5F7D4E",
  forest:"#304F43", sea:"#4D8491", aqua:"#83B9AE", violet:"#6E608A"
};

/* 第06節・06A：操作キャラクター（福岡編で加入する5人＋将来分） */
const CHARS = {
  hero:   { name:null, age:32, career:"社会福祉士", from:"福岡市", initJob:"J22", hair:PAL.brown, coat:PAL.red },
  moe:    { name:"もえ", full:"雪餅羽 もえ", age:null, career:"アイドル（おやすみセカイ元メンバー）", from:null, initJob:"J08", hair:PAL.violet, coat:PAL.cream },
  naoki:  { name:"直樹", full:"瀬尾 直樹", age:47, career:"電気工事士", from:"北九州", initJob:"J15", hair:PAL.slate, coat:PAL.gold },
  kohei:  { name:"航平", full:"久住 航平", age:39, career:"トラック運転手", from:"佐賀", initJob:"J01", hair:PAL.ink, coat:PAL.sea },
  mio:    { name:"澪", full:"芦田 澪", age:29, career:"看護師", from:"大分", initJob:"J13", hair:PAL.violet, coat:PAL.aqua },
  kayo:   { name:"佳代", full:"水野 佳代", age:54, career:"調理師", from:"長崎", initJob:"J14", hair:PAL.mist, coat:PAL.coral },
  tsumugi:{ name:"紬", full:"相原 紬", age:26, career:"システムエンジニア", from:"熊本", initJob:"J02", hair:PAL.ink, coat:PAL.violet },
  makoto: { name:"真琴", full:"辻村 真琴", age:41, career:"建築士", from:"宮崎", initJob:"J17", hair:PAL.brown, coat:PAL.leaf },
  gaku:   { name:"岳", full:"長岡 岳", age:35, career:"配管工", from:"鹿児島", initJob:"J16", hair:PAL.ink, coat:PAL.forest }
};
const CHAR_ORDER = ["hero","moe","naoki","kohei","mio","kayo","tsumugi","makoto","gaku"];

/* 加入予定：福岡は主人公ともえの2人旅。以降は各県の最初の拠点へ着いた時に1人ずつ加入 */
const JOIN_PLAN = [
  {cid:"kohei", hub:"KY03", pref:"佐賀"}, {cid:"kayo", hub:"KY05", pref:"長崎"}, {cid:"tsumugi", hub:"KY07", pref:"熊本"},
  {cid:"mio", hub:"KY09", pref:"大分"}, {cid:"makoto", hub:"KY11", pref:"宮崎"}, {cid:"gaku", hub:"KY13", pref:"鹿児島"},
  {cid:"naoki", hub:"KY15", pref:"沖縄"}
];

/* 第10A～10E節：22ジョブ。kind は技能の処理種別 */
const JOBS = {
  J01:{name:"トラック運転手",   field:"攻撃と自己防護", skill:"巡回ストライク",   cost:3, desc:S=>`敵1体に攻撃（追加${8+2*S}）。自分に防護2。`},
  J02:{name:"システムエンジニア",field:"コメント効率",   skill:"コメント整理",     cost:1, desc:S=>`応援コメントの代わりに使う。エール＋${22+S}、コメント連携4。挨拶・作戦・感謝を選ぶ。`},
  J03:{name:"グラビアアイドル", field:"見せ場と防護",   skill:"ベストショット",   cost:2, desc:S=>`味方1人に防護${4+Math.floor(S/2)}、コメント連携4。`},
  J04:{name:"ショップ店員",     field:"状況別の補給",   skill:"ぴったり提案",     cost:1, desc:S=>`体力補給（集中力1）：1人の体力を(${10+2*S})×成長係数＋レベル回復。集中補給（集中力2）：自分以外1人の集中力＋${3+Math.floor(S/2)}。`},
  J05:{name:"スーパーレジ打ち", field:"攻撃とエール",   skill:"スキャン連携",     cost:2, desc:S=>`敵1体に攻撃（追加${3+S}）。通常のエール＋8に加えてエール＋4。`},
  J06:{name:"ギャンブラー",     field:"危険を選ぶ攻撃", skill:"勝負の一手",       cost:3, desc:S=>`堅実：敵1体に攻撃（追加${10+2*S}）、自分に防護1。強気：体力10×成長係数も払い、敵1体に攻撃（追加${18+2*S}）。`},
  J07:{name:"ニート",           field:"充電と自己防護", skill:"マイペース充電",   cost:0, desc:S=>`集中力の消費なし。自分の集中力＋5、自分に防護${2+Math.floor(S/2)}。`},
  J08:{name:"ライバー",         field:"応援と回復",     skill:"コールアンドレスポンス", cost:2, desc:S=>`エール＋${24+S}、味方1人の体力を${8+S}×成長係数回復。`},
  J09:{name:"工場作業者",       field:"攻撃と全体防護", skill:"品質チェック",     cost:3, desc:S=>`敵1体に攻撃（追加${6+2*S}）。味方全員に防護1。`},
  J10:{name:"ユーチューバー",   field:"複数の敵への攻撃",skill:"ダイジェスト編集", cost:3, desc:S=>`敵全体に レベル×2＋(${5+S})×成長係数−防御力 のダメージ。エール＋8とコメント連携は使わない。`},
  J11:{name:"インフルエンサー", field:"応援と全体防護", skill:"シェアウェーブ",   cost:3, desc:S=>`エール＋${16+2*S}、味方全員に防護2。`},
  J12:{name:"専業主婦",         field:"全体の立て直し", skill:"暮らしの段取り",   cost:3, desc:S=>`味方全員の体力を${8+S}×成長係数回復し、集中力＋1。`},
  J13:{name:"看護師",           field:"大きな単体回復", skill:"ケアコール",       cost:3, desc:S=>`味方1人の体力を(${18+3*S})×成長係数＋レベル×2回復。`},
  J14:{name:"調理師",           field:"全体への集中力補給",skill:"キッチンリズム", cost:3, desc:S=>`自分以外の味方全員の集中力＋${2+Math.floor(S/2)}。`},
  J15:{name:"電気工事士",       field:"単体への集中攻撃",skill:"ライトパルス",    cost:3, desc:S=>`敵1体に攻撃（追加${12+2*S}）。`},
  J16:{name:"配管工",           field:"防御を越える攻撃",skill:"音声ルート",      cost:2, desc:S=>`敵の防御力を0として、敵1体に攻撃（追加${4+S}）。`},
  J17:{name:"建築士",           field:"全体防護",       skill:"光のステージ",     cost:3, desc:S=>`味方全員に防護${3+Math.floor(S/2)}。`},
  J18:{name:"社会福祉士",       field:"回復と攻撃準備", skill:"はじめまして案内", cost:2, desc:S=>`味方1人の体力を(${12+2*S})×成長係数＋レベル×2回復、コメント連携4。`},
  J19:{name:"素人カメラマン",   field:"攻撃と次の攻撃支援",skill:"フラッシュショット",cost:3, desc:S=>`敵1体に攻撃（追加${10+2*S}）。コメント連携を使った後、コメント連携を4に戻す。`},
  J20:{name:"観光ガイド",       field:"応援と攻撃準備", skill:"ルートガイド",     cost:2, desc:S=>`エール＋${12+S}、コメント連携4、味方全員に防護1。`},
  J21:{name:"プロカメラマン",   field:"集中力を使う単体攻撃",skill:"精密フレーミング",cost:4, desc:S=>`敵1体に攻撃（追加${18+2*S}）。コメント連携を使い、戻さない。`},
  J22:{name:"アイドルオタク",   field:"応援と集中力補給",skill:"推し色コール",    cost:3, desc:S=>`エール＋${14+2*S}、自分以外の味方1人の集中力＋${2+Math.floor(S/2)}。`}
};
const JOB_IDS = Object.keys(JOBS);
const H_TYPE = new Set(["J01","J03","J05","J08","J09","J12","J13","J15","J16","J17","J19"]);

/* 第16A～16D節：装備（共通36種＋専用44種。地域24種は各県の段階で追加） */
const EQUIP = {
  CW01:{slot:"w",name:"はじめの配信マイク",price:0,atk:2,text:"単体攻撃力＋2。"},
  CW02:{slot:"w",name:"声合わせハンドマイク",price:180,atk:1,commentA:1,text:"単体攻撃力＋1。応援コメントのエール＋1。"},
  CW03:{slot:"w",name:"光つなぎの指示棒",price:240,atk:3,text:"単体攻撃力＋3。"},
  CW04:{slot:"w",name:"記録のペン型リモコン",price:180,atk:0,c:1,text:"単体攻撃力＋0。最大集中力＋1。"},
  CW05:{slot:"w",name:"小窓のミニライト",price:240,atk:1,meter:1,text:"単体攻撃力＋1。メーター突破＋1。"},
  CW06:{slot:"w",name:"返事のチャイムマイク",price:240,atk:1,family:1,text:"単体攻撃力＋1。ファミリー応援の回復＋1。"},
  CA01:{slot:"a",name:"控室パーカー",price:0,d:1,text:"防御1。"},
  CA02:{slot:"a",name:"巡回ライトベスト",price:180,d:0,hp:6,text:"防御0、最大体力＋6。"},
  CA03:{slot:"a",name:"音守りヘッドセット",price:180,d:0,c:1,text:"防御0、最大集中力＋1。"},
  CA04:{slot:"a",name:"風よけ配信ジャケット",price:300,d:2,text:"防御2。"},
  CA05:{slot:"a",name:"携行プロテクトバッグ",price:240,d:1,hp:2,text:"防御1、最大体力＋2。"},
  CA06:{slot:"a",name:"配信用リストサポーター",price:240,d:1,rest:1,text:"防御1、ひと息つくの集中力回復＋1。"},
  AC01:{slot:"acc",name:"携帯マイク",price:200,atk:2,text:"単体攻撃力＋2。"},
  AC02:{slot:"acc",name:"コメント手帳",price:200,commentA:2,text:"応援コメントのエール＋2。"},
  AC03:{slot:"acc",name:"保温ボトル",price:200,rest:1,text:"ひと息つくの集中力回復＋1。"},
  AC04:{slot:"acc",name:"予備バッテリー",price:200,c:1,text:"最大集中力＋1。"},
  AC05:{slot:"acc",name:"折り畳みライト",price:300,hp:5,text:"最大体力＋5。"},
  AC06:{slot:"acc",name:"携帯スピーカー",price:300,meter:2,text:"メーター突破＋2。"},
  AC07:{slot:"acc",name:"応援タオル",price:300,family:2,text:"ファミリー応援の回復＋2。"},
  AC08:{slot:"acc",name:"配信者のポーチ",price:300,pouch:true,text:"自分が使う回復・蘇生道具の効果1.5倍（切上げ）。"}
};
const JW_NAMES = ["旅程ビーコンマイク","ログ整理キーボード","光彩リフレクター","提案タッチパネル","リズムスキャン端末","読み筋カードデッキ","発見メモタブレット","返事の指向性マイク","工程ライトワンド","四景編集コントローラー","紹介リレースマートフォン","くらしノート端末","ケアコールマイク","リズム調理タイマー","照明調整テスター","音路チューニングレンチ","ステージ設計スタイラス","対話ナビクリップボード","つなぐシャッターカメラ","まち案内ライトポインター","定点フォーカスカメラ","推し色ペンライト"];
const JA_NAMES = ["巡回配信ジャケット","端末ポケットベスト","ステージライトケープ","セレクトポケットエプロン","チェックラインベスト","テーブルジャケット","趣味じかんカーディガン","ステージパーカー","工程サイン作業ベスト","編集ポケットジャケット","街めぐりライトコート","段取りポケットベスト","ケアステージカーディガン","キッチンステージエプロン","ライト調整プロテクトベスト","ルートメッシュ作業ベスト","設計ポケットロングベスト","対話サポートカーディガン","撮影クッションベスト","まち歩きウインドジャケット","機材サポートベスト","応援ユーティリティパーカー"];
JOB_IDS.forEach((j,i)=>{
  const n=j.slice(1);
  EQUIP["JW"+n]={slot:"w",name:JW_NAMES[i],price:320,atk:2,job:j,needR:4,text:`${JOBS[j].name}専用・熟練度4以上。単体攻撃力＋2、技能強化＋1。`};
  const h=H_TYPE.has(j);
  EQUIP["JA"+n]={slot:"a",name:JA_NAMES[i],price:320,d:1,hp:h?4:0,c:h?0:1,job:j,needR:7,text:`${JOBS[j].name}専用・熟練度7以上。防御1、${h?"最大体力＋4":"最大集中力＋1"}。`};
});
const SHOPS = {
  SH01:{name:"広場の道具店", items:["CW01","CW02","CW03","CA01","CA02","CA04","AC01","AC02","AC03","AC04"]},
  SH02:{name:"港の配信用品店", items:["CW01","CW04","CW05","CW06","CA01","CA03","CA05","CA06","AC05","AC06","AC07","AC08"]}
};

/* 第11B節：地域ボス（福岡は静観型） */
const BOSSES = {
  LB01:{name:"コメラモス", q:3, areaId:"KY01-A3", cue:"guard", hub:"KY01"},
  B01: {name:"ハートーマ", q:8, areaId:"KY02-A3", cue:"guard", hub:"KY02"},
  B02: {name:"シオカゼラ", q:11, areaId:"KY03-A3", cue:"guard", hub:"KY03"},
  B03: {name:"ヒカリカエシ", q:14, areaId:"KY04-A3", cue:"guard", hub:"KY04"},
  B04: {name:"カゼマチ", q:17, areaId:"KY05-A3", cue:"guard", hub:"KY05"},
  B05: {name:"オトノコダマ", q:20, areaId:"KY06-A3", cue:"guard", hub:"KY06"},
  B06: {name:"コエノカゲ", q:23, areaId:"KY07-A3", cue:"guard", hub:"KY07"}
};

/* ボスの少人数補正（ユーザー指定の2人旅に合わせた本作の調整）。HPと攻撃に掛ける */
const BOSS_PARTY_SCALE = { 1:{hp:0.5,atk:0.8}, 2:{hp:0.7,atk:0.85}, 3:{hp:0.85,atk:0.92}, 4:{hp:1,atk:1} };
/* ボス個別の上書き：コメラモスは2人でLV2～3が勝ちどころになるよう弱めの補正 */
const BOSS_SCALE_OVERRIDE = { LB01:{ 2:{hp:0.9,atk:1} } };
function bossScale(bid, n){ n=Math.min(4,Math.max(1,n)); const o=BOSS_SCALE_OVERRIDE[bid]; return (o&&o[n]) || BOSS_PARTY_SCALE[n]; }

/* 宿屋：1人あたりの宿泊料（ゴールド）。泊まると翌朝になり、体力と集中力が全回復 */
const INN_PRICE = { KY01:6, KY02:10, KY03:12, KY04:12, KY05:14, KY06:14, KY07:16, KY08:16 };

/* 第05D節：もえのシナリオ到達ランク */
const MOE_RANKS = ["E1","D1","D2","D3","C1","C2","C3","B1","B2","B3","A1","A2","A3","S1","S2","S3","S4","S5","S6"];

/* 第18～19節：依頼（福岡編・佐賀編の入口） */
const QUESTS = {
  M01:{hub:"KY01", name:"故郷からの第一声", kills:1, boss:"LB01", stream:false, main:true,
       goal:"福岡市のA1～A3で通常敵を1体倒し、放送塔の丘の奥でコメラモスに挑む。"},
  M02:{hub:"KY02", name:"港の声リレー", kills:2, boss:"B01", stream:true, main:true,
       goal:"北九州市のA1～A3で通常敵を2体倒し、灯台の段丘の奥でハートーマに挑む。その後、配信で80点以上。"},
  M03:{hub:"KY03", name:"海辺からの返事", kills:2, boss:"B02", stream:true, main:true,
       goal:"唐津市のA1～A3で通常敵を2体倒し、海辺の見晴らしでシオカゼラに挑む。その後、配信で80点以上。"},
  M04:{hub:"KY04", name:"街灯をつなぐ声", kills:2, boss:"B03", stream:true, main:true,
       goal:"佐賀市のA1～A3で通常敵を2体倒し、街灯の広場でヒカリカエシに挑む。その後、配信で80点以上。"},
  M05:{hub:"KY05", name:"港から届く返事", kills:2, boss:"B04", stream:true, main:true,
       goal:"佐世保市のA1～A3で通常敵を2体倒し、展望広場でカゼマチに挑む。その後、配信で80点以上。"},
  M06:{hub:"KY06", name:"丘から返る声", kills:2, boss:"B05", stream:true, main:true,
       goal:"長崎市のA1～A3で通常敵を2体倒し、丘の眺めでオトノコダマに挑む。その後、配信で80点以上。"},
  M07:{hub:"KY07", name:"石垣の先の声", kills:2, boss:"B06", stream:true, main:true,
       goal:"熊本市のA1～A3で通常敵を2体倒し、石垣の広場でコエノカゲに挑む。その後、配信で80点以上。"},
  S01:{hub:"KY01", name:"ふるさとの紹介文", kills:1, main:false, npc:"akari",
       goal:"灯里と故郷の紹介文を考え、福岡市のA1～A3で通常敵を1体倒す。"},
  S02:{hub:"KY02", name:"港の拍手練習", kills:1, main:false, npc:"sota",
       goal:"奏太の応援のタイミングを整え、北九州市のA1～A3で通常敵を1体倒す。"}
};

/* 第15節：地域支援 */
const SUPPORTS = {
  PR01:{name:"福岡の声", text:"戦闘開始時のエール＋10", startA:10, npc:"akari"},
  PR02:{name:"佐賀の声", text:"戦闘開始時のエール＋12", startA:12, npc:"karatsuGuide"},
  PR03:{name:"長崎の声", text:"戦闘開始時のエール＋14", startA:14, npc:"saseboGuide"}
};

/* 第13・13A節：配信 */
const STREAM_ACTS = {
  first:{name:"初見案内", req:"初めての人へ企画を教えて"},
  local:{name:"地域紹介", req:"街の話を聞きたい"},
  reply:{name:"コメント返し", req:"質問に答えて"},
  thanks:{name:"ありがとう", req:"今日を振り返って"},
  like:{name:"いいねリレー", req:"光のリレーを見たい"},
  kira:{name:"キラコメ演出", req:"短いキラコメで彩って"}
};
const STREAM_REQ = { PR01:["first","local","reply","thanks"], PR02:["local","reply","first","thanks"], PR03:["local","first","reply","thanks"], PR04:["first","reply","local","thanks"] };
const STREAM_THEMES = { newbie:{name:"初見歓迎",act:"first"}, local:{name:"地域の話",act:"local"}, chat:{name:"ゆったり雑談",act:"reply"} };
const STREAM_TIMES = ["21時00分","21時20分","21時40分","21時59分"];

/* ===== マップ ===== */
/* タイル: T木 .草(安全) ,道(安全) ~水 #壁 w床 1/2/3危険 =橋 c屋根 */
function buildMap(w,h,ops){
  const g=[]; for(let y=0;y<h;y++){g.push(new Array(w).fill("T"));}
  for(const [t,x,y,ww,hh] of ops){ for(let j=y;j<y+hh;j++) for(let i=x;i<x+ww;i++) if(g[j]&&i>=0&&i<w) g[j][i]=t; }
  return g;
}
const MAPS = {
  "KY01":{ hub:"KY01", name:"福岡市", kind:"out", w:48, h:32, safeAnchor:[19,19],
    tiles: buildMap(48,32,[
      [".",1,1,46,30],["T",1,1,46,1],["T",1,2,13,9],["T",34,2,13,9],
      ["3",14,2,20,8],["T",19,4,10,3],["T",14,2,3,2],["T",31,2,3,2],[",",24,10,2,1],
      ["1",1,11,11,10],["T",4,14,5,4],
      ["2",36,11,11,10],["#",39,14,5,4],["c",39,13,5,1],
      [",",14,11,20,10],["~",22,14,4,3],
      ["#",15,22,7,3],["c",15,21,7,1],
      ["#",26,22,6,3],["c",26,21,6,1],
      [",",33,24,14,1],[",",18,21,1,1],[",",29,21,1,1],
      ["~",1,27,46,4],[",",8,25,10,1],["=",10,26,3,3]
    ]),
    objects:[
      {id:"door_home",x:18,y:22,type:"door",label:"実家と控室",to:"KY01-in",tx:12,ty:16},
      {id:"shop1",x:29,y:22,type:"shop",label:"広場の道具店",shop:"SH01",npc:"ryosuke"},
      {id:"akari",x:16,y:13,type:"npc",label:"灯里",npc:"akari"},
      {id:"chiyo",x:9,y:25,type:"npc",label:"千代",npc:"chiyo"},
      {id:"inn1",x:34,y:21,type:"inn",label:"宿屋「みなと屋」"},
      {id:"boxA1",x:14,y:20,type:"box",label:"応援箱A",box:"KY01-A"},
      {id:"boxB1",x:33,y:11,type:"box",label:"応援箱B",box:"KY01-B"},
      {id:"bench",x:12,y:24,type:"bench",label:"夕景のベンチ"},
      {id:"sign1",x:12,y:12,type:"sign",label:"案内板（広場外れ）",area:"KY01-A1"},
      {id:"sign2",x:35,y:12,type:"sign",label:"案内板（ひさし通り）",area:"KY01-A2"},
      {id:"sign3",x:23,y:10,type:"sign",label:"案内板（放送塔の丘）",area:"KY01-A3"},
      {id:"tower",x:24,y:1,type:"tower",label:"放送塔"},
      {id:"boss1",x:24,y:2,type:"boss",label:"放送塔の前（ボス待機地点）",boss:"LB01",walk:true},
      {id:"gate1",x:46,y:24,type:"gate",label:"北九州市への道",to:"KY02",tx:2,ty:24}
    ],
    zones:{"1":"KY01-A1","2":"KY01-A2","3":"KY01-A3"}
  },
  "KY01-in":{ hub:"KY01", name:"福岡市・実家と控室", kind:"in", w:24, h:18, safeAnchor:[12,15],
    tiles: buildMap(24,18,[["#",0,0,24,18],["w",1,2,22,15],["#",12,2,1,9],["w",12,8,1,2]]),
    objects:[
      {id:"exit_home",x:12,y:17,type:"door",label:"外へ出る",to:"KY01",tx:18,ty:21,walk:true},
      {id:"rest_home",x:4,y:4,type:"rest",label:"居間（日付を進める）"},
      {id:"shelf",x:8,y:3,type:"shelf",label:"故郷の展示棚"},
      {id:"moe1",x:17,y:6,type:"npc",label:"もえ",npc:"moe"},
      {id:"board1",x:20,y:3,type:"board",label:"控室の編成ボード"}
    ], zones:{}
  },
  "KY02":{ hub:"KY02", name:"北九州市", kind:"out", w:48, h:32, safeAnchor:[24,20],
    tiles: buildMap(48,32,[
      [".",1,1,46,30],["T",1,1,46,1],["T",1,2,12,9],["T",35,2,12,9],
      ["3",13,2,22,8],["T",18,4,12,3],[",",23,10,2,1],
      ["2",36,11,11,12],["#",38,13,3,3],["#",43,13,3,3],["#",38,18,3,3],["#",43,18,3,3],["c",38,12,3,1],["c",43,12,3,1],["c",38,17,3,1],["c",43,17,3,1],
      [",",14,11,20,10],
      ["#",16,21,6,3],["c",16,20,6,1],
      ["#",27,21,6,3],["c",27,20,6,1],[",",19,20,1,1],[",",30,20,1,1],
      [",",1,24,13,1],
      ["1",2,25,40,3],["T",10,26,24,1],
      ["~",1,28,46,3]
    ]),
    objects:[
      {id:"door_k2",x:19,y:21,type:"door",label:"エール便の控室",to:"KY02-in",tx:12,ty:16},
      {id:"shop2",x:30,y:21,type:"shop",label:"港の配信用品店",shop:"SH02",npc:"shigeru"},
      {id:"sota",x:27,y:13,type:"npc",label:"奏太",npc:"sota"},
      {id:"misuzu",x:12,y:22,type:"npc",label:"美鈴",npc:"misuzu"},
      {id:"inn2",x:24,y:21,type:"inn",label:"宿屋「灯台荘」"},
      {id:"boxA2",x:15,y:13,type:"box",label:"応援箱A",box:"KY02-A"},
      {id:"boxB2",x:34,y:20,type:"box",label:"応援箱B",box:"KY02-B"},
      {id:"sign4",x:14,y:24,type:"sign",label:"案内板（港の遊歩道）",area:"KY02-A1"},
      {id:"sign5",x:35,y:12,type:"sign",label:"案内板（倉庫街道）",area:"KY02-A2"},
      {id:"sign6",x:22,y:10,type:"sign",label:"案内板（灯台の段丘）",area:"KY02-A3"},
      {id:"lighthouse",x:24,y:1,type:"tower",label:"灯台"},
      {id:"boss2",x:24,y:2,type:"boss",label:"灯台の前（ボス待機地点）",boss:"B01",walk:true},
      {id:"gate2",x:1,y:24,type:"gate",label:"福岡市への道",to:"KY01",tx:45,ty:24},
      {id:"gate_saga",x:46,y:24,type:"gate",label:"唐津市への道",to:"KY03",tx:2,ty:24}
    ],
    zones:{"1":"KY02-A1","2":"KY02-A2","3":"KY02-A3"}
  },
  "KY02-in":{ hub:"KY02", name:"北九州市・エール便の控室", kind:"in", w:24, h:18, safeAnchor:[12,15],
    tiles: buildMap(24,18,[["#",0,0,24,18],["w",1,2,22,15]]),
    objects:[
      {id:"exit_k2",x:12,y:17,type:"door",label:"外へ出る",to:"KY02",tx:19,ty:20,walk:true},
      {id:"rest_k2",x:4,y:4,type:"rest",label:"仮眠スペース（日付を進める）"},
      {id:"moe2",x:17,y:6,type:"npc",label:"もえ",npc:"moe"},
      {id:"board2",x:20,y:3,type:"board",label:"控室の編成ボード"}
    ], zones:{}
  },
  "KY03":{ hub:"KY03", name:"唐津市", kind:"out", w:48, h:32, safeAnchor:[12,20],
    tiles: buildMap(48,32,[
      [".",1,1,46,30],["~",1,1,46,8],["~",33,9,14,8],
      ["T",2,10,8,8],["T",39,18,7,7],
      ["1",2,18,9,5],["2",34,18,5,8],["3",15,9,18,6],
      [",",1,24,24,1],[",",12,16,2,9],[",",12,16,24,2],
      ["#",17,20,6,3],["c",17,19,6,1],["#",27,20,6,3],["c",27,19,6,1]
    ]),
    objects:[
      {id:"gate_kitakyushu",x:1,y:24,type:"gate",label:"北九州市への道",to:"KY02",tx:45,ty:24},
      {id:"karatsu_guide",x:12,y:19,type:"npc",label:"唐津の案内人",npc:"karatsuGuide"},
      {id:"karatsu_landmark",x:25,y:16,type:"landmark",label:"海辺の案内板"},
      {id:"karatsu_sign1",x:10,y:20,type:"sign",label:"案内板（海辺の小径）",area:"KY03-A1"},
      {id:"karatsu_sign2",x:35,y:17,type:"sign",label:"案内板（潮見の路地）",area:"KY03-A2"},
      {id:"karatsu_sign3",x:14,y:12,type:"sign",label:"案内板（見晴らし台）",area:"KY03-A3"},
      {id:"karatsu_boss",x:24,y:10,type:"boss",label:"見晴らし台の前（ボス待機地点）",boss:"B02",walk:true},
      {id:"karatsu_inn",x:20,y:20,type:"inn",label:"唐津の宿屋"},
      {id:"karatsu_rest",x:30,y:20,type:"rest",label:"休憩所（日付を進める）"},
      {id:"karatsu_board",x:27,y:16,type:"board",label:"編成ボード"},
      {id:"karatsu_record",x:33,y:16,type:"shelf",label:"旅の記録"},
      {id:"gate_sagacity",x:46,y:24,type:"gate",label:"佐賀市への道",to:"KY04",tx:2,ty:20}
    ], zones:{"1":"KY03-A1","2":"KY03-A2","3":"KY03-A3"}
  },
  "KY04":{ hub:"KY04", name:"佐賀市", kind:"out", w:40, h:28, safeAnchor:[12,20],
    tiles:buildMap(40,28,[[".",1,1,38,26],["T",2,3,7,9],["T",32,3,6,9],["1",3,13,6,5],["2",30,13,6,5],["3",16,4,9,5],[",",1,20,37,1],[",",12,12,2,9],[",",12,12,22,2]]),
    objects:[
      {id:"gate_karatsu",x:1,y:20,type:"gate",label:"唐津市への道",to:"KY03",tx:46,ty:25},
      {id:"sagacity_guide",x:12,y:19,type:"npc",label:"佐賀市の案内人",npc:"sagaCityGuide"},
      {id:"sagacity_sign1",x:9,y:15,type:"sign",label:"案内板（川沿いの道）",area:"KY04-A1"},
      {id:"sagacity_sign2",x:29,y:15,type:"sign",label:"案内板（駅前の通り）",area:"KY04-A2"},
      {id:"sagacity_sign3",x:20,y:9,type:"sign",label:"案内板（街灯の広場）",area:"KY04-A3"},
      {id:"sagacity_boss",x:20,y:5,type:"boss",label:"街灯の広場の奥（ボス待機地点）",boss:"B03",walk:true},
      {id:"sagacity_inn",x:20,y:18,type:"inn",label:"佐賀市の宿屋"},
      {id:"sagacity_rest",x:30,y:18,type:"rest",label:"休憩所（日付を進める）"},
      {id:"sagacity_board",x:26,y:13,type:"board",label:"編成ボード"},
      {id:"sagacity_record",x:33,y:13,type:"shelf",label:"旅の記録"},
      {id:"gate_sasebo",x:38,y:20,type:"gate",label:"佐世保市への道",to:"KY05",tx:2,ty:20}
    ], zones:{"1":"KY04-A1","2":"KY04-A2","3":"KY04-A3"}
  },
  "KY05":{ hub:"KY05", name:"佐世保市", kind:"out", w:40, h:28, safeAnchor:[12,20],
    tiles:buildMap(40,28,[[".",1,1,38,26],["T",2,3,7,9],["T",32,3,6,9],["1",3,13,6,5],["2",30,13,6,5],["3",16,4,9,5],[",",1,20,37,1],[",",12,12,2,9],[",",12,12,22,2]]),
    objects:[
      {id:"gate_sagacity",x:1,y:20,type:"gate",label:"佐賀市への道",to:"KY04",tx:37,ty:20},
      {id:"sasebo_guide",x:12,y:19,type:"npc",label:"佐世保市の案内人",npc:"saseboGuide"},
      {id:"sasebo_sign1",x:9,y:15,type:"sign",label:"案内板（港沿いの道）",area:"KY05-A1"},
      {id:"sasebo_sign2",x:29,y:15,type:"sign",label:"案内板（坂の通り）",area:"KY05-A2"},
      {id:"sasebo_sign3",x:20,y:9,type:"sign",label:"案内板（展望広場）",area:"KY05-A3"},
      {id:"sasebo_boss",x:20,y:5,type:"boss",label:"展望広場の奥（ボス待機地点）",boss:"B04",walk:true},
      {id:"sasebo_inn",x:20,y:18,type:"inn",label:"佐世保市の宿屋"},
      {id:"sasebo_rest",x:30,y:18,type:"rest",label:"休憩所（日付を進める）"},
      {id:"sasebo_board",x:26,y:13,type:"board",label:"編成ボード"},
      {id:"sasebo_record",x:33,y:13,type:"shelf",label:"旅の記録"},
      {id:"gate_nagasaki",x:38,y:20,type:"gate",label:"長崎市への道",to:"KY06",tx:2,ty:20}
    ], zones:{"1":"KY05-A1","2":"KY05-A2","3":"KY05-A3"}
  },
  "KY06":{ hub:"KY06", name:"長崎市", kind:"out", w:40, h:28, safeAnchor:[12,20],
    tiles:buildMap(40,28,[[".",1,1,38,26],["~",1,1,38,5],["T",2,8,7,8],["T",32,8,6,8],["1",3,16,7,3],["2",30,16,6,3],["3",16,7,9,4],[",",1,20,37,1],[",",12,10,2,11],[",",12,10,21,2],["#",18,15,7,3],["c",18,14,7,1]]),
    objects:[
      {id:"gate_sasebo",x:1,y:20,type:"gate",label:"佐世保市への道",to:"KY05",tx:37,ty:20},
      {id:"nagasaki_guide",x:12,y:19,type:"npc",label:"長崎市の案内人",npc:"nagasakiGuide"},
      {id:"nagasaki_sign1",x:10,y:17,type:"sign",label:"案内板（港の小径）",area:"KY06-A1"},
      {id:"nagasaki_sign2",x:29,y:17,type:"sign",label:"案内板（坂道の路地）",area:"KY06-A2"},
      {id:"nagasaki_sign3",x:20,y:11,type:"sign",label:"案内板（丘の眺め）",area:"KY06-A3"},
      {id:"nagasaki_boss",x:20,y:8,type:"boss",label:"丘の眺めの奥（ボス待機地点）",boss:"B05",walk:true},
      {id:"nagasaki_inn",x:21,y:18,type:"inn",label:"長崎市の宿屋"},
      {id:"nagasaki_rest",x:30,y:18,type:"rest",label:"休憩所（日付を進める）"},
      {id:"nagasaki_board",x:26,y:13,type:"board",label:"編成ボード"},
      {id:"nagasaki_record",x:33,y:13,type:"shelf",label:"旅の記録"},
      {id:"gate_kumamoto",x:38,y:20,type:"gate",label:"熊本市への道",to:"KY07",tx:2,ty:20}
    ], zones:{"1":"KY06-A1","2":"KY06-A2","3":"KY06-A3"}
  },
  "KY07":{ hub:"KY07", name:"熊本市", kind:"out", w:40, h:28, safeAnchor:[12,20],
    tiles:buildMap(40,28,[[".",1,1,38,26],["T",2,3,7,9],["T",32,3,6,9],["1",3,13,6,5],["2",30,13,6,5],["3",16,4,9,4],[",",1,20,37,1],[",",12,12,2,9],["#",17,8,8,6],["c",16,14,10,1]]),
    objects:[
      {id:"gate_nagasakicity",x:1,y:20,type:"gate",label:"長崎市への道",to:"KY06",tx:37,ty:20},
      {id:"kumamoto_guide",x:12,y:19,type:"npc",label:"熊本市の案内人",npc:"kumamotoGuide"},
      {id:"kumamoto_sign1",x:9,y:15,type:"sign",label:"案内板（川辺の小径）",area:"KY07-A1"},
      {id:"kumamoto_sign2",x:29,y:15,type:"sign",label:"案内板（街路の通り）",area:"KY07-A2"},
      {id:"kumamoto_sign3",x:20,y:8,type:"sign",label:"案内板（石垣の広場）",area:"KY07-A3"},
      {id:"kumamoto_boss",x:20,y:5,type:"boss",label:"石垣の広場の奥（ボス待機地点）",boss:"B06",walk:true},
      {id:"kumamoto_inn",x:20,y:18,type:"inn",label:"熊本市の宿屋"},
      {id:"kumamoto_rest",x:30,y:18,type:"rest",label:"休憩所（日付を進める）"},
      {id:"kumamoto_board",x:26,y:16,type:"board",label:"編成ボード"},
      {id:"kumamoto_record",x:33,y:16,type:"shelf",label:"旅の記録"},
      {id:"gate_aso",x:38,y:20,type:"gate",label:"阿蘇市への道",to:"KY08",tx:2,ty:20}
    ], zones:{"1":"KY07-A1","2":"KY07-A2","3":"KY07-A3"}
  },
  "KY08":{ hub:"KY08", name:"阿蘇市", kind:"out", w:40, h:28, safeAnchor:[12,20],
    tiles:buildMap(40,28,[[".",1,1,38,26],["T",2,3,7,9],["T",32,3,6,9],["1",3,13,6,5],["2",30,13,6,5],["3",16,3,9,4],[",",1,20,37,1],[",",12,12,2,9],["#",18,7,6,5],["c",17,12,8,1]]),
    objects:[
      {id:"gate_kumamotocity",x:1,y:20,type:"gate",label:"熊本市への道",to:"KY07",tx:37,ty:20},
      {id:"aso_guide",x:12,y:19,type:"npc",label:"阿蘇市の案内人",npc:"asoGuide"},
      {id:"aso_sign1",x:9,y:15,type:"sign",label:"案内板（草地の道）",area:"KY08-A1"},
      {id:"aso_sign2",x:29,y:15,type:"sign",label:"案内板（風の通り）",area:"KY08-A2"},
      {id:"aso_sign3",x:20,y:7,type:"sign",label:"案内板（稜線の広場）",area:"KY08-A3"},
      {id:"aso_inn",x:20,y:18,type:"inn",label:"阿蘇市の宿屋"},
      {id:"aso_rest",x:30,y:18,type:"rest",label:"休憩所（日付を進める）"},
      {id:"aso_board",x:26,y:16,type:"board",label:"編成ボード"},
      {id:"aso_record",x:33,y:16,type:"shelf",label:"旅の記録"}
    ], zones:{"1":"KY08-A1","2":"KY08-A2","3":"KY08-A3"}
  }
};
const HUBS = {
  KY01:{name:"福岡市", pref:"福岡", prefId:"PR01", map:"KY01", home:true},
  KY02:{name:"北九州市", pref:"福岡", prefId:"PR01", map:"KY02"},
  KY03:{name:"唐津市", pref:"佐賀", prefId:"PR02", map:"KY03"},
  KY04:{name:"佐賀市", pref:"佐賀", prefId:"PR02", map:"KY04"},
  KY05:{name:"佐世保市", pref:"長崎", prefId:"PR03", map:"KY05"},
  KY06:{name:"長崎市", pref:"長崎", prefId:"PR03", map:"KY06"},
  KY07:{name:"熊本市", pref:"熊本", prefId:"PR04", map:"KY07"},
  KY08:{name:"阿蘇市", pref:"熊本", prefId:"PR04", map:"KY08"}
};
const FUTURE_HUBS = [["KY09","別府市","大分"],["KY10","大分市","大分"],["KY11","宮崎市","宮崎"],["KY12","日南市","宮崎"],["KY13","霧島市","鹿児島"],["KY14","鹿児島市","鹿児島"],["KY15","那覇市","沖縄"],["KY16","名護市","沖縄"]];

/* ===== 住民と会話 ===== */
const NPCS = {
  asoGuide:{name:"阿蘇市の案内人", hub:"KY08", sprite:[PAL.sand,PAL.sea],
    first:p=>[["案内人",`${p}さん、阿蘇市へようこそ。草地の道から稜線の広場まで歩けます。`],["案内人","依頼と配信はまだ準備中です。熊本市へは西の門から戻れます。"]],
    normal:p=>[["案内人","草地の道・風の通り・稜線の広場を探索できます。宿屋と休憩所もどうぞ。"]]},
  kumamotoGuide:{name:"熊本市の案内人", hub:"KY07", sprite:[PAL.sand,PAL.ink],
    first:p=>[["案内人",`${p}さん、熊本市へようこそ。川辺の小径から石垣の広場まで歩けます。`],["案内人","石垣の奥に声が残っています。依頼帳でM07を受け、街で調べてください。"]],
    normal:p=>[["案内人","川辺の小径・街路の通り・石垣の広場を探索できます。宿屋と休憩所もどうぞ。"]]},
  nagasakiGuide:{name:"長崎市の案内人", hub:"KY06", sprite:[PAL.sea,PAL.sand],
    first:p=>[["案内人",`${p}さん、長崎市へようこそ。港の小径から丘の眺めまで探索できます。`],["案内人","丘の上で返事が重なっています。依頼帳でM06を受け、港と坂道から調べてください。"]],
    normal:p=>[["案内人","港の小径・坂道の路地・丘の眺めを歩けます。佐世保市へは西の門から戻れます。"]]},
  akari:{name:"灯里", hub:"KY01", rep:true, sprite:[PAL.coral,PAL.ink],
    first:p=>[["灯里",`${p}、おかえり！ 交流会の準備、手伝いに来てくれたんだね。`],["灯里","この広場、昔から皆の待ち合わせ場所でしょ。今日はもえさんの配信を見に来た人も多いよ。"],["灯里","実は、広場の紹介文を一緒に考えてくれる人を探してたんだ。手が空いたら声をかけて。"]],
    after:p=>[["灯里","紹介文、掲示板に貼ったよ。読んだ人が『行ってみたい』って言ってくれた。"]],
    normal:p=>[["灯里",`放送塔の丘は乱れが強いから、気をつけてね、${p}。`]] },
  ryosuke:{name:"良介", hub:"KY01", sprite:[PAL.sand,PAL.brown],
    first:p=>[["良介",`お、${p}じゃないか。道具店はいつでも開いてるよ。`],["良介","はじめのマイクとパーカーは無料で補充できる。気軽に寄ってくれ。"]],
    normal:p=>[["良介","いい道具は、使う人の声をちゃんと届けてくれるんだ。"]] },
  chiyo:{name:"千代", hub:"KY01", sprite:[PAL.mist,PAL.violet],
    first:p=>[["千代",`あら、${p}ちゃん。水辺の風が気持ちいいでしょう。`],["千代","ひさし通りの雨だれの音、近ごろ変に響くのよ。原因が分かったら教えてね。"]],
    normal:p=>[["千代","港の船を眺めると、遠くの街の声も聞こえる気がするわ。"]] },
  sota:{name:"奏太", hub:"KY02", rep:true, sprite:[PAL.sea,PAL.ink],
    first:p=>[["奏太","福岡市から来たエール便の人たち？ ようこそ北九州へ。"],["奏太","港で拍手の練習をしてるんだけど、いつ手をたたけばいいか迷っちゃって。"],["奏太","よかったら、タイミングを一緒に考えてくれないかな。"]],
    after:p=>[["奏太","拍手、配信の間合いにぴったり合うようになったよ。ありがとう！"]],
    normal:p=>[["奏太","灯台の段丘は、夜になると光が強く揺れるんだ。"]] },
  shigeru:{name:"茂", hub:"KY02", sprite:[PAL.slate,PAL.gold],
    first:p=>[["茂","港の配信用品店へようこそ。倉庫に眠ってた機材も手入れして並べてるよ。"]],
    normal:p=>[["茂","スピーカーやタオル、仲間を支える品がそろってる。"]] },
  misuzu:{name:"美鈴", hub:"KY02", sprite:[PAL.aqua,PAL.red],
    first:p=>[["美鈴","遊歩道の足元灯、点いたり消えたりしてるの。乱れのせいかしら。"]],
    normal:p=>[["美鈴","係留ロープの結び目って、きれいな形をしてるのよ。"]] },
  saseboGuide:{name:"佐世保市の案内人", hub:"KY05", sprite:[PAL.sand,PAL.sea],
    first:p=>[["案内人",`${p}さん、佐世保市へようこそ。港沿いの道から展望広場まで探索できます。`],["案内人","展望広場の声が風に散っています。依頼帳でM05を受け、港沿いと坂道から調べてください。"]],
    normal:p=>[["案内人","港沿いの道・坂の通り・展望広場には乱れが残っています。佐賀市へは西の門から戻れます。"]]},
  sagaCityGuide:{name:"佐賀市の案内人", hub:"KY04", sprite:[PAL.sand,PAL.coral],
    first:p=>[["案内人",`${p}さん、佐賀市へようこそ。唐津での配信を聞きました。`],["案内人","街灯の広場で声が重なっています。依頼帳でM04を受け、川沿いと駅前から調べてください。"]],
    normal:p=>[["案内人","唐津へは西の門から戻れます。街灯の広場へ向かう前に宿屋で整えてください。"]]},
  karatsuGuide:{name:"唐津の案内人", hub:"KY03", sprite:[PAL.sand,PAL.sea],
    first:p=>[["案内人",`${p}さん、唐津へようこそ。海辺の案内板から、この街の声を聞いてみてください。`],["案内人","見晴らし台の返事が乱れています。依頼帳でM03を受け、海辺の探索区域を調べてください。"]],
    normal:p=>[["案内人","北九州へは西の門から戻れます。見晴らし台へ行く前に宿屋で整えてください。"]] },
  moe:{name:"もえ", sprite:[PAL.cream,PAL.violet]}
};

/* 序章と節目（第05A・05E節。台詞は本作用の新規作成） */
const SCENES = {
  HS00:{title:"序章　福岡から", lines:p=>[
    ["","福岡市の実家。窓の外では、交流広場の準備が進んでいる。"],
    ["",`${p}は、今日の交流会を手伝う約束をしていた。`],
    ["","交流広場。そこで、ひとりの女性が住民と話していた。"],
    ["もえ","はじめまして。雪餅羽もえです。読み方は、のわんもえ。"],
    ["もえ","アイドルグループ『おやすみセカイ』のメンバーとして活動していました。"],
    ["もえ","おやすみセカイを脱退した今、Pocochaで新しい一歩を踏み出したい。目標はS6。"],
    ["もえ","今はE1から。一人ひとりの声に、ちゃんと返事ができる配信をしたいんです。"],
    [p,"その挑戦を支えるよ。配信の準備も旅も、一緒に進めよう。"],
    ["もえ","ありがとう。……ねえ、この街で好きな場所を、ひとつ教えてほしいな。"],
    ["","そのとき、交流会の仮想演出装置が乱れた。呼びかけと紹介の声が重なり、ノイズ体が生まれていく。"],
    ["もえ","声の順番が、ばらばらになってる……。私も一緒に行く。待ってるだけなんて、できないよ。"],
    ["","雪餅羽もえが仲間に加わった（ジョブ：ライバー）。旅を続けると、各地で新しい仲間に出会えます。"],
    ["","依頼帳から「M01 故郷からの第一声」を受けて、通常敵を倒し、放送塔の丘のコメラモスへ挑もう。"]
  ]},
  RANK_D1:{title:"もえのランク D1", lines:p=>[
    ["","放送塔の前。重なっていた声がほどけ、交流会の音が戻ってきた。"],
    ["もえ","聞こえる。最初の挨拶と、返事の声。ちゃんと順番に届いてる。"],
    ["灯里",`${p}たち、ありがとう！ 広場のみんなが、もえさんの配信を楽しみにしてるよ。`],
    ["","その後の配信で、もえの新しい挑戦に応援が届いた。もえのシナリオ到達ランクがD1になった。"],
    ["もえ","この声、次の街にも届けたい。"],
    [p,"じゃあ北九州へ行こう。九州エール便の始まりだ。"],
    ["","北九州市への道は、広場の東から続いている。依頼帳の「M02 港の声リレー」を受けよう。"]
  ]},
  M02_BOSS:{title:"灯台の段丘", lines:p=>[
    ["","灯台の光が穏やかになった。港の反響が静まり、配信の準備が整う。"],
    ["もえ","今日の配信、手伝ってくれる？ 返事は私が届ける。進行を支えてほしいの。"],
    ["","配信サポート担当と番組テーマを選んで、4手番の配信へ進もう。80点以上で達成。"]
  ]},
  RANK_D2:{title:"もえのランク D2", lines:p=>[
    ["","22時、締め。港のコメント欄に、ありがとうの言葉が並んだ。"],
    ["もえ","福岡でも北九州でも、声をくれた人がいた。全部、覚えておきたい。"],
    ["","もえのシナリオ到達ランクがD2になった。"],
    [p,"二人でここまで来られたね。次の県では、手伝ってくれる仲間も探そう。"],
    ["もえ",`${p}、次は佐賀だね。私、相手の返事を取り入れた紹介を試してみたい。`],
    ["","福岡編はここまで。唐津に渡り、次の依頼「M03 海辺からの返事」を受けられます。"]
  ]},
  M03_BOSS:{title:"見晴らし台の風", lines:p=>[
    ["","見晴らし台の乱れが静まり、海辺からの返事が届き始めた。"],
    ["航平",`${p}さん、帰りの道は任せて。もえさんの配信で、この街の声を届けよう。`],
    ["","佐賀での配信準備が整った。依頼帳から配信を始めよう。"]
  ]},
  RANK_D3:{title:"もえのランク D3", lines:p=>[
    ["もえ","唐津の人の返事を、急がず聞けた気がする。"],
    ["",`${p}たちは佐賀の海辺から次の旅程を考える。`],
    ["","もえのシナリオ到達ランクがD3になった。唐津の東門から佐賀市へ進み、M04を受けられます。"]
  ]},
  M04_BOSS:{title:"街灯の広場", lines:p=>[
    ["","街灯の広場に重なっていた声がほどけ、通りに落ち着きが戻った。"],
    ["もえ",`${p}、川沿いと駅前で聞いた声も、配信で届けよう。`],
    ["","佐賀市での配信準備が整った。依頼帳から配信を始めよう。"]
  ]},
  RANK_C1:{title:"もえのランク C1", lines:p=>[
    ["もえ","佐賀市の声を、みんなと一緒に届けられたね。"],
    ["","もえのシナリオ到達ランクがC1になった。佐賀市の東門から佐世保市へ進み、M05を受けられます。"]
  ]},
  M05_BOSS:{title:"展望広場の風", lines:p=>[
    ["","展望広場に重なっていた声がほどけ、港へ向かう風が落ち着いた。"],
    ["もえ",`${p}、港沿いと坂道で聞いた返事を配信でも届けよう。`],
    ["","佐世保市での配信準備が整った。依頼帳から配信を始めよう。"]
  ]},
  RANK_C2:{title:"もえのランク C2", lines:p=>[
    ["もえ","佐世保市からの返事も、みんなへ届けられたね。"],
    ["","もえのシナリオ到達ランクがC2になった。佐世保市の東門から長崎市へ進み、M06を受けられます。"]
  ]},
  M06_BOSS:{title:"丘の声", lines:p=>[
    ["","丘に重なっていた声が静まり、港と坂道からの返事が聞こえ始めた。"],
    ["もえ",`${p}、長崎市で聞いた声を配信でも届けよう。`],
    ["","長崎市での配信準備が整った。依頼帳から配信を始めよう。"]
  ]},
  RANK_C3:{title:"もえのランク C3", lines:p=>[
    ["もえ","長崎市で聞いた返事も、ひとつずつ届けられたね。"],
    ["","もえのシナリオ到達ランクがC3になった。長崎市の東門から熊本市へ進み、M07を受けられます。"]
  ]},
  M07_BOSS:{title:"石垣の声", lines:p=>[
    ["","広場に重なっていた声がほどけ、川辺と街路の呼びかけが届いた。"],
    ["もえ",`${p}、熊本市で聞いた声を配信でも届けよう。`],
    ["","熊本市での配信準備が整った。依頼帳から配信を始めよう。"]
  ]},
  RANK_B1:{title:"もえのランク B1", lines:p=>[
    ["もえ","熊本市の返事も、みんなに届いたね。"],
    ["","もえのシナリオ到達ランクがB1になった。熊本市の東門から阿蘇市へ進めます。"]
  ]},
  S01_DONE:{title:"ふるさとの紹介文", lines:p=>[
    ["灯里","できた！『待ち合わせの広場。帰ってきた人に、おかえりを言う場所』。"],
    ["もえ","いい紹介文。配信でも読ませてもらっていい？"],
    ["","紹介文を掲示できた。応援箱Bが開けられるようになった。"]
  ]},
  S02_DONE:{title:"港の拍手練習", lines:p=>[
    ["奏太","話が一区切りしたところで拍手。うん、これなら邪魔にならない！"],
    ["","拍手のタイミングを整えられた。応援箱Bが開けられるようになった。"]
  ]}
};
const BOX_CARDS = {
  "KY01-A":"旅立ちの広場","KY01-B":"ふるさとの紹介文","KY02-A":"港の遊歩道の灯り","KY02-B":"倉庫街の拍手"
};
const COMMENT_LINES = {
  greet:["こんばんは、届いてるよ！","はじめまして、来ました！","いい声だね、こんばんは！"],
  plan:["次は右から攻めよう！","守りを固めて、次で決めよう！","順番に声を届けよう！"],
  thanks:["ありがとう、助かった！","いい流れ、ありがとう！","一緒に来てくれてありがとう！"]
};
const LINE_NAMES = {greet:"挨拶",plan:"作戦",thanks:"感謝"};
const DIFFICULTY = {
  easy:{name:"ゆったり",hp:0.8,atk:0.75,startA:20},
  std:{name:"標準",hp:1,atk:1,startA:0},
  hard:{name:"手応え",hp:1.2,atk:1.15,startA:0}
};

/* ---- 道具袋の拡張上限（参照v10.73～10.80）。旧セーブの所持数は維持 ---- */
const BAG_KINDS = 300, EVENT_KINDS = 400, BAG_STACK = 99, KEEP_MAX = 20;
const UNEQUIPPED_GEAR_MAX = 300;
const ITEM_RARITY = {1:"★1 ありふれた",2:"★2 ときどき見る",3:"★3 めずらしい",4:"★4 とてもめずらしい",5:"★5 まぼろし"};
const ITEM_ACQ = {S:"ショップ",E:"イベント限定",DS:"モンスター限定（売却可）",DN:"モンスター限定（売却不可）",SD:"ショップ・モンスター"};
const ITEMS = {};
for(const [id,r] of Object.entries(ITEMS_RAW)){
  ITEMS[id] = {id, name:r[0], cat:r[1], target:r[2], eff:r[3], stars:r[4], tier:r[5], acq:r[6], price:r[7], sell:r[8], battleOnly:!!r[9], text:r[10]};
}
/* 店の道具：地域段階1（福岡）の購入可能品 */
const SHOP_ITEMS = Object.values(ITEMS).filter(it=>(it.acq==="S"||it.acq==="SD")&&it.tier<=1).map(it=>it.id);
const INITIAL_ITEMS = [["IT001",5],["IT033",3]];



