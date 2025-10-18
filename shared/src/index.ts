import { z } from "zod";

export const PROTOCOL_VERSION = "1.1.0" as const;

export const RANKING_SORT_LOCALE = "pt-BR" as const;
export const RANKING_SORT_OPTIONS = { sensitivity: "base" } as const;

export const WORLD_SIZE = 4000;
export const WORLD_RADIUS = WORLD_SIZE / 2;

export const NAME_PATTERN = /^[\p{L}\p{N} _-]+$/u;
export const ABILITY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 24;
export const MAX_PLAYER_ID_LENGTH = 64;
export const MAX_ABILITY_ID_LENGTH = 64;
export const MAX_VERSION_LENGTH = 16;
export const MAX_WORLD_OBJECT_ID_LENGTH = 64;

export const ARCHETYPE_KEYS = [
  "virus",
  "bacteria",
  "archaea",
  "protozoa",
  "algae",
  "fungus",
] as const;

export const archetypeKeySchema = z.enum(ARCHETYPE_KEYS);

export const vector2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});

export const orientationSchema = z.object({
  angle: z.number().finite(),
  tilt: z.number().finite().optional()
});

export const healthSchema = z
  .object({
    current: z.number().finite().nonnegative(),
    max: z.number().finite().positive()
  })
  .refine((value) => value.current <= value.max, {
    message: "health_exceeds_max",
    path: ["current"]
  });

const playerNameSchema = z
  .string()
  .trim()
  .min(MIN_NAME_LENGTH, "name_too_short")
  .max(MAX_NAME_LENGTH, "name_too_long")
  .regex(NAME_PATTERN, "name_invalid_chars");

const playerIdSchema = z.string().trim().min(1).max(MAX_PLAYER_ID_LENGTH);

const abilityIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_ABILITY_ID_LENGTH)
  .regex(ABILITY_ID_PATTERN, "ability_invalid_chars");

const worldObjectIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_WORLD_OBJECT_ID_LENGTH);

export const combatStatusSchema = z.object({
  state: z.union([z.literal("idle"), z.literal("engaged"), z.literal("cooldown")]),
  targetPlayerId: playerIdSchema.nullable().default(null),
  targetObjectId: worldObjectIdSchema.nullable().default(null),
  lastAttackAt: z.number().finite().nullable().default(null)
});

export const combatAttributesSchema = z.object({
  attack: z.number().finite().nonnegative(),
  defense: z.number().finite().nonnegative(),
  speed: z.number().finite().nonnegative(),
  range: z.number().finite().nonnegative()
});

const combatStatAdjustmentSchema = z
  .object({
    attack: z.number().finite().optional(),
    defense: z.number().finite().optional(),
    speed: z.number().finite().optional(),
    range: z.number().finite().optional()
  })
  .partial()
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "empty_stat_adjustment"
  });

export const evolutionTierSchema = z.union([
  z.literal("small"),
  z.literal("medium"),
  z.literal("large"),
  z.literal("macro")
]);

export const evolutionActionSchema = z.object({
  type: z.literal("evolution"),
  evolutionId: z.string().trim().min(1).max(64),
  tier: evolutionTierSchema.optional(),
  countDelta: z.number().finite().int().optional(),
  traitDeltas: z.array(z.string().trim().min(1).max(64)).optional(),
  additiveDelta: combatStatAdjustmentSchema.optional(),
  multiplierDelta: combatStatAdjustmentSchema.optional(),
  baseDelta: combatStatAdjustmentSchema.optional()
});

const statusKeySchema = z.string().trim().min(1).max(64);

export const statusEffectEventSchema = z.object({
  targetKind: z.union([
    z.literal("player"),
    z.literal("microorganism"),
    z.literal("organic_matter"),
    z.literal("obstacle")
  ]),
  targetPlayerId: playerIdSchema.optional(),
  targetObjectId: worldObjectIdSchema.optional(),
  status: statusKeySchema,
  stacks: z.number().int().nonnegative().default(1),
  durationMs: z.number().finite().nonnegative().optional(),
  sourcePlayerId: playerIdSchema.optional()
});

const geneCounterSchema = z.object({
  minor: z.number().finite().nonnegative().default(0),
  major: z.number().finite().nonnegative().default(0),
  apex: z.number().finite().nonnegative().default(0),
});

export const sharedPlayerStateSchema = z.object({
  id: playerIdSchema,
  name: playerNameSchema,
  connected: z.boolean(),
  score: z.number().finite(),
  combo: z.number().finite(),
  energy: z.number().finite().nonnegative().default(0),
  xp: z.number().finite().nonnegative().default(0),
  geneticMaterial: z.number().finite().nonnegative().default(0),
  geneFragments: geneCounterSchema.optional(),
  stableGenes: geneCounterSchema.optional(),
  dashCharge: z.number().finite().nonnegative().max(100).default(0),
  dashCooldownMs: z.number().finite().nonnegative().default(0),
  lastActiveAt: z.number().finite(),
  position: vector2Schema,
  movementVector: vector2Schema,
  orientation: orientationSchema,
  health: healthSchema,
  combatStatus: combatStatusSchema,
  combatAttributes: combatAttributesSchema,
  archetype: archetypeKeySchema.nullable().optional().default(null),
  archetypeKey: archetypeKeySchema.nullable().optional().default(null),
  skillList: z.array(z.string().trim().min(1).max(64)).optional().default([]),
  currentSkill: z.string().trim().min(1).max(64).nullable().optional().default(null),
  skillCooldowns: z
    .record(z.string().trim().min(1).max(64), z.number().finite().nonnegative())
    .optional()
    .default({})
});

const microorganismAppearanceSchema = z
  .object({
    bodyShape: z.enum(["orb", "helix", "shield", "needle", "cluster"]).optional(),
    bodyColor: z.string().trim().min(1).max(32).optional(),
    coreColor: z.string().trim().min(1).max(32).optional(),
    mantleColor: z.string().trim().min(1).max(32).optional(),
    accentColor: z.string().trim().min(1).max(32).optional(),
    glowColor: z.string().trim().min(1).max(32).optional(),
    appendages: z.number().finite().nonnegative().max(12).optional(),
    texture: z.string().trim().min(1).max(48).optional(),
    scale: z.number().finite().positive().max(3).optional()
  })
  .passthrough();

const microorganismAiSchema = z
  .object({
    behavior: z.enum(["wander", "patrol", "orbit", "stalker", "swarm"]),
    anchor: vector2Schema.optional(),
    orbitRadius: z.number().finite().nonnegative().optional(),
    orbitSpeed: z.number().finite().optional(),
    roamRadius: z.number().finite().nonnegative().optional(),
    patrolPoints: z.array(vector2Schema).min(2).max(8).optional(),
    patrolPauseMs: z.number().finite().nonnegative().optional(),
    preferredDistance: z.number().finite().nonnegative().optional(),
    lastDecision: z.string().trim().min(1).max(96).optional(),
    state: z.record(z.string().trim().min(1).max(64), z.unknown()).optional(),
    focus: z.string().trim().min(1).max(64).optional(),
    aggressionBias: z.number().finite().optional()
  })
  .passthrough();

export const microorganismSchema = z.object({
  id: worldObjectIdSchema,
  kind: z.literal("microorganism"),
  species: z.string().trim().min(1).max(64),
  position: vector2Schema,
  movementVector: vector2Schema,
  orientation: orientationSchema,
  health: healthSchema,
  aggression: z.union([z.literal("passive"), z.literal("neutral"), z.literal("hostile")]),
  attributes: z
    .object({
      speed: z.number().finite().nonnegative().optional(),
      damage: z.number().finite().nonnegative().optional(),
      resilience: z.number().finite().nonnegative().optional()
    })
    .default({}),
  displayName: z.string().trim().min(1).max(64).optional(),
  level: z.number().int().min(1).max(99).optional(),
  variant: z.string().trim().min(1).max(64).optional(),
  appearance: microorganismAppearanceSchema.optional(),
  description: z.string().trim().min(1).max(280).optional(),
  ai: microorganismAiSchema.optional()
});

export const organicMatterSchema = z.object({
  id: worldObjectIdSchema,
  kind: z.literal("organic_matter"),
  position: vector2Schema,
  quantity: z.number().finite().nonnegative(),
  nutrients: z.record(z.string().trim().min(1), z.number().finite()).default({})
});

export const obstacleSchema = z.object({
  id: worldObjectIdSchema,
  kind: z.literal("obstacle"),
  position: vector2Schema,
  size: vector2Schema,
  orientation: orientationSchema.optional(),
  impassable: z.boolean().default(true)
});

export const roomObjectSchema = z.object({
  id: worldObjectIdSchema,
  kind: z.literal("room_object"),
  type: z.string().trim().min(1).max(64),
  position: vector2Schema,
  state: z.record(z.string().trim().min(1), z.unknown()).optional()
});

export const worldEntitySchema = z.discriminatedUnion("kind", [
  microorganismSchema,
  organicMatterSchema,
  obstacleSchema,
  roomObjectSchema
]);

export const sharedWorldStateSchema = z.object({
  microorganisms: z.array(microorganismSchema),
  organicMatter: z.array(organicMatterSchema),
  obstacles: z.array(obstacleSchema),
  roomObjects: z.array(roomObjectSchema)
});

export const sharedWorldStateDiffSchema = z.object({
  upsertMicroorganisms: z.array(microorganismSchema).optional(),
  removeMicroorganismIds: z.array(worldObjectIdSchema).optional(),
  upsertOrganicMatter: z.array(organicMatterSchema).optional(),
  removeOrganicMatterIds: z.array(worldObjectIdSchema).optional(),
  upsertObstacles: z.array(obstacleSchema).optional(),
  removeObstacleIds: z.array(worldObjectIdSchema).optional(),
  upsertRoomObjects: z.array(roomObjectSchema).optional(),
  removeRoomObjectIds: z.array(worldObjectIdSchema).optional(),
  statusEffects: z.array(statusEffectEventSchema).optional()
});

const progressionPitySchema = z.object({
  fragment: z.number().finite().nonnegative().default(0),
  stableGene: z.number().finite().nonnegative().default(0)
});

export const progressionRollsSchema = z
  .object({
    fragment: z.number().finite().min(0).max(1).optional(),
    fragmentAmount: z.number().finite().min(0).max(1).optional(),
    stableGene: z.number().finite().min(0).max(1).optional(),
    mg: z.number().finite().min(0).max(1).optional()
  })
  .partial();

const dropTierSchema = z.union([z.literal("minion"), z.literal("elite"), z.literal("boss")]);

const progressionDamageEventSchema = z
  .object({
    amount: z.number().finite().nonnegative().optional(),
    multiplier: z.number().finite().nonnegative().optional()
  })
  .partial();

const progressionObjectiveEventSchema = z
  .object({
    xp: z.number().finite().nonnegative().optional()
  })
  .partial();

export const progressionKillEventSchema = z
  .object({
    timestamp: z.number().finite().nonnegative().optional(),
    playerId: playerIdSchema.optional(),
    targetId: worldObjectIdSchema.optional(),
    dropTier: dropTierSchema.optional(),
    tier: dropTierSchema.optional(),
    xpMultiplier: z.number().finite().nonnegative().optional(),
    advantage: z.boolean().optional(),
    rolls: progressionRollsSchema.optional()
  })
  .partial();

export const sharedProgressionStreamSchema = z.object({
  sequence: z.number().int().nonnegative().default(0),
  dropPity: progressionPitySchema.optional(),
  damage: z.array(progressionDamageEventSchema).optional(),
  objectives: z.array(progressionObjectiveEventSchema).optional(),
  kills: z.array(progressionKillEventSchema).optional()
});

export const sharedProgressionStateSchema = z.object({
  players: z.record(playerIdSchema, sharedProgressionStreamSchema).default({})
});

export const sharedGameStateSchema = z.object({
  phase: z.union([z.literal("waiting"), z.literal("active"), z.literal("ended")]),
  roundId: z.string().trim().min(1).max(64).nullable(),
  roundStartedAt: z.number().finite().nullable(),
  roundEndsAt: z.number().finite().nullable(),
  players: z.array(sharedPlayerStateSchema),
  world: sharedWorldStateSchema,
  progression: sharedProgressionStateSchema.optional()
});

export const combatLogEntrySchema = z.object({
  timestamp: z.number().finite(),
  attackerId: playerIdSchema.optional(),
  targetId: playerIdSchema.optional(),
  targetKind: z
    .union([
      z.literal("player"),
      z.literal("microorganism"),
      z.literal("organic_matter"),
      z.literal("obstacle")
    ]),
  targetObjectId: worldObjectIdSchema.optional(),
  damage: z.number().finite().nonnegative(),
  outcome: z.union([z.literal("hit"), z.literal("defeated"), z.literal("blocked"), z.literal("collected")]),
  remainingHealth: z.number().finite().nonnegative().optional(),
  scoreAwarded: z.number().finite().optional()
});

export const sharedGameStateDiffSchema = z.object({
  phase: sharedGameStateSchema.shape.phase.optional(),
  roundId: sharedGameStateSchema.shape.roundId.optional(),
  roundStartedAt: sharedGameStateSchema.shape.roundStartedAt.optional(),
  roundEndsAt: sharedGameStateSchema.shape.roundEndsAt.optional(),
  upsertPlayers: z.array(sharedPlayerStateSchema).optional(),
  removedPlayerIds: z.array(playerIdSchema).optional(),
  world: sharedWorldStateDiffSchema.optional(),
  combatLog: z.array(combatLogEntrySchema).optional(),
  progression: sharedProgressionStateSchema.optional()
});

export type SharedProgressionStream = z.infer<typeof sharedProgressionStreamSchema>;
export type SharedProgressionState = z.infer<typeof sharedProgressionStateSchema>;
export type SharedProgressionKillEvent = z.infer<typeof progressionKillEventSchema>;

export const DROP_TABLES = {
  minion: {
    xp: { base: 24, variance: 0.2 },
    geneticMaterial: { min: 2, max: 4 },
    fragment: {
      chance: 0.1,
      min: 1,
      max: 1,
      pityThreshold: 5,
      pityIncrement: 0.1
    },
    stableGene: {
      chance: 0.02,
      amount: 1,
      pityThreshold: 12,
      pityIncrement: 0.05
    },
    fragmentKey: "minor",
    stableKey: "minor"
  },
  elite: {
    xp: { base: 80, variance: 0.15 },
    geneticMaterial: { min: 6, max: 10 },
    fragment: {
      chance: 0.22,
      min: 1,
      max: 2,
      pityThreshold: 4,
      pityIncrement: 0.12
    },
    stableGene: {
      chance: 0.08,
      amount: 1,
      pityThreshold: 6,
      pityIncrement: 0.1
    },
    fragmentKey: "major",
    stableKey: "major"
  },
  boss: {
    xp: { base: 260, variance: 0.1 },
    geneticMaterial: { min: 20, max: 32 },
    fragment: {
      chance: 0.55,
      min: 3,
      max: 5,
      pityThreshold: 2,
      pityIncrement: 0.2
    },
    stableGene: {
      chance: 0.35,
      amount: 1,
      pityThreshold: 3,
      pityIncrement: 0.25
    },
    fragmentKey: "apex",
    stableKey: "apex"
  }
} as const;

export type DropTables = typeof DROP_TABLES;
export type DropTier = keyof DropTables;

export const XP_DISTRIBUTION = {
  perDamage: 0.45,
  perObjective: 120,
  baseKillXp: {
    minion: 40,
    elite: 120,
    boss: 400
  }
} as const;

const createGeneCounter = () => ({ minor: 0, major: 0, apex: 0 });

const FRAGMENT_KEY_BY_TIER: Record<string, keyof ReturnType<typeof createGeneCounter>> = {
  minion: "minor",
  elite: "major",
  boss: "apex"
};

const STABLE_KEY_BY_TIER: Record<string, keyof ReturnType<typeof createGeneCounter>> = {
  minion: "minor",
  elite: "major",
  boss: "apex"
};

const clampChance = (value: number | undefined) => Math.min(1, Math.max(0, value ?? 0));

const computePityChance = (
  baseChance: number | undefined,
  pityCounter: number,
  config: { pityThreshold?: number; pityIncrement?: number } | undefined
) => {
  if (!config) {
    return clampChance(baseChance);
  }
  const threshold = Number.isFinite(config.pityThreshold) ? Number(config.pityThreshold) : Infinity;
  const increment = Number.isFinite(config.pityIncrement) ? Number(config.pityIncrement) : 0;
  if (!Number.isFinite(pityCounter) || pityCounter < threshold) {
    return clampChance(baseChance);
  }

  const stacks = Math.max(0, Math.floor(pityCounter - threshold + 1));
  return clampChance((baseChance ?? 0) + stacks * increment);
};

const rollValueBetween = (min: number | undefined, max: number | undefined, roll: number | undefined) => {
  const lower = Number.isFinite(min) ? Number(min) : 0;
  const upper = Number.isFinite(max) ? Number(max) : lower;
  if (upper <= lower) {
    return lower;
  }
  const normalized = clampChance(roll);
  return lower + Math.round((upper - lower) * normalized);
};

export const calculateExperienceFromEvents = (
  events: Partial<SharedProgressionStream> | undefined,
  xpConfig: typeof XP_DISTRIBUTION = XP_DISTRIBUTION
): number => {
  if (!events) {
    return 0;
  }

  const damageEvents = Array.isArray(events.damage) ? events.damage : [];
  const objectiveEvents = Array.isArray(events.objectives) ? events.objectives : [];
  const killEvents = Array.isArray(events.kills) ? events.kills : [];

  const damageXp = damageEvents.reduce((total, event) => {
    const amount = Number.isFinite(event?.amount) ? Number(event?.amount) : 0;
    const multiplier = Number.isFinite(event?.multiplier) ? Number(event?.multiplier) : 1;
    return total + Math.max(0, amount) * (xpConfig.perDamage ?? 0) * Math.max(multiplier, 0);
  }, 0);

  const objectiveXp = objectiveEvents.reduce((total, event) => {
    if (Number.isFinite(event?.xp)) {
      return total + Math.max(0, Number(event?.xp));
    }
    return total + (xpConfig.perObjective ?? 0);
  }, 0);

  const killXp = killEvents.reduce((total, kill) => {
    const tier = (kill?.dropTier ?? kill?.tier ?? "minion") as DropTier;
    const base = xpConfig.baseKillXp?.[tier] ?? xpConfig.baseKillXp?.minion ?? 0;
    const multiplier = Number.isFinite(kill?.xpMultiplier) ? Number(kill?.xpMultiplier) : 1;
    return total + base * Math.max(multiplier, 0);
  }, 0);

  return Math.max(0, damageXp + objectiveXp + killXp);
};

export const aggregateDrops = (
  kills: readonly SharedProgressionKillEvent[] | undefined,
  {
    dropTables = DROP_TABLES,
    rng = Math.random,
    initialPity = { fragment: 0, stableGene: 0 }
  }: {
    dropTables?: DropTables;
    rng?: () => number;
    initialPity?: { fragment?: number; stableGene?: number } | null;
  } = {}
) => {
  const clampCounter = (value: number | undefined) =>
    Math.max(0, Number.isFinite(value) ? Number(value) : 0);

  const counters = {
    geneticMaterial: 0,
    fragments: createGeneCounter(),
    stableGenes: createGeneCounter(),
    pity: {
      fragment: clampCounter(initialPity?.fragment),
      stableGene: clampCounter(initialPity?.stableGene)
    }
  };

  if (!Array.isArray(kills)) {
    return counters;
  }

  kills.forEach((kill) => {
    const tier = ((kill?.dropTier ?? kill?.tier) as DropTier) || "minion";
    const profile = dropTables?.[tier] ?? dropTables?.minion;
    if (!profile) {
      return;
    }

    const advantageMultiplier = kill?.advantage ? 1.25 : 1;
    const baseMin = Number.isFinite(profile.geneticMaterial?.min)
      ? Number(profile.geneticMaterial?.min)
      : 0;
    const baseMax = Number.isFinite(profile.geneticMaterial?.max)
      ? Number(profile.geneticMaterial?.max)
      : baseMin;
    const mgRoll = kill?.rolls?.mg ?? rng();
    const mgGain = Math.max(
      baseMin,
      Math.round(rollValueBetween(baseMin, baseMax, mgRoll) * Math.max(advantageMultiplier, 0))
    );
    counters.geneticMaterial += mgGain;

    const fragmentKey = FRAGMENT_KEY_BY_TIER[tier] ?? "minor";
    const fragmentConfig = profile.fragment ?? {};
    const fragmentChance = computePityChance(fragmentConfig.chance, counters.pity.fragment, fragmentConfig);
    const fragmentRoll = kill?.rolls?.fragment ?? rng();
    if (fragmentRoll < fragmentChance) {
      const amount = rollValueBetween(
        fragmentConfig.min ?? 1,
        fragmentConfig.max ?? fragmentConfig.min ?? 1,
        kill?.rolls?.fragmentAmount ?? rng()
      );
      counters.fragments[fragmentKey] = (counters.fragments[fragmentKey] ?? 0) + Math.max(1, amount);
      counters.pity.fragment = 0;
    } else {
      counters.pity.fragment += 1;
    }

    const stableKey = STABLE_KEY_BY_TIER[tier] ?? "minor";
    const stableConfig = profile.stableGene ?? {};
    const stableChance = computePityChance(
      stableConfig.chance,
      counters.pity.stableGene,
      stableConfig
    );
    const stableRoll = kill?.rolls?.stableGene ?? rng();
    if (stableRoll < stableChance) {
      const amount = Number.isFinite(stableConfig.amount) ? Number(stableConfig.amount) : 1;
      counters.stableGenes[stableKey] =
        (counters.stableGenes[stableKey] ?? 0) + Math.max(1, amount);
      counters.pity.stableGene = 0;
    } else {
      counters.pity.stableGene += 1;
    }
  });

  return counters;
};

export const rankingEntrySchema = z.object({
  playerId: playerIdSchema,
  name: playerNameSchema,
  score: z.number().finite()
});

export const rankingMessageSchema = z.object({
  type: z.literal("ranking"),
  ranking: z.array(rankingEntrySchema)
});

const reconnectTokenSchema = z.string().trim().min(1).max(128);

export const joinMessageSchema = z.object({
  type: z.literal("join"),
  name: playerNameSchema,
  playerId: playerIdSchema.optional(),
  reconnectToken: reconnectTokenSchema.optional(),
  version: z.string().trim().min(1).max(MAX_VERSION_LENGTH).optional()
});

export const pingMessageSchema = z.object({
  type: z.literal("ping"),
  ts: z.number().finite().nonnegative()
});

export const scoreActionSchema = z.object({
  type: z.literal("score"),
  amount: z.number().finite(),
  comboMultiplier: z.number().finite().optional()
});

export const comboActionSchema = z.object({
  type: z.literal("combo"),
  multiplier: z.number().finite()
});

export const deathActionSchema = z.object({
  type: z.literal("death")
});

export const abilityActionSchema = z.object({
  type: z.literal("ability"),
  abilityId: abilityIdSchema,
  value: z.number().finite().optional()
});

const ATTACK_KIND_VALUES = ["basic", "dash", "skill"] as const;

export const attackKindSchema = z.enum(ATTACK_KIND_VALUES);

export type AttackKind = z.infer<typeof attackKindSchema>;

export const TARGET_OPTIONAL_ATTACK_KINDS: ReadonlySet<AttackKind> = new Set([
  "dash",
  "skill",
]);

export const movementActionSchema = z.object({
  type: z.literal("movement"),
  position: vector2Schema,
  movementVector: vector2Schema,
  orientation: orientationSchema
});

const attackActionBaseSchema = z.object({
  type: z.literal("attack"),
  kind: attackKindSchema.optional(),
  targetPlayerId: playerIdSchema.optional(),
  targetObjectId: worldObjectIdSchema.optional(),
  damage: z.number().finite().nonnegative().optional(),
  state: combatStatusSchema.shape.state.optional(),
  resultingHealth: healthSchema.optional()
});

export const attackActionSchema = attackActionBaseSchema;

export const collectActionSchema = z.object({
  type: z.literal("collect"),
  objectId: worldObjectIdSchema,
  quantity: z.number().finite().nonnegative().optional(),
  resourceType: z.string().trim().min(1).max(64).optional()
});

export const archetypeActionSchema = z.object({
  type: z.literal("archetype"),
  archetype: archetypeKeySchema
});

export const playerActionSchema = z
  .discriminatedUnion("type", [
    comboActionSchema,
    deathActionSchema,
    movementActionSchema,
    attackActionBaseSchema,
    collectActionSchema,
    evolutionActionSchema,
    archetypeActionSchema
  ])
  .superRefine((value, ctx) => {
    if (value.type !== "attack") {
      return;
    }

    const kind = (value.kind ?? "basic") as AttackKind;
    const targetRequired = !TARGET_OPTIONAL_ATTACK_KINDS.has(kind);
    const hasTargetPlayer = value.targetPlayerId !== undefined && value.targetPlayerId !== null;
    const hasTargetObject = value.targetObjectId !== undefined && value.targetObjectId !== null;

    if (targetRequired && !hasTargetPlayer && !hasTargetObject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "attack_target_required",
        path: ["targetPlayerId"],
      });
    }
  });

export const actionMessageSchema = z.object({
  type: z.literal("action"),
  playerId: playerIdSchema,
  clientTime: z.number().finite().optional(),
  action: playerActionSchema
});

export const movementMessageSchema = movementActionSchema.extend({
  playerId: playerIdSchema,
  clientTime: z.number().finite().optional()
});

export const attackMessageSchema = attackActionBaseSchema.extend({
  playerId: playerIdSchema,
  clientTime: z.number().finite().optional()
});

export const collectMessageSchema = collectActionSchema.extend({
  playerId: playerIdSchema,
  clientTime: z.number().finite().optional()
});

export const clientMessageSchema = z
  .discriminatedUnion("type", [
    joinMessageSchema,
    actionMessageSchema,
    pingMessageSchema,
    movementMessageSchema,
    attackMessageSchema,
    collectMessageSchema
  ])
  .superRefine((value, ctx) => {
    if (value.type !== "attack") {
      return;
    }

    const kind = (value.kind ?? "basic") as AttackKind;
    const targetRequired = !TARGET_OPTIONAL_ATTACK_KINDS.has(kind);
    const hasTargetPlayer = value.targetPlayerId !== undefined && value.targetPlayerId !== null;
    const hasTargetObject = value.targetObjectId !== undefined && value.targetObjectId !== null;

    if (targetRequired && !hasTargetPlayer && !hasTargetObject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "attack_target_required",
        path: ["targetPlayerId"],
      });
    }
  });

export const joinedMessageSchema = z.object({
  type: z.literal("joined"),
  playerId: playerIdSchema,
  reconnectToken: reconnectTokenSchema,
  reconnectUntil: z.number().finite(),
  state: sharedGameStateSchema,
  ranking: z.array(rankingEntrySchema)
});

export const stateFullMessageSchema = z.object({
  type: z.literal("state"),
  mode: z.literal("full"),
  state: sharedGameStateSchema
});

export const stateDiffMessageSchema = z.object({
  type: z.literal("state"),
  mode: z.literal("diff"),
  state: sharedGameStateDiffSchema
});

export const stateMessageSchema = z.discriminatedUnion("mode", [
  stateFullMessageSchema,
  stateDiffMessageSchema
]);

export const pongMessageSchema = z.object({
  type: z.literal("pong"),
  ts: z.number().finite()
});

export const resetMessageSchema = z.object({
  type: z.literal("reset"),
  state: sharedGameStateSchema
});

export const upgradeRequiredMessageSchema = z.object({
  type: z.literal("upgrade_required"),
  minVersion: z.string().trim().min(1).max(MAX_VERSION_LENGTH)
});

export const errorMessageSchema = z.object({
  type: z.literal("error"),
  reason: z.union([
    z.literal("invalid_payload"),
    z.literal("invalid_name"),
    z.literal("name_taken"),
    z.literal("room_full"),
    z.literal("unknown_player"),
    z.literal("invalid_token"),
    z.literal("game_not_active"),
    z.literal("rate_limited")
  ]),
  retryAfterMs: z.number().nonnegative().optional()
});

export const serverMessageSchema = z.union([
  joinedMessageSchema,
  rankingMessageSchema,
  stateMessageSchema,
  pongMessageSchema,
  resetMessageSchema,
  upgradeRequiredMessageSchema,
  errorMessageSchema
]);

export type GamePhase = z.infer<typeof sharedGameStateSchema.shape.phase>;
export type Vector2 = z.infer<typeof vector2Schema>;
export type OrientationState = z.infer<typeof orientationSchema>;
export type HealthState = z.infer<typeof healthSchema>;
export type CombatStatus = z.infer<typeof combatStatusSchema>;
export type CombatAttributes = z.infer<typeof combatAttributesSchema>;
export type SharedPlayerState = z.infer<typeof sharedPlayerStateSchema>;
export type SharedGameState = z.infer<typeof sharedGameStateSchema>;
export type SharedGameStateDiff = z.infer<typeof sharedGameStateDiffSchema>;
export type SharedWorldState = z.infer<typeof sharedWorldStateSchema>;
export type SharedWorldStateDiff = z.infer<typeof sharedWorldStateDiffSchema>;
export type StatusEffectEvent = z.infer<typeof statusEffectEventSchema>;
export type CombatLogEntry = z.infer<typeof combatLogEntrySchema>;
export type Microorganism = z.infer<typeof microorganismSchema>;
export type OrganicMatter = z.infer<typeof organicMatterSchema>;
export type Obstacle = z.infer<typeof obstacleSchema>;
export type RoomObject = z.infer<typeof roomObjectSchema>;
export type WorldEntity = z.infer<typeof worldEntitySchema>;
export type RankingEntry = z.infer<typeof rankingEntrySchema>;
export type RankingMessage = z.infer<typeof rankingMessageSchema>;
export type JoinMessage = z.infer<typeof joinMessageSchema>;
export type PingMessage = z.infer<typeof pingMessageSchema>;
export type PlayerScoreAction = z.infer<typeof scoreActionSchema>;
export type PlayerComboAction = z.infer<typeof comboActionSchema>;
export type PlayerDeathAction = z.infer<typeof deathActionSchema>;
export type PlayerAbilityAction = z.infer<typeof abilityActionSchema>;
export type PlayerMovementAction = z.infer<typeof movementActionSchema>;
export type PlayerAttackAction = z.infer<typeof attackActionSchema>;
export type PlayerCollectAction = z.infer<typeof collectActionSchema>;
export type PlayerEvolutionAction = z.infer<typeof evolutionActionSchema>;
export type PlayerArchetypeAction = z.infer<typeof archetypeActionSchema>;
export type EvolutionTier = z.infer<typeof evolutionTierSchema>;
export type ArchetypeKey = z.infer<typeof archetypeKeySchema>;
export type PlayerAction = z.infer<typeof playerActionSchema>;
export type ActionMessage = z.infer<typeof actionMessageSchema>;
export type MovementMessage = z.infer<typeof movementMessageSchema>;
export type AttackMessage = z.infer<typeof attackMessageSchema>;
export type CollectMessage = z.infer<typeof collectMessageSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type JoinedMessage = z.infer<typeof joinedMessageSchema>;
export type StateFullMessage = z.infer<typeof stateFullMessageSchema>;
export type StateDiffMessage = z.infer<typeof stateDiffMessageSchema>;
export type StateMessage = z.infer<typeof stateMessageSchema>;
export type PongMessage = z.infer<typeof pongMessageSchema>;
export type ResetMessage = z.infer<typeof resetMessageSchema>;
export type UpgradeRequiredMessage = z.infer<typeof upgradeRequiredMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;

export const sanitizePlayerName = (name: string): string | null => {
  const result = playerNameSchema.safeParse(name);
  if (!result.success) {
    return null;
  }
  return result.data;
};

export const sanitizeAbilityId = (abilityId: string): string | null => {
  const result = abilityIdSchema.safeParse(abilityId);
  if (!result.success) {
    return null;
  }
  return result.data;
};

export const sanitizePlayerId = (playerId: string): string | null => {
  const result = playerIdSchema.safeParse(playerId);
  if (!result.success) {
    return null;
  }
  return result.data;
};

export const sanitizeArchetypeKey = (archetype: string): ArchetypeKey | null => {
  const normalized = typeof archetype === "string" ? archetype.trim() : archetype;
  const result = archetypeKeySchema.safeParse(normalized);
  if (!result.success) {
    return null;
  }
  return result.data;
};
