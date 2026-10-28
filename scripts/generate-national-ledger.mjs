import {readFile,writeFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const source=await readFile(resolve(root,'src/data_national.js'),'utf8');
const {regions,prefs,implemented}=runInNewContext(`${source}\n({regions:NATIONAL_REGIONS,prefs:NATIONAL_PREFECTURES,implemented:NATIONAL_IMPLEMENTED_HUBS})`);
const names=Object.fromEntries(regions);
const rows=prefs.map(p=>{
  const hubs=implemented[p.id]||[];
  return `| ${p.id} | ${p.name} | ${names[p.regionId]} | ${hubs.length?'一部実装':'未実装'} | ${hubs.length?hubs.join('・'):'—'} | ${hubs.length?'既存拠点の保存互換を確認':'拠点・経路・物語を設計'} |`;
});
const out=`# 全国編 都道府県実装台帳\n\nこの表は \`src/data_national.js\` から生成する。地理IDの登録は遊べることを意味しない。現行の公開版は福岡編 v5.29。\n\n| ID | 都道府県 | 地方 | 状態 | 遊べる拠点ID | 次の作業 |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n合計：${prefs.length}都道府県、${regions.length}地方。現在の遊べる県は福岡県のみ（福岡市・北九州市）。\n`;
await writeFile(resolve(root,'docs/NATIONAL_PREFECTURES.md'),out,'utf8');
console.log(`Generated national ledger: ${prefs.length} prefectures`);
