import { createOrganism } from '../entities/organism';
import { createResourceProfile } from './resourceProfile';

export const createInitialState = () => {
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportHeight =
    typeof window !== 'undefined' ? Math.max(0, window.innerHeight - 40) : 720;

  const resources = createResourceProfile();
  const organism = createOrganism({ resources });

  return {
    energy: 0,
    health: 100,
    maxHealth: 100,
    level: 1,
    score: 0,
    canEvolve: false,

    organism,
    resources,
    xp: resources.xp,
    characteristicPoints: resources.characteristicPoints,
    geneticMaterial: resources.geneticMaterial,
    geneFragments: resources.geneFragments,
    stableGenes: resources.stableGenes,
    evolutionSlots: resources.evolutionSlots,
    reroll: resources.reroll,
    dropPity: resources.dropPity,
    progressionQueue: [],
    recentRewards: { xp: 0, geneticMaterial: 0, fragments: 0, stableGenes: 0 },
    evolutionContext: null,

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

    camera: {
      x: 2000,
      y: 2000,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
      },
    },

    spawnInterval: 2000,
    lastSpawnTime: 0,

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
    formReapplyNotice: false,
    fogIntensity: 0,
    boss: null,
    bossPending: false,
    nextBossLevel: 3,
    uiSyncTimer: 0.2,

    joystick: { x: 0, y: 0, active: false, source: 'none' },
    actionButton: false,
    gameOver: false,
  };
};
