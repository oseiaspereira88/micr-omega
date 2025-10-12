import { describe, expect, beforeEach, it } from "vitest";
import { gameStore, type GameStoreState } from "../gameStore";
import type { RankingEntry, SharedGameState, SharedGameStateDiff } from "../../utils/messageTypes";

const baseState = (): GameStoreState => ({
  connectionStatus: "idle",
  reconnectAttempts: 0,
  reconnectUntil: null,
  playerId: null,
  playerName: null,
  joinError: null,
  lastPingAt: null,
  lastPongAt: null,
  room: {
    phase: "waiting",
    roundId: null,
    roundStartedAt: null,
    roundEndsAt: null
  },
  players: {},
  ranking: []
});

describe("gameStore actions", () => {
  beforeEach(() => {
    const snapshot = baseState();
    gameStore.setState(() => snapshot);
  });

  it("applies full game state snapshots", () => {
    const snapshot: SharedGameState = {
      phase: "active",
      roundId: "round-1",
      roundStartedAt: 1_000,
      roundEndsAt: 61_000,
      players: [
        {
          id: "alice",
          name: "Alice",
          score: 1200,
          combo: 4,
          connected: true,
          lastActiveAt: 1_000
        },
        {
          id: "bob",
          name: "Bob",
          score: 800,
          combo: 2,
          connected: false,
          lastActiveAt: 900
        }
      ]
    };

    gameStore.actions.applyFullState(snapshot);

    const state = gameStore.getState();
    expect(state.room).toEqual({
      phase: "active",
      roundId: "round-1",
      roundStartedAt: 1_000,
      roundEndsAt: 61_000
    });
    expect(state.players).toEqual({
      alice: {
        id: "alice",
        name: "Alice",
        score: 1200,
        combo: 4,
        connected: true,
        lastActiveAt: 1_000
      },
      bob: {
        id: "bob",
        name: "Bob",
        score: 800,
        combo: 2,
        connected: false,
        lastActiveAt: 900
      }
    });
  });

  it("merges diff updates and prunes removed players", () => {
    gameStore.setState((prev) => ({
      ...prev,
      players: {
        alice: {
          id: "alice",
          name: "Alice",
          score: 100,
          combo: 1,
          connected: true,
          lastActiveAt: 0
        },
        carol: {
          id: "carol",
          name: "Carol",
          score: 250,
          combo: 3,
          connected: true,
          lastActiveAt: 0
        }
      }
    }));

    const diff: SharedGameStateDiff = {
      upsertPlayers: [
        {
          id: "alice",
          name: "Alice",
          score: 400,
          combo: 5,
          connected: true,
          lastActiveAt: 2_000
        },
        {
          id: "bob",
          name: "Bob",
          score: 50,
          combo: 1,
          connected: false,
          lastActiveAt: 1_500
        }
      ],
      removedPlayerIds: ["carol"]
    };

    gameStore.actions.applyStateDiff(diff);

    const state = gameStore.getState();
    expect(Object.keys(state.players)).toEqual(["alice", "bob"]);
    expect(state.players.alice.score).toBe(400);
    expect(state.players.bob.connected).toBe(false);
  });

  it("tracks ranking and preserves player session on reset", () => {
    gameStore.setState((prev) => ({
      ...prev,
      connectionStatus: "connected",
      playerId: "alice",
      playerName: "Alice",
      reconnectUntil: 123
    }));

    const ranking: RankingEntry[] = [
      { playerId: "alice", name: "Alice", score: 600 },
      { playerId: "bob", name: "Bob", score: 400 }
    ];

    gameStore.actions.applyRanking(ranking);
    expect(gameStore.getState().ranking).toEqual(ranking);

    gameStore.actions.resetGameState();
    const state = gameStore.getState();
    expect(state.ranking).toEqual([]);
    expect(state.playerId).toBe("alice");
    expect(state.playerName).toBe("Alice");
    expect(state.connectionStatus).toBe("connected");
    expect(state.reconnectUntil).toBe(123);
  });
});
