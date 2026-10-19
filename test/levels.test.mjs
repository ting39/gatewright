import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, buildLibrary } from '../src/levels.js';
import { checkLevel, checkProgram, scoreOf } from '../src/check.js';
import { SOL, PROGRAMS, d } from './solutions.mjs';

const solved = {}, designs = {};
const libAt = (i) => buildLibrary(solved, designs, i);

test('every level has a passing reference solution, in order', () => {
  const table = [];
  for (const level of LEVELS) {
    if (level.free) continue;
    const lib = libAt(level.index);
    if (level.kind === 'program') {
      const r = checkProgram(level, PROGRAMS[level.id], designs.computer, buildLibrary(solved, designs));
      assert.ok(r.pass, `${level.id}: ${r.error || r.fail?.msg}`);
      table.push(`${level.id.padEnd(9)} size ${r.size} cycles ${r.cycles}`);
    } else {
      const sol = SOL[level.id];
      assert.ok(sol, 'missing reference for ' + level.id);
      const r = checkLevel(level, sol, lib);
      assert.ok(r.pass, `${level.id}: ${r.error || r.fail?.msg}`);
      const s = scoreOf(sol, lib);
      table.push(`${level.id.padEnd(9)} nand ${String(s.nand).padStart(5)} delay ${s.delay}  (${r.total} checks)`);
      if (level.par) assert.deepEqual({ nand: s.nand, delay: s.delay }, level.par, 'par for ' + level.id);
    }
    solved[level.id] = true;
    designs[level.id] = SOL[level.id];
  }
  console.log(table.join('\n'));
});

test('wrong designs fail with a useful message', () => {
  const lvl = LEVELS.find((l) => l.id === 'or');
  const r = checkLevel(lvl, d({ in: { a: 1, b: 1 }, out: { out: 1 }, parts: { n: 'NAND' }, wires: 'a>n.a b>n.b n>out' }), libAt(lvl.index));
  assert.equal(r.pass, false);
  assert.match(r.fail.msg, /Wrong output for a=0 b=0/);
});

test('an oscillating loop is reported, not hung', () => {
  const lvl = LEVELS.find((l) => l.id === 'not');
  const r = checkLevel(lvl, d({ in: { a: 1 }, out: { out: 1 }, parts: { n: 'NAND' }, wires: 'n>n.a n>n.b n>out' }), libAt(0));
  assert.equal(r.pass, false);
  assert.match(r.fail.msg, /never settles/);
});

test('a single latch is not a flip-flop', () => {
  const lvl = LEVELS.find((l) => l.id === 'dff');
  const r = checkLevel(lvl, d({ in: { d: 1, clk: 1 }, out: { q: 1 }, parts: { l: 'DLATCH' }, wires: 'd>l.d clk>l.en l.q>q' }), libAt(lvl.index));
  assert.equal(r.pass, false);
});

test('CPU with a swapped mux fails on the right cycle', () => {
  const lvl = LEVELS.find((l) => l.id === 'cpu');
  const bad = structuredClone(SOL.cpu);
  for (const w of bad.wires) if (w.to.part === 'ym' && w.to.pin === 'a') w.to.pin = 'b'; else if (w.to.part === 'ym' && w.to.pin === 'b') w.to.pin = 'a';
  const r = checkLevel(lvl, bad, buildLibrary(solved, designs, lvl.index));
  assert.equal(r.pass, false);
  assert.match(r.fail.msg, /cycle 1, running `ADD #3`/);
});

test('free-play demo assembles and draws', async () => {
  const { assemble, RefMachine } = await import('../src/isa.js');
  const l = LEVELS.find((x) => x.free);
  const a = assemble(l.starter);
  assert.equal(a.errors.length, 0);
  const m = new RefMachine(a.words);
  for (let i = 0; i < 400; i++) m.step();
  assert.ok([...m.ram.slice(0xe0)].some((v) => v), 'pen pixel drawn');
});
