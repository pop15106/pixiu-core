#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

// 路由只選擇要讀取的說明；執行授權仍由使用者指令與 Task Contract 決定。
function isTokenUsageRequest(request) {
  return /\btokens?\s*(?:使用量|用量|計量|計數|預算|成本|消耗|usage\b|count\b|cost\b|budget\b)|(?:使用量|用量|消耗|預算|成本).*tokens?/i.test(request);
}

function hasCredentialContext(request) {
  return /\b(?:jwt|oauth|bearer|access\s+token|refresh\s+token)\b|憑證|金鑰|令牌|秘密|外洩|洩漏|密碼|權限|存取|安全|過期/i.test(request);
}

function isReadmeOnlyEdit(request) {
  if (!/\breadme(?:\.md)?\b/i.test(request) ||
      !/錯字|錯別字|標點|typos?|spelling|punctuation/i.test(request)) return false;
  const remainder = request.replace(
    /\breadme(?:\.md)?\b[^，,。；;\n]*?(?:錯字|錯別字|標點|typos?|spelling|punctuation)/ig,
    ''
  );
  // 同一句仍要求修改程式時，保留既有的實作與 TDD 路由。
  return !/程式|功能|登入|邏輯|後端|前端|\b(?:java|javascript|typescript|python|api|sql|bug|code|application)\b/i.test(remainder);
}

function hasWorkflowControlMention(request, keywords) {
  const normalized = normalizeText(request);
  return normalized.split(/[，,。；;\n]/).some(clause => {
    if (!keywords.some(keyword => clause.includes(normalizeText(keyword)))) return false;
    const outsideQuotes = clause.replace(/「[^」]*」|『[^』]*』|“[^”]*”|"[^"]*"|`[^`]*`/g, '');
    const deniedAction = /(?:不要|請勿|不得|禁止|暫不|不准|不需要|不是要你|不|do\s+not|don't|never)\s*(?:再|自動)?\s*(?:啟用|啟動|開啟|執行|恢復|繼續|停止|暫停|取消|用|使用|採用|開|跑|enable|start|activate|run|resume|stop|pause|cancel)/i;
    const deniedMode = /(?:不要|請勿|不得|禁止|暫不|不准)\s*(?:完整自動|自動接力|自動放行|auto\s+mode)/i;
    if (deniedAction.test(clause) || deniedMode.test(clause)) return false;

    const onlyReview = /只(?:要|做|需)?\s*(?:審核|審查|盤點|檢查|分析|說明|解釋|確認)/i;
    const askingHow = /如何|怎麼|是否|能否|能不能|可不可以|\bhow\s+to\b/i;
    if (onlyReview.test(outsideQuotes) || askingHow.test(outsideQuotes)) return false;

    const informational = /審核|審查|盤點|檢查|解釋|說明|介紹|分析|確認|規則|是什麼|\b(?:review|audit|explain|describe)\b/i.test(outsideQuotes);
    const control = /啟用|啟動|開啟|恢復|繼續|停止|暫停|取消|關閉|停用|\b(?:enable|start|activate|resume|stop|pause|cancel|disable)\b/i.test(outsideQuotes);
    // 控制包含暫停、停止與取消；取得規則不等於啟動新任務。
    const colloquialControl = /(?:^|請|幫我|直接|現在|立刻|立即|然後|接著|先|再)\s*(?:用|使用|採用|開|跑)/i.test(outsideQuotes);
    return !informational || control || colloquialControl;
  });
}

// 保留既有 Agent 派工情境篩選；此函式不授予派工權限。
function isOperationalMatch(request, keywords) {
  const clauses = request.split(/[，,。；;\n]/).filter(clause =>
    keywords.some(keyword => clause.includes(normalizeText(keyword))));
  const inspection = /審核|審查|盤點|解釋|說明|是什麼|什麼是|怎麼用|如何使用|只看(?!結果)|只讀|唯讀|\breview\b|\baudit\b/i;
  const denied = /不要|不需|不必|不可|不允許|禁止|停用|停止|暫停|不派工|不啟動|不開啟|不啟用/i;
  const activate = /啟動|開啟|啟用|恢復|繼續|開始|\benable\b|\bstart\b|\bresume\b/i;
  // 否定句的否定停用詞不當成新的啟動授權；另一個明確續跑子句仍可命中。
  const positive = clauses.filter(clause => !denied.test(clause));
  if (positive.some(clause => activate.test(clause) && !inspection.test(clause))) return true;
  if (inspection.test(request) || clauses.some(clause => denied.test(clause))) return false;
  return positive.length > 0;
}

function scoreCapability(request, capability) {
  const normalized = normalizeText(request);
  const keywords = Array.isArray(capability.keywords) ? capability.keywords : [];
  let matches = keywords.filter(keyword => normalized.includes(normalizeText(keyword)));
  const requiredContext = capability.requiresAny || [];
  if (requiredContext.length && !requiredContext.some(word => normalized.includes(normalizeText(word)))) matches = [];

  if (['full-automatic-handoff', 'runtime-control'].includes(capability.id) &&
      !hasWorkflowControlMention(normalized, keywords)) matches = [];
  if (capability.id === 'agent-routing' && !isOperationalMatch(normalized, keywords)) matches = [];

  const usageOnly = isTokenUsageRequest(normalized) && !hasCredentialContext(normalized);
  if (capability.id === 'security-review' && usageOnly) matches = matches.filter(word => normalizeText(word) !== 'token');

  const documentOnly = /readme|文件|說明書|註解/.test(normalized) && /錯字|標點|排版|措辭|拼字/.test(normalized) &&
    !/程式|功能|邏輯|\bjava\b|\bsql\b|\bapi\b|\bbug\b/.test(normalized);
  if (capability.id === 'code-implementation' && (documentOnly || isReadmeOnlyEdit(normalized))) matches = [];
  return {
    score: matches.length,
    matches
  };
}

function collectFiles(capabilities) {
  const files = [];
  const seen = new Set();

  for (const capability of capabilities) {
    const load = capability.load || {};
    for (const file of [
      ...(load.skills || []),
      ...(load.contexts || []),
      ...(load.governance || [])
    ]) {
      if (!seen.has(file)) {
        seen.add(file);
        files.push(file);
      }
    }
  }

  return files;
}

function isValidCapabilityLimit(value) {
  return Number.isInteger(value) && value >= 0;
}

function resolveCapabilities(request, manifest, options = {}) {
  const requestedMaxCapabilities = isValidCapabilityLimit(options.maxCapabilities)
    ? options.maxCapabilities
    : isValidCapabilityLimit(manifest.maxCapabilitiesPerRequest)
      ? manifest.maxCapabilitiesPerRequest
      : 3;
  const maxCapabilities = Math.min(requestedMaxCapabilities, 3);

  const candidates = (manifest.capabilities || [])
    .map(capability => {
      const scored = scoreCapability(request, capability);
      return {
        capability,
        score: scored.score,
        matches: scored.matches
      };
    })
    .filter(item => item.score > 0)
    .sort((left, right) => {
      const priorityDiff = (right.capability.priority || 0) - (left.capability.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      const scoreDiff = right.score - left.score;
      if (scoreDiff !== 0) return scoreDiff;
      return left.capability.id.localeCompare(right.capability.id);
    });

  const ranked = [];
  const suppressed = new Set();
  for (const item of candidates) {
    if (ranked.length >= maxCapabilities) break;
    if (suppressed.has(item.capability.id)) continue;

    ranked.push(item);
    for (const suppressedCapability of item.capability.suppresses || []) {
      suppressed.add(String(suppressedCapability));
    }
  }

  const selected = ranked.map(item => item.capability);

  return {
    capabilities: selected.map(capability => capability.id),
    filesToLoad: collectFiles(selected),
    reasons: ranked.map(item => ({
      capability: item.capability.id,
      matchedKeywords: item.matches
    }))
  };
}

function loadManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`找不到 Capability Manifest：${manifestPath}`);
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function safeResolveFromFile(request, manifestPath, options = {}) {
  try {
    return {
      degraded: false,
      ...resolveCapabilities(request, loadManifest(manifestPath), options)
    };
  } catch (error) {
    return {
      degraded: true,
      capabilities: [],
      filesToLoad: [],
      reasons: [],
      error: error.message
    };
  }
}

if (require.main === module) {
  const request = process.argv[2] || '';
  const manifestPath = path.resolve(
    process.argv[3] || path.join(__dirname, '..', '..', 'vault', 'capabilities', 'capability-manifest.json')
  );

  const result = safeResolveFromFile(request, manifestPath);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.degraded) process.exitCode = 2;
}

module.exports = {
  normalizeText,
  scoreCapability,
  collectFiles,
  resolveCapabilities,
  loadManifest,
  safeResolveFromFile
};
