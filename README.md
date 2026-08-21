<div align="center">
  <h1>⚔️ Krevathorn</h1>
  <p><strong>A Mobile-First, Offline Roguelike Dungeon Crawler built with Vanilla Web Technologies</strong></p>
  <br>
  <!-- Badges -->
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Canvas_API-FF6600?style=for-the-badge&logo=html5&logoColor=white" alt="Canvas API" />
  <img src="https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" alt="PWA" />
</div>

<br>

## 📜 Overview
**Krevathorn** is a fully offline, mobile-optimized 2D roguelike action RPG. Designed from the ground up using **Vanilla JavaScript and the HTML5 Canvas API**, it features procedural dungeon generation, dynamic difficulty, a deep skill tree, and a custom rendering engine. 

This project demonstrates strong capabilities in **state management, performance optimization (60FPS target on mobile), object pooling, and vanilla web development without frameworks**.

---

## ✨ Key Features

- **📱 Mobile-First PWA:** Fully installable and playable offline with touch-optimized controls and a responsive UI.
- **🗡️ 3 Distinct Playable Classes:** 
  - **Warrior:** High HP, heavy melee damage, fury mechanics.
  - **Rogue:** High mobility, critical hits, poison damage.
  - **Mage:** Area control, spell combos, arcane shielding.
- **🗺️ Procedural Dungeon Generation:** Unique map layouts, hazards, and enemy spawns every run.
- **⚙️ Custom Game Engine:** Built from scratch featuring an entity-component style architecture, collision detection (Spatial Hash), and dynamic lighting.
- **📈 Dynamic Difficulty Adjustment (DDA):** The game adapts to the player's performance in real-time.
- **🎒 Deep RPG Mechanics:** 
  - Skill Tree with specialized branches (52 nodes).
  - Equipment system with rarities (Common to Mythic) and unique affixes.
  - Prestige system for infinite replayability.
  - Lore and Achievement tracking (55 lore fragments, 25 achievements).
- **⚒️ Crafting:** A forge in the merchant shop converts dropped gold into potions and weapon upgrades.
- **🎓 Tutorials:** Quick (~1 min) and Full (~3 min) guided tutorials covering movement, dash, combat, abilities, shop, skill tree, and equipment.
- **🌌 Two Game Modes:** 10-floor Dungeon run and the infinite Abyss.
- **🏕️ Camp & Events:** In-floor events, camp events, and 3 NPCs (Guide, Merchant, Oracle).
- **⛩️ MetaLoja & Relics:** Meta-progression shop (essence economy), 13 relics, pets, and daily challenges (speedrun, one-hit, darkness, tank, and more — modifiers are fully applied).
- **🌍 Trilingual UI:** Portuguese, English, and Spanish — the full game (HUD, logs, content pools) is translated, not just menus.
- **🔊 Procedural Audio (Web Audio API):** Synthesized sound effects and dynamic adaptive music that changes based on the biome and combat state.

---

## 🛠️ Technical Highlights (Under the Hood)

As a portfolio piece, this project highlights several advanced software engineering concepts:

*   **Zero Dependencies:** No external game engines (like Phaser) or UI frameworks (like React/Vue) were used. Everything is custom-built.
*   **Performance Optimization:** 
    *   **Object Pooling:** Reuses bullets and particle objects to prevent garbage collection pauses.
    *   **Offscreen Canvas Rendering:** Caches static layers (like the dungeon floor and lighting) to minimize draw calls per frame.
    *   **Dynamic Resolution Scaling:** Automatically lowers internal resolution if the framerate drops below the target on low-end devices.
*   **State Management & Persistence:** Custom `StorageManager` with versioning, data migration, and a centralized key registry (every localStorage key lives in one place); `SaveSystem` handles mid-run checkpoints with schema migration.
*   **Offline PWA:** A `sw.js` service worker (stale-while-revalidate) makes the game fully playable offline after the first visit.
*   **Procedural Content Generation:** Uses a seeded `Mulberry32` PRNG to ensure reproducible map generation and random events (seeded runs).
*   **Audio Lifecycle Management:** Every synthesized AudioNode is disconnected on completion and the context suspends in background tabs — no node leaks in long sessions.

---

## 🚀 How to Run

Since the game is built with vanilla web technologies, running it is incredibly simple:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/JonJonesBR/Sombras-de-Krevathorn.git
    ```
2.  **Open the file:**
    Simply open `index.html` in any modern web browser.
3.  *(Optional)* For the best experience, serve it through a local development server (e.g., VSCode Live Server or Python's `http.server`). This enables PWA install and the offline service worker — both require `http(s)://` (opening the file directly always works, just without them).

---

## 🎮 Controls

*   **Mobile:** On-screen virtual joysticks (configurable in settings as fixed or floating) and dedicated action buttons.
*   **Desktop:** WASD/Arrows to move, Mouse to aim/shoot (hold to fire), Space for abilities, gamepad support. Input mode auto-adapts between touch, mouse, and gamepad.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
<div align="center">
  <i>Developed by JonJonesBR</i>
</div>
