/* ===========================================================================
 * Story Tree Generator — one-time setup tool.
 *
 * PLAIN ENGLISH SUMMARY
 * ---------------------
 * This script is run ONCE, by you, on your computer. It asks OpenAI to write a
 * full 5-chapter branching adventure for "Space Odyssey: Galactic Evolution",
 * makes sure every choice and every consequence will work inside the game,
 * and then saves the entire adventure into a single static file:
 *
 *     artifacts/space-odyssey/constants/storyData.ts
 *
 * After this file exists, the GAME ITSELF never talks to OpenAI again. The
 * mobile app reads the saved adventure straight from disk. You can disconnect
 * the OpenAI key, take the device offline, ship to the App Store — the story
 * is now part of the game like any other built-in content.
 *
 * HOW TO RUN
 * ----------
 *   pnpm --filter @workspace/scripts run generate:story
 *
 * REQUIRED ENVIRONMENT VARIABLES (any one of these — checked in this order)
 *   - GEMINI_API_KEY  (Google Gemini key; uses Gemini's OpenAI-compatible
 *     endpoint so the rest of the script is identical)
 *   - AI_INTEGRATIONS_OPENAI_BASE_URL  +  AI_INTEGRATIONS_OPENAI_API_KEY
 *     (set automatically when the Replit OpenAI integration is provisioned)
 *   - OPENAI_API_KEY  (plain OpenAI account key; baseURL defaults to api.openai.com)
 *
 * OPTIONAL ENVIRONMENT VARIABLES
 *   - STORY_GEN_MODEL    Defaults depend on provider: "gemini-2.5-flash" for
 *                        Gemini, "gpt-5-mini" for OpenAI. Override to taste.
 *   - STORY_GEN_FORCE    Set to "1" to ignore the chapter cache and regenerate
 *                        every chapter from scratch.
 *
 * The script is RESUMABLE. Each chapter is cached under
 * scripts/.cache/storytree/chapter-N.json once it's accepted by the validator,
 * so a re-run after a network blip only re-asks OpenAI for the chapters that
 * are still missing.
 * =========================================================================== */

import OpenAI from 'openai';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const OUTPUT_PATH = join(
  REPO_ROOT,
  'artifacts',
  'space-odyssey',
  'constants',
  'storyData.ts',
);
const CACHE_DIR = join(REPO_ROOT, 'scripts', '.cache', 'storytree');

// ---------------------------------------------------------------------------
// Credentials — try providers in priority order:
//   1. GEMINI_API_KEY                                (Google Gemini)
//   2. AI_INTEGRATIONS_OPENAI_*                      (Replit OpenAI integration)
//   3. OPENAI_API_KEY                                (plain OpenAI key)
// Gemini exposes an OpenAI-compatible REST surface, so the openai SDK is
// reused as-is by just pointing baseURL at Google's compat endpoint.
// ---------------------------------------------------------------------------
type Provider = 'gemini' | 'openai';

interface ProviderConfig {
  provider: Provider;
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  label: string;
}

function pickProvider(): ProviderConfig {
  if (process.env.GEMINI_API_KEY) {
    return {
      provider: 'gemini',
      apiKey: process.env.GEMINI_API_KEY,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      defaultModel: 'gemini-2.5-flash',
      label: 'Google Gemini (OpenAI-compatible endpoint)',
    };
  }
  if (
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  ) {
    return {
      provider: 'openai',
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      defaultModel: 'gpt-5-mini',
      label: 'Replit OpenAI integration',
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      defaultModel: 'gpt-5-mini',
      label: 'OpenAI direct (OPENAI_API_KEY)',
    };
  }
  console.error(
    '\n[story-gen] No usable AI credentials found.\n' +
      '            Set GEMINI_API_KEY, OPENAI_API_KEY, or the Replit OpenAI\n' +
      '            integration env vars and re-run.\n',
  );
  process.exit(1);
}

const PROVIDER = pickProvider();
const MODEL = process.env.STORY_GEN_MODEL || PROVIDER.defaultModel;
const FORCE = process.env.STORY_GEN_FORCE === '1';

const openai = new OpenAI({ apiKey: PROVIDER.apiKey, baseURL: PROVIDER.baseURL });

// ---------------------------------------------------------------------------
// Game vocabulary — kept in sync by hand with constants/gameData.ts.
// The generator and validator both reference these whitelists so the AI can
// only produce consequences the engine actually knows how to apply.
// ---------------------------------------------------------------------------
const ELEMENT_SYMBOLS = [
  'H', 'He', 'Li', 'C', 'O', 'Fe', 'Cu', 'Ag', 'Au',
  'Pt', 'U', 'Pu', 'Xr7', 'Nv', 'Ti', 'Si',
] as const;
const RESOURCE_KEYS = [...ELEMENT_SYMBOLS, 'credits'] as const;
const FACTION_IDS = ['zorathi', 'krenn', 'vael'] as const;
const BUILDING_IDS = [
  'mine_basic', 'lab_basic', 'habitat_basic', 'defense_basic',
  'storage_basic', 'refinery', 'temple', 'trade_post',
] as const;
const NODE_TYPES = ['random', 'story', 'discovery', 'threat'] as const;

const NEXT_CHAPTER_TOKEN = '<NEXT_CHAPTER>';
const END_TOKEN = 'END';

// ---------------------------------------------------------------------------
// Chapter plan. Tweak this list to rebalance length / theme of the campaign.
// Resource scaling per chapter is enforced by the validator below.
// ---------------------------------------------------------------------------
interface ChapterPlan {
  number: number;
  era: number;
  title: string;
  theme: string;
  nodeCount: number;
  resourceCap: number; // max absolute amount allowed in resourceChanges values
}

const CHAPTERS: ChapterPlan[] = [
  {
    number: 1,
    era: 1,
    title: 'The Awakening',
    theme:
      'Stranded survivors of the colony ship Odyssey wake to discover the planet is not as dead as the scans claimed. Ancient signals pulse beneath the ice. The early days are about food, shelter, first contact with the unknown.',
    nodeCount: 12,
    resourceCap: 100,
  },
  {
    number: 2,
    era: 2,
    title: 'Industrial Dawn',
    theme:
      'Smelters fire up, the first factions arrive in low orbit. The merchant Vael make first contact. The colony must decide how open it is willing to be.',
    nodeCount: 14,
    resourceCap: 200,
  },
  {
    number: 3,
    era: 3,
    title: 'Atomic Horizon',
    theme:
      'Reactors come online. Power tempts the militaristic Krenn Empire to test the colony. Espionage, sabotage, and the first true war-time decisions.',
    nodeCount: 16,
    resourceCap: 400,
  },
  {
    number: 4,
    era: 4,
    title: 'Stellar Reach',
    theme:
      'Warp drives shrink the galaxy. The silent Zorathi Collective makes contact. Alien archaeology unearths ideas that may not be safe to know.',
    nodeCount: 14,
    resourceCap: 800,
  },
  {
    number: 5,
    era: 5,
    title: 'Galactic Convergence',
    theme:
      'A galaxy-shaking convergence forces the colony to choose its place in the new order: lone power, faction ally, or something stranger.',
    nodeCount: 12,
    resourceCap: 1600,
  },
];

// ---------------------------------------------------------------------------
// Types — these mirror the runtime types we will emit into storyData.ts.
// ---------------------------------------------------------------------------
type NodeType = (typeof NODE_TYPES)[number];
type ChoiceId = 'safe' | 'risky';

interface RawChoice {
  id: ChoiceId;
  text: string;
  consequence: string;
  effects: {
    resourceChanges: Record<string, number>;
    stabilityChange: number;
    populationChange: number;
    defensePowerChange: number;
    reputationChanges: Record<string, number>;
    buildingLevelChanges: Record<string, number>;
  };
  nextNodeId: string;
}

interface RawNode {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  choices: RawChoice[];
}

interface RawChapter {
  chapterNumber: number;
  startNodeId: string;
  nodes: RawNode[];
}

// ---------------------------------------------------------------------------
// PROMPTS — this is THE EXACT TEXT sent to OpenAI.
// Kept inline so it lives next to the validator that enforces every rule it
// promises. If you change the schema below, mirror it here too.
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a sci-fi narrative designer building a branching story tree for a space-colony idle RPG called "Space Odyssey: Galactic Evolution".

You will be asked to design ONE CHAPTER at a time. A chapter is a directed graph of "story nodes". Each node is a single dramatic moment. Each node offers EXACTLY TWO choices: a SAFE option and a RISKY option. Each choice points to the NEXT story node, creating branching paths the player explores across multiple playthroughs.

OUTPUT FORMAT
Output a single JSON object. No markdown. No prose. No code fences. Match this exact shape:

{
  "chapterNumber": <integer>,
  "startNodeId": "ch{N}_n01",
  "nodes": [
    {
      "id": "ch{N}_n01",
      "type": "story" | "discovery" | "threat" | "random",
      "title": "Short cinematic title (max 6 words)",
      "description": "2-4 atmospheric sci-fi sentences setting the scene.",
      "choices": [
        {
          "id": "safe",
          "text": "Action verb phrase the player taps.",
          "consequence": "One sentence describing what happens.",
          "effects": {
            "resourceChanges": { "Fe": 30, "credits": 50 },
            "stabilityChange": 2,
            "populationChange": 0,
            "defensePowerChange": 0,
            "reputationChanges": { "vael": 5 },
            "buildingLevelChanges": {}
          },
          "nextNodeId": "ch{N}_n02"
        },
        {
          "id": "risky",
          "text": "Bolder action verb phrase.",
          "consequence": "One sentence describing the bigger swing.",
          "effects": {
            "resourceChanges": { "Au": 80 },
            "stabilityChange": -10,
            "populationChange": -3,
            "defensePowerChange": 0,
            "reputationChanges": { "krenn": -10 },
            "buildingLevelChanges": { "defense_basic": -1 }
          },
          "nextNodeId": "ch{N}_n03"
        }
      ]
    }
    // ...more nodes
  ]
}

HARD RULES — failure to follow these means the chapter is rejected.
1. EVERY node has exactly 2 choices. choice.id MUST be "safe" or "risky", in that order.
2. EVERY choice MUST include all six fields under "effects" (resourceChanges, stabilityChange, populationChange, defensePowerChange, reputationChanges, buildingLevelChanges). Empty objects {} are allowed; missing keys are NOT.
3. Every nextNodeId MUST be one of:
   - the id of another node defined IN THIS CHAPTER, OR
   - the literal token "${NEXT_CHAPTER_TOKEN}" to bridge into the next chapter, OR
   - the literal token "${END_TOKEN}" — only allowed in chapter 5.
4. Node ids MUST follow the pattern "ch{N}_n##" (two-digit zero-padded), e.g. "ch3_n07". The entry node MUST be "ch{N}_n01".
5. The chapter MUST genuinely BRANCH. At LEAST 60% of nodes must have the safe and risky choice pointing to DIFFERENT next nodes. Loops are allowed but the chapter graph must be acyclic from entry to bridge/END.
6. The chapter MUST have at least 2 distinct ending paths (nodes whose choices use "${NEXT_CHAPTER_TOKEN}" / "${END_TOKEN}"). Different endings reflect different player playstyles.
7. SAFE choices = small, low-volatility consequences. RISKY choices = bigger swings, can be very positive AND negative in the same effect block.

ALLOWED EFFECT KEYS — anything else will be silently dropped.
- resourceChanges keys: ${RESOURCE_KEYS.join(', ')}
- reputationChanges keys: ${FACTION_IDS.join(', ')}
- buildingLevelChanges keys: ${BUILDING_IDS.join(', ')}
- stabilityChange: integer in [-30, 15]
- populationChange: integer in [-20, 30]
- defensePowerChange: integer in [-20, 20]
- reputation values: integers in [-30, 30]
- buildingLevel values: integers in [-1, 1]

TONE
- Atmospheric, cinematic, hard sci-fi. Think "The Expanse" meets classic colony games.
- The player is THE COLONY'S LEADER. Address them in second person sparingly ("Your engineers report...") or in narrator voice.
- These are the colony's "Deep Space Events". DO NOT use the words "AI", "machine learning", "GPT", "language model", or any reference to being generated. The events are diegetic in-world history.
- Title fields should sound like episode titles. Avoid generic words like "Choice", "Decision", "Event".

NAMING
- Element symbols use exact case as listed (Fe not fe, Xr7 not xr7).
- Faction ids are lowercase exactly as listed.
- Building ids are lowercase exactly as listed.
`;

function buildUserPrompt(plan: ChapterPlan, totalChapters: number): string {
  const isFinal = plan.number === totalChapters;
  const bridgeToken = isFinal ? END_TOKEN : NEXT_CHAPTER_TOKEN;

  return [
    `CHAPTER ${plan.number} of ${totalChapters} — "${plan.title}" (Era ${plan.era})`,
    '',
    `THEME`,
    plan.theme,
    '',
    `REQUIREMENTS`,
    `- Generate exactly ${plan.nodeCount} story nodes.`,
    `- Entry node id: "ch${plan.number}_n01".`,
    `- Resource amounts in this chapter MUST stay within [-${plan.resourceCap}, +${plan.resourceCap}].`,
    `- Bridging token: every "ending" node uses "${bridgeToken}" as its nextNodeId for choices that finish the chapter.`,
    isFinal
      ? `- This is the FINAL chapter. End-of-chapter bridges use "${END_TOKEN}". Provide at least 3 distinct endings reflecting Lone Power / Faction Allied / Convergence-touched playstyles.`
      : `- Provide at least 2 endings that bridge to chapter ${plan.number + 1}.`,
    '',
    `Return ONLY the JSON object as specified. No commentary, no markdown.`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// One OpenAI call per chapter. Uses response_format=json_object so the API
// guarantees parseable JSON; structural correctness is then enforced by our
// own validator (validateChapter), and we retry up to N times on failure.
// ---------------------------------------------------------------------------
async function generateChapter(
  plan: ChapterPlan,
  totalChapters: number,
): Promise<RawChapter> {
  const maxAttempts = 3;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `[story-gen] Chapter ${plan.number} — attempt ${attempt}/${maxAttempts} (model=${MODEL})`,
    );

    const userPrompt = buildUserPrompt(plan, totalChapters);
    const errorNote = lastError
      ? `\n\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${lastError}\nFix the listed problems.`
      : '';

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt + errorNote },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      lastError = `JSON parse error: ${(err as Error).message}`;
      continue;
    }

    const validation = validateChapter(parsed, plan, totalChapters);
    if (validation.ok) {
      return validation.chapter;
    }
    lastError = validation.errors.join('; ');
    console.warn(
      `[story-gen] Chapter ${plan.number} validation failed: ${lastError}`,
    );
  }

  throw new Error(
    `Chapter ${plan.number} failed after ${maxAttempts} attempts. Last error: ${lastError}`,
  );
}

// ---------------------------------------------------------------------------
// Validator — refuses any chapter that breaks game-engine guarantees.
// Also CLAMPS numeric values into the allowed ranges so a slightly-too-greedy
// risky choice doesn't blow up the player's save.
// ---------------------------------------------------------------------------
function validateChapter(
  raw: unknown,
  plan: ChapterPlan,
  totalChapters: number,
): { ok: true; chapter: RawChapter } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['top-level value is not an object'] };
  }
  const obj = raw as Record<string, unknown>;

  const chapterNumber = obj.chapterNumber;
  const startNodeId = obj.startNodeId;
  const nodesIn = obj.nodes;

  if (chapterNumber !== plan.number) {
    errors.push(`chapterNumber mismatch (got ${chapterNumber}, want ${plan.number})`);
  }
  if (startNodeId !== `ch${plan.number}_n01`) {
    errors.push(`startNodeId must be "ch${plan.number}_n01" (got "${startNodeId}")`);
  }
  if (!Array.isArray(nodesIn)) {
    return { ok: false, errors: [...errors, 'nodes is not an array'] };
  }
  if (nodesIn.length === 0) {
    return { ok: false, errors: [...errors, 'nodes array is empty'] };
  }

  const isFinal = plan.number === totalChapters;
  const allowedBridge = isFinal ? END_TOKEN : NEXT_CHAPTER_TOKEN;

  // First pass: validate node shapes, collect ids.
  const nodes: RawNode[] = [];
  const idSet = new Set<string>();
  const idPattern = new RegExp(`^ch${plan.number}_n\\d{2}$`);

  for (const n of nodesIn) {
    if (!n || typeof n !== 'object') {
      errors.push('node is not an object');
      continue;
    }
    const node = n as Record<string, unknown>;
    const id = String(node.id);
    if (!idPattern.test(id)) {
      errors.push(`node id "${id}" doesn't match pattern ch${plan.number}_n##`);
      continue;
    }
    if (idSet.has(id)) {
      errors.push(`duplicate node id "${id}"`);
      continue;
    }
    idSet.add(id);

    const type = node.type;
    if (typeof type !== 'string' || !NODE_TYPES.includes(type as NodeType)) {
      errors.push(`node ${id} has invalid type "${String(type)}"`);
      continue;
    }
    const title = typeof node.title === 'string' ? node.title.trim() : '';
    const description =
      typeof node.description === 'string' ? node.description.trim() : '';
    if (!title) errors.push(`node ${id} missing title`);
    if (!description) errors.push(`node ${id} missing description`);

    const choicesIn = node.choices;
    if (!Array.isArray(choicesIn) || choicesIn.length !== 2) {
      errors.push(`node ${id} must have exactly 2 choices`);
      continue;
    }

    const choices = choicesIn.map((c, i) => normalizeChoice(c, id, i, plan, errors, allowedBridge));
    if (choices.some((c) => c === null)) continue;
    if (choices[0]!.id !== 'safe' || choices[1]!.id !== 'risky') {
      errors.push(`node ${id} choices must be ordered [safe, risky]`);
      continue;
    }

    nodes.push({
      id,
      type: type as NodeType,
      title,
      description,
      choices: choices as RawChoice[],
    });
  }

  // Second pass: graph integrity.
  const branchingNodes = nodes.filter(
    (n) => n.choices[0].nextNodeId !== n.choices[1].nextNodeId,
  ).length;
  if (branchingNodes / Math.max(1, nodes.length) < 0.6) {
    errors.push(
      `only ${branchingNodes}/${nodes.length} nodes branch; need at least 60%`,
    );
  }

  let bridgeCount = 0;
  for (const n of nodes) {
    for (const c of n.choices) {
      if (c.nextNodeId === allowedBridge) {
        bridgeCount++;
      } else if (!idSet.has(c.nextNodeId)) {
        errors.push(
          `node ${n.id} choice ${c.id} points to unknown next "${c.nextNodeId}"`,
        );
      }
    }
  }
  if (bridgeCount < 2) {
    errors.push(
      `chapter must have at least 2 ending paths using "${allowedBridge}" (found ${bridgeCount})`,
    );
  }

  // Reachability from entry.
  const entry = `ch${plan.number}_n01`;
  if (!idSet.has(entry)) {
    errors.push(`entry node "${entry}" missing`);
  } else {
    const reachable = new Set<string>([entry]);
    const queue = [entry];
    const byId = new Map(nodes.map((n) => [n.id, n] as const));
    while (queue.length) {
      const cur = queue.shift()!;
      const node = byId.get(cur);
      if (!node) continue;
      for (const c of node.choices) {
        if (c.nextNodeId === allowedBridge) continue;
        if (!reachable.has(c.nextNodeId) && idSet.has(c.nextNodeId)) {
          reachable.add(c.nextNodeId);
          queue.push(c.nextNodeId);
        }
      }
    }
    for (const id of idSet) {
      if (!reachable.has(id)) {
        errors.push(`node "${id}" is unreachable from entry`);
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    chapter: { chapterNumber: plan.number, startNodeId: entry, nodes },
  };
}

function normalizeChoice(
  raw: unknown,
  nodeId: string,
  index: number,
  plan: ChapterPlan,
  errors: string[],
  allowedBridge: string,
): RawChoice | null {
  if (!raw || typeof raw !== 'object') {
    errors.push(`node ${nodeId} choice[${index}] is not an object`);
    return null;
  }
  const c = raw as Record<string, unknown>;
  const id = c.id === 'safe' || c.id === 'risky' ? c.id : null;
  if (!id) {
    errors.push(`node ${nodeId} choice[${index}] has invalid id "${String(c.id)}"`);
    return null;
  }
  const text = typeof c.text === 'string' ? c.text.trim() : '';
  const consequence = typeof c.consequence === 'string' ? c.consequence.trim() : '';
  if (!text) errors.push(`node ${nodeId} choice ${id} missing text`);
  if (!consequence) errors.push(`node ${nodeId} choice ${id} missing consequence`);

  const next = typeof c.nextNodeId === 'string' ? c.nextNodeId : '';
  if (!next) {
    errors.push(`node ${nodeId} choice ${id} missing nextNodeId`);
    return null;
  }

  const eff = (c.effects && typeof c.effects === 'object'
    ? c.effects
    : {}) as Record<string, unknown>;

  const resourceChanges = filterDict(
    eff.resourceChanges,
    RESOURCE_KEYS as readonly string[],
    -plan.resourceCap,
    plan.resourceCap,
  );
  const reputationChanges = filterDict(
    eff.reputationChanges,
    FACTION_IDS as readonly string[],
    -30,
    30,
  );
  const buildingLevelChanges = filterDict(
    eff.buildingLevelChanges,
    BUILDING_IDS as readonly string[],
    -1,
    1,
  );

  return {
    id: id as ChoiceId,
    text,
    consequence,
    nextNodeId: next,
    effects: {
      resourceChanges,
      reputationChanges,
      buildingLevelChanges,
      stabilityChange: clampInt(eff.stabilityChange, -30, 15),
      populationChange: clampInt(eff.populationChange, -20, 30),
      defensePowerChange: clampInt(eff.defensePowerChange, -20, 20),
    },
  };
}

function filterDict(
  raw: unknown,
  whitelist: readonly string[],
  min: number,
  max: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!whitelist.includes(k)) continue;
    const n = clampInt(v, min, max);
    if (n !== 0) out[k] = n;
  }
  return out;
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Cache helpers — every accepted chapter is written to disk so a re-run
// after a crash / Ctrl-C only re-asks for the missing chapters.
// ---------------------------------------------------------------------------
function cachePathFor(num: number): string {
  return join(CACHE_DIR, `chapter-${num}.json`);
}

function loadCachedChapter(num: number): RawChapter | null {
  const p = cachePathFor(num);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as RawChapter;
  } catch {
    return null;
  }
}

function saveCachedChapter(chapter: RawChapter): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePathFor(chapter.chapterNumber), JSON.stringify(chapter, null, 2));
}

// ---------------------------------------------------------------------------
// Final emitter — turns the validated chapter list into a typed TS module.
// All <NEXT_CHAPTER> tokens are resolved to the actual entry id of the
// following chapter so the runtime never has to interpret a marker.
// ---------------------------------------------------------------------------
function emitStoryDataModule(chapters: RawChapter[]): string {
  const totalChapters = chapters.length;

  // Resolve <NEXT_CHAPTER> bridges.
  for (let i = 0; i < chapters.length; i++) {
    const next = chapters[i + 1];
    const bridgeTo = next ? next.startNodeId : END_TOKEN;
    for (const node of chapters[i].nodes) {
      for (const choice of node.choices) {
        if (choice.nextNodeId === NEXT_CHAPTER_TOKEN) choice.nextNodeId = bridgeTo;
      }
    }
  }

  // Flatten into a global lookup so the runtime can resolve any id in O(1).
  const nodesById: Record<string, RawNode> = {};
  for (const ch of chapters) {
    for (const n of ch.nodes) {
      nodesById[n.id] = n;
    }
  }

  const generatedAt = new Date().toISOString();
  const totalNodes = Object.keys(nodesById).length;

  const header = `/* eslint-disable */
// =============================================================================
// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
// Generated by: scripts/src/generateStoryTree.ts
// Generated at: ${generatedAt}
// Chapters: ${totalChapters}   Nodes: ${totalNodes}
//
// To regenerate, run:
//   pnpm --filter @workspace/scripts run generate:story
//
// This file contains the entire branching "Deep Space Events" campaign.
// The mobile app reads it directly — there is no network call at runtime.
// =============================================================================

export type StoryNodeType = 'random' | 'story' | 'discovery' | 'threat';
export type StoryChoiceId = 'safe' | 'risky';

export interface StoryEffects {
  /** Element symbol or "credits" -> signed integer. */
  resourceChanges: Record<string, number>;
  /** -30..+15 */
  stabilityChange: number;
  /** -20..+30 */
  populationChange: number;
  /** -20..+20 */
  defensePowerChange: number;
  /** Faction id (zorathi|krenn|vael) -> -30..+30. */
  reputationChanges: Record<string, number>;
  /** Building id -> -1..+1 (level delta). */
  buildingLevelChanges: Record<string, number>;
}

export interface StoryChoice {
  id: StoryChoiceId;
  text: string;
  consequence: string;
  effects: StoryEffects;
  /** Id of the next StoryNode, or "END" if the campaign concludes here. */
  nextNodeId: string;
}

export interface StoryNode {
  id: string;
  type: StoryNodeType;
  title: string;
  description: string;
  choices: [StoryChoice, StoryChoice];
}

export interface StoryChapter {
  number: number;
  era: number;
  title: string;
  startNodeId: string;
  nodeIds: string[];
}

export interface StoryTree {
  generatedAt: string;
  chapters: StoryChapter[];
  /** Flat lookup so the engine can resolve any node id in O(1). */
  nodesById: Record<string, StoryNode>;
  /** Entry node for a brand-new player. */
  rootNodeId: string;
  /** Special terminal id used to mark "campaign complete". */
  endNodeId: 'END';
}

`;

  const chapterMeta = chapters.map((ch, i) => ({
    number: ch.chapterNumber,
    era: CHAPTERS[i].era,
    title: CHAPTERS[i].title,
    startNodeId: ch.startNodeId,
    nodeIds: ch.nodes.map((n) => n.id),
  }));

  const tree = {
    generatedAt,
    chapters: chapterMeta,
    nodesById,
    rootNodeId: chapters[0].startNodeId,
    endNodeId: END_TOKEN,
  };

  return header + `export const STORY_TREE: StoryTree = ${JSON.stringify(tree, null, 2)} as const;\n`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`[story-gen] Output target: ${OUTPUT_PATH}`);
  console.log(`[story-gen] Cache directory: ${CACHE_DIR}`);
  console.log(`[story-gen] Provider: ${PROVIDER.label}`);
  console.log(`[story-gen] Model:    ${MODEL}    Force regenerate: ${FORCE}`);

  const chapters: RawChapter[] = [];
  for (const plan of CHAPTERS) {
    if (!FORCE) {
      const cached = loadCachedChapter(plan.number);
      if (cached) {
        const re = validateChapter(cached, plan, CHAPTERS.length);
        if (re.ok) {
          console.log(`[story-gen] Chapter ${plan.number}: using cached copy.`);
          chapters.push(re.chapter);
          continue;
        }
        console.warn(
          `[story-gen] Cached chapter ${plan.number} failed re-validation, regenerating.`,
        );
      }
    }
    const ch = await generateChapter(plan, CHAPTERS.length);
    saveCachedChapter(ch);
    chapters.push(ch);
    const totalNodes = ch.nodes.length;
    const totalChoices = ch.nodes.reduce((s, n) => s + n.choices.length, 0);
    console.log(
      `[story-gen] Chapter ${plan.number} accepted — ${totalNodes} nodes, ${totalChoices} choices.`,
    );
  }

  const tsSource = emitStoryDataModule(chapters);
  if (!existsSync(dirname(OUTPUT_PATH))) {
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  }
  writeFileSync(OUTPUT_PATH, tsSource, 'utf-8');

  const totalNodes = chapters.reduce((s, c) => s + c.nodes.length, 0);
  console.log(
    `\n[story-gen] DONE.\n` +
      `            Wrote ${chapters.length} chapters / ${totalNodes} nodes to:\n` +
      `            ${OUTPUT_PATH}\n`,
  );
}

main().catch((err) => {
  console.error('\n[story-gen] FATAL:', err);
  process.exit(1);
});
