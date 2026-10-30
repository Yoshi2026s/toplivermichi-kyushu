/* Character illustration layer: native curves, individual costumes and directional poses. */
const CHARACTER_ART=(()=>{
 const cache=new Map();
 const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')];};
 const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
 function keep(k,f){if(cache.has(k))return cache.get(k);const c=f();cache.set(k,c);if(cache.size>256)cache.delete(cache.keys().next().value);return c;}
 const oval=(g,x,y,rx,ry,c)=>{g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();};
 const path=(g,d,c,stroke='#26313d',width=.65)=>{const tokens=d.match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+/g)||[];let i=0,cmd='',x=0,y=0,sx=0,sy=0;g.beginPath();
  while(i<tokens.length){if(/[a-z]/i.test(tokens[i]))cmd=tokens[i++];const rel=cmd===cmd.toLowerCase(),n=()=>+tokens[i++],X=v=>rel?x+v:v,Y=v=>rel?y+v:v;
   if(cmd.toUpperCase()==='Z'){g.closePath();x=sx;y=sy;cmd='';continue;}
   if(cmd.toUpperCase()==='M'||cmd.toUpperCase()==='L'){const a=X(n()),b=Y(n());if(cmd.toUpperCase()==='M'){g.moveTo(a,b);sx=a;sy=b;cmd=rel?'l':'L';}else g.lineTo(a,b);x=a;y=b;}
   else if(cmd.toUpperCase()==='H'){x=X(n());g.lineTo(x,y);}else if(cmd.toUpperCase()==='V'){y=Y(n());g.lineTo(x,y);}else if(cmd.toUpperCase()==='Q'){const a=X(n()),b=Y(n()),xx=X(n()),yy=Y(n());g.quadraticCurveTo(a,b,xx,yy);x=xx;y=yy;}else break;
  }g.fillStyle=c;g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.lineJoin='round';g.stroke();}};
 const grad=(g,x,y,x2,y2,a,b)=>{const q=g.createLinearGradient(x,y,x2,y2);q.addColorStop(0,a);q.addColorStop(1,b);return q;};
 function person(id,hair,coat,dir=0,frame=0,opt={}){return keep(JSON.stringify(['person',id,hair,coat,dir,frame%4,opt]),()=>{
  const[c,g]=make(64,96);c.artScale=4;g.scale(2,2);if(dir===3){g.translate(32,0);g.scale(-1,1);dir=2;}
  const h=hash(id),style=h%4,step=frame%4===1?1.7:frame%4===3?-1.7:0,bob=step?.65:0;
  oval(g,16,45.5,8.8,1.6,'#10222e30');g.translate(0,-bob);
  const cloth=grad(g,8,25,25,39,'#fff4da',coat); // base color remains dominant in the midtones
  cloth.addColorStop(.28,coat);cloth.addColorStop(.8,coat);
  const skin=grad(g,10,11,23,24,'#ffe2ba','#c78e77');
  for(const [x,s]of [[11,step],[18,-step]]){path(g,`M${x} 34h4l.3 ${8-s}h-4.7Z`,'#354253');path(g,`M${x-.8} ${41-s}q2-1 4.8 0l1 3h-6Z`,'#57463c');path(g,`M${x-.4} ${41.5-s}h3.5v.5h-3.5Z`,'#ba9c72',null);}
  if(opt.long)path(g,'M8 11Q5 21 8 32L13 30 22 32Q27 21 24 11Z',hair);
  path(g,'M11 24Q16 22 22 25L25 38Q18 41 7 38L9 29Z',cloth);
  path(g,'M11 25 14 28 12 33 10 27Z','#fff0cf');path(g,'M20 25 17 28 19 33 22 27Z',coat);
  if(style===1)path(g,'M10 25Q17 31 22 25L21 29 12 31Z','#d9b36d');
  if(style===2)path(g,'M10 31H22V38H10Z',coat);
  if(dir!==1){path(g,'M16 28V38','transparent','#31404b',.5);for(let y=30;y<38;y+=3)oval(g,17,y,.55,.55,'#f3d396');path(g,'M10 25 22 35','transparent','#a8875c',1.1);path(g,'M21 32h6v7h-6Z','#77543d');path(g,'M21 32h6v2h-6Z','#c19b65');oval(g,24,35,.7,.7,'#f0d391');}
  for(const [x,s]of dir===2?[[12,step]]:[[7,step],[23,-step]]){path(g,`M${x} 26q-1 4 ${s*.35} 9l3 .5 .5-9Z`,cloth);oval(g,x+1.5+s*.35,36,1.7,2,skin);path(g,`M${x} 33.5h3`,'transparent','#e7cc9d',.7);}
  oval(g,16,14,9.7,11,'#24313d');oval(g,16,13.5,9.1,10.4,grad(g,9,4,24,22,hair,'#222c38'));
  if(dir===1){path(g,'M9 10Q15 5 23 12M9 15Q16 10 24 16M10 20Q16 16 23 21','transparent',hair,1.7);path(g,'M10 7Q14 5 18 6','transparent','#ffffff45',.9);}
  else{
   oval(g,16,16,7.5,9,skin);oval(g,8.9,17,1.3,2.1,'#e4ad8d');oval(g,23,17,1.2,2,'#ce977d');
   path(g,'M7 14Q6 5 14 3Q23 1 25 13L23 18 21 10Q18 13 16 14L16 9Q13 13 10 14L10 10Z',grad(g,8,4,24,17,hair,'#27313c'));
   path(g,'M10 7Q14 4 20 6M11 9 15 7','transparent','#ffffff40',.65);
   for(const x of dir===2?[10.2]:[11.2,19]){path(g,`M${x-1} 16Q${x+1} 14.7 ${x+3} 16`,'transparent','#46363c',.75);oval(g,x+1,17.6,1.65,2.2,'#fff8e6');oval(g,x+.8,18,1.1,1.65,'#485a69');oval(g,x+.8,18.4,.65,1.1,'#182c3b');oval(g,x+.3,16.8,.55,.65,'#ffffff');}
   if(dir===2){path(g,'M8.7 18.7 6.8 20 9 20.5',skin);path(g,'M10 23q1.5 .7 3 0','transparent','#9e655e',.6);path(g,'M21 12Q25 20 21 25L19 23 20 14Z',hair);}
   else{oval(g,11,21,1.7,.7,'#e8a09070');oval(g,21.8,21,1.6,.7,'#df978b70');path(g,'M14.6 23Q16.4 24 18 22.8','transparent','#9b6261',.65);path(g,'M16 20h.7','transparent','#b5806a',.6);}
  }
  if(dir!==1&&style===2){for(const x of dir===2?[10.2]:[11.2,19]){oval(g,x+1,17.8,2.8,2.6,'#ffffff10');g.strokeStyle='#baac88';g.lineWidth=.65;g.beginPath();g.ellipse(x+1,17.8,2.8,2.6,0,0,Math.PI*2);g.stroke();}path(g,'M15 17.6h3','transparent','#baac88',.6);}
  if(dir!==1&&style===1)path(g,'M9 9Q11 3 18 4L14 7 12 11Z',hair);
  if(opt.ribbon)path(g,'M23 8 19 5 19 11 23 9 27 5 27 11Z',opt.ribbon);
  else if(style===3){path(g,'M9 7Q15 1 23 7L24 9H8Z',coat);path(g,'M8 8h16','transparent','#dec395',.8);}
  if(style===0&&dir!==1){oval(g,23,23,1,1,'#e9cb88');}
  return c;
 });}
 ART.person=person;
 return {person,stats:()=>({entries:cache.size}),oval,path,grad,make};
})();
