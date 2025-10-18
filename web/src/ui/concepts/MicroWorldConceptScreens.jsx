import React, { useCallback, useState } from 'react';
import styles from './MicroWorldConceptScreens.module.css';

const ScreenPreview = ({ title, orientation = 'desktop', canvasClass, children }) => {
  const resolution = orientation === 'mobile' ? '1080 × 1920' : '1920 × 1080';

  return (
    <div className={styles.previewCard}>
      <div
        className={[
          styles.previewViewport,
          orientation === 'mobile' ? styles.mobileViewport : styles.desktopViewport,
          canvasClass,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className={styles.previewGlow} />
        <div className={styles.previewContent}>{children}</div>
      </div>
      <div className={styles.previewMeta}>
        <span className={styles.previewTitle}>{title}</span>
        <span className={styles.previewResolution}>{resolution}</span>
      </div>
    </div>
  );
};

const conceptSteps = [
  {
    key: 'splash',
    label: 'Splash Screen',
    render: () => (
      <section className={styles.section}>
        <div className={styles.sectionCopy}>
          <h2>Splash Screen</h2>
          <p>
            A cinematic entry with radiant logo, responsive progress feedback, and ambient micro-fauna
            silhouettes that hint at the life waiting inside each session.
          </p>
          <ul>
            <li>Dynamic glow around the game emblem with subtle parallax particles.</li>
            <li>Sequential loading messages for world-building immersion.</li>
            <li>Bioluminescent micro-creatures orbiting within the glass layers.</li>
          </ul>
        </div>
        <div className={styles.sectionGallery}>
          <ScreenPreview title="Splash Screen — Desktop" canvasClass={styles.splashCanvas}>
            <div className={styles.splashScene}>
              <div className={styles.logoStack}>
                <span className={styles.gameMark}>MICR•OMEGA</span>
                <span className={styles.gameVersion}>Evolution Protocol v2.1</span>
              </div>
              <div className={styles.progressRail}>
                <div className={styles.progressPulse} />
              </div>
              <div className={styles.loadingFeed}>
                <span>Loading environment...</span>
                <span>Syncing data...</span>
                <span>Stabilising biomes...</span>
              </div>
              <div className={styles.poweredBy}>Powered by CloseApps</div>
              <div className={styles.microSwarm}>
                <span className={`${styles.microOrb} ${styles.orbOne}`} />
                <span className={`${styles.microOrb} ${styles.orbTwo}`} />
                <span className={`${styles.microOrb} ${styles.orbThree}`} />
              </div>
            </div>
          </ScreenPreview>
          <ScreenPreview
            title="Splash Screen — Mobile"
            orientation="mobile"
            canvasClass={`${styles.splashCanvas} ${styles.mobileSplash}`}
          >
            <div className={styles.splashSceneMobile}>
              <div className={styles.logoStackCompact}>
                <span className={styles.gameMark}>MICR•OMEGA</span>
                <span className={styles.gameVersion}>Phase Shift Loading</span>
              </div>
              <div className={styles.progressRailMobile}>
                <div className={styles.progressPulse} />
              </div>
              <div className={styles.loadingFeedMobile}>
                <span>Calibrating senses...</span>
                <span>Syncing data...</span>
              </div>
              <div className={styles.poweredBy}>Powered by CloseApps</div>
              <div className={styles.mobileOrbits}>
                <span className={`${styles.microOrb} ${styles.orbFour}`} />
                <span className={`${styles.microOrb} ${styles.orbFive}`} />
              </div>
            </div>
          </ScreenPreview>
        </div>
      </section>
    ),
  },
  {
    key: 'menu',
    label: 'Main Menu',
    render: () => (
      <section className={styles.section}>
        <div className={styles.sectionCopy}>
          <h2>Main Menu</h2>
          <p>
            A glassmorphic command center highlighting immediate play, personalised progression, and
            animated world updates.
          </p>
          <ul>
            <li>Primary “Play” call-to-action with animated neon breathing edge.</li>
            <li>Modular cards for profile, missions, shop, and social presence.</li>
            <li>Responsive news ticker with holographic banners and subtle depth.</li>
          </ul>
        </div>
        <div className={styles.sectionGallery}>
          <ScreenPreview title="Main Menu — Desktop" canvasClass={styles.menuCanvas}>
            <div className={styles.menuLayout}>
              <div className={styles.menuTopRow}>
                <div className={styles.profileCard}>
                  <div className={styles.avatarRing}>
                    <div className={styles.avatarGlow} />
                    <span className={styles.avatarInitials}>AR</span>
                  </div>
                  <div>
                    <p className={styles.profileName}>Artemis_Rift</p>
                    <p className={styles.profileMeta}>Lvl 42 • XP 78%</p>
                  </div>
                </div>
                <button type="button" className={styles.playButton}>
                  Play
                </button>
              </div>
              <div className={styles.secondaryGrid}>
                <button type="button" className={styles.secondaryAction}>
                  ⚙️ Settings
                </button>
                <button type="button" className={styles.secondaryAction}>
                  🛒 Loja
                </button>
                <button type="button" className={styles.secondaryAction}>
                  ⭐ Missões
                </button>
                <button type="button" className={styles.secondaryAction}>
                  👥 Amigos
                </button>
              </div>
              <div className={styles.newsPanel}>
                <div className={styles.newsBanner}>
                  <span className={styles.bannerTitle}>Nova mutação liberada</span>
                  <span className={styles.bannerMeta}>Evento Eclipse Azul • 02h restantes</span>
                </div>
                <div className={styles.newsBanner}>
                  <span className={styles.bannerTitle}>Temporada Genesis ++</span>
                  <span className={styles.bannerMeta}>Ranked reset em 3 dias</span>
                </div>
              </div>
              <footer className={styles.menuFooter}>
                <span>v1.3.0</span>
                <span>•</span>
                <span>Privacy Policy</span>
              </footer>
            </div>
          </ScreenPreview>
          <ScreenPreview
            title="Main Menu — Mobile"
            orientation="mobile"
            canvasClass={`${styles.menuCanvas} ${styles.menuMobileCanvas}`}
          >
            <div className={styles.menuLayoutMobile}>
              <div className={styles.profileSummaryMobile}>
                <div className={styles.avatarRingSmall}>
                  <div className={styles.avatarGlow} />
                  <span className={styles.avatarInitials}>AR</span>
                </div>
                <div>
                  <p className={styles.profileName}>Artemis_Rift</p>
                  <p className={styles.profileMeta}>Lvl 42 • XP 78%</p>
                </div>
              </div>
              <button type="button" className={styles.playButtonMobile}>
                Play
              </button>
              <div className={styles.mobileActionsRow}>
                <button type="button" className={styles.secondaryActionCompact}>
                  ⚙️
                </button>
                <button type="button" className={styles.secondaryActionCompact}>
                  🛒
                </button>
                <button type="button" className={styles.secondaryActionCompact}>
                  ⭐
                </button>
                <button type="button" className={styles.secondaryActionCompact}>
                  👥
                </button>
              </div>
              <div className={styles.newsStackMobile}>
                <div className={styles.newsBannerMobile}>
                  <span className={styles.bannerTitle}>Nova mutação liberada</span>
                  <span className={styles.bannerMeta}>Evento Eclipse Azul</span>
                </div>
                <div className={styles.newsBannerMobile}>
                  <span className={styles.bannerTitle}>Temporada Genesis ++</span>
                  <span className={styles.bannerMeta}>Reset em 3 dias</span>
                </div>
              </div>
              <footer className={styles.menuFooterMobile}>v1.3.0 • Privacy Policy</footer>
            </div>
          </ScreenPreview>
        </div>
      </section>
    ),
  },
  {
    key: 'lobby',
    label: 'Lobby',
    render: () => (
      <section className={styles.section}>
        <div className={styles.sectionCopy}>
          <h2>Lobby — Seleção de Salas</h2>
          <p>
            Salas exibidas em cards translúcidos com indicadores claros de disponibilidade, ping e
            recompensas, mantendo a leitura fluida entre desktop e mobile.
          </p>
          <ul>
            <li>Aba lateral para criar sala com destaque em neon cristalino.</li>
            <li>Filtros por região, idioma e modo com feedback ativo.</li>
            <li>Cards premium com cadeado e ação de desbloqueio com moeda 💎.</li>
          </ul>
        </div>
        <div className={styles.sectionGallery}>
          <ScreenPreview title="Lobby — Desktop" canvasClass={styles.lobbyCanvas}>
            <div className={styles.lobbyLayout}>
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
                      <button type="button" className={styles.joinButton}>
                        Entrar agora
                      </button>
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
                      <button type="button" className={styles.unlockButton}>
                        Desbloquear 120💎
                      </button>
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
                      <button type="button" className={styles.unlockButton}>
                        Desbloquear 95💎
                      </button>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </ScreenPreview>
          <ScreenPreview
            title="Lobby — Mobile"
            orientation="mobile"
            canvasClass={`${styles.lobbyCanvas} ${styles.lobbyMobileCanvas}`}
          >
            <div className={styles.lobbyLayoutMobile}>
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
          </ScreenPreview>
        </div>
      </section>
    ),
  },
];

const MicroWorldConceptScreens = ({ onAdvance, onContinue }) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const totalSteps = conceptSteps.length;
  const safeIndex = Math.min(Math.max(activeStepIndex, 0), totalSteps - 1);
  const activeStep = conceptSteps[safeIndex] ?? conceptSteps[0];
  const StepContent = activeStep.render;

  const handleAdvance = useCallback(() => {
    if (safeIndex < totalSteps - 1) {
      const nextIndex = safeIndex + 1;
      setActiveStepIndex(nextIndex);
      if (typeof onAdvance === 'function') {
        onAdvance({
          currentIndex: safeIndex,
          currentStep: activeStep.key,
          nextIndex,
          nextStep: conceptSteps[nextIndex].key,
        });
      }
      return;
    }

    if (typeof onContinue === 'function') {
      onContinue({
        currentIndex: safeIndex,
        currentStep: activeStep.key,
      });
    }
  }, [safeIndex, totalSteps, onAdvance, onContinue, activeStep]);

  const ctaLabel = safeIndex === totalSteps - 1 ? 'Entrar no jogo' : 'Próximo';

  return (
    <div className={styles.page}>
      <div className={styles.backgroundAura} />
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Micr•Omega — Interface Vision</p>
          <h1 className={styles.heading}>Evolving Microworlds UI Kit</h1>
          <p className={styles.subtitle}>
            Futuristic-bioluminescent aesthetics crafted for a cross-platform multiplayer experience.
            Each screen blends organic motion, sci-fi clarity, and responsive comfort.
          </p>
        </div>
        <div className={styles.themePalette}>
          <span className={styles.themeChip}>Dark Flux</span>
          <span className={`${styles.themeChip} ${styles.themeChipAlt}`}>Luminous Drift</span>
          <span className={`${styles.themeChip} ${styles.themeChipOutline}`}>Glass Neon</span>
        </div>
      </header>
      <StepContent />
      <div className={styles.actionsBar}>
        <div className={styles.stepMeta}>
          <span className={styles.stepTitle}>
            Etapa {safeIndex + 1} de {totalSteps}
          </span>
          <span className={styles.stepDescription}>{activeStep.label}</span>
        </div>
        <button type="button" className={styles.primaryCta} onClick={handleAdvance}>
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};

export default MicroWorldConceptScreens;
