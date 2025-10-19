import React, { useEffect, useRef } from 'react';

import { createParticle } from '../../game/effects/particles.js';
import { effectsRenderer } from '../../game/render/effectsRenderer.js';

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 360;
const PARTICLE_TARGET = 48;

const randomInRange = (min, max) => Math.random() * (max - min) + min;

const spawnParticle = (x, y, overrides = {}) =>
  createParticle(x, y, {
    color: overrides.color ?? '#7f8cff',
    size: overrides.size ?? randomInRange(5, 9),
    life: overrides.life ?? randomInRange(1.8, 2.4),
    fade: overrides.fade ?? randomInRange(0.012, 0.02),
    gravity: overrides.gravity ?? 0,
    blend: overrides.blend ?? 'lighter',
    glowStrength: overrides.glowStrength ?? randomInRange(1.2, 2.6),
    glowColor: overrides.glowColor ?? overrides.color ?? '#7f8cff',
    pulseSpeed: overrides.pulseSpeed ?? randomInRange(4, 8),
    pulseAmplitude: overrides.pulseAmplitude ?? randomInRange(0.25, 0.4),
    pulsePhase: overrides.pulsePhase,
    stretch: overrides.stretch ?? randomInRange(0.6, 1.4),
    angularVelocity: overrides.angularVelocity ?? (Math.random() - 0.5) * 0.2,
  });

const ParticleEffectsStory = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const viewport = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
    const camera = {
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      viewport,
    };

    const state = {
      effects: [],
      particles: [],
      fogIntensity: 0,
    };

    const originX = CANVAS_WIDTH / 2;
    const originY = CANVAS_HEIGHT / 2;

    const replenishParticles = () => {
      while (state.particles.length < PARTICLE_TARGET) {
        const angle = Math.random() * Math.PI * 2;
        const radius = randomInRange(4, 32);
        const spawnX = originX + Math.cos(angle) * radius;
        const spawnY = originY + Math.sin(angle) * radius;
        const hue = randomInRange(180, 260);
        const saturation = randomInRange(65, 90);
        const lightness = randomInRange(60, 80);
        const color = `hsl(${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(lightness)}%)`;

        const particle = spawnParticle(spawnX, spawnY, {
          color,
          pulseSpeed: randomInRange(3, 6) * (Math.random() > 0.5 ? 1 : -1),
          pulsePhase: Math.random() * Math.PI * 2,
          glowStrength: randomInRange(1.4, 3),
          stretch: randomInRange(0.8, 1.2),
        });

        if (particle) {
          particle.vx *= 0.4;
          particle.vy *= 0.4;
          state.particles.push(particle);
        }
      }
    };

    replenishParticles();

    let animationFrame;
    let previousTimestamp = performance.now();

    const renderFrame = (timestamp) => {
      const delta = (timestamp - previousTimestamp) / 1000;
      previousTimestamp = timestamp;

      context.fillStyle = 'rgba(8, 14, 28, 0.85)';
      context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      const result = effectsRenderer.render(
        context,
        state,
        camera,
        { delta, viewport }
      );

      if (result) {
        state.particles = result.particles;
        state.effects = result.effects;
      }

      if (state.particles.length < PARTICLE_TARGET * 0.8) {
        replenishParticles();
      }

      animationFrame = requestAnimationFrame(renderFrame);
    };

    animationFrame = requestAnimationFrame(renderFrame);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{ borderRadius: '12px', background: '#050a16', boxShadow: '0 0 24px rgba(127, 140, 255, 0.25)' }}
      />
      <p style={{ color: '#aab4ff', fontSize: '0.9rem', margin: 0 }}>
        Pulsing particles now support additive glow and customizable rhythm.
      </p>
    </div>
  );
};

export default ParticleEffectsStory;
