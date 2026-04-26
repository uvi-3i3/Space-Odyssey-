import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Element, Building, Technology, GameEvent, Faction, Achievement,
  INITIAL_ELEMENTS, INITIAL_BUILDINGS, INITIAL_TECHNOLOGIES,
  INITIAL_FACTIONS, INITIAL_ACHIEVEMENTS, PLANET_ZONES, NARRATIVE_EVENTS,
} from '@/constants/gameData';

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
  elements: Element[];
  buildings: Building[];
  technologies: Technology[];
  factions: Faction[];
  achievements: Achievement[];
  activeEvents: GameEvent[];
  completedEvents: string[];
  planetZones: typeof PLANET_ZONES;
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
}

export interface CombatEntry {
  id: string;
  factionId: string;
  type: 'attack' | 'defend';
  outcome: 'win' | 'loss' | 'draw';
  timestamp: number;
  details: string;
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
  credits: 100,
  prestigePoints: 0,
  prestigeLevel: 0,
  population: 10,
  maxPopulation: 50,
  defensePower: 10,
  miningMultiplier: 1.0,
  researchSpeed: 1.0,
  elements: INITIAL_ELEMENTS,
  buildings: INITIAL_BUILDINGS,
  technologies: INITIAL_TECHNOLOGIES,
  factions: INITIAL_FACTIONS,
  achievements: INITIAL_ACHIEVEMENTS,
  activeEvents: [],
  completedEvents: [],
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
  storageCapacity: 1000,
  activeTab: 'planet',
};

interface GameContextType {
  state: GameState;
  mineZone: (zoneId: string, miningType: 'safe' | 'aggressive' | 'deep') => { success: boolean; rewards: Record<string, number>; message: string };
  constructBuilding: (buildingId: string) => { success: boolean; message: string };
  upgradeBuilding: (buildingId: string) => { success: boolean; message: string };
  demolishBuilding: (buildingId: string) => void;
  startResearch: (techId: string) => { success: boolean; message: string };
  resolveEvent: (eventId: string, choiceId: string) => void;
  engageCombat: (factionId: string, strategy: 'attack' | 'defend' | 'retreat') => CombatEntry;
  runEspionage: (factionId: string, mission: 'scan' | 'spy' | 'disrupt' | 'fake') => EspionageEntry;
  claimDailyReward: () => { success: boolean; rewards: Record<string, number> };
  performPrestige: () => void;
  recruitUnits: (unitId: string, count: number) => { success: boolean; message: string };
  getElementQuantity: (elementId: string) => number;
  getBuilding: (buildingId: string) => Building | undefined;
  getTech: (techId: string) => Technology | undefined;
  generateEvent: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadGame();
  }, []);

  useEffect(() => {
    tickRef.current = setInterval(tick, TICK_INTERVAL);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state.buildings, state.technologies, state.prestigeLevel]);

  const loadGame = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as GameState;
        const offlineTime = (Date.now() - parsed.lastSave) / 1000;
        const cappedTime = Math.min(offlineTime, 86400);
        const loaded = applyOfflineProgress(parsed, cappedTime);
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
    } catch {
      // use defaults
    }
  };

  const applyOfflineProgress = (s: GameState, seconds: number): GameState => {
    const updated = { ...s };
    const mineBuildings = s.buildings.filter(b => b.type === 'mine' && b.level > 0);
    const mineMultiplier = 1 + (s.prestigeLevel * 0.1);
    const elems = [...s.elements];
    for (const building of mineBuildings) {
      const rate = building.productionRate * building.level * mineMultiplier;
      const totalGained = Math.floor(rate * seconds / 60);
      if (totalGained > 0) {
        const zone = PLANET_ZONES[0];
        for (const elemId of zone.elements) {
          const idx = elems.findIndex(e => e.id === elemId);
          if (idx >= 0) {
            elems[idx] = { ...elems[idx], quantity: elems[idx].quantity + Math.floor(totalGained / zone.elements.length) };
          }
        }
      }
    }
    updated.elements = elems;
    updated.credits = Math.min(updated.credits + Math.floor(seconds * 0.5), 999999);
    return updated;
  };

  const saveGame = useCallback(async (s: GameState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, lastSave: Date.now() }));
    } catch {}
  }, []);

  const tick = useCallback(() => {
    setState(prev => {
      const updated = { ...prev };
      const mineBuildings = prev.buildings.filter(b => b.type === 'mine' && b.level > 0);
      const mineMultiplier = 1 + (prev.prestigeLevel * 0.1);
      const elems = [...prev.elements];
      for (const building of mineBuildings) {
        const rate = building.productionRate * building.level * mineMultiplier * prev.miningMultiplier;
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
      updated.credits = Math.min(prev.credits + 0.1, 999999);
      updated.totalPlayTime = prev.totalPlayTime + 1;

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
            updated.researchSpeed = getResearchSpeed(techs);
          } else {
            updated.researchProgress = newProgress;
          }
        }
      }

      if (Math.random() < 0.002 && prev.activeEvents.length === 0 && prev.completedEvents.length < NARRATIVE_EVENTS.length) {
        const available = NARRATIVE_EVENTS.filter(e => !prev.completedEvents.includes(e.id) && !prev.activeEvents.find(ae => ae.id === e.id));
        if (available.length > 0) {
          const event = available[Math.floor(Math.random() * available.length)];
          updated.activeEvents = [{ ...event, timestamp: Date.now() }];
        }
      }

      return updated;
    });
  }, []);

  const getResearchSpeed = (techs: Technology[]) => {
    let speed = 1.0;
    if (techs.find(t => t.id === 'quantum_research' && t.researched)) speed *= 1.5;
    return speed;
  };

  const getElementQuantity = (elementId: string) => {
    return state.elements.find(e => e.id === elementId)?.quantity ?? 0;
  };

  const getBuilding = (buildingId: string) => state.buildings.find(b => b.id === buildingId);
  const getTech = (techId: string) => state.technologies.find(t => t.id === techId);

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

  const mineZone = useCallback((zoneId: string, miningType: 'safe' | 'aggressive' | 'deep') => {
    const zone = state.planetZones.find(z => z.id === zoneId);
    if (!zone || !zone.unlocked) return { success: false, rewards: {}, message: 'Zone not accessible' };

    const now = Date.now();
    const cooldown = miningType === 'safe' ? 3000 : miningType === 'aggressive' ? 2000 : 5000;
    if (now - zone.lastMined < cooldown) return { success: false, rewards: {}, message: 'Zone cooling down...' };

    const riskMap = { safe: 0, aggressive: 0.25, deep: 0.5 };
    const multiplierMap = { safe: 1, aggressive: 2.5, deep: 5 };
    const risk = riskMap[miningType];
    const mult = multiplierMap[miningType] * state.miningMultiplier * (1 + state.prestigeLevel * 0.1);

    if (Math.random() < risk) {
      setState(prev => ({
        ...prev,
        planetZones: prev.planetZones.map(z => z.id === zoneId ? { ...z, lastMined: now } : z),
      }));
      return { success: false, rewards: {}, message: miningType === 'deep' ? 'Cave collapse! Nothing recovered.' : 'Mining accident! No yield.' };
    }

    const rewards: Record<string, number> = {};
    const elemIds = zone.elements;
    for (const elemId of elemIds) {
      const elem = state.elements.find(e => e.id === elemId);
      if (!elem) continue;
      const base = Math.floor(zone.baseYield * mult * (Math.random() * 0.5 + 0.75));
      rewards[elemId] = Math.max(1, base);
    }

    if (miningType === 'deep' && Math.random() < 0.15) {
      const undiscovered = state.elements.filter(e => !e.discovered);
      if (undiscovered.length > 0) {
        const newElem = undiscovered[Math.floor(Math.random() * undiscovered.length)];
        rewards[newElem.id] = (rewards[newElem.id] ?? 0) + Math.floor(Math.random() * 10) + 1;
      }
    }

    setState(prev => {
      const elems = prev.elements.map(e => {
        if (!rewards[e.id]) return e;
        const newQty = Math.min(e.quantity + rewards[e.id], prev.storageCapacity);
        return { ...e, quantity: newQty, discovered: true };
      });
      const zones = prev.planetZones.map(z => z.id === zoneId ? { ...z, lastMined: now } : z);

      const updatedAchievements = checkAchievements(prev.achievements, elems, prev.buildings, prev.technologies);
      return { ...prev, elements: elems, planetZones: zones, achievements: updatedAchievements };
    });

    return { success: true, rewards, message: `Mined successfully!` };
  }, [state]);

  const constructBuilding = useCallback((buildingId: string) => {
    const building = state.buildings.find(b => b.id === buildingId);
    if (!building) return { success: false, message: 'Building not found' };
    if (building.level > 0) return { success: false, message: 'Already constructed' };

    if (!canAfford(building.baseCost, state.elements, state.credits)) {
      return { success: false, message: 'Insufficient resources' };
    }

    setState(prev => {
      const { elements, credits } = deductCost(building.baseCost, prev.elements, prev.credits);
      const buildings = prev.buildings.map(b => b.id === buildingId ? { ...b, level: 1 } : b);
      const storageCapacity = prev.storageCapacity + (buildingId === 'storage_basic' ? 500 : 0);
      const maxPopulation = prev.maxPopulation + (buildingId === 'habitat_basic' ? 20 : 0);
      const defensePower = prev.defensePower + (buildingId === 'defense_basic' ? 25 : 0);
      const updatedAchievements = checkAchievements(prev.achievements, elements, buildings, prev.technologies);
      return { ...prev, elements, credits, buildings, storageCapacity, maxPopulation, defensePower, achievements: updatedAchievements };
    });
    return { success: true, message: 'Construction complete!' };
  }, [state]);

  const upgradeBuilding = useCallback((buildingId: string) => {
    const building = state.buildings.find(b => b.id === buildingId);
    if (!building || building.level === 0) return { success: false, message: 'Build it first' };
    if (building.level >= building.maxLevel) return { success: false, message: 'Max level reached' };

    const upgradeCost: Record<string, number> = {};
    Object.entries(building.baseCost).forEach(([k, v]) => {
      upgradeCost[k] = Math.floor(v * Math.pow(building.upgradeMultiplier, building.level));
    });

    if (!canAfford(upgradeCost, state.elements, state.credits)) {
      return { success: false, message: 'Insufficient resources' };
    }

    setState(prev => {
      const { elements, credits } = deductCost(upgradeCost, prev.elements, prev.credits);
      const buildings = prev.buildings.map(b => b.id === buildingId ? { ...b, level: b.level + 1 } : b);
      let storageCapacity = prev.storageCapacity;
      let maxPopulation = prev.maxPopulation;
      let defensePower = prev.defensePower;
      if (buildingId === 'storage_basic') storageCapacity += 500;
      if (buildingId === 'habitat_basic') maxPopulation += 20;
      if (buildingId === 'defense_basic') defensePower += 25;
      return { ...prev, elements, credits, buildings, storageCapacity, maxPopulation, defensePower };
    });
    return { success: true, message: 'Upgrade complete!' };
  }, [state]);

  const demolishBuilding = useCallback((buildingId: string) => {
    setState(prev => ({
      ...prev,
      buildings: prev.buildings.map(b => b.id === buildingId ? { ...b, level: 0 } : b),
    }));
  }, []);

  const startResearch = useCallback((techId: string) => {
    if (state.currentResearch) return { success: false, message: 'Already researching' };
    const tech = state.technologies.find(t => t.id === techId);
    if (!tech) return { success: false, message: 'Tech not found' };
    if (tech.researched) return { success: false, message: 'Already researched' };

    const prereqsMet = tech.prerequisites.every(p => state.technologies.find(t => t.id === p)?.researched);
    if (!prereqsMet) return { success: false, message: 'Prerequisites not met' };
    if (!canAfford(tech.cost, state.elements, state.credits)) return { success: false, message: 'Insufficient resources' };

    setState(prev => {
      const { elements, credits } = deductCost(tech.cost, prev.elements, prev.credits);
      return { ...prev, elements, credits, currentResearch: techId, researchProgress: 0 };
    });
    return { success: true, message: `Researching ${tech.name}...` };
  }, [state]);

  const resolveEvent = useCallback((eventId: string, choiceId: string) => {
    setState(prev => {
      const event = prev.activeEvents.find(e => e.id === eventId);
      if (!event) return prev;
      const choice = event.choices.find(c => c.id === choiceId);
      if (!choice) return prev;

      let elements = [...prev.elements];
      let credits = prev.credits;
      if (choice.resourceChanges) {
        elements = elements.map(e => {
          const change = choice.resourceChanges![e.id];
          if (!change) return e;
          return { ...e, quantity: Math.max(0, e.quantity + change) };
        });
        if (choice.resourceChanges['credits']) credits += choice.resourceChanges['credits'];
      }

      const factions = choice.reputationChange ? prev.factions.map(f => ({
        ...f, reputation: Math.max(-100, Math.min(100, f.reputation + (choice.reputationChange ?? 0))),
      })) : prev.factions;

      return {
        ...prev,
        elements,
        credits,
        factions,
        activeEvents: prev.activeEvents.filter(e => e.id !== eventId),
        completedEvents: [...prev.completedEvents, eventId],
      };
    });
  }, []);

  const engageCombat = useCallback((factionId: string, strategy: 'attack' | 'defend' | 'retreat') => {
    const faction = state.factions.find(f => f.id === factionId);
    const playerPower = state.units.reduce((sum, u) => sum + u.count * (u.attack + u.defense) / 2, 0) + state.defensePower;
    const enemyPower = 50 + (faction?.reputation ?? 0) * -0.5;

    let outcome: 'win' | 'loss' | 'draw' = 'draw';
    let details = '';

    if (strategy === 'retreat') {
      outcome = 'draw';
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
        outcome = 'draw';
        details = 'The battle was inconclusive. Both sides withdrew.';
      }
    }

    const entry: CombatEntry = {
      id: Date.now().toString(),
      factionId,
      type: strategy === 'defend' ? 'defend' : 'attack',
      outcome,
      timestamp: Date.now(),
      details,
    };

    setState(prev => {
      const reputationChange = outcome === 'win' ? 20 : outcome === 'loss' ? -10 : 0;
      const factions = prev.factions.map(f =>
        f.id === factionId ? { ...f, reputation: Math.max(-100, Math.min(100, f.reputation + reputationChange)) } : f
      );
      const updatedAchievements = outcome === 'win' ? checkAchievements(prev.achievements, prev.elements, prev.buildings, prev.technologies, 'combat') : prev.achievements;
      return { ...prev, factions, combatLog: [entry, ...prev.combatLog].slice(0, 20), achievements: updatedAchievements };
    });

    return entry;
  }, [state]);

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
    if (state.dailyRewardClaimed) return { success: false, rewards: {} };

    const day = Math.min(state.loginStreak, 7);
    const rewards: Record<string, number> = {};
    if (day < 7) {
      rewards['credits'] = day * 50;
      rewards['Fe'] = day * 20;
    } else {
      rewards['prestigePoints'] = 1;
      rewards['credits'] = 500;
    }

    setState(prev => {
      const elements = prev.elements.map(e => rewards[e.id] ? { ...e, quantity: e.quantity + rewards[e.id] } : e);
      return {
        ...prev,
        elements,
        credits: prev.credits + (rewards['credits'] ?? 0),
        prestigePoints: prev.prestigePoints + (rewards['prestigePoints'] ?? 0),
        dailyRewardClaimed: true,
      };
    });

    return { success: true, rewards };
  }, [state]);

  const performPrestige = useCallback(() => {
    setState(prev => {
      const prestigeLevel = prev.prestigeLevel + 1;
      return {
        ...initialState,
        prestigeLevel,
        prestigePoints: prev.prestigePoints + 5,
        loginStreak: prev.loginStreak,
        lastLoginDate: prev.lastLoginDate,
        dailyRewardClaimed: prev.dailyRewardClaimed,
        miningMultiplier: 1 + prestigeLevel * 0.1,
        achievements: prev.achievements.map(a =>
          a.id === 'prestige_1' ? { ...a, unlocked: true, progress: 1 } : a
        ),
      };
    });
  }, []);

  const recruitUnits = useCallback((unitId: string, count: number) => {
    const unit = state.units.find(u => u.id === unitId);
    if (!unit) return { success: false, message: 'Unit not found' };

    const totalCost: Record<string, number> = {};
    Object.entries(unit.cost).forEach(([k, v]) => { totalCost[k] = v * count; });

    if (!canAfford(totalCost, state.elements, state.credits)) return { success: false, message: 'Insufficient resources' };

    setState(prev => {
      const { elements, credits } = deductCost(totalCost, prev.elements, prev.credits);
      const units = prev.units.map(u => u.id === unitId ? { ...u, count: u.count + count } : u);
      return { ...prev, elements, credits, units };
    });

    return { success: true, message: `Recruited ${count} ${unit.name}(s)` };
  }, [state]);

  const generateEvent = useCallback(() => {
    setState(prev => {
      const available = NARRATIVE_EVENTS.filter(e => !prev.completedEvents.includes(e.id) && !prev.activeEvents.find(ae => ae.id === e.id));
      if (available.length === 0) return prev;
      const event = available[Math.floor(Math.random() * available.length)];
      return { ...prev, activeEvents: [...prev.activeEvents, { ...event, timestamp: Date.now() }] };
    });
  }, []);

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
      let unlocked = a.unlocked;

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

  useEffect(() => {
    const saveInterval = setInterval(() => saveGame(state), 30000);
    return () => clearInterval(saveInterval);
  }, [state, saveGame]);

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
      generateEvent,
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
