// In-browser QA helpers: `const H = (await import('/test/qa.js')).helpers();`
import { pinPos } from '../src/editor.js';
export function helpers() {
  const E = window.__gw.editor, cv = document.querySelector('#board');
  const scr = (wx, wy) => { const r = cv.getBoundingClientRect(); return { x: r.left + (wx - E.view.x) * E.view.z, y: r.top + (wy - E.view.y) * E.view.z }; };
  const fire = (el, type, p, extra = {}) => el.dispatchEvent(new PointerEvent(type, { clientX: p.x, clientY: p.y, bubbles: true, pointerId: 1, button: 0, ...extra }));
  const h = {
    E, cv, scr, fire,
    wire(pa, na, pb, nb) { const a = pinPos(E.partById(pa), na, E.lib), b = pinPos(E.partById(pb), nb, E.lib); const s = scr(a.x, a.y), t = scr(b.x, b.y); fire(cv, 'pointerdown', s); fire(cv, 'pointermove', { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 }); fire(cv, 'pointermove', t); fire(cv, 'pointerup', t); },
    click(wx, wy, extra) { const c = scr(wx, wy); fire(cv, 'pointerdown', c, extra); fire(cv, 'pointerup', c, extra); },
    toggle(id) { const p = E.partById(id); h.click(p.x + 20, p.y + 16); },
    bin(name) { const item = [...document.querySelectorAll('.pitem')].find((b) => b.querySelector('.nm').textContent === name); const ir = item.getBoundingClientRect(); const ip = { x: ir.left + 10, y: ir.top + 10 }; fire(item, 'pointerdown', ip); window.dispatchEvent(new PointerEvent('pointerup', { clientX: ip.x, clientY: ip.y, pointerId: 1 })); return E.design.parts[E.design.parts.length - 1]; },
    key(k, o = {}) { document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...o })); },
  };
  return h;
}
