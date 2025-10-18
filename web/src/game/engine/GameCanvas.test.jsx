import { describe, expect, it } from 'vitest';

import {
  formatEvolutionCost,
  formatEvolutionRequirements,
} from './GameCanvas.jsx';

describe('GameCanvas formatting helpers', () => {
  describe('formatEvolutionCost', () => {
    it('returns fallback when cost is invalid input', () => {
      const invalidValues = [null, 42, -1, []];

      invalidValues.forEach((value) => {
        expect(formatEvolutionCost(value)).toBe('Sem custo');
      });
    });

    it('formats cost details when provided', () => {
      expect(
        formatEvolutionCost({
          pc: 3,
          mg: 5,
          fragments: { Alpha: 2 },
          stableGenes: { Beta: 1 },
        })
      ).toBe('3 PC · 5 MG · 2 Frag Alpha · 1 Gene Beta');
    });

    it('skips fragments and genes with invalid amounts', () => {
      expect(
        formatEvolutionCost({
          pc: 1,
          fragments: {
            Alpha: NaN,
            Beta: -1,
            Gamma: 0,
            Delta: Infinity,
            Epsilon: 2,
            Zeta: '3',
          },
          stableGenes: {
            Alpha: undefined,
            Beta: -5,
            Gamma: Infinity,
            Delta: 3,
          },
        })
      ).toBe('1 PC · 2 Frag Epsilon · 3 Gene Delta');
    });
  });

  describe('formatEvolutionRequirements', () => {
    it('returns fallback when requirements are invalid input', () => {
      const invalidValues = [null, 0, 99, []];

      invalidValues.forEach((value) => {
        expect(formatEvolutionRequirements(value)).toBe('Nenhum requisito adicional');
      });
    });

    it('formats requirement details when provided', () => {
      expect(
        formatEvolutionRequirements({
          level: 7,
          fragments: { Gamma: 4 },
          stableGenes: { Delta: 2 },
          mg: 15,
        })
      ).toBe('Nível 7 · 4 Frag Gamma · 2 Gene Delta · 15 MG mínimo');
    });

    it('skips invalid fragment and gene requirements', () => {
      expect(
        formatEvolutionRequirements({
          level: 10,
          fragments: {
            Alpha: NaN,
            Beta: -1,
            Gamma: 0,
            Delta: Infinity,
            Epsilon: 2,
          },
          stableGenes: {
            Alpha: undefined,
            Beta: -5,
            Gamma: Infinity,
            Delta: 4,
          },
          mg: 30,
        })
      ).toBe('Nível 10 · 2 Frag Epsilon · 4 Gene Delta · 30 MG mínimo');
    });
  });
});
