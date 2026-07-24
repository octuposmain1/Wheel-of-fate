# 🎡 Wheel of Fate ⚔️ — AI RPG Character Generator & Video Export

> 🚧 **WORK IN PROGRESS (WIP)** 🚧
>
> **Wheel of Fate** is an interactive, full-stack RPG character generator powered by weighted rarity physics, AI narrative & stat evaluation, interactive tournament clash wheels, and programmatic video rendering for YouTube Shorts / TikTok.

---

## 🌟 Key Features

### 🎡 1. Canvas Wheel Engine & Dynamic Physics
* **Trigonometric Rendering Engine:** Built with HTML5 Canvas featuring custom radial vertical text layouts, contrast pills, dynamic glows, and collision-tick SFX.
* **Weighted Rarity System:** Custom probability curves drive wheel slice sizes and spin intensity across customizable rarity tiers (*Common*, *Rare*, *Legendary*, *Mythic*, or user-defined tiers).
* **Hover Tooltips & Dynamic Controls:** Inspect slice odds, weights, and labels live on the canvas.

### 🧠 2. AI-Powered Generation & RPG Power System (Groq / OpenAI)
* **⚡ AI Prompt-to-Wheel Generator:** Enter a prompt (e.g., *"Weapons of a cosmic sorcerer"*) to instantly synthesize a full wheel of balanced traits using LLMs.
* **📊 RPG Power Sheet & Synergy Evaluation:** When a character is generated, AI evaluates the combination of rolled traits to calculate combat stats (Strength, Defense, Speed, Energy Flow, Tactics), assign an RPG class/type (e.g., *Ki, Stand, Nen, Chakra*), evaluate synergy tiers ($S$-tier to $C$-tier), and identify positive traits vs. negative flaws.
* **🔒 Privacy-First API Keys:** API keys are stored locally in the user's browser (`localStorage`) and proxied in-memory without being stored on any server. Includes offline fallback generators.

### ⚔️ 3. Tournament Bracket & AI Matchup Clash Wheels
* **Interactive 1v1 Battle Mode:** Pit saved characters against each other in bracket tournaments.
* **AI Duel Clashes:** The AI generates an 8-stage interactive clash wheel based on both fighters' unique backstories and traits.
* **Dynamic Wedge Removal:** As rounds progress, landed clash actions are dynamically removed from the wheel, altering future outcome odds in real time.

### 🎬 4. Programmatic Video Export (Remotion & Express)
* **Automated YouTube Shorts / TikTok Generator:** Converts live 9:16 spin sessions into high-definition MP4 videos using Remotion.
* **Synthetic Web Audio Sound Design:** Server-side tone synthesizer (`toneSynth.js`) generates custom WAV audio effects (ticks, whooshes, landing chimes) synchronized to the video animations.
* **Inline Video Preview:** Play and preview generated videos directly in the browser before downloading.

### 🗄️ 5. Dual Persistence Architecture
* **Hybrid Storage:** Works seamlessly offline with `localStorage`, and automatically syncs to a **PostgreSQL** database when a `DATABASE_URL` is configured.

---

## 🛠️ Tech Stack

* **Frontend:** Vanilla JavaScript (ES Modules), HTML5 Canvas API, Web Audio API, Custom CSS Design System (Glassmorphism, CSS Variables).
* **Backend:** Node.js, Express.js.
* **AI Integration:** Groq API / OpenRouter / OpenAI API.
* **Video Rendering:** Remotion (React-based video rendering engine).
* **Database:** PostgreSQL (with `localStorage` fallback).

---

## 🚀 Quick Start

### Prerequisites
* Node.js (v18+)
* npm

### Running the App

```bash
# Clone the repository
git clone https://github.com/octuposmain1/Wheel-of-fate.git
cd wheel-of-fate/server

# Install dependencies
npm install

# Start the full application (Frontend + API + Video Export)
npm start
```

Visit `http://localhost:4000` in your browser.

> **Note on AI Keys:** Press the `?` icon or click **AI Generate** in the app to connect a free Groq or OpenAI key. If no key is provided, the app seamlessly runs on a built-in offline simulation mode.

---

## 📄 License
Distributed under the [MIT License](LICENSE). Built with passion for high-performance web development.
