import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const ui=readFileSync(resolve(root,'src/ui.js'),'utf8');
const core=readFileSync(resolve(root,'src/core.js'),'utf8');
const fn=ui.match(/function renderBattleLog\(\)\{[\s\S]*?\n\}/)?.[0];
if(!fn||!core.includes('run.log = [...(run.log||[]), ...log].slice(-80)')) throw new Error('battle log retention missing');
const state={st:{run:{log:Array.from({length:83},(_,i)=>`記録${i+1}`)}},sheetData:{page:0}};
const render=runInNewContext(`${fn}\nrenderBattleLog`,{G:state,esc:s=>String(s)});
const newest=render();
if(!newest.includes('直近80件')||!newest.includes('記録83')||newest.includes('記録3</p>')||!newest.includes('1/10ページ')) throw new Error('recent page or 80-entry cap failed');
state.sheetData.page=9;
const oldest=render();
if(!oldest.includes('10/10ページ')||!oldest.includes('記録4')||oldest.includes('記録3</p>')) throw new Error('oldest page includes discarded entries');
state.st.run.log=[];state.sheetData.page=99;
if(!render().includes('まだありません。')||!render().includes('1/1ページ')) throw new Error('empty or stale page failed');
console.log('Battle log: 80-entry retention, newest/oldest pages, empty state OK');
