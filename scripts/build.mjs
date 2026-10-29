import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const source = name => readFile(resolve(root, 'src', name), 'utf8');
const files = ['data_enemies.js', 'data_saga_enemies.js', 'data_items.js', 'data_national.js', 'data.js', 'data_nationwide.js', 'data_nationwide_story.js', 'data_maps.js', 'data_character.js', 'data_pets.js', 'data_ocean.js', 'data_extras.js', 'core.js', 'art.js', 'audio.js', 'share.js', 'pets.js', 'ocean.js', 'listeners.js', 'ui.js', 'ui_character.js', 'ui_pets.js', 'ui_ocean.js', 'ui_systems.js', 'ui_management.js', 'ui_guards.js', 'input.js'];
const shell = await source('shell.html');
const scripts = await Promise.all(files.map(source));
const header = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="福岡編から47都道府県へ旅する、スマホ向けの非公式創作RPG。全47都道府県の物語・地域ボスを収録。街と街外を分けた全国編。">
<meta name="theme-color" content="#101820">
<style>body{margin:0}</style>
<script>window.TLR_PUBLIC=true;window.TLR_BUILD="2026-10-30";</script>
</head><body>
`;
const output = header + shell.trimEnd() + '\n<script>\n' + scripts.map(s => s.trimEnd()).join('\n\n') + '\n</script>\n</body></html>\n';
await writeFile(resolve(root, 'index.html'), output);
await writeFile(resolve(root, 'GAME_SPEC.txt'), await readFile(resolve(root, 'GAME_SPEC.md'), 'utf8'));
const releaseFiles={};
for(const name of ['index.html','README.md','VERSION.txt','GAME_SPEC.md','GAME_SPEC.txt']){
  const bytes=await readFile(resolve(root,name));releaseFiles[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
const version=(scripts[files.indexOf('data.js')].match(/const GAME_VERSION = "([^"]+)"/)||[])[1];
await writeFile(resolve(root,'release-manifest.json'),JSON.stringify({version,schemaVersion:5,buildDate:'2026-10-30',sourceFileCount:files.length,files:releaseFiles,validation:'docs/validation-5.34.json'},null,2)+'\n');
console.log(`Built index.html from ${files.length} source files`);

