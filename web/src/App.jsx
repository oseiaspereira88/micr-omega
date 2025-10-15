import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicroOmegaGame from './MicroOmegaGame.jsx';
import StartScreen from './components/StartScreen';
import ToastStack from './components/ToastStack';
import { useGameSocket } from './hooks/useGameSocket';
import { gameStore, useGameStore } from './store/gameStore';
import { useGameSettings } from './store/gameSettings';

const TOAST_DURATION = 5000;

const App = () => {
  const { connect, disconnect, sendMovement, sendAttack } = useGameSocket();
  const joinError = useGameStore((state) => state.joinError);
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const { settings } = useGameSettings();
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const [isGameActive, setIsGameActive] = useState(false);

  const handleCommandBatch = useCallback(
    (commands) => {
      if (!commands || typeof commands !== 'object') {
        return;
      }

      const movementCommand = commands.movement;
      const hasMovementCommand =
        movementCommand && typeof movementCommand === 'object' ? movementCommand : null;

      const state = gameStore.getState();
      if (!state) {
        if (Array.isArray(commands.attacks) && commands.attacks.length > 0) {
          commands.attacks.length = 0;
        }
        return;
      }
      const playerId = state?.playerId;
      const players = state?.players ?? {};
      const player =
        playerId && players
          ? players[playerId] ?? state?.remotePlayers?.byId?.[playerId]
          : null;

      const phase = state?.room?.phase;
      const isGamePhaseActive = phase === 'active';

      if (hasMovementCommand && playerId && player && isGamePhaseActive) {
        const vector = hasMovementCommand.vector ?? {};
        const rawSpeed = hasMovementCommand.speed;
        const timestamp = hasMovementCommand.timestamp;

        const vectorX = Number.isFinite(vector.x) ? vector.x : 0;
        const vectorY = Number.isFinite(vector.y) ? vector.y : 0;
        const speed = Number.isFinite(rawSpeed) ? rawSpeed : 0;

        const position = player.position;
        const posX = Number.isFinite(position?.x) ? position.x : null;
        const posY = Number.isFinite(position?.y) ? position.y : null;

        if (posX !== null && posY !== null) {
          const orientationState = player.orientation ?? {};
          const orientation = {
            angle: Number.isFinite(orientationState.angle) ? orientationState.angle : 0,
          };

          if (Number.isFinite(orientationState.tilt)) {
            orientation.tilt = orientationState.tilt;
          }

          const movementVector = {
            x: vectorX * speed,
            y: vectorY * speed,
          };

          const clientTime = Number.isFinite(timestamp) ? timestamp : Date.now();

          if (movementVector.x !== 0 || movementVector.y !== 0 || speed === 0) {
            sendMovement({
              playerId,
              position: { x: posX, y: posY },
              movementVector,
              orientation,
              clientTime,
            });
          }
        }
      }

      if (Array.isArray(commands.attacks) && commands.attacks.length > 0) {
        if (typeof sendAttack === 'function') {
          // Integração de ataque ainda não suportada. Apenas limpamos a fila.
        }
        commands.attacks.length = 0;
      }
    },
    [sendMovement, sendAttack]
  );

  const resolvedSettings = useMemo(
    () => ({
      ...(settings || {}),
      onCommandBatch: handleCommandBatch,
    }),
    [settings, handleCommandBatch]
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    if (typeof window !== 'undefined') {
      const timerId = timersRef.current.get(id);
      if (timerId) {
        window.clearTimeout(timerId);
        timersRef.current.delete(id);
      }
    }
  }, []);

  const enqueueToast = useCallback(
    (message) => {
      if (!message) {
        return;
      }

      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [...prev, { id, message }]);

      if (typeof window !== 'undefined') {
        const timerId = window.setTimeout(() => {
          removeToast(id);
        }, TOAST_DURATION);
        timersRef.current.set(id, timerId);
      }
    },
    [removeToast]
  );

  useEffect(() => {
    if (!joinError) {
      return;
    }

    enqueueToast(joinError);
  }, [enqueueToast, joinError]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        timersRef.current.forEach((timerId) => {
          window.clearTimeout(timerId);
        });
      }
      timersRef.current.clear();
    };
  }, []);

  const handleStart = useCallback(
    ({ name }) => {
      connect(name);
      setIsGameActive(true);
    },
    [connect]
  );

  const handleQuit = useCallback(() => {
    setIsGameActive(false);
    disconnect();
  }, [disconnect]);

  useEffect(() => {
    if (connectionStatus === 'disconnected') {
      setIsGameActive(false);
    }
  }, [connectionStatus]);

  return (
    <>
      {isGameActive ? (
        <MicroOmegaGame settings={resolvedSettings} onQuit={handleQuit} />
      ) : null}
      {!isGameActive ? (
        <StartScreen onStart={handleStart} onQuit={handleQuit} />
      ) : null}
      <ToastStack toasts={toasts} onDismiss={removeToast} />
    </>
  );
};

export default App;
