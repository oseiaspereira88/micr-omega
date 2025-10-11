#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = resolve(__dirname, '../..');
const logsDir = resolve(rootDir, 'logs/structured');
mkdirSync(logsDir, { recursive: true });

const workerName = process.env.WORKER_NAME ?? 'micr-omega-worker';
const logflareSourceId = process.env.LOGFLARE_SOURCE_ID ?? process.env.LOGFLARE_SOURCE_ID_WEB ?? process.env.LOGFLARE_SOURCE_ID_WORKER;
const logflareApiKey = process.env.LOGFLARE_API_TOKEN ?? process.env.LOGFLARE_API_KEY ?? process.env.LOGFLARE_API_TOKEN_WORKER;
const forwardToLogflare = Boolean(logflareSourceId && logflareApiKey);

const isoDate = new Date().toISOString().slice(0, 10);
const logFilePath = join(logsDir, `${isoDate}.ndjson`);
const fileStream = createWriteStream(logFilePath, { flags: 'a' });

console.log(`▶️  Iniciando tail do Worker "${workerName}". Logs em ${logFilePath}`);
if (forwardToLogflare) {
  console.log('   ↪️  Encaminhando logs para Logflare');
}

const tailProcess = spawn('npx', ['--yes', 'wrangler', 'tail', workerName, '--format', 'json'], {
  cwd: resolve(rootDir, 'worker'),
  env: process.env,
  stdio: ['ignore', 'pipe', 'inherit']
});

tailProcess.on('error', (error) => {
  console.error('Falha ao iniciar wrangler tail', error);
  process.exitCode = 1;
});

tailProcess.on('exit', (code, signal) => {
  if (signal) {
    console.log(`wrangler tail finalizado com sinal ${signal}`);
  } else {
    console.log(`wrangler tail finalizado com código ${code ?? 'desconhecido'}`);
    if (code && code !== 0) {
      process.exitCode = code;
    }
  }
});

const rl = createInterface({ input: tailProcess.stdout });

const pending: Promise<unknown>[] = [];

const flushPending = () => {
  if (pending.length === 0) {
    return;
  }
  const promises = pending.splice(0, pending.length);
  Promise.allSettled(promises).catch(() => {
    // Ignora erros já tratados individualmente
  });
};

const forwardLogflare = async (entry) => {
  if (!forwardToLogflare) {
    return;
  }

  try {
    await fetch('https://api.logflare.app/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': logflareApiKey
      },
      body: JSON.stringify({
        source: logflareSourceId,
        log_entry: entry,
        metadata: entry
      })
    });
  } catch (error) {
    console.error('Erro ao encaminhar log para Logflare', error);
  }
};

rl.on('line', (line) => {
  if (!line.trim()) {
    return;
  }
  try {
    const parsed = JSON.parse(line);
    const entry = {
      ...parsed,
      tailed_at: new Date().toISOString()
    };
    fileStream.write(`${JSON.stringify(entry)}\n`);
    pending.push(forwardLogflare(entry));
    if (pending.length > 10) {
      flushPending();
    }
  } catch (error) {
    console.error('Linha de log inválida recebida do wrangler tail', { line, error });
  }
});

process.on('SIGINT', () => {
  console.log('\nInterrompendo tail...');
  flushPending();
  rl.close();
  tailProcess.kill('SIGINT');
  fileStream.close();
});

process.on('beforeExit', flushPending);
