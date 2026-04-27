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
- **AI Narrative Events**: GPT-powered dynamic events unique to each civilization's state via Expo Router API route (`app/api/generate-event+api.ts`)
- **Static Fallback Events**: 5 static branching events used when AI is unavailable
- **Combat System**: Turn-based fleet battles with 3 strategies
- **Espionage System**: 4 mission types with varying success rates
- **3 Factions**: Zorathi, Krenn, Vael with reputation system
- **Achievement System**: 10 achievements with rarity tiers
- **Daily Rewards**: 7-day streak system
- **Prestige System**: Reset for permanent multipliers
- **Offline Progress**: Idle resource generation while away
- **Persistence**: AsyncStorage-based save system

### AI Integration
- Uses Replit AI Integrations (OpenAI) via an Expo Router API route
- `app/api/generate-event+api.ts` — server-side handler using `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY`
- Enabled by `"output": "server"` in `app.json` web config
- Falls back to static events on API failure
- AI events tagged with "AI" badge in the Events tab UI

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
- `Typewriter.tsx` — character-by-character reveal for AI narrative titles
- `Shimmer.tsx` — diagonal sheen for rare/epic/legendary elements
- `GlowPulse.tsx` — slow breathing glow halo for hero CTAs (engage, prestige, active research)
- `AnimatedTabIcon.tsx` — tab bar icon with spring scale + halo glow on focus

Integration coverage:
- Planet (`app/(tabs)/index.tsx`) — starfield, rotating planet, scan pulse, zone node press, mining buttons, panel/banner fade-in, codex shimmer
- Command (`app/(tabs)/command.tsx`) — section pills, era chips, building cards, expand details, construct/upgrade/research buttons, active research glow pulse
- Intel (`app/(tabs)/intel.tsx`) — section pills, faction cards, strategy cards, engage fleet glow, mission cards, deep-scan typewriter on AI events, prestige glow, daily-claim button
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
