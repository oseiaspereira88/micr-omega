import { createVisualEffect } from '../effects/visualEffects';
import { createParticle as generateParticle } from '../effects/particles';
import {
  ELEMENT_TYPES,
  SKILL_TYPES,
  STATUS_EFFECTS,
} from '../../shared/combat';

export const createSkills = ({ playSound }) => ({
  pulse: {
    name: 'Pulso Energético',
    icon: '💥',
    cooldown: 3000,
    cost: 20,
    color: '#00D9FF',
    element: ELEMENT_TYPES.ELECTRIC,
    type: SKILL_TYPES.ACTIVE,
    applies: [STATUS_EFFECTS.KNOCKBACK, STATUS_EFFECTS.STAGGER],
    effect: (state) => {
      const org = state.organism;
      state.enemies.forEach(enemy => {
        const dx = enemy.x - org.x;
        const dy = enemy.y - org.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 200) {
          enemy.vx += (dx / dist) * 15;
          enemy.vy += (dy / dist) * 15;
          enemy.health -= org.attack * 0.5;
          state.effects.push(createVisualEffect(enemy.x, enemy.y, 'pulse', '#00D9FF'));
        }
      });
      state.effects.push(createVisualEffect(org.x, org.y, 'shockwave', '#00D9FF'));
      playSound('skill');
    }
  },
  spike: {
    name: 'Lança de Espinhos',
    icon: '🔱',
    cooldown: 2000,
    cost: 15,
    color: '#FF0066',
    element: ELEMENT_TYPES.KINETIC,
    type: SKILL_TYPES.ACTIVE,
    applies: [STATUS_EFFECTS.BLEED],
    effect: (state) => {
      const org = state.organism;
      for (let i = 0; i < 3; i++) {
        state.projectiles.push({
          x: org.x,
          y: org.y,
          vx: Math.cos(org.angle + (i - 1) * 0.3) * 8,
          vy: Math.sin(org.angle + (i - 1) * 0.3) * 8,
          damage: org.attack * 1.5,
          life: 2,
          color: '#FF0066',
          type: 'spike',
          element: ELEMENT_TYPES.KINETIC,
        });
      }
      playSound('shoot');
    }
  },
  shield: {
    name: 'Escudo Celular',
    icon: '🛡️',
    cooldown: 5000,
    cost: 25,
    color: '#FFD700',
    element: ELEMENT_TYPES.PSIONIC,
    type: SKILL_TYPES.ACTIVE,
    applies: [STATUS_EFFECTS.SHIELD, STATUS_EFFECTS.BARRIER],
    effect: (state) => {
      state.organism.invulnerable = true;
      setTimeout(() => { state.organism.invulnerable = false; }, 2000);
      state.effects.push(createVisualEffect(state.organism.x, state.organism.y, 'shield', '#FFD700'));
      playSound('buff');
    }
  },
  drain: {
    name: 'Absorção Vital',
    icon: '🌀',
    cooldown: 4000,
    cost: 30,
    color: '#00FF88',
    element: ELEMENT_TYPES.BIO,
    type: SKILL_TYPES.ACTIVE,
    applies: [STATUS_EFFECTS.LEECH, STATUS_EFFECTS.RESTORE],
    effect: (state) => {
      const org = state.organism;
      let totalDrain = 0;

      state.enemies.forEach(enemy => {
        const dx = enemy.x - org.x;
        const dy = enemy.y - org.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 250) {
          const drain = Math.min(enemy.health, 15);
          enemy.health -= drain;
          totalDrain += drain;

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

      state.health = Math.min(state.maxHealth, state.health + totalDrain);
      state.effects.push(createVisualEffect(org.x, org.y, 'drain', '#00FF88'));
      playSound('drain');
    }
  }
});
