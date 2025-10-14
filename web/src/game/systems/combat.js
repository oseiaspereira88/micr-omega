import { calculateDamageWithResistances } from '../engine/updateGameState';
import { AFFINITY_TYPES, ELEMENT_TYPES } from '../../shared/combat';

export const updateEnemy = (state, helpers = {}, enemy, delta = 0) => {
  if (!state || !enemy) return false;

  const { playSound, createEffect, addNotification } = helpers;
  const organism = state.organism;
  if (!organism) return false;

  enemy.animPhase += delta * 3;
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);

  const dx = organism.x - enemy.x;
  const dy = organism.y - enemy.y;
  const distToPlayer = Math.sqrt(dx * dx + dy * dy) || 1;

  if (enemy.boss) {
    enemy.vx += (dx / distToPlayer) * enemy.speed * 0.12;
    enemy.vy += (dy / distToPlayer) * enemy.speed * 0.12;
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
      enemy.vx += (dx / distToPlayer) * enemy.speed * 0.1;
      enemy.vy += (dy / distToPlayer) * enemy.speed * 0.1;
    } else if (enemy.behavior === 'territorial' && distToPlayer < 500) {
      enemy.vx += (dx / distToPlayer) * enemy.speed * 0.05;
      enemy.vy += (dy / distToPlayer) * enemy.speed * 0.05;
    } else if (enemy.behavior === 'opportunist') {
      if (distToPlayer < 350) {
        enemy.vx += (dx / distToPlayer) * enemy.speed * 0.1;
        enemy.vy += (dy / distToPlayer) * enemy.speed * 0.1;
      } else {
        enemy.vx += (Math.random() - 0.5) * enemy.speed * 0.05;
        enemy.vy += (Math.random() - 0.5) * enemy.speed * 0.05;
      }
    } else if (enemy.behavior === 'hunter') {
      enemy.vx += (dx / distToPlayer) * enemy.speed * 0.12;
      enemy.vy += (dy / distToPlayer) * enemy.speed * 0.12;
    }
  }

  enemy.vx *= 0.95;
  enemy.vy *= 0.95;

  const speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
  const maxSpeed = enemy.speed * (enemy.boss ? 1.5 : 2);
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
      const effectiveAttack = Math.max(0, (enemy.attack + attackBonus) * attackMultiplier);
      const defenseValue = Math.max(0, organism.defense ?? 0);
      const baseDamage = Math.max(0, effectiveAttack - defenseValue);
      const damageResult = calculateDamageWithResistances({
        baseDamage,
        attackerElement: enemy.element ?? ELEMENT_TYPES.BIO,
        attackElement: enemy.attackElement ?? enemy.element ?? ELEMENT_TYPES.BIO,
        attackerAffinity: enemy.affinity ?? AFFINITY_TYPES.NEUTRAL,
        targetElement: organism.element ?? ELEMENT_TYPES.BIO,
        targetResistances: organism.resistances ?? {},
        situationalModifiers: [],
      });
      const damage = Math.max(1, damageResult.damage);
      state.health -= damage;
      addNotification?.(state, `-${damage} HP`);
      playSound?.('damage');
      createEffect?.(state, organism.x, organism.y, 'hit', '#FF0000');

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
    state.boss = {
      active: true,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
      color: enemy.color
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
    syncState
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
  const attackRange = organism.attackRange + rangeBonus;

  state.enemies.forEach(enemy => {
    const dx = enemy.x - organism.x;
    const dy = enemy.y - organism.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (dist < attackRange) {
      const defenseMultiplier = enemy.dynamicModifiers?.defenseMultiplier ?? 1;
      const defenseBonus = enemy.dynamicModifiers?.defenseBonus ?? 0;
      const effectiveDefense = Math.max(0, (enemy.defense + defenseBonus) * defenseMultiplier * 0.5);
      const baseAttackValue = Math.max(0, organism.attack + attackBonus);
      const baseDamage = Math.max(0, baseAttackValue - effectiveDefense);
      const damageResult = calculateDamageWithResistances({
        baseDamage,
        attackerElement: organism.element ?? ELEMENT_TYPES.BIO,
        attackElement: organism.attackElement ?? organism.element ?? ELEMENT_TYPES.BIO,
        attackerAffinity: organism.affinity ?? AFFINITY_TYPES.NEUTRAL,
        targetElement: enemy.element ?? ELEMENT_TYPES.BIO,
        targetResistances: enemy.resistances ?? {},
        situationalModifiers: [],
        combo: { value: state.combo, multiplier: comboMultiplier },
        hooks: organism.comboHooks ?? {},
      });
      const damage = Math.max(1, damageResult.damage);
      enemy.health -= damage;

      createEffect?.(state, enemy.x, enemy.y, 'hit', organism.color);

      enemy.vx += (dx / dist) * 5;
      enemy.vy += (dy / dist) * 5;

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
        for (let i = 0; i < 15; i++) {
          createParticle?.(state, enemy.x, enemy.y, enemy.color);
        }
        dropPowerUps?.(state, enemy);
        if (enemy.boss) {
          state.boss = null;
          state.bossPending = false;
        }
        state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
      }

      if (enemy.boss && enemy.health > 0) {
        state.boss = {
          active: true,
          health: Math.max(0, enemy.health),
          maxHealth: enemy.maxHealth,
          color: enemy.color
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
