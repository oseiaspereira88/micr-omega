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
  onUseSkill,
  touchControlsActive = false,
  layout,
  showTouchControls = false,
  touchLayout = 'right',
}) => {
  const shouldRender = currentSkill || skillList.length > 0;

  if (!shouldRender) {
    return null;
  }

  const resolvedLayout = layout ?? (touchControlsActive ? 'mobile' : 'desktop');
  const isMobileLayout = resolvedLayout === 'mobile';
  const usesTouchGuidance = touchControlsActive || isMobileLayout;
  const statusMessageId = React.useId();
  const containerRef = React.useRef(null);
  const [touchControlsFootprint, setTouchControlsFootprint] = React.useState(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const scheduleFrame =
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : callback => window.setTimeout(callback, 0);
    const cancelFrame =
      typeof window.cancelAnimationFrame === 'function'
        ? window.cancelAnimationFrame.bind(window)
        : window.clearTimeout.bind(window);

    const updateFootprint = () => {
      if (!containerRef.current) {
        return;
      }

      const computedStyle = window.getComputedStyle(containerRef.current);
      const footprintValue = computedStyle
        .getPropertyValue('--touch-controls-footprint')
        .trim();
      const numericValue = Number.parseFloat(footprintValue);

      if (Number.isFinite(numericValue) && numericValue > 0) {
        setTouchControlsFootprint(numericValue);
      } else {
        setTouchControlsFootprint(null);
      }
    };

    updateFootprint();

    let frameId = scheduleFrame(updateFootprint);
    let resizeObserver;

    if (containerRef.current && typeof window.ResizeObserver === 'function') {
      resizeObserver = new window.ResizeObserver(() => {
        updateFootprint();
      });
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', updateFootprint);

    return () => {
      window.removeEventListener('resize', updateFootprint);
      if (frameId !== null) {
        cancelFrame(frameId);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [touchControlsActive, showTouchControls, touchLayout]);

  const resolvedTouchLayout = touchLayout === 'left' ? 'left' : 'right';
  const hasMeasuredFootprint = Number.isFinite(touchControlsFootprint)
    ? touchControlsFootprint > 0
    : true;
  const shouldOffsetForTouchControls =
    isMobileLayout &&
    touchControlsActive &&
    showTouchControls &&
    hasMeasuredFootprint;
  const touchOffsetClass = shouldOffsetForTouchControls
    ? resolvedTouchLayout === 'left'
      ? styles.mobileOffsetLeft
      : styles.mobileOffsetRight
    : '';

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

  const handleUseClick = () => {
    onUseSkill?.();
  };

  const handleUsePointerDown = (event) => {
    const pointerType = event.pointerType ?? event.nativeEvent?.pointerType;
    if (pointerType && (pointerType === 'touch' || pointerType === 'pen' || pointerType === 'stylus')) {
      event.preventDefault();
      onUseSkill?.();
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
  const progressWheelClassName = [
    styles.progressWheel,
    readinessPercent >= 100 ? styles.progressWheelReady : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cycleButtonLabel = usesTouchGuidance
    ? '🔁 Trocar habilidade'
    : '🔁 Trocar habilidade (R)';

  const useButtonLabel = usesTouchGuidance
    ? '✨ Usar habilidade'
    : '✨ Usar habilidade (Q)';

  const hintContent = usesTouchGuidance
    ? 'Toque em “Usar habilidade” ou deslize para trocar.'
    : 'Q: usar habilidade • Shift: dash';

  const containerClassName = [
    styles.container,
    isMobileLayout ? styles.mobile : '',
    touchControlsActive ? styles.mobileWithTouchControls : '',
    touchOffsetClass,
  ]
    .filter(Boolean)
    .join(' ');
  const showUseButton = Boolean(currentSkill && onUseSkill);

  return (
    <div
      ref={containerRef}
      className={containerClassName}
      data-touch-footprint={
        Number.isFinite(touchControlsFootprint)
          ? Math.round(touchControlsFootprint)
          : undefined
      }
    >
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
          className={progressWheelClassName}
          style={{
            '--readiness': readinessPercent,
          }}
        >
          <div className={styles.progressValue}>
            <span className={styles.progressValueText}>
              {readinessPercent >= 100 ? 'Pronta' : `${readinessPercent}%`}
            </span>
          </div>
        </div>
      </div>
      <span
        id={statusMessageId}
        className={styles.visuallyHidden}
        role="status"
        aria-live="polite"
      >
        Estado da habilidade atual: {currentSkill ? `${currentSkill.name}. ${readinessStatus}` : readinessStatus}
      </span>

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
        <ul className={styles.skills}>
          {skillList.map(skill => {
            const cooldownValue = Number.isFinite(skill.cooldown) ? skill.cooldown : 0;
            const maxCooldownValue = Number.isFinite(skill.maxCooldown) ? skill.maxCooldown : 0;

            const cooldownFillPercent = maxCooldownValue
              ? Math.max(0, Math.min(100, (cooldownValue / maxCooldownValue) * 100))
              : 0;

            const readinessPercentForSkill = maxCooldownValue
              ? Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(
                      ((maxCooldownValue - cooldownValue) / maxCooldownValue) * 100 || 0,
                    ),
                  ),
                )
              : cooldownValue > 0
                ? 0
                : 100;

            const cooldownStatusLabel =
              readinessPercentForSkill >= 100
                ? 'Pronta para uso'
                : `${readinessPercentForSkill}% recarregada`;

            const itemClass = skill.isActive
              ? `${styles.skillItem} ${styles.skillItemActive}`
              : styles.skillItem;

            const elementLabel = ELEMENT_LABELS[skill.element] ?? skill.element ?? '—';
            const typeLabel = SKILL_TYPE_LABELS[skill.type] ?? skill.type ?? 'Ativa';

            return (
              <li
                key={skill.key}
                className={itemClass}
                title={`${skill.name} • ${elementLabel} (${typeLabel}) • ${cooldownStatusLabel}`}
                aria-label={`${skill.name}. Elemento: ${elementLabel}. Tipo: ${typeLabel}. ${cooldownStatusLabel}.`}
              >
                <span>{skill.icon}</span>
                <span className={styles.visuallyHidden}>
                  {`${skill.name}: ${cooldownStatusLabel}`}
                </span>
                {skill.cooldown > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: `${Math.max(0, Math.min(100, cooldownFillPercent))}%`,
                      background: 'rgba(0, 0, 0, 0.55)',
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(showUseButton || hasMultipleSkills) && (
        <div className={styles.actionRow}>
          {showUseButton && (
            <button
              type="button"
              className={`${styles.actionButton} ${styles.useButton}`}
              onClick={handleUseClick}
              onPointerDown={handleUsePointerDown}
              aria-describedby={statusMessageId}
            >
              {useButtonLabel}
            </button>
          )}
          {hasMultipleSkills && (
            <button
              type="button"
              className={`${styles.actionButton} ${styles.cycleButton}`}
              onClick={handleCycleClick}
              onPointerDown={handleCyclePointerDown}
              aria-describedby={statusMessageId}
            >
              {cycleButtonLabel}
            </button>
          )}
        </div>
      )}

      {hintContent ? <div className={styles.hint}>{hintContent}</div> : null}
    </div>
  );
};

export default SkillWheel;
