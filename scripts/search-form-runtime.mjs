import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/ui_search.js',import.meta.url),'utf8');
export const searchFormSource=source.match(/const LIST_SEARCH=\{[\s\S]*?\n\};/)[0]+'\n'+['listSearchBlocked','listSearchForm'].map(name=>source.match(new RegExp('^function '+name+'\\(.*$','m'))[0]).join('\n');
