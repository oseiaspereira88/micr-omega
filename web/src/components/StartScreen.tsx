import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ConnectionStatus,
  gameStore,
  useGameStore,
} from "../store/gameStore";
import {
  GameSettings,
  useGameSettings,
} from "../store/gameSettings";
import {
  getValidationMessage,
  persistName,
  readStoredName,
  INVALID_PLAYER_NAME_MESSAGE,
} from "../utils/playerNameStorage";
import {
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
  sanitizePlayerName,
} from "../utils/messageTypes";
import styles from "./StartScreen.module.css";

type StartScreenProps = {
  onStart: (payload: { name: string; settings: GameSettings }) => void;
  onQuit: () => void;
  connectionStatus?: ConnectionStatus;
  joinError?: string | null;
};

const StartScreen = ({
  onStart,
  onQuit,
  connectionStatus: connectionStatusProp,
  joinError: joinErrorProp,
}: StartScreenProps) => {
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const joinError = useGameStore((state) => state.joinError);
  const storedName = useGameStore((state) => state.playerName);
  const playerId = useGameStore((state) => state.playerId);
  const effectiveStatus = connectionStatusProp ?? connectionStatus;
  const effectiveJoinError = joinErrorProp ?? joinError;

  const { settings, updateSettings } = useGameSettings();

  const [inputValue, setInputValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (storedName) {
      setInputValue(storedName);
      return;
    }

    const persisted = readStoredName();
    if (persisted) {
      setInputValue(persisted);
      gameStore.actions.setPlayerName(persisted);
    }
  }, [storedName]);

  const errorMessage = useMemo(
    () => localError ?? effectiveJoinError ?? null,
    [effectiveJoinError, localError]
  );

  const isConnecting =
    effectiveStatus === "connecting" || effectiveStatus === "reconnecting";

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = inputValue.trim();
      const validation = getValidationMessage(trimmed);

      if (validation) {
        setLocalError(validation);
        focusInput();
        return;
      }

      const sanitized = sanitizePlayerName(trimmed);
      if (!sanitized) {
        setLocalError(INVALID_PLAYER_NAME_MESSAGE);
        focusInput();
        return;
      }

      setLocalError(null);
      persistName(sanitized);

      if (storedName && storedName !== sanitized) {
        gameStore.actions.setPlayerId(null);
      }

      gameStore.actions.setPlayerName(sanitized);
      gameStore.actions.setJoinError(null);

      onStart({ name: sanitized, settings });
    },
    [focusInput, inputValue, onStart, settings, storedName]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setInputValue(event.target.value);
      if (localError) {
        setLocalError(null);
      }
      if (joinError) {
        gameStore.actions.setJoinError(null);
      }
    },
    [joinError, localError]
  );

  const handleQuit = useCallback(() => {
    onQuit();
    setInputValue("");
    setLocalError(null);
    gameStore.actions.setJoinError(null);
    gameStore.actions.setPlayerName(null);
    gameStore.actions.setPlayerId(null);
    gameStore.actions.setConnectionStatus("idle");
    gameStore.actions.setReconnectUntil(null);
    gameStore.actions.resetGameState();
  }, [onQuit]);

  const handleAudioToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateSettings({ audioEnabled: event.target.checked });
    },
    [updateSettings]
  );

  const handleDensityChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as GameSettings["visualDensity"];
      updateSettings({ visualDensity: value });
    },
    [updateSettings]
  );

  const handleTouchToggle = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateSettings({ showTouchControls: event.target.checked });
    },
    [updateSettings]
  );

  const isConnected = effectiveStatus === "connected" && Boolean(playerId);

  return (
    <div className={styles.root}>
      <div className={styles.panel} role="dialog" aria-modal="true">
        <header className={styles.header}>
          <h1 className={styles.title}>Micro Ωmega</h1>
          <p className={styles.subtitle}>
            Entre na simulação pública, customize sua experiência e desafie outros
            microrganismos em tempo real.
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="player-name">
              Nome do jogador
            </label>
            <input
              id="player-name"
              name="player-name"
              className={`${styles.input} ${errorMessage ? styles.inputError : ""}`.trim()}
              value={inputValue}
              onChange={handleInputChange}
              ref={inputRef}
              disabled={isConnecting}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="name"
              autoFocus
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? "player-name-error" : undefined}
            />
            {errorMessage ? (
              <p
                id="player-name-error"
                className={styles.errorMessage}
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}
          </div>

          <div className={`${styles.fieldGroup} ${styles.controls}`}>
            <span className={styles.label}>Preferências</span>
            <div className={styles.options}>
              <div className={styles.optionRow}>
                <div className={styles.optionContent}>
                  <span className={styles.optionTitle}>Áudio</span>
                  <span className={styles.optionDescription}>
                    Ative os efeitos sonoros durante a partida.
                  </span>
                </div>
                <label className={styles.toggleWrapper}>
                  <input
                    type="checkbox"
                    id="audio-enabled"
                    name="audio-enabled"
                    className={styles.toggle}
                    checked={settings.audioEnabled}
                    onChange={handleAudioToggle}
                    disabled={isConnecting}
                  />
                  Som ligado
                </label>
              </div>

              <div className={styles.optionRow}>
                <div className={styles.optionContent}>
                  <label
                    className={styles.optionTitle}
                    htmlFor="visual-density"
                  >
                    Densidade visual
                  </label>
                  <span className={styles.optionDescription}>
                    Ajuste a quantidade de partículas e elementos em cena.
                  </span>
                </div>
                <select
                  id="visual-density"
                  name="visual-density"
                  className={`${styles.select} ${styles.input}`.trim()}
                  value={settings.visualDensity}
                  onChange={handleDensityChange}
                  disabled={isConnecting}
                  aria-label="Densidade visual"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>

              <div className={styles.optionRow}>
                <div className={styles.optionContent}>
                  <span className={styles.optionTitle}>Controles touch</span>
                  <span className={styles.optionDescription}>
                    Exibir botões virtuais para dispositivos sensíveis ao toque.
                  </span>
                </div>
                <label className={styles.toggleWrapper}>
                  <input
                    type="checkbox"
                    id="show-touch-controls"
                    name="show-touch-controls"
                    className={styles.checkbox}
                    checked={settings.showTouchControls}
                    onChange={handleTouchToggle}
                    disabled={isConnecting}
                  />
                  Mostrar controles
                </label>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isConnecting}
            >
              {isConnected ? "Reconectar" : "Iniciar partida"}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleQuit}
            >
              Sair da sala
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StartScreen;
