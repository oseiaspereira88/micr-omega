export const createOrganism = (overrides = {}) => {
  const {
    traits = [],
    trail = [],
    skills = [],
    skillCooldowns = {},
    ...rest
  } = overrides;

  const defaults = {
    x: 2000,
    y: 2000,
    vx: 0,
    vy: 0,
    size: 32,
    form: 'sphere',
    color: '#00D9FF',
    secondaryColor: '#0088FF',
    tertiaryColor: '#00FFFF',
    angle: 0,
    targetAngle: 0,
    swimPhase: 0,
    bodyWave: 0,
    pulseIntensity: 1,
    rotation: 0,
    tiltX: 0,
    tiltY: 0,
    eyeBlinkTimer: 0,
    eyeBlinkState: 0,
    eyeLookX: 0,
    eyeLookY: 0,
    eyeExpression: 'neutral',
    dashCharge: 100,
    maxDashCharge: 100,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 0,
    invulnerable: false,
    invulnerableTimer: 0,
    attack: 10,
    defense: 5,
    speed: 1,
    attackRange: 80,
    attackCooldown: 0,
    currentSkillIndex: 0,
    dying: false,
    deathTimer: 0,
    hasShieldPowerUp: false,
    invulnerableFromPowerUp: false
  };

  return {
    ...defaults,
    ...rest,
    traits: [...traits],
    trail: [...trail],
    skills: [...skills],
    skillCooldowns: { ...skillCooldowns }
  };
};
