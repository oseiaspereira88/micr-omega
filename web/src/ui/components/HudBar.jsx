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
  xp,
  geneticMaterial,
  characteristicPoints,
  geneFragments,
  stableGenes,
  evolutionSlots,
  reroll,
  dropPity,
  recentRewards,
}) => {
  const xpCurrent = Math.max(0, Math.floor(xp?.current ?? 0));
  const xpNext = Math.max(1, Math.floor(xp?.next ?? 1));
  const xpPercent = Math.max(0, Math.min(1, xpCurrent / xpNext));

  const mgCurrent = Math.floor(geneticMaterial?.current ?? 0);
  const pcAvailable = Math.floor(characteristicPoints?.available ?? 0);
  const pcTotal = Math.floor(characteristicPoints?.total ?? pcAvailable);

  const slotSummary = (slot) => {
    const used = Math.floor(slot?.used ?? 0);
    const max = Math.floor(slot?.max ?? 0);
    return `${used}/${max}`;
  };

  const rerollCost = Math.floor(reroll?.cost ?? reroll?.baseCost ?? 25);
  const rerollCount = Math.floor(reroll?.count ?? 0);

  const fragmentCounters = geneFragments || {};
  const stableCounters = stableGenes || {};

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
        <div className={styles.badge} style={{ background: 'rgba(0, 255, 170, 0.18)' }}>
          🧬 MG {mgCurrent}
        </div>
        <div className={styles.badge} style={{ background: 'rgba(90, 130, 255, 0.18)' }}>
          🧠 PC {pcAvailable}/{pcTotal}
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
        <div className={styles.progressRow}>
          <div className={styles.xpPanel}>
            <div className={styles.xpHeader}>XP {xpCurrent} / {xpNext}</div>
            <div className={styles.xpBar}>
              <div className={styles.xpFill} style={{ width: `${xpPercent * 100}%` }} />
            </div>
          </div>
          <div className={styles.slotSummary}>
            <span>Pequena: {slotSummary(evolutionSlots?.small)}</span>
            <span>Média: {slotSummary(evolutionSlots?.medium)}</span>
            <span>Grande: {slotSummary(evolutionSlots?.large)}</span>
          </div>
        </div>
        <div className={styles.resourceGrid}>
          <div className={styles.resourceCard}>
            <div className={styles.resourceTitle}>Fragmentos</div>
            <div className={styles.resourceValues}>
              <span>Menor {fragmentCounters.minor ?? 0}</span>
              <span>Maior {fragmentCounters.major ?? 0}</span>
              <span>Ápice {fragmentCounters.apex ?? 0}</span>
            </div>
          </div>
          <div className={styles.resourceCard}>
            <div className={styles.resourceTitle}>Genes estáveis</div>
            <div className={styles.resourceValues}>
              <span>Menor {stableCounters.minor ?? 0}</span>
              <span>Maior {stableCounters.major ?? 0}</span>
              <span>Ápice {stableCounters.apex ?? 0}</span>
            </div>
          </div>
          <div className={styles.resourceCard}>
            <div className={styles.resourceTitle}>Reroll</div>
            <div className={styles.resourceValues}>
              <span>Custo {rerollCost} MG</span>
              <span>Usado {rerollCount}x</span>
              <span>Piedade {dropPity?.fragment ?? 0}/{dropPity?.stableGene ?? 0}</span>
            </div>
          </div>
          <div className={styles.resourceCard}>
            <div className={styles.resourceTitle}>Últimos ganhos</div>
            <div className={styles.resourceValues}>
              <span>XP +{Math.floor(recentRewards?.xp ?? 0)}</span>
              <span>MG +{Math.floor(recentRewards?.geneticMaterial ?? 0)}</span>
              <span>Frags +{Math.floor(recentRewards?.fragments ?? 0)}</span>
              <span>Genes +{Math.floor(recentRewards?.stableGenes ?? 0)}</span>
            </div>
          </div>
        </div>
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
