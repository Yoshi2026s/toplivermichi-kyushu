import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
const root=resolve(import.meta.dirname,'..'),checks=[];
for(const name of readdirSync(import.meta.dirname).filter(n=>/^check-.*\.mjs$/.test(n)&&n!=='check-all.mjs').sort()){
  const start=Date.now(),r=spawnSync(process.execPath,[resolve(import.meta.dirname,name)],{cwd:root,encoding:'utf8',timeout:120000});
  checks.push({name,passed:r.status===0,exitCode:r.status,durationMs:Date.now()-start,stdout:r.stdout.trim(),stderr:r.stderr.trim()});
  console.log(`${r.status===0?'PASS':'FAIL'} ${name}`);if(r.status!==0)console.log((r.stderr||r.stdout).slice(-3500));
}
const html=readFileSync(resolve(root,'index.html'),'utf8');
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Script(match[1]);
const hashes=Object.fromEntries(readdirSync(resolve(root,'src')).map(n=>[n,createHash('sha256').update(readFileSync(resolve(root,'src',n))).digest('hex')]));
const report={version:'5.34',generatedAtUTC:new Date().toISOString(),checks,generatedHtmlSyntax:true,sourceSHA256:hashes};
mkdirSync(resolve(root,'.task'),{recursive:true});writeFileSync(resolve(root,'.task/validation-5.34.json'),JSON.stringify(report,null,2)+'\n');
console.log(`${checks.filter(c=>c.passed).length}/${checks.length} regression programs passed; generated HTML syntax OK`);
if(checks.some(c=>!c.passed))process.exitCode=1;
