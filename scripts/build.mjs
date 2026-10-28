import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = name => readFile(resolve(root, 'src', name), 'utf8');
const files = ['data_enemies.js', 'data_items.js', 'data.js', 'core.js', 'art.js', 'audio.js', 'ui.js', 'input.js'];
const shell = await source('shell.html');
const scripts = await Promise.all(files.map(source));
const header = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="男女混合アイドルグループを脱退したヒロインと2人で九州・沖縄を旅する、昭和風ドットのスマホ向けRPG（非公式の創作ゲーム・福岡編）。">
<meta name="theme-color" content="#101820">
<style>body{margin:0}</style>
<script>window.TLR_PUBLIC=true;window.TLR_BUILD="2026-10-29";</script>
</head><body>
`;
const output = header + shell.trimEnd() + '\n<script>\n' + scripts.map(s => s.trimEnd()).join('\n\n') + '\n</script>\n</body></html>\n';
await writeFile(resolve(root, 'index.html'), output);
console.log(`Built index.html from ${files.length} source files`);

