# Wheel of Fate — Task List

## Phase 1: Bootstrap & Core UI

### Project Setup
- [x] Bootstrap project (vanilla ES modules — no build step needed)
- [x] Set up global CSS design system (dark neon theme, fonts, variables)

### Store & Utilities
- [x] `rarity.js` — weighted RNG engine
- [x] `audio.js` — Web Audio API click SFX
- [x] `store.js` — global state with localStorage persistence
- [x] `router.js` — hash-based SPA router

### Components
- [x] `spinWheel.js` — Canvas-based animated wheel with neon segments
- [x] `navbar.js` — Navigation header
- [x] `toast.js` — Toast notifications + modal system

### Pages
- [x] `homePage.js` — Dashboard / landing with stats and rarity legend
- [x] `builderPage.js` — Full CRUD UI for wheels and traits (drag-drop, rarity, icons)
- [x] `spinPage.js` — 9:16 spin session view with sequential wheel spinning
- [x] `charactersPage.js` — Character library with rename/delete

### Final Wiring
- [x] App routing (main.js)
- [x] Default wheel templates (Race, Bloodline, Special Power, Fatal Weakness)
- [x] Bug fix: saveCharacter passes traits/backstory directly (no active session required)

## Phase 2: Backend & Advanced Features
- [x] OpenAI backstory generation (wired with API key entry via `?` shortcut)
- [x] Remotion video export pipeline (Express + Remotion server, async render-job queue)
- [x] Tournament bracket mode (`tournamentPage.js`)
- [x] PostgreSQL backend (api-first store with localStorage fallback, one-time migration)

## Phase 3: Editable & Addable Rarity Tiers
- [x] Data model: `rarityTiers` in `store.js` with stable `id` + editable `label/weight/color/icon`
- [x] Derivation formula (`getTierIntensity`) replacing ~8 hardcoded per-rarity tables project-wide
- [x] Bounded lerp outputs for spin duration, tournament power, audio frequency, "dramatic" threshold
- [x] "🏷️ Manage Rarities" UI in Builder page (add/edit/delete tiers, guard delete if in use)
- [x] Backend CRUD (`server/routes/rarityTiers.js`, `rarity_tiers` table, dropped old `CHECK` constraint)
- [x] Remotion simplified to accept `color`/`intensity` directly instead of its own rarity table

## Phase 4: Bugfixes — Spin Video & Rarity Bugs
- [x] Export video now shows the actual wheel spinning (`SpinningWheel.tsx` Remotion scene) before the reveal/summary cards
  - [x] User has verified this in a live browser export at `localhost:4000` — confirmed working, but flagged missing audio and segment labels (see Phase 5)
- [x] Fixed wheel pointer/segment visual misalignment (`spinWheel.js` — pointer is on the right edge per `main.css`, not the top)
  - [x] User has verified the wheel now lands on the correct segment
- [x] Confirmed new/edited rarity tiers affect spin odds correctly (was the same root cause as the alignment bug — RNG was always correct, only the visual landing was off)
  - [x] User has verified a custom tier now visibly affects spin behavior
- [x] New rarity tiers now default to a colored-circle icon matching their color instead of `❔` (`builderPage.js`)
  - [x] User re-tested and found the fix didn't cover *already-created* tiers ("bonb" still showed ❔) — real bug, root-caused and fixed in Phase 5

## Phase 5: Video Audio/Labels, Rarity Data Migration, UI Polish
- [x] Synthesized whoosh/tick/landing-tone audio for the export video (`server/services/toneSynth.js`, WAV synthesis ported from `src/utils/audio.js`'s Web Audio design) — verified an AAC audio stream is present in a real rendered MP4
- [x] Segment name labels now render on the spinning wheel in the export video (`SpinningWheel.tsx`), mirroring the live canvas wheel's label placement — verified visually via an extracted frame
- [x] Fixed the real root cause of the icon bug: it was stale *data*, not a broken fix — added `pickCircleIcon()` (nearest color-circle match) and a one-time migration for any tier still carrying the old `❔` placeholder (`store.js`)
- [x] Delete (✕) buttons on in-use rarity tiers replaced with a visible "Used by N traits" label instead of a silently-disabled button, so the guard is self-explanatory instead of looking broken
- [x] Targeted cleanup: moved the Manage Rarities panel's inline style soup into CSS classes (`main.css`), removed the now-redundant `NEW_TIER_ICONS` array
- [x] Fixed a Remotion bundler bug found during verification: `bundle()` was silently failing to copy `server/remotion/public/` because it resolves its root via the nearest `package.json` (lands on `server/`, not `server/remotion/`) — now passes `publicDir` explicitly

## Phase 6: Wheel Readability, Hover Tooltip & Rarity Circle-as-Color
- [x] Contrast pill behind wheel segment labels + larger minimum font (`spinWheel.js`)
- [x] Hover-to-see-full-name tooltip on the live wheel (only when not spinning), fixed-positioned so it can't be clipped by the 9:16 frame's `overflow:hidden`
- [x] Rarity "icon" character concept removed from display everywhere — every rarity indicator (badges, dropdowns, Manage Rarities, character cards, Remotion `RarityBadge`) is now a plain circle/dot derived directly from `tier.color`, so it can never drift from the color picker
- [x] Rarity tiers can actually be deleted now — the delete button was being hidden whenever any trait used a tier (which, given the default templates, was always); it's now always shown, with a warning confirm that explains affected traits will show as "Unknown Rarity" (the pre-existing safe fallback) until reassigned

## Phase 7: Fix Live Spin Landing Bug, Add Landing Pause, Match Video Wheel to Live Wheel
- [x] Fixed a real bug in `spinWheel.js`'s `spin()`: `fullSpins` used a continuous random multiplier instead of an integer turn count, so the wheel landed at a random offset from the intended winner on nearly every spin (separate from, and in addition to, the pointer-offset bug fixed earlier) — now always an exact multiple of 2π
- [x] Landing pause added both live (`spinPage.js`, 900ms hold before advancing) and in the export video (`SPIN_HOLD_FRAMES` in `theme.ts`, wheel holds its landed position for 15 frames before cutting to the reveal card)
- [x] Export video's wheel now visually matches the live canvas wheel exactly: radial gradient fills, the same fixed neon palette for common segments (real tier color reserved for dramatic/rare ones), dramatic-segment glow outline, outer ring glow, and the same label contrast pill/font floor — verified via extracted frames from a real render

## Phase 8 (Future)
- [ ] Nothing currently planned — add here before starting new work
