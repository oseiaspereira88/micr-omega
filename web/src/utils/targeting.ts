import type { Microorganism, Vector2 } from "./messageTypes";

const coerceFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

type PositionTuple = readonly [unknown, unknown];

type PositionSource =
  | Vector2
  | PositionTuple
  | {
      x?: unknown;
      y?: unknown;
      position?: Vector2 | PositionTuple | { x?: unknown; y?: unknown };
    };

const isVectorLike = (value: unknown): value is PositionSource =>
  typeof value === "object" && value !== null;

const extractFromTuple = (value: PositionTuple): Vector2 | null => {
  const [rawX, rawY] = value;
  const x = coerceFiniteNumber(rawX);
  const y = coerceFiniteNumber(rawY);

  if (x === null || y === null) {
    return null;
  }

  return { x, y };
};

const extractPositionInternal = (
  entity: unknown,
  visited: Set<object>
): Vector2 | null => {
  if (!isVectorLike(entity)) {
    return null;
  }

  const objectEntity = entity as object;

  if (visited.has(objectEntity)) {
    return null;
  }

  visited.add(objectEntity);

  if (Array.isArray(entity) && entity.length >= 2) {
    return extractFromTuple(entity as PositionTuple);
  }

  if ("x" in entity || "y" in entity) {
    const x = coerceFiniteNumber((entity as { x?: unknown }).x);
    const y = coerceFiniteNumber((entity as { y?: unknown }).y);

    if (x !== null && y !== null) {
      return { x, y };
    }
  }

  if ("position" in entity) {
    return extractPositionInternal((entity as { position?: unknown }).position, visited);
  }

  return null;
};

export const extractPosition = (entity: unknown): Vector2 | null =>
  extractPositionInternal(entity, new Set<object>());

const dist2 = (a: Vector2, b: Vector2) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

type MicroorganismAggression = Microorganism["aggression"];

type MicroorganismLike = Pick<Microorganism, "id" | "aggression" | "health" | "position"> & {
  x?: unknown;
  y?: unknown;
};

const VALID_AGGRESSIONS: ReadonlySet<MicroorganismAggression> = new Set([
  "passive",
  "neutral",
  "hostile",
]);

const normalizeAggressionSet = (
  aggressions?: Iterable<MicroorganismAggression> | null
): ReadonlySet<MicroorganismAggression> | null => {
  if (!aggressions) {
    return null;
  }

  const normalized = new Set<MicroorganismAggression>();
  for (const aggression of aggressions) {
    if (VALID_AGGRESSIONS.has(aggression)) {
      normalized.add(aggression);
    }
  }

  return normalized.size > 0 ? normalized : null;
};

const isAttackableMicroorganism = (
  entity: MicroorganismLike | null | undefined,
  allowedAggressions: ReadonlySet<MicroorganismAggression> | null
): entity is MicroorganismLike => {
  if (!entity || typeof entity.id !== "string" || entity.id.length === 0) {
    return false;
  }

  const aggression = entity.aggression;
  if (allowedAggressions && !allowedAggressions.has(aggression)) {
    return false;
  }

  const health = entity.health;
  if (!health || typeof health.current !== "number" || !Number.isFinite(health.current)) {
    return false;
  }

  return health.current > 0;
};

type IterableLike<T> = readonly T[] | Iterable<T> | null | undefined;

type FindNearestOptions = {
  playerPosition?: Vector2 | null;
  renderMicroorganisms?: IterableLike<MicroorganismLike>;
  sharedMicroorganisms?: IterableLike<MicroorganismLike>;
  excludeIds?: Iterable<string> | null;
};

const iterateMicroorganisms = (
  ...collections: IterableLike<MicroorganismLike>[]
): Generator<MicroorganismLike, void, void> => {
  function* iterateCollection(collection?: IterableLike<MicroorganismLike>) {
    if (!collection) {
      return;
    }

    if (Array.isArray(collection)) {
      for (const entry of collection) {
        if (entry) {
          yield entry;
        }
      }
      return;
    }

    if (typeof (collection as Iterable<MicroorganismLike>)[Symbol.iterator] === "function") {
      for (const entry of collection as Iterable<MicroorganismLike>) {
        if (entry) {
          yield entry;
        }
      }
    }
  }

  return (function* () {
    for (const collection of collections) {
      yield* iterateCollection(collection);
    }
  })();
};

const normalizePlayerPosition = (position?: Vector2 | null): Vector2 | null => {
  if (!position) {
    return null;
  }

  const normalized = extractPosition(position);
  if (!normalized) {
    return null;
  }

  return normalized;
};

const buildExcludeSet = (excludeIds?: Iterable<string> | null) => {
  if (!excludeIds) {
    return null;
  }

  const set = new Set<string>();
  for (const id of excludeIds) {
    if (typeof id === "string" && id) {
      set.add(id);
    }
  }

  return set.size > 0 ? set : null;
};

const findNearestWithAggressions = (
  {
    renderMicroorganisms,
    sharedMicroorganisms,
    excludeIds,
  }: FindNearestOptions = {},
  origin: Vector2,
  allowedAggressions: ReadonlySet<MicroorganismAggression> | null,
  evaluated: Set<string>
) => {
  const excludeSet = buildExcludeSet(excludeIds);
  let nearestId: string | null = null;
  let nearestDistance = Infinity;

  for (const entity of iterateMicroorganisms(renderMicroorganisms, sharedMicroorganisms)) {
    if (!isAttackableMicroorganism(entity, allowedAggressions)) {
      continue;
    }

    if (excludeSet?.has(entity.id) || evaluated.has(entity.id)) {
      continue;
    }

    const position = extractPosition(entity);
    if (!position) {
      continue;
    }

    evaluated.add(entity.id);

    const distance = dist2(origin, position);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = entity.id;
    }
  }

  return nearestId;
};

type FindNearestAttackableOptions = FindNearestOptions & {
  aggressionPreference?: readonly (Iterable<MicroorganismAggression> | null | undefined)[] | null;
};

export const findNearestAttackableMicroorganismId = ({
  playerPosition,
  renderMicroorganisms,
  sharedMicroorganisms,
  excludeIds,
  aggressionPreference,
}: FindNearestAttackableOptions = {}): string | null => {
  const origin = normalizePlayerPosition(playerPosition);
  if (!origin) {
    return null;
  }

  const evaluated = new Set<string>();
  const preferences =
    aggressionPreference && aggressionPreference.length > 0
      ? aggressionPreference
      : [["hostile"], ["neutral"]];

  for (const preference of preferences) {
    const allowedAggressions = normalizeAggressionSet(preference ?? null);
    const nearestId = findNearestWithAggressions(
      {
        renderMicroorganisms,
        sharedMicroorganisms,
        excludeIds,
      },
      origin,
      allowedAggressions,
      evaluated
    );

    if (nearestId) {
      return nearestId;
    }
  }

  return null;
};

export const findNearestHostileMicroorganismId = (options: FindNearestOptions = {}) =>
  findNearestAttackableMicroorganismId({
    ...options,
    aggressionPreference: [["hostile"], ["neutral"]],
  });

export const resolvePlayerPosition = ({
  renderPlayer,
  sharedPlayer,
}: {
  renderPlayer?: unknown;
  sharedPlayer?: unknown;
} = {}): Vector2 | null => {
  const renderSources: unknown[] = [
    (renderPlayer as { renderPosition?: unknown })?.renderPosition,
    (renderPlayer as { position?: unknown })?.position,
    renderPlayer,
  ];

  for (const source of renderSources) {
    const position = extractPosition(source);
    if (position) {
      return position;
    }
  }

  const sharedSources: unknown[] = [
    (sharedPlayer as { position?: unknown })?.position,
    sharedPlayer,
  ];

  for (const source of sharedSources) {
    const position = extractPosition(source);
    if (position) {
      return position;
    }
  }

  return null;
};

export default findNearestHostileMicroorganismId;
