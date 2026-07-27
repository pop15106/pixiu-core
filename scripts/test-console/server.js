#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const { createRunManager, ActiveRunError, UnknownModuleError, UnknownRunError } = require('./run-manager');
const { createTestRegistry } = require('./test-registry');

const STATIC_FILES = Object.freeze({
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8']
});

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff'
  });
  response.end(body);
}

function sendText(response, statusCode, contentType, body) {
  response.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'content-type': contentType,
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY'
  });
  response.end(body);
}

function readJsonBody(request, maxBodyBytes) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    let tooLarge = false;
    const chunks = [];

    request.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBodyBytes) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (tooLarge) {
        const error = new Error('請求內容過大');
        error.statusCode = 413;
        reject(error);
        return;
      }
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text.length === 0 ? {} : JSON.parse(text));
      } catch {
        const error = new Error('JSON 格式錯誤');
        error.statusCode = 400;
        reject(error);
      }
    });
    request.on('error', (error) => reject(error));
  });
}

function isAllowedOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) {
    return false;
  }
  const candidates = new Set([`http://${host}`]);
  const port = host.includes(':') ? host.slice(host.lastIndexOf(':') + 1) : '80';
  candidates.add(`http://127.0.0.1:${port}`);
  candidates.add(`http://localhost:${port}`);
  return candidates.has(origin);
}

function validateWriteRequest(request, token) {
  if (!isAllowedOrigin(request)) {
    return '來源不允許';
  }
  if (request.headers['x-pixiu-test-token'] !== token) {
    return '測試 session token 不正確';
  }
  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    return 'Content-Type 必須是 application/json';
  }
  return null;
}

function createTestConsoleServer(options = {}) {
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, '..', '..'));
  const staticRoot = path.resolve(options.staticRoot || path.join(__dirname, 'public'));
  const token = options.token || crypto.randomBytes(24).toString('hex');
  const maxBodyBytes = options.maxBodyBytes || 8192;
  const registry = options.registry || createTestRegistry(rootDir);
  const runManager = options.runManager || createRunManager({ registry });
  let listeningAddress = null;

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url, 'http://127.0.0.1');
      const pathname = requestUrl.pathname;

      if (request.method === 'GET' && pathname === '/healthz') {
        sendJson(response, 200, {
          status: 'ready',
          activeRun: runManager.getActiveRun()
        });
        return;
      }

      if (request.method === 'GET' && pathname === '/api/session') {
        sendJson(response, 200, {
          token,
          activeRun: runManager.getActiveRun()
        });
        return;
      }

      if (request.method === 'GET' && pathname === '/api/modules') {
        sendJson(response, 200, {
          modules: registry.list(),
          activeRun: runManager.getActiveRun()
        });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/runs') {
        const validationError = validateWriteRequest(request, token);
        if (validationError) {
          sendJson(response, 403, { error: validationError });
          return;
        }
        const body = await readJsonBody(request, maxBodyBytes);
        if (typeof body.moduleId !== 'string' || body.moduleId.length === 0) {
          sendJson(response, 400, { error: 'moduleId 必須是非空字串' });
          return;
        }
        const run = runManager.start(body.moduleId);
        sendJson(response, 202, { run });
        return;
      }

      const runMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9-]+)$/);
      if (request.method === 'GET' && runMatch) {
        sendJson(response, 200, { run: runManager.getRun(runMatch[1]) });
        return;
      }

      const cancelMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9-]+)\/cancel$/);
      if (request.method === 'POST' && cancelMatch) {
        const validationError = validateWriteRequest(request, token);
        if (validationError) {
          sendJson(response, 403, { error: validationError });
          return;
        }
        await readJsonBody(request, maxBodyBytes);
        sendJson(response, 200, { run: runManager.cancel(cancelMatch[1]) });
        return;
      }

      if (request.method === 'GET' && STATIC_FILES[pathname]) {
        const [fileName, contentType] = STATIC_FILES[pathname];
        const filePath = path.join(staticRoot, fileName);
        if (!filePath.startsWith(`${staticRoot}${path.sep}`) || !fs.existsSync(filePath)) {
          sendJson(response, 404, { error: '找不到靜態資源' });
          return;
        }
        sendText(response, 200, contentType, fs.readFileSync(filePath));
        return;
      }

      sendJson(response, 404, { error: '找不到路由' });
    } catch (error) {
      if (error instanceof UnknownModuleError || error instanceof UnknownRunError) {
        sendJson(response, 404, { error: error.message });
        return;
      }
      if (error instanceof ActiveRunError) {
        sendJson(response, 409, {
          error: error.message,
          activeRunId: error.activeRunId
        });
        return;
      }
      if (error.statusCode === 400 || error.statusCode === 413) {
        sendJson(response, error.statusCode, { error: error.message });
        return;
      }
      sendJson(response, 500, { error: '測試控制台發生未預期錯誤' });
    }
  });

  function start(port = 8787, host = '127.0.0.1') {
    if (host !== '127.0.0.1') {
      return Promise.reject(new Error('測試控制台只允許監聽 127.0.0.1'));
    }
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.removeListener('error', reject);
        listeningAddress = server.address();
        resolve(listeningAddress);
      });
    });
  }

  async function stop() {
    runManager.cancelActive();
    if (!server.listening) {
      return;
    }
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    listeningAddress = null;
  }

  return Object.freeze({
    registry,
    runManager,
    server,
    start,
    stop,
    token,
    get address() {
      return listeningAddress;
    }
  });
}

function parseArguments(argv) {
  let port = 8787;
  let open = false;
  for (const argument of argv) {
    if (argument === '--open') {
      open = true;
      continue;
    }
    if (argument.startsWith('--port=')) {
      const parsed = Number.parseInt(argument.slice('--port='.length), 10);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error('port 必須介於 1 到 65535');
      }
      port = parsed;
    }
  }
  return { open, port };
}

function openBrowser(url) {
  let executable;
  let args;
  if (process.platform === 'win32') {
    executable = 'cmd.exe';
    args = ['/c', 'start', '', url];
  } else if (process.platform === 'darwin') {
    executable = 'open';
    args = [url];
  } else {
    executable = 'xdg-open';
    args = [url];
  }
  const child = spawn(executable, args, {
    detached: true,
    shell: false,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
}

async function main() {
  const { open, port } = parseArguments(process.argv.slice(2));
  const app = createTestConsoleServer();
  const address = await app.start(port);
  const url = `http://127.0.0.1:${address.port}`;
  process.stdout.write(`PixiuCore 測試控制台：${url}\n`);
  process.stdout.write('按 Ctrl+C 關閉。\n');
  if (open) {
    openBrowser(url);
  }

  const shutdown = async () => {
    await app.stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  createTestConsoleServer,
  isAllowedOrigin,
  parseArguments,
  readJsonBody,
  validateWriteRequest
};
