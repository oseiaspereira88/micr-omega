import React, { useEffect, useMemo, useState } from 'react';
import styles from './LobbyScreen.module.css';

const filterDefinitions = [
  { id: 'region', label: 'Região', value: 'Global' },
  { id: 'language', label: 'Idioma', value: 'PT-BR' },
  { id: 'mode', label: 'Modo', value: 'Co-op' },
];

const LobbyScreen = ({
  variant = 'desktop',
  onJoinPublic,
  onCreateRoom,
  onFilterChange,
  initialActiveFilters,
}) => {
  const testId = variant === 'mobile' ? 'lobby-screen-mobile' : 'lobby-screen';
  const className = [styles.root, variant === 'mobile' ? styles.mobile : ''].filter(Boolean).join(' ');

  const defaultActiveFilters = useMemo(
    () =>
      filterDefinitions.reduce(
        (acc, filter) => ({
          ...acc,
          [filter.id]: filter.id === 'region',
        }),
        {},
      ),
    [],
  );

  const [activeFilters, setActiveFilters] = useState(() => ({
    ...defaultActiveFilters,
    ...(initialActiveFilters ?? {}),
  }));

  useEffect(() => {
    if (!initialActiveFilters) {
      return;
    }

    setActiveFilters((prev) => ({
      ...defaultActiveFilters,
      ...prev,
      ...initialActiveFilters,
    }));
  }, [defaultActiveFilters, initialActiveFilters]);

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(activeFilters);
    }
  }, [activeFilters, onFilterChange]);

  const handleFilterToggle = (filterId) => {
    setActiveFilters((prev) => ({
      ...prev,
      [filterId]: !prev[filterId],
    }));
  };

  return (
    <div className={className} data-testid={testId}>
      <div className={styles.backdrop} />
      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <h3>Criar Sala</h3>
          <p>Monte partidas privadas com regras avançadas e convide o seu esquadrão.</p>
          <button type="button" className={styles.createButton} onClick={onCreateRoom}>
            Criar nova sala
          </button>
          <div className={styles.statusCard}>
            <span>🏓 Ping médio: 22ms</span>
            <span>Conexão estável</span>
          </div>
          <div className={styles.statusCard}>
            <span>🔥 3 salas premium disponíveis</span>
            <span>Atualizadas a cada 5 min</span>
          </div>
        </aside>
        <section className={styles.rooms}>
          <div className={styles.filters}>
            {filterDefinitions.map((filter) => {
              const isActive = Boolean(activeFilters[filter.id]);

              return (
                <button
                  key={filter.id}
                  type="button"
                  className={`${styles.filterChip} ${isActive ? styles.filterChipActive : styles.filterChipInactive}`}
                  onClick={() => handleFilterToggle(filter.id)}
                  aria-pressed={isActive}
                >
                  {`${filter.label}: ${filter.value}`}
                </button>
              );
            })}
          </div>
          <div className={styles.roomList}>
            <article className={styles.roomCard}>
              <div>
                <h4>Sala Pública — Gratuita</h4>
                <p>Entre imediatamente com qualquer jogador online 🌍</p>
              </div>
              <div className={styles.roomMeta}>
                <span>Jogadores: 24 / 40</span>
                <span>Ping 26ms</span>
                <button
                  type="button"
                  className={styles.joinButton}
                  data-testid="lobby-join-public"
                  onClick={onJoinPublic}
                >
                  Entrar agora
                </button>
              </div>
            </article>
            <article className={styles.roomCard}>
              <div>
                <h4>Cluster Sináptico</h4>
                <p>Modos mutantes exclusivos com bônus de XP</p>
              </div>
              <div className={styles.roomMeta}>
                <span>Jogadores: 8 / 12</span>
                <span className={styles.locked}>🔒 Premium</span>
                <button type="button" className={styles.unlockButton}>Desbloquear 120💎</button>
              </div>
            </article>
            <article className={styles.roomCard}>
              <div>
                <h4>Ninho Lúmen</h4>
                <p>Experiência narrativa cooperativa por capítulos</p>
              </div>
              <div className={styles.roomMeta}>
                <span>Jogadores: 2 / 6</span>
                <span className={styles.locked}>🔒 Premium</span>
                <button type="button" className={styles.unlockButton}>Desbloquear 95💎</button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
};

export default LobbyScreen;
