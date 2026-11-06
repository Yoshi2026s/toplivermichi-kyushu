import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const read=path=>readFileSync(resolve(root,path));
const html=read('index.html').toString();
assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="\.\/assets\/icons\/quest-icon-180\.png\?v=20261106">/);
assert.match(html,/<link rel="manifest" href="\.\/manifest\.webmanifest\?v=20261106">/);
const manifest=JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.name,'ポコチャクエスト');assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
for(const size of [180,192,512]){
 const data=read(`assets/icons/quest-icon-${size}.png`);
 assert.equal(data.subarray(1,4).toString(),'PNG');assert.equal(data.readUInt32BE(16),size);assert.equal(data.readUInt32BE(20),size);
 if(size!==180)assert(manifest.icons.some(icon=>icon.sizes===`${size}x${size}`&&icon.src===`./assets/icons/quest-icon-${size}.png?v=20261106`));
}
// Relative paths must remain inside the repository's Pages directory.
for(const icon of manifest.icons)assert.equal(new URL(icon.src,'https://example.test/toplivermichi-kyushu/manifest.webmanifest').pathname,`/toplivermichi-kyushu/${icon.src.slice(2).split('?')[0]}`);
console.log('Home icon PNG dimensions, iOS metadata, Android manifest and Pages-relative paths OK');
