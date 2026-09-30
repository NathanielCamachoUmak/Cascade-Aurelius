# Cascade-Aurelius — Classes, Abilities & Special Blocks

This document lists all playable classes, their passives, active abilities (`[Q]`, `[E]`), and ultimates (`[R]`), along with the Special Blocks system.

---

## 1. Speedster (`SPEEDSTER`)
*Tagline: "Built for fast, technical play."*

| Slot | Name | Cooldown / Cost | Target | Effect |
| :--- | :--- | :--- | :--- | :--- |
| **Passive** | **Speed Block Guarantee** | Tetris (4-line clear) | Self | Clearing a Tetris guarantees a **Speed Block (`V`)** on your next piece *(slows drop speed by 25% when cleared)*. |
| **`[Q]`** | **Sprint** | 10s–12s Cooldown | Targeted Opponent | Causes the targeted opponent's **current active piece and next 3 pieces** to drop **50% faster**. |
| **`[E]`** | **Time Warp** | 15s Cooldown | Self | Slows your own piece drop speed by **50%** for **6 seconds**. |
| **`[R]`** | **Bullet Time** | **40 Lines** | All Opponents | Freezes **all opponents** in place (`QUICKSILVER` effect) for **5 seconds** while you continue playing normally. |

---

## 2. Sentinel (`TANK`)
*Tagline: "Built to take a hit."*

| Slot | Name | Cooldown / Cost | Target | Effect |
| :--- | :--- | :--- | :--- | :--- |
| **Passive** | **Shield Block Guarantee** | Tetris (4-line clear) | Self | Clearing a Tetris guarantees a **Shield Block (`S`)** on your next piece *(blocks the next incoming garbage attack when cleared)*. |
| **`[Q]`** | **Fortify** | 10s Cooldown | Self | Grants **2 charges** that completely ignore/block the next **2 incoming garbage attacks**. |
| **`[E]`** | **Counter Strike** | 15s–20s Cooldown | Self | Arms a reflector that bounces the **next incoming garbage attack** back to the sender. |
| **`[R]`** | **Earthquake** | **50 Lines** | All Opponents | Sends **4 lines of garbage** to **every opponent**. |

---

## 3. Saboteur (`SABOTEUR`)
*Tagline: "Plays the long game."*

| Slot | Name | Cooldown / Cost | Target | Effect |
| :--- | :--- | :--- | :--- | :--- |
| **Passive** | **Freeze Block Guarantee** | Tetris (4-line clear) | Self | Clearing a Tetris guarantees a **Freeze Block (`F`)** on your next piece *(locks opponents' abilities for 3 seconds when cleared)*. |
| **`[Q]`** | **Scramble** | 10s–12s Cooldown | Targeted Opponent | Randomizes/scrambles the targeted opponent's **next 5 upcoming pieces**. |
| **`[E]`** | **Grid Shift** | **Once per match** | Targeted Opponent | Shifts the targeted opponent's entire grid **2 columns left or right** (wrapping around). Only usable once per match unless reset by Chaos Mode. |
| **`[R]`** | **Chaos Mode** | **35 Lines** | All Opponents + Self | Reverses **every opponent's left/right movement and rotation controls** for **8 seconds** **AND resets your `[E]` Grid Shift** use. |

---

## 4. Support (`SUPPORT`)
*Tagline: "Turns pressure into recovery."*

| Slot | Name | Cooldown / Cost | Target | Effect |
| :--- | :--- | :--- | :--- | :--- |
| **Passive** | **Garbage Conversion** | Tetris (4-line clear) | Self | Clearing a Tetris arms your board so the **next incoming garbage attack** is automatically converted into **Special Blocks**. |
| **`[Q]`** | **Recycle** | 10s Cooldown | Self or Targeted Ally (3v3 TDM) | Converts up to **4 existing garbage lines** into **Special Blocks** (or arms conversion for incoming garbage if fewer than 4 are on the board). Can target **allies in 3v3 Team Deathmatch** (or defaults to yourself). |
| **`[E]`** | **Gold Drop** | 25s Cooldown | Self | Your **next tetromino** is made entirely out of **4 different Special Item Blocks** (every block of the tetromino is a unique item block). |
| **`[R]`** | **Guardian Angel** | **45 Lines** | Self or Ally (3v3 TDM) | Clears the **bottom 4 lines** of your board, or a **targeted ally's board** in 3v3 Team Deathmatch (automatically picks the most endangered ally if none is targeted). |

---

## Special Blocks Reference

| Block Type | Letter | Effect When Cleared in a Line |
| :--- | :---: | :--- |
| **Bomb (`BOMB`)** | `B` | Explodes and clears a surrounding area centered on the cleared row. |
| **Heavy (`HEAVY`)** | `W` | Crushes and destroys the row directly beneath the cleared line before the board compacts. |
| **Multiplier (`MULTIPLIER`)** | `X` | Activates a **2x score multiplier** for a duration. |
| **Speed (`SPEED`)** | `V` | **Slows down** your piece drop rate by **25%** (`dropInterval * 1.25`). |
| **Shield (`SHIELD`)** | `S` | Activates a shield that blocks the next incoming garbage attack. |
| **Freeze (`FREEZE`)** | `F` | Freezes all opponents' abilities (`[Q]`, `[E]`, `[R]`) for **3 seconds**. |
| **Garbage Eater (`GARBAGE_EATER`)** | `G` | Immediately removes **1 garbage line** from the bottom of your board. |
