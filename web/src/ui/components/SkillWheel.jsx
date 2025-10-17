import React from 'react';
import styles from './SkillWheel.module.css';
import {
  ELEMENT_ICONS,
  ELEMENT_LABELS,
  SKILL_TYPE_LABELS,
  STATUS_LABELS,
} from '../../shared/combat';

const SkillWheel = ({
  currentSkill,
  skillList = [],
  hasMultipleSkills,
  skillCooldownLabel,
  skillReadyPercent,
  onCycleSkill,
  touchControlsActive = false,
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

  const resolveCostLabel = (skill) => {
    if (!skill) return '0⚡';
    const cost = skill.cost ?? {};
    const energy = Number.isFinite(cost.energy) ? cost.energy : Number.isFinite(skill.cost) ? skill.cost : 0;
    const xp = Number.isFinite(cost.xp) ? cost.xp : 0;
    const mg = Number.isFinite(cost.mg) ? cost.mg : 0;
    const parts = [];
    if (energy > 0) parts.push(`${energy}⚡`);
    if (xp > 0) parts.push(`${xp}XP`);
    if (mg > 0) parts.push(`${mg}MG`);
    return parts.length > 0 ? parts.join(' · ') : '0⚡';
  };

  const readinessPercent = Math.max(0, Math.min(100, Math.round(skillReadyPercent)));
  const readinessStatus = readinessPercent >= 100 ? 'Pronta' : `${readinessPercent}% recarregada`;

  const cycleButtonLabel = touchControlsActive
    ? '🔁 Trocar habilidade'
    : '🔁 Trocar habilidade (R)';

  const hintContent = touchControlsActive
    ? 'Toque no botão de habilidade para usar.'
    : 'Q: usar habilidade • Shift: dash';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>
          {currentSkill ? `${currentSkill.icon} ${currentSkill.name}` : 'Sem habilidade ativa'}
        </span>
        {currentSkill && <span className={styles.cost}>{resolveCostLabel(currentSkill)}</span>}
      </div>

      <div className={styles.meta}>
        <span>
          Tipo: {currentSkill ? SKILL_TYPE_LABELS[currentSkill.type] ?? currentSkill.type ?? 'Ativa' : '--'}
        </span>
        <span>
          Elemento:{' '}
          {currentSkill
            ? `${ELEMENT_ICONS[currentSkill.element] ?? '🧬'} ${
                ELEMENT_LABELS[currentSkill.element] ?? currentSkill.element ?? 'Neutro'
              }`
            : '--'}
        </span>
        <span>Custo: {currentSkill ? resolveCostLabel(currentSkill) : '--'}</span>
        <span>{skillCooldownLabel}</span>
      </div>

      <div className={styles.progress}>
        <div
          role="progressbar"
          aria-label="Recarga da habilidade"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={readinessPercent}
          aria-valuetext={readinessStatus}
          className={styles.progressFill}
          style={{
            width: `${readinessPercent}%`,
            background: 'linear-gradient(90deg, #00D9FF, #7B2FFF)',
          }}
        />
      </div>
      <span className={styles.visuallyHidden}>Estado da habilidade: {readinessStatus}</span>

      {currentSkill?.applies?.length ? (
        <div className={styles.statusList}>
          {currentSkill.applies.map((status) => (
            <span key={status} className={styles.statusBadge}>
              {STATUS_LABELS[status] ?? status}
            </span>
          ))}
        </div>
      ) : null}

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
              <div
                key={skill.key}
                className={itemClass}
                title={`${skill.name} • ${ELEMENT_LABELS[skill.element] ?? skill.element ?? '—'} (${SKILL_TYPE_LABELS[skill.type] ?? skill.type ?? 'Ativa'})`}
              >
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
          {cycleButtonLabel}
        </button>
      )}

      {hintContent ? <div className={styles.hint}>{hintContent}</div> : null}
    </div>
  );
};

export default SkillWheel;
