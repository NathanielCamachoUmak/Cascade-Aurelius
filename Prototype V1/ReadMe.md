You are an expert game developer specializing in TypeScript, HTML5 Canvas, and highly optimized 2D grid mechanics. 

I am building the single-player foundational prototype for "Block Quartet," a competitive falling-block puzzle game. We are skipping multiplayer networking for now to strictly build and finalize the core Object-Oriented architecture, the Finite State Machine (FSM), and the grid logic.

Please bootstrap a Vite + TypeScript project and build the game using the following strict architectural guidelines and mechanics:

1. ARCHITECTURE & OOP STRUCTURE
Use a modular, Object-Oriented approach. Do not use a heavy physics engine; we require a strict 10x20 2D Array matrix and AABB collision detection. Create the following classes:
- `GameManager`: Controls the main `requestAnimationFrame` loop and the FSM.
- `Grid`: Manages the 10x20 2D array, grid state updates, and O(n) line-clearing logic.
- `Tetromino`: Manages the 7-Bag Randomizer (Fisher-Yates shuffle), piece coordinates, and the Super Rotation System (SRS) with wall-kicks.
- `InputHandler`: Implements a strict Input Buffer to queue rapid keystrokes and prevent dropped inputs during frame drops.
- `ItemManager`: Handles Weighted Random Selection for special blocks and component-based effect dispatching.
- `ScoreManager`: Handles the Non-Linear Scoring math and the Stack-Based Counter with a Decay Timer for combo multipliers.

2. FINITE STATE MACHINE (FSM)
Implement an Expanded FSM in the `GameManager`. The game loop must strictly transition between these states to prevent overlapping logic errors:
- `READY`: Waiting to start.
- `SPAWNING`: Generating the next piece from the 7-Bag.
- `ACTIVE_DROP`: Piece is falling; taking player input.
- `PIECE_LOCK`: AABB collision detected; piece locks into the grid array.
- `RESOLUTION`: Triggers line clearing, calculates non-linear scoring, and dispatches Item block effects.
- `GAME_OVER`: Grid tops out.

3. CORE MECHANICS
- Dynamic Gravity: Implement a floating-point multiplier that scales piece-falling speed based on time survived/lines cleared.
- 7-Bag Randomizer: Ensure fair distribution of the 7 standard tetromino shapes.
- SRS Rotation: Pieces must snap to adjacent valid spaces if rotating against a wall.

4. ROGUELIKE ITEM PROGRESSION (TEST POOL)
Implement a Weighted Random Selection algorithm that occasionally embeds a "Special Block" into a falling Tetromino. When a line containing a Special Block is cleared, trigger its effect. Implement only these 3 for now:
- Bomb Block (Draw a simple bomb icon inside): Instantly clears a 3x3 grid area around itself upon line clear.
- Heavy Block (Draw a simple weight icon inside): When this line is cleared, automatically clear the single line directly beneath it.
- Multiplier Block (Draw an "X" icon inside): Temporarily doubles the non-linear score output for the next 8 seconds.

5. AESTHETICS & RENDERING
- Visual Style: Retro Arcade.
- Theme: High-contrast terminal style. Use a pure black background (#000000) with bright neon green (#00FF00) for grid borders, standard blocks, text, and UI elements. 
- Use HTML5 Canvas API for all rendering to ensure lightweight execution.

Please generate the file structure, the required TypeScript configuration, and the complete code for these interconnected classes to yield a playable single-player prototype.