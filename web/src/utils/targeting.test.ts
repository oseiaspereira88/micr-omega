import { describe, expect, it } from "vitest";
import {
  extractPosition,
  findNearestHostileMicroorganismId,
  resolvePlayerPosition,
} from "./targeting";

const createMicroorganism = ({
  id,
  x,
  y,
  aggression = "hostile",
  healthCurrent = 10,
}: {
  id: string;
  x: number;
  y: number;
  aggression?: "passive" | "neutral" | "hostile";
  healthCurrent?: number;
}) => ({
  id,
  aggression,
  health: { current: healthCurrent, max: 10 },
  position: { x, y },
});

describe("extractPosition", () => {
  it("returns coordinates from direct objects", () => {
    expect(extractPosition({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
  });

  it("extracts coordinates from nested position objects", () => {
    expect(extractPosition({ position: { x: 5, y: 7 } })).toEqual({ x: 5, y: 7 });
  });

  it("supports tuple positions and string coercion", () => {
    expect(extractPosition(["12", 8])).toEqual({ x: 12, y: 8 });
  });

  it("returns null for self-referential position objects", () => {
    const entity: { position?: unknown } = {};
    entity.position = entity;

    expect(extractPosition(entity)).toBeNull();
  });
});

describe("findNearestHostileMicroorganismId", () => {
  const playerPosition = { x: 0, y: 0 };

  it("ignores neutral and defeated microorganisms", () => {
    const result = findNearestHostileMicroorganismId({
      playerPosition,
      renderMicroorganisms: [
        createMicroorganism({ id: "hostile", x: 2, y: 0 }),
        createMicroorganism({ id: "neutral", x: 1, y: 0, aggression: "neutral" }),
        createMicroorganism({ id: "defeated", x: 1, y: 0, healthCurrent: 0 }),
      ],
    });

    expect(result).toBe("hostile");
  });

  it("respects excluded identifiers", () => {
    const result = findNearestHostileMicroorganismId({
      playerPosition,
      sharedMicroorganisms: [
        createMicroorganism({ id: "a", x: 3, y: 0 }),
        createMicroorganism({ id: "b", x: 1, y: 0 }),
      ],
      excludeIds: ["b"],
    });

    expect(result).toBe("a");
  });
});

describe("resolvePlayerPosition", () => {
  it("prioritizes render-specific coordinates", () => {
    const position = resolvePlayerPosition({
      renderPlayer: { renderPosition: { x: 4, y: 5 } },
      sharedPlayer: { position: { x: 1, y: 2 } },
    });

    expect(position).toEqual({ x: 4, y: 5 });
  });

  it("falls back to shared coordinates when render data is unavailable", () => {
    const position = resolvePlayerPosition({
      renderPlayer: null,
      sharedPlayer: { position: { x: 9, y: 3 } },
    });

    expect(position).toEqual({ x: 9, y: 3 });
  });
});
