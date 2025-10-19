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

  const storeActions = [
    {
      key: 'settings',
      label: 'Configurações',
      onClick: onOpenSettings,
      testId: 'main-menu-settings',
    },
    {
      key: 'store',
      label: 'Loja',
      onClick: onOpenStore,
      testId: 'main-menu-store',
    },
    {
      key: 'missions',
      label: 'Missões',
      onClick: onOpenMissions,
      testId: 'main-menu-missions',
    },
    {
      key: 'friends',
      label: 'Amigos',
      onClick: onOpenFriends,
      testId: 'main-menu-friends',
    },
  ];

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
            onClick={onPlay}
          >
            Play
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
            {storeActions.map((action) => {
                const isDisabled = typeof action.onClick !== 'function';
                const buttonClassName = [
                  styles.storeButton,
                  isDisabled ? styles.storeButtonDisabled : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                return (
                  <button
                    key={action.key}
                    type="button"
                    className={buttonClassName}
                    data-testid={action.testId}
                    onClick={isDisabled ? undefined : action.onClick}
                    disabled={isDisabled}
                    aria-disabled={isDisabled || undefined}
                  >
                    <span className={styles.storeButtonLabel}>{action.label}</span>
                    <span className={styles.storeButtonMeta} aria-hidden={isDisabled ? undefined : true}>
                      Em breve
                    </span>
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
