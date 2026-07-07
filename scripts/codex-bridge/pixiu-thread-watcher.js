#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_STDIN = 1024 * 1024;

function run(rawInput, options = {}) {
  const input = parseJson(rawInput);
  if (!input) return rawInput || '';

  const corePath = resolveCorePath(options.corePath);
  const transcriptPath = resolveTranscriptPath(input, options);
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return rawInput || '';

  // 機器狀態不進 vault（governance quick-diagnosis 2026-07-03）：改存 %PIXIU_CORE%\state\
  const stateDir = options.stateDir || path.join(corePath, 'state', 'hook-state', 'codex-thread-watcher');
  const tempDir = options.tempDir || path.join(stateDir, 'transcripts');
  const homunculusDir = options.homunculusDir || path.join(resolveHome(), '.claude', 'homunculus');
  const sessionId = input.session_id || inferSessionIdFromPath(transcriptPath) || 'unknown';
  const statePath = path.join(stateDir, `${safeFileName(sessionId)}.json`);
  const state = readState(statePath);
  const entries = readJsonl(transcriptPath);
  const project = detectProject(input, entries);
  const mode = options.mode || process.argv[2] || 'all';

  if (mode === 'all' || mode === 'pre:observe' || mode === 'post:observe') {
    writeObservations({
      entries,
      state,
      homunculusDir,
      project,
      sessionId,
      mode,
      now: options.now || new Date()
    });
  }

  if (mode === 'all' || mode === 'session:end:marker') {
    writeSessionEndMarker({
      input,
      state,
      stateDir,
      sessionId,
      transcriptPath,
      now: options.now || new Date()
    });
    runWikiCapture(rawInput, { corePath });
  }

  if (mode === 'all' || mode === 'session:end:pixiu:auto-recap') {
    runSessionEndAutoRecap({
      input,
      entries,
      state,
      corePath,
      tempDir,
      transcriptPath,
      sessionId,
      now: options.now || new Date()
    });
  }

  writeState(statePath, state);
  return rawInput || '';
}

function resolveCorePath(explicitCorePath) {
  return explicitCorePath ||
    process.env.PIXIU_CORE ||
    process.env.PIXIU_CORE_PATH ||
    path.join(resolveHome(), '.pixiu-core');
}

function resolveHome() {
  return process.env.USERPROFILE || process.env.HOME || '.';
}

function resolveTranscriptPath(input, options) {
  const candidates = [
    input.transcript_path,
    input.codex_transcript_path,
    input.session_path,
    options.transcriptPath
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  if (input.session_id) {
    return findCodexSessionById(input.session_id, options.codexHome);
  }

  return '';
}

function findCodexSessionById(sessionId, codexHome) {
  const root = path.join(codexHome || process.env.CODEX_HOME || path.join(resolveHome(), '.codex'), 'sessions');
  if (!fs.existsSync(root)) return '';
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      if (entry.isFile() && entry.name.endsWith('.jsonl') && entry.name.includes(sessionId)) return full;
    }
  }
  return '';
}

function writeObservations({ entries, state, homunculusDir, project, sessionId, mode, now }) {
  const observations = extractObservations(entries, sessionId, project, now);
  const filtered = observations.filter(observation => {
    if (mode === 'pre:observe') return observation.event === 'tool_start';
    if (mode === 'post:observe') return observation.event === 'tool_complete';
    return true;
  });
  if (!filtered.length) return;

  const projectDir = path.join(homunculusDir, 'projects', project.id);
  fs.mkdirSync(path.join(projectDir, 'observations.archive'), { recursive: true });
  writeProjectMetadata(homunculusDir, projectDir, project);

  const outputPath = path.join(projectDir, 'observations.jsonl');
  for (const observation of filtered) {
    const key = `observe:${observation.source_index}:${observation.event}:${observation.tool_use_id || observation.tool}`;
    if (state.processed[key]) continue;
    fs.appendFileSync(outputPath, JSON.stringify(stripInternalFields(observation)) + '\n', 'utf8');
    state.processed[key] = true;
  }
}

function extractObservations(entries, sessionId, project, now) {
  const calls = new Map();
  const observations = [];

  entries.forEach((entry, index) => {
    const payload = entry.payload || {};
    if (entry.type !== 'response_item') return;

    if (payload.type === 'function_call') {
      const tool = payload.name || 'unknown';
      const toolUseId = payload.call_id || `call-${index}`;
      const input = compactForLog(payload.arguments || '');
      calls.set(toolUseId, { tool, input });
      observations.push({
        timestamp: entry.timestamp || now.toISOString(),
        event: 'tool_start',
        tool,
        session: sessionId,
        tool_use_id: toolUseId,
        project_id: project.id,
        project_name: project.name,
        input: scrubSecrets(input),
        source_index: index
      });
      return;
    }

    if (payload.type === 'function_call_output') {
      const toolUseId = payload.call_id || `call-${index}`;
      const call = calls.get(toolUseId) || { tool: 'unknown' };
      observations.push({
        timestamp: entry.timestamp || now.toISOString(),
        event: 'tool_complete',
        tool: call.tool,
        session: sessionId,
        tool_use_id: toolUseId,
        project_id: project.id,
        project_name: project.name,
        output: scrubSecrets(compactForLog(payload.output || '')),
        source_index: index
      });
    }
  });

  return observations;
}

function writeProjectMetadata(homunculusDir, projectDir, project) {
  const metadata = {
    id: project.id,
    name: project.name,
    root: project.root,
    remote: '',
    last_seen: new Date().toISOString()
  };

  fs.mkdirSync(homunculusDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf8');

  const registryPath = path.join(homunculusDir, 'projects.json');
  const registry = fs.existsSync(registryPath) ? parseJson(fs.readFileSync(registryPath, 'utf8')) || {} : {};
  registry[project.id] = { ...registry[project.id], ...metadata };
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf8');
}

function writeSessionEndMarker({ input, state, stateDir, sessionId, transcriptPath, now }) {
  const markerKey = `marker:${sessionId}:${input.turn_id || sha256(transcriptPath)}`;
  if (state.processed[markerKey]) return;

  fs.mkdirSync(stateDir, { recursive: true });
  fs.appendFileSync(
    path.join(stateDir, 'session-end-markers.jsonl'),
    JSON.stringify({
      timestamp: now.toISOString(),
      replacement_for: 'session:end:marker',
      source_event: input.hook_event_name || 'Stop',
      session_id: sessionId,
      turn_id: input.turn_id || '',
      transcript_path: transcriptPath,
      cwd: input.cwd || ''
    }) + '\n',
    'utf8'
  );
  state.processed[markerKey] = true;
}

function runSessionEndAutoRecap({ input, entries, state, corePath, tempDir, transcriptPath, sessionId }) {
  const normalized = normalizeCodexTranscript(entries);
  if (!normalized.trim()) return;

  const hash = sha256(normalized);
  const recapKey = `auto-recap:${sessionId}:${hash}`;
  if (state.processed[recapKey]) return;

  const hookPath = path.join(corePath, 'scripts', 'hooks', 'pixiu-auto-recap.js');
  if (!fs.existsSync(hookPath)) return;

  fs.mkdirSync(tempDir, { recursive: true });
  // 同一 session 固定檔名（覆寫），避免每次內容變動都長新檔
  const normalizedPath = path.join(tempDir, `${safeFileName(sessionId)}.jsonl`);
  fs.writeFileSync(normalizedPath, normalized, 'utf8');

  const hook = require(hookPath);
  if (!hook || typeof hook.run !== 'function') return;

  const raw = JSON.stringify({
    hook_event_name: 'SessionEnd',
    transcript_path: normalizedPath,
    codex_transcript_path: transcriptPath,
    session_id: sessionId,
    turn_id: input.turn_id || '',
    cwd: input.cwd || detectCwd(entries) || process.cwd()
  });

  hook.run(raw, { corePath });
  state.processed[recapKey] = true;
}

function runWikiCapture(rawInput, options = {}) {
  const pocRoot = resolveWikiPocPath(options.pocRoot);
  const hookPath = path.join(pocRoot, 'scripts', 'codex-wiki-capture.js');
  if (!fs.existsSync(hookPath)) return;

  try {
    const hook = require(hookPath);
    if (hook && typeof hook.run === 'function') {
      hook.run(rawInput, { pocRoot });
    }
  } catch (err) {
    process.stderr.write(`[pixiu-thread-watcher] wiki capture skipped: ${err.message}\n`);
  }
}

function resolveWikiPocPath(explicitPocRoot) {
  return explicitPocRoot ||
    process.env.PIXIU_WIKI_POC ||
    path.join(resolveHome(), 'Documents', 'Playground', 'kc-llm-wiki-poc');
}

function normalizeCodexTranscript(entries) {
  const output = [];
  const calls = new Map();

  entries.forEach(entry => {
    const payload = entry.payload || {};
    if (entry.type === 'response_item' && payload.type === 'message' && payload.role === 'user') {
      const text = extractContentText(payload.content);
      if (isRecapUserText(text)) {
        output.push({
          type: 'user',
          message: { role: 'user', content: text }
        });
      }
      return;
    }

    if (entry.type === 'response_item' && payload.type === 'function_call') {
      const input = parseToolArguments(payload.arguments);
      const toolName = payload.name || 'unknown';
      calls.set(payload.call_id || '', { toolName, input });
      output.push({
        type: 'tool_use',
        tool_name: toolName,
        name: toolName,
        tool_input: input,
        input
      });
      return;
    }

    if (entry.type === 'response_item' && payload.type === 'function_call_output') {
      const call = calls.get(payload.call_id || '') || {};
      output.push({
        type: 'tool_result',
        tool_name: call.toolName || 'unknown',
        tool_output: payload.output || '',
        output: payload.output || ''
      });
    }
  });

  return output.map(entry => JSON.stringify(entry)).join('\n') + (output.length ? '\n' : '');
}

function parseToolArguments(value) {
  if (!value || typeof value !== 'string') return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return { arguments: value };
  }
}

function extractContentText(content) {
  if (typeof content === 'string') return content.replace(/\s+/g, ' ').trim();
  if (!Array.isArray(content)) return '';
  return content
    .map(block => block && (block.text || block.content || ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRecapUserText(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  if (value.startsWith('<codex_internal_context')) return false;
  if (value.startsWith('# AGENTS.md instructions')) return false;
  if (value.includes('========= MEMORY_SUMMARY BEGINS =========')) return false;
  if (value.includes('<permissions instructions>')) return false;
  if (value.includes('<skills_instructions>')) return false;
  if (value.length > 12000 && /AGENTS\.md|MEMORY_SUMMARY|developer|system/i.test(value)) return false;
  return true;
}

function detectProject(input, entries) {
  const root = input.cwd || detectCwd(entries) || process.cwd();
  const normalized = String(root || '').replace(/[\\/]+$/, '');
  const name = path.basename(normalized.replace(/\//g, path.sep)) || 'global';
  return {
    id: sha256(normalized || 'global').slice(0, 12),
    name,
    root: normalized
  };
}

function detectCwd(entries) {
  for (const entry of entries) {
    if (entry.type === 'session_meta' && entry.payload && entry.payload.cwd) {
      return entry.payload.cwd;
    }
  }
  return '';
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => parseJson(line))
    .filter(Boolean);
}

function readState(filePath) {
  if (!fs.existsSync(filePath)) return { processed: {} };
  const state = parseJson(fs.readFileSync(filePath, 'utf8'));
  if (!state || typeof state !== 'object') return { processed: {} };
  state.processed = state.processed && typeof state.processed === 'object' ? state.processed : {};
  return state;
}

function writeState(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stripInternalFields(value) {
  const next = { ...value };
  delete next.source_index;
  return next;
}

function compactForLog(value) {
  return String(value).slice(0, 5000);
}

function scrubSecrets(value) {
  return String(value).replace(
    /(api[_-]?key|token|secret|password|authorization|credentials?|auth)(["'\s:=]+)([A-Za-z]+\s+)?([A-Za-z0-9_\-/.+=]{8,})/gi,
    (_match, key, sep, scheme) => `${key}${sep}${scheme || ''}[REDACTED]`
  );
}

function inferSessionIdFromPath(filePath) {
  const match = String(filePath).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match ? match[1] : '';
}

function safeFileName(value) {
  return String(value || 'unknown').replace(/[^A-Za-z0-9._-]/g, '_');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) {
      raw += chunk.substring(0, MAX_STDIN - raw.length);
    }
  });
  process.stdin.on('end', () => {
    try {
      process.stdout.write(run(raw));
    } catch (err) {
      process.stderr.write(`[pixiu-thread-watcher] ${err.message}\n`);
      process.stdout.write(raw);
    }
  });
}

module.exports = {
  run,
  normalizeCodexTranscript,
  isRecapUserText,
  extractObservations,
  resolveTranscriptPath
};
