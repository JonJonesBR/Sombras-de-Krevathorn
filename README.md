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
  - Skill Tree with specialized branches.
  - Equipment system with rarities (Common to Mythic) and unique affixes.
  - Prestige system for infinite replayability.
  - Lore and Achievement tracking.
- **🔊 Procedural Audio (Web Audio API):** Synthesized sound effects and dynamic adaptive music that changes based on the biome and combat state.

---

## 🛠️ Technical Highlights (Under the Hood)

As a portfolio piece, this project highlights several advanced software engineering concepts:

*   **Zero Dependencies:** No external game engines (like Phaser) or UI frameworks (like React/Vue) were used. Everything is custom-built.
*   **Performance Optimization:** 
    *   **Object Pooling:** Reuses bullets and particle objects to prevent garbage collection pauses.
    *   **Offscreen Canvas Rendering:** Caches static layers (like the dungeon floor and lighting) to minimize draw calls per frame.
    *   **Dynamic Resolution Scaling:** Automatically lowers internal resolution if the framerate drops below the target on low-end devices.
*   **State Management & Persistence:** Custom `StorageManager` with versioning and data migration to handle save states, statistics, and settings across sessions.
*   **Procedural Content Generation:** Uses a seeded `Mulberry32` PRNG to ensure reproducible map generation and random events.

---

## 🚀 How to Run

Since the game is built with vanilla web technologies, running it is incredibly simple:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/jonjonesbr/krevathorn.git
    ```
2.  **Open the file:**
    Simply open `index.html` in any modern web browser.
3.  *(Optional)* For the best experience, serve it through a local development server (e.g., VSCode Live Server or Python's `http.server`) to ensure PWA service workers function correctly.

---

## 🎮 Controls

*   **Mobile:** On-screen virtual joysticks (configurable in settings as fixed or floating) and dedicated action buttons.
*   **Desktop:** (If applicable) WASD/Arrows to move, Mouse to aim/shoot, Space/Keys for abilities. *(Note: Primarily touch-optimized).*

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
<div align="center">
  <i>Developed by JonJonesBR</i>
</div>
