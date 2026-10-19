// Gatewright — levels. Each level specifies a chip (pins + behaviour) that the player
// builds; once solved it joins the parts bin as a reusable, sealed chip.

import { Library, mask } from './chips.js';

const pin = (name, width = 1) => ({ name, width });
const b = (v) => v & 1;

// Comb spec: fn(inputs) -> outputs.  Clk spec: {init, eval(ins, st)} (level-sensitive state,
// outputs may be null = unknown).  Seq spec: {init, out(ins, st), next(ins, st), combDeps}.

export const CHAPTERS = [
  { id: 'logic', title: 'I · Logic', blurb: 'One gate in the bin. Make it into many.' },
  { id: 'arith', title: 'II · Arithmetic', blurb: 'Teach wires to count.' },
  { id: 'memory', title: 'III · Memory', blurb: 'Loops that remember.' },
  { id: 'computer', title: 'IV · Computer', blurb: 'Put it all together.' },
  { id: 'programs', title: 'V · Programs', blurb: 'Run code on the machine you built.' },
];

export const LEVELS = [
  // ───────────────────────── I · Logic ─────────────────────────
  {
    id: 'not', par: { nand: 1, delay: 1 }, chapter: 'logic', title: 'Inverter', chip: 'NOT', shape: 'not',
    io: { in: [pin('a')], out: [pin('out')] }, kind: 'comb',
    spec: ({ a }) => ({ out: b(~a) }),
    brief: `<p>Welcome to the foundry. Our only machine stamps out <b>NAND</b> gates: the output is 0 only when <i>both</i> inputs are 1.</p>
<p>Build an <b>inverter</b>: <code>out</code> is the opposite of <code>a</code>.</p>
<p class="how">Drag a NAND from the bin onto the board. Drag from one pin to another to lay a wire. Click an input to flip it, then press <b>Test</b>.</p>`,
    hints: ['A NAND with both inputs tied together only ever sees 00 or 11.', 'Wire a to both NAND inputs.'],
  },
  {
    id: 'and', par: { nand: 2, delay: 2 }, chapter: 'logic', title: 'Both', chip: 'AND', shape: 'and',
    io: { in: [pin('a'), pin('b')], out: [pin('out')] }, kind: 'comb',
    spec: ({ a, b: bb }) => ({ out: a & bb }),
    brief: `<p>Your inverter is in the bin now. Chips you finish become parts you can reuse.</p><p>Build <b>AND</b>: <code>out</code> is 1 only when <code>a</code> and <code>b</code> are both 1.</p>`,
    hints: ['NAND is "not AND".', 'Invert the output of a NAND.'],
  },
  {
    id: 'or', par: { nand: 3, delay: 2 }, chapter: 'logic', title: 'Either', chip: 'OR', shape: 'or',
    io: { in: [pin('a'), pin('b')], out: [pin('out')] }, kind: 'comb',
    spec: ({ a, b: bb }) => ({ out: a | bb }),
    brief: `<p>Build <b>OR</b>: <code>out</code> is 1 when <code>a</code>, <code>b</code>, or both are 1.</p>`,
    hints: ['When is OR zero? Only when both inputs are 0, so only when both inverted inputs are 1.', 'NAND the two inverted inputs (De Morgan).'],
  },
  {
    id: 'xor', par: { nand: 4, delay: 3 }, chapter: 'logic', title: 'One or the other', chip: 'XOR', shape: 'xor',
    io: { in: [pin('a'), pin('b')], out: [pin('out')] }, kind: 'comb',
    spec: ({ a, b: bb }) => ({ out: a ^ bb }),
    brief: `<p>Build <b>XOR</b> (exclusive or): <code>out</code> is 1 when the inputs <i>differ</i>.</p><p>It works with the gates you have. The best builds use only 4 NANDs.</p>`,
    hints: ['XOR = (a OR b) AND NOT (a AND b).', 'For the 4-NAND version: n = NAND(a,b); out = NAND(NAND(a,n), NAND(b,n)).'],
  },
  {
    id: 'mux', par: { nand: 4, delay: 3 }, chapter: 'logic', title: 'Switch', chip: 'MUX', shape: 'mux',
    io: { in: [pin('a'), pin('b'), pin('sel')], out: [pin('out')] }, kind: 'comb',
    spec: ({ a, b: bb, sel }) => ({ out: sel ? bb : a }),
    brief: `<p>A <b>multiplexer</b> picks one of its inputs. If <code>sel</code> is 0, <code>out</code> copies <code>a</code>. If it is 1, it copies <code>b</code>.</p>`,
    hints: ['Let a through when sel = 0, let b through when sel = 1, then combine the two.', '(a AND NOT sel) OR (b AND sel). It can be done in 4 NANDs.'],
  },
  {
    id: 'demux', par: { nand: 5, delay: 3 }, chapter: 'logic', title: 'Router', chip: 'DEMUX', shape: 'box',
    io: { in: [pin('in'), pin('sel')], out: [pin('a'), pin('b')] }, kind: 'comb',
    spec: ({ in: x, sel }) => ({ a: sel ? 0 : x, b: sel ? x : 0 }),
    brief: `<p>The reverse of the switch. A <b>demultiplexer</b> sends <code>in</code> to <code>a</code> when <code>sel</code> is 0, or to <code>b</code> when it is 1. The other output stays 0.</p>`,
    hints: ['Each output is an AND.', 'a = in AND NOT sel; b = in AND sel.'],
  },
  {
    id: 'mux8', par: { nand: 32, delay: 3 }, chapter: 'logic', title: 'Bus switch', chip: 'MUX8', shape: 'mux',
    io: { in: [pin('a', 8), pin('b', 8), pin('sel')], out: [pin('out', 8)] }, kind: 'comb', tools: ['FAN'],
    spec: ({ a, b: bb, sel }) => ({ out: sel ? bb : a }),
    brief: `<p>Thick wires are <b>buses</b> that carry 8 bits at once. Here <code>a</code>, <code>b</code> and <code>out</code> are bytes.</p>
<p>New trick: <b>lanes</b>. Select any chip whose pins are all single wires and set its lanes to 8. You get 8 copies side by side that work on whole buses, bit by bit.</p>
<p>New part: <b>Fan</b> copies one wire to all 8 lines of a bus.</p>`,
    hints: ['Put down a MUX, select it, and set its lanes to 8.', 'A laned MUX also wants an 8-bit sel. Fan the 1-bit sel out to 8 lines.'],
  },
  // ───────────────────────── II · Arithmetic ─────────────────────────
  {
    id: 'half', par: { nand: 5, delay: 3 }, chapter: 'arith', title: 'Half adder', chip: 'HALFADD', label: 'HALF ADD', shape: 'box',
    io: { in: [pin('a'), pin('b')], out: [pin('sum'), pin('carry')] }, kind: 'comb',
    spec: ({ a, b: bb }) => ({ sum: (a + bb) & 1, carry: (a + bb) >> 1 }),
    brief: `<p>Add two bits. 0+0 = 0, 0+1 = 1, and 1+1 = <b>10</b> in binary, which is sum 0, carry 1.</p>`,
    hints: ['Look at the sum column of the truth table. You have built that gate already.', 'sum = XOR, carry = AND.'],
  },
  {
    id: 'full', par: { nand: 9, delay: 6 }, chapter: 'arith', title: 'Full adder', chip: 'FULLADD', label: 'FULL ADD', shape: 'box',
    io: { in: [pin('a'), pin('b'), pin('c')], out: [pin('sum'), pin('carry')] }, kind: 'comb',
    spec: ({ a, b: bb, c }) => ({ sum: (a + bb + c) & 1, carry: (a + bb + c) >> 1 }),
    brief: `<p>Add <i>three</i> bits: <code>a</code>, <code>b</code> and a carry <code>c</code> from the column to the right. The answer is 0 to 3, so it fits in sum and carry.</p>`,
    hints: ['Add two bits, then add the third to that result.', 'Two half adders. The carry is 1 if either of them carried.'],
  },
  {
    id: 'add8', par: { nand: 72, delay: 48 }, chapter: 'arith', title: 'Byte adder', chip: 'ADD8', label: 'ADD 8', shape: 'box',
    io: { in: [pin('a', 8), pin('b', 8), pin('cin')], out: [pin('sum', 8), pin('cout')] }, kind: 'comb', tools: ['SPLIT', 'JOIN', 'CONST'],
    spec: ({ a, b: bb, cin }) => { const s = a + bb + cin; return { sum: s & 255, cout: s >> 8 }; },
    brief: `<p>Add two bytes, the way you add on paper: right to left, carrying as you go.</p>
<p>New parts: <b>Split</b> breaks a bus into its wires (output 0 = bit 0, the lowest). <b>Join</b> bundles wires back into a bus. <b>Const</b> is a fixed value. You can change their widths in the inspector.</p>`,
    hints: ['Split a and b into bits. Chain 8 full adders, each carry feeding the next one up.', 'Bit 0 takes cin as its carry in. The last carry out is cout.'],
  },
  {
    id: 'addsub', par: { nand: 104, delay: 51 }, chapter: 'arith', title: 'Add or subtract', chip: 'ADDSUB', label: 'ADD/SUB', shape: 'box',
    io: { in: [pin('a', 8), pin('b', 8), pin('sub')], out: [pin('out', 8)] }, kind: 'comb',
    spec: ({ a, b: bb, sub }) => ({ out: (sub ? a - bb : a + bb) & 255 }),
    brief: `<p>When <code>sub</code> is 1, output <code>a − b</code>. Otherwise output <code>a + b</code>. Results wrap around 256: 3 − 5 = 254.</p>
<p>The trick is two's complement: <code>−b</code> is the same as <code>(NOT b) + 1</code>.</p>`,
    hints: ['XOR with 1 flips a bit and XOR with 0 keeps it. A laned XOR can flip b only when sub is 1.', 'Feed b XOR fan(sub) into your adder, with cin = sub.'],
  },
  {
    id: 'zero', par: { nand: 22, delay: 7 }, chapter: 'arith', title: 'Zero detector', chip: 'ISZERO', label: 'IS ZERO', shape: 'box',
    io: { in: [pin('in', 8)], out: [pin('zero')] }, kind: 'comb',
    spec: ({ in: x }) => ({ zero: x === 0 ? 1 : 0 }),
    brief: `<p>Output 1 exactly when all 8 bits of <code>in</code> are 0. The CPU will use this to decide when to jump.</p>`,
    hints: ['OR all the bits together, then invert.', 'A tree of ORs (4, then 2, then 1) has less delay than a chain.'],
  },
  {
    id: 'mux4', par: { nand: 96, delay: 6 }, chapter: 'arith', title: 'Four-way switch', chip: 'MUX4', shape: 'mux',
    io: { in: [pin('a', 8), pin('b', 8), pin('c', 8), pin('d', 8), pin('sel', 2)], out: [pin('out', 8)] }, kind: 'comb',
    spec: ({ a, b: bb, c, d, sel }) => ({ out: [a, bb, c, d][sel] }),
    tests: (rng) => { const v = []; for (let i = 0; i < 160; i++) v.push({ a: rng(256), b: rng(256), c: rng(256), d: rng(256), sel: i & 3 }); return v; },
    brief: `<p>Pick one of four bytes with a 2-bit <code>sel</code>: 0 → a, 1 → b, 2 → c, 3 → d.</p>`,
    hints: ['Use bit 0 of sel to choose within each pair. Bit 1 chooses between the pairs.', 'Three bus switches in a little tree.'],
  },
  {
    id: 'alu', par: { nand: 400, delay: 60 }, chapter: 'arith', title: 'ALU', chip: 'ALU', shape: 'alu',
    io: { in: [pin('x', 8), pin('y', 8), pin('op', 3)], out: [pin('out', 8)] }, kind: 'comb',
    spec: ({ x, y, op }) => ({ out: aluFn(op, x, y) }),
    tests: (rng) => { const v = []; const sp = [0, 1, 2, 127, 128, 255]; for (let op = 0; op < 8; op++) { for (const x of sp) for (const y of sp) v.push({ x, y, op }); for (let i = 0; i < 40; i++) v.push({ x: rng(256), y: rng(256), op }); } return v; },
    brief: `<p>The arithmetic logic unit is the calculator at the heart of the CPU. <code>op</code> picks what it computes:</p>
<table class="ops"><tr><td>0</td><td>x</td><td>4</td><td>x AND y</td></tr><tr><td>1</td><td>y</td><td>5</td><td>x OR y</td></tr><tr><td>2</td><td>x + y</td><td>6</td><td>x XOR y</td></tr><tr><td>3</td><td>x − y</td><td>7</td><td>x shifted left 1</td></tr></table>
<p>"Shifted left" moves every bit up one place, so bit 7 falls off and bit 0 becomes 0.</p>`,
    hints: ['Compute all eight answers at once, then select one using op.', 'A shift is just wiring: split x, then join it back one place higher with a 0 at the bottom.', 'Two four-way switches pick using op bits 0–1. A bus switch on op bit 2 picks between them. ADD/SUB with sub = op bit 0 covers 2 and 3.'],
  },
  // ───────────────────────── III · Memory ─────────────────────────
  {
    id: 'srlatch', par: { nand: 4, delay: null }, chapter: 'memory', title: 'Set & reset', chip: 'SRLATCH', label: 'SR LATCH', shape: 'box',
    io: { in: [pin('set'), pin('reset')], out: [pin('q')] }, kind: 'clk',
    spec: {
      init: () => ({ q: null }),
      eval: ({ set, reset }, st) => { if (set) st.q = 1; else if (reset) st.q = 0; return { q: st.q }; },
    },
    steps: (rng) => {
      const s = [{ set: 0, reset: 1 }, { set: 0, reset: 0 }, { set: 1, reset: 0 }, { set: 0, reset: 0 }, { set: 0, reset: 0 }, { set: 0, reset: 1 }, { set: 0, reset: 0 }];
      for (let i = 0; i < 30; i++) { const r = rng(3); s.push(r === 0 ? { set: 1, reset: 0 } : r === 1 ? { set: 0, reset: 1 } : { set: 0, reset: 0 }); }
      return s;
    },
    brief: `<p>So far every output depended only on the inputs right now. Time to <b>remember</b>.</p>
<p>A pulse on <code>set</code> makes <code>q</code> 1. A pulse on <code>reset</code> makes it 0. With both at 0, <code>q</code> keeps whatever it was. (Both at 1 is never tested.)</p>
<p>For the first time you may wire a loop: a gate's output can feed back into an earlier gate.</p>`,
    hints: ['Feed q back into the circuit that computes q.', 'q = set OR (q AND NOT reset). Or use the classic pair of cross-coupled NANDs with inverted inputs.'],
  },
  {
    id: 'dlatch', par: { nand: 4, delay: null }, chapter: 'memory', title: 'Data latch', chip: 'DLATCH', label: 'D LATCH', shape: 'box',
    io: { in: [pin('d'), pin('en')], out: [pin('q')] }, kind: 'clk',
    spec: {
      init: () => ({ q: null }),
      eval: ({ d, en }, st) => { if (en) st.q = d; return { q: st.q }; },
    },
    steps: (rng) => {
      const s = [{ d: 0, en: 1 }, { d: 0, en: 0 }, { d: 1, en: 0 }, { d: 1, en: 1 }, { d: 0, en: 0 }, { d: 0, en: 1 }, { d: 1, en: 1 }, { d: 0, en: 1 }];
      for (let i = 0; i < 30; i++) s.push({ d: rng(2), en: rng(3) === 0 ? 1 : 0 });
      return s;
    },
    brief: `<p>A cleaner kind of memory. While <code>en</code> (enable) is 1, <code>q</code> follows <code>d</code>. When <code>en</code> drops to 0, <code>q</code> holds its last value.</p>`,
    hints: ['Your SR latch remembers. You only need to work out when to set it and when to reset it.', 'set = d AND en, reset = NOT d AND en.'],
  },
  {
    id: 'dff', par: { nand: 9, delay: 9 }, chapter: 'memory', title: 'Flip-flop', chip: 'DFF', label: 'DFF', shape: 'box',
    io: { in: [pin('d'), pin('clk')], out: [pin('q')] }, kind: 'clk',
    spec: {
      init: () => ({ q: null, clk: 0 }),
      eval: ({ d, clk }, st) => { if (clk && !st.clk) st.q = d; st.clk = clk; return { q: st.q }; },
    },
    unlock: {
      io: { in: [pin('in')], out: [pin('out')] },
      seq: { init: () => ({ v: 0 }), out: (_, st) => ({ out: st.v }), next: ({ in: x }, st) => { st.v = x; } },
    },
    steps: (rng) => {
      const s = [{ d: 0, clk: 0 }, { d: 0, clk: 1 }, { d: 1, clk: 1 }, { d: 1, clk: 0 }, { d: 1, clk: 1 }, { d: 0, clk: 1 }, { d: 0, clk: 0 }, { d: 1, clk: 0 }, { d: 0, clk: 0 }, { d: 0, clk: 1 }];
      // d never changes at the same instant clk rises (that would be a setup-time violation)
      let clk = 1, dv = 0;
      for (let i = 0; i < 40; i++) { if (rng(2)) clk ^= 1; else dv = rng(2); s.push({ d: dv, clk }); }
      return s;
    },
    brief: `<p>A latch is see-through for as long as <code>en</code> is high, and that is too long. Computers need parts that change at one exact moment: the <b>rising edge</b> of a clock.</p>
<p>Build a <b>flip-flop</b>. When <code>clk</code> goes from 0 to 1, <code>q</code> takes the value of <code>d</code>. At every other moment <code>q</code> holds still, whatever <code>d</code> does.</p>
<p class="how">After this level the clock is wired for you. Every memory part ticks together when you press <b>Tick</b>.</p>`,
    hints: ['Use two latches in a row: a leader and a follower.', 'The leader is open while clk is 0. The follower is open while clk is 1, so it only ever sees a value the leader has already locked.'],
  },
  {
    id: 'bit', par: { nand: 13, delay: 3 }, chapter: 'memory', title: 'One bit', chip: 'BIT', shape: 'box',
    io: { in: [pin('in'), pin('load')], out: [pin('out')] }, kind: 'seq',
    spec: { init: () => ({ v: 0 }), out: (_, st) => ({ out: st.v }), next: ({ in: x, load }, st) => { if (load) st.v = x; } },
    steps: (rng) => { const s = []; for (let i = 0; i < 40; i++) s.push({ in: rng(2), load: rng(3) === 0 ? 1 : 0 }); s.splice(3, 0, { in: 1, load: 1 }, { in: 0, load: 0 }, { in: 0, load: 0 }); return s; },
    brief: `<p>Your flip-flop (now <b>DFF</b>, with the clock built in) copies its input on every tick. A real memory cell should change only when told to.</p>
<p>On each tick: if <code>load</code> is 1, store <code>in</code>. Otherwise keep the old value. <code>out</code> is always the stored value.</p>`,
    hints: ['The DFF has to store something on every tick. Choose what that is.', 'Feed the DFF from a MUX: the old value (its own output) or the new one (in), selected by load.'],
  },
  {
    id: 'reg', par: { nand: 104, delay: 0 }, chapter: 'memory', title: 'Register', chip: 'REG', label: 'REGISTER', shape: 'box',
    io: { in: [pin('in', 8), pin('load')], out: [pin('out', 8)] }, kind: 'seq',
    spec: { init: () => ({ v: 0 }), out: (_, st) => ({ out: st.v }), next: ({ in: x, load }, st) => { if (load) st.v = x; } },
    steps: (rng) => { const s = []; for (let i = 0; i < 40; i++) s.push({ in: rng(256), load: rng(2) }); return s; },
    brief: `<p>Eight bits that load together: a <b>register</b>. Same rules as One Bit, but for a whole byte.</p>`,
    hints: ['Lanes work on memory chips too.', 'A BIT with 8 lanes, and load fanned out to all of them.'],
  },
  {
    id: 'counter', par: { nand: 240, delay: 54 }, chapter: 'memory', title: 'Counter', chip: 'COUNTER', shape: 'box',
    io: { in: [pin('in', 8), pin('load'), pin('inc'), pin('reset')], out: [pin('out', 8)] }, kind: 'seq',
    spec: {
      init: () => ({ v: 0 }), out: (_, st) => ({ out: st.v }),
      next: ({ in: x, load, inc, reset }, st) => { st.v = reset ? 0 : load ? x : inc ? (st.v + 1) & 255 : st.v; },
    },
    steps: (rng) => {
      const s = [];
      for (let i = 0; i < 6; i++) s.push({ in: 0, load: 0, inc: 1, reset: 0 });
      s.push({ in: 250, load: 1, inc: 1, reset: 0 });
      for (let i = 0; i < 8; i++) s.push({ in: rng(256), load: 0, inc: 1, reset: 0 });
      s.push({ in: 9, load: 1, inc: 0, reset: 1 }, { in: 9, load: 0, inc: 0, reset: 0 });
      for (let i = 0; i < 40; i++) s.push({ in: rng(256), load: rng(4) === 0 ? 1 : 0, inc: rng(2), reset: rng(8) === 0 ? 1 : 0 });
      return s;
    },
    brief: `<p>The CPU keeps its place in a program with a <b>counter</b>. On each tick, the first rule that applies wins:</p>
<ol><li><code>reset</code> → 0</li><li><code>load</code> → <code>in</code></li><li><code>inc</code> → out + 1 (255 wraps to 0)</li><li>otherwise keep</li></ol>`,
    hints: ['Start from a register that loads on every tick, and choose what goes into it.', 'Build a chain of bus switches: keep or +1 by inc, then that or in by load, then that or 0 by reset. Your adder with b = 1 does the +1.'],
  },
  {
    id: 'decoder', par: { nand: 35, delay: 9 }, chapter: 'memory', title: 'Decoder', chip: 'DECODE', label: 'DECODER', shape: 'box',
    io: { in: [pin('sel', 3)], out: [pin('out', 8)] }, kind: 'comb',
    spec: ({ sel }) => ({ out: 1 << sel }),
    brief: `<p>Turn a 3-bit number into a <b>one-hot</b> byte. Exactly one bit of <code>out</code> is 1: bit number <code>sel</code>. For example, sel = 5 gives 00100000.</p>`,
    hints: ['Each output bit is an AND of three wires: each sel bit or its inverse.', 'Or: a DEMUX tree. Route a constant 1 by sel bit 2, then bit 1, then bit 0.'],
  },
  {
    id: 'ram8', par: { nand: 1107, delay: 11 }, chapter: 'memory', title: 'RAM', chip: 'RAM8', label: 'RAM 8', shape: 'box',
    io: { in: [pin('addr', 3), pin('in', 8), pin('load')], out: [pin('out', 8)] }, kind: 'seq',
    spec: {
      combDeps: true,
      init: () => ({ m: new Array(8).fill(0) }),
      out: ({ addr }, st) => ({ out: st.m[addr] }),
      next: ({ addr, in: x, load }, st) => { if (load) st.m[addr] = x; },
    },
    steps: (rng) => {
      const s = [];
      for (let a = 0; a < 8; a++) s.push({ addr: a, in: (a * 37 + 11) & 255, load: 1 });
      for (let a = 0; a < 8; a++) s.push({ addr: 7 - a, in: rng(256), load: 0 });
      for (let i = 0; i < 50; i++) s.push({ addr: rng(8), in: rng(256), load: rng(3) === 0 ? 1 : 0 });
      return s;
    },
    brief: `<p>Eight registers and an address. <code>out</code> always shows register number <code>addr</code>. On a tick with <code>load</code> = 1, <code>in</code> is written into that register only.</p>
<p>The finished computer uses 256 bytes of this. Once you've built 8, we'll stack 32 of them for you.</p>`,
    hints: ['Writing: the decoder picks one register, so AND its output with load.', 'Reading: two four-way switches plus a bus switch, picked by the bits of addr.'],
  },
  // ───────────────────────── IV · Computer ─────────────────────────
  {
    id: 'control', par: { nand: 47, delay: 16 }, chapter: 'computer', title: 'Control unit', chip: 'CONTROL', shape: 'box',
    io: { in: [pin('ctl', 8), pin('a', 8)], out: [pin('op', 3), pin('ymem'), pin('pmode'), pin('store'), pin('setp'), pin('jump')] }, kind: 'comb',
    spec: ({ ctl, a }) => {
      const j = ctl & 1;
      const op = (ctl >> 3) & 7;
      const neg = (a >> 7) & 1, zero = a === 0 ? 1 : 0, pos = !neg && !zero ? 1 : 0;
      const jump = j & (((op >> 2) & neg) | ((op >> 1) & zero) | (op & pos));
      return { op: j ? 0 : op, ymem: (ctl >> 7) & 1, pmode: (ctl >> 6) & 1, store: (ctl >> 2) & 1, setp: (ctl >> 1) & 1, jump };
    },
    brief: `<p>Each instruction is 16 bits. The low byte is a number <b>k</b>. The high byte, <code>ctl</code>, says what to do with it:</p>
<table class="bits"><tr><th>7</th><th>6</th><th>5 4 3</th><th>2</th><th>1</th><th>0</th></tr><tr><td>m</td><td>p</td><td>op</td><td>s</td><td>t</td><td>j</td></tr></table>
<p>Pass m, p, s and t straight through as <code>ymem</code>, <code>pmode</code>, <code>store</code> and <code>setp</code>.</p>
<p>If <b>j</b> is 0: <code>op</code> = op and <code>jump</code> = 0.<br>If <b>j</b> is 1, this is a jump. <code>op</code> must be 0 (leave A alone), and the three op bits become conditions on <code>a</code>, the accumulator, read as a signed number:
bit 5 = "jump if negative", bit 4 = "if zero", bit 3 = "if positive". <code>jump</code> is 1 if any enabled condition holds.</p>`,
    hints: ['negative = bit 7 of a. zero = your zero detector. positive = neither.', 'jump = j AND ((op2 AND neg) OR (op1 AND zero) OR (op0 AND pos)). To force op to 0 when jumping, AND it with a fanned NOT j.'],
  },
  {
    id: 'cpu', par: { nand: 959, delay: 79 }, chapter: 'computer', title: 'CPU', chip: 'CPU', shape: 'box', sealed: false,
    io: { in: [pin('instr', 16), pin('data', 8), pin('reset')], out: [pin('addr', 8), pin('out', 8), pin('write'), pin('pc', 8)] }, kind: 'cpu',
    brief: `<p>The big one. Your CPU has three registers: <b>A</b> (the accumulator), <b>P</b> (a pointer) and the program counter <b>PC</b>.</p>
<p>Each tick it runs one instruction, <code>instr</code> = ROM[PC]. Split it into ctl and k, and feed ctl to your control unit. Then:</p>
<ul><li><code>addr</code> = pmode ? P : k. The memory answers on <code>data</code>.</li>
<li>Y = ymem ? data : k</li>
<li>A ← ALU(op, A, Y) on every tick (op 0 keeps A)</li>
<li><code>out</code> = A and <code>write</code> = store, so memory can save A at addr</li>
<li>P ← A when setp</li>
<li>PC ← k if jump, else PC + 1. <code>reset</code> sets PC to 0.</li></ul>`,
    hints: ['You need two registers (A, P), a counter (PC), the ALU, the control unit and two bus switches.', 'The PC counter: in = k, load = jump, inc = 1, reset = reset. A loads every tick from the ALU.', 'Every arrow in the list above is one wire or one bus switch. Build it one line at a time.'],
  },
  {
    id: 'computer', par: { nand: 959, delay: 82 }, chapter: 'computer', title: 'Computer', chip: 'COMPUTER', shape: 'box', sealed: false,
    io: { in: [pin('reset')], out: [pin('pc', 8)] }, kind: 'computer', tools: ['ROM', 'RAM256'],
    brief: `<p>Last bit of wiring. Connect your <b>CPU</b> to a <b>ROM</b>, which holds the program, and to a <b>RAM 256</b>, which holds the data.</p>
<ul><li>CPU.pc → ROM.addr, and ROM.data → CPU.instr</li><li>CPU.addr → RAM.addr, CPU.out → RAM.in, CPU.write → RAM.load</li><li>RAM.out → CPU.data</li></ul>
<p>The test runs a real program on your machine.</p>`,
    hints: ['Seven wires plus reset and pc.', 'If the test runs but gives wrong numbers, check that you didn\'t swap RAM.in and RAM.addr.'],
  },
  // ───────────────────────── V · Programs ─────────────────────────
  {
    id: 'p-sum', chapter: 'programs', title: 'Triangle numbers', kind: 'program',
    brief: `<p>Your computer works, so now it needs software. Write the program in <b>G8 assembly</b> and it runs on the CPU you wired.</p>
<p>RAM[0] holds <b>n</b>. Store <b>1 + 2 + … + n</b> in RAM[1] (mod 256), then halt.</p>`,
    cases: [0, 1, 4, 10, 22, 30].map((n) => ({ ram: { 0: n }, expect: { 1: (n * (n + 1) / 2) & 255 } })),
    limit: 6000,
    starter: `; Triangle numbers: RAM[1] = 1 + 2 + ... + RAM[0]
n   = 0
sum = 1

        LDA #0
        STA sum
loop:   LDA n
        JZ done
        ADD sum      ; A = n + sum
        STA sum
        ; ... count n down by one and go round again
done:   HLT
`,
    hints: ['To decrement n: LDA n, SUB #1, STA n.', 'After STA n, jump back to loop.'],
  },
  {
    id: 'p-mul', chapter: 'programs', title: 'Multiply', kind: 'program',
    brief: `<p>The ALU can't multiply, but you can. Store <b>RAM[0] × RAM[1]</b> (mod 256) in RAM[2].</p><p>Repeated addition works. Shift-and-add (the method from paper long multiplication) is much faster, and your score counts cycles.</p>`,
    cases: [[3, 4], [0, 9], [7, 0], [13, 11], [255, 2], [16, 16], [25, 10], [200, 200]].map(([x, y]) => ({ ram: { 0: x, 1: y }, expect: { 2: (x * y) & 255 } })),
    limit: 20000,
    starter: `; RAM[2] = RAM[0] * RAM[1]
x   = 0
y   = 1
out = 2

        LDA #0
        STA out
        ; your code here
        HLT
`,
    hints: ['Repeated addition: add x to out, y times, counting y down to 0.', 'Shift-and-add: for each bit of y, from the lowest, if (y AND bit) ≠ 0 then out += x. Then double x and the bit (SHL).'],
  },
  {
    id: 'p-x', chapter: 'programs', title: 'Draw an X', kind: 'program',
    brief: `<p>The screen is 16×16 pixels, mapped to RAM 0xE0–0xFF. Each row is two bytes, left half first, and the top bit of each byte is the leftmost pixel. Writing 0x80 to 0xE0 lights the top-left pixel.</p>
<p>Draw both diagonals: an <b>X</b> across the whole screen. Then halt. Fewer instructions scores better, and loops beat 32 stores.</p>`,
    cases: [{ ram: {}, expect: 'x' }],
    limit: 20000,
    starter: `; Draw an X on the 16x16 screen (RAM 0xE0..0xFF, 2 bytes per row)
; SCREEN is predefined as 0xE0. [P] reads/writes the address held in P (set with TAP).

        LDA #0x80
        STA SCREEN      ; top-left pixel
        HLT
`,
    hints: ['Keep a pointer in RAM. LDA ptr then TAP, and now STA [P] writes wherever ptr points.', 'For rows 0–7 the left byte shifts down one bit each row. SHL shifts up, so you can start at row 7 (0x01) and go upwards, or use a lookup of stores.', 'Row r and row 15−r are mirror images. One loop can fill both.'],
  },
];

export const aluFn = (op, x, y) => {
  switch (op & 7) {
    case 0: return x;
    case 1: return y;
    case 2: return (x + y) & 255;
    case 3: return (x - y) & 255;
    case 4: return x & y;
    case 5: return x | y;
    case 6: return x ^ y;
    default: return (x << 1) & 255;
  }
};

// Expected screen for "Draw an X": 32 bytes.
export function xScreen() {
  const s = new Uint8Array(32);
  for (let r = 0; r < 16; r++) for (const c of [r, 15 - r]) s[r * 2 + (c >> 3)] |= 0x80 >> (c & 7);
  return s;
}

export const levelById = Object.fromEntries(LEVELS.map((l, i) => [l.id, Object.assign(l, { index: i })]));

// ---------------------------------------------------------------------------
// Turning specs into models
// ---------------------------------------------------------------------------

const objOf = (pins, vals) => { const o = {}; pins.forEach((q, i) => { o[q.name] = vals[i]; }); return o; };
const arrOf = (pins, o) => pins.map((q) => ((o[q.name] ?? 0) & mask(q.width)) >>> 0);

export function modelFromLevel(level) {
  const u = level.unlock;
  const io = u ? u.io : level.io;
  if (u && u.seq) return seqModel(io, u.seq);
  if (level.kind === 'comb') return () => ({ combDeps: true, init: () => null, eval: (ins) => arrOf(io.out, level.spec(objOf(io.in, ins))) });
  if (level.kind === 'clk') return () => ({ combDeps: true, init: () => level.spec.init(), eval: (ins, st) => arrOf(io.out, level.spec.eval(objOf(io.in, ins), st)) });
  if (level.kind === 'seq') return seqModel(io, level.spec);
  return null;
}

function seqModel(io, spec) {
  return () => ({
    combDeps: !!spec.combDeps,
    init: () => spec.init(),
    eval: (ins, st) => arrOf(io.out, spec.out(objOf(io.in, ins), st)),
    tick: (ins, st) => spec.next(objOf(io.in, ins), st),
  });
}

// Tools (wiring parts) available while working on a level.
export function toolsFor(levelIndex) {
  const t = [];
  for (let i = 0; i <= levelIndex && i < LEVELS.length; i++) if (LEVELS[i].tools) t.push(...LEVELS[i].tools);
  return t;
}

// Build the library from the player's progress. `designs[id]` = their solved design.
// `upTo`: only chips from levels with index < upTo (default: all solved).
export function buildLibrary(solved, designs, upTo = Infinity) {
  const lib = new Library();
  for (const level of LEVELS) {
    if (level.index >= upTo || !level.chip) continue;
    if (!solved[level.id]) continue;
    const io = level.unlock ? level.unlock.io : level.io;
    lib.add({
      name: level.chip, label: level.label || level.chip, shape: level.shape || 'box',
      pins: io, model: modelFromLevel(level), sealed: level.sealed !== false,
      design: designs[level.id] || null, level: level.id,
      parNand: level.par ? level.par.nand : 0, parDelay: level.par ? level.par.delay : 0,
      clocked: level.kind === 'seq' || !!level.unlock,
    });
  }
  return lib;
}
