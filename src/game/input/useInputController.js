import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_JOYSTICK_STATE,
  computeJoystickFromKeys,
  updateJoystickPosition
} from './utils';

const preventDefaultForGame = (event) => {
  const targetTag = event.target?.tagName?.toLowerCase();
  if (targetTag && ['input', 'textarea', 'select'].includes(targetTag)) return false;

  event.preventDefault();
  return true;
};

const useInputController = ({
  onMovementIntent,
  onAttack,
  onDash,
  onUseSkill,
  onCycleSkill,
  onOpenEvolutionMenu,
  onActionButtonChange
}) => {
  const keyboardStateRef = useRef({ up: false, down: false, left: false, right: false });
  const [touchActive, setTouchActive] = useState(false);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const [movementIntent, setMovementIntent] = useState({ ...DEFAULT_JOYSTICK_STATE });

  const emitMovementIntent = useCallback(
    (intent) => {
      const nextIntent = { ...intent };
      setMovementIntent(nextIntent);
      onMovementIntent?.(nextIntent);
    },
    [onMovementIntent]
  );

  const handleKeyboardIntent = useCallback(() => {
    const intent = computeJoystickFromKeys(keyboardStateRef.current);
    emitMovementIntent(intent);
  }, [emitMovementIntent]);

  const handleKeyDown = useCallback(
    (event) => {
      const key = event.key;
      const lower = key.toLowerCase();
      let movementUpdated = false;

      if (key === 'ArrowUp' || lower === 'w') {
        if (!keyboardStateRef.current.up) movementUpdated = true;
        keyboardStateRef.current.up = true;
      } else if (key === 'ArrowDown' || lower === 's') {
        if (!keyboardStateRef.current.down) movementUpdated = true;
        keyboardStateRef.current.down = true;
      } else if (key === 'ArrowLeft' || lower === 'a') {
        if (!keyboardStateRef.current.left) movementUpdated = true;
        keyboardStateRef.current.left = true;
      } else if (key === 'ArrowRight' || lower === 'd') {
        if (!keyboardStateRef.current.right) movementUpdated = true;
        keyboardStateRef.current.right = true;
      }

      if (movementUpdated) {
        if (preventDefaultForGame(event)) {
          handleKeyboardIntent();
        }
        return;
      }

      switch (true) {
        case key === ' ' || key === 'Spacebar':
          if (preventDefaultForGame(event)) onAttack?.();
          break;
        case key === 'Shift':
          if (preventDefaultForGame(event)) onDash?.();
          break;
        case lower === 'q':
          if (preventDefaultForGame(event)) onUseSkill?.();
          break;
        case lower === 'r' || key === 'Tab':
          if (preventDefaultForGame(event)) onCycleSkill?.(1);
          break;
        case lower === 'e':
          if (preventDefaultForGame(event)) onOpenEvolutionMenu?.();
          break;
        default:
          break;
      }
    },
    [handleKeyboardIntent, onAttack, onDash, onUseSkill, onCycleSkill, onOpenEvolutionMenu]
  );

  const handleKeyUp = useCallback(
    (event) => {
      const key = event.key;
      const lower = key.toLowerCase();
      let movementUpdated = false;

      if (key === 'ArrowUp' || lower === 'w') {
        if (keyboardStateRef.current.up) movementUpdated = true;
        keyboardStateRef.current.up = false;
      } else if (key === 'ArrowDown' || lower === 's') {
        if (keyboardStateRef.current.down) movementUpdated = true;
        keyboardStateRef.current.down = false;
      } else if (key === 'ArrowLeft' || lower === 'a') {
        if (keyboardStateRef.current.left) movementUpdated = true;
        keyboardStateRef.current.left = false;
      } else if (key === 'ArrowRight' || lower === 'd') {
        if (keyboardStateRef.current.right) movementUpdated = true;
        keyboardStateRef.current.right = false;
      }

      if (movementUpdated) {
        if (preventDefaultForGame(event)) {
          handleKeyboardIntent();
        }
      }
    },
    [handleKeyboardIntent]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const handleJoystickStart = useCallback(
    (event) => {
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      setTouchActive(true);
      const { position, joystick } = updateJoystickPosition(
        touch.clientX,
        touch.clientY,
        centerX,
        centerY
      );

      setJoystickPosition(position);
      emitMovementIntent(joystick);
    },
    [emitMovementIntent]
  );

  const handleJoystickMove = useCallback(
    (event) => {
      if (!touchActive) return;
      event.preventDefault();
      const touch = event.touches[0];
      if (!touch) return;

      const rect = event.currentTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const { position, joystick } = updateJoystickPosition(
        touch.clientX,
        touch.clientY,
        centerX,
        centerY
      );

      setJoystickPosition(position);
      emitMovementIntent(joystick);
    },
    [emitMovementIntent, touchActive]
  );

  const handleJoystickEnd = useCallback(() => {
    setTouchActive(false);
    setJoystickPosition({ x: 0, y: 0 });
    const intent = computeJoystickFromKeys(keyboardStateRef.current);
    emitMovementIntent(intent);
  }, [emitMovementIntent]);

  const handleAttackPress = useCallback(() => {
    onActionButtonChange?.(true);
    onAttack?.();
  }, [onActionButtonChange, onAttack]);

  const handleAttackRelease = useCallback(() => {
    onActionButtonChange?.(false);
  }, [onActionButtonChange]);

  const reset = useCallback(
    (state) => {
      keyboardStateRef.current = { up: false, down: false, left: false, right: false };
      setTouchActive(false);
      setJoystickPosition({ x: 0, y: 0 });
      const intent = { ...DEFAULT_JOYSTICK_STATE };
      emitMovementIntent(intent);
      if (state?.joystick) {
        state.joystick = { ...intent };
      }
      onActionButtonChange?.(false);
    },
    [emitMovementIntent, onActionButtonChange]
  );

  const joystick = useMemo(
    () => ({
      ...movementIntent,
      position: joystickPosition,
      isTouchActive: touchActive
    }),
    [movementIntent, joystickPosition, touchActive]
  );

  const actions = useMemo(
    () => ({
      attack: () => onAttack?.(),
      dash: () => onDash?.(),
      useSkill: () => onUseSkill?.(),
      cycleSkill: (direction = 1) => onCycleSkill?.(direction),
      openEvolutionMenu: () => onOpenEvolutionMenu?.(),
      attackPress: handleAttackPress,
      attackRelease: handleAttackRelease,
      joystickStart: handleJoystickStart,
      joystickMove: handleJoystickMove,
      joystickEnd: handleJoystickEnd,
      resetControls: reset
    }),
    [
      handleAttackPress,
      handleAttackRelease,
      handleJoystickEnd,
      handleJoystickMove,
      handleJoystickStart,
      onAttack,
      onDash,
      onUseSkill,
      onCycleSkill,
      onOpenEvolutionMenu,
      reset
    ]
  );

  return { joystick, actions };
};

export default useInputController;
