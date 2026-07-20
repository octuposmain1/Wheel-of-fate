# Wheel of Fate — Complete Walkthrough 🎡

## How to Run

Two servers exist for two different purposes — use the right one:

```
# Full app (static files + API + video export) — use this for anything backend-related
cd wheel-of-fate/server
npm install
npm start
# → http://localhost:4000

# Frontend-only static server (no API, no video export)
npx serve wheel-of-fate -p 5500
# → http://localhost:5500
```

> [!IMPORTANT]
> ES modules require a real HTTP server — opening `index.html` directly via `file://` in Chrome will fail with a CORS error on the `<script type="module">` tag. Always serve it.

> [!NOTE]
> Without a `DATABASE_URL` set, the server logs "running with localStorage-only persistence" and video export still works — Postgres is optional, not required.

---

## What Was Built

### File Structure
```
wheel-of-fate/
├── index.html
├── task.md / implementation_plan.md / walkthrough.md   # you are here
├── src/
│   ├── main.js                   # Router + page lifecycle
│   ├── styles/main.css
│   ├── utils/
│   │   ├── rarity.js             # Weighted RNG + tier-derivation formulas
│   │   ├── store.js              # API-first state, localStorage fallback
│   │   ├── api.js                # Backend API client
│   │   ├── audio.js              # Web Audio SFX, derived from tier intensity
│   │   └── router.js
│   ├── components/
│   │   ├── spinWheel.js          # Canvas wheel engine
│   │   ├── navbar.js
│   │   └── toast.js
│   └── pages/
│       ├── homePage.js, builderPage.js, spinPage.js
│       ├── charactersPage.js, tournamentPage.js
│ └── server/
│     ├── index.js                  # Express: static files + /api/*
│     ├── routes/                   # wheels, characters, rarityTiers, render
│     ├── services/                 # renderQueue, remotionRunner, toneSynth (WAV synthesis)
│     ├── db/                       # schema.sql, migrate.js
│     └── remotion/
│         ├── public/audio/generated/  # lazily-populated tone bank (gitignored)
│         └── src/                     # CharacterReveal, SpinningWheel, SummaryCard, TraitReveal
```

### 🏠 Home / 🎡 Builder / ⚡ Spin / 📜 Characters (Phase 1)
Core UI, canvas wheel physics, weighted RNG, rarity legend, drag-drop trait editor, 9:16 spin session, character library — all as originally planned.

### 🧠 Backstory, 🎬 Video Export, 🏆 Tournament, 🗄️ Postgres (Phase 2)
- AI backstory via OpenAI (press `?` to add a key) or a local generator without one.
- **Export as Short**: sends the full spin session to the Express/Remotion backend, which renders a 9:16 MP4 (intro card → per-trait spin + reveal → summary card) via an async render-job queue.
- Tournament bracket mode pits saved characters against each other using rarity-derived power scores.
- Wheels, characters, and rarity tiers all persist to Postgres when configured, with localStorage as a transparent fallback and a one-time migration on first load.

### 🏷️ Editable & Addable Rarity Tiers (Phase 3)
Rarity tiers (previously a hardcoded 4-key `Common/Rare/Legendary/Mythic`) are now full user data: rename, recolor, re-icon, reweight, add, or delete tiers from a "Manage Rarities" panel in the Builder. A single weight-ranked `intensity` formula drives spin duration, tournament power, audio drama, and visual "dramatic" effects for *any* tier — including brand-new ones — with bounded output ranges so extreme weights can't break the pacing.

### 🐛 Fixes (Phase 4)
1. **Export video now shows the actual spin**, not just static reveal cards — a new `SpinningWheel.tsx` Remotion scene animates the full wheel to a stop on the real winner before each trait reveal.
2. **Wheel landing position fixed**: the physical pointer sits on the wheel's right edge (per `main.css`), but the canvas drawing code assumed it was at the top — a fixed quarter-turn error. Fixed in `spinWheel.js`.
3. **New rarity tiers now correctly affect spin odds** — this turned out to be the same bug as #2: the RNG/weighting was already correct, only the *visual* landing was wrong, which made it look like weight had no effect.
4. **New tier icon** now defaults to a colored circle matching the tier's color instead of a `❔`.

### 🔊 Video Audio, Labels & Data Fixes (Phase 5)
1. **The export video now has sound.** Added `server/services/toneSynth.js`, which synthesizes the exact whoosh/tick/landing-chime sound design already used live (`src/utils/audio.js`) as plain WAV files.
2. **Segment names now appear on the spinning wheel itself**, not just after it lands — `SpinningWheel.tsx` was drawing colored wedges with no text at all, unlike the live canvas wheel.
3. **The rarity tier icon fix retroactively applied** to pre-existing tiers via migrations.
4. **Delete (✕) buttons** are enabled appropriately with detailed labels when used.
5. **Targeted cleanup of Manage Rarities panel's inline styles into real classes.**

### 🎯 Wheel Readability, Hover Tooltip & Rarity-as-Color (Phase 6)
1. **Wheel labels are easier to read**: a dark contrast pill now sits behind each segment's text, and the minimum font size was raised.
2. **Hover a wedge to see its full name**: on the live wheel (when it isn't spinning), hovering shows a tooltip with the untruncated label, rarity, and weight%.
3. **Rarity circles rendered dynamically from color** preventing drifts.

### 🎯 Spin Landing Bug, Landing Pause, Video/Live Visual Parity (Phase 7)
1. **Landing offset bugs resolved** using precise turn integer logic.
2. **Wheel pause on land** added for pacing parity.
3. **Visual Parity updates** for gradients, glows, and contrast pills in Remotion.

### 🎯 Vertical Radial Wheel Text & Premium Visuals (Phase 8)
1. **Vertical/Radial Text Layout:** canvas rotating matches mid-angles with comfortable auto-flipping on the left half to support 2.5x longer traits without clipping.
2. **Ambient Glowing Canvas:** neon dynamic background float blobs.

### 🧠 Combined AI Backstory, Detailed RPG Power Systems & AI Wheel Generation (Phase 9)
1. **Combined AI Backstory & RPG Power System Evaluation:**
   - Unified character backstory generation with an AI evaluation of combat synergies in [spinPage.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/pages/spinPage.js). The model analyzes the character's rolled traits and assigns a thematic power system (e.g. Nen, Chakra, Ki, Stand Powers), a class/type, a synergy rating (S-Tier to C-Tier), a detailed rating explanation, and numeric stats (Combat Power, Strength, Defense, Speed, Energy Flow, Tactics).
   - Created a shared, deterministic procedural generator `proceduralFallbackPowerSystem` in [rarity.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/utils/rarity.js) to serve as a robust local fallback when offline or no API key is set.
2. **Glassmorphic RPG Stats Sheet & Card Tabs:**
   - Implemented a premium glassmorphic RPG Stats Sheet featuring custom colored progress bars and detailed synergy badges.
   - Designed an interactive tab switcher (**TRAITS** vs **POWER SHEET**) inside the Completed Character Card on the Spin page. This lets the user toggle between their raw traits and their AI evaluation dynamically, keeping the 9:16 layout clean and compact.
3. **Library Directory Modals & Legacy Upgrades:**
   - Displayed power system summaries directly on cards inside the Character Library in [charactersPage.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/pages/charactersPage.js).
   - Added a "📊 View RPG Power Sheet" button to open the full stats sheet in a popup modal. Handles backward compatibility: clicking the sheet for any pre-existing legacy character dynamically calculates, saves, and syncs their RPG stats on the fly.
4. **AI-Powered Wheel Generation:**
   - Added a secondary `⚡ AI Generate` button on the Builder sidebar in [builderPage.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/pages/builderPage.js).
   - Implemented a generation modal that takes a custom user prompt (e.g. "Weapons of a cosmic sorcerer") and prompts OpenAI to generate a wheel name, emoji icon, and list of traits/rarities.
   - Built keyword-matching fallback template presets (Cyberware, Magic Spells, Steampunk Weapons) to guarantee creative, immediate generation when offline.
   - Generated wheels are added directly as native wheels, keeping them fully editable, customizable, and deletable individually.
5. **Tournament Stat Integrations:**
   - Updated `computePower` in [tournamentPage.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/pages/tournamentPage.js) to utilize the AI-evaluated `combatPower` directly in bracket simulations when available, falling back to rarity-derived sums otherwise.
6. **State & Database Persistence:**
   - Updated `schema.sql` and character endpoints in [characters.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/server/routes/characters.js) to persist `power_system` JSON strings, and extended [store.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/utils/store.js) to serialize the values locally and in background API syncs.
   - Ran compilation checks confirming zero TypeScript errors and successful parity bundles.

---

### ⚔️ AI Duel Clash Wheels, Weakness Deductions, Outlines & Inline Streaming (Phase 10)
1. **Interactive AI Matchup Clash Wheels & Log:**
   - Tournament matches are now interactive combat clashes! Clicking "FIGHT!" opens a custom modal containing a matchup wheel generated on-the-fly.
   - The AI reads BOTH fighters' traits, backstories, and stats, generating **8 customized clash interactions** (e.g., `"Time Slow counters Super Speed"`).
   - Each spin lands on an action, writes a detailed narrative description to the combat log, and updates the scoreboards.
   - **Dynamic Segment Removal:** Landing on a matchup segment removes it from the wheel and re-renders the remaining wedges, changing the odds for subsequent rounds. Best-of-3 rounds (or sudden death if tied) decides the victor.
   - Built a robust deterministic local fallback pairing random traits with power-derived outcomes when offline or without an API key.
2. **AI-Inferred Trait Roles (Weakness Deductions):**
   - OpenAI now yields a `traitRoles` map classifying each rolled trait as `"positive"` (adds power) or `"negative"` (weakness, penalizes combat power).
   - Modified `computePower` in [tournamentPage.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/pages/tournamentPage.js) to subtract the power score of traits marked negative by the AI or belonging to legacy weakness/flaw wheels.
3. **AI Wheel Prompt Regeneration & Reverts:**
   - Added `⚡ AI Regen` and `⏪ Revert` buttons to the Builder editor header.
   - Regenerating a wheel backs up its current traits list. Clicking `⏪ Revert` immediately restores the backup and synchronizes the changes back to the database.
4. **Enhanced Segment Label Visibility:**
   - Raised the wheel label minimum font sizes and darkened background pills to `rgba(10,10,15,0.75)`.
   - Implemented high-contrast text outlines in both the live app (via canvas `strokeText`) and Remotion videos (via SVG text stroke properties).
5. **In-Browser Video Playback:**
   - Added a query parameter `?download=1` switch in [render.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/server/routes/render.js). This allows inline streaming in the browser.
   - Export modals now embed an autoplaying `<video>` preview so users can play and check their clip in-browser before downloading.
