import React from 'react';
import styles from './BossHealthBar.module.css';

const toSafeNumber = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const DEFAULT_BOSS_NAME = 'Mega-organismo';

const resolveBossName = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return DEFAULT_BOSS_NAME;
};

const SEGMENT_COUNT = 4;
const SEGMENT_MARKERS = Array.from({ length: SEGMENT_COUNT - 1 }, (_, index) => ({
  id: index,
  percent: ((index + 1) / SEGMENT_COUNT) * 100,
}));

const BossHealthBar = ({ active, health, maxHealth, name, portrait }) => {
  const legendId = React.useId();

  if (!active) {
    return null;
  }

  const safeHealth = Math.max(0, toSafeNumber(health, 0));
  const safeMaxHealth = Math.max(1, toSafeNumber(maxHealth, Math.max(1, safeHealth || 1)));
  const rawPercent = (safeHealth / safeMaxHealth) * 100;
  const percent = Math.max(0, Math.min(100, Number.isFinite(rawPercent) ? rawPercent : 0));
  const bossName = resolveBossName(name);
  const isLowHealth = percent <= 20;
  const segmentSize = 100 / SEGMENT_COUNT;
  const phaseIndex = Math.min(
    SEGMENT_COUNT - 1,
    Math.floor((100 - percent) / segmentSize)
  );
  const currentPhase = phaseIndex + 1;
  const legendText = isLowHealth ? 'Enfurecido!' : `Fase ${currentPhase}`;

  return (
    <div className={styles.container}>
      <div className={styles.infoSection}>
        <div className={styles.header}>
          <span className={styles.name} title={bossName}>
            ⚠️ {bossName}
          </span>
          <span className={styles.percent}>{Math.round(percent)}%</span>
        </div>
        <div className={styles.legend} id={legendId} role="note" aria-live="polite">
          {legendText}
        </div>
      </div>
      <div className={styles.portraitSlot} aria-hidden={portrait ? undefined : 'true'}>
        {portrait}
      </div>
      <div className={styles.progressWrapper}>
        <div
          className={styles.progress}
          role="progressbar"
          aria-label={bossName}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-describedby={legendId}
        >
          <div
            className={`${styles.fill} ${isLowHealth ? styles.lowHealth : ''}`}
            style={{ width: `${percent}%` }}
          />
          <div className={styles.segmentMarkers} aria-hidden="true">
            {SEGMENT_MARKERS.map((marker) => (
              <span
                key={marker.id}
                className={styles.segmentMarker}
                style={{ left: `${marker.percent}%` }}
                data-segment-marker
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BossHealthBar;
