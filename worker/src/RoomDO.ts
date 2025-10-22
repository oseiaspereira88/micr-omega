import { createMulberry32 } from "@micr-omega/shared";
import type { Env } from "./index";
import { createObservability, serializeError, type Observability } from "./observability";
import {
  DEFAULT_RUNTIME_CONFIG,
  loadRuntimeConfig,
  type RuntimeConfig,
} from "./config/runtime";
import {
  ROOM_ID_HEADER,
  deriveRoomIdFromUrl,
  parseRoomRoute,
  routeExpectsWebSocket,
  normalizePathname,
  sanitizeRoomId,
} from "./room-routing";
import {
  ORGANIC_COLLECTION_ENERGY_MULTIPLIER,
  ORGANIC_COLLECTION_MG_MULTIPLIER,
  ORGANIC_COLLECTION_SCORE_MULTIPLIER,
  ORGANIC_COLLECTION_XP_MULTIPLIER,
} from "./config/balance";
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
  type SharedDamagePopup,
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
  calculateExperienceFromEvents,
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
import {
  applyEvolutionActionToState,
  cloneCombatAttributes,
  cloneCombatStatusState,
  cloneEvolutionState,
  cloneHealthState,
  cloneOrientation,
  clonePlayerSkillState,
  cloneCharacteristicPointsState,
  cloneVector,
  computeEvolutionSlotsForPlayer,
  computeCombatAttributesWithModifiers,
  DEFAULT_COMBAT_ATTRIBUTES,
  createCombatAttributes,
  createCombatStatusState,
  createEvolutionState,
  createHealthState,
  createOrientation,
  createPlayerSkillState,
  createCharacteristicPointsState,
  createVector,
  DEFAULT_DASH_CHARGE,
  DEFAULT_PLAYER_ENERGY,
  DEFAULT_PLAYER_GENETIC_MATERIAL,
  DEFAULT_PLAYER_XP,
  DASH_CHARGE_COST,
  DASH_COOLDOWN_MS,
  DASH_RECHARGE_PER_MS,
  getArchetypeDefinition,
  MAX_DASH_CHARGE,
  normalizeVectorOrNull,
  normalizeDashCharge,
  normalizeDashCooldown,
  normalizePlayerSkillState,
  orientationsApproximatelyEqual,
  rotateVector,
  vectorsApproximatelyEqual,
  type PendingAttack,
  type PlayerInternal,
  type PlayerSkillState,
  type StoredPlayer,
  type StoredPlayerSkillState,
  type StoredPlayerSnapshot,
} from "./playerManager";
import {
  cloneGeneCounter,
  createGeneCounter,
  getPlayerLevelFromXp,
  incrementGeneCounter,
  type GeneCounter,
  type PendingProgressionStream,
  type PlayerProgressionState,
} from "./progression";
import {
  GLOBAL_RATE_LIMIT_HEADROOM,
  MAX_CLIENT_MESSAGE_SIZE_BYTES,
  MAX_MESSAGES_GLOBAL,
  MAX_MESSAGES_PER_CONNECTION,
  MessageRateLimiter,
  RATE_LIMIT_UTILIZATION_REPORT_INTERVAL_MS,
  RATE_LIMIT_WINDOW_MS,
} from "./networking";
import {
  CONTACT_BUFFER,
  DAMAGE_POPUP_TTL_MS,
  MICRO_COLLISION_RADIUS,
  MICRO_CONTACT_INVULNERABILITY_MS,
  MAX_DAMAGE_POPUPS_PER_TICK,
  PLAYER_COLLISION_RADIUS,
  WORLD_BOUNDS,
  WORLD_TICK_INTERVAL_MS,
  clamp,
  clampToWorldBounds,
  getDeterministicCombatAttributesForPlayer,
  getSpawnPositionForPlayer,
  hashString,
  sanitizeOrganicMatterTags,
  translateWithinWorldBounds,
  vectorMagnitude,
} from "./worldSimulation";

export {
  MessageRateLimiter,
  MAX_CLIENT_MESSAGE_SIZE_BYTES,
  RATE_LIMIT_WINDOW_MS,
  MAX_MESSAGES_PER_CONNECTION,
  MAX_MESSAGES_GLOBAL,
  GLOBAL_RATE_LIMIT_HEADROOM,
} from "./networking";

export { DEFAULT_RUNTIME_CONFIG } from "./config/runtime";

export {
  WORLD_TICK_INTERVAL_MS,
  CONTACT_BUFFER,
  PLAYER_COLLISION_RADIUS,
  MICRO_COLLISION_RADIUS,
  MAX_DAMAGE_POPUPS_PER_TICK,
  DAMAGE_POPUP_TTL_MS,
  MICRO_CONTACT_INVULNERABILITY_MS,
} from "./worldSimulation";

export {
  DEFAULT_PLAYER_ENERGY,
  DEFAULT_PLAYER_XP,
  DEFAULT_PLAYER_GENETIC_MATERIAL,
  MAX_DASH_CHARGE,
  DEFAULT_DASH_CHARGE,
  DASH_CHARGE_COST,
  DASH_COOLDOWN_MS,
} from "./playerManager";

export {
  createGeneCounter,
  cloneGeneCounter,
  incrementGeneCounter,
  getPlayerLevelFromXp,
} from "./progression";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });

export const hashReconnectToken = async (token: string): Promise<string> => {
  const encoded = TEXT_ENCODER.encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
};

export const DEFAULT_MIN_PLAYERS_TO_START = DEFAULT_RUNTIME_CONFIG.minPlayersToStart;
export const DEFAULT_WAITING_START_DELAY_MS = DEFAULT_RUNTIME_CONFIG.waitingStartDelayMs;
export const DEFAULT_ROUND_DURATION_MS = DEFAULT_RUNTIME_CONFIG.roundDurationMs;
export const DEFAULT_RESET_DELAY_MS = DEFAULT_RUNTIME_CONFIG.resetDelayMs;
export const DEFAULT_RECONNECT_WINDOW_MS = DEFAULT_RUNTIME_CONFIG.reconnectWindowMs;
export const DEFAULT_INACTIVE_TIMEOUT_MS = DEFAULT_RUNTIME_CONFIG.inactiveTimeoutMs;
export const DEFAULT_MAX_PLAYERS = DEFAULT_RUNTIME_CONFIG.maxPlayers;

const MAX_COMBO_MULTIPLIER = 50;
const MAX_PERSISTED_SCORE = Number.MAX_SAFE_INTEGER;

const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const numeric = Number(trimmed);
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (value instanceof Number) {
    const numeric = value.valueOf();
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
};

const sanitizeStoredScore = (value: unknown): number => {
  const numeric = toFiniteNumberOrNull(value);
  if (numeric === null) {
    return 0;
  }
  return clamp(numeric, 0, MAX_PERSISTED_SCORE);
};

const sanitizeStoredCombo = (value: unknown): number => {
  const numeric = toFiniteNumberOrNull(value);
  if (numeric === null) {
    return 1;
  }
  return clamp(numeric, 1, MAX_COMBO_MULTIPLIER);
};

const PLAYERS_KEY = "players";
const WORLD_KEY = "world";
const ALARM_KEY = "alarms";
const SNAPSHOT_STATE_KEY = "snapshot_state";
const RNG_STATE_KEY = "rng_state";
const PROGRESSION_KEY = "progression";

const SNAPSHOT_FLUSH_INTERVAL_MS = 500;
const PLAYER_ATTACK_COOLDOWN_MS = 800;
const PLAYER_COLLECT_RADIUS = 60;
const PLAYER_ATTACK_RANGE_BUFFER = CONTACT_BUFFER;
const OBSTACLE_PADDING = 12;

const MICRO_LOW_HEALTH_THRESHOLD = 0.3;
const MICRO_RETARGET_COOLDOWN_MS = 500;
const MICRO_CONTACT_INVULNERABILITY_MS = PLAYER_ATTACK_COOLDOWN_MS + 400;
const MICRO_FLEE_DURATION_MS = 2_000;
const MICRO_PATROL_RADIUS = 140;
const MICRO_WAYPOINT_REACH_DISTANCE = 16;
const MICRO_WAYPOINT_REFRESH_MS = 6_000;
const MICRO_ZIG_ANGLE_RADIANS = Math.PI / 6;
const MICRO_ZIG_INTERVAL_MS = 1_200;
const MICRO_STEERING_SAMPLE_DISTANCE = 360;
const MICRO_STEERING_ANGLES = [Math.PI / 6, Math.PI / 4, Math.PI / 3] as const;

const ORGANIC_MATTER_CELL_SIZE = PLAYER_COLLECT_RADIUS;
const ORGANIC_RESPAWN_DELAY_RANGE_MS = { min: 1_200, max: 3_600 } as const;
const ORGANIC_CLUSTER_PATTERNS = [
  [
    { offset: { x: 0, y: 0 }, quantityFactor: 1.2 },
    { offset: { x: 28, y: -18 }, quantityFactor: 0.95 },
    { offset: { x: -30, y: 24 }, quantityFactor: 0.85 },
    { offset: { x: 18, y: 32 }, quantityFactor: 0.9 },
    { offset: { x: -26, y: -28 }, quantityFactor: 0.8 },
  ],
  [
    { offset: { x: 0, y: 0 }, quantityFactor: 1.1 },
    { offset: { x: -24, y: 22 }, quantityFactor: 0.88 },
    { offset: { x: 32, y: 18 }, quantityFactor: 0.92 },
    { offset: { x: -36, y: -16 }, quantityFactor: 0.84 },
    { offset: { x: 18, y: -30 }, quantityFactor: 0.86 },
  ],
  [
    { offset: { x: 0, y: 0 }, quantityFactor: 1.15 },
    { offset: { x: 26, y: 24 }, quantityFactor: 0.9 },
    { offset: { x: -28, y: -22 }, quantityFactor: 0.87 },
    { offset: { x: 34, y: -14 }, quantityFactor: 0.93 },
    { offset: { x: -22, y: 32 }, quantityFactor: 0.85 },
    { offset: { x: 8, y: -36 }, quantityFactor: 0.82 },
  ],
] as const;

const CLIENT_TIME_MAX_FUTURE_DRIFT_MS = 2_000;

const SUPPORTED_CLIENT_VERSIONS = new Set([PROTOCOL_VERSION]);
const NAME_VALIDATION_ERROR_MESSAGES = new Set([
  "name_too_short",
  "name_too_long",
  "name_invalid_chars",
]);

type PersistentAlarmType = "waiting_start" | "round_end" | "reset" | "cleanup";
type TransientAlarmType = "world_tick" | "snapshot";
type AlarmType = PersistentAlarmType | TransientAlarmType;

type AlarmSnapshot = Record<PersistentAlarmType, number | null>;

type SnapshotState = {
  playersDirty: boolean;
  worldDirty: boolean;
  progressionDirty: boolean;
  pendingSnapshotAlarm: number | null;
};

type RngState = {
  organicMatterRespawn: number;
  progression: number;
  microorganismWaypoint: number;
};

type ApplyPlayerActionResult = {
  updatedPlayers: PlayerInternal[];
  worldDiff?: SharedWorldStateDiff;
  combatLog?: CombatLogEntry[];
  scoresChanged?: boolean;
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

const clonePityCounters = (pity: { fragment: number; stableGene: number }) => ({
  fragment: pity.fragment,
  stableGene: pity.stableGene,
});

const cloneDamagePopup = (popup: SharedDamagePopup): SharedDamagePopup => ({
  id: popup.id,
  position: cloneVector(popup.position),
  value: popup.value,
  variant: popup.variant,
  createdAt: popup.createdAt,
  expiresAt: popup.expiresAt,
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
  organicMatter: world.organicMatter.map((matter) => cloneOrganicMatter(matter)),
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
  damagePopups: Array.isArray(world.damagePopups)
    ? world.damagePopups.map(cloneDamagePopup)
    : [],
});

type StoredMicroorganism = Omit<Microorganism, "name" | "level"> &
  Partial<Pick<Microorganism, "name" | "level">>;

type StoredWorldState = Omit<SharedWorldState, "microorganisms"> & {
  microorganisms: StoredMicroorganism[];
};

const cloneMicroorganism = (entity: Microorganism): Microorganism => ({
  ...entity,
  position: cloneVector(entity.position),
  movementVector: cloneVector(entity.movementVector),
  orientation: cloneOrientation(entity.orientation),
  health: cloneHealthState(entity.health),
  attributes: { ...entity.attributes },
});

type MicroorganismMovementMemory = {
  targetPlayerId: string | null;
  retargetAfter: number;
  nextWaypoint: Vector2 | null;
  zigzagDirection: 1 | -1;
  lastZigToggleAt: number;
  baseHeadingAngle: number | null;
  fleeUntil: number;
};

type MicroorganismBehaviorState = {
  lastAttackAt: number;
  movement: MicroorganismMovementMemory;
};

const cloneOrganicMatter = (matter: OrganicMatter): OrganicMatter => ({
  ...matter,
  position: cloneVector(matter.position),
  nutrients: { ...matter.nutrients },
  tags: sanitizeOrganicMatterTags(matter.tags, matter.nutrients),
});

type InitialMicroorganismTemplate = {
  id: string;
  species: Microorganism["species"];
  name: Microorganism["name"];
  level: Microorganism["level"];
  aggression: Microorganism["aggression"];
  position: Vector2;
  movementVector: Vector2;
  orientation: OrientationState;
  health: HealthState;
  attributes: Microorganism["attributes"];
};

const createInitialMicroorganism = ({
  id,
  species,
  name,
  level,
  aggression,
  position,
  movementVector,
  orientation,
  health,
  attributes,
}: InitialMicroorganismTemplate): Microorganism => ({
  id,
  kind: "microorganism",
  species,
  name,
  level,
  aggression,
  position,
  movementVector,
  orientation,
  health,
  attributes,
});

const INITIAL_WORLD_TEMPLATE: SharedWorldState = {
  microorganisms: [
    createInitialMicroorganism({
      id: "micro-alpha",
      species: "bacillus",
      name: "Amber Spindle",
      level: 3,
      position: { x: -200, y: -150 },
      movementVector: { x: 1, y: 0.2 },
      orientation: { angle: 0 },
      health: { current: 40, max: 40 },
      aggression: "neutral",
      attributes: { speed: 40, damage: 6, resilience: 3 },
    }),
    createInitialMicroorganism({
      id: "micro-beta",
      species: "amoeba",
      name: "Crimson Bloom",
      level: 5,
      position: { x: 220, y: 160 },
      movementVector: { x: -0.6, y: 0.8 },
      orientation: { angle: Math.PI / 2 },
      health: { current: 55, max: 55 },
      aggression: "hostile",
      attributes: { speed: 50, damage: 9, resilience: 4 },
    }),
    createInitialMicroorganism({
      id: "micro-gamma",
      species: "ciliate",
      name: "Azure Spiral",
      level: 2,
      position: { x: 0, y: 260 },
      movementVector: { x: 0.2, y: -1 },
      orientation: { angle: Math.PI },
      health: { current: 35, max: 35 },
      aggression: "neutral",
      attributes: { speed: 30, damage: 5, resilience: 2 },
    }),
    createInitialMicroorganism({
      id: "micro-delta",
      species: "protozoa",
      name: "Verdant Lancer",
      level: 4,
      position: { x: -320, y: 280 },
      movementVector: { x: 0.7, y: -0.4 },
      orientation: { angle: (3 * Math.PI) / 4 },
      health: { current: 60, max: 60 },
      aggression: "hostile",
      attributes: { speed: 48, damage: 8, resilience: 5 },
    }),
    createInitialMicroorganism({
      id: "micro-epsilon",
      species: "fungus",
      name: "Saffron Veil",
      level: 1,
      position: { x: 360, y: -240 },
      movementVector: { x: -0.3, y: 0.6 },
      orientation: { angle: Math.PI / 6 },
      health: { current: 28, max: 28 },
      aggression: "passive",
      attributes: { speed: 24, damage: 3, resilience: 6 },
    }),
    createInitialMicroorganism({
      id: "micro-zeta",
      species: "virus",
      name: "Obsidian Shard",
      level: 6,
      position: { x: 120, y: -300 },
      movementVector: { x: -1.1, y: 0.5 },
      orientation: { angle: (5 * Math.PI) / 6 },
      health: { current: 32, max: 32 },
      aggression: "hostile",
      attributes: { speed: 60, damage: 11, resilience: 2 },
    }),
  ],
  organicMatter: [
    {
      id: "organic-alpha",
      kind: "organic_matter",
      position: { x: 140, y: -120 },
      quantity: 24,
      nutrients: { carbon: 10, nitrogen: 4 },
      tags: { nutrients: ["carbon", "nitrogen"], attributes: ["attack"] },
    },
    {
      id: "organic-beta",
      kind: "organic_matter",
      position: { x: -260, y: 200 },
      quantity: 18,
      nutrients: { carbon: 6 },
      tags: { nutrients: ["carbon"], attributes: ["defense"] },
    },
    {
      id: "organic-gamma",
      kind: "organic_matter",
      position: { x: 80, y: 40 },
      quantity: 30,
      nutrients: { phosphorus: 5 },
      tags: { nutrients: ["phosphorus"], attributes: ["speed"] },
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
  damagePopups: [],
};

type WorldGenerationOptions = {
  primarySpawn?: Vector2 | null;
};

type PendingOrganicRespawnTemplate = {
  quantity: number;
  nutrients: OrganicMatter["nutrients"];
  tags: OrganicMatter["tags"];
};

type PendingOrganicRespawnGroup = {
  anchor: Vector2;
  clusterShape: typeof ORGANIC_CLUSTER_PATTERNS[number];
  size: number;
  templates: PendingOrganicRespawnTemplate[];
  delayRangeMs: { min: number; max: number };
  respawnAt: number;
  randomSeed: number;
};

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

  const translatedOrganicMatter = base.organicMatter.flatMap((matter, index) => {
    const baseOffset = getEntityOffset(directions, index + base.microorganisms.length);
    const anchor = translateWithinWorldBounds(matter.position, baseOffset);
    const angle = Math.atan2(baseOffset.y, baseOffset.x);
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const pattern =
      ORGANIC_CLUSTER_PATTERNS[index % ORGANIC_CLUSTER_PATTERNS.length] ?? ORGANIC_CLUSTER_PATTERNS[0];

    return pattern.map((entry, offsetIndex) => {
      const rotatedOffset = {
        x: entry.offset.x * cosAngle - entry.offset.y * sinAngle,
        y: entry.offset.x * sinAngle + entry.offset.y * cosAngle,
      };
      const jitterSeed = Math.sin((index + 1) * (offsetIndex + 11));
      const jitterMagnitude = (jitterSeed - Math.floor(jitterSeed)) * 12 - 6;
      const jitterAngle = ((index + 3) * (offsetIndex + 5)) % 360;
      const jitterRadians = (jitterAngle * Math.PI) / 180;
      const jitterOffset = {
        x: Math.cos(jitterRadians) * jitterMagnitude,
        y: Math.sin(jitterRadians) * jitterMagnitude,
      };
      const position = translateWithinWorldBounds(anchor, {
        x: rotatedOffset.x + jitterOffset.x,
        y: rotatedOffset.y + jitterOffset.y,
      });
      const quantityBase = Math.max(4, matter.quantity);
      const quantity = Math.max(3, Math.round(quantityBase * entry.quantityFactor));

      return {
        ...matter,
        id: offsetIndex === 0 ? matter.id : `${matter.id}-cluster-${offsetIndex}`,
        position,
        quantity,
      };
    });
  });

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

const LEGACY_MICROORGANISM_NAME_ADJECTIVES = [
  "Amber",
  "Crimson",
  "Azure",
  "Verdant",
  "Saffron",
  "Obsidian",
  "Ivory",
  "Cerulean",
  "Umbral",
  "Gilded",
  "Cinder",
  "Misty",
] as const;

const LEGACY_MICROORGANISM_NAME_NOUNS = [
  "Spindle",
  "Bloom",
  "Spiral",
  "Lancer",
  "Veil",
  "Shard",
  "Warden",
  "Drift",
  "Glyph",
  "Maw",
  "Crown",
  "Echo",
] as const;

const DEFAULT_LEGACY_MICROORGANISM_LEVEL = 1;

const generateLegacyMicroorganismName = (
  microorganism: StoredMicroorganism,
  index: number,
): string => {
  const baseHash = hashString(`${microorganism.id ?? index}:${microorganism.species ?? ""}`);
  const adjective =
    LEGACY_MICROORGANISM_NAME_ADJECTIVES[
      baseHash % LEGACY_MICROORGANISM_NAME_ADJECTIVES.length
    ] ?? "Luminous";
  const noun =
    LEGACY_MICROORGANISM_NAME_NOUNS[
      Math.floor(baseHash / LEGACY_MICROORGANISM_NAME_ADJECTIVES.length) %
        LEGACY_MICROORGANISM_NAME_NOUNS.length
    ] ?? "Strain";
  const name = `${adjective} ${noun}`.trim();
  return name.slice(0, 64);
};

const normalizeStoredMicroorganism = (
  microorganism: StoredMicroorganism,
  index: number,
): { entity: Microorganism; changed: boolean } => {
  let changed = false;

  const rawName =
    typeof microorganism.name === "string" ? microorganism.name.trim() : "";
  const normalizedName =
    rawName.length > 0 ? rawName.slice(0, 64) : generateLegacyMicroorganismName(microorganism, index);
  if (normalizedName !== microorganism.name) {
    changed = true;
  }

  const rawLevel = microorganism.level;
  let normalizedLevel: number;
  if (typeof rawLevel === "number" && Number.isFinite(rawLevel)) {
    normalizedLevel = Math.trunc(rawLevel);
    if (normalizedLevel < 0) {
      normalizedLevel = 0;
    }
    if (normalizedLevel !== rawLevel) {
      changed = true;
    }
  } else {
    normalizedLevel = DEFAULT_LEGACY_MICROORGANISM_LEVEL;
    changed = true;
  }

  return {
    entity: {
      ...microorganism,
      name: normalizedName,
      level: normalizedLevel,
    } as Microorganism,
    changed,
  };
};

const normalizeStoredWorldState = (
  world: StoredWorldState,
): { world: SharedWorldState; changed: boolean } => {
  const microorganismsSource = Array.isArray(world.microorganisms)
    ? world.microorganisms
    : [];
  let changed = !Array.isArray(world.microorganisms);

  const damagePopupsSource = Array.isArray(world.damagePopups)
    ? (world.damagePopups as SharedDamagePopup[])
    : [];
  if (!Array.isArray(world.damagePopups)) {
    changed = true;
  }

  const microorganisms = microorganismsSource.map((entity, index) => {
    const result = normalizeStoredMicroorganism(entity, index);
    if (result.changed) {
      changed = true;
    }
    return result.entity;
  });

  const damagePopups = damagePopupsSource.map((popup) => cloneDamagePopup(popup));

  if (!changed) {
    return { world: world as SharedWorldState, changed: false };
  }

  return {
    world: {
      ...world,
      microorganisms,
      damagePopups,
    },
    changed: true,
  };
};

const HANDSHAKE_TIMEOUT_CLOSE_CODE = 4000;

export class RoomDO {
  static readonly RNG_STATE_PERSIST_DEBOUNCE_MS = 50;

  private readonly state: DurableObjectState;
  private readonly ready: Promise<void>;
  private readonly observability: Observability;
  private readonly config: RuntimeConfig;
  private readonly waitingStartDelayEnabled: boolean;

  private readonly clientsBySocket = new Map<WebSocket, string>();
  private readonly activeSockets = new Set<WebSocket>();
  private readonly handshakeTimeouts = new WeakMap<WebSocket, ReturnType<typeof setTimeout>>();
  private readonly socketsByPlayer = new Map<string, WebSocket>();
  private readonly players = new Map<string, PlayerInternal>();
  private readonly nameToPlayerId = new Map<string, string>();
  private readonly connectionRateLimiters = new WeakMap<WebSocket, MessageRateLimiter>();
  private readonly rateLimitUtilizationLastReported = new WeakMap<WebSocket, number>();
  private readonly globalRateLimiter: MessageRateLimiter;
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
  private rngState: RngState = {
    organicMatterRespawn: 1,
    progression: 1,
    microorganismWaypoint: 1,
  };
  private organicMatterRespawnRng: () => number = Math.random;
  private progressionRng: () => number = Math.random;
  private microorganismWaypointRng: () => number = Math.random;
  private organicGroupRngFactory: (seed: number) => () => number = (seed) =>
    createMulberry32(seed);
  private organicRespawnQueue: PendingOrganicRespawnGroup[] = [];
  private obstacles = new Map<string, Obstacle>();
  private microorganismBehavior = new Map<string, MicroorganismBehaviorState>();
  private microorganismStatusEffects = new Map<string, StatusCollection>();
  private lastWorldTickAt: number | null = null;
  private pendingStatusEffects: StatusEffectEvent[] = [];
  private pendingPlayerDeaths: Array<{ playerId: string; socket: WebSocket | null }> = [];
  private playersPendingRemoval = new Set<string>();
  private damagePopupSequence = 0;

  private rngStatePersistPending = false;
  private rngStatePersistTimeout: ReturnType<typeof setTimeout> | null = null;
  private rngStatePersistInFlight: Promise<void> | null = null;

  private alarmSchedule: Map<AlarmType, number> = new Map();
  private alarmsDirty = false;
  private persistentAlarmsDirty = false;
  private playersDirty = false;
  private worldDirty = false;
  private progressionDirty = false;
  private pendingSnapshotAlarm: number | null = null;
  private gameStateSnapshot: SharedGameState | null = null;
  private gameStateSnapshotDirty = true;
  private progressionState = new Map<string, PlayerProgressionState>();
  private pendingProgression = new Map<string, PendingProgressionStream>();

  private connectedPlayers = 0;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.config = loadRuntimeConfig(env);
    this.waitingStartDelayEnabled =
      this.config.minPlayersToStart > 1 && this.config.waitingStartDelayMs > 0;
    this.globalRateLimiter = new MessageRateLimiter(
      this.config.maxMessagesGlobal,
      this.config.rateLimitWindowMs
    );
    this.observability = createObservability(env, { component: "RoomDO" });
    this.ready = this.initialize();
    this.observability.log("info", "room_initialized");
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);
    const normalizedPath = normalizePathname(url.pathname);

    const baseHeaders = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    } as const;

    if (normalizedPath === "/health") {
      return Response.json({ status: "ok" }, { status: 200, headers: baseHeaders });
    }

    const route = parseRoomRoute(url.pathname);
    const expectsWebSocket = routeExpectsWebSocket(route);
    const derivedRoom = deriveRoomIdFromUrl(url, route);
    const forwardedRoom = sanitizeRoomId(request.headers.get(ROOM_ID_HEADER));
    const roomId = forwardedRoom ?? derivedRoom.roomId;

    if (!route || !expectsWebSocket) {
      return new Response("Not Found", { status: 404, headers: baseHeaders });
    }

    if (forwardedRoom && forwardedRoom !== derivedRoom.roomId) {
      this.observability.log("warn", "room_id_mismatch", {
        forwardedRoomId: forwardedRoom,
        derivedRoomId: derivedRoom.roomId,
        route: route.kind,
      });
      return new Response("Bad Request", { status: 400, headers: baseHeaders });
    }

    if (request.method !== "GET") {
      this.observability.log("warn", "room_invalid_method", {
        method: request.method,
        roomId,
      });
      return new Response("Method Not Allowed", { status: 405, headers: baseHeaders });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      this.observability.log("warn", "room_upgrade_missing", {
        route: route.kind,
        roomId,
      });
      return new Response("Expected WebSocket", { status: 426, headers: baseHeaders });
    }

    const pair = new WebSocketPair();
    const { 0: client, 1: server } = pair;
    server.accept();

    this.setupSession(server).catch((error) => {
      this.observability.logError("room_session_failed", error, {
        roomId,
        route: route.kind,
      });
      try {
        server.close(1011, "internal_error");
      } catch (err) {
        this.observability.logError("room_session_close_failed", err, {
          roomId,
          route: route.kind,
        });
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
      limiter = new MessageRateLimiter(
        this.config.maxMessagesPerConnection,
        this.config.rateLimitWindowMs
      );
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
    if (now - lastReportedAt < this.config.rateLimitUtilizationReportIntervalMs) {
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

    if (now - this.lastGlobalRateLimitReportAt < this.config.rateLimitUtilizationReportIntervalMs) {
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
    const baseline = activeConnections * this.config.maxMessagesPerConnection;
    const headroom = this.config.globalRateLimitHeadroom;
    const scaledLimit = Math.ceil(baseline * headroom);
    const maxLimit = Math.max(1, this.config.maxMessagesGlobal);
    return Math.min(maxLimit, Math.max(1, scaledLimit));
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
    const storedRngState = await this.state.storage.get<RngState>(RNG_STATE_KEY);
    const {
      restoredFromStorage,
      mutated: rngStateChanged,
      sanitizedKeys,
    } = this.initializeRngState(storedRngState ?? null);

    if (rngStateChanged) {
      await this.flushQueuedRngStatePersist({ force: true });
    }

    const rngLogMetadata =
      sanitizedKeys.length > 0 ? { sanitizedKeys } : undefined;

    if (restoredFromStorage) {
      this.observability.log("info", "rng_state_restored", rngLogMetadata);
    } else {
      this.observability.log("info", "rng_state_initialized", rngLogMetadata);
    }

    const storedProgression = await this.state.storage.get<
      Record<string, PlayerProgressionState>
    >(PROGRESSION_KEY);
    const restoredProgression = new Map<string, PlayerProgressionState>();
    if (storedProgression && typeof storedProgression === "object") {
      for (const [playerId, snapshot] of Object.entries(storedProgression)) {
        if (!snapshot || typeof snapshot !== "object") {
          continue;
        }
        const dropPitySource = (snapshot as PlayerProgressionState).dropPity ?? {
          fragment: 0,
          stableGene: 0,
        };
        const sanitizedDropPity = {
          fragment: Number.isFinite(dropPitySource.fragment)
            ? Math.max(0, Number(dropPitySource.fragment))
            : 0,
          stableGene: Number.isFinite(dropPitySource.stableGene)
            ? Math.max(0, Number(dropPitySource.stableGene))
            : 0,
        };
        const sanitizedSequence = Number.isFinite(snapshot.sequence)
          ? Math.max(0, Math.trunc(Number(snapshot.sequence)))
          : 0;
        restoredProgression.set(playerId, {
          sequence: sanitizedSequence,
          dropPity: sanitizedDropPity,
        });
      }
    }
    this.progressionState = restoredProgression;

    const storedPlayers = await this.state.storage.get<StoredPlayerSnapshot[]>(PLAYERS_KEY);
    let needsLegacyHashMigration = false;
    if (Array.isArray(storedPlayers)) {
      const now = Date.now();
      for (const storedRaw of storedPlayers) {
        if (!storedRaw || typeof storedRaw !== "object") {
          this.observability.log("warn", "player_restore_invalid_record", {
            reason: "invalid_payload",
          });
          continue;
        }

        const stored = storedRaw as StoredPlayerSnapshot & Record<string, unknown>;
        const playerId = typeof stored.id === "string" ? stored.id.trim() : "";
        if (!playerId) {
          this.observability.log("warn", "player_restore_invalid_record", {
            reason: "missing_id",
          });
          continue;
        }

        const rawName = typeof stored.name === "string" ? stored.name : "";
        const trimmedName = rawName.trim();
        if (!trimmedName) {
          this.observability.log("warn", "player_restore_invalid_record", {
            reason: "missing_name",
            playerId,
          });
          continue;
        }

        const sanitizedName = sanitizePlayerName(trimmedName);
        if (!sanitizedName) {
          this.observability.log("warn", "player_restore_invalid_record", {
            reason: "invalid_name",
            playerId,
          });
          continue;
        }

        const evolutionState = createEvolutionState(stored.evolutionState);
        const archetypeKey = stored.archetypeKey
          ? sanitizeArchetypeKey(stored.archetypeKey)
          : null;
        const skillState = createPlayerSkillState(stored.skillState);
        let reconnectTokenHash = sanitizeReconnectToken(stored.reconnectTokenHash);
        const legacyReconnectToken = sanitizeReconnectToken(stored.reconnectToken);
        if (!reconnectTokenHash && legacyReconnectToken) {
          reconnectTokenHash = await hashReconnectToken(legacyReconnectToken);
          needsLegacyHashMigration = true;
        }

        if (!reconnectTokenHash) {
          const fallbackToken = generateReconnectToken();
          reconnectTokenHash = await hashReconnectToken(fallbackToken);
          needsLegacyHashMigration = true;
        }

        const reconnectToken = generateReconnectToken();

        const sanitizedScore = sanitizeStoredScore(stored.score);
        const sanitizedCombo = sanitizeStoredCombo(stored.combo);

        const normalized: StoredPlayer = {
          id: playerId,
          name: sanitizedName,
          score: sanitizedScore,
          combo: sanitizedCombo,
          energy: Number.isFinite(stored.energy)
            ? Math.max(0, stored.energy)
            : DEFAULT_PLAYER_ENERGY,
          xp: Number.isFinite(stored.xp) ? Math.max(0, stored.xp) : DEFAULT_PLAYER_XP,
          geneticMaterial: Number.isFinite(stored.geneticMaterial)
            ? Math.max(0, stored.geneticMaterial)
            : DEFAULT_PLAYER_GENETIC_MATERIAL,
          geneFragments: createGeneCounter(stored.geneFragments),
          stableGenes: createGeneCounter(stored.stableGenes),
          dashCharge: normalizeDashCharge(stored.dashCharge),
          dashCooldownMs: normalizeDashCooldown(stored.dashCooldownMs),
          characteristicPoints: createCharacteristicPointsState(stored.characteristicPoints),
          position: createVector(stored.position),
          movementVector: createVector(stored.movementVector),
          orientation: createOrientation(stored.orientation),
          health: createHealthState(stored.health),
          combatStatus: createCombatStatusState(stored.combatStatus),
          combatAttributes: createCombatAttributes(stored.combatAttributes),
          evolutionState,
          archetypeKey: archetypeKey ?? null,
          reconnectTokenHash,
          skillState: clonePlayerSkillState(skillState),
          totalSessionDurationMs: stored.totalSessionDurationMs ?? 0,
          sessionCount: stored.sessionCount ?? 0
        };
        const player: PlayerInternal = {
          ...normalized,
          reconnectToken,
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
      if (needsLegacyHashMigration) {
        this.markPlayersDirty();
      }
    }

    this.connectedPlayers = this.recalculateConnectedPlayers();

    const storedWorld = await this.state.storage.get<StoredWorldState>(WORLD_KEY);
    if (storedWorld) {
      const { world: normalizedWorld, changed: worldChanged } = normalizeStoredWorldState(storedWorld);
      this.world = cloneWorldState(normalizedWorld);
      if (worldChanged) {
        await this.state.storage.put(WORLD_KEY, cloneWorldState(this.world));
      }
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
      this.progressionDirty = storedSnapshotState.progressionDirty ?? false;
      this.pendingSnapshotAlarm = storedSnapshotState.pendingSnapshotAlarm ?? null;
    } else {
      this.playersDirty = false;
      this.worldDirty = false;
      this.progressionDirty = false;
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
    if (this.playersDirty || this.worldDirty || this.progressionDirty) {
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
    this.organicRespawnQueue = [];
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
      this.microorganismBehavior.set(
        microorganism.id,
        this.createMicroorganismBehaviorState(now),
      );
    }
  }

  private createMicroorganismBehaviorState(now: number): MicroorganismBehaviorState {
    return {
      lastAttackAt: 0,
      movement: {
        targetPlayerId: null,
        retargetAfter: now,
        nextWaypoint: null,
        zigzagDirection: 1,
        lastZigToggleAt: now,
        baseHeadingAngle: null,
        fleeUntil: 0,
      },
    };
  }

  private getMicroorganismBehaviorState(
    microorganismId: string,
    now: number,
  ): MicroorganismBehaviorState {
    let behavior = this.microorganismBehavior.get(microorganismId);
    if (!behavior) {
      behavior = this.createMicroorganismBehaviorState(now);
      this.microorganismBehavior.set(microorganismId, behavior);
      return behavior;
    }
    if (!behavior.movement) {
      behavior.movement = {
        targetPlayerId: null,
        retargetAfter: now,
        nextWaypoint: null,
        zigzagDirection: 1,
        lastZigToggleAt: now,
        baseHeadingAngle: null,
        fleeUntil: 0,
      };
    }
    return behavior;
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
    const spawn = getSpawnPositionForPlayer(player.id, PLAYER_SPAWN_POSITIONS);
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
    const normalized: OrganicMatter = {
      ...matter,
      tags: sanitizeOrganicMatterTags(matter.tags, matter.nutrients),
    };
    const index = this.world.organicMatter.length;
    this.world.organicMatter.push(normalized);
    this.organicMatter.set(normalized.id, normalized);
    this.organicMatterOrder.set(normalized.id, index);
    this.addOrganicMatterToIndex(normalized);
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

  private createDamagePopupId(createdAt: number): string {
    this.damagePopupSequence += 1;
    return `dmg-${createdAt.toString(36)}-${this.damagePopupSequence.toString(36)}`.slice(0, 64);
  }

  private pushDamagePopup(
    worldDiff: SharedWorldStateDiff,
    popup: { id?: string; x: number; y: number; value: number; variant?: string; createdAt: number },
  ): void {
    const rawValue = Number.isFinite(popup.value) ? Math.round(popup.value) : 0;
    if (rawValue <= 0) {
      return;
    }

    const createdAt = Number.isFinite(popup.createdAt) ? popup.createdAt : Date.now();
    const idSource = typeof popup.id === "string" ? popup.id.trim() : "";
    const id = idSource.length > 0 ? idSource.slice(0, 64) : this.createDamagePopupId(createdAt);
    const normalizedVariant =
      typeof popup.variant === "string" && popup.variant.trim().length > 0
        ? popup.variant.trim().toLowerCase()
        : "normal";
    const position = {
      x: Number.isFinite(popup.x) ? popup.x : 0,
      y: Number.isFinite(popup.y) ? popup.y : 0,
    };

    const entry: SharedDamagePopup = {
      id,
      position,
      value: rawValue,
      variant: normalizedVariant,
      createdAt,
      expiresAt: createdAt + DAMAGE_POPUP_TTL_MS,
    };

    worldDiff.damagePopups = [...(worldDiff.damagePopups ?? []), entry];
  }

  private finalizeDamagePopups(
    worldDiff: SharedWorldStateDiff | undefined,
    now: number,
  ): void {
    if (!worldDiff?.damagePopups || worldDiff.damagePopups.length === 0) {
      if (worldDiff?.damagePopups) {
        delete worldDiff.damagePopups;
      }
      return;
    }

    const normalized: SharedDamagePopup[] = [];
    for (const popup of worldDiff.damagePopups) {
      if (!popup) {
        continue;
      }
      const createdAt = Number.isFinite(popup.createdAt) ? popup.createdAt : now;
      const expiresAtSource = Number.isFinite(popup.expiresAt)
        ? Math.max(popup.expiresAt, createdAt)
        : createdAt + DAMAGE_POPUP_TTL_MS;
      if (expiresAtSource <= now) {
        continue;
      }

      const positionSource = popup.position ?? { x: 0, y: 0 };
      const position = {
        x: Number.isFinite(positionSource.x) ? positionSource.x : 0,
        y: Number.isFinite(positionSource.y) ? positionSource.y : 0,
      };

      normalized.push({
        id: popup.id,
        position,
        value: Number.isFinite(popup.value) ? popup.value : 0,
        variant:
          typeof popup.variant === "string" && popup.variant.trim().length > 0
            ? popup.variant
            : "normal",
        createdAt,
        expiresAt: expiresAtSource,
      });
    }

    if (normalized.length === 0) {
      delete worldDiff.damagePopups;
      return;
    }

    normalized.sort((a, b) => a.createdAt - b.createdAt);
    if (normalized.length > MAX_DAMAGE_POPUPS_PER_TICK) {
      const startIndex = normalized.length - MAX_DAMAGE_POPUPS_PER_TICK;
      worldDiff.damagePopups = normalized.slice(startIndex);
    } else {
      worldDiff.damagePopups = normalized;
    }
  }

  private applyDamageToMicroorganism(
    player: PlayerInternal,
    microorganism: Microorganism,
    damage: number,
    now: number,
    worldDiff: SharedWorldStateDiff,
    combatLog: CombatLogEntry[],
    variantHint: string = "normal",
  ): { worldChanged: boolean; scoresChanged: boolean; defeated: boolean } {
    const appliedDamage = Math.max(0, Math.round(damage));
    if (appliedDamage <= 0) {
      return { worldChanged: false, scoresChanged: false, defeated: false };
    }

    const nextHealth = Math.max(0, microorganism.health.current - appliedDamage);
    const lethal = nextHealth === 0;
    const popupVariant =
      lethal && (!variantHint || variantHint === "normal") ? "critical" : variantHint ?? "normal";
    this.pushDamagePopup(worldDiff, {
      x: microorganism.position.x,
      y: microorganism.position.y,
      value: appliedDamage,
      variant: popupVariant,
      createdAt: now,
    });
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
        tags: sanitizeOrganicMatterTags(
          { nutrients: ["residue"], attributes: [] },
          { residue: microorganism.health.max },
        ),
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

  private tickPlayerDashState(player: PlayerInternal, deltaMs: number): boolean {
    let changed = false;
    let remainingMs = Math.max(0, deltaMs);

    if (player.dashCooldownMs > 0 && remainingMs > 0) {
      const consumed = Math.min(player.dashCooldownMs, remainingMs);
      const nextCooldown = player.dashCooldownMs - consumed;
      if (nextCooldown !== player.dashCooldownMs) {
        player.dashCooldownMs = nextCooldown;
        changed = true;
      }
      remainingMs -= consumed;
    }

    if (player.dashCooldownMs === 0 && player.dashCharge < MAX_DASH_CHARGE && remainingMs > 0) {
      const recharge = remainingMs * DASH_RECHARGE_PER_MS;
      if (recharge > 0) {
        const nextCharge = Math.min(MAX_DASH_CHARGE, player.dashCharge + recharge);
        if (nextCharge !== player.dashCharge) {
          player.dashCharge = nextCharge;
          changed = true;
        }
      }
    }

    return changed;
  }

  private canPlayerDash(player: PlayerInternal): boolean {
    return player.dashCharge >= DASH_CHARGE_COST && player.dashCooldownMs <= 0;
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

    const origin = { x: player.position.x, y: player.position.y };
    const angle = Number.isFinite(player.orientation.angle) ? player.orientation.angle : 0;
    const dashDistance = Math.max(60, Math.min(240, player.combatAttributes.speed * 0.5));
    const desiredDestination = this.clampPosition({
      x: origin.x + Math.cos(angle) * dashDistance,
      y: origin.y + Math.sin(angle) * dashDistance,
    });
    const { position: destination, collidedObstacle, collided } = this.computeDashDestination(
      origin,
      desiredDestination,
    );
    const deltaX = Math.abs(destination.x - origin.x);
    const deltaY = Math.abs(destination.y - origin.y);
    const moved = deltaX > 1e-3 || deltaY > 1e-3;
    const dashBlocked = collided && !moved;

    player.position = moved ? destination : origin;
    if (moved) {
      updatedPlayers.set(player.id, player);
      worldChanged = true;
    }

    if (dashBlocked && collidedObstacle) {
      combatLog.push({
        timestamp: now,
        attackerId: player.id,
        targetKind: "obstacle",
        targetObjectId: collidedObstacle.id,
        damage: 0,
        outcome: "blocked",
      });
    }

    if (dashBlocked) {
      player.combatStatus = createCombatStatusState({
        state: "cooldown",
        targetPlayerId: null,
        targetObjectId: null,
        lastAttackAt: now,
      });
      const nextCharge = Math.max(0, Math.min(MAX_DASH_CHARGE, player.dashCharge - DASH_CHARGE_COST));
      if (nextCharge !== player.dashCharge) {
        player.dashCharge = nextCharge;
      }
      const nextCooldown = Math.max(player.dashCooldownMs, DASH_COOLDOWN_MS);
      if (nextCooldown !== player.dashCooldownMs) {
        player.dashCooldownMs = nextCooldown;
      }
      updatedPlayers.set(player.id, player);
      return { worldChanged, scoresChanged };
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
        "critical",
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
    const nextCharge = Math.max(0, Math.min(MAX_DASH_CHARGE, player.dashCharge - DASH_CHARGE_COST));
    if (nextCharge !== player.dashCharge) {
      player.dashCharge = nextCharge;
    }
    const nextCooldown = Math.max(player.dashCooldownMs, DASH_COOLDOWN_MS);
    if (nextCooldown !== player.dashCooldownMs) {
      player.dashCooldownMs = nextCooldown;
    }
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
            "skill",
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
            "skill",
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
            "skill",
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
            "skill",
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

  private normalizeRngSeed(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 1;
    }

    const normalized = Math.floor(Math.abs(value)) >>> 0;
    if (normalized === 0) {
      return 1;
    }
    return normalized;
  }

  private advanceRngSeed(seed: number): number {
    const normalized = this.normalizeRngSeed(seed);
    const next = (normalized + 0x6d2b79f5) >>> 0;
    if (next === 0) {
      return 1;
    }
    return next;
  }

  private convertRandomToSeed(value: number): number {
    if (!Number.isFinite(value)) {
      return 1;
    }

    const clamped = Math.min(Math.max(value, 0), 0.9999999999999999);
    const scaled = Math.floor(clamped * 0x1_0000_0000) >>> 0;
    return this.normalizeRngSeed(scaled);
  }

  private generateRandomSeed(): number {
    const buffer = new Uint32Array(1);
    if (typeof crypto?.getRandomValues === "function") {
      crypto.getRandomValues(buffer);
    } else {
      buffer[0] = Math.floor(Math.random() * 0xffffffff);
    }
    return this.normalizeRngSeed(buffer[0]!);
  }

  private createPersistentRng<K extends keyof RngState>(
    key: K,
    initialSeed: number,
  ): () => number {
    const normalized = this.normalizeRngSeed(initialSeed);
    this.rngState[key] = normalized;
    let currentSeed = normalized;
    const rng = createMulberry32(normalized);
    return () => {
      const value = rng();
      currentSeed = this.advanceRngSeed(currentSeed);
      this.rngState[key] = currentSeed;
      this.queueRngStatePersist();
      return value;
    };
  }

  private initializeRngState(
    stored?: RngState | null,
  ): { restoredFromStorage: boolean; mutated: boolean; sanitizedKeys: string[] } {
    let restoredFromStorage = Boolean(stored);
    let mutated = false;
    const sanitizedKeys: string[] = [];

    const resolveSeed = (key: keyof RngState): number => {
      const storedValue = stored?.[key];
      if (!Number.isFinite(storedValue) || storedValue! <= 0) {
        restoredFromStorage = false;
        mutated = true;
        return this.normalizeRngSeed(this.generateRandomSeed());
      }

      const normalized = this.normalizeRngSeed(storedValue as number);
      if (normalized !== storedValue) {
        mutated = true;
        sanitizedKeys.push(key);
      }
      return normalized;
    };

    const organicSeed = resolveSeed("organicMatterRespawn");
    const progressionSeed = resolveSeed("progression");
    const microorganismSeed = resolveSeed("microorganismWaypoint");

    this.rngState = {
      organicMatterRespawn: organicSeed,
      progression: progressionSeed,
      microorganismWaypoint: microorganismSeed,
    };

    this.organicMatterRespawnRng = this.createPersistentRng(
      "organicMatterRespawn",
      organicSeed,
    );
    this.progressionRng = this.createPersistentRng("progression", progressionSeed);
    this.microorganismWaypointRng = this.createPersistentRng(
      "microorganismWaypoint",
      microorganismSeed,
    );

    return { restoredFromStorage, mutated, sanitizedKeys };
  }

  private queueRngStatePersist(): void {
    this.rngStatePersistPending = true;
    if (this.rngStatePersistTimeout !== null) {
      return;
    }

    this.rngStatePersistTimeout = setTimeout(() => {
      this.rngStatePersistTimeout = null;
      void this.flushQueuedRngStatePersist().catch((error) => {
        this.observability.logError("rng_state_persist_failed", error, {
          category: "persistence",
        });
      });
    }, RoomDO.RNG_STATE_PERSIST_DEBOUNCE_MS);
  }

  private async flushQueuedRngStatePersist(options: { force?: boolean } = {}): Promise<void> {
    const { force = false } = options;

    if (this.rngStatePersistTimeout !== null) {
      clearTimeout(this.rngStatePersistTimeout);
      this.rngStatePersistTimeout = null;
    }

    if (!force && !this.rngStatePersistPending) {
      if (this.rngStatePersistInFlight) {
        await this.rngStatePersistInFlight;
      }
      return;
    }

    this.rngStatePersistPending = false;

    if (this.rngStatePersistInFlight) {
      await this.rngStatePersistInFlight;
    }

    const persistPromise = this.persistRngState();
    this.rngStatePersistInFlight = persistPromise;
    try {
      await persistPromise;
    } finally {
      if (this.rngStatePersistInFlight === persistPromise) {
        this.rngStatePersistInFlight = null;
      }
    }
  }

  private createOrganicRespawnRng(): { seed: number; rng: () => number } {
    const base = this.organicMatterRespawnRng();
    const seed = this.convertRandomToSeed(base);
    return {
      seed,
      rng: this.organicGroupRngFactory(seed),
    };
  }

  private createProgressionRng(): { seed: number; rng: () => number } {
    const base = this.progressionRng();
    const seed = this.convertRandomToSeed(base);
    return {
      seed,
      rng: createMulberry32(seed),
    };
  }

  private findOrganicMatterRespawnPosition(
    origin: Vector2,
    attempts = 12,
    rng: () => number = this.organicMatterRespawnRng,
  ): Vector2 | null {
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
    void this.syncAlarms()
      .then(() => {
        if (!this.persistentAlarmsDirty) {
          this.alarmsDirty = false;
        }
      })
      .catch((error) => {
        this.observability.logError("alarm_sync_failed", error, {
          category: "persistence",
        });
      });
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

  private markProgressionDirty(): void {
    const wasDirty = this.progressionDirty;
    this.progressionDirty = true;
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
    let shouldPersistProgression = force || this.progressionDirty;

    if (!shouldPersistPlayers && !shouldPersistWorld && !shouldPersistProgression) {
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
    this.progressionDirty = false;
    this.pendingSnapshotAlarm = null;
    this.alarmSchedule.delete("snapshot");

    if (shouldPersistPlayers) {
      await this.persistPlayers();
      shouldPersistProgression = false;
    }

    if (shouldPersistWorld) {
      await this.persistWorld();
    }

    if (shouldPersistProgression) {
      await this.persistProgression();
    }

    await this.flushQueuedRngStatePersist({ force });
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

  private buildOrientationFromDirection(
    direction: Vector2,
    existing: OrientationState,
  ): OrientationState | null {
    const normalized = normalizeVectorOrNull(direction);
    if (!normalized) {
      return null;
    }
    const angle = Math.atan2(normalized.y, normalized.x);
    if (!Number.isFinite(angle)) {
      return null;
    }
    return existing.tilt === undefined
      ? { angle }
      : { angle, tilt: existing.tilt };
  }

  private generateMicroorganismWaypoint(origin: Vector2): Vector2 {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const angle = this.microorganismWaypointRng() * Math.PI * 2;
      const distance =
        MICRO_PATROL_RADIUS * (0.4 + this.microorganismWaypointRng() * 0.6);
      const candidate = this.clampPosition({
        x: origin.x + Math.cos(angle) * distance,
        y: origin.y + Math.sin(angle) * distance,
      });
      if (!this.isBlockedByObstacle(candidate)) {
        return candidate;
      }
    }
    return { ...origin };
  }

  private findClosestPlayer(
    position: Vector2,
    candidates: PlayerInternal[],
  ): PlayerInternal | null {
    let closest: { player: PlayerInternal; distanceSquared: number } | null = null;
    for (const player of candidates) {
      const distanceSquared = this.distanceSquared(player.position, position);
      if (!closest || distanceSquared < closest.distanceSquared) {
        closest = { player, distanceSquared };
      }
    }
    return closest?.player ?? null;
  }

  private isDirectionViable(origin: Vector2, direction: Vector2, sampleDistance: number): boolean {
    const steps = Math.max(1, Math.ceil(sampleDistance / 20));
    const originBlocked = this.isBlockedByObstacle(origin);
    let hasExitedBlockedRegion = !originBlocked;
    for (let step = 1; step <= steps; step += 1) {
      const distance = (sampleDistance / steps) * step;
      const candidate = {
        x: origin.x + direction.x * distance,
        y: origin.y + direction.y * distance,
      };
      const clamped = this.clampPosition(candidate);
      if (!this.positionsEqual(candidate, clamped)) {
        return false;
      }
      const blocked = this.isBlockedByObstacle(clamped);
      if (blocked && hasExitedBlockedRegion) {
        return false;
      }
      if (!blocked) {
        hasExitedBlockedRegion = true;
      }
    }
    return hasExitedBlockedRegion;
  }

  private computeSteeredDirection(origin: Vector2, desired: Vector2): Vector2 {
    const normalized = normalizeVectorOrNull(desired);
    if (!normalized) {
      return createVector();
    }

    if (this.isDirectionViable(origin, normalized, MICRO_STEERING_SAMPLE_DISTANCE)) {
      return normalized;
    }

    for (const angle of MICRO_STEERING_ANGLES) {
      for (const sign of [1, -1] as const) {
        const rotated = rotateVector(normalized, angle * sign);
        if (this.isDirectionViable(origin, rotated, MICRO_STEERING_SAMPLE_DISTANCE)) {
          return rotated;
        }
      }
    }

    return createVector();
  }

  private resolveMicroorganismTarget(
    microorganism: Microorganism,
    behavior: MicroorganismBehaviorState,
    now: number,
  ): PlayerInternal | null {
    const { movement } = behavior;
    let target: PlayerInternal | null = null;
    if (movement.targetPlayerId) {
      const candidate = this.players.get(movement.targetPlayerId) ?? null;
      if (
        candidate &&
        candidate.connected &&
        candidate.health.current > 0 &&
        !candidate.pendingRemoval &&
        !this.playersPendingRemoval.has(candidate.id)
      ) {
        target = candidate;
      } else {
        movement.targetPlayerId = null;
      }
    }

    if (!target || now >= movement.retargetAfter) {
      const candidates = this.getMicroorganismTargetCandidates();
      if (candidates.length === 0) {
        movement.targetPlayerId = null;
        movement.retargetAfter = now + MICRO_RETARGET_COOLDOWN_MS;
        return null;
      }
      const closest = this.findClosestPlayer(microorganism.position, candidates);
      if (!closest) {
        movement.targetPlayerId = null;
        movement.retargetAfter = now + MICRO_RETARGET_COOLDOWN_MS;
        return null;
      }
      movement.targetPlayerId = closest.id;
      movement.retargetAfter = now + MICRO_RETARGET_COOLDOWN_MS;
      target = closest;
    }

    return target;
  }

  private computeMicroorganismIntent(
    microorganism: Microorganism,
    behavior: MicroorganismBehaviorState,
    now: number,
  ): { movementVector: Vector2; orientation: OrientationState | null } {
    const { movement } = behavior;
    const healthRatio = microorganism.health.max > 0
      ? microorganism.health.current / microorganism.health.max
      : 0;

    if (healthRatio <= MICRO_LOW_HEALTH_THRESHOLD) {
      movement.fleeUntil = Math.max(movement.fleeUntil, now + MICRO_FLEE_DURATION_MS);
    } else if (movement.fleeUntil < now) {
      movement.fleeUntil = 0;
    }

    if (movement.fleeUntil > now) {
      const candidates = this.getMicroorganismTargetCandidates();
      const closest = this.findClosestPlayer(microorganism.position, candidates);
      if (!closest) {
        return { movementVector: createVector(), orientation: null };
      }
      const fleeDirection = {
        x: microorganism.position.x - closest.position.x,
        y: microorganism.position.y - closest.position.y,
      };
      const movementVector = this.computeSteeredDirection(microorganism.position, fleeDirection);
      const orientation = this.buildOrientationFromDirection(movementVector, microorganism.orientation);
      movement.targetPlayerId = null;
      return { movementVector, orientation };
    }

    if (microorganism.aggression === "hostile") {
      const target = this.resolveMicroorganismTarget(microorganism, behavior, now);
      if (!target) {
        return { movementVector: createVector(), orientation: null };
      }
      const pursuit = {
        x: target.position.x - microorganism.position.x,
        y: target.position.y - microorganism.position.y,
      };
      const movementVector = this.computeSteeredDirection(microorganism.position, pursuit);
      const orientation = this.buildOrientationFromDirection(movementVector, microorganism.orientation);
      return { movementVector, orientation };
    }

    if (
      !movement.nextWaypoint ||
      now >= movement.retargetAfter ||
      this.distanceSquared(microorganism.position, movement.nextWaypoint) <=
        MICRO_WAYPOINT_REACH_DISTANCE ** 2
    ) {
      movement.nextWaypoint = this.generateMicroorganismWaypoint(microorganism.position);
      movement.retargetAfter = now + MICRO_WAYPOINT_REFRESH_MS;
      if (movement.nextWaypoint) {
        movement.baseHeadingAngle = Math.atan2(
          movement.nextWaypoint.y - microorganism.position.y,
          movement.nextWaypoint.x - microorganism.position.x,
        );
      } else {
        movement.baseHeadingAngle = null;
      }
    }

    if (now - movement.lastZigToggleAt >= MICRO_ZIG_INTERVAL_MS) {
      movement.zigzagDirection = movement.zigzagDirection === 1 ? -1 : 1;
      movement.lastZigToggleAt = now;
    }

    if (!movement.nextWaypoint) {
      return { movementVector: createVector(), orientation: null };
    }

    let patrolDirection = {
      x: movement.nextWaypoint.x - microorganism.position.x,
      y: movement.nextWaypoint.y - microorganism.position.y,
    };

    if (movement.baseHeadingAngle !== null) {
      patrolDirection = rotateVector(
        normalizeVectorOrNull(patrolDirection) ?? createVector(),
        movement.zigzagDirection * MICRO_ZIG_ANGLE_RADIANS,
      );
    }

    const movementVector = this.computeSteeredDirection(microorganism.position, patrolDirection);

    if (vectorsApproximatelyEqual(movementVector, createVector())) {
      movement.nextWaypoint = this.generateMicroorganismWaypoint(microorganism.position);
    }

    const orientation = this.buildOrientationFromDirection(movementVector, microorganism.orientation);
    movement.targetPlayerId = null;
    return { movementVector, orientation };
  }

  private isBlockedByObstacle(position: Vector2): boolean {
    return this.findBlockingObstacle(position) !== null;
  }

  private findBlockingObstacle(position: Vector2): Obstacle | null {
    for (const obstacle of this.obstacles.values()) {
      const halfWidth = obstacle.size.x / 2 + OBSTACLE_PADDING;
      const halfHeight = obstacle.size.y / 2 + OBSTACLE_PADDING;
      if (
        Math.abs(position.x - obstacle.position.x) <= halfWidth &&
        Math.abs(position.y - obstacle.position.y) <= halfHeight
      ) {
        return obstacle;
      }
    }
    return null;
  }

  private computeDashDestination(
    origin: Vector2,
    desiredDestination: Vector2,
  ): { position: Vector2; collidedObstacle: Obstacle | null; collided: boolean } {
    if (this.positionsEqual(origin, desiredDestination)) {
      const blocking = this.findBlockingObstacle(origin);
      return { position: { ...origin }, collidedObstacle: blocking, collided: blocking !== null };
    }

    const direction = {
      x: desiredDestination.x - origin.x,
      y: desiredDestination.y - origin.y,
    };
    const totalDistance = Math.sqrt(direction.x ** 2 + direction.y ** 2);
    if (!Number.isFinite(totalDistance) || totalDistance === 0) {
      const blocking = this.findBlockingObstacle(origin);
      return { position: { ...origin }, collidedObstacle: blocking, collided: blocking !== null };
    }

    const stepSize = 1;
    const steps = Math.max(1, Math.ceil(totalDistance / stepSize));
    const normalizedX = direction.x / totalDistance;
    const normalizedY = direction.y / totalDistance;

    let lastSafe: Vector2 | null = this.isBlockedByObstacle(origin) ? null : { ...origin };
    let blockedPoint: Vector2 | null = null;
    let collidedObstacle: Obstacle | null = null;
    let encounteredCollision = false;
    const startingObstacle = this.findBlockingObstacle(origin);

    for (let i = 1; i <= steps; i += 1) {
      const distanceAlong = Math.min(i * stepSize, totalDistance);
      const candidate = {
        x: origin.x + normalizedX * distanceAlong,
        y: origin.y + normalizedY * distanceAlong,
      };

      const blocked = this.isBlockedByObstacle(candidate);
      if (!blocked) {
        lastSafe = { ...candidate };
        continue;
      }

      const obstacle = this.findBlockingObstacle(candidate);
      if (lastSafe === null) {
        collidedObstacle = obstacle ?? collidedObstacle;
        continue;
      }

      encounteredCollision = true;
      blockedPoint = candidate;
      collidedObstacle = obstacle ?? collidedObstacle;
      break;
    }

    if (!encounteredCollision) {
      if (lastSafe) {
        return { position: { ...desiredDestination }, collidedObstacle: null, collided: false };
      }
      const blocking = startingObstacle ?? collidedObstacle;
      return { position: { ...origin }, collidedObstacle: blocking ?? null, collided: blocking !== null };
    }

    if (!lastSafe) {
      const blocking = startingObstacle ?? collidedObstacle;
      return { position: { ...origin }, collidedObstacle: blocking ?? null, collided: blocking !== null };
    }

    const startedAtSafeOrigin =
      Math.abs(lastSafe.x - origin.x) <= 1e-3 && Math.abs(lastSafe.y - origin.y) <= 1e-3;

    if (startedAtSafeOrigin) {
      return { position: { ...origin }, collidedObstacle: collidedObstacle ?? null, collided: true };
    }

    let low = lastSafe;
    let high = blockedPoint ?? lastSafe;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const mid = {
        x: (low.x + high.x) / 2,
        y: (low.y + high.y) / 2,
      };
      if (this.isBlockedByObstacle(mid)) {
        high = mid;
      } else {
        low = mid;
      }
    }

    if (this.isBlockedByObstacle(low)) {
      const blocking = startingObstacle ?? collidedObstacle;
      return { position: { ...origin }, collidedObstacle: blocking ?? null, collided: blocking !== null };
    }

    const deltaX = Math.abs(low.x - origin.x);
    const deltaY = Math.abs(low.y - origin.y);
    if (deltaX <= 1e-3 && deltaY <= 1e-3) {
      return { position: { ...origin }, collidedObstacle: collidedObstacle ?? null, collided: true };
    }

    return { position: { ...low }, collidedObstacle: collidedObstacle ?? null, collided: true };
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

  private moveMicroorganismDuringTick(microorganism: Microorganism, deltaMs: number): boolean {
    const movement = microorganism.movementVector;
    const magnitude = vectorMagnitude(movement);
    if (!Number.isFinite(magnitude) || magnitude === 0) {
      return false;
    }

    const speed = Math.max(0, microorganism.attributes.speed ?? 30);
    if (speed <= 0) {
      return false;
    }

    const normalized = { x: movement.x / magnitude, y: movement.y / magnitude };
    const distance = (speed * deltaMs) / 1000;
    const candidate = this.clampPosition({
      x: microorganism.position.x + normalized.x * distance,
      y: microorganism.position.y + normalized.y * distance,
    });

    if (this.positionsEqual(candidate, microorganism.position)) {
      return false;
    }

    if (this.isBlockedByObstacle(candidate)) {
      return false;
    }

    microorganism.position = candidate;
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

    const removedIds = collectedEntries.map((entry) => entry.id);
    worldDiff.removeOrganicMatterIds = [
      ...(worldDiff.removeOrganicMatterIds ?? []),
      ...removedIds,
    ];

    const pendingRespawnGroups: PendingOrganicRespawnGroup[] = [];
    let index = 0;
    while (index < collectedEntries.length) {
      const { seed: groupSeed, rng: groupRng } = this.createOrganicRespawnRng();
      const remaining = collectedEntries.length - index;
      const baseSize = Math.min(remaining, Math.floor(groupRng() * 3) + 3);
      const clusterSize = Math.max(1, baseSize);
      const anchor = this.findOrganicMatterRespawnPosition(player.position, 18, groupRng);
      if (!anchor) {
        break;
      }

      const patternIndex = Math.floor(groupRng() * ORGANIC_CLUSTER_PATTERNS.length);
      const clusterShape =
        ORGANIC_CLUSTER_PATTERNS[patternIndex] ?? ORGANIC_CLUSTER_PATTERNS[0];
      const templates: PendingOrganicRespawnTemplate[] = [];

      for (let clusterIndex = 0; clusterIndex < clusterSize; clusterIndex += 1) {
        const entry = collectedEntries[index + clusterIndex];
        if (!entry) {
          break;
        }

        templates.push({
          quantity: Math.max(1, Math.round(entry.matter.quantity)),
          nutrients: { ...entry.matter.nutrients },
          tags: sanitizeOrganicMatterTags(entry.matter.tags, entry.matter.nutrients),
        });
      }

      if (templates.length === 0) {
        break;
      }

      const delayRangeMs = ORGANIC_RESPAWN_DELAY_RANGE_MS;
      const delayVariance = Math.max(0, delayRangeMs.max - delayRangeMs.min);
      const delay = delayRangeMs.min + groupRng() * delayVariance;

      pendingRespawnGroups.push({
        anchor,
        clusterShape,
        size: templates.length,
        templates,
        delayRangeMs,
        respawnAt: now + Math.max(delay, delayRangeMs.min),
        randomSeed: groupSeed,
      });

      index += templates.length;
    }

    const usesDefaultRespawnFinder =
      this.findOrganicMatterRespawnPosition ===
      RoomDO.prototype.findOrganicMatterRespawnPosition;

    if (usesDefaultRespawnFinder && pendingRespawnGroups.length < collectedEntries.length) {
      const placeholdersNeeded = collectedEntries.length - pendingRespawnGroups.length;
      for (let placeholderIndex = 0; placeholderIndex < placeholdersNeeded; placeholderIndex += 1) {
        pendingRespawnGroups.push({
          anchor: cloneVector(player.position),
          clusterShape: [],
          size: 0,
          templates: [],
          delayRangeMs: ORGANIC_RESPAWN_DELAY_RANGE_MS,
          respawnAt: now,
          randomSeed: 0,
        });
      }
    }

    if (pendingRespawnGroups.length > 0) {
      this.organicRespawnQueue.push(...pendingRespawnGroups);
    }

    let totalScore = 0;
    for (const { matter } of collectedEntries) {
      const rawAwarded = Math.max(1, Math.round(matter.quantity));
      const scaledAwarded = Math.max(
        0,
        Math.round(rawAwarded * ORGANIC_COLLECTION_SCORE_MULTIPLIER)
      );
      const awarded = rawAwarded > 0 ? Math.max(1, scaledAwarded) : 0;
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

    if (collectedEntries.length > 0) {
      const rawEnergyGain = collectedEntries.reduce((total, { matter }) => {
        const base = Number.isFinite(matter.quantity) ? Math.round(matter.quantity) : 0;
        const nutrientBonus = Object.values(matter.nutrients ?? {}).reduce((sum, value) => {
          if (!Number.isFinite(value)) {
            return sum;
          }
          return sum + Math.max(0, Math.round(value));
        }, 0);
        return total + Math.max(0, base) + Math.max(0, nutrientBonus);
      }, 0);
      const energyGain = Math.max(
        0,
        Math.round(rawEnergyGain * ORGANIC_COLLECTION_ENERGY_MULTIPLIER)
      );

      if (energyGain > 0) {
        player.energy = Math.max(0, player.energy + energyGain);
      }

      const baseXpGain = Math.round(totalScore / 2);
      const xpGain = Math.max(
        0,
        Math.round(baseXpGain * ORGANIC_COLLECTION_XP_MULTIPLIER)
      );
      if (xpGain > 0) {
        player.xp = Math.max(0, player.xp + xpGain);
      }

      const baseMgGain = Math.round(totalScore / 4);
      const mgGain = Math.max(
        0,
        Math.round(baseMgGain * ORGANIC_COLLECTION_MG_MULTIPLIER)
      );
      if (mgGain > 0) {
        player.geneticMaterial = Math.max(0, player.geneticMaterial + mgGain);
      }
    }

    return {
      playerUpdated: true,
      worldChanged: true,
      scoresChanged: totalScore > 0,
    };
  }

  private processOrganicRespawnQueue(now: number, worldDiff: SharedWorldStateDiff): void {
    if (this.organicRespawnQueue.length === 0) {
      return;
    }

    const ready: PendingOrganicRespawnGroup[] = [];
    const pending: PendingOrganicRespawnGroup[] = [];
    for (const entry of this.organicRespawnQueue) {
      if (entry.respawnAt <= now) {
        ready.push(entry);
      } else {
        pending.push(entry);
      }
    }
    this.organicRespawnQueue = pending;

    if (ready.length === 0) {
      return;
    }

    const generatedIds = new Set<string>();
    for (const group of ready) {
      const pattern = group.clusterShape;
      const spawnCount = Math.min(group.size, group.templates.length);
      for (let index = 0; index < spawnCount; index += 1) {
        const template = group.templates[index];
        if (!template) {
          continue;
        }

        const shape = pattern[index % pattern.length] ?? {
          offset: { x: 0, y: 0 },
          quantityFactor: 1,
        };
        let spawnPosition = this.clampPosition({
          x: group.anchor.x + shape.offset.x,
          y: group.anchor.y + shape.offset.y,
        });

        if (this.isBlockedByObstacle(spawnPosition)) {
          const fallback = this.findOrganicMatterRespawnPosition(spawnPosition, 12);
          if (fallback) {
            spawnPosition = fallback;
          } else {
            spawnPosition = this.clampPosition(spawnPosition);
          }
        }

        const id = this.createEntityId(
          "organic",
          (candidate) => this.organicMatter.has(candidate) || generatedIds.has(candidate),
        );
        generatedIds.add(id);

        const quantity = Math.max(
          1,
          Math.round(template.quantity * (shape.quantityFactor ?? 1)),
        );

        const matter: OrganicMatter = {
          id,
          kind: "organic_matter",
          position: spawnPosition,
          quantity,
          nutrients: { ...template.nutrients },
          tags: sanitizeOrganicMatterTags(template.tags, template.nutrients),
        };

        this.addOrganicMatterEntity(matter);
        worldDiff.upsertOrganicMatter = [
          ...(worldDiff.upsertOrganicMatter ?? []),
          cloneOrganicMatter(matter),
        ];
      }
    }
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

    return computeCombatAttributesWithModifiers(base, modifiers);
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
      if (!this.canPlayerDash(player)) {
        player.combatStatus = createCombatStatusState({
          state: "cooldown",
          targetPlayerId: null,
          targetObjectId: null,
          lastAttackAt: now,
        });
        const nextCooldown = Math.max(player.dashCooldownMs, DASH_COOLDOWN_MS);
        if (nextCooldown !== player.dashCooldownMs) {
          player.dashCooldownMs = nextCooldown;
        }
        updatedPlayers.set(player.id, player);
        return this.finalizeAttackResolution({ worldChanged, scoresChanged }, worldDiff);
      }
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
      if (appliedDamage > 0) {
        const damageVariant =
          nextHealth === 0 ? "critical" : player.combo > 1 ? "advantage" : "normal";
        this.pushDamagePopup(worldDiff, {
          x: target.position.x,
          y: target.position.y,
          value: appliedDamage,
          variant: damageVariant,
          createdAt: now,
        });
      }
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
      const variantHint = player.combo > 1 ? "advantage" : "normal";
      const result = this.applyDamageToMicroorganism(
        player,
        microorganism,
        damage,
        now,
        worldDiff,
        combatLog,
        variantHint,
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
      const behavior = this.getMicroorganismBehaviorState(microorganism.id, now);
      const statusCollection = this.microorganismStatusEffects.get(microorganism.id);
      if (statusCollection) {
        const pruned = pruneExpiredStatusEffects(statusCollection, now);
        if (pruned.length > 0) {
          this.microorganismStatusEffects.set(microorganism.id, pruned);
        } else {
          this.microorganismStatusEffects.delete(microorganism.id);
        }
      }

      const intent = this.computeMicroorganismIntent(microorganism, behavior, now);

      let microorganismDiffNeeded = false;

      if (!vectorsApproximatelyEqual(microorganism.movementVector, intent.movementVector)) {
        microorganism.movementVector = createVector(intent.movementVector);
        microorganismDiffNeeded = true;
      }

      if (intent.orientation) {
        const nextOrientation = createOrientation(intent.orientation);
        if (!orientationsApproximatelyEqual(microorganism.orientation, nextOrientation)) {
          microorganism.orientation = nextOrientation;
          microorganismDiffNeeded = true;
        }
      }

      if (this.moveMicroorganismDuringTick(microorganism, deltaMs)) {
        microorganismDiffNeeded = true;
      }

      if (microorganismDiffNeeded) {
        worldDiff.upsertMicroorganisms = [
          ...(worldDiff.upsertMicroorganisms ?? []),
          cloneMicroorganism(microorganism),
        ];
        worldChanged = true;
      }

      if (microorganism.aggression !== "hostile") {
        continue;
      }

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

      const attackRange = Math.max(
        0,
        PLAYER_COLLISION_RADIUS + MICRO_COLLISION_RADIUS + CONTACT_BUFFER,
      );
      const attackRangeSquared = attackRange * attackRange;
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
      if (damage > 0) {
        const variant =
          nextHealth === 0 ? "critical" : damage < baseDamage ? "resisted" : "normal";
        this.pushDamagePopup(worldDiff, {
          x: closest.player.position.x,
          y: closest.player.position.y,
          value: damage,
          variant,
          createdAt: now,
        });
        const nextInvulnerableUntil = Math.max(
          closest.player.invulnerableUntil ?? 0,
          now + MICRO_CONTACT_INVULNERABILITY_MS,
        );
        closest.player.invulnerableUntil = nextInvulnerableUntil;
      }
      updatedPlayers.set(closest.player.id, closest.player);
      behavior.lastAttackAt = now;

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
    this.setPlayerConnectionState(player, false);
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

  private cancelPendingPlayerRemoval(player: PlayerInternal): WebSocket[] {
    const sockets: WebSocket[] = [];

    player.pendingRemoval = false;
    this.playersPendingRemoval.delete(player.id);

    for (let index = this.pendingPlayerDeaths.length - 1; index >= 0; index--) {
      const pending = this.pendingPlayerDeaths[index];
      if (pending.playerId !== player.id) {
        continue;
      }
      this.pendingPlayerDeaths.splice(index, 1);
      if (pending.socket) {
        sockets.push(pending.socket);
      }
    }

    return sockets;
  }

  private async setupSession(socket: WebSocket): Promise<void> {
    let playerId: string | null = null;
    let joinPromise: Promise<string | null> | null = null;
    const queuedMessages: ClientMessage[] = [];

    const flushQueuedMessages = (): void => {
      if (!playerId || queuedMessages.length === 0) {
        return;
      }
      const pending = queuedMessages.splice(0);
      for (const message of pending) {
        processClientMessage(message);
      }
    };

    const processClientMessage = (parsed: ClientMessage): void => {
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
        case "join": {
          const pendingJoin = this.handleJoin(socket, parsed)
            .then((result) => {
              if (result) {
                playerId = result;
                flushQueuedMessages();
              }
              return result;
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
            })
            .finally(() => {
              if (joinPromise === pendingJoin) {
                joinPromise = null;
              }
            });
          joinPromise = pendingJoin;
          break;
        }
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
    };

    const queueOrProcessClientMessage = (parsed: ClientMessage): void => {
      if (joinPromise && playerId === null && parsed.type !== "join") {
        queuedMessages.push(parsed);
        return;
      }
      processClientMessage(parsed);
    };

    this.activeSockets.add(socket);
    this.startHandshakeTimeout(socket);

    socket.addEventListener("message", (event) => {
      void (async () => {
        const rawData = event.data;

        const rejectOversizedPayload = (bytes: number): void => {
          this.observability.log("warn", "client_payload_invalid", {
            stage: "size",
            bytes,
            category: "protocol_error"
          });
          this.observability.recordMetric("protocol_errors", 1, {
            type: "payload_too_large",
            bytes,
          });
          this.send(socket, { type: "error", reason: "invalid_payload" });
          socket.close(1009, "invalid_payload");
        };

        let data: string;
        let payloadByteLength: number;
        try {
          if (typeof rawData === "string") {
            data = rawData;
            payloadByteLength = TEXT_ENCODER.encode(rawData).byteLength;
          } else if (rawData instanceof ArrayBuffer) {
            payloadByteLength = rawData.byteLength;
            if (payloadByteLength > MAX_CLIENT_MESSAGE_SIZE_BYTES) {
              rejectOversizedPayload(payloadByteLength);
              return;
            }
            data = TEXT_DECODER.decode(rawData);
          } else if (typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(rawData)) {
            const view = rawData as ArrayBufferView;
            payloadByteLength = view.byteLength;
            if (payloadByteLength > MAX_CLIENT_MESSAGE_SIZE_BYTES) {
              rejectOversizedPayload(payloadByteLength);
              return;
            }
            data = TEXT_DECODER.decode(view);
          } else if (typeof Blob !== "undefined" && rawData instanceof Blob) {
            payloadByteLength = rawData.size;
            if (payloadByteLength > MAX_CLIENT_MESSAGE_SIZE_BYTES) {
              rejectOversizedPayload(payloadByteLength);
              return;
            }
            const arrayBuffer = await rawData.arrayBuffer();
            data = TEXT_DECODER.decode(arrayBuffer);
          } else {
            data = String(rawData);
            payloadByteLength = TEXT_ENCODER.encode(data).byteLength;
          }
        } catch (error) {
          this.observability.log("warn", "client_payload_invalid", {
            stage: "decode",
            error: serializeError(error),
            category: "protocol_error"
          });
          this.observability.recordMetric("protocol_errors", 1, {
            type: "invalid_text"
          });
          this.send(socket, { type: "error", reason: "invalid_payload" });
          socket.close(1003, "invalid_payload");
          return;
        }

        if (payloadByteLength > MAX_CLIENT_MESSAGE_SIZE_BYTES) {
          rejectOversizedPayload(payloadByteLength);
          return;
        }

        const now = Date.now();

        const perConnectionLimiter = this.getConnectionLimiter(socket);
        const perConnectionLimit = this.config.maxMessagesPerConnection;
        if (!perConnectionLimiter.consume(now, perConnectionLimit)) {
          const retryAfter = perConnectionLimiter.getRetryAfterMs(now, perConnectionLimit);
          const knownPlayerId = playerId ?? this.clientsBySocket.get(socket) ?? null;
          this.handleRateLimit(socket, "connection", retryAfter, knownPlayerId, {
            limit: perConnectionLimit,
            activeConnections: this.activeSockets.size,
          });
          return;
        }

        this.maybeRecordRateLimitUtilization(
          socket,
          perConnectionLimiter,
          now,
          perConnectionLimit
        );

        const globalLimit = this.getDynamicGlobalLimit();
        if (!this.globalRateLimiter.consume(now, globalLimit)) {
          const retryAfter = this.globalRateLimiter.getRetryAfterMs(now, globalLimit);
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
            const hasNameValidationError = validation.error.issues.some(
              (issue) =>
                issue.path.length > 0 &&
                issue.path[0] === "name" &&
                NAME_VALIDATION_ERROR_MESSAGES.has(issue.message ?? ""),
            );
            const reason = hasNameValidationError ? "invalid_name" : "invalid_payload";
            this.send(socket, { type: "error", reason });
            socket.close(1008, reason);
          } else {
            this.send(socket, { type: "error", reason: "invalid_payload" });
            socket.close(1003, "invalid_payload");
          }
          return;
        }

        const parsed = validation.data;
        queueOrProcessClientMessage(parsed);
      })().catch((error) => {
        this.observability.logError("client_message_handler_failed", error, {
          category: "protocol_error",
        });
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) {
          try {
            socket.close(1011, "error");
          } catch (closeError) {
            this.observability.logError("client_message_handler_close_failed", closeError, {
              category: "protocol_error",
            });
          }
        }
      });
    });

    socket.addEventListener("close", () => {
      this.clearHandshakeTimeout(socket);
      const disconnectPlayerId = playerId ?? this.clientsBySocket.get(socket) ?? null;
      if (disconnectPlayerId) {
        void this.handleDisconnect(socket, disconnectPlayerId).catch((error) => {
          this.observability.logError("player_disconnect_failed", error, {
            playerId: disconnectPlayerId
          });
        });
      }
      queuedMessages.length = 0;
      this.clientsBySocket.delete(socket);
      this.activeSockets.delete(socket);
    });

    socket.addEventListener("error", () => {
      this.clearHandshakeTimeout(socket);
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) {
        socket.close(1011, "error");
      }
    });
  }

  private async handleJoin(socket: WebSocket, message: JoinMessage): Promise<string | null> {
    const validation = joinMessageSchema.safeParse(message);
    if (!validation.success) {
      const hasNameValidationError = validation.error.issues.some(
        (issue) =>
          issue.path.length > 0 &&
          issue.path[0] === "name" &&
          NAME_VALIDATION_ERROR_MESSAGES.has(issue.message ?? ""),
      );
      const reason = hasNameValidationError ? "invalid_name" : "invalid_payload";
      this.send(socket, { type: "error", reason });
      socket.close(1008, reason);
      return null;
    }

    const payload = validation.data;
    const providedReconnectToken = sanitizeReconnectToken(payload.reconnectToken);
    const providedReconnectTokenHash = providedReconnectToken
      ? await hashReconnectToken(providedReconnectToken)
      : null;
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
        if (
          !providedReconnectTokenHash ||
          providedReconnectTokenHash !== candidate.reconnectTokenHash
        ) {
          this.send(socket, { type: "error", reason: "invalid_token" });
          socket.close(1008, "invalid_token");
          return null;
        }
        player = candidate;
      }
    }
    let expiredPlayerRemoved = false;
    if (player && now - player.lastSeenAt > this.config.reconnectWindowMs) {
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
        const withinReconnectWindow =
          now - existing.lastSeenAt <= this.config.reconnectWindowMs;
        const tokenMatches = providedReconnectTokenHash === existing.reconnectTokenHash;
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

    const pendingSockets = player ? this.cancelPendingPlayerRemoval(player) : [];
    const previousSocket = player ? this.socketsByPlayer.get(player.id) : undefined;

    let rankingShouldUpdate = false;
    let playerWasCreated = false;

    if (!player && this.getConnectedPlayersCount() >= this.config.maxPlayers) {
      this.send(socket, { type: "error", reason: "room_full" });
      socket.close(1008, "room_full");
      return null;
    }

    if (!player) {
      const id = crypto.randomUUID();
      const spawnPosition = this.clampPosition(
        getSpawnPositionForPlayer(id, PLAYER_SPAWN_POSITIONS),
      );
      const evolutionState = createEvolutionState();
      const skillState = createPlayerSkillState();
      const reconnectToken = generateReconnectToken();
      const reconnectTokenHash = await hashReconnectToken(reconnectToken);
      player = {
        id,
        name: normalizedName,
        score: 0,
        combo: 1,
        energy: DEFAULT_PLAYER_ENERGY,
        xp: DEFAULT_PLAYER_XP,
        geneticMaterial: DEFAULT_PLAYER_GENETIC_MATERIAL,
        geneFragments: createGeneCounter(),
        stableGenes: createGeneCounter(),
        dashCharge: DEFAULT_DASH_CHARGE,
        dashCooldownMs: 0,
        characteristicPoints: createCharacteristicPointsState(),
        position: createVector(spawnPosition),
        movementVector: createVector(),
        orientation: createOrientation(),
        health: createHealthState(),
        combatStatus: createCombatStatusState(),
        combatAttributes: getDeterministicCombatAttributesForPlayer(id),
        evolutionState,
        archetypeKey: null,
        reconnectToken,
        reconnectTokenHash,
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
      this.adjustConnectedPlayers(1);
      rankingShouldUpdate = true;
      playerWasCreated = true;
    } else {
      for (const pendingSocket of pendingSockets) {
        this.discardSocket(pendingSocket, 1000, "reconnected", "discard_pending_socket_failed");
      }
      if (pendingSockets.length > 0) {
        this.socketsByPlayer.delete(player.id);
      }
      const previousName = player.name;
      const previousKey = player.name.toLowerCase();
      const previousLastSeenAt = player.lastSeenAt ?? now;
      if (previousKey !== nameKey && this.nameToPlayerId.get(previousKey) === player.id) {
        this.nameToPlayerId.delete(previousKey);
      }
      const offlineDuration = Math.max(0, now - (player.lastSeenAt ?? now));
      player.name = normalizedName;
      this.setPlayerConnectionState(player, true);
      player.lastSeenAt = now;
      player.lastActiveAt = now;
      player.connectedAt = now;
      const statusCollection = this.ensurePlayerStatusEffects(player);
      player.statusEffects = pruneExpiredStatusEffects(statusCollection, now);
      if (player.invulnerableUntil && player.invulnerableUntil <= now) {
        player.invulnerableUntil = null;
      }
      if (offlineDuration > 0) {
        this.tickPlayerSkillCooldowns(player, offlineDuration);
      }
      const combatStatus = player.combatStatus;
      if (combatStatus.lastAttackAt !== null) {
        const clampedLastAttackAt = Math.min(combatStatus.lastAttackAt, now);
        const remainingCooldown = Math.max(
          0,
          PLAYER_ATTACK_COOLDOWN_MS - (now - clampedLastAttackAt),
        );
        if (remainingCooldown === 0 && combatStatus.state === "cooldown") {
          player.combatStatus = createCombatStatusState({ state: "idle" });
        } else if (clampedLastAttackAt !== combatStatus.lastAttackAt) {
          player.combatStatus = createCombatStatusState({
            state: combatStatus.state,
            targetPlayerId: combatStatus.targetPlayerId ?? null,
            targetObjectId: combatStatus.targetObjectId ?? null,
            lastAttackAt: clampedLastAttackAt,
          });
        }
      }
      player.evolutionState = createEvolutionState(player.evolutionState);
      player.pendingAttack = null;
      this.playersPendingRemoval.delete(player.id);
      if (player.invulnerableUntil) {
        if (player.invulnerableUntil <= now) {
          player.invulnerableUntil = null;
        } else {
          const offlineDuration = Math.max(0, now - previousLastSeenAt);
          if (offlineDuration > 0) {
            const adjustedInvulnerability = player.invulnerableUntil - offlineDuration;
            player.invulnerableUntil = adjustedInvulnerability <= now ? null : adjustedInvulnerability;
          }
        }
      }
      this.updatePlayerCombatAttributes(player);
      this.players.set(player.id, player);
      this.nameToPlayerId.set(nameKey, player.id);
      if (previousName !== normalizedName) {
        rankingShouldUpdate = true;
      }
    }

    this.ensureProgressionState(player.id);

    if (socket.readyState !== WebSocket.OPEN) {
      if (playerWasCreated) {
        this.players.delete(player.id);
        if (this.nameToPlayerId.get(nameKey) === player.id) {
          this.nameToPlayerId.delete(nameKey);
        }
        this.adjustConnectedPlayers(-1);
        const removedProgression = this.progressionState.delete(player.id);
        const removedPendingProgression = this.pendingProgression.delete(player.id);
        if (removedProgression || removedPendingProgression) {
          this.markProgressionDirty();
        }
      }
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

    const previousReconnectToken = player.reconnectToken;
    const previousReconnectTokenHash = player.reconnectTokenHash;
    const reconnectToken = generateReconnectToken();
    const reconnectTokenHash = await hashReconnectToken(reconnectToken);
    player.reconnectToken = reconnectToken;
    player.reconnectTokenHash = reconnectTokenHash;

    this.markPlayersDirty();

    const hadPendingSnapshot = this.pendingSnapshotAlarm;
    const previousPlayersDirty = this.playersDirty;
    const previousWorldDirty = this.worldDirty;
    const previousSnapshotSchedule = this.alarmSchedule.get("snapshot");

    try {
      if (this.playersDirty) {
        if (hadPendingSnapshot === null) {
          await this.flushSnapshots({ force: true });
        } else {
          await this.flushSnapshots();
          this.queueSyncAlarms();
        }
      }
    } catch (error) {
      this.playersDirty = previousPlayersDirty;
      this.worldDirty = previousWorldDirty;
      this.pendingSnapshotAlarm = hadPendingSnapshot;
      if (previousSnapshotSchedule !== undefined) {
        this.alarmSchedule.set("snapshot", previousSnapshotSchedule);
      } else {
        this.alarmSchedule.delete("snapshot");
      }
      this.queueSnapshotStatePersist();
      this.queueSyncAlarms();
      player.reconnectToken = previousReconnectToken;
      player.reconnectTokenHash = previousReconnectTokenHash;
      this.observability.logError("player_snapshot_flush_failed", error, {
        category: "persistence",
        playerId: player.id,
      });
      this.send(socket, { type: "error", reason: "internal_error" });
      socket.close(1011, "internal_error");
      return null;
    }

    const connectedPlayers = this.getConnectedPlayersCount();
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

    const reconnectUntil = now + this.config.reconnectWindowMs;

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
      this.phase === "waiting" &&
      this.getConnectedPlayersCount() >= this.config.minPlayersToStart;

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

    this.clearHandshakeTimeout(socket);

    return player.id;
  }

  private startHandshakeTimeout(socket: WebSocket): void {
    const timeoutMs = this.config.handshakeTimeoutMs;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return;
    }

    this.clearHandshakeTimeout(socket);

    const timeout = setTimeout(() => {
      this.handshakeTimeouts.delete(socket);
      this.observability.log("warn", "handshake_timeout", {
        timeoutMs,
        activeConnections: this.activeSockets.size,
      });

      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING ||
        socket.readyState === WebSocket.CLOSING
      ) {
        try {
          socket.close(HANDSHAKE_TIMEOUT_CLOSE_CODE, "handshake_timeout");
        } catch (error) {
          this.observability.logError("handshake_timeout_close_failed", error, {
            timeoutMs,
          });
        }
      }
    }, timeoutMs);

    this.handshakeTimeouts.set(socket, timeout);
  }

  private clearHandshakeTimeout(socket: WebSocket): void {
    const timeout = this.handshakeTimeouts.get(socket);
    if (timeout) {
      clearTimeout(timeout);
      this.handshakeTimeouts.delete(socket);
    }
  }

  private normalizeName(rawName: string): string | null {
    return sanitizePlayerName(rawName);
  }

  private async handleActionMessage(
    message: ActionMessage,
    socket: WebSocket,
    options?: { validate?: boolean },
  ): Promise<void> {
    const shouldValidate = options?.validate ?? false;
    let payload: ActionMessage = message;

    if (shouldValidate) {
      const validation = actionMessageSchema.safeParse(message);
      if (!validation.success) {
        this.send(socket, { type: "error", reason: "invalid_payload" });
        return;
      }

      payload = validation.data;
    }

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
      this.setPlayerConnectionState(player, true);
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
      this.finalizeDamagePopups(result.worldDiff, Date.now());
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

        if (attackKind === "dash" && !this.canPlayerDash(player)) {
          player.combatStatus = createCombatStatusState({
            state: "cooldown",
            targetPlayerId: action.targetPlayerId ?? null,
            targetObjectId: action.targetObjectId ?? null,
            lastAttackAt: now,
          });
          player.pendingAttack = null;
          const nextCooldown = Math.max(player.dashCooldownMs, DASH_COOLDOWN_MS);
          if (nextCooldown !== player.dashCooldownMs) {
            player.dashCooldownMs = nextCooldown;
          }
          updatedPlayers.push(player);
          return { updatedPlayers };
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

    this.setPlayerConnectionState(player, false);
    this.markRankingDirty();
    const rankingMessage: RankingMessage = { type: "ranking", ranking: this.getRanking() };
    this.broadcast(rankingMessage, socket);
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

    const connectedPlayers = this.getConnectedPlayersCount();
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

    if (this.phase === "active" && this.getConnectedPlayersCount() === 0) {
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
      if (now - player.lastSeenAt <= this.config.inactiveTimeoutMs) {
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

      if (this.tickPlayerDashState(player, deltaMs)) {
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

    this.processOrganicRespawnQueue(now, worldDiff);

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

    this.finalizeDamagePopups(worldDiff, now);

    const hasPlayerUpdates = updatedPlayers.size > 0;
    const hasWorldDiff = Boolean(
      worldDiff.upsertMicroorganisms?.length ||
        worldDiff.removeMicroorganismIds?.length ||
        worldDiff.upsertOrganicMatter?.length ||
        worldDiff.removeOrganicMatterIds?.length ||
        worldDiff.upsertObstacles?.length ||
        worldDiff.removeObstacleIds?.length ||
        worldDiff.upsertRoomObjects?.length ||
        worldDiff.removeRoomObjectIds?.length ||
        worldDiff.damagePopups?.length
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

    if (activePlayers.length >= this.config.minPlayersToStart) {
      await this.startGame();
      return;
    }

    if (this.waitingStartDelayEnabled && !this.alarmSchedule.has("waiting_start")) {
      const at = Date.now() + this.config.waitingStartDelayMs;
      this.alarmSchedule.set("waiting_start", at);
      await this.persistAndSyncAlarms();
    }
  }

  private async startGame(): Promise<void> {
    if (this.getConnectedPlayersCount() === 0) {
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
    this.roundEndsAt = this.roundStartedAt + this.config.roundDurationMs;
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

    const connectedPlayers = this.getConnectedPlayersCount();
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
    this.alarmSchedule.set("reset", Date.now() + this.config.resetDelayMs);
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
      connectedPlayers: this.getConnectedPlayersCount()
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

    const { mutated: rngStateChanged } = this.initializeRngState();
    if (rngStateChanged) {
      await this.flushQueuedRngStatePersist({ force: true });
    }

    const resetTimestamp = Date.now();
    for (const player of this.players.values()) {
      player.score = 0;
      player.combo = 1;
      player.dashCharge = DEFAULT_DASH_CHARGE;
      player.dashCooldownMs = 0;
      player.lastActiveAt = resetTimestamp;
      player.movementVector = createVector();
      player.orientation = createOrientation();
      player.position = this.clampPosition(
        getSpawnPositionForPlayer(player.id, PLAYER_SPAWN_POSITIONS),
      );
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
    this.organicRespawnQueue = [];

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

    const rankingMessage: RankingMessage = {
      type: "ranking",
      ranking: this.getRanking()
    };
    this.broadcast(rankingMessage);

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
      geneFragments: cloneGeneCounter(player.geneFragments),
      stableGenes: cloneGeneCounter(player.stableGenes),
      characteristicPoints: cloneCharacteristicPointsState(player.characteristicPoints),
      dashCharge: player.dashCharge,
      dashCooldownMs: player.dashCooldownMs,
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
      evolutionSlots: computeEvolutionSlotsForPlayer(player),
    };
  }

  private ensureProgressionState(playerId: string): PlayerProgressionState {
    let state = this.progressionState.get(playerId);
    if (!state) {
      state = { dropPity: { fragment: 0, stableGene: 0 }, sequence: 0 };
      this.progressionState.set(playerId, state);
      this.markProgressionDirty();
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
    const { rng: progressionRng } = this.createProgressionRng();
    const event: SharedProgressionKillEvent = {
      playerId: player.id,
      targetId: context.targetId,
      dropTier: (context.dropTier ?? "minion") as SharedProgressionKillEvent["dropTier"],
      advantage: context.advantage ?? false,
      xpMultiplier: 1,
      rolls: {
        fragment: progressionRng(),
        fragmentAmount: progressionRng(),
        stableGene: progressionRng(),
        mg: progressionRng(),
      },
      timestamp: Date.now(),
    };
    pending.kills = [...(pending.kills ?? []), event];

    const dropResults = aggregateDrops([event], {
      dropTables: DROP_TABLES,
      rng: progressionRng,
      initialPity: state.dropPity,
    });
    const xpGain = Math.round(
      calculateExperienceFromEvents({ kills: [event] })
    );

    if (xpGain > 0) {
      player.xp = Math.max(0, player.xp + xpGain);
    }

    if (dropResults.geneticMaterial > 0) {
      player.geneticMaterial = Math.max(0, player.geneticMaterial + dropResults.geneticMaterial);
    }

    if (!player.geneFragments) {
      player.geneFragments = createGeneCounter();
    }
    if (!player.stableGenes) {
      player.stableGenes = createGeneCounter();
    }

    incrementGeneCounter(player.geneFragments, dropResults.fragments);
    incrementGeneCounter(player.stableGenes, dropResults.stableGenes);

    state.dropPity = clonePityCounters(dropResults.pity);
    pending.dropPity = clonePityCounters(dropResults.pity);
    this.markProgressionDirty();
  }

  private flushPendingProgression(): SharedProgressionState | null {
    if (this.pendingProgression.size === 0) {
      return null;
    }

    const players: SharedProgressionState["players"] = {};
    let progressionChanged = false;
    for (const [playerId, stream] of this.pendingProgression.entries()) {
      const state = this.ensureProgressionState(playerId);
      players[playerId] = {
        sequence: stream.sequence,
        dropPity: clonePityCounters(stream.dropPity),
        damage: stream.damage ? stream.damage.map((entry) => ({ ...entry })) : undefined,
        objectives: stream.objectives ? stream.objectives.map((entry) => ({ ...entry })) : undefined,
        kills: stream.kills ? stream.kills.map((entry) => ({ ...entry })) : undefined,
      };
      if (state.sequence !== stream.sequence) {
        progressionChanged = true;
        state.sequence = stream.sequence;
      }
      this.pendingProgression.delete(playerId);
    }

    if (Object.keys(players).length === 0) {
      return null;
    }

    if (progressionChanged) {
      this.markProgressionDirty();
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
      .filter((player) => player.connected)
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

    if (player.connected) {
      this.adjustConnectedPlayers(-1);
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

    const removedProgression = this.progressionState.delete(playerId);
    this.pendingProgression.delete(playerId);
    if (removedProgression) {
      this.markProgressionDirty();
    }

    return player;
  }

  private async cleanupInactivePlayers(reference: number): Promise<void> {
    let removedSomeone = false;
    for (const player of Array.from(this.players.values())) {
      if (player.connected) {
        continue;
      }
      const seenDelta = reference - player.lastSeenAt;
      const activeDelta = reference - player.lastActiveAt;
      if (
        seenDelta > this.config.reconnectWindowMs &&
        activeDelta > this.config.inactiveTimeoutMs
      ) {
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

    const connectedPlayers = this.getConnectedPlayersCount();
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
    this.playersPendingRemoval.delete(playerId);
    if (this.pendingPlayerDeaths.length > 0) {
      for (let index = this.pendingPlayerDeaths.length - 1; index >= 0; index--) {
        if (this.pendingPlayerDeaths[index]?.playerId === playerId) {
          this.pendingPlayerDeaths.splice(index, 1);
        }
      }
    }

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

    const connectedPlayers = this.getConnectedPlayersCount();
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
        const expiresAt = player.lastSeenAt + this.config.reconnectWindowMs;
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
      const removed = this.alarmSchedule.delete("cleanup");
      if (!removed) {
        this.observability.log("debug", "cleanup_alarm_unchanged", {
          nextCleanup: null
        });
        return;
      }

      this.observability.log("debug", "cleanup_alarm_cleared");
      await this.persistAndSyncAlarms();
      return;
    }

    const currentCleanup = this.alarmSchedule.get("cleanup");
    if (typeof currentCleanup === "number" && currentCleanup === nextCleanup) {
      this.observability.log("debug", "cleanup_alarm_unchanged", {
        nextCleanup
      });
      return;
    }

    this.alarmSchedule.set("cleanup", nextCleanup);
    this.observability.log("debug", "cleanup_alarm_scheduled", {
      nextCleanup
    });
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
        geneFragments: cloneGeneCounter(player.geneFragments),
        stableGenes: cloneGeneCounter(player.stableGenes),
        dashCharge: player.dashCharge,
        dashCooldownMs: player.dashCooldownMs,
        characteristicPoints: cloneCharacteristicPointsState(player.characteristicPoints),
        position: cloneVector(player.position),
        movementVector: cloneVector(player.movementVector),
        orientation: cloneOrientation(player.orientation),
        health: cloneHealthState(player.health),
        combatStatus: cloneCombatStatusState(player.combatStatus),
        combatAttributes: cloneCombatAttributes(player.combatAttributes),
        evolutionState: cloneEvolutionState(player.evolutionState),
        archetypeKey: player.archetypeKey ?? null,
        reconnectTokenHash: player.reconnectTokenHash,
        skillState: clonePlayerSkillState(skillState),
        totalSessionDurationMs: player.totalSessionDurationMs ?? 0,
        sessionCount: player.sessionCount ?? 0
      };
    });
    await this.state.storage.put(PLAYERS_KEY, snapshot);
    await this.persistProgression();
  }

  private async persistProgression(): Promise<void> {
    if (this.progressionState.size === 0) {
      await this.state.storage.delete(PROGRESSION_KEY);
      return;
    }

    const snapshot: Record<string, PlayerProgressionState> = {};
    for (const [playerId, state] of this.progressionState.entries()) {
      const dropPity = clonePityCounters(state.dropPity);
      dropPity.fragment = Number.isFinite(dropPity.fragment)
        ? Math.max(0, Number(dropPity.fragment))
        : 0;
      dropPity.stableGene = Number.isFinite(dropPity.stableGene)
        ? Math.max(0, Number(dropPity.stableGene))
        : 0;
      snapshot[playerId] = {
        sequence: Number.isFinite(state.sequence)
          ? Math.max(0, Math.trunc(Number(state.sequence)))
          : 0,
        dropPity,
      };
    }

    await this.state.storage.put(PROGRESSION_KEY, snapshot);
  }

  private async persistWorld(): Promise<void> {
    await this.state.storage.put(WORLD_KEY, cloneWorldState(this.world));
  }

  private async persistRngState(): Promise<void> {
    const snapshot: RngState = {
      organicMatterRespawn: this.normalizeRngSeed(this.rngState.organicMatterRespawn),
      progression: this.normalizeRngSeed(this.rngState.progression),
      microorganismWaypoint: this.normalizeRngSeed(
        this.rngState.microorganismWaypoint,
      ),
    };
    await this.state.storage.put(RNG_STATE_KEY, snapshot);
  }

  private async persistSnapshotState(): Promise<void> {
    if (
      !this.playersDirty &&
      !this.worldDirty &&
      !this.progressionDirty &&
      this.pendingSnapshotAlarm === null
    ) {
      await this.state.storage.delete(SNAPSHOT_STATE_KEY);
      return;
    }

    const snapshotState: SnapshotState = {
      playersDirty: this.playersDirty,
      worldDirty: this.worldDirty,
      progressionDirty: this.progressionDirty,
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
    return this.getConnectedPlayersCount() > 0;
  }

  private getConnectedPlayersCount(): number {
    if (this.connectedPlayers < 0 || this.connectedPlayers > this.players.size) {
      this.connectedPlayers = this.recalculateConnectedPlayers();
    }
    return this.connectedPlayers;
  }

  private adjustConnectedPlayers(delta: number): void {
    this.connectedPlayers += delta;
    if (this.connectedPlayers < 0 || this.connectedPlayers > this.players.size) {
      this.connectedPlayers = this.recalculateConnectedPlayers();
    }
  }

  private setPlayerConnectionState(player: PlayerInternal, connected: boolean): void {
    if (player.connected === connected) {
      return;
    }

    player.connected = connected;
    this.adjustConnectedPlayers(connected ? 1 : -1);
  }

  private recalculateConnectedPlayers(): number {
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

  private discardSocket(
    socket: WebSocket,
    code: number,
    reason: string,
    logEvent: string
  ): void {
    if (socket.readyState !== WebSocket.CLOSING && socket.readyState !== WebSocket.CLOSED) {
      try {
        socket.close(code, reason);
      } catch (error) {
        this.observability.log("warn", logEvent, {
          error: serializeError(error),
        });
      }
    }

    this.clientsBySocket.delete(socket);
    this.activeSockets.delete(socket);
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
