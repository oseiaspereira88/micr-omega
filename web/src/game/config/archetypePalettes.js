export const archetypePalettes = {
  virus: {
    form: 'viral',
    hybridForms: ['viral', 'star'],
    palette: {
      base: '#ff3b6d',
      accent: '#a4113d',
      secondary: '#ff7f9f',
      tertiary: '#ffe2ec',
      label: '#fff4f7',
    },
  },
  bacteria: {
    form: 'bacterial',
    hybridForms: ['bacterial', 'sphere'],
    palette: {
      base: '#46c58f',
      accent: '#1b7a58',
      secondary: '#7fe3ba',
      tertiary: '#e0fff1',
      label: '#f4fff9',
    },
  },
  archaea: {
    form: 'archaeal',
    hybridForms: ['archaeal', 'geometric'],
    palette: {
      base: '#d67b26',
      accent: '#8f4b0f',
      secondary: '#f5a457',
      tertiary: '#ffe3c5',
      label: '#fff5e8',
    },
  },
  protozoa: {
    form: 'protozoan',
    hybridForms: ['protozoan', 'elongated'],
    palette: {
      base: '#5f6cf0',
      accent: '#2e3ab6',
      secondary: '#8a95ff',
      tertiary: '#dde1ff',
      label: '#f6f7ff',
    },
  },
  algae: {
    form: 'algal',
    hybridForms: ['algal', 'amoeba'],
    palette: {
      base: '#43b7d6',
      accent: '#1b6e83',
      secondary: '#7ad8ed',
      tertiary: '#e0f7fb',
      label: '#f5fdff',
    },
  },
  fungus: {
    form: 'mycelial',
    hybridForms: ['mycelial', 'geometric'],
    palette: {
      base: '#9b6cf5',
      accent: '#5c35b3',
      secondary: '#c6a1ff',
      tertiary: '#f0e5ff',
      label: '#f9f5ff',
    },
  },
};

export const getArchetypePalette = (archetypeKey) => archetypePalettes[archetypeKey] ?? null;
