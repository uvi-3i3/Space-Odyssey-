# Space Odyssey: Galactic Evolution — Full Redesign Agent Prompt

> Hand this entire document to your coding agent. It is self-contained.  
> Do not summarize it. Do not paraphrase it. Give it verbatim.

---

## Context: What This Game Is and What Is Wrong With It

Space Odyssey is a React Native / Expo mobile idle RPG. The code is structurally sound. The bugs are mostly fixed. The problem is not the code — it is the game design. Right now the game:

- Throws the player onto a planet with no introduction, no character, no story reason to care
- Has no clear first action or goal
- Auto-mines passively forever with no reason to return
- Shows "events" as a batch of cards to click through in one sitting — not real events with weight and consequence
- Has buildings, tech, factions, combat, espionage all visible and clickable immediately — overwhelming the player
- Shows no visual change when things improve (numbers go up, nothing looks different)
- Has no narrative thread connecting anything
- Lets players click "upgrade" forever even when at max, or "attack" repeatedly with zero cost or strategy

The redesign must fix ALL of this. The following is the complete specification.

---

## Design Pillars (Read Before Touching Any Code)

These are borrowed from the best text-based RPGs — Disco Elysium, Fallen London, Wildermyth, Suzerain, The Banner Saga — and adapted for this game.

**1. Every system must be earned, not exposed.**  
Disco Elysium never shows you all its skill checks at once. Fallen London drip-feeds its storylines. Nothing in Space Odyssey should be visible until the player has done something to deserve seeing it.

**2. Events are not menus. They are moments.**  
In Fallen London, a single event card can have 200 words of lore, delayed consequences, and ripple effects days later. In The Banner Saga, a caravan event might cost you a character you loved. Events in this game must feel like that — each one is a story beat, not a form to fill out.

**3. The player is a character, not a cursor.**  
Wildermyth works because you care about your characters. This game needs a Commander — a named, voiced persona who the player names and chooses a background for at the start. Everything the player does is done *as* this Commander.

**4. Offline time is narrative, not a calculator.**  
When the player returns, they should read what happened while they were gone — not see a "+340 Fe" popup. The world moved without them.

**5. Visual state must reflect game state.**  
If you have 3 buildings, the planet should look different than when you have 8. If a faction is hostile, their icon should pulse red. If research completes, something on screen should visibly change.

**6. Consequences must be real and delayed.**  
Choices made in week 1 should affect what happens in week 3. Not immediately. Not obviously. But demonstrably.

---

## Phase 1 — The Beginning: Onboarding & Character Creation

### What Must Be Built

**Screen: Commander Creation (runs once on first launch, before anything else)**

Replace the current immediate planet view with a full-screen narrative intro sequence:

```
Scene 1 (full screen, dark space, text fades in):
"Year 2387. Earth is gone. You are the Commander of the last colony ship —
the Helios Vanguard. You've found a planet. You have 47 survivors.
What you build here will either save humanity or end it."

[TAP TO CONTINUE]

Scene 2:
"Before we begin — who are you?"

[Input: Commander Name]

Scene 3 (three background cards, each with an icon and 2-sentence description):
Choose your background:

◆ THE SOLDIER
You led the military evacuation. You are trusted. You are feared.
→ Starting bonus: +2 Scout units, Defense Tower costs 30% less

◆ THE SCIENTIST  
You designed the Helios drive. Your mind sees patterns others miss.
→ Starting bonus: Research Lab built, Basic Mining researched

◆ THE DIPLOMAT
You brokered the last peace accord before the fall. Words are your weapons.
→ Starting bonus: Vael Merchants discovered, +15 reputation with all factions

Scene 4 (after selection):
"The Helios Vanguard breaks atmosphere.
The planet has no name yet. That's for you to decide."

[Input: Name your planet]

Scene 5:
"[Commander Name]. [Planet Name]. 47 survivors.
The first thing you need is shelter from this planet's storms.
Start with the northern plains — they're exposed but rich with iron."

[BEGIN]
```

After this sequence, the game opens to the Planet screen — but with ONLY the Northern Tundra zone visible and a single pulsing action prompt: **"Mine the Northern Plains."** Nothing else is unlocked or visible yet.

### Progression Gate: What Unlocks What

The game must be gated strictly in this order. Nothing outside this order should be visible:

**Stage 0 — Survival (0-10 minutes of play)**
- Only: Planet screen, Northern Tundra zone, Safe mining only
- HUD shows: Commander name, survivor count (population), iron stockpile only
- No buildings tab. No tech tab. No events tab. No combat tab.
- First mine action triggers: short narrative text overlay ("The survivors dig. The iron is cold but plentiful. This will do for now.")

**Stage 1 — Shelter (first building constructed)**
- Unlock: Buildings tab (shows ONLY Habitat Dome and Basic Mine)
- Trigger: After first mine yields 50 Fe, a prompt appears: "Your survivors need shelter before nightfall."
- This is the player's first real decision

**Stage 2 — Signals (first Habitat built)**
- Unlock: Events tab (one static event appears: "Strange Signal Detected")
- Unlock: Second zone (Equatorial Rift)
- Narrative text: "The colony's sensors, now properly powered, pick up something from deep space."

**Stage 3 — Research (first event resolved)**
- Unlock: Tech tab (shows only Era 1 techs)
- Narrative: "The signal's data contains schematics. Your scientists are already at work."

**Stage 4 — Contact (Basic Mining tech researched)**
- Unlock: Third zone (Crystal Caves)
- Unlock: Combat/Espionage tab — but ONLY showing "No factions encountered yet"
- Narrative: "Deeper scans reveal you are not alone on this planet."

Everything from Stage 4 onward proceeds as the current era system, now that it is properly implemented.

---

## Phase 2 — The Passive Mining Overhaul: Time as a Resource

### The Core Problem
Right now, mines produce forever. There is no reason to return. This must be replaced with an **Energy system**.

### The New System

**Mining Energy**
- Each mining operation (manual or passive) costs Energy
- The Commander has a base Energy pool of 100
- Energy regenerates at 10/hour (real time), capped at 100
- This means a full regen takes 10 hours — the designed return window
- Energy is displayed as a bar in the HUD at all times

**Manual mining costs:**
- Safe mine: 5 Energy
- Aggressive mine: 10 Energy
- Deep Core mine: 20 Energy

**Passive mining (buildings):**
- Basic Mine at level 1 costs 1 Energy per production tick (every 60 seconds)
- When Energy hits 0, passive mining pauses
- A push notification should fire: "Your mines are idle. Your Commander needs rest."

**Why this works:**
- Player has ~2-4 hours of active mining per session before Energy depletes
- Then they leave. Then they come back.
- This is exactly how Fallen London's Action Point system works — it is the oldest and most effective engagement loop in text RPG design

**Implementation notes:**
- Add `energy: number` and `maxEnergy: number` to `GameState`
- `maxEnergy` starts at 100, increases by 20 per Habitat Dome level
- Add `energyRegenRate: number` (default 10/hour = 0.00278/second)
- Each tick: `energy = Math.min(maxEnergy, energy + energyRegenRate)`
- Before any mining action, check `energy >= cost`. If not, return failure with message: "Your Commander is exhausted. Rest and return."
- Add Energy bar to `ResourceBar.tsx` — amber color, always visible

---

## Phase 3 — Events: Real Consequences, Real Weight

### The Core Problem
Events are currently a list of cards the player clicks through like a form. There is no narrative weight, no delay, no consequence that actually changes the world visually.

### The New Event Architecture

**Events are not resolved instantly. They unfold over time.**

Each event has three phases:

**Phase A — Discovery (immediate)**
The event appears. Player reads the setup. 2–4 paragraphs of lore, not one sentence. The writing must be good. Each event must feel like a chapter of a novel, not a tooltip.

**Phase B — Choice (immediate)**
Player picks one of three options. The choice is logged. The event disappears from the active queue.

**Phase C — Consequence (delayed: 2–24 real hours later)**
The consequence resolves and appears as a new "Report" card. THIS is when resources and reputation change. The delay is the mechanic. The player comes back and finds out what happened.

### Event Data Structure Changes

```typescript
interface GameEvent {
  id: string;
  title: string;
  // Phase A — full narrative. Minimum 3 sentences. Written like prose fiction.
  lore: string;
  // The specific situation demanding a choice
  situation: string;
  choices: EventChoice[];
  type: 'discovery' | 'story' | 'threat' | 'random' | 'report';
  timestamp: number;
  // New fields:
  choiceMade?: string;           // Set when player chooses
  resolveAt?: number;            // Unix ms — when Phase C fires
  resolved?: boolean;
  reportText?: string;           // Written narrative of what happened
  // Long-term flags this event sets
  worldFlags?: string[];         // e.g. ['krenn_warned', 'ai_integrated']
}
```

**WorldFlags** are persistent boolean flags in GameState. Future events check these flags. Example: if `'krenn_warned'` is set, the next Krenn event references that previous encounter. This is how Fallen London builds continuity — every choice leaves a trace.

```typescript
// Add to GameState:
worldFlags: string[];
eventReports: GameEvent[]; // Resolved consequence reports waiting to be read
```

### Event Trigger Rules (replace the current 0.2% random tick)

Events do NOT trigger randomly every tick. They trigger on conditions:

| Trigger | Event Category |
|---|---|
| Era advances | Always triggers a "Chapter" story event |
| New faction discovered | Triggers a first-contact event for that faction |
| Building constructed for first time | Triggers a "colony milestone" event |
| Tech researched | Can trigger a discovery event (30% chance) |
| Player offline > 4 hours | Triggers an "In Your Absence" event on return |
| worldFlag set | Can unlock specific scripted events |
| Every 3rd manual mine in a zone | Small "zone lore" discovery event (one-time per zone) |

Maximum 1 active event at a time. Maximum 1 pending report at a time. Player cannot be overwhelmed.

### Rewrite the 5 Static Events

Each must be rewritten to be 3× longer and have real prose. Example rewrite for Event 1:

**BEFORE:** "Your scanners pick up an encrypted transmission from deep space."

**AFTER:**
```
STRANGE SIGNAL DETECTED

Three nights ago, your communications officer — a young engineer named Kael who 
survived the evacuation by hiding in a cargo module — came to you with shaking hands.

"Commander. I've been running it through every cipher we have. The signal isn't 
random noise. It repeats on a 17-minute cycle, like it's... waiting. Patient."

You listened to the recording together. Clicks and pulses that meant nothing. 
Then, on the fourth replay, Kael went pale.

"That's a distress call structure. Old format — pre-Consolidation, maybe. 
Whoever sent this has been sending it for a very long time."

The signal is still transmitting. You have a decision to make.

[SITUATION]
A repeated, encrypted transmission is emanating from a point 
0.3 light-years distant. Its age and origin are unknown.
```

### The "In Your Absence" Event (new system)

When the player returns after 4+ hours, instead of a "+X resources" popup, they get a narrative report:

```
COMMANDER'S LOG — [Date/Time]

While you were away, [X hours] passed on [Planet Name].

The Basic Mine ran for [Y] hours before the crew needed rest. 
The stockpiles gained [Fe: +N, Si: +N] before the vault started turning 
people away at the door.

Sensor logs show no hostile activity. The sky was clear last night — 
Kael says he counted fourteen stars that don't appear in our charts.
The survivors called it a good omen.

Your Energy has partially restored. The colony is ready when you are.

[CONTINUE]
```

This is generated programmatically from the offline progress calculation, not AI-generated. It should always be readable, specific, and in-character.

---

## Phase 4 — The Commander & Crew System (Character Recruitment)

### What Must Be Built

The player recruits named crew members who matter to the story and affect mechanics.

**Crew Member Data Structure:**
```typescript
interface CrewMember {
  id: string;
  name: string;
  role: 'engineer' | 'scientist' | 'soldier' | 'diplomat' | 'explorer';
  // 2-sentence backstory shown on their profile card
  backstory: string;
  // Their passive bonus — always specific and mechanical
  ability: string;
  abilityEffect: CrewEffect;
  // Changes as they participate in events
  status: 'active' | 'on_mission' | 'injured' | 'lost';
  // Increases through relevant activity. Max 5.
  experienceLevel: number;
  // Events they've been referenced in
  eventHistory: string[];
}

interface CrewEffect {
  type: 'mining_bonus' | 'research_speed' | 'combat_power' | 'energy_regen' | 'event_option';
  value: number;
  // Some crew unlock a 4th choice in specific events
  unlocksEventOption?: string;
}
```

**Starting crew (based on Commander background):**
- Soldier background: Kael (Engineer, +5% mining), Rynn (Soldier, +10 defense)
- Scientist background: Kael (Engineer), Mira (Scientist, +10% research speed)
- Diplomat background: Kael (Engineer), Sorin (Diplomat, unlocks 4th option in faction events)

Kael the Engineer is always present — he's the game's recurring human character who shows up in event lore and "In Your Absence" reports.

**Crew recruitment:**
- New crew members are found through events — not purchased from a shop
- Some are found by researching certain techs (xenobiology → reveals a scientist survivor)
- Some are unlocked by reaching relationship milestones with factions
- Max crew: 8 members

**Crew tab:**
- Add a "Crew" tab to the navigation (replace the current confusing "Intel" tab or fold it in)
- Shows each crew member as a card with portrait icon, name, role, status, experience bar
- Crew members assigned to missions are "on_mission" and unavailable during that time

**Crew in events:**
- If a relevant crew member exists, their name appears in the event lore ("Kael has been studying the signal...")
- If they have the relevant skill, a new choice option appears that they enable
- If a crew member is "on_mission" during a threat event, the event references their absence

---

## Phase 5 — Visual State Must Reflect Game State

This is non-negotiable. Every major milestone must change something visible.

### Planet Screen Changes

The planet visual must evolve. Implement a layered visual system:

**Stage 0 (no buildings):** Barren planet, dark, no structures visible

**Stage 1 (1-2 buildings):** Small light cluster visible on the planet surface. A tiny dome shape.

**Stage 2 (3-5 buildings):** Multiple light clusters. Faint grid lines suggesting structure.

**Stage 3 (6-8 buildings, Era 2+):** Visible base structures. The planet's dark zones have lights.

**Stage 4 (all zones unlocked, Era 3):** The entire planet surface has activity indicators.

This can be implemented using layered SVG overlays or conditional React Native components rendered on top of the planet image. Each stage is a set of additional elements, not a full image swap. The transition should animate when it triggers.

### Building Cards

When a building is at max level, its card must visually distinguish itself:
- Gold border instead of default border
- "MAXIMUM CAPACITY" label replaces the upgrade button entirely
- The upgrade button must not exist — not greyed out, not there
- The icon glows

When a building is level 0, its card shows a ghost/outline version, not a full card with a disabled button.

### Faction Cards

Faction relationship must be immediately readable at a glance:

- Hostile: Red pulsing border, skull indicator
- Neutral: Default grey
- Friendly: Green steady border
- Allied: Gold border, handshake indicator

The faction card should show a visual "trust meter" — a 5-pip display — not just a number.

### Combat & Espionage — Gated by Story Logic

**Current problem:** Players can attack factions they haven't met and run espionage missions that do nothing mechanically.

**Fix:**

Combat is only available after:
1. A faction is discovered (existing system, now properly wired)
2. AND the player has at least 1 military unit
3. AND the relevant story event for that faction has been encountered

Espionage is only available after:
1. Combat has been initiated at least once with that faction
2. AND Xenobiology is researched (establishes formal contact)

Espionage outcomes must now have real mechanical consequences, not just log text:
- Scan Base (success): Reveals exact enemy power for next 3 combats
- Plant Spy (success): Adds 10% to next combat win chance against that faction
- Disrupt (success): Reduces enemy power by 15% for 48 real hours
- Fake Signals (success): Prevents that faction from initiating threat events for 24 real hours

Espionage failures must now have consequences:
- Scout detected: That faction's reputation drops 5, AND a threat event triggers within 2 hours
- Spy captured: Triggers a "Diplomatic Incident" forced event that cannot be ignored
- Saboteur caught: Reputation −15, that faction's enemy power increases 20% for 24 hours
- Deception detected: Prevents future espionage against that faction for 48 real hours

These timers must be stored in `GameState` as `factionModifiers: FactionModifier[]`.

---

## Phase 6 — Economy & Balance Rules

### Credits
- Passive rate stays at 0.25/tick (already fixed in v2)
- Credits must be shown as a whole integer always — never 142.3 credits
- The Trade Nexus should now generate actual credit income: +5 credits per level per minute
- Credits above 10,000 should display as "10.2K" etc.

### Storage
- When storage is 90%+ full, the ResourceBar storage icon should turn amber and pulse
- When storage is 100% full, mining is automatically disabled and a banner appears: "Vaults at capacity. Build or upgrade an Element Vault."
- This is already a bug in v1 that was partially fixed. Ensure it is enforced everywhere.

### Building Costs — Structural Engineering Tech Effect
This tech is now implemented in v2 but was missing before. Verify it applies correctly:
- `buildingCostMultiplier` should be 1.0 by default, 0.8 after Structural Engineering
- Both `constructBuilding` AND `upgradeBuilding` must apply this multiplier
- The building card UI must show the discounted cost in a different color when the tech is active, with a small "(−20%)" label

### Max Level Buildings
- When any upgradeable stat (storage, population, defense) reaches max via a building:
  - The upgrade button permanently disappears
  - The card gains "MAXED" visual treatment
  - A one-time narrative note appears: "The [Building Name] has reached the limits of what current technology allows."
  
### Combat Balance
The enemy power formula in v2 is now correct (scales with era and prestige). One additional rule:

- A faction cannot be fought more than once per 4 real hours
- The combat button shows a cooldown timer if this limit is active: "Fleet recharging — 2h 14m"
- This prevents the current infinite combat spam

---

## Phase 7 — Navigation & UX Cleanup

### Tab Restructure

Replace the current 7 confusing tabs with 5 clear tabs, revealed progressively:

| Tab | Icon | Unlocks at | What it contains |
|---|---|---|---|\
| HOME | Planet | Always | Planet map, mining, element codex |
| BASE | Building | Stage 1 | Buildings, resource overview |
| RESEARCH | Flask | Stage 3 | Tech tree |
| CREW | Users | Stage 4 | Crew members, events log, worldflags |
| COMMAND | Crown | Stage 4 | Factions, combat, espionage, achievements, prestige |

"Events" is not a top-level tab. Events appear as a notification badge on the CREW tab. The event card opens as a modal overlay on top of whatever screen the player is on.

### Resource Bar (always visible)

The top HUD must show exactly: Era indicator, Credits, Energy bar, Population/Max, Storage %.  
Nothing else. No scrolling. No overflow.

### Empty States

Every screen that has no content yet (no buildings, no crew, no factions) must show:
- A specific illustration placeholder (use the existing blueprint aesthetic)
- One clear sentence: what the player needs to do to unlock this
- A direct action button if possible

Example: Buildings tab before Stage 1: "Your survivors are living in the Helios's cargo bay. They need shelter." [Mine Resources First]

---

## Phase 8 — Narrative Writing Standards

Every piece of text the player reads must meet these standards. Share this with whoever writes event content or AI prompts:

**Rule 1: Name your NPCs.** "A scientist" is forgettable. "Mira, your lead xenobiologist" is not.

**Rule 2: Ground events in specifics.** Not "a meteor shower is coming." Instead: "Long-range sensors show 47 objects, the largest approximately 80 meters across, on approach vector 334-delta. Impact in 14 minutes."

**Rule 3: Stakes must be real.** Every threat event should be able to result in actual resource loss, crew injury, or permanent worldFlag consequences.

**Rule 4: The Commander must speak.** Event lore should be written from the perspective of someone describing what the Commander is seeing, hearing, and deciding — not a news report.

**Rule 5: Consequences must be written, not just applied.** When an event resolves (Phase C), write what happened narratively. Don't say "+50 Fe." Say: "The meteor fragments, once properly processed, yielded more than Kael expected. The vaults are heavier for it."

**AI Event Generation — Updated System Prompt:**

The current `generate-event+api.ts` system prompt must be replaced with this:

```
You are the narrative engine for Space Odyssey: Galactic Evolution, a text-based mobile RPG.

Your job is to write one dramatic, narrative-rich event for a player's colony.

TONE: Thoughtful science fiction. Think The Expanse, not Star Wars. Grounded, tense, human.

EVENT STRUCTURE — return ONLY valid JSON, no markdown:
{
  "id": "ai_evt_XXXXX",
  "title": "Title (4-6 words, evocative not generic)",
  "lore": "3-5 sentences of narrative prose. Include at least one named NPC. Ground it in the player's specific situation. Write like a novel, not a tooltip.",
  "situation": "1-2 sentences stating exactly what decision the Commander faces right now.",
  "type": "discovery|story|threat|random",
  "choices": [
    {
      "id": "c1",
      "text": "Action verb phrase (not 'Option 1')",
      "consequence": "1 sentence of what happens — written in past tense as if already done.",
      "reportText": "2-3 sentences written as the delayed consequence report. What the Commander finds out later.",
      "resourceChanges": {"Fe": 50},
      "reputationChange": 0,
      "worldFlag": "optional_flag_string_to_set"
    }
  ],
  "resolveDelayHours": 2
}

RULES:
- Exactly 3 choices
- resourceChanges keys: H, He, Li, C, O, Fe, Cu, Ag, Au, Pt, U, Pu, Ti, Si, Xr7, Nv, or "credits"
- Amounts: -150 to +150 (not 200 — smaller feels more real)
- reputationChange: -20 to +20
- resolveDelayHours: 1, 2, 4, 8, or 12
- worldFlag: snake_case string or omit the field
- One choice may have negative resourceChanges — real decisions have costs
- Do not write "Good news" or "Bad news" — let the player decide
```

---

## Phase 9 — Technical Implementation Checklist

The agent must implement ALL of the following. Check each one off:

**State additions to `GameState`:**
- [ ] `commanderName: string`
- [ ] `planetName: string`
- [ ] `commanderBackground: 'soldier' | 'scientist' | 'diplomat'`
- [ ] `energy: number` (starts at 100)
- [ ] `maxEnergy: number` (starts at 100)
- [ ] `crew: CrewMember[]`
- [ ] `worldFlags: string[]`
- [ ] `eventReports: GameEvent[]`
- [ ] `gameStage: 0 | 1 | 2 | 3 | 4` (progression gate)
- [ ] `factionModifiers: FactionModifier[]` (espionage/combat timers)
- [ ] `lastReturnEvent: string | null` (the "In Your Absence" text, shown once on load)
- [ ] `combatCooldowns: Record<string, number>` (factionId → unix ms of next allowed combat)

**New components to build:**
- [ ] `OnboardingFlow.tsx` — full-screen narrative intro (runs once, sets commander name, planet name, background)
- [ ] `EnergyBar.tsx` — amber progress bar, always in HUD
- [ ] `CrewCard.tsx` — crew member display card
- [ ] `CrewScreen.tsx` — new tab screen
- [ ] `EventModal.tsx` — events appear as modal overlays, not tab screens
- [ ] `ReportCard.tsx` — Phase C consequence cards
- [ ] `InYourAbsenceModal.tsx` — the narrative offline report shown on load

**Existing screens to modify:**
- [ ] `planet.tsx` — add layered visual state system (4 visual stages), add Energy cost to mining buttons
- [ ] `buildings.tsx` — add "MAXED" state, remove upgrade button at max level, show discount when structural_engineering active
- [ ] `events.tsx` — rewrite entirely to be a log/report view, not the primary event interaction point (events interact via EventModal)
- [ ] `combat.tsx` — add faction cooldown, add prereq gates, add espionage mechanical consequences
- [ ] `_layout.tsx` — add `InYourAbsenceModal` on load if offline > 4 hours
- [ ] `GameContext.tsx` — add Energy system, add `gameStage` gate logic, add `worldFlags`, add delayed event resolution, add `factionModifiers` expiry tick

**Tick loop additions:**
- [ ] Energy regeneration: `energy = Math.min(maxEnergy, energy + 0.00278)` per second
- [ ] `factionModifiers` expiry check: remove expired modifiers each tick
- [ ] Delayed event resolution: check `eventReports` for events where `resolveAt <= Date.now()` and fire consequences

**Remove or gate:**
- [ ] Remove all tab navigation that is visible before its unlock stage
- [ ] Remove the ability to run espionage before Xenobiology is researched
- [ ] Remove the ability to attack before military units exist AND faction is discovered
- [ ] Remove the upgrade button (not disable — remove) when building is at max level
- [ ] Remove the "Scan for Signals" button when an event is already active

---

## What Not to Change

- The blueprint aesthetic (dark blue, grid, monospace font) — this is the game's identity. Keep it.
- The `applyProgression()` architecture introduced in v2 — it is clean and correct
- The `stateRef` autosave pattern — correct, keep it
- The AI event API route structure — update the prompt only, not the plumbing
- The prestige system — it works. Leave it.
- The element codex — the 16 elements and their data are fine
- The `deriveRelationship()` function — correct, keep it

---

## Definition of Done

The redesign is complete when a brand-new player can:

1. Launch the game and see the narrative intro before any UI
2. Name their Commander and choose a background
3. Understand their first action without reading any documentation
4. Run out of Energy after a session and understand why they should return
5. Encounter their first event as a modal with real narrative prose
6. Wait for the event consequence to resolve (come back hours later)
7. See their planet look visually different after building 3 structures
8. Discover a faction through story logic, not by clicking a tab
9. Attempt combat, be told they need military units first, build them, then fight
10. Reach Era 2 and see a "Chapter 2" narrative moment

If all 10 of these are true, the game is a game. Right now, it is a dashboard.

---

*End of prompt. Give this entire document to the coding agent. Do not summarize.*
