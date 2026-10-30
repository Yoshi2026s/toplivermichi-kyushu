/* 海域の計算と保存。ここでは画面・通信・自動保存を行わない。 */
function oceanAreaRecord(st,areaId){
  if(!Object.hasOwn(OCEAN_AREAS,areaId))return null;
  return st.ocean?.areas?.[areaId]||{kills:0,rescue:false,survey:false,treasure:false};
}
function validateOceanState(st){
  const s=st.ocean;if(s===undefined)return true;
  if(!s||typeof s!=="object"||s.version!==1||!s.areas||typeof s.areas!=="object"||Array.isArray(s.areas)||!Array.isArray(s.visitedRoutes)||s.visitedRoutes.some(id=>!Object.hasOwn(OCEAN_ROUTES,id)))throw Error("海域記録の形式が正しくありません。");
  for(const [id,r]of Object.entries(s.areas)){
    if(!Object.hasOwn(OCEAN_AREAS,id)||!r||!Number.isSafeInteger(r.kills)||r.kills<0||[r.rescue,r.survey,r.treasure].some(v=>typeof v!=="boolean")||r.treasure&&!r.rescue||r.survey&&r.kills<3)throw Error("海域の達成記録が正しくありません。");
  }
  return true;
}
function migrateOcean(st){validateOceanState(st);if(!st.ocean)st.ocean={version:1,areas:{},visitedRoutes:[]};return st;}
function oceanRouteAvailable(st,id){const r=OCEAN_ROUTES[id];return !!r&&st.quests?.[r.quest]==="complete";}
function currentOceanArea(st){const m=MAPS[st.mapId];return m?.combatDomain==="sea"?m.encountersByCell[`${st.pos.x},${st.pos.y}`]||null:null;}
function oceanEnemyDef(areaId,idx){
  const a=OCEAN_AREAS[areaId];if(!a||!Number.isInteger(idx)||idx<0||idx>=50)throw Error("海洋敵の指定が正しくありません。");
  const family=Math.floor(idx/10),stage=idx%10+1,theme=OCEAN_THEMES[a.region],q=a.q+Math.floor((stage-1)/4);
  const bases=[{hp:32,def:1,cycle:[["s",11],["s",8],["c",0]]},{hp:30,def:2,cycle:[["a",6],["c",0],["a",8]]},{hp:40,def:5,cycle:[["c",0],["s",16],["s",8]]},{hp:48,def:4,cycle:[["s",8],["c",0],["a",7]]},{hp:46,def:3,cycle:[["s",13],["a",7],["c",0],["s",16]]}];
  const b=bases[family],rarity=Math.min(5,1+Math.floor((stage-1)/2));
  return {id:`OCN-${areaId}-F${family+1}-S${String(stage).padStart(2,"0")}`,areaId,profile:`OF${family+1}`,family,stage,theme:a.region,
    name:`${a.name}の${OCEAN_STAGES[stage-1]}${theme.forms[family]}`,species:OCEAN_SPECIES[family],attr:"水",type:`海洋・${OCEAN_SPECIES[family]}`,baseHP:b.hp+stage*3,baseDEF:b.def+Math.floor(stage/3),cycle:b.cycle.map(([t,p])=>[t,t==="c"?0:p+Math.floor(stage/2)]),
    trait:`${theme.name}の${OCEAN_SPECIES[family]}系・第${stage}段階。航路E・海辺Sに出現する。`,counter:family===2?"甲殻は防御が高い。防御を越える技が有効。":family===1?"全体攻撃の後、休止を利用して回復しよう。":"休止を使ってMPと体力を整えよう。",rarity,weight:[250,200,125,60,20][rarity-1],q};
}
function pickOceanEnemy(areaId,r){
  if(!OCEAN_AREAS[areaId]||!Number.isFinite(r))throw Error("海域抽選値が正しくありません。");
  const weights=Array.from({length:50},(_,i)=>oceanEnemyDef(areaId,i).weight),sum=weights.reduce((a,b)=>a+b,0);
  let roll=((Math.floor(r)%10000)+10000)%10000/10000*sum;
  for(let i=0;i<50;i++){roll-=weights[i];if(roll<0)return i;}return 49;
}
function createOceanRun(st,areaId,rolls){
  const a=OCEAN_AREAS[areaId];if(!a)throw Error("海域がありません。");
  const run=baseRun(st,"field"),df=DIFFICULTY[run.difficulty];
  run.areaId=areaId;run.oceanArea=areaId;run.combatDomain="sea";run.q=a.q;run.hub=a.hub;run.returnPos={map:st.mapId,x:st.pos.x,y:st.pos.y};
  for(let slot=0;slot<(rolls.count?2:1);slot++){
    const d=oceanEnemyDef(areaId,pickOceanEnemy(areaId,rolls.picks[slot])),hp=Math.ceil((d.baseHP+12*(d.q-1))*df.hp);
    run.enemies.push({slot,id:d.id,name:d.name,fullName:d.name,profile:d.profile,species:d.species,attr:d.attr,rarity:d.rarity,maxHP:hp,hp,def:d.baseDEF+Math.floor((d.q-1)/12),oceanFamily:d.family,oceanStage:d.stage,
      cycle:d.cycle.map(([t,p])=>({t,p:t==="c"?0:Math.ceil((p+Math.floor(4*(d.q-1)/5))*df.atk)}))});
  }
  assignLabels(run.enemies);return run;
}
function recordOceanVictory(st,run,res){
  if(!OCEAN_AREAS[run.oceanArea]||run.oceanVictoryRecorded)return;
  migrateOcean(st);const id=run.oceanArea,r={...oceanAreaRecord(st,id)};
  r.kills=Math.min(Number.MAX_SAFE_INTEGER,r.kills+run.enemies.length);st.ocean.areas[id]=r;run.oceanVictoryRecorded=true;
  const route=OCEAN_AREAS[id].routeId;if(!st.ocean.visitedRoutes.includes(route))st.ocean.visitedRoutes.push(route);
  if(res?.notes)res.notes.push(`${OCEAN_AREAS[id].name}：海洋敵討伐 ${r.kills}/3体${r.kills>=3&&!r.survey?"。調査報告ができます。":"。"}`);
}
function oceanEventAvailability(st,areaId,event,context={}){
  const a=OCEAN_AREAS[areaId],r=oceanAreaRecord(st,areaId),m=MAPS[st.mapId];
  if(!a||!["rescue","survey","treasure"].includes(event))return {ok:false,reason:"海域・イベントの指定が正しくありません。"};
  if(context.readOnly||context.busy||st.run)return {ok:false,reason:"今は海上イベントを実行できません。"};
  if(m?.combatDomain!=="sea"||m.oceanRoute!==a.routeId||!oceanRouteAvailable(st,a.routeId))return {ok:false,reason:"対象の航路へ出発してください。"};
  const atArea=currentOceanArea(st)===areaId,near=Math.max(Math.abs(st.pos.x-a.marker[0]),Math.abs(st.pos.y-a.marker[1]))<=1;
  if(!atArea&&!near)return {ok:false,reason:"この海域の海面か案内標まで移動してください。"};
  if(r[event])return {ok:false,reason:"この報酬は受取済みです。"};
  if(event==="survey"&&r.kills<3)return {ok:false,reason:`この海域の海洋敵をあと${3-r.kills}体倒してください。`};
  if(event==="treasure"&&!r.rescue)return {ok:false,reason:"同じ海域で漂流者を救助すると地図が手に入ります。"};
  return {ok:true,reason:""};
}
function oceanEventToken(st,areaId,event){const r=oceanAreaRecord(st,areaId);return JSON.stringify([st.saveGeneration,st.mapId,st.pos.x,st.pos.y,areaId,event,r,st.gold,st.tickets]);}
function claimOceanEvent(st,areaId,event,context={}){
  const can=oceanEventAvailability(st,areaId,event,context);if(!can.ok)return can;
  const gold=event==="rescue"?80:event==="treasure"?120:0,tickets=event==="survey"?60:0;
  if(!Number.isSafeInteger(st.gold+gold)||!Number.isSafeInteger(st.tickets+tickets))return {ok:false,reason:"所持数の上限です。"};
  migrateOcean(st);st.ocean.areas[areaId]={...oceanAreaRecord(st,areaId),[event]:true};st.gold+=gold;st.tickets+=tickets;
  return {ok:true,gold,tickets,lines:event==="survey"?[["航海案内人",`${OCEAN_AREAS[areaId].name}の三体分の調査記録を受け取った。五系統の違いを次の船乗りに伝えよう。`]]:[["",OCEAN_AREAS[areaId][event==="rescue"?"rescueStory":"treasureStory"]]]};
}

/* 専用ドット画像。海洋敵96件・海戦背景24件までのLRU。 */
const OCEAN_ART_CACHE={enemies:new Map(),backgrounds:new Map(),maps:new Map(),ships:new Map()};
function oceanCached(cache,key,limit,make){if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}const value=make();cache.set(key,value);while(cache.size>limit)cache.delete(cache.keys().next().value);return value;}
function oceanCanvas(w,h){const c=document.createElement("canvas");c.width=w;c.height=h;return [c,c.getContext("2d")];}
function oceanEnemySprite(region,family,frame=0,size=32){
  region=((region%8)+8)%8;family=((family%5)+5)%5;frame=((frame%2)+2)%2;size=[32,64,128].includes(size)?size:32;
  return oceanCached(OCEAN_ART_CACHE.enemies,`${region}/${family}/${frame}/${size}`,96,()=>{
    const [c,g]=oceanCanvas(size,size),s=size/32,t=OCEAN_THEMES[region],b=frame;
    const p=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(Math.round(x*s),Math.round((y+b)*s),Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s)));};
    if(family===0){p(7,10,16,12,t.color);p(4,13,5,6,t.accent);p(22,8,3,3,t.accent);p(24,6,4,6,t.color);p(24,20,4,5,t.color);p(22,18,4,4,t.accent);}
    if(family===1){p(8,7,16,13,t.color);p(11,4,10,4,t.accent);p(5,11,22,7,t.color);for(let i=0;i<5;i++)p(7+i*4,19,2,7+(i%2?b:2),i%2?t.accent:t.color);p(8,17,16,2,t.accent);}
    if(family===2){p(8,12,16,12,t.color);p(11,9,10,4,t.accent);for(let i=0;i<3;i++){p(3,15+i*4,6,2,t.accent);p(23,15+i*4,6,2,t.accent);}p(3,8,4,7,t.color);p(25,8,4,7,t.color);p(1,6,4,3,t.accent);p(27,6,4,3,t.accent);}
    if(family===3){p(7,8,18,17,t.color);p(10,6,12,3,t.accent);p(12,10,8,12,t.accent);p(3,13,5,5,t.color);p(25,14,5,5,t.color);p(8,24,5,4,t.color);p(22,23,5,4,t.color);p(4,7,6,6,t.accent);}
    if(family===4){p(11,7,11,13,t.color);p(16,2,12,9,t.color);p(21,0,3,4,t.accent);p(26,6,4,3,t.accent);p(8,18,13,5,t.color);p(3,22,13,5,t.color);p(1,26,6,3,t.accent);p(9,7,4,10,t.accent);p(14,12,4,4,t.accent);}
    const ex=family===3?5:family===4?23:11,ey=family===3?9:family===4?5:13;p(ex,ey,3,3,"#F4ECD8");p(ex,ey+1,1,2,"#101820");if(family!==0&&family!==3&&family!==4){p(19,ey,3,3,"#F4ECD8");p(21,ey+1,1,2,"#101820");}
    for(let k=0;k<region+1;k++)p(10+(k%4)*3,17+Math.floor(k/4)*3,1,1,t.accent);
    const image=g.getImageData(0,0,size,size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4;if(!image.data[i+3])continue;const shade=1.2-.45*y/size-.12*x/size;for(let k=0;k<3;k++)image.data[i+k]=Math.min(255,image.data[i+k]*shade);if(image.data[i+3]&&x>0&&!image.data[i-1])for(let k=0;k<3;k++)image.data[i+k]*=.65;}g.putImageData(image,0,0);
    g.strokeStyle=t.accent;g.lineWidth=Math.max(1,size/64);if(family===3){for(let i=0;i<3;i++){g.beginPath();g.ellipse(size*.5,size*.51,(.12+i*.07)*size,.23*size,0,0,Math.PI*2);g.stroke();}}else{g.globalAlpha=.45;for(let k=0;k<6;k++){g.beginPath();g.ellipse((.33+k%3*.14)*size,(.36+Math.floor(k/3)*.15)*size,size*.025,size*.015,0,0,Math.PI*2);g.stroke();}g.globalAlpha=1;}
    return c;
  });
}
function oceanBattleStage(areaId,frame=0){const a=OCEAN_AREAS[areaId];return oceanCached(OCEAN_ART_CACHE.backgrounds,`${a.region}/${frame%4}`,24,()=>{
  const [c,g]=oceanCanvas(160,64),t=OCEAN_THEMES[a.region];g.fillStyle="#23364D";g.fillRect(0,0,160,22);g.fillStyle=t.color;g.fillRect(0,22,160,42);g.fillStyle="#101820";
  for(let i=0;i<4;i++)g.fillRect(12+i*43,15-i%2*4,22,10+i%2*3);
  g.fillStyle=t.accent;for(let y=26;y<48;y+=6)for(let x=0;x<160;x+=18)g.fillRect((x+frame*2+y)%160,y,8,1);
  g.fillStyle="#945B45";g.fillRect(0,49,160,15);g.fillStyle="#D4B483";for(let y=51;y<64;y+=4)g.fillRect(0,y,160,1);for(let x=0;x<160;x+=20)g.fillRect(x,50,1,14);return c;});}
function oceanMapLayer(mapId,frame=0){return oceanCached(OCEAN_ART_CACHE.maps,`${mapId}/${frame%4}`,4,()=>{
  const m=MAPS[mapId],theme=OCEAN_THEMES[Object.keys(OCEAN_ROUTES).indexOf(m.oceanRoute)], [c,g]=oceanCanvas(m.w*32,m.h*32);c.artScale=2;g.scale(2,2);
  for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){const t=m.tiles[y][x];g.fillStyle=t==="P"?"#D4B483":t==="."?"#5F7D4E":t==="S"?"#83B9AE":theme.color;g.fillRect(x*16,y*16,16,16);if(t==="E"||t==="S"){g.fillStyle="#F4ECD8";g.globalAlpha=.45;g.fillRect(x*16+3+(frame%2)*2,y*16+7,8,1);g.globalAlpha=1;}else if(t==="~"){g.fillStyle="#23364D";g.globalAlpha=.2;g.fillRect(x*16+4,y*16+9+(frame%2),5,1);g.globalAlpha=1;}if(t==="P"){g.fillStyle="#945B45";for(let i=3;i<16;i+=5)g.fillRect(x*16,y*16+i,16,1);}g.fillStyle="#b8e5d8";g.globalAlpha=t==="P"?0:.17;for(let k=0;k<3;k++){const yy=y*16+3+k*5,xx=x*16+((x*7+y*3+k*5+frame*2)%12);g.fillRect(xx,yy,3.5,.5);g.fillRect(xx+1,yy-.5,1,.5);}g.globalAlpha=1;}return c;});}
function oceanShipSprite(dir=0,frame=0){return oceanCached(OCEAN_ART_CACHE.ships,`${dir%4}/${frame%2}`,9,()=>{const [c,g]=oceanCanvas(32,48);c.artScale=2;g.scale(2,2);g.fillStyle="#101820";g.fillRect(1,14,14,5);g.fillStyle="#945B45";g.fillRect(2,13,12,5);g.fillStyle="#D4B483";g.fillRect(4,17,8,3);g.fillStyle="#F4ECD8";g.fillRect(5,7,7,6);g.fillStyle="#B84B4B";g.fillRect(7,4,1,11);g.fillStyle="#D5B34C";g.fillRect(dir===2?3:8,5,5,2);g.fillStyle="#83B9AE";g.fillRect(frame%2?0:1,21,14,1);g.fillStyle="#fff8df";g.fillRect(5.5,7.5,1,4);g.fillStyle="#b6b6a4";g.fillRect(10,7,1,6);g.fillStyle="#584737";for(let x=3;x<13;x+=2)g.fillRect(x,14,.5,3);g.fillStyle="#e7c98c";g.fillRect(3,14,10,.5);return c;});}
function oceanEmptySprite(){return oceanCached(OCEAN_ART_CACHE.ships,"empty",9,()=>oceanCanvas(16,24)[0]);}
function installOceanArt(){
  const landEnemy=ART.enemy,landStage=ART.stage,landMap=ART.mapLayer,landObject=ART.object;
  ART.enemy=function(profile,species,attr,area,frame,size=32,boss=false){const a=OCEAN_AREAS[area];if(a&&!boss)return oceanEnemySprite(a.region,Math.max(0,Number(String(profile).replace("OF",""))-1),frame,size);return landEnemy(profile,species,attr,area,frame,size,boss);};
  ART.stage=(area,frame)=>OCEAN_AREAS[area]?oceanBattleStage(area,frame):landStage(area,frame);
  ART.mapLayer=(map,frame)=>MAPS[map]?.combatDomain==="sea"?oceanMapLayer(map,frame):landMap(map,frame);
  ART.object=function(type,frame){if(type!=="oceanEvent")return landObject(type,frame);const [c,g]=oceanCanvas(16,24);g.fillStyle="#F4ECD8";g.fillRect(5,7,6,15);g.fillStyle="#B84B4B";g.fillRect(4,6,8,4);g.fillStyle="#D5B34C";g.fillRect(6,3,4,4);return c;};
}
