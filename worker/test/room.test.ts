import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Miniflare } from "miniflare";
import {
  createMiniflare,
  onceMessage,
  openSocket,
  waitForRanking,
  type MessagePayload,
} from "./utils/miniflare";

describe("RoomDO", () => {
  let mf: Miniflare;

  const createClient = async () => {
    const socket = await openSocket(mf);
    const queue: MessagePayload[] = [];

    socket.addEventListener("message", (event: MessageEvent) => {
      const data = typeof event.data === "string" ? event.data : String(event.data);
      queue.push(JSON.parse(data));
    });

    return {
      socket,
      drain<T extends MessagePayload>(predicate: (payload: T) => boolean, timeout = 2_000) {
        return new Promise<T>((resolve, reject) => {
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
        });
      },
    };
  };

  beforeEach(async () => {
    mf = await createMiniflare();
  });

  afterEach(async () => {
    await mf.dispose();
  });

  it("responds with joined payload when a player joins", async () => {
    const socket = await openSocket(mf);
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
        score: 0,
      },
    ]);

    socket.close();
  });

  it("rejects invalid player names", async () => {
    const socket = await openSocket(mf);
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
        { once: true },
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
      "Bob",
    ]);
    expect(joinedB.ranking.map((entry) => entry.name)).toEqual(["Alice", "Bob"]);

    const broadcastToAlice = await clientA.drain<{ type: string; ranking: { name: string }[] }>(
      (payload) => payload.type === "ranking" && Array.isArray(payload.ranking) && payload.ranking.length === 2,
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

    await clientA.drain((payload) => payload.type === "state");

    const rankingUpdateA = waitForRanking(
      clientA.socket,
      (ranking) => ranking[0]?.score === 5_000,
    );
    const rankingUpdateB = waitForRanking(
      clientB.socket,
      (ranking) => ranking[0]?.score === 5_000,
    );

    clientA.socket.send(
      JSON.stringify({
        type: "action",
        playerId: joinedA.playerId,
        action: { type: "score", amount: 5_000 },
      }),
    );

    const [rankingA, rankingB] = await Promise.all([rankingUpdateA, rankingUpdateB]);

    expect(rankingA[0]).toMatchObject({ playerId: joinedA.playerId, score: 5_000 });
    expect(rankingB[0]).toMatchObject({ playerId: joinedA.playerId, score: 5_000 });

    clientA.socket.close();
    clientB.socket.close();
  });
});
