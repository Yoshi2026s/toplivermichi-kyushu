import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createCanvas,Image}=require(process.env.CANVAS_MODULE_PATH||'@napi-rs/canvas');
const assets={FRONT:'party-front',BACK:'party-back',SIDE:'party-side',NPC:'npc-front',PETS:'pets',ENEMIES:'enemies'};
export async function illustratedContext(code,extra={}){
 for(const [token,name]of Object.entries(assets))code=code.replaceAll('__SOFT_'+token+'_DATA_URI__','data:image/webp;base64,'+readFileSync(new URL('../assets/illustrated/'+name+'.webp',import.meta.url)).toString('base64'));
 const context=createContext({document:{createElement:()=>createCanvas(1,1)},Image,...extra});
 const api=runInContext(code,context);
 await runInContext('SOFT_ART.loaded',context);
 return api;
}
