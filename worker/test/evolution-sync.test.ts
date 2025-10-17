import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import type { PlayerEvolutionAction, StateDiffMessage, StateMessage } from "../src/types";
import { createMiniflare, onceMessage, openSocket } from "./utils/miniflare";
import { MockDurableObjectState } from "./utils/mock-state";

const createRoom = async () => {
  const mockState = new MockDurableObjectState();
  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  return { roomAny } as const;
};

const waitForStateMessage = (
  socket: WebSocket,
  predicate: (message: StateMessage) => boolean,
  timeoutMs: number,
): Promise<StateMessage> => {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      socket.removeEventListener("message", onMessage as EventListener);
    };

    timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for state message"));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      const raw = typeof event.data === "string" ? event.data : String(event.data);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }

      if (!parsed || typeof parsed !== "object") {
        return;
      }

      const message = parsed as { type?: string };
      if (message.type !== "state") {
        return;
      }

      const stateMessage = parsed as StateMessage;
      if (!predicate(stateMessage)) {
        return;
      }

      cleanup();
      resolve(stateMessage);
    };

    socket.addEventListener("message", onMessage as EventListener);
  });
};

describe("player evolution synchronization", () => {
  it("applies combat stat adjustments from evolution actions", async () => {
    const { roomAny } = await createRoom();
    const playerId = "player-evolution-test";
    const now = Date.now();

    const player: any = {
      id: playerId,
      name: playerId,
      score: 0,
      combo: 1,
      energy: 100,
      xp: 0,
      geneticMaterial: 0,
      position: { x: 0, y: 0 },
      movementVector: { x: 0, y: 0 },
      orientation: { angle: 0 },
      health: { current: 100, max: 100 },
      combatStatus: { state: "idle", targetPlayerId: null, targetObjectId: null, lastAttackAt: null },
      combatAttributes: { attack: 0, defense: 0, speed: 0, range: 0 },
      connected: true,
      lastActiveAt: now,
      lastSeenAt: now,
      connectedAt: now,
      totalSessionDurationMs: 0,
      sessionCount: 0,
    };

    player.combatAttributes = roomAny.computePlayerCombatAttributes(player);
    roomAny.players.set(playerId, player);

    const initialAttack = player.combatAttributes.attack;
    const initialSpeed = player.combatAttributes.speed;

    const action: PlayerEvolutionAction = {
      type: "evolution",
      evolutionId: "test-upgrade",
      tier: "small",
      countDelta: 1,
      additiveDelta: { attack: 5 },
      multiplierDelta: { speed: 0.5 },
    };

    const result = roomAny.applyPlayerAction(player, action, now);
    expect(result).not.toBeNull();
    expect(result?.updatedPlayers).toHaveLength(1);

    expect(player.combatAttributes.attack).toBeCloseTo(initialAttack + 5, 6);
    expect(player.combatAttributes.speed).toBeGreaterThan(initialSpeed);
    expect(player.evolutionState.history.small["test-upgrade"]).toBe(1);
    expect(player.evolutionState.modifiers.attack.additive).toBeCloseTo(5, 6);
    expect(player.evolutionState.modifiers.speed.multiplier).toBeCloseTo(0.5, 6);
  });

  it("broadcasts combat attribute updates after evolution messages", async () => {
    const mf = await createMiniflare();
    try {
      const socket = await openSocket(mf);
      const fullStatePromise = waitForStateMessage(
        socket,
        (message) => message.mode === "full",
        5000,
      );
      socket.send(JSON.stringify({ type: "join", name: "EvolutionTester" }));
      const joined = await onceMessage(socket, "joined", 5000);
      const playerId = joined.playerId;
      expect(typeof playerId).toBe("string");

      const initialPlayer = joined.state.players.find((entry) => entry.id === playerId);
      expect(initialPlayer).toBeDefined();
      const initialAttack = initialPlayer?.combatAttributes.attack ?? 0;
      const initialSpeed = initialPlayer?.combatAttributes.speed ?? 0;

      await fullStatePromise;

      const diffPromise = waitForStateMessage(
        socket,
        (message) =>
          message.mode === "diff" &&
          (message as StateDiffMessage).state.upsertPlayers?.some((entry) => entry.id === playerId) === true,
        5000,
      );
      socket.send(
        JSON.stringify({
          type: "action",
          playerId,
          action: {
            type: "evolution",
            evolutionId: "integration-test-upgrade",
            tier: "small",
            countDelta: 1,
            additiveDelta: { attack: 4 },
            multiplierDelta: { speed: 0.2 },
          } satisfies PlayerEvolutionAction,
        }),
      );

      const diff = (await diffPromise) as StateDiffMessage;
      expect(diff.mode).toBe("diff");
      const updated = diff.state.upsertPlayers?.find((entry) => entry.id === playerId);
      expect(updated).toBeDefined();
      expect(updated?.combatAttributes.attack).toBeGreaterThan(initialAttack);
      expect(updated?.combatAttributes.speed).toBeGreaterThan(initialSpeed);

      socket.close();
    } finally {
      await mf.dispose();
    }
  });
});
