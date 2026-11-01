/* One continuous outdoor surface. Legacy regional maps remain the save fallback and scenery source. */
const WORLD_ID='JP-WORLD';
const WORLD={w:1020,h:1080,regions:[],byHub:new Map(),byField:new Map(),objects:new Map(),roads:new Map(),links:[],access:new Uint8Array(1020*1080),allowed:new Set(),state:null,stamp:''};
const WORLD_GRID={1:[12,0],2:[10,2],3:[11,3],4:[11,4],5:[9,3],6:[9,4],7:[10,5],8:[11,6],9:[10,6],10:[9,6],11:[9,7],12:[11,7],13:[10,7],14:[9,8],15:[8,5],16:[7,6],17:[6,6],18:[5,7],19:[8,8],20:[8,7],21:[7,8],22:[8,9],23:[7,9],24:[6,10],25:[6,8],26:[5,8],27:[5,9],28:[4,8],29:[6,9],30:[5,10],31:[3,7],32:[2,7],33:[3,8],34:[2,8],35:[1,8],36:[4,10],37:[3,9],38:[2,9],39:[3,10],44:[1,10],45:[1,11],46:[0,12],47:[-2,15]};
const WORLD_KY={KY01:[0,9],KY02:[1,9],KY03:[-1,9],KY04:[-1,10],KY05:[-2,10],KY06:[-2,11],KY07:[0,11],KY08:[0,10]};
const WORLD_OLD_ROUTES=NATIONAL_ROUTES.map(r=>({...r}));
const WORLD_TILES=Array.from({length:WORLD.h},()=>Array(WORLD.w).fill('~'));
const WORLD_OWNER=new Uint8Array(WORLD.w*WORLD.h);
for(const [hub,pair]of Object.entries(NATIONAL_MAP_PAIRS)){
 const old=MAPS[pair.field],grid=WORLD_KY[hub]||WORLD_GRID[Number(pair.prefId.slice(2))],x=(grid[0]+3)*60,y=(grid[1]+1)*60;
 const r={hub,field:pair.field,x,y,w:old.w,h:old.h,index:WORLD.regions.length+1,old};WORLD.regions.push(r);WORLD.byHub.set(hub,r);WORLD.byField.set(pair.field,r);
 for(let yy=0;yy<old.h;yy++)for(let xx=0;xx<old.w;xx++){WORLD_TILES[y+yy][x+xx]=old.tiles[yy][xx];WORLD_OWNER[(y+yy)*WORLD.w+x+xx]=r.index;}
}
function worldPoint(hub,point){const r=WORLD.byHub.get(hub);return {x:r.x+point[0],y:r.y+point[1]};}
function worldPut(o){const key=o.y*WORLD.w+o.x;if(WORLD.objects.has(key))throw Error('World object overlap: '+o.id);WORLD.objects.set(key,o);return o;}
for(const r of WORLD.regions)for(const o of r.old.objects){if(o.fieldRoute)continue;worldPut({...o,x:o.x+r.x,y:o.y+r.y,regionHub:r.hub});}
function worldIsland(hub){if(hub.startsWith('KY')||['NW44','NW45','NW46'].includes(hub))return 'kyushu';if(hub==='NW47')return 'okinawa';if(hub==='NW01')return 'hokkaido';if(['NW36','NW37','NW38','NW39'].includes(hub))return 'shikoku';return 'honshu';}
function worldSeaRoute(r){return worldIsland(r.from)!==worldIsland(r.to)||[r.from,r.to].sort().join('/')==='KY06/KY07';}
function worldRoad(from,to){
 const a=WORLD.byHub.get(from),b=WORLD.byHub.get(to),p=worldPoint(from,a.old.safeAnchor),q=worldPoint(to,b.old.safeAnchor),points=[];
 let x=p.x,y=p.y;const line=(tx,ty)=>{while(x!==tx||y!==ty){points.push([x,y]);if(x!==tx)x+=Math.sign(tx-x);else y+=Math.sign(ty-y);}};
 line(a.x+55,p.y);line(a.x+55,a.y+48);line(b.x+55,a.y+48);line(b.x+55,b.y+48);line(b.x+55,q.y);line(q.x,q.y);points.push([x,y]);
 points.forEach(([x,y],i)=>{const owner=i<points.length/2?a.index:b.index;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const xx=x+dx,yy=y+dy;if(xx<1||yy<1||xx>=WORLD.w-1||yy>=WORLD.h-1)continue;const key=yy*WORLD.w+xx;if(WORLD_OWNER[key]&&WORLD_OWNER[key]!==owner)continue;const set=WORLD.roads.get(key)||new Set();set.add(owner);WORLD.roads.set(key,set);if(!WORLD_OWNER[key]||Math.abs(dx)+Math.abs(dy)<=1)WORLD_TILES[yy][xx]=Math.abs(dx)+Math.abs(dy)<=1?'w':'.';}});
 WORLD.links.push({from,to,sea:false,points});
}
for(const route of WORLD_OLD_ROUTES){route.sea=worldSeaRoute(route);if(!route.sea)worldRoad(route.from,route.to);else WORLD.links.push({...route,sea:true});}
// A walkable bridge links Kyushu and Honshu only after both regions are unlocked.
worldRoad('KY02','NW35');
for(let i=0;i<WORLD.regions.length;i++)for(const b of WORLD.regions.slice(i+1)){const a=WORLD.regions[i];if(worldIsland(a.hub)!==worldIsland(b.hub)||Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==60||WORLD.links.some(l=>!l.sea&&[l.from,l.to].includes(a.hub)&&[l.from,l.to].includes(b.hub)))continue;worldRoad(a.hub,b.hub);NATIONAL_ROUTES.push({id:'WORLD-'+a.hub+'-'+b.hub,from:a.hub,to:b.hub,mode:'walk',status:'playable',unlock:'always',worldLink:true});}
const WORLD_BRIDGE={id:'WORLD-KANMON',from:'KY02',to:'NW35',mode:'bridge',status:'playable',unlock:'always',worldLink:true};NATIONAL_ROUTES.push(WORLD_BRIDGE);
for(const r of WORLD.regions){
 const routes=WORLD.links.filter(l=>l.sea&&(l.from===r.hub||l.to===r.hub));if(!routes.length)continue;
 const p=worldPoint(r.hub,r.old.safeAnchor),x=r.x+r.w+2,y=p.y;
 for(let xx=p.x;xx<=x;xx++){WORLD_TILES[y][xx]='w';const key=y*WORLD.w+xx,set=WORLD.roads.get(key)||new Set();set.add(r.index);WORLD.roads.set(key,set);}
 WORLD_TILES[y][x]='=';r.port=worldPut({id:'port_'+r.hub,type:'worldPort',label:HUBS[r.hub].name+'の港（船で移動）',x,y,walk:false,regionHub:r.hub,routes});
}
function worldRegionAt(pos){const index=WORLD_OWNER[pos.y*WORLD.w+pos.x];if(index)return WORLD.regions[index-1];const candidates=WORLD.roads.get(pos.y*WORLD.w+pos.x);let best=null,d=Infinity;for(const r of WORLD.regions){if(candidates&&!candidates.has(r.index))continue;const n=Math.abs(pos.x-r.x-r.w/2)+Math.abs(pos.y-r.y-r.h/2);if(n<d){best=r;d=n;}}return best||WORLD.regions[0];}
const worldBaseRouteAvailable=nationalRouteAvailable;
function worldRefreshAccess(st,force=false){
 if(!st)return;const stamp=[!!st.fukuokaClear,...Object.keys(st.quests||{}).filter(id=>st.quests[id]==='complete'),...(st.visitedHubs||[])].join('|');if(!force&&WORLD.state===st&&WORLD.stamp===stamp)return;
 WORLD.state=st;WORLD.stamp=stamp;const hubs=new Set(['KY01',...(st.visitedHubs||[])]),queue=[...hubs];
 for(let i=0;i<queue.length;i++)for(const r of WORLD_OLD_ROUTES){if(r.from!==queue[i]&&r.to!==queue[i])continue;const next=r.from===queue[i]?r.to:r.from;if(!hubs.has(next)&&worldBaseRouteAvailable(st,queue[i],next)){hubs.add(next);queue.push(next);}}
 WORLD.allowed=hubs;WORLD.access.fill(0);for(const r of WORLD.regions)if(hubs.has(r.hub))for(let y=r.y;y<r.y+r.h;y++)WORLD.access.fill(1,y*WORLD.w+r.x,y*WORLD.w+r.x+r.w);
 for(const [key,owners]of WORLD.roads)if(!WORLD_OWNER[key]&&[...owners].some(i=>hubs.has(WORLD.regions[i-1].hub)))WORLD.access[key]=1;
}
function worldHubUnlocked(st,hub){worldRefreshAccess(st);return WORLD.allowed.has(hub);}
nationalRouteAvailable=function(st,from,to){if(NATIONAL_ROUTES.some(r=>r.worldLink&&((r.from===from&&r.to===to)||(r.from===to&&r.to===from))))return worldHubUnlocked(st,from)&&worldHubUnlocked(st,to);return worldBaseRouteAvailable(st,from,to);};
MAPS[WORLD_ID]={kind:'field',continuousWorld:true,w:WORLD.w,h:WORLD.h,tiles:WORLD_TILES,objects:[...WORLD.objects.values()],zones:{},safeAnchor:Object.values(worldPoint('KY01',MAPS['KY01-field'].safeAnchor)),layoutVersion:MAP_LAYOUT_VERSION};
Object.defineProperties(MAPS[WORLD_ID],{hub:{get:()=>G.st?.mapId===WORLD_ID?worldRegionAt(G.st.pos).hub:'KY01'},terrain:{get:()=>WORLD.byHub.get(MAPS[WORLD_ID].hub).old.terrain},name:{get:()=>HUBS[MAPS[WORLD_ID].hub].name+'周辺・全国街外'}});
for(const m of Object.values(MAPS))if(m.kind==='town')for(const o of m.objects){const r=WORLD.byField.get(o.to);if(r){o.to=WORLD_ID;o.tx+=r.x;o.ty+=r.y;}}
function worldFallback(point){let r=worldRegionAt(point);if(!WORLD.allowed.has(r.hub)){r=WORLD.regions.filter(r=>WORLD.allowed.has(r.hub)).sort((a,b)=>(Math.abs(point.x-a.x)+Math.abs(point.y-a.y))-(Math.abs(point.x-b.x)+Math.abs(point.y-b.y)))[0]||WORLD.regions[0];}const x=point.x-r.x,y=point.y-r.y,valid=x>=0&&y>=0&&x<r.w&&y<r.h&&'.,123w='.includes(r.old.tiles[y][x])&&!r.old.objects.some(o=>o.x===x&&o.y===y&&!o.walk);return {map:r.field,...(valid?{x,y}:{x:r.old.safeAnchor[0],y:r.old.safeAnchor[1]})};}
function encodeWorldSave(st){
 if(st.mapId!==WORLD_ID&&st.run?.returnPos?.map!==WORLD_ID&&!st.worldPosition&&!(st.visitedMaps||[]).includes(WORLD_ID))return st;const saved=clone(st);delete saved.worldPosition;saved.visitedMaps=(saved.visitedMaps||[]).filter(id=>id!==WORLD_ID);
 if(st.mapId===WORLD_ID){const fallback=worldFallback(st.pos);saved.worldPosition={version:1,...st.pos,fallback};saved.mapId=fallback.map;saved.pos={x:fallback.x,y:fallback.y};}
 if(st.run?.returnPos?.map===WORLD_ID){const p=st.run.returnPos,fallback=worldFallback(p);saved.run.worldReturn={version:1,x:p.x,y:p.y,fallback};saved.run.returnPos=fallback;}
 return saved;
}
function worldRestorePoint(saved,map,pos){return saved?.version===1&&saved.fallback?.map===map&&saved.fallback.x===pos.x&&saved.fallback.y===pos.y&&Number.isInteger(saved.x)&&Number.isInteger(saved.y)&&saved.x>=0&&saved.y>=0&&saved.x<WORLD.w&&saved.y<WORLD.h&&'.,123w='.includes(WORLD_TILES[saved.y][saved.x])?{x:saved.x,y:saved.y}:null;}
// Compare positions in the same coordinate system when explaining save recovery.
function restoreReferencePosition(st){const exact=worldRestorePoint(st.worldPosition,st.mapId,st.pos||{});if(exact)return exact;const r=WORLD.byField.get(st.mapId);return st.pos?{x:st.pos.x+(r?.x||0),y:st.pos.y+(r?.y||0)}:null;}
const worldBaseMigrate=migrate;
migrate=function(st){const point=worldRestorePoint(st.worldPosition,st.mapId,st.pos||{}),back=worldRestorePoint(st.run?.worldReturn,st.run?.returnPos?.map,st.run?.returnPos||{});if(Array.isArray(st.visitedMaps))st.visitedMaps=st.visitedMaps.filter(id=>id!==WORLD_ID);worldBaseMigrate(st);worldRefreshAccess(st,true);delete st.worldPosition;
 const r=WORLD.byField.get(st.mapId);if(point||r){st.pos=point||{x:st.pos.x+r.x,y:st.pos.y+r.y};st.mapId=WORLD_ID;const hub=worldRegionAt(st.pos).hub;if(WORLD.allowed.has(hub)&&!st.visitedHubs.includes(hub))st.visitedHubs.push(hub);}
 if(st.run){const r=WORLD.byField.get(st.run.returnPos?.map);if(back||r){st.run.returnPos={map:WORLD_ID,...(back||{x:st.run.returnPos.x+r.x,y:st.run.returnPos.y+r.y})};}delete st.run.worldReturn;}
 worldRefreshAccess(st,true);return st;
};
const worldBaseWalkable=walkable,worldBaseObject=objAt,worldBaseZone=zoneAt;
objAt=function(m,x,y){return m.continuousWorld?WORLD.objects.get(y*m.w+x):worldBaseObject(m,x,y);};
walkable=function(m,x,y){if(!m.continuousWorld)return worldBaseWalkable(m,x,y);if(x<0||y<0||x>=m.w||y>=m.h||!WORLD.access[y*m.w+x])return false;return worldBaseWalkable(m,x,y);};
zoneAt=function(m,x,y){if(!m.continuousWorld)return worldBaseZone(m,x,y);const index=WORLD_OWNER[y*m.w+x];if(!index||objAt(m,x,y))return null;const r=WORLD.regions[index-1];return worldBaseZone(r.old,x-r.x,y-r.y);};
const worldBaseTravel=travelMap;
travelMap=function(to,x,y,save=true){const r=WORLD.byField.get(to);if(r){to=WORLD_ID;x+=r.x;y+=r.y;}worldRefreshAccess(G.st);return worldBaseTravel(to,x,y,save);};
const worldBaseRender=render,worldBaseArrive=arrive,worldBaseWalk=walkTo;
render=function(){if(G.st)worldRefreshAccess(G.st);if(G.st?.mapId!==WORLD_ID)G.worldMusicHub=null;return worldBaseRender();};
walkTo=function(x,y,pending){if(G.st?.mapId===WORLD_ID){worldRefreshAccess(G.st);if(!WORLD.access[y*WORLD.w+x])return toast('このエリアは未解放です。やることで次の目標を確認してください。');}return worldBaseWalk(x,y,pending);};
arrive=function(){if(!G.st||G.readOnly||G.sheet||G.dlg||G.lock||document.hidden||G.screen!=='explore'||G.st.run)return worldBaseArrive();if(G.st?.mapId===WORLD_ID){const st=G.st,r=worldRegionAt(st.pos);if(G.worldMusicHub!==r.hub){G.worldMusicHub=r.hub;exploreBgm();const exit=worldTownExit(st),button=document.querySelector('.map-exit');if(button&&exit){button.dataset.v=exit.id;button.setAttribute('aria-label',HUBS[r.hub].name+'の街へ戻る');}G.cv?.setAttribute?.('aria-label',MAPS[WORLD_ID].name+'の地図。地面をタップすると移動します。');}if(WORLD.allowed.has(r.hub)&&!st.visitedHubs.includes(r.hub)){st.visitedHubs.push(r.hub);const j=JOIN_PLAN.find(j=>j.hub===r.hub);if(j){joinMember(st,j.cid);const strip=document.querySelector('.pstrip');if(strip)strip.outerHTML=partyStrip();}worldRefreshAccess(st,true);}const place=document.querySelector('.xhead .place');if(place)place.textContent=MAPS[WORLD_ID].name;}return worldBaseArrive();};
function worldTownExit(st=G.st){return MAPS[st.mapId].objects.find(o=>o.fieldExit&&(!o.regionHub||o.regionHub===worldRegionAt(st.pos).hub));}
function drawWorldTerrain(g,m,cam,vw,vh){
 const x0=Math.max(0,Math.floor(cam.x/16)),y0=Math.max(0,Math.floor(cam.y/16)),x1=Math.min(m.w,Math.ceil((cam.x+vw)/16)),y1=Math.min(m.h,Math.ceil((cam.y+vh)/16));
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(!WORLD_OWNER[y*m.w+x])g.drawImage(ART.tile(m.tiles[y][x],0),x*16-cam.x,y*16-cam.y,16,16);
 for(const r of WORLD.regions){if(r.x>=x1||r.y>=y1||r.x+r.w<=x0||r.y+r.h<=y0)continue;const layer=ART.mapLayer(r.field,0),scale=layer.artScale||1,xx=Math.max(x0,r.x),yy=Math.max(y0,r.y),ww=Math.min(x1,r.x+r.w)-xx,hh=Math.min(y1,r.y+r.h)-yy;g.drawImage(layer,(xx-r.x)*16*scale,(yy-r.y)*16*scale,ww*16*scale,hh*16*scale,xx*16-cam.x,yy*16-cam.y,ww*16,hh*16);
  for(let y=yy;y<yy+hh;y++)for(let x=xx;x<xx+ww;x++)if(m.tiles[y][x]!==r.old.tiles[y-r.y][x-r.x])g.drawImage(ART.tile(m.tiles[y][x],0),x*16-cam.x,y*16-cam.y,16,16);
 }
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(m.tiles[y][x]!=='~'&&!WORLD.access[y*m.w+x]){g.fillStyle='#51436499';g.fillRect(x*16-cam.x,y*16-cam.y,16,16);g.strokeStyle='#c3b0cd88';g.strokeRect(x*16-cam.x+.5,y*16-cam.y+.5,15,15);}
}
const worldBaseMini=drawMiniMap;
drawMiniMap=function(m,cam){
 if(!m.continuousWorld)return worldBaseMini(m,cam);const c=document.getElementById('minimap');if(!c)return;c.classList.add('world-mini');if(c.width!==204)c.width=204;if(c.height!==216)c.height=216;const g=c.getContext('2d'),s=.2;
 if(WORLD.miniCache?.stamp!==WORLD.stamp){const layer=document.createElement('canvas');layer.width=204;layer.height=216;const g=layer.getContext('2d');g.fillStyle='#29465b';g.fillRect(0,0,204,216);g.lineWidth=2;for(const l of WORLD.links){g.strokeStyle=l.sea?'#b4cbd155':'#8da478';g.setLineDash(l.sea?[2,3]:[]);g.beginPath();const a=WORLD.byHub.get(l.from),b=WORLD.byHub.get(l.to);g.moveTo((a.x+a.w/2)*s,(a.y+a.h/2)*s);g.lineTo((b.x+b.w/2)*s,(b.y+b.h/2)*s);g.stroke();}g.setLineDash([]);for(const r of WORLD.regions){g.fillStyle=WORLD.allowed.has(r.hub)?'#c4d39a':'#81738c';g.fillRect(r.x*s,r.y*s,r.w*s,r.h*s);}WORLD.miniCache={stamp:WORLD.stamp,layer};}
 g.drawImage(WORLD.miniCache.layer,0,0);g.strokeStyle='#fff';g.strokeRect(cam.x/16*s,cam.y/16*s,Math.max(3,G.vw*s),Math.max(3,G.vh*s));g.fillStyle='#ffe6a0';g.beginPath();g.arc((G.st.pos.x+.5)*s,(G.st.pos.y+.5)*s,2.5,0,Math.PI*2);g.fill();
};
const worldBaseInteract=interact;
interact=function(o){if(o?.type!=='worldPort')return worldBaseInteract(o);if(G.st?.mapId!==WORLD_ID||!WORLD.objects.has(o.y*WORLD.w+o.x)||Math.max(Math.abs(G.st.pos.x-o.x),Math.abs(G.st.pos.y-o.y))>1||G.readOnly)return;openSheet('worldFerry',{port:o.id});};
const worldBaseSheet=renderSheet;
renderSheet=function(){if(G.sheet!=='worldFerry')return worldBaseSheet();const port=MAPS[WORLD_ID].objects.find(o=>o.id===G.sheetData.port);if(!port)return sheetWrap('港','<p>港に近づいてください。</p>');return sheetWrap('港から船で移動',`<p>${esc(port.label)}。海上区間は徒歩では渡れません。</p><div class="stack">${port.routes.map(r=>{const to=r.from===port.regionHub?r.to:r.from,ok=nationalRouteAvailable(G.st,port.regionHub,to)&&worldHubUnlocked(G.st,to);return `<button class="btn" data-a="worldSail" data-port="${port.id}" data-to="${to}" ${ok&&!G.readOnly?'':'disabled'}>船で${esc(HUBS[to].name)}へ（無料）${ok?'':'・未解放'}</button>`;}).join('')}</div>`);};
ACT.worldSail=function(el){const st=G.st,port=MAPS[WORLD_ID].objects.find(o=>o.id===el.dataset.port),to=el.dataset.to,route=port?.routes.find(r=>(r.from===port.regionHub?r.to:r.from)===to),dest=WORLD.byHub.get(to)?.port;if(G.sheet!=='worldFerry'||G.sheetData.port!==port?.id||st.mapId!==WORLD_ID||G.readOnly||st.run||G.dlg||!route||!dest||Math.max(Math.abs(st.pos.x-port.x),Math.abs(st.pos.y-port.y))>1||!nationalRouteAvailable(st,port.regionHub,to)||!worldHubUnlocked(st,to))return;G.walkPlan=null;G.sheetHistory=[];travelHub(to,dest.x-1,dest.y,WORLD_ID);SND.sfx('seaWave');toast(HUBS[to].name+'の港へ船で到着しました。');};

// Point searches use A*; the global distance field is calculated only when a guide is opened.
const worldBaseBfs=bfs,worldBaseDistances=navigationDistances;
function worldPointPath(m,sx,sy,goal,target){
 const start=sy*m.w+sx,cost=new Map([[start,0]]),prev=new Map(),heap=[];
 const push=n=>{heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;};
 const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;};
 const heuristic=(x,y)=>Math.max(0,Math.abs(x-target.x)+Math.abs(y-target.y)-(target.adjacent?1:0));push({key:start,g:0,f:heuristic(sx,sy)});
 while(heap.length){const n=pop();if(n.g!==cost.get(n.key))continue;const x=n.key%m.w,y=Math.floor(n.key/m.w);if(n.key!==start&&goal(x,y)){const path=[];let k=n.key;while(k!==start){path.push({x:k%m.w,y:Math.floor(k/m.w)});k=prev.get(k);}return path.reverse();}
  for(const [dx,dy]of [[0,1],[0,-1],[1,0],[-1,0]]){const xx=x+dx,yy=y+dy;if(!walkable(m,xx,yy))continue;const k=yy*m.w+xx,o=objAt(m,xx,yy);if(o?.walk&&o.to&&!goal(xx,yy))continue;const g=n.g+1;if(g>=(cost.get(k)??Infinity))continue;cost.set(k,g);prev.set(k,n.key);push({key:k,g,f:g+heuristic(xx,yy)});}
 }return null;
}
bfs=function(m,x,y,goal,avoid){return m.continuousWorld&&WORLD.searchTarget?worldPointPath(m,x,y,goal,WORLD.searchTarget):worldBaseBfs(m,x,y,goal,avoid);};
navigationDistances=function(m,pos=G.st.pos){if(!m.continuousWorld)return worldBaseDistances(m,pos);worldRefreshAccess(G.st);const key=[pos.x,pos.y,WORLD.stamp].join('/');if(WORLD.distanceCache?.key===key)return WORLD.distanceCache.value;const value=worldBaseDistances(m,pos);WORLD.distanceCache={key,value};return value;};
const worldPointWalk=walkTo;
walkTo=function(x,y,pending){if(G.st?.mapId!==WORLD_ID)return worldPointWalk(x,y,pending);const o=objAt(MAPS[WORLD_ID],x,y);WORLD.searchTarget={x,y,adjacent:!!o&&!o.walk};try{return worldPointWalk(x,y,pending);}finally{WORLD.searchTarget=null;}};
function worldTravelTarget(hub){
 const st=G.st;if(!worldHubUnlocked(st,hub))return null;const itinerary=nationalItinerary(st,curHub(),hub);if(!itinerary)return null;
 let target;for(let i=1;i<itinerary.length;i++){const route=WORLD_OLD_ROUTES.find(r=>[r.from,r.to].includes(itinerary[i-1])&&[r.from,r.to].includes(itinerary[i]));if(route?.sea){target=WORLD.byHub.get(itinerary[i-1]).port;break;}}
 target=target||MAPS[WORLD_ID].objects.find(o=>o.regionHub===hub&&o.fieldExit);if(!target)return null;const steps=navigationDistance(MAPS[WORLD_ID],target,navigationDistances(MAPS[WORLD_ID]));return Number.isFinite(steps)?{...target,steps}:null;
}
const worldBaseQuestTarget=navigationQuestTarget;
navigationQuestTarget=function(id){
 if(G.st?.mapId!==WORLD_ID)return worldBaseQuestTarget(id);const st=G.st,q=QUESTS[id],status=st.quests[id];if(!q||['locked','complete'].includes(status))return null;
 if(q.hub!==curHub()||status==='available')return worldTravelTarget(q.hub);
 if(status==='bossReady'){const o=MAPS[WORLD_ID].objects.find(o=>o.boss===q.boss);if(!o)return null;const steps=navigationDistance(MAPS[WORLD_ID],o,navigationDistances(MAPS[WORLD_ID]));return Number.isFinite(steps)?{...o,steps}:null;}
 const r=WORLD.byHub.get(q.hub),distances=navigationDistances(MAPS[WORLD_ID]);let best=null;
 for(let y=1;y<r.h-1;y++)for(let x=1;x<r.w-1;x++){if(!r.old.zones[r.old.tiles[y][x]])continue;const xx=x+r.x,yy=y+r.y,steps=distances.get(yy*WORLD.w+xx);if(steps>0&&Number.isFinite(steps)&&!objAt(MAPS[WORLD_ID],xx,yy)&&(!best||steps<best.steps))best={x:xx,y:yy,steps,walk:true,label:HUBS[q.hub].name+'の探索区域'};}
 return best;
};
ACT.worldGo=function(el){const to=el.dataset.v;if(!Object.hasOwn(HUBS,to)||G.readOnly||G.st?.run||G.dlg||G.screen!=='explore'||!worldHubUnlocked(G.st,to))return;let target;if(G.st.mapId===WORLD_ID)target=worldTravelTarget(to);else target=MAPS[G.st.mapId].objects.find(o=>o.fieldExit)||MAPS[G.st.mapId].objects.find(o=>o.type==='door');if(!target)return;G.sheet=null;G.sheetHistory=[];render();walkTo(target.x,target.y);if(navigationValidPlan())G.walkPlan.label=target.label;};
function worldOverview(st){const land=WORLD.links.filter(l=>!l.sea).map(l=>{const a=WORLD.byHub.get(l.from),b=WORLD.byHub.get(l.to);return 'M'+(a.x+a.w/2)+' '+(a.y+a.h/2)+'L'+(b.x+b.w/2)+' '+(b.y+b.h/2);}).join(' ');return `<svg class="world-overview" viewBox="0 0 ${WORLD.w} ${WORLD.h}" role="img" aria-label="全国の街外。緑は解放済み、暗い色は未解放。点線は港からの船路"><defs><radialGradient id="world-sea"><stop stop-color="#355b70"/><stop offset="1" stop-color="#122c42"/></radialGradient></defs><rect width="1020" height="1080" fill="url(#world-sea)"/><path d="${land}" fill="none" stroke="#c1b990" stroke-width="55" stroke-linecap="round" stroke-linejoin="round"/><path d="${land}" fill="none" stroke="#526f66" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/><g fill="#d4e2d6" font-family="serif" font-size="22"><text x="70" y="100">N ↑</text><text x="70" y="138" font-size="13">全国の街道と船路</text></g>${WORLD.links.map(l=>{const a=WORLD.byHub.get(l.from),b=WORLD.byHub.get(l.to);return `<path d="M${a.x+a.w/2} ${a.y+a.h/2}L${b.x+b.w/2} ${b.y+b.h/2}" fill="none" stroke="${l.sea?'#9eb7c0':'#809267'}" stroke-width="${l.sea?3:8}" ${l.sea?'stroke-dasharray="8 7"':''}/>`;}).join('')}${WORLD.regions.map(r=>`<g><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="8" fill="${WORLD.allowed.has(r.hub)?'#a6bd86':'#786781'}" stroke="#e0d6ba" stroke-width="2"/><text x="${r.x+r.w/2}" y="${r.y+r.h/2+5}" text-anchor="middle" fill="#101e2c" font-size="14" font-weight="700">${esc(HUBS[r.hub].name.replace(/市$|区$/,''))}</text></g>`).join('')}<circle cx="${st.mapId===WORLD_ID?st.pos.x:WORLD.byHub.get(curHub())?.x||0}" cy="${st.mapId===WORLD_ID?st.pos.y:WORLD.byHub.get(curHub())?.y||0}" r="11" fill="#fff4c1" stroke="#b95758" stroke-width="5"/></svg>`;}
const worldBaseWorld=renderWorld;
renderWorld=function(){worldRefreshAccess(G.st);return `<p>全国の街外は一続きです。緑は解放済み、暗い色は未解放で通れません。点線の海上区間は港から船で渡ります。</p>${worldOverview(G.st)}<div class="world-destinations">${WORLD.regions.map(r=>`<button class="btn" data-a="worldGo" data-v="${r.hub}" ${WORLD.allowed.has(r.hub)&&!G.readOnly?'':'disabled'}>${esc(HUBS[r.hub].name)}・${WORLD.allowed.has(r.hub)?'解放済み':'未解放'}</button>`).join('')}</div><details><summary>地域と物語の記録</summary>${worldBaseWorld()}</details>`;};
const worldBaseObjectArt=ART.object;let worldPortArt;
ART.object=function(type,frame){if(type!=='worldPort')return worldBaseObjectArt(type,frame);if(worldPortArt)return worldPortArt;const c=document.createElement('canvas');c.width=80;c.height=112;c.artScale=4;const g=c.getContext('2d');g.fillStyle='#5d8eaa';g.beginPath();g.ellipse(40,94,37,11,0,0,Math.PI*2);g.fill();g.strokeStyle='#cee8ed';g.lineWidth=2;for(let y=92;y<108;y+=5){g.beginPath();g.moveTo(6,y);g.quadraticCurveTo(34,y-5,71,y);g.stroke();}g.fillStyle='#75503d';g.beginPath();g.moveTo(7,77);g.lineTo(73,77);g.lineTo(59,96);g.lineTo(21,96);g.closePath();g.fill();g.strokeStyle='#d9ba75';g.stroke();g.fillStyle='#d9bd8d';g.fillRect(36,15,4,65);g.fillStyle='#f6e9c8';g.beginPath();g.moveTo(41,18);g.lineTo(69,68);g.lineTo(41,68);g.closePath();g.fill();g.fillStyle='#87b7b5';g.beginPath();g.moveTo(33,25);g.lineTo(13,68);g.lineTo(33,68);g.closePath();g.fill();worldPortArt=c;return c;};
