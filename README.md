# Gatewright

**Build a computer from a single NAND gate, then program it.**

▶ **Play:** https://ting39.github.io/gatewright/

You start with one part in the bin: NAND. Every chip you finish joins the bin, so a few dozen
levels later you're wiring an 8-bit CPU out of your own ALU, registers and control unit.
Then you write assembly that runs on the CPU you built, and draw on its 16×16 screen.

## The climb (28 levels + free play)
| Chapter | Levels |
|---|---|
| I · Logic | Inverter, AND, OR, XOR, MUX, DEMUX, 8-bit bus switch |
| II · Arithmetic | half adder, full adder, byte adder, add/subtract, zero detector, 4-way switch, ALU |
| III · Memory | SR latch, D latch, edge-triggered flip-flop, bit, register, counter, decoder, RAM |
| IV · Computer | control unit, CPU, computer (CPU + ROM + RAM) |
| V · Programs | triangle numbers, multiply, draw an X: G8 assembly on *your* machine. Then free play with an etch-a-sketch demo you can edit |

## Features
- **A real wiring editor:** drag from pin to pin, multi-bit buses with value badges, split/join/fan parts,
  *lanes* (turn any 1-bit chip into an n-bit one), tidy orthogonal routing you can re-route by dragging,
  box select, copy/paste, undo/redo, zoom/pan/pinch, keyboard shortcuts.
- **A proper simulator:** strongly-connected-component ordering, so feedback loops (latches) settle
  and oscillations get caught and highlighted. Combinational and clocked logic both work.
  Signals visibly ripple through the gates, one NAND delay at a time.
- **Honest checking:** exhaustive truth tables where they fit, randomized vectors with edge cases where
  they don't. Sequential parts are checked step by step against the spec. The CPU is checked cycle by cycle
  against a reference machine, with the failing instruction named. Click any test row to load it onto the board.
- **Scores:** NAND count (counting the gates inside your own sub-chips) and critical-path delay.
  Each level has a par and remembers your personal best.
- **Programs run on your own wiring.** The program levels run on your computer design, not a stand-in.
  The machine view has a syntax-highlighted editor, step/run at adjustable speed, the screen, RAM, the output port and buttons.
- Hints for every level, a sandbox, export/import of designs and progress, sound (WebAudio, toggleable),
  `prefers-reduced-motion` support, and a tablet layout.

## The G8 CPU
16-bit instructions in ROM, 8-bit data, 256 bytes of RAM. Registers **A** (accumulator), **P** (pointer), **PC**.

```
bit:  15 14 13 12 11 10  9  8 | 7..0
       m  p op2 op1 op0  s  t  j |  k
addr = p ? P : k        Y = m ? RAM[addr] : k
A <- ALU(op, A, Y)      op: 0 keep · 1 Y · 2 A+Y · 3 A−Y · 4 AND · 5 OR · 6 XOR · 7 A<<1
s: RAM[addr] <- A       t: P <- A
j: jump to k if (op2 & A<0) | (op1 & A==0) | (op0 & A>0); A unchanged
```
Assembly: `LDA #5` (immediate) · `LDA x` (memory) · `LDA [P]` (via pointer) · `ADD SUB AND OR XOR SHL STA TAP`
· `JMP JZ JNZ JN JP JNN JLE` · `NOP HLT` · labels, `name = value`, `; comments`.
I/O: `OUT` = 0xDE (output port), `KEYS` = 0xDF (buttons), `SCREEN` = 0xE0–0xFF (16×16, 2 bytes per row, MSB on the left).

## Development
Plain ES modules, no build step, no dependencies.
```bash
python3 -m http.server 8102          # then open http://localhost:8102
node --test test/                     # simulator, ISA and a reference solution for every level
```
- `src/sim.js`: flattening, net merging, SCC ordering, evaluation, clocking, delay analysis
- `src/chips.js`: primitive parts and the chip library
- `src/levels.js`: level specs (also the behaviour of each sealed chip)
- `src/check.js`: test runner, CPU lock-step checker, program runner
- `src/isa.js`: assembler, disassembler, reference CPU
- `src/editor.js`: canvas editor · `src/app.js`: UI · `src/machine.js`: program levels
- `test/solutions.mjs`: reference designs for all 25 circuit levels and the 3 programs, used to set par

Made by ting39 with Claude.
