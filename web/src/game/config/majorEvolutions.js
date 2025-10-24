import {
  AFFINITY_LABELS,
  AFFINITY_TYPES,
  ELEMENT_LABELS,
  ELEMENT_TYPES,
  convertWeaknessesToResistances,
  createResistanceSnapshot,
  resolveResistanceProfile,
} from '../../shared/combat';
import { forms } from './forms';
import {
  applyAdditivePassive,
  applyMultiplicativePassive,
  ensureBaseStat,
} from './evolutionHelpers';
import { calculateDiminishingMultiplier } from '@micr-omega/shared';

const applyForm = (state, formKey) => {
  const form = forms[formKey];
  if (!form) return;

  const { organism } = state;
  const currentDefenseMultiplier = Number.isFinite(organism?.formDefenseMultiplier)
    ? organism.formDefenseMultiplier
    : 1;
  const currentSpeedMultiplier = Number.isFinite(organism?.formSpeedMultiplier)
    ? organism.formSpeedMultiplier
    : 1;

  const baseDefense = currentDefenseMultiplier > 0
    ? organism.defense / currentDefenseMultiplier
    : organism.defense;
  const baseSpeed = currentSpeedMultiplier > 0
    ? organism.speed / currentSpeedMultiplier
    : organism.speed;

  const safeDefenseMultiplier = form.defense > 0 ? form.defense : 1;
  const safeSpeedMultiplier = form.speed > 0 ? form.speed : 1;

  ensureBaseStat(organism, 'defense');
  ensureBaseStat(organism, 'speed');

  organism.form = formKey;
  organism.formDefenseMultiplier = safeDefenseMultiplier;
  organism.formSpeedMultiplier = safeSpeedMultiplier;
  organism.defense = baseDefense * safeDefenseMultiplier;
  organism.speed = baseSpeed * safeSpeedMultiplier;
};

const setBaseStat = (organism, statKey, value) => {
  if (!organism || !Number.isFinite(value)) return;
  const baseKey = ensureBaseStat(organism, statKey);
  organism[baseKey] = value;

  const passives = organism.persistentPassives || {};
  const bonus = Number.isFinite(passives[`${statKey}Bonus`])
    ? passives[`${statKey}Bonus`]
    : 0;
  const multiplier = Number.isFinite(passives[`${statKey}Multiplier`])
    ? passives[`${statKey}Multiplier`]
    : 0;

  organism[statKey] = (value + bonus) * (1 + multiplier);
};

const applyResistanceOverrides = (state, { resistances, weaknesses }) => {
  if (!state?.organism) return;

  const profile = resolveResistanceProfile(
    resistances,
    convertWeaknessesToResistances(weaknesses)
  );
  state.organism.resistances = profile;
  state.resistances = createResistanceSnapshot(profile);
};

const applyAffinityConfiguration = (state, affinityOptions = []) => {
  if (!state?.organism || !Array.isArray(affinityOptions) || affinityOptions.length === 0) {
    return;
  }

  const primary = affinityOptions[0];
  if (primary.element) {
    state.organism.element = primary.element;
    state.element = primary.element;
    state.elementLabel = ELEMENT_LABELS[primary.element] ?? primary.element;
  }
  if (primary.affinity) {
    state.organism.affinity = primary.affinity;
    state.affinity = primary.affinity;
    state.affinityLabel =
      AFFINITY_LABELS[primary.affinity] ?? AFFINITY_LABELS[AFFINITY_TYPES.NEUTRAL];
  }

  state.organism.affinityOptions = affinityOptions.map((option) => ({ ...option }));
};

const applyMacroEvolutionProfile = (state, macroConfig = {}, multiplier = 1) => {
  if (!state?.organism) return;
  const { organism } = state;

  if (macroConfig.statProfile) {
    Object.entries(macroConfig.statProfile).forEach(([stat, value]) => {
      setBaseStat(organism, stat, value);
    });
    if (Number.isFinite(macroConfig.statProfile.maxHealth)) {
      state.maxHealth = organism.maxHealth;
      state.health = Math.min(state.health ?? organism.maxHealth, state.maxHealth);
    }
  }

  if (Array.isArray(macroConfig.passiveAdjustments)) {
    macroConfig.passiveAdjustments.forEach((passive) => {
      const { type, stat, value, scaleWithMultiplier } = passive || {};
      if (!stat || !Number.isFinite(value)) return;
      const effective = scaleWithMultiplier ? value * multiplier : value;
      if (type === 'additive') {
        applyAdditivePassive(organism, stat, effective);
      } else if (type === 'multiplicative') {
        applyMultiplicativePassive(organism, stat, effective);
      }
    });
  }

  if (Number.isFinite(macroConfig.energyBonus)) {
    state.energy = Math.max(0, (state.energy ?? 0) + macroConfig.energyBonus);
  }

  if (macroConfig.resistances || macroConfig.weaknesses) {
    applyResistanceOverrides(state, macroConfig);
  }

  if (macroConfig.affinityOptions) {
    applyAffinityConfiguration(state, macroConfig.affinityOptions);
  }

  if (Array.isArray(macroConfig.subforms) && macroConfig.subforms.length > 0) {
    organism.availableForms = Array.from(new Set(macroConfig.subforms));
    organism.hybridForms = Array.from(new Set(macroConfig.subforms));
  }
};

export const majorEvolutions = {
  viralOverclock: {
    name: 'Surto Viral Primevo',
    icon: '🦠',
    color: '#FF3B6B',
    category: 'macro',
    macro: true,
    form: 'viral',
    cost: { mg: 165, stableGenes: { major: 1 } },
    requirements: { level: 7 },
    diminishing: 0.45,
    minimumBonus: 0.3,
    macroProfile: {
      statProfile: { attack: 22, defense: 6, speed: 1.65, maxHealth: 105 },
      passiveAdjustments: [
        { type: 'multiplicative', stat: 'attack', value: 0.25 },
        { type: 'multiplicative', stat: 'speed', value: 0.12, scaleWithMultiplier: true },
      ],
      resistances: { chemical: 0.25, acid: 0.15 },
      weaknesses: { thermal: 0.2 },
      affinityOptions: [
        { element: ELEMENT_TYPES.CHEMICAL, affinity: AFFINITY_TYPES.DIVERGENT },
        { element: ELEMENT_TYPES.ACID, affinity: AFFINITY_TYPES.ATTUNED },
      ],
      subforms: ['viral', 'star'],
      rewardPc: 2,
    },
    effect: (state, context) => {
      const multiplier = calculateDiminishingMultiplier(
        context.previousPurchases,
        'large',
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      applyForm(state, context.entry.form);
      applyMacroEvolutionProfile(state, context.entry.macroProfile, multiplier);
      return { multiplier };
    },
  },
  colonyBastion: {
    name: 'Bastião Coloniado',
    icon: '🧫',
    color: '#00D9FF',
    category: 'macro',
    macro: true,
    form: 'bacterial',
    cost: { mg: 175, stableGenes: { major: 1 } },
    requirements: { level: 8 },
    diminishing: 0.5,
    minimumBonus: 0.35,
    macroProfile: {
      statProfile: { attack: 16, defense: 16, speed: 1.05, maxHealth: 145 },
      passiveAdjustments: [
        { type: 'additive', stat: 'defense', value: 4 },
        { type: 'multiplicative', stat: 'maxHealth', value: 0.12 },
      ],
      resistances: { bio: 0.2, acid: 0.1, kinetic: 0.05 },
      weaknesses: { thermal: 0.15 },
      affinityOptions: [
        { element: ELEMENT_TYPES.BIO, affinity: AFFINITY_TYPES.ATTUNED },
        { element: ELEMENT_TYPES.KINETIC, affinity: AFFINITY_TYPES.NEUTRAL },
      ],
      subforms: ['bacterial', 'amoeba'],
      rewardPc: 3,
    },
    effect: (state, context) => {
      const multiplier = calculateDiminishingMultiplier(
        context.previousPurchases,
        'large',
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      applyForm(state, context.entry.form);
      applyMacroEvolutionProfile(state, context.entry.macroProfile, multiplier);
      return { multiplier };
    },
  },
  extremophileShell: {
    name: 'Casulo Extremófilo',
    icon: '🜃',
    color: '#F8A12F',
    category: 'macro',
    macro: true,
    form: 'archaeal',
    cost: { mg: 185, stableGenes: { apex: 1 } },
    requirements: { level: 8 },
    diminishing: 0.5,
    minimumBonus: 0.35,
    macroProfile: {
      statProfile: { attack: 14, defense: 18, speed: 1.0, maxHealth: 150 },
      passiveAdjustments: [
        { type: 'additive', stat: 'defense', value: 5 },
        { type: 'multiplicative', stat: 'maxHealth', value: 0.15 },
      ],
      resistances: { acid: 0.25, thermal: 0.2 },
      weaknesses: { sonic: 0.15 },
      affinityOptions: [
        { element: ELEMENT_TYPES.ACID, affinity: AFFINITY_TYPES.ATTUNED },
        { element: ELEMENT_TYPES.THERMAL, affinity: AFFINITY_TYPES.ATTUNED },
      ],
      subforms: ['archaeal', 'geometric'],
      rewardPc: 3,
    },
    effect: (state, context) => {
      const multiplier = calculateDiminishingMultiplier(
        context.previousPurchases,
        'large',
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      applyForm(state, context.entry.form);
      applyMacroEvolutionProfile(state, context.entry.macroProfile, multiplier);
      return { multiplier };
    },
  },
  apexPredatorCrest: {
    name: 'Crina do Predador Ápice',
    icon: '🧬',
    color: '#FF6B6B',
    category: 'macro',
    macro: true,
    form: 'protozoan',
    cost: { mg: 190, stableGenes: { apex: 1 } },
    requirements: { level: 9 },
    diminishing: 0.55,
    minimumBonus: 0.35,
    macroProfile: {
      statProfile: { attack: 24, defense: 9, speed: 1.55, maxHealth: 120 },
      passiveAdjustments: [
        { type: 'multiplicative', stat: 'attack', value: 0.2, scaleWithMultiplier: true },
        { type: 'additive', stat: 'speed', value: 0.2 },
      ],
      resistances: { kinetic: 0.2 },
      weaknesses: { chemical: 0.12 },
      affinityOptions: [
        { element: ELEMENT_TYPES.KINETIC, affinity: AFFINITY_TYPES.ATTUNED },
        { element: ELEMENT_TYPES.ELECTRIC, affinity: AFFINITY_TYPES.NEUTRAL },
      ],
      subforms: ['protozoan', 'star'],
      rewardPc: 2,
    },
    effect: (state, context) => {
      const multiplier = calculateDiminishingMultiplier(
        context.previousPurchases,
        'large',
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      applyForm(state, context.entry.form);
      applyMacroEvolutionProfile(state, context.entry.macroProfile, multiplier);
      return { multiplier };
    },
  },
  lumenBloom: {
    name: 'Flor Lumínica',
    icon: '🌿',
    color: '#8BEA7C',
    category: 'macro',
    macro: true,
    form: 'algal',
    cost: { mg: 170, stableGenes: { major: 1 } },
    requirements: { level: 8 },
    diminishing: 0.5,
    minimumBonus: 0.33,
    macroProfile: {
      statProfile: { attack: 14, defense: 11, speed: 1.25, maxHealth: 140 },
      passiveAdjustments: [
        { type: 'multiplicative', stat: 'maxHealth', value: 0.1 },
        { type: 'additive', stat: 'speed', value: 0.1 },
      ],
      resistances: { electric: 0.2, bio: 0.1 },
      weaknesses: { acid: 0.12 },
      affinityOptions: [
        { element: ELEMENT_TYPES.ELECTRIC, affinity: AFFINITY_TYPES.ATTUNED },
        { element: ELEMENT_TYPES.BIO, affinity: AFFINITY_TYPES.ATTUNED },
      ],
      subforms: ['algal', 'sphere'],
      rewardPc: 2,
      energyBonus: 35,
    },
    effect: (state, context) => {
      const multiplier = calculateDiminishingMultiplier(
        context.previousPurchases,
        'large',
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      applyForm(state, context.entry.form);
      applyMacroEvolutionProfile(state, context.entry.macroProfile, multiplier);
      return { multiplier };
    },
  },
  mycelialConvergence: {
    name: 'Convergência Micelial',
    icon: '🍄',
    color: '#C98BFF',
    category: 'macro',
    macro: true,
    form: 'mycelial',
    cost: { mg: 195, stableGenes: { apex: 1 } },
    requirements: { level: 9 },
    diminishing: 0.55,
    minimumBonus: 0.4,
    macroProfile: {
      statProfile: { attack: 18, defense: 20, speed: 0.95, maxHealth: 160 },
      passiveAdjustments: [
        { type: 'multiplicative', stat: 'defense', value: 0.18 },
        { type: 'multiplicative', stat: 'maxHealth', value: 0.18 },
      ],
      resistances: { psionic: 0.25, chemical: 0.1 },
      weaknesses: { thermal: 0.15 },
      affinityOptions: [
        { element: ELEMENT_TYPES.PSIONIC, affinity: AFFINITY_TYPES.DIVERGENT },
        { element: ELEMENT_TYPES.ACID, affinity: AFFINITY_TYPES.DIVERGENT },
      ],
      subforms: ['mycelial', 'amoeba'],
      rewardPc: 3,
    },
    effect: (state, context) => {
      const multiplier = calculateDiminishingMultiplier(
        context.previousPurchases,
        'large',
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      applyForm(state, context.entry.form);
      applyMacroEvolutionProfile(state, context.entry.macroProfile, multiplier);
      return { multiplier };
    },
  },
};

