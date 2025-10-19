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
  onUnlockRoom,
}) => {
  const testId = variant === 'mobile' ? 'lobby-screen-mobile' : 'lobby-screen';
  const className = [styles.root, variant === 'mobile' ? styles.mobile : ''].filter(Boolean).join(' ');
  const shellClassName = [styles.shell, variant === 'mobile' ? styles.mobileShell : ''].filter(Boolean).join(' ');
  const sidebarClassName = [styles.sidebar, variant === 'mobile' ? styles.mobileSidebar : '']
    .filter(Boolean)
    .join(' ');
  const highlightsClassName = [
    styles.sidebarHighlights,
    variant === 'mobile' ? styles.sidebarHighlightsMobile : '',
  ]
    .filter(Boolean)
    .join(' ');
  const roomsClassName = [styles.rooms, variant === 'mobile' ? styles.mobileRooms : ''].filter(Boolean).join(' ');
  const filtersClassName = [styles.filters, variant === 'mobile' ? styles.mobileFilters : '']
    .filter(Boolean)
    .join(' ');
  const roomListClassName = [styles.roomList, variant === 'mobile' ? styles.mobileRoomList : '']
    .filter(Boolean)
    .join(' ');
  const isCreateRoomEnabled = typeof onCreateRoom === 'function';
  const createButtonClassName = [
    styles.createButton,
    !isCreateRoomEnabled ? styles.createButtonDisabled : '',
  ]
    .filter(Boolean)
    .join(' ');
  const isUnlockEnabled = typeof onUnlockRoom === 'function';
  const unlockButtonClassName = [
    styles.unlockButton,
    !isUnlockEnabled ? styles.unlockButtonDisabled : '',
  ]
    .filter(Boolean)
    .join(' ');
  const premiumAvailabilityMessage =
    'Disponível quando a loja estiver ativa ou uma oferta de desbloqueio estiver disponível.';

  const lockedRooms = [
    {
      id: 'cluster-sinaptico',
      title: 'Cluster Sináptico',
      description: 'Modos mutantes exclusivos com bônus de XP',
      players: '8 / 12',
      price: '120💎',
    },
    {
      id: 'ninho-lumen',
      title: 'Ninho Lúmen',
      description: 'Experiência narrativa cooperativa por capítulos',
      players: '2 / 6',
      price: '95💎',
    },
  ];

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
      <div className={shellClassName}>
        <aside className={sidebarClassName}>
          <h3>Criar Sala</h3>
          <p>Monte partidas privadas com regras avançadas e convide o seu esquadrão.</p>
          <button
            type="button"
            className={createButtonClassName}
            onClick={isCreateRoomEnabled ? onCreateRoom : undefined}
            disabled={!isCreateRoomEnabled}
            aria-disabled={!isCreateRoomEnabled}
          >
            Criar nova sala
          </button>
          {!isCreateRoomEnabled && (
            <p className={styles.createButtonNotice} role="status">
              Em breve: conecte-se a uma sala pública enquanto preparamos a criação privada.
            </p>
          )}
          <div className={highlightsClassName}>
            <div className={styles.statusCard}>
              <span>🏓 Ping médio: 22ms</span>
              <span>Conexão estável</span>
            </div>
            <div className={styles.statusCard}>
              <span>🔥 3 salas premium disponíveis</span>
              <span>Atualizadas a cada 5 min</span>
            </div>
          </div>
        </aside>
        <section className={roomsClassName}>
          <div className={filtersClassName}>
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
          <div className={roomListClassName}>
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
            {lockedRooms.map((room) => (
              <article key={room.id} className={styles.roomCard}>
                <div>
                  <h4>{room.title}</h4>
                  <p>{room.description}</p>
                </div>
                <div className={styles.roomMeta}>
                  <span>{`Jogadores: ${room.players}`}</span>
                  <span className={styles.locked}>🔒 Premium</span>
                  <button
                    type="button"
                    className={unlockButtonClassName}
                    onClick={
                      isUnlockEnabled
                        ? () => {
                            onUnlockRoom(room.id);
                          }
                        : undefined
                    }
                    disabled={!isUnlockEnabled}
                    aria-disabled={!isUnlockEnabled}
                    title={
                      isUnlockEnabled
                        ? `Desbloquear ${room.price}`
                        : premiumAvailabilityMessage
                    }
                  >
                    {`Desbloquear ${room.price}`}
                  </button>
                  {!isUnlockEnabled && (
                    <span className={styles.unlockButtonHint}>{premiumAvailabilityMessage}</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default LobbyScreen;
