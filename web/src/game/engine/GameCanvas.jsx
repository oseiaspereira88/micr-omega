import React, { useCallback, useMemo, useRef } from 'react';
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
});

const formatEvolutionCost = (cost = {}) => {
  const parts = [];
  if (Number.isFinite(cost.pc)) parts.push(`${cost.pc} PC`);
  if (Number.isFinite(cost.mg)) parts.push(`${cost.mg} MG`);
  if (cost.fragments) {
    Object.entries(cost.fragments).forEach(([key, amount]) => {
      parts.push(`${amount} Frag ${key}`);
    });
  }
  if (cost.stableGenes) {
    Object.entries(cost.stableGenes).forEach(([key, amount]) => {
      parts.push(`${amount} Gene ${key}`);
    });
  }
  return parts.length > 0 ? parts.join(' · ') : 'Sem custo';
};

const formatEvolutionRequirements = (requirements = {}) => {
  const parts = [];
  if (Number.isFinite(requirements.level)) parts.push(`Nível ${requirements.level}`);
  if (requirements.fragments) {
    Object.entries(requirements.fragments).forEach(([key, amount]) => {
      parts.push(`${amount} Frag ${key}`);
    });
  }
  if (requirements.stableGenes) {
    Object.entries(requirements.stableGenes).forEach(([key, amount]) => {
      parts.push(`${amount} Gene ${key}`);
    });
  }
  if (Number.isFinite(requirements.mg)) parts.push(`${requirements.mg} MG mínimo`);
  return parts.length > 0 ? parts.join(' · ') : 'Nenhum requisito adicional';
};

const GameCanvas = ({ settings, onQuit }) => {
  const canvasRef = useRef(null);
  const gameState = useGameState();
  const dispatch = useGameDispatch();

  const {
    joystick,
    inputActions,
    chooseEvolution,
    requestEvolutionReroll,
    restartGame,
    selectArchetype,
    setCameraZoom,
  } = useGameLoop({
    canvasRef,
    dispatch,
    settings,
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
        onRestart={handleRestart}
      />
    );
  }

  const evolutionMenu = evolutionMenuState || DEFAULT_EVOLUTION_MENU;

  const handleEvolutionReroll = useCallback(() => {
    requestEvolutionReroll?.();
  }, [requestEvolutionReroll]);

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
        cameraZoom={cameraZoom ?? gameState.camera?.zoom ?? 1}
        onCameraZoomChange={setCameraZoom}
        onQuit={onQuit}
        opponents={opponents}
      />

      {showEvolutionChoice && (
        <div className={styles.evolutionOverlay}>
          <div className={styles.evolutionCard}>
            <h2 className={styles.evolutionTitle}>🧬 Evolução Nível {level}</h2>

            <div className={styles.rerollControls}>
              <button
                type="button"
                className={`${styles.rerollButton} ${
                  rerollAvailable ? '' : styles.rerollButtonDisabled
                }`.trim()}
                onClick={handleEvolutionReroll}
                aria-disabled={!rerollAvailable}
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
                >
                  {rerollAvailable ? 'Disponível' : 'MG insuficiente'}
                </span>
              </div>
            </div>

            <div className={styles.evolutionTabs}>
              {(['small', 'medium', 'large']).map((tierKey) => {
                const metadata = TIER_METADATA[tierKey];
                const isActive = evolutionMenu.activeTier === tierKey;
                const slots = evolutionSlots?.[tierKey] || { used: 0, max: 0 };
                return (
                  <div
                    key={tierKey}
                    className={`${styles.evolutionTab} ${isActive ? styles.evolutionTabActive : styles.evolutionTabDisabled}`.trim()}
                  >
                    <div className={styles.evolutionTabHeader}>
                      <span>{metadata.icon}</span>
                      <span>{metadata.label}</span>
                    </div>
                    <small className={styles.evolutionTabHint}>{metadata.description}</small>
                    <small className={styles.evolutionTabSlots}>
                      Slots {slots.used}/{slots.max}
                    </small>
                  </div>
                );
              })}
            </div>

            <div className={styles.optionHeading}>
              {TIER_METADATA[evolutionMenu.activeTier]?.label || 'Evoluções'} disponíveis
            </div>
            <div className={styles.optionList}>
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
