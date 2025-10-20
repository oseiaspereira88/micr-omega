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
  const { settings, updateSettings } = useGameSettings();
  const isMinimapEnabled = Boolean(settings?.showMinimap);
  const touchLayoutPreference = settings?.touchLayout === 'left' ? 'left' : 'right';
  const autoSwapTouchLayoutWhenSidebarOpen = Boolean(
    settings?.autoSwapTouchLayoutWhenSidebarOpen,
  );
  const minimapPreviewClassName = useMemo(
    () =>
      [
        styles.minimapPreview,
        isMinimapEnabled ? styles.minimapPreviewActive : styles.minimapPreviewInactive,
      ].join(' '),
    [isMinimapEnabled],
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
            <div className={styles.skillWheelRow}>
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
              {!showTouchControls && canEvolve ? (
                <button
                  type="button"
                  className={styles.desktopEvolutionButton}
                  onClick={onOpenEvolutionMenu}
                  aria-label="Abrir menu de evolução"
                  data-testid="desktop-evolution-button"
                >
                  Evolução
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
            className={hudDisabled ? styles.hudElementDisabled : undefined}
            aria-hidden={hudDisabled ? true : undefined}
            inert={hudDisabled ? 'true' : undefined}
          />
        ) : null}
      </div>
    </>
  );
};

export default GameHud;
