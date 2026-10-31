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
const OCEAN_ART_CACHE={enemies:new Map(),backgrounds:new Map(),maps:new Map(),ships:new Map(),markers:new Map()};
function oceanCached(cache,key,limit,make){if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}const value=make();cache.set(key,value);while(cache.size>limit)cache.delete(cache.keys().next().value);return value;}
function oceanCanvas(w,h){const c=document.createElement("canvas");c.width=w;c.height=h;return [c,c.getContext("2d")];}
function oceanEnemySprite(region,family,frame=0,size=32){
 if(typeof SOFT_ART!=="undefined")return SOFT_ART.creature("ocean/"+region+"/"+family,["fish","turtle","bird","otter","dragon"][family%5],OCEAN_THEMES[region].color,size,frame,false,1,region);
 region=((region%8)+8)%8;family=((family%5)+5)%5;frame=((frame%2)+2)%2;size=[32,64,128].includes(size)?size:32;
 return oceanCached(OCEAN_ART_CACHE.enemies,region+'/'+family+'/'+frame+'/'+size,96,()=>{
  const[c,g]=oceanCanvas(size,size),t=OCEAN_THEMES[region];g.scale(size/64,size/64);g.translate(0,frame*.8);
  const gradient=g.createLinearGradient(12,8,52,57);gradient.addColorStop(0,t.accent);gradient.addColorStop(.4,t.color);gradient.addColorStop(1,'#203747');
  const e=(x,y,rx,ry,color=gradient)=>{g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill();g.strokeStyle='#253c4b';g.lineWidth=.7;g.stroke();};
  const line=(points,color=t.accent,w=1)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=w;g.lineCap='round';g.stroke();};
  const fin=(points,color=gradient)=>{g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=color;g.fill();g.strokeStyle='#253c4b';g.lineWidth=.8;g.stroke();};
  if(family===0){fin([[43,30],[59,17],[57,33],[60,46],[43,39]]);fin([[22,25],[31,12],[40,25]]);e(29,33,22,15);fin([[25,39],[37,46],[31,32]],t.accent);for(let i=0;i<5;i++)line([[25+i*4,24],[22+i*4,30],[25+i*4,36]],'#ffffff35',.6);line([[18,31],[16,36],[19,39]],t.accent);}
  if(family===1){for(let i=0;i<7;i++){g.beginPath();g.moveTo(15+i*5,33);g.bezierCurveTo(5+i*6,43,23+i*3+frame*3,49,13+i*6,59-i%3*3);g.strokeStyle=i%2?t.accent:t.color;g.lineWidth=2.4-i%2*.7;g.stroke();}g.beginPath();g.moveTo(9,34);g.bezierCurveTo(7,2,56,2,55,34);g.quadraticCurveTo(48,41,40,35);g.quadraticCurveTo(32,42,25,35);g.quadraticCurveTo(17,41,9,34);g.fillStyle=gradient;g.fill();g.strokeStyle=t.accent;g.lineWidth=1;g.stroke();e(26,20,6,9,'#f7efcd45');}
  if(family===2){for(let i=0;i<3;i++){line([[20,35+i*4],[9-i*2,32+i*7],[4,38+i*6]],t.accent,2);line([[44,35+i*4],[55+i*2,32+i*7],[60,38+i*6]],t.color,2);}e(32,37,20,14);for(const x of [12,51]){line([[x+3,31],[x,23]],t.color,4);e(x,18,7,9);line([[x,10],[x+2,19]],'#213a48',1.4);}e(32,31,13,5,t.accent);line([[24,28],[23,22]],t.accent,2);line([[40,28],[41,22]],t.accent,2);}
  if(family===3){for(const [x,y,rx,ry]of [[13,26,10,5],[51,28,10,5],[18,49,8,5],[47,50,8,5]])e(x,y,rx,ry);e(33,34,20,23);e(33,33,16,19,t.color);fin([[32,18],[43,25],[43,39],[32,47],[22,39],[22,25]],t.accent);for(const y of [27,38])line([[18,y],[23,y+1],[32,y+3],[43,y+1],[49,y]],'#203d4666');e(10,17,9,7);}
  if(family===4){g.beginPath();g.moveTo(12,54);g.bezierCurveTo(54,60,45,28,32,28);g.bezierCurveTo(18,30,20,51,41,44);g.strokeStyle='#233b4c';g.lineWidth=12;g.stroke();g.strokeStyle=gradient;g.lineWidth=9;g.stroke();for(let i=0;i<6;i++)fin([[29+i*2,44-i*3],[18+i*3,42-i*3],[26+i*3,38-i*3]],t.accent);e(39,17,14,9);fin([[36,11],[37,2],[42,10]],t.accent);fin([[47,14],[59,17],[55,23],[42,24]],t.color);line([[44,23],[52,29],[59,27]],t.accent,1);}
  const ex=family===3?9:family===4?43:family===0?16:25,ey=family===3?16:family===4?16:family===0?30:family===2?24:27;
  for(const x of family===0||family===3||family===4?[ex]:[ex,ex+14]){e(x,ey,3,3.5,'#fff2d5');e(x-.2,ey+.4,1.4,2,'#243447');e(x-.7,ey-.8,.7,.7,'#ffffff');}
  for(let i=0;i<region+2;i++)e(25+i%4*4,37+Math.floor(i/4)*4,.75,.6,t.accent);
  return c;
 });
}
function oceanBattleStage(areaId,frame=0){const a=OCEAN_AREAS[areaId];return oceanCached(OCEAN_ART_CACHE.backgrounds,`${a.region}/${frame%4}`,24,()=>{
  const [c,g]=oceanCanvas(160,64),t=OCEAN_THEMES[a.region];g.fillStyle="#23364D";g.fillRect(0,0,160,22);g.fillStyle=t.color;g.fillRect(0,22,160,42);g.fillStyle="#101820";
  for(let i=0;i<4;i++)g.fillRect(12+i*43,15-i%2*4,22,10+i%2*3);
  g.fillStyle=t.accent;for(let y=26;y<48;y+=6)for(let x=0;x<160;x+=18)g.fillRect((x+frame*2+y)%160,y,8,1);
  g.fillStyle="#945B45";g.fillRect(0,49,160,15);g.fillStyle="#D4B483";for(let y=51;y<64;y+=4)g.fillRect(0,y,160,1);for(let x=0;x<160;x+=20)g.fillRect(x,50,1,14);return c;});}
function oceanMapLayer(mapId,frame=0){if(typeof WORLD_ART!=='undefined'&&WORLD_ART.ready())return WORLD_ART.mapLayer(mapId,frame);return oceanCached(OCEAN_ART_CACHE.maps,`${mapId}/${frame%4}`,4,()=>{
  const m=MAPS[mapId],theme=OCEAN_THEMES[Object.keys(OCEAN_ROUTES).indexOf(m.oceanRoute)], [c,g]=oceanCanvas(m.w*32,m.h*32);c.artScale=2;g.scale(2,2);
  for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){const t=m.tiles[y][x];g.fillStyle=t==="P"?"#D4B483":t==="."?"#5F7D4E":t==="S"?"#83B9AE":theme.color;g.fillRect(x*16,y*16,16,16);if(t==="E"||t==="S"){g.fillStyle="#F4ECD8";g.globalAlpha=.45;g.fillRect(x*16+3+(frame%2)*2,y*16+7,8,1);g.globalAlpha=1;}else if(t==="~"){g.fillStyle="#23364D";g.globalAlpha=.2;g.fillRect(x*16+4,y*16+9+(frame%2),5,1);g.globalAlpha=1;}if(t==="P"){g.fillStyle="#945B45";for(let i=3;i<16;i+=5)g.fillRect(x*16,y*16+i,16,1);}g.fillStyle="#b8e5d8";g.globalAlpha=t==="P"?0:.17;for(let k=0;k<3;k++){const yy=y*16+3+k*5,xx=x*16+((x*7+y*3+k*5+frame*2)%12);g.fillRect(xx,yy,3.5,.5);g.fillRect(xx+1,yy-.5,1,.5);}g.globalAlpha=1;}return c;});}
function oceanShipSprite(dir=0,frame=0){return oceanCached(OCEAN_ART_CACHE.ships,`${dir%4}/${frame%2}`,9,()=>{const [c,g]=oceanCanvas(32,48);c.artScale=2;g.scale(2,2);g.fillStyle="#101820";g.fillRect(1,14,14,5);g.fillStyle="#945B45";g.fillRect(2,13,12,5);g.fillStyle="#D4B483";g.fillRect(4,17,8,3);g.fillStyle="#F4ECD8";g.fillRect(5,7,7,6);g.fillStyle="#B84B4B";g.fillRect(7,4,1,11);g.fillStyle="#D5B34C";g.fillRect(dir===2?3:8,5,5,2);g.fillStyle="#83B9AE";g.fillRect(frame%2?0:1,21,14,1);g.fillStyle="#fff8df";g.fillRect(5.5,7.5,1,4);g.fillStyle="#b6b6a4";g.fillRect(10,7,1,6);g.fillStyle="#584737";for(let x=3;x<13;x+=2)g.fillRect(x,14,.5,3);g.fillStyle="#e7c98c";g.fillRect(3,14,10,.5);return c;});}
function oceanEmptySprite(){return oceanCached(OCEAN_ART_CACHE.ships,"empty",9,()=>oceanCanvas(16,24)[0]);}
function installOceanArt(){
  const landEnemy=ART.enemy,landStage=ART.stage,landMap=ART.mapLayer,landObject=ART.object;
  ART.enemy=function(profile,species,attr,area,frame,size=32,boss=false){const a=OCEAN_AREAS[area];if(a&&!boss)return oceanEnemySprite(a.region,Math.max(0,Number(String(profile).replace("OF",""))-1),frame,size);return landEnemy(profile,species,attr,area,frame,size,boss);};
  ART.stage=(area,frame)=>OCEAN_AREAS[area]?oceanBattleStage(area,frame):landStage(area,frame);
  ART.mapLayer=(map,frame)=>MAPS[map]?.combatDomain==="sea"?oceanMapLayer(map,frame):landMap(map,frame);
  ART.object=function(type,frame){if(type!=="oceanEvent")return landObject(type,frame);return oceanCached(OCEAN_ART_CACHE.markers,"event",1,()=>{const [c,g]=oceanCanvas(16,24);g.fillStyle="#F4ECD8";g.fillRect(5,7,6,15);g.fillStyle="#B84B4B";g.fillRect(4,6,8,4);g.fillStyle="#D5B34C";g.fillRect(6,3,4,4);return c;});};
}
