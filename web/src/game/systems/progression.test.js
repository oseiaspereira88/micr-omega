import { describe, expect, it, vi } from 'vitest';

import { evolutionaryTraits } from '../config/evolutionaryTraits';
import { chooseForm, chooseTrait } from './progression';

const createTraitState = () => ({
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

const createTraitHelpers = () => ({
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
  it.each(traitTestCases)(
    'prevents duplicate application of %s',
    ({ key, expectedStat, statGetter }) => {
      const state = createTraitState();
      const helpers = createTraitHelpers();
      const { skill } = evolutionaryTraits[key];

      chooseTrait(state, helpers, key);

      const statAfterFirstChoice = statGetter(state);
      const skillsAfterFirstChoice = [...state.organism.skills];
      const traitsAfterFirstChoice = [...state.organism.traits];
      const stateMaxHealthAfterFirstChoice = state.maxHealth;
      const skillOccurrencesAfterFirstChoice = skillsAfterFirstChoice.filter(
        (value) => value === skill
      ).length;

      expect(traitsAfterFirstChoice).toEqual([key]);
      expect(statAfterFirstChoice).toBeCloseTo(expectedStat, 5);
      expect(skillOccurrencesAfterFirstChoice).toBe(1);

      chooseTrait(state, helpers, key);

      const skillOccurrencesAfterSecondChoice = state.organism.skills.filter(
        (value) => value === skill
      ).length;

      expect(state.organism.traits).toEqual(traitsAfterFirstChoice);
      expect(statGetter(state)).toBe(statAfterFirstChoice);
      expect(state.organism.skills).toEqual(skillsAfterFirstChoice);
      expect(skillOccurrencesAfterSecondChoice).toBe(1);
      expect(state.maxHealth).toBe(stateMaxHealthAfterFirstChoice);
    }
  );
});

describe('chooseForm', () => {
  const forms = {
    sphere: { name: 'Sphere', defense: 1.5, speed: 1.2 },
    star: { name: 'Star', defense: 0.8, speed: 1.4 },
  };

  const createFormState = () => ({
    organism: {
      form: 'sphere',
      defense: 10,
      speed: 2,
      formDefenseMultiplier: 1,
      formSpeedMultiplier: 1,
      traits: [],
      skillCooldowns: {},
    },
    showEvolutionChoice: true,
    formReapplyNotice: false,
    uiSyncTimer: 0,
  });

  it('does not stack defense and speed when reselecting the same form', () => {
    const state = createFormState();

    chooseForm(state, { forms }, 'sphere');
    const defenseAfterFirstSelection = state.organism.defense;
    const speedAfterFirstSelection = state.organism.speed;

    chooseForm(state, { forms }, 'sphere');

    expect(state.organism.defense).toBeCloseTo(defenseAfterFirstSelection);
    expect(state.organism.speed).toBeCloseTo(speedAfterFirstSelection);
  });

  it('recalculates stats relative to the previous multiplier when switching forms', () => {
    const state = createFormState();

    chooseForm(state, { forms }, 'sphere');
    const defenseAfterSphere = state.organism.defense;
    const speedAfterSphere = state.organism.speed;

    chooseForm(state, { forms }, 'star');

    expect(state.organism.defense).toBeCloseTo(
      defenseAfterSphere * (forms.star.defense / forms.sphere.defense)
    );
    expect(state.organism.speed).toBeCloseTo(
      speedAfterSphere * (forms.star.speed / forms.sphere.speed)
    );
  });
});
