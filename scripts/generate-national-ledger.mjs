import {readFile,writeFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const source=(await Promise.all(['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js','data_nationwide_story.js','data_maps.js'].map(name=>readFile(resolve(root,'src',name),'utf8')))).join('\n');
const {regions,prefs,implemented,routes,quests,bosses,hubs}=runInNewContext(`${source}\n({regions:NATIONAL_REGIONS,prefs:NATIONAL_PREFECTURES,implemented:NATIONAL_IMPLEMENTED_HUBS,routes:NATIONAL_ROUTES,quests:QUESTS,bosses:BOSSES,hubs:HUBS})`);
const names=Object.fromEntries(regions);
const rows=prefs.map(p=>{
  const hubs=implemented[p.id]||[];
  const state=Object.entries(quests).filter(([,q])=>q.main&&hubs.includes(q.hub)).map(([id,q])=>id+'：'+q.name+'／'+bosses[q.boss].name).join('・');
  const next='街↔街外の分離MAP・本編とボス実装済み';
  return `| ${p.id} | ${p.name} | ${names[p.regionId]} | ${state} | ${hubs.length?hubs.join('・'):'—'} | ${next} |`;
});
const unlock={always:'常時',fukuokaClear:'福岡編完了',karatsuClear:'M03完了',sagaCityClear:'M04完了',saseboClear:'M05完了',nagasakiClear:'M06完了',kumamotoClear:'M07完了',asoClear:'M08完了'};
const routeRows=routes.map(r=>`| ${r.id} | ${r.from} ↔ ${r.to} | ${r.mode==='road'?'陸路':'交通路'} | ${r.requiredQuest||unlock[r.unlock]||r.unlock} | ${r.status==='playable'?'移動可能':'未収録'} |`);
const out=`# 全国編 都道府県実装台帳\n\nこの表は \`src/data_national.js\` と \`src/data_nationwide.js\` から生成する。全国編v5.33の追加物語・ボス・MAPは本版の新規制作であり、参照版v10.108の再現ではない。\n\n| ID | 都道府県 | 地方 | 状態 | 遊べる拠点ID | MAP・実装状況 |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n合計：${prefs.length}都道府県、${regions.length}地方、${Object.values(implemented).flat().length}拠点。全51拠点に物語と地域ボス、街MAPと街外MAPを収録。ボス討伐後の配信イベントは廃止。戦闘は街外のみ。\n\n## 経路\n\n| 経路ID | 拠点 | 手段 | 進行条件 | 実装状態 |\n| --- | --- | --- | --- | --- |\n${routeRows.join('\n')}\n\n全国の交通路は阿蘇市編M08完了後に開き、以降は現在地の地域ボス討伐で次の地域へ進める。帰路は常に通れる。初回は門・交通路から到達し、訪問後は地図から隣接拠点へ移動できる。\n`;
await writeFile(resolve(root,'docs/NATIONAL_PREFECTURES.md'),out,'utf8');
console.log(`Generated national ledger: ${prefs.length} prefectures`);

