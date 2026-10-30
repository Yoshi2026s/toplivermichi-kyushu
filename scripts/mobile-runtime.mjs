import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium, devices} from 'playwright';

export const root=resolve(import.meta.dirname,'..');
export const presets={
  standard:{label:'Android portrait',...devices['Pixel 7'],viewport:{width:393,height:851}},
  small:{label:'Small portrait',...devices['Pixel 7'],viewport:{width:360,height:640}},
  landscape:{label:'Android landscape',...devices['Pixel 7 landscape'],viewport:{width:851,height:393}},
  short:{label:'Reduced height (keyboard layout approximation)',...devices['Pixel 7'],viewport:{width:393,height:500}},
};
export function mobileOptions(name){
  const preset=presets[name];
  if(!preset)throw Error('Unknown device: '+name+'. Choose '+Object.keys(presets).join(', '));
  const {label,defaultBrowserType,...options}=preset;
  return options;
}
export function browserOptions(headless=true){
  const channel=process.env.MOBILE_BROWSER||'chrome';
  if(!['chrome','msedge','chromium'].includes(channel))throw Error('MOBILE_BROWSER must be chrome, msedge or chromium');
  return {headless,...(channel==='chromium'?{}:{channel}),args:['--mute-audio']};
}
export {chromium};

// Only the generated game is served. Repository metadata and local saves are never exposed.
export async function serveGame(port=0){
  const html=await readFile(resolve(root,'index.html'));
  const server=createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
    let pathname;
    try{pathname=new URL(req.url,'http://localhost').pathname;}catch{res.writeHead(400).end();return;}
    if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}
    if(!['/','/index.html'].includes(pathname)){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end(req.method==='HEAD'?undefined:html);
  });
  await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',accept);});
  return {server,url:'http://127.0.0.1:'+server.address().port+'/',close:()=>new Promise((accept,reject)=>server.close(e=>e?reject(e):accept()))};
}
