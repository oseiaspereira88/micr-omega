import { beforeEach, describe, expect, it } from "vitest";
import { gameStore, type GameStoreState } from "./gameStore";
import type {
  RankingEntry,
  SharedGameState,
  SharedGameStateDiff,
} from "../utils/messageTypes";

const baseState = gameStore.getState();

const createFreshState = (): GameStoreState => ({
  ...baseState,
  room: { ...baseState.room },
  players: {},
  ranking: [],
  connectionStatus: "idle",
  reconnectAttempts: 0,
  reconnectUntil: null,
  playerId: null,
  playerName: null,
  joinError: null,
  lastPingAt: null,
  lastPongAt: null,
});

beforeEach(() => {
  gameStore.setState(() => createFreshState());
});

describe("gameStore", () => {
  it("applies full state snapshots and merges subsequent diffs", () => {
    const fullState: SharedGameState = {
      phase: "active",
      roundId: "round-1",
      roundStartedAt: 1000,
      roundEndsAt: 2000,
      players: [
        {
          id: "p1",
          name: "Alice",
          connected: true,
          score: 10,
          combo: 1,
          lastActiveAt: 1000,
        },
      ],
    };

    gameStore.actions.applyFullState(fullState);

    const afterFull = gameStore.getState();
    expect(afterFull.room).toEqual({
      phase: "active",
      roundId: "round-1",
      roundStartedAt: 1000,
      roundEndsAt: 2000,
    });
    expect(afterFull.players).toHaveProperty("p1");
    expect(afterFull.players.p1?.name).toBe("Alice");

    const diff: SharedGameStateDiff = {
      upsertPlayers: [
        {
          id: "p1",
          name: "Alice",
          connected: true,
          score: 250,
          combo: 3,
          lastActiveAt: 1500,
        },
      ],
    };

    gameStore.actions.applyStateDiff(diff);

    const updated = gameStore.getState();
    expect(updated.players.p1?.score).toBe(250);
    expect(updated.players.p1?.combo).toBe(3);

    gameStore.actions.applyStateDiff({ removedPlayerIds: ["p1"] });
    expect(gameStore.getState().players.p1).toBeUndefined();
  });

  it("clears round metadata when diffs reset values", () => {
    const fullState: SharedGameState = {
      phase: "active",
      roundId: "round-42",
      roundStartedAt: 10_000,
      roundEndsAt: 20_000,
      players: [],
    };

    gameStore.actions.applyFullState(fullState);

    gameStore.actions.applyStateDiff({
      phase: "waiting",
      roundId: null,
      roundStartedAt: null,
      roundEndsAt: null,
    });

    expect(gameStore.getState().room).toEqual({
      phase: "waiting",
      roundId: null,
      roundStartedAt: null,
      roundEndsAt: null,
    });
  });

  it("tracks ranking payloads and connection lifecycle", () => {
    const ranking: RankingEntry[] = [
      { playerId: "p1", name: "Alice", score: 3200 },
      { playerId: "p2", name: "Bob", score: 2500 },
    ];

    gameStore.actions.applyRanking(ranking);

    expect(gameStore.getState().ranking).toEqual(ranking);

    gameStore.actions.setConnectionStatus("connecting");
    expect(gameStore.getState().connectionStatus).toBe("connecting");

    gameStore.actions.setJoinError("name_taken");
    expect(gameStore.getState().joinError).toBe("name_taken");

    const attempts = gameStore.actions.incrementReconnectAttempts();
    expect(attempts).toBe(1);
    expect(gameStore.getState().reconnectAttempts).toBe(1);

    gameStore.actions.setReconnectUntil(5000);
    expect(gameStore.getState().reconnectUntil).toBe(5000);

    gameStore.actions.markPing(1000);
    gameStore.actions.markPong(1200);
    expect(gameStore.getState().lastPingAt).toBe(1000);
    expect(gameStore.getState().lastPongAt).toBe(1200);
  });
});
