import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicroOmegaGame from './MicroOmegaGame.jsx';
import StartScreen from './components/StartScreen';
import ToastStack from './components/ToastStack';
import { useGameSocket } from './hooks/useGameSocket';
import { gameStore, useGameStore } from './store/gameStore';
import { useGameSettings } from './store/gameSettings';
import { buildEvolutionPayload } from './utils/evolution';
import { sanitizeArchetypeKey, TARGET_OPTIONAL_ATTACK_KINDS } from './utils/messageTypes';
import {
  findNearestHostileMicroorganismId,
  resolvePlayerPosition,
} from './utils/targeting';

const TOAST_DURATION = 5000;
// Limit the number of simultaneously displayed toasts to avoid overwhelming the UI.
const MAX_TOASTS = 5;

const createToastIdGenerator = () => {
  let fallbackCounter = 0;

  return () => {
    const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
      try {
        return cryptoApi.randomUUID();
      } catch (error) {
        // ignore and fallback to counter-based IDs
      }
    }

    fallbackCounter += 1;
    return `toast-${fallbackCounter}`;
  };
};

const generateToastId = createToastIdGenerator();

const App = () => {
  const [isAutoJoinRequested, setIsAutoJoinRequested] = useState(false);
  const { connect, disconnect, sendMovement, sendAttack, send } = useGameSocket({
    autoConnect: isAutoJoinRequested,
  });
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
          const commandOrientation = hasMovementCommand.orientation ?? {};
          const orientationState = player.orientation ?? {};
          const angleFromCommand = Number.isFinite(commandOrientation.angle)
            ? commandOrientation.angle
            : null;
          const orientation = {
            angle: angleFromCommand ?? (Number.isFinite(orientationState.angle) ? orientationState.angle : 0),
          };

          if (Number.isFinite(commandOrientation.tilt)) {
            orientation.tilt = commandOrientation.tilt;
          } else if (Number.isFinite(orientationState.tilt)) {
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
        const attackQueue = commands.attacks;

        if (typeof sendAttack === 'function' && playerId && player && isGamePhaseActive) {
          const combatStatus = player.combatStatus ?? {};

          const validatePlayerTarget = (candidate) => {
            if (typeof candidate !== 'string' || !candidate) {
              return null;
            }
            if (players?.[candidate]) {
              return candidate;
            }
            if (state?.remotePlayers?.byId?.[candidate]) {
              return candidate;
            }
            return null;
          };

          const collections = [
            state?.microorganisms?.byId,
            state?.organicMatter?.byId,
            state?.obstacles?.byId,
            state?.roomObjects?.byId,
          ];

          const validateObjectTarget = (candidate) => {
            if (typeof candidate !== 'string' || !candidate) {
              return null;
            }

            for (const collection of collections) {
              if (collection && collection[candidate]) {
                return candidate;
              }
            }

            return null;
          };

          attackQueue.forEach((attackCommand) => {
            if (!attackCommand || typeof attackCommand !== 'object') {
              return;
            }

            const normalizedKind =
              typeof attackCommand.kind === 'string' && attackCommand.kind
                ? attackCommand.kind
                : 'basic';
            const isTargetOptional = TARGET_OPTIONAL_ATTACK_KINDS.has(normalizedKind);

            const payload = {
              playerId,
              kind: normalizedKind,
            };

            const timestamp = Number.isFinite(attackCommand.timestamp)
              ? attackCommand.timestamp
              : Date.now();
            payload.clientTime = timestamp;

            const capturedPlayerTarget = validatePlayerTarget(attackCommand.targetPlayerId);
            const capturedObjectTarget = validateObjectTarget(attackCommand.targetObjectId);

            let targetPlayerId = capturedPlayerTarget;
            let targetObjectId = capturedObjectTarget;

            if (!targetPlayerId && !targetObjectId && !isTargetOptional) {
              targetPlayerId = validatePlayerTarget(combatStatus?.targetPlayerId);
              targetObjectId = validateObjectTarget(combatStatus?.targetObjectId);
            }

            if (!targetPlayerId && !targetObjectId && !isTargetOptional) {
              const playerPosition = resolvePlayerPosition({ sharedPlayer: player });
              const renderMicroorganisms = Array.isArray(state?.microorganisms?.all)
                ? state.microorganisms.all
                : undefined;
              const sharedMicroorganisms = Array.isArray(state?.world?.microorganisms)
                ? state.world.microorganisms
                : undefined;

              const nearestId =
                (renderMicroorganisms?.length ?? 0) > 0 || (sharedMicroorganisms?.length ?? 0) > 0
                  ? findNearestHostileMicroorganismId({
                      playerPosition,
                      renderMicroorganisms,
                      sharedMicroorganisms,
                    })
                  : null;

              if (nearestId) {
                payload.targetObjectId = nearestId;
                targetObjectId = nearestId;
              }
            }

            if (targetPlayerId) {
              payload.targetPlayerId = targetPlayerId;
            }
            if (targetObjectId) {
              payload.targetObjectId = targetObjectId;
            }

            if (!payload.targetPlayerId && !payload.targetObjectId && !isTargetOptional) {
              console.warn('Ignorando comando de ataque sem alvo válido', attackCommand);
              return;
            }

            if (Number.isFinite(attackCommand.damage)) {
              payload.damage = attackCommand.damage;
            }
            if (
              typeof attackCommand.state === 'string' &&
              attackCommand.state &&
              attackCommand.state !== 'idle'
            ) {
              payload.state = attackCommand.state;
            }
            if (
              attackCommand.resultingHealth &&
              typeof attackCommand.resultingHealth === 'object'
            ) {
              payload.resultingHealth = attackCommand.resultingHealth;
            }

            try {
              const sent = sendAttack(payload);
              if (!sent) {
                console.warn('Falha ao enviar comando de ataque', payload);
              }
            } catch (error) {
              console.error('Erro ao enviar comando de ataque', error);
            }
          });
        }

        attackQueue.length = 0;
      }
    },
    [sendMovement, sendAttack]
  );

  const handleEvolutionDelta = useCallback(
    (delta) => {
      const state = gameStore.getState();
      const playerId = state?.playerId;
      if (!playerId) {
        return;
      }

      const actionPayload = buildEvolutionPayload(delta);
      if (!actionPayload) {
        return;
      }

      send({
        type: 'action',
        playerId,
        action: actionPayload,
      });
    },
    [send]
  );

  const handleArchetypeSelect = useCallback(
    (archetypeKey, snapshot) => {
      const candidate =
        typeof archetypeKey === 'string' ? archetypeKey.trim() : '';
      const normalized = sanitizeArchetypeKey(candidate);
      if (!normalized) {
        return;
      }

      const state = gameStore.getState();
      const playerId = state?.playerId;
      if (!playerId) {
        return;
      }

      try {
        send({
          type: 'action',
          playerId,
          action: {
            type: 'archetype',
            archetype: normalized,
          },
        });
      } catch (error) {
        console.error('Erro ao enviar ação de arquétipo', error);
      }

      gameStore.setState((prev) => {
        const currentPlayer =
          prev.players[playerId] ?? prev.remotePlayers.byId[playerId];
        if (!currentPlayer) {
          return prev;
        }

        let changed = false;

        const nextHealth = { ...currentPlayer.health };
        const nextCombatAttributes = { ...currentPlayer.combatAttributes };

        if (snapshot && typeof snapshot === 'object') {
          const combatSnapshot =
            snapshot.combatAttributes && typeof snapshot.combatAttributes === 'object'
              ? snapshot.combatAttributes
              : null;

          const resolveNumber = (value) =>
            Number.isFinite(value) ? Number(value) : undefined;

          const nextHealthValue = resolveNumber(snapshot.health);
          const nextMaxHealthValue = resolveNumber(snapshot.maxHealth);

          if (
            nextHealthValue !== undefined &&
            nextHealthValue !== currentPlayer.health.current
          ) {
            nextHealth.current = nextHealthValue;
            changed = true;
          }
          if (
            nextMaxHealthValue !== undefined &&
            nextMaxHealthValue !== currentPlayer.health.max
          ) {
            nextHealth.max = nextMaxHealthValue;
            changed = true;
          }

          if (combatSnapshot) {
            const applyStat = (key) => {
              const value = resolveNumber(combatSnapshot[key]);
              if (value !== undefined && value !== nextCombatAttributes[key]) {
                nextCombatAttributes[key] = value;
                changed = true;
              }
            };

            applyStat('attack');
            applyStat('defense');
            applyStat('speed');
            applyStat('range');
          }
        }

        if (currentPlayer.archetype !== normalized) {
          changed = true;
        }
        if (currentPlayer.archetypeKey !== normalized) {
          changed = true;
        }

        if (!changed) {
          return prev;
        }

        const nextPlayer = {
          ...currentPlayer,
          combatAttributes: nextCombatAttributes,
          health: nextHealth,
          archetype: normalized,
          archetypeKey: normalized,
        };

        const nextPlayers = { ...prev.players, [playerId]: nextPlayer };

        let nextRemotePlayers = prev.remotePlayers;
        const remoteIndex = prev.remotePlayers.indexById.get(playerId);
        if (remoteIndex !== undefined) {
          const nextAll = prev.remotePlayers.all.slice();
          nextAll[remoteIndex] = nextPlayer;
          const nextById = { ...prev.remotePlayers.byId, [playerId]: nextPlayer };
          const nextIndexById = new Map(prev.remotePlayers.indexById);
          nextIndexById.set(playerId, remoteIndex);
          nextRemotePlayers = {
            byId: nextById,
            all: nextAll,
            indexById: nextIndexById,
          };
        } else if (prev.remotePlayers.byId[playerId]) {
          const nextById = { ...prev.remotePlayers.byId, [playerId]: nextPlayer };
          const nextAll = prev.remotePlayers.all.map((entry) =>
            entry.id === playerId ? nextPlayer : entry
          );
          const nextIndexById = new Map(prev.remotePlayers.indexById);
          const recalculatedIndex = nextAll.findIndex((entry) => entry?.id === playerId);
          if (recalculatedIndex >= 0) {
            nextIndexById.set(playerId, recalculatedIndex);
          } else {
            nextIndexById.delete(playerId);
          }
          nextRemotePlayers = {
            byId: nextById,
            all: nextAll,
            indexById: nextIndexById,
          };
        }

        return {
          ...prev,
          players: nextPlayers,
          remotePlayers: nextRemotePlayers,
        };
      });
    },
    [send]
  );

  const resolvedSettings = useMemo(
    () => ({
      ...(settings || {}),
      onCommandBatch: handleCommandBatch,
      onEvolutionDelta: handleEvolutionDelta,
      onArchetypeSelect: handleArchetypeSelect,
    }),
    [settings, handleCommandBatch, handleEvolutionDelta, handleArchetypeSelect]
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    if (typeof window !== 'undefined') {
      const timerId = timersRef.current.get(id);
      if (typeof timerId !== 'undefined' && timerId !== null) {
        window.clearTimeout(timerId);
        timersRef.current.delete(id);
      }
    }
  }, []);

  const enqueueToast = useCallback(
    (input) => {
      if (!input) {
        return;
      }

      let message = null;
      let variant = 'error';
      let providedId = null;

      if (typeof input === 'string') {
        const normalizedMessage = input.trim();
        if (normalizedMessage.length > 0) {
          message = normalizedMessage;
        }
      } else if (typeof input === 'object') {
        if (typeof input.message === 'string') {
          const normalizedMessage = input.message.trim();
          if (normalizedMessage.length > 0) {
            message = normalizedMessage;
          }
        }

        if (
          input.variant === 'error' ||
          input.variant === 'warning' ||
          input.variant === 'info' ||
          input.variant === 'success'
        ) {
          variant = input.variant;
        }

        if (typeof input.id === 'string' && input.id) {
          providedId = input.id;
        }
      }

      if (!message) {
        return;
      }

      const id = providedId ?? generateToastId();

      if (typeof window !== 'undefined') {
        const existingTimerId = timersRef.current.get(id);
        if (typeof existingTimerId !== 'undefined') {
          window.clearTimeout(existingTimerId);
          timersRef.current.delete(id);
        }
      } else {
        timersRef.current.delete(id);
      }

      const normalizedToast = { id, message, variant };
      setToasts((prev) => {
        const overflow = Math.max(prev.length + 1 - MAX_TOASTS, 0);
        if (overflow > 0) {
          const discarded = prev.slice(0, overflow);
          const hasWindow = typeof window !== 'undefined';
          discarded.forEach(({ id: discardedId }) => {
            const timerId = timersRef.current.get(discardedId);
            if (hasWindow && typeof timerId !== 'undefined') {
              window.clearTimeout(timerId);
            }
            timersRef.current.delete(discardedId);
          });
        }

        const retained = overflow > 0 ? prev.slice(overflow) : prev;
        const withoutDuplicate = retained.filter((toast) => toast.id !== id);
        return [...withoutDuplicate, normalizedToast];
      });

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

    enqueueToast({ message: joinError, variant: 'error' });
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
    ({ name, autoJoinRequested }) => {
      if (autoJoinRequested) {
        setIsAutoJoinRequested(true);
      }

      connect(name);
      setIsGameActive(true);
    },
    [connect, setIsAutoJoinRequested]
  );

  const handleQuit = useCallback(() => {
    setIsGameActive(false);
    setIsAutoJoinRequested(false);
    disconnect();
  }, [disconnect, setIsAutoJoinRequested]);

  useEffect(() => {
    if (connectionStatus === 'disconnected') {
      setIsGameActive(false);
    }
  }, [connectionStatus]);

  return (
    <>
      {isGameActive ? (
        <MicroOmegaGame
          settings={resolvedSettings}
          onQuit={handleQuit}
          onReconnect={connect}
        />
      ) : null}
      {!isGameActive ? (
        <StartScreen onStart={handleStart} onQuit={handleQuit} />
      ) : null}
      <ToastStack toasts={toasts} onDismiss={removeToast} />
    </>
  );
};

export default App;
