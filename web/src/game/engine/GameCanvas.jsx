import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import GameHud from '../../ui/components/GameHud';
import GameOverScreen from '../../ui/components/GameOverScreen';
import ArchetypeSelection from '../../ui/components/ArchetypeSelection';
import styles from '../../MicroOmegaGame.module.css';
import { useGameDispatch, useGameState } from './GameContext';
import useGameLoop from './useGameLoop';
import useIsTouchDevice from '../../hooks/useIsTouchDevice';

const DEFAULT_EVOLUTION_MENU = Object.freeze({
  activeTier: 'small',
  options: Object.freeze({
    small: Object.freeze([]),
    medium: Object.freeze([]),
    large: Object.freeze([]),
    macro: Object.freeze([]),
  }),
});

const TIER_METADATA = Object.freeze({
  small: {
    label: 'Pequenas',
    icon: '🧬',
    description: 'Custam PC e focam em ajustes rápidos.',
  },
  medium: {
    label: 'Médias',
    icon: '🧫',
    description: 'Usam MG + fragmentos para reforços profundos.',
  },
  large: {
    label: 'Grandes',
    icon: '🌌',
    description: 'Formas e mutações poderosas com Genes estáveis.',
  },
  macro: {
    label: 'Macro',
    icon: '🪐',
    description: 'Transformações épicas que remodelam todo o organismo.',
  },
});

const EVOLUTION_TIER_KEYS = Object.freeze(['small', 'medium', 'large', 'macro']);
const EVOLUTION_OPTIONS_PANEL_ID = 'evolution-options-panel';

const createEmptyJourneyStats = () => ({
  elapsedMs: 0,
  xpTotal: 0,
  mgTotal: 0,
  evolutionsTotal: 0,
  evolutionsByTier: {
    small: 0,
    medium: 0,
    large: 0,
    macro: 0,
  },
});

const summarizeEvolutionSlots = (slots = {}) => {
  const summary = {
    total: 0,
    byTier: {
      small: 0,
      medium: 0,
      large: 0,
      macro: 0,
    },
  };

  EVOLUTION_TIER_KEYS.forEach((tier) => {
    const used = Number.isFinite(slots?.[tier]?.used) ? Math.max(0, slots[tier].used) : 0;
    summary.byTier[tier] = used;
    summary.total += used;
  });

  return summary;
};

export const formatEvolutionCost = (cost = {}) => {
  const resolvedCost = typeof cost === 'object' && cost !== null ? cost : {};
  const parts = [];
  if (Number.isFinite(resolvedCost.pc)) parts.push(`${resolvedCost.pc} PC`);
  if (Number.isFinite(resolvedCost.mg)) parts.push(`${resolvedCost.mg} MG`);
  if (typeof resolvedCost.fragments === 'object' && resolvedCost.fragments !== null) {
    Object.entries(resolvedCost.fragments).forEach(([key, amount]) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      parts.push(`${amount} Frag ${key}`);
    });
  }
  if (typeof resolvedCost.stableGenes === 'object' && resolvedCost.stableGenes !== null) {
    Object.entries(resolvedCost.stableGenes).forEach(([key, amount]) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      parts.push(`${amount} Gene ${key}`);
    });
  }
  return parts.length > 0 ? parts.join(' · ') : 'Sem custo';
};

export const formatEvolutionRequirements = (requirements = {}) => {
  const resolvedRequirements =
    typeof requirements === 'object' && requirements !== null ? requirements : {};
  const parts = [];
  if (Number.isFinite(resolvedRequirements.level))
    parts.push(`Nível ${resolvedRequirements.level}`);
  if (
    typeof resolvedRequirements.fragments === 'object' &&
    resolvedRequirements.fragments !== null
  ) {
    Object.entries(resolvedRequirements.fragments).forEach(([key, amount]) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      parts.push(`${amount} Frag ${key}`);
    });
  }
  if (
    typeof resolvedRequirements.stableGenes === 'object' &&
    resolvedRequirements.stableGenes !== null
  ) {
    Object.entries(resolvedRequirements.stableGenes).forEach(([key, amount]) => {
      if (!Number.isFinite(amount) || amount <= 0) return;
      parts.push(`${amount} Gene ${key}`);
    });
  }
  if (Number.isFinite(resolvedRequirements.mg)) parts.push(`${resolvedRequirements.mg} MG mínimo`);
  return parts.length > 0 ? parts.join(' · ') : 'Nenhum requisito adicional';
};

const clampCameraZoom = (value) => {
  const parsed = Number.isFinite(value) ? value : 1;
  if (parsed < 0.6) {
    return 0.6;
  }
  if (parsed > 1.2) {
    return 1.2;
  }
  return parsed;
};

const GameCanvas = ({ settings, updateSettings, onQuit, onReconnect }) => {
  const canvasRef = useRef(null);
  const gameState = useGameState();
  const dispatch = useGameDispatch();
  const [journeyStats, setJourneyStats] = useState(() => createEmptyJourneyStats());

  const runStartRef = useRef(null);
  const lastGameOverRef = useRef(Boolean(gameState.gameOver));

  const {
    joystick,
    inputActions,
    chooseEvolution,
    requestEvolutionReroll,
    cancelEvolutionChoice,
    restartGame,
    selectArchetype,
    setCameraZoom,
    setActiveEvolutionTier,
    pauseGame,
    resumeGame,
  } = useGameLoop({
    canvasRef,
    dispatch,
    settings,
    updateSettings,
  });

  const isTouchDevice = useIsTouchDevice();

  const {
    currentSkill: currentSkillInfo,
    skillList,
    hasMultipleSkills,
    energy,
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
    statusEffects,
    notifications,
    canEvolve,
    cameraZoom,
    opponents,
    evolutionMenu: evolutionMenuState,
    currentForm,
    showEvolutionChoice,
    archetypeSelection,
    selectedArchetype,
    level,
    score,
    health,
    maxHealth,
    dashCharge,
    combo,
    maxCombo,
    activePowerUps,
  } = gameState;

  // Pausar jogo durante menu de evolução
  useEffect(() => {
    if (showEvolutionChoice) {
      pauseGame?.();
    } else {
      resumeGame?.();
    }
  }, [showEvolutionChoice, pauseGame, resumeGame]);

  const desiredCameraZoom = useMemo(() => {
    if (Number.isFinite(settings?.cameraZoom)) {
      return clampCameraZoom(settings.cameraZoom);
    }
    return null;
  }, [settings?.cameraZoom]);

  useEffect(() => {
    if (!Number.isFinite(desiredCameraZoom)) {
      return;
    }

    const currentZoom = Number.isFinite(cameraZoom) ? cameraZoom : 1;
    if (Math.abs(currentZoom - desiredCameraZoom) < 0.0001) {
      return;
    }

    setCameraZoom(desiredCameraZoom);
  }, [desiredCameraZoom, cameraZoom, setCameraZoom]);

  useEffect(() => {
    const now = Date.now();
    const xpTotal = Number.isFinite(xp?.total) ? Math.max(0, xp.total) : 0;
    const mgTotal = Number.isFinite(geneticMaterial?.total) ? Math.max(0, geneticMaterial.total) : 0;
    const evolutionSummary = summarizeEvolutionSlots(evolutionSlots);

    setJourneyStats((previous) => {
      let start = runStartRef.current;
      if (!gameState.gameOver) {
        if (lastGameOverRef.current || start === null) {
          start = now;
          runStartRef.current = start;
        }

        const elapsedMs = start ? Math.max(0, now - start) : 0;

        return {
          elapsedMs,
          xpTotal,
          mgTotal,
          evolutionsTotal: evolutionSummary.total,
          evolutionsByTier: evolutionSummary.byTier,
        };
      }

      if (!lastGameOverRef.current && start !== null) {
        const elapsedMs = Math.max(0, now - start);
        return {
          elapsedMs,
          xpTotal,
          mgTotal,
          evolutionsTotal: evolutionSummary.total,
          evolutionsByTier: evolutionSummary.byTier,
        };
      }

      return {
        elapsedMs: previous.elapsedMs ?? 0,
        xpTotal,
        mgTotal,
        evolutionsTotal: evolutionSummary.total,
        evolutionsByTier: evolutionSummary.byTier,
      };
    });

    if (!gameState.gameOver && lastGameOverRef.current) {
      runStartRef.current = now;
    }

    if (gameState.gameOver && !lastGameOverRef.current) {
      runStartRef.current = runStartRef.current ?? now;
    }

    lastGameOverRef.current = gameState.gameOver;
  }, [gameState.gameOver, xp, geneticMaterial, evolutionSlots]);

  const xpCurrent = xp?.current ?? 0;
  const mgCurrent = geneticMaterial?.current ?? 0;
  const rerollCost = Math.floor(reroll?.cost ?? reroll?.baseCost ?? 25);
  const rerollCount = Math.floor(reroll?.count ?? 0);
  const rerollAvailable = mgCurrent >= rerollCost;

  const skillData = useMemo(() => {
    const resolveCost = (skill) => {
      if (!skill) return { energy: 0, xp: 0, mg: 0 };
      const cost = skill.cost ?? {};
      if (typeof cost === 'number' && Number.isFinite(cost)) {
        return { energy: cost, xp: 0, mg: 0 };
      }
      return {
        energy: Number.isFinite(cost.energy) ? cost.energy : 0,
        xp: Number.isFinite(cost.xp) ? cost.xp : 0,
        mg: Number.isFinite(cost.mg) ? cost.mg : 0,
      };
    };
    const currentCost = resolveCost(currentSkillInfo);
    const skillMaxCooldown = currentSkillInfo?.maxCooldown ?? 0;
    const skillCooldownRemaining = currentSkillInfo?.cooldown ?? 0;
    const skillReadyPercent = currentSkillInfo
      ? skillMaxCooldown > 0
        ? Math.max(
            0,
            Math.min(100, ((skillMaxCooldown - skillCooldownRemaining) / skillMaxCooldown) * 100)
          )
        : 100
      : 0;
    const skillCoolingDown = Boolean(currentSkillInfo && skillCooldownRemaining > 0.05);
    const skillDisabled =
      !currentSkillInfo ||
      skillCoolingDown ||
      energy < currentCost.energy ||
      xpCurrent < currentCost.xp ||
      mgCurrent < currentCost.mg;
    const skillCooldownLabel = currentSkillInfo
      ? skillCoolingDown
        ? `${skillCooldownRemaining.toFixed(1)}s`
        : 'Pronta'
      : 'Sem habilidade';
    const skillCooldownPercent = currentSkillInfo && skillMaxCooldown
      ? Math.max(0, Math.min(100, (skillCooldownRemaining / skillMaxCooldown) * 100))
      : 0;
    const costParts = [];
    if (currentCost.energy > 0) costParts.push(`${currentCost.energy}⚡`);
    if (currentCost.xp > 0) costParts.push(`${currentCost.xp}XP`);
    if (currentCost.mg > 0) costParts.push(`${currentCost.mg}MG`);
    const costLabel = costParts.length > 0 ? costParts.join(' · ') : '0⚡';

    return {
      currentSkill: currentSkillInfo,
      skillList,
      hasMultipleSkills,
      skillCooldownLabel,
      skillReadyPercent,
      skillCooldownPercent,
      skillCoolingDown,
      skillDisabled,
      costLabel,
      costBreakdown: currentCost,
    };
  }, [currentSkillInfo, energy, hasMultipleSkills, mgCurrent, skillList, xpCurrent]);

  const handleRestart = useCallback(() => {
    restartGame();
  }, [restartGame]);

  if (gameState.gameOver) {
    return (
      <GameOverScreen
        score={gameState.score}
        level={gameState.level}
        maxCombo={gameState.maxCombo}
        journeyStats={journeyStats}
        onRestart={handleRestart}
        onQuit={onQuit}
      />
    );
  }

  const evolutionMenu = evolutionMenuState || DEFAULT_EVOLUTION_MENU;

  const handleEvolutionReroll = useCallback(() => {
    if (!rerollAvailable) {
      return;
    }

    requestEvolutionReroll?.();
  }, [rerollAvailable, requestEvolutionReroll]);

  const evolutionOverlayRef = useRef(null);
  const evolutionDialogRef = useRef(null);
  const rerollButtonRef = useRef(null);
  const firstTierButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const wasEvolutionOpenRef = useRef(false);
  const evolutionDialogTitleId = useId();

  const getFocusableEvolutionElements = useCallback(() => {
    const dialog = evolutionDialogRef.current;
    if (!dialog) return [];

    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];

    return Array.from(dialog.querySelectorAll(selectors.join(','))).filter((element) => {
      if (element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      if (element.hasAttribute('disabled')) {
        return false;
      }
      if (element.dataset?.focusSentinel === 'true') {
        return false;
      }
      const htmlElement = element;
      return htmlElement instanceof HTMLElement && htmlElement.offsetParent !== null;
    });
  }, []);

  const releaseEvolutionFocus = useCallback(() => {
    const previous = previousFocusRef.current;
    previousFocusRef.current = null;
    if (previous && typeof previous.focus === 'function') {
      previous.focus();
    }
  }, []);

  const handleEvolutionCancel = useCallback(() => {
    releaseEvolutionFocus();
    cancelEvolutionChoice?.();
  }, [cancelEvolutionChoice, releaseEvolutionFocus]);

  const focusFirstEvolutionElement = useCallback(() => {
    const focusableElements = getFocusableEvolutionElements();
    focusableElements[0]?.focus();
  }, [getFocusableEvolutionElements]);

  const focusLastEvolutionElement = useCallback(() => {
    const focusableElements = getFocusableEvolutionElements();
    focusableElements[focusableElements.length - 1]?.focus();
  }, [getFocusableEvolutionElements]);

  const handleEvolutionOverlayKeyDown = useCallback(
    (event) => {
      if (event.key === 'Tab') {
        const focusableElements = getFocusableEvolutionElements();
        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const activeElement = document.activeElement;
        const currentIndex = focusableElements.indexOf(activeElement);

        if (event.shiftKey) {
          if (currentIndex <= 0) {
            event.preventDefault();
            focusableElements[focusableElements.length - 1]?.focus();
          }
        } else if (currentIndex === -1 || currentIndex === focusableElements.length - 1) {
          event.preventDefault();
          focusableElements[0]?.focus();
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleEvolutionCancel();
      }
    },
    [getFocusableEvolutionElements, handleEvolutionCancel]
  );

  const handleEvolutionOverlayClick = useCallback(
    (event) => {
      if (event.target === event.currentTarget) {
        handleEvolutionCancel();
      }
    },
    [handleEvolutionCancel]
  );

  useEffect(() => {
    if (showEvolutionChoice) {
      const dialog = evolutionDialogRef.current;
      if (!wasEvolutionOpenRef.current) {
        wasEvolutionOpenRef.current = true;
        const activeElement = document.activeElement;
        previousFocusRef.current =
          activeElement instanceof HTMLElement ? activeElement : null;

        let initialFocus = null;
        const rerollButton = rerollButtonRef.current;
        if (rerollButton && !rerollButton.disabled) {
          initialFocus = rerollButton;
        } else if (firstTierButtonRef.current) {
          initialFocus = firstTierButtonRef.current;
        } else {
          const focusableElements = getFocusableEvolutionElements();
          initialFocus = focusableElements[0] ?? null;
        }

        if (initialFocus && typeof initialFocus.focus === 'function') {
          initialFocus.focus();
        } else if (dialog && typeof dialog.focus === 'function') {
          dialog.focus();
        }
      } else if (
        dialog &&
        typeof dialog.contains === 'function' &&
        !dialog.contains(document.activeElement)
      ) {
        dialog.focus();
      }
    } else if (wasEvolutionOpenRef.current) {
      wasEvolutionOpenRef.current = false;
      releaseEvolutionFocus();
    }
  }, [
    showEvolutionChoice,
    getFocusableEvolutionElements,
    releaseEvolutionFocus,
  ]);

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <GameHud
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
        bossActive={bossActive}
        bossHealth={bossHealth}
        bossMaxHealth={bossMaxHealth}
        bossName={bossName}
        element={element}
        affinity={affinity}
        elementLabel={elementLabel}
        affinityLabel={affinityLabel}
        resistances={resistances}
        statusEffects={statusEffects ?? []}
        skillData={skillData}
        notifications={notifications}
        joystick={joystick}
        onJoystickStart={inputActions.joystickStart}
        onJoystickMove={inputActions.joystickMove}
        onJoystickEnd={inputActions.joystickEnd}
        onAttackPress={inputActions.attackPress}
        onAttackRelease={inputActions.attackRelease}
        onAttack={inputActions.attack}
        onDash={inputActions.dash}
        onUseSkill={inputActions.useSkill}
        onCycleSkill={inputActions.cycleSkill}
        onOpenEvolutionMenu={inputActions.openEvolutionMenu}
        canEvolve={canEvolve}
        showTouchControls={Boolean(settings?.showTouchControls && isTouchDevice)}
        cameraZoom={
          Number.isFinite(desiredCameraZoom)
            ? desiredCameraZoom
            : Number.isFinite(cameraZoom)
              ? cameraZoom
              : gameState.camera?.zoom ?? 1
        }
        onCameraZoomChange={setCameraZoom}
        onQuit={onQuit}
        onReconnect={onReconnect}
        opponents={opponents}
      />

      {showEvolutionChoice && (
        <div
          className={styles.evolutionOverlay}
          ref={evolutionOverlayRef}
          onClick={handleEvolutionOverlayClick}
        >
          <div
            className={styles.evolutionDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={evolutionDialogTitleId}
            onKeyDown={handleEvolutionOverlayKeyDown}
            ref={evolutionDialogRef}
            tabIndex={-1}
          >
            <span
              tabIndex={0}
              data-focus-sentinel="true"
              className={styles.focusSentinel}
              onFocus={focusLastEvolutionElement}
            />

            <div className={styles.evolutionCard}>
              <h2 id={evolutionDialogTitleId} className={styles.evolutionTitle}>
                🧬 Evolução Nível {level}
              </h2>

              <div className={styles.rerollControls}>
                <button
                  type="button"
                  className={`${styles.rerollButton} ${
                    rerollAvailable ? '' : styles.rerollButtonDisabled
                  }`.trim()}
                  onClick={handleEvolutionReroll}
                  disabled={!rerollAvailable}
                  aria-disabled={!rerollAvailable}
                  ref={rerollButtonRef}
                >
                  🔁 Rerrolar opções
                </button>
                <div className={styles.rerollInfo}>
                  <span className={styles.rerollCost}>Custo {rerollCost} MG</span>
                  <span className={styles.rerollCount}>Usado {rerollCount}x</span>
                  <span
                    className={`${styles.rerollStatus} ${
                      rerollAvailable ? styles.rerollStatusAvailable : styles.rerollStatusBlocked
                    }`.trim()}
                    role="status"
                    aria-live="polite"
                  >
                    {rerollAvailable ? 'Disponível' : 'MG insuficiente'}
                  </span>
                </div>
              </div>

              <div className={styles.evolutionTabs}>
                {EVOLUTION_TIER_KEYS.map((tierKey, index) => {
                  const metadata = TIER_METADATA[tierKey];
                  const isActive = evolutionMenu.activeTier === tierKey;
                  const slots = evolutionSlots?.[tierKey] || { used: 0, max: 0 };
                  const handleActivateTier = () => {
                    if (!isActive) {
                      setActiveEvolutionTier?.(tierKey);
                    }
                  };
                  return (
                    <button
                      type="button"
                      key={tierKey}
                      className={`${styles.evolutionTab} ${
                        isActive ? styles.evolutionTabActive : styles.evolutionTabDisabled
                      }`.trim()}
                      onClick={handleActivateTier}
                      aria-pressed={isActive}
                      aria-controls={EVOLUTION_OPTIONS_PANEL_ID}
                      ref={index === 0 ? firstTierButtonRef : null}
                      data-evolution-tier-tab="true"
                    >
                      <div className={styles.evolutionTabHeader}>
                        <span>{metadata.icon}</span>
                        <span>{metadata.label}</span>
                      </div>
                      <small className={styles.evolutionTabHint}>{metadata.description}</small>
                      <small className={styles.evolutionTabSlots}>
                        Slots {slots.used}/{slots.max}
                      </small>
                    </button>
                  );
                })}
              </div>

              <div className={styles.optionHeading}>
                {TIER_METADATA[evolutionMenu.activeTier]?.label || 'Evoluções'} disponíveis
              </div>
              <div className={styles.optionList} id={EVOLUTION_OPTIONS_PANEL_ID}>
                {(evolutionMenu.options?.[evolutionMenu.activeTier] || []).map((option) => {
                  const disabled = !option.available;
                  const multiplierPercent = Math.round((option.nextBonusMultiplier ?? 0) * 100);
                  const className = [
                    styles.evolutionOption,
                    disabled ? styles.evolutionOptionDisabled : '',
                  ]
                    .join(' ')
                    .trim();

                  const handleSelect = () => {
                    if (disabled) return;
                    releaseEvolutionFocus();
                    chooseEvolution(option.key, option.tier);
                  };

                  return (
                    <button
                      type="button"
                      key={option.key}
                      className={className}
                      onClick={handleSelect}
                      disabled={disabled}
                    >
                      <div className={styles.evolutionOptionHeader}>
                        <span className={styles.evolutionOptionTitle} style={{ color: option.color }}>
                          {option.icon} {option.name}
                        </span>
                        <span className={styles.evolutionOptionRepeat}>
                          Aquisições: {option.purchases}
                        </span>
                      </div>
                      <div className={styles.evolutionOptionRow}>
                        <span className={styles.evolutionOptionLabel}>Custo</span>
                        <span>{formatEvolutionCost(option.cost)}</span>
                      </div>
                      <div className={styles.evolutionOptionRow}>
                        <span className={styles.evolutionOptionLabel}>Requisitos</span>
                        <span>{formatEvolutionRequirements(option.requirements)}</span>
                      </div>
                      <div className={styles.evolutionOptionRow}>
                        <span className={styles.evolutionOptionLabel}>Próximo bônus</span>
                        <span>{multiplierPercent}%</span>
                      </div>
                      {!option.available && option.reason && (
                        <div className={styles.evolutionOptionNotice}>{option.reason}</div>
                      )}
                      {option.tier === 'large' && option.key === currentForm && (
                        <div className={styles.evolutionOptionNotice}>
                          Forma atual — benefício reduzido
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <span
              tabIndex={0}
              data-focus-sentinel="true"
              className={styles.focusSentinel}
              onFocus={focusFirstEvolutionElement}
            />
          </div>
        </div>
      )}

      {archetypeSelection?.pending && (
        <ArchetypeSelection
          selection={archetypeSelection}
          selected={selectedArchetype}
          onSelect={selectArchetype}
        />
      )}
    </div>
  );
};

export default GameCanvas;
