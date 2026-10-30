import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {root,presets,mobileOptions,browserOptions,chromium,serveGame} from './mobile-runtime.mjs';

const args=process.argv.slice(2);
if(args.includes('--help')){
  console.log('node scripts/mobile-preview.mjs [--device=standard|small|landscape|short] [--port=4173]\nClose the dedicated browser window or press Ctrl+C to stop.');
  process.exit(0);
}
for(const arg of args)if(!/^--(device|port)=/.test(arg))throw Error('Unknown option: '+arg);
const device=args.find(a=>a.startsWith('--device='))?.slice(9)||'standard';
const port=Number(args.find(a=>a.startsWith('--port='))?.slice(7)||4173);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Port must be an integer from 1024 to 65535');
const options=mobileOptions(device),dir=resolve(root,'.task/mobile');
await mkdir(dir,{recursive:true});
const app=await serveGame(port);
let context;
try{
  context=await chromium.launchPersistentContext(resolve(dir,'profiles',device),{
    ...browserOptions(false),...options,
  });
  const page=context.pages()[0]||await context.newPage();
  await page.goto(app.url);
  await page.locator('[data-a="newGame"]').waitFor();
  await page.screenshot({path:resolve(dir,'preview-'+device+'.png')});
  await writeFile(resolve(dir,'preview.json'),JSON.stringify({mode:'browser-emulation',device,label:presets[device].label,url:app.url,viewport:options.viewport,profile:'.task/mobile/profiles/'+device},null,2)+'\n');
  console.log(`Ready: ${app.url} ${device} ${options.viewport.width}x${options.viewport.height}\nTouch emulation enabled. Saves are stored in a dedicated test profile.\nClose this browser window or press Ctrl+C to stop.`);
  const stop=()=>context.close().catch(()=>{});
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  await new Promise(accept=>context.once('close',accept));
}finally{
  await context?.close();
  await app.close();
}
