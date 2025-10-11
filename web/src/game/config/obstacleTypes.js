export const obstacleTypes = {
  rock: {
    colors: ['#666666', '#555555', '#777777'],
    coreColors: ['#AAAAAA99', '#888888AA'],
    hitColors: ['#FFAA8866', '#FF886666'],
    sizes: [40, 80],
    shapes: ['angular', 'round'],
    opacityRange: [0.55, 0.85],
    pulseSpeedRange: [0.35, 0.7],
    driftRange: [0.15, 0.4]
  },
  crystal: {
    colors: ['#00FFFF', '#00DDDD', '#00BBBB'],
    coreColors: ['#FFFFFFAA', '#99FFFFAA'],
    hitColors: ['#A0FFFF88', '#66DDFF88'],
    sizes: [30, 60],
    shapes: ['geometric', 'cluster'],
    opacityRange: [0.65, 0.9],
    pulseSpeedRange: [0.6, 1],
    driftRange: [0.2, 0.5]
  },
  plant: {
    colors: ['#00AA00', '#00CC00', '#009900'],
    coreColors: ['#55FF5599', '#66FF7788'],
    hitColors: ['#FFFF6688', '#FFDD4488'],
    sizes: [50, 100],
    shapes: ['branched', 'leafy'],
    opacityRange: [0.55, 0.8],
    pulseSpeedRange: [0.4, 0.8],
    driftRange: [0.1, 0.3]
  },
  membrane: {
    colors: ['#FF00FF44', '#FF00AA44', '#AA00FF44'],
    coreColors: ['#FF66FF88', '#FF99FF77'],
    hitColors: ['#FFD6FFAA', '#FFB6FF99'],
    sizes: [60, 120],
    shapes: ['wall', 'bubble'],
    opacityRange: [0.45, 0.7],
    pulseSpeedRange: [0.5, 0.9],
    driftRange: [0.05, 0.2]
  }
};
