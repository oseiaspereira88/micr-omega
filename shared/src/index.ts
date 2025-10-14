import { z } from "zod";

export const PROTOCOL_VERSION = "1.0.0" as const;

export const NAME_PATTERN = /^[\p{L}\p{N} _-]+$/u;
export const ABILITY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const MIN_NAME_LENGTH = 3;
export const MAX_NAME_LENGTH = 24;
export const MAX_PLAYER_ID_LENGTH = 64;
export const MAX_ABILITY_ID_LENGTH = 64;
export const MAX_VERSION_LENGTH = 16;
export const MAX_WORLD_OBJECT_ID_LENGTH = 64;

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

export const sharedPlayerStateSchema = z.object({
  id: playerIdSchema,
  name: playerNameSchema,
  connected: z.boolean(),
  score: z.number().finite(),
  combo: z.number().finite(),
  lastActiveAt: z.number().finite(),
  position: vector2Schema,
  movementVector: vector2Schema,
  orientation: orientationSchema,
  health: healthSchema,
  combatStatus: combatStatusSchema
});

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
    .default({})
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
  removeRoomObjectIds: z.array(worldObjectIdSchema).optional()
});

export const sharedGameStateSchema = z.object({
  phase: z.union([z.literal("waiting"), z.literal("active"), z.literal("ended")]),
  roundId: z.string().trim().min(1).max(64).nullable(),
  roundStartedAt: z.number().finite().nullable(),
  roundEndsAt: z.number().finite().nullable(),
  players: z.array(sharedPlayerStateSchema),
  world: sharedWorldStateSchema
});

export const sharedGameStateDiffSchema = z.object({
  phase: sharedGameStateSchema.shape.phase.optional(),
  roundId: sharedGameStateSchema.shape.roundId.optional(),
  roundStartedAt: sharedGameStateSchema.shape.roundStartedAt.optional(),
  roundEndsAt: sharedGameStateSchema.shape.roundEndsAt.optional(),
  upsertPlayers: z.array(sharedPlayerStateSchema).optional(),
  removedPlayerIds: z.array(playerIdSchema).optional(),
  world: sharedWorldStateDiffSchema.optional()
});

export const rankingEntrySchema = z.object({
  playerId: playerIdSchema,
  name: playerNameSchema,
  score: z.number().finite()
});

export const rankingMessageSchema = z.object({
  type: z.literal("ranking"),
  ranking: z.array(rankingEntrySchema)
});

export const joinMessageSchema = z.object({
  type: z.literal("join"),
  name: playerNameSchema,
  playerId: playerIdSchema.optional(),
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

export const movementActionSchema = z.object({
  type: z.literal("movement"),
  position: vector2Schema,
  movementVector: vector2Schema,
  orientation: orientationSchema
});

const attackActionBaseSchema = z.object({
  type: z.literal("attack"),
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

export const playerActionSchema = z
  .discriminatedUnion("type", [
    scoreActionSchema,
    comboActionSchema,
    deathActionSchema,
    abilityActionSchema,
    movementActionSchema,
    attackActionBaseSchema,
    collectActionSchema
  ])
  .superRefine((value, ctx) => {
    if (
      value.type === "attack" &&
      value.targetPlayerId === undefined &&
      value.targetObjectId === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "attack_target_required",
        path: ["targetPlayerId"]
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
    if (
      value.type === "attack" &&
      value.targetPlayerId === undefined &&
      value.targetObjectId === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "attack_target_required",
        path: ["targetPlayerId"]
      });
    }
  });

export const joinedMessageSchema = z.object({
  type: z.literal("joined"),
  playerId: playerIdSchema,
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
    z.literal("game_not_active"),
    z.literal("rate_limited")
  ]),
  retryAfterMs: z.number().nonnegative().optional()
});

export const playerJoinedMessageSchema = z.object({
  type: z.literal("player_joined"),
  playerId: playerIdSchema,
  name: playerNameSchema,
  state: sharedGameStateSchema
});

export const playerLeftMessageSchema = z.object({
  type: z.literal("player_left"),
  playerId: playerIdSchema,
  name: playerNameSchema,
  state: sharedGameStateSchema
});

export const serverMessageSchema = z.union([
  joinedMessageSchema,
  rankingMessageSchema,
  stateMessageSchema,
  pongMessageSchema,
  resetMessageSchema,
  upgradeRequiredMessageSchema,
  errorMessageSchema,
  playerJoinedMessageSchema,
  playerLeftMessageSchema
]);

export type GamePhase = z.infer<typeof sharedGameStateSchema.shape.phase>;
export type Vector2 = z.infer<typeof vector2Schema>;
export type OrientationState = z.infer<typeof orientationSchema>;
export type HealthState = z.infer<typeof healthSchema>;
export type CombatStatus = z.infer<typeof combatStatusSchema>;
export type SharedPlayerState = z.infer<typeof sharedPlayerStateSchema>;
export type SharedGameState = z.infer<typeof sharedGameStateSchema>;
export type SharedGameStateDiff = z.infer<typeof sharedGameStateDiffSchema>;
export type SharedWorldState = z.infer<typeof sharedWorldStateSchema>;
export type SharedWorldStateDiff = z.infer<typeof sharedWorldStateDiffSchema>;
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
export type PlayerJoinedMessage = z.infer<typeof playerJoinedMessageSchema>;
export type PlayerLeftMessage = z.infer<typeof playerLeftMessageSchema>;
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
