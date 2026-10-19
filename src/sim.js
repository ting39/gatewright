// Gatewright — circuit compiler and simulator. Pure module (browser + Node).
//
// A design is { parts: [{id, type, x, y, lanes?, cfg?}], wires: [{id, from:{part,pin}, to:{part,pin}}] }.
// compile() flattens it (sealed chips stay single nodes, unsealed chips are inlined),
// merges aliased nets, and orders nodes by strongly-connected components so that
// acyclic logic evaluates in one pass and feedback loops (latches) iterate to a fixed point.

import { PRIMS, mask } from './chips.js';

const MAX_DEPTH = 24;

function laneModel(base, lanes) {
  return {
    combDeps: base.combDeps,
    init: () => Array.from({ length: lanes }, () => base.init()),
    eval: (ins, st) => {
      let outs = null;
      const li = new Array(ins.length);
      for (let k = 0; k < lanes; k++) {
        for (let j = 0; j < ins.length; j++) li[j] = (ins[j] >>> k) & 1;
        const lo = base.eval(li, st[k]);
        if (!outs) outs = new Array(lo.length).fill(0);
        for (let j = 0; j < lo.length; j++) outs[j] |= (lo[j] & 1) << k;
      }
      return outs;
    },
    tick: base.tick && ((ins, st) => {
      const li = new Array(ins.length);
      for (let k = 0; k < lanes; k++) {
        for (let j = 0; j < ins.length; j++) li[j] = (ins[j] >>> k) & 1;
        base.tick(li, st[k]);
      }
    }),
  };
}

export function modelFor(part, lib) {
  const lanes = part.lanes || 1;
  const p = PRIMS[part.type];
  if (p) {
    if (!p.model) return null;
    if (part.type === 'NAND') {
      const m = mask(lanes);
      return { combDeps: true, nand: true, init: () => null, eval: (i) => [~(i[0] & i[1]) & m] };
    }
    return p.model(Object.assign({}, p.defaults, part.cfg));
  }
  const c = lib.chips.get(part.type);
  if (!c || !c.model) return null;
  const base = c.model();
  return lanes > 1 ? laneModel(base, lanes) : base;
}

export function compile(design, lib, opts = {}) {
  const width = [];
  const parent = [];
  const nodes = [];
  const errors = [];
  const newNet = (w) => { width.push(w); parent.push(parent.length); return parent.length - 1; };
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) { parent[b] = a; width[a] = Math.max(width[a], width[b]); } };

  const top = { pinNet: new Map(), inputs: {}, outputs: {}, inputWidth: {}, outputWidth: {} };

  function flatten(d, depth, bound, topPart, pathPrefix) {
    const isTop = depth === 0;
    const outNets = {};
    const pinNet = new Map();
    const partById = new Map();
    for (const part of d.parts) {
      partById.set(part.id, part);
      const pins = lib.pinsOf(part);
      const m = {};
      for (const q of pins.out) m[q.name] = newNet(q.width);
      pinNet.set(part.id, m);
    }
    const driver = new Map();
    for (const w of d.wires) {
      if (!pinNet.has(w.from.part) || !partById.has(w.to.part)) continue;
      const src = pinNet.get(w.from.part)[w.from.pin];
      if (src === undefined) continue;
      driver.set(w.to.part + '\u0000' + w.to.pin, src);
    }
    const srcOf = (part, q) => {
      const s = driver.get(part.id + '\u0000' + q.name);
      if (s !== undefined) return s;
      const z = newNet(q.width); // floating input reads 0
      return z;
    };
    for (const part of d.parts) {
      const pins = lib.pinsOf(part);
      const outs = pinNet.get(part.id);
      const tp = isTop ? part.id : topPart;
      if (part.type === 'IN') {
        const name = part.cfg.name;
        if (isTop) { top.inputs[name] = outs.out; top.inputWidth[name] = part.cfg.width || 1; }
        else if (bound[name] !== undefined) union(bound[name], outs.out);
        continue;
      }
      const ins = pins.in.map((q) => srcOf(part, q));
      if (part.type === 'OUT') {
        const name = part.cfg.name;
        outNets[name] = ins[0];
        if (isTop) { top.outputs[name] = ins[0]; top.outputWidth[name] = part.cfg.width || 1; }
        continue;
      }
      const def = lib.get(part.type);
      if (!def) { errors.push({ part: tp, msg: 'Unknown part ' + part.type }); continue; }
      const inline = !PRIMS[part.type] && def.sealed === false && def.design && (part.lanes || 1) === 1 && depth < MAX_DEPTH && !opts.sealAll;
      if (inline) {
        const b = {};
        pins.in.forEach((q, i) => { b[q.name] = ins[i]; });
        const inner = flatten(def.design, depth + 1, b, tp, pathPrefix + part.id + '/');
        for (const q of pins.out) {
          if (inner[q.name] !== undefined) union(outs[q.name], inner[q.name]);
        }
        continue;
      }
      const model = modelFor(part, lib);
      if (!model) { errors.push({ part: tp, msg: 'No behaviour for ' + part.type }); continue; }
      nodes.push({
        model, ins, outs: pins.out.map((q) => outs[q.name]),
        st: model.init(), top: tp, type: part.type, path: pathPrefix + part.id,
        delay: model.nand ? 1 : lib.delayOf ? lib.delayOf(part.type) : 0,
      });
    }
    if (isTop) top.pinNet = pinNet;
    return outNets;
  }

  flatten(design, 0, null, null, '');

  // Compact nets through the union-find.
  const remap = new Map();
  const W = [];
  const id = (n) => {
    const r = find(n);
    let k = remap.get(r);
    if (k === undefined) { k = W.length; remap.set(r, k); W.push(width[r]); }
    return k;
  };
  for (const n of nodes) { n.ins = n.ins.map(id); n.outs = n.outs.map(id); n.buf = new Array(n.ins.length); }
  for (const k in top.inputs) top.inputs[k] = id(top.inputs[k]);
  for (const k in top.outputs) top.outputs[k] = id(top.outputs[k]);
  for (const [pid, m] of top.pinNet) for (const q in m) m[q] = id(m[q]);

  return new Circuit(nodes, W, top, errors);
}

export class Circuit {
  constructor(nodes, widths, top, errors) {
    this.nodes = nodes;
    this.widths = widths;
    this.vals = new Uint32Array(widths.length);
    this.inputs = top.inputs; this.outputs = top.outputs;
    this.inputWidth = top.inputWidth; this.outputWidth = top.outputWidth;
    this.pinNet = top.pinNet;
    this.errors = errors;
    this.unstable = new Set();
    this.cycles = 0;
    this.devices = {};
    for (const n of nodes) if (n.model.device && !this.devices[n.model.device]) this.devices[n.model.device] = n;
    this.seq = nodes.filter((n) => n.model.tick);
    this._order();
  }

  _order() {
    const nodes = this.nodes;
    const drv = new Int32Array(this.widths.length).fill(-1);
    nodes.forEach((n, i) => { for (const o of n.outs) drv[o] = i; });
    this.driver = drv;
    const adj = nodes.map((n) => {
      if (!n.model.combDeps) return [];
      const s = new Set();
      for (const x of n.ins) if (drv[x] >= 0) s.add(drv[x]);
      return [...s];
    });
    // Tarjan (iterative). Edges point from a node to the nodes it reads from,
    // so SCCs come out in dependency-first (evaluation) order.
    const N = nodes.length;
    const index = new Int32Array(N).fill(-1), low = new Int32Array(N), onStack = new Uint8Array(N);
    const stack = [], groups = [];
    let idx = 0;
    for (let s = 0; s < N; s++) {
      if (index[s] >= 0) continue;
      const work = [[s, 0]];
      index[s] = low[s] = idx++; stack.push(s); onStack[s] = 1;
      while (work.length) {
        const fr = work[work.length - 1];
        const v = fr[0];
        if (fr[1] < adj[v].length) {
          const w = adj[v][fr[1]++];
          if (index[w] < 0) { index[w] = low[w] = idx++; stack.push(w); onStack[w] = 1; work.push([w, 0]); }
          else if (onStack[w]) low[v] = Math.min(low[v], index[w]);
        } else {
          work.pop();
          if (work.length) { const u = work[work.length - 1][0]; low[u] = Math.min(low[u], low[v]); }
          if (low[v] === index[v]) {
            const g = [];
            let w;
            do { w = stack.pop(); onStack[w] = 0; g.push(w); } while (w !== v);
            const cyclic = g.length > 1 || adj[v].includes(v);
            groups.push({ nodes: g.reverse(), cyclic });
          }
        }
      }
    }
    this.groups = groups;
    this.hasCycles = groups.some((g) => g.cyclic);
  }

  _evalNode(n) {
    const v = this.vals, b = n.buf;
    for (let j = 0; j < b.length; j++) b[j] = v[n.ins[j]];
    const o = n.model.eval(b, n.st);
    let ch = false;
    for (let j = 0; j < o.length; j++) {
      const x = o[j] >>> 0;
      if (v[n.outs[j]] !== x) { v[n.outs[j]] = x; ch = true; }
    }
    return ch;
  }

  evaluate() {
    this.unstable.clear();
    for (const g of this.groups) {
      if (!g.cyclic) { this._evalNode(this.nodes[g.nodes[0]]); continue; }
      const limit = 16 + 4 * g.nodes.length;
      let it = 0, changed = true;
      while (changed && it < limit) {
        changed = false;
        for (const i of g.nodes) if (this._evalNode(this.nodes[i])) changed = true;
        it++;
      }
      if (changed) for (const i of g.nodes) this.unstable.add(i);
    }
    return this.unstable.size === 0;
  }

  tick() {
    const snaps = this.seq.map((n) => n.ins.map((x) => this.vals[x]));
    this.seq.forEach((n, k) => n.model.tick(snaps[k], n.st));
    this.cycles++;
    return this.evaluate();
  }

  reset() {
    this.vals.fill(0);
    for (const n of this.nodes) n.st = n.model.init();
    this.cycles = 0;
    this.unstable.clear();
  }

  set(name, value) {
    const n = this.inputs[name];
    if (n !== undefined) this.vals[n] = (value & mask(this.widths[n])) >>> 0;
  }
  get(name) {
    const n = this.outputs[name];
    return n === undefined ? 0 : this.vals[n];
  }
  setAll(obj) { for (const k in obj) this.set(k, obj[k]); }
  getAll() { const r = {}; for (const k in this.outputs) r[k] = this.get(k); return r; }

  unstableParts() {
    const s = new Set();
    for (const i of this.unstable) s.add(this.nodes[i].top);
    return s;
  }

  // Longest NAND-delay path. Clocked parts' outputs start at 0; loops are reported.
  analyze() {
    const depth = new Float64Array(this.widths.length);
    let max = 0;
    for (const g of this.groups) {
      const iter = g.cyclic ? 2 : 1;
      for (let r = 0; r < iter; r++) {
        for (const i of g.nodes) {
          const n = this.nodes[i];
          let d = 0;
          if (n.model.combDeps) for (const x of n.ins) d = Math.max(d, depth[x]);
          if (n.model.combDeps) d += n.delay || 0;
          for (const o of n.outs) depth[o] = Math.max(depth[o], d);
        }
      }
    }
    for (const n of this.seq) for (const x of n.ins) max = Math.max(max, depth[x]);
    for (const k in this.outputs) max = Math.max(max, depth[this.outputs[k]]);
    return { netDepth: depth, delay: max, cyclic: this.hasCycles };
  }
}

// Chip delay = longest NAND path through the player's own design (cached on the library).
import { Library } from './chips.js';
Library.prototype.delayOf = function (type) {
  const p = PRIMS[type];
  if (p) return p.delay || 0;
  const c = this.chips.get(type);
  if (!c) return 0;
  if (c.delayCache !== undefined) return c.delayCache;
  if (!c.design || c._delayBusy) return c.parDelay || 0;
  c._delayBusy = true;
  try { c.delayCache = compile(c.design, this).analyze().delay; }
  finally { c._delayBusy = false; }
  return c.delayCache;
};
