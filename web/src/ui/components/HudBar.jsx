import React, { useCallback, useMemo } from 'react';
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

const summarizeSlot = (slot, formatValue = (value) => value) => {
  const used = Math.max(0, Math.floor(sanitizeNumber(slot?.used)));
  const max = Math.max(0, Math.floor(sanitizeNumber(slot?.max)));
  return `${formatValue(used)}/${formatValue(max)}`;
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
  isMinimized = false,
}) => {
  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);
  const formatNumber = useCallback((value) => numberFormatter.format(value), [numberFormatter]);

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

  const energyDisplay = formatNumber(safeEnergy);
  const healthDisplay = `${formatNumber(safeHealth)}/${formatNumber(safeMaxHealth)}`;
  const dashDisplay = `${formatNumber(safeDashCharge)}%`;
  const mgDisplay = formatNumber(mgCurrent);
  const pcDisplay = `${formatNumber(pcAvailable)}/${formatNumber(pcTotal)}`;
  const comboDisplay = `x${formatNumber(safeCombo)}`;
  const maxComboDisplay = `x${formatNumber(safeMaxCombo)}`;

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

  const minimized = Boolean(isMinimized);
  const statsClassName = minimized
    ? `${styles.stats} ${styles.statsCompact}`.trim()
    : styles.stats;

  const renderBadge = ({ key, icon, label, value, style, className, ariaLabel }) => (
    <div
      key={key}
      className={[styles.badge, className].filter(Boolean).join(' ')}
      style={style}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span className={styles.badgeIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.badgeContent}>
        <span className={styles.badgeLabel}>{label}</span>
        <span className={styles.badgeValue}>{value}</span>
      </span>
    </div>
  );

  const primaryBadges = [
    {
      key: 'energy',
      icon: '⚡',
      label: 'Energia',
      value: energyDisplay,
      style: { background: 'rgba(0, 217, 255, 0.2)' },
      ariaLabel: `Energia atual: ${energyDisplay}`,
    },
    {
      key: 'health',
      icon: '❤️',
      label: 'Vida',
      value: healthDisplay,
      style: { background: 'rgba(255, 100, 100, 0.2)' },
      ariaLabel: `Vida atual: ${formatNumber(safeHealth)} de ${formatNumber(safeMaxHealth)}`,
    },
    {
      key: 'dash',
      icon: '💨',
      label: 'Dash',
      value: dashDisplay,
      style: { background: 'rgba(255, 200, 0, 0.2)' },
      ariaLabel: `Carga de dash disponível: ${dashDisplay}`,
    },
    {
      key: 'geneticMaterial',
      icon: '🧬',
      label: 'MG',
      value: mgDisplay,
      style: { background: 'rgba(0, 255, 170, 0.18)' },
      ariaLabel: `Material genético disponível: ${mgDisplay}`,
    },
    {
      key: 'characteristicPoints',
      icon: '🧠',
      label: 'PC',
      value: pcDisplay,
      style: { background: 'rgba(90, 130, 255, 0.18)' },
      ariaLabel: `Pontos de característica disponíveis: ${formatNumber(
        pcAvailable
      )} de ${formatNumber(pcTotal)}`,
    },
  ];

  return (
    <>
      <div className={styles.header}>
        <div className={styles.title}>MicrΩ • Nv.{safeLevel} • {formatNumber(safeScore)} pts</div>
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

      <div className={statsClassName}>
        {primaryBadges.map(renderBadge)}
        {safeCombo > 1 && (
          renderBadge({
            key: 'combo',
            icon: '🔥',
            label: 'Combo',
            value: comboDisplay,
            style: { background: 'rgba(255, 80, 0, 0.25)' },
            className: styles.comboBadge,
            ariaLabel: `Combo atual: ${comboDisplay}`,
          })
        )}
        {safeMaxCombo > 0 && (
          renderBadge({
            key: 'maxCombo',
            icon: '🏅',
            label: 'Combo máx.',
            value: maxComboDisplay,
            style: { background: 'rgba(255, 255, 255, 0.1)' },
            className: styles.maxComboBadge,
            ariaLabel: `Melhor combo: ${maxComboDisplay}`,
          })
        )}
        {resistanceEntries.length > 0 && !minimized && (
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
        {statusBadges.length > 0 && !minimized && (
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
        {!minimized && (
          <>
            <div className={styles.progressRow}>
              <div className={styles.xpPanel}>
                <div className={styles.xpHeader}>XP {formatNumber(xpCurrent)} / {formatNumber(xpNext)}</div>
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
                <span>Pequena: {summarizeSlot(evolutionSlots?.small, formatNumber)}</span>
                <span>Média: {summarizeSlot(evolutionSlots?.medium, formatNumber)}</span>
                <span>Grande: {summarizeSlot(evolutionSlots?.large, formatNumber)}</span>
                {evolutionSlots?.macro && (
                  <span>Macro: {summarizeSlot(evolutionSlots?.macro, formatNumber)}</span>
                )}
              </div>
            </div>
            <div className={styles.resourceGrid}>
              <div className={styles.resourceCard}>
                <div className={styles.resourceTitle}>Fragmentos</div>
                <div className={styles.resourceValues}>
                  <span>Menor {formatNumber(fragmentCounters.minor)}</span>
                  <span>Maior {formatNumber(fragmentCounters.major)}</span>
                  <span>Ápice {formatNumber(fragmentCounters.apex)}</span>
                </div>
              </div>
              <div className={styles.resourceCard}>
                <div className={styles.resourceTitle}>Genes estáveis</div>
                <div className={styles.resourceValues}>
                  <span>Menor {formatNumber(stableCounters.minor)}</span>
                  <span>Maior {formatNumber(stableCounters.major)}</span>
                  <span>Ápice {formatNumber(stableCounters.apex)}</span>
                </div>
              </div>
              <div className={styles.resourceCard}>
                <div className={styles.resourceTitle}>Reroll</div>
                <div className={styles.resourceValues}>
                  <span>Custo {formatNumber(rerollCost)} MG</span>
                  <span>Usado {formatNumber(rerollCount)}x</span>
                  <span>Piedade {formatNumber(dropPityFragment)}/{formatNumber(dropPityStableGene)}</span>
                </div>
              </div>
              <div className={styles.resourceCard}>
                <div className={styles.resourceTitle}>Últimos ganhos</div>
                <div className={styles.resourceValues}>
                  <span>XP +{formatNumber(recentRewardsSummary.xp)}</span>
                  <span>MG +{formatNumber(recentRewardsSummary.geneticMaterial)}</span>
                  <span>Frags +{formatNumber(recentRewardsSummary.fragments)}</span>
                  <span>Genes +{formatNumber(recentRewardsSummary.stableGenes)}</span>
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
          </>
        )}
      </div>
    </>
  );
};

export default HudBar;
