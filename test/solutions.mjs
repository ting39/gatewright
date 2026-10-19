// Reference solutions for every level, written in a tiny DSL.
// d({in:{a:1}, out:{out:1}, parts:{n:'NAND', m:['MUX',{lanes:8}]}, wires:'a>n.a a>n.b n>out'})

let uid = 0;
export function d({ in: ins = {}, out: outs = {}, parts = {}, wires = '' }) {
  const P = [], W = [];
  let y = 0;
  for (const [name, width] of Object.entries(ins)) P.push({ id: 'I_' + name, type: 'IN', x: 0, y: (y += 2), cfg: { name, width } });
  y = 0;
  for (const [name, width] of Object.entries(outs)) P.push({ id: 'O_' + name, type: 'OUT', x: 40, y: (y += 2), cfg: { name, width } });
  let x = 4;
  for (const [id, spec] of Object.entries(parts)) {
    const [type, extra = {}] = Array.isArray(spec) ? spec : [spec];
    P.push({ id, type, x: (x += 4), y: 4, ...extra });
  }
  for (const w of wires.trim().split(/\s+/).filter(Boolean)) {
    const [s, t] = w.split('>');
    const [sp, spin] = s.split('.');
    const [tp, tpin] = t.split('.');
    const from = sp in ins ? { part: 'I_' + sp, pin: 'out' } : { part: sp, pin: spin || 'out' };
    const to = tp in outs && !tpin ? { part: 'O_' + tp, pin: 'in' } : { part: tp, pin: tpin };
    if (!to.pin) throw new Error('target pin missing in ' + w);
    W.push({ id: 'w' + ++uid, from, to });
  }
  return { parts: P, wires: W };
}

const byte = (n) => Array(n).fill(1);
export const SOL = {
  not: d({ in: { a: 1 }, out: { out: 1 }, parts: { n: 'NAND' }, wires: 'a>n.a a>n.b n>out' }),
  and: d({ in: { a: 1, b: 1 }, out: { out: 1 }, parts: { n: 'NAND', i: 'NOT' }, wires: 'a>n.a b>n.b n>i.a i>out' }),
  or: d({ in: { a: 1, b: 1 }, out: { out: 1 }, parts: { na: 'NOT', nb: 'NOT', n: 'NAND' }, wires: 'a>na.a b>nb.a na>n.a nb>n.b n>out' }),
  xor: d({ in: { a: 1, b: 1 }, out: { out: 1 }, parts: { n1: 'NAND', n2: 'NAND', n3: 'NAND', n4: 'NAND' },
    wires: 'a>n1.a b>n1.b a>n2.a n1>n2.b b>n3.a n1>n3.b n2>n4.a n3>n4.b n4>out' }),
  mux: d({ in: { a: 1, b: 1, sel: 1 }, out: { out: 1 }, parts: { s: 'NAND', x: 'NAND', y: 'NAND', o: 'NAND' },
    wires: 'sel>s.a sel>s.b a>x.a s>x.b b>y.a sel>y.b x>o.a y>o.b o>out' }),
  demux: d({ in: { in: 1, sel: 1 }, out: { a: 1, b: 1 }, parts: { ns: 'NOT', x: 'AND', y: 'AND' },
    wires: 'sel>ns.a in>x.a ns>x.b in>y.a sel>y.b x>a y>b' }),
  mux8: d({ in: { a: 8, b: 8, sel: 1 }, out: { out: 8 }, parts: { m: ['MUX', { lanes: 8 }], f: ['FAN', { cfg: { width: 8 } }] },
    wires: 'sel>f.in a>m.a b>m.b f>m.sel m>out' }),
  half: d({ in: { a: 1, b: 1 }, out: { sum: 1, carry: 1 }, parts: { n1: 'NAND', n2: 'NAND', n3: 'NAND', n4: 'NAND', c: 'NOT' },
    wires: 'a>n1.a b>n1.b a>n2.a n1>n2.b b>n3.a n1>n3.b n2>n4.a n3>n4.b n4>sum n1>c.a c>carry' }),
  full: d({ in: { a: 1, b: 1, c: 1 }, out: { sum: 1, carry: 1 },
    parts: { n1: 'NAND', n2: 'NAND', n3: 'NAND', x: 'NAND', n5: 'NAND', n6: 'NAND', n7: 'NAND', s: 'NAND', k: 'NAND' },
    wires: 'a>n1.a b>n1.b a>n2.a n1>n2.b b>n3.a n1>n3.b n2>x.a n3>x.b x>n5.a c>n5.b x>n6.a n5>n6.b c>n7.a n5>n7.b n6>s.a n7>s.b s>sum n1>k.a n5>k.b k>carry' }),
  add8: (() => {
    const parts = { sa: ['SPLIT', { cfg: { widths: byte(8) } }], sb: ['SPLIT', { cfg: { widths: byte(8) } }], j: ['JOIN', { cfg: { widths: byte(8) } }] };
    let w = 'a>sa.in b>sb.in j>sum ';
    for (let i = 0; i < 8; i++) {
      parts['f' + i] = 'FULLADD';
      w += `sa.o${i}>f${i}.a sb.o${i}>f${i}.b f${i}.sum>j.i${i} ` + (i === 0 ? 'cin>f0.c ' : `f${i - 1}.carry>f${i}.c `);
    }
    w += 'f7.carry>cout';
    return d({ in: { a: 8, b: 8, cin: 1 }, out: { sum: 8, cout: 1 }, parts, wires: w });
  })(),
  addsub: d({ in: { a: 8, b: 8, sub: 1 }, out: { out: 8 }, parts: { f: ['FAN', { cfg: { width: 8 } }], x: ['XOR', { lanes: 8 }], ad: 'ADD8' },
    wires: 'sub>f.in b>x.a f>x.b a>ad.a x>ad.b sub>ad.cin ad.sum>out' }),
  zero: d({ in: { in: 8 }, out: { zero: 1 }, parts: { s: ['SPLIT', { cfg: { widths: byte(8) } }], o1: 'OR', o2: 'OR', o3: 'OR', o4: 'OR', o5: 'OR', o6: 'OR', o7: 'OR', n: 'NOT' },
    wires: 'in>s.in s.o0>o1.a s.o1>o1.b s.o2>o2.a s.o3>o2.b s.o4>o3.a s.o5>o3.b s.o6>o4.a s.o7>o4.b o1>o5.a o2>o5.b o3>o6.a o4>o6.b o5>o7.a o6>o7.b o7>n.a n>zero' }),
  mux4: d({ in: { a: 8, b: 8, c: 8, d: 8, sel: 2 }, out: { out: 8 }, parts: { s: ['SPLIT', { cfg: { widths: [1, 1] } }], m1: 'MUX8', m2: 'MUX8', m3: 'MUX8' },
    wires: 'sel>s.in a>m1.a b>m1.b s.o0>m1.sel c>m2.a d>m2.b s.o0>m2.sel m1>m3.a m2>m3.b s.o1>m3.sel m3>out' }),
  alu: d({ in: { x: 8, y: 8, op: 3 }, out: { out: 8 },
    parts: { so: ['SPLIT', { cfg: { widths: [1, 1, 1] } }], jo: ['JOIN', { cfg: { widths: [1, 1] } }], as: 'ADDSUB',
      an: ['AND', { lanes: 8 }], or: ['OR', { lanes: 8 }], xo: ['XOR', { lanes: 8 }],
      sx: ['SPLIT', { cfg: { widths: [7, 1] } }], jx: ['JOIN', { cfg: { widths: [1, 7] } }], lo: 'MUX4', hi: 'MUX4', m: 'MUX8' },
    wires: 'op>so.in so.o0>jo.i0 so.o1>jo.i1 x>as.a y>as.b so.o0>as.sub x>an.a y>an.b x>or.a y>or.b x>xo.a y>xo.b x>sx.in sx.o0>jx.i1 ' +
      'x>lo.a y>lo.b as>lo.c as>lo.d jo>lo.sel an>hi.a or>hi.b xo>hi.c jx>hi.d jo>hi.sel lo>m.a hi>m.b so.o2>m.sel m>out' }),
  srlatch: d({ in: { set: 1, reset: 1 }, out: { q: 1 }, parts: { s: 'NAND', r: 'NAND', q: 'NAND', qb: 'NAND' },
    wires: 'set>s.a set>s.b reset>r.a reset>r.b s>q.a qb>q.b r>qb.a q>qb.b q>q' }),
  dlatch: d({ in: { d: 1, en: 1 }, out: { q: 1 }, parts: { s: 'NAND', r: 'NAND', q: 'NAND', qb: 'NAND' },
    wires: 'd>s.a en>s.b s>r.a en>r.b s>q.a qb>q.b r>qb.a q>qb.b q>q' }),
  dff: d({ in: { d: 1, clk: 1 }, out: { q: 1 }, parts: { n: 'NOT', m: 'DLATCH', s: 'DLATCH' },
    wires: 'clk>n.a d>m.d n>m.en m.q>s.d clk>s.en s.q>q' }),
  bit: d({ in: { in: 1, load: 1 }, out: { out: 1 }, parts: { f: 'DFF', m: 'MUX' },
    wires: 'f>m.a in>m.b load>m.sel m>f.in f>out' }),
  reg: d({ in: { in: 8, load: 1 }, out: { out: 8 }, parts: { b: ['BIT', { lanes: 8 }], f: ['FAN', { cfg: { width: 8 } }] },
    wires: 'load>f.in in>b.in f>b.load b>out' }),
  counter: d({ in: { in: 8, load: 1, inc: 1, reset: 1 }, out: { out: 8 },
    parts: { r: 'REG', one: ['CONST', { cfg: { width: 1, value: 1 } }], ad: 'ADD8', ml: 'MUX8', mr: 'MUX8' },
    wires: 'r>ad.a inc>ad.cin ad.sum>ml.a in>ml.b load>ml.sel ml>mr.a reset>mr.sel mr>r.in one>r.load r>out' }),
  decoder: d({ in: { sel: 3 }, out: { out: 8 },
    parts: { s: ['SPLIT', { cfg: { widths: [1, 1, 1] } }], one: ['CONST', { cfg: { width: 1, value: 1 } }], j: ['JOIN', { cfg: { widths: byte(8) } }],
      d0: 'DEMUX', d1: 'DEMUX', d2: 'DEMUX', d3: 'DEMUX', d4: 'DEMUX', d5: 'DEMUX', d6: 'DEMUX' },
    wires: 'sel>s.in one>d0.in s.o2>d0.sel d0.a>d1.in d0.b>d2.in s.o1>d1.sel s.o1>d2.sel ' +
      'd1.a>d3.in d1.b>d4.in d2.a>d5.in d2.b>d6.in s.o0>d3.sel s.o0>d4.sel s.o0>d5.sel s.o0>d6.sel ' +
      'd3.a>j.i0 d3.b>j.i1 d4.a>j.i2 d4.b>j.i3 d5.a>j.i4 d5.b>j.i5 d6.a>j.i6 d6.b>j.i7 j>out' }),
  ram8: (() => {
    const parts = { dec: 'DECODE', fl: ['FAN', { cfg: { width: 8 } }], an: ['AND', { lanes: 8 }], sl: ['SPLIT', { cfg: { widths: byte(8) } }],
      sa: ['SPLIT', { cfg: { widths: [2, 1] } }], lo: 'MUX4', hi: 'MUX4', m: 'MUX8' };
    let w = 'addr>dec.sel load>fl.in dec>an.a fl>an.b an>sl.in addr>sa.in sa.o0>lo.sel sa.o0>hi.sel lo>m.a hi>m.b sa.o1>m.sel m>out ';
    for (let i = 0; i < 8; i++) {
      parts['r' + i] = 'REG';
      w += `in>r${i}.in sl.o${i}>r${i}.load r${i}>${i < 4 ? 'lo' : 'hi'}.${'abcd'[i & 3]} `;
    }
    return d({ in: { addr: 3, in: 8, load: 1 }, out: { out: 8 }, parts, wires: w });
  })(),
  control: d({ in: { ctl: 8, a: 8 }, out: { op: 3, ymem: 1, pmode: 1, store: 1, setp: 1, jump: 1 },
    parts: { c: ['SPLIT', { cfg: { widths: byte(8) } }], jo: ['JOIN', { cfg: { widths: [1, 1, 1] } }], nj: 'NOT', f3: ['FAN', { cfg: { width: 3 } }],
      ao: ['AND', { lanes: 3 }], sa: ['SPLIT', { cfg: { widths: [7, 1] } }], z: 'ISZERO', nz: 'OR', pos: 'NOT',
      t2: 'AND', t1: 'AND', t0: 'AND', o1: 'OR', o2: 'OR', jj: 'AND' },
    wires: 'ctl>c.in c.o3>jo.i0 c.o4>jo.i1 c.o5>jo.i2 c.o0>nj.a nj>f3.in jo>ao.a f3>ao.b ao>op ' +
      'c.o7>ymem c.o6>pmode c.o2>store c.o1>setp a>sa.in a>z.in sa.o1>nz.a z.zero>nz.b nz>pos.a ' +
      'c.o5>t2.a sa.o1>t2.b c.o4>t1.a z.zero>t1.b c.o3>t0.a pos>t0.b t2>o1.a t1>o1.b o1>o2.a t0>o2.b c.o0>jj.a o2>jj.b jj>jump' }),
  cpu: d({ in: { instr: 16, data: 8, reset: 1 }, out: { addr: 8, out: 8, write: 1, pc: 8 },
    parts: { sp: ['SPLIT', { cfg: { widths: [8, 8] } }], ct: 'CONTROL', A: 'REG', P: 'REG', am: 'MUX8', ym: 'MUX8', alu: 'ALU', pcr: 'COUNTER', one: ['CONST', { cfg: { width: 1, value: 1 } }] },
    wires: 'instr>sp.in sp.o1>ct.ctl A>ct.a alu>A.in one>A.load A>P.in ct.setp>P.load sp.o0>am.a P>am.b ct.pmode>am.sel am>addr ' +
      'sp.o0>ym.a data>ym.b ct.ymem>ym.sel A>alu.x ym>alu.y ct.op>alu.op sp.o0>pcr.in ct.jump>pcr.load one>pcr.inc reset>pcr.reset ' +
      'A>out ct.store>write pcr>pc' }),
  computer: d({ in: { reset: 1 }, out: { pc: 8 }, parts: { cpu: 'CPU', rom: 'ROM', ram: 'RAM256' },
    wires: 'reset>cpu.reset cpu.pc>rom.addr rom.data>cpu.instr cpu.addr>ram.addr cpu.out>ram.in cpu.write>ram.load ram.out>cpu.data cpu.pc>pc' }),
};

export const PROGRAMS = {
  'p-sum': `
n=0
sum=1
        LDA #0
        STA sum
loop:   LDA n
        JZ done
        ADD sum
        STA sum
        LDA n
        SUB #1
        STA n
        JMP loop
done:   HLT`,
  'p-mul': `
x=0
y=1
out=2
bit=3
        LDA #0
        STA out
        LDA #1
        STA bit
loop:   LDA y
        AND bit
        JZ skip
        LDA out
        ADD x
        STA out
skip:   LDA x
        SHL
        STA x
        LDA bit
        SHL
        STA bit
        JNZ loop
        HLT`,
  'p-x': `
v=0x10
up=0x11
dn=0x12
        LDA #1
        STA v
        LDA #0xE1
        STA up
        LDA #0xEE
        STA dn
loop:   LDA up
        TAP
        LDA v
        STA [P]
        LDA up
        ADD #0x0F
        TAP
        LDA v
        STA [P]
        LDA dn
        TAP
        LDA v
        STA [P]
        LDA dn
        ADD #0x11
        TAP
        LDA v
        STA [P]
        LDA up
        ADD #2
        STA up
        LDA dn
        SUB #2
        STA dn
        LDA v
        SHL
        STA v
        JNZ loop
        HLT`,
};
