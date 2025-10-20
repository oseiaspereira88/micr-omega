import {
  cloneSkillCooldowns,
  getDefaultSkillList,
  isSkillKey,
  type SkillKey,
} from "./skills";
import type {
  ArchetypeKey,
  AttackKind,
  CombatAttributes,
  CombatStatus,
  HealthState,
  OrientationState,
  PlayerEvolutionAction,
  Vector2,
} from "./types";
import { sanitizeArchetypeKey } from "./types";
import type { StatusCollection } from "./statuses";
import { getPlayerLevelFromXp, type GeneCounter } from "./progression";

export const DEFAULT_COMBAT_ATTRIBUTES: CombatAttributes = {
  attack: 8,
  defense: 4,
  speed: 140,
  range: 80,
};

export const DEFAULT_PLAYER_ENERGY = 100;
export const DEFAULT_PLAYER_XP = 0;
export const DEFAULT_PLAYER_GENETIC_MATERIAL = 0;

export const MAX_DASH_CHARGE = 100;
export const DEFAULT_DASH_CHARGE = MAX_DASH_CHARGE;
export const DASH_CHARGE_COST = 30;
export const DASH_COOLDOWN_MS = 1_000;
const DASH_RECHARGE_RATE_PER_SECOND = 20;
export const DASH_RECHARGE_PER_MS = DASH_RECHARGE_RATE_PER_SECOND / 1_000;

export const createCombatAttributes = (attributes?: CombatAttributes): CombatAttributes => ({
  attack: attributes?.attack ?? DEFAULT_COMBAT_ATTRIBUTES.attack,
  defense: attributes?.defense ?? DEFAULT_COMBAT_ATTRIBUTES.defense,
  speed: attributes?.speed ?? DEFAULT_COMBAT_ATTRIBUTES.speed,
  range: attributes?.range ?? DEFAULT_COMBAT_ATTRIBUTES.range,
});

export const cloneCombatAttributes = (attributes: CombatAttributes): CombatAttributes => ({
  attack: attributes.attack,
  defense: attributes.defense,
  speed: attributes.speed,
  range: attributes.range,
});

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const createOrientation = (orientation?: OrientationState): OrientationState => {
  if (!orientation) {
    return { angle: 0 };
  }
  return orientation.tilt === undefined
    ? { angle: orientation.angle }
    : { angle: orientation.angle, tilt: orientation.tilt };
};

export const cloneOrientation = (orientation: OrientationState): OrientationState =>
  orientation.tilt === undefined
    ? { angle: orientation.angle }
    : { angle: orientation.angle, tilt: orientation.tilt };

const DEFAULT_MAX_HEALTH = 100;

export const createHealthState = (health?: HealthState): HealthState => {
  const max = health?.max ?? DEFAULT_MAX_HEALTH;
  const current = health?.current ?? max;
  return {
    current: Math.max(0, Math.min(max, current)),
    max,
  };
};

export const cloneHealthState = (health: HealthState): HealthState => ({
  current: health.current,
  max: health.max,
});

export const createCombatStatusState = (status?: CombatStatus): CombatStatus => ({
  state: status?.state ?? "idle",
  targetPlayerId: status?.targetPlayerId ?? null,
  targetObjectId: status?.targetObjectId ?? null,
  lastAttackAt: status?.lastAttackAt ?? null,
});

export const cloneCombatStatusState = (status: CombatStatus): CombatStatus => ({
  state: status.state,
  targetPlayerId: status.targetPlayerId,
  targetObjectId: status.targetObjectId,
  lastAttackAt: status.lastAttackAt,
});

export const normalizeDashCharge = (charge?: number): number => {
  if (!Number.isFinite(charge)) {
    return DEFAULT_DASH_CHARGE;
  }
  return clamp(charge as number, 0, MAX_DASH_CHARGE);
};

export const normalizeDashCooldown = (cooldown?: number): number => {
  if (!Number.isFinite(cooldown)) {
    return 0;
  }
  return Math.max(0, cooldown as number);
};

export type StoredPlayerSkillState = {
  available: SkillKey[];
  current: SkillKey;
  cooldowns: Record<string, number>;
};

export type PlayerSkillState = {
  available: SkillKey[];
  current: SkillKey;
  cooldowns: Record<string, number>;
};

export const createPlayerSkillState = (stored?: StoredPlayerSkillState): PlayerSkillState => {
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

export const clonePlayerSkillState = (state: PlayerSkillState): StoredPlayerSkillState => ({
  available: state.available.slice(),
  current: state.current,
  cooldowns: { ...state.cooldowns },
});

export const normalizePlayerSkillState = (
  state: PlayerSkillState | StoredPlayerSkillState | undefined,
): PlayerSkillState => createPlayerSkillState(state as StoredPlayerSkillState | undefined);

export type PendingAttack = {
  kind: AttackKind;
  targetPlayerId?: string | null;
  targetObjectId?: string | null;
};

export type StoredPlayer = {
  id: string;
  name: string;
  score: number;
  combo: number;
  energy: number;
  xp: number;
  geneticMaterial: number;
  geneFragments: GeneCounter;
  stableGenes: GeneCounter;
  dashCharge: number;
  dashCooldownMs: number;
  position: Vector2;
  movementVector: Vector2;
  orientation: OrientationState;
  health: HealthState;
  combatStatus: CombatStatus;
  combatAttributes: CombatAttributes;
  evolutionState: PlayerEvolutionState;
  archetypeKey: string | null;
  reconnectTokenHash: string;
  reconnectToken?: string;
  skillState?: StoredPlayerSkillState;
  totalSessionDurationMs?: number;
  sessionCount?: number;
};

type Vector2 = { x: number; y: number };

type PlayerEvolutionHistory = Record<EvolutionTier, Record<string, number>>;

type CombatStatModifierState = {
  additive: number;
  multiplier: number;
  baseOverride: number;
};

type CombatStatKey = "attack" | "defense" | "speed" | "range";

type EvolutionTier = "small" | "medium" | "large" | "macro";

export type PlayerEvolutionState = {
  traits: string[];
  history: PlayerEvolutionHistory;
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

const createEvolutionHistoryState = (
  history?: Partial<PlayerEvolutionHistory> | null,
): PlayerEvolutionHistory => ({
  small: sanitizeHistoryBucket(history?.small),
  medium: sanitizeHistoryBucket(history?.medium),
  large: sanitizeHistoryBucket(history?.large),
  macro: sanitizeHistoryBucket((history as Partial<PlayerEvolutionHistory> | undefined)?.macro),
});

export const createEvolutionState = (state?: Partial<PlayerEvolutionState> | null): PlayerEvolutionState => {
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

export const cloneEvolutionState = (state?: PlayerEvolutionState | null): PlayerEvolutionState => {
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

const sumEvolutionHistory = (bucket: Record<string, number> | undefined): number => {
  if (!bucket) {
    return 0;
  }

  let total = 0;
  for (const value of Object.values(bucket)) {
    if (Number.isFinite(value)) {
      total += Math.max(0, Math.trunc(value));
    }
  }
  return total;
};

export const computeEvolutionSlotsForPlayer = (player: PlayerInternal) => {
  const level = getPlayerLevelFromXp(player.xp);
  const SMALL_EVOLUTION_SLOT_BASE = 2;
  const SMALL_SLOT_LEVEL_DIVISOR = 3;
  const MEDIUM_SLOT_INTERVAL = 2;
  const LARGE_SLOT_INTERVAL = 5;

  const smallMax = SMALL_EVOLUTION_SLOT_BASE + Math.floor(level / SMALL_SLOT_LEVEL_DIVISOR);
  const mediumMax = Math.floor(level / MEDIUM_SLOT_INTERVAL);
  const largeMax = Math.floor(level / LARGE_SLOT_INTERVAL);
  const macroMax = largeMax;

  const history = player.evolutionState?.history ?? createEvolutionHistoryState(null);

  const buildSlot = (bucket: Record<string, number> | undefined, max: number) => {
    const used = sumEvolutionHistory(bucket);
    return {
      used,
      max: Math.max(max, used),
    };
  };

  return {
    small: buildSlot(history.small, smallMax),
    medium: buildSlot(history.medium, mediumMax),
    large: buildSlot(history.large, largeMax),
    macro: buildSlot(history.macro, macroMax),
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
  for (const key of ["attack", "defense", "speed", "range"] as const) {
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

export const applyEvolutionActionToState = (
  state: PlayerEvolutionState,
  action: PlayerEvolutionAction,
): boolean => {
  let changed = false;

  if (action.tier && action.evolutionId) {
    const tier = ["small", "medium", "large", "macro"].find((value) => value === action.tier);
    if (tier) {
      const bucket = state.history[tier as EvolutionTier];
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

const computeStatWithModifiers = (base: number, modifier: CombatStatModifierState): number => {
  const baseOverride = Number.isFinite(modifier.baseOverride) ? modifier.baseOverride : 0;
  const additive = Number.isFinite(modifier.additive) ? modifier.additive : 0;
  const multiplier = Number.isFinite(modifier.multiplier) ? modifier.multiplier : 0;

  const effectiveBase = base + baseOverride;
  const effectiveMultiplier = 1 + multiplier / 100;

  return Math.max(0, (effectiveBase + additive) * effectiveMultiplier);
};

export const computeCombatAttributesWithModifiers = (
  base: CombatAttributes,
  modifiers: Record<CombatStatKey, CombatStatModifierState>,
): CombatAttributes =>
  createCombatAttributes({
    attack: computeStatWithModifiers(base.attack, modifiers.attack),
    defense: computeStatWithModifiers(base.defense, modifiers.defense),
    speed: computeStatWithModifiers(base.speed, modifiers.speed),
    range: computeStatWithModifiers(base.range, modifiers.range),
  });

export type StoredPlayerSnapshot = Omit<
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
      | "reconnectToken"
      | "reconnectTokenHash"
      | "dashCharge"
      | "dashCooldownMs"
      | "geneFragments"
      | "stableGenes"
    >
  >;

export type PlayerSkillSnapshot = StoredPlayerSkillState;

export type PlayerInternal = Omit<StoredPlayer, "skillState"> & {
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

export const getArchetypeDefinition = (key: string | null | undefined): ArchetypeDefinition | null => {
  if (!key) {
    return null;
  }
  const normalized = sanitizeArchetypeKey(key);
  if (!normalized) {
    return null;
  }
  return ARCHETYPE_DEFINITIONS[normalized as ArchetypeKey] ?? null;
};

export const createVector = (vector?: Vector2): Vector2 => ({
  x: vector?.x ?? 0,
  y: vector?.y ?? 0,
});

export const cloneVector = (vector: Vector2): Vector2 => ({ x: vector.x, y: vector.y });

export const normalizeVectorOrNull = (vector: Vector2): Vector2 | null => {
  const magnitude = Math.sqrt(vector.x ** 2 + vector.y ** 2);
  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return null;
  }
  return { x: vector.x / magnitude, y: vector.y / magnitude };
};

export const rotateVector = (vector: Vector2, angle: number): Vector2 => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos,
  };
};

export const vectorsApproximatelyEqual = (a: Vector2, b: Vector2, tolerance = 1e-3): boolean =>
  Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;

export const orientationsApproximatelyEqual = (
  a: OrientationState,
  b: OrientationState,
  tolerance = 1e-3,
): boolean => {
  if (Math.abs(a.angle - b.angle) > tolerance) {
    return false;
  }
  return a.tilt === b.tilt;
};

export type PlayerInternalState = PlayerInternal;
