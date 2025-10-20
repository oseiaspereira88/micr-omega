import { WORLD_RADIUS } from "./types";
import type { CombatAttributes, Vector2 } from "./types";
import { DEFAULT_COMBAT_ATTRIBUTES, createCombatAttributes } from "./playerManager";

export const WORLD_TICK_INTERVAL_MS = 50;
export const CONTACT_BUFFER = 4;
export const PLAYER_COLLISION_RADIUS = 36;
export const MICRO_COLLISION_RADIUS = 60;
export const MAX_DAMAGE_POPUPS_PER_TICK = 12;
export const DAMAGE_POPUP_TTL_MS = 1_200;
export const MICRO_CONTACT_INVULNERABILITY_MS = 1_200;

export const WORLD_BOUNDS = {
  minX: -WORLD_RADIUS,
  maxX: WORLD_RADIUS,
  minY: -WORLD_RADIUS,
  maxY: WORLD_RADIUS,
} as const;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const clampToWorldBounds = (position: Vector2): Vector2 => ({
  x: clamp(position.x, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
  y: clamp(position.y, WORLD_BOUNDS.minY, WORLD_BOUNDS.maxY),
});

export const translateWithinWorldBounds = (position: Vector2, offset: Vector2): Vector2 =>
  clampToWorldBounds({
    x: position.x + offset.x,
    y: position.y + offset.y,
  });

export const sanitizeOrganicMatterTags = (
  tags: { nutrients?: unknown; attributes?: unknown } | null | undefined,
  nutrients: Record<string, unknown> | null | undefined,
): { nutrients: string[]; attributes: string[] } => {
  const sanitizeArray = (values: unknown): string[] => {
    if (!Array.isArray(values)) {
      return [];
    }
    const sanitized: string[] = [];
    for (const value of values) {
      if (typeof value !== "string") {
        continue;
      }
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        continue;
      }
      sanitized.push(trimmed);
    }
    return sanitized;
  };

  const nutrientTags = sanitizeArray(tags?.nutrients);
  const attributeTags = sanitizeArray(tags?.attributes);
  if (nutrientTags.length === 0 && nutrients) {
    for (const key of Object.keys(nutrients)) {
      const trimmed = typeof key === "string" ? key.trim() : "";
      if (trimmed.length === 0) {
        continue;
      }
      nutrientTags.push(trimmed);
    }
  }
  return { nutrients: nutrientTags, attributes: attributeTags };
};

export const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
};

export const vectorMagnitude = (vector: Vector2): number => Math.hypot(vector.x, vector.y);

export const getSpawnPositionForPlayer = (playerId: string, positions: Vector2[]): Vector2 => {
  if (positions.length === 0) {
    return { x: 0, y: 0 };
  }
  const index = hashString(playerId) % positions.length;
  const position = positions[index];
  return { x: position.x, y: position.y };
};

export const getDeterministicCombatAttributesForPlayer = (
  playerId: string,
  base: CombatAttributes = DEFAULT_COMBAT_ATTRIBUTES,
): CombatAttributes => {
  const hash = hashString(playerId);
  const attackBonus = hash % 5;
  const defenseBonus = Math.floor(hash / 5) % 4;
  const speedBonus = Math.floor(hash / 17) % 5;
  const rangeBonus = Math.floor(hash / 29) % 4;

  return createCombatAttributes({
    attack: base.attack + attackBonus,
    defense: base.defense + defenseBonus,
    speed: base.speed + speedBonus * 8,
    range: base.range + rangeBonus * 6,
  });
};
