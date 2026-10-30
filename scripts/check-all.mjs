import {readdirSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
const root=resolve(import.meta.dirname,'..'),checks=[];
for(const name of readdirSync(import.meta.dirname).filter(n=>/^check-.*\.mjs$/.test(n)&&n!=='check-all.mjs').sort()){
  // Run outside the checkout so accidental cwd-relative reads fail in CI too.
  const start=Date.now(),r=spawnSync(process.execPath,[resolve(import.meta.dirname,name)],{cwd:tmpdir(),encoding:'utf8',timeout:120000});
  const stdout=(r.stdout||'').trim(),stderr=(r.stderr||'').trim();
  const error=r.error?`${r.error.code||'ERROR'}: ${r.error.message}`:null;
  const passed=r.status===0&&!error;
  checks.push({name,passed,exitCode:r.status,signal:r.signal,error,durationMs:Date.now()-start,stdout,stderr});
  console.log(`${passed?'PASS':'FAIL'} ${name}`);if(!passed)console.log([error,r.signal&&`signal: ${r.signal}`,stderr||stdout].filter(Boolean).join('\n').slice(-3500));
}
const html=readFileSync(resolve(root,'index.html'),'utf8');
for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Script(match[1]);
const hashes=Object.fromEntries(readdirSync(resolve(root,'src')).map(n=>[n,createHash('sha256').update(readFileSync(resolve(root,'src',n),'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
const manifest=JSON.parse(readFileSync(resolve(root,'release-manifest.json'),'utf8'));
const sha=name=>createHash('sha256').update(readFileSync(resolve(root,name))).digest('hex');
const assetSHA256=Object.fromEntries(Object.keys(manifest.assets||{}).map(name=>[name,sha(name)]));
const artifactSHA256=Object.fromEntries([...Object.keys(manifest.files),'release-manifest.json'].map(name=>[name,sha(name)]));
const report={version:manifest.version,generatedAtUTC:new Date().toISOString(),checks,generatedHtmlSyntax:true,sourceTextEncoding:"UTF-8 LF",sourceSHA256:hashes,assetSHA256,artifactSHA256};
mkdirSync(resolve(root,'.task'),{recursive:true});writeFileSync(resolve(root,'.task/validation-5.34.json'),JSON.stringify(report,null,2)+'\n');
console.log(`${checks.filter(c=>c.passed).length}/${checks.length} regression programs passed; generated HTML syntax OK`);
if(checks.some(c=>!c.passed))process.exitCode=1;
