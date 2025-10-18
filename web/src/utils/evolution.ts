export type EvolutionAdjustment = Record<string, number>;

export interface EvolutionActionPayload {
  type: 'evolution';
  evolutionId: string;
  tier?: string;
  countDelta?: number;
  traitDeltas?: string[];
  additiveDelta?: EvolutionAdjustment;
  multiplierDelta?: EvolutionAdjustment;
  baseDelta?: EvolutionAdjustment;
}

type EvolutionDeltaInput = {
  evolutionId?: unknown;
  tier?: unknown;
  countDelta?: unknown;
  traitDeltas?: unknown;
  additiveDelta?: unknown;
  multiplierDelta?: unknown;
  baseDelta?: unknown;
};

const prepareAdjustments = (
  adjustments: unknown,
): EvolutionAdjustment | undefined => {
  if (!adjustments || typeof adjustments !== 'object') {
    return undefined;
  }

  const entries = Object.entries(adjustments as Record<string, unknown>)
    .map(([key, value]) => [key, Number(value)] as const)
    .filter(([, numericValue]) => Number.isFinite(numericValue) && numericValue !== 0);

  if (entries.length === 0) {
    return undefined;
  }

  return entries.reduce<EvolutionAdjustment>((accumulator, [key, numericValue]) => {
    accumulator[key] = numericValue;
    return accumulator;
  }, {});
};

export const buildEvolutionPayload = (
  delta: unknown,
): EvolutionActionPayload | null => {
  if (!delta || typeof delta !== 'object') {
    return null;
  }

  const {
    evolutionId,
    tier,
    countDelta,
    traitDeltas,
    additiveDelta,
    multiplierDelta,
    baseDelta,
  } = delta as EvolutionDeltaInput;

  const normalizedEvolutionId =
    typeof evolutionId === 'string' ? evolutionId.trim() : '';

  if (!normalizedEvolutionId) {
    return null;
  }

  const actionPayload: EvolutionActionPayload = {
    type: 'evolution',
    evolutionId: normalizedEvolutionId,
  };

  if (typeof tier === 'string' && tier) {
    actionPayload.tier = tier;
  }

  if (typeof countDelta === 'number' && Number.isFinite(countDelta) && countDelta !== 0) {
    actionPayload.countDelta = Math.trunc(countDelta);
  }

  if (Array.isArray(traitDeltas) && traitDeltas.length > 0) {
    const uniqueTraits = Array.from(
      new Set(
        traitDeltas
          .map((trait) => (typeof trait === 'string' ? trait.trim() : ''))
          .filter((trait) => trait.length > 0),
      ),
    );

    if (uniqueTraits.length > 0) {
      actionPayload.traitDeltas = uniqueTraits;
    }
  }

  const normalizedAdditiveDelta = prepareAdjustments(additiveDelta);
  if (normalizedAdditiveDelta) {
    actionPayload.additiveDelta = normalizedAdditiveDelta;
  }

  const normalizedMultiplierDelta = prepareAdjustments(multiplierDelta);
  if (normalizedMultiplierDelta) {
    actionPayload.multiplierDelta = normalizedMultiplierDelta;
  }

  const normalizedBaseDelta = prepareAdjustments(baseDelta);
  if (normalizedBaseDelta) {
    actionPayload.baseDelta = normalizedBaseDelta;
  }

  return actionPayload;
};

export default buildEvolutionPayload;
