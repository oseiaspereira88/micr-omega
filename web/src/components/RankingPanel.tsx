import { useMemo } from "react";
import { useGameStore } from "../store/gameStore";
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

const RankingPanel = () => {
  const ranking = useGameStore((state) => state.ranking);
  const players = useGameStore((state) => state.players);
  const localPlayerId = useGameStore((state) => state.playerId);
  const connectionStatus = useGameStore((state) => state.connectionStatus);

  const rows = useMemo<RankingRow[]>(() => {
    return ranking.map((entry) => {
      const player = players[entry.playerId];
      return {
        playerId: entry.playerId,
        name: entry.name,
        score: entry.score,
        connected: player ? player.connected : false,
        isLocal: entry.playerId === localPlayerId,
      };
    });
  }, [localPlayerId, players, ranking]);

  if (rows.length === 0) {
    return (
      <aside className={styles.panel} aria-label="Ranking da partida">
        <header className={styles.header}>
          <h3 className={styles.title}>Ranking</h3>
          <span className={styles.statusBadge}>Sem dados</span>
        </header>
        <div className={styles.placeholder}>
          Aguarde o servidor enviar a classificação em tempo real.
        </div>
      </aside>
    );
  }

  const statusLabel = STATUS_LABEL[connectionStatus] ?? connectionStatus;
  const statusClass = STATUS_CLASS[connectionStatus] ?? "";

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
