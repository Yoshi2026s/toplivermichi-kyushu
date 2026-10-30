import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,mkdtempSync,rmSync,cpSync,copyFileSync,appendFileSync,unlinkSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const run=(cwd,...args)=>spawnSync(process.execPath,['scripts/build.mjs',...args],{cwd,encoding:'utf8',timeout:30000});
const clean=run(root,'--check');assert.equal(clean.status,0,clean.stderr||clean.stdout);
for(const match of readFileSync(resolve(root,'README.md'),'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
 const target=match[1];if(!/^(?:https?:|#)/.test(target))assert(existsSync(resolve(root,target.split('#')[0])),'README link is missing: '+target);
}
const manifest=JSON.parse(readFileSync(resolve(root,'release-manifest.json'),'utf8'));
assert.equal(Object.keys(manifest.assets).filter(n=>n.endsWith('.webp')).length,7,'title, four terrain backgrounds and two party atlases are tracked');
assert.equal(Object.keys(manifest.assets).filter(n=>n.endsWith('.woff2')).length,2,'both Japanese fonts are tracked');
for(const name of Object.keys(manifest.assets)){
 const bytes=readFileSync(resolve(root,name));if(name.endsWith('.webp')){assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');}else assert.equal(bytes.subarray(0,4).toString(),'wOF2');
 assert(readFileSync(resolve(root,'index.html'),'utf8').includes(bytes.toString('base64')),name+' works without an image request');
}
assert(readFileSync(resolve(root,'index.html'),'utf8').includes('SIL OPEN FONT LICENSE Version 1.1'),'standalone HTML includes font licenses');
const fonts=JSON.parse(readFileSync(resolve(root,'assets/fonts/SOURCES.json'),'utf8')).fonts;
for(const font of fonts){
 assert(existsSync(resolve(root,'assets/fonts',font.license)),'font license must ship with the subset');
 const coverage=new Set(font.codepoints);
 for(const char of 'ポコチャクエスト全国編やる事オート移動メニュー地図道具ステータス編成記録ペット航海図鑑設定解説戻決体力MP0123456789')assert(coverage.has(char.codePointAt(0)),font.family+' lacks '+char);
}
assert(!readFileSync(resolve(root,'src/shell.html'),'utf8').includes('fonts.googleapis.com'),'game typography must not depend on an external font service');
// Run real build checks in an isolated copy; never alter the working game.
const fixture=mkdtempSync(resolve(tmpdir(),'pococha-release-integrity-'));
try{
mkdirSync(resolve(fixture,'scripts'),{recursive:true});
for(const name of ['src','assets'])cpSync(resolve(root,name),resolve(fixture,name),{recursive:true});
copyFileSync(resolve(root,'scripts/build.mjs'),resolve(fixture,'scripts/build.mjs'));
for(const name of [...Object.keys(manifest.files),'release-manifest.json'])copyFileSync(resolve(root,name),resolve(fixture,name));
assert.equal(run(fixture,'--check').status,0);
appendFileSync(resolve(fixture,'index.html'),'<!-- obsolete build -->');
let failed=run(fixture,'--check');assert.notEqual(failed.status,0);assert.match(failed.stderr,/index.html is missing or stale/);
copyFileSync(resolve(root,'index.html'),resolve(fixture,'index.html'));
const art=Object.keys(manifest.assets)[0];appendFileSync(resolve(fixture,art),Buffer.from([0]));
failed=run(fixture,'--check');assert.notEqual(failed.status,0,'changed art must invalidate the embedded build');
unlinkSync(resolve(fixture,art));failed=run(fixture,'--check');assert.notEqual(failed.status,0,'missing art must block rebuilding');
copyFileSync(resolve(root,art),resolve(fixture,art));
appendFileSync(resolve(fixture,'release-manifest.json'),' ');failed=run(fixture,'--check');assert.notEqual(failed.status,0);assert.match(failed.stderr,/release-manifest.json is missing or stale/);
}finally{
 rmSync(fixture,{recursive:true,force:true});
}
console.log('Release checks reject stale HTML, modified/missing art and stale manifests; all embedded graphics/fonts and README links are present');
