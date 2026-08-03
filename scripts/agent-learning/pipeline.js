'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const AGENT_LEARNING_ROOT = 'vault/memory/agent-learning';
const OBSERVATION_ROOT = `${AGENT_LEARNING_ROOT}/observations`;
const REPORT_ROOT = `${AGENT_LEARNING_ROOT}/verifier-reports`;
const INSTINCT_ROOT = `${AGENT_LEARNING_ROOT}/instincts`;
const CANDIDATE_ROOT = `${AGENT_LEARNING_ROOT}/promote-candidates`;
const MANIFEST_PATH = `${AGENT_LEARNING_ROOT}/index-manifest.json`;
const REQUIRED_SECTIONS = [
  'Context',
  'Action',
  'Result',
  'Why It Happened',
  'Recommendation',
  'Evidence',
  'Verification'
];
const ALLOWED_RESULTS = new Set(['pass', 'needs-review', 'reject']);
const ALLOWED_DESTINATIONS = new Set(['candidate', 'instinct', 'decision', 'sop', 'reject']);
const SENSITIVE_PATTERNS = [
  /\b(?:sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})\b/i,
  /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/i,
  /-----BEGIN(?: [A-Z0-9]+)* PRIVATE KEY-----/i,
  /\b(?:token|password|secret|api[_-]?key)\s*[:=]\s*\S{4,}/i,
  /\b[A-Za-z]:\\(?:Users|ProgramData|Windows)\\/i,
  /\\\\[^\\\s]+\\[^\\\s]+/
];

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function normalizeRelativePath(value) {
  const text = toPosix(value).trim();
  const segments = text.split('/');
  if (!text || path.isAbsolute(text) || /^[A-Za-z]:\//.test(text) || text.startsWith('/') || segments.includes('..')) {
    throw new Error(`路徑不合法：${text || '<empty>'}`);
  }
  return segments.filter(Boolean).join('/');
}

function resolveInsideCore(corePath, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const root = path.resolve(corePath);
  const absolutePath = path.resolve(root, ...normalized.split('/'));
  const comparisonRoot = process.platform === 'win32' ? root.toLowerCase() : root;
  const comparisonPath = process.platform === 'win32' ? absolutePath.toLowerCase() : absolutePath;
  if (comparisonPath !== comparisonRoot && !comparisonPath.startsWith(`${comparisonRoot}${path.sep}`)) {
    throw new Error(`路徑越界：${normalized}`);
  }
  return { normalized, absolutePath };
}

function parseScalar(value) {
  const text = String(value || '').trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (text.startsWith('[') && text.endsWith(']')) {
    const inner = text.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => item.trim().replace(/^['"]|['"]$/g, ''));
  }
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    if (text.startsWith('"')) {
      try {
        return JSON.parse(text);
      } catch {
        return text.slice(1, -1);
      }
    }
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

function parseFrontmatter(content) {
  const normalized = String(content || '').replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/);
  if (lines[0] !== '---') throw new Error('缺少 frontmatter');
  const end = lines.indexOf('---', 1);
  if (end === -1) throw new Error('frontmatter 未結束');

  const metadata = {};
  for (let index = 1; index < end; index += 1) {
    const line = lines[index];
    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2] || '';
    if (value.trim()) {
      metadata[key] = parseScalar(value);
      continue;
    }

    const items = [];
    while (index + 1 < end) {
      const next = lines[index + 1];
      const itemMatch = next.match(/^\s{2,}-\s+(.+)$/);
      if (!itemMatch) break;
      items.push(parseScalar(itemMatch[1]));
      index += 1;
    }
    metadata[key] = items;
  }

  return {
    metadata,
    body: lines.slice(end + 1).join('\n')
  };
}

function getSections(body) {
  const sections = new Map();
  let current = null;
  for (const line of String(body || '').split(/\r?\n/)) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      current = match[1];
      sections.set(current, []);
      continue;
    }
    if (current) sections.get(current).push(line);
  }
  return sections;
}

function sanitizeLine(value, fieldName) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 500) throw new Error(`${fieldName} 不合法`);
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error(`${fieldName} 含敏感內容`);
  }
  return text;
}

function quoteYaml(value) {
  return JSON.stringify(String(value));
}

function slug(value, fieldName = 'slug') {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(text)) {
    throw new Error(`${fieldName} 不合法`);
  }
  return text;
}

function assertSafeContent(content, label) {
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(String(content || '')))) {
    throw new Error(`${label} 含敏感內容`);
  }
}

function validateObservation(corePath, relativePath) {
  const { normalized, absolutePath } = resolveInsideCore(corePath, relativePath);
  if (!normalized.startsWith(`${OBSERVATION_ROOT}/`) || !normalized.endsWith('.md')) {
    throw new Error(`observation 路徑不合法：${normalized}`);
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error(`observation 不存在：${normalized}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf8');
  assertSafeContent(content, normalized);
  const { metadata, body } = parseFrontmatter(content);
  if (metadata.type !== 'agent-observation') throw new Error(`observation type 不合法：${normalized}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(metadata.date || ''))) throw new Error(`observation date 不合法：${normalized}`);
  const project = slug(metadata.project, 'project').toUpperCase();
  const system = slug(metadata.system, 'system').toUpperCase();
  const repo = slug(metadata.repo, 'repo');
  const topic = slug(metadata.topic, 'topic');
  if (!['candidate', 'verified', 'rejected'].includes(String(metadata.status || ''))) {
    throw new Error(`observation status 不合法：${normalized}`);
  }
  if (typeof metadata.verified !== 'boolean') throw new Error(`observation verified 不合法：${normalized}`);
  const sourcePaths = Array.isArray(metadata.source_paths) ? metadata.source_paths : [];
  if (sourcePaths.length === 0) throw new Error(`source_paths 不合法：${normalized}`);
  const normalizedSources = sourcePaths.map((sourcePath) => {
    let resolved;
    try {
      resolved = resolveInsideCore(corePath, sourcePath);
    } catch {
      throw new Error(`source_paths 不合法：${normalized}`);
    }
    if (!fs.existsSync(resolved.absolutePath) || !fs.statSync(resolved.absolutePath).isFile()) {
      throw new Error(`source_paths 不合法：${normalized}`);
    }
    return resolved.normalized;
  });

  const sections = getSections(body);
  for (const section of REQUIRED_SECTIONS) {
    if (!sections.has(section) || !sections.get(section).join('\n').trim()) {
      throw new Error(`observation 缺少 ${section}：${normalized}`);
    }
  }

  const confidence = Number(metadata.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error(`observation confidence 不合法：${normalized}`);
  }

  return {
    relativePath: normalized,
    absolutePath,
    content,
    metadata: {
      ...metadata,
      project,
      system,
      repo,
      topic,
      source_paths: normalizedSources,
      confidence
    },
    sections
  };
}

function replaceFrontmatterField(content, field, value) {
  const expression = new RegExp(`^${field}:.*$`, 'm');
  if (!expression.test(content)) throw new Error(`缺少 frontmatter 欄位：${field}`);
  return content.replace(expression, `${field}: ${value}`);
}

function replaceVerificationSection(content, lines) {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const sourceLines = content.split(/\r?\n/);
  const start = sourceLines.findIndex((line) => line.trim() === '## Verification');
  if (start === -1) throw new Error('缺少 Verification 區塊');
  let end = sourceLines.length;
  for (let index = start + 1; index < sourceLines.length; index += 1) {
    if (/^##\s+/.test(sourceLines[index])) {
      end = index;
      break;
    }
  }
  const replacement = ['## Verification', '', ...lines, ''];
  sourceLines.splice(start, end - start, ...replacement);
  while (sourceLines.length > 1 && sourceLines[sourceLines.length - 1] === '' && sourceLines[sourceLines.length - 2] === '') {
    sourceLines.pop();
  }
  return `${sourceLines.join(newline).replace(new RegExp(`${newline}*$`), '')}${newline}`;
}

function renderVerifiedObservation(observation, decision, verifier) {
  let content = observation.content;
  const status = decision.result === 'pass' ? 'verified' : decision.result === 'reject' ? 'rejected' : 'candidate';
  const verified = decision.result === 'pass' ? 'true' : 'false';
  content = replaceFrontmatterField(content, 'status', status);
  content = replaceFrontmatterField(content, 'verified', verified);
  content = replaceVerificationSection(content, [
    `- verifier: ${verifier}`,
    `- result: ${decision.result}`,
    `- destination: ${decision.destination}`,
    `- notes: ${sanitizeLine(decision.notes, 'notes')}`
  ]);
  return content;
}

function renderVerifierReport(observation, decision, verifier, date) {
  const sources = [observation.relativePath, ...observation.metadata.source_paths];
  return `---\n` +
    `type: agent-verifier-report\n` +
    `date: ${date}\n` +
    `project: ${observation.metadata.project}\n` +
    `system: ${observation.metadata.system}\n` +
    `repo: ${observation.metadata.repo}\n` +
    `topic: ${observation.metadata.topic}\n` +
    `status: ${decision.result}\n` +
    `verifier: ${verifier}\n` +
    `observation: ${observation.relativePath}\n` +
    `destination: ${decision.destination}\n` +
    `tags: [agent-learning, verifier-report]\n` +
    `source_paths:\n${sources.map((item) => `  - ${item}`).join('\n')}\n` +
    `summary: ${quoteYaml(`Observation ${observation.metadata.topic} verifier result: ${decision.result}.`)}\n` +
    `---\n\n` +
    `# Verifier Report - ${observation.metadata.topic}\n\n` +
    `## Result\n\n` +
    `- result: ${decision.result}\n` +
    `- destination: ${decision.destination}\n` +
    `- verifier: ${verifier}\n\n` +
    `## Checklist Outcome\n\n` +
    `- Evidence paths are relative, readable, and inside the core.\n` +
    `- Required observation sections are present.\n` +
    `- No supported secret or machine-sensitive path pattern was detected.\n` +
    `- Promotion remains bounded by the explicit review destination.\n\n` +
    `## Notes\n\n${sanitizeLine(decision.notes, 'notes')}\n`;
}

function normalizeReview(review) {
  if (!review || review.schemaVersion !== 1) throw new Error('review schemaVersion 必須為 1');
  const verifier = slug(review.verifier, 'verifier');
  if (!Array.isArray(review.observations) || review.observations.length === 0) {
    throw new Error('review observations 不可為空');
  }

  const seen = new Set();
  const observations = review.observations.map((decision) => {
    const relativePath = normalizeRelativePath(decision.path);
    if (seen.has(relativePath)) throw new Error(`review observation 重複：${relativePath}`);
    seen.add(relativePath);
    const result = String(decision.result || '');
    const destination = String(decision.destination || '');
    if (!ALLOWED_RESULTS.has(result)) throw new Error(`review result 不合法：${relativePath}`);
    if (!ALLOWED_DESTINATIONS.has(destination)) throw new Error(`review destination 不合法：${relativePath}`);
    if (result !== 'pass' && !['candidate', 'reject'].includes(destination)) {
      throw new Error(`未通過的 observation 不得升級：${relativePath}`);
    }
    const cluster = decision.cluster == null || decision.cluster === '' ? null : slug(decision.cluster, 'cluster');
    if (destination === 'instinct' && !cluster) throw new Error(`instinct destination 缺少 cluster：${relativePath}`);
    return {
      path: relativePath,
      result,
      destination,
      cluster,
      notes: sanitizeLine(decision.notes, 'notes')
    };
  });

  const promotionGroups = Array.isArray(review.promotionGroups) ? review.promotionGroups.map((group) => ({
    cluster: slug(group.cluster, 'cluster'),
    title: sanitizeLine(group.title, 'title'),
    summary: sanitizeLine(group.summary, 'summary'),
    trigger: sanitizeLine(group.trigger, 'trigger'),
    firstMove: sanitizeLine(group.firstMove, 'firstMove'),
    rationale: sanitizeLine(group.rationale, 'rationale'),
    boundaries: sanitizeLine(group.boundaries, 'boundaries'),
    nextTarget: slug(group.nextTarget, 'nextTarget').toLowerCase()
  })) : [];
  const groupNames = new Set();
  for (const group of promotionGroups) {
    if (!['decision', 'sop', 'skill', 'context-plan'].includes(group.nextTarget)) {
      throw new Error(`nextTarget 不合法：${group.cluster}`);
    }
    if (groupNames.has(group.cluster)) throw new Error(`promotion group 重複：${group.cluster}`);
    groupNames.add(group.cluster);
  }

  return { verifier, observations, promotionGroups };
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('now 不合法');
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function renderInstinct(group, observations, date) {
  const project = observations[0].metadata.project;
  const system = observations[0].metadata.system;
  const repo = observations[0].metadata.repo;
  const confidence = Math.min(
    0.85,
    observations.reduce((sum, item) => sum + item.metadata.confidence, 0) / observations.length + 0.1
  );
  const supports = observations.map((item) => item.relativePath);
  return `---\n` +
    `type: agent-instinct\n` +
    `date: ${date}\n` +
    `project: ${project}\n` +
    `system: ${system}\n` +
    `repo: ${repo}\n` +
    `topic: ${group.cluster}\n` +
    `status: active\n` +
    `summary: ${quoteYaml(group.summary)}\n` +
    `tags: [agent-learning, instinct]\n` +
    `confidence: ${confidence.toFixed(2)}\n` +
    `supporting_observations:\n${supports.map((item) => `  - ${item}`).join('\n')}\n` +
    `contradicting_observations: []\n` +
    `---\n\n` +
    `# Instinct - ${group.title}\n\n` +
    `## Trigger\n\n${group.trigger}\n\n` +
    `## First Move\n\n${group.firstMove}\n\n` +
    `## Rationale\n\n${group.rationale}\n\n` +
    `## Boundaries\n\n${group.boundaries}\n\n` +
    `## Evidence Base\n\n${supports.map((item) => `- ${item}`).join('\n')}\n\n` +
    `## Promotion Rule\n\n` +
    `建立 promote candidate 供人工審核；不得自動修改 user_rules、SOP、Skill 或其他治理檔。建議下一層：${group.nextTarget}。\n`;
}

function renderPromoteCandidate(group, instinctPath, observations, date) {
  const supports = observations.map((item) => item.relativePath);
  return `---\n` +
    `type: agent-promote-candidate\n` +
    `date: ${date}\n` +
    `project: ${observations[0].metadata.project}\n` +
    `system: ${observations[0].metadata.system}\n` +
    `repo: ${observations[0].metadata.repo}\n` +
    `topic: ${group.cluster}\n` +
    `status: needs-approval\n` +
    `target: ${group.nextTarget}\n` +
    `instinct: ${instinctPath}\n` +
    `tags: [agent-learning, promote-candidate]\n` +
    `source_paths:\n  - ${instinctPath}\n${supports.map((item) => `  - ${item}`).join('\n')}\n` +
    `summary: ${quoteYaml(`Review ${group.cluster} for promotion to ${group.nextTarget}.`)}\n` +
    `---\n\n` +
    `# Promote Candidate - ${group.title}\n\n` +
    `## Proposed Target\n\n${group.nextTarget}\n\n` +
    `## Basis\n\n${group.summary}\n\n` +
    `## Supporting Evidence\n\n${supports.map((item) => `- ${item}`).join('\n')}\n\n` +
    `## Approval Boundary\n\n` +
    `此檔只提出候選，不代表已升格；修改治理檔、SOP、Skill 或 user_rules 前仍需使用者明確核准。\n`;
}

function listMarkdownFiles(corePath, rootRelativePath) {
  const { absolutePath } = resolveInsideCore(corePath, rootRelativePath);
  if (!fs.existsSync(absolutePath)) return [];
  return fs.readdirSync(absolutePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `${rootRelativePath}/${entry.name}`)
    .sort();
}

function createDocumentRecord(relativePath, content) {
  if (!String(content || '').replace(/^\uFEFF/, '').startsWith('---\n') &&
      !String(content || '').replace(/^\uFEFF/, '').startsWith('---\r\n')) {
    return null;
  }
  const { metadata } = parseFrontmatter(content);
  if (!String(metadata.type || '').startsWith('agent-')) return null;
  if (metadata.type === 'agent-observation' && metadata.verified !== true) return null;
  return {
    type: metadata.type,
    path: relativePath,
    sha256: sha256(content),
    date: String(metadata.date || ''),
    project: String(metadata.project || ''),
    system: String(metadata.system || ''),
    repo: String(metadata.repo || ''),
    topic: String(metadata.topic || ''),
    status: String(metadata.status || '')
  };
}

function buildIndexManifest(corePath, plannedContent, now) {
  const candidatePaths = [
    ...listMarkdownFiles(corePath, OBSERVATION_ROOT),
    ...listMarkdownFiles(corePath, REPORT_ROOT),
    ...listMarkdownFiles(corePath, INSTINCT_ROOT),
    ...listMarkdownFiles(corePath, CANDIDATE_ROOT),
    ...plannedContent.keys()
  ];
  const documents = [];
  for (const relativePath of [...new Set(candidatePaths)].sort()) {
    const content = plannedContent.has(relativePath)
      ? plannedContent.get(relativePath)
      : fs.readFileSync(resolveInsideCore(corePath, relativePath).absolutePath, 'utf8');
    const record = createDocumentRecord(relativePath, content);
    if (record) documents.push(record);
  }
  documents.sort((left, right) => left.path.localeCompare(right.path, 'en'));
  return `${JSON.stringify({
    schemaVersion: 1,
    generatedAtUtc: (now instanceof Date ? now : new Date(now)).toISOString(),
    sourceOfTruth: 'vault-markdown',
    includes: [
      'verified observations',
      'verifier reports',
      'instincts',
      'promote candidates'
    ],
    excludes: ['consolidation-runs', 'unverified observations'],
    documents
  }, null, 2)}\n`;
}

function createWrite(corePath, relativePath, content, mode, expectedOriginalContent = null) {
  const { normalized, absolutePath } = resolveInsideCore(corePath, relativePath);
  return {
    relativePath: normalized,
    absolutePath,
    content,
    mode,
    expectedOriginalSha256: expectedOriginalContent == null ? null : sha256(expectedOriginalContent)
  };
}

function planAgentLearningRun({ corePath, review, now = new Date() }) {
  const root = path.resolve(corePath);
  const normalizedReview = normalizeReview(review);
  const date = formatDate(now);
  const writes = [];
  const plannedContent = new Map();
  const verifiedObservations = [];
  const observationsByCluster = new Map();

  for (const decision of normalizedReview.observations) {
    const observation = validateObservation(root, decision.path);
    const updated = renderVerifiedObservation(observation, decision, normalizedReview.verifier);
    const reportPath = `${REPORT_ROOT}/${observation.metadata.date}-${observation.metadata.topic}-verification.md`;
    const report = renderVerifierReport(observation, decision, normalizedReview.verifier, date);

    writes.push(createWrite(root, observation.relativePath, updated, 'update', observation.content));
    writes.push(createWrite(root, reportPath, report, 'create'));
    plannedContent.set(observation.relativePath, updated);
    plannedContent.set(reportPath, report);

    if (decision.result === 'pass') {
      verifiedObservations.push(observation.relativePath);
      if (decision.destination === 'instinct') {
        if (!observationsByCluster.has(decision.cluster)) observationsByCluster.set(decision.cluster, []);
        observationsByCluster.get(decision.cluster).push(observation);
      }
    }
  }

  const groupsByCluster = new Map(normalizedReview.promotionGroups.map((group) => [group.cluster, group]));
  for (const cluster of observationsByCluster.keys()) {
    if (!groupsByCluster.has(cluster)) throw new Error(`缺少 promotion group：${cluster}`);
  }
  for (const cluster of groupsByCluster.keys()) {
    if (!observationsByCluster.has(cluster)) throw new Error(`promotion group 沒有通過驗證的 observation：${cluster}`);
  }

  const instincts = [];
  const promoteCandidates = [];
  for (const [cluster, observations] of observationsByCluster.entries()) {
    if (observations.length < 2) throw new Error(`至少需要兩筆通過驗證的 observation：${cluster}`);
    const group = groupsByCluster.get(cluster);
    const instinctPath = `${INSTINCT_ROOT}/${date}-${cluster}.md`;
    const candidatePath = `${CANDIDATE_ROOT}/${date}-${cluster}-candidate.md`;
    const instinct = renderInstinct(group, observations, date);
    const candidate = renderPromoteCandidate(group, instinctPath, observations, date);
    writes.push(createWrite(root, instinctPath, instinct, 'create'));
    writes.push(createWrite(root, candidatePath, candidate, 'create'));
    plannedContent.set(instinctPath, instinct);
    plannedContent.set(candidatePath, candidate);
    instincts.push(instinctPath);
    promoteCandidates.push(candidatePath);
  }

  const manifest = buildIndexManifest(root, plannedContent, now);
  writes.push(createWrite(root, MANIFEST_PATH, manifest, 'replace'));

  return {
    corePath: root,
    date,
    writes,
    verifiedObservations: verifiedObservations.sort(),
    instincts: instincts.sort(),
    promoteCandidates: promoteCandidates.sort(),
    manifestPath: MANIFEST_PATH
  };
}

function preflightWrites(plan) {
  const seen = new Set();
  for (const write of plan.writes) {
    if (seen.has(write.relativePath)) throw new Error(`重複寫入路徑：${write.relativePath}`);
    seen.add(write.relativePath);
    assertSafeContent(write.content, write.relativePath);
    const exists = fs.existsSync(write.absolutePath);
    if (exists && !fs.statSync(write.absolutePath).isFile()) {
      throw new Error(`目標不是檔案：${write.relativePath}`);
    }
    if (write.mode === 'create' && exists) {
      const existing = fs.readFileSync(write.absolutePath, 'utf8');
      if (existing !== write.content) throw new Error(`既有產物內容不同：${write.relativePath}`);
    }
    if (write.mode === 'update' && exists) {
      const existing = fs.readFileSync(write.absolutePath, 'utf8');
      const allowed = existing === write.content || sha256(existing) === write.expectedOriginalSha256;
      if (!allowed) throw new Error(`observation 在規劃後已變更：${write.relativePath}`);
    }
    if (write.mode === 'update' && !exists) throw new Error(`待更新 observation 不存在：${write.relativePath}`);
  }
}

function atomicWrite(absolutePath, content) {
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const temporaryPath = `${absolutePath}.pixiu-agent-learning-${process.pid}-${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporaryPath, content, 'utf8');
  try {
    fs.renameSync(temporaryPath, absolutePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
}

function applyPlan(plan) {
  preflightWrites(plan);
  const backups = [];
  let changedFiles = 0;
  try {
    for (const write of plan.writes) {
      const existed = fs.existsSync(write.absolutePath);
      const original = existed ? fs.readFileSync(write.absolutePath, 'utf8') : null;
      if (original === write.content) continue;
      backups.push({ absolutePath: write.absolutePath, existed, original });
      atomicWrite(write.absolutePath, write.content);
      changedFiles += 1;
    }
  } catch (error) {
    for (const backup of backups.reverse()) {
      if (backup.existed) atomicWrite(backup.absolutePath, backup.original);
      else if (fs.existsSync(backup.absolutePath)) fs.rmSync(backup.absolutePath, { force: true });
    }
    throw error;
  }
  return changedFiles;
}

function executeAgentLearningRun(input) {
  const plan = planAgentLearningRun(input);
  const changedFiles = applyPlan(plan);
  return {
    verifiedObservations: plan.verifiedObservations,
    instincts: plan.instincts,
    promoteCandidates: plan.promoteCandidates,
    manifestPath: plan.manifestPath,
    changedFiles
  };
}

module.exports = {
  executeAgentLearningRun,
  parseFrontmatter,
  planAgentLearningRun,
  validateObservation
};
