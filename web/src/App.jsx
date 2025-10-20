import React, { useCallback, useState } from 'react';
import GameApp from './GameApp.jsx';
import MicroWorldOnboardingFlow from './ui/onboarding/MicroWorldOnboardingFlow.jsx';
import MicroWorldConceptScreens from './ui/concepts/MicroWorldConceptScreens.jsx';
import StoryMode from './ui/stories/StoryMode.jsx';
import useDynamicViewportHeight from './hooks/useDynamicViewportHeight.js';

const readSearchParams = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return new URLSearchParams(window.location?.search ?? '');
  } catch (error) {
    return null;
  }
};

const detectInitialMode = () => {
  if (typeof window === 'undefined') {
    return 'concept';
  }

  try {
    const params = readSearchParams();
    if (!params) return 'concept';
    const explicitMode = params.get('mode');

    if (typeof explicitMode === 'string') {
      const normalized = explicitMode.trim().toLowerCase();
      if (normalized === 'play' || normalized === 'game') {
        return 'game';
      }
      if (normalized === 'story' || normalized === 'effects') {
        return 'story';
      }
    }

    return 'concept';
  } catch (error) {
    return 'concept';
  }
};

const detectStoryId = () => {
  const params = readSearchParams();
  if (!params) return undefined;

  const story = params.get('story');
  if (typeof story === 'string' && story.trim().length > 0) {
    return story.trim();
  }

  return undefined;
};

const App = () => {
  useDynamicViewportHeight();
  const [displayMode, setDisplayMode] = useState(() => detectInitialMode());
  const [storyId] = useState(() => detectStoryId());

  const handleConceptComplete = useCallback(() => {
    setDisplayMode('game');
  }, []);

  if (displayMode === 'story') {
    return <StoryMode storyId={storyId} />;
  }

  if (displayMode === 'concept') {
    return <MicroWorldOnboardingFlow onComplete={handleConceptComplete} />;
  }

  return <GameApp />;
};

export default App;
