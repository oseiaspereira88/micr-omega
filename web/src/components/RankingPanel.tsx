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

  return (
    <aside className={styles.panel} aria-label="Ranking da partida">
      <header className={styles.header}>
        <h3 className={styles.title}>Ranking</h3>
        <span className={styles.statusBadge}>{connectionStatus}</span>
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
              <span className={styles.name} title={row.name}>
                {row.name}
              </span>
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
