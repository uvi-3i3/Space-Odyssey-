import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Element, Building, Technology, GameEvent, EventChoice, Faction, Achievement,
  PlanetZone, RelationshipTier, deriveRelationship,
  INITIAL_ELEMENTS, INITIAL_BUILDINGS, INITIAL_TECHNOLOGIES,
  INITIAL_FACTIONS, INITIAL_ACHIEVEMENTS, PLANET_ZONES, NARRATIVE_EVENTS,
  StabilityTier, getStabilityTier, getStabilityProductionMultiplier,
  STABILITY_HIT_BY_MINING, STABILITY_BASELINE, STABILITY_REGEN_PER_TICK,
  AUTO_MINER_COST, AUTO_MINER_INTERVAL_SEC,
} from '@/constants/gameData';
import { STORY_TREE, StoryNode } from '@/constants/storyData';

const STORAGE_KEY = '@space_odyssey_save';
const TICK_INTERVAL = 1000;

export interface GameState {
  era: number;
  credits: number;
  prestigePoints: number;
  prestigeLevel: number;
  population: number;
  maxPopulation: number;
  defensePower: number;
  miningMultiplier: number;
  researchSpeed: number;
  combatMultiplier: number;
  buildingCostMultiplier: number;
  elements: Element[];
  buildings: Building[];
  technologies: Technology[];
  factions: Faction[];
  achievements: Achievement[];
  activeEvents: GameEvent[];
  completedEvents: string[];
  eventLog: EventResolution[];
  planetZones: PlanetZone[];
  lastSave: number;
  totalPlayTime: number;
  loginStreak: number;
  lastLoginDate: string;
  dailyRewardClaimed: boolean;
  currentResearch: string | null;
  researchProgress: number;
  combatLog: CombatEntry[];
  espionageLog: EspionageEntry[];
  units: FleetUnit[];
  storageCapacity: number;
  activeTab: string;
  /** Phase 4 — civilization stability (0-100). Drives production multiplier. */
  stability: number;
  /** Phase 4 — total Auto-Miners the player owns (deployed + idle). */
  autoMinersOwned: number;
  /** Phase 4 — Auto-Miners deployed per zone. Sum cannot exceed autoMinersOwned. */
  autoMinersAssigned: Record<string, number>;
  /**
   * Phase 4 — wallclock-style accumulator: each Auto-Miner's tick fraction is
   * added here per second. When the per-zone bucket crosses 1.0, one yield
   * fires and the bucket subtracts 1. Persisted so deploys/refreshes don't
   * reset progress mid-cycle.
   */
  autoMinerProgress: Record<string, number>;
  /**
   * Phase 5 — pointer into the pre-generated branching campaign in
   * `STORY_TREE`. Each call to `generateEvent` reads this node and pushes it
   * as the next active event. Each `resolveEvent` advances it to the chosen
   * branch's `nextNodeId` (or `'END'` when the campaign is complete).
   */
  currentStoryNodeId: string;
}

export interface CombatEntry {
  id: string;
  factionId: string;
  type: 'attack' | 'defend';
  outcome: 'win' | 'loss' | 'draw';
  timestamp: number;
  details: string;
}

export interface EventResolution {
  id: string;
  eventId: string;
  eventTitle: string;
  eventType: 'random' | 'story' | 'discovery' | 'threat';
  choiceId: string;
  choiceText: string;
  consequence: string;
  resourceChanges: Record<string, number>;
  reputationChange: number;
  critical: boolean;
  netScore: number;
  timestamp: number;
}

export interface EspionageEntry {
  id: string;
  factionId: string;
  mission: string;
  success: boolean;
  timestamp: number;
  details: string;
}

export interface FleetUnit {
  id: string;
  type: 'fighter' | 'bomber' | 'capital' | 'scout';
  name: string;
  count: number;
  attack: number;
  defense: number;
  cost: Record<string, number>;
}

const DEFAULT_UNITS: FleetUnit[] = [
  { id: 'fighter', type: 'fighter', name: 'Fighter', count: 0, attack: 10, defense: 5, cost: { Fe: 20, Cu: 10 } },
  { id: 'bomber', type: 'bomber', name: 'Bomber', count: 0, attack: 25, defense: 3, cost: { Fe: 40, Ti: 15 } },
  { id: 'capital', type: 'capital', name: 'Capital Ship', count: 0, attack: 60, defense: 40, cost: { Fe: 100, Ti: 50, Au: 20 } },
  { id: 'scout', type: 'scout', name: 'Scout', count: 0, attack: 5, defense: 8, cost: { Fe: 15, Si: 10 } },
];

const initialState: GameState = {
  era: 1,
  // Phase 2 — early-game starter buffer so the player can afford the first
  // building or two before passive income kicks in.
  credits: 250,
  prestigePoints: 0,
  prestigeLevel: 0,
  population: 10,
  maxPopulation: 50,
  defensePower: 10,
  miningMultiplier: 1.0,
  researchSpeed: 1.0,
  combatMultiplier: 1.0,
  buildingCostMultiplier: 1.0,
  elements: INITIAL_ELEMENTS,
  buildings: INITIAL_BUILDINGS,
  technologies: INITIAL_TECHNOLOGIES,
  factions: INITIAL_FACTIONS,
  achievements: INITIAL_ACHIEVEMENTS,
  activeEvents: [],
  completedEvents: [],
  eventLog: [],
  planetZones: PLANET_ZONES,
  lastSave: Date.now(),
  totalPlayTime: 0,
  loginStreak: 1,
  lastLoginDate: new Date().toDateString(),
  dailyRewardClaimed: false,
  currentResearch: null,
  researchProgress: 0,
  combatLog: [],
  espionageLog: [],
  units: DEFAULT_UNITS,
  // Phase 2 — early-game vault buffer (was 1000) so newly mined elements have
  // somewhere to go before the player can build/upgrade an Element Vault.
  storageCapacity: 2000,
  activeTab: 'planet',
  // Phase 4 — start at full stability so the player feels safe before they
  // begin choosing risky mining protocols.
  stability: 100,
  // Phase 4 — give the player one Auto-Miner already deployed on Zone 1 as a
  // tutorial. They watch passive yield trickle in immediately, learning the
  // "managed setup" loop before they ever tap-to-mine.
  autoMinersOwned: 1,
  autoMinersAssigned: { zone_1: 1 },
  autoMinerProgress: { zone_1: 0 },
  // Phase 5 — every brand-new player starts at the root of the campaign.
  currentStoryNodeId: STORY_TREE.rootNodeId,
};

// ---------------------------------------------------------------------------
// Phase 1 — pure progression helpers.
// All helpers are pure (state in, state out) and module-scoped so they can be
// composed inside setState(prev => ...) callbacks without stale closures.
// ---------------------------------------------------------------------------

function isResearched(s: GameState, techId: string): boolean {
  return s.technologies.find(t => t.id === techId)?.researched ?? false;
}

/** Recompute every tech-derived multiplier from scratch off the tech list. */
function recomputeDerivedStats(s: GameState): GameState {
  let mining = 1.0;
  if (isResearched(s, 'basic_mining')) mining *= 1.25;
  if (isResearched(s, 'advanced_mining')) mining *= 2.0;

  let research = 1.0;
  if (isResearched(s, 'quantum_research')) research *= 1.5;

  let combat = 1.0;
  if (isResearched(s, 'plasma_weapons')) combat *= 1.4;

  let buildCost = 1.0;
  if (isResearched(s, 'structural_engineering')) buildCost *= 0.8;

  if (
    s.miningMultiplier === mining &&
    s.researchSpeed === research &&
    s.combatMultiplier === combat &&
    s.buildingCostMultiplier === buildCost
  ) return s;

  return {
    ...s,
    miningMultiplier: mining,
    researchSpeed: research,
    combatMultiplier: combat,
    buildingCostMultiplier: buildCost,
  };
}

/** Unlock zones 4–8 as their gating techs are completed. */
function applyZoneUnlocks(s: GameState): GameState {
  const unlockMap: Record<string, boolean> = {
    zone_4: isResearched(s, 'element_scanner'),
    zone_5: isResearched(s, 'element_scanner'),
    zone_6: isResearched(s, 'deep_drilling'),
    zone_7: isResearched(s, 'advanced_mining'),
    zone_8: isResearched(s, 'warp_drive'),
  };
  let changed = false;
  const zones = s.planetZones.map(z => {
    if (z.unlocked) return z;
    if (unlockMap[z.id]) {
      changed = true;
      return { ...z, unlocked: true };
    }
    return z;
  });
  return changed ? { ...s, planetZones: zones } : s;
}

/** Advance state.era when every tech in the current era is researched. */
function applyEraProgression(s: GameState): GameState {
  let era = s.era;
  while (era < 4) {
    const eraTechs = s.technologies.filter(t => t.era === era);
    if (eraTechs.length === 0) break;
    if (!eraTechs.every(t => t.researched)) break;
    era += 1;
  }
  if (era === s.era) return s;
  const achievements = s.achievements.map(a =>
    a.id === 'era_2' && era >= 2 && !a.unlocked
      ? { ...a, progress: 1, unlocked: true }
      : a,
  );
  return { ...s, era, achievements };
}

/** Reveal factions based on era + tech triggers (event-based reveal handled inline). */
function applyFactionDiscovery(s: GameState): GameState {
  let factions = s.factions;
  let changed = false;

  // Era 2 — the Zorathi (scientific scanners) make first contact.
  if (s.era >= 2) {
    const zIdx = factions.findIndex(f => f.id === 'zorathi');
    if (zIdx >= 0 && !factions[zIdx].discovered) {
      factions = factions.map(f => f.id === 'zorathi' ? { ...f, discovered: true } : f);
      changed = true;
    }
  }

  // Xenobiology — formal diplomacy reveals every faction.
  if (isResearched(s, 'xenobiology') && factions.some(f => !f.discovered)) {
    factions = factions.map(f => f.discovered ? f : { ...f, discovered: true });
    changed = true;
  }

  return changed ? { ...s, factions } : s;
}

/** Single composite call: run after any change that may affect tech-driven progression. */
function applyProgression(s: GameState): GameState {
  let next = recomputeDerivedStats(s);
  next = applyZoneUnlocks(next);
  next = applyEraProgression(next);
  next = applyFactionDiscovery(next);
  return next;
}

// ---------------------------------------------------------------------------
// Phase 4 — Stability + Auto-Miner pure helpers.
// These are tick-loop primitives. Each takes (state, optional seconds) and
// returns a new state; never mutates. Composed inside the tick callback and
// inside applyOfflineProgress so passive systems behave identically online
// and offline.
// ---------------------------------------------------------------------------

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Drift stability gently back toward the baseline when nothing is hurting it. */
function applyStabilityRegen(s: GameState, seconds: number): GameState {
  if (seconds <= 0) return s;
  const delta = STABILITY_REGEN_PER_TICK * seconds;
  // Move toward baseline from either direction; never overshoot.
  let next = s.stability;
  if (next < STABILITY_BASELINE) {
    next = Math.min(STABILITY_BASELINE, next + delta);
  } else if (next > STABILITY_BASELINE) {
    next = Math.max(STABILITY_BASELINE, next - delta * 0.5);
  } else {
    return s;
  }
  if (next === s.stability) return s;
  return { ...s, stability: next };
}

/**
 * Apply Auto-Miner production for `seconds` seconds. Each Auto-Miner generates
 * 1 unit / AUTO_MINER_INTERVAL_SEC, multiplied by stability + tech mining
 * multipliers. Yield rotates through the zone's elements so all of them grow
 * roughly evenly (not just the first one). Storage cap is enforced per element.
 *
 * Uses `autoMinerProgress` as a fractional accumulator so we don't lose yield
 * when seconds < AUTO_MINER_INTERVAL_SEC (the normal 1s tick case).
 */
function applyAutoMinerProduction(s: GameState, seconds: number): GameState {
  if (seconds <= 0) return s;
  const stabMult = getStabilityProductionMultiplier(s.stability);
  const prestigeMult = 1 + s.prestigeLevel * 0.1;
  // unitsPerSec for ONE auto-miner, before zone-count multiplication
  const unitsPerSec = (1 / AUTO_MINER_INTERVAL_SEC) * stabMult * s.miningMultiplier * prestigeMult;

  const elems = [...s.elements];
  const progress: Record<string, number> = { ...s.autoMinerProgress };
  let changed = false;

  for (const zone of s.planetZones) {
    const count = s.autoMinersAssigned[zone.id] ?? 0;
    if (count <= 0 || !zone.unlocked) continue;

    const accrued = (progress[zone.id] ?? 0) + unitsPerSec * count * seconds;
    const yieldUnits = Math.floor(accrued);
    progress[zone.id] = accrued - yieldUnits;
    if (yieldUnits <= 0) continue;

    // Distribute the yield round-robin across the zone's element list so a
    // 3-element zone with 6 yield grants +2 of each, not +6 of the first one.
    for (let i = 0; i < yieldUnits; i++) {
      const elemId = zone.elements[i % zone.elements.length];
      const idx = elems.findIndex(e => e.id === elemId);
      if (idx < 0) continue;
      const newQty = Math.min(elems[idx].quantity + 1, s.storageCapacity);
      if (newQty !== elems[idx].quantity) {
        elems[idx] = { ...elems[idx], quantity: newQty, discovered: true };
        changed = true;
      }
    }
  }

  if (!changed && progress === s.autoMinerProgress) return s;
  return { ...s, elements: elems, autoMinerProgress: progress };
}

/** How many Auto-Miners are currently deployed across all zones. */
function deployedAutoMinerCount(s: GameState): number {
  return Object.values(s.autoMinersAssigned).reduce((a, b) => a + (b || 0), 0);
}

interface GameContextType {
  state: GameState;
  mineZone: (zoneId: string, miningType: 'safe' | 'aggressive' | 'deep') => { success: boolean; rewards: Record<string, number>; message: string };
  constructBuilding: (buildingId: string) => { success: boolean; message: string };
  upgradeBuilding: (buildingId: string) => { success: boolean; message: string };
  demolishBuilding: (buildingId: string) => void;
  startResearch: (techId: string) => { success: boolean; message: string };
  resolveEvent: (eventId: string, choiceId: string) => EventResolution | null;
  engageCombat: (factionId: string, strategy: 'attack' | 'defend' | 'retreat') => CombatEntry;
  runEspionage: (factionId: string, mission: 'scan' | 'spy' | 'disrupt' | 'fake') => EspionageEntry;
  claimDailyReward: () => { success: boolean; rewards: Record<string, number> };
  performPrestige: () => void;
  recruitUnits: (unitId: string, count: number) => { success: boolean; message: string };
  getElementQuantity: (elementId: string) => number;
  getBuilding: (buildingId: string) => Building | undefined;
  getTech: (techId: string) => Technology | undefined;
  /** Phase 2 — derived live from `faction.reputation`; never store this. */
  getFactionRelationship: (factionId: string) => RelationshipTier;
  generateEvent: () => void;
  generatingEvent: boolean;
  /** Phase 3 — most recent save/load error, or null. UI surfaces via banner. */
  lastError: string | null;
  clearError: () => void;
  // Phase 4 — Stability + Auto-Miner public API.
  /** Buys one Auto-Miner using credits. Doesn't auto-deploy. */
  buyAutoMiner: () => { success: boolean; message: string };
  /** Deploys one idle Auto-Miner to the given unlocked zone. */
  assignAutoMiner: (zoneId: string) => { success: boolean; message: string };
  /** Recalls one Auto-Miner from the given zone back into the idle pool. */
  unassignAutoMiner: (zoneId: string) => { success: boolean; message: string };
  /** Total Auto-Miners currently deployed across all zones (derived). */
  deployedAutoMiners: number;
  /** Stability tier ('high' | 'medium' | 'low' | 'critical') — derived live. */
  stabilityTier: StabilityTier;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const [generatingEvent, setGeneratingEvent] = useState(false);
  // Phase 3 — `lastError` surfaces save/load failures to the UI via the root
  // layout's `<SaveErrorBanner />`. Previously these were silently swallowed.
  const [lastError, setLastError] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Phase 3 — `stateRef` lets the autosave interval and async callbacks read
  // the latest committed state without subscribing to it as a dep. Re-
  // subscribing on every state change broke the 30s autosave entirely (the
  // interval was destroyed before it could ever fire).
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const clearError = useCallback(() => setLastError(null), []);

  useEffect(() => {
    loadGame();
  }, []);

  const loadGame = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GameState;
        if (!parsed.eventLog) parsed.eventLog = [];
        if (parsed.combatMultiplier == null) parsed.combatMultiplier = 1.0;
        if (parsed.buildingCostMultiplier == null) parsed.buildingCostMultiplier = 1.0;
        // Phase 4 — back-compat defaults so older saves load cleanly. New
        // players start at full stability with one tutorial Auto-Miner.
        if (parsed.stability == null) parsed.stability = 100;
        if (parsed.autoMinersOwned == null) parsed.autoMinersOwned = 1;
        if (parsed.autoMinersAssigned == null) parsed.autoMinersAssigned = { zone_1: 1 };
        if (parsed.autoMinerProgress == null) parsed.autoMinerProgress = {};
        // Phase 5 — back-compat: pre-Phase-5 saves have no story pointer.
        // Drop them at the campaign root, OR clamp invalid ids to root, OR
        // honour 'END' if they already finished.
        if (
          parsed.currentStoryNodeId == null ||
          (parsed.currentStoryNodeId !== STORY_TREE.endNodeId &&
            !STORY_TREE.nodesById[parsed.currentStoryNodeId])
        ) {
          parsed.currentStoryNodeId = STORY_TREE.rootNodeId;
        }
        const offlineTime = (Date.now() - parsed.lastSave) / 1000;
        const cappedTime = Math.min(offlineTime, 86400);
        let loaded = applyOfflineProgress(parsed, cappedTime);
        // Re-derive every tech-driven multiplier and unlock state from the
        // saved tech list, in case formulas changed since the save was written.
        loaded = applyProgression(loaded);
        const today = new Date().toDateString();
        if (loaded.lastLoginDate !== today) {
          const yesterday = new Date(Date.now() - 86400000).toDateString();
          const streak = loaded.lastLoginDate === yesterday ? loaded.loginStreak + 1 : 1;
          loaded.loginStreak = streak;
          loaded.lastLoginDate = today;
          loaded.dailyRewardClaimed = false;
        }
        setState(loaded);
      }
    } catch (err) {
      // Phase 3 — surface load failures instead of swallowing them. The save
      // is likely corrupt; the player keeps playing on default state but at
      // least sees what happened.
      console.error('[GameContext] loadGame failed:', err);
      setLastError('Save file could not be loaded — starting a new game state.');
    }
  };

  const applyOfflineProgress = (s: GameState, seconds: number): GameState => {
    let updated: GameState = { ...s };
    const stabMult = getStabilityProductionMultiplier(updated.stability);
    const mineBuildings = s.buildings.filter(b => b.type === 'mine' && b.level > 0);
    const mineMultiplier = 1 + (s.prestigeLevel * 0.1);
    const elems = [...s.elements];
    for (const building of mineBuildings) {
      // Phase 2 — honour the tech-driven mining multiplier offline so
      // researched techs feel real after coming back from a session.
      // Phase 4 — also honour the stability production multiplier so a
      // crashed civilization actually loses production while you're away.
      const rate = building.productionRate * building.level * mineMultiplier * s.miningMultiplier * stabMult;
      const totalGained = Math.floor(rate * seconds / 60);
      if (totalGained > 0) {
        const zone = PLANET_ZONES[0];
        const perElem = Math.floor(totalGained / zone.elements.length);
        for (const elemId of zone.elements) {
          const idx = elems.findIndex(e => e.id === elemId);
          if (idx >= 0) {
            // Phase 2 — strictly enforce vault capacity offline, mirroring the
            // online tick. Otherwise long offline sessions blew past storage.
            const newQty = Math.min(elems[idx].quantity + perElem, s.storageCapacity);
            elems[idx] = { ...elems[idx], quantity: newQty };
          }
        }
      }
    }
    updated.elements = elems;
    updated.credits = Math.min(updated.credits + Math.floor(seconds * 0.5), 999999);
    // Phase 4 — Auto-Miners produce while you're away too. Stability also
    // drifts back toward the baseline. Both routed through the same pure
    // helpers used inside the live tick so behaviour is identical.
    updated = applyStabilityRegen(updated, seconds);
    updated = applyAutoMinerProduction(updated, seconds);
    return updated;
  };

  const saveGame = useCallback(async (s: GameState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, lastSave: Date.now() }));
    } catch (err) {
      // Phase 3 — surface save failures so players know their progress isn't
      // being persisted (e.g., quota exceeded, storage permission revoked).
      console.error('[GameContext] saveGame failed:', err);
      setLastError('Save failed — your latest progress may not persist. Try again or free up device storage.');
    }
  }, []);

  const tick = useCallback(() => {
    setState(prev => {
      let updated: GameState = { ...prev };
      // Phase 4 — stability multiplier scales BOTH mine buildings AND every
      // auto-miner. Computed once per tick off the start-of-tick stability
      // value (regen is applied at the end of the tick, deliberately).
      const stabMult = getStabilityProductionMultiplier(prev.stability);
      const mineBuildings = prev.buildings.filter(b => b.type === 'mine' && b.level > 0);
      const mineMultiplier = 1 + (prev.prestigeLevel * 0.1);
      const elems = [...prev.elements];
      for (const building of mineBuildings) {
        const rate = building.productionRate * building.level * mineMultiplier * prev.miningMultiplier * stabMult;
        if (Math.random() < rate / 60) {
          const zone = PLANET_ZONES[0];
          for (const elemId of zone.elements) {
            const idx = elems.findIndex(e => e.id === elemId);
            if (idx >= 0 && elems[idx].quantity < prev.storageCapacity) {
              elems[idx] = { ...elems[idx], quantity: elems[idx].quantity + 1 };
            }
          }
        }
      }
      updated.elements = elems;
      // Phase 2 — modest passive credit bump (was 0.1/sec) to ease the early-
      // game credit wall before Trade Nexus and refinery income come online.
      updated.credits = Math.min(prev.credits + 0.25, 999999);
      updated.totalPlayTime = prev.totalPlayTime + 1;

      let researchCompleted = false;
      if (prev.currentResearch) {
        const techIdx = prev.technologies.findIndex(t => t.id === prev.currentResearch);
        if (techIdx >= 0) {
          const tech = prev.technologies[techIdx];
          const newProgress = prev.researchProgress + prev.researchSpeed;
          if (newProgress >= tech.researchTime) {
            const techs = [...prev.technologies];
            techs[techIdx] = { ...tech, researched: true };
            updated.technologies = techs;
            updated.currentResearch = null;
            updated.researchProgress = 0;
            researchCompleted = true;
          } else {
            updated.researchProgress = newProgress;
          }
        }
      }

      // Phase 5 — autospawn the next pre-generated story node at a low rate
      // so a player who never taps "Tune Array" still encounters the campaign
      // organically. The whole branching tree is now sourced from
      // `STORY_TREE`; the legacy `NARRATIVE_EVENTS` array is retained only as
      // a type/example reference and is no longer surfaced to the player.
      if (
        Math.random() < 0.002 &&
        prev.activeEvents.length === 0 &&
        prev.currentStoryNodeId !== STORY_TREE.endNodeId
      ) {
        const node = STORY_TREE.nodesById[prev.currentStoryNodeId];
        if (node) {
          updated.activeEvents = [storyNodeToGameEvent(node)];
        }
      }

      // When research finishes mid-tick, recompute all tech-driven derived
      // stats, zone unlocks, era advancement, and faction discovery in one pass.
      if (researchCompleted) {
        updated = applyProgression(updated);
      }
      // Phase 4 — Auto-Miner production runs every tick (1s of game time).
      // Stability regen ALSO runs every tick (drift toward baseline). Both
      // helpers are pure and capacity-aware.
      updated = applyAutoMinerProduction(updated, 1);
      updated = applyStabilityRegen(updated, 1);
      return updated;
    });
  }, []);

  // Phase 3 — tick is dependency-free (`useCallback(..., [])`) and reads
  // everything through `setState(prev => …)`, so the interval can be set up
  // once on mount instead of being torn down/rebuilt on every build, research,
  // or prestige change. Previously this caused tick drift right after any
  // action that mutated those slices. Placed *after* `tick` is declared to
  // avoid the temporal-dead-zone reference.
  useEffect(() => {
    tickRef.current = setInterval(tick, TICK_INTERVAL);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [tick]);

  const getElementQuantity = (elementId: string) => {
    return state.elements.find(e => e.id === elementId)?.quantity ?? 0;
  };

  const getBuilding = (buildingId: string) => state.buildings.find(b => b.id === buildingId);
  const getTech = (techId: string) => state.technologies.find(t => t.id === techId);
  const getFactionRelationship = (factionId: string): RelationshipTier => {
    const f = state.factions.find(x => x.id === factionId);
    return deriveRelationship(f?.reputation ?? 0);
  };

  const canAfford = (cost: Record<string, number>, elements: Element[], credits: number): boolean => {
    return Object.entries(cost).every(([id, amount]) => {
      if (id === 'credits') return credits >= amount;
      const elem = elements.find(e => e.id === id);
      return elem ? elem.quantity >= amount : false;
    });
  };

  const deductCost = (cost: Record<string, number>, elements: Element[], credits: number): { elements: Element[]; credits: number } => {
    let newCredits = credits;
    const newElems = elements.map(e => {
      if (cost[e.id]) return { ...e, quantity: e.quantity - cost[e.id] };
      return e;
    });
    if (cost['credits']) newCredits -= cost['credits'];
    return { elements: newElems, credits: newCredits };
  };

  // Phase 3 — all action callbacks moved to `[]` deps. State is read via
  // `setState(prev => …)`; return values are captured through an outer `let`
  // (React's setState updater is invoked synchronously, so the outer closure
  // is populated before the function returns).
  const mineZone = useCallback((zoneId: string, miningType: 'safe' | 'aggressive' | 'deep') => {
    let result: { success: boolean; rewards: Record<string, number>; message: string } = {
      success: false, rewards: {}, message: 'Zone not accessible',
    };
    setState(prev => {
      const zone = prev.planetZones.find(z => z.id === zoneId);
      if (!zone || !zone.unlocked) return prev;

      const now = Date.now();
      const cooldown = miningType === 'safe' ? 3000 : miningType === 'aggressive' ? 2000 : 5000;
      if (now - zone.lastMined < cooldown) {
        result = { success: false, rewards: {}, message: 'Zone cooling down...' };
        return prev;
      }

      const riskMap = { safe: 0, aggressive: 0.25, deep: 0.5 };
      const multiplierMap = { safe: 1, aggressive: 2.5, deep: 5 };
      const risk = riskMap[miningType];
      // Phase 4 — stability boosts/penalises manual yield in addition to the
      // existing tech + prestige multipliers. Spamming Aggressive while in
      // the LOW tier means you mine half as much AND lose more stability.
      const stabMult = getStabilityProductionMultiplier(prev.stability);
      const mult = multiplierMap[miningType] * prev.miningMultiplier * (1 + prev.prestigeLevel * 0.1) * stabMult;

      // Phase 4 — stability cost charged regardless of success: the dangerous
      // protocol was used, the empire bears the cost either way. Clamped 0-100.
      const stabilityHit = STABILITY_HIT_BY_MINING[miningType];
      const newStability = clamp(prev.stability - stabilityHit, 0, 100);
      const stabSuffix = stabilityHit > 0 ? ` (-${stabilityHit} stability)` : '';

      if (Math.random() < risk) {
        const failMsg = miningType === 'deep'
          ? 'Cave collapse! Nothing recovered.'
          : 'Mining accident! No yield.';
        result = { success: false, rewards: {}, message: failMsg + stabSuffix };
        return {
          ...prev,
          stability: newStability,
          planetZones: prev.planetZones.map(z => z.id === zoneId ? { ...z, lastMined: now } : z),
        };
      }

      const rewards: Record<string, number> = {};
      for (const elemId of zone.elements) {
        const elem = prev.elements.find(e => e.id === elemId);
        if (!elem) continue;
        const base = Math.floor(zone.baseYield * mult * (Math.random() * 0.5 + 0.75));
        rewards[elemId] = Math.max(1, base);
      }

      if (miningType === 'deep' && Math.random() < 0.15) {
        const undiscovered = prev.elements.filter(e => !e.discovered);
        if (undiscovered.length > 0) {
          const newElem = undiscovered[Math.floor(Math.random() * undiscovered.length)];
          rewards[newElem.id] = (rewards[newElem.id] ?? 0) + Math.floor(Math.random() * 10) + 1;
        }
      }

      const elems = prev.elements.map(e => {
        if (!rewards[e.id]) return e;
        const newQty = Math.min(e.quantity + rewards[e.id], prev.storageCapacity);
        return { ...e, quantity: newQty, discovered: true };
      });
      const zones = prev.planetZones.map(z => z.id === zoneId ? { ...z, lastMined: now } : z);
      const updatedAchievements = checkAchievements(prev.achievements, elems, prev.buildings, prev.technologies);

      result = { success: true, rewards, message: 'Mined successfully!' + stabSuffix };
      return { ...prev, stability: newStability, elements: elems, planetZones: zones, achievements: updatedAchievements };
    });
    return result;
  }, []);

  // -------------------------------------------------------------------------
  // Phase 4 — Auto-Miner actions.
  // Buy: spend credits, increase the owned pool. Doesn't auto-deploy — the
  // player decides where to put it. Assign/unassign just shuffles the pool
  // between deployed and idle.
  // -------------------------------------------------------------------------

  const buyAutoMiner = useCallback(() => {
    let result: { success: boolean; message: string } = { success: false, message: 'Could not buy Auto-Miner' };
    setState(prev => {
      if (prev.credits < AUTO_MINER_COST) {
        result = { success: false, message: `Need ${AUTO_MINER_COST} credits` };
        return prev;
      }
      result = { success: true, message: `Auto-Miner purchased — ${prev.autoMinersOwned + 1} owned` };
      return { ...prev, credits: prev.credits - AUTO_MINER_COST, autoMinersOwned: prev.autoMinersOwned + 1 };
    });
    return result;
  }, []);

  const assignAutoMiner = useCallback((zoneId: string) => {
    let result: { success: boolean; message: string } = { success: false, message: 'Cannot deploy here' };
    setState(prev => {
      const zone = prev.planetZones.find(z => z.id === zoneId);
      if (!zone || !zone.unlocked) {
        result = { success: false, message: 'Zone not accessible' };
        return prev;
      }
      const deployed = deployedAutoMinerCount(prev);
      if (deployed >= prev.autoMinersOwned) {
        result = { success: false, message: 'No idle Auto-Miners — buy or recall one' };
        return prev;
      }
      const next = { ...prev.autoMinersAssigned, [zoneId]: (prev.autoMinersAssigned[zoneId] ?? 0) + 1 };
      result = { success: true, message: 'Auto-Miner deployed' };
      return { ...prev, autoMinersAssigned: next };
    });
    return result;
  }, []);

  const unassignAutoMiner = useCallback((zoneId: string) => {
    let result: { success: boolean; message: string } = { success: false, message: 'No Auto-Miner deployed here' };
    setState(prev => {
      const here = prev.autoMinersAssigned[zoneId] ?? 0;
      if (here <= 0) return prev;
      const next = { ...prev.autoMinersAssigned, [zoneId]: here - 1 };
      // Reset the per-zone fractional accumulator when fully recalled so the
      // next deploy starts from zero rather than inheriting a stale fraction.
      const nextProgress = { ...prev.autoMinerProgress };
      if (next[zoneId] === 0) nextProgress[zoneId] = 0;
      result = { success: true, message: 'Auto-Miner recalled' };
      return { ...prev, autoMinersAssigned: next, autoMinerProgress: nextProgress };
    });
    return result;
  }, []);

  const constructBuilding = useCallback((buildingId: string) => {
    let result: { success: boolean; message: string } = { success: false, message: 'Building not found' };
    setState(prev => {
      const building = prev.buildings.find(b => b.id === buildingId);
      if (!building) return prev;
      if (building.level > 0) {
        result = { success: false, message: 'Already constructed' };
        return prev;
      }

      // Tech-discounted cost (structural_engineering → ×0.8). Floored, min 1 per resource.
      const discountedCost: Record<string, number> = {};
      Object.entries(building.baseCost).forEach(([k, v]) => {
        discountedCost[k] = Math.max(1, Math.floor(v * prev.buildingCostMultiplier));
      });

      if (!canAfford(discountedCost, prev.elements, prev.credits)) {
        result = { success: false, message: 'Insufficient resources' };
        return prev;
      }

      const { elements, credits } = deductCost(discountedCost, prev.elements, prev.credits);
      const buildings = prev.buildings.map(b => b.id === buildingId ? { ...b, level: 1 } : b);
      const storageCapacity = prev.storageCapacity + (buildingId === 'storage_basic' ? 500 : 0);
      const maxPopulation = prev.maxPopulation + (buildingId === 'habitat_basic' ? 20 : 0);
      const defensePower = prev.defensePower + (buildingId === 'defense_basic' ? 25 : 0);
      // Building a Trade Nexus opens commerce with the Vael Merchants.
      const factions = buildingId === 'trade_post'
        ? prev.factions.map(f => f.id === 'vael' && !f.discovered ? { ...f, discovered: true } : f)
        : prev.factions;
      const updatedAchievements = checkAchievements(prev.achievements, elements, buildings, prev.technologies);

      result = { success: true, message: 'Construction complete!' };
      return { ...prev, elements, credits, buildings, storageCapacity, maxPopulation, defensePower, factions, achievements: updatedAchievements };
    });
    return result;
  }, []);

  const upgradeBuilding = useCallback((buildingId: string) => {
    let result: { success: boolean; message: string } = { success: false, message: 'Build it first' };
    setState(prev => {
      const building = prev.buildings.find(b => b.id === buildingId);
      if (!building || building.level === 0) return prev;
      if (building.level >= building.maxLevel) {
        result = { success: false, message: 'Max level reached' };
        return prev;
      }

      const upgradeCost: Record<string, number> = {};
      Object.entries(building.baseCost).forEach(([k, v]) => {
        const scaled = v * Math.pow(building.upgradeMultiplier, building.level) * prev.buildingCostMultiplier;
        upgradeCost[k] = Math.max(1, Math.floor(scaled));
      });

      if (!canAfford(upgradeCost, prev.elements, prev.credits)) {
        result = { success: false, message: 'Insufficient resources' };
        return prev;
      }

      const { elements, credits } = deductCost(upgradeCost, prev.elements, prev.credits);
      const buildings = prev.buildings.map(b => b.id === buildingId ? { ...b, level: b.level + 1 } : b);
      let storageCapacity = prev.storageCapacity;
      let maxPopulation = prev.maxPopulation;
      let defensePower = prev.defensePower;
      if (buildingId === 'storage_basic') storageCapacity += 500;
      if (buildingId === 'habitat_basic') maxPopulation += 20;
      if (buildingId === 'defense_basic') defensePower += 25;

      result = { success: true, message: 'Upgrade complete!' };
      return { ...prev, elements, credits, buildings, storageCapacity, maxPopulation, defensePower };
    });
    return result;
  }, []);

  const demolishBuilding = useCallback((buildingId: string) => {
    setState(prev => {
      const b = prev.buildings.find(x => x.id === buildingId);
      if (!b || b.level === 0) return prev;
      const lvl = b.level;
      // Phase 2 — fully reverse the per-level stat bonuses that construct &
      // upgrade granted, floored at the original baseline so demolishing can
      // never bring a stat below the starting value.
      let storageCapacity = prev.storageCapacity;
      let maxPopulation = prev.maxPopulation;
      let defensePower = prev.defensePower;
      if (buildingId === 'storage_basic') {
        storageCapacity = Math.max(initialState.storageCapacity, storageCapacity - 500 * lvl);
      }
      if (buildingId === 'habitat_basic') {
        maxPopulation = Math.max(initialState.maxPopulation, maxPopulation - 20 * lvl);
      }
      if (buildingId === 'defense_basic') {
        defensePower = Math.max(initialState.defensePower, defensePower - 25 * lvl);
      }
      return {
        ...prev,
        buildings: prev.buildings.map(x => x.id === buildingId ? { ...x, level: 0 } : x),
        storageCapacity,
        maxPopulation,
        defensePower,
      };
    });
  }, []);

  const startResearch = useCallback((techId: string) => {
    let result: { success: boolean; message: string } = { success: false, message: 'Tech not found' };
    setState(prev => {
      if (prev.currentResearch) {
        result = { success: false, message: 'Already researching' };
        return prev;
      }
      const tech = prev.technologies.find(t => t.id === techId);
      if (!tech) return prev;
      if (tech.researched) {
        result = { success: false, message: 'Already researched' };
        return prev;
      }
      const prereqsMet = tech.prerequisites.every(p => prev.technologies.find(t => t.id === p)?.researched);
      if (!prereqsMet) {
        result = { success: false, message: 'Prerequisites not met' };
        return prev;
      }
      if (!canAfford(tech.cost, prev.elements, prev.credits)) {
        result = { success: false, message: 'Insufficient resources' };
        return prev;
      }
      const { elements, credits } = deductCost(tech.cost, prev.elements, prev.credits);
      result = { success: true, message: `Researching ${tech.name}...` };
      return { ...prev, elements, credits, currentResearch: techId, researchProgress: 0 };
    });
    return result;
  }, []);

  const resolveEvent = useCallback((eventId: string, choiceId: string): EventResolution | null => {
    let resolution: EventResolution | null = null;
    setState(prev => {
      const event = prev.activeEvents.find(e => e.id === eventId);
      if (!event) return prev;
      const choice = event.choices.find(c => c.id === choiceId);
      if (!choice) return prev;

      // Compute critical outcome: chance varies by event type.
      const critChanceByType: Record<string, number> = {
        discovery: 0.24, story: 0.18, random: 0.20, threat: 0.16,
      };
      const critical = Math.random() < (critChanceByType[event.type] ?? 0.2);

      // Phase 5 — story-tree events carry rich `effects`; legacy
      // `NARRATIVE_EVENTS` carry only `resourceChanges`/`reputationChange`.
      // Merge both shapes into a single canonical "applied effects" bundle
      // so the rest of the function stays uniform.
      const eff = choice.effects ?? {};
      const baseResourceChanges: Record<string, number> = {
        ...(choice.resourceChanges || {}),
        ...(eff.resourceChanges || {}),
      };

      const finalResourceChanges: Record<string, number> = { ...baseResourceChanges };
      if (critical) {
        Object.keys(finalResourceChanges).forEach(k => {
          const v = finalResourceChanges[k];
          if (v > 0) finalResourceChanges[k] = Math.round(v * 1.6);
          else if (v < 0 && event.type !== 'threat') finalResourceChanges[k] = Math.round(v * 0.4);
        });
        if ((event.type === 'discovery' || event.type === 'story') && Object.keys(finalResourceChanges).length > 0) {
          const rares = prev.elements.filter(e => e.rarity === 'rare' || e.rarity === 'epic');
          if (rares.length > 0) {
            const bonus = rares[Math.floor(Math.random() * rares.length)];
            finalResourceChanges[bonus.id] = (finalResourceChanges[bonus.id] || 0) + (event.type === 'discovery' ? 25 : 15);
          }
        }
      }

      // Phase 5 — for the resolution log we summarise "reputation change" as
      // the sum of all faction deltas (legacy single-faction shape ⊆ this).
      const repChangesByFaction: Record<string, number> = { ...(eff.reputationChanges || {}) };
      const legacyRepChange = critical && choice.reputationChange
        ? Math.round(choice.reputationChange * (choice.reputationChange > 0 ? 1.5 : 0.5))
        : (choice.reputationChange ?? 0);
      const summedFactionRep = Object.values(repChangesByFaction).reduce((a, b) => a + b, 0);
      const finalReputationChange = summedFactionRep + legacyRepChange;

      const resScore = Object.values(finalResourceChanges).reduce((acc, v) => acc + (v > 0 ? 1 : v < 0 ? -1 : 0), 0);
      const netScore = resScore * 5 + finalReputationChange;

      resolution = {
        id: `${eventId}_${Date.now()}`,
        eventId,
        eventTitle: event.title,
        eventType: event.type,
        choiceId,
        choiceText: choice.text,
        consequence: choice.consequence,
        resourceChanges: finalResourceChanges,
        reputationChange: finalReputationChange,
        critical,
        netScore,
        timestamp: Date.now(),
      };

      // ---- Apply resource + credit deltas (clamped at floor 0). ----------
      let elements = [...prev.elements];
      let credits = prev.credits;
      Object.keys(finalResourceChanges).forEach(k => {
        const change = finalResourceChanges[k];
        if (k === 'credits') { credits = Math.max(0, Math.min(999999, credits + change)); return; }
        elements = elements.map(e =>
          e.id === k
            ? { ...e, quantity: Math.max(0, Math.min(prev.storageCapacity, e.quantity + change)) }
            : e,
        );
      });

      // ---- Apply faction reputation changes. ------------------------------
      // Story-tree shape is per-faction; legacy shape is "every faction by N".
      let factions = prev.factions;
      if (Object.keys(repChangesByFaction).length > 0) {
        factions = factions.map(f => repChangesByFaction[f.id]
          ? { ...f, reputation: Math.max(-100, Math.min(100, f.reputation + repChangesByFaction[f.id])) }
          : f);
      }
      if (legacyRepChange) {
        factions = factions.map(f => ({
          ...f, reputation: Math.max(-100, Math.min(100, f.reputation + legacyRepChange)),
        }));
      }

      // Krenn War Fleet event reveals the Krenn Empire on the diplomacy roster.
      if (eventId === 'event_4') {
        factions = factions.map(f => f.id === 'krenn' && !f.discovered ? { ...f, discovered: true } : f);
      }
      // Phase 5 — any story-tree event that pushes Krenn rep also discovers
      // them, so the player can actually see the consequence on the roster.
      if (repChangesByFaction['krenn']) {
        factions = factions.map(f => f.id === 'krenn' && !f.discovered ? { ...f, discovered: true } : f);
      }
      if (repChangesByFaction['vael']) {
        factions = factions.map(f => f.id === 'vael' && !f.discovered ? { ...f, discovered: true } : f);
      }

      // ---- Apply stability / population / defense deltas. -----------------
      const stability = Math.max(0, Math.min(100, prev.stability + (eff.stabilityChange ?? 0)));
      const popDelta = eff.populationChange ?? 0;
      const population = Math.max(0, Math.min(prev.maxPopulation, prev.population + popDelta));
      const defensePower = Math.max(0, prev.defensePower + (eff.defensePowerChange ?? 0));

      // ---- Apply per-building level deltas. -------------------------------
      // Each delta is -1..+1 from the generator, so we clamp at ≥0 and keep
      // the rest of the building record untouched.
      let buildings = prev.buildings;
      const buildingChanges = eff.buildingLevelChanges ?? {};
      if (Object.keys(buildingChanges).length > 0) {
        buildings = buildings.map(b => buildingChanges[b.id]
          ? { ...b, level: Math.max(0, b.level + buildingChanges[b.id]) }
          : b);
      }

      // ---- Advance the story-tree pointer to the chosen branch. -----------
      // `nextNodeId` is only present on story-tree events. Legacy events
      // leave the pointer untouched.
      const nextNodeId = choice.nextNodeId;
      const currentStoryNodeId = nextNodeId
        ? (nextNodeId === STORY_TREE.endNodeId || STORY_TREE.nodesById[nextNodeId]
            ? nextNodeId
            : prev.currentStoryNodeId)
        : prev.currentStoryNodeId;

      return {
        ...prev,
        elements,
        credits,
        factions,
        stability,
        population,
        defensePower,
        buildings,
        currentStoryNodeId,
        activeEvents: prev.activeEvents.filter(e => e.id !== eventId),
        completedEvents: [...prev.completedEvents, eventId],
        eventLog: [resolution, ...prev.eventLog].slice(0, 25),
      };
    });
    return resolution;
  }, []);

  const engageCombat = useCallback((factionId: string, strategy: 'attack' | 'defend' | 'retreat') => {
    let entry: CombatEntry | null = null;
    setState(prev => {
      const faction = prev.factions.find(f => f.id === factionId);
      const rawPower = prev.units.reduce((sum, u) => sum + u.count * (u.attack + u.defense) / 2, 0) + prev.defensePower;
      const playerPower = rawPower * prev.combatMultiplier;

      const eraScale = (prev.era - 1) * 40;
      const prestigeScale = prev.prestigeLevel * 30;
      const repFactor = Math.abs(faction?.reputation ?? 0) * 0.25;
      const personalityMod = faction?.personality === 'militaristic'
        ? 25
        : faction?.personality === 'merchant' ? -10 : 0;
      const enemyPower = Math.max(50, 50 + eraScale + prestigeScale + repFactor + personalityMod);

      let outcome: 'win' | 'loss' | 'draw' = 'draw';
      let details = '';

      if (strategy === 'retreat') {
        details = 'You retreated from battle.';
      } else {
        const stratBonus = strategy === 'attack' ? 1.3 : 0.8;
        const playerEffective = playerPower * stratBonus * (Math.random() * 0.4 + 0.8);
        const enemyEffective = enemyPower * (Math.random() * 0.4 + 0.8);

        if (playerEffective > enemyEffective * 1.2) {
          outcome = 'win';
          details = `Victory! Gained resources and ${faction?.name} reputation.`;
        } else if (enemyEffective > playerEffective * 1.2) {
          outcome = 'loss';
          details = `Defeat. ${faction?.name} forces overwhelmed your fleet.`;
        } else {
          details = 'The battle was inconclusive. Both sides withdrew.';
        }
      }

      entry = {
        id: Date.now().toString(),
        factionId,
        type: strategy === 'defend' ? 'defend' : 'attack',
        outcome,
        timestamp: Date.now(),
        details,
      };

      const reputationChange = outcome === 'win' ? 20 : outcome === 'loss' ? -10 : 0;
      const factions = prev.factions.map(f =>
        f.id === factionId ? { ...f, reputation: Math.max(-100, Math.min(100, f.reputation + reputationChange)) } : f
      );
      const updatedAchievements = outcome === 'win'
        ? checkAchievements(prev.achievements, prev.elements, prev.buildings, prev.technologies, 'combat')
        : prev.achievements;
      return { ...prev, factions, combatLog: [entry, ...prev.combatLog].slice(0, 20), achievements: updatedAchievements };
    });
    return entry as unknown as CombatEntry;
  }, []);

  const runEspionage = useCallback((factionId: string, mission: 'scan' | 'spy' | 'disrupt' | 'fake') => {
    const successRates = { scan: 0.9, spy: 0.6, disrupt: 0.5, fake: 0.7 };
    const success = Math.random() < successRates[mission];
    const missionDescriptions = {
      scan: success ? 'Intel gathered on faction defenses.' : 'Scout was detected and eliminated.',
      spy: success ? 'Agent planted successfully. Gathering intelligence.' : 'Spy was captured. Diplomatic incident.',
      disrupt: success ? 'Production sabotaged. Their output reduced.' : 'Saboteur was caught and executed.',
      fake: success ? 'False signals accepted. Confusion in their command.' : 'Deception detected. They\'re suspicious.',
    };

    const entry: EspionageEntry = {
      id: Date.now().toString(),
      factionId,
      mission,
      success,
      timestamp: Date.now(),
      details: missionDescriptions[mission],
    };

    setState(prev => ({
      ...prev,
      espionageLog: [entry, ...prev.espionageLog].slice(0, 20),
    }));

    return entry;
  }, []);

  const claimDailyReward = useCallback(() => {
    let result: { success: boolean; rewards: Record<string, number> } = { success: false, rewards: {} };
    setState(prev => {
      if (prev.dailyRewardClaimed) return prev;

      const day = Math.min(prev.loginStreak, 7);
      const rewards: Record<string, number> = {};
      if (day < 7) {
        rewards['credits'] = day * 50;
        rewards['Fe'] = day * 20;
      } else {
        rewards['prestigePoints'] = 1;
        rewards['credits'] = 500;
      }

      const elements = prev.elements.map(e => rewards[e.id] ? { ...e, quantity: e.quantity + rewards[e.id] } : e);
      result = { success: true, rewards };
      return {
        ...prev,
        elements,
        credits: prev.credits + (rewards['credits'] ?? 0),
        prestigePoints: prev.prestigePoints + (rewards['prestigePoints'] ?? 0),
        dailyRewardClaimed: true,
      };
    });
    return result;
  }, []);

  const performPrestige = useCallback(() => {
    setState(prev => {
      const prestigeLevel = prev.prestigeLevel + 1;
      const reset: GameState = {
        ...initialState,
        prestigeLevel,
        prestigePoints: prev.prestigePoints + 5,
        loginStreak: prev.loginStreak,
        lastLoginDate: prev.lastLoginDate,
        dailyRewardClaimed: prev.dailyRewardClaimed,
        achievements: prev.achievements.map(a =>
          a.id === 'prestige_1' ? { ...a, unlocked: true, progress: 1 } : a
        ),
      };
      // After reset, derived stats start back at base; applyProgression keeps
      // them in sync (also covers any future tech-preserving prestige rules).
      return applyProgression(reset);
    });
  }, []);

  const recruitUnits = useCallback((unitId: string, count: number) => {
    let result: { success: boolean; message: string } = { success: false, message: 'Unit not found' };
    setState(prev => {
      const unit = prev.units.find(u => u.id === unitId);
      if (!unit) return prev;

      const totalCost: Record<string, number> = {};
      Object.entries(unit.cost).forEach(([k, v]) => { totalCost[k] = v * count; });

      if (!canAfford(totalCost, prev.elements, prev.credits)) {
        result = { success: false, message: 'Insufficient resources' };
        return prev;
      }

      const { elements, credits } = deductCost(totalCost, prev.elements, prev.credits);
      const units = prev.units.map(u => u.id === unitId ? { ...u, count: u.count + count } : u);
      result = { success: true, message: `Recruited ${count} ${unit.name}(s)` };
      return { ...prev, elements, credits, units };
    });
    return result;
  }, []);

  /**
   * Phase 5 — convert a pre-generated `StoryNode` from `STORY_TREE` into the
   * runtime `GameEvent` shape. We stamp a unique id (so the same node can
   * appear twice across a run if the player revisits a branch via prestige)
   * and copy the rich `effects` + `nextNodeId` onto every choice so
   * `resolveEvent` can apply them deterministically.
   */
  const storyNodeToGameEvent = (node: StoryNode): GameEvent => {
    const stamp = Date.now();
    const choices: EventChoice[] = node.choices.map(c => ({
      id: c.id,
      text: c.text,
      consequence: c.consequence,
      // Mirror the most useful effect fields onto the legacy slots so older
      // UI hint code (resourceChanges preview, reputation hint) keeps working
      // without having to know about the rich `effects` shape.
      resourceChanges: c.effects.resourceChanges,
      reputationChange: Object.values(c.effects.reputationChanges || {})
        .reduce((a, b) => a + b, 0) || undefined,
      effects: {
        resourceChanges: c.effects.resourceChanges,
        stabilityChange: c.effects.stabilityChange,
        populationChange: c.effects.populationChange,
        defensePowerChange: c.effects.defensePowerChange,
        reputationChanges: c.effects.reputationChanges,
        buildingLevelChanges: c.effects.buildingLevelChanges,
      },
      nextNodeId: c.nextNodeId,
    }));
    return {
      id: `story_${node.id}_${stamp}`,
      title: node.title,
      description: node.description,
      type: node.type,
      choices,
      timestamp: stamp,
    };
  };

  const generateEvent = useCallback(() => {
    if (generatingEvent) return;

    // Phase 5 — pure local read out of the pre-generated story tree. No
    // network call, no API key required at runtime. The "scanning" pulse
    // still flashes briefly so the player feels the act of tuning in.
    setGeneratingEvent(true);
    const SCAN_DELAY_MS = 600;

    setTimeout(() => {
      setState(prev => {
        // Already an active event in the queue — don't double up.
        if (prev.activeEvents.length > 0) return prev;

        const nodeId = prev.currentStoryNodeId;
        if (nodeId === STORY_TREE.endNodeId) {
          // Campaign complete. Nothing more to enqueue.
          return prev;
        }
        const node = STORY_TREE.nodesById[nodeId];
        if (!node) {
          // Defensive — shouldn't happen because loadGame clamps to root.
          console.warn('[GameContext] Story node missing, resetting to root:', nodeId);
          return { ...prev, currentStoryNodeId: STORY_TREE.rootNodeId };
        }
        const event = storyNodeToGameEvent(node);
        return { ...prev, activeEvents: [...prev.activeEvents, event] };
      });
      setGeneratingEvent(false);
    }, SCAN_DELAY_MS);
  }, [generatingEvent]);

  const checkAchievements = (
    achievements: Achievement[],
    elements: Element[],
    buildings: Building[],
    technologies: Technology[],
    trigger?: string
  ): Achievement[] => {
    return achievements.map(a => {
      if (a.unlocked) return a;
      let progress = a.progress;
      // Explicit annotation: after the early-return above, TS narrows
      // `a.unlocked` to literal `false`, which makes the later `unlocked = true`
      // assignment fail. Widening to `boolean` keeps the achievement-flip path
      // type-safe.
      let unlocked: boolean = a.unlocked;

      switch (a.id) {
        case 'first_mine':
          progress = elements.some(e => e.quantity > 0 && e.discovered) ? 1 : 0;
          break;
        case 'elements_10':
          progress = elements.filter(e => e.discovered).length;
          break;
        case 'elements_50':
          progress = elements.filter(e => e.discovered).length;
          break;
        case 'build_5':
          progress = buildings.filter(b => b.level > 0).length;
          break;
        case 'tech_5':
          progress = technologies.filter(t => t.researched).length;
          break;
        case 'combat_win':
          if (trigger === 'combat') progress = 1;
          break;
        case 'legendary_element':
          if (elements.some(e => e.rarity === 'legendary' && e.discovered)) progress = 1;
          break;
      }

      if (progress >= a.target) unlocked = true;
      return { ...a, progress, unlocked };
    });
  };

  // Phase 3 — autosave every 30s using stateRef so the interval is set up
  // exactly once. Previously deps were `[state, saveGame]` which destroyed and
  // recreated the interval on every tick, meaning autosave never actually
  // fired (the only path that saved was the AsyncStorage call inside loadGame
  // recovery — i.e., never).
  useEffect(() => {
    const saveInterval = setInterval(() => saveGame(stateRef.current), 30000);
    return () => clearInterval(saveInterval);
  }, [saveGame]);

  // Phase 4 — derived stability tier and deployed-miner count. Lives in the
  // provider (not as a hook in consumers) so every screen reads the same
  // values from the same source of truth.
  const stabilityTier = getStabilityTier(state.stability);
  const deployedAutoMiners = deployedAutoMinerCount(state);

  return (
    <GameContext.Provider value={{
      state,
      mineZone,
      constructBuilding,
      upgradeBuilding,
      demolishBuilding,
      startResearch,
      resolveEvent,
      engageCombat,
      runEspionage,
      claimDailyReward,
      performPrestige,
      recruitUnits,
      getElementQuantity,
      getBuilding,
      getTech,
      getFactionRelationship,
      generateEvent,
      generatingEvent,
      lastError,
      clearError,
      buyAutoMiner,
      assignAutoMiner,
      unassignAutoMiner,
      deployedAutoMiners,
      stabilityTier,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
