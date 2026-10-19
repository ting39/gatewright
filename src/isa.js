// Gatewright — the G8 instruction set: assembler, disassembler and reference CPU.
//
// Instruction word (16 bits):  [m][p][op2 op1 op0][s][t][j] k7..k0
//   addr = p ? P : k            Y = m ? RAM[addr] : k
//   A <- ALU(op, A, Y)          (j=1 forces op=000 and reuses op bits as the jump condition)
//   s: RAM[addr] <- A           t: P <- A           j: PC <- k if (lt&A<0)|(eq&A==0)|(gt&A>0)

export const OPS = ['KEEP', 'LDA', 'ADD', 'SUB', 'AND', 'OR', 'XOR', 'SHL'];
export const ALU = (op, x, y) => {
  switch (op & 7) {
    case 0: return x & 255;
    case 1: return y & 255;
    case 2: return (x + y) & 255;
    case 3: return (x - y) & 255;
    case 4: return x & y & 255;
    case 5: return (x | y) & 255;
    case 6: return (x ^ y) & 255;
    default: return (x << 1) & 255;
  }
};
export const condMet = (cond, a) => {
  const neg = (a & 0x80) !== 0, zero = (a & 255) === 0;
  return !!(((cond & 4) && neg) || ((cond & 2) && zero) || ((cond & 1) && !neg && !zero));
};

const ALU_OPS = { LDA: 1, ADD: 2, SUB: 3, AND: 4, OR: 5, XOR: 6 };
const JUMPS = { JMP: 7, JZ: 2, JNZ: 5, JN: 4, JP: 1, JNN: 3, JLE: 6 };
const JUMP_NAME = Object.fromEntries(Object.entries(JUMPS).map(([k, v]) => [v, k]));
export const MNEMONICS = ['NOP', 'HLT', 'SHL', 'TAP', 'STA', ...Object.keys(ALU_OPS), ...Object.keys(JUMPS)];
export const PREDEFINED = { SCREEN: 0xe0, OUT: 0xde, KEYS: 0xdf };

export const encode = ({ m = 0, p = 0, op = 0, s = 0, t = 0, j = 0, k = 0 }) =>
  (((m << 7) | (p << 6) | ((op & 7) << 3) | (s << 2) | (t << 1) | j) << 8) | (k & 255);

export const decode = (w) => {
  const hi = w >>> 8;
  return { m: (hi >> 7) & 1, p: (hi >> 6) & 1, op: (hi >> 3) & 7, s: (hi >> 2) & 1, t: (hi >> 1) & 1, j: hi & 1, k: w & 255 };
};

const hex2 = (v) => '0x' + (v & 255).toString(16).toUpperCase().padStart(2, '0');

export function disassemble(w, pc) {
  const d = decode(w);
  const operand = d.p ? '[P]' : d.m ? hex2(d.k) : '#' + d.k;
  if (d.j) {
    if (d.op === 7 && pc !== undefined && d.k === pc) return 'HLT';
    return (JUMP_NAME[d.op] || 'J?' + d.op) + ' ' + d.k + (d.s || d.t || d.m || d.p ? ' …' : '');
  }
  const parts = [];
  if (d.op === 7) parts.push('SHL');
  else if (d.op) parts.push(OPS[d.op] + ' ' + operand);
  if (d.s) parts.push('STA ' + (d.p ? '[P]' : hex2(d.k)));
  if (d.t) parts.push('TAP');
  return parts.length ? parts.join(' + ') : 'NOP';
}

// ---------------------------------------------------------------------------
// Assembler
// ---------------------------------------------------------------------------

function parseNumber(tok) {
  if (/^-?0x[0-9a-f]+$/i.test(tok)) return tok[0] === '-' ? -parseInt(tok.slice(3), 16) : parseInt(tok, 16);
  if (/^-?0b[01]+$/i.test(tok)) return tok[0] === '-' ? -parseInt(tok.slice(3), 2) : parseInt(tok.slice(2), 2);
  if (/^-?\d+$/.test(tok)) return parseInt(tok, 10);
  if (/^'.'$/.test(tok)) return tok.charCodeAt(1);
  return null;
}

function evalExpr(expr, syms) {
  // number | symbol | term (+|-) term ...
  const toks = expr.replace(/\s+/g, '').match(/[+-]?[^+-]+/g);
  if (!toks) throw new Error('missing value');
  let v = 0;
  for (let t of toks) {
    let sign = 1;
    if (t[0] === '+') t = t.slice(1);
    else if (t[0] === '-') { sign = -1; t = t.slice(1); }
    let n = parseNumber(t);
    if (n === null) {
      if (!/^[A-Za-z_]\w*$/.test(t)) throw new Error(`can't read "${t}"`);
      if (!(t in syms)) {
        const up = t.toUpperCase();
        if (up in PREDEFINED) n = PREDEFINED[up];
        else throw new Error(`unknown name "${t}"`);
      } else n = syms[t];
    }
    v += sign * n;
  }
  return v;
}

const byteOf = (v) => {
  if (v < -128 || v > 255) throw new Error(`value ${v} doesn't fit in a byte (−128…255)`);
  return v & 255;
};

export function assemble(src) {
  const lines = src.split('\n');
  const syms = {};
  const errors = [];
  const items = []; // {line, mn, arg}
  // Pass 1: labels, constants, instruction addresses.
  let pc = 0;
  lines.forEach((raw, ln) => {
    let text = raw.replace(/;.*/, '').trim();
    if (!text) return;
    let m;
    while ((m = text.match(/^([A-Za-z_]\w*)\s*:\s*/))) {
      if (m[1] in syms) errors.push({ line: ln, msg: `"${m[1]}" is defined twice` });
      syms[m[1]] = pc;
      text = text.slice(m[0].length);
    }
    if (!text) return;
    if ((m = text.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/))) {
      items.push({ line: ln, constant: m[1], expr: m[2] });
      return;
    }
    const sp = text.search(/\s/);
    const mn = (sp < 0 ? text : text.slice(0, sp)).toUpperCase();
    const arg = sp < 0 ? '' : text.slice(sp).trim();
    items.push({ line: ln, mn, arg, addr: pc });
    pc++;
  });
  // Constants may refer to each other in any order: resolve iteratively.
  const consts = items.filter((x) => x.constant);
  for (let pass = 0; pass < consts.length + 1; pass++) {
    for (const c of consts) {
      try { const v = evalExpr(c.expr, syms); if (c.constant in syms && syms[c.constant] !== v && pass === 0 && !c.done) errors.push({ line: c.line, msg: `"${c.constant}" is defined twice` }); syms[c.constant] = v; c.done = true; } catch (e) { c.err = e.message; }
    }
  }
  for (const c of consts) if (!c.done) errors.push({ line: c.line, msg: c.err });

  if (pc > 256) errors.push({ line: lines.length - 1, msg: `program is ${pc} instructions; the ROM holds 256` });
  const words = new Uint16Array(256);
  const lineAddr = new Array(lines.length).fill(-1);
  for (const it of items) {
    if (it.constant) continue;
    lineAddr[it.line] = it.addr;
    try {
      words[it.addr & 255] = encodeLine(it.mn, it.arg, it.addr, syms);
    } catch (e) {
      errors.push({ line: it.line, msg: e.message });
    }
  }
  errors.sort((a, b) => a.line - b.line);
  return { words, size: pc, errors, lineAddr, symbols: syms };
}

function encodeLine(mn, arg, addr, syms) {
  const noArg = () => { if (arg) throw new Error(`${mn} takes no operand`); };
  const memOperand = (a) => {
    if (/^\[\s*p\s*\]$/i.test(a)) return { m: 1, p: 1, k: 0 };
    if (/^\[.*\]$/.test(a)) throw new Error('only [P] can go in brackets; write a plain address for direct memory');
    return { m: 1, p: 0, k: byteOf(evalExpr(a, syms)) };
  };
  if (mn === 'NOP') { noArg(); return 0; }
  if (mn === 'SHL') { noArg(); return encode({ op: 7 }); }
  if (mn === 'TAP') { noArg(); return encode({ t: 1 }); }
  if (mn === 'HLT') { noArg(); return encode({ j: 1, op: 7, k: addr }); }
  if (mn in ALU_OPS) {
    if (!arg) throw new Error(`${mn} needs an operand: #value, an address, or [P]`);
    if (arg[0] === '#') return encode({ op: ALU_OPS[mn], k: byteOf(evalExpr(arg.slice(1), syms)) });
    return encode({ op: ALU_OPS[mn], ...memOperand(arg) });
  }
  if (mn === 'STA') {
    if (!arg) throw new Error('STA needs an address or [P]');
    if (arg[0] === '#') throw new Error("STA stores into memory; it can't take an immediate #value");
    const o = memOperand(arg);
    return encode({ s: 1, p: o.p, k: o.k });
  }
  if (mn in JUMPS) {
    if (!arg) throw new Error(`${mn} needs a target label`);
    if (arg[0] === '#' || arg[0] === '[') throw new Error(`${mn} jumps to a ROM address or label`);
    return encode({ j: 1, op: JUMPS[mn], k: byteOf(evalExpr(arg, syms)) });
  }
  throw new Error(`unknown instruction "${mn}"`);
}

// ---------------------------------------------------------------------------
// Reference CPU (the spec the player's CPU is checked against)
// ---------------------------------------------------------------------------

export class RefMachine {
  constructor(rom) {
    this.rom = rom || new Uint16Array(256);
    this.ram = new Uint8Array(256);
    this.buttons = 0;
    this.outLog = [];
    this.reset();
  }
  reset() { this.pc = 0; this.a = 0; this.p = 0; this.cycles = 0; }
  read(addr) { return addr === 0xdf ? this.buttons & 255 : this.ram[addr]; }
  write(addr, v) { this.ram[addr] = v; if (addr === 0xde) this.outLog.push(v); }
  // Signals the CPU must present during the current cycle (before the clock edge).
  signals(word = this.rom[this.pc]) {
    const d = decode(word);
    const addr = d.p ? this.p : d.k;
    return { pc: this.pc, addr, out: this.a, write: d.s };
  }
  halted() {
    const d = decode(this.rom[this.pc]);
    return d.j === 1 && d.op === 7 && d.k === this.pc;
  }
  step() {
    const d = decode(this.rom[this.pc]);
    const addr = d.p ? this.p : d.k;
    const y = d.m ? this.read(addr) : d.k;
    const a = this.a;
    const newA = ALU(d.j ? 0 : d.op, a, y);
    const jump = d.j && condMet(d.op, a);
    if (d.s) this.write(addr, a);
    if (d.t) this.p = a;
    this.a = newA;
    this.pc = jump ? d.k : (this.pc + 1) & 255;
    this.cycles++;
  }
  run(limit = 100000) {
    while (!this.halted() && this.cycles < limit) this.step();
    return this.halted();
  }
}
