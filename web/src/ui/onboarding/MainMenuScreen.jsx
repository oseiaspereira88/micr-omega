import React from 'react';
import styles from './MainMenuScreen.module.css';

const MainMenuScreen = ({
  variant = 'desktop',
  onPlay,
  onOpenSettings,
  onOpenStore,
  onOpenMissions,
  onOpenFriends,
}) => {
  const testId = variant === 'mobile' ? 'main-menu-screen-mobile' : 'main-menu-screen';
  const className = [styles.root, variant === 'mobile' ? styles.mobile : ''].filter(Boolean).join(' ');
  const secondaryActions = [
    {
      key: 'settings',
      label: 'Configurações',
      handler: onOpenSettings,
    },
    {
      key: 'store',
      label: 'Loja',
      handler: onOpenStore,
    },
    {
      key: 'missions',
      label: 'Missões',
      handler: onOpenMissions,
    },
    {
      key: 'friends',
      label: 'Amigos',
      handler: onOpenFriends,
    },
  ];

  const isPlayEnabled = typeof onPlay === 'function';

  return (
    <div className={className} data-testid={testId}>
      <div className={styles.backdrop} />
      <div className={styles.shell}>
        <section className={styles.primary}>
          <header className={styles.profile}>
            <div className={styles.avatar}>
              <span className={styles.avatarInitials}>AR</span>
            </div>
            <div>
              <p className={styles.profileName}>Artemis_Rift</p>
              <p className={styles.profileMeta}>Lvl 42 • XP 78%</p>
            </div>
          </header>
          <button
            type="button"
            className={styles.playButton}
            data-testid="main-menu-play"
            onClick={isPlayEnabled ? onPlay : undefined}
            disabled={!isPlayEnabled}
          >
            Play
            {!isPlayEnabled && <span className={styles.buttonSoon}>Em breve</span>}
          </button>
          <div className={styles.badgeRow}>
            <div className={styles.badge}>
              <strong>Operação</strong>
              <span>Cluster Lúmen ativo</span>
            </div>
            <div className={styles.badge}>
              <strong>Esquadrão</strong>
              <span>Synapse Nova • Online</span>
            </div>
            <div className={styles.badge}>
              <strong>Recompensa</strong>
              <span>XP bônus +32% hoje</span>
            </div>
          </div>
        </section>
        <aside className={styles.secondary}>
          <div className={styles.banner}>
            <strong>Destaques da Temporada</strong>
            <span>Mutação "Aurora" liberada • Evento Eclipse Azul</span>
          </div>
          <div className={styles.feed}>
            <div className={styles.feedItem}>
              <strong>Ranked</strong>
              <span>Top 5% • Próximo reset em 3d</span>
            </div>
            <div className={styles.feedItem}>
              <strong>Contratos</strong>
              <span>2 missões lendárias disponíveis</span>
            </div>
            <div className={styles.feedItem}>
              <strong>Comunidade</strong>
              <span>Eventos cooperativos ao vivo</span>
            </div>
          </div>
          <div className={styles.storeActions}>
            {secondaryActions.map((action) => {
              const isEnabled = typeof action.handler === 'function';

              return (
                <button
                  key={action.key}
                  type="button"
                  className={styles.storeButton}
                  data-testid={`main-menu-${action.key}`}
                  onClick={isEnabled ? action.handler : undefined}
                  disabled={!isEnabled}
                >
                  <span className={styles.storeButtonLabel}>{action.label}</span>
                  {!isEnabled && <span className={styles.storeButtonSoon}>Em breve</span>}
                </button>
              );
            })}
          </div>
          <div className={styles.footer}>
            <span>v1.3.0</span>
            <span>•</span>
            <span>Micr•Omega Protocol</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MainMenuScreen;
