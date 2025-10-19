import React, { useCallback, useState } from 'react';
import GameApp from './GameApp.jsx';
import MicroWorldOnboardingFlow from './ui/onboarding/MicroWorldOnboardingFlow.jsx';
import MicroWorldConceptScreens from './ui/concepts/MicroWorldConceptScreens.jsx';
import ParticlesGlowStory from './ui/stories/ParticlesGlowStory.jsx';

const detectInitialMode = () => {
  if (typeof window === 'undefined') {
    return 'concept';
  }

  try {
    const search = window.location?.search ?? '';
    const params = new URLSearchParams(search);
    const explicitMode = params.get('mode');

    if (typeof explicitMode === 'string') {
      const normalized = explicitMode.trim().toLowerCase();
      if (normalized === 'play' || normalized === 'game') {
        return 'game';
      }

      if (normalized === 'story') {
        return 'story';
      }
    }

    return 'concept';
  } catch (error) {
    return 'concept';
  }
};

const App = () => {
  const [displayMode, setDisplayMode] = useState(() => detectInitialMode());

  const handleConceptComplete = useCallback(() => {
    setDisplayMode('game');
  }, []);

  if (displayMode === 'story') {
    const getStoryKey = () => {
      if (typeof window === 'undefined') return 'particles-glow';
      try {
        const params = new URLSearchParams(window.location?.search ?? '');
        const key = params.get('story');
        return key || 'particles-glow';
      } catch (error) {
        return 'particles-glow';
      }
    };

    const storyKey = getStoryKey();

    switch (storyKey) {
      case 'particles-glow':
      default:
        return <ParticlesGlowStory />;
    }
  }

  if (displayMode === 'concept') {
    return <MicroWorldOnboardingFlow onComplete={handleConceptComplete} />;
  }

  return <GameApp />;
};

export default App;
