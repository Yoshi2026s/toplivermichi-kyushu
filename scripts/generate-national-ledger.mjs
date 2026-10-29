import {readFile,writeFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const source=(await Promise.all(['data_enemies.js','data_saga_enemies.js','data_items.js','data_national.js','data.js','data_nationwide.js'].map(name=>readFile(resolve(root,'src',name),'utf8')))).join('\n');
const {regions,prefs,implemented,routes}=runInNewContext(`${source}\n({regions:NATIONAL_REGIONS,prefs:NATIONAL_PREFECTURES,implemented:NATIONAL_IMPLEMENTED_HUBS,routes:NATIONAL_ROUTES})`);
const names=Object.fromEntries(regions);
const rows=prefs.map(p=>{
  const hubs=implemented[p.id]||[];
  const original=Number(p.id.slice(2))>=40&&Number(p.id.slice(2))<=43;
  const state=original?'本編M01～M08・探索':hubs.length?'訪問・探索':'未実装';
  const next=original?'実機の保存互換を確認':'固有の物語・依頼・地域素材を制作';
  return `| ${p.id} | ${p.name} | ${names[p.regionId]} | ${state} | ${hubs.length?hubs.join('・'):'—'} | ${next} |`;
});
const unlock={always:'常時',fukuokaClear:'福岡編完了',karatsuClear:'M03完了',sagaCityClear:'M04完了',saseboClear:'M05完了',nagasakiClear:'M06完了',kumamotoClear:'M07完了',asoClear:'M08完了'};
const routeRows=routes.map(r=>`| ${r.id} | ${r.from} ↔ ${r.to} | ${r.mode==='road'?'陸路':'交通路'} | ${unlock[r.unlock]||r.unlock} | ${r.status==='playable'?'移動可能':'未収録'} |`);
const out=`# 全国編 都道府県実装台帳\n\nこの表は \`src/data_national.js\` と \`src/data_nationwide.js\` から生成する。現行の公開版は福岡編 v5.29。ドラフトPRの全国追加拠点は本版の新規制作であり、参照版v10.108の再現ではない。\n\n| ID | 都道府県 | 地方 | 状態 | 遊べる拠点ID | 次の作業 |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n合計：${prefs.length}都道府県、${regions.length}地方、${Object.values(implemented).flat().length}拠点。追加の43拠点は訪問・探索3区域・宿屋・休憩・編成・記録に対応。本編依頼・固有物語・地域ボス・配信は未収録。\n\n## 経路\n\n| 経路ID | 拠点 | 手段 | 進行条件 | 実装状態 |\n| --- | --- | --- | --- | --- |\n${routeRows.join('\n')}\n\n全国の交通路は阿蘇市編M08完了後に開く。初回は門・交通路から到達し、訪問後は地図から隣接拠点へ移動できる。\n`;
await writeFile(resolve(root,'docs/NATIONAL_PREFECTURES.md'),out,'utf8');
console.log(`Generated national ledger: ${prefs.length} prefectures`);

