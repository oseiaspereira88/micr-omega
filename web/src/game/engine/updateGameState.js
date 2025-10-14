import {
  nebulaTypes,
} from '../config';

const toFiniteNumber = value => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const ensureNumber = (value, fallback = 0) => {
  const fallbackNumber = toFiniteNumber(fallback);
  const normalizedFallback = fallbackNumber ?? 0;
  const finiteValue = toFiniteNumber(value);
  return finiteValue ?? normalizedFallback;
};

const resolveEnemyDamage = enemy => {
  if (!enemy) return 0;

  const candidateKeys = ['attack', 'damage', 'baseDamage'];
  for (const key of candidateKeys) {
    const damage = toFiniteNumber(enemy[key]);
    if (damage !== null) {
      return damage;
    }
  }

  return 0;
};

const applyBuffModifiersToDynamic = (dynamic, modifiers = {}) => {
  if (!dynamic || typeof dynamic !== 'object') return;
  if (!modifiers || typeof modifiers !== 'object') return;

  if (typeof modifiers.attackMultiplier === 'number' && Number.isFinite(modifiers.attackMultiplier)) {
    dynamic.attackMultiplier *= modifiers.attackMultiplier;
  }

  if (typeof modifiers.defenseMultiplier === 'number' && Number.isFinite(modifiers.defenseMultiplier)) {
    dynamic.defenseMultiplier *= modifiers.defenseMultiplier;
  }

  if (typeof modifiers.speedMultiplier === 'number' && Number.isFinite(modifiers.speedMultiplier)) {
    dynamic.speedMultiplier *= modifiers.speedMultiplier;
  }

  if (typeof modifiers.sizeMultiplier === 'number' && Number.isFinite(modifiers.sizeMultiplier)) {
    dynamic.sizeMultiplier *= modifiers.sizeMultiplier;
  }

  if (typeof modifiers.attackBonus === 'number' && Number.isFinite(modifiers.attackBonus)) {
    dynamic.attackBonus += modifiers.attackBonus;
  }

  if (typeof modifiers.defenseBonus === 'number' && Number.isFinite(modifiers.defenseBonus)) {
    dynamic.defenseBonus += modifiers.defenseBonus;
  }

  if (typeof modifiers.speedBonus === 'number' && Number.isFinite(modifiers.speedBonus)) {
    dynamic.speedBonus += modifiers.speedBonus;
  }

  if (typeof modifiers.sizeBonus === 'number' && Number.isFinite(modifiers.sizeBonus)) {
    dynamic.sizeBonus += modifiers.sizeBonus;
  }
};

const applyBuffToEnemy = (enemy, buff = {}, { immediate = false } = {}) => {
  if (!enemy || !buff || typeof buff !== 'object') return;

  const normalizedDuration = ensureNumber(buff.remaining ?? buff.duration, 0);
  if (normalizedDuration <= 0) return;

  const normalizedBuff = {
    sourceId: buff.sourceId ?? enemy.id,
    type: buff.type ?? 'generic',
    remaining: normalizedDuration,
    modifiers: { ...(buff.modifiers || {}) },
  };

  if (!Array.isArray(enemy.activeBuffs)) {
    enemy.activeBuffs = [];
  }

  const existingBuff = enemy.activeBuffs.find(
    (item) => item.sourceId === normalizedBuff.sourceId && item.type === normalizedBuff.type
  );

  if (existingBuff) {
    existingBuff.remaining = Math.max(
      ensureNumber(existingBuff.remaining, 0),
      normalizedBuff.remaining
    );
    existingBuff.modifiers = { ...existingBuff.modifiers, ...normalizedBuff.modifiers };
  } else {
    enemy.activeBuffs.push({ ...normalizedBuff });
  }

  if (immediate && enemy.dynamicModifiers) {
    applyBuffModifiersToDynamic(enemy.dynamicModifiers, normalizedBuff.modifiers);
  }
};

export const updateGameState = ({
  state,
  delta = 0,
  movementIntent = {},
  helpers = {},
  spawnEnemy,
  spawnBoss,
  spawnOrganicMatter,
  applyPowerUp,
}) => {
  if (!state) return;

  const {
    createEffect = () => {},
    createParticle = () => {},
    addNotification = () => {},
    dropPowerUps = () => [],
    playSound = () => {},
    getAveragePlayerLevel = () => 1,
  } = helpers;

  const organism = state.organism;
  if (!organism) {
    return;
  }

  const camera = state.camera;
  const worldSize = ensureNumber(state.worldSize, 4000);

  const averageLevelRaw = Number(getAveragePlayerLevel?.() ?? 1);
  const normalizedAverageLevel = Number.isFinite(averageLevelRaw) ? averageLevelRaw : 1;
  const clampedAverageLevel = Math.max(1, normalizedAverageLevel);
  const baseEnemyCap = 10;
  const enemyCapGrowth = 2;
  const maxEnemiesAllowed = Math.max(
    4,
    Math.round(baseEnemyCap + (clampedAverageLevel - 1) * enemyCapGrowth)
  );

  state.joystick = movementIntent || state.joystick || {};

  if (!state.gameOver) {
    const frameFactor = Math.min(delta * 60, 3);
    const previousDashTimer = Math.max(0, ensureNumber(organism.dashTimer, 0));
    const wasDashing = Boolean(organism.isDashing || previousDashTimer > 0);
    const updatedDashTimer = Math.max(0, previousDashTimer - delta);
    organism.dashTimer = updatedDashTimer;
    const dashActive = updatedDashTimer > 0;
    organism.isDashing = dashActive;

    if (dashActive) {
      organism.invulnerable = true;
    }

    if (wasDashing && !dashActive) {
      organism.invulnerable = Boolean(organism.invulnerableFromPowerUp);
      organism.dashCooldown = Math.max(1, ensureNumber(organism.dashCooldown, 0));
      createEffect(state, organism.x, organism.y, 'dashend', organism.color);
    }

    const moving = Boolean(movementIntent?.x || movementIntent?.y);

    if (!dashActive && moving && frameFactor > 0) {
      const length = Math.sqrt(
        movementIntent.x * movementIntent.x +
          movementIntent.y * movementIntent.y
      );
      const normX = movementIntent.x / (length || 1);
      const normY = movementIntent.y / (length || 1);

      const acceleration = organism.speed * frameFactor * 0.9;
      organism.vx += normX * acceleration;
      organism.vy += normY * acceleration;

      const maxSpeed = organism.speed * 12;
      const currentSpeed = Math.sqrt(organism.vx * organism.vx + organism.vy * organism.vy);
      if (currentSpeed > maxSpeed) {
        const scale = maxSpeed / currentSpeed;
        organism.vx *= scale;
        organism.vy *= scale;
      }

      organism.rotation = Math.atan2(normY, normX);
    } else if (dashActive && (organism.vx !== 0 || organism.vy !== 0)) {
      organism.rotation = Math.atan2(organism.vy, organism.vx);
    }

    const frictionBase = dashActive ? 0.99 : moving ? 0.92 : 0.78;
    const friction = frameFactor > 0 ? Math.pow(frictionBase, frameFactor) : frictionBase;
    organism.vx *= friction;
    organism.vy *= friction;

    if (!dashActive) {
      const maxSpeed = organism.speed * 12;
      const currentSpeed = Math.sqrt(organism.vx * organism.vx + organism.vy * organism.vy);
      if (currentSpeed > maxSpeed) {
        const scale = maxSpeed / currentSpeed;
        organism.vx *= scale;
        organism.vy *= scale;
      }
    }

    organism.x += organism.vx;
    organism.y += organism.vy;

    organism.x = Math.max(organism.size, Math.min(worldSize - organism.size, organism.x));
    organism.y = Math.max(organism.size, Math.min(worldSize - organism.size, organism.y));

    if (camera) {
      camera.x += ((organism.x - camera.x) * 0.08) * delta * 60;
      camera.y += ((organism.y - camera.y) * 0.08) * delta * 60;
    }

    const currentDashCharge = Math.max(0, ensureNumber(organism.dashCharge, 0));
    const maxDashCharge = Math.max(
      0,
      ensureNumber(organism.maxDashCharge, Math.max(currentDashCharge, 100))
    );
    if (maxDashCharge > 0) {
      const dashCharge = Math.min(maxDashCharge, currentDashCharge);
      const dashRegenRate = Math.max(
        0,
        ensureNumber(organism.dashChargeRegenRate, 20)
      );
      const regeneratedCharge = dashCharge + dashRegenRate * delta;
      organism.dashCharge = Math.min(maxDashCharge, regeneratedCharge);
    } else {
      organism.dashCharge = currentDashCharge;
    }

    organism.attackCooldown = Math.max(
      0,
      ensureNumber(organism.attackCooldown, 0) - delta
    );
    organism.dashCooldown = Math.max(
      0,
      ensureNumber(organism.dashCooldown, 0) - delta
    );

    if (organism.skillCooldowns && typeof organism.skillCooldowns === 'object') {
      let needsImmediateSync = false;

      Object.keys(organism.skillCooldowns).forEach((skillKey) => {
        const currentCooldown = ensureNumber(organism.skillCooldowns[skillKey], 0);

        if (currentCooldown <= 0) {
          if (currentCooldown < 0) {
            organism.skillCooldowns[skillKey] = 0;
          }
          return;
        }

        const updatedCooldown = Math.max(0, currentCooldown - delta);

        if (updatedCooldown !== currentCooldown) {
          organism.skillCooldowns[skillKey] = updatedCooldown;

          if (updatedCooldown === 0) {
            needsImmediateSync = true;
          }
        }
      });

      if (needsImmediateSync) {
        state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
      }
    }

    const currentInvulnerableTimer = Math.max(
      0,
      ensureNumber(organism.invulnerableTimer, 0)
    );
    const updatedInvulnerableTimer = Math.max(0, currentInvulnerableTimer - delta);
    organism.invulnerableTimer = updatedInvulnerableTimer;

    if (updatedInvulnerableTimer === 0 && !dashActive) {
      organism.invulnerable = Boolean(organism.invulnerableFromPowerUp);
    }

    state.gameTime += delta;

    if (state.gameTime - state.lastSpawnTime > state.spawnInterval / 1000) {
      if (state.enemies.length < maxEnemiesAllowed) {
        spawnEnemy?.();
      }
      state.lastSpawnTime = state.gameTime;
      state.spawnInterval = Math.max(800, state.spawnInterval - 20);

      if (state.level % 5 === 0 && !state.bossPending) {
        state.bossPending = true;
        spawnBoss?.();
      }
    }

    const effects = state.effects || [];
    state.effects = effects.filter(effect => {
      effect.life -= delta;
      return effect.life > 0;
    });
  }

  const updatedNebulas = [];
  (state.nebulas || []).forEach(nebula => {
    const dx = nebula.x - organism.x;
    const dy = nebula.y - organism.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < nebula.radius + organism.size && !nebula.dispelled) {
      nebula.dispelled = true;
      nebula.dispelProgress = nebula.dispelProgress || 0;
      nebula.rotationSpeed *= 3;
      nebula.turbulence *= 2;
      const nebulaColorBase =
        nebula.color ?? nebulaTypes[nebula.type]?.color ?? 'rgba(20, 56, 81, ';
      const nebulaEffectColor =
        nebula.glow ?? nebulaTypes[nebula.type]?.glow ?? `${nebulaColorBase}0.6)`;
      addNotification(state, '🌫️ Nebulosa bioenergética dispersa!');
      createEffect(state, nebula.x, nebula.y, 'nebula', nebulaEffectColor);
      state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
    }

    nebula.rotation += nebula.rotationSpeed * delta;
    nebula.pulsePhase += delta;

    if (nebula.dispelled) {
      nebula.dispelProgress = (nebula.dispelProgress || 0) + delta * 0.5;
      if (nebula.dispelProgress >= 1) {
        return;
      }
    }

    updatedNebulas.push(nebula);
  });
  state.nebulas = updatedNebulas;

  state.obstacles = (state.obstacles || []).filter(obs => {
    obs.x += obs.vx;
    obs.y += obs.vy;
    obs.rotation += obs.rotationSpeed * delta;

    if (obs.x < -200 || obs.x > worldSize + 200) return false;
    if (obs.y < -200 || obs.y > worldSize + 200) return false;

    const dx = obs.x - organism.x;
    const dy = obs.y - organism.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < obs.size + organism.size) {
      const divisor = dist || 1;
      organism.vx -= (dx / divisor) * 10;
      organism.vy -= (dy / divisor) * 10;
      createEffect(state, obs.x, obs.y, 'impact', obs.color);
      obs.color = obs.hitColor;
      obs.hitPulse = 1;
      obs.rotationSpeed *= -1;
      playSound('impact');
    }

    if (obs.hitPulse > 0) {
      obs.hitPulse *= 0.85;
      if (obs.hitPulse < 0.01) {
        obs.hitPulse = 0;
      }
    }

    return true;
  });

  state.powerUps = (state.powerUps || []).filter(power => {
    power.pulse += delta * 3;

    const dx = power.x - organism.x;
    const dy = power.y - organism.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < organism.size + 24) {
      applyPowerUp?.(power.type);
      return false;
    }

    return true;
  });

  state.organicMatter = (state.organicMatter || []).filter(matter => {
    matter.x += matter.vx;
    matter.y += matter.vy;
    matter.rotation += matter.rotationSpeed * delta;
    matter.pulsePhase += delta * 2;

    const dx = matter.x - organism.x;
    const dy = matter.y - organism.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < matter.size + organism.size) {
      state.energy += matter.energy;
      state.health = Math.min(state.maxHealth, state.health + matter.health);
      state.score += matter.energy;
      playSound('collect');
      addNotification(state, `+${matter.energy} ⚡`);
      for (let i = 0; i < 5; i += 1) {
        createParticle(state, matter.x, matter.y, matter.color, 3);
      }
      return false;
    }

    return true;
  });

  if (state.organicMatter.length < 30 && Math.random() < 0.05) {
    spawnOrganicMatter?.(state, 1);
  }

  const enemies = Array.isArray(state.enemies) ? state.enemies : [];

  enemies.forEach((enemy) => {
    if (!enemy || typeof enemy !== 'object') {
      return;
    }

    if (!enemy.dynamicModifiers || typeof enemy.dynamicModifiers !== 'object') {
      enemy.dynamicModifiers = {
        attackMultiplier: 1,
        defenseMultiplier: 1,
        speedMultiplier: 1,
        sizeMultiplier: 1,
        attackBonus: 0,
        defenseBonus: 0,
        speedBonus: 0,
        sizeBonus: 0,
      };
    } else {
      enemy.dynamicModifiers.attackMultiplier = 1;
      enemy.dynamicModifiers.defenseMultiplier = 1;
      enemy.dynamicModifiers.speedMultiplier = 1;
      enemy.dynamicModifiers.sizeMultiplier = 1;
      enemy.dynamicModifiers.attackBonus = 0;
      enemy.dynamicModifiers.defenseBonus = 0;
      enemy.dynamicModifiers.speedBonus = 0;
      enemy.dynamicModifiers.sizeBonus = 0;
    }

    if (!enemy.baseStats || typeof enemy.baseStats !== 'object') {
      enemy.baseStats = {
        size: ensureNumber(enemy.size, 12),
        speed: ensureNumber(enemy.speed, 1),
        attack: ensureNumber(enemy.attack, 0),
        defense: ensureNumber(enemy.defense, 0),
        maxHealth: ensureNumber(enemy.maxHealth, ensureNumber(enemy.health, 10)),
        health: ensureNumber(enemy.health, 10),
      };
    }

    enemy.behaviorTraits =
      enemy.behaviorTraits && typeof enemy.behaviorTraits === 'object'
        ? enemy.behaviorTraits
        : {};

    if (Array.isArray(enemy.activeBuffs)) {
      enemy.activeBuffs = enemy.activeBuffs.filter((buff) => {
        if (!buff || typeof buff !== 'object') return false;
        const remaining = ensureNumber(buff.remaining ?? buff.duration, 0) - delta;
        if (remaining <= 0) return false;
        buff.remaining = remaining;
        applyBuffModifiersToDynamic(enemy.dynamicModifiers, buff.modifiers || {});
        return true;
      });
    } else {
      enemy.activeBuffs = [];
    }
  });

  state.projectiles = state.projectiles || [];

  const updatedEnemies = enemies.filter((enemy) => {
    if (!enemy || typeof enemy !== 'object') {
      return false;
    }

    const dynamic = enemy.dynamicModifiers || {
      attackMultiplier: 1,
      defenseMultiplier: 1,
      speedMultiplier: 1,
      sizeMultiplier: 1,
      attackBonus: 0,
      defenseBonus: 0,
      speedBonus: 0,
      sizeBonus: 0,
    };
    const baseStats = enemy.baseStats || {};
    const behaviorTraits = enemy.behaviorTraits || {};

    if (!enemy.boss && behaviorTraits.speedBurst) {
      const burst = behaviorTraits.speedBurst;
      const interval = Math.max(0.2, ensureNumber(burst.interval, 6));
      enemy.speedBurstTimer = ensureNumber(enemy.speedBurstTimer, 0) + delta;
      enemy.speedBurstActive = Boolean(enemy.speedBurstActive);
      enemy.speedBurstRemaining = Math.max(0, ensureNumber(enemy.speedBurstRemaining, 0) - delta);
      if (enemy.speedBurstRemaining <= 0) {
        enemy.speedBurstActive = false;
      }

      if (enemy.speedBurstTimer >= interval) {
        enemy.speedBurstTimer = 0;
        enemy.speedBurstActive = true;
        enemy.speedBurstRemaining = Math.max(0.2, ensureNumber(burst.duration, 0.8));
        enemy.speedBurstMultiplier = Math.max(1, ensureNumber(burst.speedMultiplier, 1.6));
        createEffect(state, enemy.x, enemy.y, 'dash', enemy.color);
        playSound('dash');
      }

      if (enemy.speedBurstActive) {
        const multiplier = Math.max(1, ensureNumber(enemy.speedBurstMultiplier, 1.6));
        applyBuffModifiersToDynamic(dynamic, { speedMultiplier: multiplier });
      }
    }

    const projectileVolley = behaviorTraits.projectileVolley;
    if (projectileVolley) {
      const interval = Math.max(0.2, ensureNumber(projectileVolley.interval, 6));
      enemy.projectileCooldown = Math.max(
        0,
        ensureNumber(enemy.projectileCooldown, 0) - delta
      );

      if (enemy.projectileCooldown <= 0) {
        const count = Math.max(1, Math.round(ensureNumber(projectileVolley.count, 3)));
        const spread = ensureNumber(projectileVolley.spread, Math.PI / 4);
        const projectileSpeed = ensureNumber(projectileVolley.speed, 5);
        const projectileLife = Math.max(0.2, ensureNumber(projectileVolley.life, 2.5));
        const damageMultiplier = ensureNumber(projectileVolley.damageMultiplier, 0.4);
        const color = projectileVolley.color || enemy.glowColor || enemy.color;
        const baseAngle = Math.atan2(organism.y - enemy.y, organism.x - enemy.x);
        const baseAttack = ensureNumber(baseStats.attack, enemy.attack);
        const damage = Math.max(1, Math.round(baseAttack * damageMultiplier));
        const spreadStep = count > 1 ? spread / (count - 1) : 0;

        for (let i = 0; i < count; i += 1) {
          const offset = count > 1 ? -spread / 2 + spreadStep * i : 0;
          const angle = baseAngle + offset;
          state.projectiles.push({
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(angle) * projectileSpeed,
            vy: Math.sin(angle) * projectileSpeed,
            damage,
            life: projectileLife,
            color,
            type: 'enemy-projectile',
            hostile: true,
            sourceId: enemy.id,
          });
        }

        enemy.projectileCooldown = interval;
        playSound('shoot');
      }
    }

    const supportAura = behaviorTraits.supportAura;
    if (supportAura) {
      enemy.supportAuraTimer = ensureNumber(enemy.supportAuraTimer, 0) + delta;
      const interval = Math.max(0.1, ensureNumber(supportAura.interval, 8));
      if (enemy.supportAuraTimer >= interval) {
        enemy.supportAuraTimer = 0;
        const duration = Math.max(0.2, ensureNumber(supportAura.duration, 3));
        const radius = Math.max(0, ensureNumber(supportAura.radius, 240));
        const includeSelf = supportAura.includeSelf !== false;
        const modifiers = supportAura.modifiers || {};
        const radiusSq = radius * radius;

        enemies.forEach((ally) => {
          if (!ally || ally === enemy && !includeSelf) return;
          const dx = ally.x - enemy.x;
          const dy = ally.y - enemy.y;
          if (dx * dx + dy * dy <= radiusSq) {
            applyBuffToEnemy(
              ally,
              {
                sourceId: enemy.id,
                type: supportAura.type || 'supportAura',
                remaining: duration,
                modifiers,
              },
              { immediate: true }
            );
          }
        });

        createEffect(state, enemy.x, enemy.y, 'buff', enemy.color);
        playSound('buff');
      }
    }

    const baseSize = ensureNumber(baseStats.size, enemy.size);
    const baseSpeed = ensureNumber(baseStats.speed, enemy.speed);
    const baseAttack = ensureNumber(baseStats.attack, enemy.attack);
    const baseDefense = ensureNumber(baseStats.defense, enemy.defense);

    const effectiveSize = Math.max(
      1,
      (baseSize + (dynamic.sizeBonus || 0)) * (dynamic.sizeMultiplier || 1)
    );
    const effectiveSpeed = Math.max(
      0,
      (baseSpeed + (dynamic.speedBonus || 0)) * (dynamic.speedMultiplier || 1)
    );
    const effectiveAttack = Math.max(
      0,
      Math.round((baseAttack + (dynamic.attackBonus || 0)) * (dynamic.attackMultiplier || 1))
    );
    const effectiveDefense = Math.max(
      0,
      Math.round((baseDefense + (dynamic.defenseBonus || 0)) * (dynamic.defenseMultiplier || 1))
    );

    enemy.size = effectiveSize;
    enemy.currentSpeed = effectiveSpeed;
    enemy.attack = effectiveAttack;
    enemy.defense = effectiveDefense;

    if (!enemy.boss) {
      enemy.behaviorTimer += delta;

      if (enemy.behaviorTimer > enemy.behaviorInterval) {
        enemy.behaviorTimer = 0;
        enemy.behaviorInterval = Math.random() * 2 + 0.5;

        const angle = Math.atan2(organism.y - enemy.y, organism.x - enemy.x);
        const speed = effectiveSpeed * (0.8 + Math.random() * 0.4);
        enemy.vx = Math.cos(angle) * speed;
        enemy.vy = Math.sin(angle) * speed;
      }

      enemy.x += enemy.vx * delta * 60;
      enemy.y += enemy.vy * delta * 60;
    } else {
      enemy.attackTimer += delta;
      enemy.phaseTimer += delta;

      if (enemy.phase === 'charge' && enemy.attackTimer > enemy.attackCooldown) {
        enemy.phase = 'dash';
        enemy.attackTimer = 0;
        const angle = Math.atan2(organism.y - enemy.y, organism.x - enemy.x);
        enemy.vx = Math.cos(angle) * enemy.dashSpeed;
        enemy.vy = Math.sin(angle) * enemy.dashSpeed;
        createEffect(state, enemy.x, enemy.y, 'dash', enemy.color);
        playSound('dash');
      }

      if (enemy.phase === 'dash') {
        enemy.x += enemy.vx * delta * 60;
        enemy.y += enemy.vy * delta * 60;
        enemy.dashDuration -= delta;
        if (enemy.dashDuration <= 0) {
          enemy.phase = 'charge';
          enemy.dashDuration = enemy.dashDurationMax;
          enemy.vx *= 0.2;
          enemy.vy *= 0.2;
        }
      } else {
        const angle = Math.atan2(organism.y - enemy.y, organism.x - enemy.x);
        const speed = effectiveSpeed * (0.6 + Math.random() * 0.4);
        enemy.vx = Math.cos(angle) * speed;
        enemy.vy = Math.sin(angle) * speed;
        enemy.x += enemy.vx * delta * 60;
        enemy.y += enemy.vy * delta * 60;
      }
    }

    enemy.x = Math.max(0, Math.min(worldSize, enemy.x));
    enemy.y = Math.max(0, Math.min(worldSize, enemy.y));

    const dx = enemy.x - organism.x;
    const dy = enemy.y - organism.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < enemy.size + organism.size) {
      if (!organism.invulnerable && !organism.invulnerableFromPowerUp) {
        const fallbackHealth = toFiniteNumber(state.maxHealth) ?? 100;
        const currentHealth = ensureNumber(state.health, fallbackHealth);
        const damage = resolveEnemyDamage(enemy);
        state.health = currentHealth - damage;
        organism.invulnerable = true;
        organism.invulnerableTimer = 1.5;
        createEffect(state, organism.x, organism.y, 'impact', enemy.color);
        playSound('hit');
        state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);

        if (state.health <= 0) {
          state.gameOver = true;
          state.showEvolutionChoice = false;
        }
      }
      enemy.vx *= -0.5;
      enemy.vy *= -0.5;
    }

    if (enemy.health <= 0) {
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      const energyReward = ensureNumber(enemy.energyReward, 0);
      state.energy += energyReward;
      state.score += enemy.points;
      createEffect(state, enemy.x, enemy.y, 'hit', enemy.color);
      playSound('enemyDie');
      dropPowerUps(state, enemy);
      state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);

      if (enemy.boss) {
        state.boss = null;
        state.bossPending = false;
        addNotification(state, '✨ Mega-organismo neutralizado!');
      }

      return false;
    }

    return true;
  });

  state.enemies = updatedEnemies;

  if (state.enemies.length < maxEnemiesAllowed && Math.random() < 0.005) {
    spawnEnemy?.();
  }

  state.projectiles = (state.projectiles || []).filter(proj => {
    proj.x += proj.vx;
    proj.y += proj.vy;
    proj.life -= delta;

    if (proj.life <= 0) return false;

    if (
      proj.x < -50 ||
      proj.x > worldSize + 50 ||
      proj.y < -50 ||
      proj.y > worldSize + 50
    ) {
      return false;
    }

    if (proj.hostile) {
      const dxOrg = proj.x - organism.x;
      const dyOrg = proj.y - organism.y;
      const distOrg = Math.sqrt(dxOrg * dxOrg + dyOrg * dyOrg);

      if (distOrg < organism.size) {
        if (!organism.invulnerable && !organism.invulnerableFromPowerUp) {
          const damage = ensureNumber(proj.damage, 0);
          const fallbackHealth = toFiniteNumber(state.maxHealth) ?? 100;
          const currentHealth = ensureNumber(state.health, fallbackHealth);
          state.health = currentHealth - damage;
          organism.invulnerable = true;
          organism.invulnerableTimer = Math.max(
            ensureNumber(organism.invulnerableTimer, 0),
            0.6
          );
          createEffect(state, organism.x, organism.y, 'impact', proj.color || '#FFFFFF');
          playSound('hit');
          state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);

          if (state.health <= 0) {
            state.gameOver = true;
            state.showEvolutionChoice = false;
          }
        }

        return false;
      }

      return true;
    }

    for (let i = 0; i < state.enemies.length; i += 1) {
      const enemy = state.enemies[i];
      const dx = proj.x - enemy.x;
      const dy = proj.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < enemy.size) {
        enemy.health -= proj.damage;
        createEffect(state, enemy.x, enemy.y, 'hit', proj.color);

        if (enemy.health <= 0) {
          state.energy += 25;
          state.score += enemy.points;
          dropPowerUps(state, enemy);
          if (enemy.boss) {
            state.boss = null;
            state.bossPending = false;
            addNotification(state, '✨ Mega-organismo neutralizado!');
          }
          state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
        } else if (enemy.boss) {
          state.boss = {
            active: true,
            health: enemy.health,
            maxHealth: enemy.maxHealth,
            color: enemy.color,
          };
          state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
        }

        return false;
      }
    }

    return true;
  });
};

export default updateGameState;
