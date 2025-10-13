import { describe, expect, it } from "vitest";
import {
  createMiniflare,
  onceMessage,
  openSocket,
  type MessagePayload,
} from "./utils/miniflare";

describe("RoomDO", () => {
  it("responds with joined payload when a player joins", async () => {
    const mf = await createMiniflare();
    try {
      const socket = await openSocket(mf);
      const joinedPromise = onceMessage<{
        type: string;
        state: { players: { id: string; name: string }[] };
        ranking: { name: string; score: number }[];
      }>(socket, "joined");

      socket.send(JSON.stringify({ type: "join", name: "Alice" }));

      const joined = await joinedPromise;
      expect(joined.type).toBe("joined");
      expect(joined.state.players.some((player) => player.name === "Alice")).toBe(true);
      expect(joined.ranking).toEqual([
        {
          playerId: expect.any(String),
          name: "Alice",
          score: 0
        }
      ]);

      socket.close();
    } finally {
      await mf.dispose();
    }
  });

  it("allows joining with accented unicode characters", async () => {
    const mf = await createMiniflare();
    try {
      const socket = await openSocket(mf);
      const joinedPromise = onceMessage<{
        type: string;
        state: { players: { id: string; name: string }[] };
        ranking: { name: string; score: number }[];
      }>(socket, "joined");

      socket.send(JSON.stringify({ type: "join", name: "Álvaro" }));

      const joined = await joinedPromise;
      expect(joined.type).toBe("joined");
      expect(joined.state.players.some((player) => player.name === "Álvaro")).toBe(true);
      expect(joined.ranking).toEqual([
        {
          playerId: expect.any(String),
          name: "Álvaro",
          score: 0
        }
      ]);

      socket.close();
    } finally {
      await mf.dispose();
    }
  });

  it("rejects invalid player names", async () => {
    const mf = await createMiniflare();
    try {
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
          { once: true }
        );
      });
    } finally {
      await mf.dispose();
    }
  });
});
