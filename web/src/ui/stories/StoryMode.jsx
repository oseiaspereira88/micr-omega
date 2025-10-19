import React from 'react';

import ParticleEffectsStory from './ParticleEffectsStory.jsx';

const STORY_MAP = {
  'particle-glow': {
    title: 'Particle Glow Showcase',
    Component: ParticleEffectsStory,
    description:
      'Demonstrates the new glowStrength and pulseSpeed particle fields rendered with additive blending.',
  },
};

const resolveStoryId = () => {
  if (typeof window === 'undefined') {
    return 'particle-glow';
  }

  try {
    const params = new URLSearchParams(window.location?.search ?? '');
    const story = params.get('story');
    if (typeof story === 'string' && STORY_MAP[story]) {
      return story;
    }
    return 'particle-glow';
  } catch (error) {
    return 'particle-glow';
  }
};

const StoryMode = ({ storyId }) => {
  const resolvedId = storyId && STORY_MAP[storyId] ? storyId : resolveStoryId();
  const { Component, title, description } = STORY_MAP[resolvedId] ?? STORY_MAP['particle-glow'];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at top, #0a1628, #04070d)',
        color: '#f7f9ff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 16px',
        gap: '24px',
      }}
    >
      <header style={{ textAlign: 'center', maxWidth: '520px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>{title}</h1>
        <p style={{ margin: 0, color: '#c1c9ff' }}>{description}</p>
      </header>
      <Component />
      <p style={{ margin: 0, color: '#6f7abf', fontSize: '0.85rem' }}>
        Use <code style={{ color: '#d7dbff' }}>?mode=story&amp;story=particle-glow</code> to open this showcase.
      </p>
    </div>
  );
};

export default StoryMode;
