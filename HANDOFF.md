# Space Odyssey: Galactic Evolution — Full Project Handoff

**Version:** 1.0.0  
**Date:** April 2026  
**Platform:** Mobile-first (Expo / React Native), also runs on web via Expo Router server mode

---

## Table of Contents

1. [Game Overview & Lore](#1-game-overview--lore)
2. [Game Loop](#2-game-loop)
3. [State Model](#3-state-model)
4. [Resources & Economy](#4-resources--economy)
5. [Elements (The Codex)](#5-elements-the-codex)
6. [Planet Zones & Mining](#6-planet-zones--mining)
7. [Buildings](#7-buildings)
8. [Technology Tree](#8-technology-tree)
9. [Narrative Events](#9-narrative-events)
10. [AI Event Generation](#10-ai-event-generation)
11. [Factions](#11-factions)
12. [Combat System](#12-combat-system)
13. [Espionage System](#13-espionage-system)
14. [Fleet & Units](#14-fleet--units)
15. [Achievements](#15-achievements)
16. [Daily Rewards & Streaks](#16-daily-rewards--streaks)
17. [Prestige System](#17-prestige-system)
18. [Offline Progress](#18-offline-progress)
19. [Persistence & Save System](#19-persistence--save-system)
20. [Screen-by-Screen Reference](#20-screen-by-screen-reference)
21. [Key Formulas & Constants](#21-key-formulas--constants)
22. [Architecture Summary](#22-architecture-summary)

---

## 1. Game Overview & Lore

**Space Odyssey: Galactic Evolution** is an idle RPG set in a far-future universe. The player takes the role of a nascent civilization that has just landed on a new planet. Starting with nothing but Hydrogen and ambition, they mine elements, construct buildings, research technologies, negotiate or battle alien factions, and gradually evolve from a Stone Age settlement into an interstellar empire capable of warp travel and the synthesis of legendary elements.

### Lore Pillars

- **The Planet:** Unnamed, uncharted. Eight distinct geological zones, each harbouring a different set of elements. Only three zones are accessible at the start; the rest must be unlocked through technology or events.
- **The Codex:** A galactic catalogue of 16 elements — from mundane Hydrogen to the civilization-ending synthetic Xyron-7. Discovering each element is a milestone in its own right.
- **The Three Factions:** The galaxy is not empty. Three alien powers watch from the shadows:
  - **Zorathi Collective** — Hive-mind scientists who value data above all. Personality: scientific. Start neutral.
  - **Krenn Empire** — Militaristic warriors who measure every civilization by its willingness to fight. Start hostile.
  - **Vael Merchants** — Interstellar traders with no loyalties, only profit margins. Start mildly friendly (+10 reputation).
- **The Eras:** Civilization advances through historical eras — Stone Age → Bronze Age → Industrial → Atomic — with each era gating new technologies, narrative events, and faction encounters.
- **Prestige & the Eternal Cycle:** After reaching sufficient power, a civilization may "prestige" — collapsing itself back to the beginning but carrying forward permanent multipliers. The lore framing is that this is a conscious choice: the civilization sacrifices its current achievements to master the cycle of galactic evolution.

---

## 2. Game Loop

The core loop repeats every second (`TICK_INTERVAL = 1000ms`) and is driven by `GameContext.tsx`:

```
Every second (tick):
  1. Passive mining  — mine buildings with level > 0 generate elements probabilistically
  2. Passive income  — credits increase by +0.1/sec (capped at 999,999)
  3. Research tick   — if currentResearch is set, increment researchProgress by researchSpeed
                       → complete when progress ≥ tech.researchTime
  4. Random event    — 0.2% chance per tick (if no active events and unused static events remain)
                       → picks a random unused NARRATIVE_EVENT and adds it to activeEvents

Player-driven actions (anytime):
  • Mine a zone       — tap a zone → choose mining type → receive element rewards
  • Build / upgrade   — spend elements/credits → unlock building or increase level
  • Research          — queue one tech at a time; research runs during tick loop
  • Resolve an event  — choose one of 3 branching options → apply resource/reputation changes
  • Generate AI event — POST /api/generate-event → GPT crafts a unique event for this civilization
  • Engage combat     — select faction + strategy → resolve outcome → update reputation
  • Run espionage     — select faction + mission type → probabilistic success/failure
  • Recruit units     — spend elements → increase fleet count
  • Claim daily reward— once per calendar day
  • Prestige          — soft reset with permanent bonuses

Persistence:
  • Game auto-saves to AsyncStorage on every state mutation
  • On load, offline progress is calculated (capped at 24 hours) and applied
```

---

## 3. State Model

All game state lives in a single `GameState` object in React context (`GameContext.tsx`). It is serialized to AsyncStorage under key `@space_odyssey_save`.

| Field | Type | Description |
|---|---|---|
| `era` | number | Current civilization era (1–4+) |
| `credits` | number | Universal currency. Passive: +0.1/sec |
| `prestigePoints` | number | Accumulated across prestiges |
| `prestigeLevel` | number | How many times the player has prestiged |
| `population` | number | Current population (cosmetic, affects combat calcs) |
| `maxPopulation` | number | Cap set by Habitat Domes (starts at 50) |
| `defensePower` | number | Base defense rating; starts at 10, +25 per Defense Tower level |
| `miningMultiplier` | number | Global multiplier on all mining yields; starts 1.0 |
| `researchSpeed` | number | Ticks of progress per second; starts 1.0, Quantum Research → 1.5 |
| `elements` | Element[] | Full element codex with discovered status and quantity |
| `buildings` | Building[] | 8 building types, each with a level (0 = not built) |
| `technologies` | Technology[] | 10 techs, each with researched boolean and researchTime |
| `factions` | Faction[] | 3 factions with reputation (–100 to +100) and relationship |
| `achievements` | Achievement[] | 10 achievements with progress tracking |
| `activeEvents` | GameEvent[] | Events awaiting player decision |
| `completedEvents` | string[] | IDs of resolved events (prevents re-triggering static events) |
| `planetZones` | Zone[] | 8 zones with unlock status and lastMined timestamp |
| `lastSave` | number | Unix timestamp of last save (used for offline calc) |
| `totalPlayTime` | number | Seconds of active play |
| `loginStreak` | number | Consecutive daily logins |
| `lastLoginDate` | string | Date string of last login (used for streak logic) |
| `dailyRewardClaimed` | boolean | Reset to false each new calendar day |
| `currentResearch` | string \| null | ID of tech being researched |
| `researchProgress` | number | Ticks accumulated toward current research |
| `combatLog` | CombatEntry[] | Last 20 combat results |
| `espionageLog` | EspionageEntry[] | Last 20 espionage results |
| `units` | FleetUnit[] | 4 fleet unit types, each with a count |
| `storageCapacity` | number | Max total elements storable; starts 1,000 |
| `activeTab` | string | Persisted last-visited tab |

---

## 4. Resources & Economy

### Credits
- Passive income: +0.1/tick (6/min, 360/hr)
- Daily rewards: +50 to +500 depending on streak day
- Combat wins: no direct credit reward currently (narrative only)
- Spending: building construction, upgrades, some tech costs

### Elements
Elements are the primary currency for buildings, tech research, and unit recruitment. Each has a maximum quantity capped at `storageCapacity` (default 1,000, +500 per Element Vault level).

Elements are spent via `deductCost()` which reads cost maps like `{ Fe: 50, Si: 20 }`.

---

## 5. Elements (The Codex)

16 elements total. Only Hydrogen (`H`) starts discovered. All others are found through mining, AI events, or Deep Core mining's discovery bonus.

| Symbol | Name | Atomic # | Rarity | Energy | Stability | Notes |
|---|---|---|---|---|---|---|
| H | Hydrogen | 1 | Common | 5 | 8 | Starts discovered |
| He | Helium | 2 | Common | 3 | 10 | Noble gas, cooling systems |
| Li | Lithium | 3 | Common | 7 | 6 | Energy storage |
| C | Carbon | 6 | Common | 6 | 9 | Organic backbone |
| O | Oxygen | 8 | Common | 4 | 9 | Life support |
| Fe | Iron | 26 | Common | 8 | 10 | Primary construction material |
| Cu | Copper | 29 | Uncommon | 9 | 8 | Electronics conductor |
| Ag | Silver | 47 | Uncommon | 11 | 7 | Precision instruments |
| Ti | Titanium | 22 | Uncommon | 12 | 9 | Lightweight structural metal |
| Si | Silicon | 14 | Common | 6 | 8 | Computing foundation |
| Au | Gold | 79 | Rare | 15 | 10 | Universal currency |
| Pt | Platinum | 78 | Rare | 18 | 9 | Advanced reaction catalyst |
| U | Uranium | 92 | Epic | 45 | 4 | Reactor fuel |
| Pu | Plutonium | 94 | Epic | 55 | 3 | Weapons-grade fissile |
| Xr7 | Xyron-7 | 119 | Legendary | 100 | 2 | Synthetic, immense power |
| Nv | Novasteel | 120 | Legendary | 30 | 10 | Strongest known alloy |

**Rarity colors** (used throughout UI):
- Common → `#A0A0A0`
- Uncommon → `#00FF88`
- Rare → `#00D4FF`
- Epic → `#9B59B6`
- Legendary → `#FFB800`

---

## 6. Planet Zones & Mining

### Zones

8 zones on the planet surface. Only 3 start unlocked.

| ID | Name | X% | Y% | Elements | Base Yield | Unlocked |
|---|---|---|---|---|---|---|
| zone_1 | Northern Tundra | 20 | 15 | H, Fe, Si | 10 | Yes |
| zone_2 | Equatorial Rift | 60 | 35 | Fe, C, Ti | 15 | Yes |
| zone_3 | Crystal Caves | 35 | 55 | Si, Cu, Li | 12 | Yes |
| zone_4 | Volcanic Rim | 75 | 70 | Fe, U, Ag | 20 | No |
| zone_5 | Deep Ocean Trench | 15 | 75 | O, He, Ag | 18 | No |
| zone_6 | Ancient Ruins | 50 | 20 | Au, Pt, C | 25 | No |
| zone_7 | Quantum Anomaly | 80 | 40 | Xr7, Pu, U | 40 | No |
| zone_8 | Core Fragment | 45 | 85 | Nv, Pt, Au | 35 | No |

X and Y are percentage positions on the planet map canvas.

### Mining Types

| Type | Cooldown | Risk | Yield Multiplier | Special |
|---|---|---|---|---|
| Safe | 3,000ms | 0% | 1× | No risk |
| Aggressive | 2,000ms | 25% | 2.5× | Mining accident on fail |
| Deep Core | 5,000ms | 50% | 5× | Cave collapse on fail; 15% chance to discover a random undiscovered element |

### Yield Formula

```
base = zone.baseYield × miningType.multiplier × miningMultiplier × (1 + prestigeLevel × 0.1)
actual = floor(base × random(0.75, 1.25))
actual = max(1, actual)
```

Each element in the zone receives its own yield roll independently. Rewards are capped at `storageCapacity`.

### Passive Mining (Tick)

Mine buildings (type `'mine'`) generate elements every tick via a probability roll:

```
rate = building.productionRate × building.level × miningMultiplier
probability per tick = rate / 60
```

When the roll succeeds, all elements in `PLANET_ZONES[0]` (Northern Tundra) each receive +1 unit.

---

## 7. Buildings

8 building types. Each starts at level 0 (not constructed). Max levels vary. Upgrade cost scales as:

```
upgradeCost[resource] = baseCost[resource] × upgradeMultiplier ^ currentLevel
```

| ID | Name | Type | Max Level | Base Cost | Effect | Upgrade Multiplier |
|---|---|---|---|---|---|---|
| mine_basic | Basic Mine | mine | 10 | Fe:50, Si:20 | Passive element production; productionRate=10 | 1.5 |
| lab_basic | Research Lab | lab | 10 | Cu:30, Si:50 | +15% research speed per level | 1.6 |
| habitat_basic | Habitat Dome | habitat | 10 | Fe:30, C:20 | +20 max population per level | 1.4 |
| defense_basic | Defense Tower | defense | 10 | Fe:80, Ti:10 | +25 defense rating per level | 1.7 |
| storage_basic | Element Vault | storage | 10 | Fe:40, C:30 | +500 storage capacity per level | 1.3 |
| refinery | Refinery | refinery | 8 | Fe:60, Cu:40, Si:30 | +20% element quality per level; productionRate=5 | 1.8 |
| temple | Star Temple | temple | 5 | Au:20, Si:50, C:40 | +10% all production per level | 2.0 |
| trade_post | Trade Nexus | trade_post | 7 | Cu:60, Au:15 | +15% trade value per level | 1.6 |

**Side effects on construction/upgrade:**
- `storage_basic` → `storageCapacity += 500` per level
- `habitat_basic` → `maxPopulation += 20` per level
- `defense_basic` → `defensePower += 25` per level

**Demolish** resets level to 0 (no resource refund in current implementation).

---

## 8. Technology Tree

10 technologies across 3 eras. Only one tech may be researched at a time. Research runs in the background tick loop.

| ID | Name | Era | Category | Prerequisites | Cost | Research Time (ticks) | Effect |
|---|---|---|---|---|---|---|---|
| basic_mining | Basic Mining | 1 | mining | — | H:20, Fe:10 | 30 | +25% mining yield |
| element_scanner | Element Scanner | 1 | mining | basic_mining | Si:30, Cu:10 | 60 | Reveals hidden zones |
| deep_drilling | Deep Core Drilling | 1 | mining | basic_mining | Fe:50, Ti:20 | 90 | Unlocks deep core mining |
| structural_engineering | Structural Engineering | 1 | construction | — | Fe:30, Si:20 | 45 | −20% building cost |
| xenobiology | Xenobiology | 2 | diplomacy | element_scanner | C:60, O:40 | 120 | Unlocks faction diplomacy |
| plasma_weapons | Plasma Weapons | 2 | military | deep_drilling | U:10, Cu:50 | 150 | +40% combat power |
| quantum_research | Quantum Research | 2 | research | structural_engineering, xenobiology | Si:100, Au:20 | 180 | +50% research speed |
| advanced_mining | Advanced Mining | 2 | mining | deep_drilling, structural_engineering | Fe:100, Cu:50, Ti:30 | 200 | +100% passive mining |
| warp_drive | Warp Drive | 3 | research | plasma_weapons, quantum_research | Xr7:5, U:30, Pt:20 | 300 | Unlocks new planets |
| synthetic_elements | Synthetic Elements | 3 | research | quantum_research, advanced_mining | Au:50, Pt:30, U:20 | 360 | Unlocks legendary elements |

**Research speed mechanic:**
```
researchSpeed starts at 1.0
quantum_research completed → researchSpeed × 1.5
```
Progress completes when `researchProgress >= tech.researchTime`.

---

## 9. Narrative Events

Events are the storytelling heart of the game. There are two sources: static hand-authored events and dynamic AI-generated events.

### How Events Enter the Game

1. **Auto-trigger (static only):** Every tick there is a `0.2%` chance to pick a random unused `NARRATIVE_EVENT` and add it to `activeEvents`, IF no events are currently active.
2. **Player-triggered (AI):** The player taps "Scan for Signals" on the Events tab, which calls the AI generation endpoint.

### Static Narrative Events

Five hand-authored events. Each has an ID, type, description, and three choices.

---

**Event 1: Strange Signal Detected** (`type: story`)

> Your scanners pick up an encrypted transmission from deep space. The signal repeats every 17 minutes, as if waiting for a response.

| Choice | Text | Consequence | Resource Changes |
|---|---|---|---|
| c1 | Respond to the signal | A Zorathi probe arrives, bearing gifts of knowledge. | Si: +50, Cu: +30 |
| c2 | Ignore it and hide | The signal fades. Whatever sent it has moved on. | Reputation: −5 |
| c3 | Trace the source | You discover a derelict station with valuable resources. | Fe: +100, Au: +10 |

---

**Event 2: Meteor Shower Incoming** (`type: random`)

> Long-range sensors detect a massive meteor shower on a collision course. You have minutes to react.

| Choice | Text | Consequence | Resource Changes |
|---|---|---|---|
| c1 | Activate defense shields | Shields hold. Minor damage to the northern mining operation. | Fe: −20 |
| c2 | Evacuate and bunker down | Everyone survives but surface structures are damaged. | Fe: −50, Si: −30 |
| c3 | Mine the meteors as they fall | Risky gamble pays off! Rare materials recovered. | Au: +25, Ti: +40, Fe: −30 |

---

**Event 3: Rogue AI Fragment** (`type: discovery`)

> A self-replicating AI fragment has been discovered in your lab's network. It claims to have ancient star maps.

| Choice | Text | Consequence | Resource Changes |
|---|---|---|---|
| c1 | Integrate the AI | The AI assists your research, but your systems are never quite the same. | Si: +100 |
| c2 | Purge the AI | System clean. The star maps are lost forever. | Cu: +20 |
| c3 | Quarantine and study it | Careful study yields breakthrough discoveries. | Au: +15, Si: +60 |

---

**Event 4: Krenn War Fleet Detected** (`type: threat`)

> A Krenn Empire war fleet is scouting your system. Their intentions are unclear — but their weapons are charged.

| Choice | Text | Consequence | Reputation Change |
|---|---|---|---|
| c1 | Show of force | They respect your defiance and withdraw... for now. | +15 |
| c2 | Offer tribute | Peace bought at a cost. They may be back for more. | Fe: −100, Au: −10; Rep: −10 |
| c3 | Open diplomatic channel | A tense exchange leads to a temporary truce. | +5 |

---

**Event 5: Ancient Burial Site** (`type: discovery`)

> Your miners uncovered what appears to be an alien burial ground, filled with unrecognized artifacts.

| Choice | Text | Consequence | Resource Changes |
|---|---|---|---|
| c1 | Excavate immediately | Priceless artifacts recovered, but something feels wrong. | Au: +40, Pt: +10 |
| c2 | Seal and preserve it | Word spreads. A faction offers alliance in gratitude. | Reputation: +20 |
| c3 | Study before touching | Careful analysis reveals the civilization's secrets. | Si: +80, C: +50 |

---

### Resolving Events

When the player picks a choice, `resolveEvent(eventId, choiceId)` is called:

1. Apply `choice.resourceChanges` to elements and credits
2. Apply `choice.reputationChange` to ALL factions (current implementation — not per-faction)
3. Remove event from `activeEvents`
4. Add event ID to `completedEvents`

---

## 10. AI Event Generation

The Events tab can generate unlimited unique narrative events using GPT via a server-side Expo Router API route.

### Endpoint

`POST /api/generate-event`

**Request body:**
```json
{
  "era": 1,
  "elementsDiscovered": ["H", "Fe", "Si"],
  "buildingsBuilt": ["Basic Mine"],
  "technologiesResearched": [],
  "credits": 150,
  "population": 10,
  "factionNames": ["Zorathi Collective", "Krenn Empire", "Vael Merchants"],
  "recentEventTitle": "Strange Signal Detected"
}
```

**Response:** A `GameEvent` object with the same structure as static events:
```json
{
  "id": "ai_evt_abc123",
  "title": "Glowing Fissure",
  "description": "A faint blue glow spills from a crack in the basalt...",
  "type": "discovery",
  "choices": [
    { "id": "c1", "text": "Venture deeper", "consequence": "...", "resourceChanges": { "H": 10 } },
    { "id": "c2", "text": "Set up collection pits", "consequence": "...", "reputationChange": 2 },
    { "id": "c3", "text": "Mark the site", "consequence": "...", "reputationChange": 3 }
  ],
  "timestamp": 0
}
```

**AI model:** `gpt-5-mini` via Replit AI Integrations OpenAI proxy

**System prompt rules enforced:**
- Exactly 3 choices
- `resourceChanges` keys: valid element symbols or `"credits"`
- Amounts: −200 to +200
- Optional `reputationChange`: −30 to +30
- Response must be pure JSON (no markdown)

**Fallback:** If the API call fails for any reason, `generateEvent()` silently falls back to a random unused static event. If all static events are also exhausted, nothing is added.

**AI tag:** Events with IDs starting `ai_` receive a cyan "AI" badge in the UI.

---

## 11. Factions

Three alien civilizations. Factions start as `discovered: false` — they must be encountered through events or exploration before appearing in the Combat/Espionage screens.

| ID | Name | Personality | Starting Reputation | Starting Relationship |
|---|---|---|---|---|
| zorathi | Zorathi Collective | Scientific | 0 | Neutral |
| krenn | Krenn Empire | Militaristic | 0 | Hostile |
| vael | Vael Merchants | Merchant | +10 | Neutral |

### Reputation Scale

Range: −100 to +100

| Range | Relationship Label |
|---|---|
| < −50 | Hostile |
| −50 to +20 | Neutral |
| +20 to +60 | Friendly |
| > +60 | Allied |

Relationship labels and colors are displayed in faction cards and the Combat screen.

### Reputation Changes

- Combat win: +20 to the target faction
- Combat loss: −10 to the target faction
- Event choices: applies `reputationChange` to ALL factions simultaneously (known simplification)
- Espionage: no reputation change currently (future feature opportunity)

---

## 12. Combat System

Accessed via the Combat tab → COMBAT sub-tab.

### Player Power Calculation

```
playerPower = sum(unit.count × (unit.attack + unit.defense) / 2) + defensePower
```

### Enemy Power Calculation

```
enemyPower = 50 + (faction.reputation × −0.5)
```
A more hostile faction (lower reputation) generates higher enemy power.

### Strategies

| Strategy | Effect | Risk |
|---|---|---|
| All Out Attack | playerEffective × 1.3 | Higher variance |
| Defensive | playerEffective × 0.8 | Lower variance |
| Retreat | Outcome is always "draw" | No loss, no gain |

### Resolution

```
playerEffective = playerPower × strategyBonus × random(0.8, 1.2)
enemyEffective  = enemyPower × random(0.8, 1.2)

if playerEffective > enemyEffective × 1.2 → WIN
if enemyEffective > playerEffective × 1.2 → LOSS
else → DRAW
```

### Outcomes

| Outcome | Reputation Change | Notes |
|---|---|---|
| WIN | +20 to faction | Triggers `combat_win` achievement check |
| LOSS | −10 to faction | |
| DRAW | 0 | Retreat always results in draw |

Combat log stores the last 20 entries.

---

## 13. Espionage System

Accessed via Combat tab → ESPIONAGE sub-tab. Requires a discovered faction to be selected first.

| Mission | Icon | Success Rate | Success Description | Failure Description |
|---|---|---|---|---|
| Scan Base | eye | 90% | Intel gathered on faction defenses. | Scout was detected and eliminated. |
| Plant Spy | user-check | 60% | Agent planted successfully. Gathering intelligence. | Spy was captured. Diplomatic incident. |
| Disrupt | zap-off | 50% | Production sabotaged. Their output reduced. | Saboteur was caught and executed. |
| Fake Signals | radio | 70% | False signals accepted. Confusion in their command. | Deception detected. They're suspicious. |

Espionage outcomes are purely narrative at this stage — no mechanical effect on faction stats yet. Log stores last 20 entries.

---

## 14. Fleet & Units

Accessed via Combat tab → FLEET sub-tab. Units are recruited in batches of 5.

| ID | Name | Type | Attack | Defense | Cost (per unit) |
|---|---|---|---|---|---|
| fighter | Fighter | fighter | 10 | 5 | Fe:20, Cu:10 |
| bomber | Bomber | bomber | 25 | 3 | Fe:40, Ti:15 |
| capital | Capital Ship | capital | 60 | 40 | Fe:100, Ti:50, Au:20 |
| scout | Scout | scout | 5 | 8 | Fe:15, Si:10 |

Recruit cost = `unitCost × 5` (always recruited in batches of 5).

Unit contribution to combat:
```
unit.count × (unit.attack + unit.defense) / 2
```
Added to `defensePower` for the total `playerPower`.

---

## 15. Achievements

10 achievements. Checked automatically during state mutations (mining, building, research, combat wins).

| ID | Name | Rarity | Trigger | Target | Prestige Point Reward |
|---|---|---|---|---|---|
| first_mine | First Contact | Common | Any element qty > 0 | 1 | 10 |
| elements_10 | Collector | Uncommon | Discovered elements count | 10 | 25 |
| build_5 | Architect | Uncommon | Buildings with level > 0 | 5 | 30 |
| tech_5 | Scholar | Rare | Researched technologies | 5 | 50 |
| era_2 | Pioneer | Rare | Reach Era 2 | 1 | 75 |
| combat_win | Warlord | Uncommon | Win a battle | 1 | 40 |
| prestige_1 | Eternal Cycle | Epic | First prestige | 1 | 200 |
| legendary_element | Beyond Science | Legendary | Discover Xr7 or Nv | 1 | 500 |
| faction_ally | Diplomat | Epic | Allied relationship with any faction | 1 | 150 |
| elements_50 | Grand Codex | Legendary | Discover all 16 elements | 16 | 1000 |

`checkAchievements()` is called after: mining, building construction, tech completion, and combat wins.

---

## 16. Daily Rewards & Streaks

Tracked via `loginStreak` and `lastLoginDate`. On each app load:

- If `lastLoginDate` matches yesterday → streak increments by 1
- If `lastLoginDate` is older → streak resets to 1
- `dailyRewardClaimed` resets to `false` each new calendar day

### Reward Table

| Day | Rewards |
|---|---|
| 1 | Credits +50, Fe +20 |
| 2 | Credits +100, Fe +40 |
| 3 | Credits +150, Fe +60 |
| 4 | Credits +200, Fe +80 |
| 5 | Credits +250, Fe +100 |
| 6 | Credits +300, Fe +120 |
| 7 | Prestige Token +1, Credits +500 |

Day 7 caps the streak cycle — `Math.min(loginStreak, 7)` is used for reward lookup.

---

## 17. Prestige System

Accessed via Command Center (settings tab) → PRESTIGE RESET.

### What Persists Through Prestige
- `prestigeLevel` (increments)
- `prestigePoints` (+5 added per prestige)
- `loginStreak` and `lastLoginDate`
- `dailyRewardClaimed`
- `Eternal Cycle` achievement (if already unlocked)

### What Resets
Everything else: elements, buildings, technologies, factions, events, credits, units, research.

### Permanent Bonus

```
miningMultiplier = 1 + prestigeLevel × 0.1
```

So Prestige Level 1 → 1.1× mining. Level 5 → 1.5× mining. Applied to both active mining and passive building production.

### Prestige Points

Accumulated but currently function as a display score. The "Diplomat" and "Grand Codex" achievements pay out large sums as a long-term goal.

---

## 18. Offline Progress

When the game loads after being closed, it calculates offline time:

```
offlineTime = (Date.now() - lastSave) / 1000   // seconds
cappedTime = min(offlineTime, 86400)            // cap at 24 hours
```

Then `applyOfflineProgress()` is run:

- For each mine building with `level > 0`:
  ```
  rate = building.productionRate × building.level × (1 + prestigeLevel × 0.1)
  totalGained = floor(rate × cappedSeconds / 60)
  ```
  Elements in `PLANET_ZONES[0]` (Northern Tundra) each receive `floor(totalGained / 3)` units.

- Credits: `+floor(cappedSeconds × 0.5)` (capped at 999,999)

Note: Offline progress only applies to the first zone's elements. Active mining zones 2–8 do not generate passively offline.

---

## 19. Persistence & Save System

- **Storage key:** `@space_odyssey_save`
- **Storage mechanism:** `AsyncStorage` (React Native / Expo)
- **Save timing:** Every `setState()` call in GameContext mutates state; however, explicit saves via `saveGame()` are only called reactively. The `lastSave` field is always updated to `Date.now()` on save.
- **Load flow:** `loadGame()` runs on mount → reads saved JSON → applies offline progress → detects new day for streak logic → sets state.
- **Error handling:** All save/load errors are silently swallowed; defaults are used on load failure.

---

## 20. Screen-by-Screen Reference

### Planet (`/planet` — default tab)

- Interactive planet surface map showing 8 zones
- Tap a zone to select it
- Three mining buttons appear below: Safe / Aggressive / Deep Core
- Zone tiles show element symbols and locked/unlocked state
- Element Codex below the map shows all 16 elements as atomic-style tiles; discovered ones show quantity

### Base (`/buildings`)

- Lists all 8 building types
- Each card shows: current level, max level, effects, cost
- Buttons: CONSTRUCT (if level 0) / UPGRADE (if level > 0 and below max) / DEMOLISH
- Build/upgrade buttons are greyed out if insufficient resources

### Tech (`/tech`)

- Lists all 10 technologies grouped by era
- Researched techs show a check; current research shows a progress bar
- Can queue one tech at a time
- Prerequisites shown per tech; greyed if not met

### Events (`/events`)

- Header shows active/completed counts + "AI NARRATIVE" badge
- Empty state: dashed card with "SCAN FOR SIGNALS" button
- Active events: full card per event with type color-coding and choice buttons
- Completed events: simple list of resolved event IDs (shows "Event resolved" currently)
- Generating state: pulsing card "SCANNING DEEP SPACE..."
- "SCAN FOR MORE SIGNALS" button appears when events are already present

**Event type colors:**
- `random` → Yellow (#FFB800)
- `story` → Cyan (#00D4FF)
- `discovery` → Green (#00FF88)
- `threat` → Red (#FF4444)

### Combat (`/combat`)

Three sub-tabs: COMBAT | ESPIONAGE | FLEET

- **COMBAT:** Select faction → pick strategy → ENGAGE FLEET → see result card
- **ESPIONAGE:** Select faction → tap mission → immediate probabilistic result
- **FLEET:** View unit stats and recruit in batches of 5; combat log below

### Awards (`/achievements`)

Two sub-tabs: ACHIEVEMENTS | DAILY

- **ACHIEVEMENTS:** Unlocked vs locked lists with rarity badges and progress bars; prestige stats at top
- **DAILY:** 7-day streak visual, current day reward display, CLAIM REWARD button

### Command Center (`/settings`)

- Civilization Status grid (era, credits, population, elements, buildings, techs)
- Session Data (play time, login streak, storage)
- Traits & Bonuses (mining multiplier, research speed, prestige level)
- Prestige Reset card with before/after bonus preview and INITIATE PRESTIGE button
- About section

---

## 21. Key Formulas & Constants

```
TICK_INTERVAL            = 1000ms
PASSIVE_CREDIT_RATE      = 0.1/tick (6/min)
MAX_CREDITS              = 999,999
DEFAULT_STORAGE_CAPACITY = 1,000
DEFAULT_MAX_POPULATION   = 50
DEFAULT_DEFENSE_POWER    = 10

MINING_COOLDOWNS:
  safe       = 3,000ms
  aggressive = 2,000ms
  deep       = 5,000ms

MINING_RISK:
  safe       = 0%
  aggressive = 25%
  deep       = 50%

MINING_MULTIPLIER:
  safe       = 1×
  aggressive = 2.5×
  deep       = 5×

DEEP_MINING_DISCOVERY_CHANCE = 15%

RANDOM_EVENT_CHANCE_PER_TICK = 0.2%

OFFLINE_CAP              = 86,400 seconds (24 hours)
OFFLINE_CREDIT_RATE      = 0.5/second

ESPIONAGE_SUCCESS_RATES:
  scan    = 90%
  spy     = 60%
  disrupt = 50%
  fake    = 70%

COMBAT_STRATEGY_BONUS:
  attack  = 1.3×
  defend  = 0.8×
  retreat = always draw

COMBAT_WIN_REPUTATION    = +20
COMBAT_LOSS_REPUTATION   = -10
COMBAT_WIN_THRESHOLD     = 1.2× enemy power

PRESTIGE_MINING_BONUS    = +10% per prestige level
PRESTIGE_POINTS_PER_RESET = +5
```

---

## 22. Architecture Summary

```
artifacts/space-odyssey/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          → re-exports planet.tsx
│   │   ├── planet.tsx         → Planet map + mining + Element Codex
│   │   ├── buildings.tsx      → Building construction/upgrade/demolish
│   │   ├── tech.tsx           → Technology tree + research queue
│   │   ├── events.tsx         → Narrative events + AI generation UI
│   │   ├── combat.tsx         → Combat / Espionage / Fleet management
│   │   ├── achievements.tsx   → Achievements + Daily rewards
│   │   ├── settings.tsx       → Command Center + Prestige
│   │   └── _layout.tsx        → Tab navigator configuration
│   ├── api/
│   │   └── generate-event+api.ts  → Server-side OpenAI event generator
│   └── _layout.tsx            → Root layout, font loading, GameProvider
│
├── context/
│   └── GameContext.tsx        → All game state + all game actions
│
├── constants/
│   └── gameData.ts            → All static data: elements, buildings, techs, events, factions, achievements, zones
│
├── components/
│   ├── BlueprintGrid.tsx      → Background grid pattern
│   ├── ResourceBar.tsx        → Top HUD (era, credits, population, defense)
│   ├── ProgressBar.tsx        → Reusable progress bar
│   └── RarityBadge.tsx        → Colored rarity label
│
├── hooks/
│   └── useColors.ts           → Centralized color tokens
│
└── app.json                   → Expo config; "web.output": "server" enables API routes
```

### Data Flow

```
User action
    ↓
Screen component calls context action
    ↓
GameContext action validates, deducts cost, setState()
    ↓
React re-renders affected screens
    ↓
AsyncStorage auto-save (on next tick save cycle)
```

### AI Event Data Flow

```
User taps "Scan for Signals"
    ↓
GameContext.generateEvent() collects civilization snapshot
    ↓
POST /api/generate-event (Expo Router server-side route)
    ↓
API route sends prompt to OpenAI proxy (Replit AI Integrations)
    ↓
GPT generates JSON event → validated → returned
    ↓
GameContext adds event to activeEvents
    ↓
Events screen renders the new card with AI badge
```

---

*End of handoff document.*
