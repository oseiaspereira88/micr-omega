import React, { useMemo } from 'react';
import styles from './HudBar.module.css';
import {
  AFFINITY_ICONS,
  AFFINITY_LABELS,
  AFFINITY_TYPES,
  ELEMENT_ICONS,
  ELEMENT_LABELS,
  ELEMENT_TYPES,
} from '../../shared/combat';

const sanitizeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const summarizeSlot = (slot) => {
  const used = Math.max(0, Math.floor(sanitizeNumber(slot?.used)));
  const max = Math.max(0, Math.floor(sanitizeNumber(slot?.max)));
  return `${used}/${max}`;
};

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
  statusEffects = [],
  xp,
  geneticMaterial,
  characteristicPoints,
  geneFragments,
  stableGenes,
  evolutionSlots,
  reroll,
  dropPity,
  recentRewards,
  element,
  affinity,
  elementLabel,
  affinityLabel,
  resistances,
}) => {
  const safeLevel = Math.max(0, Math.floor(sanitizeNumber(level)));
  const safeScore = Math.max(0, Math.floor(sanitizeNumber(score)));
  const safeEnergy = Math.max(0, Math.floor(sanitizeNumber(energy)));
  const safeHealth = Math.max(0, Math.floor(sanitizeNumber(health)));
  const safeMaxHealth = Math.max(
    0,
    Math.floor(sanitizeNumber(maxHealth ?? safeHealth, safeHealth))
  );
  const safeDashCharge = Math.max(
    0,
    Math.min(100, Math.floor(sanitizeNumber(dashCharge)))
  );
  const safeCombo = Math.max(0, Math.floor(sanitizeNumber(combo)));
  const safeMaxCombo = Math.max(0, Math.floor(sanitizeNumber(maxCombo)));

  const xpCurrent = Math.max(0, Math.floor(sanitizeNumber(xp?.current)));
  const xpNext = Math.max(1, Math.floor(sanitizeNumber(xp?.next ?? 1, 1)));
  const xpPercent = Math.max(0, Math.min(1, xpCurrent / xpNext));

  const mgCurrent = Math.max(0, Math.floor(sanitizeNumber(geneticMaterial?.current)));
  const pcAvailable = Math.max(0, Math.floor(sanitizeNumber(characteristicPoints?.available)));
  const pcTotal = Math.max(
    pcAvailable,
    Math.floor(sanitizeNumber(characteristicPoints?.total ?? pcAvailable, pcAvailable))
  );

  const rerollBaseCost = sanitizeNumber(reroll?.baseCost ?? 25, 25);
  const rerollCost = Math.max(
    0,
    Math.floor(sanitizeNumber(reroll?.cost ?? rerollBaseCost, rerollBaseCost))
  );
  const rerollCount = Math.max(0, Math.floor(sanitizeNumber(reroll?.count)));

  const fragmentCounters = {
    minor: Math.max(0, Math.floor(sanitizeNumber(geneFragments?.minor))),
    major: Math.max(0, Math.floor(sanitizeNumber(geneFragments?.major))),
    apex: Math.max(0, Math.floor(sanitizeNumber(geneFragments?.apex))),
  };
  const stableCounters = {
    minor: Math.max(0, Math.floor(sanitizeNumber(stableGenes?.minor))),
    major: Math.max(0, Math.floor(sanitizeNumber(stableGenes?.major))),
    apex: Math.max(0, Math.floor(sanitizeNumber(stableGenes?.apex))),
  };

  const dropPityFragment = Math.max(0, Math.floor(sanitizeNumber(dropPity?.fragment)));
  const dropPityStableGene = Math.max(0, Math.floor(sanitizeNumber(dropPity?.stableGene)));

  const recentRewardsSummary = {
    xp: Math.max(0, Math.floor(sanitizeNumber(recentRewards?.xp))),
    geneticMaterial: Math.max(0, Math.floor(sanitizeNumber(recentRewards?.geneticMaterial))),
    fragments: Math.max(0, Math.floor(sanitizeNumber(recentRewards?.fragments))),
    stableGenes: Math.max(0, Math.floor(sanitizeNumber(recentRewards?.stableGenes))),
  };

  const normalizedElement = element ?? ELEMENT_TYPES.BIO;
  const normalizedAffinity = affinity ?? AFFINITY_TYPES.NEUTRAL;
  const elementName = elementLabel ?? ELEMENT_LABELS[normalizedElement] ?? normalizedElement;
  const affinityName = affinityLabel ?? AFFINITY_LABELS[normalizedAffinity] ?? normalizedAffinity;
  const elementIcon = ELEMENT_ICONS[normalizedElement] ?? '🧬';
  const affinityIcon = AFFINITY_ICONS[normalizedAffinity] ?? '✨';
  const resistanceEntries = useMemo(
    () =>
      Object.entries(resistances || {})
        .map(([key, value]) => [key, sanitizeNumber(value)])
        .filter(([, value]) => Math.abs(value) >= 0.05)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 3),
    [resistances]
  );
  const statusBadges = useMemo(
    () =>
      (statusEffects || [])
        .map((entry) => ({
          key: entry.key,
          label: entry.label,
          icon: entry.icon,
          color: entry.color,
          stacks: Math.max(0, Math.floor(sanitizeNumber(entry.stacks))),
          remaining: Math.max(0, Math.ceil(sanitizeNumber(entry.remaining))),
        }))
        .slice(0, 4),
    [statusEffects]
  );
  const powerUpSummaries = useMemo(
    () =>
      (activePowerUps || []).map((power) => {
        const duration = Math.max(0, sanitizeNumber(power.duration));
        const remaining = Math.max(0, sanitizeNumber(power.remaining));
        const percent =
          duration > 0
            ? Math.max(0, Math.min(100, (remaining / duration) * 100))
            : 0;

        return {
          key: power.type,
          color: power.color,
          icon: power.icon,
          name: power.name,
          percent,
        };
      }),
    [activePowerUps]
  );

  return (
    <>
      <div className={styles.header}>
        <div className={styles.title}>MicrΩ • Nv.{safeLevel} • {safeScore} pts</div>
        <div className={styles.combatProfile}>
          <span className={styles.combatTag} title={`Elemento ${elementName}`}>
            {elementIcon} {elementName}
          </span>
          <span
            className={`${styles.combatTag} ${styles.affinityTag}`}
            title={`Afinidade ${affinityName}`}
          >
            {affinityIcon} {affinityName}
          </span>
        </div>
      </div>

      <div className={styles.stats}>
        <div className={styles.badge} style={{ background: 'rgba(0, 217, 255, 0.2)' }}>
          ⚡ {safeEnergy}
        </div>
        <div className={styles.badge} style={{ background: 'rgba(255, 100, 100, 0.2)' }}>
          ❤️ {safeHealth}/{safeMaxHealth}
        </div>
        <div className={styles.badge} style={{ background: 'rgba(255, 200, 0, 0.2)' }}>
          💨 {safeDashCharge}%
        </div>
        <div className={styles.badge} style={{ background: 'rgba(0, 255, 170, 0.18)' }}>
          🧬 MG {mgCurrent}
        </div>
        <div className={styles.badge} style={{ background: 'rgba(90, 130, 255, 0.18)' }}>
          🧠 PC {pcAvailable}/{pcTotal}
        </div>
        {safeCombo > 1 && (
          <div className={`${styles.badge} ${styles.comboBadge}`} style={{ background: 'rgba(255, 80, 0, 0.25)' }}>
            🔥 Combo x{safeCombo}
          </div>
        )}
        {safeMaxCombo > 0 && (
          <div className={`${styles.badge} ${styles.maxComboBadge}`} style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
            🏅 Máx x{safeMaxCombo}
          </div>
        )}
        {resistanceEntries.length > 0 && (
          <div className={styles.resistanceRow}>
            {resistanceEntries.map(([key, value]) => {
              const label = ELEMENT_LABELS[key] ?? key;
              const percent = Math.round(value * 100);
              const positive = value >= 0;
              const formatted = `${percent > 0 ? '+' : ''}${percent}%`;
              const title = `${positive ? 'Resistência' : 'Fraqueza'} ${label} ${formatted}`;
              return (
                <span
                  key={key}
                  className={`${styles.resistanceBadge} ${
                    positive ? styles.resistancePositive : styles.resistanceNegative
                  }`}
                  title={title}
                >
                  {positive ? '🛡️' : '⚠️'} {label} {formatted}
                </span>
              );
            })}
          </div>
        )}
        {statusBadges.length > 0 && (
          <div className={styles.statusRow}>
            {statusBadges.map((status) => (
              <span
                key={status.key}
                className={styles.statusBadge}
                style={{ background: `${status.color}22`, borderColor: `${status.color}55` }}
                title={`x${status.stacks} • ${status.label}`}
              >
                {status.icon} {status.remaining}s
              </span>
            ))}
          </div>
        )}
        <div className={styles.progressRow}>
          <div className={styles.xpPanel}>
            <div className={styles.xpHeader}>XP {xpCurrent} / {xpNext}</div>
            <div
              className={styles.xpBar}
              role="progressbar"
              aria-label="Progresso de XP"
              aria-valuenow={Math.round(xpPercent * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={styles.xpFill} style={{ width: `${xpPercent * 100}%` }} />
            </div>
          </div>
          <div className={styles.slotSummary}>
            <span>Pequena: {summarizeSlot(evolutionSlots?.small)}</span>
            <span>Média: {summarizeSlot(evolutionSlots?.medium)}</span>
            <span>Grande: {summarizeSlot(evolutionSlots?.large)}</span>
            {evolutionSlots?.macro && (
              <span>Macro: {summarizeSlot(evolutionSlots?.macro)}</span>
            )}
          </div>
        </div>
        <div className={styles.resourceGrid}>
          <div className={styles.resourceCard}>
            <div className={styles.resourceTitle}>Fragmentos</div>
            <div className={styles.resourceValues}>
              <span>Menor {fragmentCounters.minor}</span>
              <span>Maior {fragmentCounters.major}</span>
              <span>Ápice {fragmentCounters.apex}</span>
            </div>
          </div>
          <div className={styles.resourceCard}>
            <div className={styles.resourceTitle}>Genes estáveis</div>
            <div className={styles.resourceValues}>
              <span>Menor {stableCounters.minor}</span>
              <span>Maior {stableCounters.major}</span>
              <span>Ápice {stableCounters.apex}</span>
            </div>
          </div>
          <div className={styles.resourceCard}>
            <div className={styles.resourceTitle}>Reroll</div>
            <div className={styles.resourceValues}>
              <span>Custo {rerollCost} MG</span>
              <span>Usado {rerollCount}x</span>
              <span>Piedade {dropPityFragment}/{dropPityStableGene}</span>
            </div>
          </div>
          <div className={styles.resourceCard}>
            <div className={styles.resourceTitle}>Últimos ganhos</div>
            <div className={styles.resourceValues}>
              <span>XP +{recentRewardsSummary.xp}</span>
              <span>MG +{recentRewardsSummary.geneticMaterial}</span>
              <span>Frags +{recentRewardsSummary.fragments}</span>
              <span>Genes +{recentRewardsSummary.stableGenes}</span>
            </div>
          </div>
        </div>
        {powerUpSummaries.length > 0 && (
          <div className={styles.powerUps}>
            {powerUpSummaries.map((power) => (
              <div
                key={power.key}
                className={styles.powerUpCard}
                style={{ background: `${power.color}22`, border: `1px solid ${power.color}` }}
              >
                <div className={styles.powerUpTitle} style={{ color: power.color }}>
                  {power.icon} {power.name}
                </div>
                <div className={styles.powerUpBar}>
                  <div style={{ width: `${power.percent}%`, height: '100%', background: power.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default HudBar;
