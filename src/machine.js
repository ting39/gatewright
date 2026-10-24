// Gatewright — program levels: assembly editor + the player's computer running it.

import { assemble, disassemble, RefMachine, MNEMONICS, PREDEFINED, decode } from './isa.js';
import { Machine, checkProgram, RefAdapter } from './check.js';

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const JUMPS = new Set(['JMP', 'JZ', 'JNZ', 'JN', 'JP', 'JNN', 'JLE', 'HLT']);
const MN = new Set(MNEMONICS);
const SPEEDS = [2, 8, 30, 120, 600, 5000];
const KEYS = [['←', 1, 'ArrowLeft'], ['→', 2, 'ArrowRight'], ['↑', 4, 'ArrowUp'], ['↓', 8, 'ArrowDown'], ['A', 16, 'z']];

function highlight(line) {
  const ci = line.indexOf(';');
  const code = ci >= 0 ? line.slice(0, ci) : line;
  const com = ci >= 0 ? line.slice(ci) : '';
  let out = '';
  const re = /([A-Za-z_]\w*\s*:)|(#?-?(?:0x[0-9a-fA-F]+|0b[01]+|\d+))|(\[\s*[pP]\s*\])|([A-Za-z_]\w*)|(\s+)|(.)/g;
  let m, first = true;
  while ((m = re.exec(code))) {
    if (m[1]) out += `<span class="tk-l">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tk-n">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="tk-p">${esc(m[3])}</span>`;
    else if (m[4]) {
      const up = m[4].toUpperCase();
      if (first && MN.has(up)) out += `<span class="${JUMPS.has(up) ? 'tk-j' : 'tk-m'}">${esc(m[4])}</span>`;
      else if (up in PREDEFINED) out += `<span class="tk-p">${esc(m[4])}</span>`;
      else out += `<span class="tk-l">${esc(m[4])}</span>`;
      first = false;
    } else out += esc(m[0]);
  }
  return out + (com ? `<span class="tk-c">${esc(com)}</span>` : '');
}

export class ProgramView {
  constructor(root, o) {
    this.root = root; this.o = o; this.level = o.level;
    this.speed = o.level.free ? 4 : 3; this.caseIdx = 0; this.buttons = 0; this.timer = 0;
    root.innerHTML = `
      <div class="code">
        <div class="codebar">
          ${o.level.free ? '' : '<button class="primary" data-a="test" title="Assemble and run every test case">Run tests</button>'}
          <button class="ghost" data-a="run" title="Run on your computer (Ctrl+Enter)">▶ Run</button>
          <button class="ghost" data-a="step" title="One clock tick (Ctrl+.)">Step</button>
          <button class="ghost" data-a="reset" title="Reload the program and RAM">⟲</button>
          <label class="note" title="Clock speed">speed <input type="range" min="0" max="${SPEEDS.length - 1}" value="${this.speed}" data-a="speed" aria-label="Clock speed"> <span data-a="hz" class="mono">${SPEEDS[this.speed]} Hz</span></label>
          <select data-a="case" aria-label="Test case to load" ${o.level.free ? 'hidden' : ''}></select>
          <span class="grow"></span>
          <span class="note mono" data-a="size"></span>
        </div>
        <div class="ed"><div class="gutter"></div><div class="edwrap"><pre aria-hidden="true"></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Assembly program"></textarea></div></div>
        <div class="errbar" hidden></div>
      </div>
      <div class="mside">
        <div class="sect">Screen · 0xE0–0xFF</div>
        <div class="screen-wrap"><canvas id="scr" width="16" height="16"></canvas></div>
        <div class="pad" aria-label="Buttons, read at KEYS (0xDF)">${KEYS.map(([t, b]) => `<button data-b="${b}" title="KEYS bit ${Math.log2(b)}">${t}</button>`).join('')}<span class="note">read at KEYS (0xDF)</span></div>
        <div class="regs"><div><small>PC</small><b data-r="pc">0</b></div><div><small>A</small><b data-r="a">0</b></div><div><small>P</small><b data-r="p">0</b></div><div><small>cycle</small><b data-r="cyc">0</b></div></div>
        <div class="cur-ins" data-r="ins">—</div>
        <div class="sect">Output port · OUT (0xDE)</div>
        <div class="outlog" data-r="out"></div>
        <div class="sect">RAM</div>
        <div class="ramgrid"></div>
        <p class="note" data-r="who"></p>
      </div>`;
    const q = (s) => root.querySelector(s);
    this.ta = q('textarea'); this.pre = q('pre'); this.gut = q('.gutter'); this.err = q('.errbar');
    this.scr = q('#scr'); this.sctx = this.scr.getContext('2d');
    this.ta.value = o.code;
    this.ta.addEventListener('input', () => { this.o.onCode(this.ta.value); this.refresh(true); });
    this.ta.addEventListener('keydown', (e) => this.keys(e));
    if (q('[data-a=test]')) q('[data-a=test]').onclick = () => this.test();
    q('[data-a=run]').onclick = () => this.toggleRun();
    q('[data-a=step]').onclick = () => this.step(1, true);
    q('[data-a=reset]').onclick = () => this.reset();
    q('[data-a=speed]').oninput = (e) => { this.speed = +e.target.value; q('[data-a=hz]').textContent = SPEEDS[this.speed] + ' Hz'; if (this.timer) { this.stop(); this.toggleRun(); } };
    const sel = q('[data-a=case]');
    this.level.cases.forEach((c, i) => {
      const op = document.createElement('option');
      const desc = Object.entries(c.ram).map(([k, v]) => `[${k}]=${v}`).join(' ');
      op.value = i; op.textContent = 'Case ' + (i + 1) + (desc ? ': ' + desc : '');
      sel.appendChild(op);
    });
    sel.onchange = () => { this.caseIdx = +sel.value; this.reset(); };
    root.querySelectorAll('.pad button').forEach((b) => {
      const bit = +b.dataset.b;
      const down = (e) => { e.preventDefault(); this.buttons |= bit; b.classList.add('down'); this.syncButtons(); };
      const up = () => { this.buttons &= ~bit; b.classList.remove('down'); this.syncButtons(); };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    });
    this._kd = (e) => {
      if (document.activeElement === this.ta) return;
      const k = KEYS.find((x) => x[2] === e.key);
      if (k) { e.preventDefault(); this.buttons |= k[1]; this.syncButtons(); }
    };
    this._ku = (e) => { const k = KEYS.find((x) => x[2] === e.key); if (k) { this.buttons &= ~k[1]; this.syncButtons(); } };
    window.addEventListener('keydown', this._kd); window.addEventListener('keyup', this._ku);
    // RAM grid
    const rg = q('.ramgrid');
    let h = '<span class="h"></span>';
    for (let c = 0; c < 16; c++) h += `<span class="h">${c.toString(16).toUpperCase()}</span>`;
    for (let r = 0; r < 16; r++) {
      h += `<span class="h">${(r * 16).toString(16).toUpperCase().padStart(2, '0')}</span>`;
      for (let c = 0; c < 16; c++) { const a = r * 16 + c; h += `<span data-m="${a}" class="${a >= 0xde ? 'io' : ''}" title="0x${a.toString(16).toUpperCase().padStart(2, '0')}">00</span>`; }
    }
    rg.innerHTML = h;
    this.cells = [...rg.querySelectorAll('[data-m]')];
    this.shown = new Int16Array(256).fill(-1);
    this.design = o.computer;
    q('[data-r=who]').textContent = this.design ? 'Running on the computer you wired (your CPU, a ROM and a RAM 256). A and P are read from a reference model that runs alongside it.' : 'No computer design was found, so this runs on the reference machine.';
    this.refresh(false);
    this.reset();
  }

  destroy() { this.stop(); window.removeEventListener('keydown', this._kd); window.removeEventListener('keyup', this._ku); this.root.innerHTML = ''; }

  keys(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = this.ta, s = ta.selectionStart;
      const col = s - ta.value.lastIndexOf('\n', s - 1) - 1;
      const n = 8 - (col % 8);
      ta.setRangeText(' '.repeat(n), s, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.toggleRun(); }
    else if ((e.ctrlKey || e.metaKey) && e.key === '.') { e.preventDefault(); this.step(1, true); }
  }

  refresh(edited) {
    const src = this.ta.value;
    this.asm = assemble(src);
    const errLines = new Map(this.asm.errors.map((x) => [x.line, x.msg]));
    const lines = src.split('\n');
    const pcLine = this.m && !this.asmStale ? this.asm.lineAddr.indexOf(this.m.pc) : -1;
    this.pre.innerHTML = lines.map((l, i) => {
      const hl = highlight(l) || ' ';
      return i === pcLine ? `<span class="ln-pc">${hl}</span>` : errLines.has(i) ? `<span class="ln-err">${hl}</span>` : hl;
    }).join('\n') + '\n';
    this.gut.innerHTML = lines.map((l, i) => {
      const a = this.asm.lineAddr[i];
      const cls = errLines.has(i) ? 'e' : i === pcLine ? 'pc' : '';
      return `<span class="${cls}"><span class="a">${a >= 0 ? a.toString(16).toUpperCase().padStart(2, '0') : '  '}</span>${i + 1}</span>`;
    }).join('\n') + '\n';
    if (this.asm.errors.length) {
      const e = this.asm.errors[0];
      this.err.hidden = false;
      this.err.textContent = `Line ${e.line + 1}: ${e.msg}` + (this.asm.errors.length > 1 ? `  (+${this.asm.errors.length - 1} more)` : '');
    } else this.err.hidden = true;
    this.root.querySelector('[data-a=size]').textContent = `${this.asm.size} instr`;
    // size the textarea to its content so the outer box does the scrolling
    this.ta.style.height = this.pre.scrollHeight + 'px';
    this.ta.style.width = Math.max(this.pre.scrollWidth, this.ta.parentElement.clientWidth) + 'px';
    if (edited) { this.stop(); this.asmStale = true; clearTimeout(this._rt); this._rt = setTimeout(() => this.reset(), 300); }
  }

  machine() {
    if (this.design) {
      try { const m = new Machine(this.design, this.o.lib); if (m.ok) return m; } catch { /* fall through */ }
    }
    return new RefAdapter();
  }

  reset() {
    this.stop();
    this.asm = assemble(this.ta.value);
    this.asmStale = false;
    this.m = this.machine();
    const cs = this.level.cases[this.caseIdx] || { ram: {} };
    this.m.load(this.asm.words, cs.ram);
    this.ref = new RefMachine(Uint16Array.from(this.asm.words));
    for (const k in cs.ram) this.ref.ram[+k] = cs.ram[k];
    this.cycles = 0; this.diverged = false;
    this.writes = new Set();
    this.syncButtons();
    this.refresh(false);
    this.draw();
  }

  syncButtons() { if (this.m) this.m.buttons = this.buttons; if (this.ref) this.ref.buttons = this.buttons; }

  step(n, manual) {
    if (!this.m) return;
    if (this.asm.errors.length) { this.o.toast('Fix the assembly errors first', 'err'); this.stop(); return; }
    if (this.asmStale) this.reset();
    this.writes = new Set();
    for (let i = 0; i < n; i++) {
      if (this.m.halted()) {
        this.stop();
        if (manual || i > 0) { this.o.toast(window.I18N ? I18N.t('tpl.halted', { n: this.cycles }) : `Halted after ${this.cycles} cycles`, 'ok'); this.o.sound('halt'); }
        break;
      }
      const d = decode(this.ref.rom[this.ref.pc]);
      if (d.s) this.writes.add(d.p ? this.ref.p : d.k);
      this.m.step(); this.ref.step(); this.cycles++;
      if (!this.diverged && this.m.pc !== this.ref.pc) { this.diverged = true; this.o.toast(window.I18N ? I18N.t('tpl.disagree', { n: this.cycles }) : `Your computer disagrees with the reference at cycle ${this.cycles}`, 'err'); }
      if (this.cycles >= 200000) { this.stop(); this.o.toast('Stopped after 200,000 cycles', 'info'); break; }
    }
    if (manual) this.o.sound('tick');
    this.refresh(false);
    this.draw();
  }

  toggleRun() {
    if (this.timer) { this.stop(); return; }
    if (this.m && this.m.halted()) this.reset();
    const btn = this.root.querySelector('[data-a=run]');
    btn.textContent = window.I18N ? I18N.t('❚❚ Pause') : '❚❚ Pause';
    let last = performance.now(), acc = 0;
    const loop = (t) => {
      acc += ((t - last) / 1000) * SPEEDS[this.speed]; last = t;
      const n = Math.min(Math.floor(acc), 20000);
      acc -= n;
      if (n > 0) this.step(n, false);
      if (this.timer) this.timer = requestAnimationFrame(loop);
    };
    this.timer = requestAnimationFrame(loop);
  }
  stop() {
    if (this.timer) cancelAnimationFrame(this.timer);
    this.timer = 0;
    const btn = this.root.querySelector('[data-a=run]');
    if (btn) btn.textContent = window.I18N ? I18N.t('▶ Run') : '▶ Run';
  }

  draw() {
    const m = this.m;
    if (!m) return;
    const mem = m.mem;
    const img = this.sctx.createImageData(16, 16);
    for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) {
      const on = (mem[0xe0 + r * 2 + (c >> 3)] >> (7 - (c & 7))) & 1;
      const i = (r * 16 + c) * 4;
      img.data[i] = on ? 255 : 18; img.data[i + 1] = on ? 184 : 24; img.data[i + 2] = on ? 77 : 40; img.data[i + 3] = 255;
    }
    this.sctx.putImageData(img, 0, 0);
    const d = decode(this.ref.rom[this.ref.pc]);
    const addr = d.m || d.s ? (d.p ? this.ref.p : d.k) : -1;
    for (let a = 0; a < 256; a++) {
      const v = mem[a];
      const cell = this.cells[a];
      if (this.shown[a] !== v) { this.shown[a] = v; cell.textContent = v.toString(16).toUpperCase().padStart(2, '0'); cell.classList.toggle('nz', v !== 0); }
      cell.classList.toggle('w', this.writes.has(a));
      cell.classList.toggle('ad', a === addr);
    }
    const r = (k) => this.root.querySelector(`[data-r=${k}]`);
    r('pc').textContent = m.pc;
    r('a').textContent = this.ref.a;
    r('p').textContent = this.ref.p;
    r('cyc').textContent = this.cycles;
    r('ins').textContent = (m.halted() ? '■ halted · ' : '▸ ') + disassemble(this.ref.rom[m.pc], m.pc);
    r('out').textContent = m.outLog.length ? m.outLog.slice(-40).join('  ') : '—';
  }

  test() {
    this.stop();
    const r = checkProgram(this.level, this.ta.value, this.design || null, this.o.lib);
    if (!this.design && !r.error && r.rows) { /* reference fallback handled in check */ }
    this.o.onResult(r);
    if (r.fail && r.fail.index !== undefined) {
      this.caseIdx = r.fail.index;
      this.root.querySelector('[data-a=case]').value = String(this.caseIdx);
      this.reset();
    }
  }
}
