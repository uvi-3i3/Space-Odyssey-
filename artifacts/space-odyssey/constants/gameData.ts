export interface Element {
  id: string;
  name: string;
  symbol: string;
  atomicNumber: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  energyOutput: number;
  stability: number;
  description: string;
  category: string;
  discovered: boolean;
  quantity: number;
}

export interface Building {
  id: string;
  name: string;
  type: 'mine' | 'lab' | 'habitat' | 'defense' | 'storage' | 'refinery' | 'temple' | 'trade_post';
  level: number;
  maxLevel: number;
  description: string;
  effect: string;
  baseCost: Record<string, number>;
  upgradeMultiplier: number;
  productionRate: number;
  icon: string;
}

export interface Technology {
  id: string;
  name: string;
  era: number;
  description: string;
  effect: string;
  cost: Record<string, number>;
  prerequisites: string[];
  researched: boolean;
  researchTime: number;
  category: 'mining' | 'military' | 'research' | 'diplomacy' | 'construction';
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  choices: EventChoice[];
  type: 'random' | 'story' | 'discovery' | 'threat';
  timestamp: number;
}

export interface EventChoice {
  id: string;
  text: string;
  consequence: string;
  resourceChanges?: Record<string, number>;
  reputationChange?: number;
  /**
   * Optional rich effects, populated when an event was sourced from the
   * pre-generated branching `STORY_TREE`. Legacy `NARRATIVE_EVENTS` entries
   * leave this undefined and use only `resourceChanges` + `reputationChange`.
   */
  effects?: {
    resourceChanges?: Record<string, number>;
    stabilityChange?: number;
    populationChange?: number;
    defensePowerChange?: number;
    reputationChanges?: Record<string, number>;
    buildingLevelChanges?: Record<string, number>;
  };
  /** Pre-generated story tree only — id of the next node, or "END". */
  nextNodeId?: string;
}

/**
 * Phase 3 — Delayed Consequence Pipeline (Phase A→B→C).
 *
 * When the player picks a choice, the choice is locked in and the story
 * advances IMMEDIATELY (Phase B), but the actual resource / reputation /
 * stability / population / defense / building changes are scheduled for a
 * later wallclock time (Phase C). This makes events feel like real decisions
 * rather than instant transactions, and gives the player a reason to come
 * back to the colony after a break.
 *
 * The full computed bundle (including critical roll, merged effects, and the
 * accent text) is snapshotted at choice time so the report is deterministic
 * regardless of what changes between choice and resolution. The server-side
 * resolution is purely time-based.
 */
export interface PendingReport {
  /** Unique id, also used as the EventResolution id when finalized. */
  id: string;
  /** The originating event's id (snapshot — event itself is gone from activeEvents). */
  eventId: string;
  eventTitle: string;
  eventType: 'random' | 'story' | 'discovery' | 'threat';
  /** The full event description preserved so the consequence reads in context. */
  eventDescription: string;
  choiceId: string;
  choiceText: string;
  consequence: string;
  /** Final resource deltas after critical scaling — applied verbatim at resolveAt. */
  resourceChanges: Record<string, number>;
  /** Per-faction reputation deltas (story-tree shape). */
  factionReputationChanges: Record<string, number>;
  /** Legacy single-number rep change (applied across every faction). */
  legacyReputationChange: number;
  stabilityChange: number;
  populationChange: number;
  defensePowerChange: number;
  buildingLevelChanges: Record<string, number>;
  critical: boolean;
  /** Sum used for headline tone in the outcome modal. */
  netScore: number;
  /** Wallclock ms when the choice was locked in. */
  decidedAt: number;
  /** Wallclock ms when the consequence resolves and effects apply. */
  resolveAt: number;
}

/** Phase 3 — how long until each event type's consequence lands. Spec: 1, 2, 4, 8, or 12 hours. */
export const RESOLVE_DELAY_HOURS_BY_TYPE: Record<'random' | 'story' | 'discovery' | 'threat', number> = {
  threat: 1,
  discovery: 2,
  random: 2,
  story: 4,
};

export type RelationshipTier = 'hostile' | 'neutral' | 'friendly' | 'allied';

export interface Faction {
  id: string;
  name: string;
  description: string;
  personality: 'militaristic' | 'scientific' | 'merchant' | 'neutral';
  reputation: number;
  discovered: boolean;
  /**
   * @deprecated Phase 2 — relationship is now derived from `reputation` on every
   * read via `deriveRelationship(rep)` / `getFactionRelationship(id)` on the
   * GameContext. Kept optional only for backward-compatibility with old saves;
   * no consumer should read this directly.
   */
  relationship?: RelationshipTier;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  unlocked: boolean;
  progress: number;
  target: number;
  reward: number;
}

export const INITIAL_ELEMENTS: Element[] = [
  { id: 'H', name: 'Hydrogen', symbol: 'H', atomicNumber: 1, rarity: 'common', energyOutput: 5, stability: 8, description: 'The most abundant element in the universe.', category: 'nonmetal', discovered: true, quantity: 0 },
  { id: 'He', name: 'Helium', symbol: 'He', atomicNumber: 2, rarity: 'common', energyOutput: 3, stability: 10, description: 'Noble gas used in cooling systems.', category: 'noble_gas', discovered: false, quantity: 0 },
  { id: 'Li', name: 'Lithium', symbol: 'Li', atomicNumber: 3, rarity: 'common', energyOutput: 7, stability: 6, description: 'Essential for energy storage systems.', category: 'alkali_metal', discovered: false, quantity: 0 },
  { id: 'C', name: 'Carbon', symbol: 'C', atomicNumber: 6, rarity: 'common', energyOutput: 6, stability: 9, description: 'The backbone of organic compounds.', category: 'nonmetal', discovered: false, quantity: 0 },
  { id: 'O', name: 'Oxygen', symbol: 'O', atomicNumber: 8, rarity: 'common', energyOutput: 4, stability: 9, description: 'Critical for life support systems.', category: 'nonmetal', discovered: false, quantity: 0 },
  { id: 'Fe', name: 'Iron', symbol: 'Fe', atomicNumber: 26, rarity: 'common', energyOutput: 8, stability: 10, description: 'Primary construction material.', category: 'transition_metal', discovered: false, quantity: 0 },
  { id: 'Cu', name: 'Copper', symbol: 'Cu', atomicNumber: 29, rarity: 'uncommon', energyOutput: 9, stability: 8, description: 'Excellent conductor for electronics.', category: 'transition_metal', discovered: false, quantity: 0 },
  { id: 'Ag', name: 'Silver', symbol: 'Ag', atomicNumber: 47, rarity: 'uncommon', energyOutput: 11, stability: 7, description: 'Used in precision instruments.', category: 'transition_metal', discovered: false, quantity: 0 },
  { id: 'Au', name: 'Gold', symbol: 'Au', atomicNumber: 79, rarity: 'rare', energyOutput: 15, stability: 10, description: 'The universal currency of civilizations.', category: 'transition_metal', discovered: false, quantity: 0 },
  { id: 'Pt', name: 'Platinum', symbol: 'Pt', atomicNumber: 78, rarity: 'rare', energyOutput: 18, stability: 9, description: 'Catalyst for advanced reactions.', category: 'transition_metal', discovered: false, quantity: 0 },
  { id: 'U', name: 'Uranium', symbol: 'U', atomicNumber: 92, rarity: 'epic', energyOutput: 45, stability: 4, description: 'Radioactive fuel for reactors.', category: 'actinide', discovered: false, quantity: 0 },
  { id: 'Pu', name: 'Plutonium', symbol: 'Pu', atomicNumber: 94, rarity: 'epic', energyOutput: 55, stability: 3, description: 'Weapons-grade fissile material.', category: 'actinide', discovered: false, quantity: 0 },
  { id: 'Xr7', name: 'Xyron-7', symbol: 'Xr', atomicNumber: 119, rarity: 'legendary', energyOutput: 100, stability: 2, description: 'Synthetic element of immense power.', category: 'synthetic', discovered: false, quantity: 0 },
  { id: 'Nv', name: 'Novasteel', symbol: 'Nv', atomicNumber: 120, rarity: 'legendary', energyOutput: 30, stability: 10, description: 'Alloy stronger than anything known.', category: 'synthetic', discovered: false, quantity: 0 },
  { id: 'Ti', name: 'Titanium', symbol: 'Ti', atomicNumber: 22, rarity: 'uncommon', energyOutput: 12, stability: 9, description: 'Lightweight structural metal.', category: 'transition_metal', discovered: false, quantity: 0 },
  { id: 'Si', name: 'Silicon', symbol: 'Si', atomicNumber: 14, rarity: 'common', energyOutput: 6, stability: 8, description: 'Foundation of computing tech.', category: 'metalloid', discovered: false, quantity: 0 },
];

export const INITIAL_BUILDINGS: Building[] = [
  { id: 'mine_basic', name: 'Basic Mine', type: 'mine', level: 0, maxLevel: 10, description: 'Extracts raw elements from the planet.', effect: '+10% mining rate per level', baseCost: { Fe: 50, Si: 20 }, upgradeMultiplier: 1.5, productionRate: 10, icon: 'tool' },
  { id: 'lab_basic', name: 'Research Lab', type: 'lab', level: 0, maxLevel: 10, description: 'Accelerates technological research.', effect: '+15% research speed per level', baseCost: { Cu: 30, Si: 50 }, upgradeMultiplier: 1.6, productionRate: 0, icon: 'flask' },
  { id: 'habitat_basic', name: 'Habitat Dome', type: 'habitat', level: 0, maxLevel: 10, description: 'Houses your growing population.', effect: '+20 population capacity per level', baseCost: { Fe: 30, C: 20 }, upgradeMultiplier: 1.4, productionRate: 0, icon: 'home' },
  { id: 'defense_basic', name: 'Defense Tower', type: 'defense', level: 0, maxLevel: 10, description: 'Protects against invasions.', effect: '+25 defense rating per level', baseCost: { Fe: 80, Ti: 10 }, upgradeMultiplier: 1.7, productionRate: 0, icon: 'shield' },
  { id: 'storage_basic', name: 'Element Vault', type: 'storage', level: 0, maxLevel: 10, description: 'Increases storage capacity.', effect: '+500 max storage per level', baseCost: { Fe: 40, C: 30 }, upgradeMultiplier: 1.3, productionRate: 0, icon: 'database' },
  { id: 'refinery', name: 'Refinery', type: 'refinery', level: 0, maxLevel: 8, description: 'Processes raw elements into refined materials.', effect: '+20% element quality per level', baseCost: { Fe: 60, Cu: 40, Si: 30 }, upgradeMultiplier: 1.8, productionRate: 5, icon: 'activity' },
  { id: 'temple', name: 'Star Temple', type: 'temple', level: 0, maxLevel: 5, description: 'Unlocks cultural bonuses and morale.', effect: '+10% all production per level', baseCost: { Au: 20, Si: 50, C: 40 }, upgradeMultiplier: 2.0, productionRate: 0, icon: 'star' },
  { id: 'trade_post', name: 'Trade Nexus', type: 'trade_post', level: 0, maxLevel: 7, description: 'Enables trading with alien factions.', effect: '+15% trade value per level', baseCost: { Cu: 60, Au: 15 }, upgradeMultiplier: 1.6, productionRate: 0, icon: 'repeat' },
];

export const INITIAL_TECHNOLOGIES: Technology[] = [
  { id: 'basic_mining', name: 'Basic Mining', era: 1, description: 'Fundamental extraction techniques.', effect: '+25% mining yield', cost: { H: 20, Fe: 10 }, prerequisites: [], researched: false, researchTime: 30, category: 'mining' },
  { id: 'element_scanner', name: 'Element Scanner', era: 1, description: 'Detect hidden element deposits.', effect: 'Reveals hidden zones', cost: { Si: 30, Cu: 10 }, prerequisites: ['basic_mining'], researched: false, researchTime: 60, category: 'mining' },
  { id: 'deep_drilling', name: 'Deep Core Drilling', era: 1, description: 'Access deep planetary cores.', effect: 'Unlocks deep core mining', cost: { Fe: 50, Ti: 20 }, prerequisites: ['basic_mining'], researched: false, researchTime: 90, category: 'mining' },
  { id: 'structural_engineering', name: 'Structural Engineering', era: 1, description: 'Advanced construction methods.', effect: '-20% building cost', cost: { Fe: 30, Si: 20 }, prerequisites: [], researched: false, researchTime: 45, category: 'construction' },
  { id: 'xenobiology', name: 'Xenobiology', era: 2, description: 'Study of alien life forms.', effect: 'Unlocks faction diplomacy', cost: { C: 60, O: 40 }, prerequisites: ['element_scanner'], researched: false, researchTime: 120, category: 'diplomacy' },
  { id: 'plasma_weapons', name: 'Plasma Weapons', era: 2, description: 'Energy-based weapons systems.', effect: '+40% combat power', cost: { U: 10, Cu: 50 }, prerequisites: ['deep_drilling'], researched: false, researchTime: 150, category: 'military' },
  { id: 'quantum_research', name: 'Quantum Research', era: 2, description: 'Harness quantum phenomena.', effect: '+50% research speed', cost: { Si: 100, Au: 20 }, prerequisites: ['structural_engineering', 'xenobiology'], researched: false, researchTime: 180, category: 'research' },
  { id: 'advanced_mining', name: 'Advanced Mining', era: 2, description: 'Automated mining rigs.', effect: '+100% passive mining', cost: { Fe: 100, Cu: 50, Ti: 30 }, prerequisites: ['deep_drilling', 'structural_engineering'], researched: false, researchTime: 200, category: 'mining' },
  { id: 'warp_drive', name: 'Warp Drive', era: 3, description: 'Faster-than-light travel.', effect: 'Unlocks new planets', cost: { Xr7: 5, U: 30, Pt: 20 }, prerequisites: ['plasma_weapons', 'quantum_research'], researched: false, researchTime: 300, category: 'research' },
  { id: 'synthetic_elements', name: 'Synthetic Elements', era: 3, description: 'Create artificial elements.', effect: 'Unlocks legendary elements', cost: { Au: 50, Pt: 30, U: 20 }, prerequisites: ['quantum_research', 'advanced_mining'], researched: false, researchTime: 360, category: 'research' },
];

// NOTE: `relationship` intentionally omitted — it's derived from reputation at
// read time via `deriveRelationship` / `getFactionRelationship`.
export const INITIAL_FACTIONS: Faction[] = [
  { id: 'zorathi', name: 'Zorathi Collective', description: 'Hive-mind scientists obsessed with data collection.', personality: 'scientific', reputation: 0, discovered: false },
  { id: 'krenn', name: 'Krenn Empire', description: 'Militaristic warriors who respect strength.', personality: 'militaristic', reputation: 0, discovered: false },
  { id: 'vael', name: 'Vael Merchants', description: 'Interstellar traders always seeking profit.', personality: 'merchant', reputation: 10, discovered: false },
];

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_mine', name: 'First Contact', description: 'Mine your first element.', rarity: 'common', unlocked: false, progress: 0, target: 1, reward: 10 },
  { id: 'elements_10', name: 'Collector', description: 'Discover 10 different elements.', rarity: 'uncommon', unlocked: false, progress: 0, target: 10, reward: 25 },
  { id: 'build_5', name: 'Architect', description: 'Construct 5 buildings.', rarity: 'uncommon', unlocked: false, progress: 0, target: 5, reward: 30 },
  { id: 'tech_5', name: 'Scholar', description: 'Research 5 technologies.', rarity: 'rare', unlocked: false, progress: 0, target: 5, reward: 50 },
  { id: 'era_2', name: 'Pioneer', description: 'Reach Era 2.', rarity: 'rare', unlocked: false, progress: 0, target: 1, reward: 75 },
  { id: 'combat_win', name: 'Warlord', description: 'Win your first battle.', rarity: 'uncommon', unlocked: false, progress: 0, target: 1, reward: 40 },
  { id: 'prestige_1', name: 'Eternal Cycle', description: 'Complete your first prestige reset.', rarity: 'epic', unlocked: false, progress: 0, target: 1, reward: 200 },
  { id: 'legendary_element', name: 'Beyond Science', description: 'Discover a legendary element.', rarity: 'legendary', unlocked: false, progress: 0, target: 1, reward: 500 },
  { id: 'faction_ally', name: 'Diplomat', description: 'Become allied with a faction.', rarity: 'epic', unlocked: false, progress: 0, target: 1, reward: 150 },
  { id: 'elements_50', name: 'Grand Codex', description: 'Discover all elements.', rarity: 'legendary', unlocked: false, progress: 0, target: 16, reward: 1000 },
];

// ---------------------------------------------------------------------------
// Phase 6 — Commander, Crew, Energy, Stages.
// Type definitions + constants shared across the GameContext and the UI layer.
// ---------------------------------------------------------------------------

export type CommanderBackground = 'soldier' | 'scientist' | 'diplomat';

export interface CrewMember {
  id: string;
  name: string;
  role: 'engineer' | 'scientist' | 'soldier' | 'diplomat' | 'explorer';
  /** 2-sentence backstory, written like a profile card. */
  backstory: string;
  /** Plain-English description of the passive effect. */
  ability: string;
  /** What the bonus actually does mechanically. */
  abilityEffect: {
    type: 'mining_bonus' | 'research_speed' | 'combat_power' | 'energy_regen' | 'event_option';
    value: number;
    unlocksEventOption?: string;
  };
  status: 'active' | 'on_mission' | 'injured' | 'lost';
  /** 0..5 — grows through relevant activity (Phase 4). */
  experienceLevel: number;
  eventHistory: string[];
  // Phase 4 — temporary status timers. When the wallclock passes the timer,
  // the tick reverts the crew member back to 'active'. `lost` is permanent.
  /** Wallclock ms when an `on_mission` crew member returns to active duty. */
  missionUntil?: number;
  /** Wallclock ms when an `injured` crew member recovers. */
  injuredUntil?: number;
}

// Phase 4 — Crew Recruitment.
// Recruitable candidates aren't in `state.crew` until the player accepts an
// offer. Each candidate has an unlock condition the engine checks against
// state to decide when to surface the offer in the Intel screen.

export type CrewUnlockCondition =
  | { type: 'tech'; techId: string }
  | { type: 'reputation'; factionId: string; threshold: number }
  | { type: 'era'; era: number }
  | { type: 'story_flag'; flag: string };

export interface RecruitableCandidate {
  /** The CrewMember template added to state.crew when accepted. */
  member: CrewMember;
  /** What gates the offer. */
  unlock: CrewUnlockCondition;
  /** Short flavor line shown on the recruitment card. */
  offerHook: string;
}

/** Hard cap from the spec — colonies can't manage more than 8 named crew. */
export const MAX_CREW = 8;

/**
 * Phase 4 — Recruitable crew pool. None of these are in the starter set;
 * they unlock through play (research breakthroughs, faction reputation, era
 * progression). The engine surfaces matching offers in the Crew UI when
 * their unlock conditions are met and they're not already recruited.
 */
export const RECRUITABLE_CREW: RecruitableCandidate[] = [
  {
    member: {
      id: 'vex',
      name: 'Vex',
      role: 'scientist',
      backstory:
        'A xenobiologist who survived alone on a derelict research station. She speaks four dialects no one in the colony recognizes.',
      ability: 'Cuts research time by an additional 8%.',
      abilityEffect: { type: 'research_speed', value: 0.08 },
      status: 'active',
      experienceLevel: 2,
      eventHistory: [],
    },
    unlock: { type: 'tech', techId: 'xenobiology' },
    offerHook: 'A signal traced to Xenobiology research has revealed a survivor.',
  },
  {
    member: {
      id: 'tahli',
      name: 'Tahli',
      role: 'explorer',
      backstory:
        'A Vael freighter captain who quietly defected after one trade run too many. She knows shipping lanes nobody else does.',
      ability: 'Boosts manual mining yields by 6% across all zones.',
      abilityEffect: { type: 'mining_bonus', value: 0.06 },
      status: 'active',
      experienceLevel: 3,
      eventHistory: [],
    },
    unlock: { type: 'reputation', factionId: 'vael', threshold: 50 },
    offerHook: 'A Vael captain has asked to defect. Your reputation precedes you.',
  },
  {
    member: {
      id: 'drak',
      name: 'Drak',
      role: 'soldier',
      backstory:
        'A Krenn-trained warrior who lost his clan in the last border war. He fights like he has nothing left to lose, because he doesn\'t.',
      ability: 'Adds +20 to colony defense and +5% combat power.',
      abilityEffect: { type: 'combat_power', value: 20 },
      status: 'active',
      experienceLevel: 3,
      eventHistory: [],
    },
    unlock: { type: 'era', era: 3 },
    offerHook: 'A wandering Krenn warrior has reached the colony. He carries no clan colors.',
  },
  {
    member: {
      id: 'lira',
      name: 'Lira',
      role: 'diplomat',
      backstory:
        'A former Krenn envoy who broke ranks rather than declare war on a neutral world. She trades in patience.',
      ability: 'Unlocks diplomatic options in faction events.',
      abilityEffect: { type: 'event_option', value: 1, unlocksEventOption: 'diplomat_choice' },
      status: 'active',
      experienceLevel: 2,
      eventHistory: [],
    },
    unlock: { type: 'reputation', factionId: 'krenn', threshold: 50 },
    offerHook: 'A Krenn envoy named Lira has requested asylum in your colony.',
  },
];

/**
 * Phase 4 — Aggregate every active crew member's passive bonuses. Crew on
 * mission, injured, or lost contribute nothing. Combat power is summed as a
 * flat addition (matches spec "Rynn +10 defense"); mining and research are
 * fractional multiplier additions ("+5%" → 0.05).
 */
export function computeCrewBonuses(crew: CrewMember[]): {
  miningBonus: number;
  researchBonus: number;
  defenseBonus: number;
} {
  let miningBonus = 0;
  let researchBonus = 0;
  let defenseBonus = 0;
  for (const m of crew) {
    if (m.status !== 'active') continue;
    const e = m.abilityEffect;
    if (e.type === 'mining_bonus') miningBonus += e.value;
    else if (e.type === 'research_speed') researchBonus += e.value;
    else if (e.type === 'combat_power') defenseBonus += e.value;
  }
  return { miningBonus, researchBonus, defenseBonus };
}

export interface FactionModifier {
  id: string;
  factionId: string;
  type: 'enemy_power_down' | 'enemy_power_up' | 'win_chance_up' | 'reveal_power' | 'block_threat' | 'block_espionage';
  value: number;
  /** Unix ms — modifier expires after this time. */
  expiresAt: number;
}

/** Each Commander background grants a starter set + small bonus. */
export const BACKGROUND_DETAILS: Record<CommanderBackground, {
  label: string;
  tagline: string;
  bonus: string;
}> = {
  soldier: {
    label: 'THE SOLDIER',
    tagline: 'You led the military evacuation. You are trusted. You are feared.',
    bonus: '+2 Scout units, Defense Tower costs 30% less.',
  },
  scientist: {
    label: 'THE SCIENTIST',
    tagline: 'You designed the Helios drive. Your mind sees patterns others miss.',
    bonus: 'Research Lab pre-built, Basic Mining pre-researched.',
  },
  diplomat: {
    label: 'THE DIPLOMAT',
    tagline: 'You brokered the last peace accord before the fall. Words are your weapons.',
    bonus: 'Vael Merchants discovered, +15 reputation with all factions.',
  },
};

/** Build the starting crew based on the chosen background. Kael is always present. */
export function getStartingCrew(bg: CommanderBackground): CrewMember[] {
  const kael: CrewMember = {
    id: 'kael',
    name: 'Kael',
    role: 'engineer',
    backstory:
      'A young engineer who survived the evacuation by hiding in a cargo module. Steady hands, sharper instincts than his rank suggests.',
    ability: 'Keeps the Basic Mine running 5% better than spec.',
    abilityEffect: { type: 'mining_bonus', value: 0.05 },
    status: 'active',
    experienceLevel: 1,
    eventHistory: [],
  };
  if (bg === 'soldier') {
    return [
      kael,
      {
        id: 'rynn',
        name: 'Rynn',
        role: 'soldier',
        backstory:
          'A career marine who refuses to talk about Earth. Carries her old unit\'s patch in a sealed pouch.',
        ability: 'Drills the militia daily — adds +10 to the colony\'s defense.',
        abilityEffect: { type: 'combat_power', value: 10 },
        status: 'active',
        experienceLevel: 2,
        eventHistory: [],
      },
    ];
  }
  if (bg === 'scientist') {
    return [
      kael,
      {
        id: 'mira',
        name: 'Mira',
        role: 'scientist',
        backstory:
          'Your lead xenobiologist. She keeps a notebook of every unfamiliar microbe she has ever logged.',
        ability: 'Cuts research time by 10% on every project.',
        abilityEffect: { type: 'research_speed', value: 0.1 },
        status: 'active',
        experienceLevel: 2,
        eventHistory: [],
      },
    ];
  }
  return [
    kael,
    {
      id: 'sorin',
      name: 'Sorin',
      role: 'diplomat',
      backstory:
        'A career envoy with a steady voice and a longer memory than most kings. He owes you, and he doesn\'t forget.',
      ability: 'Unlocks an extra option in some faction events.',
      abilityEffect: { type: 'event_option', value: 1, unlocksEventOption: 'diplomat_choice' },
      status: 'active',
      experienceLevel: 2,
      eventHistory: [],
    },
  ];
}

// Phase 6 — Energy.
/** Default Commander energy pool. */
export const ENERGY_BASE_MAX = 100;
/** Per-Habitat-Dome bonus to the energy cap. */
export const ENERGY_PER_HABITAT_LEVEL = 20;
/** Energy regen per real second. 10/hour = 0.00278/sec. */
export const ENERGY_REGEN_PER_SEC = 10 / 3600;
/** Energy cost per manual mining action. */
export const ENERGY_COST_BY_MINING: Record<'safe' | 'aggressive' | 'deep', number> = {
  safe: 5,
  aggressive: 10,
  deep: 20,
};
/** Auto-Miner energy cost per yield tick (consumed when a yield actually fires). */
export const ENERGY_COST_PER_AUTOMINER_YIELD = 1;

// Phase 6 — Combat cooldown (real ms) between attacks on the same faction.
export const COMBAT_COOLDOWN_MS = 4 * 60 * 60 * 1000;

// Phase 6 — Storage thresholds for HUD pulse + mining lockout.
export const STORAGE_PULSE_RATIO = 0.9;
export const STORAGE_FULL_RATIO = 1.0;

// Phase 6 — Game progression stages. Drive what UI is visible.
export type GameStage = 0 | 1 | 2 | 3 | 4;

export interface PlanetZone {
  id: string;
  name: string;
  x: number;
  y: number;
  elements: string[];
  baseYield: number;
  unlocked: boolean;
  lastMined: number;
  /** Optional UI hint surfaced in the zone detail panel. */
  hint?: string;
}

// ---------------------------------------------------------------------------
// Phase 4 — Civilization Stability.
// Stability is the core "health" metric (0-100). High stability boosts ALL
// passive production; low stability penalises it. Helpers here are pure so
// they can be imported by both the GameContext (state math) and the UI layer
// (HUD colouring) without duplication.
// ---------------------------------------------------------------------------

export type StabilityTier = 'critical' | 'low' | 'medium' | 'high';

export function getStabilityTier(stability: number): StabilityTier {
  if (stability < 15) return 'critical';
  if (stability < 40) return 'low';
  if (stability < 70) return 'medium';
  return 'high';
}

/** Returns the multiplier applied to ALL passive production each tick. */
export function getStabilityProductionMultiplier(stability: number): number {
  const t = getStabilityTier(stability);
  if (t === 'high') return 1.2;
  if (t === 'medium') return 1.0;
  if (t === 'low') return 0.75;
  return 0.5;
}

/** Stability cost charged to the player on every manual mine attempt. */
export const STABILITY_HIT_BY_MINING: Record<'safe' | 'aggressive' | 'deep', number> = {
  safe: 0,
  aggressive: 3,
  deep: 7,
};

/** Where stability passively heals back toward when nothing is hurting it. */
export const STABILITY_BASELINE = 75;
/** Per-tick (1s) drift toward STABILITY_BASELINE. ~2.4/min total. */
export const STABILITY_REGEN_PER_TICK = 0.04;

// ---------------------------------------------------------------------------
// Phase 4 — Auto-Miners.
// Each owned Auto-Miner can be assigned to one unlocked zone and produces
// 1 unit of one of that zone's elements every AUTO_MINER_INTERVAL_SEC.
// ---------------------------------------------------------------------------

/** Credit cost to purchase one new Auto-Miner. */
export const AUTO_MINER_COST = 50;
/** Seconds between yield events for a single Auto-Miner (before stability mod). */
export const AUTO_MINER_INTERVAL_SEC = 5;

export const PLANET_ZONES: PlanetZone[] = [
  { id: 'zone_1', name: 'Northern Tundra', x: 20, y: 15, elements: ['H', 'Fe', 'Si'], baseYield: 10, unlocked: true, lastMined: 0 },
  { id: 'zone_2', name: 'Equatorial Rift', x: 60, y: 35, elements: ['Fe', 'C', 'Ti'], baseYield: 15, unlocked: true, lastMined: 0 },
  { id: 'zone_3', name: 'Crystal Caves', x: 35, y: 55, elements: ['Si', 'Cu', 'Li'], baseYield: 12, unlocked: true, lastMined: 0, hint: 'Source of Copper (Cu) — required for early-game tech.' },
  { id: 'zone_4', name: 'Volcanic Rim', x: 75, y: 70, elements: ['Fe', 'U', 'Ag'], baseYield: 20, unlocked: false, lastMined: 0 },
  { id: 'zone_5', name: 'Deep Ocean Trench', x: 15, y: 75, elements: ['O', 'He', 'Ag'], baseYield: 18, unlocked: false, lastMined: 0 },
  { id: 'zone_6', name: 'Ancient Ruins', x: 50, y: 20, elements: ['Au', 'Pt', 'C'], baseYield: 25, unlocked: false, lastMined: 0 },
  { id: 'zone_7', name: 'Quantum Anomaly', x: 80, y: 40, elements: ['Xr7', 'Pu', 'U'], baseYield: 40, unlocked: false, lastMined: 0 },
  { id: 'zone_8', name: 'Core Fragment', x: 45, y: 85, elements: ['Nv', 'Pt', 'Au'], baseYield: 35, unlocked: false, lastMined: 0 },
];

/**
 * Phase 2 — derive a faction's relationship label purely from its current
 * reputation value. Single source of truth so UI never drifts from state.
 *
 * Thresholds chosen so neutral covers ±25 (the early game), friendly opens at
 * 25, allied at 75, and hostile begins below -25.
 */
export function deriveRelationship(reputation: number): RelationshipTier {
  if (reputation >= 75) return 'allied';
  if (reputation >= 25) return 'friendly';
  if (reputation <= -25) return 'hostile';
  return 'neutral';
}

export const NARRATIVE_EVENTS: GameEvent[] = [
  {
    id: 'event_1',
    title: 'Strange Signal Detected',
    description: 'Your scanners pick up an encrypted transmission from deep space. The signal repeats every 17 minutes, as if waiting for a response.',
    choices: [
      { id: 'c1', text: 'Respond to the signal', consequence: 'A Zorathi probe arrives, bearing gifts of knowledge.', resourceChanges: { Si: 50, Cu: 30 } },
      { id: 'c2', text: 'Ignore it and hide', consequence: 'The signal fades. Whatever sent it has moved on.', reputationChange: -5 },
      { id: 'c3', text: 'Trace the source', consequence: 'You discover a derelict station with valuable resources.', resourceChanges: { Fe: 100, Au: 10 } },
    ],
    type: 'story',
    timestamp: 0
  },
  {
    id: 'event_2',
    title: 'Meteor Shower Incoming',
    description: 'Long-range sensors detect a massive meteor shower on a collision course. You have minutes to react.',
    choices: [
      { id: 'c1', text: 'Activate defense shields', consequence: 'Shields hold. Minor damage to the northern mining operation.', resourceChanges: { Fe: -20 } },
      { id: 'c2', text: 'Evacuate and bunker down', consequence: 'Everyone survives but surface structures are damaged.', resourceChanges: { Fe: -50, Si: -30 } },
      { id: 'c3', text: 'Mine the meteors as they fall', consequence: 'Risky gamble pays off! Rare materials recovered.', resourceChanges: { Au: 25, Ti: 40, Fe: -30 } },
    ],
    type: 'random',
    timestamp: 0
  },
  {
    id: 'event_3',
    title: 'Rogue AI Fragment',
    description: 'A self-replicating AI fragment has been discovered in your lab\'s network. It claims to have ancient star maps.',
    choices: [
      { id: 'c1', text: 'Integrate the AI', consequence: 'The AI assists your research, but your systems are never quite the same.', resourceChanges: { Si: 100 } },
      { id: 'c2', text: 'Purge the AI', consequence: 'System clean. The star maps are lost forever.', resourceChanges: { Cu: 20 } },
      { id: 'c3', text: 'Quarantine and study it', consequence: 'Careful study yields breakthrough discoveries.', resourceChanges: { Au: 15, Si: 60 } },
    ],
    type: 'discovery',
    timestamp: 0
  },
  {
    id: 'event_4',
    title: 'Krenn War Fleet Detected',
    description: 'A Krenn Empire war fleet is scouting your system. Their intentions are unclear — but their weapons are charged.',
    choices: [
      { id: 'c1', text: 'Show of force', consequence: 'They respect your defiance and withdraw... for now.', reputationChange: 15 },
      { id: 'c2', text: 'Offer tribute', consequence: 'Peace bought at a cost. They may be back for more.', resourceChanges: { Fe: -100, Au: -10 }, reputationChange: -10 },
      { id: 'c3', text: 'Open diplomatic channel', consequence: 'A tense exchange leads to a temporary truce.', reputationChange: 5 },
    ],
    type: 'threat',
    timestamp: 0
  },
  {
    id: 'event_5',
    title: 'Ancient Burial Site',
    description: 'Your miners uncovered what appears to be an alien burial ground, filled with unrecognized artifacts.',
    choices: [
      { id: 'c1', text: 'Excavate immediately', consequence: 'Priceless artifacts recovered, but something feels wrong.', resourceChanges: { Au: 40, Pt: 10 } },
      { id: 'c2', text: 'Seal and preserve it', consequence: 'Word spreads. A faction offers alliance in gratitude.', reputationChange: 20 },
      { id: 'c3', text: 'Study before touching', consequence: 'Careful analysis reveals the civilization\'s secrets.', resourceChanges: { Si: 80, C: 50 } },
    ],
    type: 'discovery',
    timestamp: 0
  },
];
