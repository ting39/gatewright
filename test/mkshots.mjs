// node test/mkshots.mjs  -> shots/<level>.json fixtures for ?shot&design=shots/<level>.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { LEVELS, buildLibrary } from '../src/levels.js';
import { SOL } from './solutions.mjs';
import { layout } from './layout.mjs';
mkdirSync('shots', { recursive: true });
const solved = {}, designs = {};
for (const l of LEVELS) {
  if (SOL[l.id]) {
    const lib = buildLibrary(solved, designs, l.index);
    const d = layout(structuredClone(SOL[l.id]), lib);
    for (const p of d.parts) if (p.type === 'IN' || p.type === 'OUT') p.id = (p.type === 'IN' ? 'in:' : 'out:') + p.cfg.name;
    for (const w of d.wires) { w.from.part = w.from.part.replace(/^I_/, 'in:'); w.to.part = w.to.part.replace(/^O_/, 'out:'); }
    writeFileSync(`shots/${l.id}.json`, JSON.stringify({ level: l.id, design: d, inputs: Object.fromEntries(l.io.in.map((q, i) => [q.name, i % 2 ? 0 : (q.width > 1 ? 37 : 1)])) }));
  }
  solved[l.id] = true; designs[l.id] = SOL[l.id];
}
console.log('ok');
import { PROGRAMS } from './solutions.mjs';
const comp = JSON.parse((await import('node:fs')).readFileSync('shots/computer.json', 'utf8')).design;
for (const id of ['p-sum', 'p-mul', 'p-x']) writeFileSync(`shots/${id}.json`, JSON.stringify({ level: id, code: PROGRAMS[id].trim() + '\n', computer: SOL.computer }));
void comp;
