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

const BossHealthBar = ({ active, health, maxHealth, name }) => {
  if (!active) {
    return null;
  }

  const safeHealth = Math.max(0, toSafeNumber(health, 0));
  const safeMaxHealth = Math.max(1, toSafeNumber(maxHealth, Math.max(1, safeHealth || 1)));
  const rawPercent = (safeHealth / safeMaxHealth) * 100;
  const percent = Math.max(0, Math.min(100, Number.isFinite(rawPercent) ? rawPercent : 0));
  const bossName = resolveBossName(name);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>⚠️ {bossName}</span>
        <span>{Math.round(percent)}%</span>
      </div>
      <div
        className={styles.progress}
        role="progressbar"
        aria-label={bossName}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

export default BossHealthBar;
