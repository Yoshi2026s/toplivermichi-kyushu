import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const files=['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','core.js'];
const core=files.map(f=>readFileSync(resolve(root,'src',f),'utf8')).join('\n');
const ui=readFileSync(resolve(root,'src','ui.js'),'utf8');
const section=ui.slice(ui.indexOf('const PENDING_BADGES='),ui.indexOf('function renderRecord(){'));
const G={sheetData:{}};
const catalog=runInNewContext(`${core}\n${section}\n({PENDING_BADGES,BADGE_GROUPS,renderBadgeRecord})`,{G,esc:s=>String(s)});
const ids=Array.from({length:100},(_,i)=>`B${String(i+1).padStart(3,'0')}`);
const implemented={...runInNewContext(`${core}\n({ITEM_BADGES,GROWTH_BADGES,PARTY_BADGES,ACTION_BADGES,HEAL_BADGES,MP_BADGES,CHEER_BADGES,SPEED_BADGES,ATTACK_BADGES,GUARD_BADGES,DEFENSE_BADGES})`)};
const all=new Set([...Object.keys(catalog.PENDING_BADGES),...Object.values(implemented).flatMap(Object.keys)]);
if(all.size!==100||ids.some(id=>!all.has(id))||Object.keys(catalog.PENDING_BADGES).length!==16||catalog.BADGE_GROUPS.length!==10) throw new Error('badge catalog must cover exactly B001-B100');
const st={battleBadges:['B001','B071']};
const full=catalog.renderBadgeRecord(st);
if(!full.includes('獲得2/100種')||!full.includes('B001')||!full.includes('B100')||!full.includes('― 制作中 B072')) throw new Error('full badge record failed');
G.sheetData.badgeOnlyUnowned=true;
const missing=catalog.renderBadgeRecord(st);
if(missing.includes('● 獲得済み B001')||!missing.includes('B100')||!missing.includes('すべて表示')) throw new Error('missing badge filter failed');
console.log('Badge catalog: 100 IDs, 10 groups, pending status and filter OK');

