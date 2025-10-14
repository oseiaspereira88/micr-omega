const ensureBaseStat = (organism, statKey, baseKey) => {
  const resolvedBaseKey = baseKey ?? `base${statKey.charAt(0).toUpperCase()}${statKey.slice(1)}`;

  if (organism[resolvedBaseKey] === undefined || !Number.isFinite(organism[resolvedBaseKey])) {
    organism[resolvedBaseKey] = organism[statKey];
  }

  return resolvedBaseKey;
};

const addSkillOnce = (organism, skill) => {
  if (!skill) return;

  if (!Array.isArray(organism.skills)) {
    organism.skills = [];
  }

  if (!organism.skills.includes(skill)) {
    organism.skills.push(skill);
  }
};

export const evolutionaryTraits = {
  flagellum: {
    name: 'Flagelo',
    icon: '🦎',
    color: '#00FFB3',
    skill: 'pulse',
    effect: (organism) => {
      const baseKey = ensureBaseStat(organism, 'speed');
      organism.speed = organism[baseKey] * 1.5;
      addSkillOnce(organism, 'pulse');
    },
  },
  spikes: {
    name: 'Espinhos',
    icon: '⚡',
    color: '#FF0066',
    skill: 'spike',
    effect: (organism) => {
      const baseKey = ensureBaseStat(organism, 'attack');
      organism.attack = organism[baseKey] * 1.8;
      addSkillOnce(organism, 'spike');
    },
  },
  membrane: {
    name: 'Membrana',
    icon: '🛡️',
    color: '#FF6B00',
    skill: 'shield',
    effect: (organism) => {
      const baseKey = ensureBaseStat(organism, 'defense');
      organism.defense = organism[baseKey] * 1.6;
      addSkillOnce(organism, 'shield');
    },
  },
  nucleus: {
    name: 'Núcleo Vital',
    icon: '💎',
    color: '#FFD700',
    skill: 'drain',
    effect: (organism) => {
      const baseKey = ensureBaseStat(organism, 'maxHealth');
      organism.maxHealth = organism[baseKey] + 50;
      if (organism.health !== undefined) {
        organism.health = Math.min(organism.health, organism.maxHealth);
      }
      addSkillOnce(organism, 'drain');
    },
  },
};
