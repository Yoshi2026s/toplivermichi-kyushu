import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),file=resolve(import.meta.dirname,'check-pet-complete.mjs');
const labels=[...readFileSync(file,'utf8').matchAll(/^ \['([^']+)',/gm)].map(m=>m[1]);
if(labels.length!==20)throw Error('Expected 20 focused reviews');
const report=[];
for(let i=0;i<labels.length;i++){const result=spawnSync(process.execPath,[file,String(i+1)],{cwd:root,encoding:'utf8',timeout:120000});const passed=result.status===0&&!result.error;report.push({round:i+1,label:labels[i],checkedAt:new Date().toISOString(),command:'node scripts/check-pet-complete.mjs '+(i+1),passed,output:(result.stdout+result.stderr).trim()});console.log((passed?'PASS':'FAIL')+' '+(i+1)+' '+labels[i]);if(!passed)console.log(report.at(-1).output);}
mkdirSync(resolve(root,'.task'),{recursive:true});writeFileSync(resolve(root,'.task/pet-twenty-rounds.json'),JSON.stringify(report,null,2)+'\n');
if(report.some(r=>!r.passed))process.exitCode=1;
