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

## ▶️ Play Now

**[🎮 Jogar no navegador — Play in the browser](https://jonjonesbr.github.io/Sombras-de-Krevathorn/)**

No install needed. The game installs itself as an offline PWA after the first visit over HTTPS.

<br>

## 📜 Overview
**Krevathorn** is a mobile-optimized 2D roguelike action RPG. Built with **Vanilla JavaScript and the HTML5 Canvas API**, it features procedural dungeon generation, dynamic difficulty, a deep skill tree, and a custom rendering engine. After the first successful online load through HTTPS, its service worker caches the game for offline play.

This project demonstrates strong capabilities in **state management, performance optimization (60FPS target on mobile), object pooling, and vanilla web development without frameworks**.

---

## ✨ Key Features

- **📱 Mobile-First PWA:** Installable and available offline after the game shell has been cached from an HTTPS visit.
- **🗡️ 4 Playable Classes:**
  - **Warrior:** High HP, heavy melee damage, fury mechanics.
  - **Rogue:** High mobility, critical hits, poison damage.
  - **Mage:** Area control, spell combos, arcane shielding.
  - **Elf:** Ranged combat, mobility, and nature abilities. Shares the Rogue's weapon table by design — the two are mechanically interchangeable at range, and a separate table would be balance guesswork without playtest data behind it.
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
- **🌍 Three interface languages:** Portuguese, English, and Spanish cover the interface, most gameplay text, and all 55 lore entries.
- **🔊 Procedural Audio (Web Audio API):** Synthesized sound effects and dynamic adaptive music that changes based on the biome and combat state.

---

## 🛠️ Technical Highlights (Under the Hood)

As a portfolio piece, this project highlights several advanced software engineering concepts:

*   **No runtime dependencies:** The game uses no external engine or UI framework. Playwright is a development-only dependency for browser regression tests, which run in Chromium, Firefox, and WebKit.
*   **Performance Optimization:** 
    *   **Object Pooling:** Reuses bullets and particle objects to prevent garbage collection pauses.
    *   **Offscreen Canvas Rendering:** Caches static layers (like the dungeon floor and lighting) to minimize draw calls per frame.
    *   **Dynamic Resolution Scaling:** Automatically lowers internal resolution if the framerate drops below the target on low-end devices.
*   **State Management & Persistence:** Custom `StorageManager` with versioning, data migration, and a centralized key registry (every localStorage key lives in one place); `SaveSystem` handles mid-run checkpoints with schema migration.
*   **Offline PWA:** A `sw.js` service worker caches the game shell for offline navigation after the first successful online load through HTTPS.
*   **Procedural Content Generation:** Uses a seeded `Mulberry32` PRNG to ensure reproducible map generation and random events (seeded runs).
*   **Audio Lifecycle Management:** Synthesized audio is managed with the Web Audio API and respects background tab visibility.

---

## 🚀 How to Run

Since the game is built with vanilla web technologies, running it is incredibly simple:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/JonJonesBR/Sombras-de-Krevathorn.git
    ```
2.  **Open the file:**
    Open `index.html` in a modern browser.
3.  *(Optional)* For the best experience, serve it through a local development server (e.g., VSCode Live Server or Python's `http.server`). This enables PWA install and the offline service worker — both require `http(s)://` (opening the file directly always works, just without them).

The game is a single self-contained `index.html` plus a `sw.js` service worker — no build step, no runtime dependencies. This repository intentionally contains only the files GitHub Pages serves; development tooling (tests, CI, linting) lives outside the repo.

---

## 🎮 Controls

*   **Mobile:** On-screen virtual joysticks (configurable in settings as fixed or floating) and dedicated action buttons.
*   **Desktop keyboard/mouse:** WASD or Arrow keys to move, hold the left mouse button to aim and fire, Space to use the class ability, Shift to dodge, and Escape to close panels.
*   **Gamepad:** Left stick to move, right stick to aim/fire, A/× for the class ability, B/○ to dodge, and Start/Menu to pause. All three can be rebound to any of the 17 standard buttons in **Settings → Gamepad** (pick from the dropdown, or press *Remap* and hit the button you want), and the mapping is saved with your other settings. Picking a button another action already uses swaps the two, so no action can become unreachable. The tutorial quotes your current bindings.

The daily leaderboard is stored on the device; there is no online leaderboard or telemetry.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
<div align="center">
  <i>Developed by JonJonesBR</i>
</div>
