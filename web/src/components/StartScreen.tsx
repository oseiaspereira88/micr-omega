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
  onStart: (
    payload: {
      name: string;
      settings: GameSettings;
      autoJoinRequested?: boolean;
    }
  ) => void;
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
  const {
    connectionStatus,
    joinError,
    storedName,
    playerId,
  } = useGameStore((state) => ({
    connectionStatus: state.connectionStatus,
    joinError: state.joinError,
    storedName: state.playerName,
    playerId: state.playerId,
  }));
  const effectiveStatus = connectionStatusProp ?? connectionStatus;
  const effectiveJoinError = joinErrorProp ?? joinError;

  const { settings, updateSettings } = useGameSettings();

  const [inputValue, setInputValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

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
    }
  }, [storedName]);

  useEffect(() => {
    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    focusInput();

    return () => {
      const target = previouslyFocusedElementRef.current;
      if (target && typeof target.focus === "function") {
        target.focus({ preventScroll: true });
      } else if (closeButtonRef.current) {
        closeButtonRef.current.blur();
      }
      previouslyFocusedElementRef.current = null;
    };
  }, [closeButtonRef, focusInput]);

  const getFocusableElements = useCallback(() => {
    const container = panelRef.current;
    if (!container) {
      return [] as HTMLElement[];
    }

    const focusableSelectors = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    return Array.from(
      container.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter((element) => {
      if (element.getAttribute("aria-hidden") === "true") {
        return false;
      }
      if (element.tabIndex < 0) {
        return false;
      }
      const elementWithDisabled = element as HTMLElement & { disabled?: boolean };
      if (elementWithDisabled.disabled) {
        return false;
      }

      return true;
    });
  }, [panelRef]);

  const focusFirstFocusable = useCallback(() => {
    if (inputRef.current && !inputRef.current.disabled) {
      focusInput();
      return;
    }

    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus({ preventScroll: true });
    }
  }, [focusInput, getFocusableElements]);

  const focusLastFocusable = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[focusableElements.length - 1].focus({
        preventScroll: true,
      });
    }
  }, [getFocusableElements]);

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

      onStart({ name: sanitized, settings, autoJoinRequested: true });
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
    const target = previouslyFocusedElementRef.current;
    if (target && typeof target.focus === "function") {
      target.focus({ preventScroll: true });
    }
    closeButtonRef.current?.blur();
    previouslyFocusedElementRef.current = null;

    onQuit();
    setInputValue("");
    setLocalError(null);
    gameStore.actions.setJoinError(null);
    gameStore.actions.setPlayerName(null);
    gameStore.actions.setPlayerId(null);
    gameStore.actions.setConnectionStatus("idle");
    gameStore.actions.setReconnectUntil(null);
    gameStore.actions.resetGameState();
  }, [closeButtonRef, onQuit]);

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

  const dialogTitleId = "start-screen-title";
  const dialogDescriptionId = "start-screen-description";
  const audioToggleId = "audio-enabled";
  const touchToggleId = "show-touch-controls";

  const startButtonLabel = isConnecting
    ? "Conectando…"
    : isConnected
    ? "Reconectar"
    : "Entrar na partida";

  const handleFocusTrapStart = useCallback(() => {
    focusLastFocusable();
  }, [focusLastFocusable]);

  const handleFocusTrapEnd = useCallback(() => {
    focusFirstFocusable();
  }, [focusFirstFocusable]);

  return (
    <div className={styles.root}>
      <span
        tabIndex={0}
        className={styles.focusSentinel}
        onFocus={handleFocusTrapStart}
        aria-hidden="true"
      />
      <div
        className={styles.panel}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={handleQuit}
          ref={closeButtonRef}
          aria-label="Fechar"
        >
          ×
        </button>
        <header className={styles.header}>
          <h1 id={dialogTitleId} className={styles.title}>
            Micro Ωmega
          </h1>
          <p id={dialogDescriptionId} className={styles.subtitle}>
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
                <label className={styles.toggleWrapper} htmlFor={audioToggleId}>
                  <input
                    type="checkbox"
                    id={audioToggleId}
                    name="audio-enabled"
                    className={styles.toggle}
                    checked={settings.audioEnabled}
                    onChange={handleAudioToggle}
                    disabled={isConnecting}
                    aria-checked={settings.audioEnabled}
                  />
                  <span className={styles.toggleLabelText}>
                    Som
                    {' '}
                    <span className={styles.toggleStatus} aria-live="polite" aria-atomic="true">
                      {settings.audioEnabled ? 'ligado' : 'desligado'}
                    </span>
                  </span>
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
                <label className={styles.toggleWrapper} htmlFor={touchToggleId}>
                  <input
                    type="checkbox"
                    id={touchToggleId}
                    name="show-touch-controls"
                    className={styles.checkbox}
                    checked={settings.showTouchControls}
                    onChange={handleTouchToggle}
                    disabled={isConnecting}
                    aria-checked={settings.showTouchControls}
                  />
                  <span className={styles.toggleLabelText}>
                    Mostrar controles
                    {' '}
                    <span className={styles.toggleStatus} aria-live="polite" aria-atomic="true">
                      {settings.showTouchControls ? 'ativos' : 'ocultos'}
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isConnecting}
              aria-busy={isConnecting}
            >
              {startButtonLabel}
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
      <span
        tabIndex={0}
        className={styles.focusSentinel}
        onFocus={handleFocusTrapEnd}
        aria-hidden="true"
      />
    </div>
  );
};

export default StartScreen;
