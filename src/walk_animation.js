/* Small 2D mesh for the painted cutouts. Positions/collision/save data stay unchanged. */
const WALK_ART=(()=>{
 const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
 function phase(distance,moving,still=false){return !moving||still?0:1+Math.floor(((Math.max(0,distance)||0)%32)/4);}
 function pose(x,y,dir,frame){
  if(!frame)return [x,y];
  const angle=(frame-1)*TAU/8,beat=Math.sin(angle),bob=(1-Math.cos(angle*2))*.8;
  const side=dir>1,leg=clamp((y-55)/37),arm=clamp((y-25)/12)*clamp((65-y)/14);
  const half=Math.tanh((x-32)/3),outside=clamp((Math.abs(x-32)-8)/8);
  // Opposite feet advance and lift, knees flex; the pelvis and torso stay connected.
  const stride=beat*half,flex=Math.sin(leg*Math.PI),lift=Math.max(0,Math.cos(angle)*half);
  const dx=side?stride*leg*7:stride*leg*1.8+half*flex*Math.abs(beat)*1.1;
  const dy=-lift*leg*5.5+(side?0:stride*leg*1.8)-flex*Math.abs(beat)*1.4;
  const sway=beat*.8*clamp((78-y)/45),swing=-beat*half*outside*arm*(side?4.2:2.6);
  return [x+dx+sway+swing-(side?1.2:0),y+dy-bob*clamp((94-y)/24)+beat*half*outside*arm*.9];
 }
 function triangle(g,img,src,dst){
  const [[x0,y0],[x1,y1],[x2,y2]]=src,[[u0,v0],[u1,v1],[u2,v2]]=dst;
  const den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
  const a=((u1-u0)*(y2-y0)-(u2-u0)*(y1-y0))/den;
  const c=((u2-u0)*(x1-x0)-(u1-u0)*(x2-x0))/den;
  const b=((v1-v0)*(y2-y0)-(v2-v0)*(y1-y0))/den;
  const d=((v2-v0)*(x1-x0)-(v1-v0)*(x2-x0))/den;
  g.save();g.beginPath();
  // Slightly overlap triangle clips to avoid transparent seams at subpixel edges.
  const cx=(u0+u1+u2)/3,cy=(v0+v1+v2)/3;
  dst.forEach(([u,v],i)=>{const k=1.008;const xx=cx+(u-cx)*k,yy=cy+(v-cy)*k;if(i)g.lineTo(xx,yy);else g.moveTo(xx,yy);});
  g.closePath();g.clip();g.transform(a,b,c,d,u0-a*x0-c*y0,v0-b*x0-d*y0);g.drawImage(img,0,0);g.restore();
 }
 function render(img,dir,frame){
  if(!frame)return img;
  const c=document.createElement('canvas');c.width=64;c.height=96;c.artScale=4;
  const g=c.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  if(dir===3){g.translate(64,0);g.scale(-1,1);}
  const xs=[0,16,24,32,40,48,64],ys=[0,16,25,36,46,55,65,75,84,96];
  for(let yi=0;yi<ys.length-1;yi++)for(let xi=0;xi<xs.length-1;xi++){
   const p=[[xs[xi],ys[yi]],[xs[xi+1],ys[yi]],[xs[xi+1],ys[yi+1]],[xs[xi],ys[yi+1]]];
   const q=p.map(([x,y])=>pose(x,y,dir,frame));
   triangle(g,img,[p[0],p[1],p[2]],[q[0],q[1],q[2]]);
   triangle(g,img,[p[0],p[2],p[3]],[q[0],q[2],q[3]]);
  }
  return c;
 }
 return {phase,pose,render};
})();
