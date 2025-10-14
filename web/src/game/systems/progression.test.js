import { describe, expect, it, vi } from 'vitest';

import { evolutionaryTraits } from '../config/evolutionaryTraits';
import { chooseTrait } from './progression';

const createState = () => ({
  organism: {
    traits: [],
    skills: [],
    skillCooldowns: {},
    size: 32,
    color: '#ffffff',
    form: 'sphere',
    speed: 1,
    attack: 10,
    defense: 5,
    maxHealth: 100,
    health: 100,
  },
  maxHealth: 100,
  health: 100,
  showEvolutionChoice: true,
});

const createHelpers = () => ({
  evolutionaryTraits,
  addNotification: vi.fn(),
  syncState: vi.fn(),
});

const traitTestCases = [
  {
    key: 'flagellum',
    expectedStat: 1.5,
    statGetter: (state) => state.organism.speed,
  },
  {
    key: 'spikes',
    expectedStat: 18,
    statGetter: (state) => state.organism.attack,
  },
  {
    key: 'membrane',
    expectedStat: 8,
    statGetter: (state) => state.organism.defense,
  },
  {
    key: 'nucleus',
    expectedStat: 150,
    statGetter: (state) => state.organism.maxHealth,
  },
];

describe('chooseTrait', () => {
  it.each(traitTestCases)('prevents duplicate application of %s', ({ key, expectedStat, statGetter }) => {
    const state = createState();
    const helpers = createHelpers();
    const { skill } = evolutionaryTraits[key];

    chooseTrait(state, helpers, key);

    const statAfterFirstChoice = statGetter(state);
    const skillsAfterFirstChoice = [...state.organism.skills];
    const traitsAfterFirstChoice = [...state.organism.traits];
    const stateMaxHealthAfterFirstChoice = state.maxHealth;
    const skillOccurrencesAfterFirstChoice = skillsAfterFirstChoice.filter((value) => value === skill).length;

    expect(traitsAfterFirstChoice).toEqual([key]);
    expect(statAfterFirstChoice).toBeCloseTo(expectedStat, 5);
    expect(skillOccurrencesAfterFirstChoice).toBe(1);

    chooseTrait(state, helpers, key);

    const skillOccurrencesAfterSecondChoice = state.organism.skills.filter((value) => value === skill).length;

    expect(state.organism.traits).toEqual(traitsAfterFirstChoice);
    expect(statGetter(state)).toBe(statAfterFirstChoice);
    expect(state.organism.skills).toEqual(skillsAfterFirstChoice);
    expect(skillOccurrencesAfterSecondChoice).toBe(1);
    expect(state.maxHealth).toBe(stateMaxHealthAfterFirstChoice);
  });
});
