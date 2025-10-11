import { enemyTemplates as defaultEnemyTemplates } from '../config/enemyTemplates';
import { createEnemyFromTemplate, createBossEnemy } from '../entities/enemy';

const getRandom = (rng = Math.random) => (typeof rng === 'function' ? rng : Math.random);

const pickRandom = (items = [], random) => {
  if (!items.length) return undefined;
  const index = Math.floor(random() * items.length);
  return items[index];
};

const DEFAULT_BOSS_CONFIG = {
  type: 'leviathan',
  size: 160,
  speed: 1.2,
  attack: 35,
  defense: 14,
  health: 900,
  maxHealth: 900,
  points: 800,
  color: '#FF3A6B',
  behavior: 'boss',
  state: 'aggressive',
  canLeave: false
};

export const spawnEnemy = ({
  level = 1,
  organismPosition = { x: 0, y: 0 },
  templates = defaultEnemyTemplates,
  spawnDistance = 600,
  rng = Math.random,
  idGenerator
} = {}) => {
  const random = getRandom(rng);
  const templateKeys = Object.keys(templates || {});
  if (!templateKeys.length) return null;

  const templateKey = pickRandom(templateKeys, random);
  const template = templates[templateKey];
  if (!template) return null;

  return createEnemyFromTemplate(templateKey, template, {
    level,
    origin: organismPosition,
    spawnDistance,
    rng: random,
    idGenerator
  });
};

export const spawnBoss = ({
  level = 1,
  organismPosition = { x: 0, y: 0 },
  rng = Math.random,
  config = DEFAULT_BOSS_CONFIG,
  idGenerator
} = {}) => {
  const random = getRandom(rng);
  const boss = createBossEnemy(
    { ...config, evolutionLevel: level },
    {
      origin: organismPosition,
      rng: random,
      spawnDistance: config.spawnDistance ?? 900,
      idGenerator
    }
  );

  if (!boss) return null;

  const bossState = {
    active: true,
    health: boss.health,
    maxHealth: boss.maxHealth,
    color: boss.color
  };

  return { boss, bossState };
};
