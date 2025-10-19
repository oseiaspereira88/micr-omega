export const organicAttributeBuffMetadata = {
  attack: {
    type: 'attack',
    label: 'Ferocity Boost',
    icon: '⚔️',
    color: '#FF6B9D',
    description: 'Temporarily amplifies outgoing attack damage.',
  },
  defense: {
    type: 'defense',
    label: 'Shell Shield',
    icon: '🛡️',
    color: '#57D5FF',
    description: 'Bolsters defensive resilience for a short window.',
  },
  speed: {
    type: 'speed',
    label: 'Velocity Burst',
    icon: '💨',
    color: '#00FFB5',
    description: 'Greatly increases movement speed temporarily.',
  },
  range: {
    type: 'range',
    label: 'Focus Bloom',
    icon: '🎯',
    color: '#FFD166',
    description: 'Extends attack range and precision for a short time.',
  },
};

export const organicAttributeBuffPresets = {
  ferocity: {
    ...organicAttributeBuffMetadata.attack,
    amount: 3,
    durationMs: 15000,
  },
  shell: {
    ...organicAttributeBuffMetadata.defense,
    amount: 2,
    durationMs: 12000,
  },
  velocity: {
    ...organicAttributeBuffMetadata.speed,
    amount: 4,
    durationMs: 10000,
  },
  focus: {
    ...organicAttributeBuffMetadata.range,
    amount: 2,
    durationMs: 14000,
  },
};

export const organicMatterTypes = {
  protein: {
    colors: ['#FF6B9D', '#FF1493', '#C71585'],
    sizes: [8, 12],
    energy: 15,
    health: 5,
    shapes: ['cluster', 'chain'],
    nutrientTags: ['protein'],
    attributeBuff: organicAttributeBuffPresets.ferocity,
  },
  lipid: {
    colors: ['#FFD700', '#FFA500', '#FF8C00'],
    sizes: [6, 10],
    energy: 10,
    health: 0,
    shapes: ['blob', 'droplet'],
    nutrientTags: ['lipid'],
    attributeBuff: organicAttributeBuffPresets.shell,
  },
  carbohydrate: {
    colors: ['#00FF88', '#00FA9A', '#3CB371'],
    sizes: [10, 15],
    energy: 20,
    health: 0,
    shapes: ['crystal', 'cluster'],
    nutrientTags: ['carbohydrate'],
    attributeBuff: organicAttributeBuffPresets.velocity,
  },
  vitamin: {
    colors: ['#00D9FF', '#1E90FF', '#4169E1'],
    sizes: [5, 8],
    energy: 5,
    health: 15,
    shapes: ['star', 'sphere'],
    nutrientTags: ['vitamin'],
    attributeBuff: organicAttributeBuffPresets.focus,
  },
};
