#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_STDIN = 1024 * 1024;
const AUTO_RECAP_START = '<!-- PIXIU:AUTO_RECAP:START -->';
const AUTO_RECAP_END = '<!-- PIXIU:AUTO_RECAP:END -->';
const MOTHER_PROJECT = '\u6bcd\u9ad4';

function run(rawInput, options = {}) {
  const input = parseHookInput(rawInput);
  if (!input) return rawInput || '';

  const corePath = resolveCorePath(options.corePath);
  const transcriptPath = input.transcript_path || process.env.CLAUDE_TRANSCRIPT_PATH || '';
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return rawInput || '';

  const transcript = readTranscript(transcriptPath);
  const summary = extractTranscriptSummary(transcript);
  if (!summary) return rawInput || '';

  const now = options.now || new Date();
  const date = formatDate(now);
  const project = inferProject(summary, input.cwd || process.cwd());
  const month = date.slice(0, 7);
  const sessionKey = deriveSessionKey(input, transcriptPath);
  const topic = `auto-session-${sessionKey}`;
  const recapRoot = path.join(corePath, 'vault', 'memory', 'recaps');
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const targetDir = path.join(recapRoot, project, month);
  const targetName = `${date}-${project}-${topic}.md`;
  const transcriptHash = sha256(transcript).slice(0, 16);
  // 跨日 session：同 sessionKey 已有檔案（查本月與上月）就沿用，避免一 session 兩檔
  const existingSessionPath = findExistingSessionFile(recapRoot, project, topic, [month, prevMonth]);
  const targetPath = existingSessionPath || resolveAutoTargetPath(targetDir, targetName, transcriptHash);
  const content = buildRecapContent({
    date,
    project,
    topic,
    summary,
    transcriptPath,
    transcriptHash,
    trigger: input.hook_event_name === 'SessionEnd' ? 'session-end' : 'stop'
  });

  fs.mkdirSync(targetDir, { recursive: true });
  if (fs.existsSync(targetPath)) {
    const existing = fs.readFileSync(targetPath, 'utf8');
    if (existing.includes(AUTO_RECAP_START) && existing.includes(AUTO_RECAP_END)) {
      let next = existing.replace(
        new RegExp(`${escapeRegExp(AUTO_RECAP_START)}[\\s\\S]*?${escapeRegExp(AUTO_RECAP_END)}`),
        extractAutoBlock(content)
      );
      const summaryLine = (content.match(/^summary: .*$/m) || [null])[0];
      if (summaryLine) next = next.replace(/^summary: .*$/m, summaryLine);
      fs.writeFileSync(targetPath, next, 'utf8');
      return rawInput || '';
    }
  }

  fs.writeFileSync(targetPath, content, 'utf8');
  return rawInput || '';
}

function parseHookInput(rawInput) {
  if (!rawInput || !rawInput.trim()) return null;
  try {
    return JSON.parse(rawInput);
  } catch {
    return null;
  }
}

function resolveCorePath(explicitCorePath) {
  if (explicitCorePath) return explicitCorePath;
  return process.env.PIXIU_CORE ||
    process.env.PIXIU_CORE_PATH ||
    path.join(process.env.USERPROFILE || process.env.HOME || '.', '.pixiu-core');
}

function readTranscript(transcriptPath) {
  return fs.readFileSync(transcriptPath, 'utf8');
}

function extractTranscriptSummary(transcript) {
  const lines = transcript.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const userMessages = [];
  const filesModified = new Set();
  const toolsUsed = new Set();

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }

    const userText = extractUserText(entry);
    if (userText) userMessages.push(userText);
    collectToolUse(entry, toolsUsed, filesModified);
  }

  if (userMessages.length === 0) return null;

  return {
    userMessages: userMessages.slice(-20),
    toolsUsed: Array.from(toolsUsed).slice(0, 20),
    filesModified: Array.from(filesModified).slice(0, 30)
  };
}

function extractUserText(entry) {
  if (!(entry.type === 'user' || entry.role === 'user' || entry.message?.role === 'user')) return '';
  const raw = entry.message?.content ?? entry.content;
  const text = typeof raw === 'string'
    ? raw
    : Array.isArray(raw)
      ? raw.map(block => block?.text || '').join(' ')
      : '';
  // 去識別化：使用者訊息可能含本機路徑，寫入 vault 前正規化
  return sanitizeLocalPath(text.replace(/\s+/g, ' ').trim());
}

function collectToolUse(entry, toolsUsed, filesModified) {
  if (entry.type === 'tool_use' || entry.tool_name) {
    const toolName = entry.tool_name || entry.name || '';
    if (toolName) toolsUsed.add(toolName);
    const filePath = entry.tool_input?.file_path || entry.input?.file_path || '';
    if (filePath && isMutationTool(toolName)) filesModified.add(filePath);
  }

  if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
    for (const block of entry.message.content) {
      if (block.type !== 'tool_use') continue;
      const toolName = block.name || '';
      if (toolName) toolsUsed.add(toolName);
      const filePath = block.input?.file_path || '';
      if (filePath && isMutationTool(toolName)) filesModified.add(filePath);
    }
  }
}

function isMutationTool(toolName) {
  return ['Edit', 'Write', 'MultiEdit'].includes(toolName);
}

function inferProject(summary, cwd) {
  const haystack = [
    cwd,
    ...summary.filesModified,
    ...summary.userMessages
  ].join(' ').toLowerCase();

  const rules = [
    ['PCLMS_AP', /pclms_ap/],
    ['PCLMS_BK', /pclms_bk|pclms_bk_new/],
    ['PCLMS', /pclms/],
    ['PEPIS', /pepis|ccps|apepis/],
    ['PERMS', /perms/],
    ['PISSO', /pisso|isso/],
    ['SECOND_BRAIN', /second[-_ ]brain|qdrant|nvidia|embedding/],
    ['AUTO_RESEARCH', /auto[-_ ]research/],
    ['DOCX_TOOLING', /docx|make-docx/],
    ['OPENSPEC', /openspec/],
    ['PPOST', /ppost/],
    ['PTWCS', /ptwcs/]
  ];

  for (const [project, pattern] of rules) {
    if (pattern.test(haystack)) return project;
  }

  if (/pixiu|mothership|vault|recap|skill|workflow|hook|agent/.test(haystack)) {
    return MOTHER_PROJECT;
  }

  return MOTHER_PROJECT;
}

function deriveSessionKey(input, transcriptPath) {
  const sid = String(input.session_id || '').replace(/[^a-zA-Z0-9]/g, '');
  if (sid.length >= 8) return sid.slice(-8).toLowerCase();
  return sha256(String(transcriptPath)).slice(0, 8);
}

function buildTopic(summary) {
  const source = summary.userMessages[summary.userMessages.length - 1] || 'session';
  const words = source
    .replace(/[\\/:*?"<>|`#\[\]{}()]/g, ' ')
    .replace(/[^\p{L}\p{N}\s_-]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8);
  const slug = words.join('-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `auto-${slug || 'session-capture'}`;
}

function findExistingSessionFile(recapRoot, project, topic, months) {
  for (const m of months) {
    const dir = path.join(recapRoot, project, m);
    let entries;
    try { entries = fs.readdirSync(dir); } catch { continue; }
    for (const f of entries) {
      if (!f.includes(`-${topic}`) || !f.endsWith('.md')) continue;
      const p = path.join(dir, f);
      // 只接手確定是本 session 的 auto recap；manual 同名檔絕不覆寫
      try {
        if (fs.readFileSync(p, 'utf8').includes('recap_mode: auto')) return p;
      } catch {}
    }
  }
  return null;
}

function resolveAutoTargetPath(targetDir, targetName, transcriptHash) {
  const basePath = path.join(targetDir, targetName);
  if (!fs.existsSync(basePath)) return basePath;

  const existing = fs.readFileSync(basePath, 'utf8');
  if (existing.includes(`auto_transcript_hash: ${transcriptHash}`)) {
    return basePath;
  }
  if (existing.includes('recap_mode: auto') || existing.includes(AUTO_RECAP_START)) {
    return basePath;
  }

  const stem = path.basename(targetName, '.md');
  for (let i = 1; i < 100; i++) {
    const candidate = path.join(targetDir, `${stem}-auto${i}.md`);
    if (!fs.existsSync(candidate)) return candidate;
    const content = fs.readFileSync(candidate, 'utf8');
    if (content.includes(`auto_transcript_hash: ${transcriptHash}`)) return candidate;
  }

  return path.join(targetDir, `${stem}-auto-${transcriptHash}.md`);
}

function buildRecapContent({ date, project, topic, summary, transcriptPath, transcriptHash, trigger }) {
  const system = project === MOTHER_PROJECT ? 'PIXIUCORE' : normalizeSystem(project);
  const frontmatterProject = project === MOTHER_PROJECT ? 'PIXIUCORE' : project;
  const title = `Auto Recap: ${topic.replace(/^auto-/, '')}`;
  const summaryText = summary.userMessages[summary.userMessages.length - 1] || 'Auto captured session recap.';
  const displayTranscriptPath = sanitizeLocalPath(transcriptPath);
  const displayFilesModified = summary.filesModified.map(sanitizeLocalPath);
  const sourcePaths = summary.filesModified.length > 0
    ? displayFilesModified.map(file => `  - ${file}`).join('\n')
    : '  - transcript';

  return `---\n` +
    `type: session-recap\n` +
    `date: ${date}\n` +
    `project: ${frontmatterProject}\n` +
    `system: ${system}\n` +
    `repo: auto-detected\n` +
    `topic: ${topic}\n` +
    `status: draft-auto\n` +
    `recap_mode: auto\n` +
    `auto_trigger: ${trigger}\n` +
    `auto_transcript_hash: ${transcriptHash}\n` +
    `tags: [recap, auto, draft-auto, ${frontmatterProject.toLowerCase().replace(/[^a-z0-9_-]/g, '-') }]\n` +
    `source_paths:\n${sourcePaths}\n` +
    `summary: ${quoteYaml(summaryText.slice(0, 180))}\n` +
    `---\n\n` +
    `# ${title}\n\n` +
    `${AUTO_RECAP_START}\n` +
    `## 觸發\n\n` +
    `- mode: auto\n` +
    `- trigger: ${trigger}\n` +
    `- transcript: ${displayTranscriptPath}\n` +
    `- hash: ${transcriptHash}\n\n` +
    `## 使用者訊息\n\n` +
    summary.userMessages.map(message => `- ${escapeMarkdownLine(message)}`).join('\n') +
    `\n\n## 修改檔案\n\n` +
    (summary.filesModified.length > 0
      ? displayFilesModified.map(file => `- ${escapeMarkdownLine(file)}`).join('\n')
      : '- 無') +
    `\n\n## 工具\n\n` +
    (summary.toolsUsed.length > 0
      ? summary.toolsUsed.map(tool => `- ${escapeMarkdownLine(tool)}`).join('\n')
      : '- 無') +
    `\n\n## 待人工確認\n\n` +
    `- [ ] 確認這份 auto recap 是否要升格為正式 recap。\n` +
    `- [ ] 若半自動 recap 已覆蓋同一工作，可刪除或保留本 draft。\n` +
    `${AUTO_RECAP_END}\n`;
}

function sanitizeLocalPath(value) {
  return String(value)
    .replace(/\\\\\?\\C:\\Users\\[^\\/]+/g, '%USERPROFILE%')
    .replace(/C:\\Users\\[^\\/]+/g, '%USERPROFILE%')
    .replace(/C:\/Users\/[^\\/]+/g, '%USERPROFILE%');
}

function normalizeSystem(project) {
  if (project.startsWith('PCLMS')) return 'PCLMS';
  return project;
}

function extractAutoBlock(content) {
  const match = content.match(new RegExp(`${escapeRegExp(AUTO_RECAP_START)}[\\s\\S]*?${escapeRegExp(AUTO_RECAP_END)}`));
  return match ? match[0] : content;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function quoteYaml(value) {
  return JSON.stringify(String(value).replace(/\r?\n/g, ' '));
}

function escapeMarkdownLine(value) {
  return String(value).replace(/\r?\n/g, ' ').replace(/`/g, '\\`');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) {
      const remaining = MAX_STDIN - raw.length;
      raw += chunk.substring(0, remaining);
    }
  });
  process.stdin.on('end', () => {
    try {
      process.stdout.write(run(raw));
    } catch (err) {
      process.stderr.write(`[pixiu-auto-recap] ${err.message}\n`);
      process.stdout.write(raw);
    }
  });
}

module.exports = {
  run,
  extractTranscriptSummary,
  inferProject,
  buildTopic
};
