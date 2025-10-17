import React, { useId, useRef } from 'react';
import styles from './TouchControls.module.css';

const joinClassNames = (...classes) => classes.filter(Boolean).join(' ');

const clampProgress = value => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
};

const TouchControls = ({
  joystick,
  onJoystickStart,
  onJoystickMove,
  onJoystickEnd,
  onAttackPress,
  onAttackRelease,
  onAttack,
  onDash,
  dashCharge,
  onUseSkill,
  onCycleSkill,
  skillDisabled,
  skillCoolingDown,
  skillCooldownLabel,
  skillCooldownPercent,
  currentSkillIcon,
  currentSkillCost,
  hasCurrentSkill,
  onOpenEvolutionMenu,
  canEvolve,
}) => {
  const dashProgressId = useId();
  const skillProgressId = useId();
  const attackPointerActiveRef = useRef(false);
  const dashReady = dashCharge >= 30;
  const dashChargePercent = clampProgress(dashCharge);
  const dashValueText = dashReady
    ? 'Dash carregado'
    : `Dash carregando: ${dashChargePercent}%`;
  const dashAriaLabel = dashReady ? 'Usar dash — pronto' : 'Usar dash — carregando';

  let skillAriaLabel = 'Usar habilidade';
  if (!hasCurrentSkill) {
    skillAriaLabel = 'Usar habilidade — nenhuma habilidade equipada';
  } else if (skillDisabled) {
    skillAriaLabel = skillCoolingDown
      ? 'Usar habilidade — em recarga'
      : 'Usar habilidade — indisponível';
  } else {
    skillAriaLabel = 'Usar habilidade — pronta';
  }

  const skillCooldownPercentClamped = clampProgress(skillCooldownPercent);
  const showSkillCooldown = Boolean(hasCurrentSkill && skillCoolingDown);
  const skillCooldownDisplay = showSkillCooldown
    ? skillCooldownLabel || `${skillCooldownPercentClamped}%`
    : null;
  const skillLabelColorClass = !hasCurrentSkill || skillDisabled
    ? styles.skillLabelDisabled
    : styles.skillLabelReady;
  const skillValueNow = !hasCurrentSkill
    ? 0
    : showSkillCooldown
    ? skillCooldownPercentClamped
    : 100;
  const skillValueText = !hasCurrentSkill
    ? 'Nenhuma habilidade equipada'
    : showSkillCooldown
    ? `Habilidade em recarga: ${skillCooldownDisplay}`
    : 'Habilidade pronta';

  const evolveAriaLabel = canEvolve
    ? 'Abrir menu de evolução'
    : 'Abrir menu de evolução — indisponível';

  const cycleSkillAriaLabel = hasCurrentSkill
    ? 'Trocar habilidade equipada'
    : 'Trocar habilidade — nenhuma habilidade equipada';

  const startAttack = (event, { shouldPreventDefault = false } = {}) => {
    if (shouldPreventDefault) {
      event?.preventDefault?.();
    }

    attackPointerActiveRef.current = true;
    onAttackPress?.();
  };

  const endAttack = (event, { shouldPreventDefault = false } = {}) => {
    if (!attackPointerActiveRef.current) {
      return;
    }

    if (shouldPreventDefault) {
      event?.preventDefault?.();
    }

    attackPointerActiveRef.current = false;
    onAttackRelease?.();
  };

  const handleAttackTouchStart = event => {
    startAttack(event, { shouldPreventDefault: true });
  };

  const handleAttackTouchEnd = event => {
    endAttack(event, { shouldPreventDefault: true });
  };

  const handleAttackPointerDown = event => {
    if (event.pointerType === 'touch') {
      return;
    }

    startAttack(event);
  };

  const handleAttackPointerEnd = event => {
    if (event.pointerType === 'touch') {
      return;
    }

    endAttack(event);
  };

  const handleAttackMouseDown = event => {
    if (attackPointerActiveRef.current) {
      return;
    }

    startAttack(event);
  };

  const handleAttackMouseEnd = event => {
    endAttack(event);
  };

  const handleDashTouchEnd = event => {
    event.preventDefault();
  };

  const handleSkillTouchEnd = event => {
    event.preventDefault();
  };

  const handleCycleSkillTouchEnd = event => {
    event.preventDefault();
  };

  return (
    <div className={styles.touchLayer}>
      <div
        className={styles.joystickZone}
        onTouchStart={onJoystickStart}
        onTouchMove={onJoystickMove}
        onTouchEnd={onJoystickEnd}
        onTouchCancel={onJoystickEnd}
      >
        <div
          className={styles.joystickKnob}
          style={{
            background: joystick.isTouchActive ? 'rgba(0, 217, 255, 0.7)' : 'rgba(255, 255, 255, 0.4)',
            boxShadow: joystick.isTouchActive ? '0 0 20px rgba(0, 217, 255, 0.8)' : 'none',
            transform: `translate(${joystick.position.x}px, ${joystick.position.y}px)`,
            transition: joystick.isTouchActive ? 'none' : 'transform 0.2s',
          }}
        />
      </div>

      <button
        type="button"
        className={joinClassNames(styles.button, styles.attackButton)}
        aria-label="Executar ataque básico"
        onTouchStart={handleAttackTouchStart}
        onTouchEnd={handleAttackTouchEnd}
        onTouchCancel={handleAttackTouchEnd}
        onPointerDown={handleAttackPointerDown}
        onPointerUp={handleAttackPointerEnd}
        onPointerCancel={handleAttackPointerEnd}
        onPointerLeave={handleAttackPointerEnd}
        onMouseDown={handleAttackMouseDown}
        onMouseUp={handleAttackMouseEnd}
        onMouseLeave={handleAttackMouseEnd}
        onClick={event => {
          event.preventDefault();
          onAttack?.();
        }}
      >
        ⚔️
      </button>

      <button
        type="button"
        className={joinClassNames(
          styles.button,
          styles.dashButton,
          dashReady ? styles.chargeReady : styles.chargeEmpty,
          dashReady ? null : styles.disabled,
        )}
        onClick={onDash}
        aria-label={dashAriaLabel}
        aria-disabled={!dashReady}
        aria-describedby={dashProgressId}
        onTouchStart={event => {
          event.preventDefault();
          if (dashReady) {
            onDash?.();
          }
        }}
        onTouchEnd={handleDashTouchEnd}
        onTouchCancel={handleDashTouchEnd}
        disabled={!dashReady}
      >
        {!dashReady && (
          <div
            className={styles.cooldownOverlay}
            aria-hidden="true"
            style={{ '--cooldown-progress': `${100 - dashChargePercent}%` }}
          />
        )}
        <span className={styles.buttonIcon}>💨</span>
        <span className={joinClassNames(styles.cooldownLabel, styles.dashLabel)}>
          {dashReady ? 'Pronto' : `${dashChargePercent}%`}
        </span>
      </button>
      <div
        id={dashProgressId}
        className={styles.visuallyHidden}
        aria-live="polite"
      >
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={dashChargePercent}
          aria-valuetext={dashValueText}
        >
          {dashValueText}
        </div>
      </div>

      <button
        type="button"
        className={joinClassNames(
          styles.button,
          styles.skillButton,
          skillDisabled ? styles.skillDisabled : styles.skillReady,
          skillDisabled ? styles.disabled : null,
        )}
        onClick={onUseSkill}
        aria-label={skillAriaLabel}
        aria-disabled={skillDisabled}
        aria-describedby={skillProgressId}
        onTouchStart={event => {
          event.preventDefault();
          onUseSkill?.();
        }}
        onTouchEnd={handleSkillTouchEnd}
        onTouchCancel={handleSkillTouchEnd}
        disabled={skillDisabled}
        title="Q: usar habilidade"
      >
        {showSkillCooldown && (
          <div
            className={joinClassNames(styles.cooldownOverlay, styles.skillCooldownOverlay)}
            aria-hidden="true"
            style={{ '--cooldown-progress': `${100 - skillCooldownPercentClamped}%` }}
          />
        )}
        <span className={styles.buttonIcon}>
          {hasCurrentSkill ? currentSkillIcon : '🌀'}
        </span>
        {showSkillCooldown && (
          <span
            className={joinClassNames(styles.cooldownLabel, styles.skillCooldownLabel)}
          >
            {skillCooldownDisplay}
          </span>
        )}
        <span
          className={joinClassNames(
            styles.skillLabel,
            showSkillCooldown ? styles.skillLabelHidden : styles.skillCostLabel,
            skillLabelColorClass,
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {hasCurrentSkill ? (showSkillCooldown ? '' : currentSkillCost) : '--'}
        </span>
      </button>
      <div
        id={skillProgressId}
        className={styles.visuallyHidden}
        aria-live="polite"
      >
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={skillValueNow}
          aria-valuetext={skillValueText}
        >
          {skillValueText}
        </div>
      </div>

      <button
        type="button"
        className={joinClassNames(
          styles.button,
          styles.cycleSkillButton,
          hasCurrentSkill ? styles.cycleSkillReady : styles.disabled,
        )}
        onClick={event => {
          event.preventDefault();
          onCycleSkill?.();
        }}
        aria-label={cycleSkillAriaLabel}
        aria-disabled={!hasCurrentSkill}
        onTouchStart={event => {
          event.preventDefault();
          if (hasCurrentSkill) {
            onCycleSkill?.();
          }
        }}
        onTouchEnd={handleCycleSkillTouchEnd}
        onTouchCancel={handleCycleSkillTouchEnd}
        disabled={!hasCurrentSkill}
        title="E: trocar habilidade"
      >
        🔄
      </button>

      <button
        type="button"
        className={joinClassNames(
          styles.button,
          styles.evolveButton,
          canEvolve ? styles.evolveReady : styles.evolveLocked,
          canEvolve ? null : styles.disabled,
        )}
        onClick={onOpenEvolutionMenu}
        aria-label={evolveAriaLabel}
        aria-disabled={!canEvolve}
        disabled={!canEvolve}
      >
        🧬
      </button>
    </div>
  );
};

export default TouchControls;
