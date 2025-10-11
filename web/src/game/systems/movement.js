export const performDash = (state, helpers = {}) => {
  if (!state) return state;

  const {
    playSound,
    createEffect,
    createParticle,
    syncState
  } = helpers;

  const organism = state.organism;
  if (!organism) return state;

  if (organism.dashCharge < 30 || organism.dashCooldown > 0 || organism.isDashing) {
    return state;
  }

  organism.dashCharge = Math.max(0, organism.dashCharge - 30);
  organism.isDashing = true;
  organism.invulnerable = true;

  const dashSpeed = 25 * organism.speed * (organism.currentSpeedMultiplier || 1);
  const currentSpeed = Math.sqrt(organism.vx * organism.vx + organism.vy * organism.vy);

  if (currentSpeed > 0.5) {
    const normalizedVx = organism.vx / currentSpeed;
    const normalizedVy = organism.vy / currentSpeed;
    organism.vx = normalizedVx * dashSpeed;
    organism.vy = normalizedVy * dashSpeed;
  } else {
    organism.vx = Math.cos(organism.angle) * dashSpeed;
    organism.vy = Math.sin(organism.angle) * dashSpeed;
  }

  playSound?.('dash');
  createEffect?.(state, organism.x, organism.y, 'dashstart', organism.color);

  for (let i = 0; i < 10; i++) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 20;
    createParticle?.(
      state,
      organism.x + Math.cos(angle) * distance,
      organism.y + Math.sin(angle) * distance,
      organism.color,
      6
    );
  }

  setTimeout(() => {
    organism.isDashing = false;
    organism.invulnerable = false;
    organism.dashCooldown = 1;
    createEffect?.(state, organism.x, organism.y, 'dashend', organism.color);
    syncState?.(state);
  }, 300);

  syncState?.(state);
  return state;
};

export const updateOrganismPhysics = (state, helpers = {}, delta = 0) => {
  if (!state) return state;
  const organism = state.organism;
  if (!organism) return state;

  const { createParticle, addNotification, syncState } = helpers;

  if (organism.dying) {
    organism.deathTimer -= delta;
    organism.rotation += delta * 5;
    organism.size *= 0.98;

    if (organism.deathTimer <= 0) {
      state.gameOver = true;
      syncState?.(state);
    }

    return state;
  }

  let speedMultiplier = 1;
  let attackBonus = 0;
  let rangeBonus = 0;
  let invincibilityActive = false;

  state.activePowerUps = state.activePowerUps.filter(power => {
    power.remaining -= delta;
    if (power.remaining > 0) {
      const intensity = Math.max(0.4, power.remaining / power.duration);
      if (power.type === 'speed') {
        speedMultiplier += 0.6 * intensity;
      } else if (power.type === 'damage') {
        attackBonus += 6 * intensity;
        rangeBonus += 20 * intensity;
      } else if (power.type === 'invincibility') {
        invincibilityActive = true;
      }
      return true;
    }

    addNotification?.(state, `${power.name} dissipou.`);
    state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
    return false;
  });

  organism.currentSpeedMultiplier = speedMultiplier;
  organism.currentAttackBonus = attackBonus;
  organism.currentRangeBonus = rangeBonus;
  organism.hasShieldPowerUp = invincibilityActive;
  organism.invulnerableFromPowerUp = invincibilityActive;

  const friction = organism.isDashing ? 0.98 : 0.92;
  const baseSpeed = organism.isDashing ? 20 * speedMultiplier : 5 * organism.speed * speedMultiplier;
  const maxSpeed = baseSpeed;

  const joystick = state.joystick;

  if (joystick.active && !organism.isDashing) {
    organism.vx += joystick.x * 0.5;
    organism.vy += joystick.y * 0.5;

    if (joystick.x !== 0 || joystick.y !== 0) {
      organism.targetAngle = Math.atan2(joystick.y, joystick.x);
    }
  }

  let angleDiff = organism.targetAngle - organism.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  organism.angle += angleDiff * 0.1;

  organism.vx *= friction;
  organism.vy *= friction;

  const speed = Math.sqrt(organism.vx * organism.vx + organism.vy * organism.vy);
  if (speed > maxSpeed) {
    organism.vx = (organism.vx / speed) * maxSpeed;
    organism.vy = (organism.vy / speed) * maxSpeed;
  }

  organism.x += organism.vx;
  organism.y += organism.vy;

  organism.x = Math.max(organism.size, Math.min(4000 - organism.size, organism.x));
  organism.y = Math.max(organism.size, Math.min(4000 - organism.size, organism.y));

  const speedFactor = Math.min(speed / maxSpeed, 1);

  organism.swimPhase += delta * (3 + speedFactor * 5);
  organism.bodyWave = Math.sin(organism.swimPhase) * speedFactor * 0.08;
  organism.pulseIntensity = 1 + Math.sin(organism.swimPhase * 0.5) * speedFactor * 0.05;

  if (speedFactor > 0.1) {
    const tiltAmount = speedFactor * 0.1;
    organism.tiltX = Math.sin(organism.swimPhase) * tiltAmount;
    organism.tiltY = Math.cos(organism.swimPhase * 1.3) * tiltAmount;
  } else {
    organism.tiltX *= 0.9;
    organism.tiltY *= 0.9;
  }

  if (speed > 1) {
    if (
      organism.trail.length === 0 ||
      Math.sqrt(
        (organism.x - organism.trail[organism.trail.length - 1].x) ** 2 +
        (organism.y - organism.trail[organism.trail.length - 1].y) ** 2
      ) > 5
    ) {
      organism.trail.push({
        x: organism.x,
        y: organism.y,
        life: 1,
        size: organism.size * 0.8,
        color: organism.color
      });
      if (organism.trail.length > 20) organism.trail.shift();
    }
  }

  organism.trail = organism.trail
    .map(trail => ({ ...trail, life: trail.life - delta * 1.5 }))
    .filter(trail => trail.life > 0);

  if (organism.isDashing) {
    for (let i = 0; i < 3; i++) {
      createParticle?.(state, organism.x, organism.y, organism.color, 4);
    }
  }

  if (organism.dashCharge < organism.maxDashCharge) {
    organism.dashCharge = Math.min(organism.maxDashCharge, organism.dashCharge + delta * 20);
  }

  organism.dashCooldown = Math.max(0, organism.dashCooldown - delta);

  organism.eyeBlinkTimer += delta;
  if (organism.eyeBlinkTimer > 3 + Math.random() * 2) {
    organism.eyeBlinkState = 1;
    organism.eyeBlinkTimer = 0;
  }

  if (organism.eyeBlinkState > 0) {
    organism.eyeBlinkState -= delta * 8;
    if (organism.eyeBlinkState < 0) organism.eyeBlinkState = 0;
  }

  if (speed > 0.5) {
    const targetLookX = (organism.vx / maxSpeed) * 0.5;
    const targetLookY = (organism.vy / maxSpeed) * 0.5;
    organism.eyeLookX += (targetLookX - organism.eyeLookX) * 0.1;
    organism.eyeLookY += (targetLookY - organism.eyeLookY) * 0.1;
  } else {
    organism.eyeLookX *= 0.9;
    organism.eyeLookY *= 0.9;
  }

  organism.attackCooldown = Math.max(0, organism.attackCooldown - delta);

  Object.keys(organism.skillCooldowns).forEach(key => {
    organism.skillCooldowns[key] = Math.max(0, organism.skillCooldowns[key] - delta);
  });

  if (state.combo > 0) {
    state.comboTimer -= delta;
    if (state.comboTimer <= 0) {
      state.combo = 0;
      state.comboTimer = 0;
      state.uiSyncTimer = Math.min(state.uiSyncTimer, 0.05);
    }
  }

  return state;
};
