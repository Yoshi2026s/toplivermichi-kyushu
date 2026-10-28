import {readFile,writeFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const source=await readFile(resolve(root,'src/data_national.js'),'utf8');
const {regions,prefs,implemented,routes}=runInNewContext(`${source}\n({regions:NATIONAL_REGIONS,prefs:NATIONAL_PREFECTURES,implemented:NATIONAL_IMPLEMENTED_HUBS,routes:NATIONAL_ROUTES})`);
const names=Object.fromEntries(regions);
const rows=prefs.map(p=>{
  const hubs=implemented[p.id]||[];
  const state=p.id==='JP41'?'唐津編（M03まで）':hubs.length?'一部実装':'未実装';
  const next=p.id==='JP41'?'佐賀市・地域支援・旧セーブ実機確認':hubs.length?'既存拠点の保存互換を確認':'拠点・経路・物語を設計';
  return `| ${p.id} | ${p.name} | ${names[p.regionId]} | ${state} | ${hubs.length?hubs.join('・'):'—'} | ${next} |`;
});
const routeRows=routes.map(r=>`| ${r.id} | ${r.from} ↔ ${r.to} | ${r.mode==='road'?'陸路':r.mode} | ${r.unlock==='fukuokaClear'?'福岡編完了':'常時'} | ${r.status==='playable'?'移動可能':'未収録'} |`);
const out=`# 全国編 都道府県実装台帳\n\nこの表は \`src/data_national.js\` から生成する。地理IDの登録は遊べることを意味しない。現行の公開版は福岡編 v5.29。\n\n| ID | 都道府県 | 地方 | 状態 | 遊べる拠点ID | 次の作業 |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n合計：${prefs.length}都道府県、${regions.length}地方。ドラフトPRでは福岡県の2拠点と佐賀県唐津市の主編M03・探索3区域・地域ボス・配信を実装。佐賀市以降は未収録。\n\n## 経路\n\n| 経路ID | 拠点 | 手段 | 進行条件 | 実装状態 |\n| --- | --- | --- | --- | --- |\n${routeRows.join('\n')}\n\n唐津市は福岡編完了後、北九州市の東門から初回到達できる。訪問後は地図からも北九州市と往復できる。\n`;
await writeFile(resolve(root,'docs/NATIONAL_PREFECTURES.md'),out,'utf8');
console.log(`Generated national ledger: ${prefs.length} prefectures`);
