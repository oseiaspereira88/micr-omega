import { describe, expect, it } from 'vitest';
import createParticle, {
  createCriticalSparks,
  createElementalBurst,
  createStatusAura,
  createStatusDrip,
} from './particles';

const constantRng = () => 0.5;

describe('particle helpers', () => {
  it('keeps createParticle as the default export', () => {
    expect(typeof createParticle).toBe('function');
  });

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

  it('creates status aura particles arranged in a circular ring', () => {
    const sequenceValues = [0.2, 0.8, 0.4, 0.6, 0.1, 0.9];
    let cursor = 0;
    const sequenceRng = () => {
      const value = sequenceValues[cursor % sequenceValues.length];
      cursor += 1;
      return value;
    };

    const radius = 12;
    const count = 6;
    const angularSpeed = 1.1;
    const centerX = 3;
    const centerY = 4;
    const aura = createStatusAura(centerX, centerY, {
      radius,
      count,
      angularSpeed,
      oscillationAmplitude: 0,
      oscillationFrequency: 3,
      pulseSpeed: 0.6,
      pulseAmplitude: 0.4,
      glowStrength: 1.8,
      rng: sequenceRng,
    });

    expect(aura).toHaveLength(count);

    aura.forEach((particle, index) => {
      const angle = (index / count) * Math.PI * 2;
      const distance = Math.hypot(particle.x - centerX, particle.y - centerY);
      expect(distance).toBeCloseTo(radius, 2);
      expect(particle.pulseSpeed).toBeCloseTo(0.6, 5);
      expect(particle.pulseAmplitude).toBeCloseTo(0.4, 5);
      expect(particle.orbit.radius).toBeCloseTo(radius, 5);
      expect(particle.orbit.centerX).toBeCloseTo(centerX, 5);
      expect(particle.orbit.centerY).toBeCloseTo(centerY, 5);
      expect(particle.vx).toBeCloseTo(-Math.sin(angle) * angularSpeed * radius, 5);
      expect(particle.vy).toBeCloseTo(Math.cos(angle) * angularSpeed * radius, 5);
    });
  });

  it('applies aura fade envelopes based on configured life', () => {
    const aura = createStatusAura(0, 0, {
      count: 3,
      radius: 10,
      life: 2,
      rng: constantRng,
    });

    expect(aura).toHaveLength(3);
    aura.forEach((particle) => {
      expect(particle.life).toBeCloseTo(2, 5);
      expect(particle.fade).toBeCloseTo(Math.max(0.01, 2 / 60), 5);
      expect(particle.glowStrength).toBeGreaterThanOrEqual(0);
      expect(particle.orbit.oscillationAmplitude).toBeGreaterThanOrEqual(0);
      expect(particle.orbit.oscillationFrequency).toBeGreaterThanOrEqual(0);
    });
  });
});
