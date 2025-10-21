import { describe, expect, it } from "vitest";
import type { DurableObjectState } from "@cloudflare/workers-types";

import { RoomDO } from "../src/RoomDO";
import type { Env } from "../src";
import { MockDurableObjectState } from "./utils/mock-state";

async function createRoom() {
  const mockState = new MockDurableObjectState();
  const room = new RoomDO(mockState as unknown as DurableObjectState, {} as Env);
  const roomAny = room as any;
  await roomAny.ready;
  return roomAny;
}

describe("RoomDO dynamic global rate limit", () => {
  it("scales above the baseline when headroom is greater than 1", async () => {
    const roomAny = await createRoom();

    roomAny.config.maxMessagesPerConnection = 100;
    roomAny.config.globalRateLimitHeadroom = 1.5;

    roomAny.activeSockets.clear();
    const sockets = Array.from({ length: 2 }, () => ({ readyState: 1 } as WebSocket));
    for (const socket of sockets) {
      roomAny.activeSockets.add(socket);
    }

    const limit = roomAny.getDynamicGlobalLimit();
    expect(limit).toBe(300);
  });

  it("lowers the baseline when headroom is below 1", async () => {
    const roomAny = await createRoom();

    roomAny.config.maxMessagesPerConnection = 100;
    roomAny.config.globalRateLimitHeadroom = 0.6;

    roomAny.activeSockets.clear();
    const sockets = Array.from({ length: 3 }, () => ({ readyState: 1 } as WebSocket));
    for (const socket of sockets) {
      roomAny.activeSockets.add(socket);
    }

    const limit = roomAny.getDynamicGlobalLimit();
    expect(limit).toBe(180);
    expect(limit).toBeGreaterThan(0);
  });

  it("never returns a non-positive limit even with degenerate configuration", async () => {
    const roomAny = await createRoom();

    roomAny.config.maxMessagesPerConnection = 0;
    roomAny.config.globalRateLimitHeadroom = 0.1;

    roomAny.activeSockets.clear();
    const limit = roomAny.getDynamicGlobalLimit();

    expect(limit).toBe(1);
  });
});
