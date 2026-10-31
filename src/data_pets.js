/* ペットは本版で新規制作。資料にない旧版の種名・画像の再現とは扱わない。 */
const PET_GROWTH_THRESHOLDS=[0,10,20,30,40,50,60,70,80,100];
const PET_SKILL_STAGES=[1,3,5,8];
const PET_RARITY_RULES={
 1:{tickets:40,supply:1,growth:2,growthText:'標準',color:'#86aab7'},
 2:{tickets:80,supply:2,growth:3,growthText:'標準の2/3',color:'#c0d9e5'},
 3:{tickets:160,supply:3,growth:4,growthText:'標準の1/2',color:'#f0cb72'},
 4:{tickets:320,supply:5,growth:5,growthText:'標準の2/5',color:'#c2a1ed'},
 5:{tickets:640,supply:8,growth:6,growthText:'標準の1/3',color:'#ffe5a0'}
};
const PET_SPECIES={};
const PET_SKILLS={};
const PET_SUPPLIES={};
const PET_CARE_TYPES={feed:"ごはん",play:"遊ぶ",groom:"お手入れ",rest:"休憩",practice:"練習",pat:"なでる"};
const PET_ROWS=[
  ["しばいぬ","dog","#c69055",1,"しっぽの励まし","attack","見守る遠吠え","ward"],
  ["みけねこ","cat","#e6c69f",1,"肉球の応援","cheer","猫のいたずら","slow"],
  ["しろうさぎ","rabbit","#ece7df",1,"ぴょんと元気","ward","月待ちの跳躍","attack"],
  ["こざくらいんこ","bird","#88b9a0",1,"小鳥のさえずり","cheer","羽ばたきの守り","ward"],
  ["はりねずみ","hedgehog","#b9a288",2,"まるい守り","ward","ちくちくの合図","slow"],
  ["りす","squirrel","#bb744f",2,"木の実の拍手","cheer","枝渡りの応援","attack"],
  ["かわうそ","otter","#8c7056",2,"水辺の握手","ward","小石の軽やかステップ","slow"],
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
  ["こじか","deer","#b28b60",4,"森の足音","attack","若葉の追い風","ward"],
  ["ゆきひょう","cat","#d8dce4",4,"雪を踏む勇気","attack","雪夜の子守歌","slow"],
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
  PET_SPECIES[id]={id,name,shape,color,rarity,skills:skillIds,unlockCount:i===0?0:Math.min(42,(i-1)*2),adoptionTickets:i===0?0:PET_RARITY_RULES[rarity].tickets};
  for(const [kind,stem] of [["feed","ごはん"],["play","おもちゃ"],["groom","ブラシ"],["rest","おやすみ布"]]){
    for(let tier=1;tier<=3;tier++){
      const sid=`${id}-${kind}-${tier}`,label=["いつもの","ふかふかの","とっておきの"][tier-1];
      const effects={bond:1+tier,[kind==="feed"?"fullness":kind==="play"?"mood":kind==="groom"?"clean":"mood"]:12+tier*8};
      if(kind==="rest")effects.clean=4+tier*3;
      const item={id:sid,name:`${name}の${label}${stem}`,cat:"ペット用品",target:"対応するペット",eff:["pet",0],stars:tier,tier:1,acq:"S",price:[12,30,60][tier-1]*PET_RARITY_RULES[rarity].supply,sell:[6,15,30][tier-1]*PET_RARITY_RULES[rarity].supply,battleOnly:false,text:`${name}専用。${PET_CARE_TYPES[kind]}で使用。育成ポイント＋${effects.bond}（なつき度への反映はペットの★で変わります）、${effects.fullness?"満腹":kind==="groom"?"清潔":"ごきげん"}が増える。`,petSupply:true,petSpecies:id,petCare:kind,petTier:tier,petEffects:effects};
      PET_SUPPLIES[sid]=item;ITEMS[sid]=item;
    }
  }
}
const PET_WALK_PLACES={garden:{name:"ひだまりの庭",care:"feed",tier:1},plaza:{name:"にぎやかな広場",care:"play",tier:1},brook:{name:"小川のほとり",care:"groom",tier:1}};
const PET_TRAVEL_POLICIES={balanced:{name:"バランス",hp:1,mp:1},hp:{name:"HP重視",hp:2,mp:0},mp:{name:"MP重視",hp:0,mp:2}};
const PET_BADGES={B071:"ペットと共闘",B072:"小さな癒やし",B073:"頼れる補助役",B074:"二匹の力",B075:"ずっとそばに",B076:"ペットのMP補給",B077:"主人公を応援",B078:"もえを応援",B079:"息の合った攻撃",B080:"敵を足止め"};

const PET_EFFECT_TEXT={hp:'傷ついた味方1人のHPを回復',mp:'味方1人のMPを回復',attack:'味方全員の攻撃を1ターン強化',ward:'味方全員に防護',cheer:'エールを回復',slow:'敵1体の行動を1回止める',defense:'味方全員の防御を1ターン強化',speed:'味方全員のすばやさを強化し、このターンの回避率UP',weaken:'敵1体の攻撃をこのターン低下',confuse:'敵1体を混乱させ、次の行動を自分への攻撃にする',sleep:'敵1体を眠らせ、次の行動を1回止める'};
for(const [id,kind] of Object.entries({'PT02-T':'confuse','PT03-S':'speed','PT04-T':'defense','PT05-T':'weaken','PT07-T':'speed','PT09-T':'confuse','PT11-T':'weaken','PT12-S':'defense','PT14-T':'speed','PT16-T':'weaken','PT17-T':'sleep','PT18-S':'defense','PT19-T':'speed','PT20-T':'sleep','PT21-T':'defense','PT22-T':'confuse'}))PET_SKILLS[id].kind=kind;
PET_SKILLS['PT08-T'].name='狐火の声援';
const PET_ACTIVITIES={seek:{name:'宝さがし遊び',text:'鼻や目を使って、お気に入りの宝物を探そう。',gains:{bond:3,mood:5}},rhythm:{name:'リズム遊び',text:'手拍子に合わせて、一緒にステップ。',gains:{bond:3,mood:5}},cuddle:{name:'くつろぎ時間',text:'控え所でそっと寄り添い、ひと休み。',gains:{bond:2,clean:3,mood:4}}};

function petRarityFrame(id){const spec=PET_SPECIES[id]||PET_SPECIES.PT01,r=spec.rarity,color=PET_RARITY_RULES[r].color;let html='<circle cx="48" cy="48" r="44" fill="#18374a" stroke="'+color+'" stroke-width="'+(r>=3?3:2)+'"/>';
 if(r>=2)html+='<circle cx="48" cy="48" r="40" fill="none" stroke="'+color+'" stroke-opacity=".55" stroke-width="1" stroke-dasharray="'+(r===5?'1 3':'4 4')+'"/>';
 if(r>=3)for(const [x,y]of [[7,48],[89,48]])html+='<path d="M'+x+' '+(y-7)+' '+(x+4)+' '+y+' '+x+' '+(y+7)+' '+(x-4)+' '+y+'Z" fill="'+color+'" stroke="#fff3c7" stroke-width=".8"/>';
 if(r>=4)for(const [x,y]of [[17,17],[79,17],[13,73],[83,73]])html+='<path d="M'+x+' '+(y-4)+'v8m-4-4h8" stroke="'+color+'" stroke-width="1.5"/>';
 if(r===5)html+='<path d="M8 32Q0 17 18 11M88 32Q96 17 78 11M10 66Q2 84 28 88M86 66Q94 84 68 88" fill="none" stroke="'+color+'" stroke-width="2"/>';
 return html;}

function petRarityAccessory(id,stage){const r=(PET_SPECIES[id]||PET_SPECIES.PT01).rarity;if(r<3)return '';const color=PET_RARITY_RULES[r].color,y=stage>=5?73:65;return '<g data-pet-accessory="'+r+'"><path d="M34 '+(y-5)+'Q48 '+(y+2)+' 62 '+(y-5)+'L60 '+y+'Q48 '+(y+7)+' 36 '+y+'Z" fill="'+color+'" stroke="#76572f" stroke-width=".7"/><path d="M48 '+(y-1)+'l4 5-4 6-4-6Z" fill="'+(r===5?'#83d6d6':r===4?'#e1a7ec':'#e8f1d6')+'" stroke="#fff0c6" stroke-width="1"/>'+(r===5&&stage<8?'<path d="M37 19 35 9 43 14 48 5 53 14 61 9 59 19Z" fill="#f9dc84" stroke="#8b683b" stroke-width="1"/><circle cx="48" cy="13" r="2" fill="#8bd6dc"/>':'')+'</g>';}
