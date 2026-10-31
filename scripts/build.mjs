import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const textFile = async path => (await readFile(resolve(root,path),'utf8')).replace(/\r\n/g,'\n');
const source = name => textFile('src/'+name);
const checkOnly=process.argv.includes('--check');
async function emitArtifact(name,content){
  const bytes=Buffer.isBuffer(content)?content:Buffer.from(content);
  if(checkOnly){
    const actual=await readFile(resolve(root,name)).catch(()=>null);
    if(!actual||!actual.equals(bytes))throw new Error(name+' is missing or stale. Run node scripts/build.mjs');
  }else await writeFile(resolve(root,name),bytes);
}
const assetFiles={};
const files = ['data_enemies.js', 'data_saga_enemies.js', 'data_items.js', 'data_national.js', 'data.js', 'data_nationwide.js', 'data_nationwide_story.js', 'data_maps.js', 'data_character.js', 'data_pets.js', 'data_ocean.js', 'data_extras.js', 'core.js', 'art.js', 'art_detail.js', 'soft_art.js', 'battle_fx.js', 'audio.js', 'share.js', 'pets.js', 'ocean.js', 'listeners.js', 'ui.js', 'ui_character.js', 'ui_pets.js', 'ui_ocean.js', 'ui_systems.js', 'ui_management.js', 'ui_guards.js', 'input.js'];
const embeddedArt = {};
for (const [token,name] of [['__TITLE_DAWN_DATA_URI__','illustrated/title-dawn'],['__SOFT_FRONT_DATA_URI__','illustrated/party-front'],['__SOFT_BACK_DATA_URI__','illustrated/party-back'],['__SOFT_SIDE_DATA_URI__','illustrated/party-side'],['__SOFT_NPC_DATA_URI__','illustrated/npc-front'],['__SOFT_PETS_DATA_URI__','illustrated/pets'],['__SOFT_ENEMIES_DATA_URI__','illustrated/enemies'],['__COAST_ART_DATA_URI__','semireal/battle-coast'],['__FOREST_ART_DATA_URI__','semireal/battle-forest'],['__MOUNTAIN_ART_DATA_URI__','semireal/battle-mountain'],['__PLAIN_ART_DATA_URI__','semireal/battle-plain']]) {
  const path='assets/'+name+'.webp',bytes=await readFile(resolve(root,path));
  assetFiles[path]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  embeddedArt[token]='data:image/webp;base64,'+bytes.toString('base64');
}
for(const [token,name]of [['__DISPLAY_FONT_DATA_URI__','quest-mincho-800'],['__BODY_FONT_DATA_URI__','quest-gothic-variable']]){
 const path='assets/fonts/'+name+'.woff2',bytes=await readFile(resolve(root,path));
 assetFiles[path]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 embeddedArt[token]='data:font/woff2;base64,'+bytes.toString('base64');
}
const embedArt = text => Object.entries(embeddedArt).reduce((out,[token,uri])=>out.replaceAll(token,uri),text);
const shell = embedArt(await source('shell.html'));
const fontLicenses=(await Promise.all(['OFL-Shippori-Mincho.txt','OFL-Noto-Sans-JP.txt'].map(name=>textFile('assets/fonts/'+name)))).join('\n\n');
const licenseTemplate='<template id="font-licenses">'+fontLicenses.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')+'</template>\n';
const scripts = await Promise.all(files.map(source));
const header = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="福岡編から47都道府県へ旅する、スマホ向けの非公式創作RPG。全47都道府県の物語・地域ボスを収録。街と街外を分けた全国編。">
<meta name="theme-color" content="#101820">
<style>body{margin:0}</style>
<script>window.TLR_PUBLIC=true;window.TLR_BUILD="2026-10-31";</script>
</head><body>
`;
const output = header + licenseTemplate + shell.trimEnd() + '\n<script>\n' + scripts.map(s => embedArt(s.trimEnd())).join('\n\n') + '\n</script>\n</body></html>\n';
await emitArtifact('index.html', output);
for(const name of ['README.md','VERSION.txt','GAME_SPEC.md'])await emitArtifact(name,await textFile(name));
await emitArtifact('GAME_SPEC.txt', await textFile('GAME_SPEC.md'));
const releaseFiles={};
for(const name of ['index.html','README.md','VERSION.txt','GAME_SPEC.md','GAME_SPEC.txt']){
  const bytes=await readFile(resolve(root,name));releaseFiles[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
const version=(scripts[files.indexOf('data.js')].match(/const GAME_VERSION = "([^"]+)"/)||[])[1];
await emitArtifact('release-manifest.json',JSON.stringify({version,schemaVersion:5,buildDate:'2026-10-31',sourceFileCount:files.length,files:releaseFiles,assets:assetFiles,validation:'docs/validation-5.34.json'},null,2)+'\n');
console.log(`${checkOnly?"Verified":"Built"} index.html from ${files.length} source files and ${Object.keys(assetFiles).length} embedded graphics/font assets`);

