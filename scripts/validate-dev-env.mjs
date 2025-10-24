#!/usr/bin/env node

/**
 * Script de validação do ambiente de desenvolvimento
 * Verifica se todas as configurações necessárias estão presentes
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function success(message) {
  log(`✓ ${message}`, COLORS.green);
}

function error(message) {
  log(`✗ ${message}`, COLORS.red);
}

function warning(message) {
  log(`⚠ ${message}`, COLORS.yellow);
}

function info(message) {
  log(`ℹ ${message}`, COLORS.cyan);
}

function checkFileExists(path, description) {
  const fullPath = resolve(rootDir, path);
  if (existsSync(fullPath)) {
    success(`${description} encontrado: ${path}`);
    return true;
  } else {
    error(`${description} não encontrado: ${path}`);
    return false;
  }
}

function checkEnvVar(path, varName, expectedValue = null) {
  const fullPath = resolve(rootDir, path);
  if (!existsSync(fullPath)) {
    return false;
  }

  const content = readFileSync(fullPath, 'utf-8');
  const regex = new RegExp(`^${varName}=(.+)$`, 'm');
  const match = content.match(regex);

  if (match) {
    const value = match[1].trim();
    if (expectedValue && value !== expectedValue) {
      warning(`${varName} encontrada com valor: ${value} (esperado: ${expectedValue})`);
      return true;
    }
    success(`${varName} configurada: ${value}`);
    return true;
  } else {
    error(`${varName} não encontrada em ${path}`);
    return false;
  }
}

async function checkPortAvailable(port, description) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        info(`${description} (porta ${port}) já está em uso - servidor provavelmente rodando`);
        resolve(true);
      } else {
        error(`Erro ao verificar porta ${port}: ${err.message}`);
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      warning(`${description} (porta ${port}) disponível - servidor NÃO está rodando`);
      resolve(false);
    });

    server.listen(port, '127.0.0.1');
  });
}

async function testWebSocketConnection(url) {
  try {
    // Testa se consegue conectar via HTTP primeiro
    const httpUrl = url.replace('ws://', 'http://').replace('wss://', 'https://');
    const response = await fetch(`${httpUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      success(`Worker respondendo em ${httpUrl}`);
      return true;
    } else {
      warning(`Worker retornou status ${response.status}`);
      return false;
    }
  } catch (err) {
    error(`Não foi possível conectar ao worker: ${err.message}`);
    return false;
  }
}

async function main() {
  log('\n=== Validação do Ambiente de Desenvolvimento MicrΩ ===\n', COLORS.cyan);

  let hasErrors = false;

  // 1. Verificar arquivos de configuração
  info('1. Verificando arquivos de configuração...');
  if (!checkFileExists('web/.env.local', 'Arquivo .env.local do frontend')) {
    hasErrors = true;
    info('   Para criar: echo "VITE_REALTIME_URL=ws://127.0.0.1:8787" > web/.env.local');
  } else {
    checkEnvVar('web/.env.local', 'VITE_REALTIME_URL', 'ws://127.0.0.1:8787');
  }

  checkFileExists('worker/wrangler.toml', 'Configuração do worker');
  console.log('');

  // 2. Verificar dependências instaladas
  info('2. Verificando dependências...');
  if (checkFileExists('node_modules', 'Dependências instaladas (node_modules)')) {
    checkFileExists('web/node_modules', 'Dependências do workspace web');
    checkFileExists('worker/node_modules', 'Dependências do workspace worker');
  } else {
    hasErrors = true;
    info('   Execute: npm install');
  }
  console.log('');

  // 3. Verificar se servidores estão rodando
  info('3. Verificando servidores...');
  const workerRunning = await checkPortAvailable(8787, 'Cloudflare Worker');
  const webRunning = await checkPortAvailable(5173, 'Vite Dev Server');

  if (!workerRunning) {
    warning('   Worker não está rodando. Execute: npm run dev:worker');
  }
  if (!webRunning) {
    warning('   Frontend não está rodando. Execute: npm run dev:web');
  }
  console.log('');

  // 4. Testar conectividade com worker
  if (workerRunning) {
    info('4. Testando conectividade com worker...');
    await testWebSocketConnection('ws://127.0.0.1:8787');
  } else {
    warning('4. Pulando teste de conectividade (worker não está rodando)');
  }
  console.log('');

  // Resumo
  log('\n=== Resumo ===\n', COLORS.cyan);
  if (hasErrors) {
    error('Foram encontrados problemas na configuração.');
    info('\nPara iniciar o desenvolvimento:');
    info('1. Execute: npm install');
    info('2. Crie o arquivo web/.env.local com: VITE_REALTIME_URL=ws://127.0.0.1:8787');
    info('3. Inicie o worker: npm run dev:worker');
    info('4. Inicie o frontend: npm run dev:web');
    process.exit(1);
  } else if (!workerRunning || !webRunning) {
    warning('Configuração OK, mas servidores não estão rodando.');
    info('\nPara iniciar o desenvolvimento:');
    if (!workerRunning) info('1. Inicie o worker: npm run dev:worker');
    if (!webRunning) info('2. Inicie o frontend: npm run dev:web');
    process.exit(0);
  } else {
    success('Ambiente de desenvolvimento configurado e rodando corretamente!');
    info('\nServidores ativos:');
    info('- Worker: http://127.0.0.1:8787');
    info('- Frontend: http://localhost:5173');
    process.exit(0);
  }
}

main().catch((err) => {
  error(`Erro inesperado: ${err.message}`);
  console.error(err);
  process.exit(1);
});
