import {
  applyAdditivePassive,
  applyMultiplicativePassive,
  ensureBaseStat,
} from './evolutionHelpers';
import { calculateDiminishingMultiplier } from '@micr-omega/shared';

export const mediumEvolutions = {
  bioCapacitor: {
    name: 'Biocapacitor',
    icon: '🧪',
    color: '#7B2FFF',
    category: 'medium',
    cost: { mg: 60, fragments: { major: 1 } },
    requirements: { level: 4 },
    diminishing: 0.6,
    minimumBonus: 0.35,
    effect: (state, context) => {
      const { organism } = state;
      const multiplier = calculateDiminishingMultiplier(
        context.previousPurchases,
        'medium',
        context.entry.diminishing,
        context.entry.minimumBonus
      );

      const additive = Math.round(25 * multiplier);
      applyAdditivePassive(organism, 'maxHealth', additive);
      state.maxHealth = organism.maxHealth;
      if (Number.isFinite(state.health)) {
        state.health = Math.min(state.health + additive, state.maxHealth);
      }

      const bonusStorage = Math.round(20 * multiplier);
      state.geneticMaterial.bonus = (state.geneticMaterial.bonus ?? 0) + bonusStorage;
      return { multiplier };
    },
  },
  synapticOverdrive: {
    name: 'Sobrecarga Sináptica',
    icon: '🧠',
    color: '#FF00E5',
    category: 'medium',
    cost: { mg: 75, fragments: { major: 1 } },
    requirements: { level: 5 },
    diminishing: 0.5,
    minimumBonus: 0.3,
    effect: (state, context) => {
      const { organism } = state;
      const multiplier = calculateDiminishingMultiplier(
        context.previousPurchases,
        'medium',
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      const haste = 0.35 * multiplier;
      applyMultiplicativePassive(organism, 'speed', haste / 2);
      organism.skillHaste = (organism.skillHaste ?? 0) + haste;
      Object.keys(organism.skillCooldowns || {}).forEach((key) => {
        organism.skillCooldowns[key] = Math.max(
          0,
          (organism.skillCooldowns[key] ?? 0) - haste
        );
      });
      return { multiplier };
    },
  },
  crystallineShell: {
    name: 'Carapaça Cristalina',
    icon: '💠',
    color: '#00D9FF',
    category: 'medium',
    cost: { mg: 90, fragments: { major: 2 } },
    requirements: { level: 6 },
    diminishing: 0.58,
    minimumBonus: 0.3,
    unique: true,
    effect: (state, context) => {
      const { organism } = state;
      const multiplier = calculateDiminishingMultiplier(
        context.previousPurchases,
        'medium',
        context.entry.diminishing,
        context.entry.minimumBonus
      );
      const defenseBoost = 0.8 * multiplier;
      applyMultiplicativePassive(organism, 'defense', defenseBoost);
      ensureBaseStat(organism, 'formDefenseMultiplier');
      organism.formDefenseMultiplier = (organism.formDefenseMultiplier ?? 1) + 0.1;
      return { multiplier };
    },
  },
};

