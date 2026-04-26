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
- **Narrative Events**: 5 branching story events with consequences
- **Combat System**: Turn-based fleet battles with 3 strategies
- **Espionage System**: 4 mission types with varying success rates
- **3 Factions**: Zorathi, Krenn, Vael with reputation system
- **Achievement System**: 10 achievements with rarity tiers
- **Daily Rewards**: 7-day streak system
- **Prestige System**: Reset for permanent multipliers
- **Offline Progress**: Idle resource generation while away
- **Persistence**: AsyncStorage-based save system

### Key Files
- `artifacts/space-odyssey/context/GameContext.tsx` — Core game state + all game logic
- `artifacts/space-odyssey/constants/gameData.ts` — All game data (elements, buildings, techs, events, factions)
- `artifacts/space-odyssey/constants/colors.ts` — Blueprint theme colors
- `artifacts/space-odyssey/components/BlueprintGrid.tsx` — Background grid pattern
- `artifacts/space-odyssey/components/ResourceBar.tsx` — Top HUD bar
- `artifacts/space-odyssey/app/(tabs)/` — 7 screen tabs

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
