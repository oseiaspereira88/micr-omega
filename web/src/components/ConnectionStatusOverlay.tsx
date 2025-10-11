import { useMemo } from "react";
import { useGameStore } from "../store/gameStore";
import styles from "./ConnectionStatusOverlay.module.css";

const STATUS_LABEL: Record<string, string> = {
  idle: "Aguardando nome",
  connecting: "Conectando…",
  connected: "Conectado",
  reconnecting: "Reconectando…",
  disconnected: "Desconectado",
};

const ConnectionStatusOverlay = () => {
  const connectionStatus = useGameStore((state) => state.connectionStatus);
  const lastPingAt = useGameStore((state) => state.lastPingAt);
  const lastPongAt = useGameStore((state) => state.lastPongAt);
  const reconnectAttempts = useGameStore((state) => state.reconnectAttempts);
  const joinError = useGameStore((state) => state.joinError);

  const latency = useMemo(() => {
    if (!lastPingAt || !lastPongAt) {
      return null;
    }

    const delta = lastPongAt - lastPingAt;
    if (delta < 0) {
      return null;
    }

    return delta;
  }, [lastPingAt, lastPongAt]);

  const statusLabel = STATUS_LABEL[connectionStatus as string] ?? connectionStatus;

  const statusClassName = `${styles.statusDot} ${
    connectionStatus === "connected"
      ? styles.statusConnected
      : connectionStatus === "connecting"
      ? styles.statusConnecting
      : connectionStatus === "reconnecting"
      ? styles.statusReconnecting
      : connectionStatus === "disconnected"
      ? styles.statusDisconnected
      : styles.statusIdle
  }`;

  const showLatency = connectionStatus === "connected" && latency !== null;
  const showAttempts = reconnectAttempts > 0 && connectionStatus !== "connected";
  const hasMetrics = showLatency || showAttempts;

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={styles.header}>
        <span className={statusClassName} aria-hidden="true" />
        <span>{statusLabel}</span>
      </div>
      {hasMetrics ? (
        <div className={styles.metrics}>
          {showLatency ? (
            <div className={styles.metric}>
              <span>Latência</span>
              <strong>{latency} ms</strong>
            </div>
          ) : null}
          {showAttempts ? (
            <div className={styles.metric}>
              <span>Tentativas</span>
              <strong>{reconnectAttempts}</strong>
            </div>
          ) : null}
        </div>
      ) : null}
      {joinError ? <div className={styles.alert}>{joinError}</div> : null}
    </div>
  );
};

export default ConnectionStatusOverlay;
