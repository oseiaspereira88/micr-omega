import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import HudBar from './HudBar';
import BossHealthBar from './BossHealthBar';
import SkillWheel from './SkillWheel';
import Notifications from './Notifications';
import TouchControls from './TouchControls';
import CameraControls from './CameraControls';
import styles from './GameHud.module.css';
import RankingPanel from '../../components/RankingPanel';
import ConnectionStatusOverlay from '../../components/ConnectionStatusOverlay';
import useIsTouchDevice from '../../hooks/useIsTouchDevice';
import { shallowEqual, useGameStore } from '../../store/gameStore';
import { useGameSettings } from '../../store/gameSettings';

const MOBILE_HUD_QUERY = '(max-width: 900px)';
const SIDEBAR_TRANSITION_DURATION_MS = 350;

const COMBAT_STATE_LABELS = {
  idle: 'Ocioso',
  engaged: 'Em combate',
  cooldown: 'Em recuperação',
};

const GameHud = ({
  level,
  score,
  energy,
  health,
  maxHealth,
  dashCharge,
  combo,
  maxCombo,
  activePowerUps,
  xp,
  geneticMaterial,
  characteristicPoints,
  geneFragments,
  stableGenes,
  evolutionSlots,
  reroll,
  dropPity,
  recentRewards,
  bossActive,
  bossHealth,
  bossMaxHealth,
  bossName,
  element,
  affinity,
  elementLabel,
  affinityLabel,
  resistances,
  statusEffects = [],
  skillData,
  notifications,
  joystick,
  onJoystickStart,
  onJoystickMove,
  onJoystickEnd,
  onAttackPress,
  onAttackRelease,
  onAttack,
  onDash,
  onUseSkill,
  onCycleSkill,
  onOpenEvolutionMenu,
  canEvolve,
  showTouchControls = false,
  cameraZoom = 1,
  onCameraZoomChange,
  onQuit,
  opponents = [],
  onReconnect,
}) => {
  const { connectionStatus, joinError } = useGameStore(
    (state) => ({
      connectionStatus: state.connectionStatus,
      joinError: state.joinError,
    }),
    shallowEqual,
  );

  const currentSkill = skillData?.currentSkill ?? null;
  const [isMobileHud, setIsMobileHud] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }

    return window.matchMedia(MOBILE_HUD_QUERY).matches;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarBackdropVisible, setIsSidebarBackdropVisible] = useState(false);
  const sidebarRef = useRef(null);
  const toggleButtonRef = useRef(null);
  const hudRootRef = useRef(null);
  const hudContentRef = useRef(null);
  const sidebarId = useId();
  const minimapToggleId = useId();
  const audioToggleId = useId();
  const audioStatusId = useId();
  const touchToggleId = useId();
  const touchLayoutSelectId = useId();
  const touchLayoutDescriptionId = useId();
  const touchLayoutHelperId = useId();
  const touchLayoutAutoSwapToggleId = useId();
  const touchLayoutAutoSwapDescriptionId = useId();
  const touchLayoutAutoSwapHelperId = useId();
  const { settings, updateSettings } = useGameSettings();
  const audioEnabled = settings?.audioEnabled !== false;
  const audioToggleLabel = 'Efeitos sonoros';
  const audioStatusLabel = audioEnabled ? 'Som ligado' : 'Som desligado';
  const isMinimapEnabled = Boolean(settings?.showMinimap);
  const showTouchControlsSetting = Boolean(settings?.showTouchControls);
  const touchLayoutPreference = settings?.touchLayout === 'left' ? 'left' : 'right';
  const autoSwapTouchLayoutWhenSidebarOpen = Boolean(
    settings?.autoSwapTouchLayoutWhenSidebarOpen,
  );
  const isTouchDevice = useIsTouchDevice();
  const canShowTouchSettings = isTouchDevice || showTouchControlsSetting;
  const isTouchLayoutDisabled = !isTouchDevice || !showTouchControlsSetting;
  const touchLayoutDescribedBy = showTouchControlsSetting
    ? touchLayoutDescriptionId
    : `${touchLayoutDescriptionId} ${touchLayoutHelperId}`;
  const touchLayoutAutoSwapDescribedBy = showTouchControlsSetting
    ? touchLayoutAutoSwapDescriptionId
    : `${touchLayoutAutoSwapDescriptionId} ${touchLayoutAutoSwapHelperId}`;
  const minimapPreviewClassName = useMemo(
    () =>
      [
        styles.minimapPreview,
        isMinimapEnabled ? styles.minimapPreviewActive : styles.minimapPreviewInactive,
      ].join(' '),
    [isMinimapEnabled],
  );
  const audioPreviewClassName = useMemo(
    () =>
      [
        styles.audioPreview,
        audioEnabled ? styles.audioPreviewActive : styles.audioPreviewInactive,
      ].join(' '),
    [audioEnabled],
  );
  const touchControlsPreviewClassName = useMemo(
    () =>
      [
        styles.touchControlsPreview,
        showTouchControlsSetting
          ? styles.touchControlsPreviewActive
          : styles.touchControlsPreviewInactive,
      ].join(' '),
    [showTouchControlsSetting],
  );

  const showStatusOverlay = connectionStatus !== 'connected';
  const hudDisabled = showStatusOverlay;
  const sidebarIsInactive = hudDisabled || !isSidebarOpen;
  const sidebarInert = sidebarIsInactive ? 'true' : undefined;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(MOBILE_HUD_QUERY);

    const handleChange = (event) => {
      setIsMobileHud(event.matches);
    };

    handleChange(mediaQueryList);

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange);
      return () => {
        mediaQueryList.removeEventListener('change', handleChange);
      };
    }

    if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(handleChange);
      return () => {
        mediaQueryList.removeListener(handleChange);
      };
    }

    return undefined;
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (sidebarIsInactive) {
      if (!hudDisabled && toggleButtonRef.current) {
        toggleButtonRef.current.focus({ preventScroll: true });
      } else if (
        document.activeElement &&
        sidebarRef.current?.contains(document.activeElement)
      ) {
        if (typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
      }
      return;
    }

    const sidebar = sidebarRef.current;
    if (!sidebar) {
      return;
    }

    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const focusableElements = sidebar.querySelectorAll(focusableSelectors);
    const focusTarget = focusableElements.length
      ? focusableElements[0]
      : sidebar;

    if (typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }
  }, [sidebarIsInactive, hudDisabled]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) {
      return undefined;
    }

    const focusableSelectors = [
      '[data-sidebar-focus]',
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[tabindex]',
    ].join(', ');

    const focusableElements = Array.from(
      sidebar.querySelectorAll(focusableSelectors),
    );

    const applyHiddenAttributes = (element) => {
      if (!element.hasAttribute('data-sidebar-orig-tabindex')) {
        const existingTabIndex = element.getAttribute('tabindex');
        if (existingTabIndex !== null) {
          element.setAttribute('data-sidebar-orig-tabindex', existingTabIndex);
        } else {
          element.setAttribute('data-sidebar-orig-tabindex', '');
        }
      }

      if (!element.hasAttribute('data-sidebar-orig-aria-hidden')) {
        const existingAriaHidden = element.getAttribute('aria-hidden');
        if (existingAriaHidden !== null) {
          element.setAttribute(
            'data-sidebar-orig-aria-hidden',
            existingAriaHidden,
          );
        } else {
          element.setAttribute('data-sidebar-orig-aria-hidden', '');
        }
      }

      element.setAttribute('tabindex', '-1');
      element.setAttribute('aria-hidden', 'true');
    };

    const restoreHiddenAttributes = (element) => {
      const originalTabIndex = element.getAttribute('data-sidebar-orig-tabindex');
      if (originalTabIndex !== null) {
        element.removeAttribute('data-sidebar-orig-tabindex');
        if (originalTabIndex === '') {
          element.removeAttribute('tabindex');
        } else {
          element.setAttribute('tabindex', originalTabIndex);
        }
      } else if (element.getAttribute('tabindex') === '-1') {
        element.removeAttribute('tabindex');
      }

      const originalAriaHidden = element.getAttribute(
        'data-sidebar-orig-aria-hidden',
      );
      if (originalAriaHidden !== null) {
        element.removeAttribute('data-sidebar-orig-aria-hidden');
        if (originalAriaHidden === '') {
          element.removeAttribute('aria-hidden');
        } else {
          element.setAttribute('aria-hidden', originalAriaHidden);
        }
      } else if (element.getAttribute('aria-hidden') === 'true') {
        element.removeAttribute('aria-hidden');
      }
    };

    if (sidebarIsInactive) {
      focusableElements.forEach(applyHiddenAttributes);

      return () => {
        focusableElements.forEach(restoreHiddenAttributes);
      };
    }

    focusableElements.forEach(restoreHiddenAttributes);

    return undefined;
  }, [sidebarIsInactive]);

  useEffect(() => {
    if (sidebarIsInactive) {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        setIsSidebarOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarIsInactive]);

  const effectiveTouchLayout = useMemo(() => {
    if (!showTouchControls) {
      return null;
    }

    if (autoSwapTouchLayoutWhenSidebarOpen && isSidebarOpen) {
      return touchLayoutPreference === 'left' ? 'right' : 'left';
    }

    return touchLayoutPreference;
  }, [
    autoSwapTouchLayoutWhenSidebarOpen,
    isSidebarOpen,
    showTouchControls,
    touchLayoutPreference,
  ]);

  const handleToggleMinimap = useCallback(() => {
    updateSettings({ showMinimap: !isMinimapEnabled });
  }, [isMinimapEnabled, updateSettings]);

  const handleToggleAudio = useCallback(() => {
    updateSettings({ audioEnabled: !audioEnabled });
  }, [audioEnabled, updateSettings]);

  const handleToggleTouchControls = useCallback(
    (event) => {
      updateSettings({ showTouchControls: event.target.checked });
    },
    [updateSettings],
  );

  const handleTouchLayoutChange = useCallback(
    (event) => {
      const value = event.target.value === 'left' ? 'left' : 'right';
      updateSettings({ touchLayout: value });
    },
    [updateSettings],
  );

  const handleToggleAutoSwapTouchLayout = useCallback(
    (event) => {
      updateSettings({ autoSwapTouchLayoutWhenSidebarOpen: event.target.checked });
    },
    [updateSettings],
  );

  const handleDesktopEvolutionClick = useCallback(() => {
    if (typeof onOpenEvolutionMenu === 'function') {
      onOpenEvolutionMenu();
    }
  }, [onOpenEvolutionMenu]);

  const resolvedBossName = useMemo(() => {
    if (typeof bossName === 'string') {
      const trimmed = bossName.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    if (Array.isArray(opponents) && opponents.length > 0) {
      const bossCandidate = opponents.find((opponent) => {
        if (!opponent || typeof opponent !== 'object') {
          return false;
        }

        if (opponent.boss === true) {
          return true;
        }

        const classification = typeof opponent.classification === 'string'
          ? opponent.classification.toLowerCase()
          : '';
        if (classification === 'boss') {
          return true;
        }

        const tier = typeof opponent.tier === 'string' ? opponent.tier.toLowerCase() : '';
        return tier === 'boss';
      });

      if (bossCandidate && typeof bossCandidate.name === 'string') {
        const trimmed = bossCandidate.name.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }

    return undefined;
  }, [bossName, opponents]);

  const opponentSummaries = useMemo(() => {
    if (!Array.isArray(opponents) || opponents.length === 0) {
      return [];
    }

    return opponents.map((opponent) => {
      const ratio = opponent.maxHealth
        ? Math.max(0, Math.min(1, opponent.health / opponent.maxHealth))
        : 0;
      const percent = Math.round(ratio * 100);
      const combatStateLabel =
        COMBAT_STATE_LABELS[opponent.combatState] ?? opponent.combatState;

      return {
        id: opponent.id,
        name: opponent.name,
        elementLabel: opponent.elementLabel ?? opponent.element ?? '—',
        affinityLabel: opponent.affinityLabel ?? opponent.affinity ?? '—',
        combatState: combatStateLabel,
        healthRatio: ratio,
        healthPercent: percent,
        barStyle: {
          width: `${ratio * 100}%`,
          background: opponent.palette?.base ?? '#47c2ff',
        },
      };
    });
  }, [opponents]);

  const hasOpponents = opponentSummaries.length > 0;

  const statusMessages = useMemo(
    () => ({
      idle: 'Preparando conexão ao servidor…',
      connecting: 'Conectando ao servidor…',
      reconnecting: 'Reconectando ao servidor…',
      disconnected: 'Conexão perdida. Tentando reconectar…',
    }),
    [],
  );

  const statusHints = useMemo(
    () => ({
      connecting: 'Isso pode levar alguns instantes.',
      reconnecting: 'Segure firme enquanto restabelecemos a conexão.',
      disconnected: 'Verifique sua rede ou tente novamente em instantes.',
    }),
    [],
  );

  const statusTitle = statusMessages[connectionStatus] ?? 'Problemas de conexão';
  const statusHint = statusHints[connectionStatus];
  const isReconnectInProgress =
    connectionStatus === 'connecting' || connectionStatus === 'reconnecting';
  const reconnectButtonLabel = isReconnectInProgress
    ? 'Tentando reconectar…'
    : 'Tentar novamente';
  const showReconnectButton = showStatusOverlay && typeof onReconnect === 'function';

  const handleReconnectClick = useCallback(() => {
    if (typeof onReconnect !== 'function' || isReconnectInProgress) {
      return;
    }

    onReconnect();
  }, [isReconnectInProgress, onReconnect]);

  const sidebarAriaHidden = sidebarIsInactive ? true : undefined;

  const hudClassName = [styles.hud, isMobileHud ? styles.mobileHud : '']
    .filter(Boolean)
    .join(' ');
  const sidebarToggleClassName = [
    styles.sidebarToggle,
    isMobileHud ? styles.sidebarToggleFloating : '',
    hudDisabled ? styles.hudElementDisabled : '',
    showTouchControls ? styles.sidebarToggleTouchControls : '',
    showTouchControls && effectiveTouchLayout === 'left'
      ? styles.sidebarToggleTouchLayoutLeft
      : '',
    showTouchControls && effectiveTouchLayout === 'right'
      ? styles.sidebarToggleTouchLayoutRight
      : '',
    isSidebarOpen ? styles.sidebarToggleOpen : '',
  ]
    .filter(Boolean)
    .join(' ');
  const sidebarClassName = [
    styles.sidebar,
    isMobileHud ? styles.sidebarSheet : '',
    isSidebarOpen ? styles.sidebarOpen : styles.sidebarClosed,
  ]
    .filter(Boolean)
    .join(' ');
  const mainHudClassName = [
    styles.mainHud,
    isMobileHud ? styles.mainHudMobile : '',
    hudDisabled ? styles.hudElementDisabled : '',
  ]
    .filter(Boolean)
    .join(' ');
  const sidebarToggleIconClassName = [
    styles.sidebarToggleIcon,
    isSidebarOpen ? styles.sidebarToggleIconOpen : '',
  ]
    .filter(Boolean)
    .join(' ');
  const sidebarToggleLabel = isSidebarOpen
    ? 'Ocultar painel'
    : 'Mostrar painel';
  const touchControlsDisabled = hudDisabled || isSidebarOpen;
  const touchControlsClassName = hudDisabled ? styles.hudElementDisabled : undefined;

  useEffect(() => {
    if (!isMobileHud) {
      setIsSidebarBackdropVisible(false);
      return undefined;
    }

    if (isSidebarOpen) {
      setIsSidebarBackdropVisible(true);
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setIsSidebarBackdropVisible(false);
    }, SIDEBAR_TRANSITION_DURATION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isMobileHud, isSidebarOpen]);

  useEffect(() => {
    const hudRoot = hudRootRef.current;
    const hudContent = hudContentRef.current;

    if (!hudRoot) {
      return undefined;
    }

    if (!isMobileHud || !hudContent) {
      hudRoot.style.removeProperty('--hud-mobile-offset');
      return undefined;
    }

    const updateOffset = () => {
      const height = hudContent.getBoundingClientRect().height;
      hudRoot.style.setProperty('--hud-mobile-offset', `${height}px`);
    };

    if (typeof window === 'undefined' || typeof window.ResizeObserver !== 'function') {
      updateOffset();
      return () => {
        hudRoot.style.removeProperty('--hud-mobile-offset');
      };
    }

    const resizeObserver = new window.ResizeObserver(() => {
      updateOffset();
    });

    resizeObserver.observe(hudContent);
    updateOffset();

    return () => {
      resizeObserver.disconnect();
      hudRoot.style.removeProperty('--hud-mobile-offset');
    };
  }, [isMobileHud]);

  return (
    <>
      <button
        type="button"
        className={sidebarToggleClassName}
        onClick={handleToggleSidebar}
        aria-expanded={isSidebarOpen}
        aria-controls={sidebarId}
        ref={toggleButtonRef}
        disabled={hudDisabled}
        aria-disabled={hudDisabled ? true : undefined}
        inert={hudDisabled ? 'true' : undefined}
        aria-label={sidebarToggleLabel}
      >
        <span
          className={sidebarToggleIconClassName}
          aria-hidden="true"
        >
          <span className={styles.sidebarToggleIconBar} />
        </span>
        <span className={styles.sidebarToggleLabel} aria-live="polite">
          {sidebarToggleLabel}
        </span>
      </button>

      <div
        className={hudClassName}
        data-mobile-hud={isMobileHud ? 'true' : 'false'}
        ref={hudRootRef}
      >
        <div
          className={`${styles.canvasOverlay} ${
            showStatusOverlay ? styles.canvasOverlayVisible : ''
          }`}
          role="status"
          aria-live="polite"
          aria-label="Estado da conexão do jogo"
          aria-hidden={showStatusOverlay ? undefined : true}
        >
          {showStatusOverlay ? (
            <div className={styles.canvasOverlayContent}>
              <div
                className={styles.canvasOverlayStatus}
                role="status"
                aria-live={joinError ? 'assertive' : 'polite'}
              >
                <h2 className={styles.canvasOverlayTitle}>{statusTitle}</h2>
                {joinError ? (
                  <p className={styles.canvasOverlayMessage}>{joinError}</p>
                ) : null}
                {statusHint ? (
                  <p className={styles.canvasOverlayHint}>{statusHint}</p>
                ) : null}
              </div>
              {showReconnectButton ? (
                <div className={styles.canvasOverlayActions}>
                  <button
                    type="button"
                    className={styles.canvasOverlayButton}
                    onClick={handleReconnectClick}
                    disabled={isReconnectInProgress}
                    aria-disabled={isReconnectInProgress ? true : undefined}
                    aria-busy={isReconnectInProgress ? true : undefined}
                  >
                    {isReconnectInProgress ? (
                      <>
                        <span
                          className={styles.canvasOverlaySpinner}
                          aria-hidden="true"
                        />
                        <span className={styles.canvasOverlayButtonLabel}>
                          {reconnectButtonLabel}
                        </span>
                      </>
                    ) : (
                      reconnectButtonLabel
                    )}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

      {isSidebarBackdropVisible ? (
        <div
          className={`${styles.sidebarBackdrop} ${
            isMobileHud && isSidebarOpen
              ? styles.sidebarBackdropOpen
              : styles.sidebarBackdropClosing
          }`}
          aria-hidden="true"
          role="presentation"
          onClick={handleCloseSidebar}
        />
      ) : null}

      <div
        id={sidebarId}
        className={`${sidebarClassName} ${hudDisabled ? styles.hudElementDisabled : ''}`}
          role="complementary"
          aria-label="Painel lateral do jogo"
          aria-hidden={sidebarAriaHidden}
          tabIndex={-1}
          inert={sidebarInert}
          ref={sidebarRef}
        >
          <div className={styles.sidebarSectionGroup} data-sidebar-focus>
            <RankingPanel />
            <ConnectionStatusOverlay />
            {hasOpponents ? (
              <div className={styles.opponentPanel}>
                <h3 className={styles.opponentHeading}>Oponentes</h3>
                <ul className={styles.opponentList}>
                  {opponentSummaries.map((opponent) => (
                    <li key={opponent.id} className={styles.opponentItem}>
                      <div className={styles.opponentName}>{opponent.name}</div>
                      <div className={styles.opponentMeta}>
                        <span className={styles.opponentTag}>{opponent.elementLabel}</span>
                        <span className={`${styles.opponentTag} ${styles.opponentAffinity}`}>
                          {opponent.affinityLabel}
                        </span>
                      </div>
                      <div className={styles.opponentHealthMeter}>
                        <div
                          className={styles.opponentHealthBar}
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={opponent.healthPercent}
                          aria-valuetext={`${opponent.healthPercent}%`}
                        >
                          <div className={styles.opponentHealthFill} style={opponent.barStyle} />
                        </div>
                        <span className={styles.opponentHealthValue}>
                          {opponent.healthPercent}%
                        </span>
                      </div>
                      <div
                        className={styles.opponentStatus}
                        aria-label={opponent.combatState}
                        title={opponent.combatState}
                      >
                        {opponent.combatState}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <CameraControls zoom={cameraZoom} onChange={onCameraZoomChange} />
            {onQuit ? (
              <button type="button" className={styles.leaveButton} onClick={onQuit}>
                Sair da sala
              </button>
            ) : null}
          </div>
          <div className={styles.settingsPanel}>
            <h3 className={styles.settingsHeading}>Áudio</h3>
            <label className={styles.settingsToggle} htmlFor={audioToggleId}>
              <div className={styles.settingsToggleInfo}>
                <div className={audioPreviewClassName} aria-hidden="true">
                  <span className={styles.audioPreviewIcon} aria-hidden="true">
                    🔊
                  </span>
                </div>
                <div className={styles.settingsToggleText}>
                  <span className={styles.settingsToggleTitle}>Efeitos sonoros</span>
                  <span className={styles.settingsToggleDescription}>
                    Ative ou desative o áudio ambiente durante a partida.
                  </span>
                </div>
              </div>
              <div className={styles.settingsToggleControl}>
                <input
                  id={audioToggleId}
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={audioEnabled}
                  onChange={handleToggleAudio}
                  aria-checked={audioEnabled}
                  aria-label={audioToggleLabel}
                  aria-describedby={audioStatusId}
                />
                <span
                  id={audioStatusId}
                  className={styles.toggleStatusText}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {audioStatusLabel}
                </span>
              </div>
            </label>
            <h3 className={styles.settingsHeading}>Exibição</h3>
            <label className={styles.settingsToggle} htmlFor={minimapToggleId}>
              <div className={styles.settingsToggleInfo}>
                <div className={minimapPreviewClassName} aria-hidden="true" />
                <div className={styles.settingsToggleText}>
                  <span className={styles.settingsToggleTitle}>Minimapa</span>
                  <span className={styles.settingsToggleDescription}>
                    Ative uma visão geral do mundo e compacte a barra de status do jogador.
                  </span>
                </div>
              </div>
              <div className={styles.settingsToggleControl}>
                <input
                  id={minimapToggleId}
                  type="checkbox"
                  className={styles.toggleInput}
                  checked={isMinimapEnabled}
                  onChange={handleToggleMinimap}
                  aria-checked={isMinimapEnabled}
                />
                <span className={styles.toggleStatusText} aria-live="polite" aria-atomic="true">
                  {isMinimapEnabled ? 'Ativado' : 'Desativado'}
                </span>
              </div>
            </label>
            {canShowTouchSettings ? (
              <>
                <h3 className={styles.settingsHeading}>Controles touch</h3>
                <label className={styles.settingsToggle} htmlFor={touchToggleId}>
                  <div className={styles.settingsToggleInfo}>
                    <div className={touchControlsPreviewClassName} aria-hidden="true">
                      <span className={styles.touchControlsPreviewIcon} aria-hidden="true">
                        🕹️
                      </span>
                    </div>
                    <div className={styles.settingsToggleText}>
                      <span className={styles.settingsToggleTitle}>Mostrar controles</span>
                      <span className={styles.settingsToggleDescription}>
                        Ative os botões virtuais durante a partida.
                      </span>
                      {!isTouchDevice ? (
                        <span className={styles.settingsToggleHelper}>
                          Disponível apenas em dispositivos com tela sensível ao toque.
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.settingsToggleControl}>
                    <input
                      id={touchToggleId}
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={showTouchControlsSetting}
                      onChange={handleToggleTouchControls}
                      aria-checked={showTouchControlsSetting}
                      aria-label="Exibir controles touch"
                    />
                    <span className={styles.toggleStatusText} aria-live="polite" aria-atomic="true">
                      {showTouchControlsSetting ? 'Ativos' : 'Ocultos'}
                    </span>
                  </div>
                </label>
                <div className={styles.settingsField}>
                  <div className={styles.settingsFieldInfo}>
                    <label className={styles.settingsFieldTitle} htmlFor={touchLayoutSelectId}>
                      Layout dos controles touch
                    </label>
                    <span
                      className={styles.settingsFieldDescription}
                      id={touchLayoutDescriptionId}
                    >
                      Escolha o lado onde os botões de ação ficam posicionados.
                    </span>
                    {!showTouchControlsSetting ? (
                      <span className={styles.settingsFieldHelper} id={touchLayoutHelperId}>
                        Ative os controles touch para escolher o layout.
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.settingsSelectWrapper}>
                    <select
                      id={touchLayoutSelectId}
                      className={styles.settingsSelect}
                      value={touchLayoutPreference}
                      onChange={handleTouchLayoutChange}
                      disabled={isTouchLayoutDisabled}
                      aria-label="Layout dos controles touch"
                      aria-disabled={isTouchLayoutDisabled ? 'true' : undefined}
                      aria-describedby={touchLayoutDescribedBy}
                    >
                      <option value="right">Botões à direita</option>
                      <option value="left">Botões à esquerda</option>
                    </select>
                  </div>
                </div>
                <label className={styles.settingsToggle} htmlFor={touchLayoutAutoSwapToggleId}>
                  <div className={styles.settingsToggleInfo}>
                    <div className={styles.settingsToggleText}>
                      <span className={styles.settingsToggleTitle}>Ajustar ao painel lateral</span>
                      <span
                        className={styles.settingsToggleDescription}
                        id={touchLayoutAutoSwapDescriptionId}
                      >
                        Inverta o lado dos botões automaticamente quando o painel lateral estiver
                        aberto.
                      </span>
                      {!showTouchControlsSetting ? (
                        <span
                          className={styles.settingsToggleHelper}
                          id={touchLayoutAutoSwapHelperId}
                        >
                          Ative os controles touch para configurar este ajuste.
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.settingsToggleControl}>
                    <input
                      id={touchLayoutAutoSwapToggleId}
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={autoSwapTouchLayoutWhenSidebarOpen}
                      onChange={handleToggleAutoSwapTouchLayout}
                      disabled={isTouchLayoutDisabled}
                      aria-checked={autoSwapTouchLayoutWhenSidebarOpen}
                      aria-label="Ajustar layout automaticamente quando o painel lateral estiver aberto"
                      aria-disabled={isTouchLayoutDisabled ? 'true' : undefined}
                      aria-describedby={touchLayoutAutoSwapDescribedBy}
                    />
                    <span className={styles.toggleStatusText} aria-live="polite" aria-atomic="true">
                      {autoSwapTouchLayoutWhenSidebarOpen ? 'Ativado' : 'Desativado'}
                    </span>
                  </div>
                </label>
              </>
            ) : null}
          </div>
        </div>

        <div
          className={mainHudClassName}
          aria-hidden={hudDisabled ? true : undefined}
          inert={hudDisabled ? 'true' : undefined}
          ref={hudContentRef}
          data-touch-controls-active={showTouchControls ? 'true' : 'false'}
        >
          <div className={styles.mobileTopRegion}>
            <HudBar
              isMobileHud={isMobileHud}
              level={level}
              score={score}
              energy={energy}
              health={health}
              maxHealth={maxHealth}
              dashCharge={dashCharge}
              combo={combo}
              maxCombo={maxCombo}
              activePowerUps={activePowerUps}
              xp={xp}
              geneticMaterial={geneticMaterial}
              characteristicPoints={characteristicPoints}
              geneFragments={geneFragments}
              stableGenes={stableGenes}
              evolutionSlots={evolutionSlots}
              reroll={reroll}
              dropPity={dropPity}
              recentRewards={recentRewards}
              element={element}
              affinity={affinity}
              elementLabel={elementLabel}
              affinityLabel={affinityLabel}
              resistances={resistances}
              statusEffects={statusEffects}
              isMinimized={isMinimapEnabled}
            />

            <BossHealthBar
              active={bossActive}
              health={bossHealth}
              maxHealth={bossMaxHealth}
              name={resolvedBossName}
            />

            <Notifications notifications={notifications} />
          </div>

          <div className={styles.mobileBottomRegion}>
            <div className={styles.desktopSkillControls}>
              <SkillWheel
                currentSkill={currentSkill}
                skillList={skillData?.skillList ?? []}
                hasMultipleSkills={skillData?.hasMultipleSkills}
                skillCooldownLabel={skillData?.skillCooldownLabel ?? 'Sem habilidade'}
                skillReadyPercent={skillData?.skillReadyPercent ?? 0}
                onCycleSkill={onCycleSkill}
                onUseSkill={onUseSkill}
                touchControlsActive={showTouchControls}
                showTouchControls={showTouchControls}
                touchLayout={touchLayoutPreference}
              />
              {!showTouchControls && canEvolve && typeof onOpenEvolutionMenu === 'function' ? (
                <button
                  type="button"
                  className={styles.desktopEvolutionButton}
                  onClick={handleDesktopEvolutionClick}
                  aria-label="Abrir menu de evolução"
                  data-desktop-evolution-button="true"
                >
                  Evoluir
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {showTouchControls ? (
          <TouchControls
            joystick={joystick}
            onJoystickStart={onJoystickStart}
            onJoystickMove={onJoystickMove}
            onJoystickEnd={onJoystickEnd}
            onAttackPress={onAttackPress}
            onAttackRelease={onAttackRelease}
            onAttack={onAttack}
            onDash={onDash}
            dashCharge={dashCharge}
            onUseSkill={onUseSkill}
            onCycleSkill={onCycleSkill}
            skillDisabled={skillData?.skillDisabled}
            skillCoolingDown={skillData?.skillCoolingDown}
            skillCooldownLabel={skillData?.skillCooldownLabel}
            skillCooldownPercent={skillData?.skillCooldownPercent ?? 0}
            currentSkillIcon={currentSkill?.icon}
            currentSkillCost={skillData?.costLabel ?? '0⚡'}
            hasCurrentSkill={Boolean(currentSkill)}
            onOpenEvolutionMenu={onOpenEvolutionMenu}
            canEvolve={canEvolve}
            touchLayout={touchLayoutPreference}
            isSidebarOpen={isSidebarOpen}
            autoInvertWhenSidebarOpen={settings.autoSwapTouchLayoutWhenSidebarOpen}
            className={touchControlsClassName}
            aria-hidden={touchControlsDisabled ? true : undefined}
            inert={touchControlsDisabled ? 'true' : undefined}
          />
        ) : null}
      </div>
    </>
  );
};

export default GameHud;
