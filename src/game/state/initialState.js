import { createOrganism } from '../entities/organism';

export const createInitialState = () => ({
  energy: 0,
  health: 100,
  maxHealth: 100,
  level: 1,
  score: 0,
  canEvolve: false,

  organism: createOrganism(),

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
