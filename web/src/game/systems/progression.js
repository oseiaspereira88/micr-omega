export const checkEvolution = (state, helpers = {}) => {
  if (!state) return state;

  const { syncState } = helpers;
  const thresholds = [0, 200, 500, 1000, 1800, 3000, 5000];
  const nextThreshold = thresholds[state.level + 1];

  if (nextThreshold && state.energy >= nextThreshold) {
    state.canEvolve = true;
    syncState?.(state);
  }

  return state;
};

export const openEvolutionMenu = (state, helpers = {}) => {
  if (!state || !state.canEvolve) return state;

  const {
    pickRandomUnique,
    evolutionaryTraits,
    forms,
    playSound,
    syncState
  } = helpers;

  state.level++;
  state.canEvolve = false;
  state.evolutionType = state.level % 3 === 0 ? 'form' : 'skill';

  if (state.level >= state.nextBossLevel) {
    state.bossPending = true;
    state.nextBossLevel += 3;
  }

  if (state.evolutionType === 'skill') {
    const unusedTraits = Object.keys(evolutionaryTraits).filter(
      traitKey => !state.organism.traits.includes(traitKey)
    );
    const traitPool = unusedTraits.length > 0 ? unusedTraits : Object.keys(evolutionaryTraits);
    state.availableTraits = pickRandomUnique?.(traitPool, Math.min(3, traitPool.length)) ?? [];
  } else {
    const unusedForms = Object.keys(forms).filter(
      formKey => formKey !== state.organism.form
    );
    const formPool = unusedForms.length > 0 ? unusedForms : Object.keys(forms);
    state.availableForms = pickRandomUnique?.(formPool, Math.min(3, formPool.length)) ?? [];
  }

  state.showEvolutionChoice = true;
  playSound?.('skill');
  state.uiSyncTimer = 0;
  syncState?.(state);
  return state;
};

export const chooseTrait = (state, helpers = {}, traitKey) => {
  if (!state) return state;

  const { evolutionaryTraits, addNotification, syncState } = helpers;
  const trait = evolutionaryTraits?.[traitKey];

  if (!trait) return state;

  state.organism.traits.push(traitKey);
  trait.effect(state.organism);

  state.organism.size += 4;
  state.organism.color = trait.color;

  if (trait.skill && state.organism.skillCooldowns[trait.skill] === undefined) {
    state.organism.skillCooldowns[trait.skill] = 0;
  }

  state.maxHealth += 30;
  state.health = state.maxHealth;

  state.showEvolutionChoice = false;
  addNotification?.(state, `✨ ${trait.name}`);

  state.uiSyncTimer = 0;
  syncState?.(state);
  return state;
};

export const chooseForm = (state, helpers = {}, formKey) => {
  if (!state) return state;

  const { forms, addNotification, syncState } = helpers;
  const form = forms?.[formKey];

  if (!form) return state;

  state.organism.form = formKey;
  state.organism.defense *= form.defense;
  state.organism.speed *= form.speed;

  state.showEvolutionChoice = false;
  addNotification?.(state, `✨ Forma ${form.name}!`);

  state.uiSyncTimer = 0;
  syncState?.(state);
  return state;
};

export const restartGame = (state, helpers = {}) => {
  if (!state) return state;

  const {
    resetControls,
    spawnObstacle,
    spawnNebula,
    spawnPowerUp,
    spawnOrganicMatter,
    syncState,
    createInitialState
  } = helpers;

  const baseState = createInitialState?.();
  const baseOrganism = baseState?.organism;

  Object.assign(state, {
    energy: 0,
    health: 100,
    maxHealth: 100,
    level: 1,
    score: 0,
    canEvolve: false,
    showEvolutionChoice: false,
    gameOver: false,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    boss: null,
    bossPending: false,
    nextBossLevel: 3,
    fogIntensity: 0,
    uiSyncTimer: 0,
    activePowerUps: [],
    powerUps: [],
    availableTraits: [],
    availableForms: [],
    organicMatter: [],
    enemies: [],
    projectiles: [],
    effects: [],
    particles: [],
    nebulas: [],
    notifications: [],
    lastEventTime: 0,
    gameTime: 0
  });

  state.organism = {
    ...(baseOrganism || {}),
    x: 2000,
    y: 2000,
    vx: 0,
    vy: 0,
    size: 32,
    form: 'sphere',
    color: '#00D9FF',
    secondaryColor: '#0088FF',
    tertiaryColor: '#00FFFF',
    traits: [],
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
    trail: [],
    dashCharge: 100,
    maxDashCharge: 100,
    isDashing: false,
    dashCooldown: 0,
    invulnerable: false,
    invulnerableTimer: 0,
    currentSpeedMultiplier: 1,
    currentAttackBonus: 0,
    currentRangeBonus: 0,
    hasShieldPowerUp: false,
    invulnerableFromPowerUp: false,
    attack: 10,
    defense: 5,
    speed: 1,
    attackRange: 80,
    attackCooldown: 0,
    skills: [],
    currentSkillIndex: 0,
    skillCooldowns: {},
    dying: false,
    deathTimer: 0
  };

  resetControls?.(state);

  state.obstacles = [];
  for (let i = 0; i < 30; i++) {
    spawnObstacle?.(state);
  }

  state.nebulas = [];
  for (let i = 0; i < 18; i++) {
    spawnNebula?.(state, i % 4 === 0 ? 'solid' : 'gas');
  }

  state.powerUps = [];
  for (let i = 0; i < 4; i++) {
    spawnPowerUp?.(state);
  }

  spawnOrganicMatter?.(state, 25);

  syncState?.(state);
  return state;
};
