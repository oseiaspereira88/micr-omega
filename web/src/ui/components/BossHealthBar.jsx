import React from 'react';
import styles from './BossHealthBar.module.css';

const BossHealthBar = ({ active, health, maxHealth }) => {
  if (!active) {
    return null;
  }

  const percent = Math.max(0, Math.min(100, (health / (maxHealth || 1)) * 100));
  const bossName = 'Mega-organismo';

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
