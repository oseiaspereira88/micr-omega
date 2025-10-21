const SOUND_PROFILES = {
  attack: { wave: 'triangle', frequency: 480, volume: 0.1, decay: 0.3, duration: 0.5 },
  collect: { wave: 'sine', frequency: 720, volume: 0.1, decay: 0.3, duration: 0.5 },
  damage: { wave: 'sawtooth', frequency: 160, volume: 0.1, decay: 0.3, duration: 0.5 },
  dash: { wave: 'square', frequency: 1280, volume: 0.1, decay: 0.3, duration: 0.5 },
  powerup: { wave: 'sine', frequency: 950, volume: 0.1, decay: 0.3, duration: 0.5 },
  skill: { wave: 'triangle', frequency: 880, volume: 0.1, decay: 0.3, duration: 0.5 },
  shoot: { wave: 'square', frequency: 1020, volume: 0.1, decay: 0.3, duration: 0.5 },
  buff: { wave: 'sine', frequency: 620, volume: 0.1, decay: 0.3, duration: 0.5 },
  drain: { wave: 'triangle', frequency: 360, volume: 0.1, decay: 0.3, duration: 0.5 },
  combo: { wave: 'square', frequency: 680, volume: 0.1, decay: 0.3, duration: 0.5 },
  boss: { wave: 'sawtooth', frequency: 260, volume: 0.2, decay: 0.6, duration: 0.6 },
  default: { wave: 'sine', frequency: 440, volume: 0.1, decay: 0.3, duration: 0.5 }
};

const resolveContext = (audioContextOrGetter) => {
  if (typeof audioContextOrGetter === 'function') {
    return audioContextOrGetter;
  }

  return () => audioContextOrGetter;
};

const clampVolume = (value) => {
  if (!Number.isFinite(value)) {
    return 1;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
};

export const createSoundEffects = (audioContextOrGetter, options = {}) => {
  const getContext = resolveContext(audioContextOrGetter);
  let masterVolume = clampVolume(
    typeof options.initialMasterVolume === 'number' ? options.initialMasterVolume : 1,
  );

  const playSound = (type = 'default') => {
    const ctx = getContext?.();
    if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') {
      return;
    }

    const profile = SOUND_PROFILES[type] || SOUND_PROFILES.default;
    const effectiveVolume = clampVolume(masterVolume) * profile.volume;
    if (effectiveVolume <= 0) {
      return;
    }
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    if (!ctx.destination || typeof gainNode.connect !== 'function' || typeof oscillator.connect !== 'function') {
      return;
    }

    oscillator.type = profile.wave;
    oscillator.frequency.value = profile.frequency;

    gainNode.gain.setValueAtTime(effectiveVolume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + profile.decay);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + profile.duration);
  };

  const setMasterVolume = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return;
    }

    masterVolume = clampVolume(value);
  };

  return { playSound, setMasterVolume };
};

export default createSoundEffects;
