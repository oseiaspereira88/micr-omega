import React from 'react';
import styles from './TouchControls.module.css';

const joinClassNames = (...classes) => classes.filter(Boolean).join(' ');

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
  const dashReady = dashCharge >= 30;
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

  const evolveAriaLabel = canEvolve
    ? 'Abrir menu de evolução'
    : 'Abrir menu de evolução — indisponível';

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
        onTouchStart={event => {
          event.preventDefault();
          onAttackPress?.();
        }}
        onTouchEnd={event => {
          event.preventDefault();
          onAttackRelease?.();
        }}
        onMouseDown={onAttackPress}
        onMouseUp={onAttackRelease}
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
        onTouchStart={event => {
          event.preventDefault();
          if (dashReady) {
            onDash?.();
          }
        }}
        disabled={!dashReady}
      >
        💨
      </button>

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
        onTouchStart={event => {
          event.preventDefault();
          onUseSkill?.();
        }}
        disabled={skillDisabled}
        title="Q: usar habilidade"
      >
        <span>{hasCurrentSkill ? currentSkillIcon : '🌀'}</span>
        <span
          className={styles.skillLabel}
          style={{ color: skillDisabled ? '#fff' : '#001' }}
        >
          {hasCurrentSkill ? (skillCoolingDown ? skillCooldownLabel : currentSkillCost) : '--'}
        </span>
        {hasCurrentSkill && skillCoolingDown && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: `${Math.max(0, Math.min(100, skillCooldownPercent))}%`,
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '0 0 32px 32px',
              pointerEvents: 'none',
            }}
          />
        )}
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
