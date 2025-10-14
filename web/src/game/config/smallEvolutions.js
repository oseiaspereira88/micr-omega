import {
  addSkillOnce,
  applyMultiplicativePassive,
  ensureBaseStat,
} from './evolutionHelpers';

const diminishingMultiplier = (previousPurchases = 0, rate = 0.6, minimum = 0.2) => {
  if (previousPurchases <= 0) {
    return 1;
  }
  const scaled = rate ** previousPurchases;
  return Math.max(minimum, scaled);
};

export const smallEvolutions = {
  flagellum: {
    name: 'Flagelo',
    icon: '🦎',
    color: '#00FFB3',
    category: 'small',
    cost: { pc: 1 },
    requirements: { level: 1 },
    skill: 'pulse',
    diminishing: 0.65,
    minimumBonus: 0.25,
    effect: (state, context) => {
      const { organism } = state;
      const multiplier = diminishingMultiplier(
        context.previousPurchases,
        context.entry.diminishing,
        context.entry.minimumBonus
      );

      const incremental = 0.45 * multiplier;
      applyMultiplicativePassive(organism, 'speed', incremental);
      addSkillOnce(organism, 'pulse');
      ensureBaseStat(organism, 'size');
      organism.size = Math.max(organism.size ?? 32, 32) + 2 * multiplier;
      return { multiplier };
    },
  },
  spikes: {
    name: 'Espinhos',
    icon: '⚡',
    color: '#FF0066',
    category: 'small',
    cost: { pc: 1 },
    requirements: { level: 2 },
    skill: 'spike',
    diminishing: 0.6,
    minimumBonus: 0.2,
    effect: (state, context) => {
      const { organism } = state;
      const multiplier = diminishingMultiplier(
        context.previousPurchases,
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      const incremental = 0.55 * multiplier;
      applyMultiplicativePassive(organism, 'attack', incremental);
      addSkillOnce(organism, 'spike');
      return { multiplier };
    },
  },
  membrane: {
    name: 'Membrana',
    icon: '🛡️',
    color: '#FF6B00',
    category: 'small',
    cost: { pc: 1 },
    requirements: { level: 3 },
    skill: 'shield',
    diminishing: 0.55,
    minimumBonus: 0.25,
    effect: (state, context) => {
      const { organism } = state;
      const multiplier = diminishingMultiplier(
        context.previousPurchases,
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      const incremental = 0.5 * multiplier;
      applyMultiplicativePassive(organism, 'defense', incremental);
      addSkillOnce(organism, 'shield');
      state.maxHealth = Math.round((state.maxHealth ?? 100) * (1 + 0.15 * multiplier));
      state.health = Math.min(state.health ?? state.maxHealth ?? 0, state.maxHealth ?? 0);
      return { multiplier };
    },
  },
};

