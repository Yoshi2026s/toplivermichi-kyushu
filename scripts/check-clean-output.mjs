import assert from 'node:assert/strict';
import {cpSync,existsSync,mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');
const require=createRequire(import.meta.url);
const canvas=process.env.CANVAS_MODULE_PATH||require.resolve('@napi-rs/canvas');
const fixture=mkdtempSync(join(tmpdir(),'pococha-clean-output-'));
try{
  // Never remove the developer's .task: exercise real scripts in an isolated copy.
  for(const name of readdirSync(root)){
    if(['.git','.task','node_modules'].includes(name))continue;
    cpSync(join(root,name),join(fixture,name),{recursive:true});
  }
  for(const [script,image] of [
    ['check-hd-art.mjs','hd-art-contact.png'],
    ['check-character-art.mjs','illustrated-creatures.png'],
    ['check-battle-fx.mjs','battle-fx-contact.png'],
    ['check-ocean.mjs','ocean-forms.png'],
  ]){
    const output=join(fixture,'.task');
    rmSync(output,{recursive:true,force:true});
    assert(!existsSync(output),'each script must start without an output directory');
    const result=spawnSync(process.execPath,[join(fixture,'scripts',script)],{
      cwd:tmpdir(),encoding:'utf8',timeout:120000,
      env:{...process.env,CANVAS_MODULE_PATH:canvas},
    });
    assert.equal(result.status,0,`${script}: ${result.error||result.stderr||result.stdout}`);
    assert.deepEqual(readFileSync(join(output,image)).subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
  }
  console.log('All four graphics checks create valid PNGs without .task, independently of test order and working directory');
}finally{
  rmSync(fixture,{recursive:true,force:true});
}
