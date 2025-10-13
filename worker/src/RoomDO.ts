import type { Env } from "./index";
import { createObservability, serializeError, type Observability } from "./observability";
import {
  PROTOCOL_VERSION,
  clientMessageSchema,
  joinMessageSchema,
  actionMessageSchema,
  sanitizePlayerName,
  type ActionMessage,
  type ClientMessage,
  type GamePhase,
  type JoinedMessage,
  type JoinMessage,
  type PlayerAction,
  type PlayerLeftMessage,
  type PlayerJoinedMessage,
  type PongMessage,
  type RankingEntry,
  type RankingMessage,
  type ResetMessage,
  type ErrorMessage,
  type ServerMessage,
  type SharedGameState,
  type SharedGameStateDiff,
  type StateDiffMessage,
  type StateFullMessage
} from "./types";

const MIN_PLAYERS_TO_START = 2;
const WAITING_START_DELAY_MS = 15_000;
const ROUND_DURATION_MS = 120_000;
const RESET_DELAY_MS = 10_000;
const RECONNECT_WINDOW_MS = 30_000;
const INACTIVE_TIMEOUT_MS = 45_000;

const MAX_SCORE_DELTA = 5_000;
const MAX_COMBO_MULTIPLIER = 50;

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_MESSAGES_PER_CONNECTION = 120;
const MAX_MESSAGES_GLOBAL = 600;

const PLAYERS_KEY = "players";
const ALARM_KEY = "alarms";

const SUPPORTED_CLIENT_VERSIONS = new Set([PROTOCOL_VERSION]);

class MessageRateLimiter {
  private timestamps: number[] = [];

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  consume(now: number): boolean {
    this.prune(now);
    if (this.timestamps.length >= this.limit) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }

  getRetryAfterMs(now: number): number {
    this.prune(now);
    const earliest = this.timestamps[0];
    if (earliest === undefined) {
      return 0;
    }
    return Math.max(0, earliest + this.windowMs - now);
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0]! <= cutoff) {
      this.timestamps.shift();
    }
  }
}

type AlarmType = "waiting_start" | "round_end" | "reset" | "cleanup";

type AlarmSnapshot = Record<AlarmType, number | null>;

type StoredPlayer = {
  id: string;
  name: string;
  score: number;
  combo: number;
  totalSessionDurationMs?: number;
  sessionCount?: number;
};

type PlayerInternal = StoredPlayer & {
  connected: boolean;
  lastActiveAt: number;
  lastSeenAt: number;
  connectedAt: number | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class RoomDO {
  private readonly state: DurableObjectState;
  private readonly ready: Promise<void>;
  private readonly observability: Observability;

  private readonly clientsBySocket = new Map<WebSocket, string>();
  private readonly socketsByPlayer = new Map<string, WebSocket>();
  private readonly players = new Map<string, PlayerInternal>();
  private readonly nameToPlayerId = new Map<string, string>();
  private readonly connectionRateLimiters = new WeakMap<WebSocket, MessageRateLimiter>();
  private readonly globalRateLimiter = new MessageRateLimiter(
    MAX_MESSAGES_GLOBAL,
    RATE_LIMIT_WINDOW_MS
  );

  private phase: GamePhase = "waiting";
  private roundId: string | null = null;
  private roundStartedAt: number | null = null;
  private roundEndsAt: number | null = null;

  private alarmSchedule: Map<AlarmType, number> = new Map();

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

    if (!isSupportedRoute) {
      return new Response("Not Found", { status: 404 });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
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

    return new Response(null, { status: 101, webSocket: client });
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
      await this.syncAlarms();
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
      }
    }

    await this.persistAlarms();
    await this.syncAlarms();
  }

  private getConnectionLimiter(socket: WebSocket): MessageRateLimiter {
    let limiter = this.connectionRateLimiters.get(socket);
    if (!limiter) {
      limiter = new MessageRateLimiter(MAX_MESSAGES_PER_CONNECTION, RATE_LIMIT_WINDOW_MS);
      this.connectionRateLimiters.set(socket, limiter);
    }
    return limiter;
  }

  private handleRateLimit(
    socket: WebSocket,
    scope: "connection" | "global",
    retryAfterMs: number,
    playerId: string | null
  ): void {
    const errorMessage: ErrorMessage = {
      type: "error",
      reason: "rate_limited",
      ...(retryAfterMs > 0 ? { retryAfterMs } : {})
    };

    this.send(socket, errorMessage);

    this.observability.log(scope === "connection" ? "warn" : "error", "rate_limited", {
      scope,
      playerId,
      retryAfterMs,
      category: "protocol_error"
    });
    this.observability.recordMetric("protocol_errors", 1, {
      type: "rate_limited",
      scope
    });

    socket.close(1013, "rate_limited");
  }

  private async initialize(): Promise<void> {
    const storedPlayers = await this.state.storage.get<StoredPlayer[]>(PLAYERS_KEY);
    if (storedPlayers) {
      const now = Date.now();
      for (const stored of storedPlayers) {
        const player: PlayerInternal = {
          ...stored,
          connected: false,
          lastActiveAt: now,
          lastSeenAt: now,
          connectedAt: null,
          totalSessionDurationMs: stored.totalSessionDurationMs ?? 0,
          sessionCount: stored.sessionCount ?? 0
        };
        this.players.set(player.id, player);
        this.nameToPlayerId.set(player.name.toLowerCase(), player.id);
      }
    }

    const storedAlarms = await this.state.storage.get<AlarmSnapshot>(ALARM_KEY);
    if (storedAlarms) {
      this.alarmSchedule = new Map(
        (Object.entries(storedAlarms) as [AlarmType, number | null][]).filter(([, ts]) => ts != null)
      );
    }

    await this.syncAlarms();
  }

  private async setupSession(socket: WebSocket): Promise<void> {
    let playerId: string | null = null;

    socket.addEventListener("message", (event) => {
      const data = typeof event.data === "string" ? event.data : String(event.data);
      const now = Date.now();

      const perConnectionLimiter = this.getConnectionLimiter(socket);
      if (!perConnectionLimiter.consume(now)) {
        const retryAfter = perConnectionLimiter.getRetryAfterMs(now);
        const knownPlayerId = playerId ?? this.clientsBySocket.get(socket) ?? null;
        this.handleRateLimit(socket, "connection", retryAfter, knownPlayerId);
        return;
      }

      if (!this.globalRateLimiter.consume(now)) {
        const retryAfter = this.globalRateLimiter.getRetryAfterMs(now);
        const knownPlayerId = playerId ?? this.clientsBySocket.get(socket) ?? null;
        this.handleRateLimit(socket, "global", retryAfter, knownPlayerId);
        return;
      }

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

      switch (parsed.type) {
        case "join":
          void this.handleJoin(socket, parsed).then((result) => {
            if (result) {
              playerId = result;
            }
          });
          break;
        case "action": {
          const knownId = playerId ?? this.clientsBySocket.get(socket);
          if (!knownId || knownId !== parsed.playerId) {
            this.send(socket, { type: "error", reason: "unknown_player" });
            return;
          }
          void this.handleActionMessage(parsed, socket);
          break;
        }
        case "ping":
          void this.handlePing(socket, parsed.ts);
          break;
      }
    });

    socket.addEventListener("close", () => {
      if (playerId) {
        void this.handleDisconnect(socket, playerId);
      }
      this.clientsBySocket.delete(socket);
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

    let player = payload.playerId ? this.players.get(payload.playerId) : undefined;
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
      if (existing && (existing.connected || now - existing.lastSeenAt <= RECONNECT_WINDOW_MS)) {
        this.send(socket, { type: "error", reason: "name_taken" });
        socket.close(1008, "name_taken");
        return null;
      }
    }

    if (!player) {
      const id = crypto.randomUUID();
      player = {
        id,
        name: normalizedName,
        score: 0,
        combo: 1,
        connected: true,
        lastActiveAt: now,
        lastSeenAt: now,
        connectedAt: now,
        totalSessionDurationMs: 0,
        sessionCount: 0
      };
      this.players.set(id, player);
      this.nameToPlayerId.set(nameKey, id);
    } else {
      const previousKey = player.name.toLowerCase();
      if (previousKey !== nameKey && this.nameToPlayerId.get(previousKey) === player.id) {
        this.nameToPlayerId.delete(previousKey);
      }
      player.name = normalizedName;
      player.connected = true;
      player.lastSeenAt = now;
      player.lastActiveAt = now;
      player.connectedAt = now;
      this.players.set(player.id, player);
      this.nameToPlayerId.set(nameKey, player.id);
    }

    this.clientsBySocket.set(socket, player.id);
    this.socketsByPlayer.set(player.id, socket);

    await this.persistPlayers();

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

    const joinedMessage: JoinedMessage = {
      type: "joined",
      playerId: player.id,
      reconnectUntil,
      state: this.serializeGameState(),
      ranking: this.getRanking()
    };

    this.send(socket, joinedMessage);

    const joinBroadcast: PlayerJoinedMessage = {
      type: "player_joined",
      playerId: player.id,
      name: player.name,
      state: this.serializeGameState()
    };

    this.broadcast(joinBroadcast, socket);

    const rankingMessage: RankingMessage = {
      type: "ranking",
      ranking: this.getRanking()
    };

    this.broadcast(rankingMessage, socket);

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

    const now = Date.now();
    player.lastSeenAt = now;
    player.lastActiveAt = now;

    if (!player.connected) {
      player.connected = true;
      player.connectedAt = now;
      const playerSocket = this.socketsByPlayer.get(player.id);
      if (playerSocket && playerSocket !== socket) {
        try {
          playerSocket.close(1008, "session_taken");
        } catch (error) {
          this.observability.log("warn", "close_stale_socket_failed", {
            playerId: player.id,
            error: serializeError(error)
          });
        }
      }
      this.socketsByPlayer.set(player.id, socket);
    }

    if (this.phase !== "active") {
      this.send(socket, { type: "error", reason: "game_not_active" });
      return;
    }

    const result = this.applyPlayerAction(player, payload.action);
    if (!result) {
      this.send(socket, { type: "error", reason: "invalid_payload" });
      return;
    }

    await this.persistPlayers();

    const diff: SharedGameStateDiff = {
      upsertPlayers: [this.serializePlayer(player)]
    };

    const stateMessage: StateDiffMessage = {
      type: "state",
      mode: "diff",
      state: diff
    };

    this.broadcast(stateMessage);

    const rankingMessage: RankingMessage = {
      type: "ranking",
      ranking: this.getRanking()
    };

    this.broadcast(rankingMessage);
  }

  private applyPlayerAction(player: PlayerInternal, action: PlayerAction): boolean {
    switch (action.type) {
      case "score": {
        const amount = clamp(Math.round(action.amount), -MAX_SCORE_DELTA, MAX_SCORE_DELTA);
        const combo =
          action.comboMultiplier !== undefined
            ? clamp(action.comboMultiplier, 1, MAX_COMBO_MULTIPLIER)
            : player.combo;
        const delta = amount * combo;
        player.score = Math.max(0, player.score + delta);
        player.combo = combo;
        return true;
      }
      case "combo": {
        const multiplier = clamp(action.multiplier, 1, MAX_COMBO_MULTIPLIER);
        player.combo = multiplier;
        return true;
      }
      case "death": {
        player.combo = 1;
        return true;
      }
      case "ability": {
        const value =
          action.value !== undefined
            ? clamp(Math.round(action.value), -MAX_SCORE_DELTA, MAX_SCORE_DELTA)
            : 0;
        if (value !== 0) {
          player.score = Math.max(0, player.score + value);
        }
        return true;
      }
      default:
        return false;
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
    const player = this.players.get(playerId);
    if (!player) {
      return;
    }

    this.socketsByPlayer.delete(playerId);

    player.connected = false;
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

    await this.persistPlayers();

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
    await this.resetGame();
  }

  private async handleCleanupAlarm(): Promise<void> {
    const scheduled = this.alarmSchedule.get("cleanup");
    if (!scheduled) {
      return;
    }

    this.alarmSchedule.delete("cleanup");
    await this.cleanupInactivePlayers(Date.now());
  }

  private async maybeStartGame(): Promise<void> {
    if (this.phase !== "waiting") {
      return;
    }

    const activePlayers = Array.from(this.players.values()).filter((player) => player.connected);

    if (activePlayers.length === 0) {
      if (this.alarmSchedule.has("waiting_start")) {
        this.alarmSchedule.delete("waiting_start");
        await this.persistAlarms();
        await this.syncAlarms();
      }
      return;
    }

    if (activePlayers.length >= MIN_PLAYERS_TO_START) {
      await this.startGame();
      return;
    }

    if (!this.alarmSchedule.has("waiting_start")) {
      const at = Date.now() + WAITING_START_DELAY_MS;
      this.alarmSchedule.set("waiting_start", at);
      await this.persistAlarms();
      await this.syncAlarms();
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
      await this.persistAlarms();
      await this.syncAlarms();
      return;
    }

    this.phase = "active";
    this.roundId = crypto.randomUUID();
    this.roundStartedAt = Date.now();
    this.roundEndsAt = this.roundStartedAt + ROUND_DURATION_MS;
    this.alarmSchedule.delete("waiting_start");
    this.alarmSchedule.set("round_end", this.roundEndsAt);
    await this.persistAlarms();
    await this.syncAlarms();

    const stateMessage: StateFullMessage = {
      type: "state",
      mode: "full",
      state: this.serializeGameState()
    };

    this.broadcast(stateMessage);

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
    this.roundEndsAt = Date.now();
    this.alarmSchedule.delete("round_end");
    this.alarmSchedule.set("reset", Date.now() + RESET_DELAY_MS);
    await this.persistAlarms();
    await this.syncAlarms();

    const stateMessage: StateFullMessage = {
      type: "state",
      mode: "full",
      state: this.serializeGameState()
    };

    const rankingMessage: RankingMessage = {
      type: "ranking",
      ranking: this.getRanking()
    };

    const resetMessage: ResetMessage = {
      type: "reset",
      state: this.serializeGameState()
    };

    this.broadcast(stateMessage);
    this.broadcast(rankingMessage);
    this.broadcast(resetMessage);

    if (reason === "completed") {
      await this.persistPlayers();
    }

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

    for (const player of this.players.values()) {
      player.combo = 1;
      player.lastActiveAt = Date.now();
    }

    this.alarmSchedule.delete("reset");
    await this.persistAlarms();
    await this.syncAlarms();

    await this.persistPlayers();

    const message: StateFullMessage = {
      type: "state",
      mode: "full",
      state: this.serializeGameState()
    };

    this.broadcast(message);

    await this.maybeStartGame();
  }

  private serializePlayer(player: PlayerInternal) {
    return {
      id: player.id,
      name: player.name,
      connected: player.connected,
      score: player.score,
      combo: player.combo,
      lastActiveAt: player.lastActiveAt
    };
  }

  private serializeGameState(): SharedGameState {
    const players = Array.from(this.players.values())
      .map((player) => this.serializePlayer(player))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      phase: this.phase,
      roundId: this.roundId,
      roundStartedAt: this.roundStartedAt,
      roundEndsAt: this.roundEndsAt,
      players
    };
  }

  private getRanking(): RankingEntry[] {
    return Array.from(this.players.values())
      .map<RankingEntry>((player) => ({
        playerId: player.id,
        name: player.name,
        score: player.score
      }))
      .sort((a, b) => {
        if (b.score === a.score) {
          return a.name.localeCompare(b.name);
        }
        return b.score - a.score;
      });
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

  private async removePlayer(playerId: string, reason: "expired" | "inactive"): Promise<void> {
    const player = this.players.get(playerId);
    if (!player) {
      return;
    }

    this.players.delete(playerId);
    const nameKey = player.name.toLowerCase();
    if (this.nameToPlayerId.get(nameKey) === playerId) {
      this.nameToPlayerId.delete(nameKey);
    }
    this.socketsByPlayer.delete(playerId);
    for (const [socket, id] of this.clientsBySocket.entries()) {
      if (id === playerId) {
        this.clientsBySocket.delete(socket);
      }
    }

    await this.persistPlayers();

    const leftMessage: PlayerLeftMessage = {
      type: "player_left",
      playerId: player.id,
      name: player.name,
      state: this.serializeGameState()
    };

    this.broadcast(leftMessage);

    this.observability.log("info", "player_removed", {
      playerId: player.id,
      name: player.name,
      reason,
      totalSessionDurationMs: player.totalSessionDurationMs ?? 0,
      sessionCount: player.sessionCount ?? 0
    });

    if (this.phase === "active" && this.countConnectedPlayers() === 0) {
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

    await this.persistAlarms();
    await this.syncAlarms();
  }

  private async persistPlayers(): Promise<void> {
    const snapshot: StoredPlayer[] = Array.from(this.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      combo: player.combo,
      totalSessionDurationMs: player.totalSessionDurationMs ?? 0,
      sessionCount: player.sessionCount ?? 0
    }));
    await this.state.storage.put(PLAYERS_KEY, snapshot);
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
    for (const socket of this.clientsBySocket.keys()) {
      if (socket === except) continue;
      if (socket.readyState === WebSocket.OPEN) {
        this.send(socket, message);
      }
    }
  }

  private send(socket: WebSocket, message: ServerMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}
