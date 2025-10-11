#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..', '..');
const logsDir = resolve(rootDir, 'logs/structured');

const pickLatestLogFile = () => {
  if (!existsSync(logsDir)) {
    return null;
  }
  const files = readdirSync(logsDir)
    .filter((file) => file.endsWith('.ndjson'))
    .sort();
  return files.at(-1) ?? null;
};

const args = process.argv.slice(2);
let fileArg = null;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--file' || arg === '-f') {
    fileArg = args[i + 1] ?? null;
    i += 1;
  }
}

const logFile = fileArg ?? pickLatestLogFile();

if (!logFile) {
  console.error('Nenhum arquivo de log NDJSON encontrado em logs/structured. Execute o pipeline de tail primeiro.');
  process.exit(1);
}

const resolvedFile = resolve(logsDir, logFile);

console.log(`🔍 Gerando relatório a partir de ${basename(resolvedFile)}`);

const raw = readFileSync(resolvedFile, 'utf8');

const lines = raw
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const metrics = {
  totalLogs: 0,
  playersConnected: new Map(),
  sessions: [],
  protocolErrors: 0,
  protocolErrorBreakdown: new Map(),
  peakPlayers: 0,
};

const updatePeak = (count) => {
  if (count > metrics.peakPlayers) {
    metrics.peakPlayers = count;
  }
};

for (const line of lines) {
  metrics.totalLogs += 1;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch (error) {
    console.warn('Ignorando linha inválida no log estruturado', { line, error });
    continue;
  }

  const { event, category, timestamp, connectedPlayers, playerId } = entry;

  if (event === 'player_connected') {
    if (playerId) {
      metrics.playersConnected.set(playerId, {
        name: entry.name ?? 'unknown',
        connectedAt: timestamp ?? entry.timestamp ?? null,
      });
    }
    if (typeof connectedPlayers === 'number') {
      updatePeak(connectedPlayers);
    }
  }

  if (event === 'player_disconnected') {
    if (playerId && metrics.playersConnected.has(playerId)) {
      metrics.playersConnected.delete(playerId);
    }
    if (typeof connectedPlayers === 'number') {
      updatePeak(connectedPlayers);
    }
    if (typeof entry.sessionDurationMs === 'number' && entry.sessionDurationMs >= 0) {
      metrics.sessions.push(entry.sessionDurationMs);
    }
  }

  if (category === 'protocol_error' || event === 'protocol_error') {
    metrics.protocolErrors += 1;
    const reason = entry.reason ?? entry.scope ?? event;
    metrics.protocolErrorBreakdown.set(reason, (metrics.protocolErrorBreakdown.get(reason) ?? 0) + 1);
  }
}

const activePlayers = metrics.playersConnected.size;
const totalSessions = metrics.sessions.length;
const avgSession = totalSessions > 0
  ? Math.round(metrics.sessions.reduce((acc, curr) => acc + curr, 0) / totalSessions)
  : 0;

console.log('\n📊 Resumo');
console.log('───────────────');
console.log(`Logs processados: ${metrics.totalLogs}`);
console.log(`Jogadores ativos agora: ${activePlayers}`);
console.log(`Pico de jogadores conectados: ${metrics.peakPlayers}`);
console.log(`Sessões encerradas: ${totalSessions}`);
console.log(`Tempo médio de sessão: ${avgSession} ms`);
console.log(`Erros de protocolo: ${metrics.protocolErrors}`);

if (metrics.protocolErrorBreakdown.size > 0) {
  console.log('\nDetalhamento de erros de protocolo:');
  for (const [reason, count] of metrics.protocolErrorBreakdown.entries()) {
    console.log(`  • ${reason}: ${count}`);
  }
}

if (metrics.sessions.length > 0) {
  const sorted = [...metrics.sessions].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  console.log('\nDistribuição de duração de sessões (ms):');
  console.log(`  mediana: ${median}`);
  console.log(`  p95: ${p95}`);
}

if (metrics.playersConnected.size > 0) {
  console.log('\nJogadores conectados atualmente:');
  for (const [id, info] of metrics.playersConnected.entries()) {
    console.log(`  • ${info.name} (${id}) desde ${info.connectedAt ?? 'tempo desconhecido'}`);
  }
}
