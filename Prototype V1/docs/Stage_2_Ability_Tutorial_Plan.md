# Cohesive Class-Specific Tutorial Implementation Plan (Stage 2)

This document outlines the step-by-step technical implementation for the scenario-based "Problem-Solution" tutorials for **Stage 2: Class Certifications**. It prioritizes the class-specific progression flow while seamlessly integrating engine-level architectural requirements.

---

## Phase 1: Engine Architecture & State Management
To teach abilities effectively without risking live-server interference, we establish a localized, highly controlled sandbox environment.

### 1.1 Dummy Grid Instantiation & Targeting
* **Headless Grid Creation:** [`GameManager.ts`](file:///c:/Users/destr/Documents/Cascade-Aurelius/Prototype%20V1/src/GameManager.ts) and [`TutorialManager.ts`](file:///c:/Users/destr/Documents/Cascade-Aurelius/Prototype%20V1/src/TutorialManager.ts) spawn secondary, non-playable 10×20 HTML5 Canvas grids ("Dummy Opponents" or "Ally Dummy").
* **Input & Network Isolation:** Set the dummy grid's input listener to `null` (frozen). Explicitly disconnect tutorial instances from the `Socket.io` network loop so tutorial actions never emit live server broadcasts.
* **Targeting Override:** Force the player's $O(1)$ Circular Linked List targeting pointer (`selectedTargetIndex = 1`) to lock exclusively onto the active Dummy Board(s) during the tutorial.

### 1.2 State Overrides & AI Injections
* **`TUTORIAL` / `TUTORIAL_ACTIVE` State:** Inject the tutorial overarching state into the Extended Finite State Machine (eFSM). This state disables standard game-over conditions, bypasses standard ability cooldowns when transitioning steps, and grants full ultimate charge when dictated by the script.
* **eFSM Guard Conditions:** Utilize eFSM guards to pause tutorial progression until the exact required keystroke (`[Q]`, `[E]`, `[R]`) or line-clear condition is captured.
* **Scripted Engine Injections:**
  * Accept automated, scripted garbage queues via the Command Query Responsibility Segregation (CQRS) queue.
  * Allow the engine to override the standard Dynamic Gravity multiplier temporarily (e.g., `55ms` instant drop rate for Speedster Step 2).
  * Populate dummy boards using either restricted Pierre Dellacherie AI or pre-configured static 2D arrays via [`Grid.loadPresetMatrix`](file:///c:/Users/destr/Documents/Cascade-Aurelius/Prototype%20V1/src/Grid.ts#L314-L330).

---

## Phase 2: Bridging Mechanics (The Passives Drill)
Before introducing active abilities, the engine bridges the gap between basic controls and class mechanics using forced RNG resolutions. This applies to **Step 1** of Speedster, Sentinel, and Saboteur (while Support begins with a 18-line garbage survival setup and conversion).

* **The Tetris Trigger:** Spawn the player into a board pre-stacked with a "well" (Column 10 open) requiring only a single `I`-piece to clear a Tetris. The engine provides the `I`-piece.
* **Forced Resolution:** Upon clearing the Tetris, the engine intercepts the RNG and forces the queue to drop the player's class-specific Special Block (`Speed [V]`, `Shield [S]`, or `Freeze [F]`).
* **Demonstration:** The player clears a single line containing this Special Block to visually trigger its baseline passive effect.

---

## Phase 3: The Certification Scenarios (Per-Class 4-Step Flow)
Each class has its own 4-step certification tutorial selected via the **Choose Your Class (Loadout) Modal**.

### 1. Speedster Certification (`SPEEDSTER`)
**Objective:** Teach players to survive high-speed drops and weaponize tempo.
* **Step 1 (Passive):** Player executes the Passives Drill (Tetris Trigger → Forced **Speed Block (`V`)**). Clearing the line containing the Speed Block (`V`) reduces baseline drop speed by **25%**.
* **Step 2 (Survival / The Clutch — `[E] Time Warp`):** The engine overrides Dynamic Gravity, accelerating the player's drop speed to an unmanageable rate (`55ms`). The UI prompts **`[E] Time Warp`**. Pressing `E` cuts drop speed by **50% for 6 seconds**, allowing safe placement of the `I`-piece to clear the line.
* **Step 3 (Offense — `[Q] Sprint`):** A Dummy Board spawns with active falling pieces. The UI prompts **`[Q] Sprint`**. Pressing `Q` causes the dummy's current and next 3 pieces to slam down **50% faster**.
* **Step 4 (Ultimate / AoE — `[R] Bullet Time`):** The engine spawns **3 miniature Dummy Boards** and maxes the player's FSM Ultimate meter (`40 / 40 LINES`). The player activates **`[R] Bullet Time`**, visually freezing all three dummies completely for **5 seconds** while the player scores a free **4-line Tetris** in a pre-stacked well!

### 2. Sentinel (Tank) Certification (`TANK`)
**Objective:** Teach players defensive mitigation and counter-attacking.
* **Step 1 (Passive):** Player executes the Passives Drill (Tetris Trigger → Forced **Shield Block (`S`)**). Clearing the line containing the Shield Block (`S`) arms a shield that absorbs a minor, scripted garbage attack from the Dummy Board.
* **Step 2 (Survival / The Defense — `[Q] Fortify`):** The player's grid is frozen. The CQRS system queues a massive, unavoidable **10-line garbage attack** (split across 2 incoming salvos). The UI prompts **`[Q] Fortify`**. The player gains **2 FSM immunity charges**, completely blocking the lethal damage.
* **Step 3 (Offense — `[E] Counter Strike`):** A subsequent **10-line garbage attack** is queued. The UI prompts **`[E] Counter Strike`**. The eFSM intercepts the garbage, applies the reflector arming visual, and bounces all 10 lines directly back onto the Dummy Opponent.
* **Step 4 (Ultimate / AoE — `[R] Earthquake`):** **3 miniature Dummy Boards** spawn and the Ultimate meter is maxed (`50 / 50 LINES`). The player triggers **`[R] Earthquake`**, dropping **4 raw lines of garbage** onto all three dummy boards simultaneously.

### 3. Saboteur Certification (`SABOTEUR`)
**Objective:** Teach players disruption, misdirection, and targeting.
* **Step 1 (Passive):** Player executes the Passives Drill (Tetris Trigger → Forced **Freeze Block (`F`)**). Clearing the line containing the Freeze Block (`F`) visually locks the Dummy Board's UI abilities (`[Q]`, `[E]`, `[R]`) for **3 seconds**.
* **Step 2 (Interception — `[Q] Scramble`):** The Dummy Board loads a static 2D array showing a perfect 4-line well with an `"I"` block queued in its preview. The UI prompts **`[Q] Scramble`**, which shuffles the dummy's next 5 upcoming pieces into awkward shapes, ruining their Tetris clear.
* **Step 3 (Offense / The Disruption — `[E] Grid Shift`):** The Dummy Board sets up a new well with an `"I"` piece poised above Column 10. The UI prompts **`[E] Grid Shift`**. The engine shifts the dummy's 2D array **2 columns over**, misaligning their stack so the piece misdrops.
* **Step 4 (Ultimate / AoE — `[R] Chaos Mode`):** **3 miniature Dummy Boards** spawn and the Ultimate meter is maxed (`35 / 35 LINES`). The player triggers **`[R] Chaos Mode`**, reversing all 3 dummies' piece rotations and horizontal movements for **8 seconds** and resetting `[E] Grid Shift`!

### 4. Support Certification (`SUPPORT`)
**Objective:** Teach players resource conversion and recovery from behind.
* **Step 1 (Survival & Conversion — `[Q] Recycle`):**
  * **Setup:** The player spawns onto a board pre-filled with **18 lines of raw garbage** (critical danger state).
  * **Action:** The UI prompts **`[Q] Recycle`**. Pressing `Q` converts the top 4 garbage lines into usable **Special Blocks** (`Bomb [B]`, `Heavy [W]`, `Multiplier [X]`, `Garbage Eater [G]`), and the player drops a piece to trigger the converted Special Blocks and stabilize the board!
* **Step 2 (Passive — `Tetris Garbage Conversion`):**
  * **Setup:** Pre-stacked 4-row Tetris well in Column 10 + `I`-piece.
  * **Action:** Clear the 4-line Tetris to arm Support's passive (`supportPassiveConversion`), automatically converting the Dummy's next incoming garbage attack into Special Blocks.
* **Step 3 (Offense — `[E] Perfect Clear Bonus`):**
  * **Setup:** The board is set up for an all-clear (4 simple scripted pieces away from an empty grid).
  * **Action:** The player activates **`[E] Perfect Clear Bonus`** (starting the **15-second timer**) and places the scripted pieces to achieve an **All-Clear**, triggering **+4 Bonus Lines** and charging the Ultimate meter to full (`45 / 45 LINES`).
* **Step 4 (Ultimate / The Rescue — `[R] Guardian Angel`):**
  * **Setup:** An **"Ally" Dummy Board** spawns on the right, 18 lines high (one block away from topping out!).
  * **Action:** With the targeting pointer locked onto the Ally Dummy Board, the player activates **`[R] Guardian Angel`**, instantly clearing the ally's **bottom 4 lines** to demonstrate team-saving utility!

---

## Phase 4: UI, Onboarding Integration, & Persistence
* **Menu Routing:** Clicking **Stage 2** in the Tutorial Menu ([modeselect.html](file:///c:/Users/destr/Documents/Cascade-Aurelius/Prototype%20V1/modeselect.html)) opens the **Choose Your Class (Loadout) Modal** ([`ClassSelectModal.ts`](file:///c:/Users/destr/Documents/Cascade-Aurelius/Prototype%20V1/src/ClassSelectModal.ts)) so the player picks which Class Certification to run.
* **Local & Cloud Persistence (Supabase):**
  * Saves per-class completion flags (`basics-stage-2-SPEEDSTER`, `basics-stage-2-TANK`, `basics-stage-2-SABOTEUR`, `basics-stage-2-SUPPORT`) in `localStorage` and syncs them to the signed-in user's Supabase `user_metadata.completed_tutorials`.
  * Stage 2 status in the Tutorial Menu shows `0 / 4 COMPLETED` through `✓ 4 / 4 COMPLETED`.
* **Cosmetic Rewards (`★ CERTIFIED` Badge):**
  * Completing a class certification unlocks a **`★ CERTIFIED`** cosmetic badge displayed on that class's card in the Class Select Modal across all modes (without locking classes in Online Matchmaking).
