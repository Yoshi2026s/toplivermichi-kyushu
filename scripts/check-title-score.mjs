import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/audio.js',import.meta.url),'utf8');
const api=runInNewContext(source.replace('return { play, jingle,','return { SONGS,compile,play,jingle,')+';SND');
const score=api.SONGS.title,compiled=api.compile(score);
assert.equal(score.style,'overture');assert.equal(compiled.bars.length,32);assert.equal(compiled.steps,256);
for(const name of ['lead','leadAlt']){const bars=score[name].split('|');assert.equal(bars.length,32);for(const bar of bars){const tokens=bar.trim().split(/\s+/);assert.equal(tokens.length,8,'one complete 4/4 bar');for(const note of tokens)assert(/^(?:[A-G][#b]?\d|\.|-)$/.test(note));}}
assert.notEqual(score.lead,score.leadAlt);assert(compiled.lead.every(e=>e.step+e.len<=256));
assert.equal(new Set(score.chords.split(' ')).size,6);
console.log('Original title overture: 32 complete bars, two distinct cycles, valid notes and section harmony');
