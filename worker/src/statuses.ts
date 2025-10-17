import type { StatusEffectEvent } from "@micr-omega/shared";

import type { StatusTag } from "./skills";

export type StatusEffectState = {
  status: StatusTag;
  stacks: number;
  expiresAt: number | null;
};

export type StatusCollection = StatusEffectState[];

export const mergeStatusEffect = (
  effects: StatusCollection,
  status: StatusTag,
  stacks: number,
  durationMs: number | undefined,
  now: number,
): StatusEffectState => {
  let entry = effects.find((effect) => effect.status === status);
  if (!entry) {
    entry = { status, stacks: Math.max(0, stacks), expiresAt: null };
    effects.push(entry);
  } else {
    entry.stacks = Math.max(0, entry.stacks + stacks);
  }

  if (Number.isFinite(durationMs) && durationMs && durationMs > 0) {
    entry.expiresAt = now + durationMs;
  }

  return entry;
};

export const pruneExpiredStatusEffects = (
  collection: StatusCollection,
  now: number,
): StatusCollection => {
  return collection.filter((entry) => entry.expiresAt === null || entry.expiresAt > now);
};

export const toStatusEffectEvent = (
  targetKind: StatusEffectEvent["targetKind"],
  target: { playerId?: string; objectId?: string },
  status: StatusTag,
  stacks: number,
  durationMs: number | undefined,
  sourcePlayerId?: string,
): StatusEffectEvent => ({
  targetKind,
  targetPlayerId: target.playerId,
  targetObjectId: target.objectId,
  status,
  stacks: Math.max(0, stacks),
  durationMs: durationMs && durationMs > 0 ? durationMs : undefined,
  sourcePlayerId,
});
