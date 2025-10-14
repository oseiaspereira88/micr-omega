import React from 'react';
import styles from './SkillWheel.module.css';

const SkillWheel = ({
  currentSkill,
  skillList = [],
  hasMultipleSkills,
  skillCooldownLabel,
  skillReadyPercent,
  onCycleSkill,
}) => {
  const shouldRender = currentSkill || skillList.length > 0;

  if (!shouldRender) {
    return null;
  }

  const handleCycleClick = () => {
    onCycleSkill?.(1);
  };

  const handleCyclePointerDown = (event) => {
    const pointerType = event.pointerType ?? event.nativeEvent?.pointerType;
    if (pointerType && (pointerType === 'touch' || pointerType === 'pen' || pointerType === 'stylus')) {
      event.preventDefault();
      onCycleSkill?.(1);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>
          {currentSkill ? `${currentSkill.icon} ${currentSkill.name}` : 'Sem habilidade ativa'}
        </span>
        {currentSkill && <span className={styles.cost}>{currentSkill.cost}⚡</span>}
      </div>

      <div className={styles.meta}>
        <span>Custo: {currentSkill ? currentSkill.cost : '--'}⚡</span>
        <span>{skillCooldownLabel}</span>
      </div>

      <div className={styles.progress}>
        <div style={{ width: `${skillReadyPercent}%`, height: '100%', background: 'linear-gradient(90deg, #00D9FF, #7B2FFF)' }} />
      </div>

      {skillList.length > 0 && (
        <div className={styles.skills}>
          {skillList.map(skill => {
            const cooldownPercent = skill.maxCooldown
              ? Math.max(0, Math.min(100, (skill.cooldown / skill.maxCooldown) * 100))
              : 0;

            const itemClass = skill.isActive
              ? `${styles.skillItem} ${styles.skillItemActive}`
              : styles.skillItem;

            return (
              <div key={skill.key} className={itemClass} title={skill.name}>
                <span>{skill.icon}</span>
                {skill.cooldown > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${Math.max(0, Math.min(100, cooldownPercent))}%`,
                      background: 'rgba(0, 0, 0, 0.55)',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasMultipleSkills && (
        <button
          type="button"
          className={styles.cycleButton}
          onClick={handleCycleClick}
          onPointerDown={handleCyclePointerDown}
        >
          🔁 Trocar habilidade (R)
        </button>
      )}

      <div className={styles.hint}>Q: usar habilidade • Shift: dash</div>
    </div>
  );
};

export default SkillWheel;
