import React, { useCallback, useMemo, useRef } from 'react';
import GameHud from '../../ui/components/GameHud';
import GameOverScreen from '../../ui/components/GameOverScreen';
import ArchetypeSelection from '../../ui/components/ArchetypeSelection';
import styles from '../../MicroOmegaGame.module.css';
import { useGameDispatch, useGameState } from './GameContext';
import useGameLoop from './useGameLoop';
import useIsTouchDevice from '../../hooks/useIsTouchDevice';

const GameCanvas = ({ settings, onQuit }) => {
  const canvasRef = useRef(null);
  const gameState = useGameState();
  const dispatch = useGameDispatch();

  const {
    joystick,
    inputActions,
    chooseEvolution,
    restartGame,
    selectArchetype,
    setCameraZoom,
  } = useGameLoop({
    canvasRef,
    dispatch,
    settings,
  });

  const isTouchDevice = useIsTouchDevice();

  const skillData = useMemo(() => {
    const currentSkillInfo = gameState.currentSkill;
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
      gameState.energy < currentCost.energy ||
      (gameState.xp?.current ?? 0) < currentCost.xp ||
      (gameState.geneticMaterial?.current ?? 0) < currentCost.mg;
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
      skillList: gameState.skillList,
      hasMultipleSkills: gameState.hasMultipleSkills,
      skillCooldownLabel,
      skillReadyPercent,
      skillCooldownPercent,
      skillCoolingDown,
      skillDisabled,
      costLabel,
      costBreakdown: currentCost,
    };
  }, [gameState]);

  const handleRestart = useCallback(() => {
    if (onQuit) {
      onQuit();
      return;
    }

    restartGame();
  }, [onQuit, restartGame]);

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

  const evolutionMenu = gameState.evolutionMenu || {
    activeTier: 'small',
    options: { small: [], medium: [], large: [] },
  };
  const currentForm = gameState.currentForm;

  const tierMetadata = useMemo(
    () => ({
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
    }),
    []
  );

  const formatCost = useCallback((cost = {}) => {
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
  }, []);

  const formatRequirements = useCallback((requirements = {}) => {
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
  }, []);

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <GameHud
        level={gameState.level}
        score={gameState.score}
        energy={gameState.energy}
        health={gameState.health}
        maxHealth={gameState.maxHealth}
        dashCharge={gameState.dashCharge}
        combo={gameState.combo}
        maxCombo={gameState.maxCombo}
        activePowerUps={gameState.activePowerUps}
        xp={gameState.xp}
        geneticMaterial={gameState.geneticMaterial}
        characteristicPoints={gameState.characteristicPoints}
        geneFragments={gameState.geneFragments}
        stableGenes={gameState.stableGenes}
        evolutionSlots={gameState.evolutionSlots}
        reroll={gameState.reroll}
        dropPity={gameState.dropPity}
        recentRewards={gameState.recentRewards}
        bossActive={gameState.bossActive}
        bossHealth={gameState.bossHealth}
        bossMaxHealth={gameState.bossMaxHealth}
        element={gameState.element}
        affinity={gameState.affinity}
        elementLabel={gameState.elementLabel}
        affinityLabel={gameState.affinityLabel}
        resistances={gameState.resistances}
        statusEffects={gameState.statusEffects ?? []}
        skillData={skillData}
        notifications={gameState.notifications}
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
        canEvolve={gameState.canEvolve}
        showTouchControls={Boolean(settings?.showTouchControls && isTouchDevice)}
        cameraZoom={gameState.cameraZoom ?? gameState.camera?.zoom ?? 1}
        onCameraZoomChange={setCameraZoom}
        onQuit={onQuit}
        opponents={gameState.opponents}
      />

      {gameState.showEvolutionChoice && (
        <div className={styles.evolutionOverlay}>
          <div className={styles.evolutionCard}>
            <h2 className={styles.evolutionTitle}>🧬 Evolução Nível {gameState.level}</h2>

            <div className={styles.evolutionTabs}>
              {(['small', 'medium', 'large']).map((tierKey) => {
                const metadata = tierMetadata[tierKey];
                const isActive = evolutionMenu.activeTier === tierKey;
                const slots = gameState.evolutionSlots?.[tierKey] || { used: 0, max: 0 };
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
              {tierMetadata[evolutionMenu.activeTier]?.label || 'Evoluções'} disponíveis
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
                      <span>{formatCost(option.cost)}</span>
                    </div>
                    <div className={styles.evolutionOptionRow}>
                      <span className={styles.evolutionOptionLabel}>Requisitos</span>
                      <span>{formatRequirements(option.requirements)}</span>
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

      {gameState.archetypeSelection?.pending && (
        <ArchetypeSelection
          selection={gameState.archetypeSelection}
          selected={gameState.selectedArchetype}
          onSelect={selectArchetype}
        />
      )}
    </div>
  );
};

export default GameCanvas;
