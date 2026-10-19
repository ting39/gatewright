// Gatewright — canvas circuit editor: geometry, rendering and interaction.

import { PRIMS } from './chips.js';

export const G = 16;
const snap = (v) => Math.round(v / G) * G;
const PIN_R = 4.5;

const C = {
  bg: '#0d1220', dot: '#1f2940', part: '#161e31', partHi: '#1d2740', stroke: '#3a4767', text: '#d5ddf0', muted: '#8591ad',
  on: '#ffb84d', onGlow: 'rgba(255,184,77,.45)', off: '#3a4766', bus: '#5ad1ff', busOff: '#33507a', sel: '#9ab8ff',
  err: '#ff5d6c', ok: '#4fe0a0', io: '#202a44', wireSel: '#ffffff', shadow: 'rgba(0,0,0,.35)',
};

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const GATE_SHAPES = new Set(['not', 'and', 'or', 'xor', 'nand']);
let measureCtx = null;
const textW = (s, font) => {
  if (!measureCtx) {
    try { measureCtx = (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas')).getContext('2d'); } catch { return s.length * 7; }
  }
  measureCtx.font = font;
  return measureCtx.measureText(s).width;
};
const FONT = (px, w = 600) => `${w} ${px}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
const MONO = (px) => `600 ${px}px ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace`;

export function shapeOf(part, lib) {
  if (part.type === 'NAND') return 'nand';
  const d = lib.get(part.type);
  return (d && d.shape) || 'box';
}

export function geom(part, lib) {
  const key = part.type + '|' + (part.lanes || 1) + '|' + JSON.stringify(part.cfg || null);
  if (part._g && part._gk === key) return part._g;
  const pins = lib.pinsOf(part);
  const def = lib.get(part.type) || {};
  const shape = shapeOf(part, lib);
  const nIn = pins.in.length, nOut = pins.out.length;
  let w, h, ins, outs, title = def.label || part.type;
  if (part.type === 'IN' || part.type === 'OUT') {
    const bus = (part.cfg.width || 1) > 1;
    w = bus ? 5 * G : 3 * G; h = 2 * G;
    ins = pins.in.map((q) => ({ ...q, x: 0, y: G }));
    outs = pins.out.map((q) => ({ ...q, x: w, y: G }));
    title = part.cfg.name;
  } else if (part.type === 'SPLIT' || part.type === 'JOIN') {
    const n = part.type === 'SPLIT' ? nOut : nIn;
    w = G; h = Math.max(2, n + 1) * G;
    const many = (arr, x) => arr.map((q, i) => ({ ...q, x, y: (i + 1) * G }));
    const mid = Math.round(h / 2 / G) * G;
    if (part.type === 'SPLIT') { ins = pins.in.map((q) => ({ ...q, x: 0, y: mid })); outs = many(pins.out, w); }
    else { ins = many(pins.in, 0); outs = pins.out.map((q) => ({ ...q, x: w, y: mid })); }
  } else if (part.type === 'FAN' || part.type === 'CONST') {
    w = 2 * G; h = 2 * G;
    ins = pins.in.map((q) => ({ ...q, x: 0, y: G }));
    outs = pins.out.map((q) => ({ ...q, x: w, y: G }));
  } else if (GATE_SHAPES.has(shape)) {
    w = shape === 'not' ? 3 * G : 4 * G;
    h = Math.max(nIn, 1) * 2 * G;
    ins = pins.in.map((q, i) => ({ ...q, x: 0, y: G + i * 2 * G }));
    outs = pins.out.map((q) => ({ ...q, x: w, y: snap(h / 2) }));
  } else {
    const lab = FONT(11, 600);
    const inW = Math.max(0, ...pins.in.map((q) => textW(q.name, lab)));
    const outW = Math.max(0, ...pins.out.map((q) => textW(q.name, lab)));
    const lanes = part.lanes > 1 ? ' ×' + part.lanes : '';
    const tW = textW(title + lanes, FONT(12, 700));
    const body = shape === 'mux' ? 2 * G : 0;
    w = Math.max(4 * G, Math.ceil((Math.max(inW + outW + 20, tW + 4) + 16 + body) / G) * G);
    const rows = Math.max(nIn, nOut, 1);
    h = (rows + 1) * 2 * G - (shape === 'mux' || shape === 'alu' ? 0 : 0);
    const top = 2 * G;
    const place = (arr, x) => {
      const off = top + Math.floor((rows - arr.length) / 2) * 2 * G;
      return arr.map((q, i) => ({ ...q, x, y: off + i * 2 * G }));
    };
    ins = place(pins.in, 0); outs = place(pins.out, w);
    h = top + rows * 2 * G - G;
  }
  const g = { w, h, ins, outs, shape, title, pins: [...ins.map((q) => ({ ...q, dir: 'in' })), ...outs.map((q) => ({ ...q, dir: 'out' }))] };
  part._g = g; part._gk = key;
  return g;
}

export function pinPos(part, pinName, lib) {
  const g = geom(part, lib);
  const p = g.pins.find((q) => q.name === pinName);
  return p ? { x: part.x + p.x, y: part.y + p.y, width: p.width, dir: p.dir } : null;
}

export function routeWire(x1, y1, x2, y2, mx) {
  if (x2 - x1 >= 2 * G) {
    if (y1 === y2 && mx === undefined) return [[x1, y1], [x2, y2]];
    let m = mx !== undefined ? mx : snap((x1 + x2) / 2);
    m = Math.max(x1 + G, Math.min(x2 - G, m));
    return [[x1, y1], [m, y1], [m, y2], [x2, y2]];
  }
  const a = x1 + G, bx = x2 - G;
  let ym = mx !== undefined ? mx : (Math.abs(y1 - y2) > 4 * G ? snap((y1 + y2) / 2) : Math.max(y1, y2) + 2 * G);
  return [[x1, y1], [a, y1], [a, ym], [bx, ym], [bx, y2], [x2, y2]];
}

function distSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx, y = a[1] + t * dy;
  return Math.hypot(px - x, py - y);
}

const uid = () => Math.random().toString(36).slice(2, 9);

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

export class Editor {
  constructor(canvas, host) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.host = host;
    this.design = { parts: [], wires: [] };
    this.view = { x: 0, y: 0, z: 1 };
    this.sel = new Set();
    this.selWire = null;
    this.hist = []; this.future = [];
    this.circuit = null; this.disp = null; this.pending = null; this.depth = null;
    this.mode = null;
    this.pointers = new Map();
    this.hover = null;
    this.badges = new Map(); // OUT part id -> {expected, ok}
    this.flash = 0;
    this.dirty = true;
    this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._bind();
    this._resize();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this._resize()).observe(canvas.parentElement);
  }

  get lib() { return this.host.lib(); }

  // ---- model ----
  setDesign(design, { keepView = false } = {}) {
    this.design = design;
    this.sel.clear(); this.selWire = null;
    this.hist = []; this.future = [];
    if (!keepView) this.fit();
    this.request();
  }
  snapshot() { return JSON.stringify(this.design, (k, v) => (k[0] === '_' ? undefined : v)); }
  commit(kind = 'edit') {
    // Called *before* a mutation: remembers the previous state.
    this.hist.push(this._pre || this.snapshot());
    this._pre = null;
    if (this.hist.length > 200) this.hist.shift();
    this.future = [];
  }
  begin() { this._pre = this.snapshot(); }
  changed(kind = 'edit') { this.host.onEdit(kind); this.request(); }
  undo() {
    if (!this.hist.length) return;
    this.future.push(this.snapshot());
    this._restore(this.hist.pop());
  }
  redo() {
    if (!this.future.length) return;
    this.hist.push(this.snapshot());
    this._restore(this.future.pop());
  }
  _restore(json) {
    const d = JSON.parse(json);
    this.design.parts = d.parts; this.design.wires = d.wires;
    this.sel.clear(); this.selWire = null;
    this.changed('history');
    this.host.onSelect();
  }
  partById(id) { return this.design.parts.find((p) => p.id === id); }

  addPart(type, x, y, extra = {}) {
    const def = PRIMS[type];
    const part = { id: uid(), type, x: snap(x), y: snap(y), ...extra };
    if (def && def.defaults && !part.cfg) part.cfg = structuredClone(def.defaults);
    const g = geom(part, this.lib);
    part.x = snap(x - g.w / 2); part.y = snap(y - g.h / 2);
    this.commit();
    this.design.parts.push(part);
    this.sel.clear(); this.sel.add(part.id); this.selWire = null;
    this.changed('add');
    this.host.onSelect();
    this.host.sound('place');
    return part;
  }

  connect(a, b) {
    // a, b: {part, pin, dir}. Normalise to out -> in.
    if (a.dir === b.dir) return false;
    const [from, to] = a.dir === 'out' ? [a, b] : [b, a];
    if (from.part === to.part && false) return false;
    const pf = pinPos(this.partById(from.part), from.pin, this.lib), pt = pinPos(this.partById(to.part), to.pin, this.lib);
    if (pf.width !== pt.width) { this.host.toast(`Can't connect: ${pf.width}-bit pin to ${pt.width}-bit pin`, 'err'); this.host.sound('err'); return false; }
    this.commit();
    this.design.wires = this.design.wires.filter((w) => !(w.to.part === to.part && w.to.pin === to.pin));
    this.design.wires.push({ id: uid(), from: { part: from.part, pin: from.pin }, to: { part: to.part, pin: to.pin } });
    this.changed('wire');
    this.host.sound('wire');
    return true;
  }

  deleteSelection() {
    if (this.selWire) {
      this.commit();
      this.design.wires = this.design.wires.filter((w) => w.id !== this.selWire);
      this.selWire = null;
      this.changed('delete');
      return;
    }
    const ids = [...this.sel].filter((id) => !this.host.locked(this.partById(id)));
    if (!ids.length) { if (this.sel.size) this.host.toast("The level's inputs and outputs can't be deleted", 'info'); return; }
    this.commit();
    const s = new Set(ids);
    this.design.parts = this.design.parts.filter((p) => !s.has(p.id));
    this.design.wires = this.design.wires.filter((w) => !s.has(w.from.part) && !s.has(w.to.part));
    this.sel.clear();
    this.changed('delete');
    this.host.onSelect();
    this.host.sound('delete');
  }

  copy() {
    const ids = new Set([...this.sel].filter((id) => !this.host.locked(this.partById(id))));
    if (!ids.size) return false;
    const parts = this.design.parts.filter((p) => ids.has(p.id));
    const wires = this.design.wires.filter((w) => ids.has(w.from.part) && ids.has(w.to.part));
    this.clip = JSON.stringify({ parts, wires }, (k, v) => (k[0] === '_' ? undefined : v));
    return true;
  }
  paste(offset = 2 * G) {
    if (!this.clip) return;
    const c = JSON.parse(this.clip);
    const map = {};
    this.commit();
    this.sel.clear();
    for (const p of c.parts) {
      if (!this.lib.has(p.type)) continue;
      const np = { ...p, id: uid(), x: p.x + offset, y: p.y + offset };
      map[p.id] = np.id;
      this.design.parts.push(np);
      this.sel.add(np.id);
    }
    for (const w of c.wires) if (map[w.from.part] && map[w.to.part]) this.design.wires.push({ id: uid(), from: { part: map[w.from.part], pin: w.from.pin }, to: { part: map[w.to.part], pin: w.to.pin }, mx: w.mx !== undefined ? w.mx + offset : undefined });
    this.clip = JSON.stringify({ parts: c.parts.map((p) => ({ ...p, x: p.x + offset, y: p.y + offset })), wires: c.wires.map((w) => ({ ...w, mx: w.mx !== undefined ? w.mx + offset : undefined })) });
    this.changed('paste');
    this.host.onSelect();
  }

  updatePart(id, fn) {
    const p = this.partById(id);
    if (!p) return;
    this.commit();
    fn(p);
    // drop wires whose pins vanished or changed width
    const lib = this.lib;
    this.design.wires = this.design.wires.filter((w) => {
      const a = this.partById(w.from.part), b = this.partById(w.to.part);
      if (!a || !b) return false;
      const pa = pinPos(a, w.from.pin, lib), pb = pinPos(b, w.to.pin, lib);
      return pa && pb && pa.width === pb.width;
    });
    this.changed('cfg');
    this.host.onSelect();
  }

  // ---- simulation display ----
  setCircuit(c) {
    this.circuit = c;
    this.disp = c ? Uint32Array.from(c.vals) : null;
    this.pending = null;
    try { this.depth = c ? c.analyze().netDepth : null; } catch { this.depth = null; }
    this.request();
  }
  // Called after the circuit re-evaluated: animate changes by NAND depth.
  propagate(animate = true) {
    const c = this.circuit;
    if (!c) return;
    if (!this.disp || this.disp.length !== c.vals.length) this.disp = new Uint32Array(c.vals.length);
    if (!animate || this.reduced || !this.depth) { this.disp.set(c.vals); this.pending = null; this.request(); return; }
    const now = performance.now();
    const list = [];
    let maxD = 1;
    for (let i = 0; i < c.vals.length; i++) if (this.disp[i] !== c.vals[i]) { const dd = this.depth[i] || 0; maxD = Math.max(maxD, dd); list.push(i); }
    const step = Math.min(45, 700 / maxD);
    this.pending = list.map((i) => ({ i, t: now + (this.depth[i] || 0) * step, v: c.vals[i] }));
    this.request();
  }
  netOf(partId, pin) {
    const m = this.circuit && this.circuit.pinNet.get(partId);
    return m ? m[pin] : undefined;
  }
  valueOfWire(w) {
    const n = this.netOf(w.from.part, w.from.pin);
    return n === undefined || !this.disp ? 0 : this.disp[n];
  }

  // ---- view ----
  _resize() {
    const r = this.cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = r.width; this.H = r.height;
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
    this.dpr = dpr;
    if (!this._fitted && this.design.parts.length) this.fit();
    this.request();
  }
  bounds(parts = this.design.parts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of parts) { const g = geom(p, this.lib); x0 = Math.min(x0, p.x - 40); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x + g.w + 40); y1 = Math.max(y1, p.y + g.h); }
    return isFinite(x0) ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 400, y1: 300 };
  }
  fit() {
    if (!this.W) return;
    const b = this.bounds();
    const pad = 60;
    const z = Math.max(0.35, Math.min(1.6, Math.min((this.W - pad * 2) / (b.x1 - b.x0), (this.H - pad * 2) / (b.y1 - b.y0))));
    this.view.z = z;
    this.view.x = (b.x0 + b.x1) / 2 - this.W / 2 / z;
    this.view.y = (b.y0 + b.y1) / 2 - this.H / 2 / z;
    this._fitted = true;
    this.request();
  }
  zoomAt(sx, sy, f) {
    const z0 = this.view.z, z1 = Math.max(0.25, Math.min(3, z0 * f));
    const wx = this.view.x + sx / z0, wy = this.view.y + sy / z0;
    this.view.z = z1; this.view.x = wx - sx / z1; this.view.y = wy - sy / z1;
    this.request();
  }
  toWorld(sx, sy) { return { x: this.view.x + sx / this.view.z, y: this.view.y + sy / this.view.z }; }
  center() { return this.toWorld(this.W / 2, this.H / 2); }

  // ---- hit testing ----
  hitPin(wx, wy) {
    const r = Math.max(9, 10 / this.view.z);
    let best = null, bd = r;
    for (let k = this.design.parts.length - 1; k >= 0; k--) {
      const p = this.design.parts[k];
      for (const q of geom(p, this.lib).pins) {
        const d = Math.hypot(wx - (p.x + q.x), wy - (p.y + q.y));
        if (d < bd) { bd = d; best = { part: p.id, pin: q.name, dir: q.dir, width: q.width, x: p.x + q.x, y: p.y + q.y }; }
      }
    }
    return best;
  }
  hitPart(wx, wy) {
    for (let k = this.design.parts.length - 1; k >= 0; k--) {
      const p = this.design.parts[k];
      const g = geom(p, this.lib);
      if (wx >= p.x - 2 && wx <= p.x + g.w + 2 && wy >= p.y - 2 && wy <= p.y + g.h + 2) return p;
    }
    return null;
  }
  wirePath(w) {
    const a = this.partById(w.from.part), b = this.partById(w.to.part);
    if (!a || !b) return null;
    const pa = pinPos(a, w.from.pin, this.lib), pb = pinPos(b, w.to.pin, this.lib);
    if (!pa || !pb) return null;
    return routeWire(pa.x, pa.y, pb.x, pb.y, w.mx);
  }
  hitWire(wx, wy) {
    const tol = Math.max(5, 6 / this.view.z);
    for (let k = this.design.wires.length - 1; k >= 0; k--) {
      const w = this.design.wires[k];
      const path = this.wirePath(w);
      if (!path) continue;
      for (let i = 0; i < path.length - 1; i++) if (distSeg(wx, wy, path[i], path[i + 1]) < tol) return { wire: w, seg: i, path };
    }
    return null;
  }

  // ---- interaction ----
  _bind() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => this._down(e));
    cv.addEventListener('pointermove', (e) => this._move(e));
    cv.addEventListener('pointerup', (e) => this._up(e));
    cv.addEventListener('pointercancel', (e) => this._up(e, true));
    cv.addEventListener('pointerleave', () => { if (!this.mode) { this.hover = null; this.request(); } });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const w = this.toWorld(sx, sy);
      const p = this.hitPart(w.x, w.y);
      if (p && p.type === 'IN' && (p.cfg.width || 1) > 1 && !e.ctrlKey) { this.host.onBusWheel(p, e.deltaY < 0 ? 1 : -1); return; }
      if (e.ctrlKey || e.deltaMode === 1 || Math.abs(e.deltaY) >= 50 && Math.abs(e.deltaX) < 2) this.zoomAt(sx, sy, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
      else { this.view.x += e.deltaX / this.view.z; this.view.y += e.deltaY / this.view.z; this.request(); }
    }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('dblclick', (e) => {
      const r = cv.getBoundingClientRect();
      const w = this.toWorld(e.clientX - r.left, e.clientY - r.top);
      const hw = this.hitWire(w.x, w.y);
      if (hw && !this.hitPart(w.x, w.y) && hw.wire.mx !== undefined) { this.begin(); this.commit(); delete hw.wire.mx; this.changed('route'); }
    });
  }
  _pos(e) {
    const r = this.cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    return { sx, sy, ...this.toWorld(sx, sy) };
  }
  _down(e) {
    this.cv.focus({ preventScroll: true });
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { this.cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (this.pointers.size === 2) {
      // pinch
      const [a, b] = [...this.pointers.values()];
      this.mode = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: this.view.z, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, v0: { ...this.view } };
      return;
    }
    const p = this._pos(e);
    const panBtn = e.button === 1 || e.button === 2 || this.spaceDown;
    if (panBtn) { this.mode = { kind: 'pan', sx: p.sx, sy: p.sy, vx: this.view.x, vy: this.view.y }; this.cv.style.cursor = 'grabbing'; return; }
    const pin = this.hitPin(p.x, p.y);
    if (pin) {
      this.mode = { kind: 'wire', from: pin, x: p.x, y: p.y, moved: false };
      this.request();
      return;
    }
    const part = this.hitPart(p.x, p.y);
    if (part) {
      if (e.shiftKey || e.metaKey || e.ctrlKey) { if (this.sel.has(part.id)) this.sel.delete(part.id); else this.sel.add(part.id); }
      else if (!this.sel.has(part.id)) { this.sel.clear(); this.sel.add(part.id); }
      this.selWire = null;
      this.host.onSelect();
      this.mode = { kind: 'drag', part, x0: p.x, y0: p.y, sx: p.sx, sy: p.sy, starts: [...this.sel].map((id) => { const q = this.partById(id); return { q, x: q.x, y: q.y }; }), moved: false, pre: this.snapshot() };
      this.request();
      return;
    }
    const hw = this.hitWire(p.x, p.y);
    if (hw) {
      this.sel.clear(); this.selWire = hw.wire.id;
      this.host.onSelect();
      const segV = hw.path.length === 4 && hw.seg === 1;
      const segH = hw.path.length === 6 && hw.seg === 2;
      if (segV || segH) this.mode = { kind: 'route', wire: hw.wire, vertical: segV, pre: this.snapshot(), moved: false };
      this.request();
      return;
    }
    if (e.shiftKey) { this.mode = { kind: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y }; return; }
    this.mode = { kind: 'pan', sx: p.sx, sy: p.sy, vx: this.view.x, vy: this.view.y, click: true };
  }
  _move(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = this._pos(e);
    const m = this.mode;
    if (!m) {
      const pin = this.hitPin(p.x, p.y);
      const part = pin ? null : this.hitPart(p.x, p.y);
      const wire = pin || part ? null : this.hitWire(p.x, p.y);
      const h = pin ? { pin } : part ? { part: part.id } : wire ? { wire: wire.wire.id } : null;
      const key = JSON.stringify(h);
      if (key !== this._hk) { this._hk = key; this.hover = h; this.request(); }
      this.cv.style.cursor = pin ? 'crosshair' : part ? (part.type === 'IN' ? 'pointer' : 'grab') : wire ? 'pointer' : 'default';
      this.host.onHover && this.host.onHover(h, e);
      return;
    }
    if (m.kind === 'pinch') {
      const [a, b] = [...this.pointers.values()];
      if (!a || !b) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = this.cv.getBoundingClientRect();
      const mid = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      const z = Math.max(0.25, Math.min(3, m.z0 * d / m.d0));
      const wx = m.v0.x + (m.mid.x - r.left) / m.z0, wy = m.v0.y + (m.mid.y - r.top) / m.z0;
      this.view.z = z; this.view.x = wx - mid.x / z; this.view.y = wy - mid.y / z;
      this.request();
      return;
    }
    if (m.kind === 'pan') {
      if (Math.hypot(p.sx - m.sx, p.sy - m.sy) > 3) m.click = false;
      this.view.x = m.vx - (p.sx - m.sx) / this.view.z;
      this.view.y = m.vy - (p.sy - m.sy) / this.view.z;
      this.request();
    } else if (m.kind === 'drag') {
      if (!m.moved && Math.hypot(p.sx - m.sx, p.sy - m.sy) < 4) return;
      m.moved = true;
      const dx = snap(p.x - m.x0), dy = snap(p.y - m.y0);
      for (const s of m.starts) { s.q.x = s.x + dx; s.q.y = s.y + dy; }
      this.request();
    } else if (m.kind === 'wire') {
      m.x = p.x; m.y = p.y; m.moved = true;
      const t = this.hitPin(p.x, p.y);
      m.target = t && t.dir !== m.from.dir && t.part !== undefined ? t : null;
      this.request();
    } else if (m.kind === 'box') {
      m.x1 = p.x; m.y1 = p.y; this.request();
    } else if (m.kind === 'route') {
      m.moved = true;
      m.wire.mx = snap(m.vertical ? p.x : p.y);
      this.request();
    }
  }
  _up(e, cancel) {
    this.pointers.delete(e.pointerId);
    const m = this.mode;
    if (!m) return;
    if (m.kind === 'pinch') { if (this.pointers.size === 0) this.mode = null; return; }
    this.mode = null;
    this.cv.style.cursor = 'default';
    if (cancel) { this.request(); return; }
    if (m.kind === 'pan' && m.click) {
      if (this.sel.size || this.selWire) { this.sel.clear(); this.selWire = null; this.host.onSelect(); }
    } else if (m.kind === 'drag') {
      if (m.moved) { this._pre = m.pre; this.commit(); this.changed('move'); }
      else if (m.part.type === 'IN' && this.sel.size === 1) this.host.onToggle(m.part, this._screenRect(m.part));
    } else if (m.kind === 'wire') {
      if (m.target) this.connect(m.from, m.target);
      else if (!m.moved || Math.hypot(m.x - m.from.x, m.y - m.from.y) < 6) {
        // click on a pin: select the wire attached to an input pin
        const w = this.design.wires.find((w) => w.to.part === m.from.part && w.to.pin === m.from.pin);
        if (w) { this.sel.clear(); this.selWire = w.id; this.host.onSelect(); }
      }
    } else if (m.kind === 'box') {
      const x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1), y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1);
      for (const p of this.design.parts) { const g = geom(p, this.lib); if (p.x >= x0 && p.x + g.w <= x1 && p.y >= y0 && p.y + g.h <= y1) this.sel.add(p.id); }
      this.host.onSelect();
    } else if (m.kind === 'route') {
      if (m.moved) { this._pre = m.pre; this.commit(); this.changed('route'); }
    }
    this.request();
  }
  _screenRect(part) {
    const g = geom(part, this.lib);
    const r = this.cv.getBoundingClientRect();
    return { x: r.left + (part.x - this.view.x) * this.view.z, y: r.top + (part.y - this.view.y) * this.view.z, w: g.w * this.view.z, h: g.h * this.view.z };
  }
  nudge(dx, dy) {
    const ids = [...this.sel];
    if (!ids.length) return;
    this.commit();
    for (const id of ids) { const p = this.partById(id); p.x += dx * G; p.y += dy * G; }
    this.changed('move');
  }
  selectAll() { for (const p of this.design.parts) this.sel.add(p.id); this.host.onSelect(); this.request(); }

  // ---- rendering ----
  request() {
    if (this.sync) { this.draw(); return; }
    if (!this._raf) this._raf = requestAnimationFrame(() => { this._raf = 0; this.draw(); });
  }

  draw() {
    const ctx = this.ctx, v = this.view, lib = this.lib;
    const now = performance.now();
    if (this.pending) {
      let left = 0;
      for (const p of this.pending) { if (p.t <= now) { this.disp[p.i] = p.v; p.done = true; } else left++; }
      this.pending = left ? this.pending.filter((p) => !p.done) : null;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, this.W, this.H);
    // grid
    const step = G * v.z;
    if (step >= 6) {
      ctx.fillStyle = C.dot;
      const ox = -((v.x * v.z) % step), oy = -((v.y * v.z) % step);
      const big = step * 4;
      for (let x = ox; x < this.W; x += step) for (let y = oy; y < this.H; y += step) {
        const gx = Math.round((x / v.z + v.x) / G), gy = Math.round((y / v.z + v.y) / G);
        const s = gx % 4 === 0 && gy % 4 === 0 ? 2 : 1.2;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      void big;
    }
    ctx.setTransform(this.dpr * v.z, 0, 0, this.dpr * v.z, -v.x * v.z * this.dpr, -v.y * v.z * this.dpr);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    const unstable = this.circuit && this.circuit.unstable.size ? this.circuit.unstableParts() : null;

    // wires
    const fanout = new Map();
    for (const w of this.design.wires) { const k = w.from.part + '.' + w.from.pin; fanout.set(k, (fanout.get(k) || 0) + 1); }
    const drawn = [];
    for (const w of this.design.wires) {
      const path = this.wirePath(w);
      if (!path) continue;
      const pf = pinPos(this.partById(w.from.part), w.from.pin, lib);
      drawn.push({ w, path, bus: pf.width > 1, val: this.valueOfWire(w), fan: fanout.get(w.from.part + '.' + w.from.pin) > 1 });
    }
    drawn.sort((a, b) => (a.val ? 1 : 0) - (b.val ? 1 : 0));
    for (const d of drawn) this._wire(ctx, d);
    // junction dots
    for (const d of drawn) if (d.fan && d.path.length > 2) {
      ctx.fillStyle = d.val ? (d.bus ? C.bus : C.on) : (d.bus ? C.busOff : C.off);
      ctx.beginPath(); ctx.arc(d.path[1][0], d.path[1][1], d.bus ? 4 : 3, 0, 7); ctx.fill();
    }
    // parts
    for (const p of this.design.parts) this._part(ctx, p, unstable && unstable.has(p.id));
    // bus value badges (on top)
    if (v.z > 0.55) for (const d of drawn) if (d.bus) this._badge(ctx, d);
    // in-progress wire
    const m = this.mode;
    if (m && m.kind === 'wire' && m.moved) {
      const a = m.from, tx = m.target ? m.target.x : m.x, ty = m.target ? m.target.y : m.y;
      const path = a.dir === 'out' ? routeWire(a.x, a.y, tx, ty) : routeWire(tx, ty, a.x, a.y);
      ctx.strokeStyle = m.target ? C.ok : C.sel; ctx.lineWidth = a.width > 1 ? 4 : 2.5; ctx.setLineDash([6, 5]);
      this._poly(ctx, path); ctx.stroke(); ctx.setLineDash([]);
      // highlight compatible pins
      for (const p of this.design.parts) for (const q of geom(p, lib).pins) {
        if (q.dir === a.dir || p.id === a.part) continue;
        ctx.strokeStyle = q.width === a.width ? 'rgba(79,224,160,.7)' : 'rgba(255,93,108,.35)';
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x + q.x, p.y + q.y, 8, 0, 7); ctx.stroke();
      }
    }
    if (m && m.kind === 'box') {
      ctx.fillStyle = 'rgba(154,184,255,.08)'; ctx.strokeStyle = C.sel; ctx.lineWidth = 1 / v.z;
      ctx.setLineDash([4 / v.z, 4 / v.z]);
      ctx.fillRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0); ctx.strokeRect(m.x0, m.y0, m.x1 - m.x0, m.y1 - m.y0); ctx.setLineDash([]);
    }
    if (this.ghost) {
      ctx.globalAlpha = 0.55;
      const gp = this.ghost;
      const g = geom(gp, lib);
      this._part(ctx, { ...gp, x: snap(gp.x - g.w / 2), y: snap(gp.y - g.h / 2) }, false);
      ctx.globalAlpha = 1;
    }
    if ((this.pending || unstable) && !this.sync) this.request();
  }

  _poly(ctx, path) {
    const r = 6;
    ctx.beginPath(); ctx.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length - 1; i++) {
      const [x, y] = path[i];
      const seg = Math.min(Math.hypot(x - path[i - 1][0], y - path[i - 1][1]), Math.hypot(path[i + 1][0] - x, path[i + 1][1] - y)) / 2;
      ctx.arcTo(x, y, path[i + 1][0], path[i + 1][1], Math.min(r, seg));
    }
    ctx.lineTo(path[path.length - 1][0], path[path.length - 1][1]);
  }

  _wire(ctx, d) {
    const sel = this.selWire === d.w.id;
    const hov = this.hover && this.hover.wire === d.w.id;
    const lw = d.bus ? 4 : 2.2;
    if (sel || hov) { ctx.strokeStyle = sel ? 'rgba(255,255,255,.9)' : 'rgba(154,184,255,.4)'; ctx.lineWidth = lw + 4; this._poly(ctx, d.path); ctx.stroke(); }
    if (d.val) {
      ctx.strokeStyle = d.bus ? 'rgba(90,209,255,.25)' : C.onGlow; ctx.lineWidth = lw + 5;
      this._poly(ctx, d.path); ctx.stroke();
    }
    ctx.strokeStyle = d.val ? (d.bus ? C.bus : C.on) : (d.bus ? C.busOff : C.off);
    ctx.lineWidth = lw;
    this._poly(ctx, d.path); ctx.stroke();
    if (d.bus) { ctx.strokeStyle = C.bg; ctx.lineWidth = 1; this._poly(ctx, d.path); ctx.stroke(); }
  }

  _badge(ctx, d) {
    const p = d.path;
    let best = 0, bl = -1;
    for (let i = 0; i < p.length - 1; i++) { const l = Math.abs(p[i + 1][0] - p[i][0]); if (p[i][1] === p[i + 1][1] && l > bl) { bl = l; best = i; } }
    if (bl < 40) return;
    const x = (p[best][0] + p[best + 1][0]) / 2, y = p[best][1];
    const t = String(d.val);
    ctx.font = MONO(9);
    const w = ctx.measureText(t).width + 8;
    ctx.fillStyle = C.bg; ctx.strokeStyle = d.val ? C.bus : C.busOff; ctx.lineWidth = 1;
    rr(ctx, x - w / 2, y - 7, w, 14, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = d.val ? C.bus : C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, x, y + 0.5);
  }

  _part(ctx, p, bad) {
    const lib = this.lib;
    const g = geom(p, lib);
    const sel = this.sel.has(p.id);
    const hov = this.hover && this.hover.part === p.id;
    const x = p.x, y = p.y;
    ctx.save();
    ctx.translate(x, y);
    const strokeCol = bad ? C.err : sel ? C.sel : hov ? '#56648a' : C.stroke;
    const lanes = p.lanes || 1;
    const net = (pin) => this.netOf(p.id, pin);
    const val = (pin) => { const n = net(pin); return n === undefined || !this.disp ? 0 : this.disp[n]; };

    if (p.type === 'IN' || p.type === 'OUT') {
      const w = p.cfg.width || 1;
      const isIn = p.type === 'IN';
      const v = isIn ? val('out') : this._outVal(p);
      const lit = v !== 0;
      ctx.fillStyle = C.io; ctx.strokeStyle = strokeCol; ctx.lineWidth = sel ? 2 : 1.5;
      rr(ctx, 0, 0, g.w, g.h, isIn ? 8 : 16); ctx.fill(); ctx.stroke();
      if (w === 1) {
        if (isIn) {
          ctx.fillStyle = lit ? C.on : '#2a3552';
          rr(ctx, 6, 7, g.w - 12, g.h - 14, 9); ctx.fill();
          ctx.fillStyle = lit ? '#2b1d05' : C.muted; ctx.font = MONO(12); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(lit ? '1' : '0', g.w / 2, g.h / 2 + 0.5);
        } else {
          if (lit) { ctx.fillStyle = C.onGlow; ctx.beginPath(); ctx.arc(g.w / 2 + 2, g.h / 2, 13, 0, 7); ctx.fill(); }
          ctx.fillStyle = lit ? C.on : '#2a3552'; ctx.beginPath(); ctx.arc(g.w / 2 + 2, g.h / 2, 9, 0, 7); ctx.fill();
          ctx.fillStyle = lit ? '#2b1d05' : C.muted; ctx.font = MONO(11); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(lit ? '1' : '0', g.w / 2 + 2, g.h / 2 + 0.5);
        }
      } else {
        ctx.fillStyle = lit ? C.bus : C.muted; ctx.font = MONO(13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(v), g.w / 2 + (isIn ? 0 : 2), g.h / 2 + 0.5);
        ctx.fillStyle = C.muted; ctx.font = MONO(8); ctx.textAlign = isIn ? 'left' : 'right';
        ctx.fillText(w + 'b', isIn ? 5 : g.w - 6, 7);
      }
      // name label outside
      ctx.font = FONT(12, 700); ctx.fillStyle = C.text; ctx.textBaseline = 'middle';
      ctx.textAlign = isIn ? 'right' : 'left';
      ctx.fillText(p.cfg.name, isIn ? -8 : g.w + 8, g.h / 2);
      const b = this.badges.get(p.id);
      if (b && !isIn) {
        const t = b.ok ? '✓' : 'want ' + b.expected;
        ctx.font = FONT(10, 700);
        const tw = ctx.measureText(t).width + 10;
        const nx = g.w + 12 + ctx.measureText(p.cfg.name).width + 6;
        ctx.fillStyle = b.ok ? 'rgba(79,224,160,.18)' : 'rgba(255,93,108,.2)'; rr(ctx, nx, g.h / 2 - 9, tw, 18, 9); ctx.fill();
        ctx.fillStyle = b.ok ? C.ok : C.err; ctx.textAlign = 'left'; ctx.fillText(t, nx + 5, g.h / 2 + 0.5);
      }
    } else if (p.type === 'SPLIT' || p.type === 'JOIN') {
      ctx.fillStyle = C.part; ctx.strokeStyle = strokeCol; ctx.lineWidth = sel ? 2 : 1.5;
      rr(ctx, 3, 4, g.w - 6, g.h - 8, 3); ctx.fill(); ctx.stroke();
      ctx.font = MONO(8); ctx.fillStyle = C.muted; ctx.textBaseline = 'middle';
      const side = p.type === 'SPLIT' ? g.outs : g.ins;
      for (const q of side) {
        ctx.textAlign = p.type === 'SPLIT' ? 'left' : 'right';
        ctx.fillText(q.bits, p.type === 'SPLIT' ? q.x + 6 : q.x - 6, q.y - 6);
      }
    } else if (p.type === 'FAN') {
      ctx.fillStyle = C.part; ctx.strokeStyle = strokeCol; ctx.lineWidth = sel ? 2 : 1.5;
      ctx.beginPath(); ctx.moveTo(4, G - 4); ctx.lineTo(g.w - 3, 3); ctx.lineTo(g.w - 3, g.h - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.font = MONO(8); ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('×' + p.cfg.width, g.w / 2 + 4, g.h / 2 + 0.5);
    } else if (p.type === 'CONST') {
      ctx.fillStyle = C.part; ctx.strokeStyle = strokeCol; ctx.lineWidth = sel ? 2 : 1.5;
      rr(ctx, 3, 3, g.w - 6, g.h - 6, 5); ctx.fill(); ctx.stroke();
      ctx.font = MONO(11); ctx.fillStyle = p.cfg.value ? C.on : C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(p.cfg.value), g.w / 2, g.h / 2 + 0.5);
    } else if (GATE_SHAPES.has(g.shape)) {
      if (lanes > 1) { ctx.save(); ctx.translate(4, -4); gatePath(ctx, g.shape, g.w, g.h); ctx.fillStyle = C.part; ctx.fill(); ctx.strokeStyle = C.stroke; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore(); }
      gatePath(ctx, g.shape, g.w, g.h);
      ctx.fillStyle = hov || sel ? C.partHi : C.part; ctx.fill();
      ctx.strokeStyle = strokeCol; ctx.lineWidth = sel ? 2.2 : 1.8; ctx.stroke();
      if (g.shape === 'xor') { ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(9, g.h / 2, -3, g.h); ctx.stroke(); }
      if (g.shape === 'not' || g.shape === 'nand') {
        const bx = g.shape === 'not' ? g.w - 6 : g.w - 6;
        ctx.beginPath(); ctx.arc(bx, g.h / 2, 4, 0, 7); ctx.fillStyle = C.bg; ctx.fill(); ctx.stroke();
      }
      if (lanes > 1) { ctx.font = MONO(9); ctx.fillStyle = C.sel; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('×' + lanes, g.w * 0.42, g.h / 2 + 0.5); }
      else if (g.h >= 4 * G && this.view.z > 0.7) { ctx.font = FONT(9, 700); ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(g.title, g.w * 0.42, g.h / 2 + 0.5); }
    } else {
      // box chip (also mux / alu / devices)
      if (lanes > 1) { ctx.fillStyle = C.part; ctx.strokeStyle = C.stroke; ctx.lineWidth = 1.2; boxPath(ctx, g.shape, g.w, g.h, 4, -4); ctx.fill(); ctx.stroke(); }
      ctx.shadowColor = C.shadow; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
      boxPath(ctx, g.shape, g.w, g.h, 0, 0);
      ctx.fillStyle = hov || sel ? C.partHi : C.part; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = strokeCol; ctx.lineWidth = sel ? 2.2 : 1.6; ctx.stroke();
      const def = lib.get(p.type) || {};
      const accent = def.kind === 'device' ? '#b48cff' : def.clocked ? '#57e3c1' : '#7f9cff';
      ctx.fillStyle = accent;
      if (g.shape === 'box') { ctx.globalAlpha = 0.85; rr(ctx, 6, 5, g.w - 12, 2.5, 1.25); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.font = FONT(12, 800); ctx.fillStyle = C.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.title + (lanes > 1 ? ' ×' + lanes : ''), g.w / 2, G);
      ctx.font = FONT(10.5, 600); ctx.fillStyle = C.muted; ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      for (const q of g.ins) ctx.fillText(q.name, 8 + (g.shape === 'mux' ? 4 : 0), q.y);
      ctx.textAlign = 'right';
      for (const q of g.outs) ctx.fillText(q.name, g.w - 8, q.y);
      if (def.clocked) { // clock notch
        ctx.strokeStyle = accent; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(g.w / 2 - 6, g.h); ctx.lineTo(g.w / 2, g.h - 6); ctx.lineTo(g.w / 2 + 6, g.h); ctx.stroke();
      }
    }
    // pins
    for (const q of g.pins) {
      const n = net(q.name);
      const v = n === undefined || !this.disp ? 0 : this.disp[n];
      const bus = q.width > 1;
      const hp = this.hover && this.hover.pin && this.hover.pin.part === p.id && this.hover.pin.pin === q.name;
      ctx.beginPath(); ctx.arc(q.x, q.y, hp ? PIN_R + 2 : bus ? PIN_R + 0.5 : PIN_R, 0, 7);
      ctx.fillStyle = v ? (bus ? C.bus : C.on) : '#0f1526';
      ctx.fill();
      ctx.strokeStyle = hp ? '#fff' : v ? (bus ? C.bus : C.on) : bus ? '#4f6c99' : '#5b6a90'; ctx.lineWidth = bus ? 2 : 1.5; ctx.stroke();
    }
    if (bad) {
      ctx.strokeStyle = C.err; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -(performance.now() / 40) % 9;
      ctx.strokeRect(-5, -5, g.w + 10, g.h + 10); ctx.setLineDash([]);
    }
    ctx.restore();
  }
  _outVal(p) {
    const w = this.design.wires.find((w) => w.to.part === p.id && w.to.pin === 'in');
    return w ? this.valueOfWire(w) : 0;
  }
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function boxPath(ctx, shape, w, h, ox, oy) {
  ctx.beginPath();
  if (shape === 'mux') {
    const s = Math.min(14, h / 6);
    ctx.moveTo(ox, oy); ctx.lineTo(ox + w, oy + s); ctx.lineTo(ox + w, oy + h - s); ctx.lineTo(ox, oy + h); ctx.closePath();
  } else if (shape === 'alu') {
    const s = Math.min(16, h / 6), n = 10;
    ctx.moveTo(ox, oy); ctx.lineTo(ox + w, oy + s); ctx.lineTo(ox + w, oy + h - s); ctx.lineTo(ox, oy + h);
    ctx.lineTo(ox, oy + h / 2 + n); ctx.lineTo(ox + n, oy + h / 2); ctx.lineTo(ox, oy + h / 2 - n); ctx.closePath();
  } else rr(ctx, ox, oy, w, h, shape === 'icon' ? 4 : 8);
}

function gatePath(ctx, shape, w, h) {
  const body = shape === 'not' || shape === 'nand' ? w - 10 : w - 2;
  ctx.beginPath();
  if (shape === 'not') {
    ctx.moveTo(4, 2); ctx.lineTo(body, h / 2); ctx.lineTo(4, h - 2); ctx.closePath();
  } else if (shape === 'and' || shape === 'nand') {
    const r = h / 2 - 2;
    ctx.moveTo(4, 2); ctx.lineTo(body - r, 2); ctx.arc(body - r, h / 2, r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(4, h - 2); ctx.closePath();
  } else { // or / xor
    ctx.moveTo(2, 2);
    ctx.quadraticCurveTo(body * 0.6, 2, body, h / 2);
    ctx.quadraticCurveTo(body * 0.6, h - 2, 2, h - 2);
    ctx.quadraticCurveTo(14, h / 2, 2, 2);
    ctx.closePath();
  }
}

export function drawPartIcon(canvas, part, lib) {
  // Small glyph for the parts bin: real shapes for gates and wiring, a simplified chip for boxes.
  const g = geom(part, lib);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = canvas.clientWidth || 52, H = canvas.clientHeight || 34;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const def = lib.get(part.type) || {};
  if (g.shape === 'box' || g.shape === 'mux' || g.shape === 'alu') {
    const nIn = g.ins.length, nOut = g.outs.length;
    const bw = 24, bh = Math.min(H - 6, Math.max(14, Math.max(nIn, nOut) * 5 + 6));
    const x = (W - bw) / 2, y = (H - bh) / 2;
    ctx.strokeStyle = '#5b6a90'; ctx.lineWidth = 1.2;
    const stub = (n, x0, x1) => { for (let i = 0; i < n; i++) { const yy = y + (bh * (i + 1)) / (n + 1); ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); } };
    stub(Math.min(nIn, 6), x - 6, x); stub(Math.min(nOut, 6), x + bw, x + bw + 6);
    boxPath(ctx, g.shape === 'box' ? 'icon' : g.shape, bw, bh, x, y);
    ctx.fillStyle = C.part; ctx.fill(); ctx.strokeStyle = '#7d8bb0'; ctx.stroke();
    ctx.fillStyle = def.kind === 'device' ? '#b48cff' : def.clocked ? '#57e3c1' : '#7f9cff';
    if (g.shape === 'box') ctx.fillRect(x + 4, y + 3, bw - 8, 2);
    return;
  }
  const s = Math.min((W - 8) / (g.w + 10), (H - 4) / (g.h + 6), 0.8);
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W - g.w * s) / 2, dpr * (H - g.h * s) / 2);
  const fake = { lib: () => lib, onEdit() {}, onSelect() {}, sound() {}, locked: () => false, toast() {} };
  const e = Object.create(Editor.prototype);
  e.host = fake; e.design = { parts: [part], wires: [] }; e.sel = new Set(); e.view = { x: 0, y: 0, z: 0.5 }; e.badges = new Map();
  e.disp = null; e.circuit = null;
  e._part(ctx, { ...part, x: 0, y: 0 }, false);
}

// Layered auto-layout: columns by logic depth, rows ordered by the average height of each part's drivers.
export function autoLayout(design, lib) {
  const parts = design.parts;
  const byId = new Map(parts.map((p) => [p.id, p]));
  const drivers = new Map(parts.map((p) => [p.id, []]));
  for (const w of design.wires) if (drivers.has(w.to.part) && byId.has(w.from.part)) drivers.get(w.to.part).push(w.from.part);
  const layer = new Map();
  const L = (id, stack) => {
    if (layer.has(id)) return layer.get(id);
    const p = byId.get(id);
    if (p.type === 'IN' || stack.has(id)) return 0;
    stack.add(id);
    let m = 0;
    for (const d of drivers.get(id)) m = Math.max(m, L(d, stack) + 1);
    stack.delete(id);
    layer.set(id, m);
    return m;
  };
  for (const p of parts) if (p.type === 'IN') layer.set(p.id, 0);
  for (const p of parts) L(p.id, new Set());
  const inner = parts.filter((p) => p.type !== 'OUT').map((p) => layer.get(p.id));
  const maxL = Math.max(0, ...inner);
  for (const p of parts) if (p.type === 'OUT') layer.set(p.id, maxL + 1);
  const cols = new Map();
  for (const p of parts) { const l = layer.get(p.id) || 0; if (!cols.has(l)) cols.set(l, []); cols.get(l).push(p); }
  const keys = [...cols.keys()].sort((a, b) => a - b);
  const cy = new Map();
  let x = 0;
  for (const l of keys) {
    const col = cols.get(l);
    const key = (p) => {
      const ds = drivers.get(p.id).filter((d) => cy.has(d));
      return ds.length ? ds.reduce((s, d) => s + cy.get(d), 0) / ds.length : p.y;
    };
    col.sort((a, b) => key(a) - key(b));
    let y = 0, wmax = 0;
    const gs = col.map((p) => geom(p, lib));
    const total = gs.reduce((s, g) => s + g.h + 2 * G, -2 * G);
    y = -Math.round(total / 2 / G) * G;
    col.forEach((p, i) => { p.x = x; p.y = y; cy.set(p.id, y + gs[i].h / 2); y += gs[i].h + 2 * G; wmax = Math.max(wmax, gs[i].w); });
    x += Math.ceil((wmax + 6 * G) / G) * G;
  }
  for (const w of design.wires) delete w.mx;
  return design;
}

Editor.prototype.tidy = function () {
  this.commit();
  autoLayout(this.design, this.lib);
  this.changed('tidy');
  this.fit();
};
