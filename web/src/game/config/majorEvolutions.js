import { forms } from './forms';
import {
  applyAdditivePassive,
  applyMultiplicativePassive,
  ensureBaseStat,
} from './evolutionHelpers';

const diminishingMultiplier = (previousPurchases = 0, rate = 0.5, minimum = 0.35) => {
  if (previousPurchases <= 0) return 1;
  return Math.max(minimum, rate ** previousPurchases);
};

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

export const majorEvolutions = {
  stellarBloom: {
    name: 'Flor Estelar',
    icon: '🌠',
    color: '#FFD369',
    category: 'large',
    form: 'star',
    cost: { mg: 150, stableGenes: { apex: 1 } },
    requirements: { level: 7 },
    diminishing: 0.45,
    minimumBonus: 0.35,
    effect: (state, context) => {
      const multiplier = diminishingMultiplier(
        context.previousPurchases,
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      applyForm(state, context.entry.form);
      const vitality = Math.round(60 * multiplier);
      applyAdditivePassive(state.organism, 'maxHealth', vitality);
      state.maxHealth = state.organism.maxHealth;
      state.health = Math.min((state.health ?? 0) + vitality, state.maxHealth);
      return { multiplier };
    },
  },
  abyssalColossus: {
    name: 'Colosso Abissal',
    icon: '🐙',
    color: '#4C6EF5',
    category: 'large',
    form: 'amoeba',
    cost: { mg: 175, stableGenes: { major: 1 } },
    requirements: { level: 8 },
    diminishing: 0.5,
    minimumBonus: 0.4,
    effect: (state, context) => {
      const multiplier = diminishingMultiplier(
        context.previousPurchases,
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      applyForm(state, context.entry.form);
      const defenseBoost = 0.9 * multiplier;
      applyMultiplicativePassive(state.organism, 'defense', defenseBoost);
      state.organism.attack = Math.max(5, state.organism.attack - 2 * multiplier);
      return { multiplier };
    },
  },
  prismaticVector: {
    name: 'Vetor Prismático',
    icon: '🔺',
    color: '#FF6B6B',
    category: 'large',
    form: 'geometric',
    cost: { mg: 200, stableGenes: { apex: 1, major: 1 } },
    requirements: { level: 10 },
    diminishing: 0.55,
    minimumBonus: 0.4,
    unique: true,
    effect: (state, context) => {
      const multiplier = diminishingMultiplier(
        context.previousPurchases,
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      applyForm(state, context.entry.form);
      const offense = 0.8 * multiplier;
      applyMultiplicativePassive(state.organism, 'attack', offense);
      state.organism.skillHaste = (state.organism.skillHaste ?? 0) + 0.25 * multiplier;
      return { multiplier };
    },
  },
};

