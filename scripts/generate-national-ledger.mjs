import {readFile,writeFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const source=await readFile(resolve(root,'src/data_national.js'),'utf8');
const {regions,prefs,implemented,routes}=runInNewContext(`${source}\n({regions:NATIONAL_REGIONS,prefs:NATIONAL_PREFECTURES,implemented:NATIONAL_IMPLEMENTED_HUBS,routes:NATIONAL_ROUTES})`);
const names=Object.fromEntries(regions);
const rows=prefs.map(p=>{
  const hubs=implemented[p.id]||[];
  return `| ${p.id} | ${p.name} | ${names[p.regionId]} | ${hubs.length?'一部実装':'未実装'} | ${hubs.length?hubs.join('・'):'—'} | ${hubs.length?'既存拠点の保存互換を確認':'拠点・経路・物語を設計'} |`;
});
const routeRows=routes.map(r=>`| ${r.id} | ${r.from} ↔ ${r.to} | ${r.mode==='road'?'陸路':r.mode} | ${r.unlock==='fukuokaClear'?'福岡編完了':'常時'} | ${r.status==='playable'?'移動可能':'未収録'} |`);
const out=`# 全国編 都道府県実装台帳\n\nこの表は \`src/data_national.js\` から生成する。地理IDの登録は遊べることを意味しない。現行の公開版は福岡編 v5.29。\n\n| ID | 都道府県 | 地方 | 状態 | 遊べる拠点ID | 次の作業 |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n合計：${prefs.length}都道府県、${regions.length}地方。現在の遊べる県は福岡県のみ（福岡市・北九州市）。\n\n## 経路\n\n| 経路ID | 拠点 | 手段 | 進行条件 | 実装状態 |\n| --- | --- | --- | --- | --- |\n${routeRows.join('\n')}\n\n佐賀県唐津市の経路は、福岡編完了で進行条件を満たしても、拠点の地図・依頼・配信等が完成するまで移動できない。\n`;
await writeFile(resolve(root,'docs/NATIONAL_PREFECTURES.md'),out,'utf8');
console.log(`Generated national ledger: ${prefs.length} prefectures`);
