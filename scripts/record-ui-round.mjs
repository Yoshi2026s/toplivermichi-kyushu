import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),[round,label,...commands]=process.argv.slice(2);
const checks=[];for(const command of commands){const p=spawnSync(process.execPath,[resolve(root,command)],{cwd:root,encoding:'utf8',timeout:240000});checks.push({command,passed:p.status===0,output:(p.stdout+p.stderr).slice(-2500)});console.log(p.stdout,p.stderr);}
mkdirSync(resolve(root,'.task'),{recursive:true});const path=resolve(root,'.task/ten-rounds.json');let report=[];try{report=JSON.parse(readFileSync(path));}catch{}
report=report.filter(r=>r.round!==Number(round));report.push({round:Number(round),label,checkedAt:new Date().toISOString(),checks,passed:checks.length>0&&checks.every(c=>c.passed)});report.sort((a,b)=>a.round-b.round);writeFileSync(path,JSON.stringify(report,null,2));if(!report.find(r=>r.round===Number(round)).passed)process.exitCode=1;
