import { describe, expect, it, vi } from 'vitest';

import { createInitialState } from '../state/initialState';
import { evolutionaryTraits } from '../config/evolutionaryTraits';
import { forms } from '../config/forms';
import {
  checkEvolution,
  openEvolutionMenu,
  chooseTrait,
  chooseForm,
  requestEvolutionReroll,
} from './progression';

const createState = () => {
  const state = createInitialState();
  state.organism.traits = [];
  state.organism.skills = [];
  state.organism.skillCooldowns = {};
  state.geneticMaterial.current = 200;
  state.geneticMaterial.total = 200;
  state.geneFragments.major = 3;
  state.geneFragments.apex = 2;
  state.stableGenes.apex = 1;
  state.stableGenes.major = 1;
  state.characteristicPoints.available = 5;
  state.characteristicPoints.total = 5;
  state.evolutionSlots.small.max = 5;
  state.evolutionSlots.medium.max = 2;
  state.evolutionSlots.large.max = 1;
  state.reroll.cost = state.reroll.baseCost;
  return state;
};

const helpers = {
  evolutionaryTraits,
  forms,
  pickRandomUnique: (list, count) => list.slice(0, count),
  addNotification: vi.fn(),
  playSound: vi.fn(),
  syncState: vi.fn(),
};

describe('checkEvolution', () => {
  it('levels up and enqueues tiers when XP exceeds thresholds', () => {
    const state = createState();
    state.xp.current = state.xp.next + 50;

    checkEvolution(state, helpers);

    expect(state.level).toBe(2);
    expect(state.xp.current).toBeGreaterThanOrEqual(0);
    expect(state.progressionQueue).toContain('medium');
    expect(state.characteristicPoints.available).toBeGreaterThan(0);
  });
});

describe('openEvolutionMenu and chooseTrait', () => {
  it('consumes characteristic points for small evolutions', () => {
    const state = createState();
    state.progressionQueue.push('small');

    openEvolutionMenu(state, helpers);
    const before = state.characteristicPoints.available;

    chooseTrait(state, helpers, 'flagellum');

    expect(state.characteristicPoints.available).toBe(before - 1);
    expect(state.organism.traits).toContain('flagellum');
  });

  it('requires MG and fragments for medium evolutions', () => {
    const state = createState();
    state.progressionQueue.push('medium');

    openEvolutionMenu(state, helpers);
    const mgBefore = state.geneticMaterial.current;
    const fragmentsBefore = state.geneFragments.major;

    chooseTrait(state, helpers, 'spikes');

    expect(state.geneticMaterial.current).toBeLessThan(mgBefore);
    expect(state.geneFragments.major).toBe(fragmentsBefore - 1);
    expect(state.organism.traits).toContain('spikes');
  });

  it('prevents duplicate trait applications even across tiers', () => {
    const state = createState();
    state.progressionQueue.push('small');
    openEvolutionMenu(state, helpers);
    chooseTrait(state, helpers, 'membrane');

    state.progressionQueue.push('medium');
    openEvolutionMenu(state, helpers);
    chooseTrait(state, helpers, 'membrane');

    const occurrences = state.organism.traits.filter((trait) => trait === 'membrane');
    expect(occurrences).toHaveLength(1);
  });
});

describe('chooseForm', () => {
  it('spends MG and stable genes for large evolutions', () => {
    const state = createState();
    state.progressionQueue.push('large');
    state.stableGenes.apex = 1;

    openEvolutionMenu(state, helpers);
    const mgBefore = state.geneticMaterial.current;
    const stableBefore = state.stableGenes.apex;

    chooseForm(state, helpers, 'star');

    expect(state.geneticMaterial.current).toBeLessThan(mgBefore);
    expect(state.stableGenes.apex).toBe(stableBefore - 1);
    expect(state.organism.form).toBe('star');
  });
});

describe('requestEvolutionReroll', () => {
  it('increments reroll cost and deducts MG', () => {
    const state = createState();
    state.progressionQueue.push('small');
    openEvolutionMenu(state, helpers);
    state.showEvolutionChoice = true;
    const costBefore = state.reroll.cost;
    const mgBefore = state.geneticMaterial.current;

    requestEvolutionReroll(state, helpers);

    expect(state.geneticMaterial.current).toBe(mgBefore - costBefore);
    expect(state.reroll.cost).toBeGreaterThan(costBefore);
    expect(state.reroll.count).toBe(1);
  });
});
