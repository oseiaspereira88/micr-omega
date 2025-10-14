import {
  AFFINITY_LABELS,
  AFFINITY_TYPES,
  ELEMENT_LABELS,
  ELEMENT_TYPES,
  createResistanceSnapshot,
  resolveResistanceProfile,
} from '../../shared/combat';
import {
  addSkillOnce,
  applyAdditivePassive,
  applyMultiplicativePassive,
  ensureBaseStat,
} from './evolutionHelpers';
import { forms } from './forms';

const applyBaseStat = (organism, stat, value) => {
  if (!Number.isFinite(value) || !organism) return;

  const baseKey = ensureBaseStat(organism, stat);
  organism[baseKey] = value;

  const passives = organism.persistentPassives || {};
  const additive = Number.isFinite(passives[`${stat}Bonus`])
    ? passives[`${stat}Bonus`]
    : 0;
  const multiplier = Number.isFinite(passives[`${stat}Multiplier`])
    ? passives[`${stat}Multiplier`]
    : 0;

  organism[stat] = (value + additive) * (1 + multiplier);
};

const applyArchetypePassives = (organism, passives = [], state) => {
  passives.forEach((passive) => {
    if (!passive || typeof passive !== 'object') return;
    const { type, stat, value } = passive;
    if (!stat || !Number.isFinite(value)) return;

    if (stat === 'energy' && state) {
      state.energy = Math.max(0, (state.energy ?? 0) + value);
      return;
    }

    if (type === 'additive') {
      applyAdditivePassive(organism, stat, value);
    } else if (type === 'multiplicative') {
      applyMultiplicativePassive(organism, stat, value);
    }
  });
};

const applyArchetypeSkills = (organism, skills = []) => {
  skills.forEach((skill) => addSkillOnce(organism, skill));
};

const buildResistanceProfile = ({ resistances, weaknesses }) => {
  return createResistanceSnapshot(resolveResistanceProfile(resistances, weaknesses));
};

export const archetypes = {
  virus: {
    key: 'virus',
    name: 'Vírus',
    icon: '🦠',
    description:
      'Forma parasitária veloz que se replica agressivamente às custas de defesa.',
    form: 'viral',
    baseStats: { attack: 14, defense: 4, speed: 1.45, maxHealth: 85 },
    affinities: {
      element: ELEMENT_TYPES.CHEMICAL,
      affinity: AFFINITY_TYPES.DIVERGENT,
      resistances: { chemical: 0.15, bio: 0.1 },
      weaknesses: { thermal: 0.15, sonic: 0.1 },
    },
    passives: [
      { type: 'multiplicative', stat: 'speed', value: 0.2 },
      { type: 'multiplicative', stat: 'attack', value: 0.1 },
    ],
    startingSkills: ['spike', 'pulse'],
  },
  bacteria: {
    key: 'bacteria',
    name: 'Bactéria',
    icon: '🧫',
    description:
      'Organismo versátil com parede celular resistente e capacidade adaptativa.',
    form: 'bacterial',
    baseStats: { attack: 10, defense: 8, speed: 1.0, maxHealth: 110 },
    affinities: {
      element: ELEMENT_TYPES.BIO,
      affinity: AFFINITY_TYPES.NEUTRAL,
      resistances: { bio: 0.1, acid: 0.05 },
      weaknesses: { thermal: 0.1 },
    },
    passives: [
      { type: 'additive', stat: 'defense', value: 2 },
      { type: 'multiplicative', stat: 'maxHealth', value: 0.1 },
    ],
    startingSkills: ['shield'],
  },
  archaea: {
    key: 'archaea',
    name: 'Arqueia',
    icon: '🜃',
    description:
      'Extremófila resiliente, especialista em sobreviver a ambientes hostis.',
    form: 'archaeal',
    baseStats: { attack: 9, defense: 9, speed: 0.95, maxHealth: 120 },
    affinities: {
      element: ELEMENT_TYPES.ACID,
      affinity: AFFINITY_TYPES.ATTUNED,
      resistances: { acid: 0.2, thermal: 0.1 },
      weaknesses: { sonic: 0.1 },
    },
    passives: [
      { type: 'additive', stat: 'defense', value: 3 },
      { type: 'additive', stat: 'maxHealth', value: 10 },
    ],
    startingSkills: ['shield', 'pulse'],
  },
  protozoa: {
    key: 'protozoa',
    name: 'Protozoário',
    icon: '🧬',
    description: 'Predador unicelular oportunista, especialista em mobilidade e caça.',
    form: 'protozoan',
    baseStats: { attack: 13, defense: 5, speed: 1.35, maxHealth: 95 },
    affinities: {
      element: ELEMENT_TYPES.KINETIC,
      affinity: AFFINITY_TYPES.ATTUNED,
      resistances: { kinetic: 0.15 },
      weaknesses: { chemical: 0.1 },
    },
    passives: [
      { type: 'multiplicative', stat: 'attack', value: 0.15 },
      { type: 'additive', stat: 'speed', value: 0.15 },
    ],
    startingSkills: ['spike', 'drain'],
  },
  algae: {
    key: 'algae',
    name: 'Alga',
    icon: '🌿',
    description:
      'Organismo fotossintético que converte luz em energia e oferece suporte.',
    form: 'algal',
    baseStats: { attack: 9, defense: 7, speed: 1.1, maxHealth: 115 },
    affinities: {
      element: ELEMENT_TYPES.ELECTRIC,
      affinity: AFFINITY_TYPES.ATTUNED,
      resistances: { electric: 0.1, bio: 0.05 },
      weaknesses: { acid: 0.1 },
    },
    passives: [
      { type: 'additive', stat: 'energy', value: 25 },
      { type: 'multiplicative', stat: 'maxHealth', value: 0.08 },
    ],
    startingSkills: ['drain', 'shield'],
  },
  fungus: {
    key: 'fungus',
    name: 'Fungo',
    icon: '🍄',
    description:
      'Rede micelial lenta porém inevitável que domina território com esporos.',
    form: 'mycelial',
    baseStats: { attack: 11, defense: 10, speed: 0.85, maxHealth: 125 },
    affinities: {
      element: ELEMENT_TYPES.PSIONIC,
      affinity: AFFINITY_TYPES.DIVERGENT,
      resistances: { psionic: 0.2 },
      weaknesses: { kinetic: 0.1, thermal: 0.1 },
    },
    passives: [
      { type: 'additive', stat: 'maxHealth', value: 15 },
      { type: 'multiplicative', stat: 'defense', value: 0.15 },
    ],
    startingSkills: ['drain'],
  },
};

export const archetypeList = Object.values(archetypes);

export const applyArchetypeToState = (state, archetypeKey) => {
  if (!state || !state.organism) return state;

  const entry = archetypes[archetypeKey];
  if (!entry) return state;

  state.selectedArchetype = entry.key;
  state.archetypeSelection = {
    pending: false,
    options: archetypeList.map((archetype) => archetype.key),
  };

  const { organism } = state;

  if (entry.form && forms[entry.form]) {
    organism.form = entry.form;
    organism.formDefenseMultiplier = forms[entry.form].defense ?? 1;
    organism.formSpeedMultiplier = forms[entry.form].speed ?? 1;
    organism.availableForms = [entry.form];
    organism.hybridForms = [entry.form];
  }

  applyBaseStat(organism, 'attack', entry.baseStats.attack);
  applyBaseStat(organism, 'defense', entry.baseStats.defense);
  applyBaseStat(organism, 'speed', entry.baseStats.speed);
  applyBaseStat(organism, 'maxHealth', entry.baseStats.maxHealth);

  state.maxHealth = organism.maxHealth;
  state.health = Math.min(state.health ?? entry.baseStats.maxHealth, state.maxHealth);

  organism.element = entry.affinities.element;
  organism.affinity = entry.affinities.affinity;
  organism.resistances = buildResistanceProfile(entry.affinities);

  state.element = organism.element;
  state.elementLabel = ELEMENT_LABELS[organism.element] ?? ELEMENT_LABELS[ELEMENT_TYPES.BIO];
  state.affinity = organism.affinity;
  state.affinityLabel =
    AFFINITY_LABELS[organism.affinity] ?? AFFINITY_LABELS[AFFINITY_TYPES.NEUTRAL];
  state.resistances = organism.resistances;

  applyArchetypePassives(organism, entry.passives, state);
  applyArchetypeSkills(organism, entry.startingSkills);

  organism.traits = Array.isArray(organism.traits) ? organism.traits : [];
  if (!organism.traits.includes(entry.key)) {
    organism.traits.push(entry.key);
  }

  state.traitLineage = Array.isArray(state.traitLineage) ? state.traitLineage : [];
  if (!state.traitLineage.includes(entry.key)) {
    state.traitLineage.push(entry.key);
  }

  return state;
};

