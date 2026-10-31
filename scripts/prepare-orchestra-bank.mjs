import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),sha='440300901dfe9275fd84e0b7763af1f8443ae62e',base='https://raw.githubusercontent.com/sgossner/VSCO-2-CE/'+sha+'/';
const selected=[
 ['strings',69,'Strings/Violin Section/susVib/VlnEns_susVib_A3_v2.wav',true],
 ['strings',62,'Strings/Violin Section/susVib/VlnEns_susVib_D3_v2.wav',true],
 ['strings',72,'Strings/Violin Section/susVib/VlnEns_susVib_C4_v2.wav',true],
 ['cello',60,'Strings/Cello Section/susvib/susvib_C3_v1_1.wav',true],
 ['cello',47,'Strings/Cello Section/susvib/susvib_B1_v1_1.wav',true],
 ['bass',36,'Strings/Solo Contrabass/SusNV/BKCtbss_SusNV_C1_v1_rr1.wav',true],
 ['horn',60,'Brass/F Horn/sus/MOHorn_sus_C3_v2_1.wav',true],
 ['horn',53,'Brass/F Horn/sus/MOHorn_sus_F2_v2_1.wav',true],
 ['trumpet',67,'Brass/Trumpet/sus/Sum_SHTrumpet_sus_G3_v3_rr1.wav',true],
 ['trumpet',84,'Brass/Trumpet/sus/Sum_SHTrumpet_sus_C5_v3_rr1.wav',true],
 ['flute',72,'Woodwinds/Flute/susNV/LDFlute_susNV_C4_v3_1.wav',true],
 ['flute',84,'Woodwinds/Flute/susNV/LDFlute_susNV_C5_v2_1.wav',true],
 ['oboe',62,'Woodwinds/Oboe/Sus/Oboe_Sus_D3_v3_Main.wav',true],
 ['harp',48,'Strings/Harp/KSHarp_C3_mf.wav',false],
 ['harp',72,'Strings/Harp/KSHarp_C5_mf.wav',false],
 ['pizz',69,'Strings/Violin Section/Pizz/VlnEns_Pizz_A3_v2_rr1.wav',false],
 ['spiccato',69,'Strings/Violin Section/Spic/VlnEns_Spic_A3_v2_rr1.wav',false],
 ['spiccato',69,'Strings/Violin Section/Spic/VlnEns_Spic_A3_v2_rr2.wav',false],
 ['glock',84,'Percussion/Glock/glock_medium_C5.wav',false],
 ['timpani',47,'Percussion/Timpani/Timpani2_Hit_v3_rr1_Sum.wav',false]
];
await mkdir(new URL('.task/vsco/',root),{recursive:true});await mkdir(new URL('assets/audio/',root),{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
function decodeWav(bytes){let fmt,data;for(let p=12;p+8<bytes.length;){const id=bytes.toString('ascii',p,p+4),n=bytes.readUInt32LE(p+4);if(id==='fmt ')fmt=bytes.subarray(p+8,p+8+n);if(id==='data')data=bytes.subarray(p+8,p+8+n);p+=8+n+(n%2);}if(!fmt||!data)throw Error('invalid WAV');const format=fmt.readUInt16LE(0),channels=fmt.readUInt16LE(2),rate=fmt.readUInt32LE(4),bits=fmt.readUInt16LE(14),stride=bits/8,out=new Float32Array(data.length/stride/channels);if(![1,3,65534].includes(format)||![16,24,32].includes(bits))throw Error('unsupported WAV');for(let i=0;i<out.length;i++){let sum=0;for(let c=0;c<channels;c++){const off=(i*channels+c)*stride;sum+=format===3?data.readFloatLE(off):bits===16?data.readInt16LE(off)/32768:bits===24?data.readIntLE(off,3)/8388608:data.readInt32LE(off)/2147483648;}out[i]=sum/channels;}return {rate,samples:out};}
const locked=await readFile(new URL('assets/audio/SOURCES.json',root),'utf8').then(t=>JSON.parse(t).samples).catch(()=>[]);
const reports=[],bank=[];
for(const[instrument,rootNote,path,sustain]of selected){const file=new URL('.task/vsco/'+path.split('/').at(-1),root);let wav=await readFile(file).catch(()=>null);if(!wav){const res=await fetch(base+path.split('/').map(encodeURIComponent).join('/'));if(!res.ok)throw Error(path+': '+res.status);wav=Buffer.from(await res.arrayBuffer());await writeFile(file,wav);}
 const expected=locked.find(s=>s.path===path)?.sourceSHA256;if(expected&&hash(wav)!==expected)throw Error('source sample hash differs: '+path);
 const {rate,samples}=decodeWav(wav),targetRate=22050;let peak=0;for(const n of samples)peak=Math.max(peak,Math.abs(n));let start=0;while(start<samples.length&&Math.abs(samples[start])<peak*.004)start++;start=Math.max(0,start-Math.round(rate*.006));const count=Math.min(Math.round(targetRate*(sustain?2.8:3.2)),Math.floor((samples.length-start)*targetRate/rate)),pcm=new Float32Array(count);let max=0;
 for(let i=0;i<count;i++){const p=start+i*rate/targetRate,a=Math.floor(p),f=p-a;pcm[i]=((samples[a]||0)*(1-f)+(samples[a+1]||0)*f);max=Math.max(max,Math.abs(pcm[i]));}
 const scale=.82/Math.max(.001,max);for(let i=0;i<count;i++)pcm[i]*=scale;
 // Verify the sample's octave against its named pitch: the source uses C3 = MIDI 60.
 const energy=f=>{let a=0,b=0;const n=Math.min(8192,count-5000);for(let i=0;i<n;i++){const v=pcm[5000+i]*Math.sin(Math.PI*i/n)**2,t=2*Math.PI*f*i/targetRate;a+=v*Math.cos(t);b+=v*Math.sin(t);}return a*a+b*b;};
 const candidates=[rootNote-12,rootNote,rootNote+12].map(n=>({note:n,power:energy(440*2**((n-69)/12))}));reports.push({instrument,path,root:rootNote,rate,seconds:samples.length/rate,sourceSHA256:hash(wav),pitchCandidates:candidates});
 let loopStart=0,loopEnd=0;if(sustain){loopStart=Math.round(targetRate*.8);loopEnd=Math.min(count-256,Math.round(targetRate*2.55));const period=targetRate/(440*2**((rootNote-69)/12));loopEnd=loopStart+Math.round((loopEnd-loopStart)/period)*period;loopEnd=Math.floor(loopEnd);const fade=128;for(let i=0;i<fade;i++){const w=i/(fade-1);pcm[loopEnd-fade+i]=pcm[loopEnd-fade+i]*(1-w)+pcm[loopStart-fade+i]*w;}}
 const binary=Buffer.alloc(count*2);for(let i=0;i<count;i++){const fade=Math.min(1,i/80,(count-1-i)/160);binary.writeInt16LE(Math.round(Math.max(-1,Math.min(1,pcm[i]*fade))*32767),i*2);}bank.push({instrument,root:rootNote,rate:targetRate,loopStart:loopStart/targetRate,loopEnd:loopEnd/targetRate,pcm:binary.toString('base64')});console.log(instrument+' '+rootNote+' '+binary.length+' bytes');
}
await writeFile(new URL('assets/audio/orchestra-bank.json',root),JSON.stringify({version:1,samples:bank})+'\n');await writeFile(new URL('assets/audio/SOURCES.json',root),JSON.stringify({library:'VSCO 2 Community Edition',author:'Versilian Studios',license:'CC0-1.0',repository:'https://github.com/sgossner/VSCO-2-CE',commit:sha,processing:'Mono PCM16, 22050 Hz, trimmed attacks and tails, peak normalized, sustaining loop crossfade; pitch roots verified from waveform; harp uses scientific octave names while other pitched instruments use C3 = MIDI 60',samples:reports},null,2)+'\n');
if(!await readFile(new URL('assets/audio/VSCO-CC0.txt',root)).catch(()=>null)){const license=await fetch(base+'LICENSE');if(!license.ok)throw Error('license download failed');await writeFile(new URL('assets/audio/VSCO-CC0.txt',root),await license.text());}
