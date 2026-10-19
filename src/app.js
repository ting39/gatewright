// Gatewright — application glue: levels, bin, panel, tests, saving.

import { LEVELS, CHAPTERS, levelById, buildLibrary, toolsFor } from './levels.js';
import { PRIMS } from './chips.js';
import { compile } from './sim.js';
import { checkLevel, scoreOf, combVectors } from './check.js';
import { Editor, G, drawPartIcon } from './editor.js';
import { ProgramView } from './machine.js';
import { sfx } from './sound.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k[0] === '_' ? undefined : v)));

// ---------------------------------------------------------------------------
// Save data (localStorage, guarded)
// ---------------------------------------------------------------------------
const KEY = 'gatewright:v1';
const fresh = () => ({ v: 1, solved: {}, passed: {}, designs: {}, best: {}, code: {}, hints: {}, cur: 'not', sandbox: null, sound: true });
let save = fresh();
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) save = Object.assign(fresh(), s); } catch { /* private mode */ }
let saveTimer = 0;
function persist(now) {
  clearTimeout(saveTimer);
  const go = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* full or blocked */ } };
  if (now) go(); else saveTimer = setTimeout(go, 400);
}
const params = new URLSearchParams(location.search);
if (params.has('dev')) for (const l of LEVELS) save.solved[l.id] = save.solved[l.id] || { nand: l.par ? l.par.nand : 0 };
sfx.enabled = save.sound;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let level = null;        // current level (null in sandbox)
let lib = null;
let circuit = null;
let inputVals = {};
let lastResult = null;
let curRow = -1;
let running = 0;
let programView = null;
let inputValsPreset = null;

const isUnlocked = (l) => l.index === 0 || !!save.solved[LEVELS[l.index - 1].id] || !!save.solved[l.id];

const editor = new Editor($('#board'), {
  lib: () => lib,
  locked: (p) => !!level && p && (p.type === 'IN' || p.type === 'OUT'),
  onEdit: () => { recompile(); storeDesign(); clearBadges(); },
  onSelect: () => renderInspector(),
  onToggle: (part, rect) => toggleInput(part, rect),
  onBusWheel: (part, d) => setInput(part.cfg.name, ((inputVals[part.cfg.name] || 0) + d) & ((1 << part.cfg.width) - 1)),
  sound: (s) => sfx.play(s),
  toast: (m, k) => toast(m, k),
});

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------
function ioDesign(l) {
  const parts = [];
  const nIn = l.io.in.length, nOut = l.io.out.length;
  const span = Math.max(nIn, nOut);
  const gap = 4 * G;
  l.io.in.forEach((q, i) => parts.push({ id: 'in:' + q.name, type: 'IN', x: 0, y: (i + (span - nIn) / 2) * gap, cfg: { name: q.name, width: q.width } }));
  const right = Math.max(24, 12 + span * 3) * G;
  l.io.out.forEach((q, i) => parts.push({ id: 'out:' + q.name, type: 'OUT', x: right, y: Math.round((i + (span - nOut) / 2) * gap / G) * G, cfg: { name: q.name, width: q.width } }));
  for (const p of parts) p.y = Math.round(p.y / G) * G;
  return { parts, wires: [] };
}

function reconcileIO(d, l) {
  // Make a stored design match the level's pins (in case levels change between versions).
  const want = new Map([...l.io.in.map((q) => ['in:' + q.name, { type: 'IN', q }]), ...l.io.out.map((q) => ['out:' + q.name, { type: 'OUT', q }])]);
  d.parts = d.parts.filter((p) => (p.type !== 'IN' && p.type !== 'OUT') || (want.has(p.id) && want.get(p.id).q.width === p.cfg.width));
  const base = ioDesign(l);
  for (const p of base.parts) if (!d.parts.some((x) => x.id === p.id)) d.parts.push(p);
  return d;
}

function openLevel(id) {
  stopClock();
  const l = levelById[id] || LEVELS[0];
  if (!isUnlocked(l)) return openLevel(LEVELS.find((x) => !save.solved[x.id] && isUnlocked(x))?.id || 'not');
  level = l; save.cur = l.id; persist();
  lastResult = null; curRow = -1; inputVals = inputValsPreset || {}; inputValsPreset = null;
  closePanelOnMobile();
  history.replaceState(null, '', '#' + l.id);
  if (l.kind === 'program') return openProgram(l);
  setProgramMode(false);
  lib = buildLibrary(save.solved, save.passed, l.index);
  const d = save.designs[l.id] ? reconcileIO(clone(save.designs[l.id]), l) : ioDesign(l);
  editor.setDesign(d);
  recompile();
  renderCrumbs(); renderBin(); renderPanel(); renderInspector();
}

function openSandbox() {
  stopClock();
  level = null; save.cur = 'sandbox'; persist();
  history.replaceState(null, '', '#sandbox');
  setProgramMode(false);
  lastResult = null; inputVals = {};
  lib = buildLibrary(save.solved, save.passed);
  const d = save.sandbox ? clone(save.sandbox) : {
    parts: [
      { id: 'sa', type: 'IN', x: 0, y: 0, cfg: { name: 'a', width: 1 } },
      { id: 'sb', type: 'IN', x: 0, y: 4 * G, cfg: { name: 'b', width: 1 } },
      { id: 'so', type: 'OUT', x: 20 * G, y: 2 * G, cfg: { name: 'out', width: 1 } },
    ], wires: [],
  };
  d.parts = d.parts.filter((p) => lib.has(p.type));
  editor.setDesign(d);
  recompile();
  renderCrumbs(); renderBin(); renderPanel(); renderInspector();
}

function setProgramMode(on) {
  $('#work').classList.toggle('program', on);
  $('#machine').hidden = !on;
  if (!on && programView) { programView.destroy(); programView = null; }
}

function openProgram(l) {
  setProgramMode(true);
  lib = buildLibrary(save.solved, save.passed);
  renderCrumbs();
  if (programView) programView.destroy();
  programView = new ProgramView($('#machine'), {
    level: l, lib,
    computer: save.passed.computer,
    code: save.code[l.id] ?? l.starter,
    onCode: (src) => { save.code[l.id] = src; persist(); },
    onResult: (r) => programResult(l, r),
    sound: (s) => sfx.play(s), toast,
  });
  renderPanel();
}

function storeDesign() {
  const d = clone(editor.design);
  if (level) save.designs[level.id] = d; else save.sandbox = d;
  persist();
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
function recompile() {
  if (!lib) return;
  circuit = compile(editor.design, lib);
  for (const k in circuit.inputs) circuit.set(k, inputVals[k] || 0);
  circuit.evaluate();
  editor.setCircuit(circuit);
  editor.propagate(false);
  const clocked = circuit.seq.length > 0;
  $('#toolbar').classList.toggle('clock', clocked);
  if (!clocked) stopClock();
  updateCycles();
  renderStats();
}

function setInput(name, v) {
  inputVals[name] = v;
  if (!circuit) return;
  circuit.set(name, v);
  circuit.evaluate();
  editor.propagate(true);
  clearBadges();
  renderStats();
}

function toggleInput(part, rect) {
  const w = part.cfg.width || 1;
  if (w === 1) { setInput(part.cfg.name, (inputVals[part.cfg.name] || 0) ^ 1); sfx.play(inputVals[part.cfg.name] ? 'on' : 'off'); return; }
  const box = $('#busEdit'), inp = $('#busInput');
  const sr = $('#stage').getBoundingClientRect();
  box.hidden = false;
  box.style.left = Math.max(8, rect.x - sr.left) + 'px';
  box.style.top = Math.max(8, rect.y - sr.top - 46) + 'px';
  inp.max = (1 << w) - 1;
  inp.value = inputVals[part.cfg.name] || 0;
  const upd = () => { $('#busHex').textContent = '0x' + (+inp.value || 0).toString(16).toUpperCase() + ' · 0b' + (+inp.value || 0).toString(2).padStart(w, '0'); };
  upd();
  inp.oninput = () => { const v = Math.max(0, Math.min((1 << w) - 1, +inp.value || 0)); setInput(part.cfg.name, v); upd(); };
  inp.onkeydown = (e) => { if (e.key === 'Enter' || e.key === 'Escape') { box.hidden = true; $('#board').focus(); } };
  inp.onblur = () => setTimeout(() => { if (document.activeElement !== inp) box.hidden = true; }, 120);
  inp.focus(); inp.select();
}

function tick() {
  if (!circuit || !circuit.seq.length) return;
  circuit.tick();
  editor.propagate(true);
  updateCycles();
  sfx.play('tick');
}
function stopClock() { if (running) { clearInterval(running); running = 0; } $('#tRun').textContent = '▶'; }
function toggleRun() {
  if (running) return stopClock();
  running = setInterval(tick, 400);
  $('#tRun').textContent = '❚❚';
}
function updateCycles() { $('#tCycles').textContent = circuit ? 'cycle ' + circuit.cycles : ''; }

function renderStats() {
  if (!lib) return;
  const s = scoreOf(editor.design, lib);
  const el = $('#stats');
  const unstable = circuit && circuit.unstable.size;
  el.innerHTML = `<span>NAND <b>${s.nand}</b></span><span>delay <b>${s.delay ?? '—'}</b></span>` +
    (unstable ? '<span class="warn">⚠ oscillating</span>' : '') + (circuit && circuit.errors.length ? `<span class="warn">⚠ ${esc(circuit.errors[0].msg)}</span>` : '');
  const sc = $('#scoreNow');
  if (sc) sc.innerHTML = scoreHTML(s);
  const empty = editor.design.parts.every((p) => p.type === 'IN' || p.type === 'OUT');
  showCoach(level && level.index === 0 && empty);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
function runTests() {
  if (!level || level.kind === 'program') return;
  stopClock();
  const r = checkLevel(level, clone(editor.design), lib);
  lastResult = r; curRow = -1;
  const s = scoreOf(editor.design, lib);
  if (r.pass) {
    const first = !save.solved[level.id];
    const prevBest = save.best[level.id];
    save.solved[level.id] = { nand: s.nand, delay: s.delay, at: Date.now() };
    save.passed[level.id] = clone(editor.design);
    const better = !prevBest || s.nand < prevBest.nand || (s.nand === prevBest.nand && (s.delay ?? 1e9) < (prevBest.delay ?? 1e9));
    if (better) save.best[level.id] = { nand: s.nand, delay: s.delay };
    persist(true);
    sfx.play('win');
    if (first) showWin(level, s); else toast(better ? 'Passed, with a new personal best!' : 'All tests pass ✓', 'ok');
  } else {
    sfx.play('fail');
    if (r.fail && r.fail.index !== undefined && r.rows && r.rows[r.fail.index]) loadRow(r.fail.index, false);
  }
  renderPanel();
  renderCrumbs();
  if (r.pass) clearBadges();
}

function programResult(l, r) {
  lastResult = r;
  if (r.pass) {
    const first = !save.solved[l.id];
    const prev = save.best[l.id];
    save.solved[l.id] = { size: r.size, cycles: r.cycles, at: Date.now() };
    const better = !prev || r.size < prev.size || (r.size === prev.size && r.cycles < prev.cycles);
    if (better) save.best[l.id] = { size: r.size, cycles: r.cycles };
    persist(true);
    sfx.play('win');
    if (first) showWin(l, r); else toast(better ? 'Passed, with a new personal best!' : 'All cases pass ✓', 'ok');
  } else sfx.play('fail');
  renderPanel(); renderCrumbs();
}

function clearBadges() { if (editor.badges.size) { editor.badges.clear(); editor.request(); } }

// Load a test row onto the board: set the inputs (replaying earlier steps for sequential levels).
function loadRow(i, sound = true) {
  const r = lastResult;
  if (!r || !r.rows[i] || !circuit) return;
  const row = r.rows[i];
  if (r.kind === 'cpu' || r.kind === 'computer') { toast('This is a whole-program check. Read the message above to see what went wrong.', 'info'); return; }
  curRow = i;
  if (r.sequence) {
    circuit.reset();
    for (let k = 0; k <= i; k++) {
      circuit.setAll(r.rows[k].inputs);
      circuit.evaluate();
      if (k < i && r.kind === 'seq') circuit.tick();
    }
    Object.assign(inputVals, row.inputs);
    editor.propagate(false);
  } else {
    for (const k in row.inputs) inputVals[k] = row.inputs[k];
    circuit.setAll(row.inputs);
    circuit.evaluate();
    editor.propagate(true);
  }
  editor.badges.clear();
  for (const q of level.io.out) {
    const e = row.expected[q.name];
    if (e === null || e === undefined) continue;
    editor.badges.set('out:' + q.name, { expected: e, ok: circuit.get(q.name) === e });
  }
  editor.request();
  updateCycles(); renderStats();
  document.querySelectorAll('.tt tr').forEach((tr) => tr.classList.toggle('cur', +tr.dataset.i === i));
  if (sound) sfx.play('tick');
}

// ---------------------------------------------------------------------------
// Rendering: crumbs, bin, panel, inspector
// ---------------------------------------------------------------------------
function renderCrumbs() {
  const c = $('#crumbs');
  if (!level) { c.innerHTML = '<span class="ch">Sandbox</span><span class="lv">Build anything</span>'; return; }
  const ch = CHAPTERS.find((x) => x.id === level.chapter);
  c.innerHTML = `<span class="ch">${esc(ch.title)}</span><span class="lv">${level.index + 1}. ${esc(level.title)}</span>` + (save.solved[level.id] ? '<span class="solved">✓ solved</span>' : '');
}

const PART_INFO = {
  IN: { name: 'Input', blurb: 'A pin into your chip. Click it to flip it.' },
  OUT: { name: 'Output', blurb: 'A pin out of your chip.' },
};

function binItems() {
  const items = { io: [], wire: [], chips: [], dev: [] };
  const tools = level ? toolsFor(level.index) : ['FAN', 'SPLIT', 'JOIN', 'CONST', ...(save.solved.computer ? ['ROM', 'RAM256'] : [])];
  if (!level) { items.io.push({ type: 'IN', cfg: { name: 'in', width: 1 } }, { type: 'OUT', cfg: { name: 'out', width: 1 } }); }
  for (const t of ['SPLIT', 'JOIN', 'FAN', 'CONST']) if (tools.includes(t)) items.wire.push({ type: t, cfg: structuredClone(PRIMS[t].defaults) });
  items.chips.push({ type: 'NAND' });
  for (const c of lib.chips.values()) items.chips.push({ type: c.name });
  for (const t of ['ROM', 'RAM256']) if (tools.includes(t)) items.dev.push({ type: t });
  return items;
}

function renderBin() {
  const bin = $('#bin');
  bin.innerHTML = '';
  const items = binItems();
  const newest = level && level.index > 0 ? LEVELS[level.index - 1].chip : null;
  const newTools = level && level.tools ? level.tools : [];
  const sec = (title, arr) => {
    if (!arr.length) return;
    const h = document.createElement('h3'); h.textContent = title; bin.appendChild(h);
    for (const it of arr) {
      const b = document.createElement('button');
      b.className = 'pitem' + (it.type === newest || newTools.includes(it.type) ? ' new' : '');
      const def = lib.get(it.type) || PRIMS[it.type];
      const name = PART_INFO[it.type]?.name || def.label || it.type;
      const n = lib.nandCount(it.type);
      b.innerHTML = `<canvas></canvas><span><span class="nm">${esc(name)}</span><span class="ct">${def.kind === 'wire' ? 'wiring' : def.kind === 'device' ? 'device' : it.type === 'IN' || it.type === 'OUT' ? 'pin' : n + ' NAND'}</span></span>`;
      b.title = (PART_INFO[it.type]?.blurb || def.blurb || name) + '\nDrag onto the board, or click to drop it in the middle.';
      b.setAttribute('aria-label', 'Add ' + name);
      bin.appendChild(b);
      requestAnimationFrame(() => drawPartIcon(b.querySelector('canvas'), { id: 'icon', type: it.type, x: 0, y: 0, cfg: it.cfg }, lib));
      bindBinDrag(b, it);
    }
  };
  sec('Pins', items.io);
  sec('Chips', items.chips);
  sec('Wiring', items.wire);
  sec('Devices', items.dev);
}

let dropCount = 0;
function bindBinDrag(el, it) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let dragging = false;
    const stage = $('#stage');
    const move = (ev) => {
      if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) dragging = true;
      if (!dragging) return;
      const r = stage.getBoundingClientRect();
      const inside = ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom;
      editor.ghost = inside ? { id: 'ghost', type: it.type, cfg: it.cfg && structuredClone(it.cfg), ...editor.toWorld(ev.clientX - r.left, ev.clientY - r.top) } : null;
      editor.request();
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const g = editor.ghost; editor.ghost = null;
      if (dragging && g) placePart(it, g.x, g.y);
      else if (!dragging && ev.type === 'pointerup') {
        const c = editor.center();
        const k = dropCount++ % 6;
        placePart(it, c.x + k * G, c.y + k * G);
      }
      editor.request();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

function placePart(it, x, y) {
  const extra = {};
  if (it.cfg) extra.cfg = structuredClone(it.cfg);
  if (it.type === 'IN' || it.type === 'OUT') {
    const used = new Set(editor.design.parts.filter((p) => p.type === it.type).map((p) => p.cfg.name));
    const base = it.type === 'IN' ? 'abcdefghijklmn' : 'xyzuvw';
    let name = [...base].find((c) => !used.has(c)) || (it.type === 'IN' ? 'in' : 'out') + used.size;
    if (it.type === 'OUT' && !used.has('out')) name = 'out';
    extra.cfg.name = name;
  }
  editor.addPart(it.type, x, y, extra);
}

function scoreHTML(s) {
  const par = level && level.par;
  const best = level && save.best[level.id];
  const gold = par && s.nand > 0 && s.nand <= par.nand && save.solved[level.id];
  return `<div><small>NAND now</small><b class="${gold ? 'gold' : ''}">${s.nand}</b></div>` +
    `<div><small>Delay now</small><b>${s.delay ?? '—'}</b></div>` +
    `<div><small>Best · par</small><b>${best ? best.nand : '–'} · ${par ? par.nand : '–'}</b></div>`;
}

function truthTable(l) {
  if (l.kind !== 'comb') return '';
  const bits = l.io.in.reduce((a, q) => a + q.width, 0);
  if (bits > 4) return '';
  const vecs = combVectors(l);
  let h = '<div class="ttwrap"><table class="tt spec"><thead><tr>' + l.io.in.map((q) => `<th>${esc(q.name)}</th>`).join('') + l.io.out.map((q, i) => `<th class="${i ? '' : 'sep'}">${esc(q.name)}</th>`).join('') + '</tr></thead><tbody>';
  vecs.forEach((v, i) => {
    const o = l.spec(v);
    h += `<tr data-spec="${i}">` + l.io.in.map((q) => `<td>${v[q.name]}</td>`).join('') + l.io.out.map((q, k) => `<td class="${k ? '' : 'sep'}">${o[q.name]}</td>`).join('') + '</tr>';
  });
  return h + '</tbody></table></div><p class="note">Click a row to set those inputs.</p>';
}

function resultHTML(r) {
  if (!r) return '';
  if (r.error) return `<div class="result fail"><h4>Can't test yet</h4><p>${esc(r.error)}</p></div>`;
  let h = `<div class="result ${r.pass ? 'pass' : 'fail'}"><h4>${r.pass ? '✓ All ' + r.total + ' checks pass' : '✗ ' + r.passed + ' / ' + r.total + ' checks pass'}</h4>`;
  if (!r.pass && r.fail) h += `<p>${esc(r.fail.msg)}</p>`;
  if (!r.pass && r.fail && r.fail.note) h += `<p class="note">${esc(r.fail.note)}</p>`;
  h += '</div>';
  if (!r.rows || !r.rows.length || r.kind === 'program') return h;
  const l = level;
  const ins = r.kind === 'cpu' || r.kind === 'computer' ? [] : l.io.in.map((q) => q.name);
  const outs = r.kind === 'cpu' ? ['pc', 'out', 'write', 'addr'] : r.kind === 'computer' ? ['pc'] : l.io.out.map((q) => q.name);
  // Show failing row first-class: all rows up to 120, centered around failure.
  let rows = r.rows.map((row, i) => [row, i]);
  const fi = r.fail ? r.fail.index ?? -1 : -1;
  if (rows.length > 120) { const s = Math.max(0, Math.min(rows.length - 120, fi - 60)); rows = rows.slice(s, s + 120); }
  h += '<div class="ttwrap"><table class="tt"><thead><tr><th></th>' + (r.sequence ? '<th>#</th>' : '') + ins.map((n) => `<th>${esc(n)}</th>`).join('') + outs.map((n, i) => `<th class="${i ? '' : 'sep'}">${esc(n)}</th>`).join('') + '</tr></thead><tbody>';
  for (const [row, i] of rows) {
    const cls = row.ok ? 'ok' : 'bad';
    h += `<tr class="${cls}${i === curRow ? ' cur' : ''}" data-i="${i}"><td class="mark">${row.ok ? '✓' : '✗'}</td>` + (r.sequence ? `<td>${row.cycle ?? row.step ?? i}</td>` : '') +
      ins.map((n) => `<td>${row.inputs[n]}</td>`).join('') +
      outs.map((n, k) => {
        const e = row.expected[n], g = row.got[n];
        const wrong = e !== null && e !== undefined && e !== g;
        return `<td class="${k ? '' : 'sep'} ${wrong ? 'got' : ''}">${wrong ? g + ' ≠ ' + e : (e === null ? g + '<span class="note">?</span>' : g ?? '')}</td>`;
      }).join('') + '</tr>';
  }
  h += '</tbody></table></div>';
  if (r.kind !== 'cpu' && r.kind !== 'computer') h += '<p class="note">Click a row to load it onto the board.' + (r.sequence ? ' Earlier steps are replayed first.' : '') + ' "?" means the value is not defined yet.</p>';
  return h;
}

function renderPanel() {
  const body = $('#panelBody');
  if (!level) {
    body.innerHTML = `<div class="brief"><div class="kicker">Sandbox</div><h2>Build anything</h2>
      <p>Everything you've unlocked is in the bin. Add pins from <b>Pins</b> and rename them in the inspector.</p>
      <p>Nothing here is tested or scored. It's a place to try ideas: a 4-bit counter, a traffic light, a whole second CPU.</p>
      <div class="actions"><button class="ghost" id="pClear">Clear board</button><button class="ghost" id="pExport">Export design</button></div>
      <div class="score" id="scoreNow"></div></div>`;
    $('#pClear').onclick = () => { editor.commit(); editor.design.parts = editor.design.parts.filter((p) => p.type === 'IN' || p.type === 'OUT'); editor.design.wires = []; editor.changed('clear'); };
    $('#pExport').onclick = exportDesign;
    renderStats();
    return;
  }
  const l = level;
  const ch = CHAPTERS.find((x) => x.id === l.chapter);
  const hintsShown = save.hints[l.id] || 0;
  let h = `<div class="brief"><div class="kicker">${esc(ch.title)} · Level ${l.index + 1} of ${LEVELS.length}</div><h2>${esc(l.title)}</h2>`;
  if (l.io && l.kind !== 'program') h += `<div class="pins"><span>in: ${l.io.in.map((q) => `<b>${esc(q.name)}</b>${q.width > 1 ? '[' + q.width + ']' : ''}`).join(', ')}</span><span>out: ${l.io.out.map((q) => `<b>${esc(q.name)}</b>${q.width > 1 ? '[' + q.width + ']' : ''}`).join(', ')}</span></div>`;
  h += l.brief;
  if (l.kind === 'program') {
    h += `<div class="actions"><button class="primary" id="pTest">Run tests</button><button class="ghost" id="pHint" ${hintsShown >= l.hints.length ? 'disabled' : ''}>Hint (${hintsShown}/${l.hints.length})</button></div>`;
  } else {
    h += truthTable(l);
    h += `<div class="actions"><button class="primary" id="pTest">Test ▶</button><button class="ghost" id="pHint" ${hintsShown >= l.hints.length ? 'disabled' : ''}>Hint (${hintsShown}/${l.hints.length})</button><button class="ghost" id="pReset" title="Remove everything except the pins">Clear</button></div>`;
  }
  for (let i = 0; i < hintsShown; i++) h += `<div class="hint">${esc(l.hints[i])}</div>`;
  if (l.kind === 'program') {
    const best = save.best[l.id];
    h += `<div class="score"><div><small>Best size</small><b>${best ? best.size : '–'}</b></div><div><small>Best cycles</small><b>${best ? best.cycles : '–'}</b></div><div><small>Instr. limit</small><b>256</b></div></div>`;
    if (lastResult && lastResult.kind === 'program' || lastResult && lastResult.error) h += programResultHTML(lastResult);
  } else {
    h += '<div class="score" id="scoreNow"></div>';
    h += resultHTML(lastResult);
  }
  const next = LEVELS[l.index + 1];
  if (save.solved[l.id] && next) h += `<div class="actions"><button class="primary" id="pNext">Next: ${esc(next.title)} →</button></div>`;
  h += '</div>';
  body.innerHTML = h;
  $('#pTest').onclick = () => (l.kind === 'program' ? programView && programView.test() : runTests());
  $('#pHint').onclick = () => { save.hints[l.id] = Math.min(l.hints.length, hintsShown + 1); persist(); renderPanel(); sfx.play('hint'); };
  if ($('#pReset')) $('#pReset').onclick = () => { editor.commit(); editor.design.parts = editor.design.parts.filter((p) => p.type === 'IN' || p.type === 'OUT'); editor.design.wires = []; editor.changed('clear'); toast('Board cleared. Undo with Ctrl+Z', 'info'); };
  if ($('#pNext')) $('#pNext').onclick = () => openLevel(next.id);
  body.querySelectorAll('.tt tr[data-i]').forEach((tr) => tr.addEventListener('click', () => loadRow(+tr.dataset.i)));
  body.querySelectorAll('.tt tr[data-spec]').forEach((tr) => tr.addEventListener('click', () => {
    const v = combVectors(l)[+tr.dataset.spec];
    for (const k in v) inputVals[k] = v[k];
    circuit.setAll(v); circuit.evaluate(); editor.propagate(true);
    editor.badges.clear();
    const o = l.spec(v);
    for (const q of l.io.out) editor.badges.set('out:' + q.name, { expected: o[q.name], ok: circuit.get(q.name) === o[q.name] });
    editor.request(); sfx.play('tick');
  }));
  renderStats();
}

function programResultHTML(r) {
  if (r.error) return `<div class="result fail"><h4>Can't run</h4><p>${esc(r.error)}</p></div>`;
  let h = `<div class="result ${r.pass ? 'pass' : 'fail'}"><h4>${r.pass ? '✓ All ' + r.total + ' cases pass' : '✗ ' + r.passed + ' / ' + r.total + ' cases pass'}</h4>`;
  if (r.pass) h += `<p>${r.size} instructions · ${r.cycles} cycles in the slowest case.</p>`;
  else if (r.fail) h += `<p>${esc(r.fail.msg)}</p>`;
  return h + '</div>';
}

function renderInspector() {
  const el = $('#inspector');
  const ids = [...editor.sel];
  if (editor.selWire) {
    const w = editor.design.wires.find((x) => x.id === editor.selWire);
    if (!w) { el.hidden = true; return; }
    const v = editor.valueOfWire(w);
    el.hidden = false;
    el.innerHTML = `<h4>Wire <small>value ${v}</small></h4><p>Drag its middle segment to re-route. Double-click resets the route.</p>
      <div class="row"><button class="chip-btn" id="iStraight">Auto route</button><button class="chip-btn danger" id="iDel">Delete</button></div>`;
    $('#iStraight').onclick = () => { editor.commit(); delete w.mx; editor.changed('route'); };
    $('#iDel').onclick = () => editor.deleteSelection();
    return;
  }
  if (ids.length !== 1) {
    if (ids.length > 1) {
      el.hidden = false;
      el.innerHTML = `<h4>${ids.length} parts</h4><div class="row"><button class="chip-btn" id="iDup">Duplicate</button><button class="chip-btn danger" id="iDel">Delete</button></div>`;
      $('#iDup').onclick = () => { if (editor.copy()) editor.paste(); };
      $('#iDel').onclick = () => editor.deleteSelection();
    } else el.hidden = true;
    return;
  }
  const p = editor.partById(ids[0]);
  if (!p) { el.hidden = true; return; }
  const def = lib.get(p.type) || {};
  const locked = level && (p.type === 'IN' || p.type === 'OUT');
  const name = PART_INFO[p.type]?.name || def.label || p.type;
  const n = lib.nandCount(p.type) * (p.lanes || 1);
  let h = `<h4>${esc(locked ? p.cfg.name : name)} <small>${def.kind === 'wire' || p.type === 'IN' || p.type === 'OUT' ? '' : n + ' NAND'}</small></h4>`;
  const blurb = PART_INFO[p.type]?.blurb || def.blurb;
  if (locked) h += `<p>${p.type === 'IN' ? 'Level input' : 'Level output'}, ${p.cfg.width}-bit. ${p.type === 'IN' ? (p.cfg.width > 1 ? 'Click to type a value, or scroll over it.' : 'Click to flip it.') : ''}</p>`;
  else if (blurb) h += `<p>${esc(blurb)}</p>`;
  else if (def.pins) h += `<p>${def.pins.in.map((q) => q.name + (q.width > 1 ? '[' + q.width + ']' : '')).join(', ')} → ${def.pins.out.map((q) => q.name + (q.width > 1 ? '[' + q.width + ']' : '')).join(', ')}</p>`;
  const rows = [];
  if (lib.laneable(p.type) && (!level || level.index >= LEVELS.findIndex((x) => x.id === 'mux8'))) {
    rows.push(`<div class="row"><label>Lanes</label><span class="seg" id="iLanes">${[1, 2, 3, 4, 8, 16].map((k) => `<button data-k="${k}" class="${(p.lanes || 1) === k ? 'on' : ''}">${k}</button>`).join('')}</span></div>`);
  }
  if (p.type === 'SPLIT' || p.type === 'JOIN') {
    rows.push(`<div class="row"><label>Widths</label><input type="text" id="iWidths" value="${p.cfg.widths.join(',')}" aria-label="Widths, lowest bits first"></div>
      <div class="row"><span class="seg" id="iPresets">${[['8×1', '1,1,1,1,1,1,1,1'], ['4+4', '4,4'], ['8+8', '8,8'], ['3×1', '1,1,1'], ['2×1', '1,1'], ['7+1', '7,1']].map(([t, v]) => `<button data-v="${v}">${t}</button>`).join('')}</span></div>`);
  }
  if (p.type === 'FAN') rows.push(`<div class="row"><label>Width</label><span class="seg" id="iW">${[2, 3, 4, 8, 16].map((k) => `<button data-k="${k}" class="${p.cfg.width === k ? 'on' : ''}">${k}</button>`).join('')}</span></div>`);
  if (p.type === 'CONST') rows.push(`<div class="row"><label>Width</label><span class="seg" id="iW">${[1, 2, 3, 4, 8].map((k) => `<button data-k="${k}" class="${p.cfg.width === k ? 'on' : ''}">${k}</button>`).join('')}</span></div><div class="row"><label>Value</label><input type="number" id="iVal" min="0" value="${p.cfg.value}"></div>`);
  if (!level && (p.type === 'IN' || p.type === 'OUT')) rows.push(`<div class="row"><label>Name</label><input type="text" id="iName" value="${esc(p.cfg.name)}" maxlength="12"></div><div class="row"><label>Width</label><span class="seg" id="iW">${[1, 2, 3, 4, 8, 16].map((k) => `<button data-k="${k}" class="${(p.cfg.width || 1) === k ? 'on' : ''}">${k}</button>`).join('')}</span></div>`);
  h += rows.join('');
  if (!locked) h += `<div class="row"><button class="chip-btn" id="iDup">Duplicate</button><button class="chip-btn danger" id="iDel">Delete</button></div>`;
  el.innerHTML = h; el.hidden = false;
  const on = (sel, fn) => { const x = el.querySelector(sel); if (x) fn(x); };
  on('#iLanes', (x) => x.querySelectorAll('button').forEach((b) => (b.onclick = () => editor.updatePart(p.id, (q) => { const k = +b.dataset.k; if (k === 1) delete q.lanes; else q.lanes = k; }))));
  on('#iW', (x) => x.querySelectorAll('button').forEach((b) => (b.onclick = () => editor.updatePart(p.id, (q) => { q.cfg.width = +b.dataset.k; if (q.type === 'CONST') q.cfg.value &= (1 << q.cfg.width) - 1; }))));
  on('#iVal', (x) => (x.onchange = () => editor.updatePart(p.id, (q) => { q.cfg.value = Math.max(0, Math.min((1 << q.cfg.width) - 1, +x.value || 0)); })));
  const setWidths = (v) => {
    const ws = v.split(/[,\s+]+/).map((s) => parseInt(s, 10)).filter((n) => n > 0 && n <= 16);
    const total = ws.reduce((a, b) => a + b, 0);
    if (!ws.length || ws.length > 16 || total > 16) { toast('Widths must be 1–16 numbers adding up to at most 16', 'err'); return; }
    editor.updatePart(p.id, (q) => { q.cfg.widths = ws; });
  };
  on('#iWidths', (x) => (x.onchange = () => setWidths(x.value)));
  on('#iPresets', (x) => x.querySelectorAll('button').forEach((b) => (b.onclick = () => setWidths(b.dataset.v))));
  on('#iName', (x) => (x.onchange = () => {
    const nm = x.value.trim().replace(/[^\w]/g, '').slice(0, 12);
    if (!nm) return;
    if (editor.design.parts.some((o) => o !== p && o.type === p.type && o.cfg.name === nm)) { toast('Another pin already has that name', 'err'); return; }
    editor.updatePart(p.id, (q) => { q.cfg.name = nm; });
  }));
  on('#iDup', (x) => (x.onclick = () => { if (editor.copy()) editor.paste(); }));
  on('#iDel', (x) => (x.onclick = () => editor.deleteSelection()));
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------
function modal(html, cls = '') {
  const m = $('#modal');
  const s = m.querySelector('.sheet');
  s.className = 'sheet ' + cls;
  s.innerHTML = '<button class="close" aria-label="Close">×</button>' + html;
  m.hidden = false;
  s.querySelector('.close').onclick = closeModal;
  m.onclick = (e) => { if (e.target === m) closeModal(); };
  const f = s.querySelector('.primary') || s.querySelector('button:not(.close)');
  if (f) f.focus();
  return s;
}
function closeModal() { $('#modal').hidden = true; $('#board').focus({ preventScroll: true }); }

function showMap() {
  let h = '<h2>Level map</h2><p class="note">From one NAND to a computer you can program. Solve a level to unlock the next. ★ = at or under par NAND count.</p><div class="map">';
  for (const ch of CHAPTERS) {
    h += `<div class="chap"><h3>${esc(ch.title)}</h3><p>${esc(ch.blurb)}</p>`;
    for (const l of LEVELS.filter((x) => x.chapter === ch.id)) {
      const s = save.solved[l.id], best = save.best[l.id];
      const star = l.par && best && best.nand <= l.par.nand;
      const m = s ? (l.kind === 'program' ? (best ? best.size + ' instr' : '✓') : (star ? '★ ' : '✓ ') + (best ? best.nand : '')) : '';
      h += `<button class="lvl ${s ? 'done' : ''} ${level && level.id === l.id ? 'cur' : ''}" data-id="${l.id}" ${isUnlocked(l) ? '' : 'disabled'}><span class="n">${l.index + 1}</span><span class="t">${esc(l.title)}</span><span class="m ${star ? 'gold' : ''}">${isUnlocked(l) ? m : '🔒'}</span></button>`;
    }
    h += '</div>';
  }
  h += '</div>';
  const s = modal(h);
  s.querySelectorAll('.lvl').forEach((b) => (b.onclick = () => { closeModal(); openLevel(b.dataset.id); }));
}

function showWin(l, s) {
  const next = LEVELS[l.index + 1];
  const chip = l.chip;
  let stats = '';
  if (l.kind === 'program') stats = `<p>${s.size} instructions · ${s.cycles} cycles</p>`;
  else stats = `<p>${s.nand} NAND gates · delay ${s.delay ?? '—'}${l.par ? ` · par ${l.par.nand}` : ''}</p>` + (l.par && s.nand <= l.par.nand ? '<p style="color:var(--on)">★ At or under par!</p>' : l.par ? `<p class="note">Par is ${l.par.nand} NAND. You can come back and beat it any time.</p>` : '');
  const finale = !next;
  const h = `<div class="big">${finale ? '🏆' : '⚡'}</div><h2>${finale ? 'You built a computer, and programmed it.' : 'Level complete'}</h2>${stats}` +
    (chip && l.kind !== 'program' ? `<div class="unlock"><canvas id="winIcon"></canvas><div><b>${esc(l.label || chip)}</b> is now in your parts bin</div></div>` : '') +
    (finale ? '<p>Every gate in that machine traces back to the one NAND you started with. The sandbox has all your chips, a ROM and a RAM, for whatever you want to build next.</p>' : '') +
    `<div class="actions" style="justify-content:center">${next ? `<button class="primary" id="wNext">Next: ${esc(next.title)} →</button>` : '<button class="primary" id="wSand">Open the sandbox</button>'}<button class="ghost" id="wStay">Stay here</button></div>`;
  const sh = modal(h, 'win');
  if (chip && l.kind !== 'program') {
    const tmp = buildLibrary(save.solved, save.passed);
    requestAnimationFrame(() => { const c = sh.querySelector('#winIcon'); if (c) drawPartIcon(c, { id: 'w', type: l.unlock ? chip : chip, x: 0, y: 0 }, tmp); });
  }
  if (sh.querySelector('#wNext')) sh.querySelector('#wNext').onclick = () => { closeModal(); openLevel(next.id); };
  if (sh.querySelector('#wSand')) sh.querySelector('#wSand').onclick = () => { closeModal(); openSandbox(); };
  sh.querySelector('#wStay').onclick = closeModal;
  celebrate();
}

function showHelp() {
  modal(`<h2>Controls</h2><div class="keys">
    <kbd>drag from bin</kbd><span>place a part (or click it to drop in the middle)</span>
    <kbd>drag pin → pin</kbd><span>lay a wire. Wiring onto an input that is already wired replaces the old wire.</span>
    <kbd>click input</kbd><span>flip it (bus inputs: type a value, or scroll over it)</span>
    <kbd>drag empty space</kbd><span>pan (also right/middle drag, or hold Space)</span>
    <kbd>wheel / pinch</kbd><span>zoom</span>
    <kbd>Shift+drag</kbd><span>box-select</span>
    <kbd>Shift+click</kbd><span>add to the selection</span>
    <kbd>Del / Backspace</kbd><span>delete selection</span>
    <kbd>Ctrl+Z / Ctrl+Shift+Z</kbd><span>undo / redo</span>
    <kbd>Ctrl+C / Ctrl+V / Ctrl+D</kbd><span>copy / paste / duplicate</span>
    <kbd>Ctrl+A</kbd><span>select everything</span>
    <kbd>arrows</kbd><span>nudge selection</span>
    <kbd>F</kbd><span>fit to screen</span>
    <kbd>T</kbd><span>run the tests</span>
    <kbd>Enter</kbd><span>clock tick (memory levels)</span>
    <kbd>Esc</kbd><span>deselect</span>
  </div>
  <h3 style="margin-top:18px">How it works</h3>
  <p class="note">Wires glow amber when they carry 1. Buses (thick wires) are blue when non-zero and show their value. When you flip an input, the change visibly ripples through the gates, one NAND delay at a time.<br>
  Your score is the number of NAND gates inside your chip, counting the gates in the chips you built earlier. Delay is the longest chain of NANDs a signal has to pass through.<br>
  Unconnected inputs read 0. Chips you finish are reused as "sealed" parts that behave exactly like their spec.</p>`);
}

function showMenu() {
  const s = modal(`<h2>Save & share</h2><p class="note">Progress saves automatically in this browser.</p><div class="menu-list">
    <button class="ghost" id="mExport">⬇ Export all progress (.json)</button>
    <button class="ghost" id="mImport">⬆ Import progress or a design</button>
    <button class="ghost" id="mDesign">⬇ Export this board</button>
    <button class="ghost" id="mWipe" style="color:var(--err)">Erase all progress…</button></div>`);
  s.querySelector('#mExport').onclick = () => download('gatewright-save.json', JSON.stringify(save, null, 1));
  s.querySelector('#mDesign').onclick = exportDesign;
  s.querySelector('#mImport').onclick = () => $('#fileIn').click();
  s.querySelector('#mWipe').onclick = () => {
    if (!confirm('Erase every solved level and design? This cannot be undone.')) return;
    save = fresh(); persist(true); closeModal(); openLevel('not');
  };
}

function exportDesign() {
  const name = level ? level.id : 'sandbox';
  download(`gatewright-${name}.json`, JSON.stringify({ gatewright: 'design', level: level ? level.id : null, design: clone(editor.design) }, null, 1));
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
$('#fileIn').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data && data.v === 1 && data.solved) {
      if (!confirm('Replace your current progress with this save file?')) return;
      save = Object.assign(fresh(), data); persist(true); closeModal(); openLevel(save.cur && levelById[save.cur] ? save.cur : 'not');
      toast('Progress imported', 'ok');
    } else if (data && data.gatewright === 'design' && data.design && Array.isArray(data.design.parts)) {
      closeModal();
      if (data.level && levelById[data.level] && isUnlocked(levelById[data.level])) { save.designs[data.level] = data.design; openLevel(data.level); }
      else { save.sandbox = data.design; openSandbox(); }
      toast('Design imported', 'ok');
    } else throw new Error('not a Gatewright file');
  } catch (err) { toast('Could not import: ' + err.message, 'err'); }
});

// ---------------------------------------------------------------------------
// Toast, coach, celebration
// ---------------------------------------------------------------------------
let toastT = 0;
function toast(msg, kind = 'info') {
  const t = $('#toast');
  t.textContent = msg; t.className = 'show ' + kind;
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = kind), 2600);
}

let coachEl = null;
function showCoach(on) {
  if (!coachEl) {
    coachEl = document.createElement('div');
    coachEl.className = 'float';
    Object.assign(coachEl.style, { left: '50%', top: '38%', transform: 'translate(-50%,-50%)', padding: '12px 16px', pointerEvents: 'none', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' });
    coachEl.innerHTML = '<b style="color:var(--on)">← Drag a NAND from the bin</b><br>then wire <b>a</b> to its inputs, and its output to <b>out</b>';
    $('#stage').appendChild(coachEl);
  }
  coachEl.hidden = !on;
}

function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 55 });
  cv.width = innerWidth; cv.height = innerHeight;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  const ps = Array.from({ length: 90 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.42, vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 11 - 3, r: Math.random() * 3 + 2, c: ['#ffb84d', '#5ad1ff', '#4fe0a0', '#b48cff'][Math.random() * 4 | 0], s: Math.random() < 0.5 }));
  let t = 0;
  const step = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of ps) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.32; p.vx *= 0.99;
      ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - t / 90);
      if (p.s) ctx.fillRect(p.x, p.y, p.r * 2, p.r * 2); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    }
    if (++t < 90) requestAnimationFrame(step); else cv.remove();
  };
  step();
}

function closePanelOnMobile() { $('#panel').classList.remove('open'); $('#panelToggle').textContent = 'Brief'; }

// ---------------------------------------------------------------------------
// Wiring up the chrome
// ---------------------------------------------------------------------------
$('#btnLevels').onclick = showMap;
$('#btnSandbox').onclick = () => (level === null && !programView ? openLevel(LEVELS.find((l) => !save.solved[l.id] && isUnlocked(l))?.id || 'not') : openSandbox());
$('#btnHelp').onclick = showHelp;
$('#btnMenu').onclick = showMenu;
const soundBtn = $('#btnSound');
const syncSound = () => { soundBtn.classList.toggle('off', !save.sound); soundBtn.setAttribute('aria-pressed', String(save.sound)); };
soundBtn.onclick = () => { save.sound = !save.sound; sfx.enabled = save.sound; persist(); syncSound(); if (save.sound) sfx.play('on'); };
syncSound();
$('#panelToggle').onclick = () => { const p = $('#panel'); p.classList.toggle('open'); $('#panelToggle').textContent = p.classList.contains('open') ? 'Close' : 'Brief'; };
$('#tUndo').onclick = () => editor.undo();
$('#tRedo').onclick = () => editor.redo();
$('#tZoomIn').onclick = () => editor.zoomAt(editor.W / 2, editor.H / 2, 1.25);
$('#tZoomOut').onclick = () => editor.zoomAt(editor.W / 2, editor.H / 2, 0.8);
$('#tFit').onclick = () => editor.fit();
$('#tTick').onclick = tick;
$('#tRun').onclick = toggleRun;
$('#tReset').onclick = () => { stopClock(); circuit.reset(); for (const k in circuit.inputs) circuit.set(k, inputVals[k] || 0); circuit.evaluate(); editor.propagate(false); updateCycles(); };

document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (!$('#modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
  if (programView) { if (e.key === '?') showHelp(); return; }
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) editor.redo(); else editor.undo(); }
  else if (mod && k === 'y') { e.preventDefault(); editor.redo(); }
  else if (mod && k === 'c') { if (editor.copy()) toast('Copied', 'info'); }
  else if (mod && k === 'v') { e.preventDefault(); editor.paste(); }
  else if (mod && k === 'd') { e.preventDefault(); if (editor.copy()) editor.paste(); }
  else if (mod && k === 'a') { e.preventDefault(); editor.selectAll(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); editor.deleteSelection(); }
  else if (e.key === 'Escape') { editor.sel.clear(); editor.selWire = null; editor.mode = null; editor.ghost = null; renderInspector(); editor.request(); $('#busEdit').hidden = true; }
  else if (k === 'f' && !mod) editor.fit();
  else if (k === 't' && !mod) runTests();
  else if (e.key === 'Enter') { e.preventDefault(); tick(); }
  else if (e.key === '?') showHelp();
  else if (e.key === ' ') { editor.spaceDown = true; e.preventDefault(); }
  else if (e.key.startsWith('Arrow') && editor.sel.size) {
    e.preventDefault();
    editor.nudge(e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0);
  }
});
document.addEventListener('keyup', (e) => { if (e.key === ' ') editor.spaceDown = false; });
window.addEventListener('beforeunload', () => persist(true));

// Phones: suggest a bigger screen once per session.
let phoneOK = false;
try { phoneOK = sessionStorage.getItem('gw-phone') === '1'; } catch { /* ignore */ }
if (Math.min(innerWidth, innerHeight) < 500 && innerWidth < 700 && !phoneOK) {
  $('#phone').hidden = false;
  $('#phoneGo').onclick = () => { $('#phone').hidden = true; try { sessionStorage.setItem('gw-phone', '1'); } catch { /* ignore */ } };
}

// QA screenshot mode: synchronous drawing, optional design file (sync XHR so it lands before 'load').
if (params.has('shot')) {
  editor.sync = true;
  editor.reduced = true;
  if (params.get('design')) {
    try {
      const x = new XMLHttpRequest(); x.open('GET', params.get('design'), false); x.send();
      const f = JSON.parse(x.responseText);
      if (f.level) { save.designs[f.level] = f.design; save.cur = f.level; for (const l of LEVELS) { if (l.id === f.level) break; save.solved[l.id] = save.solved[l.id] || { nand: 0 }; } }
      if (f.inputs) inputValsPreset = f.inputs;
      if (f.code) { save.code[f.level] = f.code; save.cur = f.level; for (const l of LEVELS) { if (l.id === f.level) break; save.solved[l.id] = save.solved[l.id] || { nand: 0 }; } }
      if (f.computer) save.passed.computer = f.computer;
    } catch (e) { console.error(e); }
  }
}
// Boot
const start = location.hash.slice(1) || save.cur;
if (start === 'sandbox') openSandbox(); else openLevel(levelById[start] ? start : 'not');
window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1);
  if (id === 'sandbox') openSandbox(); else if (levelById[id] && (!level || level.id !== id)) openLevel(id);
});
if (params.has('shot') && params.has('test')) { if (programView) programView.test(); else runTests(); }
if (params.has('shot') && params.has('run') && programView) programView.step(+params.get('run') || 100000, false);
if (params.has('shot') && params.get('sel')) { editor.sel.add(params.get('sel')); renderInspector(); editor.request(); }
window.__gw = { editor, get circuit() { return circuit; }, get lib() { return lib; }, openLevel, runTests, save: () => save };
