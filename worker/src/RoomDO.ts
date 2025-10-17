import type { Env } from "./index";
import { createObservability, serializeError, type Observability } from "./observability";
import {
  PROTOCOL_VERSION,
  RANKING_SORT_LOCALE,
  RANKING_SORT_OPTIONS,
  WORLD_RADIUS,
  clientMessageSchema,
  joinMessageSchema,
  actionMessageSchema,
  sanitizePlayerName,
  sanitizeArchetypeKey,
  type ActionMessage,
  type ClientMessage,
  type GamePhase,
  type JoinedMessage,
  type JoinMessage,
  type PlayerAction,
  type PlayerAttackAction,
  type AttackKind,
  type PlayerCollectAction,
  type PlayerMovementAction,
  type PongMessage,
  type RankingEntry,
  type RankingMessage,
  type ResetMessage,
  type ErrorMessage,
  type ServerMessage,
  type SharedGameState,
  type SharedGameStateDiff,
  type SharedWorldState,
  type SharedWorldStateDiff,
  type StatusEffectEvent,
  type SharedProgressionState,
  type SharedProgressionStream,
  type SharedProgressionKillEvent,
  type CombatAttributes,
  type CombatLogEntry,
  type Microorganism,
  type OrganicMatter,
  type Obstacle,
  type RoomObject,
  type StateDiffMessage,
  type StateFullMessage,
  type Vector2,
  type OrientationState,
  type HealthState,
  type CombatStatus,
  type PlayerEvolutionAction,
  type ArchetypeKey,
  aggregateDrops,
  DROP_TABLES,
  TARGET_OPTIONAL_ATTACK_KINDS
} from "./types";
import {
  SKILL_KEYS,
  cloneSkillCooldowns,
  getDefaultSkillList,
  getSkillDefinition,
  isSkillKey,
  type SkillDefinition,
  type SkillKey,
  type StatusTag,
} from "./skills";
import {
  mergeStatusEffect,
  pruneExpiredStatusEffects,
  toStatusEffectEvent,
  type StatusCollection,
} from "./statuses";

const MIN_PLAYERS_TO_START = 1;
const WAITING_START_DELAY_MS = 15_000;
const WAITING_START_DELAY_ENABLED = MIN_PLAYERS_TO_START > 1;
const ROUND_DURATION_MS = 120_000;
const RESET_DELAY_MS = 10_000;
const RECONNECT_WINDOW_MS = 30_000;
const INACTIVE_TIMEOUT_MS = 45_000;
export const MAX_PLAYERS = 100;

const MAX_COMBO_MULTIPLIER = 50;

// Allow clients to sustain at least 70 messages per second without being
// throttled by using a one-minute sliding window.
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const MAX_MESSAGES_PER_CONNECTION = 4_200;
// Base global rate limit; the runtime cap scales with the number of active sockets.
export const MAX_MESSAGES_GLOBAL = 12_000;
export const GLOBAL_RATE_LIMIT_HEADROOM = 1.25;
const RATE_LIMIT_UTILIZATION_REPORT_INTERVAL_MS = 5_000;

const PLAYERS_KEY = "players";
const WORLD_KEY = "world";
const ALARM_KEY = "alarms";
const SNAPSHOT_STATE_KEY = "snapshot_state";

export const WORLD_TICK_INTERVAL_MS = 50;
const SNAPSHOT_FLUSH_INTERVAL_MS = 500;
const PLAYER_ATTACK_COOLDOWN_MS = 800;
const PLAYER_COLLECT_RADIUS = 60;
const PLAYER_ATTACK_RANGE_BUFFER = 4;
const OBSTACLE_PADDING = 12;

const ORGANIC_MATTER_CELL_SIZE = PLAYER_COLLECT_RADIUS;

const CLIENT_TIME_MAX_FUTURE_DRIFT_MS = 2_000;

const WORLD_BOUNDS = {
  minX: -WORLD_RADIUS,
  maxX: WORLD_RADIUS,
  minY: -WORLD_RADIUS,
  maxY: WORLD_RADIUS
} as const;

const SUPPORTED_CLIENT_VERSIONS = new Set([PROTOCOL_VERSION]);

export class MessageRateLimiter {
  private timestamps: number[] = [];
  private startIndex = 0;

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  consume(now: number, limitOverride?: number): boolean {
    this.prune(now);
    const limit = limitOverride ?? this.limit;
    if (this.getActiveCount() >= limit) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }

  getUtilization(now: number, limitOverride?: number): number {
    this.prune(now);
    const limit = limitOverride ?? this.limit;
    if (limit <= 0) {
      return 0;
    }
    return this.getActiveCount() / limit;
  }

  getRetryAfterMs(now: number): number {
    this.prune(now);
    const earliest = this.timestamps[this.startIndex];
    if (earliest === undefined) {
      return 0;
    }
    return Math.max(0, earliest + this.windowMs - now);
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.startIndex < this.timestamps.length && this.timestamps[this.startIndex]! <= cutoff) {
      this.startIndex++;
    }

    if (this.startIndex > 0 && this.startIndex * 2 >= this.timestamps.length) {
      this.timestamps = this.timestamps.slice(this.startIndex);
      this.startIndex = 0;
    }
  }

  private getActiveCount(): number {
    return this.timestamps.length - this.startIndex;
  }
}

type PersistentAlarmType = "waiting_start" | "round_end" | "reset" | "cleanup";
type TransientAlarmType = "world_tick" | "snapshot";
type AlarmType = PersistentAlarmType | TransientAlarmType;

type AlarmSnapshot = Record<PersistentAlarmType, number | null>;

type SnapshotState = {
  playersDirty: boolean;
  worldDirty: boolean;
  pendingSnapshotAlarm: number | null;
};

type StoredPlayerSkillState = {
  available: SkillKey[];
  current: SkillKey;
  cooldowns: Record<string, number>;
};

type PlayerSkillState = {
  available: SkillKey[];
  current: SkillKey;
  cooldowns: Record<string, number>;
};

type PendingAttack = {
  kind: AttackKind;
  targetPlayerId?: string | null;
  targetObjectId?: string | null;
};

type StoredPlayer = {
  id: string;
  name: string;
  score: number;
  combo: number;
  energy: number;
  xp: number;
  geneticMaterial: number;
  position: Vector2;
  movementVector: Vector2;
  orientation: OrientationState;
  health: HealthState;
  combatStatus: CombatStatus;
  combatAttributes: CombatAttributes;
  evolutionState: PlayerEvolutionState;
  archetypeKey: string | null;
  reconnectToken: string;
  skillState?: StoredPlayerSkillState;
  totalSessionDurationMs?: number;
  sessionCount?: number;
};

type StoredPlayerSnapshot = Omit<
  StoredPlayer,
  "position" | "movementVector" | "orientation" | "health" | "combatStatus" | "combatAttributes" | "evolutionState"
> &
  Partial<
    Pick<
      StoredPlayer,
      | "position"
      | "movementVector"
      | "orientation"
      | "health"
      | "combatStatus"
      | "combatAttributes"
      | "evolutionState"
      | "archetypeKey"
      | "skillState"
    >
  >;

type PlayerInternal = Omit<StoredPlayer, "skillState"> & {
  connected: boolean;
  lastActiveAt: number;
  lastSeenAt: number;
  connectedAt: number | null;
  skillState: PlayerSkillState;
  pendingAttack: PendingAttack | null;
  statusEffects: StatusCollection;
  invulnerableUntil: number | null;
  pendingRemoval?: boolean;
};

type ApplyPlayerActionResult = {
  updatedPlayers: PlayerInternal[];
  worldDiff?: SharedWorldStateDiff;
  combatLog?: CombatLogEntry[];
  scoresChanged?: boolean;
};

type PlayerProgressionState = {
  dropPity: { fragment: number; stableGene: number };
  sequence: number;
};

type PendingProgressionStream = {
  sequence: number;
  dropPity: { fragment: number; stableGene: number };
  damage?: SharedProgressionStream["damage"];
  objectives?: SharedProgressionStream["objectives"];
  kills?: SharedProgressionKillEvent[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const createVector = (vector?: Vector2): Vector2 => ({
  x: vector?.x ?? 0,
  y: vector?.y ?? 0,
});

const cloneVector = (vector: Vector2): Vector2 => ({ x: vector.x, y: vector.y });

const createOrientation = (orientation?: OrientationState): OrientationState => {
  if (!orientation) {
    return { angle: 0 };
  }
  return orientation.tilt === undefined
    ? { angle: orientation.angle }
    : { angle: orientation.angle, tilt: orientation.tilt };
};

const cloneOrientation = (orientation: OrientationState): OrientationState =>
  orientation.tilt === undefined
    ? { angle: orientation.angle }
    : { angle: orientation.angle, tilt: orientation.tilt };

const DEFAULT_MAX_HEALTH = 100;

const createHealthState = (health?: HealthState): HealthState => {
  const max = health?.max ?? DEFAULT_MAX_HEALTH;
  const current = health?.current ?? max;
  return {
    current: Math.max(0, Math.min(max, current)),
    max,
  };
};

const sanitizeReconnectToken = (token: unknown): string | null => {
  if (typeof token !== "string") {
    return null;
  }

  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 128);
};

const generateReconnectToken = (): string => crypto.randomUUID();

const cloneHealthState = (health: HealthState): HealthState => ({
  current: health.current,
  max: health.max,
});

const createCombatStatusState = (status?: CombatStatus): CombatStatus => ({
  state: status?.state ?? "idle",
  targetPlayerId: status?.targetPlayerId ?? null,
  targetObjectId: status?.targetObjectId ?? null,
  lastAttackAt: status?.lastAttackAt ?? null,
});

const cloneCombatStatusState = (status: CombatStatus): CombatStatus => ({
  state: status.state,
  targetPlayerId: status.targetPlayerId,
  targetObjectId: status.targetObjectId,
  lastAttackAt: status.lastAttackAt,
});

const DEFAULT_COMBAT_ATTRIBUTES: CombatAttributes = {
  attack: 8,
  defense: 4,
  speed: 140,
  range: 80,
};

const DEFAULT_PLAYER_ENERGY = 100;
const DEFAULT_PLAYER_XP = 0;
const DEFAULT_PLAYER_GENETIC_MATERIAL = 0;

const createCombatAttributes = (attributes?: CombatAttributes): CombatAttributes => ({
  attack: attributes?.attack ?? DEFAULT_COMBAT_ATTRIBUTES.attack,
  defense: attributes?.defense ?? DEFAULT_COMBAT_ATTRIBUTES.defense,
  speed: attributes?.speed ?? DEFAULT_COMBAT_ATTRIBUTES.speed,
  range: attributes?.range ?? DEFAULT_COMBAT_ATTRIBUTES.range,
});

const createPlayerSkillState = (stored?: StoredPlayerSkillState): PlayerSkillState => {
  const storedAvailable = Array.isArray(stored?.available)
    ? stored!.available.filter((entry): entry is SkillKey => typeof entry === "string" && isSkillKey(entry))
    : [];
  const available = storedAvailable.length > 0 ? storedAvailable : getDefaultSkillList();
  const fallback = available[0] ?? getDefaultSkillList()[0]!;
  const current = stored?.current && isSkillKey(stored.current) ? stored.current : fallback;
  const cooldownEntries = cloneSkillCooldowns(stored?.cooldowns);
  const normalizedCooldowns: Record<string, number> = {};
  for (const key of available) {
    normalizedCooldowns[key] = Math.max(0, cooldownEntries[key] ?? 0);
  }
  return {
    available,
    current,
    cooldowns: normalizedCooldowns,
  };
};

const clonePlayerSkillState = (state: PlayerSkillState): StoredPlayerSkillState => ({
  available: state.available.slice(),
  current: state.current,
  cooldowns: { ...state.cooldowns },
});

const normalizePlayerSkillState = (
  state: PlayerSkillState | StoredPlayerSkillState | undefined,
): PlayerSkillState => createPlayerSkillState(state as StoredPlayerSkillState | undefined);

type ArchetypeDefinition = {
  key: ArchetypeKey;
  maxHealth: number;
  combatAttributes: CombatAttributes;
};

const ARCHETYPE_DEFINITIONS: Record<ArchetypeKey, ArchetypeDefinition> = {
  virus: {
    key: "virus",
    maxHealth: 90,
    combatAttributes: createCombatAttributes({
      attack: 12,
      defense: 3,
      speed: 176,
      range: 88,
    }),
  },
  bacteria: {
    key: "bacteria",
    maxHealth: 120,
    combatAttributes: createCombatAttributes({
      attack: 9,
      defense: 7,
      speed: 144,
      range: 84,
    }),
  },
  archaea: {
    key: "archaea",
    maxHealth: 125,
    combatAttributes: createCombatAttributes({
      attack: 10,
      defense: 8,
      speed: 140,
      range: 82,
    }),
  },
  protozoa: {
    key: "protozoa",
    maxHealth: 100,
    combatAttributes: createCombatAttributes({
      attack: 13,
      defense: 4,
      speed: 172,
      range: 90,
    }),
  },
  algae: {
    key: "algae",
    maxHealth: 115,
    combatAttributes: createCombatAttributes({
      attack: 9,
      defense: 6,
      speed: 150,
      range: 92,
    }),
  },
  fungus: {
    key: "fungus",
    maxHealth: 130,
    combatAttributes: createCombatAttributes({
      attack: 11,
      defense: 9,
      speed: 136,
      range: 82,
    }),
  },
};

const getArchetypeDefinition = (key: string | null | undefined): ArchetypeDefinition | null => {
  if (!key) {
    return null;
  }
  const normalized = sanitizeArchetypeKey(key);
  if (!normalized) {
    return null;
  }
  return ARCHETYPE_DEFINITIONS[normalized] ?? null;
};

const cloneCombatAttributes = (attributes: CombatAttributes): CombatAttributes => ({
  attack: attributes.attack,
  defense: attributes.defense,
  speed: attributes.speed,
  range: attributes.range,
});

const COMBAT_STAT_KEYS = ["attack", "defense", "speed", "range"] as const;
type CombatStatKey = (typeof COMBAT_STAT_KEYS)[number];

const EVOLUTION_TIERS = ["small", "medium", "large", "macro"] as const;
type EvolutionTier = (typeof EVOLUTION_TIERS)[number];

type CombatStatModifierState = {
  additive: number;
  multiplier: number;
  baseOverride: number;
};

type EvolutionHistoryState = Record<EvolutionTier, Record<string, number>>;

type PlayerEvolutionState = {
  traits: string[];
  history: EvolutionHistoryState;
  modifiers: Record<CombatStatKey, CombatStatModifierState>;
};

const createCombatStatModifier = (modifier?: Partial<CombatStatModifierState>): CombatStatModifierState => ({
  additive: Number.isFinite(modifier?.additive) ? Number(modifier?.additive) : 0,
  multiplier: Number.isFinite(modifier?.multiplier) ? Number(modifier?.multiplier) : 0,
  baseOverride: Number.isFinite(modifier?.baseOverride) ? Number(modifier?.baseOverride) : 0,
});

const sanitizeHistoryBucket = (bucket?: Record<string, unknown> | null): Record<string, number> => {
  if (!bucket || typeof bucket !== "object") {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(bucket)) {
    if (typeof key !== "string" || !key) {
      continue;
    }
    const numeric = Number.isFinite(value) ? Math.trunc(Number(value)) : 0;
    if (numeric > 0) {
      normalized[key] = numeric;
    }
  }
  return normalized;
};

const createEvolutionHistoryState = (history?: Partial<EvolutionHistoryState> | null): EvolutionHistoryState => ({
  small: sanitizeHistoryBucket(history?.small),
  medium: sanitizeHistoryBucket(history?.medium),
  large: sanitizeHistoryBucket(history?.large),
  macro: sanitizeHistoryBucket((history as Partial<EvolutionHistoryState> | undefined)?.macro),
});

const createEvolutionState = (state?: Partial<PlayerEvolutionState> | null): PlayerEvolutionState => {
  const traits = Array.isArray(state?.traits)
    ? Array.from(
        new Set(
          state!.traits
            .map((trait) => (typeof trait === "string" ? trait.trim() : ""))
            .filter((trait) => trait.length > 0),
        ),
      )
    : [];

  const modifiers: Record<CombatStatKey, CombatStatModifierState> = {
    attack: createCombatStatModifier(state?.modifiers?.attack),
    defense: createCombatStatModifier(state?.modifiers?.defense),
    speed: createCombatStatModifier(state?.modifiers?.speed),
    range: createCombatStatModifier(state?.modifiers?.range),
  };

  return {
    traits,
    history: createEvolutionHistoryState(state?.history),
    modifiers,
  };
};

const cloneEvolutionState = (state?: PlayerEvolutionState | null): PlayerEvolutionState => {
  if (!state) {
    return createEvolutionState();
  }

  return {
    traits: [...state.traits],
    history: {
      small: { ...state.history.small },
      medium: { ...state.history.medium },
      large: { ...state.history.large },
      macro: { ...state.history.macro },
    },
    modifiers: {
      attack: { ...state.modifiers.attack },
      defense: { ...state.modifiers.defense },
      speed: { ...state.modifiers.speed },
      range: { ...state.modifiers.range },
    },
  };
};

const applyStatAdjustments = (
  target: Record<CombatStatKey, CombatStatModifierState>,
  adjustments: Partial<Record<CombatStatKey, number>> | undefined,
  kind: keyof CombatStatModifierState,
): boolean => {
  if (!adjustments) {
    return false;
  }

  let changed = false;
  for (const key of COMBAT_STAT_KEYS) {
    const delta = adjustments[key];
    if (!Number.isFinite(delta) || delta === 0) {
      continue;
    }
    const modifier = target[key];
    const next = modifier[kind] + Number(delta);
    if (Number.isFinite(next)) {
      modifier[kind] = next;
      changed = true;
    }
  }
  return changed;
};

const applyEvolutionActionToState = (
  state: PlayerEvolutionState,
  action: PlayerEvolutionAction,
): boolean => {
  let changed = false;

  if (action.tier && action.evolutionId) {
    const tier = EVOLUTION_TIERS.find((value) => value === action.tier);
    if (tier) {
      const bucket = state.history[tier];
      const delta =
        action.countDelta !== undefined && Number.isFinite(action.countDelta)
          ? Math.trunc(Number(action.countDelta))
          : 1;
      if (delta !== 0) {
        const next = (bucket[action.evolutionId] ?? 0) + delta;
        if (next > 0) {
          bucket[action.evolutionId] = next;
        } else {
          delete bucket[action.evolutionId];
        }
        changed = true;
      }
    }
  }

  if (Array.isArray(action.traitDeltas)) {
    for (const trait of action.traitDeltas) {
      if (typeof trait !== "string") {
        continue;
      }
      const normalized = trait.trim();
      if (normalized && !state.traits.includes(normalized)) {
        state.traits.push(normalized);
        changed = true;
      }
    }
  }

  const additiveChanged = applyStatAdjustments(state.modifiers, action.additiveDelta, "additive");
  const multiplierChanged = applyStatAdjustments(state.modifiers, action.multiplierDelta, "multiplier");
  const baseChanged = applyStatAdjustments(state.modifiers, action.baseDelta, "baseOverride");

  return changed || additiveChanged || multiplierChanged || baseChanged;
};

const computeStatWithModifiers = (
  base: number,
  modifier: CombatStatModifierState,
): number => {
  const baseOverride = Number.isFinite(modifier.baseOverride) ? modifier.baseOverride : 0;
  const additive = Number.isFinite(modifier.additive) ? modifier.additive : 0;
  const multiplier = Number.isFinite(modifier.multiplier) ? modifier.multiplier : 0;

  const effectiveBase = base + baseOverride;
  const scaled = (effectiveBase + additive) * Math.max(0, 1 + multiplier);
  if (!Number.isFinite(scaled)) {
    return Math.max(0, base);
  }
  return Math.max(0, scaled);
};

const clonePityCounters = (pity: { fragment: number; stableGene: number }) => ({
  fragment: pity.fragment,
  stableGene: pity.stableGene,
});

const cloneWorldState = (world: SharedWorldState): SharedWorldState => ({
  microorganisms: world.microorganisms.map((entity) => ({
    ...entity,
    position: cloneVector(entity.position),
    movementVector: cloneVector(entity.movementVector),
    orientation: cloneOrientation(entity.orientation),
    health: cloneHealthState(entity.health),
    attributes: { ...entity.attributes },
  })),
  organicMatter: world.organicMatter.map((matter) => ({
    ...matter,
    position: cloneVector(matter.position),
    nutrients: { ...matter.nutrients },
  })),
  obstacles: world.obstacles.map((obstacle) => ({
    ...obstacle,
    position: cloneVector(obstacle.position),
    size: cloneVector(obstacle.size),
    orientation: obstacle.orientation ? cloneOrientation(obstacle.orientation) : undefined,
  })),
  roomObjects: world.roomObjects.map((object) => ({
    ...object,
    position: cloneVector(object.position),
    state: object.state ? { ...object.state } : undefined,
  })),
});

const cloneMicroorganism = (entity: Microorganism): Microorganism => ({
  ...entity,
  position: cloneVector(entity.position),
  movementVector: cloneVector(entity.movementVector),
  orientation: cloneOrientation(entity.orientation),
  health: cloneHealthState(entity.health),
  attributes: { ...entity.attributes },
});

const cloneOrganicMatter = (matter: OrganicMatter): OrganicMatter => ({
  ...matter,
  position: cloneVector(matter.position),
  nutrients: { ...matter.nutrients },
});

const INITIAL_WORLD_TEMPLATE: SharedWorldState = {
  microorganisms: [
    {
      id: "micro-alpha",
      kind: "microorganism",
      species: "bacillus",
      position: { x: -200, y: -150 },
      movementVector: { x: 1, y: 0 },
      orientation: { angle: 0 },
      health: { current: 40, max: 40 },
      aggression: "neutral",
      attributes: { speed: 40, damage: 6, resilience: 3 },
    },
    {
      id: "micro-beta",
      kind: "microorganism",
      species: "amoeba",
      position: { x: 220, y: 160 },
      movementVector: { x: -0.6, y: 0.8 },
      orientation: { angle: Math.PI / 2 },
      health: { current: 55, max: 55 },
      aggression: "hostile",
      attributes: { speed: 50, damage: 9, resilience: 4 },
    },
    {
      id: "micro-gamma",
      kind: "microorganism",
      species: "ciliate",
      position: { x: 0, y: 260 },
      movementVector: { x: 0, y: -1 },
      orientation: { angle: Math.PI },
      health: { current: 35, max: 35 },
      aggression: "neutral",
      attributes: { speed: 30, damage: 5, resilience: 2 },
    },
  ],
  organicMatter: [
    {
      id: "organic-alpha",
      kind: "organic_matter",
      position: { x: 140, y: -120 },
      quantity: 24,
      nutrients: { carbon: 10, nitrogen: 4 },
    },
    {
      id: "organic-beta",
      kind: "organic_matter",
      position: { x: -260, y: 200 },
      quantity: 18,
      nutrients: { carbon: 6 },
    },
    {
      id: "organic-gamma",
      kind: "organic_matter",
      position: { x: 80, y: 40 },
      quantity: 30,
      nutrients: { phosphorus: 5 },
    },
  ],
  obstacles: [
    {
      id: "obstacle-alpha",
      kind: "obstacle",
      position: { x: 0, y: 0 },
      size: { x: 160, y: 120 },
      impassable: true,
    },
    {
      id: "obstacle-beta",
      kind: "obstacle",
      position: { x: -320, y: -200 },
      size: { x: 100, y: 160 },
      impassable: true,
    },
  ],
  roomObjects: [],
};

type WorldGenerationOptions = {
  primarySpawn?: Vector2 | null;
};

const clampToWorldBounds = (position: Vector2): Vector2 => ({
  x: clamp(position.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
  y: clamp(position.y, WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY),
});

const translateWithinWorldBounds = (position: Vector2, offset: Vector2): Vector2 =>
  clampToWorldBounds({
    x: position.x + offset.x,
    y: position.y + offset.y,
  });

const ENTITY_OFFSET_RATIOS: readonly number[] = [0.22, 0.18, 0.16, 0.14, 0.12, 0.1];

const normalizeVector = (vector: Vector2): Vector2 => {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }
  return { x: vector.x / magnitude, y: vector.y / magnitude };
};

const getOrderedSpawnDirections = (primarySpawn: Vector2): Vector2[] => {
  const remainingPositions = PLAYER_SPAWN_POSITIONS.slice();
  const primaryIndex = remainingPositions.findIndex(
    (position) => position.x === primarySpawn.x && position.y === primarySpawn.y,
  );

  if (primaryIndex >= 0) {
    const [primaryPosition] = remainingPositions.splice(primaryIndex, 1);
    return [primaryPosition, ...remainingPositions].map((position) =>
      normalizeVector(position),
    );
  }

  return [primarySpawn, ...remainingPositions].map((position) => normalizeVector(position));
};

const getEntityOffset = (directions: Vector2[], index: number): Vector2 => {
  if (directions.length === 0) {
    return { x: 0, y: 0 };
  }
  const direction = directions[index % directions.length]!;
  const ratio = ENTITY_OFFSET_RATIOS[index % ENTITY_OFFSET_RATIOS.length] ?? 0;
  const distance = WORLD_RADIUS * ratio;
  return {
    x: direction.x * distance,
    y: direction.y * distance,
  };
};

const createInitialWorldState = (options: WorldGenerationOptions = {}): SharedWorldState => {
  const base = cloneWorldState(INITIAL_WORLD_TEMPLATE);
  const primarySpawn = options.primarySpawn;
  if (!primarySpawn) {
    return base;
  }

  const directions = getOrderedSpawnDirections(primarySpawn);

  const translatedMicroorganisms = base.microorganisms.map((entity, index) => ({
    ...entity,
    position: translateWithinWorldBounds(entity.position, getEntityOffset(directions, index)),
  }));

  const translatedOrganicMatter = base.organicMatter.map((matter, index) => ({
    ...matter,
    position: translateWithinWorldBounds(
      matter.position,
      getEntityOffset(directions, index + base.microorganisms.length),
    ),
  }));

  return {
    ...base,
    microorganisms: translatedMicroorganisms,
    organicMatter: translatedOrganicMatter,
  };
};

const haveEntityPositionsChanged = <T extends { id: string; position: Vector2 }>(
  previous: readonly T[],
  next: readonly T[],
): boolean => {
  if (previous.length !== next.length) {
    return true;
  }
  const nextById = new Map(next.map((entity) => [entity.id, entity]));
  for (const entity of previous) {
    const candidate = nextById.get(entity.id);
    if (!candidate) {
      return true;
    }
    if (entity.position.x !== candidate.position.x || entity.position.y !== candidate.position.y) {
      return true;
    }
  }
  return false;
};

const PLAYER_SPAWN_DISTANCE_RATIO = 18 / 25;
const PLAYER_SPAWN_DISTANCE = WORLD_RADIUS * PLAYER_SPAWN_DISTANCE_RATIO;

const PLAYER_SPAWN_POSITIONS: Vector2[] = [
  { x: -PLAYER_SPAWN_DISTANCE, y: -PLAYER_SPAWN_DISTANCE },
  { x: PLAYER_SPAWN_DISTANCE, y: -PLAYER_SPAWN_DISTANCE },
  { x: -PLAYER_SPAWN_DISTANCE, y: PLAYER_SPAWN_DISTANCE },
  { x: PLAYER_SPAWN_DISTANCE, y: PLAYER_SPAWN_DISTANCE },
  { x: 0, y: -PLAYER_SPAWN_DISTANCE },
  { x: 0, y: PLAYER_SPAWN_DISTANCE },
  { x: PLAYER_SPAWN_DISTANCE, y: 0 },
  { x: -PLAYER_SPAWN_DISTANCE, y: 0 },
];

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
};

const getSpawnPositionForPlayer = (playerId: string): Vector2 => {
  const index = hashString(playerId) % PLAYER_SPAWN_POSITIONS.length;
  const position = PLAYER_SPAWN_POSITIONS[index];
  return { x: position.x, y: position.y };
};

const getDeterministicCombatAttributesForPlayer = (playerId: string): CombatAttributes => {
  const hash = hashString(playerId);
  const attackBonus = hash % 5;
  const defenseBonus = Math.floor(hash / 5) % 4;
  const speedBonus = Math.floor(hash / 17) % 5;
  const rangeBonus = Math.floor(hash / 29) % 4;

  return createCombatAttributes({
    attack: DEFAULT_COMBAT_ATTRIBUTES.attack + attackBonus,
    defense: DEFAULT_COMBAT_ATTRIBUTES.defense + defenseBonus,
    speed: DEFAULT_COMBAT_ATTRIBUTES.speed + speedBonus * 8,
    range: DEFAULT_COMBAT_ATTRIBUTES.range + rangeBonus * 6,
  });
};

export class RoomDO {
  private readonly state: DurableObjectState;
  private readonly ready: Promise<void>;
  private readonly observability: Observability;

  private readonly clientsBySocket = new Map<WebSocket, string>();
  private readonly activeSockets = new Set<WebSocket>();
  private readonly socketsByPlayer = new Map<string, WebSocket>();
  private readonly players = new Map<string, PlayerInternal>();
  private readonly nameToPlayerId = new Map<string, string>();
  private readonly connectionRateLimiters = new WeakMap<WebSocket, MessageRateLimiter>();
  private readonly rateLimitUtilizationLastReported = new WeakMap<WebSocket, number>();
  private readonly globalRateLimiter = new MessageRateLimiter(
    MAX_MESSAGES_GLOBAL,
    RATE_LIMIT_WINDOW_MS
  );
  private lastGlobalRateLimitReportAt = 0;
  private rankingCache: RankingEntry[] = [];
  private rankingDirty = true;

  private phase: GamePhase = "waiting";
  private roundId: string | null = null;
  private roundStartedAt: number | null = null;
  private roundEndsAt: number | null = null;

  private world: SharedWorldState = createInitialWorldState();
  private microorganisms = new Map<string, Microorganism>();
  private organicMatter = new Map<string, OrganicMatter>();
  private organicMatterCells = new Map<string, Set<string>>();
  private organicMatterCellById = new Map<string, string>();
  private organicMatterOrder = new Map<string, number>();
  private roomObjects = new Map<string, RoomObject>();
  private entitySequence = 0;
  private organicMatterRespawnRng: () => number = Math.random;
  private obstacles = new Map<string, Obstacle>();
  private microorganismBehavior = new Map<string, { lastAttackAt: number }>();
  private microorganismStatusEffects = new Map<string, StatusCollection>();
  private lastWorldTickAt: number | null = null;
  private pendingStatusEffects: StatusEffectEvent[] = [];
  private pendingPlayerDeaths: Array<{ playerId: string; socket: WebSocket | null }> = [];
  private playersPendingRemoval = new Set<string>();

  private alarmSchedule: Map<AlarmType, number> = new Map();
  private alarmsDirty = false;
  private persistentAlarmsDirty = false;
  private playersDirty = false;
  private worldDirty = false;
  private pendingSnapshotAlarm: number | null = null;
  private gameStateSnapshot: SharedGameState | null = null;
  private gameStateSnapshotDirty = true;
  private progressionState = new Map<string, PlayerProgressionState>();
  private pendingProgression = new Map<string, PendingProgressionStream>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.observability = createObservability(env, { component: "RoomDO" });
    this.ready = this.initialize();
    this.observability.log("info", "room_initialized");
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    const pathname = url.pathname === "" ? "/" : url.pathname;
    const isSupportedRoute = pathname === "/" || pathname === "/ws";

    const baseHeaders = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    } as const;

    if (!isSupportedRoute) {
      return new Response("Not Found", { status: 404, headers: baseHeaders });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426, headers: baseHeaders });
    }

    const pair = new WebSocketPair();
    const { 0: client, 1: server } = pair;
    server.accept();

    this.setupSession(server).catch((error) => {
      this.observability.logError("room_session_failed", error);
      try {
        server.close(1011, "internal_error");
      } catch (err) {
        this.observability.logError("room_session_close_failed", err);
      }
    });

    return new Response(null, { status: 101, webSocket: client, headers: baseHeaders });
  }

  async alarm(): Promise<void> {
    await this.ready;
    const now = Date.now();

    const due: AlarmType[] = [];
    for (const [type, timestamp] of this.alarmSchedule.entries()) {
      if (timestamp !== null && timestamp <= now) {
        due.push(type);
      }
    }

    if (due.length === 0) {
      if (this.alarmsDirty) {
        if (this.persistentAlarmsDirty) {
          await this.persistAlarms();
          this.persistentAlarmsDirty = false;
        }
        await this.syncAlarms();
        this.alarmsDirty = false;
      } else {
        await this.syncAlarms();
      }
      return;
    }

    due.sort((a, b) => {
      const ta = this.alarmSchedule.get(a) ?? 0;
      const tb = this.alarmSchedule.get(b) ?? 0;
      return ta - tb;
    });

    for (const type of due) {
      switch (type) {
        case "waiting_start":
          await this.handleWaitingStartAlarm();
          break;
        case "round_end":
          await this.handleRoundEndAlarm();
          break;
        case "reset":
          await this.handleResetAlarm();
          break;
        case "cleanup":
          await this.handleCleanupAlarm();
          break;
        case "world_tick":
          await this.handleWorldTickAlarm(now);
          break;
        case "snapshot":
          await this.flushSnapshots();
          break;
      }
    }

    if (this.alarmsDirty) {
      if (this.persistentAlarmsDirty) {
        await this.persistAlarms();
        this.persistentAlarmsDirty = false;
      }
      await this.syncAlarms();
      this.alarmsDirty = false;
    } else {
      await this.syncAlarms();
    }
  }

  private getConnectionLimiter(socket: WebSocket): MessageRateLimiter {
    let limiter = this.connectionRateLimiters.get(socket);
    if (!limiter) {
      limiter = new MessageRateLimiter(MAX_MESSAGES_PER_CONNECTION, RATE_LIMIT_WINDOW_MS);
      this.connectionRateLimiters.set(socket, limiter);
    }
    return limiter;
  }

  private maybeRecordRateLimitUtilization(
    socket: WebSocket,
    limiter: MessageRateLimiter,
    now: number,
    limit: number
  ): void {
    if (limit <= 0) {
      return;
    }

    const utilization = limiter.getUtilization(now, limit);
    if (utilization < 0.7) {
      if (utilization < 0.5) {
        this.rateLimitUtilizationLastReported.delete(socket);
      }
      return;
    }

    const lastReportedAt = this.rateLimitUtilizationLastReported.get(socket) ?? 0;
    if (now - lastReportedAt < RATE_LIMIT_UTILIZATION_REPORT_INTERVAL_MS) {
      return;
    }

    const playerId = this.clientsBySocket.get(socket) ?? null;
    this.observability.recordMetric("rate_limit_utilization", utilization, {
      scope: "connection",
      limit,
      bucket: Math.min(100, Math.round(utilization * 100)),
      playerKnown: playerId ? "known" : "unknown",
    });

    this.rateLimitUtilizationLastReported.set(socket, now);
  }

  private maybeRecordGlobalRateLimitUtilization(now: number, limit: number): void {
    if (limit <= 0) {
      return;
    }

    const utilization = this.globalRateLimiter.getUtilization(now, limit);
    if (utilization < 0.7) {
      return;
    }

    if (now - this.lastGlobalRateLimitReportAt < RATE_LIMIT_UTILIZATION_REPORT_INTERVAL_MS) {
      return;
    }

    this.observability.recordMetric("rate_limit_utilization", utilization, {
      scope: "global",
      limit,
      bucket: Math.min(100, Math.round(utilization * 100)),
    });

    this.lastGlobalRateLimitReportAt = now;
  }

  private getDynamicGlobalLimit(): number {
    const activeConnections = Math.max(1, this.activeSockets.size);
    const scaledLimit = Math.ceil(
      activeConnections * MAX_MESSAGES_PER_CONNECTION * GLOBAL_RATE_LIMIT_HEADROOM
    );
    return Math.max(MAX_MESSAGES_GLOBAL, scaledLimit);
  }

  private handleRateLimit(
    socket: WebSocket,
    scope: "connection" | "global",
    retryAfterMs: number,
    playerId: string | null,
    context: { limit?: number; activeConnections?: number } = {}
  ): void {
    const errorMessage: ErrorMessage = {
      type: "error",
      reason: "rate_limited",
      ...(retryAfterMs > 0 ? { retryAfterMs } : {})
    };

    this.send(socket, errorMessage);

    const logData: Record<string, unknown> = {
      scope,
      playerId,
      retryAfterMs,
      category: "protocol_error"
    };

    if (context.limit !== undefined) {
      logData.limit = context.limit;
    }
    if (context.activeConnections !== undefined) {
      logData.activeConnections = context.activeConnections;
    }

    this.observability.log(scope === "connection" ? "warn" : "error", "rate_limited", logData);
    this.observability.recordMetric("protocol_errors", 1, {
      type: "rate_limited",
      scope
    });

    const metricDimensions: Record<string, string | number> = {
      scope,
      playerKnown: playerId ? "known" : "unknown",
      activeConnections: context.activeConnections ?? this.activeSockets.size
    };

    if (context.limit !== undefined) {
      metricDimensions.limit = context.limit;
    }

    this.observability.recordMetric("rate_limit_hits", 1, metricDimensions);

    socket.close(1013, "rate_limited");
  }

  private async initialize(): Promise<void> {
    const storedPlayers = await this.state.storage.get<StoredPlayerSnapshot[]>(PLAYERS_KEY);
    if (storedPlayers) {
      const now = Date.now();
      for (const stored of storedPlayers) {
        const evolutionState = createEvolutionState(stored.evolutionState);
        const archetypeKey = stored.archetypeKey
          ? sanitizeArchetypeKey(stored.archetypeKey)
          : null;
        const skillState = createPlayerSkillState(stored.skillState);
        const reconnectToken =
          sanitizeReconnectToken(stored.reconnectToken) ?? generateReconnectToken();

        const normalized: StoredPlayer = {
          id: stored.id,
          name: stored.name,
          score: stored.score,
          combo: stored.combo,
          energy: Number.isFinite(stored.energy)
            ? Math.max(0, stored.energy)
            : DEFAULT_PLAYER_ENERGY,
          xp: Number.isFinite(stored.xp) ? Math.max(0, stored.xp) : DEFAULT_PLAYER_XP,
          geneticMaterial: Number.isFinite(stored.geneticMaterial)
            ? Math.max(0, stored.geneticMaterial)
            : DEFAULT_PLAYER_GENETIC_MATERIAL,
          position: createVector(stored.position),
          movementVector: createVector(stored.movementVector),
          orientation: createOrientation(stored.orientation),
          health: createHealthState(stored.health),
          combatStatus: createCombatStatusState(stored.combatStatus),
          combatAttributes: createCombatAttributes(stored.combatAttributes),
          evolutionState,
          archetypeKey: archetypeKey ?? null,
          reconnectToken,
          skillState: clonePlayerSkillState(skillState),
          totalSessionDurationMs: stored.totalSessionDurationMs ?? 0,
          sessionCount: stored.sessionCount ?? 0
        };
        const player: PlayerInternal = {
          ...normalized,
          connected: false,
          lastActiveAt: now,
          lastSeenAt: now,
          connectedAt: null,
          skillState,
          pendingAttack: null,
          statusEffects: [],
          invulnerableUntil: null,
        };
        const definition = getArchetypeDefinition(player.archetypeKey);
        if (definition) {
          const maxHealth = Math.max(1, definition.maxHealth);
          const currentHealth = Math.max(0, Math.min(player.health.current, maxHealth));
          player.health = {
            current: currentHealth,
            max: maxHealth,
          };
        }
        player.combatAttributes = this.computePlayerCombatAttributes(player);
        this.players.set(player.id, player);
        this.nameToPlayerId.set(player.name.toLowerCase(), player.id);
        this.ensureProgressionState(player.id);
      }
    }

    const storedWorld = await this.state.storage.get<SharedWorldState>(WORLD_KEY);
    if (storedWorld) {
      this.world = cloneWorldState(storedWorld);
    } else {
      const primarySpawn = this.getPrimarySpawnPosition();
      this.world = createInitialWorldState({ primarySpawn });
      await this.state.storage.put(WORLD_KEY, cloneWorldState(this.world));
    }
    this.rebuildWorldCaches();
    this.invalidateGameStateSnapshot();

    const storedSnapshotState = await this.state.storage.get<SnapshotState>(SNAPSHOT_STATE_KEY);
    if (storedSnapshotState) {
      this.playersDirty = storedSnapshotState.playersDirty ?? false;
      this.worldDirty = storedSnapshotState.worldDirty ?? false;
      this.pendingSnapshotAlarm = storedSnapshotState.pendingSnapshotAlarm ?? null;
    } else {
      this.playersDirty = false;
      this.worldDirty = false;
      this.pendingSnapshotAlarm = null;
    }

    const storedAlarms = await this.state.storage.get<AlarmSnapshot>(ALARM_KEY);
    this.alarmSchedule = new Map();
    if (storedAlarms) {
      const persistentTypes: readonly PersistentAlarmType[] = [
        "waiting_start",
        "round_end",
        "reset",
        "cleanup",
      ];
      for (const type of persistentTypes) {
        const timestamp = storedAlarms[type];
        if (typeof timestamp === "number") {
          this.alarmSchedule.set(type, timestamp);
        }
      }
    }

    const startupNow = Date.now();
    const shouldRunWorldTick = this.shouldRunWorldTickLoop();
    this.lastWorldTickAt = shouldRunWorldTick ? startupNow : null;
    if (!this.alarmSchedule.has("world_tick") && shouldRunWorldTick) {
      // World ticks are transient and are rescheduled relative to "now" so they recover
      // immediately after a restart even though they are not persisted.
      this.scheduleWorldTick(startupNow);
    }

    let snapshotAlarmModified = false;
    if (this.playersDirty || this.worldDirty) {
      const now = Date.now();
      const desired = this.pendingSnapshotAlarm ?? now + SNAPSHOT_FLUSH_INTERVAL_MS;
      const normalized = Math.max(now, desired);
      if (this.pendingSnapshotAlarm !== normalized) {
        this.pendingSnapshotAlarm = normalized;
        snapshotAlarmModified = true;
      }
      this.alarmSchedule.set("snapshot", this.pendingSnapshotAlarm);
    } else {
      this.pendingSnapshotAlarm = null;
      this.alarmSchedule.delete("snapshot");
      snapshotAlarmModified = storedSnapshotState?.pendingSnapshotAlarm != null;
    }

    if (snapshotAlarmModified) {
      await this.persistSnapshotState();
    }

    await this.syncAlarms();
  }

  private rebuildWorldCaches(): void {
    this.microorganisms = new Map(this.world.microorganisms.map((entity) => [entity.id, entity]));
    this.organicMatter = new Map();
    this.organicMatterCells = new Map();
    this.organicMatterCellById = new Map();
    this.organicMatterOrder = new Map();
    this.obstacles = new Map(this.world.obstacles.map((obstacle) => [obstacle.id, obstacle]));
    this.roomObjects = new Map(this.world.roomObjects.map((object) => [object.id, object]));

    this.world.organicMatter.forEach((matter, index) => {
      this.organicMatter.set(matter.id, matter);
      this.organicMatterOrder.set(matter.id, index);
      this.addOrganicMatterToIndex(matter);
    });
    const now = Date.now();
    this.microorganismBehavior.clear();
    for (const microorganism of this.microorganisms.values()) {
      this.microorganismBehavior.set(microorganism.id, { lastAttackAt: now });
    }
  }

  private getPrimaryPlayerForSpawn(): PlayerInternal | null {
    const connectedPlayers = Array.from(this.players.values())
      .filter((player) => player.connected)
      .sort((a, b) => {
        const aConnectedAt = a.connectedAt ?? Number.MAX_SAFE_INTEGER;
        const bConnectedAt = b.connectedAt ?? Number.MAX_SAFE_INTEGER;
        if (aConnectedAt === bConnectedAt) {
          return a.id.localeCompare(b.id);
        }
        return aConnectedAt - bConnectedAt;
      });

    if (connectedPlayers.length > 0) {
      return connectedPlayers[0];
    }

    const iterator = this.players.values().next();
    return iterator.value ?? null;
  }

  private getPrimarySpawnPosition(): Vector2 | null {
    const player = this.getPrimaryPlayerForSpawn();
    if (!player) {
      return null;
    }
    const spawn = getSpawnPositionForPlayer(player.id);
    return { x: spawn.x, y: spawn.y };
  }

  private regenerateWorldForPrimarySpawn(): SharedWorldStateDiff | null {
    const primarySpawn = this.getPrimarySpawnPosition();
    const nextWorld = createInitialWorldState({ primarySpawn });

    const previousWorld = this.world;
    const microorganismsChanged = haveEntityPositionsChanged(
      previousWorld.microorganisms,
      nextWorld.microorganisms,
    );
    const organicMatterChanged = haveEntityPositionsChanged(
      previousWorld.organicMatter,
      nextWorld.organicMatter,
    );

    this.world = nextWorld;
    this.rebuildWorldCaches();

    if (!microorganismsChanged && !organicMatterChanged) {
      return null;
    }

    this.markWorldDirty();

    return {
      upsertMicroorganisms: nextWorld.microorganisms.map((entity) => cloneMicroorganism(entity)),
      upsertOrganicMatter: nextWorld.organicMatter.map((matter) => cloneOrganicMatter(matter)),
    };
  }

  private getOrganicMatterCellKeyFromCoordinates(cellX: number, cellY: number): string {
    return `${cellX}:${cellY}`;
  }

  private getOrganicMatterCellKey(position: Vector2): string {
    const cellSize = Math.max(1, ORGANIC_MATTER_CELL_SIZE);
    const cellX = Math.floor(position.x / cellSize);
    const cellY = Math.floor(position.y / cellSize);
    return this.getOrganicMatterCellKeyFromCoordinates(cellX, cellY);
  }

  private getOrganicMatterCellKeysForRadius(position: Vector2, radius: number): string[] {
    const cellSize = Math.max(1, ORGANIC_MATTER_CELL_SIZE);
    const minCellX = Math.floor((position.x - radius) / cellSize);
    const maxCellX = Math.floor((position.x + radius) / cellSize);
    const minCellY = Math.floor((position.y - radius) / cellSize);
    const maxCellY = Math.floor((position.y + radius) / cellSize);

    const keys: string[] = [];
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        keys.push(this.getOrganicMatterCellKeyFromCoordinates(cellX, cellY));
      }
    }
    return keys;
  }

  private addOrganicMatterToIndex(matter: OrganicMatter): void {
    const key = this.getOrganicMatterCellKey(matter.position);
    let bucket = this.organicMatterCells.get(key);
    if (!bucket) {
      bucket = new Set<string>();
      this.organicMatterCells.set(key, bucket);
    }
    bucket.add(matter.id);
    this.organicMatterCellById.set(matter.id, key);
  }

  private removeOrganicMatterFromIndex(id: string): void {
    const key = this.organicMatterCellById.get(id);
    if (!key) {
      return;
    }
    const bucket = this.organicMatterCells.get(key);
    if (bucket) {
      bucket.delete(id);
      if (bucket.size === 0) {
        this.organicMatterCells.delete(key);
      }
    }
    this.organicMatterCellById.delete(id);
  }

  private addOrganicMatterEntity(matter: OrganicMatter): void {
    const index = this.world.organicMatter.length;
    this.world.organicMatter.push(matter);
    this.organicMatter.set(matter.id, matter);
    this.organicMatterOrder.set(matter.id, index);
    this.addOrganicMatterToIndex(matter);
  }

  private removeOrganicMatterEntity(id: string): OrganicMatter | undefined {
    const matter = this.organicMatter.get(id);
    if (!matter) {
      return undefined;
    }
    this.organicMatter.delete(id);
    this.removeOrganicMatterFromIndex(id);

    const index = this.organicMatterOrder.get(id);
    this.organicMatterOrder.delete(id);
    if (index !== undefined) {
      const lastIndex = this.world.organicMatter.length - 1;
      if (lastIndex >= 0) {
        const lastMatter = this.world.organicMatter[lastIndex];
        if (lastMatter) {
          if (index !== lastIndex) {
            this.world.organicMatter[index] = lastMatter;
            this.organicMatterOrder.set(lastMatter.id, index);
          }
          this.world.organicMatter.pop();
        }
      }
    }

    return matter;
  }

  private createEntityId(prefix: string, isTaken: (candidate: string) => boolean): string {
    let candidate: string;
    do {
      this.entitySequence += 1;
      candidate = `${prefix}-${this.entitySequence.toString(36)}`;
    } while (isTaken(candidate));
    return candidate;
  }

  private pushStatusEffectEvent(event: StatusEffectEvent): void {
    this.pendingStatusEffects.push(event);
  }

  private ensurePlayerSkillState(player: PlayerInternal): PlayerSkillState {
    const current = (player as unknown as { skillState?: StoredPlayerSkillState }).skillState;
    const normalized = normalizePlayerSkillState(current);
    player.skillState = normalized;
    return normalized;
  }

  private finalizeAttackResolution(
    result: { worldChanged: boolean; scoresChanged: boolean },
    worldDiff: SharedWorldStateDiff,
  ): { worldChanged: boolean; scoresChanged: boolean } {
    if (this.pendingStatusEffects.length > 0) {
      worldDiff.statusEffects = [
        ...(worldDiff.statusEffects ?? []),
        ...this.pendingStatusEffects,
      ];
      this.pendingStatusEffects = [];
      result.worldChanged = true;
    }
    return result;
  }

  private ensurePlayerStatusEffects(player: PlayerInternal): StatusCollection {
    if (!Array.isArray(player.statusEffects)) {
      player.statusEffects = [];
    }
    return player.statusEffects;
  }

  private applyStatusToPlayer(
    player: PlayerInternal,
    status: StatusTag,
    stacks: number,
    durationMs: number | undefined,
    now: number,
    sourcePlayerId?: string,
  ): void {
    const collection = this.ensurePlayerStatusEffects(player);
    player.statusEffects = pruneExpiredStatusEffects(collection, now);
    const merged = mergeStatusEffect(collection, status, stacks, durationMs, now);
    player.statusEffects = pruneExpiredStatusEffects(collection, now);
    this.pushStatusEffectEvent(
      toStatusEffectEvent(
        "player",
        { playerId: player.id },
        status,
        merged.stacks,
        durationMs,
        sourcePlayerId,
      ),
    );
  }

  private applyStatusToMicroorganism(
    microorganism: Microorganism,
    status: StatusTag,
    stacks: number,
    durationMs: number | undefined,
    now: number,
    sourcePlayerId: string,
  ): void {
    const existing = this.microorganismStatusEffects.get(microorganism.id) ?? [];
    const merged = mergeStatusEffect(existing, status, stacks, durationMs, now);
    const pruned = pruneExpiredStatusEffects(existing, now);
    if (pruned.length > 0) {
      this.microorganismStatusEffects.set(microorganism.id, pruned);
    } else {
      this.microorganismStatusEffects.delete(microorganism.id);
    }
    this.pushStatusEffectEvent(
      toStatusEffectEvent(
        "microorganism",
        { objectId: microorganism.id },
        status,
        merged.stacks,
        durationMs,
        sourcePlayerId,
      ),
    );
  }

  private applyDamageToMicroorganism(
    player: PlayerInternal,
    microorganism: Microorganism,
    damage: number,
    now: number,
    worldDiff: SharedWorldStateDiff,
    combatLog: CombatLogEntry[],
  ): { worldChanged: boolean; scoresChanged: boolean; defeated: boolean } {
    const appliedDamage = Math.max(0, Math.round(damage));
    if (appliedDamage <= 0) {
      return { worldChanged: false, scoresChanged: false, defeated: false };
    }

    const nextHealth = Math.max(0, microorganism.health.current - appliedDamage);
    microorganism.health = {
      current: nextHealth,
      max: microorganism.health.max,
    };

    if (nextHealth === 0) {
      this.microorganisms.delete(microorganism.id);
      this.microorganismBehavior.delete(microorganism.id);
      this.microorganismStatusEffects.delete(microorganism.id);
      this.world.microorganisms = this.world.microorganisms.filter(
        (entry) => entry.id !== microorganism.id,
      );
      worldDiff.removeMicroorganismIds = [
        ...(worldDiff.removeMicroorganismIds ?? []),
        microorganism.id,
      ];

      this.recordKillProgression(player, { targetId: microorganism.id, dropTier: "minion" });

      const remainsId = `${microorganism.id}-remains`;
      const remains: OrganicMatter = {
        id: remainsId,
        kind: "organic_matter",
        position: cloneVector(microorganism.position),
        quantity: Math.max(5, Math.round(microorganism.health.max / 2)),
        nutrients: { residue: microorganism.health.max },
      };
      this.addOrganicMatterEntity(remains);
      worldDiff.upsertOrganicMatter = [
        ...(worldDiff.upsertOrganicMatter ?? []),
        cloneOrganicMatter(remains),
      ];

      const scoreAwarded = 120;
      player.score = Math.max(0, player.score + scoreAwarded);
      this.markRankingDirty();

      combatLog.push({
        timestamp: now,
        attackerId: player.id,
        targetKind: "microorganism",
        targetObjectId: microorganism.id,
        damage: appliedDamage,
        outcome: "defeated",
        remainingHealth: nextHealth,
        scoreAwarded,
      });

      return { worldChanged: true, scoresChanged: true, defeated: true };
    }

    worldDiff.upsertMicroorganisms = [
      ...(worldDiff.upsertMicroorganisms ?? []),
      cloneMicroorganism(microorganism),
    ];
    combatLog.push({
      timestamp: now,
      attackerId: player.id,
      targetKind: "microorganism",
      targetObjectId: microorganism.id,
      damage: appliedDamage,
      outcome: "hit",
      remainingHealth: nextHealth,
    });
    return { worldChanged: true, scoresChanged: false, defeated: false };
  }

  private tickPlayerSkillCooldowns(player: PlayerInternal, deltaMs: number): boolean {
    const skillState = this.ensurePlayerSkillState(player);
    const cooldowns = skillState.cooldowns;
    let changed = false;
    for (const key of skillState.available) {
      const current = cooldowns[key] ?? 0;
      if (current > 0) {
        const next = Math.max(0, current - deltaMs);
        if (next !== current) {
          cooldowns[key] = next;
          changed = true;
        }
      }
    }

    for (const storedKey of Object.keys(cooldowns)) {
      if (!skillState.available.includes(storedKey as SkillKey)) {
        delete cooldowns[storedKey];
        changed = true;
      }
    }

    return changed;
  }

  private resolveDashAttack(
    player: PlayerInternal,
    now: number,
    worldDiff: SharedWorldStateDiff,
    combatLog: CombatLogEntry[],
    updatedPlayers: Map<string, PlayerInternal>,
  ): { worldChanged: boolean; scoresChanged: boolean } {
    let worldChanged = false;
    let scoresChanged = false;

    const angle = Number.isFinite(player.orientation.angle) ? player.orientation.angle : 0;
    const dashDistance = Math.max(60, Math.min(240, player.combatAttributes.speed * 0.5));
    const destination = this.clampPosition({
      x: player.position.x + Math.cos(angle) * dashDistance,
      y: player.position.y + Math.sin(angle) * dashDistance,
    });

    if (destination.x !== player.position.x || destination.y !== player.position.y) {
      player.position = destination;
      updatedPlayers.set(player.id, player);
      worldChanged = true;
    }

    const radius = Math.max(40, player.combatAttributes.range * 0.75);
    const radiusSquared = radius * radius;
    const knockbackForce = 18;
    const statusDuration = 800;

    for (const microorganism of this.microorganisms.values()) {
      const distanceSquared = this.distanceSquared(player.position, microorganism.position);
      if (distanceSquared > radiusSquared) {
        continue;
      }

      const distance = Math.sqrt(distanceSquared) || 1;
      const directionX = (microorganism.position.x - player.position.x) / distance;
      const directionY = (microorganism.position.y - player.position.y) / distance;
      microorganism.movementVector = {
        x: directionX * knockbackForce,
        y: directionY * knockbackForce,
      };

      const damage = Math.max(4, Math.round(player.combatAttributes.attack * 0.35));
      const result = this.applyDamageToMicroorganism(
        player,
        microorganism,
        damage,
        now,
        worldDiff,
        combatLog,
      );
      if (result.worldChanged) {
        worldChanged = true;
      }
      if (result.scoresChanged) {
        scoresChanged = true;
      }

      this.applyStatusToMicroorganism(
        microorganism,
        "KNOCKBACK",
        1,
        statusDuration,
        now,
        player.id,
      );
    }

    player.combatStatus = createCombatStatusState({
      state: "cooldown",
      targetPlayerId: null,
      targetObjectId: null,
      lastAttackAt: now,
    });
    updatedPlayers.set(player.id, player);

    return { worldChanged, scoresChanged };
  }

  private resolveSkillAttack(
    player: PlayerInternal,
    now: number,
    worldDiff: SharedWorldStateDiff,
    combatLog: CombatLogEntry[],
    updatedPlayers: Map<string, PlayerInternal>,
  ): { worldChanged: boolean; scoresChanged: boolean } {
    let worldChanged = false;
    let scoresChanged = false;

    const skillState = this.ensurePlayerSkillState(player);
    const skill = getSkillDefinition(skillState.current);
    if (!skill) {
      player.combatStatus = createCombatStatusState({ state: "idle" });
      updatedPlayers.set(player.id, player);
      return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
    }

    const remainingCooldown = skillState.cooldowns[skill.key] ?? 0;
    if (remainingCooldown > 0) {
      return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
    }

    const energyCost = Math.max(0, skill.cost?.energy ?? 0);
    const xpCost = Math.max(0, skill.cost?.xp ?? 0);
    const mgCost = Math.max(0, skill.cost?.mg ?? 0);

    if (
      (energyCost > 0 && player.energy < energyCost) ||
      (xpCost > 0 && player.xp < xpCost) ||
      (mgCost > 0 && player.geneticMaterial < mgCost)
    ) {
      skillState.cooldowns[skill.key] = Math.max(skillState.cooldowns[skill.key] ?? 0, skill.cooldownMs);
      player.combatStatus = createCombatStatusState({
        state: "cooldown",
        targetPlayerId: null,
        targetObjectId: null,
        lastAttackAt: now,
      });
      updatedPlayers.set(player.id, player);
      return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
    }

    if (energyCost > 0) {
      player.energy = Math.max(0, player.energy - energyCost);
    }
    if (xpCost > 0) {
      player.xp = Math.max(0, player.xp - xpCost);
    }
    if (mgCost > 0) {
      player.geneticMaterial = Math.max(0, player.geneticMaterial - mgCost);
    }

    const params = skill.parameters ?? {};
    const rangeBase = player.combatAttributes.range;

    const applyStatuses = (
      microorganism: Microorganism,
      durationMs: number | undefined,
    ) => {
      for (const statusKey of skill.applies) {
        if (statusKey === "RESTORE") {
          this.applyStatusToPlayer(player, statusKey, 1, durationMs, now, player.id);
          continue;
        }
        if (statusKey === "LEECH") {
          this.applyStatusToMicroorganism(microorganism, statusKey, 1, durationMs, now, player.id);
          continue;
        }
        this.applyStatusToMicroorganism(microorganism, statusKey, 1, durationMs, now, player.id);
      }
    };

    switch (skill.effect) {
      case "pulse": {
        const radiusMultiplier = params.radiusMultiplier ?? 1.1;
        const damageMultiplier = params.damageMultiplier ?? 0.45;
        const statusDuration = params.statusDurationMs ?? 6_000;
        const knockbackForce = params.knockbackForce ?? 18;
        const radius = Math.max(40, rangeBase * radiusMultiplier);
        const radiusSquared = radius * radius;

        for (const microorganism of this.microorganisms.values()) {
          const distanceSquared = this.distanceSquared(player.position, microorganism.position);
          if (distanceSquared > radiusSquared) {
            continue;
          }
          const distance = Math.sqrt(distanceSquared) || 1;
          const directionX = (microorganism.position.x - player.position.x) / distance;
          const directionY = (microorganism.position.y - player.position.y) / distance;
          microorganism.movementVector = {
            x: directionX * knockbackForce,
            y: directionY * knockbackForce,
          };
          const damage = Math.max(
            4,
            Math.ceil(player.combatAttributes.attack * damageMultiplier),
          );
          const result = this.applyDamageToMicroorganism(
            player,
            microorganism,
            damage,
            now,
            worldDiff,
            combatLog,
          );
          if (result.worldChanged) {
            worldChanged = true;
          }
          if (result.scoresChanged) {
            scoresChanged = true;
          }
          applyStatuses(microorganism, statusDuration);
        }
        break;
      }
      case "projectile": {
        const projectileCount = Math.max(1, Math.round(params.projectileCount ?? 3));
        const forwardAngle = Number.isFinite(player.orientation.angle)
          ? player.orientation.angle
          : 0;
        const forwardVector = { x: Math.cos(forwardAngle), y: Math.sin(forwardAngle) };
        const spread = params.spreadRadians ?? 0.28;
        const candidates: Array<{
          microorganism: Microorganism;
          alignment: number;
          distanceSquared: number;
        }> = [];

        for (const microorganism of this.microorganisms.values()) {
          const vectorX = microorganism.position.x - player.position.x;
          const vectorY = microorganism.position.y - player.position.y;
          const distanceSquared = vectorX * vectorX + vectorY * vectorY;
          if (distanceSquared <= 0) {
            continue;
          }
          const distance = Math.sqrt(distanceSquared);
          const normalizedX = vectorX / distance;
          const normalizedY = vectorY / distance;
          const alignment = normalizedX * forwardVector.x + normalizedY * forwardVector.y;
          const angleDifference = Math.acos(Math.max(-1, Math.min(1, alignment)));
          if (angleDifference > spread * 1.5) {
            continue;
          }
          candidates.push({ microorganism, alignment, distanceSquared });
        }

        candidates.sort((a, b) => b.alignment - a.alignment || a.distanceSquared - b.distanceSquared);

        const damageMultiplier = params.damageMultiplier ?? 1.35;
        const statusDuration = params.statusDurationMs ?? 7_000;
        for (let index = 0; index < Math.min(projectileCount, candidates.length); index += 1) {
          const { microorganism } = candidates[index]!;
          const damage = Math.max(
            4,
            Math.ceil(player.combatAttributes.attack * damageMultiplier),
          );
          const result = this.applyDamageToMicroorganism(
            player,
            microorganism,
            damage,
            now,
            worldDiff,
            combatLog,
          );
          if (result.worldChanged) {
            worldChanged = true;
          }
          if (result.scoresChanged) {
            scoresChanged = true;
          }
          applyStatuses(microorganism, statusDuration);
        }
        break;
      }
      case "shield": {
        const radiusMultiplier = params.radiusMultiplier ?? 0.8;
        const healMultiplier = params.healMultiplier ?? 0.4;
        const statusDuration = params.statusDurationMs ?? 4_000;
        const radius = Math.max(20, rangeBase * radiusMultiplier);
        const radiusSquared = radius * radius;
        const stacks = Math.max(1, Math.round(params.stacks ?? 1));

        for (const microorganism of this.microorganisms.values()) {
          const distanceSquared = this.distanceSquared(player.position, microorganism.position);
          if (distanceSquared > radiusSquared) {
            continue;
          }
          microorganism.movementVector = { x: 0, y: 0 };
          this.applyStatusToMicroorganism(
            microorganism,
            "ENTANGLED",
            stacks,
            statusDuration,
            now,
            player.id,
          );
          worldDiff.upsertMicroorganisms = [
            ...(worldDiff.upsertMicroorganisms ?? []),
            cloneMicroorganism(microorganism),
          ];
          worldChanged = true;
        }

        const healAmount = Math.max(0, Math.round(player.combatAttributes.attack * healMultiplier));
        if (healAmount > 0) {
          const nextHealth = Math.min(player.health.max, player.health.current + healAmount);
          if (nextHealth !== player.health.current) {
            player.health = { current: nextHealth, max: player.health.max };
            worldChanged = true;
          }
          this.applyStatusToPlayer(player, "RESTORE", 1, statusDuration, now, player.id);
        }

        const durationMs = params.durationMs ?? 1_800;
        player.invulnerableUntil = Math.max(player.invulnerableUntil ?? 0, now + durationMs);
        break;
      }
      case "drain": {
        const radiusMultiplier = params.radiusMultiplier ?? 1.4;
        const damageMultiplier = params.damageMultiplier ?? 0.4;
        const minimumDamage = params.minimumDamage ?? 6;
        const statusDuration = params.statusDurationMs ?? 4_000;
        const radius = Math.max(40, rangeBase * radiusMultiplier);
        const radiusSquared = radius * radius;
        let totalDrain = 0;

        for (const microorganism of this.microorganisms.values()) {
          const distanceSquared = this.distanceSquared(player.position, microorganism.position);
          if (distanceSquared > radiusSquared) {
            continue;
          }
          const rawDamage = Math.max(
            minimumDamage,
            Math.round(player.combatAttributes.attack * damageMultiplier),
          );
          const damage = Math.min(rawDamage, microorganism.health.current);
          totalDrain += damage;
          const result = this.applyDamageToMicroorganism(
            player,
            microorganism,
            damage,
            now,
            worldDiff,
            combatLog,
          );
          if (result.worldChanged) {
            worldChanged = true;
          }
          if (result.scoresChanged) {
            scoresChanged = true;
          }
          this.applyStatusToMicroorganism(microorganism, "FISSURE", 1, statusDuration, now, player.id);
          this.applyStatusToMicroorganism(microorganism, "LEECH", 1, statusDuration, now, player.id);
        }

        if (totalDrain > 0) {
          const healAmount = Math.round(totalDrain);
          const nextHealth = Math.min(player.health.max, player.health.current + healAmount);
          if (nextHealth !== player.health.current) {
            player.health = { current: nextHealth, max: player.health.max };
            worldChanged = true;
          }
          this.applyStatusToPlayer(player, "RESTORE", 1, statusDuration, now, player.id);
        }
        break;
      }
      case "beam": {
        const radiusMultiplier = params.radiusMultiplier ?? 1.6;
        const damageMultiplier = params.damageMultiplier ?? 0.55;
        const alignmentThreshold = params.alignmentThreshold ?? 0.45;
        const statusDuration = params.statusDurationMs ?? 5_000;
        const radius = Math.max(40, rangeBase * radiusMultiplier);
        const radiusSquared = radius * radius;
        const forwardAngle = Number.isFinite(player.orientation.angle)
          ? player.orientation.angle
          : 0;
        const forwardVector = { x: Math.cos(forwardAngle), y: Math.sin(forwardAngle) };

        for (const microorganism of this.microorganisms.values()) {
          const vectorX = microorganism.position.x - player.position.x;
          const vectorY = microorganism.position.y - player.position.y;
          const distanceSquared = vectorX * vectorX + vectorY * vectorY;
          if (distanceSquared > radiusSquared || distanceSquared <= 0) {
            continue;
          }
          const distance = Math.sqrt(distanceSquared);
          const normalizedX = vectorX / distance;
          const normalizedY = vectorY / distance;
          const alignment = normalizedX * forwardVector.x + normalizedY * forwardVector.y;
          if (alignment <= alignmentThreshold) {
            continue;
          }
          const damage = Math.max(5, Math.round(player.combatAttributes.attack * damageMultiplier));
          const result = this.applyDamageToMicroorganism(
            player,
            microorganism,
            damage,
            now,
            worldDiff,
            combatLog,
          );
          if (result.worldChanged) {
            worldChanged = true;
          }
          if (result.scoresChanged) {
            scoresChanged = true;
          }
          this.applyStatusToMicroorganism(
            microorganism,
            "PHOTOLESION",
            1,
            statusDuration,
            now,
            player.id,
          );
        }
        break;
      }
      case "entangle": {
        const radiusMultiplier = params.radiusMultiplier ?? 1.3;
        const statusDuration = params.statusDurationMs ?? 3_500;
        const stacks = Math.max(1, Math.round(params.stacks ?? 2));
        const radius = Math.max(20, rangeBase * radiusMultiplier);
        const radiusSquared = radius * radius;

        for (const microorganism of this.microorganisms.values()) {
          const distanceSquared = this.distanceSquared(player.position, microorganism.position);
          if (distanceSquared > radiusSquared) {
            continue;
          }
          microorganism.movementVector = { x: 0, y: 0 };
          this.applyStatusToMicroorganism(
            microorganism,
            "ENTANGLED",
            stacks,
            statusDuration,
            now,
            player.id,
          );
          worldDiff.upsertMicroorganisms = [
            ...(worldDiff.upsertMicroorganisms ?? []),
            cloneMicroorganism(microorganism),
          ];
          worldChanged = true;
        }
        break;
      }
      default:
        break;
    }

    player.skillState.cooldowns[skill.key] = skill.cooldownMs;
    player.combatStatus = createCombatStatusState({
      state: "cooldown",
      targetPlayerId: null,
      targetObjectId: null,
      lastAttackAt: now,
    });
    updatedPlayers.set(player.id, player);

    return { worldChanged, scoresChanged };
  }

  private findOrganicMatterRespawnPosition(origin: Vector2, attempts = 12): Vector2 | null {
    const rng = this.organicMatterRespawnRng;
    const minimumDistance = PLAYER_COLLECT_RADIUS * 1.1;
    const distanceSpread = Math.max(PLAYER_COLLECT_RADIUS * 0.6, 1);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const angle = rng() * Math.PI * 2;
      const radialOffset = attempt * PLAYER_COLLECT_RADIUS * 0.35;
      const distance = minimumDistance + radialOffset + rng() * distanceSpread;
      const candidate = this.clampPosition({
        x: origin.x + Math.cos(angle) * distance,
        y: origin.y + Math.sin(angle) * distance,
      });

      if (this.isBlockedByObstacle(candidate)) {
        continue;
      }

      if (this.distanceSquared(origin, candidate) < PLAYER_COLLECT_RADIUS ** 2) {
        continue;
      }

      return candidate;
    }

    const fallback = this.clampPosition({
      x: origin.x + minimumDistance + attempts * PLAYER_COLLECT_RADIUS * 0.35,
      y: origin.y,
    });
    if (!this.isBlockedByObstacle(fallback) && this.distanceSquared(origin, fallback) >= PLAYER_COLLECT_RADIUS ** 2) {
      return fallback;
    }

    return null;
  }

  private markAlarmsDirty(options: { persistent?: boolean } = {}): void {
    const { persistent = false } = options;
    this.alarmsDirty = true;
    if (persistent) {
      this.persistentAlarmsDirty = true;
    }
  }

  private async persistAndSyncAlarms(): Promise<void> {
    this.markAlarmsDirty({ persistent: true });
    await this.persistAlarms();
    await this.syncAlarms();
    this.persistentAlarmsDirty = false;
    this.alarmsDirty = false;
  }

  private scheduleWorldTick(reference: number = Date.now()): void {
    if (!this.shouldRunWorldTickLoop()) {
      this.cancelWorldTick();
      return;
    }

    const desired = reference + WORLD_TICK_INTERVAL_MS;
    const current = this.alarmSchedule.get("world_tick");
    const nextTickAt = typeof current === "number" ? Math.min(current, desired) : desired;
    if (typeof current === "number" && current === nextTickAt) {
      return;
    }

    this.alarmSchedule.set("world_tick", nextTickAt);
    this.commitWorldTickScheduleChange();
  }

  private cancelWorldTick(): void {
    const removed = this.alarmSchedule.delete("world_tick");
    this.lastWorldTickAt = null;
    if (!removed) {
      return;
    }

    this.commitWorldTickScheduleChange();
  }

  private commitWorldTickScheduleChange(): void {
    this.markAlarmsDirty();
    void this.syncAlarms().catch((error) => {
      this.observability.logError("alarm_sync_failed", error, {
        category: "persistence",
      });
    });
    if (!this.persistentAlarmsDirty) {
      this.alarmsDirty = false;
    }
  }

  private queueSnapshotStatePersist(): void {
    void this.persistSnapshotState().catch((error) => {
      this.observability.logError("snapshot_state_persist_failed", error, {
        category: "persistence"
      });
    });
  }

  private queueSyncAlarms(): void {
    void this.syncAlarms().catch((error) => {
      this.observability.logError("alarm_sync_failed", error, {
        category: "persistence"
      });
    });
  }

  private scheduleSnapshotFlush(targetTimestamp?: number): boolean {
    const now = Date.now();
    const desired =
      targetTimestamp !== undefined ? Math.max(targetTimestamp, now) : now + SNAPSHOT_FLUSH_INTERVAL_MS;

    if (this.pendingSnapshotAlarm !== null && this.pendingSnapshotAlarm <= desired) {
      this.alarmSchedule.set("snapshot", this.pendingSnapshotAlarm);
      return false;
    }

    this.pendingSnapshotAlarm = desired;
    this.alarmSchedule.set("snapshot", desired);
    this.queueSyncAlarms();
    return true;
  }

  private invalidateGameStateSnapshot(): void {
    this.gameStateSnapshot = null;
    this.gameStateSnapshotDirty = true;
  }

  private markPlayersDirty(): void {
    const wasDirty = this.playersDirty;
    this.playersDirty = true;
    this.invalidateGameStateSnapshot();
    const pendingChanged = this.scheduleSnapshotFlush();
    if (!wasDirty || pendingChanged) {
      this.queueSnapshotStatePersist();
    }
  }

  private markRankingDirty(): void {
    this.rankingDirty = true;
  }

  private markWorldDirty(): void {
    const wasDirty = this.worldDirty;
    this.worldDirty = true;
    this.invalidateGameStateSnapshot();
    const pendingChanged = this.scheduleSnapshotFlush();
    if (!wasDirty || pendingChanged) {
      this.queueSnapshotStatePersist();
    }
  }

  private async flushSnapshots(options: { force?: boolean } = {}): Promise<void> {
    const { force = false } = options;
    const shouldPersistPlayers = force || this.playersDirty;
    const shouldPersistWorld = force || this.worldDirty;

    if (!shouldPersistPlayers && !shouldPersistWorld) {
      if (force && this.pendingSnapshotAlarm !== null) {
        this.pendingSnapshotAlarm = null;
        this.alarmSchedule.delete("snapshot");
        await this.persistSnapshotState();
        await this.syncAlarms();
      }
      return;
    }

    this.playersDirty = false;
    this.worldDirty = false;
    this.pendingSnapshotAlarm = null;
    this.alarmSchedule.delete("snapshot");

    if (shouldPersistPlayers) {
      await this.persistPlayers();
    }

    if (shouldPersistWorld) {
      await this.persistWorld();
    }

    await this.persistSnapshotState();

    if (force) {
      await this.syncAlarms();
    }
  }

  private clampPosition(position: Vector2): Vector2 {
    return {
      x: clamp(position.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
      y: clamp(position.y, WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY),
    };
  }

  private isBlockedByObstacle(position: Vector2): boolean {
    for (const obstacle of this.obstacles.values()) {
      const halfWidth = obstacle.size.x / 2 + OBSTACLE_PADDING;
      const halfHeight = obstacle.size.y / 2 + OBSTACLE_PADDING;
      if (
        Math.abs(position.x - obstacle.position.x) <= halfWidth &&
        Math.abs(position.y - obstacle.position.y) <= halfHeight
      ) {
        return true;
      }
    }
    return false;
  }

  private distanceSquared(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  private distance(a: Vector2, b: Vector2): number {
    return Math.sqrt(this.distanceSquared(a, b));
  }

  private positionsEqual(a: Vector2, b: Vector2): boolean {
    return a.x === b.x && a.y === b.y;
  }

  private movePlayerDuringTick(player: PlayerInternal, deltaMs: number): boolean {
    const movement = player.movementVector;
    const magnitude = Math.sqrt(movement.x ** 2 + movement.y ** 2);
    if (!Number.isFinite(magnitude) || magnitude === 0) {
      return false;
    }

    const speed = Math.max(0, player.combatAttributes.speed);
    if (speed <= 0) {
      return false;
    }

    const normalizedX = movement.x / magnitude;
    const normalizedY = movement.y / magnitude;
    const cappedDeltaMs = Math.max(0, Math.min(deltaMs, WORLD_TICK_INTERVAL_MS));
    if (cappedDeltaMs === 0) {
      return false;
    }

    const distance = (speed * cappedDeltaMs) / 1000;
    const candidate = this.clampPosition({
      x: player.position.x + normalizedX * distance,
      y: player.position.y + normalizedY * distance,
    });

    if (this.positionsEqual(candidate, player.position)) {
      return false;
    }

    if (this.isBlockedByObstacle(candidate)) {
      return false;
    }

    player.position = candidate;
    return true;
  }

  private handleCollectionsDuringTick(
    player: PlayerInternal,
    worldDiff: SharedWorldStateDiff,
    combatLog: CombatLogEntry[],
    now: number
  ): { playerUpdated: boolean; worldChanged: boolean; scoresChanged: boolean } {
    const collectedEntries: { id: string; matter: OrganicMatter }[] = [];
    const collectRadiusSquared = PLAYER_COLLECT_RADIUS ** 2;
    const neighborCells = this.getOrganicMatterCellKeysForRadius(
      player.position,
      PLAYER_COLLECT_RADIUS,
    );
    const seenIds = new Set<string>();
    for (const cellKey of neighborCells) {
      const bucket = this.organicMatterCells.get(cellKey);
      if (!bucket) {
        continue;
      }
      for (const id of bucket) {
        if (!seenIds.add(id)) {
          continue;
        }
        const matter = this.organicMatter.get(id);
        if (!matter) {
          continue;
        }
        const distanceSquared = this.distanceSquared(player.position, matter.position);
        if (distanceSquared <= collectRadiusSquared) {
          collectedEntries.push({ id, matter });
        }
      }
    }

    if (collectedEntries.length === 0) {
      return { playerUpdated: false, worldChanged: false, scoresChanged: false };
    }

    for (const { id } of collectedEntries) {
      this.removeOrganicMatterEntity(id);
    }

    const respawnedMatter: OrganicMatter[] = [];
    for (const { matter } of collectedEntries) {
      const spawnPosition = this.findOrganicMatterRespawnPosition(player.position);
      if (!spawnPosition) {
        continue;
      }

      const id = this.createEntityId(
        "organic",
        (candidate) =>
          this.organicMatter.has(candidate) || respawnedMatter.some((entry) => entry.id === candidate),
      );
      const replacement: OrganicMatter = {
        ...matter,
        id,
        position: spawnPosition,
      };
      this.addOrganicMatterEntity(replacement);
      respawnedMatter.push(replacement);
    }

    const removedIds = collectedEntries.map((entry) => entry.id);
    worldDiff.removeOrganicMatterIds = [
      ...(worldDiff.removeOrganicMatterIds ?? []),
      ...removedIds,
    ];

    if (respawnedMatter.length > 0) {
      worldDiff.upsertOrganicMatter = [
        ...(worldDiff.upsertOrganicMatter ?? []),
        ...respawnedMatter.map((matter) => cloneOrganicMatter(matter)),
      ];
    }

    let totalScore = 0;
    for (const { matter } of collectedEntries) {
      const awarded = Math.max(1, Math.round(matter.quantity));
      totalScore += awarded;
      combatLog.push({
        timestamp: now,
        attackerId: player.id,
        targetKind: "organic_matter",
        targetObjectId: matter.id,
        damage: 0,
        outcome: "collected",
        remainingHealth: matter.quantity,
        scoreAwarded: awarded,
      });
    }

    if (totalScore > 0) {
      player.score = Math.max(0, player.score + totalScore);
      this.markRankingDirty();
    }

    return {
      playerUpdated: true,
      worldChanged: true,
      scoresChanged: totalScore > 0,
    };
  }

  private computePlayerCombatAttributes(player: PlayerInternal): CombatAttributes {
    if (!player.evolutionState) {
      player.evolutionState = createEvolutionState();
    }
    const archetypeDefinition = getArchetypeDefinition(player.archetypeKey);
    const base = archetypeDefinition
      ? archetypeDefinition.combatAttributes
      : getDeterministicCombatAttributesForPlayer(player.id);
    const modifiers = player.evolutionState.modifiers;

    return createCombatAttributes({
      attack: computeStatWithModifiers(base.attack, modifiers.attack),
      defense: computeStatWithModifiers(base.defense, modifiers.defense),
      speed: computeStatWithModifiers(base.speed, modifiers.speed),
      range: computeStatWithModifiers(base.range, modifiers.range),
    });
  }

  private updatePlayerCombatAttributes(player: PlayerInternal): boolean {
    const next = this.computePlayerCombatAttributes(player);
    const changed =
      next.attack !== player.combatAttributes.attack ||
      next.defense !== player.combatAttributes.defense ||
      next.speed !== player.combatAttributes.speed ||
      next.range !== player.combatAttributes.range;
    player.combatAttributes = next;
    return changed;
  }

  private resolvePlayerAttackDuringTick(
    player: PlayerInternal,
    now: number,
    worldDiff: SharedWorldStateDiff,
    combatLog: CombatLogEntry[],
    updatedPlayers: Map<string, PlayerInternal>,
  ): { worldChanged: boolean; scoresChanged: boolean } {
    let worldChanged = false;
    let scoresChanged = false;

    const status = player.combatStatus;
    if (status.state !== "engaged") {
      player.statusEffects = pruneExpiredStatusEffects(
        this.ensurePlayerStatusEffects(player),
        now,
      );
      if (player.invulnerableUntil && player.invulnerableUntil <= now) {
        player.invulnerableUntil = null;
      }
      return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
    }

    if (status.lastAttackAt && now - status.lastAttackAt < PLAYER_ATTACK_COOLDOWN_MS) {
      player.statusEffects = pruneExpiredStatusEffects(
        this.ensurePlayerStatusEffects(player),
        now,
      );
      if (player.invulnerableUntil && player.invulnerableUntil <= now) {
        player.invulnerableUntil = null;
      }
      return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
    }

    player.statusEffects = pruneExpiredStatusEffects(
      this.ensurePlayerStatusEffects(player),
      now,
    );
    if (player.invulnerableUntil && player.invulnerableUntil <= now) {
      player.invulnerableUntil = null;
    }

    const pending = player.pendingAttack ?? {
      kind: "basic" as AttackKind,
      targetPlayerId: status.targetPlayerId ?? null,
      targetObjectId: status.targetObjectId ?? null,
    };

    player.pendingAttack = null;

    if (pending.kind === "dash") {
      const result = this.resolveDashAttack(player, now, worldDiff, combatLog, updatedPlayers);
      return this.finalizeAttackResolution(result, worldDiff);
    }

    if (pending.kind === "skill") {
      const result = this.resolveSkillAttack(player, now, worldDiff, combatLog, updatedPlayers);
      return this.finalizeAttackResolution(result, worldDiff);
    }

    const targetPlayerId = pending.targetPlayerId ?? status.targetPlayerId;
    if (targetPlayerId) {
      const target = this.players.get(targetPlayerId);
      if (!target) {
        player.combatStatus = createCombatStatusState({ state: "idle" });
        updatedPlayers.set(player.id, player);
        return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
      }

      const range = player.combatAttributes.range + PLAYER_ATTACK_RANGE_BUFFER;
      const rangeSquared = range ** 2;
      const distanceSquared = this.distanceSquared(player.position, target.position);
      if (distanceSquared > rangeSquared) {
        return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
      }

      if (target.invulnerableUntil && target.invulnerableUntil <= now) {
        target.invulnerableUntil = null;
      }

      const baseDamage = Math.max(1, Math.round(player.combatAttributes.attack));
      const mitigation = Math.max(0, Math.round(target.combatAttributes.defense / 3));
      const potentialDamage = Math.max(0, baseDamage - mitigation);
      const blocked = target.invulnerableUntil && target.invulnerableUntil > now;
      const appliedDamage = blocked ? 0 : Math.max(1, potentialDamage);
      const nextHealth = Math.max(0, target.health.current - appliedDamage);

      target.health = {
        current: nextHealth,
        max: target.health.max,
      };
      player.combatStatus = createCombatStatusState({
        state: "engaged",
        targetPlayerId: target.id,
        targetObjectId: null,
        lastAttackAt: now,
      });

      updatedPlayers.set(player.id, player);
      updatedPlayers.set(target.id, target);

      let outcome: CombatLogEntry["outcome"] = "hit";
      let scoreAwarded = 0;
      if (appliedDamage <= 0) {
        outcome = "blocked";
      } else if (nextHealth === 0) {
        outcome = "defeated";
        scoreAwarded = 150;
        player.score = Math.max(0, player.score + scoreAwarded);
        scoresChanged = true;
        this.markRankingDirty();
        target.combatStatus = createCombatStatusState({ state: "cooldown", lastAttackAt: now });
        this.queuePlayerDeath(target, now, updatedPlayers);
      } else {
        scoreAwarded = 10;
        player.score = Math.max(0, player.score + scoreAwarded);
        scoresChanged = true;
        this.markRankingDirty();
      }

      combatLog.push({
        timestamp: now,
        attackerId: player.id,
        targetId: target.id,
        targetKind: "player",
        damage: appliedDamage,
        outcome,
        remainingHealth: nextHealth,
        ...(scoreAwarded > 0 ? { scoreAwarded } : {}),
      });

      return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
    }

    const targetObjectId = pending.targetObjectId ?? status.targetObjectId;
    if (targetObjectId) {
      const microorganism = this.microorganisms.get(targetObjectId);

      if (!microorganism) {
        player.combatStatus = createCombatStatusState({ state: "idle" });
        updatedPlayers.set(player.id, player);
        return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
      }

      const range = player.combatAttributes.range + PLAYER_ATTACK_RANGE_BUFFER;
      const rangeSquared = range ** 2;
      const distanceSquared = this.distanceSquared(player.position, microorganism.position);
      if (distanceSquared > rangeSquared) {
        return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
      }

      const baseDamage = Math.max(1, Math.round(player.combatAttributes.attack));
      const mitigation = Math.max(0, Math.round((microorganism.attributes.resilience ?? 0) / 2));
      const damage = Math.max(1, baseDamage - mitigation);
      const result = this.applyDamageToMicroorganism(
        player,
        microorganism,
        damage,
        now,
        worldDiff,
        combatLog,
      );
      if (result.worldChanged) {
        worldChanged = true;
      }
      if (result.scoresChanged) {
        scoresChanged = true;
      }

      player.combatStatus = createCombatStatusState({
        state: "engaged",
        targetPlayerId: null,
        targetObjectId: microorganism.id,
        lastAttackAt: now,
      });
      updatedPlayers.set(player.id, player);

      return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
    }

    return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
  }

  private updateMicroorganismsDuringTick(
    deltaMs: number,
    now: number,
    worldDiff: SharedWorldStateDiff,
    combatLog: CombatLogEntry[],
    updatedPlayers: Map<string, PlayerInternal>
  ): { worldChanged: boolean; scoresChanged: boolean } {
    let worldChanged = false;
    let scoresChanged = false;

    for (const microorganism of this.microorganisms.values()) {
      const statusCollection = this.microorganismStatusEffects.get(microorganism.id);
      if (statusCollection) {
        const pruned = pruneExpiredStatusEffects(statusCollection, now);
        if (pruned.length > 0) {
          this.microorganismStatusEffects.set(microorganism.id, pruned);
        } else {
          this.microorganismStatusEffects.delete(microorganism.id);
        }
      }

      const movement = microorganism.movementVector;
      const magnitude = Math.sqrt(movement.x ** 2 + movement.y ** 2);
      if (Number.isFinite(magnitude) && magnitude > 0) {
        const speed = Math.max(0, microorganism.attributes.speed ?? 30);
        if (speed > 0) {
          const normalizedX = movement.x / magnitude;
          const normalizedY = movement.y / magnitude;
          const distance = (speed * deltaMs) / 1000;
          const candidate = this.clampPosition({
            x: microorganism.position.x + normalizedX * distance,
            y: microorganism.position.y + normalizedY * distance,
          });
          if (!this.positionsEqual(candidate, microorganism.position) && !this.isBlockedByObstacle(candidate)) {
            microorganism.position = candidate;
            worldDiff.upsertMicroorganisms = [
              ...(worldDiff.upsertMicroorganisms ?? []),
              cloneMicroorganism(microorganism),
            ];
            worldChanged = true;
          }
        }
      }

      if (microorganism.aggression !== "hostile") {
        continue;
      }

      const behavior = this.microorganismBehavior.get(microorganism.id) ?? { lastAttackAt: 0 };
      const cooldown = PLAYER_ATTACK_COOLDOWN_MS + 400;
      if (behavior.lastAttackAt && now - behavior.lastAttackAt < cooldown) {
        continue;
      }

      const candidates = this.getMicroorganismTargetCandidates();
      if (candidates.length === 0) {
        continue;
      }

      let closest: { player: PlayerInternal; distanceSquared: number } | null = null;
      for (const player of candidates) {
        const distanceSquared = this.distanceSquared(player.position, microorganism.position);
        if (!closest || distanceSquared < closest.distanceSquared) {
          closest = { player, distanceSquared };
        }
      }

      if (!closest) {
        continue;
      }

      const attackRange = 100;
      const attackRangeSquared = attackRange ** 2;
      if (closest.distanceSquared > attackRangeSquared) {
        continue;
      }

      const baseDamage = Math.max(1, Math.round(microorganism.attributes.damage ?? 6));
      const mitigation = Math.max(0, Math.round(closest.player.combatAttributes.defense / 4));
      const damage = Math.max(1, baseDamage - mitigation);
      if (closest.player.invulnerableUntil && closest.player.invulnerableUntil <= now) {
        closest.player.invulnerableUntil = null;
      }
      if (closest.player.invulnerableUntil && closest.player.invulnerableUntil > now) {
        continue;
      }
      const nextHealth = Math.max(0, closest.player.health.current - damage);
      closest.player.health = {
        current: nextHealth,
        max: closest.player.health.max,
      };
      updatedPlayers.set(closest.player.id, closest.player);
      this.microorganismBehavior.set(microorganism.id, { lastAttackAt: now });

      if (nextHealth === 0) {
        closest.player.combatStatus = createCombatStatusState({ state: "cooldown", lastAttackAt: now });
        this.queuePlayerDeath(closest.player, now, updatedPlayers);
      }

      combatLog.push({
        timestamp: now,
        targetId: closest.player.id,
        targetKind: "player",
        targetObjectId: microorganism.id,
        damage,
        outcome: nextHealth === 0 ? "defeated" : "hit",
        remainingHealth: nextHealth,
      });
    }

    return { worldChanged, scoresChanged };
  }

  private getMicroorganismTargetCandidates(): PlayerInternal[] {
    const candidates: PlayerInternal[] = [];
    for (const player of this.players.values()) {
      if (!player.connected) {
        continue;
      }
      if (player.health.current <= 0) {
        continue;
      }
      if (player.pendingRemoval) {
        continue;
      }
      if (this.playersPendingRemoval.has(player.id)) {
        continue;
      }
      candidates.push(player);
    }

    return candidates;
  }

  private queuePlayerDeath(
    player: PlayerInternal,
    now: number,
    updatedPlayers?: Map<string, PlayerInternal>,
  ): void {
    if (this.playersPendingRemoval.has(player.id)) {
      return;
    }

    this.playersPendingRemoval.add(player.id);
    player.pendingRemoval = true;
    player.connected = false;
    player.lastSeenAt = now;
    player.lastActiveAt = now;
    player.movementVector = createVector();
    player.pendingAttack = null;
    player.invulnerableUntil = null;

    if (updatedPlayers) {
      updatedPlayers.delete(player.id);
    }

    const socket = this.socketsByPlayer.get(player.id) ?? null;
    if (socket) {
      this.socketsByPlayer.delete(player.id);
      this.clientsBySocket.delete(socket);
      this.activeSockets.delete(socket);
    }

    this.pendingPlayerDeaths.push({ playerId: player.id, socket });
  }

  private async flushPendingPlayerDeaths(): Promise<void> {
    if (this.pendingPlayerDeaths.length === 0) {
      return;
    }

    const pending = this.pendingPlayerDeaths.splice(0);
    for (const { playerId, socket } of pending) {
      this.playersPendingRemoval.delete(playerId);
      const player = this.players.get(playerId);
      if (!player) {
        continue;
      }

      player.pendingRemoval = false;
      await this.handlePlayerDeath(player, socket);
    }
  }

  private async setupSession(socket: WebSocket): Promise<void> {
    let playerId: string | null = null;

    this.activeSockets.add(socket);

    socket.addEventListener("message", (event) => {
      const data = typeof event.data === "string" ? event.data : String(event.data);
      const now = Date.now();

      const perConnectionLimiter = this.getConnectionLimiter(socket);
      if (!perConnectionLimiter.consume(now)) {
        const retryAfter = perConnectionLimiter.getRetryAfterMs(now);
        const knownPlayerId = playerId ?? this.clientsBySocket.get(socket) ?? null;
        this.handleRateLimit(socket, "connection", retryAfter, knownPlayerId, {
          limit: MAX_MESSAGES_PER_CONNECTION,
          activeConnections: this.activeSockets.size,
        });
        return;
      }

      this.maybeRecordRateLimitUtilization(
        socket,
        perConnectionLimiter,
        now,
        MAX_MESSAGES_PER_CONNECTION
      );

      const globalLimit = this.getDynamicGlobalLimit();
      if (!this.globalRateLimiter.consume(now, globalLimit)) {
        const retryAfter = this.globalRateLimiter.getRetryAfterMs(now);
        const knownPlayerId = playerId ?? this.clientsBySocket.get(socket) ?? null;
        this.handleRateLimit(socket, "global", retryAfter, knownPlayerId, {
          limit: globalLimit,
          activeConnections: this.activeSockets.size,
        });
        return;
      }

      this.maybeRecordGlobalRateLimitUtilization(now, globalLimit);

      let json: unknown;
      try {
        json = JSON.parse(data);
      } catch (error) {
        this.observability.log("warn", "client_payload_invalid", {
          stage: "parse",
          error: serializeError(error),
          category: "protocol_error"
        });
        this.observability.recordMetric("protocol_errors", 1, {
          type: "invalid_json"
        });
        this.send(socket, { type: "error", reason: "invalid_payload" });
        socket.close(1003, "invalid_payload");
        return;
      }

      const validation = clientMessageSchema.safeParse(json);
      if (!validation.success) {
        const rawType =
          typeof json === "object" && json !== null ? (json as { type?: string }).type : undefined;
        const issues = validation.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path,
          message: issue.message
        }));
        this.observability.log("warn", "client_payload_invalid", {
          stage: "schema",
          type: rawType ?? "unknown",
          issues,
          category: "protocol_error"
        });
        this.observability.recordMetric("protocol_errors", 1, {
          type: "schema_invalid",
          messageType: rawType ?? "unknown"
        });

        if (rawType === "join") {
          this.send(socket, { type: "error", reason: "invalid_name" });
          socket.close(1008, "invalid_name");
        } else {
          this.send(socket, { type: "error", reason: "invalid_payload" });
          socket.close(1003, "invalid_payload");
        }
        return;
      }

      const parsed = validation.data;

      const handleActionFailure = (error: unknown, source: string): void => {
        const knownPlayerId = playerId ?? this.clientsBySocket.get(socket) ?? null;
        this.observability.logError("action_message_failed", error, {
          category: "protocol_error",
          source,
          playerId: knownPlayerId,
        });
        this.observability.recordMetric("protocol_errors", 1, {
          type: "action_processing_failed",
          source,
        });
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) {
          try {
            socket.close(1011, "error");
          } catch (closeError) {
            this.observability.logError("action_socket_close_failed", closeError, {
              category: "protocol_error",
              source,
              playerId: knownPlayerId,
            });
          }
        }
      };

      switch (parsed.type) {
        case "join":
          void this.handleJoin(socket, parsed)
            .then((result) => {
              if (result) {
                playerId = result;
              }
            })
            .catch((error) => {
              this.observability.logError("join_failed", error);
              try {
                if (
                  socket.readyState === WebSocket.CONNECTING ||
                  socket.readyState === WebSocket.OPEN
                ) {
                  socket.close(1011, "internal_error");
                }
              } catch (closeError) {
                this.observability.logError("join_close_failed", closeError);
              }
            });
          break;
        case "action": {
          const knownId = playerId ?? this.clientsBySocket.get(socket);
          if (!knownId || knownId !== parsed.playerId) {
            this.send(socket, { type: "error", reason: "unknown_player" });
            return;
          }
          void this.handleActionMessage(parsed, socket).catch((error) =>
            handleActionFailure(error, "action")
          );
          break;
        }
        case "movement": {
          const knownId = playerId ?? this.clientsBySocket.get(socket);
          if (!knownId || knownId !== parsed.playerId) {
            this.send(socket, { type: "error", reason: "unknown_player" });
            return;
          }
          const { playerId: movementPlayerId, clientTime, ...movement } = parsed;
          const normalized: ActionMessage = {
            type: "action",
            playerId: movementPlayerId,
            ...(clientTime !== undefined ? { clientTime } : {}),
            action: movement as PlayerMovementAction,
          };
          void this.handleActionMessage(normalized, socket).catch((error) =>
            handleActionFailure(error, "movement")
          );
          break;
        }
        case "attack": {
          const knownId = playerId ?? this.clientsBySocket.get(socket);
          if (!knownId || knownId !== parsed.playerId) {
            this.send(socket, { type: "error", reason: "unknown_player" });
            return;
          }
          const { playerId: attackPlayerId, clientTime, ...attack } = parsed;
          const normalized: ActionMessage = {
            type: "action",
            playerId: attackPlayerId,
            ...(clientTime !== undefined ? { clientTime } : {}),
            action: attack as PlayerAttackAction,
          };
          void this.handleActionMessage(normalized, socket).catch((error) =>
            handleActionFailure(error, "attack")
          );
          break;
        }
        case "collect": {
          const knownId = playerId ?? this.clientsBySocket.get(socket);
          if (!knownId || knownId !== parsed.playerId) {
            this.send(socket, { type: "error", reason: "unknown_player" });
            return;
          }
          const { playerId: collectPlayerId, clientTime, ...collect } = parsed;
          const normalized: ActionMessage = {
            type: "action",
            playerId: collectPlayerId,
            ...(clientTime !== undefined ? { clientTime } : {}),
            action: collect as PlayerCollectAction,
          };
          void this.handleActionMessage(normalized, socket).catch((error) =>
            handleActionFailure(error, "collect")
          );
          break;
        }
        case "ping":
          void this.handlePing(socket, parsed.ts);
          break;
      }
    });

    socket.addEventListener("close", () => {
      const disconnectPlayerId = playerId ?? this.clientsBySocket.get(socket) ?? null;
      if (disconnectPlayerId) {
        void this.handleDisconnect(socket, disconnectPlayerId).catch((error) => {
          this.observability.logError("player_disconnect_failed", error, {
            playerId: disconnectPlayerId
          });
        });
      }
      this.clientsBySocket.delete(socket);
      this.activeSockets.delete(socket);
    });

    socket.addEventListener("error", () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) {
        socket.close(1011, "error");
      }
    });
  }

  private async handleJoin(socket: WebSocket, message: JoinMessage): Promise<string | null> {
    const validation = joinMessageSchema.safeParse(message);
    if (!validation.success) {
      this.send(socket, { type: "error", reason: "invalid_payload" });
      socket.close(1008, "invalid_payload");
      return null;
    }

    const payload = validation.data;
    const providedReconnectToken = sanitizeReconnectToken(payload.reconnectToken);
    const now = Date.now();
    await this.cleanupInactivePlayers(now);

    const normalizedName = this.normalizeName(payload.name);
    if (!normalizedName) {
      this.send(socket, { type: "error", reason: "invalid_name" });
      socket.close(1008, "invalid_name");
      return null;
    }

    if (payload.version && !SUPPORTED_CLIENT_VERSIONS.has(payload.version)) {
      this.send(socket, { type: "upgrade_required", minVersion: PROTOCOL_VERSION });
      socket.close(1011, "upgrade_required");
      return null;
    }

    let player: PlayerInternal | undefined;
    if (payload.playerId) {
      const candidate = this.players.get(payload.playerId);
      if (candidate) {
        if (!providedReconnectToken || providedReconnectToken !== candidate.reconnectToken) {
          this.send(socket, { type: "error", reason: "invalid_token" });
          socket.close(1008, "invalid_token");
          return null;
        }
        player = candidate;
      }
    }
    let expiredPlayerRemoved = false;
    if (player && now - player.lastSeenAt > RECONNECT_WINDOW_MS) {
      await this.removePlayer(player.id, "expired");
      expiredPlayerRemoved = true;
      player = undefined;
    }

    if (expiredPlayerRemoved) {
      const rankingMessage: RankingMessage = {
        type: "ranking",
        ranking: this.getRanking()
      };
      this.broadcast(rankingMessage, socket);
      await this.scheduleCleanupAlarm();
    }

    const nameKey = normalizedName.toLowerCase();
    const existingByName = this.nameToPlayerId.get(nameKey);
    if (!player && existingByName) {
      const existing = this.players.get(existingByName);
      if (existing) {
        const withinReconnectWindow = now - existing.lastSeenAt <= RECONNECT_WINDOW_MS;
        const tokenMatches = providedReconnectToken === existing.reconnectToken;
        if (existing.connected) {
          this.send(socket, { type: "error", reason: "name_taken" });
          socket.close(1008, "name_taken");
          return null;
        }

        if (withinReconnectWindow) {
          if (!tokenMatches) {
            this.send(socket, { type: "error", reason: "invalid_token" });
            socket.close(1008, "invalid_token");
            return null;
          }
          player = existing;
        } else {
          await this.removePlayer(existing.id, "expired");
          expiredPlayerRemoved = true;
        }
      } else {
        this.nameToPlayerId.delete(nameKey);
      }
    }

    const previousSocket = player ? this.socketsByPlayer.get(player.id) : undefined;

    let rankingShouldUpdate = false;

    if (!player && this.countConnectedPlayers() >= MAX_PLAYERS) {
      this.send(socket, { type: "error", reason: "room_full" });
      socket.close(1008, "room_full");
      return null;
    }

    if (!player) {
      const id = crypto.randomUUID();
      const spawnPosition = this.clampPosition(getSpawnPositionForPlayer(id));
      const evolutionState = createEvolutionState();
      const skillState = createPlayerSkillState();
      const reconnectToken = generateReconnectToken();
      player = {
        id,
        name: normalizedName,
        score: 0,
        combo: 1,
        energy: DEFAULT_PLAYER_ENERGY,
        xp: DEFAULT_PLAYER_XP,
        geneticMaterial: DEFAULT_PLAYER_GENETIC_MATERIAL,
        position: createVector(spawnPosition),
        movementVector: createVector(),
        orientation: createOrientation(),
        health: createHealthState(),
        combatStatus: createCombatStatusState(),
        combatAttributes: getDeterministicCombatAttributesForPlayer(id),
        evolutionState,
        archetypeKey: null,
        reconnectToken,
        connected: true,
        lastActiveAt: now,
        lastSeenAt: now,
        connectedAt: now,
        totalSessionDurationMs: 0,
        sessionCount: 0,
        skillState,
        pendingAttack: null,
        statusEffects: [],
        invulnerableUntil: null,
      };
      player.combatAttributes = this.computePlayerCombatAttributes(player);
      this.players.set(id, player);
      this.nameToPlayerId.set(nameKey, id);
      rankingShouldUpdate = true;
    } else {
      const previousName = player.name;
      const previousKey = player.name.toLowerCase();
      if (previousKey !== nameKey && this.nameToPlayerId.get(previousKey) === player.id) {
        this.nameToPlayerId.delete(previousKey);
      }
      player.name = normalizedName;
      player.connected = true;
      player.lastSeenAt = now;
      player.lastActiveAt = now;
      player.connectedAt = now;
      player.evolutionState = createEvolutionState(player.evolutionState);
      this.updatePlayerCombatAttributes(player);
      this.players.set(player.id, player);
      this.nameToPlayerId.set(nameKey, player.id);
      if (previousName !== normalizedName) {
        rankingShouldUpdate = true;
      }
    }

    this.ensureProgressionState(player.id);

    if (socket.readyState !== WebSocket.OPEN) {
      return null;
    }

    if (previousSocket && previousSocket !== socket) {
      this.closePlayerSocketIfCurrent(
        player.id,
        previousSocket,
        1008,
        "session_taken",
        "close_stale_socket_failed",
      );
      this.clientsBySocket.delete(previousSocket);
      this.activeSockets.delete(previousSocket);
      this.socketsByPlayer.delete(player.id);
    }

    this.clientsBySocket.set(socket, player.id);
    this.socketsByPlayer.set(player.id, socket);

    const reconnectToken = generateReconnectToken();
    player.reconnectToken = reconnectToken;

    this.markPlayersDirty();

    const connectedPlayers = this.countConnectedPlayers();
    const isReconnect = payload.playerId === player.id && !expiredPlayerRemoved;
    this.observability.log("info", "player_connected", {
      playerId: player.id,
      name: player.name,
      connectedPlayers,
      isReconnect
    });
    this.observability.recordMetric("connected_players", connectedPlayers, {
      phase: this.phase
    });

    const reconnectUntil = now + RECONNECT_WINDOW_MS;

    if (rankingShouldUpdate) {
      this.markRankingDirty();
    }

    const sharedState = this.serializeGameState();
    const ranking = this.getRanking();

    const joinedMessage: JoinedMessage = {
      type: "joined",
      playerId: player.id,
      reconnectToken,
      reconnectUntil,
      state: sharedState,
      ranking
    };

    this.send(socket, joinedMessage);

    const joinDiff: SharedGameStateDiff = {
      upsertPlayers: [this.serializePlayer(player)]
    };
    const joinBroadcast: StateDiffMessage = {
      type: "state",
      mode: "diff",
      state: joinDiff
    };

    const willStartImmediately =
      this.phase === "waiting" && this.countConnectedPlayers() >= MIN_PLAYERS_TO_START;

    if (!willStartImmediately) {
      this.broadcast(joinBroadcast, socket);
    }

    const rankingMessage: RankingMessage = {
      type: "ranking",
      ranking
    };

    this.broadcast(rankingMessage, socket);

    this.scheduleWorldTick();

    await this.maybeStartGame();

    return player.id;
  }

  private normalizeName(rawName: string): string | null {
    return sanitizePlayerName(rawName);
  }

  private async handleActionMessage(message: ActionMessage, socket: WebSocket): Promise<void> {
    const validation = actionMessageSchema.safeParse(message);
    if (!validation.success) {
      this.send(socket, { type: "error", reason: "invalid_payload" });
      return;
    }

    const payload = validation.data;

    const socketPlayerId = this.clientsBySocket.get(socket);
    if (socketPlayerId && socketPlayerId !== payload.playerId) {
      this.send(socket, { type: "error", reason: "unknown_player" });
      return;
    }

    const player = this.players.get(payload.playerId);
    if (!player) {
      this.send(socket, { type: "error", reason: "unknown_player" });
      return;
    }

    if (player.pendingRemoval) {
      return;
    }

    const now = Date.now();
    player.lastSeenAt = now;
    player.lastActiveAt = now;

    if (!player.connected) {
      player.connected = true;
      player.connectedAt = now;
      const playerSocket = this.socketsByPlayer.get(player.id);
      if (playerSocket && playerSocket !== socket) {
        this.closePlayerSocketIfCurrent(
          player.id,
          playerSocket,
          1008,
          "session_taken",
          "close_stale_socket_failed"
        );
      }
      this.socketsByPlayer.set(player.id, socket);
    }

    if (this.phase !== "active") {
      this.send(socket, { type: "error", reason: "game_not_active" });
      return;
    }

    if (payload.action.type === "death") {
      await this.handlePlayerDeath(player, socket);
      return;
    }

    const result = this.applyPlayerAction(player, payload.action, payload.clientTime);
    if (!result) {
      this.send(socket, { type: "error", reason: "invalid_payload" });
      return;
    }

    if (result.updatedPlayers.length > 0 || result.scoresChanged) {
      this.markPlayersDirty();
    }

    if (result.worldDiff) {
      this.markWorldDirty();
    }

    const diff: SharedGameStateDiff = {};
    if (result.updatedPlayers.length > 0) {
      diff.upsertPlayers = result.updatedPlayers.map((playerState) => this.serializePlayer(playerState));
    }
    if (result.worldDiff) {
      diff.world = result.worldDiff;
    }
    if (result.combatLog && result.combatLog.length > 0) {
      diff.combatLog = result.combatLog;
    }

    const progression = this.flushPendingProgression();
    if (progression) {
      diff.progression = progression;
    }

    if (Object.keys(diff).length > 0) {
      const stateMessage: StateDiffMessage = {
        type: "state",
        mode: "diff",
        state: diff
      };
      this.broadcast(stateMessage);
    }

    if (result.scoresChanged) {
      this.markRankingDirty();
      const rankingMessage: RankingMessage = {
        type: "ranking",
        ranking: this.getRanking()
      };

      this.broadcast(rankingMessage);
    }
  }

  private applyPlayerAction(
    player: PlayerInternal,
    action: PlayerAction,
    clientTime?: number,
  ): ApplyPlayerActionResult | null {
    const updatedPlayers: PlayerInternal[] = [];

    switch (action.type) {
      case "combo": {
        const multiplier = clamp(action.multiplier, 1, MAX_COMBO_MULTIPLIER);
        player.combo = multiplier;
        updatedPlayers.push(player);
        return { updatedPlayers };
      }
      case "archetype": {
        const definition = getArchetypeDefinition(action.archetype);
        if (!definition) {
          return null;
        }

        player.archetypeKey = definition.key;

        if (!player.evolutionState) {
          player.evolutionState = createEvolutionState();
        }

        if (!player.evolutionState.traits.includes(definition.key)) {
          player.evolutionState.traits.push(definition.key);
        }

        const nextMaxHealth = Math.max(1, definition.maxHealth);
        const nextCurrentHealth = Math.max(
          0,
          Math.min(player.health.current, nextMaxHealth),
        );
        player.health = {
          current: nextCurrentHealth,
          max: nextMaxHealth,
        };

        this.updatePlayerCombatAttributes(player);

        updatedPlayers.push(player);
        return { updatedPlayers };
      }
      case "movement": {
        const normalizedMovement = cloneVector(action.movementVector);
        const magnitude = Math.sqrt(normalizedMovement.x ** 2 + normalizedMovement.y ** 2);
        if (!Number.isFinite(magnitude)) {
          return null;
        }
        if (magnitude > 1) {
          normalizedMovement.x /= magnitude;
          normalizedMovement.y /= magnitude;
        }

        const clampedPosition = this.clampPosition(player.position);
        if (clampedPosition.x !== player.position.x || clampedPosition.y !== player.position.y) {
          player.position = clampedPosition;
        }

        if (this.isBlockedByObstacle(player.position)) {
          normalizedMovement.x = 0;
          normalizedMovement.y = 0;
        }

        player.movementVector = normalizedMovement;
        player.orientation = cloneOrientation(action.orientation);
        updatedPlayers.push(player);
        return { updatedPlayers };
      }
      case "attack": {
        const attackKind = (action.kind ?? "basic") as AttackKind;
        const targetOptional = TARGET_OPTIONAL_ATTACK_KINDS.has(attackKind);
        const hasTargetPlayer = action.targetPlayerId !== undefined && action.targetPlayerId !== null;
        const hasTargetObject = action.targetObjectId !== undefined && action.targetObjectId !== null;
        if (!hasTargetPlayer && !hasTargetObject && !targetOptional) {
          return null;
        }

        if (hasTargetPlayer) {
          const targetPlayer = this.players.get(action.targetPlayerId!);
          if (!targetPlayer) {
            return null;
          }
        }

        if (hasTargetObject) {
          const objectId = action.targetObjectId!;
          if (
            !this.microorganisms.has(objectId) &&
            !this.organicMatter.has(objectId) &&
            !this.obstacles.has(objectId) &&
            !this.roomObjects.has(objectId)
          ) {
            return null;
          }
        }

        const now = Date.now();

        if (attackKind === "skill") {
          const skillState = this.ensurePlayerSkillState(player);
          const skill = getSkillDefinition(skillState.current);
          if (!skill) {
            player.combatStatus = createCombatStatusState({ state: "cooldown", lastAttackAt: now });
            player.pendingAttack = null;
            updatedPlayers.push(player);
            return { updatedPlayers };
          }

          const remainingCooldown = Math.max(0, skillState.cooldowns[skill.key] ?? 0);
          if (remainingCooldown > 0) {
            player.combatStatus = createCombatStatusState({
              state: "cooldown",
              targetPlayerId: action.targetPlayerId ?? null,
              targetObjectId: action.targetObjectId ?? null,
              lastAttackAt: now,
            });
            player.pendingAttack = null;
            updatedPlayers.push(player);
            return { updatedPlayers };
          }

          const energyCost = Math.max(0, skill.cost?.energy ?? 0);
          const xpCost = Math.max(0, skill.cost?.xp ?? 0);
          const mgCost = Math.max(0, skill.cost?.mg ?? 0);
          const lacksEnergy = player.energy < energyCost;
          const lacksXp = player.xp < xpCost;
          const lacksGeneticMaterial = player.geneticMaterial < mgCost;

          if (lacksEnergy || lacksXp || lacksGeneticMaterial) {
            const nextCooldown = Math.max(skill.cooldownMs, skillState.cooldowns[skill.key] ?? 0);
            skillState.cooldowns[skill.key] = nextCooldown;
            player.combatStatus = createCombatStatusState({
              state: "cooldown",
              targetPlayerId: action.targetPlayerId ?? null,
              targetObjectId: action.targetObjectId ?? null,
              lastAttackAt: now,
            });
            player.pendingAttack = null;
            updatedPlayers.push(player);
            return { updatedPlayers };
          }
        }

        const nextState = action.state ?? "engaged";
        const previousLastAttackAt = player.combatStatus.lastAttackAt;
        let nextLastAttackAt = previousLastAttackAt;
        if (typeof clientTime === "number" && Number.isFinite(clientTime)) {
          nextLastAttackAt = Math.min(
            Math.max(clientTime, now),
            now + CLIENT_TIME_MAX_FUTURE_DRIFT_MS,
          );
        }
        player.combatStatus = createCombatStatusState({
          state: nextState,
          targetPlayerId: action.targetPlayerId ?? null,
          targetObjectId: action.targetObjectId ?? null,
          lastAttackAt: nextLastAttackAt,
        });

        player.pendingAttack = {
          kind: attackKind,
          targetPlayerId: action.targetPlayerId ?? null,
          targetObjectId: action.targetObjectId ?? null,
        };

        const currentHealthMax = player.health.max;
        const previousHealthCurrent = player.health.current;
        const hasDamage = typeof action.damage === "number";
        const normalizedDamage = hasDamage ? Math.max(0, action.damage) : 0;
        const expectedCurrent = hasDamage
          ? clamp(previousHealthCurrent - normalizedDamage, 0, currentHealthMax)
          : previousHealthCurrent;

        if (action.resultingHealth) {
          const { current, max } = action.resultingHealth;
          const isCurrentFinite = typeof current === "number" && Number.isFinite(current);
          const maxMatches = max === undefined || max === currentHealthMax;

          if (hasDamage && isCurrentFinite && maxMatches) {
            const normalizedCurrent = clamp(current, 0, currentHealthMax);
            if (normalizedCurrent !== expectedCurrent) {
              this.observability.recordMetric("player_attack_resulting_health_mismatch", 1, {
                expected: expectedCurrent,
                reported: normalizedCurrent,
                damage: normalizedDamage,
              });
            }
          }
        }

        if (hasDamage) {
          player.health = {
            current: expectedCurrent,
            max: currentHealthMax,
          };
        }

        updatedPlayers.push(player);
        return { updatedPlayers };
      }
      case "collect": {
        if (!this.organicMatter.has(action.objectId) && !this.microorganisms.has(action.objectId)) {
          return null;
        }

        player.combatStatus = createCombatStatusState({
          state: "idle",
          targetPlayerId: null,
          targetObjectId: action.objectId,
          lastAttackAt: player.combatStatus.lastAttackAt,
        });
        updatedPlayers.push(player);
        return { updatedPlayers };
      }
      case "evolution": {
        if (!player.evolutionState) {
          player.evolutionState = createEvolutionState();
        }
        applyEvolutionActionToState(player.evolutionState, action as PlayerEvolutionAction);
        player.lastActiveAt = Date.now();
        this.updatePlayerCombatAttributes(player);
        updatedPlayers.push(player);
        return { updatedPlayers };
      }
      default:
        return null;
    }
  }

  private async handlePing(socket: WebSocket, ts: number): Promise<void> {
    const playerId = this.clientsBySocket.get(socket);
    if (playerId) {
      const player = this.players.get(playerId);
      if (player) {
        player.lastSeenAt = Date.now();
      }
    }

    const pong: PongMessage = { type: "pong", ts };
    this.send(socket, pong);
  }

  private async handleDisconnect(socket: WebSocket, playerId: string): Promise<void> {
    this.clientsBySocket.delete(socket);
    this.activeSockets.delete(socket);

    const player = this.players.get(playerId);
    if (!player) {
      return;
    }

    const activeSocket = this.socketsByPlayer.get(playerId);
    if (activeSocket && activeSocket !== socket) {
      return;
    }

    this.socketsByPlayer.delete(playerId);

    player.connected = false;
    player.movementVector = createVector();
    player.combatStatus = createCombatStatusState();
    player.lastSeenAt = Date.now();
    const now = player.lastSeenAt;
    let sessionDurationMs: number | null = null;
    if (player.connectedAt) {
      sessionDurationMs = Math.max(0, now - player.connectedAt);
      player.totalSessionDurationMs = (player.totalSessionDurationMs ?? 0) + sessionDurationMs;
      player.sessionCount = (player.sessionCount ?? 0) + 1;
    }
    player.connectedAt = null;

    const diff: SharedGameStateDiff = {
      upsertPlayers: [this.serializePlayer(player)]
    };

    const progression = this.flushPendingProgression();
    if (progression) {
      diff.progression = progression;
    }

    const stateMessage: StateDiffMessage = {
      type: "state",
      mode: "diff",
      state: diff
    };

    this.broadcast(stateMessage, socket);

    const connectedPlayers = this.countConnectedPlayers();
    this.observability.log("info", "player_disconnected", {
      playerId: player.id,
      name: player.name,
      connectedPlayers,
      sessionDurationMs
    });
    this.observability.recordMetric("connected_players", connectedPlayers, {
      phase: this.phase
    });
    if (sessionDurationMs !== null) {
      this.observability.recordMetric("session_duration_ms", sessionDurationMs, {
        playerId: player.id
      });
    }

    this.markPlayersDirty();

    await this.scheduleCleanupAlarm();

    if (this.phase === "waiting") {
      await this.maybeStartGame();
    }

    if (this.phase === "active" && this.countConnectedPlayers() === 0) {
      await this.endGame("timeout");
    }
  }

  private async handleWaitingStartAlarm(): Promise<void> {
    const scheduled = this.alarmSchedule.get("waiting_start");
    if (!scheduled) {
      return;
    }

    this.alarmSchedule.delete("waiting_start");
    this.markAlarmsDirty({ persistent: true });

    if (this.phase === "waiting") {
      await this.startGame();
    }
  }

  private async handleRoundEndAlarm(): Promise<void> {
    const scheduled = this.alarmSchedule.get("round_end");
    if (!scheduled) {
      return;
    }

    this.alarmSchedule.delete("round_end");
    this.markAlarmsDirty({ persistent: true });

    if (this.phase === "active") {
      await this.endGame("timeout");
    }
  }

  private async handleResetAlarm(): Promise<void> {
    const scheduled = this.alarmSchedule.get("reset");
    if (!scheduled) {
      return;
    }

    this.alarmSchedule.delete("reset");
    this.markAlarmsDirty({ persistent: true });
    await this.resetGame();
  }

  private async handleCleanupAlarm(): Promise<void> {
    const scheduled = this.alarmSchedule.get("cleanup");
    if (!scheduled) {
      return;
    }

    this.alarmSchedule.delete("cleanup");
    this.markAlarmsDirty({ persistent: true });
    await this.cleanupInactivePlayers(Date.now());
  }

  private async handleWorldTickAlarm(now: number): Promise<void> {
    const scheduled = this.alarmSchedule.get("world_tick");
    if (!this.shouldRunWorldTickLoop()) {
      if (scheduled !== undefined) {
        this.cancelWorldTick();
      } else {
        this.lastWorldTickAt = null;
      }
      return;
    }

    if (scheduled === undefined) {
      this.scheduleWorldTick(now);
      return;
    }

    this.alarmSchedule.delete("world_tick");

    const lastTick = this.lastWorldTickAt ?? now;
    const deltaMs = Math.max(1, now - lastTick);
    this.lastWorldTickAt = now;

    const stalePlayerIds = new Set<string>();
    const staleSockets: Array<{ playerId: string; socket: WebSocket }> = [];
    for (const player of this.players.values()) {
      if (!player.connected) {
        continue;
      }
      if (now - player.lastSeenAt <= INACTIVE_TIMEOUT_MS) {
        continue;
      }
      const socket = this.socketsByPlayer.get(player.id);
      if (!socket) {
        continue;
      }
      stalePlayerIds.add(player.id);
      staleSockets.push({ playerId: player.id, socket });
    }

    for (const { playerId, socket } of staleSockets) {
      this.closePlayerSocketIfCurrent(
        playerId,
        socket,
        1001,
        "inactive_timeout",
        "close_inactive_socket_failed"
      );
    }

    const updatedPlayers = new Map<string, PlayerInternal>();
    const worldDiff: SharedWorldStateDiff = {};
    const combatLog: CombatLogEntry[] = [];
    let worldChanged = false;
    let scoresChanged = false;

    for (const player of this.players.values()) {
      if (!player.connected) {
        continue;
      }
      if (stalePlayerIds.has(player.id)) {
        continue;
      }
      if (this.movePlayerDuringTick(player, deltaMs)) {
        updatedPlayers.set(player.id, player);
      }

      if (this.tickPlayerSkillCooldowns(player, deltaMs)) {
        updatedPlayers.set(player.id, player);
      }

      const collectionResult = this.handleCollectionsDuringTick(player, worldDiff, combatLog, now);
      if (collectionResult.playerUpdated) {
        updatedPlayers.set(player.id, player);
      }
      if (collectionResult.worldChanged) {
        worldChanged = true;
      }
      if (collectionResult.scoresChanged) {
        scoresChanged = true;
      }

      const attackResult = this.resolvePlayerAttackDuringTick(
        player,
        now,
        worldDiff,
        combatLog,
        updatedPlayers
      );
      if (attackResult.worldChanged) {
        worldChanged = true;
      }
      if (attackResult.scoresChanged) {
        scoresChanged = true;
      }
    }

    const microorganismResult = this.updateMicroorganismsDuringTick(
      deltaMs,
      now,
      worldDiff,
      combatLog,
      updatedPlayers
    );
    if (microorganismResult.worldChanged) {
      worldChanged = true;
    }
    if (microorganismResult.scoresChanged) {
      scoresChanged = true;
    }

    if (this.pendingStatusEffects.length > 0) {
      worldDiff.statusEffects = [
        ...(worldDiff.statusEffects ?? []),
        ...this.pendingStatusEffects,
      ];
      this.pendingStatusEffects = [];
    }

    const hasPlayerUpdates = updatedPlayers.size > 0;
    const hasWorldDiff = Boolean(
      worldDiff.upsertMicroorganisms?.length ||
        worldDiff.removeMicroorganismIds?.length ||
        worldDiff.upsertOrganicMatter?.length ||
        worldDiff.removeOrganicMatterIds?.length ||
        worldDiff.upsertObstacles?.length ||
        worldDiff.removeObstacleIds?.length ||
        worldDiff.upsertRoomObjects?.length ||
        worldDiff.removeRoomObjectIds?.length
    );
    const hasCombatLog = combatLog.length > 0;

    if (hasPlayerUpdates || scoresChanged) {
      this.markPlayersDirty();
    }

    if (hasWorldDiff || worldChanged) {
      this.markWorldDirty();
    }

    const diff: SharedGameStateDiff = {};
    if (hasPlayerUpdates) {
      diff.upsertPlayers = Array.from(updatedPlayers.values()).map((player) => this.serializePlayer(player));
    }
    if (hasWorldDiff) {
      diff.world = worldDiff;
    }
    if (hasCombatLog) {
      diff.combatLog = combatLog;
    }

    const progression = this.flushPendingProgression();
    if (progression) {
      diff.progression = progression;
    }

    if (diff.upsertPlayers || diff.world || diff.combatLog || diff.progression) {
      const stateMessage: StateDiffMessage = {
        type: "state",
        mode: "diff",
        state: diff,
      };
      this.broadcast(stateMessage);
    }

    const hadQueuedDeaths = this.pendingPlayerDeaths.length > 0;
    await this.flushPendingPlayerDeaths();

    if (scoresChanged && !hadQueuedDeaths) {
      this.markRankingDirty();
      const rankingMessage: RankingMessage = {
        type: "ranking",
        ranking: this.getRanking(),
      };
      this.broadcast(rankingMessage);
    }

    this.scheduleWorldTick(now);
  }

  private async maybeStartGame(): Promise<void> {
    if (this.phase === "ended") {
      await this.resetGame();
      return;
    }

    if (this.phase !== "waiting") {
      return;
    }

    const activePlayers = Array.from(this.players.values()).filter((player) => player.connected);

    if (activePlayers.length === 0) {
      if (this.alarmSchedule.has("waiting_start")) {
        this.alarmSchedule.delete("waiting_start");
        await this.persistAndSyncAlarms();
      }
      return;
    }

    if (activePlayers.length >= MIN_PLAYERS_TO_START) {
      await this.startGame();
      return;
    }

    if (WAITING_START_DELAY_ENABLED && !this.alarmSchedule.has("waiting_start")) {
      const at = Date.now() + WAITING_START_DELAY_MS;
      this.alarmSchedule.set("waiting_start", at);
      await this.persistAndSyncAlarms();
    }
  }

  private async startGame(): Promise<void> {
    if (this.countConnectedPlayers() === 0) {
      this.phase = "waiting";
      this.roundId = null;
      this.roundStartedAt = null;
      this.roundEndsAt = null;
      this.alarmSchedule.delete("waiting_start");
      this.alarmSchedule.delete("round_end");
      await this.persistAndSyncAlarms();
      this.invalidateGameStateSnapshot();
      return;
    }

    const worldDiff = this.regenerateWorldForPrimarySpawn();

    this.phase = "active";
    this.roundId = crypto.randomUUID();
    this.roundStartedAt = Date.now();
    this.roundEndsAt = this.roundStartedAt + ROUND_DURATION_MS;
    this.alarmSchedule.delete("waiting_start");
    this.alarmSchedule.set("round_end", this.roundEndsAt);
    await this.persistAndSyncAlarms();
    this.invalidateGameStateSnapshot();

    const stateMessage: StateFullMessage = {
      type: "state",
      mode: "full",
      state: this.serializeGameState()
    };

    this.broadcast(stateMessage);

    if (worldDiff) {
      const worldDiffMessage: StateDiffMessage = {
        type: "state",
        mode: "diff",
        state: { world: worldDiff },
      };
      this.broadcast(worldDiffMessage);
    }

    const now = Date.now();
    this.lastWorldTickAt = now;
    this.scheduleWorldTick(now);

    const connectedPlayers = this.countConnectedPlayers();
    this.observability.log("info", "round_started", {
      roundId: this.roundId,
      roundEndsAt: this.roundEndsAt,
      connectedPlayers
    });
    this.observability.recordMetric("connected_players", connectedPlayers, {
      phase: this.phase
    });
  }

  private async endGame(reason: "timeout" | "completed"): Promise<void> {
    this.phase = "ended";
    this.cancelWorldTick();
    this.roundEndsAt = Date.now();
    this.alarmSchedule.delete("round_end");
    this.alarmSchedule.set("reset", Date.now() + RESET_DELAY_MS);
    await this.persistAndSyncAlarms();
    this.invalidateGameStateSnapshot();

    const serializedState = this.serializeGameState();
    const ranking = this.getRanking();

    const stateMessage: StateFullMessage = {
      type: "state",
      mode: "full",
      state: serializedState
    };

    const rankingMessage: RankingMessage = {
      type: "ranking",
      ranking
    };

    const resetMessage: ResetMessage = {
      type: "reset",
      state: serializedState
    };

    this.broadcast(stateMessage);
    this.broadcast(rankingMessage);
    this.broadcast(resetMessage);

    await this.flushSnapshots({ force: true });

    const duration = this.roundStartedAt ? this.roundEndsAt - this.roundStartedAt : null;
    this.observability.log("info", "round_ended", {
      roundId: this.roundId,
      reason,
      durationMs: duration,
      connectedPlayers: this.countConnectedPlayers()
    });
    if (duration !== null) {
      this.observability.recordMetric("round_duration_ms", duration, { reason });
    }
  }

  private async resetGame(): Promise<void> {
    this.phase = "waiting";
    this.roundId = null;
    this.roundStartedAt = null;
    this.roundEndsAt = null;
    const worldDiff = this.regenerateWorldForPrimarySpawn();

    const resetTimestamp = Date.now();
    for (const player of this.players.values()) {
      player.combo = 1;
      player.lastActiveAt = resetTimestamp;
      player.movementVector = createVector();
      player.orientation = createOrientation();
      player.position = this.clampPosition(getSpawnPositionForPlayer(player.id));
      player.health = createHealthState({
        max: player.health.max,
        current: player.health.max,
      });
      player.combatStatus = createCombatStatusState();
      player.statusEffects = [];
      player.pendingAttack = null;
      player.invulnerableUntil = null;
    }

    this.playersPendingRemoval.clear();
    this.pendingStatusEffects = [];
    this.microorganismStatusEffects.clear();

    this.playersDirty = true;
    this.invalidateGameStateSnapshot();
    this.markRankingDirty();

    this.alarmSchedule.delete("reset");
    await this.persistAndSyncAlarms();

    await this.flushSnapshots({ force: true });

    const now = Date.now();
    if (this.shouldRunWorldTickLoop()) {
      this.lastWorldTickAt = now;
      this.scheduleWorldTick(now);
    } else {
      this.lastWorldTickAt = null;
      this.cancelWorldTick();
    }

    const message: StateFullMessage = {
      type: "state",
      mode: "full",
      state: this.serializeGameState()
    };

    this.broadcast(message);

    if (worldDiff) {
      const worldDiffMessage: StateDiffMessage = {
        type: "state",
        mode: "diff",
        state: { world: worldDiff },
      };
      this.broadcast(worldDiffMessage);
    }

    await this.maybeStartGame();
  }

  private serializePlayer(player: PlayerInternal) {
    const skillState = this.ensurePlayerSkillState(player);
    return {
      id: player.id,
      name: player.name,
      connected: player.connected,
      score: player.score,
      combo: player.combo,
      energy: player.energy,
      xp: player.xp,
      geneticMaterial: player.geneticMaterial,
      lastActiveAt: player.lastActiveAt,
      position: cloneVector(player.position),
      movementVector: cloneVector(player.movementVector),
      orientation: cloneOrientation(player.orientation),
      health: cloneHealthState(player.health),
      combatStatus: cloneCombatStatusState(player.combatStatus),
      combatAttributes: cloneCombatAttributes(player.combatAttributes),
      archetype: player.archetypeKey ?? null,
      archetypeKey: player.archetypeKey ?? null,
      skillList: skillState.available.slice(),
      currentSkill: skillState.current ?? null,
      skillCooldowns: { ...skillState.cooldowns },
    };
  }

  private ensureProgressionState(playerId: string): PlayerProgressionState {
    let state = this.progressionState.get(playerId);
    if (!state) {
      state = { dropPity: { fragment: 0, stableGene: 0 }, sequence: 0 };
      this.progressionState.set(playerId, state);
      this.invalidateGameStateSnapshot();
    }
    return state;
  }

  private queueProgressionStream(playerId: string): PendingProgressionStream {
    let pending = this.pendingProgression.get(playerId);
    if (!pending) {
      const state = this.ensureProgressionState(playerId);
      pending = {
        sequence: state.sequence + 1,
        dropPity: clonePityCounters(state.dropPity),
      };
      this.pendingProgression.set(playerId, pending);
    }
    return pending;
  }

  private recordKillProgression(
    player: PlayerInternal,
    context: { targetId?: string; dropTier?: SharedProgressionKillEvent["dropTier"]; advantage?: boolean }
  ): void {
    const state = this.ensureProgressionState(player.id);
    const pending = this.queueProgressionStream(player.id);
    const event: SharedProgressionKillEvent = {
      playerId: player.id,
      targetId: context.targetId,
      dropTier: (context.dropTier ?? "minion") as SharedProgressionKillEvent["dropTier"],
      advantage: context.advantage ?? false,
      xpMultiplier: 1,
      rolls: {
        fragment: Math.random(),
        fragmentAmount: Math.random(),
        stableGene: Math.random(),
        mg: Math.random(),
      },
      timestamp: Date.now(),
    };
    pending.kills = [...(pending.kills ?? []), event];

    const dropResults = aggregateDrops([event], {
      dropTables: DROP_TABLES,
      rng: Math.random,
      initialPity: state.dropPity,
    });
    state.dropPity = clonePityCounters(dropResults.pity);
    this.invalidateGameStateSnapshot();
  }

  private flushPendingProgression(): SharedProgressionState | null {
    if (this.pendingProgression.size === 0) {
      return null;
    }

    const players: SharedProgressionState["players"] = {};
    for (const [playerId, stream] of this.pendingProgression.entries()) {
      const state = this.ensureProgressionState(playerId);
      players[playerId] = {
        sequence: stream.sequence,
        dropPity: clonePityCounters(stream.dropPity),
        damage: stream.damage ? stream.damage.map((entry) => ({ ...entry })) : undefined,
        objectives: stream.objectives ? stream.objectives.map((entry) => ({ ...entry })) : undefined,
        kills: stream.kills ? stream.kills.map((entry) => ({ ...entry })) : undefined,
      };
      state.sequence = stream.sequence;
      this.pendingProgression.delete(playerId);
    }

    if (Object.keys(players).length === 0) {
      return null;
    }

    return { players };
  }

  private serializeProgressionState(): SharedProgressionState {
    const players: SharedProgressionState["players"] = {};
    for (const playerId of this.players.keys()) {
      const state = this.ensureProgressionState(playerId);
      players[playerId] = {
        sequence: state.sequence,
        dropPity: clonePityCounters(state.dropPity),
      };
    }
    return { players };
  }

  private serializeGameState(): SharedGameState {
    if (this.gameStateSnapshot !== null && !this.gameStateSnapshotDirty) {
      return this.gameStateSnapshot;
    }

    const players = Array.from(this.players.values())
      .map((player) => this.serializePlayer(player))
      .sort((a, b) => a.name.localeCompare(b.name));

    const snapshot: SharedGameState = {
      phase: this.phase,
      roundId: this.roundId,
      roundStartedAt: this.roundStartedAt,
      roundEndsAt: this.roundEndsAt,
      players,
      world: cloneWorldState(this.world),
      progression: this.serializeProgressionState()
    };

    this.gameStateSnapshot = snapshot;
    this.gameStateSnapshotDirty = false;

    return snapshot;
  }

  private getRanking(): RankingEntry[] {
    if (!this.rankingDirty) {
      return this.rankingCache;
    }

    this.rankingCache = Array.from(this.players.values())
      .map<RankingEntry>((player) => ({
        playerId: player.id,
        name: player.name,
        score: player.score,
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        const nameComparison = a.name.localeCompare(
          b.name,
          RANKING_SORT_LOCALE,
          RANKING_SORT_OPTIONS,
        );
        if (nameComparison !== 0) {
          return nameComparison;
        }
        return a.playerId.localeCompare(b.playerId);
      });
    this.rankingDirty = false;
    return this.rankingCache;
  }

  private detachPlayer(playerId: string): PlayerInternal | null {
    const player = this.players.get(playerId);
    if (!player) {
      return null;
    }

    this.players.delete(playerId);
    this.markRankingDirty();

    const nameKey = player.name.toLowerCase();
    if (this.nameToPlayerId.get(nameKey) === playerId) {
      this.nameToPlayerId.delete(nameKey);
    }

    this.socketsByPlayer.delete(playerId);

    for (const [socket, id] of this.clientsBySocket.entries()) {
      if (id === playerId) {
        this.clientsBySocket.delete(socket);
        this.activeSockets.delete(socket);
      }
    }

    this.progressionState.delete(playerId);
    this.pendingProgression.delete(playerId);
    this.invalidateGameStateSnapshot();

    return player;
  }

  private async cleanupInactivePlayers(reference: number): Promise<void> {
    let removedSomeone = false;
    for (const player of Array.from(this.players.values())) {
      if (player.connected) {
        continue;
      }
      if (reference - player.lastSeenAt > RECONNECT_WINDOW_MS || reference - player.lastActiveAt > INACTIVE_TIMEOUT_MS) {
        await this.removePlayer(player.id, "inactive");
        removedSomeone = true;
      }
    }

    if (removedSomeone) {
      const rankingMessage: RankingMessage = {
        type: "ranking",
        ranking: this.getRanking()
      };
      this.broadcast(rankingMessage);
    }

    if (this.phase === "waiting") {
      await this.maybeStartGame();
    }

    await this.scheduleCleanupAlarm();
  }

  private async handlePlayerDeath(
    player: PlayerInternal,
    socket: WebSocket | null,
  ): Promise<void> {
    const now = Date.now();
    let sessionDurationMs: number | null = null;

    if (player.connectedAt !== null) {
      sessionDurationMs = Math.max(0, now - player.connectedAt);
      player.totalSessionDurationMs = (player.totalSessionDurationMs ?? 0) + sessionDurationMs;
      player.sessionCount = (player.sessionCount ?? 0) + 1;
      player.connectedAt = null;
    }

    const removed = this.detachPlayer(player.id);
    if (!removed) {
      return;
    }

    this.markPlayersDirty();

    const diff: SharedGameStateDiff = { removedPlayerIds: [removed.id] };
    const progression = this.flushPendingProgression();
    if (progression) {
      diff.progression = progression;
    }
    const stateMessage: StateDiffMessage = { type: "state", mode: "diff", state: diff };
    this.broadcast(stateMessage);
    if (socket) {
      this.send(socket, stateMessage);
    }

    const rankingMessage: RankingMessage = { type: "ranking", ranking: this.getRanking() };
    this.broadcast(rankingMessage);
    if (socket) {
      this.send(socket, rankingMessage);
    }

    const connectedPlayers = this.countConnectedPlayers();
    this.observability.log("info", "player_removed", {
      playerId: removed.id,
      name: removed.name,
      reason: "death",
      sessionDurationMs,
      totalSessionDurationMs: removed.totalSessionDurationMs ?? 0,
      sessionCount: removed.sessionCount ?? 0,
      connectedPlayers
    });
    this.observability.recordMetric("connected_players", connectedPlayers, {
      phase: this.phase
    });

    if (this.phase === "active" && connectedPlayers === 0) {
      await this.endGame("timeout");
    }
  }

  private async removePlayer(
    playerId: string,
    reason: "expired" | "inactive"
  ): Promise<void> {
    const removed = this.detachPlayer(playerId);
    if (!removed) {
      return;
    }

    this.markPlayersDirty();

    const diff: SharedGameStateDiff = { removedPlayerIds: [removed.id] };
    const progression = this.flushPendingProgression();
    if (progression) {
      diff.progression = progression;
    }
    const stateMessage: StateDiffMessage = { type: "state", mode: "diff", state: diff };

    this.broadcast(stateMessage);

    this.observability.log("info", "player_removed", {
      playerId: removed.id,
      name: removed.name,
      reason,
      totalSessionDurationMs: removed.totalSessionDurationMs ?? 0,
      sessionCount: removed.sessionCount ?? 0
    });

    const connectedPlayers = this.countConnectedPlayers();
    this.observability.recordMetric("connected_players", connectedPlayers, {
      phase: this.phase
    });

    if (this.phase === "active" && connectedPlayers === 0) {
      await this.endGame("timeout");
    }
  }

  private async scheduleCleanupAlarm(): Promise<void> {
    let nextCleanup: number | null = null;
    const now = Date.now();
    for (const player of this.players.values()) {
      if (!player.connected) {
        const expiresAt = player.lastSeenAt + RECONNECT_WINDOW_MS;
        if (expiresAt <= now) {
          nextCleanup = now;
          break;
        }
        if (nextCleanup === null || expiresAt < nextCleanup) {
          nextCleanup = expiresAt;
        }
      }
    }

    if (nextCleanup === null) {
      this.alarmSchedule.delete("cleanup");
    } else {
      this.alarmSchedule.set("cleanup", nextCleanup);
    }

    await this.persistAndSyncAlarms();
  }

  private async persistPlayers(): Promise<void> {
    const snapshot: StoredPlayer[] = Array.from(this.players.values()).map((player) => {
      const skillState = this.ensurePlayerSkillState(player);
      return {
        id: player.id,
        name: player.name,
        score: player.score,
        combo: player.combo,
        energy: player.energy,
        xp: player.xp,
        geneticMaterial: player.geneticMaterial,
        position: cloneVector(player.position),
        movementVector: cloneVector(player.movementVector),
        orientation: cloneOrientation(player.orientation),
        health: cloneHealthState(player.health),
        combatStatus: cloneCombatStatusState(player.combatStatus),
        combatAttributes: cloneCombatAttributes(player.combatAttributes),
        evolutionState: cloneEvolutionState(player.evolutionState),
        archetypeKey: player.archetypeKey ?? null,
        reconnectToken: player.reconnectToken,
        skillState: clonePlayerSkillState(skillState),
        totalSessionDurationMs: player.totalSessionDurationMs ?? 0,
        sessionCount: player.sessionCount ?? 0
      };
    });
    await this.state.storage.put(PLAYERS_KEY, snapshot);
  }

  private async persistWorld(): Promise<void> {
    await this.state.storage.put(WORLD_KEY, cloneWorldState(this.world));
  }

  private async persistSnapshotState(): Promise<void> {
    if (!this.playersDirty && !this.worldDirty && this.pendingSnapshotAlarm === null) {
      await this.state.storage.delete(SNAPSHOT_STATE_KEY);
      return;
    }

    const snapshotState: SnapshotState = {
      playersDirty: this.playersDirty,
      worldDirty: this.worldDirty,
      pendingSnapshotAlarm: this.pendingSnapshotAlarm,
    };

    await this.state.storage.put(SNAPSHOT_STATE_KEY, snapshotState);
  }

  private async persistAlarms(): Promise<void> {
    const serialized: AlarmSnapshot = {
      waiting_start: this.alarmSchedule.get("waiting_start") ?? null,
      round_end: this.alarmSchedule.get("round_end") ?? null,
      reset: this.alarmSchedule.get("reset") ?? null,
      cleanup: this.alarmSchedule.get("cleanup") ?? null
    };
    await this.state.storage.put(ALARM_KEY, serialized);
  }

  private async syncAlarms(): Promise<void> {
    const entries = Array.from(this.alarmSchedule.entries()).filter(([, timestamp]) => timestamp != null);
    if (entries.length === 0) {
      const storage = this.state.storage as typeof this.state.storage & { deleteAlarm?: () => Promise<void> };
      if (typeof storage.deleteAlarm === "function") {
        await storage.deleteAlarm();
      }
      return;
    }
    entries.sort((a, b) => (a[1]! - b[1]!));
    const [, nextTimestamp] = entries[0];
    if (typeof nextTimestamp === "number") {
      await this.state.storage.setAlarm(nextTimestamp);
    }
  }

  private shouldRunWorldTickLoop(): boolean {
    if (this.phase === "ended") {
      return false;
    }
    return this.countConnectedPlayers() > 0;
  }

  private countConnectedPlayers(): number {
    let count = 0;
    for (const player of this.players.values()) {
      if (player.connected) {
        count += 1;
      }
    }
    return count;
  }

  private broadcast(message: ServerMessage, except?: WebSocket): void {
    const payload = JSON.stringify(message);
    for (const socket of this.clientsBySocket.keys()) {
      if (socket === except) continue;
      if (socket.readyState === WebSocket.OPEN) {
        this.send(socket, message, payload);
      }
    }
  }

  private closePlayerSocketIfCurrent(
    playerId: string,
    socket: WebSocket,
    code: number,
    reason: string,
    logEvent: string = "close_socket_failed"
  ): void {
    const current = this.socketsByPlayer.get(playerId);
    if (current !== socket) {
      return;
    }
    const mappedPlayerId = this.clientsBySocket.get(socket);
    if (mappedPlayerId !== playerId) {
      return;
    }

    if (socket.readyState !== WebSocket.CLOSING && socket.readyState !== WebSocket.CLOSED) {
      try {
        socket.close(code, reason);
      } catch (error) {
        this.observability.log("warn", logEvent, {
          playerId,
          error: serializeError(error),
        });
      }
    }
  }

  private send(socket: WebSocket, message: ServerMessage, payload?: string): void {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const serialized = payload ?? JSON.stringify(message);

    try {
      socket.send(serialized);
    } catch (error) {
      const playerId = this.clientsBySocket.get(socket);
      this.observability.logError("socket_send_failed", error, {
        ...(playerId ? { playerId } : {}),
        messageType: message.type
      });

      this.clientsBySocket.delete(socket);
      this.activeSockets.delete(socket);
      if (playerId && this.socketsByPlayer.get(playerId) === socket) {
        this.socketsByPlayer.delete(playerId);
      }

      const closingState = (WebSocket as unknown as { CLOSING?: number }).CLOSING;
      if (
        socket.readyState === WebSocket.OPEN ||
        (typeof closingState === "number" && socket.readyState === closingState)
      ) {
        try {
          socket.close(1011, "send_failed");
        } catch (closeError) {
          this.observability.logError("socket_close_failed", closeError, {
            ...(playerId ? { playerId } : {}),
            messageType: message.type
          });
        }
      }
    }
  }
}
