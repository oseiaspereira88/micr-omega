const createAttributePreset = ({ key, label, description, color, icon }) => ({
  key,
  label,
  description,
  color,
  icon,
});

export const organicMatterAttributePresets = {
  attack: createAttributePreset({
    key: 'attack',
    label: 'Aggression Boost',
    description: 'Temporarily amplifies attack potency.',
    color: '#FF4F81',
    icon: 'ATK',
  }),
  defense: createAttributePreset({
    key: 'defense',
    label: 'Carapace Shield',
    description: 'Bolsters defensive resilience for a short time.',
    color: '#F5A524',
    icon: 'DEF',
  }),
  speed: createAttributePreset({
    key: 'speed',
    label: 'Metabolic Surge',
    description: 'Accelerates locomotion and reaction speed.',
    color: '#2FD8A7',
    icon: 'SPD',
  }),
  range: createAttributePreset({
    key: 'range',
    label: 'Focus Bloom',
    description: 'Extends effective attack distance.',
    color: '#3DA9FC',
    icon: 'RNG',
  }),
};

const createTags = ({ nutrients = [], attributes = [] } = {}) => ({
  nutrients,
  attributes,
});

export const organicMatterTypes = {
  protein: {
    colors: ['#FF6B9D', '#FF1493', '#C71585'],
    sizes: [8, 12],
    energy: 15,
    health: 5,
    shapes: ['cluster', 'chain', 'spiral'],
    tags: createTags({ nutrients: ['protein'], attributes: ['attack'] }),
    attributeBuff: organicMatterAttributePresets.attack,
  },
  lipid: {
    colors: ['#FFD700', '#FFA500', '#FF8C00'],
    sizes: [6, 10],
    energy: 10,
    health: 0,
    shapes: ['blob', 'droplet', 'compact-blob'],
    tags: createTags({ nutrients: ['lipid'], attributes: ['defense'] }),
    attributeBuff: organicMatterAttributePresets.defense,
  },
  carbohydrate: {
    colors: ['#00FF88', '#00FA9A', '#3CB371'],
    sizes: [10, 15],
    energy: 20,
    health: 0,
    shapes: ['crystal', 'cluster', 'wave'],
    tags: createTags({ nutrients: ['carbohydrate'], attributes: ['speed'] }),
    attributeBuff: organicMatterAttributePresets.speed,
  },
  vitamin: {
    colors: ['#00D9FF', '#1E90FF', '#4169E1'],
    sizes: [5, 8],
    energy: 5,
    health: 15,
    shapes: ['star', 'sphere', 'spiral'],
    tags: createTags({ nutrients: ['vitamin'], attributes: ['range'] }),
    attributeBuff: organicMatterAttributePresets.range,
  },
};

export const getOrganicMatterAttributePreset = (key) =>
  organicMatterAttributePresets[key] ?? null;
