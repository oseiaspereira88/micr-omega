import { describe, expect, it } from 'vitest';
import {
  createCriticalSparks,
  createElementalBurst,
  createStatusDrip,
} from './particles';

const constantRng = () => 0.5;

describe('particle helpers', () => {
  it('creates elemental bursts with oriented motion and blend', () => {
    const direction = Math.PI / 4;
    const particles = createElementalBurst(10, 20, {
      color: '#ff0000',
      life: 2,
      direction,
      count: 3,
      speed: 5,
      rng: constantRng,
    });

    expect(particles).toHaveLength(3);
    particles.forEach((particle) => {
      expect(particle.color).toBe('#ff0000');
      expect(particle.life).toBeCloseTo(2, 5);
      expect(particle.blend).toBe('lighter');
      expect(particle.fade).toBeCloseTo(0.03, 5);
      expect(particle.gravity).toBeCloseTo(0.08, 5);
      expect(Math.atan2(particle.vy, particle.vx)).toBeCloseTo(direction, 5);
    });
  });

  it('creates status drips with downward drift and custom fade', () => {
    const direction = Math.PI / 3;
    const particles = createStatusDrip(0, 0, {
      color: '#00ff00',
      life: 1.4,
      direction,
      count: 4,
      speed: 2,
      fade: 0.01,
      rng: constantRng,
    });

    expect(particles).toHaveLength(4);
    particles.forEach((particle) => {
      expect(particle.color).toBe('#00ff00');
      expect(particle.life).toBeCloseTo(1.4, 5);
      expect(particle.fade).toBeCloseTo(0.01, 5);
      expect(particle.gravity).toBeGreaterThan(0);
      expect(Math.atan2(particle.vy, particle.vx)).toBeCloseTo(direction, 5);
    });
  });

  it('creates critical sparks alternating highlight colors', () => {
    const direction = 0;
    const particles = createCriticalSparks(5, 5, {
      color: '#ffaa00',
      highlight: '#ffffff',
      life: 1.5,
      direction,
      count: 6,
      speed: 4,
      rng: constantRng,
    });

    expect(particles).toHaveLength(6);
    particles.forEach((particle, index) => {
      const expectedColor = index % 2 === 0 ? '#ffffff' : '#ffaa00';
      expect(particle.color).toBe(expectedColor);
      expect(particle.life).toBeCloseTo(1.5, 5);
      expect(particle.blend).toBe('lighter');
      expect(particle.angularVelocity).toBeCloseTo(0, 5);
      expect(Math.atan2(particle.vy, particle.vx)).toBeCloseTo(direction, 5);
    });
  });
});
