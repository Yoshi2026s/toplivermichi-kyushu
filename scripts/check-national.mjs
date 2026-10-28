import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const source=readFileSync(resolve(root,'src/data_national.js'),'utf8');
const {regions,prefs,implemented}=runInNewContext(`${source}\n({regions:NATIONAL_REGIONS,prefs:NATIONAL_PREFECTURES,implemented:NATIONAL_IMPLEMENTED_HUBS})`);
const expected='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
const fail=msg=>{throw new Error(msg)};
if(regions.length!==8||new Set(regions.map(r=>r[0])).size!==8) fail('8 region IDs required');
if(prefs.length!==47) fail('47 prefectures required');
for(let i=0;i<47;i++){
  const p=prefs[i];
  if(p.id!==`JP${String(i+1).padStart(2,'0')}`||p.name!==expected[i]) fail(`prefecture ${i+1} mismatch`);
  if(!regions.some(r=>r[0]===p.regionId)) fail(`${p.id} has unknown region`);
}
if(new Set(prefs.map(p=>p.name)).size!==47) fail('duplicate prefecture');
const counts=regions.map(r=>prefs.filter(p=>p.regionId===r[0]).length);
if(counts.join(',')!=='1,6,7,9,7,5,4,8') fail(`region counts ${counts}`);
const data=readFileSync(resolve(root,'src/data.js'),'utf8');
const match=data.match(/const HUBS = (\{[\s\S]*?\n\});/);
if(!match) fail('HUBS not found');
const hubs=runInNewContext(`(${match[1]})`);
if(Object.keys(implemented).join(',')!=='JP40'||implemented.JP40.join(',')!=='KY01,KY02') fail('playable prefectures must match current game');
for(const ids of Object.values(implemented)) for(const id of ids) if(!hubs[id]) fail(`missing playable hub ${id}`);
console.log('National registry: 8 regions, 47 prefectures, 2 existing hubs OK');
