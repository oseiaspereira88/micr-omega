import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './GameOverScreen.module.css';

const numberFormatter = new Intl.NumberFormat('pt-BR');

const formatStat = (value) => {
  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return numberFormatter.format(numericValue);
  }

  return numberFormatter.format(0);
};

const focusableSelectors =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

const tierLabels = {
  small: 'Pequenas',
  medium: 'Médias',
  large: 'Grandes',
  macro: 'Macro',
};

const normalizeJourneyStats = (stats) => {
  const byTierSource = stats?.evolutionsByTier ?? {};

  const sanitizedByTier = {
    small: Number.isFinite(byTierSource.small) ? Math.max(0, byTierSource.small) : 0,
    medium: Number.isFinite(byTierSource.medium) ? Math.max(0, byTierSource.medium) : 0,
    large: Number.isFinite(byTierSource.large) ? Math.max(0, byTierSource.large) : 0,
    macro: Number.isFinite(byTierSource.macro) ? Math.max(0, byTierSource.macro) : 0,
  };

  const totalFromTiers = Object.values(sanitizedByTier).reduce((acc, value) => acc + value, 0);
  const providedTotal = Number.isFinite(stats?.evolutionsTotal) ? Math.max(0, stats.evolutionsTotal) : 0;

  return {
    elapsedMs: Number.isFinite(stats?.elapsedMs) ? Math.max(0, stats.elapsedMs) : 0,
    xpTotal: Number.isFinite(stats?.xpTotal) ? Math.max(0, stats.xpTotal) : 0,
    mgTotal: Number.isFinite(stats?.mgTotal) ? Math.max(0, stats.mgTotal) : 0,
    evolutionsTotal: Math.max(totalFromTiers, providedTotal),
    evolutionsByTier: sanitizedByTier,
  };
};

const formatDuration = (milliseconds) => {
  const safeMs = Number.isFinite(milliseconds) ? Math.max(0, milliseconds) : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${hours > 0 ? String(minutes).padStart(2, '0') : minutes}m`);
  parts.push(`${String(seconds).padStart(2, '0')}s`);

  return parts.join(' ');
};

const GameOverScreen = ({ score, level, maxCombo, journeyStats, onRestart, onQuit }) => {
  const dialogRef = useRef(null);
  const focusableElementsRef = useRef([]);
  const formattedScore = formatStat(score);
  const formattedLevel = formatStat(level);
  const formattedMaxCombo = formatStat(maxCombo);
  const titleId = useId();
  const descriptionId = useId();
  const hasQuitAction = Boolean(onQuit);
  const [viewportState, setViewportState] = useState({
    isMobile: false,
    isCompact: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mobileQuery = window.matchMedia('(max-width: 600px)');
    const compactQuery = window.matchMedia('(max-height: 720px)');

    const updateViewportState = () => {
      setViewportState((prevState) => {
        const nextState = {
          isMobile: mobileQuery.matches,
          isCompact: compactQuery.matches,
        };

        if (
          prevState.isMobile === nextState.isMobile &&
          prevState.isCompact === nextState.isCompact
        ) {
          return prevState;
        }

        return nextState;
      });
    };

    updateViewportState();

    const handleChange = () => {
      updateViewportState();
    };

    const attachListener = (query) => {
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', handleChange);
        return () => query.removeEventListener('change', handleChange);
      }

      query.addListener(handleChange);
      return () => query.removeListener(handleChange);
    };

    const detachMobile = attachListener(mobileQuery);
    const detachCompact = attachListener(compactQuery);

    return () => {
      detachMobile();
      detachCompact();
    };
  }, []);

  const { isMobile, isCompact } = viewportState;
  const containerClassName = [
    styles.container,
    isMobile ? styles.mobile : '',
    isCompact ? styles.compact : '',
  ]
    .filter(Boolean)
    .join(' ');

  const stats = [
    {
      key: 'level',
      label: 'Nível Alcançado',
      value: formattedLevel,
      icon: '🧬',
    },
    {
      key: 'maxCombo',
      label: 'Combo Máximo',
      value: `x${formattedMaxCombo}`,
      icon: '🔥',
    },
  ];

  const resolvedJourneyStats = useMemo(() => normalizeJourneyStats(journeyStats), [journeyStats]);

  const evolutionBreakdown = useMemo(() => {
    const parts = Object.entries(resolvedJourneyStats.evolutionsByTier)
      .filter(([, count]) => count > 0)
      .map(([tier, count]) => `${count} ${tierLabels[tier] ?? tier}`);
    return parts.join(' · ');
  }, [resolvedJourneyStats.evolutionsByTier]);

  const journeyEntries = useMemo(
    () => [
      {
        key: 'duration',
        label: 'Tempo decorrido',
        icon: '⏱️',
        value: formatDuration(resolvedJourneyStats.elapsedMs),
      },
      {
        key: 'xp',
        label: 'XP coletado',
        icon: '📘',
        value: `${formatStat(resolvedJourneyStats.xpTotal)} XP`,
      },
      {
        key: 'mg',
        label: 'MG coletado',
        icon: '🧪',
        value: `${formatStat(resolvedJourneyStats.mgTotal)} MG`,
      },
      {
        key: 'evolutions',
        label: 'Evoluções adquiridas',
        icon: '🧿',
        value: formatStat(resolvedJourneyStats.evolutionsTotal),
        detail: evolutionBreakdown,
      },
    ],
    [evolutionBreakdown, resolvedJourneyStats]
  );

  useEffect(() => {
    if (!dialogRef.current) {
      return;
    }

    const focusableElements = Array.from(
      dialogRef.current.querySelectorAll(focusableSelectors)
    ).filter((element) => !element.hasAttribute('disabled'));

    focusableElementsRef.current = focusableElements;

    const firstFocusable = focusableElementsRef.current[0];

    if (firstFocusable) {
      firstFocusable.focus();
      return;
    }

    dialogRef.current.focus();
  }, [hasQuitAction]);

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab' || !dialogRef.current) {
      return;
    }

    const focusableElements = focusableElementsRef.current;

    if (!focusableElements.length) {
      return;
    }

    const { activeElement } = document;
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (activeElement === firstElement || !dialogRef.current.contains(activeElement)) {
        event.preventDefault();
        lastElement.focus();
      }
      return;
    }

    if (activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  return (
    <div className={styles.backdrop}>
      <div
        className={containerClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        tabIndex={-1}
      >
        <h1 id={titleId} className={styles.title}>
          Game Over
        </h1>

        <section id={descriptionId} className={styles.summaryCard}>
          <header className={styles.summaryHeader}>
            <p className={styles.summaryLabel}>Pontuação Final</p>
            <p className={styles.summaryScore}>{formattedScore}</p>
          </header>

          <ul className={styles.statsList}>
            {stats.map((stat) => (
              <li key={stat.key} className={styles.statCard}>
                <span className={styles.statIcon} aria-hidden="true">
                  {stat.icon}
                </span>
                <div className={styles.statContent}>
                  <span className={styles.statLabel}>{stat.label}</span>
                  <span className={styles.statValue}>{stat.value}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.journeySection} aria-labelledby={`${titleId}-journey`}>
          <div className={styles.journeyHeader}>
            <h2 id={`${titleId}-journey`} className={styles.journeyTitle}>
              Resumo da jornada
            </h2>
            <p className={styles.journeySubtitle}>
              Principais conquistas e recursos coletados nesta corrida.
            </p>
          </div>

          <dl className={styles.journeyGrid}>
            {journeyEntries.map((entry) => (
              <div key={entry.key} className={styles.journeyItem}>
                <dt className={styles.journeyLabel}>
                  <span className={styles.journeyIcon} aria-hidden="true">
                    {entry.icon}
                  </span>
                  {entry.label}
                </dt>
                <dd className={styles.journeyValue}>{entry.value}</dd>
                {entry.detail ? <dd className={styles.journeyDetail}>{entry.detail}</dd> : null}
              </div>
            ))}
          </dl>
        </section>

        <div className={styles.actions}>
          <button type="button" className={styles.restartButton} onClick={onRestart}>
            🔄 Jogar Novamente
          </button>

          {onQuit ? (
            <button type="button" className={styles.quitButton} onClick={onQuit}>
              🚪 Sair da sala
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;
