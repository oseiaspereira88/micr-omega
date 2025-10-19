import React, { useEffect, useMemo, useRef } from 'react';
import { effectsRenderer } from '../../game/render/effectsRenderer.js';
import { createParticle, createParticleBurst } from '../../game/effects/particles.js';

const createDemoParticles = (centerX, centerY) => {
  const palette = [
    'rgba(120, 200, 255, 1)',
    'rgba(255, 180, 120, 1)',
    'rgba(180, 120, 255, 1)',
  ];

  return createParticleBurst(centerX, centerY, palette[Math.floor(Math.random() * palette.length)], 12, 6, {
    glowStrength: 1.4,
    pulseSpeed: 3,
    baseAlpha: 0.9,
    composite: 'additive',
  });
};

const ParticlesGlowStory = () => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationRef = useRef(null);

  const camera = useMemo(
    () => ({
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      viewport: { width: 640, height: 400 },
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let lastTime = performance.now();

    const spawnBurst = () => {
      const baseParticles = createDemoParticles(canvas.width / 2, canvas.height / 2);
      const trailingParticle = createParticle(canvas.width / 2, canvas.height / 2, 'rgba(255, 255, 255, 1)', 12, {
        glowStrength: 2,
        pulseSpeed: 5,
        baseAlpha: 0.6,
        composite: 'additive',
        shape: 'circle',
      });
      particlesRef.current = particlesRef.current.concat(baseParticles, trailingParticle);
    };

    const loop = time => {
      const delta = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (particlesRef.current.length < 45) {
        spawnBurst();
      }

      const result = effectsRenderer.render(
        ctx,
        {
          particles: particlesRef.current,
          effects: [],
        },
        camera,
        {
          delta,
          viewport: camera.viewport,
        }
      );

      particlesRef.current = result?.particles ?? [];

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [camera]);

  return (
    <div
      style={{
        background: '#050914',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <canvas
        ref={canvasRef}
        width={camera.viewport.width}
        height={camera.viewport.height}
        style={{
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          background: 'rgba(12, 20, 40, 0.9)',
        }}
      />
      <p style={{ maxWidth: 480, textAlign: 'center', opacity: 0.8 }}>
        This scene demonstrates particle glow strength and pulse speeds rendered with additive
        blending. Use <code>?mode=story&amp;story=particles-glow</code> to open it during development.
      </p>
    </div>
  );
};

export default ParticlesGlowStory;
