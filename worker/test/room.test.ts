import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Miniflare } from "miniflare";
import { build } from "esbuild";

type MessagePayload = { type: string; [key: string]: unknown };

describe("RoomDO", () => {
  let mf: Miniflare | null = null;

  async function createMiniflare(): Promise<Miniflare> {
    const bundle = await build({
      entryPoints: ["src/index.ts"],
      bundle: true,
      format: "esm",
      platform: "neutral",
      target: "es2022",
      mainFields: ["module", "main"],
      write: false,
      sourcemap: "inline"
    });

    const script = bundle.outputFiles[0]?.text ?? "";

    return new Miniflare({
      modules: true,
      script,
      compatibilityDate: "2024-10-01",
      durableObjects: {
        ROOM: { className: "RoomDO" }
      }
    });
  }

  async function openSocket(instance: Miniflare) {
    const response = await instance.dispatchFetch("http://localhost/ws", {
      headers: { Upgrade: "websocket" }
    });
    expect(response.status).toBe(101);
    const socket = response.webSocket;
    expect(socket).toBeDefined();
    socket!.accept();
    return socket!;
  }

  function onceMessage<T extends MessagePayload>(socket: WebSocket, type?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.removeEventListener("message", onMessage as EventListener);
        reject(new Error("Timed out waiting for message"));
      }, 1000);

      const onMessage = (event: MessageEvent) => {
        const data = typeof event.data === "string" ? event.data : String(event.data);
        const parsed = JSON.parse(data) as T;
        if (!type || parsed.type === type) {
          clearTimeout(timeout);
          socket.removeEventListener("message", onMessage as EventListener);
          resolve(parsed);
        }
      };

      socket.addEventListener("message", onMessage as EventListener);
    });
  }

  const createClient = async () => {
    const socket = await openSocket(mf!);
    const queue: MessagePayload[] = [];
    socket.addEventListener("message", (event: MessageEvent) => {
      const data = typeof event.data === "string" ? event.data : String(event.data);
      queue.push(JSON.parse(data));
    });

    return {
      socket,
      drain: <T extends MessagePayload>(predicate: (payload: T) => boolean, timeout = 2_000) =>
        new Promise<T>((resolve, reject) => {
          const start = Date.now();

          const checkQueue = () => {
            while (queue.length > 0) {
              const item = queue.shift() as T;
              if (predicate(item)) {
                resolve(item);
                return;
              }
            }

            if (Date.now() - start > timeout) {
              reject(new Error("Timed out waiting for message"));
              return;
            }

            setTimeout(checkQueue, 10);
          };

          checkQueue();
        })
    };
  };

  beforeEach(async () => {
    mf = await createMiniflare();
  });

  afterEach(async () => {
    if (mf) {
      await mf.dispose();
      mf = null;
    }
  });

  it("responds with joined payload when a player joins", async () => {
    const socket = await openSocket(mf!);
    const joinedPromise = onceMessage<{
      type: string;
      playerId: string;
      state: { players: { id: string; name: string }[] };
      ranking: { playerId: string; name: string; score: number }[];
    }>(socket, "joined");

    socket.send(JSON.stringify({ type: "join", name: "Alice" }));

    const joined = await joinedPromise;
    expect(joined.type).toBe("joined");
    expect(joined.playerId).toMatch(/[a-f0-9-]+/);
    expect(joined.state.players.some((player) => player.name === "Alice")).toBe(true);
    expect(joined.ranking).toEqual([
      {
        playerId: joined.playerId,
        name: "Alice",
        score: 0
      }
    ]);

    socket.close();
  });

  it("rejects invalid player names", async () => {
    const socket = await openSocket(mf!);
    const errorPromise = onceMessage<{ type: string; reason: string }>(socket, "error");

    socket.send(JSON.stringify({ type: "join", name: "!!" }));

    const error = await errorPromise;
    expect(error.type).toBe("error");
    expect(error.reason).toBe("invalid_name");

    await new Promise<void>((resolve) => {
      socket.addEventListener(
        "close",
        () => {
          resolve();
        },
        { once: true }
      );
    });
  });

  it("synchronizes state and ranking across multiple clients", async () => {
    const clientA = await createClient();
    const joinAPromise = onceMessage<{
      type: string;
      playerId: string;
      ranking: { playerId: string; name: string; score: number }[];
    }>(clientA.socket, "joined");

    clientA.socket.send(JSON.stringify({ type: "join", name: "Alice" }));

    const alice = await joinAPromise;
    expect(alice.ranking).toHaveLength(1);

    const clientB = await createClient();
    const joinBPromise = onceMessage<{
      type: string;
      playerId: string;
      state: { players: { name: string }[] };
      ranking: { name: string }[];
    }>(clientB.socket, "joined");

    clientB.socket.send(JSON.stringify({ type: "join", name: "Bob" }));

    const joinedB = await joinBPromise;

    expect(joinedB.state.players.map((player) => player.name)).toEqual([
      "Alice",
      "Bob"
    ]);
    expect(joinedB.ranking.map((entry) => entry.name)).toEqual(["Alice", "Bob"]);

    const broadcastToAlice = await clientA.drain<{ type: string; ranking: { name: string }[] }>(
      (payload) => payload.type === "ranking" && payload.ranking.length === 2
    );
    expect(broadcastToAlice.ranking.map((entry) => entry.name)).toEqual(["Alice", "Bob"]);

    clientA.socket.close();
    clientB.socket.close();
  });

  it("updates ranking when score actions are processed", async () => {
    const clientA = await createClient();
    const joinAPromise = onceMessage<{ type: string; playerId: string }>(clientA.socket, "joined");
    clientA.socket.send(JSON.stringify({ type: "join", name: "Alice" }));
    const joinedA = await joinAPromise;

    const clientB = await createClient();
    const joinBPromise = onceMessage(clientB.socket, "joined");
    clientB.socket.send(JSON.stringify({ type: "join", name: "Bob" }));
    await joinBPromise;

    await clientA.drain((payload: MessagePayload) => payload.type === "state");

    const rankingUpdateA = clientA.drain<{ type: string; ranking: { playerId: string; score: number }[] }>(
      (payload) => payload.type === "ranking" && payload.ranking[0]?.score === 5_000
    );
    const rankingUpdateB = clientB.drain<{ type: string; ranking: { playerId: string; score: number }[] }>(
      (payload) => payload.type === "ranking" && payload.ranking[0]?.score === 5_000
    );

    clientA.socket.send(
      JSON.stringify({
        type: "action",
        playerId: joinedA.playerId,
        action: { type: "score", amount: 5_000 }
      })
    );

    const [rankingA, rankingB] = await Promise.all([rankingUpdateA, rankingUpdateB]);

    expect(rankingA.ranking[0]).toMatchObject({ playerId: joinedA.playerId, score: 5_000 });
    expect(rankingB.ranking[0]).toMatchObject({ playerId: joinedA.playerId, score: 5_000 });

    clientA.socket.close();
    clientB.socket.close();
  });
});
