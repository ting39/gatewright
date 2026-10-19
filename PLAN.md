Status: in-progress

# J. Build a computer from NAND gates (puzzle game)
Read `~/Desktop/playground/NIGHT_PLAN.md` first. Folder: `~/Desktop/playground/nand` (pick a
good name; record it). Heartbeat: `.heartbeat`. Local port: 8102.

## Goal
A browser puzzle game: start with only NAND, build NOT → AND/OR/XOR → MUX/DEMUX → half/full adder
→ 8-bit adder → ALU → latch/flip-flop → register → RAM → program counter → a working CPU, then
run programs on the CPU you built (final level: write a small program, e.g. multiply or draw on a
tiny screen). ~15–25 levels; each unlocks the built part as a reusable chip.
Original framing, not a copy of nand2tetris/Turing Complete text or levels.

## Quality bar
- Great wiring UX: drag gates, connect pins, buses (multi-bit wires), labels, undo/redo,
  copy/paste, zoom/pan, keyboard shortcuts, wire auto-routing that looks tidy.
- Correct simulation: combinational evaluation + clocked sequential logic, cycle detection,
  propagation visualised (wires light up), step/run clock, truth-table checker per level with
  clear failure display (which input combination failed).
- Unit tests for the simulator (node --test). Levels verified by reference solutions in tests.
- Score per level: gate count / delay, with personal best; hints; sandbox mode.
- Save progress (localStorage, guarded); export/import designs.
- Works on desktop well; usable on tablet; graceful message on small phones.


## Name & design notes (2026-10-20, lane C)
**Name: Gatewright** (slug `gatewright`, live at https://ting39.github.io/gatewright/). Plain ES modules, no build.

Files: `src/sim.js` (flatten + compile + evaluate, pure), `src/chips.js` (primitives + library),
`src/levels.js` (levels, specs, hints), `src/check.js` (test runner, pure), `src/isa.js`
(assembler + reference CPU), `src/editor.js` (canvas editor), `src/app.js` (UI glue),
`src/machine.js` (program-level UI), `test/*.test.mjs` (node --test, reference solutions).

Simulator decisions:
- Nets carry ints (≤16 bits). Primitives: NAND (bitwise), SPLIT/JOIN (configurable widths),
  FAN (1→n copy), CONST. IN/OUT parts are the chip boundary.
- "Lanes": any chip whose pins are all 1-bit can be set to N lanes → bitwise N-bit version
  (gate count ×N). Avoids tedious 8× copies.
- Once a level is solved, its chip is used **sealed** (behavioural model = the level spec) in later
  designs, so the CPU runs fast. Exception: the CPU and Computer chips are flattened, so programs
  really run on the player's own CPU wiring. Gate count still sums the player's own designs.
- Evaluation: Tarjan SCCs over combinational deps, topological order, Gauss-Seidel iteration
  inside cycles (latches) with a limit → "never settles" error highlighting the loop.
- Clock: the latch/flip-flop levels use an explicit `clk` input. After the Flip-Flop level, the
  sealed DFF has an **implicit global clock** (no clk pin); all memory parts tick together.
- Sequential tests run the spec model in lockstep with the player's circuit (set inputs →
  settle → compare → tick). Unknown initial state (latches) = don't care until defined.

ISA ("G8"), 16-bit instructions in a separate ROM, 8-bit data, RAM 256 bytes:
`[m][p][op2 op1 op0][s][t][j] k(8)`. addr = p ? P : k; Y = m ? RAM[addr] : k;
A ← ALU(op, A, Y) every cycle (op 000 = keep A, 001 Y, 010 A+Y, 011 A−Y, 100 AND, 101 OR,
110 XOR, 111 A<<1); s: RAM[addr] ← A (old A); t: P ← A (old A); j: op field becomes jump
condition (lt,eq,gt on A, signed), PC ← k if condition, A unchanged. I/O: 0xDE = OUT port
(writes logged), 0xDF = buttons (read), 0xE0–0xFF = 16×16 screen (2 bytes/row, MSB left).
Assembler: `LDA #5` immediate, `LDA x` direct, `LDA [P]` indirect; ADD SUB AND OR XOR SHL
STA TAP JMP JZ JNZ JN JP JNN JLE NOP HLT; labels, `name = value`, `;` comments.

Levels (28): Logic — NOT, AND, OR, XOR, MUX, DEMUX, Bus MUX8 · Arithmetic — Half adder,
Full adder, Adder8, AddSub8, IsZero8, MUX4 (4-way bus), ALU · Memory — SR latch, D latch,
Flip-flop, Bit, Register, Counter, Decoder 3→8, RAM8 · Computer — Control unit, CPU, Computer
(wire CPU+ROM+RAM256, run a program) · Programs — Sum 1..n, Multiply, Draw an X.
Score: NAND count + delay (longest NAND path), par from reference solutions, personal best.

## Checklist
- [x] Name + level list + design notes here
- [ ] Simulator core + tests
- [ ] Editor UX
- [ ] Levels + reference solutions + tests
- [ ] CPU levels + program runner + assembler
- [ ] Polish, publish, CARD.json, MORNING_REPORT entry

## Progress log
- 2026-10-20 01:50 lane C: claimed, design notes written (name Gatewright). Next: simulator core + tests.
