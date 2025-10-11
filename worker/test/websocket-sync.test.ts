import { describe, expect, it } from "vitest";
import { createMiniflare, onceMessage, openSocket, waitForRanking } from "./utils/miniflare";

describe("RoomDO integration", () => {
  it("synchronizes state and ranking across multiple clients", { timeout: 15000 }, async () => {
    const mf = await createMiniflare();

    try {
      const socketA = await openSocket(mf);
      const socketB = await openSocket(mf);

      const stateSyncA = onceMessage<{ type: string; mode: string }>(socketA, "state");
      const stateSyncB = onceMessage<{ type: string; mode: string }>(socketB, "state");

      const joinedPromiseA = onceMessage<{
        type: string;
        playerId: string;
        ranking: { playerId: string; score: number }[];
      }>(socketA, "joined");
      socketA.send(JSON.stringify({ type: "join", name: "Alice" }));
      const joinedA = await joinedPromiseA;

      const joinedPromiseB = onceMessage<{
        type: string;
        playerId: string;
        ranking: { playerId: string; score: number }[];
        state: { players: { id: string }[] };
      }>(socketB, "joined");
      socketB.send(JSON.stringify({ type: "join", name: "Bob" }));
      const joinedB = await joinedPromiseB;

      expect(joinedA.playerId).not.toBe(joinedB.playerId);
      expect(joinedB.state.players.length).toBeGreaterThanOrEqual(2);
      expect(joinedB.ranking.length).toBeGreaterThanOrEqual(2);

      await Promise.all([stateSyncA, stateSyncB]);

      const updatedRankingA = waitForRanking(
        socketA,
        (ranking) => ranking[0]?.playerId === joinedA.playerId && ranking[0]?.score >= 1000,
      );
      const updatedRankingB = waitForRanking(
        socketB,
        (ranking) => ranking[0]?.playerId === joinedA.playerId && ranking[0]?.score >= 1000,
      );

      socketA.send(
        JSON.stringify({
          type: "action",
          playerId: joinedA.playerId,
          action: { type: "score", amount: 500, comboMultiplier: 2 },
        }),
      );

      const [rankingA, rankingB] = await Promise.all([updatedRankingA, updatedRankingB]);

      expect(rankingA[0]).toMatchObject({ playerId: joinedA.playerId, score: 1000 });
      expect(rankingB[0]).toMatchObject({ playerId: joinedA.playerId, score: 1000 });

      socketA.close();
      socketB.close();
    } finally {
      await mf.dispose();
    }
  });
});
