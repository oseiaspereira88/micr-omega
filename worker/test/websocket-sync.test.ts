import { describe, expect, it } from "vitest";
import { createMiniflare, onceMessage, openSocket, waitForRanking } from "./utils/miniflare";

async function waitForPlayerStateDiff(
  socket: WebSocket,
  playerId: string,
  timeoutMs = 5000,
) {
  const deadline = Date.now() + timeoutMs;
  let remaining = timeoutMs;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (remaining <= 0) {
      throw new Error(`Timed out waiting for player ${playerId} state diff`);
    }

    let diff;
    try {
      diff = await onceMessage<{
        type: string;
        state: {
          upsertPlayers?: Array<{
            id: string;
            combatStatus?: {
              state: string | undefined;
              targetPlayerId: string | null;
              targetObjectId: string | null;
            };
          }>;
        };
      }>(socket, "state", remaining);
    } catch (error) {
      const remainingAfterError = deadline - Date.now();
      if (remainingAfterError <= 0) {
        throw error;
      }
      remaining = remainingAfterError;
      continue;
    }

    const updatedPlayer = diff.state.upsertPlayers?.find((entry) => entry.id === playerId);
    if (updatedPlayer) {
      return { diff, updatedPlayer };
    }

    remaining = deadline - Date.now();
  }
}

describe("RoomDO integration", () => {
  it("rejects unauthorized score actions and keeps ranking unchanged", { timeout: 20000 }, async () => {
    const mf = await createMiniflare();

    try {
      const socketA = await openSocket(mf);
      const socketB = await openSocket(mf);

      const stateSyncA = onceMessage<{ type: string }>(socketA, "state", 5000);
      const stateSyncB = onceMessage<{ type: string }>(socketB, "state", 5000);

      const joinedPromiseA = onceMessage<{
        type: string;
        playerId: string;
        state: {
          players: {
            id: string;
            score: number;
            movementVector: { x: number; y: number };
            position: { x: number; y: number };
            orientation: { angle: number; tilt?: number };
          }[];
        };
        ranking: { playerId: string; score: number }[];
      }>(socketA, "joined", 5000);
      socketA.send(JSON.stringify({ type: "join", name: "Alice" }));
      const joinedA = await joinedPromiseA;

      const joinedPromiseB = onceMessage<{ type: string; playerId: string }>(socketB, "joined", 5000);
      socketB.send(JSON.stringify({ type: "join", name: "Bob" }));
      await joinedPromiseB;

      await Promise.all([stateSyncA, stateSyncB]);

      const initialPlayer = joinedA.state.players.find((player) => player.id === joinedA.playerId);
      if (!initialPlayer) {
        throw new Error("Player state not found in joined payload");
      }

      const errorPromise = onceMessage<{ type: string; reason: string }>(socketA, "error", 5000);
      const rankingAttemptA = waitForRanking(
        socketA,
        (ranking) =>
          ranking.some(
            (entry) => entry.playerId === joinedA.playerId && entry.score !== initialPlayer.score,
          ),
        500,
      );
      const rankingAttemptB = waitForRanking(
        socketB,
        (ranking) =>
          ranking.some(
            (entry) => entry.playerId === joinedA.playerId && entry.score !== initialPlayer.score,
          ),
        500,
      );

      socketA.send(
        JSON.stringify({
          type: "action",
          playerId: joinedA.playerId,
          action: { type: "score", amount: 500, comboMultiplier: 2 },
        }),
      );

      const error = await errorPromise;
      expect(error).toMatchObject({ type: "error", reason: "invalid_payload" });

      await Promise.all([
        expect(rankingAttemptA).rejects.toThrow("Timed out waiting for ranking update"),
        expect(rankingAttemptB).rejects.toThrow("Timed out waiting for ranking update"),
      ]);

      socketA.close();
      socketB.close();
    } finally {
      await mf.dispose();
    }
  });

  it("clamps combo multipliers even when zero is provided", async () => {
    const mf = await createMiniflare();

    try {
      const socketA = await openSocket(mf);
      const socketB = await openSocket(mf);

      const stateSyncA = onceMessage<{ type: string }>(socketA, "state", 5000);
      const stateSyncB = onceMessage<{ type: string }>(socketB, "state", 5000);

      const joinedPromiseA = onceMessage<{ type: string; playerId: string }>(
        socketA,
        "joined",
        5000,
      );

      const joinedPromiseB = onceMessage<{ type: string; playerId: string }>(
        socketB,
        "joined",
        5000,
      );

      socketA.send(JSON.stringify({ type: "join", name: "Charlie" }));
      const joinedA = await joinedPromiseA;

      socketB.send(JSON.stringify({ type: "join", name: "Delta" }));
      await joinedPromiseB;

      await Promise.all([stateSyncA, stateSyncB]);

      const stateDiffPromise = onceMessage<{
        type: string;
        state: { upsertPlayers?: { id: string; combo: number }[] };
      }>(socketA, "state", 5000);

      socketA.send(
        JSON.stringify({
          type: "action",
          playerId: joinedA.playerId,
          action: { type: "combo", multiplier: 0 },
        }),
      );

      const stateDiff = await stateDiffPromise;
      const updatedPlayer = stateDiff.state.upsertPlayers?.find(
        (entry) => entry.id === joinedA.playerId,
      );
      expect(updatedPlayer?.combo).toBe(1);

      socketA.close();
      socketB.close();
    } finally {
      await mf.dispose();
    }
  });

  it("rejects unauthorized ability actions", { timeout: 20000 }, async () => {
    const mf = await createMiniflare();

    try {
      const socketA = await openSocket(mf);
      const socketB = await openSocket(mf);

      const stateSyncA = onceMessage<{ type: string }>(socketA, "state", 5000);
      const stateSyncB = onceMessage<{ type: string }>(socketB, "state", 5000);

      const joinedPromiseA = onceMessage<{
        type: string;
        playerId: string;
        state: {
          players: {
            id: string;
            score: number;
            movementVector: { x: number; y: number };
            position: { x: number; y: number };
            orientation: { angle: number; tilt?: number };
          }[];
        };
        ranking: { playerId: string; score: number }[];
      }>(socketA, "joined", 5000);
      socketA.send(JSON.stringify({ type: "join", name: "Eve" }));
      const joinedA = await joinedPromiseA;

      const joinedPromiseB = onceMessage<{ type: string; playerId: string }>(socketB, "joined", 5000);
      socketB.send(JSON.stringify({ type: "join", name: "Frank" }));
      await joinedPromiseB;

      await Promise.all([stateSyncA, stateSyncB]);

      const initialPlayer = joinedA.state.players.find((player) => player.id === joinedA.playerId);
      if (!initialPlayer) {
        throw new Error("Player state not found in joined payload");
      }

      const errorPromise = onceMessage<{ type: string; reason: string }>(socketA, "error", 5000);
      const rankingAttemptA = waitForRanking(
        socketA,
        (ranking) =>
          ranking.some(
            (entry) => entry.playerId === joinedA.playerId && entry.score !== initialPlayer.score,
          ),
        500,
      );
      const rankingAttemptB = waitForRanking(
        socketB,
        (ranking) =>
          ranking.some(
            (entry) => entry.playerId === joinedA.playerId && entry.score !== initialPlayer.score,
          ),
        500,
      );

      socketA.send(
        JSON.stringify({
          type: "action",
          playerId: joinedA.playerId,
          action: { type: "ability", abilityId: "dash", value: 100 },
        }),
      );

      const error = await errorPromise;
      expect(error).toMatchObject({ type: "error", reason: "invalid_payload" });

      await Promise.all([
        expect(rankingAttemptA).rejects.toThrow("Timed out waiting for ranking update"),
        expect(rankingAttemptB).rejects.toThrow("Timed out waiting for ranking update"),
      ]);

      socketA.close();
      socketB.close();
    } finally {
      await mf.dispose();
    }
  });

  it("accepts dash attacks without explicit targets", async () => {
    const mf = await createMiniflare();

    try {
      const socket = await openSocket(mf);

      const joinedPromise = onceMessage<{
        type: string;
        playerId: string;
      }>(socket, "joined", 5000);
      socket.send(JSON.stringify({ type: "join", name: "Gina" }));
      const joined = await joinedPromise;

      await onceMessage<{ type: string }>(socket, "state", 5000);

      const stateDiffPromise = waitForPlayerStateDiff(socket, joined.playerId, 5000);

      const errorPromise = onceMessage<{ type: string }>(socket, "error", 500).catch(
        (err) => err as Error,
      );

      socket.send(
        JSON.stringify({
          type: "attack",
          playerId: joined.playerId,
          kind: "dash",
          clientTime: Date.now(),
        }),
      );

      const { diff: stateDiff, updatedPlayer } = await stateDiffPromise;

      expect(updatedPlayer?.combatStatus?.state).toBe("engaged");
      expect(updatedPlayer?.combatStatus?.targetPlayerId).toBeNull();
      expect(updatedPlayer?.combatStatus?.targetObjectId).toBeNull();

      const errorResult = await errorPromise;
      expect(errorResult).toBeInstanceOf(Error);
      expect((errorResult as Error).message).toContain("Timed out waiting for error message");

      socket.close();
    } finally {
      await mf.dispose();
    }
  });
});
