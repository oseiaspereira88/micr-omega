import React, { useCallback, useEffect, useRef, useState } from 'react';
import MicroOmegaGame from './MicroOmegaGame.jsx';
import StartScreen from './components/StartScreen';
import ToastStack from './components/ToastStack';
import { useGameSocket } from './hooks/useGameSocket';
import { useGameStore } from './store/gameStore';
import { useGameSettings } from './store/gameSettings';

const TOAST_DURATION = 5000;

const App = () => {
  const { connect, disconnect } = useGameSocket();
  const joinError = useGameStore((state) => state.joinError);
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const { settings } = useGameSettings();
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const [isGameActive, setIsGameActive] = useState(false);

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
      {isGameActive ? <MicroOmegaGame settings={settings} /> : null}
      {!isGameActive ? (
        <StartScreen onStart={handleStart} onQuit={handleQuit} />
      ) : null}
      <ToastStack toasts={toasts} onDismiss={removeToast} />
    </>
  );
};

export default App;
