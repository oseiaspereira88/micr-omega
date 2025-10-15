import { useCallback, useEffect, useMemo, useRef } from 'react';

import { createSoundEffects } from '../audio/soundEffects';
import { createParticle as generateParticle } from '../effects/particles';
import { createVisualEffect as generateVisualEffect } from '../effects/visualEffects';
import { addNotification as appendNotification } from '../ui/notifications';
import { renderFrame } from '../render/renderFrame';
import { updateGameState } from './updateGameState';
import useInputController from '../input/useInputController';
import { DEFAULT_JOYSTICK_STATE } from '../input/utils';
import { gameStore } from '../../store/gameStore';
import { createInitialState } from '../state/initialState';

const DEFAULT_SETTINGS = {
  audioEnabled: true,
  visualDensity: 'medium',
  showTouchControls: false,
};

const DENSITY_SCALE = {
  low: 0.6,
  medium: 1,
  high: 1.4,
};

const createInitialRenderState = () => ({
  camera: {
    x: 2000,
    y: 2000,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    viewport: {
      width: 0,
      height: 0,
    },
  },
  pulsePhase: 0,
  effects: [],
  particles: [],
  notifications: [],
  background: {
    backgroundLayers: [],
    lightRays: [],
    microorganisms: [],
    glowParticles: [],
    floatingParticles: [],
  },
  worldView: {
    microorganisms: [],
    organicMatter: [],
    obstacles: [],
    roomObjects: [],
  },
  playersById: new Map(),
  playerList: [],
  combatIndicators: [],
  pendingInputs: {
    movement: null,
    attacks: [],
  },
  hudSnapshot: null,
  lastMovementIntent: { ...DEFAULT_JOYSTICK_STATE },
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const MAX_FRAME_DELTA_SECONDS = 0.1;
const MAX_FRAME_DELTA_MS = MAX_FRAME_DELTA_SECONDS * 1000;

const resolveTimestamp = (timestamp) => {
  if (typeof timestamp === 'number') {
    return timestamp;
  }

  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
};

const useGameLoop = ({ canvasRef, dispatch, settings }) => {
  const audioCtxRef = useRef(null);
  const audioWarningLoggedRef = useRef(false);
  const animationFrameRef = useRef(null);
  const renderStateRef = useRef(createInitialRenderState());
  const sharedStateRef = useRef(gameStore.getState());
  const movementIntentRef = useRef({ ...DEFAULT_JOYSTICK_STATE });
  const actionBufferRef = useRef({ attacks: [] });
  const dispatchRef = useRef(dispatch);
  const commandCallbackRef = useRef(settings?.onCommandBatch ?? null);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    commandCallbackRef.current = settings?.onCommandBatch ?? null;
  }, [settings]);

  useEffect(() => {
    sharedStateRef.current = gameStore.getState();
    const unsubscribe = gameStore.subscribe(() => {
      sharedStateRef.current = gameStore.getState();
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const resolvedSettings = useMemo(
    () => ({
      ...DEFAULT_SETTINGS,
      ...(settings || {}),
    }),
    [settings]
  );

  const densityScale = useMemo(
    () => DENSITY_SCALE[resolvedSettings.visualDensity] ?? DENSITY_SCALE.medium,
    [resolvedSettings.visualDensity]
  );

  const { playSound } = useMemo(() => createSoundEffects(() => audioCtxRef.current), []);

  const createParticle = useCallback((x, y, color, size = 3) => {
    const particle = generateParticle(x, y, color, size);
    if (!particle) return;

    const state = renderStateRef.current;
    state.particles.push(particle);
  }, []);

  const createEffect = useCallback((x, y, type, color) => {
    const effect = generateVisualEffect(x, y, type, color);
    if (!effect) return;

    const state = renderStateRef.current;
    state.effects.push(effect);
  }, []);

  const pushNotification = useCallback((text) => {
    if (!text) return;

    const state = renderStateRef.current;
    state.notifications = appendNotification(state.notifications, text);
  }, []);

  const setCameraZoom = useCallback((zoomValue) => {
    const state = renderStateRef.current;
    const camera = state?.camera;
    if (!camera) return;

    const minZoom = 0.6;
    const maxZoom = 1.2;
    const parsed = Number.parseFloat(zoomValue);
    const safeValue = Number.isFinite(parsed) ? parsed : 1;
    const clamped = clamp(safeValue, minZoom, maxZoom);

    if (Math.abs((camera.zoom ?? 1) - clamped) < 0.0001) {
      return;
    }

    camera.zoom = clamped;
  }, []);

  const selectArchetype = useCallback(
    (key) => {
      if (!key) return;
      const normalized = String(key).trim();
      if (!normalized) return;

      const baseState = createInitialState({ archetypeKey: normalized });
      renderStateRef.current.localArchetypeSelection = baseState.archetypeSelection;
      renderStateRef.current.localSelectedArchetype = baseState.selectedArchetype;
      renderStateRef.current.hudSnapshot = {
        ...(renderStateRef.current.hudSnapshot || {}),
        energy: baseState.energy,
        health: baseState.health,
        maxHealth: baseState.maxHealth,
        level: baseState.level,
        element: baseState.element,
        affinity: baseState.affinity,
        resistances: baseState.resistances,
        elementLabel: baseState.elementLabel,
        affinityLabel: baseState.affinityLabel,
        archetypeSelection: baseState.archetypeSelection,
        selectedArchetype: baseState.selectedArchetype,
      };

      dispatchRef.current({
        type: 'SYNC_STATE',
        payload: {
          energy: baseState.energy,
          health: baseState.health,
          maxHealth: baseState.maxHealth,
          level: baseState.level,
          element: baseState.element,
          affinity: baseState.affinity,
          resistances: baseState.resistances,
          elementLabel: baseState.elementLabel,
          affinityLabel: baseState.affinityLabel,
          archetypeSelection: baseState.archetypeSelection,
          selectedArchetype: baseState.selectedArchetype,
        },
      });

      if (typeof resolvedSettings.onArchetypeSelect === 'function') {
        resolvedSettings.onArchetypeSelect(normalized, baseState);
      }
    },
    [resolvedSettings]
  );

  const initializeBackground = useCallback(() => {
    const state = renderStateRef.current;
    const { background } = state;

    background.floatingParticles = [];
    background.glowParticles = [];
    background.microorganisms = [];
    background.lightRays = [];
    background.backgroundLayers = [];

    const floatingCount = Math.max(150, Math.round(500 * densityScale));
    for (let i = 0; i < floatingCount; i += 1) {
      background.floatingParticles.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 3 + 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        depth: Math.random(),
        hue: Math.random() * 60 + 180,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.5 + Math.random() * 1.5,
      });
    }

    const glowCount = Math.max(60, Math.round(150 * densityScale));
    for (let i = 0; i < glowCount; i += 1) {
      background.glowParticles.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 4 + 2,
        opacity: Math.random() * 0.8 + 0.2,
        depth: Math.random(),
        color: ['rgba(0, 255, 200, ', 'rgba(100, 200, 255, ', 'rgba(200, 100, 255, '][
          Math.floor(Math.random() * 3)
        ],
        pulsePhase: Math.random() * Math.PI * 2,
        glowIntensity: Math.random() * 20 + 10,
      });
    }

    const microorganismCount = Math.max(30, Math.round(80 * densityScale));
    for (let i = 0; i < microorganismCount; i += 1) {
      background.microorganisms.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 6 + 3,
        opacity: Math.random() * 0.3 + 0.1,
        color: ['rgba(100, 200, 255, ', 'rgba(100, 255, 200, ', 'rgba(255, 200, 100, '][
          Math.floor(Math.random() * 3)
        ],
        animPhase: Math.random() * Math.PI * 2,
        depth: 0.3 + Math.random() * 0.4,
      });
    }

    const lightRayCount = Math.max(3, Math.round(5 * densityScale));
    for (let i = 0; i < lightRayCount; i += 1) {
      background.lightRays.push({
        x: Math.random() * 4000,
        y: -200,
        angle: (Math.random() - 0.5) * 0.3,
        width: Math.random() * 100 + 50,
        opacity: Math.random() * 0.1 + 0.05,
        length: 1000 + Math.random() * 500,
        speed: Math.random() * 0.1 + 0.05,
      });
    }

    for (let i = 0; i < 3; i += 1) {
      background.backgroundLayers.push({
        x: Math.random() * 4000,
        y: Math.random() * 4000,
        size: Math.random() * 300 + 200,
        opacity: Math.random() * 0.05 + 0.02,
        color: i === 0 ? '#0a3a4a' : i === 1 ? '#1a2a3a' : '#2a1a3a',
        depth: 0.2 + i * 0.15,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }, [densityScale]);

  const { joystick, actions: inputActions } = useInputController({
    onMovementIntent: (intent) => {
      movementIntentRef.current = intent;
    },
    onAttack: () => {
      actionBufferRef.current.attacks.push({
        kind: 'basic',
        timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      });
    },
    onDash: () => {
      actionBufferRef.current.attacks.push({
        kind: 'dash',
        timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      });
    },
    onUseSkill: () => {
      actionBufferRef.current.attacks.push({
        kind: 'skill',
        timestamp: typeof performance !== 'undefined' ? performance.now() : Date.now(),
      });
    },
    onCycleSkill: () => {},
    onOpenEvolutionMenu: () => {},
    onActionButtonChange: () => {},
  });

  useEffect(() => {
    initializeBackground();
  }, [initializeBackground]);

  useEffect(() => {
    if (!resolvedSettings.audioEnabled) {
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        audioCtxRef.current.close();
      }
      audioCtxRef.current = null;
      return;
    }

    const AudioContextCtor =
      typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);

    if (!AudioContextCtor) {
      audioCtxRef.current = null;
      if (!audioWarningLoggedRef.current) {
        console.warn('Web Audio API unavailable; game audio disabled.');
        audioWarningLoggedRef.current = true;
      }
      return;
    }

    if (audioCtxRef.current) {
      return;
    }

    try {
      audioCtxRef.current = new AudioContextCtor();
    } catch (error) {
      audioCtxRef.current = null;
      if (!audioWarningLoggedRef.current) {
        console.warn('Failed to initialize Web Audio API; game audio disabled.', error);
        audioWarningLoggedRef.current = true;
      }
    }
  }, [resolvedSettings.audioEnabled]);

  useEffect(
    () => () => {
      if (audioCtxRef.current && typeof audioCtxRef.current.close === 'function') {
        audioCtxRef.current.close();
      }
    },
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Canvas 2D context not available; aborting game loop setup.');
      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      };
    }

    const updateCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight - 40;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const displayWidth = Math.round(width * dpr);
      const displayHeight = Math.round(height * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;

        if (typeof ctx.resetTransform === 'function') {
          ctx.resetTransform();
        } else {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }

        ctx.scale(dpr, dpr);
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    let lastTime = null;

    const animate = (timestamp) => {
      const now = resolveTimestamp(timestamp);

      if (lastTime === null) {
        lastTime = now;
      }

      let deltaMs = now - lastTime;
      if (!Number.isFinite(deltaMs) || deltaMs < 0) {
        deltaMs = 0;
      }

      const clampedDeltaMs = Math.min(deltaMs, MAX_FRAME_DELTA_MS);
      const delta = clampedDeltaMs / 1000;

      // Always reset to the current RAF timestamp so we don't accumulate large catch-up steps
      // when the tab resumes after being paused or throttled.
      lastTime = now;

      const canvasWidth = canvas.clientWidth || canvas.width / (window.devicePixelRatio || 1);
      const canvasHeight = canvas.clientHeight || canvas.height / (window.devicePixelRatio || 1);

      const renderState = renderStateRef.current;
      const sharedState = sharedStateRef.current;
      const camera = renderState.camera;

      const updateResult = updateGameState({
        renderState,
        sharedState,
        delta,
        movementIntent: movementIntentRef.current,
        actionBuffer: actionBufferRef.current,
        helpers: {
          createEffect,
          createParticle,
          addNotification: pushNotification,
          playSound,
        },
      });

      renderState.pendingInputs = updateResult.commands;
      if (updateResult.commands && commandCallbackRef.current) {
        commandCallbackRef.current(updateResult.commands);
      }

      if (updateResult.hudSnapshot) {
        dispatchRef.current({
          type: 'SYNC_STATE',
          payload: updateResult.hudSnapshot,
        });
      }

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      const cameraOffsetX = camera.x - canvasWidth / 2;
      const cameraOffsetY = camera.y - canvasHeight / 2;

      camera.offsetX = cameraOffsetX;
      camera.offsetY = cameraOffsetY;
      camera.viewport = {
        width: canvasWidth,
        height: canvasHeight,
      };

      const frameResult = renderFrame(
        ctx,
        {
          background: renderState.background,
          worldView: renderState.worldView,
          players: renderState.playerList,
          combatIndicators: renderState.combatIndicators,
          effects: renderState.effects,
          particles: renderState.particles,
          localPlayerId: updateResult.localPlayerId,
          pulsePhase: renderState.pulsePhase,
        },
        camera,
        {
          canvas,
          delta,
          viewport: {
            width: canvasWidth,
            height: canvasHeight,
          },
        }
      );

      if (frameResult) {
        renderState.effects = frameResult.effects;
        renderState.particles = frameResult.particles;
      }

      renderState.pulsePhase += delta * 4;

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate(resolveTimestamp());

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [canvasRef, createEffect, createParticle, playSound, pushNotification]);

  return {
    joystick,
    inputActions,
    chooseEvolution: () => {},
    restartGame: () => {},
    selectArchetype,
    setCameraZoom,
  };
};

export default useGameLoop;
