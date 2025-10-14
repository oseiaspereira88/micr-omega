import React, { useCallback, useMemo, useRef } from 'react';

import { forms, evolutionaryTraits } from '../config';
import GameHud from '../../ui/components/GameHud';
import GameOverScreen from '../../ui/components/GameOverScreen';
import styles from '../../MicroOmegaGame.module.css';
import { useGameDispatch, useGameState } from './GameContext';
import useGameLoop from './useGameLoop';
import useIsTouchDevice from '../../hooks/useIsTouchDevice';

const GameCanvas = ({ settings, onQuit }) => {
  const canvasRef = useRef(null);
  const gameState = useGameState();
  const dispatch = useGameDispatch();

  const { joystick, inputActions, chooseTrait, chooseForm, restartGame, setCameraZoom } = useGameLoop({
    canvasRef,
    dispatch,
    settings,
  });

  const isTouchDevice = useIsTouchDevice();

  const skillData = useMemo(() => {
    const currentSkillInfo = gameState.currentSkill;
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
      (currentSkillInfo ? gameState.energy < currentSkillInfo.cost : true);
    const skillCooldownLabel = currentSkillInfo
      ? skillCoolingDown
        ? `${skillCooldownRemaining.toFixed(1)}s`
        : 'Pronta'
      : 'Sem habilidade';
    const skillCooldownPercent = currentSkillInfo && skillMaxCooldown
      ? Math.max(0, Math.min(100, (skillCooldownRemaining / skillMaxCooldown) * 100))
      : 0;

    return {
      currentSkill: currentSkillInfo,
      skillList: gameState.skillList,
      hasMultipleSkills: gameState.hasMultipleSkills,
      skillCooldownLabel,
      skillReadyPercent,
      skillCooldownPercent,
      skillCoolingDown,
      skillDisabled,
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

  const traitOptions = gameState.availableTraits || [];
  const formOptions = gameState.availableForms || [];
  const currentForm = gameState.currentForm;
  const formReapplyNotice = gameState.formReapplyNotice;

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
        bossActive={gameState.bossActive}
        bossHealth={gameState.bossHealth}
        bossMaxHealth={gameState.bossMaxHealth}
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
      />

      {gameState.showEvolutionChoice && (
        <div className={styles.evolutionOverlay}>
          <div className={styles.evolutionCard}>
            <h2 className={styles.evolutionTitle}>🧬 Evolução Nível {gameState.level}</h2>

            {gameState.evolutionType === 'skill' ? (
              <>
                <h3 className={styles.optionHeading}>Escolha uma Habilidade:</h3>
                <div className={styles.optionList}>
                  {traitOptions.map((traitKey) => {
                    const trait = evolutionaryTraits[traitKey];
                    if (!trait) return null;

                    return (
                      <div
                        key={traitKey}
                        className={styles.traitCard}
                        style={{
                          background: `linear-gradient(90deg, ${trait.color}33, ${trait.color}11)`,
                          border: `2px solid ${trait.color}`,
                        }}
                        onClick={() => chooseTrait(traitKey)}
                      >
                        <div className={styles.traitTitle} style={{ color: trait.color }}>
                          {trait.icon} {trait.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h3 className={styles.optionHeading}>Escolha uma Forma:</h3>
                {formReapplyNotice && (
                  <p className={styles.formNotice}>
                    Reaplicar a forma atual não concede bônus adicional.
                  </p>
                )}
                <div className={styles.optionList}>
                  {formOptions.map((formKey) => {
                    const form = forms[formKey];
                    if (!form) return null;

                    const isCurrentForm = formKey === currentForm;
                    const cardClassName = `${styles.formCard} ${isCurrentForm ? styles.formCardCurrent : ''}`;

                    return (
                      <div
                        key={formKey}
                        className={cardClassName.trim()}
                        onClick={() => chooseForm(formKey)}
                      >
                        <div className={styles.formTitle}>
                          {form.icon} {form.name}
                        </div>
                        {isCurrentForm && (
                          <div className={styles.formHint}>Forma atual — sem bônus adicional</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
