import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const code = await readFile(resolve(import.meta.dirname, '../src/core.js'), 'utf8');
const start = code.indexOf('function pickTarget(run, seed){');
const end = code.indexOf('\nfunction enemyAction(', start);
assert.ok(start >= 0 && end > start);
const pickTarget = new Function(`${code.slice(start, end)}; return pickTarget;`)();

const run = { party: Array.from({ length: 4 }, () => ({ hp: 10 })) };
const counts = [0, 0, 0, 0];
for (let seed = 0; seed < 10; seed++) counts[pickTarget(run, seed)]++;
assert.deepEqual(counts, [4, 3, 2, 1]);
run.party[0].hp = 0;
for (let seed = 0; seed < 9; seed++) assert.notEqual(pickTarget(run, seed), 0);
run.party.forEach(p => { p.hp = 0; });
assert.equal(pickTarget(run, 0), -1);
console.log('Target weighting and KO exclusion OK');
