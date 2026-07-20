# AI-Driven Tournament Clash Wheels and Inferred Trait Roles Plan

This plan details the design and implementation to transition the tournament matchup mechanics to use AI-generated clash wheels, dynamic segment removal, and AI-inferred trait roles.

## User Review Required

> [!IMPORTANT]
> **AI Matchup Wheels:**
> When starting a tournament match (Fighter A vs Fighter B), we call the AI to generate 6-8 customized clash segments based specifically on their unique abilities, story context, and stats. Each segment represents a narrative interaction (e.g., "Time Slow negates Super Speed").
>
> **Dynamic Segment Removal:**
> When a segment lands during a fight, it is removed from the canvas wheel. The wheel is re-rendered with the remaining segments, altering the odds and ensuring no duplicate events occur in subsequent rounds of the clash.
>
> **AI-Inferred Trait Roles:**
> We replace keyword-based negative wheel detection with AI inference. During character creation/backstory generation, the AI returns a `traitRoles` dictionary classifying each trait as `"positive"` (strength) or `"negative"` (weakness). Weaknesses are subtracted from the tournament power rating automatically.

## Open Questions

None. We are ready to proceed.

---

## Proposed Changes

### 1. AI-Inferred Trait Roles & Power Calculation

#### [MODIFY] [spinPage.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/pages/spinPage.js)
- Update the OpenAI system prompt inside `_generateBackstory` to return a `traitRoles` key in the JSON object:
  - `traitRoles`: An object mapping each rolled trait label to `"positive"` or `"negative"`.
  - Prompt instructions explicitly state that weaknesses/flaws must be classified as `"negative"`.
- Update `_localPowerSystem` (local fallback) to inspect wheel names for weakness/flaw keywords and output a corresponding `traitRoles` mapping.

#### [MODIFY] [rarity.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/utils/rarity.js)
- Add a helper `isNegativeWheel(wheelName)` for the local fallback to map roles deterministically.
- Expose `proceduralFallbackPowerSystem` with the `traitRoles` dictionary output.

#### [MODIFY] [tournamentPage.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/pages/tournamentPage.js)
- Update `computePower(character)`:
  - For each trait, look up its role in `character.powerSystem?.traitRoles`. If classified as `"negative"`, subtract its `getPowerScore` from the total score. Otherwise, add it.

---

### 2. Interactive AI-Generated Matchup Wheels

#### [MODIFY] [tournamentPage.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/pages/tournamentPage.js)
- Replace the instant match resolver with a popup fight modal triggered by clicking "FIGHT!".
- Inside the modal:
  - Render side-by-side fighter headers showing names, scores, and active stats.
  - Call the server or directly call OpenAI (if a key exists) to generate the matchup segments:
    - **Matchup Generation Prompt:** Reads Fighter A's and Fighter B's traits, backstories, and stats, then outputs 6–8 specific clash events. E.g.
      ```json
      {
        "segments": [
          { "label": "Time Slow negates Super Speed", "winner": "b", "points": 20, "combatLog": "B slows time down to a crawl, completely neutralizing A's supersonic run and landing a solid blow." }
        ]
      }
      ```
    - Provide a robust local generator that procedurally mixes their traits to construct 6-8 themed clash events if no API key is available.
  - Mount a `SpinWheel` instance on a local canvas inside the modal using these segments.
  - Each spin lands on a segment, outputs the narrative `combatLog`, awards `points` to the winner, and **removes the landed segment from the wheel**.
  - Re-renders the wheel for the next spin.
  - Decides the winner after 3 rounds or in sudden death (if tied), advances the bracket, and updates the UI.

---

### 3. AI Wheel Prompt Regeneration & Revert

#### [MODIFY] [store.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/utils/store.js)
- Add `regenerateWheelTraits(wheelId, newTraits)` and `revertWheelTraits(wheelId)` store methods.

#### [MODIFY] [builderPage.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/pages/builderPage.js)
- Add `⚡ AI Regen` and `⏪ Revert` buttons to the editor header.
- Connect revert calls to the store and add the AI prompt regeneration modal.

---

### 4. Visibility & Playback Previews

#### [MODIFY] [spinWheel.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/components/spinWheel.js)
- Increase font sizes and thicken contrast pills (`rgba(10,10,15,0.75)`).
- Implement high-contrast black text outlines using canvas `strokeText`.

#### [MODIFY] [SpinningWheel.tsx](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/server/remotion/src/scenes/SpinningWheel.tsx)
- Increase font size fraction and darken segment pills.
- Apply SVG outline properties to `<text>` nodes (`stroke="#000000" strokeWidth="2.5" paintOrder="stroke"`).

#### [MODIFY] [render.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/server/routes/render.js)
- Serve the MP4 directly in the browser unless `?download=1` is specified.

#### [MODIFY] [spinPage.js](file:///c:/Users/jacob/.gemini/antigravity/scratch/wheel-of-fate/src/pages/spinPage.js)
- Embed an autoplaying `<video>` tag inside the export modal once the render job finishes.

---

## Verification Plan

### Automated Tests
- Run `node node_modules\typescript\bin\tsc --noEmit -p remotion\tsconfig.json`.

### Manual Verification
- Verify that a tournament fight generates custom clash interactions, removes segments on landing, updates scores, and displays descriptive combat log narrations.
- Check that weaknesses are subtracted from the power score.
- Test regeneration and reverting in the Builder.
- Verify text outline legibility on the wheel.
- Export a video and play it inside the popup modal.
