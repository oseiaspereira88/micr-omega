import type { DurableObjectState } from "@cloudflare/workers-types";
import { describe, expect, it } from "vitest";

import type { Env } from "../src";
import { RoomDO } from "../src/RoomDO";
import { MockDurableObjectState } from "./utils/mock-state";

type StoredRngState = {
  organicMatterRespawn: number;
  progression: number;
  microorganismWaypoint: number;
};

const RNG_STATE_KEY = "rng_state";

const cloneRngState = (snapshot: StoredRngState): StoredRngState =>
  JSON.parse(JSON.stringify(snapshot)) as StoredRngState;

async function createRoomWithState(state: MockDurableObjectState) {
  const room = new RoomDO(state as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  roomAny.obstacles.clear();
  return { roomAny } as const;
}

describe("RoomDO microorganism waypoint RNG", () => {
  it("resumes deterministic patrol paths after restart", async () => {
    const initialRngState: StoredRngState = {
      organicMatterRespawn: 0x12345678,
      progression: 0x23456789,
      microorganismWaypoint: 0x3456789a,
    };

    const controlState = new MockDurableObjectState();
    controlState.storageImpl.data.set(RNG_STATE_KEY, { ...initialRngState });
    const { roomAny: controlRoom } = await createRoomWithState(controlState);

    const origin = { x: 0, y: 0 };
    const controlWaypoints = Array.from({ length: 5 }, () =>
      controlRoom.generateMicroorganismWaypoint(origin),
    );

    const runState = new MockDurableObjectState();
    runState.storageImpl.data.set(RNG_STATE_KEY, { ...initialRngState });
    const { roomAny: firstRoom } = await createRoomWithState(runState);

    const consumedWaypoints = [
      firstRoom.generateMicroorganismWaypoint(origin),
      firstRoom.generateMicroorganismWaypoint(origin),
    ];
    await firstRoom.persistRngState();
    const persistedState = cloneRngState(
      runState.storageImpl.data.get(RNG_STATE_KEY) as StoredRngState,
    );

    expect(consumedWaypoints).toEqual(controlWaypoints.slice(0, 2));

    const restartState = new MockDurableObjectState();
    restartState.storageImpl.data.set(RNG_STATE_KEY, { ...persistedState });
    const { roomAny: restartedRoom } = await createRoomWithState(restartState);

    const resumedWaypoints = [
      restartedRoom.generateMicroorganismWaypoint(origin),
      restartedRoom.generateMicroorganismWaypoint(origin),
      restartedRoom.generateMicroorganismWaypoint(origin),
    ];

    expect(resumedWaypoints).toEqual(controlWaypoints.slice(2));
  });
});
