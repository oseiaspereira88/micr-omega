import { useMemo } from "react";
import { shallowEqual, useGameStore, type ConnectionStatus } from "../store/gameStore";
import styles from "./ConnectionStatusOverlay.module.css";

const STATUS_LABEL: Record<string, { label: string; icon: string; title?: string }> = {
  idle: {
    label: "Aguardando nome",
    icon: "💤",
    title: "Aguardando identificação do jogador",
  },
  connecting: {
    label: "Conectando…",
    icon: "⏳",
    title: "Tentando estabelecer conexão",
  },
  connected: {
    label: "Conectado",
    icon: "⚡",
  },
  reconnecting: {
    label: "Reconectando…",
    icon: "🔄",
    title: "Tentando reconectar",
  },
  disconnected: {
    label: "Desconectado",
    icon: "🚨",
    title: "Conexão perdida",
  },
};

const STATUS_CLASS: Partial<Record<ConnectionStatus, string>> = {
  connected: styles.statusConnected,
  connecting: styles.statusConnecting,
  reconnecting: styles.statusReconnecting,
  disconnected: styles.statusDisconnected,
  idle: styles.statusIdle,
};

const STATUS_ICON_CLASS: Partial<Record<ConnectionStatus, string>> = {
  reconnecting: styles.statusIconPulse,
};

const LATENCY_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const formatLatency = (value: number) => LATENCY_FORMATTER.format(Math.round(value));

const ConnectionStatusOverlay = () => {
  const connectionState = useGameStore(
    (state) => ({
      connectionStatus: state.connectionStatus,
      lastPingAt: state.lastPingAt,
      lastPongAt: state.lastPongAt,
      reconnectAttempts: state.reconnectAttempts,
      joinError: state.joinError,
    }),
    shallowEqual,
  );

  const latency = useMemo(() => {
    if (connectionState.lastPingAt == null || connectionState.lastPongAt == null) {
      return null;
    }

    const delta = connectionState.lastPongAt - connectionState.lastPingAt;
    if (delta < 0) {
      return null;
    }

    return delta;
  }, [connectionState.lastPingAt, connectionState.lastPongAt]);

  const statusMeta =
    STATUS_LABEL[connectionState.connectionStatus as string] ?? {
      label: connectionState.connectionStatus,
      icon: "ℹ️",
    };

  const statusLabel = statusMeta.label;

  const statusClassName = useMemo(() => {
    const className =
      STATUS_CLASS[connectionState.connectionStatus] ?? styles.statusIdle;
    return `${styles.statusDot} ${className}`;
  }, [connectionState.connectionStatus]);

  const statusIconClassName =
    STATUS_ICON_CLASS[connectionState.connectionStatus] ?? "";
  const statusIconClasses =
    statusIconClassName !== ""
      ? `${styles.statusIcon} ${statusIconClassName}`
      : styles.statusIcon;

  const showLatency =
    connectionState.connectionStatus === "connected" && latency !== null;
  const showAttempts =
    connectionState.reconnectAttempts > 0 &&
    connectionState.connectionStatus !== "connected";
  const hasMetrics = showLatency || showAttempts;
  const formattedLatency = showLatency && latency !== null ? formatLatency(latency) : null;

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={styles.header}>
        <span className={statusClassName} aria-hidden="true" />
        <span
          className={statusIconClasses}
          aria-hidden="true"
          title={statusMeta.title}
        >
          {statusMeta.icon}
        </span>
        <span>{statusLabel}</span>
      </div>
      {hasMetrics ? (
        <div className={styles.metrics}>
          {showLatency ? (
            <div className={styles.metric}>
              <span>Latência</span>
              <strong>{formattedLatency} ms</strong>
            </div>
          ) : null}
          {showAttempts ? (
            <div className={styles.metric}>
              <span>Tentativas</span>
              <strong>{connectionState.reconnectAttempts}</strong>
            </div>
          ) : null}
        </div>
      ) : null}
      {connectionState.joinError ? (
        <div className={styles.alert} role="alert">
          {connectionState.joinError}
        </div>
      ) : null}
    </div>
  );
};

export default ConnectionStatusOverlay;
