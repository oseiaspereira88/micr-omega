import { describe, expect, it } from "vitest";
import { normalizePathname, parseRoomRoute } from "../src/room-routing";

describe("room routing normalization", () => {
  it("compresses extra slashes for health check path", () => {
    expect(normalizePathname("//health")).toBe("/health");
    expect(parseRoomRoute("//health")).toBeNull();
  });

  it("parses websocket room route with redundant slashes", () => {
    expect(normalizePathname("/rooms///demo//ws")).toBe("/rooms/demo/ws");
    expect(parseRoomRoute("/rooms///demo//ws")).toEqual({
      kind: "room_ws",
      roomSegment: "demo",
    });
  });
});
