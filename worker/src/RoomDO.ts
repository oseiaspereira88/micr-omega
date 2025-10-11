import type { Env } from "./index";

type RankingEntry = { name: string; score: number };
type StoredRanking = RankingEntry[];

type JoinMessage = { type: "join"; name: string };
type ClientMessage = JoinMessage;

type ErrorMessage = { type: "error"; reason: "invalid_name" | "name_taken" };
type JoinedMessage = {
  type: "joined";
  state: { players: string[] };
  ranking: RankingEntry[];
};
type PlayerJoinedMessage = {
  type: "player_joined";
  name: string;
  state: { players: string[] };
};
type PlayerLeftMessage = {
  type: "player_left";
  name: string;
  state: { players: string[] };
};
type ServerMessage = JoinedMessage | ErrorMessage | PlayerJoinedMessage | PlayerLeftMessage;

const NAME_PATTERN = /^[A-Za-z0-9 _-]+$/;
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 24;

export class RoomDO {
  private readonly state: DurableObjectState;
  private readonly clientsBySocket = new Map<WebSocket, string>();
  private readonly socketsByName = new Map<string, WebSocket>();
  private ranking = new Map<string, number>();
  private readonly ready: Promise<void>;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
    this.ready = this.initialize();
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    const url = new URL(request.url);

    if (url.pathname !== "/ws") {
      return new Response("Not Found", { status: 404 });
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const { 0: client, 1: server } = pair;
    server.accept();
    this.setupSession(server).catch((error) => {
      console.error("RoomDO session failed", error);
      try {
        server.close(1011, "internal_error");
      } catch (err) {
        console.error("Failed to close websocket after error", err);
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async initialize(): Promise<void> {
    const stored = await this.state.storage.get<StoredRanking>("ranking");
    if (stored) {
      this.ranking = new Map(stored.map(({ name, score }) => [name, score]));
    }
  }

  private async setupSession(socket: WebSocket): Promise<void> {
    let currentName: string | null = null;

    socket.addEventListener("message", (event) => {
      const data = typeof event.data === "string" ? event.data : String(event.data);
      let parsed: ClientMessage;
      try {
        parsed = JSON.parse(data) as ClientMessage;
      } catch {
        this.send(socket, { type: "error", reason: "invalid_name" });
        socket.close(1003, "invalid_payload");
        return;
      }

      if (parsed.type === "join") {
        void this.handleJoin(socket, parsed.name).then((name) => {
          currentName = name;
        });
      }
    });

    socket.addEventListener("close", () => {
      if (currentName) {
        this.clientsBySocket.delete(socket);
        this.socketsByName.delete(currentName);
        this.broadcast({
          type: "player_left",
          name: currentName,
          state: { players: this.currentPlayers() }
        });
      }
    });

    socket.addEventListener("error", () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CLOSING) {
        socket.close(1011, "error");
      }
    });
  }

  private async handleJoin(socket: WebSocket, rawName: unknown): Promise<string | null> {
    const name = this.normalizeName(rawName);

    if (!name || !this.isValidName(name)) {
      this.send(socket, { type: "error", reason: "invalid_name" });
      socket.close(1008, "invalid_name");
      return null;
    }

    if (this.socketsByName.has(name)) {
      this.send(socket, { type: "error", reason: "name_taken" });
      socket.close(1008, "name_taken");
      return null;
    }

    this.clientsBySocket.set(socket, name);
    this.socketsByName.set(name, socket);

    if (!this.ranking.has(name)) {
      this.ranking.set(name, 0);
      await this.persistRanking();
    }

    const joined: JoinedMessage = {
      type: "joined",
      state: { players: this.currentPlayers() },
      ranking: this.serializeRanking()
    };
    this.send(socket, joined);

    this.broadcast(
      {
        type: "player_joined",
        name,
        state: { players: this.currentPlayers() }
      },
      socket
    );

    return name;
  }

  private normalizeName(rawName: unknown): string | null {
    if (typeof rawName !== "string") {
      return null;
    }
    const trimmed = rawName.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private isValidName(name: string): boolean {
    if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
      return false;
    }
    return NAME_PATTERN.test(name);
  }

  private serializeRanking(): RankingEntry[] {
    return Array.from(this.ranking.entries())
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => {
        if (b.score === a.score) {
          return a.name.localeCompare(b.name);
        }
        return b.score - a.score;
      });
  }

  private currentPlayers(): string[] {
    return Array.from(this.socketsByName.keys()).sort((a, b) => a.localeCompare(b));
  }

  private async persistRanking(): Promise<void> {
    const snapshot: StoredRanking = this.serializeRanking();
    await this.state.storage.put("ranking", snapshot);
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
