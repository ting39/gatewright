// Layered auto-layout for reference designs (used to produce QA screenshot fixtures).
import { geom, G } from '../src/editor.js';

export function layout(design, lib) {
  const parts = design.parts;
  const byId = new Map(parts.map((p) => [p.id, p]));
  const drivers = new Map(parts.map((p) => [p.id, []]));
  for (const w of design.wires) if (drivers.has(w.to.part)) drivers.get(w.to.part).push(w.from.part);
  const layer = new Map();
  const L = (id, stack = new Set()) => {
    if (layer.has(id)) return layer.get(id);
    const p = byId.get(id);
    if (p.type === 'IN') { layer.set(id, 0); return 0; }
    if (stack.has(id)) return 0;
    stack.add(id);
    let m = 0;
    for (const d of drivers.get(id)) m = Math.max(m, L(d, stack) + 1);
    stack.delete(id);
    layer.set(id, m);
    return m;
  };
  parts.forEach((p) => L(p.id));
  const maxL = Math.max(...parts.filter((p) => p.type !== 'OUT').map((p) => layer.get(p.id)));
  for (const p of parts) if (p.type === 'OUT') layer.set(p.id, maxL + 1);
  const cols = new Map();
  for (const p of parts) { const l = layer.get(p.id); if (!cols.has(l)) cols.set(l, []); cols.get(l).push(p); }
  let x = 0;
  const keys = [...cols.keys()].sort((a, b) => a - b);
  for (const l of keys) {
    const col = cols.get(l);
    let y = 0, wmax = 0;
    for (const p of col) { const g = geom(p, lib); p.x = x; p.y = y; y += g.h + 2 * G; wmax = Math.max(wmax, g.w); delete p._g; }
    const shift = -Math.round(y / 2 / G) * G;
    for (const p of col) p.y += shift;
    x += wmax + 6 * G;
  }
  return design;
}
