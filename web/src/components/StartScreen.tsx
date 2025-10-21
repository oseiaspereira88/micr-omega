import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ConnectionStatus,
  gameStore,
  shallowEqual,
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
  NAME_PATTERN,
  sanitizePlayerName,
} from "../utils/messageTypes";
import styles from "./StartScreen.module.css";
import StartScreenPreview from "./StartScreenPreview";
import ControlsGuide from "../ui/components/ControlsGuide";
import TouchLayoutPreview from "../ui/components/TouchLayoutPreview";

export const START_SCREEN_MOBILE_MEDIA_QUERY = "(max-width: 640px)";

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
  const { connectionStatus, joinError, storedName, playerId } = useGameStore(
    (state) => ({
      connectionStatus: state.connectionStatus,
      joinError: state.joinError,
      storedName: state.playerName,
      playerId: state.playerId,
    }),
    shallowEqual,
  );
  const effectiveStatus = connectionStatusProp ?? connectionStatus;
  const effectiveJoinError = joinErrorProp ?? joinError;

  const { settings, updateSettings } = useGameSettings();

  const [layout, setLayout] = useState<"desktop" | "mobile">(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return "desktop";
    }

    return window.matchMedia(START_SCREEN_MOBILE_MEDIA_QUERY).matches
      ? "mobile"
      : "desktop";
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia(START_SCREEN_MOBILE_MEDIA_QUERY);
    const updateLayout = (matches: boolean) => {
      setLayout(matches ? "mobile" : "desktop");
    };

    updateLayout(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      updateLayout(event.matches);
    };

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);
      return () => mediaQueryList.removeEventListener("change", handleChange);
    }

    if (typeof mediaQueryList.addListener === "function") {
      mediaQueryList.addListener(handleChange);
      return () => mediaQueryList.removeListener(handleChange);
    }

    return undefined;
  }, []);

  const isMobileLayout = layout === "mobile";

  const [inputValue, setInputValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [isControlsGuideOpen, setControlsGuideOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const controlsGuideTriggerRef = useRef<HTMLButtonElement | null>(null);
  const controlsGuideDialogRef = useRef<HTMLDivElement | null>(null);
  const shouldRestoreGuideFocusRef = useRef(false);

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

    const dialogNode = panelRef.current;
    if (dialogNode && typeof dialogNode.focus === "function") {
      dialogNode.focus({ preventScroll: true });
    } else {
      focusInput();
    }

    return () => {
      const target = previouslyFocusedElementRef.current;
      if (target && typeof target.focus === "function") {
        target.focus({ preventScroll: true });
      }
      previouslyFocusedElementRef.current = null;
    };
  }, [focusInput]);

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

  const handleTouchLayoutChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as GameSettings["touchLayout"];
      updateSettings({ touchLayout: value });
    },
    [updateSettings]
  );

  const handleTouchAutoSwapChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      updateSettings({
        autoSwapTouchLayoutWhenSidebarOpen: event.target.checked,
      });
    },
    [updateSettings]
  );

  const isConnected = effectiveStatus === "connected" && Boolean(playerId);
  const canQuit =
    isConnected ||
    effectiveStatus === "connecting" ||
    effectiveStatus === "reconnecting";

  const dialogTitleId = "start-screen-title";
  const dialogDescriptionId = "start-screen-description";
  const playerNameHelperId = "player-name-helper";
  const playerNameErrorId = "player-name-error";
  const playerNameDescribedBy = errorMessage
    ? `${playerNameHelperId} ${playerNameErrorId}`
    : playerNameHelperId;
  const audioToggleId = "audio-enabled";
  const touchToggleId = "show-touch-controls";
  const touchLayoutSelectId = "touch-layout";
  const touchLayoutDescriptionId = "touch-layout-description";
  const touchLayoutHelperId = "touch-layout-helper";
  const touchLayoutAutoSwapToggleId = "touch-layout-auto-swap";
  const touchLayoutAutoSwapDescriptionId = "touch-layout-auto-swap-description";
  const touchLayoutAutoSwapHelperId = "touch-layout-auto-swap-helper";
  const controlsGuideDialogId = "controls-guide-dialog";
  const controlsGuideTitleId = "controls-guide-title";
  const controlsGuideDescriptionId = "controls-guide-description";

  const isTouchLayoutDisabled =
    isConnecting || !settings.showTouchControls;
  const touchLayoutDescribedBy = settings.showTouchControls
    ? touchLayoutDescriptionId
    : `${touchLayoutDescriptionId} ${touchLayoutHelperId}`;
  const touchLayoutAutoSwapDescribedBy = settings.showTouchControls
    ? touchLayoutAutoSwapDescriptionId
    : `${touchLayoutAutoSwapDescriptionId} ${touchLayoutAutoSwapHelperId}`;

  const audioLabel = settings.audioEnabled ? "Som ligado" : "Som desligado";

  const startButtonLabel = isConnecting
    ? "Conectando…"
    : isConnected
    ? "Reconectar"
    : "Entrar na partida";

  const quitButtonLabel = isConnected
    ? "Desconectar"
    : isConnecting
    ? "Cancelar tentativa"
    : "Desconectar";

  const getControlsGuideFocusableElements = useCallback(() => {
    const container = controlsGuideDialogRef.current;
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
      container.querySelectorAll<HTMLElement>(focusableSelectors),
    ).filter((element) => {
      if (element.getAttribute("aria-hidden") === "true") {
        return false;
      }

      const elementWithDisabled = element as HTMLElement & { disabled?: boolean };
      if (elementWithDisabled.disabled) {
        return false;
      }

      return true;
    });
  }, []);

  const closeControlsGuide = useCallback(() => {
    setControlsGuideOpen(false);
    shouldRestoreGuideFocusRef.current = true;
  }, []);

  const handleControlsGuideKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeControlsGuide();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getControlsGuideFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      if (event.shiftKey) {
        if (!activeElement || activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus({ preventScroll: true });
        }
        return;
      }

      if (!activeElement || activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus({ preventScroll: true });
      }
    },
    [closeControlsGuide, getControlsGuideFocusableElements],
  );

  const handleControlsGuideBackdropClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        closeControlsGuide();
      }
    },
    [closeControlsGuide],
  );

  useEffect(() => {
    if (isControlsGuideOpen) {
      const focusableElements = getControlsGuideFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus({ preventScroll: true });
        return;
      }

      controlsGuideDialogRef.current?.focus({ preventScroll: true });
      return;
    }

    if (shouldRestoreGuideFocusRef.current) {
      shouldRestoreGuideFocusRef.current = false;
      controlsGuideTriggerRef.current?.focus({ preventScroll: true });
    }
  }, [getControlsGuideFocusableElements, isControlsGuideOpen]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const preferredFirstElement =
        inputRef.current && !inputRef.current.disabled
          ? inputRef.current
          : undefined;
      const firstElement = preferredFirstElement ?? focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const dialogNode = panelRef.current;
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      const isActiveInside = Boolean(
        activeElement && panelRef.current?.contains(activeElement)
      );

      if (dialogNode && activeElement === dialogNode) {
        event.preventDefault();
        if (event.shiftKey) {
          focusLastFocusable();
        } else {
          focusFirstFocusable();
        }
        return;
      }

      if (event.shiftKey) {
        if (
          !isActiveInside ||
          (firstElement && activeElement === firstElement) ||
          activeElement === dialogNode
        ) {
          event.preventDefault();
          focusLastFocusable();
        }
        return;
      }

      if (!isActiveInside || (lastElement && activeElement === lastElement)) {
        event.preventDefault();
        focusFirstFocusable();
      }
    },
    [focusFirstFocusable, focusLastFocusable, getFocusableElements]
  );

  const rootClassName = [
    styles.root,
    isMobileLayout ? styles.mobileRoot : "",
  ]
    .filter(Boolean)
    .join(" ");
  const panelClassName = [
    styles.panel,
    isMobileLayout ? styles.mobilePanel : "",
  ]
    .filter(Boolean)
    .join(" ");
  const formBodyClassName = [
    styles.formBody,
    isMobileLayout ? styles.mobileFormBody : "",
  ]
    .filter(Boolean)
    .join(" ");
  const actionsClassName = [
    styles.actions,
    isMobileLayout ? styles.mobileActions : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      <div
        className={panelClassName}
        ref={panelRef}
        role="dialog"
        aria-modal={isControlsGuideOpen ? undefined : true}
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        aria-hidden={isControlsGuideOpen ? "true" : undefined}
      >
        <StartScreenPreview isMobile={isMobileLayout} />

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
          <div className={formBodyClassName}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="player-name">
                Nome do jogador
              </label>
              <p id={playerNameHelperId} className={styles.helperText}>
                {`Use entre ${MIN_NAME_LENGTH} e ${MAX_NAME_LENGTH} caracteres válidos:`}
              {" "}
              letras (incluindo acentos), números, espaços, hífens ou sublinhados.
            </p>
            <input
              id="player-name"
              name="player-name"
              className={`${styles.input} ${errorMessage ? styles.inputError : ""}`.trim()}
              value={inputValue}
              onChange={handleInputChange}
              ref={inputRef}
              disabled={isConnecting}
              required
              minLength={MIN_NAME_LENGTH}
              maxLength={MAX_NAME_LENGTH}
              pattern={NAME_PATTERN.source}
              autoComplete="name"
              aria-invalid={Boolean(errorMessage)}
              aria-required="true"
              aria-describedby={playerNameDescribedBy}
            />
            {errorMessage ? (
              <p
                id={playerNameErrorId}
                className={styles.errorMessage}
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}
            </div>

            <div className={`${styles.fieldGroup} ${styles.controls}`}>
              <span className={styles.label}>Preferências</span>
              <div className={styles.preferenceGroups}>
                <details
                  className={styles.preferenceAccordion}
                  {...(isMobileLayout ? {} : { open: true })}
                >
                  <summary className={styles.preferenceSummary}>
                    <span className={styles.preferenceSummaryTitle}>Áudio</span>
                    <span className={styles.preferenceSummaryDescription}>
                      Gerencie o feedback sonoro da sessão.
                    </span>
                  </summary>
                  <div className={styles.preferenceContent}>
                    <div className={styles.optionRow}>
                      <div className={styles.optionContent}>
                        <span className={styles.optionTitle}>Efeitos sonoros</span>
                        <span className={styles.optionDescription}>
                          Ative os efeitos sonoros durante a partida.
                        </span>
                      </div>
                      <label
                        className={styles.toggleWrapper}
                        htmlFor={audioToggleId}
                      >
                        <input
                          type="checkbox"
                          id={audioToggleId}
                          name="audio-enabled"
                          className={styles.toggle}
                          checked={settings.audioEnabled}
                          onChange={handleAudioToggle}
                          disabled={isConnecting}
                          aria-checked={settings.audioEnabled}
                          aria-label={audioLabel}
                        />
                        <span className={styles.toggleLabelText}>
                          <span className={styles.toggleStatus} aria-live="polite" aria-atomic="true">
                            {audioLabel}
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </details>

                <details
                  className={styles.preferenceAccordion}
                  {...(isMobileLayout ? {} : { open: true })}
                >
                  <summary className={styles.preferenceSummary}>
                    <span className={styles.preferenceSummaryTitle}>Interface</span>
                    <span className={styles.preferenceSummaryDescription}>
                      Ajuste a densidade de elementos exibidos.
                    </span>
                  </summary>
                  <div className={styles.preferenceContent}>
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
                  </div>
                </details>

                <details
                  className={styles.preferenceAccordion}
                  {...(isMobileLayout ? {} : { open: true })}
                >
                  <summary className={styles.preferenceSummary}>
                    <span className={styles.preferenceSummaryTitle}>Controles touch</span>
                    <span className={styles.preferenceSummaryDescription}>
                      Configure atalhos e layouts para telas sensíveis ao toque.
                    </span>
                  </summary>
                  <div className={styles.preferenceContent}>
                    <div className={styles.optionRow}>
                      <div className={styles.optionContent}>
                        <span className={styles.optionTitle}>Exibir controles</span>
                        <span className={styles.optionDescription}>
                          Ative os botões virtuais durante a partida.
                        </span>
                      </div>
                      <label
                        className={styles.toggleWrapper}
                        htmlFor={touchToggleId}
                      >
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
                          {" "}
                          <span className={styles.toggleStatus} aria-live="polite" aria-atomic="true">
                            {settings.showTouchControls ? "ativos" : "ocultos"}
                          </span>
                        </span>
                      </label>
                    </div>

                    <div className={styles.optionRow}>
                      <div className={styles.optionContent}>
                        <label
                          className={styles.optionTitle}
                          htmlFor={touchLayoutSelectId}
                        >
                          Layout dos controles touch
                        </label>
                        <span
                          className={styles.optionDescription}
                          id={touchLayoutDescriptionId}
                        >
                          Escolha o lado onde os botões de ação ficam posicionados.
                        </span>
                        {!settings.showTouchControls ? (
                          <span
                            className={styles.optionDescription}
                            id={touchLayoutHelperId}
                          >
                            Ative os controles touch para escolher o layout.
                          </span>
                        ) : null}
                      </div>
                      <div className={styles.touchLayoutControlGroup}>
                        <select
                          id={touchLayoutSelectId}
                          name="touch-layout"
                          className={`${styles.select} ${styles.input}`.trim()}
                          value={settings.touchLayout}
                          onChange={handleTouchLayoutChange}
                          disabled={isTouchLayoutDisabled}
                          aria-label="Layout dos controles touch"
                          aria-disabled={isTouchLayoutDisabled}
                          aria-describedby={touchLayoutDescribedBy}
                        >
                          <option value="right">Botões à direita</option>
                          <option value="left">Botões à esquerda</option>
                        </select>
                        <TouchLayoutPreview
                          layout={settings.touchLayout}
                          disabled={isTouchLayoutDisabled}
                          className={styles.touchLayoutPreview}
                          data-testid="start-touch-layout-preview"
                        />
                      </div>
                    </div>

                    <div className={styles.optionRow}>
                      <div className={styles.optionContent}>
                        <span className={styles.optionTitle}>Ajustar ao painel lateral</span>
                        <span
                          className={styles.optionDescription}
                          id={touchLayoutAutoSwapDescriptionId}
                        >
                          Inverta o lado dos botões automaticamente quando o painel lateral estiver
                          aberto.
                        </span>
                        {!settings.showTouchControls ? (
                          <span
                            className={styles.optionDescription}
                            id={touchLayoutAutoSwapHelperId}
                          >
                            Ative os controles touch para configurar este ajuste.
                          </span>
                        ) : null}
                      </div>
                      <label
                        className={styles.toggleWrapper}
                        htmlFor={touchLayoutAutoSwapToggleId}
                      >
                        <input
                          type="checkbox"
                          id={touchLayoutAutoSwapToggleId}
                          name="touch-layout-auto-swap"
                          className={styles.checkbox}
                          checked={settings.autoSwapTouchLayoutWhenSidebarOpen}
                          onChange={handleTouchAutoSwapChange}
                          disabled={isTouchLayoutDisabled}
                          aria-checked={settings.autoSwapTouchLayoutWhenSidebarOpen}
                          aria-disabled={isTouchLayoutDisabled}
                          aria-describedby={touchLayoutAutoSwapDescribedBy}
                        />
                        <span className={styles.toggleLabelText}>
                          Ajuste automático
                          {" "}
                          <span className={styles.toggleStatus} aria-live="polite" aria-atomic="true">
                            {settings.autoSwapTouchLayoutWhenSidebarOpen ? "ativado" : "desativado"}
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>

          <div className={actionsClassName}>
            <button
              type="button"
              className={styles.guideButton}
              onClick={() => {
                setControlsGuideOpen(true);
              }}
              aria-expanded={isControlsGuideOpen}
              aria-controls={controlsGuideDialogId}
              ref={controlsGuideTriggerRef}
            >
              Como jogar
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={isConnecting}
              aria-busy={isConnecting}
            >
              {startButtonLabel}
            </button>
            {canQuit ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleQuit}
              >
                {quitButtonLabel}
              </button>
            ) : null}
          </div>
        </form>
      </div>
      {isControlsGuideOpen ? (
        <div
          className={styles.controlsGuideBackdrop}
          role="presentation"
          onMouseDown={handleControlsGuideBackdropClick}
        >
          <div
            id={controlsGuideDialogId}
            className={styles.controlsGuideDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={controlsGuideTitleId}
            aria-describedby={controlsGuideDescriptionId}
            ref={controlsGuideDialogRef}
            tabIndex={-1}
            onKeyDown={handleControlsGuideKeyDown}
          >
            <ControlsGuide
              className={styles.controlsGuideContent}
              title="Como jogar"
              titleId={controlsGuideTitleId}
              descriptionId={controlsGuideDescriptionId}
              actions={
                <button
                  type="button"
                  className={styles.controlsGuideCloseButton}
                  onClick={closeControlsGuide}
                >
                  Fechar
                </button>
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default StartScreen;
