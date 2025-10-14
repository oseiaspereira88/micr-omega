import { createVisualEffect } from '../effects/visualEffects';
import { createParticle as generateParticle } from '../effects/particles';
import {
  ELEMENT_TYPES,
  SKILL_TYPES,
  STATUS_EFFECTS,
} from '../../shared/combat';
import {
  STATUS_METADATA,
  applyStatusEffect,
  getStatusEffectVisual,
} from '../systems/statusEffects';

const formatCost = (cost = {}) => ({
  energy: Math.max(0, Math.floor(cost.energy ?? 0)),
  xp: Math.max(0, Math.floor(cost.xp ?? 0)),
  mg: Math.max(0, Math.floor(cost.mg ?? 0)),
});

const createStatusEffect = (state, entity, statusKey, options = {}) => {
  const result = applyStatusEffect(entity, { type: statusKey, ...options });
  if (result.applied) {
    const color = STATUS_METADATA[statusKey]?.color ?? '#ffffff';
    state.effects.push(createVisualEffect(entity.x, entity.y, getStatusEffectVisual(statusKey), color));
  }
  return result;
};

export const createSkills = ({ playSound }) => ({
  pulse: {
    name: 'Pulso Osmótico',
    icon: '💥',
    cooldown: 3200,
    cost: formatCost({ energy: 28, xp: 6 }),
    color: '#00D9FF',
    element: ELEMENT_TYPES.ELECTRIC,
    type: SKILL_TYPES.ACTIVE,
    applies: [STATUS_EFFECTS.FISSURE, STATUS_EFFECTS.KNOCKBACK],
    effect: (state) => {
      const org = state.organism;
      const radius = (org.range ?? org.attackRange) * 1.1;
      let affected = 0;
      state.enemies.forEach((enemy) => {
        const dx = enemy.x - org.x;
        const dy = enemy.y - org.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          enemy.vx += (dx / (dist || 1)) * 18;
          enemy.vy += (dy / (dist || 1)) * 18;
          enemy.health -= Math.max(4, org.attack * 0.45);
          createStatusEffect(state, enemy, STATUS_EFFECTS.FISSURE, { stacks: 1, duration: 6 });
          affected += 1;
        }
      });
      state.effects.push(createVisualEffect(org.x, org.y, 'pulse', '#00D9FF'));
      if (affected > 0) {
        playSound('skill');
      }
    },
  },
  spike: {
    name: 'Lança Corrosiva',
    icon: '🔱',
    cooldown: 2300,
    cost: formatCost({ energy: 18, xp: 4 }),
    color: '#FF0066',
    element: ELEMENT_TYPES.ACID,
    type: SKILL_TYPES.ACTIVE,
    applies: [STATUS_EFFECTS.CORROSION],
    effect: (state) => {
      const org = state.organism;
      for (let i = 0; i < 3; i++) {
        state.projectiles.push({
          x: org.x,
          y: org.y,
          vx: Math.cos(org.angle + (i - 1) * 0.28) * 9,
          vy: Math.sin(org.angle + (i - 1) * 0.28) * 9,
          damage: org.attack * 1.35,
          life: 2.5,
          color: '#FF0066',
          type: 'spike',
          element: ELEMENT_TYPES.ACID,
          onHit: (enemy) => {
            createStatusEffect(state, enemy, STATUS_EFFECTS.CORROSION, { stacks: 1, duration: 7 });
          },
        });
      }
      playSound('shoot');
    },
  },
  shield: {
    name: 'Biofilme Local',
    icon: '🛡️',
    cooldown: 5200,
    cost: formatCost({ energy: 24, mg: 5 }),
    color: '#7ED957',
    element: ELEMENT_TYPES.BIO,
    type: SKILL_TYPES.ACTIVE,
    applies: [STATUS_EFFECTS.ENTANGLED],
    effect: (state) => {
      const org = state.organism;
      state.enemies.forEach((enemy) => {
        const dx = enemy.x - org.x;
        const dy = enemy.y - org.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < (org.range ?? org.attackRange) * 0.8) {
          createStatusEffect(state, enemy, STATUS_EFFECTS.ENTANGLED, { stacks: 1, duration: 4 });
        }
      });
      org.invulnerable = true;
      setTimeout(() => {
        org.invulnerable = false;
      }, 1800);
      state.health = Math.min(state.maxHealth, state.health + Math.round(org.attack * 0.4));
      state.effects.push(createVisualEffect(org.x, org.y, 'shield', '#7ED957'));
      playSound('buff');
    },
  },
  drain: {
    name: 'Absorção Vital',
    icon: '🌀',
    cooldown: 4200,
    cost: formatCost({ energy: 30, xp: 8 }),
    color: '#00FF88',
    element: ELEMENT_TYPES.BIO,
    type: SKILL_TYPES.ACTIVE,
    applies: [STATUS_EFFECTS.LEECH, STATUS_EFFECTS.RESTORE],
    effect: (state) => {
      const org = state.organism;
      let totalDrain = 0;

      state.enemies.forEach((enemy) => {
        const dx = enemy.x - org.x;
        const dy = enemy.y - org.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (org.range ?? org.attackRange) * 1.4) {
          const drain = Math.min(enemy.health, Math.max(6, org.attack * 0.4));
          enemy.health -= drain;
          totalDrain += drain;
          createStatusEffect(state, enemy, STATUS_EFFECTS.FISSURE, { stacks: 1, duration: 4 });

          for (let i = 0; i < 5; i++) {
            const t = i / 5;
            state.particles.push(
              generateParticle(
                enemy.x + (org.x - enemy.x) * t,
                enemy.y + (org.y - enemy.y) * t,
                '#00FF88',
                3
              )
            );
          }
        }
      });

      state.health = Math.min(state.maxHealth, state.health + Math.round(totalDrain));
      state.effects.push(createVisualEffect(org.x, org.y, 'drain', '#00FF88'));
      playSound('drain');
    },
  },
  biofilm: {
    name: 'Rede Fotônica',
    icon: '🔆',
    cooldown: 3600,
    cost: formatCost({ energy: 26, xp: 10 }),
    color: '#FFD93D',
    element: ELEMENT_TYPES.THERMAL,
    type: SKILL_TYPES.ACTIVE,
    applies: [STATUS_EFFECTS.PHOTOLESION],
    effect: (state) => {
      const org = state.organism;
      const facingX = Math.cos(org.angle);
      const facingY = Math.sin(org.angle);
      state.enemies.forEach((enemy) => {
        const toEnemyX = enemy.x - org.x;
        const toEnemyY = enemy.y - org.y;
        const dist = Math.sqrt(toEnemyX * toEnemyX + toEnemyY * toEnemyY) || 1;
        const alignment = (toEnemyX * facingX + toEnemyY * facingY) / dist;
        if (dist < (org.range ?? org.attackRange) * 1.6 && alignment > 0.45) {
          enemy.health -= Math.max(5, org.attack * 0.55);
          createStatusEffect(state, enemy, STATUS_EFFECTS.PHOTOLESION, { stacks: 1, duration: 5 });
        }
      });
      state.effects.push(createVisualEffect(org.x, org.y, 'photolesion', '#FFD93D'));
      playSound('skill');
    },
  },
  entangle: {
    name: 'Tecido Adesivo',
    icon: '🕸️',
    cooldown: 2800,
    cost: formatCost({ energy: 16, mg: 4 }),
    color: '#7F8CFF',
    element: ELEMENT_TYPES.PSIONIC,
    type: SKILL_TYPES.ACTIVE,
    applies: [STATUS_EFFECTS.ENTANGLED],
    effect: (state) => {
      const org = state.organism;
      state.enemies.forEach((enemy) => {
        const dx = enemy.x - org.x;
        const dy = enemy.y - org.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < (org.range ?? org.attackRange) * 1.3) {
          createStatusEffect(state, enemy, STATUS_EFFECTS.ENTANGLED, { stacks: 2, duration: 3.5 });
        }
      });
      state.effects.push(createVisualEffect(org.x, org.y, 'entangled', '#7F8CFF'));
      playSound('skill');
    },
  },
});
