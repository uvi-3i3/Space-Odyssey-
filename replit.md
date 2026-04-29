# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Contains a Space Odyssey mobile game (Expo) plus shared API server and mockup sandbox.

## Artifacts

- **space-odyssey** (`artifacts/space-odyssey/`) — Expo mobile idle RPG game
- **api-server** (`artifacts/api-server/`) — Express API server (shared backend)
- **mockup-sandbox** (`artifacts/mockup-sandbox/`) — UI prototyping sandbox

## Space Odyssey: Galactic Evolution

Mobile-first idle RPG where you guide a civilization through planetary exploration, element mining, building construction, technology research, combat, and narrative events.

### Features
- **7 Navigation Tabs**: Planet, Base, Tech, Events, Combat, Awards, Command
- **Blueprint Aesthetic**: Royal blue (#0A1628) background + grid pattern
- **Element System**: 16+ elements with rarity tiers (common → legendary)
- **Mining System**: 3 mining types (Safe, Aggressive, Deep Core) across 8 planet zones
- **Building System**: 8 building types with upgrade system
- **Tech Tree**: 10+ technologies across 3 eras
- **Deep Space Events**: Pre-generated branching campaign tree (5 chapters, 68 nodes, 2 choices each, ≥60% unique branches) read locally from `constants/storyData.ts` — no runtime network call.
- **Combat System**: Turn-based fleet battles with 3 strategies
- **Espionage System**: 4 mission types with varying success rates
- **3 Factions**: Zorathi, Krenn, Vael with reputation system
- **Achievement System**: 10 achievements with rarity tiers
- **Daily Rewards**: 7-day streak system
- **Prestige System**: Reset for permanent multipliers
- **Offline Progress**: Idle resource generation while away
- **Persistence**: AsyncStorage-based save system

### Deep Space Events Pipeline (Phase 5)
- **Generated once, shipped flat.** A one-shot script (`scripts/src/generateStoryTree.ts`) calls Gemini (preferred), the Replit OpenAI integration, or a raw `OPENAI_API_KEY` and writes the entire branching campaign to `artifacts/space-odyssey/constants/storyData.ts`. Per-chapter responses are cached under `scripts/.cache/storytree/` so reruns are instant.
- **Run with**: `pnpm --filter @workspace/scripts run generate:story` (set `GEMINI_API_KEY`, or use the OpenAI integration, or `OPENAI_API_KEY`). Add `--force` to ignore the cache.
- **Validator** enforces 2 choices per node, ≥60% unique branches per chapter, valid building/element/faction ids, and clamps every effect into the safe ranges.
- **Runtime**: `GameContext` reads `STORY_TREE.nodesById[state.currentStoryNodeId]` — no network call. `resolveEvent` applies the rich `StoryEffects` (resources, stability, population, defense, faction reputations, building level deltas) via `setState(prev => ...)` and advances `currentStoryNodeId` to the chosen branch's `nextNodeId` (or `'END'`).
- **No "AI" copy in the UI** — the screen is now "Deep Space Events" with a "LIVE FEED" badge and per-choice effect chips (resources, faction reps, stability, population, defense, building deltas). A translucent dim overlay fades in behind the cards when a transmission is active.
- The legacy `app/api/generate-event+api.ts` route has been removed. The legacy `NARRATIVE_EVENTS` array is retained in `gameData.ts` only as a type/example reference and is no longer surfaced.

### Key Files
- `artifacts/space-odyssey/context/GameContext.tsx` — Core game state + all game logic
- `artifacts/space-odyssey/constants/gameData.ts` — All game data (elements, buildings, techs, events, factions)
- `artifacts/space-odyssey/constants/colors.ts` — Blueprint theme colors
- `artifacts/space-odyssey/components/BlueprintGrid.tsx` — Background grid pattern
- `artifacts/space-odyssey/components/ResourceBar.tsx` — Top HUD bar
- `artifacts/space-odyssey/app/(tabs)/` — 7 screen tabs

### Motion Design System
Lightweight, premium sci-fi motion built on RN `Animated` API (native driver where supported, JS fallback on web). All durations 200-600ms, designed to be subtle and non-distracting.

Reusable primitives in `artifacts/space-odyssey/components/`:
- `Starfield.tsx` — twinkling background star field
- `RotatingPlanet.tsx` — slow rotation + subtle scale breathe for the planet core
- `ScanPulse.tsx` — concentric scan ring around selected zone
- `PressableScale.tsx` — universal button press: scale-down + optional glow halo
- `FadeSlideIn.tsx` — entrance animation (opacity + translate) with delay/offset
- `Typewriter.tsx` — character-by-character reveal for Deep Space Event titles
- `Shimmer.tsx` — diagonal sheen for rare/epic/legendary elements
- `GlowPulse.tsx` — slow breathing glow halo for hero CTAs (engage, prestige, active research)
- `AnimatedTabIcon.tsx` — tab bar icon with spring scale + halo glow on focus
- `CountUpText.tsx` — animated numeric ticker with easing
- `EventOutcomeModal.tsx` — cinematic event aftermath reveal: type-tinted flash, suspense lock-in, typewriter consequence text, animated resource ledger tickers, optional "CRITICAL" outcome with shimmer + heavy haptic

### Phase 6 Redesign — Identity, Energy, Crew, Return Loop (latest pass)

The "Space Odyssey Redesign" rebuild added the foundational systems below. They are wired through `GameContext` (back-compat for old saves) and surfaced across the HUD, Planet, Command, and Intel screens.

**State foundations (`context/GameContext.tsx`, `constants/gameData.ts`)**
- New `GameState` fields: `commanderName`, `planetName`, `commanderBackground`, `gameStage` (0..4), `energy`/`maxEnergy`, `worldFlags`, `eventReports`, `factionModifiers`, `lastReturnEvent`, `combatCooldowns`, `crew`, plus `onboarded` flag.
- `loadGame` defaults every new field for old saves; legacy saves with `totalPlayTime > 60` or any built building auto-mark `onboarded = true` so existing players bypass the new intro.

**Onboarding (`components/OnboardingFlow.tsx`)**
- Full-screen 5-scene narrative gate (intro → name commander → choose background → name planet → begin) renders before any tab when `state.onboarded === false`.
- Three commander backgrounds (Soldier / Scientist / Diplomat) grant day-1 bonuses (+2 Scouts and a defense-discount flag, pre-built Lab + basic mining researched, or Vael discovered + +15 reputation everywhere).

**Energy (`components/EnergyBar.tsx`, `ResourceBar.tsx`)**
- Amber bar in the HUD pulses red when low. Mining costs 5/10/20 energy by type; mining is rejected at 0 energy. Energy regenerates +10/hr in tick + offline catch-up. Each habitat (build or upgrade) raises `maxEnergy` by 20 (base 100).

**In Your Absence (`components/InYourAbsenceModal.tsx`)**
- On load, if the player was offline > 4h, `loadGame` writes a programmatic narrative to `state.lastReturnEvent` (uses crew names, real numbers, a tone-set opening line). The modal shows it once over the dark blueprint backdrop and `dismissReturnEvent` clears it.

**HUD restructure (`components/ResourceBar.tsx`)**
- New layout: Era + Planet name + Stability badge on the top row; Credits (K-formatted) | Energy bar | Crew (pop/max) | Storage % on the stats row. Storage % pulses amber at ≥90%, red at 100%.

**Planet screen (`app/(tabs)/index.tsx`)**
- Storage banners: amber warning at ≥90%, red "STORAGE FULL — MINING HALTED" lockout at 100%.
- Planet visual stages driven by active building count: 0 = bare planet, 1 = single dome dot (1-2), 2 = three-dot cluster (3-5), 3 = full activity ring (6+).
- Planet header now shows `state.planetName` instead of static "PLANETARY SURVEY".

**Command screen (`app/(tabs)/command.tsx`)**
- At max level, the upgrade button is removed entirely and replaced with a celebratory gold "MAXED · LV{n}" banner with a soft glow pulse. No more grey disabled-style fake button.

**Intel screen (`app/(tabs)/intel.tsx`)**
- Combat: 4-hour per-faction cooldown after any engagement. The ENGAGE FLEET button is replaced inline with "FLEET RECHARGING — Xh Ym" (amber) or "NO MILITARY UNITS" (grey) when blocked. Both states explain *why*.
- Faction cards: hostile factions get a red glow pulse with a warning icon. The continuous reputation bar is replaced by a 5-pip trust meter (bins map -100..+100 → 0..5 lit pips) and the label reads "TRUST" instead of "ALLIANCE STATUS".
- New "COMMAND CREW" section above Fleet Management: at minimum the engineer Kael; the second crew slot is determined by background. Each card shows role, backstory, and a one-line ability description.

**Game stage auto-advance (in tick)**
- Tick advances `gameStage` 0..4 on milestones (first mine, first building, first habitat, first faction discovered, first prestige) and writes a one-time `worldFlag` so each transition fires only once.

**Helpers added to context value**
- `completeOnboarding({ commanderName, planetName, background })`, `dismissReturnEvent()`, `addWorldFlag(flag)`, `getCombatCooldownRemaining(factionId)`, `formatCooldown(ms)`, `storageFillRatio` (derived).

**Deferred for later (intentionally)**
- Full 5-role crew recruitment-via-events flow (current pass: data layer + onboarding crew + display only).
- Phase A/B/C delayed-consequence pipeline (the pre-generated story tree already covers the bulk of the narrative weight).
- Espionage mechanical consequences with timer-driven faction modifiers (data shape exists in `factionModifiers`; expiration logic is wired in tick but no missions write to it yet).
- Spec's 3 → 5 tab restructure (current 3-tab Planet/Command/Intel layout reads cleaner; revisit if later content demands it).
- Phase 8 AI prompt rewrite is moot — the story tree is pre-generated and shipped flat.

### Event System Drama
Events now feel like real consequential decisions rather than silent transactions:
- Choosing an option locks-in (✓ checkmark + glow), siblings dim, and a 750ms suspense overlay ("PROCESSING DECISION · CALCULATING TIMELINE BRANCH...") appears with a spinning ring.
- After the suspense, an outcome modal opens with a colored radial flash, type-aware headline ("BREAKTHROUGH" / "THREAT NEUTRALIZED" / "A COSTLY GAMBLE"), the event's pre-existing `consequence` text revealed via typewriter, and an animated resource ledger that counts up each gain/loss with directional icons.
- 16-24% chance per event of a CRITICAL outcome (varies by event type: discovery 24%, random 20%, story 18%, threat 16%) — multiplies positive resource gains by 1.6×, halves losses (except threats), and on discovery/story criticals adds a bonus rare/epic element. Critical outcomes are gold-accented with a shimmer badge and heavy haptic.
- Resolved events are stored in `state.eventLog` (last 25, persisted) and shown in an "AFTERMATH LOG" section as tappable rows that re-open the outcome modal in read-only mode.

Integration coverage:
- Planet (`app/(tabs)/index.tsx`) — starfield, rotating planet, scan pulse, zone node press, mining buttons, panel/banner fade-in, codex shimmer
- Command (`app/(tabs)/command.tsx`) — section pills, era chips, building cards, expand details, construct/upgrade/research buttons, active research glow pulse
- Intel (`app/(tabs)/intel.tsx`) — section pills, faction cards, strategy cards, engage fleet glow, mission cards, deep-scan typewriter on Deep Space Events, prestige glow, daily-claim button
- Tab bar (`app/(tabs)/_layout.tsx`) — animated focused tab icon

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Mobile**: Expo Router (file-based routing)
- **State**: React Context + AsyncStorage
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
