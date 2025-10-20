import React from 'react';

import ParticleEffectsStory from './ParticleEffectsStory.jsx';
import styles from './StoryMode.module.css';

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
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
      </header>
      <Component />
      <p className={styles.showcaseHint}>
        Use <code>?mode=story&amp;story=particle-glow</code> to open this showcase.
      </p>
    </div>
  );
};

export default StoryMode;
