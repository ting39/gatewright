// Gatewright — level checker. Pure module.

import { compile } from './sim.js';
import { designNandCount, mask } from './chips.js';
import { RefMachine, assemble, decode } from './isa.js';
import { xScreen } from './levels.js';

export function rng(seed = 0x9e3779b9) {
  let a = seed >>> 0;
  const f = (n) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  };
  return f;
}

export function combVectors(level, r = rng(7)) {
  if (level.tests) return level.tests(r);
  const ins = level.io.in;
  const bits = ins.reduce((s, q) => s + q.width, 0);
  const out = [];
  if (bits <= 12) {
    for (let v = 0; v < 1 << bits; v++) {
      const o = {}; let sh = 0;
      // first input = most significant, so truth tables read naturally
      for (let k = ins.length - 1; k >= 0; k--) { o[ins[k].name] = (v >> sh) & mask(ins[k].width); sh += ins[k].width; }
      out.push(o);
    }
    return out;
  }
  const corners = (w) => w === 1 ? [0, 1] : [0, 1, 0x7f, 0x80, mask(w)];
  for (let i = 0; i < 48; i++) { const o = {}; for (const q of ins) { const c = corners(q.width); o[q.name] = c[(i + q.name.length * 3 + ins.indexOf(q) * 7) % c.length]; } out.push(o); }
  for (let i = 0; i < 400; i++) { const o = {}; for (const q of ins) o[q.name] = r(mask(q.width) + 1); out.push(o); }
  return out;
}

const fmtIO = (o, pins) => pins.map((q) => q.name + '=' + (o[q.name] ?? '?')).join(' ');

export function scoreOf(design, lib) {
  let delay = null, cyclic = false;
  try { const a = compile(design, lib).analyze(); delay = a.delay; cyclic = a.cyclic; } catch { /* ignore */ }
  return { nand: designNandCount(design, lib), delay: cyclic ? null : delay };
}

// Returns { pass, total, passed, rows: [{inputs, expected, got, ok}], fail: {...}|null, error }
export function checkLevel(level, design, lib, opts = {}) {
  try {
    switch (level.kind) {
      case 'comb': return checkComb(level, design, lib, opts);
      case 'clk': return checkSteps(level, design, lib, false);
      case 'seq': return checkSteps(level, design, lib, true);
      case 'cpu': return checkCpu(design, lib);
      case 'computer': return checkComputer(design, lib);
      default: return { pass: false, error: 'not a circuit level' };
    }
  } catch (e) {
    return { pass: false, error: 'Simulation error: ' + e.message, rows: [], total: 0, passed: 0 };
  }
}

function compare(level, expected, c) {
  const got = {};
  let ok = true;
  for (const q of level.io.out) {
    got[q.name] = c.get(q.name);
    const e = expected[q.name];
    if (e !== null && e !== undefined && ((e & mask(q.width)) >>> 0) !== got[q.name]) ok = false;
  }
  return { got, ok };
}

function checkComb(level, design, lib) {
  const c = compile(design, lib);
  const vecs = combVectors(level);
  const rows = [];
  let passed = 0, fail = null;
  for (const v of vecs) {
    c.setAll(v);
    const stable = c.evaluate();
    const expected = level.spec(v);
    const { got, ok } = compare(level, expected, c);
    const row = { inputs: v, expected, got, ok: ok && stable };
    if (!stable) row.note = 'never settles';
    rows.push(row);
    if (row.ok) passed++;
    else if (!fail) fail = { index: rows.length - 1, ...row, msg: (stable ? 'Wrong output' : 'Your circuit never settles (it oscillates)') + ' for ' + fmtIO(v, level.io.in) };
  }
  return { pass: !fail, total: rows.length, passed, rows, fail, kind: 'comb' };
}

function checkSteps(level, design, lib, clocked) {
  const c = compile(design, lib);
  c.reset();
  const st = level.spec.init();
  const steps = level.steps(rng(11));
  const rows = [];
  let passed = 0, fail = null;
  for (let i = 0; i < steps.length; i++) {
    const v = steps[i];
    c.setAll(v);
    const stable = c.evaluate();
    const expected = clocked ? level.spec.out(v, st) : level.spec.eval(v, st);
    const { got, ok } = compare(level, expected, c);
    const row = { step: i, inputs: v, expected, got, ok: ok && stable };
    if (!stable) row.note = 'never settles';
    rows.push(row);
    if (row.ok) passed++;
    else if (!fail) fail = { index: i, ...row, msg: (stable ? 'Wrong output' : 'Your circuit never settles') + ` at step ${i + 1} (${fmtIO(v, level.io.in)})` };
    if (fail) break;
    if (clocked) { level.spec.next(v, st); c.tick(); }
  }
  return { pass: !fail, total: steps.length, passed, rows, fail, kind: clocked ? 'seq' : 'clk', sequence: true };
}

// ---------------------------------------------------------------------------
// CPU: lock-step against the reference machine.
// ---------------------------------------------------------------------------

export const CPU_TESTS = [
  { name: 'arithmetic', src: `
        LDA #5
        ADD #3        ; 8
        SUB #10       ; 254
        AND #0x0F     ; 14
        OR  #0x30     ; 62
        XOR #0xFF     ; 193
        SHL           ; 130
        STA 7
        LDA #1
        ADD 7         ; 131
        STA 8
        SUB 8         ; 0
        NOP
        HLT` },
  { name: 'jumps', src: `
        LDA #0
        JZ  a         ; taken
        LDA #99
a:      JNZ bad       ; not taken
        JN  bad
        JP  bad
        JNN b         ; taken (0 >= 0)
        HLT
b:      JLE c         ; taken
        HLT
c:      LDA #200      ; negative
        JP  bad
        JZ  bad
        JN  d         ; taken
        HLT
d:      LDA #3
loop:   SUB #1
        STA 0x10
        JNZ loop
        LDA #9
        JLE bad
        JMP done
bad:    LDA #0xEE
        STA 0x11
done:   HLT` },
  { name: 'pointer', src: `
        LDA #0x40
        TAP           ; P = 0x40
        LDA #7
        STA [P]       ; RAM[0x40] = 7
        ADD [P]       ; 14
        STA 0x41
        LDA #0x41
        TAP
        LDA #0
        LDA [P]       ; 14
        SUB [P]       ; 0
        OR  0x40      ; 7
        STA OUT
        STA [P]
        HLT` },
];

export function checkCpu(design, lib) {
  const rows = [];
  let passed = 0, total = 0, fail = null;
  for (const t of CPU_TESTS) {
    const asm = assemble(t.src);
    if (asm.errors.length) throw new Error('bad test program: ' + asm.errors[0].msg);
    const ref = new RefMachine(asm.words);
    const ram = new Uint8Array(256);
    const c = compile(design, lib);
    c.reset();
    for (let cyc = 0; cyc < 300; cyc++) {
      settleCpu(c, asm.words, ram, 0);
      const exp = ref.signals();
      const got = { pc: c.get('pc'), addr: c.get('addr'), out: c.get('out'), write: c.get('write') };
      const d = decode(asm.words[ref.pc]);
      const usesMem = d.m || d.s;
      const ok = !c.unstable.size && got.pc === exp.pc && got.out === exp.out && got.write === exp.write && (!usesMem || got.addr === exp.addr);
      total++;
      const row = { test: t.name, cycle: cyc, inputs: { instr: asm.words[ref.pc] }, expected: exp, got, ok, disasm: lineFor(t.src, asm, ref.pc) };
      rows.push(row);
      if (!ok) { fail = { index: rows.length - 1, ...row, msg: `Program "${t.name}", cycle ${cyc}, running \`${row.disasm}\`: expected pc=${exp.pc} out=${exp.out} write=${exp.write}${usesMem ? ' addr=' + exp.addr : ''}, got pc=${got.pc} out=${got.out} write=${got.write}${usesMem ? ' addr=' + got.addr : ''}` }; break; }
      passed++;
      if (ref.halted()) break;
      if (got.write) { ram[got.addr] = got.out; }
      c.tick();
      ref.step();
    }
    if (fail) break;
    // reset pulls PC back to 0
    c.set('reset', 1); c.evaluate(); c.tick(); c.set('reset', 0); c.evaluate();
    total++;
    const pc = c.get('pc');
    const ok = pc === 0;
    rows.push({ test: t.name, cycle: 'reset', inputs: { reset: 1 }, expected: { pc: 0 }, got: { pc }, ok });
    if (!ok) { fail = { index: rows.length - 1, msg: `After a tick with reset = 1, pc should be 0 but is ${pc}` }; break; }
    passed++;
  }
  return { pass: !fail, total, passed, rows, fail, kind: 'cpu', sequence: true };
}

function lineFor(src, asm, addr) {
  const lines = src.split('\n');
  const i = asm.lineAddr.indexOf(addr);
  return i >= 0 ? lines[i].replace(/;.*/, '').replace(/^\s*\w+:\s*/, '').trim() : '?';
}

function settleCpu(c, rom, ram, reset) {
  c.set('reset', reset);
  let instr = -1, data = -1;
  for (let k = 0; k < 6; k++) {
    const ni = rom[c.get('pc') & 255], nd = ram[c.get('addr') & 255];
    if (ni === instr && nd === data) break;
    instr = ni; data = nd;
    c.set('instr', instr); c.set('data', data);
    c.evaluate();
  }
}

// ---------------------------------------------------------------------------
// Computer + programs: run on the player's own machine.
// ---------------------------------------------------------------------------

export const COMPUTER_TEST = `
; countdown to the output port, a pointer walk and a shift
        LDA #5
loop:   STA OUT
        SUB #1
        JNZ loop
        LDA #0x30
        TAP
        LDA #0x81
        STA [P]
        SHL
        STA 0x31
        ADD 0x30
        STA 0x32
        HLT
`;

export class Machine {
  constructor(design, lib) {
    this.c = compile(design, lib);
    this.rom = this.c.devices.rom;
    this.ram = this.c.devices.ram;
    this.ok = !!(this.rom && this.ram);
  }
  load(words, ramInit = {}) {
    this.c.reset();
    this.rom.st.mem.set(words);
    for (const k in ramInit) this.ram.st.mem[+k] = ramInit[k];
    this.c.set('reset', 0);
    this.c.evaluate();
  }
  get pc() { return this.c.get('pc'); }
  get mem() { return this.ram.st.mem; }
  get outLog() { return this.ram.st.outLog; }
  set buttons(v) { this.ram.st.buttons = v; }
  halted() {
    const pc = this.pc;
    const d = decode(this.rom.st.mem[pc]);
    return d.j === 1 && d.op === 7 && d.k === pc;
  }
  step() { return this.c.tick(); }
  run(limit) {
    let n = 0;
    while (n < limit && !this.halted()) { this.c.tick(); n++; }
    return n;
  }
}

export function checkComputer(design, lib) {
  const m = new Machine(design, lib);
  if (!m.ok) return { pass: false, error: 'Your computer needs one ROM and one RAM 256.', rows: [], total: 0, passed: 0 };
  const asm = assemble(COMPUTER_TEST);
  const ref = new RefMachine(asm.words);
  m.load(asm.words);
  const rows = [];
  let fail = null;
  for (let cyc = 0; cyc < 200; cyc++) {
    const ok = m.pc === ref.pc && !m.c.unstable.size;
    const row = { cycle: cyc, expected: { pc: ref.pc }, got: { pc: m.pc }, ok, disasm: lineFor(COMPUTER_TEST, asm, ref.pc) };
    rows.push(row);
    if (!ok) { fail = { index: rows.length - 1, ...row, msg: `Cycle ${cyc}: expected pc=${ref.pc}, got ${m.pc}` }; break; }
    if (ref.halted()) break;
    m.step(); ref.step();
  }
  if (!fail) {
    for (let a = 0; a < 256; a++) if (m.mem[a] !== ref.ram[a]) { fail = { msg: `After the program, RAM[${a}] should be ${ref.ram[a]} but is ${m.mem[a]}` }; break; }
    if (!fail && m.outLog.join() !== ref.outLog.join()) fail = { msg: `Output port should show ${ref.outLog.join(', ')} but shows ${m.outLog.join(', ') || 'nothing'}` };
    rows.push({ cycle: 'end', expected: { out: ref.outLog.join(',') }, got: { out: m.outLog.join(',') }, ok: !fail });
  }
  return { pass: !fail, total: rows.length, passed: rows.filter((r) => r.ok).length, rows, fail, kind: 'computer', sequence: true };
}

// Same interface as Machine, backed by the reference CPU (used when no computer design exists).
export class RefAdapter {
  constructor() { this.ok = true; this.ref = new RefMachine(); }
  load(words, ram = {}) { this.ref = new RefMachine(Uint16Array.from(words)); for (const k in ram) this.ref.ram[+k] = ram[k]; }
  get pc() { return this.ref.pc; }
  get mem() { return this.ref.ram; }
  get outLog() { return this.ref.outLog; }
  set buttons(v) { this.ref.buttons = v; }
  halted() { return this.ref.halted(); }
  step() { this.ref.step(); return true; }
  run(limit) { let n = 0; while (n < limit && !this.halted()) { this.step(); n++; } return n; }
}

export function checkProgram(level, src, design, lib) {
  const asm = assemble(src);
  if (asm.errors.length) return { pass: false, error: `Line ${asm.errors[0].line + 1}: ${asm.errors[0].msg}`, asm, rows: [] };
  const m = design ? new Machine(design, lib) : new RefAdapter();
  if (!m.ok) return { pass: false, error: 'Your computer design is missing its ROM or RAM.', rows: [] };
  const rows = [];
  let fail = null, maxCycles = 0;
  level.cases.forEach((cs, i) => {
    if (fail) return;
    m.load(asm.words, cs.ram);
    const cycles = m.run(level.limit);
    maxCycles = Math.max(maxCycles, cycles);
    const halted = m.halted();
    let ok = halted, msg = '';
    let expected, got;
    if (!halted) msg = `didn't halt within ${level.limit} cycles`;
    if (cs.expect === 'x') {
      const want = xScreen();
      const have = m.mem.slice(0xe0, 0x100);
      expected = { screen: 'X' }; got = { screen: [...have].map((x) => x.toString(16).padStart(2, '0')).join('') };
      if (ok) for (let k = 0; k < 32; k++) if (want[k] !== have[k]) { ok = false; msg = `screen row ${k >> 1} (byte 0x${(0xe0 + k).toString(16).toUpperCase()}) should be ${want[k].toString(2).padStart(8, '0')} but is ${have[k].toString(2).padStart(8, '0')}`; break; }
    } else {
      expected = {}; got = {};
      for (const a in cs.expect) {
        expected['RAM[' + a + ']'] = cs.expect[a];
        got['RAM[' + a + ']'] = m.mem[+a];
        if (ok && m.mem[+a] !== cs.expect[a]) { ok = false; msg = `RAM[${a}] should be ${cs.expect[a]} but is ${m.mem[+a]}`; }
      }
    }
    const row = { test: i, inputs: Object.fromEntries(Object.entries(cs.ram).map(([k, v]) => ['RAM[' + k + ']', v])), expected, got, ok, cycles };
    rows.push(row);
    if (!ok) fail = { index: i, ...row, msg: `Case ${i + 1} (${Object.entries(row.inputs).map(([k, v]) => k + '=' + v).join(', ') || 'blank RAM'}): ${msg}` };
  });
  return { pass: !fail, total: level.cases.length, passed: rows.filter((r) => r.ok).length, rows, fail, size: asm.size, cycles: maxCycles, kind: 'program', asm };
}
