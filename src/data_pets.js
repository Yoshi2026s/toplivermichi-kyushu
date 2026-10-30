/* ペットは本版で新規制作。資料にない旧版の種名・画像の再現とは扱わない。 */
const PET_GROWTH_THRESHOLDS=[0,10,20,30,40,50,60,70,80,100];
const PET_SKILL_STAGES=[1,3,5,8];
const PET_SPECIES={};
const PET_SKILLS={};
const PET_SUPPLIES={};
const PET_CARE_TYPES={feed:"ごはん",play:"遊ぶ",groom:"お手入れ",rest:"休憩",practice:"練習",pat:"なでる"};
const PET_ROWS=[
  ["しばいぬ","dog","#c69055",1,"しっぽの励まし","attack","見守る遠吠え","ward"],
  ["みけねこ","cat","#e6c69f",1,"肉球の応援","cheer","猫の足どり","slow"],
  ["しろうさぎ","rabbit","#ece7df",1,"ぴょんと元気","ward","月待ちの跳躍","attack"],
  ["こざくらいんこ","bird","#88b9a0",1,"小鳥のさえずり","cheer","羽ばたきの守り","ward"],
  ["はりねずみ","hedgehog","#b9a288",2,"まるい守り","ward","ちくちくの合図","slow"],
  ["りす","squirrel","#bb744f",2,"木の実の拍手","cheer","枝渡りの応援","attack"],
  ["かわうそ","otter","#8c7056",2,"水辺の握手","ward","小石のリズム","slow"],
  ["きつね","fox","#d69350",2,"灯りのしっぽ","attack","狐火のオート移動","cheer"],
  ["たぬき","raccoon","#998579",2,"ぽんぽこ拍子","cheer","葉っぱのかくれ道","slow"],
  ["あらいぐま","raccoon","#8e9198",2,"おてての応援","attack","しましまの守り","ward"],
  ["ふくろう","owl","#c9b29a",3,"夜目の導き","attack","静かな羽音","slow"],
  ["こあら","koala","#b5b6bd",3,"木陰の守り","ward","ゆったりした声","cheer"],
  ["れっさーぱんだ","panda","#b25c49",3,"赤いしっぽの舞","attack","木の上の合図","ward"],
  ["ぺんぎん","penguin","#71869a",3,"よちよち行進","cheer","氷のステップ","slow"],
  ["あざらし","seal","#bac6cf",3,"まあるい盾","ward","ひれの拍手","cheer"],
  ["かめ","turtle","#7fa88c",3,"甲羅の守り","ward","ゆっくりの合図","slow"],
  ["ひつじ","sheep","#e8d7bc",4,"ふわふわの守り","ward","夢見の呼び声","slow"],
  ["あるぱか","alpaca","#d4bea1",4,"やわらかい声援","cheer","長い首の見守り","ward"],
  ["こじか","deer","#b28b60",4,"森の足音","attack","若葉の守り","ward"],
  ["ゆきひょう","cat","#d8dce4",4,"雪を踏む勇気","attack","白い足どり","slow"],
  ["しろおおかみ","wolf","#ccd2d9",5,"銀の遠吠え","attack","群れの守り","ward"],
  ["ほしりゅう","dragon","#a7a0cf",5,"星灯りの声援","cheer","星屑の足止め","slow"]
];
for(let i=0;i<PET_ROWS.length;i++){
  const [name,shape,color,rarity,support1,supportType1,support2,supportType2]=PET_ROWS[i];
  const id=`PT${String(i+1).padStart(2,"0")}`;
  const skillIds=[`${id}-H`,`${id}-M`,`${id}-S`,`${id}-T`];
  const labels=[`${name}のぬくもり`,`${name}のひと息`,support1,support2];
  const types=["hp","mp",supportType1,supportType2];
  skillIds.forEach((sid,j)=>PET_SKILLS[sid]={id:sid,name:labels[j],kind:types[j],stage:PET_SKILL_STAGES[j],family:j<2?"heal":"support"});
  PET_SPECIES[id]={id,name,shape,color,rarity,skills:skillIds,unlockCount:i===0?0:Math.min(42,(i-1)*2),adoptionTickets:i===0?0:30+rarity*10};
  for(const [kind,stem] of [["feed","ごはん"],["play","おもちゃ"],["groom","ブラシ"],["rest","おやすみ布"]]){
    for(let tier=1;tier<=3;tier++){
      const sid=`${id}-${kind}-${tier}`,label=["いつもの","ふかふかの","とっておきの"][tier-1];
      const effects={bond:1+tier,[kind==="feed"?"fullness":kind==="play"?"mood":kind==="groom"?"clean":"mood"]:12+tier*8};
      if(kind==="rest")effects.clean=4+tier*3;
      const item={id:sid,name:`${name}の${label}${stem}`,cat:"ペット用品",target:"対応するペット",eff:["pet",0],stars:tier,tier:1,acq:"S",price:[12,30,60][tier-1],sell:[6,15,30][tier-1],battleOnly:false,text:`${name}専用。${PET_CARE_TYPES[kind]}で使用。なつき度＋${effects.bond}、${effects.fullness?"満腹":kind==="groom"?"清潔":"ごきげん"}が増える。`,petSupply:true,petSpecies:id,petCare:kind,petTier:tier,petEffects:effects};
      PET_SUPPLIES[sid]=item;ITEMS[sid]=item;
    }
  }
}
const PET_WALK_PLACES={garden:{name:"ひだまりの庭",care:"feed",tier:1},plaza:{name:"にぎやかな広場",care:"play",tier:1},brook:{name:"小川のほとり",care:"groom",tier:1}};
const PET_TRAVEL_POLICIES={balanced:{name:"バランス",hp:1,mp:1},hp:{name:"HP重視",hp:2,mp:0},mp:{name:"MP重視",hp:0,mp:2}};
const PET_BADGES={B071:"ペットと共闘",B072:"小さな癒やし",B073:"頼れる補助役",B074:"二匹の力",B075:"ずっとそばに",B076:"ペットのMP補給",B077:"主人公を応援",B078:"もえを応援",B079:"息の合った攻撃",B080:"敵を足止め"};
