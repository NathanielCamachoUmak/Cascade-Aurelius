# 🟩 Cascade

> **A Competitive Multiplayer Puzzle Game Featuring Proximity-Based Sabotage and Roguelike Item Progression.**

![Cascade Banner](https://github.com/NathanielCamachoUmak/Cascade-Aurelius/blob/main/Prototype%20V1/Blockquartet%20blurry.png)

*Cascade* is a web-based, 4-player competitive falling-block puzzle game. Originally developed as a Computer Science research thesis, the engine bridges the gap between classic grid-based mastery and modern, high-variance social gaming through asymmetric player classes, deterministic state synchronization, and heavily optimized algorithmic design.

---

## ✨ Key Features

* **Battle Royale Staggered Elimination:** Dynamic match pacing where players compete in timed rounds. At the end of each round, the lowest-scoring player is culled until only one remains. Includes intermission overlays, round timers, and automatic bot-fill for missing slots.
* **Asymmetric Player Classes:** Choose your strategic identity before the match.
  * ⚡ **Speedster:** High APM, faster gravity, multiplied ultimate charge.
  * 🛡️ **Tank:** Passive mitigation against incoming garbage lines.
  * 🐍 **Saboteur:** Disables and freezes opponent grids with targeted debuffs.
* **Proximity-Based Sabotage:** Utilize a $O(1)$ Circular Linked List targeting system to aim Event-Driven Garbage lines at specific opponents.
* **Roguelike Item Progression (Loot Blocks):** Governed by a Weighted Random Selection algorithm, special blocks (Bombs, Multipliers, Heavy Weights) spawn to introduce controlled, fair variance. Multiplier stacking introduces deep strategic play in later rounds.
* **Autonomous AI Opponents:** Includes a built-in Utility-Based Heuristic AI (Dellacherie model) that simulates millions of board states per second for tutorial matches and auto-filling lobbies.
* **Deterministic Netcode:** Built for low-bandwidth environments utilizing a Shared RNG Seed and an Event-Driven architecture to eliminate "rubber-banding."

---

## 🛠️ Tech Stack

**Frontend (Client)**
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Build Tool:** [Vite](https://vitejs.dev/)
* **Rendering:** Raw HTML5 Canvas API (Strict 95% FPS Floor target)
* **UI Overlay:** [Tailwind CSS](https://tailwindcss.com/) & HTML

**Backend (Server)**
* **Runtime:** [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
* **Real-time Networking:** [Socket.IO](https://socket.io/)
* **Database & Authentication:** [Supabase](https://supabase.com/) (PostgreSQL)

---

## 🧠 System Architecture

*Cascade* rejects heavy physics engines in favor of strict, lightweight algorithmic gatekeeping:
* **Expanded Finite State Machine (FSM):** Prevents overlapping ability glitches and manages complex multiplayer cooldowns.
* **Super Rotation System (SRS):** Mathematically accurate wall-kicks and matrix transformations.
* **Input Buffer:** Queues rapid keystrokes to ensure zero dropped inputs during network fluctuations or high cognitive load.
* **Axis-Aligned Bounding Box (AABB):** Optimized $O(1)$ collision detection for real-time 4-player grids.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v18+) and [npm](https://www.npmjs.com/) installed on your machine. You will also need a [Supabase](https://supabase.com/) project set up for database and authentication services.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/NathanielCamachoUmak/Cascade-Aurelius.git
   cd Cascade-Aurelius
   ```

2. **Install Frontend Dependencies:**
   ```bash
   cd "Prototype V1"
   npm install
   ```

3. **Install Backend Dependencies:**
   ```bash
   cd "Prototype V1/Server"
   npm install
   ```

4. **Environment Setup:**
   Create a `.env` file in `Prototype V1` with your Supabase credentials, and another `.env` in `Prototype V1/Server` if required:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### Running the Game Locally

1. **Start the Backend Server:**
   ```bash
   cd "Prototype V1/Server"
   npm run dev
   ```

2. **Start the Frontend Vite Client:**
   Open a new terminal window:
   ```bash
   cd "Prototype V1"
   npm run dev
   ```

3. **Open your browser and navigate to the provided local URL (usually `http://localhost:5173`).**

---

## 📖 Research & Documentation
This project was developed in adherence to strict software engineering pipelines (Input-Process-Output framework).

For a deep dive into the algorithmic benchmarking, neuroscientific pacing strategies, and mathematical DDA (Dynamic Difficulty Adjustment) models used in this game, please refer to our published Review of Related Literature & Methodology documentation (available upon request).

---

## 👥 Proponents / Development Team
* Felam Life Banhao
* Elisha Cyrene Benitez
* Kenichi Lei Calica
* Roberto Nathaniel Camacho
