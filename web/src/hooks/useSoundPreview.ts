import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSoundEffects } from "../game/audio/soundEffects";

type UseSoundPreviewOptions = {
  audioEnabled: boolean;
  masterVolume: number;
  profile?: string;
};

type SoundEffectsApi = ReturnType<typeof createSoundEffects> | null;

type AudioContextConstructor = typeof AudioContext;

type ExtendedWindow = typeof window & {
  webkitAudioContext?: AudioContextConstructor;
};

const clampVolume = (value: number): number => {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
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

const resolveAudioContextConstructor = (): AudioContextConstructor | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const globalWindow = window as ExtendedWindow;
  return globalWindow.AudioContext ?? globalWindow.webkitAudioContext;
};

const useSoundPreview = ({
  audioEnabled,
  masterVolume,
  profile = "collect",
}: UseSoundPreviewOptions) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEffectsRef = useRef<SoundEffectsApi>(null);
  const profileRef = useRef(profile);
  const [isSupported, setIsSupported] = useState(() => Boolean(resolveAudioContextConstructor()));

  profileRef.current = profile;

  if (!soundEffectsRef.current) {
    soundEffectsRef.current = createSoundEffects(() => audioContextRef.current, {
      initialMasterVolume: clampVolume(masterVolume),
    });
  }

  useEffect(() => {
    const nextVolume = clampVolume(masterVolume);
    soundEffectsRef.current?.setMasterVolume?.(nextVolume);
  }, [masterVolume]);

  useEffect(() => {
    if (!audioEnabled) {
      const ctx = audioContextRef.current;
      if (ctx && typeof ctx.close === "function") {
        void ctx.close().catch(() => {});
      }
      audioContextRef.current = null;
      return;
    }

    const AudioContextCtor = resolveAudioContextConstructor();
    if (!AudioContextCtor) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new AudioContextCtor();
      } catch (error) {
        console.warn("Failed to initialize preview audio context", error);
        audioContextRef.current = null;
        setIsSupported(false);
      }
    }
  }, [audioEnabled]);

  useEffect(
    () => () => {
      const ctx = audioContextRef.current;
      if (ctx && typeof ctx.close === "function") {
        void ctx.close().catch(() => {});
      }
      audioContextRef.current = null;
    },
    [],
  );

  const playPreview = useCallback(
    (type?: string) => {
      if (!audioEnabled || !isSupported) {
        return false;
      }

      const ctx = audioContextRef.current;
      if (!ctx) {
        return false;
      }

      try {
        if (ctx.state === "suspended" && typeof ctx.resume === "function") {
          const resumeResult = ctx.resume();
          if (resumeResult && typeof (resumeResult as Promise<void>).catch === "function") {
            resumeResult.catch(() => {});
          }
        }
      } catch (error) {
        console.warn("Failed to resume preview audio context", error);
        return false;
      }

      const target = type ?? profileRef.current;
      soundEffectsRef.current?.playSound?.(target);
      return true;
    },
    [audioEnabled, isSupported],
  );

  return useMemo(
    () => ({
      playPreview,
      isSupported,
    }),
    [isSupported, playPreview],
  );
};

export default useSoundPreview;
