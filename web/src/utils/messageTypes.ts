export type GamePhase = "waiting" | "active" | "ended";

export type SharedPlayerState = {
  id: string;
  name: string;
  connected: boolean;
  score: number;
  combo: number;
  lastActiveAt: number;
};

export type SharedGameState = {
  phase: GamePhase;
  roundId: string | null;
  roundStartedAt: number | null;
  roundEndsAt: number | null;
  players: SharedPlayerState[];
};

export type SharedGameStateDiff = {
  phase?: GamePhase;
  roundId?: string | null;
  roundStartedAt?: number | null;
  roundEndsAt?: number | null;
  upsertPlayers?: SharedPlayerState[];
  removedPlayerIds?: string[];
};

export type RankingEntry = {
  playerId: string;
  name: string;
  score: number;
};

export type RankingMessage = {
  type: "ranking";
  ranking: RankingEntry[];
};

export type JoinMessage = {
  type: "join";
  name: string;
  playerId?: string;
  version?: string;
};

export type PingMessage = {
  type: "ping";
  ts: number;
};

export type PlayerScoreAction = {
  type: "score";
  amount: number;
  comboMultiplier?: number;
};

export type PlayerComboAction = {
  type: "combo";
  multiplier: number;
};

export type PlayerDeathAction = {
  type: "death";
};

export type PlayerAbilityAction = {
  type: "ability";
  abilityId: string;
  value?: number;
};

export type PlayerAction =
  | PlayerScoreAction
  | PlayerComboAction
  | PlayerDeathAction
  | PlayerAbilityAction;

export type ActionMessage = {
  type: "action";
  playerId: string;
  action: PlayerAction;
  clientTime?: number;
};

export type ClientMessage = JoinMessage | ActionMessage | PingMessage;

export type JoinedMessage = {
  type: "joined";
  playerId: string;
  reconnectUntil: number;
  state: SharedGameState;
  ranking: RankingEntry[];
};

export type StateFullMessage = {
  type: "state";
  mode: "full";
  state: SharedGameState;
};

export type StateDiffMessage = {
  type: "state";
  mode: "diff";
  state: SharedGameStateDiff;
};

export type StateMessage = StateFullMessage | StateDiffMessage;

export type PongMessage = {
  type: "pong";
  ts: number;
};

export type ResetMessage = {
  type: "reset";
  state: SharedGameState;
};

export type UpgradeRequiredMessage = {
  type: "upgrade_required";
  minVersion: string;
};

export type ErrorMessage = {
  type: "error";
  reason:
    | "invalid_payload"
    | "invalid_name"
    | "name_taken"
    | "unknown_player"
    | "game_not_active";
};

export type PlayerJoinedMessage = {
  type: "player_joined";
  playerId: string;
  name: string;
  state: SharedGameState;
};

export type PlayerLeftMessage = {
  type: "player_left";
  playerId: string;
  name: string;
  state: SharedGameState;
};

export type ServerMessage =
  | JoinedMessage
  | StateMessage
  | RankingMessage
  | PongMessage
  | ResetMessage
  | UpgradeRequiredMessage
  | ErrorMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage;
