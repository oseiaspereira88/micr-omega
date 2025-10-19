import { calculateDamageWithResistances } from '../engine/updateGameState';
import { AFFINITY_TYPES, ELEMENT_TYPES } from '../../shared/combat';
import {
  STATUS_METADATA,
  getStatusCriticalBonus,
  getStatusDamageModifier,
  getStatusDefensePenalty,
  getStatusEffectVisual,
  getStatusMovementMultiplier,
  shouldTriggerPhagocytosis,
  tickStatusEffects,
} from './statusEffects';
import { pushDamagePopup } from '../state/damagePopups';
import {
  createCriticalSparks,
  createElementalBurst,
  createStatusDrip,
} from '../effects/particles';

const resolveBossName = (enemy) => {
  if (!enemy || typeof enemy !== 'object') return null;

  const candidates = [enemy.name, enemy.label, enemy.species];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
};

const ELEMENT_PARTICLE_COLORS = {
  [ELEMENT_TYPES.BIO]: '#7ED957',
  [ELEMENT_TYPES.CHEMICAL]: '#f59e0b',
  [ELEMENT_TYPES.ACID]: '#ff4d6d',
  [ELEMENT_TYPES.THERMAL]: '#ffd93d',
  [ELEMENT_TYPES.ELECTRIC]: '#00d9ff',
  [ELEMENT_TYPES.KINETIC]: '#f97316',
  [ELEMENT_TYPES.PSIONIC]: '#9f7aea',
  [ELEMENT_TYPES.SONIC]: '#60a5fa',
};

const resolveElementColor = (element, fallback) =>
  ELEMENT_PARTICLE_COLORS[element] ?? fallback ?? '#ffffff';

export const updateEnemy = (state, helpers = {}, enemy, delta = 0) => {
  if (!state || !enemy) return false;

  const { playSound, createEffect, addNotification, createParticle } = helpers;
  const organism = state.organism;
  if (!organism) return false;

  tickStatusEffects(enemy, delta, {
    onDamage: ({ damage, status }) => {
      const normalizedDamage = Math.max(0, damage);
      if (normalizedDamage <= 0) return;
      enemy.health = Math.max(0, enemy.health - normalizedDamage);
      const color = STATUS_METADATA[status]?.color ?? enemy.color;
      createEffect?.(state, enemy.x, enemy.y, getStatusEffectVisual(status), color);
      createParticle?.(
        state,
        createStatusDrip(enemy.x, enemy.y, {
          color,
          life: 1.1,
          count: 4,
          direction: Math.PI / 2,
        }),
      );
      pushDamagePopup(state, {
        x: enemy.x,
        y: enemy.y,
        value: normalizedDamage,
        variant: 'status',
      });
    },
  });

  enemy.animPhase += delta * 3;
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);

  const dx = organism.x - enemy.x;
  const dy = organism.y - enemy.y;
  const distToPlayer = Math.sqrt(dx * dx + dy * dy) || 1;

  const statusSpeedMultiplier = getStatusMovementMultiplier(enemy);
  const effectiveSpeed = enemy.speed * statusSpeedMultiplier;

  if (enemy.boss) {
    enemy.vx += (dx / distToPlayer) * effectiveSpeed * 0.12;
    enemy.vy += (dy / distToPlayer) * effectiveSpeed * 0.12;
    enemy.rotation = (enemy.rotation || 0) + delta * 0.4;
    enemy.animPhase += delta * 2;
  } else {
    if (distToPlayer > 1500) {
      enemy.ticksOutOfRange++;
      if (enemy.ticksOutOfRange > 100) return false;
    } else {
      enemy.ticksOutOfRange = 0;
    }

    if (enemy.behavior === 'aggressive' && distToPlayer < 800) {
      enemy.vx += (dx / distToPlayer) * effectiveSpeed * 0.1;
      enemy.vy += (dy / distToPlayer) * effectiveSpeed * 0.1;
    } else if (enemy.behavior === 'territorial' && distToPlayer < 500) {
      enemy.vx += (dx / distToPlayer) * effectiveSpeed * 0.05;
      enemy.vy += (dy / distToPlayer) * effectiveSpeed * 0.05;
    } else if (enemy.behavior === 'opportunist') {
      if (distToPlayer < 350) {
        enemy.vx += (dx / distToPlayer) * effectiveSpeed * 0.1;
        enemy.vy += (dy / distToPlayer) * effectiveSpeed * 0.1;
      } else {
        enemy.vx += (Math.random() - 0.5) * effectiveSpeed * 0.05;
        enemy.vy += (Math.random() - 0.5) * effectiveSpeed * 0.05;
      }
    } else if (enemy.behavior === 'hunter') {
      enemy.vx += (dx / distToPlayer) * effectiveSpeed * 0.12;
      enemy.vy += (dy / distToPlayer) * effectiveSpeed * 0.12;
    }
  }

  enemy.vx *= 0.95;
  enemy.vy *= 0.95;

  const speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
  const maxSpeed = effectiveSpeed * (enemy.boss ? 1.5 : 2);
  if (speed > maxSpeed) {
    enemy.vx = (enemy.vx / speed) * maxSpeed;
    enemy.vy = (enemy.vy / speed) * maxSpeed;
  }

  enemy.x += enemy.vx;
  enemy.y += enemy.vy;

  if (distToPlayer < enemy.size + organism.size + 10 && enemy.attackCooldown === 0) {
    const powerShieldActive =
      organism.hasShieldPowerUp ||
      organism.invulnerableFromPowerUp ||
      state.activePowerUps.some(p => p.type === 'invincibility');

    if (!organism.invulnerable && !organism.dying && !powerShieldActive) {
      const attackMultiplier = enemy.dynamicModifiers?.attackMultiplier ?? 1;
      const attackBonus = enemy.dynamicModifiers?.attackBonus ?? 0;
      const penetration = Number.isFinite(enemy.penetration) ? enemy.penetration : 0;
      const critBonus = getStatusCriticalBonus(enemy);
      const rng = helpers?.rng ?? Math.random;
      const criticalChance = Math.max(
        0,
        Math.min(0.75, (enemy.criticalChance ?? 0) + critBonus)
      );
      const criticalMultiplier = Math.max(1, enemy.criticalMultiplier ?? 1.5);
      const effectiveAttack = Math.max(0, (enemy.attack + attackBonus) * attackMultiplier);
      const defensePenalty = getStatusDefensePenalty(organism);
      const rawDefense = Math.max(0, (organism.defense ?? 0) * Math.max(0.5, organism.stability ?? 1));
      const adjustedDefense = Math.max(0, rawDefense * Math.max(0, 1 - defensePenalty));
      const mitigatedDefense = Math.max(0, adjustedDefense - penetration);
      const defenseReductionCap = Math.max(
        0.35,
        Math.min(0.8, 0.5 + (organism.stability ?? 1) * 0.12)
      );
      const reducedDamage = Math.max(
        effectiveAttack * (1 - defenseReductionCap),
        effectiveAttack - mitigatedDefense
      );
      const criticalRoll = typeof rng === 'function' ? rng() : Math.random();
      const criticalHit = criticalRoll < criticalChance;
      const baseDamage = criticalHit ? reducedDamage * criticalMultiplier : reducedDamage;
      const situationalModifiers = [];
      const attackElement = enemy.attackElement ?? enemy.element ?? ELEMENT_TYPES.BIO;
      const statusBonus = getStatusDamageModifier({ target: organism, attackElement });
      if (statusBonus !== 0) {
        situationalModifiers.push(statusBonus);
      }
      const damageResult = calculateDamageWithResistances({
        baseDamage,
        attackerElement: enemy.element ?? ELEMENT_TYPES.BIO,
        attackElement: enemy.attackElement ?? enemy.element ?? ELEMENT_TYPES.BIO,
        attackerAffinity: enemy.affinity ?? AFFINITY_TYPES.NEUTRAL,
        targetElement: organism.element ?? ELEMENT_TYPES.BIO,
        targetResistances: organism.resistances ?? {},
        situationalModifiers,
      });
      const damage = Math.max(1, damageResult.damage);
      state.health -= damage;
      addNotification?.(state, `-${damage} HP`);
      playSound?.('damage');
      createEffect?.(state, organism.x, organism.y, 'hit', '#FF0000');

      if (criticalHit) {
        addNotification?.(state, '💥 Golpe crítico inimigo!');
      }

      if (damageResult.relation === 'advantage') {
        addNotification?.(state, '⚠️ Afinidade inimiga explorou sua fraqueza!');
      } else if (damageResult.relation === 'disadvantage') {
        addNotification?.(state, '🛡️ Resistência absorveu parte do dano.');
      }

      organism.eyeExpression = 'hurt';
      setTimeout(() => { organism.eyeExpression = 'neutral'; }, 500);

      if (state.health <= 0) {
        organism.dying = true;
        organism.deathTimer = 2;
      }
    }
    enemy.attackCooldown = enemy.boss ? 2.2 : 1.5;

    organism.vx += (dx / distToPlayer) * -3;
    organism.vy += (dy / distToPlayer) * -3;
    state.combo = 0;
    state.comboTimer = 0;
    state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
  }

  if (enemy.boss) {
    const resolvedName = resolveBossName(enemy) ?? state.boss?.name ?? null;
    state.boss = {
      active: true,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
      color: enemy.color,
      name: resolvedName,
    };
  }

  return enemy.health > 0;
};

export const performAttack = (state, helpers = {}) => {
  if (!state) return state;

  const {
    playSound,
    createEffect,
    createParticle,
    addNotification,
    dropPowerUps,
    syncState,
  } = helpers;

  const organism = state.organism;
  if (!organism || organism.attackCooldown > 0 || organism.dying) {
    return state;
  }

  let hitSomething = false;
  let comboSound = false;

  const comboMultiplier = 1 + (state.combo * 0.05);
  const attackBonus = organism.currentAttackBonus || 0;
  const rangeBonus = organism.currentRangeBonus || 0;
  const attackRange = (organism.range ?? organism.attackRange) + rangeBonus;
  const rng = helpers?.rng ?? Math.random;
  const attackerStability = Math.max(0.6, organism.stability ?? 1);

  state.enemies.forEach(enemy => {
    const dx = enemy.x - organism.x;
    const dy = enemy.y - organism.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (dist < attackRange) {
      const defenseMultiplier = enemy.dynamicModifiers?.defenseMultiplier ?? 1;
      const defenseBonus = enemy.dynamicModifiers?.defenseBonus ?? 0;
      const penetration = Number.isFinite(organism.penetration) ? organism.penetration : 0;
      const critBonus = getStatusCriticalBonus(organism);
      const criticalChance = Math.max(
        0,
        Math.min(0.85, (organism.criticalChance ?? 0) + critBonus)
      );
      const criticalMultiplier = Math.max(1, organism.criticalMultiplier ?? 1.5);
      const baseAttackValue = Math.max(0, (organism.attack + attackBonus) * attackerStability);
      const defensePenalty = getStatusDefensePenalty(enemy);
      const baseDefense = Math.max(
        0,
        (enemy.defense + defenseBonus) * defenseMultiplier * Math.max(0.5, enemy.stability ?? 1)
      );
      const adjustedDefense = Math.max(0, baseDefense * Math.max(0, 1 - defensePenalty));
      const mitigatedDefense = Math.max(0, adjustedDefense - penetration);
      const defenseReductionCap = Math.max(
        0.32,
        Math.min(0.85, 0.45 + (enemy.stability ?? 1) * 0.1)
      );
      const reducedDamage = Math.max(
        baseAttackValue * (1 - defenseReductionCap),
        baseAttackValue - mitigatedDefense
      );
      const critRoll = typeof rng === 'function' ? rng() : Math.random();
      const criticalHit = critRoll < criticalChance;
      const baseDamage = criticalHit ? reducedDamage * criticalMultiplier : reducedDamage;
      const situationalModifiers = [];
      const attackElement = organism.attackElement ?? organism.element ?? ELEMENT_TYPES.BIO;
      const statusBonus = getStatusDamageModifier({ target: enemy, attackElement });
      if (statusBonus !== 0) {
        situationalModifiers.push(statusBonus);
      }

      const damageResult = calculateDamageWithResistances({
        baseDamage,
        attackerElement: organism.element ?? ELEMENT_TYPES.BIO,
        attackElement,
        attackerAffinity: organism.affinity ?? AFFINITY_TYPES.NEUTRAL,
        targetElement: enemy.element ?? ELEMENT_TYPES.BIO,
        targetResistances: enemy.resistances ?? {},
        situationalModifiers,
        combo: { value: state.combo, multiplier: comboMultiplier },
        hooks: organism.comboHooks ?? {},
      });
      const damage = Math.max(1, damageResult.damage);
      enemy.health -= damage;

      createEffect?.(state, enemy.x, enemy.y, 'hit', organism.color);
      const attackDirection = Math.atan2(enemy.y - organism.y, enemy.x - organism.x);
      const elementColor = resolveElementColor(attackElement, organism.color);
      let impactParticles;

      if (criticalHit) {
        impactParticles = createCriticalSparks(enemy.x, enemy.y, {
          color: elementColor,
          highlight: '#ffffff',
          direction: attackDirection,
          count: 10,
          speed: 9,
        });
      } else if (damageResult.relation === 'advantage') {
        impactParticles = createElementalBurst(enemy.x, enemy.y, {
          color: elementColor,
          direction: attackDirection,
          count: 14,
          life: 1.1,
          speed: 8,
        });
      } else if (damageResult.relation === 'disadvantage') {
        impactParticles = createStatusDrip(enemy.x, enemy.y, {
          color: elementColor,
          direction: attackDirection + Math.PI / 2,
          count: 6,
          life: 0.8,
        });
      } else {
        impactParticles = createElementalBurst(enemy.x, enemy.y, {
          color: elementColor,
          direction: attackDirection,
          count: 10,
          life: 0.85,
          speed: 6,
        });
      }
      createParticle?.(state, impactParticles);

      enemy.vx += (dx / dist) * 5;
      enemy.vy += (dy / dist) * 5;

      const popupVariant = criticalHit
        ? 'critical'
        : damageResult.relation === 'advantage'
        ? 'advantage'
        : damageResult.relation === 'disadvantage'
        ? 'resisted'
        : 'normal';
      pushDamagePopup(state, {
        x: enemy.x,
        y: enemy.y,
        value: damage,
        variant: popupVariant,
      });

      if (criticalHit) {
        addNotification?.(state, '✨ Crítico!');
        createEffect?.(state, enemy.x, enemy.y, 'critical', organism.color);
      }

      hitSomething = true;

      state.combo += 1;
      state.comboTimer = 3;
      if (state.combo > state.maxCombo) state.maxCombo = state.combo;
      if (state.combo > 0 && state.combo % 6 === 0) comboSound = true;

      if (damageResult.relation === 'advantage') {
        addNotification?.(state, '⚡ Ataque explorou fraqueza elemental!');
      } else if (damageResult.relation === 'disadvantage') {
        addNotification?.(state, '🛡️ Resistência inimiga reduziu o golpe.');
      }

      if (typeof organism.comboHooks?.onDamageResolved === 'function') {
        organism.comboHooks.onDamageResolved({ damageResult, enemy, state });
      }

      if (enemy.health <= 0) {
        state.energy += 30;
        state.score += enemy.points;
        addNotification?.(state, `+${enemy.points} pts`);
        createParticle?.(
          state,
          createElementalBurst(enemy.x, enemy.y, {
            color: enemy.color,
            count: 24,
            life: 1.2,
            speed: 9,
            spread: Math.PI * 2,
          }),
        );
        dropPowerUps?.(state, enemy);
        if (enemy.boss) {
          state.boss = null;
          state.bossPending = false;
        }
        state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);

        if (shouldTriggerPhagocytosis({ attacker: organism, target: enemy })) {
          const heal = Math.max(5, Math.round(enemy.maxHealth * 0.12));
          state.health = Math.min(state.maxHealth, state.health + heal);
          state.energy += Math.round(enemy.points * 0.1);
          addNotification?.(state, '🧫 Fagocitose!');
          playSound?.('drain');
          createEffect?.(state, enemy.x, enemy.y, 'phagocytosis', organism.color);
        } else if (organism.mass > (enemy.mass ?? 1) && damage > enemy.maxHealth * 0.2) {
          enemy.vx += (dx / dist) * 6;
          enemy.vy += (dy / dist) * 6;
          createEffect?.(state, enemy.x, enemy.y, 'knockback', organism.color);
        }
      }

      if (enemy.boss && enemy.health > 0) {
        const resolvedName = resolveBossName(enemy) ?? state.boss?.name ?? null;
        state.boss = {
          active: true,
          health: Math.max(0, enemy.health),
          maxHealth: enemy.maxHealth,
          color: enemy.color,
          name: resolvedName,
        };
      }
    }
  });

  if (hitSomething) {
    playSound?.('attack');
    if (comboSound) playSound?.('combo');
    organism.attackCooldown = 0.8;
    organism.eyeExpression = 'attacking';
    setTimeout(() => { organism.eyeExpression = 'neutral'; }, 300);
    createEffect?.(state, organism.x, organism.y, 'attack', organism.color);
    state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
  } else {
    state.combo = Math.max(0, state.combo - 1);
    if (state.combo === 0) {
      state.comboTimer = 0;
    }
  }

  syncState?.(state);
  return state;
};
