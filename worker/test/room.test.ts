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

  it("starts a solo session immediately and accepts movement actions", async () => {
    const mf = await createMiniflare();
    try {
      const socket = await openSocket(mf);
      const joinedPromise = onceMessage<{
        type: string;
        playerId: string;
      }>(socket, "joined", 5000);

      const stateMessages: { type: string; mode: string; state: any }[] = [];
      const onStateMessage = (event: MessageEvent) => {
        const data = typeof event.data === "string" ? event.data : String(event.data);
        const parsed = JSON.parse(data) as { type: string; mode?: string; state?: unknown };
        if (parsed.type === "state") {
          stateMessages.push(parsed as { type: string; mode: string; state: any });
        }
      };
      socket.addEventListener("message", onStateMessage as EventListener);

      socket.send(JSON.stringify({ type: "join", name: "Solo" }));

      const joined = await joinedPromise;
      await new Promise((resolve) => setTimeout(resolve, 50));

      const activeState = stateMessages.find((message) => message.mode === "full");
      expect(activeState).toBeDefined();
      expect(activeState?.state.phase).toBe("active");

      const worldDiffState = stateMessages.find(
        (message) => message.mode === "diff" && message.state.world,
      );
      expect(worldDiffState).toBeDefined();
      expect(worldDiffState?.state.world.upsertMicroorganisms?.length ?? 0).toBeGreaterThan(0);
      expect(worldDiffState?.state.world.upsertOrganicMatter?.length ?? 0).toBeGreaterThan(0);

      socket.removeEventListener("message", onStateMessage as EventListener);

      const receivePlayerDiff = async () => {
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const message = await onceMessage<{
            type: string;
            mode: string;
            state: {
              upsertPlayers?: {
                id: string;
                position?: { x: number; y: number };
                movementVector?: { x: number; y: number };
              }[];
            };
          }>(socket, "state", 5000);
          const hasPlayerUpdate =
            message.mode === "diff" && (message.state.upsertPlayers?.length ?? 0) > 0;
          if (hasPlayerUpdate) {
            return message;
          }
        }
        throw new Error("Did not receive player diff message");
      };
      const errorPromise = onceMessage<{ type: string; reason: string }>(socket, "error", 200);

      socket.send(
        JSON.stringify({
          type: "action",
          playerId: joined.playerId,
          clientTime: Date.now(),
          action: {
            type: "movement",
            position: { x: 0, y: 0 },
            movementVector: { x: 10, y: 0 },
            orientation: { angle: 0 }
          }
        })
      );

      await expect(errorPromise).rejects.toThrow("Timed out waiting for error message");
      const stateDiff = await receivePlayerDiff();

      expect(stateDiff.mode).toBe("diff");
      const soloUpdate = stateDiff.state.upsertPlayers?.find((player) => player.id === joined.playerId);
      expect(soloUpdate).toBeDefined();
      expect(soloUpdate?.movementVector).toBeDefined();
      const movementVector = soloUpdate?.movementVector;
      if (movementVector) {
        expect(Math.abs(movementVector.x) + Math.abs(movementVector.y)).toBeGreaterThan(0);
      }

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

  it("keeps the player connected when a stale socket closes", async () => {
    const mf = await createMiniflare();
    try {
      const firstSocket = await openSocket(mf);
      const joinedPromise = onceMessage<{
        type: string;
        playerId: string;
        reconnectToken: string;
      }>(firstSocket, "joined");

      firstSocket.send(
        JSON.stringify({
          type: "join",
          name: "Alice",
        })
      );

      const joined = await joinedPromise;

      const secondSocket = await openSocket(mf);
      const secondJoinedPromise = onceMessage<{
        type: string;
        playerId: string;
        reconnectToken: string;
      }>(secondSocket, "joined");

      secondSocket.send(
        JSON.stringify({
          type: "join",
          name: "Alice",
          playerId: joined.playerId,
          reconnectToken: joined.reconnectToken,
        })
      );

      await secondJoinedPromise;

      const receivedMessages: MessagePayload[] = [];
      const onMessage = (event: MessageEvent) => {
        const data = typeof event.data === "string" ? event.data : String(event.data);
        receivedMessages.push(JSON.parse(data) as MessagePayload);
      };
      secondSocket.addEventListener("message", onMessage as EventListener);

      firstSocket.close();
      await new Promise((resolve) => setTimeout(resolve, 150));

      secondSocket.removeEventListener("message", onMessage as EventListener);

      const disconnectDiffReceived = receivedMessages.some((message) => {
        if (message.type !== "state") {
          return false;
        }
        const diff = message as {
          mode?: string;
          state?: { upsertPlayers?: { id: string; connected?: boolean }[] };
        };
        if (diff.mode !== "diff") {
          return false;
        }
        const players = diff.state?.upsertPlayers ?? [];
        return players.some((player) => player.id === joined.playerId && player.connected === false);
      });

      expect(disconnectDiffReceived).toBe(false);

      const pongPromise = onceMessage<{ type: string }>(secondSocket, "pong");
      secondSocket.send(
        JSON.stringify({
          type: "ping",
          ts: Date.now(),
        })
      );
      const pong = await pongPromise;
      expect(pong.type).toBe("pong");

      secondSocket.close();
    } finally {
      await mf.dispose();
    }
  });

  it("allows reconnecting within the reconnect window when providing a valid token", async () => {
    const mf = await createMiniflare();
    try {
      const firstSocket = await openSocket(mf);
      const firstJoinedPromise = onceMessage<{
        type: string;
        playerId: string;
        reconnectToken: string;
      }>(firstSocket, "joined");

      firstSocket.send(
        JSON.stringify({
          type: "join",
          name: "Alice",
        }),
      );

      const firstJoined = await firstJoinedPromise;

      firstSocket.close();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const secondSocket = await openSocket(mf);
      const secondJoinedPromise = onceMessage<{
        type: string;
        playerId: string;
        reconnectToken: string;
      }>(secondSocket, "joined");

      secondSocket.send(
        JSON.stringify({
          type: "join",
          name: "Alice",
          playerId: firstJoined.playerId,
          reconnectToken: firstJoined.reconnectToken,
        }),
      );

      const secondJoined = await secondJoinedPromise;

      expect(secondJoined.playerId).toBe(firstJoined.playerId);
      expect(secondJoined.reconnectToken).not.toBe(firstJoined.reconnectToken);

      secondSocket.close();
    } finally {
      await mf.dispose();
    }
  });

  it("closes the previous socket when reconnecting with the same playerId", async () => {
    const mf = await createMiniflare();
    try {
      const firstSocket = await openSocket(mf);
      const firstJoinedPromise = onceMessage<{
        type: string;
        playerId: string;
        reconnectToken: string;
      }>(firstSocket, "joined");

      firstSocket.send(
        JSON.stringify({
          type: "join",
          name: "Alice",
        }),
      );

      const firstJoined = await firstJoinedPromise;

      const firstClosePromise = new Promise<{ code: number; reason: string }>((resolve) => {
        const listener = (event: Event) => {
          const closeEvent = event as Event & { code: number; reason: string };
          resolve({ code: closeEvent.code, reason: closeEvent.reason });
        };
        firstSocket.addEventListener("close", listener as EventListener, { once: true });
      });

      const secondSocket = await openSocket(mf);
      const secondJoinedPromise = onceMessage<{
        type: string;
        playerId: string;
        reconnectToken: string;
      }>(secondSocket, "joined");

      secondSocket.send(
        JSON.stringify({
          type: "join",
          name: "Alice",
          playerId: firstJoined.playerId,
          reconnectToken: firstJoined.reconnectToken,
        }),
      );

      const [secondJoined, firstClose] = await Promise.all([secondJoinedPromise, firstClosePromise]);

      expect(secondJoined.playerId).toBe(firstJoined.playerId);
      expect(firstClose.code).toBe(1008);
      expect(firstClose.reason).toBe("session_taken");

      secondSocket.close();
    } finally {
      await mf.dispose();
    }
  });

  it("rejects reconnection attempts that lack or provide invalid tokens", async () => {
    const mf = await createMiniflare();
    try {
      const firstSocket = await openSocket(mf);
      const joinedPromise = onceMessage<{
        type: string;
        playerId: string;
        reconnectToken: string;
      }>(firstSocket, "joined");

      firstSocket.send(
        JSON.stringify({
          type: "join",
          name: "Alice",
        }),
      );

      const joined = await joinedPromise;

      const missingTokenSocket = await openSocket(mf);
      const missingTokenErrorPromise = onceMessage<{ type: string; reason: string }>(
        missingTokenSocket,
        "error",
      );

      missingTokenSocket.send(
        JSON.stringify({
          type: "join",
          name: "Alice",
          playerId: joined.playerId,
        }),
      );

      const missingTokenError = await missingTokenErrorPromise;
      expect(missingTokenError.reason).toBe("invalid_reconnect_token");
      await new Promise<void>((resolve) => {
        missingTokenSocket.addEventListener(
          "close",
          () => resolve(),
          { once: true },
        );
      });

      const invalidTokenSocket = await openSocket(mf);
      const invalidTokenErrorPromise = onceMessage<{ type: string; reason: string }>(
        invalidTokenSocket,
        "error",
      );

      invalidTokenSocket.send(
        JSON.stringify({
          type: "join",
          name: "Alice",
          playerId: joined.playerId,
          reconnectToken: `${joined.reconnectToken}-invalid`,
        }),
      );

      const invalidTokenError = await invalidTokenErrorPromise;
      expect(invalidTokenError.reason).toBe("invalid_reconnect_token");
      await new Promise<void>((resolve) => {
        invalidTokenSocket.addEventListener(
          "close",
          () => resolve(),
          { once: true },
        );
      });

      const pongPromise = onceMessage<{ type: string }>(firstSocket, "pong");
      firstSocket.send(
        JSON.stringify({
          type: "ping",
          ts: Date.now(),
        }),
      );
      const pong = await pongPromise;
      expect(pong.type).toBe("pong");

      firstSocket.close();
    } finally {
      await mf.dispose();
    }
  });
});
