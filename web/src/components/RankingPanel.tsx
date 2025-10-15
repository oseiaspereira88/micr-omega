import { useMemo } from "react";

import { useGameStore, type ConnectionStatus } from "../store/gameStore";
import styles from "./RankingPanel.module.css";

const DISCONNECTED_ICON = "\u26A0\uFE0F"; // ⚠️

type RankingRow = {
  playerId: string;
  name: string;
  score: number;
  connected: boolean;
  isLocal: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  idle: "Aguardando",
  connecting: "Conectando",
  connected: "Ao vivo",
  reconnecting: "Reconectando",
  disconnected: "Offline",
};

const STATUS_CLASS: Record<string, string> = {
  connected: styles.statusConnected,
  reconnecting: styles.statusReconnecting,
  disconnected: styles.statusDisconnected,
};

const PLACEHOLDER_MESSAGE: Record<ConnectionStatus | "default", string> = {
  idle: "Aguardando o início da partida para receber o ranking.",
  connecting: "Conectando ao servidor para obter a classificação...",
  reconnecting: "Tentando reconectar para recuperar a classificação...",
  disconnected: "Conexão perdida. Atualizaremos assim que o servidor responder novamente.",
  connected: "Aguarde o servidor enviar a classificação em tempo real.",
  default: "Aguarde o servidor enviar a classificação em tempo real.",
};

const RankingPanel = () => {
  const ranking = useGameStore((state) => state.ranking);
  const players = useGameStore((state) => state.players);
  const localPlayerId = useGameStore((state) => state.playerId);
  const connectionStatus = useGameStore((state) => state.connectionStatus);

  const rows: RankingRow[] = useMemo(() => {
    if (!ranking.length) {
      return [];
    }

    return [...ranking]
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        const nameComparison = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
        if (nameComparison !== 0) {
          return nameComparison;
        }
        return a.playerId.localeCompare(b.playerId);
      })
      .map((entry) => {
        const player = players[entry.playerId];
        return {
          playerId: entry.playerId,
          name: entry.name,
          score: entry.score,
          connected: player ? player.connected : false,
          isLocal: entry.playerId === localPlayerId,
        };
      });
  }, [ranking, players, localPlayerId]);

  const statusLabel = STATUS_LABEL[connectionStatus] ?? connectionStatus;
  const statusClass = STATUS_CLASS[connectionStatus] ?? "";

  if (rows.length === 0) {
    const placeholderMessage =
      PLACEHOLDER_MESSAGE[connectionStatus] ?? PLACEHOLDER_MESSAGE.default;
    return (
      <aside className={styles.panel} aria-label="Ranking da partida">
        <header className={styles.header}>
          <h3 className={styles.title}>Ranking</h3>
          <span className={`${styles.statusBadge} ${statusClass}`}>{statusLabel}</span>
        </header>
        <div className={styles.placeholder}>
          {placeholderMessage}
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel} aria-label="Ranking da partida">
      <header className={styles.header}>
        <h3 className={styles.title}>Ranking</h3>
        <span className={`${styles.statusBadge} ${statusClass}`}>{statusLabel}</span>
      </header>
      <ol className={styles.list}>
        {rows.map((row, index) => {
          const tierClass =
            index === 0
              ? styles.top1
              : index === 1
              ? styles.top2
              : index === 2
              ? styles.top3
              : "";
          const itemClass = [styles.item, tierClass, row.isLocal ? styles.localPlayer : ""]
            .filter(Boolean)
            .join(" ");
          return (
            <li key={row.playerId} className={itemClass}>
              <span className={styles.rankBadge}>{index + 1}</span>
              <div className={styles.nameCell}>
                <span className={styles.name} title={row.name}>
                  {row.name}
                </span>
                {row.isLocal ? <span className={styles.localTag}>Você</span> : null}
              </div>
              <span className={styles.score}>
                {row.score.toLocaleString("pt-BR")}
                {!row.connected ? (
                  <span
                    className={styles.disconnected}
                    title="Jogador desconectado"
                    aria-label="Jogador desconectado"
                  >
                    {" "}
                    {DISCONNECTED_ICON}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
};

export default RankingPanel;
