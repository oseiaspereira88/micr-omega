const randomRange = (min, max) => Math.random() * (max - min) + min;

export const createParticle = (x, y, color, size = 3) => ({
  x,
  y,
  vx: randomRange(-2.5, 2.5),
  vy: randomRange(-2.5, 2.5),
  life: 1,
  color,
  size: randomRange(2, size + 2)
});

export const createParticleBurst = (x, y, color, count = 1, size = 3) =>
  Array.from({ length: Math.max(0, count) }, () => createParticle(x, y, color, size));

export default createParticle;
