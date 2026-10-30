import {readFileSync,writeFileSync,readdirSync,mkdirSync,mkdtempSync,cpSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
for(const args of [['scripts/build.mjs'],['scripts/check-all.mjs'],['scripts/build.mjs','--check']]){
 const result=spawnSync(process.execPath,args,{cwd:root,stdio:'inherit',timeout:600000});
 if(result.status!==0)process.exit(result.status||1);
}
const manifest=JSON.parse(readFileSync(resolve(root,'release-manifest.json'),'utf8'));
const report=JSON.parse(readFileSync(resolve(root,'.task/validation-5.34.json'),'utf8'));
const expected=readdirSync(import.meta.dirname).filter(n=>/^check-.*\.mjs$/.test(n)&&n!=='check-all.mjs').sort();
if(report.checks.length!==expected.length||report.checks.some((c,i)=>c.name!==expected[i]||!c.passed)||!report.generatedHtmlSyntax)throw Error('Regression report is incomplete or contains failures');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [name,digest]of Object.entries(report.sourceSHA256))if(sha(readFileSync(resolve(root,'src',name),'utf8').replace(/\r\n/g,'\n'))!==digest)throw Error('Source changed after testing: '+name);
for(const [name,digest]of Object.entries({...report.assetSHA256,...report.artifactSHA256}))if(sha(readFileSync(resolve(root,name)))!==digest)throw Error('Artifact changed after testing: '+name);
const reportPath=resolve(root,manifest.validation);mkdirSync(resolve(reportPath,'..'),{recursive:true});writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
if(!/^\d+\.\d+(?:\.\d+)?$/.test(manifest.version))throw Error('Invalid release version');
const stage=mkdtempSync(resolve(root,'.task/release-v'+manifest.version+'-'));
for(const name of ['src','scripts','assets','docs','.github'])cpSync(resolve(root,name),resolve(stage,name),{recursive:true});
for(const name of [...Object.keys(manifest.files),'release-manifest.json','package.json','package-lock.json','.gitattributes','.gitignore'])copyFileSync(resolve(root,name),resolve(stage,name));
const verify=spawnSync(process.execPath,['scripts/build.mjs','--check'],{cwd:stage,stdio:'inherit',timeout:30000});
if(verify.status!==0)throw Error('Copied candidate failed verification');
writeFileSync(resolve(root,'.task/release-candidate.json'),JSON.stringify({version:manifest.version,directory:stage,checks:report.checks.length,manifestSHA256:sha(readFileSync(resolve(stage,'release-manifest.json')))},null,2)+'\n');
console.log('Release candidate ready: '+stage+'; '+report.checks.length+' checks passed. No deployment was performed.');
