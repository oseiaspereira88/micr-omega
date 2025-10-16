import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MicroOmegaGame from './MicroOmegaGame.jsx';
import StartScreen from './components/StartScreen';
import ToastStack from './components/ToastStack';
import { useGameSocket } from './hooks/useGameSocket';
import { gameStore, useGameStore } from './store/gameStore';
import { useGameSettings } from './store/gameSettings';
import { sanitizeArchetypeKey, TARGET_OPTIONAL_ATTACK_KINDS } from './utils/messageTypes';
import {
  findNearestHostileMicroorganismId,
  resolvePlayerPosition,
} from './utils/targeting';

const TOAST_DURATION = 5000;

const App = () => {
  const { connect, disconnect, sendMovement, sendAttack, send } = useGameSocket();
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

          const validateObjectTarget = (candidate) => {
            if (typeof candidate !== 'string' || !candidate) {
              return null;
            }

            const collections = [
              state?.microorganisms?.byId,
              state?.organicMatter?.byId,
              state?.obstacles?.byId,
              state?.roomObjects?.byId,
            ];

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
              const sharedMicroorganisms = [
                ...(Array.isArray(state?.world?.microorganisms)
                  ? state.world.microorganisms
                  : []),
                ...(Array.isArray(state?.microorganisms?.all)
                  ? state.microorganisms.all
                  : []),
              ];

              const nearestId = findNearestHostileMicroorganismId({
                playerPosition,
                sharedMicroorganisms:
                  sharedMicroorganisms.length > 0 ? sharedMicroorganisms : undefined,
              });

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
            if (typeof attackCommand.state === 'string' && attackCommand.state) {
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
      if (!delta || typeof delta !== 'object') {
        return;
      }

      const { evolutionId } = delta;
      if (typeof evolutionId !== 'string' || !evolutionId.trim()) {
        return;
      }

      const state = gameStore.getState();
      const playerId = state?.playerId;
      if (!playerId) {
        return;
      }

      const actionPayload = {
        type: 'evolution',
        evolutionId: evolutionId.trim(),
      };

      if (typeof delta.tier === 'string' && delta.tier) {
        actionPayload.tier = delta.tier;
      }

      if (Number.isFinite(delta.countDelta) && delta.countDelta !== 0) {
        actionPayload.countDelta = Math.trunc(delta.countDelta);
      }

      if (Array.isArray(delta.traitDeltas) && delta.traitDeltas.length > 0) {
        const traits = Array.from(
          new Set(
            delta.traitDeltas
              .map((trait) => (typeof trait === 'string' ? trait.trim() : ''))
              .filter((trait) => trait.length > 0),
          ),
        );
        if (traits.length > 0) {
          actionPayload.traitDeltas = traits;
        }
      }

      const prepareAdjustments = (adjustments) => {
        if (!adjustments || typeof adjustments !== 'object') return undefined;
        const entries = Object.entries(adjustments).filter(([, value]) => Number.isFinite(value) && value !== 0);
        if (entries.length === 0) return undefined;
        return entries.reduce((acc, [key, value]) => {
          acc[key] = Number(value);
          return acc;
        }, {});
      };

      const additiveDelta = prepareAdjustments(delta.additiveDelta);
      if (additiveDelta) {
        actionPayload.additiveDelta = additiveDelta;
      }

      const multiplierDelta = prepareAdjustments(delta.multiplierDelta);
      if (multiplierDelta) {
        actionPayload.multiplierDelta = multiplierDelta;
      }

      const baseDelta = prepareAdjustments(delta.baseDelta);
      if (baseDelta) {
        actionPayload.baseDelta = baseDelta;
      }

      const hasAdjustments =
        Boolean(actionPayload.countDelta) ||
        Boolean(actionPayload.traitDeltas?.length) ||
        Boolean(additiveDelta) ||
        Boolean(multiplierDelta) ||
        Boolean(baseDelta);

      if (!hasAdjustments) {
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
