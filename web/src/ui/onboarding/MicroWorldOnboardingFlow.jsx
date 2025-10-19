import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SplashScreen from './SplashScreen.jsx';
import MainMenuScreen from './MainMenuScreen.jsx';
import LobbyScreen from './LobbyScreen.jsx';
import styles from './MicroWorldOnboardingFlow.module.css';

const STAGE_SEQUENCE = ['splash', 'menu', 'lobby'];

const isTestEnvironment =
  typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined'
    ? import.meta.env.MODE === 'test'
    : false;

const STAGE_METADATA = {
  splash: {
    phaseLabel: 'Micr•Omega Boot Sequence',
    title: 'Sincronizando com o Núcleo',
    description:
      'Aperte os cintos: a ponte neural está estabelecendo o vínculo inicial enquanto as criaturas microscópicas despertam.',
    timelineLabel: 'Boot',
    status: 'Calibrando sensores e carregando ambiente.',
    autoAdvanceAfter: 5200,
  },
  menu: {
    phaseLabel: 'Centro de Comando',
    title: 'Hangar de Operações',
    description:
      'Revise seu esquadrão, verifique as recompensas do dia e prepare-se para mergulhar na próxima incursão.',
    timelineLabel: 'Comando',
    status: 'Aguardando confirmação do piloto para acessar o lobby.',
  },
  lobby: {
    phaseLabel: 'Coordenação de Missão',
    title: 'Lobby Micr•Omega',
    description:
      'Selecione a sala ideal, organize seu time e sincronize as regras de partida antes de iniciar a invasão.',
    timelineLabel: 'Lobby',
    status: 'Selecione uma sala pública para avançar para a configuração.',
  },
};

const MicroWorldOnboardingFlow = ({ onAdvance, onComplete }) => {
  const [activeStage, setActiveStage] = useState('splash');
  const [feedbackNotice, setFeedbackNotice] = useState(null);

  const stageConfig = useMemo(() => STAGE_METADATA[activeStage] ?? STAGE_METADATA.splash, [activeStage]);

  const goToStage = useCallback(
    (nextStage) => {
      if (!STAGE_SEQUENCE.includes(nextStage)) {
        return;
      }

      setActiveStage((current) => {
        if (current === nextStage) {
          return current;
        }
        const currentIndex = STAGE_SEQUENCE.indexOf(current);
        const nextIndex = STAGE_SEQUENCE.indexOf(nextStage);

        if (typeof onAdvance === 'function' && nextIndex !== -1) {
          onAdvance({
            currentIndex,
            currentStep: current,
            nextIndex,
            nextStep: nextStage,
          });
        }

        return nextStage;
      });
    },
    [onAdvance],
  );

  useEffect(() => {
    if (activeStage !== 'splash') {
      return undefined;
    }

    const { autoAdvanceAfter = 5200 } = STAGE_METADATA.splash;
    const splashDelay = isTestEnvironment ? 50 : autoAdvanceAfter;

    const timer = setTimeout(() => {
      goToStage('menu');
    }, Math.max(0, splashDelay));

    return () => {
      clearTimeout(timer);
    };
  }, [activeStage, goToStage]);

  const handlePlay = useCallback(() => {
    goToStage('lobby');
  }, [goToStage]);

  const pushFeedback = useCallback((message) => {
    setFeedbackNotice(message);
  }, [setFeedbackNotice]);

  const handleOpenSettings = useCallback(() => {
    pushFeedback('Painel de configurações será habilitado em breve nesta simulação.');
  }, [pushFeedback]);

  const handleOpenStore = useCallback(() => {
    pushFeedback('A loja estelar está em construção. Volte após a próxima sincronização.');
  }, [pushFeedback]);

  const handleOpenMissions = useCallback(() => {
    pushFeedback('Missões narrativas adicionais serão liberadas em uma atualização futura.');
  }, [pushFeedback]);

  const handleOpenFriends = useCallback(() => {
    pushFeedback('A central de esquadrões sociais está quase pronta. Convites em breve!');
  }, [pushFeedback]);

  const handleEnterPublic = useCallback(() => {
    if (typeof onComplete === 'function') {
      onComplete({
        currentStage: 'lobby',
        currentIndex: STAGE_SEQUENCE.indexOf('lobby'),
      });
    }
  }, [onComplete]);

  const handleCreateRoom = useCallback(() => {
    setFeedbackNotice('Criação de salas privadas chegará em breve. Enquanto isso, use as salas públicas!');
  }, []);

  const handleUnlockRoom = useCallback((roomId) => {
    const roomNameMap = {
      'cluster-sinaptico': 'Cluster Sináptico',
      'ninho-lumen': 'Ninho Lúmen',
    };
    const resolvedName = roomNameMap[roomId] ?? 'Sala premium';

    setFeedbackNotice(
      `${resolvedName} requer acesso à loja premium, que ainda não está disponível nesta versão de prévia.`,
    );
  }, []);

  useEffect(() => {
    if (!feedbackNotice) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setFeedbackNotice(null);
    }, 4000);

    return () => {
      clearTimeout(timeout);
    };
  }, [feedbackNotice]);

  const timelineItems = useMemo(
    () =>
      STAGE_SEQUENCE.map((key) => ({
        key,
        label: STAGE_METADATA[key]?.timelineLabel ?? key,
        active: key === activeStage,
      })),
    [activeStage],
  );

  return (
    <div className={styles.flowRoot} data-testid="micro-world-onboarding-flow">
      <div className={styles.backgroundLayer} />
      <header className={styles.header}>
        <span className={styles.phaseLabel}>{stageConfig.phaseLabel}</span>
        <h1 className={styles.title}>{stageConfig.title}</h1>
        <p className={styles.description}>{stageConfig.description}</p>
      </header>
      <div className={styles.stageArea}>
        <div className={styles.stageShell}>
          <div className={styles.stageGlow} />
          <div className={styles.stageContent}>
            {activeStage === 'splash' && <SplashScreen />}
            {activeStage === 'menu' && (
              <MainMenuScreen
                onPlay={handlePlay}
                onOpenSettings={handleOpenSettings}
                onOpenStore={handleOpenStore}
                onOpenMissions={handleOpenMissions}
                onOpenFriends={handleOpenFriends}
              />
            )}
            {activeStage === 'lobby' && (
              <LobbyScreen
                onJoinPublic={handleEnterPublic}
                onCreateRoom={handleCreateRoom}
                onUnlockRoom={handleUnlockRoom}
              />
            )}
          </div>
        </div>
      </div>
      {feedbackNotice && (
        <div className={styles.feedbackToast} role="status" aria-live="polite">
          {feedbackNotice}
        </div>
      )}
      <div className={styles.statusRow}>
        <div className={styles.statusPrimary}>
          <strong>Sequência atual</strong>
          <span>{stageConfig.status}</span>
        </div>
        <nav className={styles.statusTimeline} aria-label="Progresso das etapas">
          <ol className={styles.timelineList}>
            {timelineItems.map((item, index) => {
              const ariaLabel = `Etapa ${index + 1} de ${timelineItems.length}: ${item.label}`;

              return (
                <li
                  key={item.key}
                  className={styles.timelineItem}
                  data-active={item.active ? 'true' : 'false'}
                  aria-current={item.active ? 'step' : undefined}
                >
                  <span aria-hidden="true">{item.label}</span>
                  <span className={styles.visuallyHidden}>
                    {ariaLabel}
                    {item.active ? ' (etapa atual)' : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </div>
  );
};

export default MicroWorldOnboardingFlow;
