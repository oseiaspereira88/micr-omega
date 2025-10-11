export const createInitialState = () => ({
  energy: 0,
  health: 100,
  maxHealth: 100,
  level: 1,
  score: 0,
  canEvolve: false,

  organism: {
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

    // Animação de locomoção melhorada
    swimPhase: 0,
    bodyWave: 0,
    pulseIntensity: 1,
    rotation: 0,
    tiltX: 0,
    tiltY: 0,

    // Olhos
    eyeBlinkTimer: 0,
    eyeBlinkState: 0,
    eyeLookX: 0,
    eyeLookY: 0,
    eyeExpression: 'neutral',

    // Trail
    trail: [],

    // Dash
    dashCharge: 100,
    maxDashCharge: 100,
    isDashing: false,
    dashCooldown: 0,

    attack: 10,
    defense: 5,
    speed: 1,
    attackRange: 80,
    attackCooldown: 0,

    skills: [],
    currentSkillIndex: 0,
    skillCooldowns: {},

    dying: false,
    deathTimer: 0,
    hasShieldPowerUp: false,
    invulnerableFromPowerUp: false
  },

  particles: [],
  floatingParticles: [],
  glowParticles: [],
  microorganisms: [],
  organicMatter: [],
  obstacles: [],
  nebulas: [],
  powerUps: [],
  activePowerUps: [],
  enemies: [],
  projectiles: [],
  effects: [],

  // Fundo dinâmico
  backgroundLayers: [],
  lightRays: [],

  worldSize: 4000,

  lastEventTime: 0,
  eventInterval: 5000,
  pulsePhase: 0,
  gameTime: 0,
  combo: 0,
  maxCombo: 0,
  comboTimer: 0,

  showEvolutionChoice: false,
  evolutionType: 'skill',
  notifications: [],
  availableTraits: [],
  availableForms: [],
  fogIntensity: 0,
  boss: null,
  bossPending: false,
  nextBossLevel: 3,
  uiSyncTimer: 0.2,

  joystick: { x: 0, y: 0, active: false, source: 'none' },
  actionButton: false,
  gameOver: false
});
