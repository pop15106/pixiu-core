#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const { createCodexLiveExecutor, LiveExecutionError } = require('./codex-live-executor');
const { ArtifactStoreError } = require('./artifact-store');
const { createProjectValidator, ProjectValidationError } = require('./project-validator');
const { WorkflowRequestError } = require('./request-validator');
const { RunStateError } = require('./run-manager');
const { createWorkflowCatalog } = require('./workflow-catalog');
const { createWorkflowEngine, WorkflowEngineError } = require('./workflow-engine');
const { WorktreeError } = require('./worktree-manager');

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

function sendStatic(response, statusCode, contentType, body) {
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
    request.on('error', reject);
  });
}

function isAllowedHost(request) {
  const host = String(request.headers.host || '').toLowerCase();
  if (!host) {
    return false;
  }
  const hostname = host.includes(':') ? host.slice(0, host.lastIndexOf(':')) : host;
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

function isAllowedOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) {
    return false;
  }
  const port = host.includes(':') ? host.slice(host.lastIndexOf(':') + 1) : '80';
  return new Set([
    `http://${host}`,
    `http://127.0.0.1:${port}`,
    `http://localhost:${port}`
  ]).has(origin);
}

function validateWriteRequest(request, token) {
  if (!isAllowedOrigin(request)) {
    return '來源不允許';
  }
  if (request.headers['x-pixiu-workflow-token'] !== token) {
    return 'Workflow session token 不正確';
  }
  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    return 'Content-Type 必須是 application/json';
  }
  return null;
}

function errorStatus(error) {
  if (error instanceof WorkflowRequestError) {
    return 400;
  }
  if (error instanceof RunStateError) {
    if (error.code === 'ACTIVE_RUN_EXISTS') {
      return 409;
    }
    if (['UNKNOWN_RUN', 'UNKNOWN_RUN_STEP'].includes(error.code)) {
      return 404;
    }
    return 400;
  }
  if (error instanceof WorkflowEngineError) {
    return error.code === 'UNKNOWN_RUN' ? 404 : 400;
  }
  if (error instanceof ProjectValidationError
    || error instanceof WorktreeError
    || error instanceof LiveExecutionError
    || error instanceof ArtifactStoreError) {
    return 400;
  }
  if (error.statusCode === 400 || error.statusCode === 413) {
    return error.statusCode;
  }
  return 500;
}

function publicErrorMessage(error, statusCode) {
  return statusCode === 500 ? 'Workflow Lab 發生未預期錯誤' : error.message;
}

function parseArguments(argv) {
  let port = 8792;
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

function createWorkflowLabServer(options = {}) {
  const rootDir = path.resolve(options.rootDir || path.join(__dirname, '..', '..'));
  const staticRoot = path.resolve(options.staticRoot || path.join(__dirname, 'public'));
  const token = options.token || crypto.randomBytes(24).toString('hex');
  const maxBodyBytes = options.maxBodyBytes || 262144;
  const catalog = options.catalog || createWorkflowCatalog();
  const projectValidator = options.projectValidator || createProjectValidator({
    ...(options.projectValidatorOptions || {}),
    fleetPath: options.projectValidatorOptions?.fleetPath || path.join(rootDir, 'fleet.json')
  });
  const liveExecutor = options.liveExecutor || createCodexLiveExecutor();
  const engine = options.engine || createWorkflowEngine({
    catalog,
    projectValidator,
    liveExecutor,
    projectValidatorOptions: options.projectValidatorOptions,
    worktreeManagerOptions: options.worktreeManagerOptions
  });
  let listeningAddress = null;

  const server = http.createServer(async (request, response) => {
    try {
      if (!isAllowedHost(request)) {
        sendJson(response, 403, { error: 'Host 不允許' });
        return;
      }
      const requestUrl = new URL(request.url, 'http://127.0.0.1');
      const pathname = requestUrl.pathname;

      if (request.method === 'GET' && pathname === '/healthz') {
        sendJson(response, 200, {
          status: 'ready',
          activeRun: engine.getActiveRun()
        });
        return;
      }

      if (request.method === 'GET' && pathname === '/api/session') {
        sendJson(response, 200, {
          token,
          liveAvailable: typeof liveExecutor.isAvailable === 'function'
            ? liveExecutor.isAvailable()
            : false,
          activeRun: engine.getActiveRun(),
          latestRun: engine.getLatestRun()
        });
        return;
      }

      if (request.method === 'GET' && pathname === '/api/modules') {
        sendJson(response, 200, {
          modules: catalog.list(),
          defaultSequence: [...catalog.defaultSequence],
          activeRun: engine.getActiveRun(),
          latestRun: engine.getLatestRun()
        });
        return;
      }

      if (request.method === 'GET' && pathname === '/api/projects') {
        sendJson(response, 200, { projects: projectValidator.listProjects() });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/runs') {
        const validationError = validateWriteRequest(request, token);
        if (validationError) {
          sendJson(response, 403, { error: validationError });
          return;
        }
        const body = await readJsonBody(request, maxBodyBytes);
        const run = engine.startDetached(body);
        sendJson(response, 202, { run });
        return;
      }

      const artifactMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9-]+)\/artifacts\/([a-zA-Z0-9-]+)$/);
      if (request.method === 'GET' && artifactMatch) {
        const artifact = engine.getArtifact(artifactMatch[1], artifactMatch[2]);
        if (!artifact) {
          sendJson(response, 404, { error: '找不到可持久化 Artifact' });
          return;
        }
        sendJson(response, 200, { artifact });
        return;
      }

      const runMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9-]+)$/);
      if (request.method === 'GET' && runMatch) {
        sendJson(response, 200, { run: engine.getSnapshot(runMatch[1]) });
        return;
      }

      const actionMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9-]+)\/(cancel|approve|reject)$/);
      if (request.method === 'POST' && actionMatch) {
        const validationError = validateWriteRequest(request, token);
        if (validationError) {
          sendJson(response, 403, { error: validationError });
          return;
        }
        const body = await readJsonBody(request, maxBodyBytes);
        const [runId, action] = [actionMatch[1], actionMatch[2]];
        if (action === 'cancel') {
          sendJson(response, 200, { run: engine.cancel(runId) });
          return;
        }
        const snapshot = engine.getSnapshot(runId);
        let decision;
        if (action === 'reject') {
          decision = { action: 'reject' };
        } else if (body.action) {
          decision = body;
        } else if (snapshot.pendingApproval?.kind === 'red-return') {
          decision = {
            action: 'return',
            moduleId: snapshot.pendingApproval.recommendedModuleId
          };
        } else {
          decision = { action: 'approve' };
        }
        const run = engine.resumeDetached(runId, decision);
        sendJson(response, 202, { run });
        return;
      }

      if (request.method === 'GET' && STATIC_FILES[pathname]) {
        const [fileName, contentType] = STATIC_FILES[pathname];
        const filePath = path.join(staticRoot, fileName);
        if (!filePath.startsWith(`${staticRoot}${path.sep}`) || !fs.existsSync(filePath)) {
          sendJson(response, 404, { error: '找不到靜態資源' });
          return;
        }
        sendStatic(response, 200, contentType, fs.readFileSync(filePath));
        return;
      }

      sendJson(response, 404, { error: '找不到路由' });
    } catch (error) {
      const statusCode = errorStatus(error);
      sendJson(response, statusCode, {
        error: publicErrorMessage(error, statusCode),
        code: statusCode === 500 ? 'INTERNAL_ERROR' : error.code
      });
    }
  });

  function start(port = 8792, host = '127.0.0.1') {
    if (host !== '127.0.0.1') {
      return Promise.reject(new Error('Workflow Lab 只允許監聽 127.0.0.1'));
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
    const activeRun = engine.getActiveRun();
    if (activeRun && !['green', 'red', 'failed', 'cancelled'].includes(activeRun.status)) {
      engine.cancel(activeRun.id);
    }
    if (!server.listening) {
      return;
    }
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    listeningAddress = null;
  }

  return Object.freeze({
    catalog,
    engine,
    projectValidator,
    server,
    start,
    stop,
    token,
    get address() {
      return listeningAddress;
    }
  });
}

async function main() {
  const { open, port } = parseArguments(process.argv.slice(2));
  const app = createWorkflowLabServer();
  const address = await app.start(port);
  const url = `http://127.0.0.1:${address.port}`;
  process.stdout.write(`PixiuCore Workflow Lab：${url}\n`);
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
  createWorkflowLabServer,
  isAllowedHost,
  isAllowedOrigin,
  parseArguments,
  readJsonBody,
  validateWriteRequest
};
