import { afterEach, describe, expect, it, vi } from 'vitest';

import { AFFINITY_TYPES, ELEMENT_TYPES } from '../../shared/combat';
import { createInitialState } from '../state/initialState';
import {
  checkEvolution,
  openEvolutionMenu,
  chooseEvolution,
  requestEvolutionReroll,
  cancelEvolutionChoice,
  selectArchetype,
} from './progression';
import { smallEvolutions } from '../config/smallEvolutions';
import { mediumEvolutions } from '../config/mediumEvolutions';
import { majorEvolutions } from '../config/majorEvolutions';

const createState = (archetypeKey = 'bacteria') => {
  const state = createInitialState({ archetypeKey });
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
  state.macroEvolutionSlots = { used: 0, max: 1 };
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

afterEach(() => {
  vi.clearAllMocks();
});

describe('checkEvolution', () => {
  it('levels up and enqueues tiers when XP exceeds thresholds', () => {
    const state = createState();
    state.xp.current = state.xp.next + 50;

    checkEvolution(state, helpers);

    expect(state.level).toBe(2);
    expect(state.xp.current).toBeGreaterThanOrEqual(0);
    expect(state.progressionQueue).toContain('medium');
    expect(state.characteristicPoints.available).toBeGreaterThan(0);
    expect(state.pendingEvolutionLevel).toBe(2);
  });

  it('normalizes zero or negative XP requirements to avoid runaway leveling', () => {
    const state = createState();
    state.xp.current = 200;
    state.xp.next = 0;

    checkEvolution(state, helpers);

    expect(state.level).toBe(2);
    expect(state.xp.next).toBeGreaterThan(0);
    expect(state.xp.current).toBeGreaterThanOrEqual(0);
    expect(state.pendingEvolutionLevel).toBe(2);

    const levelToasts = helpers.addNotification.mock.calls
      .map(([, message]) => message)
      .filter((message) => typeof message === 'string' && message.startsWith('⬆️'));

    expect(levelToasts).toEqual(['⬆️ Nível 2']);
  });

  it('emits a single level-up notification per evolution and keeps pending level', () => {
    const state = createState();
    state.xp.current = state.xp.next + 10;

    checkEvolution(state, helpers);

    const levelToasts = helpers.addNotification.mock.calls
      .map(([, message]) => message)
      .filter((message) => typeof message === 'string' && message.startsWith('⬆️'));

    expect(levelToasts).toEqual(['⬆️ Nível 2']);
    expect(state.pendingEvolutionLevel).toBe(2);

    helpers.addNotification.mockClear();

    checkEvolution(state, helpers);

    const repeatedToasts = helpers.addNotification.mock.calls
      .map(([, message]) => message)
      .filter((message) => typeof message === 'string' && message.startsWith('⬆️'));

    expect(repeatedToasts).toHaveLength(0);
  });
});

describe('selectArchetype', () => {
  it('aplica afinidades e estatísticas base do arquétipo escolhido', () => {
    const state = createInitialState();

    selectArchetype(state, helpers, 'virus');

    expect(state.selectedArchetype).toBe('virus');
    expect(state.archetypeSelection.pending).toBe(false);
    expect(state.element).toBe(ELEMENT_TYPES.CHEMICAL);
    expect(state.affinity).toBe(AFFINITY_TYPES.DIVERGENT);
    expect(state.organism.traits).toContain('virus');
    expect(state.traitLineage).toContain('virus');
    expect(state.maxHealth).toBeGreaterThan(0);
    expect(state.organism.skills.length).toBeGreaterThan(0);
  });

  it('ignora seleções inválidas mantendo estado pendente', () => {
    const state = createInitialState();

    selectArchetype(state, helpers, '');

    expect(state.selectedArchetype).toBeNull();
    expect(state.archetypeSelection.pending).toBe(true);
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

  it('marks options unavailable when tier slots are full', () => {
    const state = createState();
    state.progressionQueue.push('small');
    state.evolutionSlots.small.used = state.evolutionSlots.small.max;

    openEvolutionMenu(state, helpers);

    state.evolutionMenu.options.small.forEach((option) => {
      expect(option.available).toBe(false);
      expect(option.reason).toBe('Sem espaços de evolução disponíveis');
    });
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
    state.stableGenes.major = 2;
    state.level = 10;
    state.xp.level = 10;

    openEvolutionMenu(state, helpers);
    const mgBefore = state.geneticMaterial.current;
    const stableBefore = { ...state.stableGenes };

    const option = state.evolutionMenu.options.large.find((entry) => entry.available);
    expect(option).toBeDefined();
    const macroBefore = state.macroEvolutionSlots.used;
    const pcBefore = state.characteristicPoints.available;
    chooseEvolution(state, helpers, option?.key ?? '', option?.tier);

    expect(state.geneticMaterial.current).toBeLessThan(mgBefore);
    Object.entries(option?.cost?.stableGenes || {}).forEach(([key, amount]) => {
      expect(state.stableGenes[key]).toBe((stableBefore[key] ?? 0) - amount);
    });
    expect(Object.keys(state.organism.evolutionHistory.large || {})).toContain(option?.key ?? '');
    expect(state.macroEvolutionSlots.used).toBe(macroBefore + 1);
    expect(state.characteristicPoints.available).toBeGreaterThan(pcBefore);
    expect(Array.isArray(state.organism.hybridForms)).toBe(true);
    expect(state.organism.hybridForms.length).toBeGreaterThan(0);
    expect(state.organism.macroEvolutions).toContain(option?.key ?? '');
  });

  it('marks macro evolution options unavailable when macro slots are full', () => {
    const state = createState();
    state.progressionQueue.push('large');
    state.level = 10;
    state.xp.level = 10;
    const macroMax = Math.max(
      state.macroEvolutionSlots.max,
      Math.floor(state.level / 5)
    );
    state.macroEvolutionSlots.max = macroMax;
    state.macroEvolutionSlots.used = macroMax;

    openEvolutionMenu(state, helpers);

    const macroOptions = state.evolutionMenu.options.large.filter((option) => option.macro);
    expect(macroOptions.length).toBeGreaterThan(0);
    macroOptions.forEach((option) => {
      expect(option.available).toBe(false);
      expect(option.reason).toBe('Sem espaços macro disponíveis');
    });
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

  it('reshuffles evolution options when using internal randomness', () => {
    const state = createState();
    state.progressionQueue.push('small');

    const randomSequence = [
      0, 0, 0, // initial small evolution roll
      0.1, 0.1, 0.1, // initial medium evolution roll
      0.2, 0.2, 0.2, // initial large evolution roll
      0.9, 0.8, 0.7, // reroll for small evolutions
    ];
    const randomMock = vi.fn();
    randomSequence.forEach((value) => randomMock.mockReturnValueOnce(value));
    randomMock.mockReturnValue(0.3);

    const randomHelpers = {
      ...helpers,
      pickRandomUnique: undefined,
      random: randomMock,
    };

    openEvolutionMenu(state, randomHelpers);
    const firstOptions = state.evolutionMenu.options.small.map((opt) => opt.key);

    expect(firstOptions.length).toBeGreaterThan(0);

    requestEvolutionReroll(state, randomHelpers);
    const rerolledOptions = state.evolutionMenu.options.small.map((opt) => opt.key);

    expect(rerolledOptions).not.toEqual(firstOptions);
    expect(randomMock).toHaveBeenCalled();
  });
});

describe('cancelEvolutionChoice', () => {
  it('restores the queued tier and hides the menu', () => {
    const state = createState();
    state.progressionQueue.push('small');
    openEvolutionMenu(state, helpers);

    expect(state.showEvolutionChoice).toBe(true);
    expect(state.progressionQueue).toHaveLength(0);

    helpers.syncState.mockClear();

    cancelEvolutionChoice(state, helpers);

    expect(state.showEvolutionChoice).toBe(false);
    expect(state.progressionQueue[0]).toBe('small');
    expect(state.canEvolve).toBe(true);
    expect(helpers.syncState).toHaveBeenCalled();
  });
});
