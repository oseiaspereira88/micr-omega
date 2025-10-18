import React from 'react';
import styles from '../concepts/MicroWorldConceptScreens.module.css';

const LobbyScreen = ({ variant = 'desktop' }) => {
  if (variant === 'mobile') {
    return (
      <div className={styles.lobbyLayoutMobile} data-testid="lobby-screen-mobile">
        <div className={styles.mobileFilterStrip}>
          <span className={styles.filterPill}>Global</span>
          <span className={styles.filterPill}>PT-BR</span>
          <span className={styles.filterPill}>Co-op</span>
        </div>
        <div className={styles.mobileRooms}>
          <div className={`${styles.roomTile} ${styles.roomTileFeatured}`}>
            <h4>Sala Pública</h4>
            <p>🌍 Jogadores online agora</p>
            <span>24 / 40 • 26ms</span>
            <button type="button" className={styles.joinButton}>Entrar</button>
          </div>
          <div className={styles.roomTile}>
            <h4>Cluster Sináptico</h4>
            <p>🔒 Premium</p>
            <button type="button" className={styles.unlockButton}>120💎</button>
          </div>
          <div className={styles.roomTile}>
            <h4>Ninho Lúmen</h4>
            <p>🔒 Premium</p>
            <button type="button" className={styles.unlockButton}>95💎</button>
          </div>
        </div>
        <div className={styles.mobileFooterCard}>
          <div>
            <h5>Criar Sala</h5>
            <p>Monte partidas privadas instantâneas.</p>
          </div>
          <button type="button" className={styles.createRoomButton}>Criar</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.lobbyLayout} data-testid="lobby-screen">
      <aside className={styles.lobbySidebar}>
        <h3>Criar Sala</h3>
        <p>Configure regras avançadas e convide seu esquadrão.</p>
        <button type="button" className={styles.createRoomButton}>
          Criar nova sala
        </button>
        <div className={styles.pingCard}>
          <span>🏓 Ping: 22ms</span>
          <span>Latência estável</span>
        </div>
      </aside>
      <div className={styles.lobbyContent}>
        <div className={styles.filterBar}>
          <button type="button" className={`${styles.filterChip} ${styles.filterChipActive}`}>
            Região: Global
          </button>
          <button type="button" className={styles.filterChip}>Idioma: PT-BR</button>
          <button type="button" className={styles.filterChip}>Tipo: Co-op</button>
        </div>
        <div className={styles.roomList}>
          <article className={`${styles.roomCard} ${styles.roomCardFeatured}`}>
            <div>
              <h4>Sala Pública — Gratuita</h4>
              <p>Entre e jogue com qualquer jogador online 🌍</p>
            </div>
            <div className={styles.roomMeta}>
              <span>Jogadores: 24 / 40</span>
              <span>Ping 26ms</span>
              <button type="button" className={styles.joinButton}>Entrar agora</button>
            </div>
          </article>
          <article className={`${styles.roomCard} ${styles.roomCardLocked}`}>
            <div>
              <h4>Cluster Sináptico</h4>
              <p>Modos mutantes exclusivos • +45% XP</p>
            </div>
            <div className={styles.roomMeta}>
              <span>Jogadores: 8 / 12</span>
              <span className={styles.lockedLabel}>🔒 Premium</span>
              <button type="button" className={styles.unlockButton}>Desbloquear 120💎</button>
            </div>
          </article>
          <article className={`${styles.roomCard} ${styles.roomCardLocked}`}>
            <div>
              <h4>Ninho Lúmen</h4>
              <p>Experiência narrativa cooperativa</p>
            </div>
            <div className={styles.roomMeta}>
              <span>Jogadores: 2 / 6</span>
              <span className={styles.lockedLabel}>🔒 Premium</span>
              <button type="button" className={styles.unlockButton}>Desbloquear 95💎</button>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};

export default LobbyScreen;
