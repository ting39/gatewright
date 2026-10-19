// Gatewright — primitive parts and the chip library.
// Pure module: loads in the browser and in Node (tests).

export const mask = (w) => (w >= 32 ? 0xffffffff : (1 << w) - 1) >>> 0;

// ---------------------------------------------------------------------------
// Primitive & wiring parts. A model is
//   { combDeps, init(), eval(ins, st) -> outs[], tick?(ins, st) }
// combDeps=false means outputs depend only on state (clocked parts).
// ---------------------------------------------------------------------------

const nandModel = (w) => {
  const m = mask(w);
  return { combDeps: true, init: () => null, eval: (i) => [~(i[0] & i[1]) & m] };
};

// Parameterised parts: pins depend on part.cfg.
export const PRIMS = {
  NAND: {
    label: 'NAND', kind: 'gate', laneable: true, nand: 1, delay: 1,
    pins: () => ({ in: [{ name: 'a', width: 1 }, { name: 'b', width: 1 }], out: [{ name: 'out', width: 1 }] }),
    model: () => nandModel(1),
    blurb: 'The only gate you start with. Output is 0 only when both inputs are 1.',
  },
  IN: {
    label: 'Input', kind: 'io',
    pins: (cfg) => ({ in: [], out: [{ name: 'out', width: cfg.width || 1 }] }),
  },
  OUT: {
    label: 'Output', kind: 'io',
    pins: (cfg) => ({ in: [{ name: 'in', width: cfg.width || 1 }], out: [] }),
  },
  SPLIT: {
    label: 'Split', kind: 'wire', nand: 0, delay: 0,
    defaults: { widths: [1, 1, 1, 1, 1, 1, 1, 1] },
    pins: (cfg) => {
      const ws = cfg.widths;
      const total = ws.reduce((a, b) => a + b, 0);
      return { in: [{ name: 'in', width: total }], out: ws.map((w, i) => ({ name: 'o' + i, width: w, bits: bitRange(ws, i) })) };
    },
    model: (cfg) => {
      const ws = cfg.widths;
      return { combDeps: true, init: () => null, eval: (i) => {
        let v = i[0]; const o = new Array(ws.length);
        for (let k = 0; k < ws.length; k++) { o[k] = v & mask(ws[k]); v >>>= ws[k]; }
        return o;
      } };
    },
    blurb: 'Breaks a bus into smaller buses or single wires. Output 0 carries the lowest bits.',
  },
  JOIN: {
    label: 'Join', kind: 'wire', nand: 0, delay: 0,
    defaults: { widths: [1, 1, 1, 1, 1, 1, 1, 1] },
    pins: (cfg) => {
      const ws = cfg.widths;
      const total = ws.reduce((a, b) => a + b, 0);
      return { in: ws.map((w, i) => ({ name: 'i' + i, width: w, bits: bitRange(ws, i) })), out: [{ name: 'out', width: total }] };
    },
    model: (cfg) => {
      const ws = cfg.widths;
      return { combDeps: true, init: () => null, eval: (i) => {
        let v = 0, sh = 0;
        for (let k = 0; k < ws.length; k++) { v |= (i[k] & mask(ws[k])) << sh; sh += ws[k]; }
        return [v >>> 0];
      } };
    },
    blurb: 'Bundles wires into one bus. Input 0 becomes the lowest bits.',
  },
  FAN: {
    label: 'Fan', kind: 'wire', nand: 0, delay: 0,
    defaults: { width: 8 },
    pins: (cfg) => ({ in: [{ name: 'in', width: 1 }], out: [{ name: 'out', width: cfg.width }] }),
    model: (cfg) => {
      const m = mask(cfg.width);
      return { combDeps: true, init: () => null, eval: (i) => [i[0] & 1 ? m : 0] };
    },
    blurb: 'Copies one wire onto every line of a bus (0 → 00000000, 1 → 11111111).',
  },
  CONST: {
    label: 'Const', kind: 'wire', nand: 0, delay: 0,
    defaults: { width: 1, value: 1 },
    pins: (cfg) => ({ in: [], out: [{ name: 'out', width: cfg.width }] }),
    model: (cfg) => {
      const v = (cfg.value & mask(cfg.width)) >>> 0;
      return { combDeps: true, init: () => null, eval: () => [v] };
    },
    blurb: 'A fixed value. Unconnected inputs already read 0, so you mostly need this for 1.',
  },
  ROM: {
    label: 'ROM', kind: 'device', nand: 0, delay: 0,
    pins: () => ({ in: [{ name: 'addr', width: 8 }], out: [{ name: 'data', width: 16 }] }),
    model: () => ({ combDeps: true, device: 'rom', init: () => ({ mem: new Uint16Array(256) }), eval: (i, st) => [st.mem[i[0] & 255]] }),
    blurb: 'Program memory: 256 instructions of 16 bits. The game loads your program into it.',
  },
  RAM256: {
    label: 'RAM 256', kind: 'device', nand: 0, delay: 0,
    pins: () => ({ in: [{ name: 'addr', width: 8 }, { name: 'in', width: 8 }, { name: 'load', width: 1 }], out: [{ name: 'out', width: 8 }] }),
    model: () => ({
      combDeps: true, device: 'ram',
      init: () => ({ mem: new Uint8Array(256), buttons: 0, outLog: [] }),
      eval: (i, st) => [(i[0] & 255) === 0xdf ? st.buttons & 255 : st.mem[i[0] & 255]],
      tick: (i, st) => {
        if (i[2] & 1) {
          const a = i[0] & 255;
          st.mem[a] = i[1] & 255;
          if (a === 0xde) st.outLog.push(i[1] & 255);
        }
      },
    }),
    blurb: '256 bytes, built from 32 of your RAM8 chips. 0xDE is an output port, 0xDF reads the buttons, 0xE0–0xFF is the screen.',
  },
};

function bitRange(ws, i) {
  let lo = 0;
  for (let k = 0; k < i; k++) lo += ws[k];
  const hi = lo + ws[i] - 1;
  return hi === lo ? String(lo) : hi + ':' + lo;
}

// ---------------------------------------------------------------------------
// Library: primitives + chips unlocked from levels.
// A chip entry: { name, label, pins:{in,out}, model() (sealed behaviour),
//   sealed (bool), design (player's solution, for gate counts / unsealed flattening) }
// ---------------------------------------------------------------------------

export class Library {
  constructor() { this.chips = new Map(); }
  add(def) { this.chips.set(def.name, def); return this; }
  has(type) { return type in PRIMS || this.chips.has(type); }
  get(type) { return PRIMS[type] || this.chips.get(type); }

  pinsOf(part) {
    const p = PRIMS[part.type];
    let pins;
    if (p) pins = p.pins(Object.assign({}, p.defaults, part.cfg));
    else {
      const c = this.chips.get(part.type);
      if (!c) return { in: [], out: [] };
      pins = c.pins;
    }
    const lanes = part.lanes || 1;
    if (lanes > 1) pins = { in: pins.in.map((q) => ({ ...q, width: lanes })), out: pins.out.map((q) => ({ ...q, width: lanes })) };
    return pins;
  }

  laneable(type) {
    const d = this.get(type);
    if (!d) return false;
    if (PRIMS[type]) return !!d.laneable;
    const ps = d.pins;
    return !!ps && [...ps.in, ...ps.out].every((q) => q.width === 1);
  }

  // NAND gates inside one instance of `type` (player's own designs, recursively).
  nandCount(type, seen = new Set()) {
    const p = PRIMS[type];
    if (p) return p.nand || 0;
    const c = this.chips.get(type);
    if (!c) return 0;
    if (c.nandCache !== undefined) return c.nandCache;
    if (!c.design || seen.has(type)) return c.parNand || 0;
    seen.add(type);
    const n = designNandCount(c.design, this, seen);
    seen.delete(type);
    c.nandCache = n;
    return n;
  }
  invalidate() { for (const c of this.chips.values()) { delete c.nandCache; delete c.delayCache; } }
}

export function designNandCount(design, lib, seen = new Set()) {
  let n = 0;
  for (const part of design.parts) n += lib.nandCount(part.type, seen) * (part.lanes || 1);
  return n;
}
