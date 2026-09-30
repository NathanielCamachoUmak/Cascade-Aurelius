# Cascade: Stage 2 Per-Class Ability Tutorial Implementation Plan

This document outlines the technical implementation for the **Stage 2: Classes & Abilities Tutorial**, where **each of the 4 classes has its own dedicated, scenario-based "Problem-Solution" tutorial** covering its complete kit (**Passive → `[Q]` Ability → `[E]` Ability → `[R]` Ultimate**).

---

## Overview & Entry Flow

1. **Launching Stage 2 from the Tutorial Menu ([modeselect.html](file:///c:/Users/destr/Documents/Cascade-Aurelius/Prototype%20V1/modeselect.html))**:
   - Clicking **START / REPLAY** on **Stage 2 (`CLASSES & ABILITIES`)** opens the **Choose Your Class (Loadout) Modal** ([`showClassSelectModal`](file:///c:/Users/destr/Documents/Cascade-Aurelius/Prototype%20V1/src/ClassSelectModal.ts)).
   - Each class card in the modal displays whether that class's tutorial has been completed (`✓ COMPLETED` or `NOT COMPLETED`).
   - Confirming a class launches `lobby.html` into that specific class's 4-step interactive tutorial (`bootGame({ mode: 'TUTORIAL', stage: 2, tutorialClass: classId })`).
2. **Per-Class Completion Tracking (`localStorage`)**:
   - Individual completion keys:
     - `basics-stage-2-SPEEDSTER`
     - `basics-stage-2-TANK` (Sentinel)
     - `basics-stage-2-SABOTEUR`
     - `basics-stage-2-SUPPORT`
   - The Stage 2 row in the Tutorial Menu displays overall progress (`0 / 4 COMPLETED`, `1 / 4 COMPLETED`, ..., `✓ 4 / 4 COMPLETED`) and marks `basics-stage-2` complete once all 4 classes are mastered.
3. **Conclusion Modal Options**:
   - Upon finishing a class's 4-step tutorial, the conclusion modal shows:
     - Which classes are completed (`X / 4 Classes Mastered`)
     - **Next Unfinished Class** / **Choose Another Class** button (re-opens the Class Select Modal right away)
     - **Replay This Class** button
     - **Back to Tutorials** button

---

## Phase 1: Engine Preparation & The "Dummy Board"
To teach offensive, defensive, and AoE abilities effectively, the player must see the consequences of their actions on an opponent.

* **Task 1.1: Dummy Grid Instantiation**
  * Instantiate a secondary, non-playable 10×20 grid alongside the player's main HTML5 Canvas grid (`GameManager.initTutorialWithDummy` / `TutorialManager`).
  * Set the Dummy Grid's input listener to `null` (frozen) so the local player cannot control it.
* **Task 1.2: Scripted AI / Dummy States**
  * Use [`Grid.loadPresetMatrix`](file:///c:/Users/destr/Documents/Cascade-Aurelius/Prototype%20V1/src/Grid.ts#L314-L330) to load pre-configured 2D arrays (static block arrangements) or restricted AI states for each class scenario.
* **Task 1.3: Targeting System Override**
  * Force the player's $O(1)$ Circular Linked List targeting pointer (`selectedTargetIndex = 1`) to lock exclusively onto the Dummy Board during the `TUTORIAL` state.

---

## Phase 2–4: Per-Class 4-Step Curriculum (Passive → `[Q]` → `[E]` → `[R]`)

### Class 1: Speedster (`SPEEDSTER`)
1. **Step 1 — Passive Drill (`Speed Block [V] Guarantee`)**:
   * **Setup:** Player's board is pre-stacked with a 4-row Tetris well (Column 10 open). Provide an `I`-piece.
   * **Action (Part A):** Rotate and drop the `I`-piece into Column 10 to clear a **4-line Tetris**.
   * **Action (Part B):** Clearing the Tetris intercepts the RNG and forces a **Speed Block (`V`)** onto the next `I`-piece. Clear the single-row setup containing `[V]`.
   * **Resolution:** Triggers the **Speed Block (`V`)**, slowing piece drop rate by **25%**.
2. **Step 2 — `[Q]` Sprint (Targeted Offense)**:
   * **Setup:** Dummy Board is active on the right (`TARGET LOCKED`) with pieces dropping at normal speed.
   * **Action:** eFSM Guard prompts **`[Q]` Sprint**.
   * **Resolution:** The Dummy Board's **current piece and next 3 pieces** drop **50% faster**, visually forcing rapid drops on the Dummy Board.
3. **Step 3 — `[E]` Time Warp (The Clutch Crisis)**:
   * **Setup:** Temporarily alter the player's Dynamic Gravity System to maximum speed (`55ms` drop interval) with a 4-cell gap on the bottom row.
   * **Action:** eFSM Guard requires pressing **`[E]` Time Warp** first, then sliding the `I`-piece into the right-hand gap and clearing the line.
   * **Resolution:** Cuts drop speed by **50% for 6 seconds**, allowing the player to safely place the piece.
4. **Step 4 — `[R]` Bullet Time (3-Dummy AoE Sandbox)**:
   * **Setup:** Instantiate **three miniature Dummy Boards** (`DUMMY ALPHA`, `DUMMY BETA`, `DUMMY GAMMA`) and pre-fill the player's Ultimate meter (`40 / 40 LINES`).
   * **Action:** eFSM Guard prompts **`[R]` Bullet Time**.
   * **Resolution:** Freezes **all 3 Dummy Boards** in place (`QUICKSILVER` effect) for **5 seconds** while the player continues playing. Marks `basics-stage-2-SPEEDSTER` complete.

---

### Class 2: Sentinel (`TANK`)
1. **Step 1 — Passive Drill (`Shield Block [S] Guarantee`)**:
   * **Setup:** Pre-stacked 4-row Tetris well (Column 10 open) + `I`-piece.
   * **Action (Part A):** Drop the `I`-piece into Column 10 to clear a **4-line Tetris**.
   * **Action (Part B):** Clearing the Tetris forces a **Shield Block (`S`)** onto the next piece. Clear the single-row setup containing `[S]`.
   * **Resolution:** Activates `SHIELD ACTIVE`, automatically blocking an incoming garbage attack from the Dummy Board.
2. **Step 2 — `[Q]` Fortify (Multi-Attack Absorption)**:
   * **Setup:** Queue **2 consecutive incoming garbage attacks** (`Attack 1: 4 Lines`, `Attack 2: 4 Lines`) from the Dummy Board.
   * **Action:** eFSM Guard prompts **`[Q]` Fortify**.
   * **Resolution:** Grants **2 Fortify charges** (`fortifyCharges = 2`), absorbing and nullifying both incoming garbage attacks back-to-back.
3. **Step 3 — `[E]` Counter Strike (The Defense Crisis)**:
   * **Setup:** Freeze the player's grid and queue an unavoidable **10-line garbage attack** via the CQRS queue.
   * **Action:** eFSM Guard prompts **`[E]` Counter Strike**.
   * **Resolution:** Intercepts the 10-line garbage attack, applies the reflector, and visually bounces all **10 lines of garbage** onto the Dummy Board.
4. **Step 4 — `[R]` Earthquake (3-Dummy AoE Sandbox)**:
   * **Setup:** Instantiate **three miniature Dummy Boards** and pre-fill the player's Ultimate meter (`50 / 50 LINES`).
   * **Action:** eFSM Guard prompts **`[R]` Earthquake**.
   * **Resolution:** Simultaneously sends **+4 lines of garbage** to **all 3 Dummy Boards** with screen shake. Marks `basics-stage-2-TANK` complete.

---

### Class 3: Saboteur (`SABOTEUR`)
1. **Step 1 — Passive Drill (`Freeze Block [F] Guarantee`)**:
   * **Setup:** Pre-stacked 4-row Tetris well (Column 10 open) + `I`-piece.
   * **Action (Part A):** Drop the `I`-piece into Column 10 to clear a **4-line Tetris**.
   * **Action (Part B):** Clearing the Tetris forces a **Freeze Block (`F`)** onto the next piece. Clear the single-row setup containing `[F]`.
   * **Resolution:** Triggers **Ability Freeze (`3.0s`)**, locking the Dummy Board's abilities (`[Q]`, `[E]`, `[R]`).
2. **Step 2 — `[Q]` Scramble (Queue Disruption)**:
   * **Setup:** Dummy Board has an upcoming preview queue of clean `I`-pieces (`[I, I, I, I, I]`). Targeting pointer is locked onto the Dummy Board.
   * **Action:** eFSM Guard prompts **`[Q]` Scramble**.
   * **Resolution:** Scrambles the Dummy's **next 5 upcoming pieces** into randomized shapes (`Z`, `S`, `J`, `L`, `T`).
3. **Step 3 — `[E]` Grid Shift (The Disruption Crisis)**:
   * **Setup:** Load a static 2D array for the Dummy Board showing a **perfect 4-line Tetris well** in Column 10, with the Dummy about to drop its vertical `I`-piece.
   * **Action:** eFSM Guard prompts **`[E]` Grid Shift** *(marks `[E]` as `USED (1/MATCH)`)*.
   * **Resolution:** Shifts the Dummy's board by **2 columns**, misaligning their well so their `I`-piece misdrops onto the stack.
4. **Step 4 — `[R]` Chaos Mode (3-Dummy AoE + Grid Shift Reset)**:
   * **Setup:** Instantiate **three miniature Dummy Boards** while `[E] Grid Shift` remains `USED (1/MATCH)`. Pre-fill the player's Ultimate meter (`35 / 35 LINES`).
   * **Action:**
     1. eFSM Guard prompts **`[R]` Chaos Mode** (reverses controls on all 3 Dummy Boards for **8 seconds** **AND resets `[E] Grid Shift`**!).
     2. Prompt the player to press **`[E]` Grid Shift** again to verify the reset!
   * **Resolution:** Demonstrates both the 3-Dummy AoE control reversal and the `[E] Grid Shift` reset. Marks `basics-stage-2-SABOTEUR` complete.

---

### Class 4: Support (`SUPPORT`)
1. **Step 1 — Passive Drill (`Incoming Garbage Conversion`)**:
   * **Setup:** Pre-stacked 4-row Tetris well (Column 10 open) + `I`-piece.
   * **Action:** Drop the `I`-piece into Column 10 to clear a **4-line Tetris**.
   * **Resolution:** Arms Support's passive (`supportPassiveConversion = true`). When the Dummy Board sends a 3-line garbage attack, the incoming garbage lines automatically transform into **Special Blocks (`B`, `W`, `X`, `S`, `F`, `G`)** on the player's board!
2. **Step 2 — `[Q]` Recycle (Board Garbage Conversion & Ally Targeting)**:
   * **Setup:** Player's board has **4 lines of grey garbage** at the bottom.
   * **Action:** eFSM Guard prompts **`[Q]` Recycle**.
   * **Resolution:** Converts **4 garbage blocks/lines** on the board into **Special Blocks** (and highlights that in 3v3 Team Deathmatch, `Recycle` can target allies).
3. **Step 3 — `[E]` Perfect Clear Bonus (All-Clear Window)**:
   * **Setup:** Player's board has a single bottom row with 6 filled cells (`columns 0–5`) and 4 open cells (`columns 6–9`), plus a horizontal `I`-piece. Clearing this single row leaves the entire grid **100% empty**.
   * **Action:**
     1. eFSM Guard prompts **`[E]` Perfect Clear Bonus** first (opening the **15-second Perfect Clear Window**).
     2. Slide the horizontal `I`-piece into `columns 6–9` and press `SPACEBAR` to achieve a **Perfect Clear**!
   * **Resolution:** Awards **+4 Bonus Lines** and **+4 Ultimate Meter** upon emptying the grid within the window.
4. **Step 4 — `[R]` Guardian Angel (The Rescue Crisis)**:
   * **Setup:** Spawn the player on a board pre-filled with **18 lines of garbage** (critical danger state) with the Ultimate meter pre-filled (`45 / 45 LINES`).
   * **Action:** eFSM Guard prompts **`[R]` Guardian Angel**.
   * **Resolution:** Instantly clears the **bottom 4 lines** of the board, rescuing the player from top-out. Marks `basics-stage-2-SUPPORT` complete.

---

## Phase 5: eFSM Integration & State Guards
* **Task 5.1: `TUTORIAL` State Module**
  * Uses the `GameState.TUTORIAL` state in [`GameManager.ts`](file:///c:/Users/destr/Documents/Cascade-Aurelius/Prototype%20V1/src/GameManager.ts) and [`TutorialManager.ts`](file:///c:/Users/destr/Documents/Cascade-Aurelius/Prototype%20V1/src/TutorialManager.ts).
  * Disables normal game-over conditions and blocks multiplayer network broadcasts (`Socket.io`) during tutorial execution.
  * Enforces eFSM keystroke guards so each step waits until the required ability key (`[Q]`, `[E]`, `[R]`) or line-clear condition is satisfied.
