import { describe, expect, it, vi } from 'vitest';

import { createInitialState } from '../state/initialState';
import {
  checkEvolution,
  openEvolutionMenu,
  chooseEvolution,
  requestEvolutionReroll,
} from './progression';
import { smallEvolutions } from '../config/smallEvolutions';
import { mediumEvolutions } from '../config/mediumEvolutions';
import { majorEvolutions } from '../config/majorEvolutions';

const createState = () => {
  const state = createInitialState();
  state.organism.traits = [];
  state.organism.skills = [];
  state.organism.skillCooldowns = {};
  state.organism.persistentPassives = {};
  state.organism.evolutionHistory = { small: {}, medium: {}, large: {} };
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
  smallEvolutions,
  mediumEvolutions,
  majorEvolutions,
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

describe('openEvolutionMenu and chooseEvolution', () => {
  it('consumes characteristic points for small evolutions', () => {
    const state = createState();
    state.progressionQueue.push('small');

    openEvolutionMenu(state, helpers);
    const before = state.characteristicPoints.available;
    const option = state.evolutionMenu.options.small[0];

    chooseEvolution(state, helpers, option.key);

    expect(state.characteristicPoints.available).toBe(before - 1);
    expect(state.organism.evolutionHistory.small[option.key]).toBe(1);
  });

  it('requires MG and fragments for medium evolutions', () => {
    const state = createState();
    state.level = 6;
    state.xp.level = 6;
    state.progressionQueue.push('medium');

    openEvolutionMenu(state, helpers);
    const available = state.evolutionMenu.options.medium.filter((opt) => opt.available);
    expect(available.length).toBeGreaterThan(0);
    const mgBefore = state.geneticMaterial.current;
    const fragmentsBefore = state.geneFragments.major;

    const option = available[0];
    chooseEvolution(state, helpers, option.key);

    expect(state.geneticMaterial.current).toBeLessThan(mgBefore);
    expect(state.geneFragments.major).toBe(fragmentsBefore - 1);
    expect(state.organism.evolutionHistory.medium[option.key]).toBe(1);
  });

  it('prevents duplicate selections for unique evolutions', () => {
    const state = createState();
    state.level = 6;
    state.xp.level = 6;
    state.progressionQueue.push('medium');
    openEvolutionMenu(state, helpers);
    const uniqueOption = state.evolutionMenu.options.medium.find((opt) => mediumEvolutions[opt.key]?.unique);
    expect(uniqueOption).toBeDefined();

    if (!uniqueOption) return;

    chooseEvolution(state, helpers, uniqueOption.key);

    state.progressionQueue.push('medium');
    openEvolutionMenu(state, helpers);

    const secondRoll = state.evolutionMenu.options.medium.map((opt) => opt.key);
    expect(secondRoll).not.toContain(uniqueOption.key);
  });
});

describe('major evolutions', () => {
  it('spends MG and stable genes for large evolutions', () => {
    const state = createState();
    state.progressionQueue.push('large');
    state.stableGenes.apex = 1;
    state.level = 10;
    state.xp.level = 10;

    openEvolutionMenu(state, helpers);
    const mgBefore = state.geneticMaterial.current;
    const stableBefore = state.stableGenes.apex;

    const option = state.evolutionMenu.options.large.find((entry) => entry.available);
    expect(option).toBeDefined();
    chooseEvolution(state, helpers, option?.key ?? '', option?.tier);

    expect(state.geneticMaterial.current).toBeLessThan(mgBefore);
    expect(state.stableGenes.apex).toBe(stableBefore - 1);
    expect(Object.keys(state.organism.evolutionHistory.large || {})).toContain(option?.key ?? '');
  });

  it('applies diminishing returns on repeated purchases', () => {
    const state = createState();
    state.progressionQueue.push('small');
    openEvolutionMenu(state, helpers);
    const option = state.evolutionMenu.options.small[0];

    chooseEvolution(state, helpers, option.key);
    const firstMultiplier = state.organism.persistentPassives.speedMultiplier ?? 0;

    state.progressionQueue.push('small');
    openEvolutionMenu(state, helpers);
    chooseEvolution(state, helpers, option.key);

    const secondMultiplier = state.organism.persistentPassives.speedMultiplier ?? 0;
    expect(secondMultiplier - firstMultiplier).toBeLessThan(firstMultiplier);
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
