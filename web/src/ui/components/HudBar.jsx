import React from 'react';
import styles from './HudBar.module.css';

const HudBar = ({
  level,
  score,
  energy,
  health,
  maxHealth,
  dashCharge,
  combo,
  maxCombo,
  activePowerUps = [],
}) => {
  return (
    <>
      <div className={styles.header}>
        <div className={styles.title}>MicrΩ • Nv.{level} • {score} pts</div>
      </div>

      <div className={styles.stats}>
        <div className={styles.badge} style={{ background: 'rgba(0, 217, 255, 0.2)' }}>
          ⚡ {Math.floor(energy)}
        </div>
        <div className={styles.badge} style={{ background: 'rgba(255, 100, 100, 0.2)' }}>
          ❤️ {Math.floor(health)}/{maxHealth}
        </div>
        <div className={styles.badge} style={{ background: 'rgba(255, 200, 0, 0.2)' }}>
          💨 {Math.floor(dashCharge)}%
        </div>
        {combo > 1 && (
          <div className={`${styles.badge} ${styles.comboBadge}`} style={{ background: 'rgba(255, 80, 0, 0.25)' }}>
            🔥 Combo x{combo}
          </div>
        )}
        {maxCombo > 0 && (
          <div className={`${styles.badge} ${styles.maxComboBadge}`} style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
            🏅 Máx x{maxCombo}
          </div>
        )}
        {activePowerUps.length > 0 && (
          <div className={styles.powerUps}>
            {activePowerUps.map(power => {
              const percent = power.duration
                ? Math.max(0, Math.min(100, (power.remaining / power.duration) * 100))
                : 0;

              return (
                <div
                  key={power.type}
                  className={styles.powerUpCard}
                  style={{ background: `${power.color}22`, border: `1px solid ${power.color}` }}
                >
                  <div className={styles.powerUpTitle} style={{ color: power.color }}>
                    {power.icon} {power.name}
                  </div>
                  <div className={styles.powerUpBar}>
                    <div style={{ width: `${percent}%`, height: '100%', background: power.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default HudBar;
