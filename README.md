# 🕷️ Laalpari — Jeet Ke Dikhao (Spider-Man Edition)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-Realtime%20PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-Synthesizer-06b6d4?style=for-the-badge)
![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

A fast-paced, high-stakes 3×3 Spider-Man themed browser survival game built with **HTML5, CSS3, Vanilla JavaScript (ES6+), and Supabase Realtime PostgreSQL**.

Zero heavy frameworks, with retro sound synthesis powered by the native **Web Audio API** and instant **College Real-Time Leaderboard sync** across students.

---

## 🌐 Live Demo & Deployment

- **Vercel Production (Live)**: [https://redzombies.vercel.app](https://redzombies.vercel.app)
- **GitHub Repository**: [https://github.com/aditya2438/Redzombies](https://github.com/aditya2438/Redzombies)

---

## 🎮 Game Concept & Rules

In **"Laalpari - Jeet Ke Dikhao"**, you control the electric **Blue Dot (🔵)** inside a high-voltage 3×3 Spider Arena:

1. **Strict 2.0-Second Round Duration**: Every round lasts exactly **2.00 seconds**. A visible digital countdown timer and progress bar drain from 100% to 0%.
2. **7 Red Zones vs 2 Safe Black Zones**: At the start of each round, 7 blocks randomly turn into lethal **Red Zones (✕)** and only 2 blocks turn into **Safe Black Zones (🛡️)**.
3. **0.00s Scanning**: When the 2-second timer hits zero, the arena instantly scans the player's position:
   - **Safe Black Zone**: You survive, gain **+1 Level** and **+1 Point**, and the next round begins!
   - **Red Zone**: Caught in danger! You lose **1 Lifeline**.
4. **3 Spider Lifelines & Prediction Mini-Game**:
   - You start with **3 Spider Lifelines (🕷️)**.
   - **Spider-Sense Prediction Round**: When dropping from 2 to 1 lifeline, the game pauses for a bonus prediction round. Guess 1 of the 9 mystery blocks that will be safe in the upcoming round. If correct, you recover **+1 Lifeline** (back to 2)!
   - **Game Over**: When 0 lifelines remain, the game immediately ends and displays the iconic quote:
     > ***"you cannot crack the developer mind"***
5. **College ID Authentication & Real-Time Leaderboard**:
   - Unique **College ID** login saved locally in `localStorage`.
   - Real-time ranking synchronized across players worldwide via **Supabase PostgreSQL & WebSockets**.

---

## 🕹️ Controls

| Control | Desktop / Laptop Keyboard | Mobile & Tablet Touch |
| :--- | :--- | :--- |
| **Move Up / Down / Left / Right** | `W`/`S`/`A`/`D` or Arrow Keys | Glass D-pad, **Direct Cell Tap**, or **Swipe** |
| **Direct Cell Jump** | Click any grid cell directly | Tap any grid cell directly |
| **Swipe Evasion** | Click & drag on arena | Swipe Up / Down / Left / Right on grid |
| **College Leaderboard** | Click 🏆 Trophy Icon in header | Tap 🏆 Trophy Icon in header |
| **Pause / Resume** | `P` or `Escape` | Tap `⏸` header button |
| **Mute / Unmute** | Click Sound Icon | Tap `🔊` header button |

---

## 🎨 Design & Aesthetic Elements

- **Red & Black Spider-Man Palette**: Obsidian black surfaces (`#020204`, `#07070b`), spider-web textures, glowing neon crimson accents (`#ff0038`, `#e11d48`), and an electric blue player dot (`#00d2ff`).
- **Responsive Layout**: Designed with CSS `clamp()`, `min()`, and `100dvh` for seamless playability across phones, tablets, laptops, and 4K displays.
- **Procedural Audio**: Custom retro synth blips, warning ticks, safe chimes, damage impacts, and fanfare synthesized directly via the Web Audio API without external audio files.
- **Web App Favicon**: Vector SVG icon (`favicon.svg`) featuring the Spider-Man mask with web reticle and electric blue dot.

---

## ☁️ Supabase Real-Time Leaderboard Integration

1. The game connects to Supabase via `supabase_config.js`.
2. High scores and levels are submitted via `upsert` bound to the unique `College ID`.
3. Supabase Realtime WebSockets automatically broadcast ranking updates to all connected devices without page refreshes.
4. If offline, the game gracefully falls back to local storage records.
