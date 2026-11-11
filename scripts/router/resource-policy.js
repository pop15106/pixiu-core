'use strict';

const fs = require('node:fs');
const path = require('node:path');

function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') ||
      value.split('/').some(part => !part || part === '.' || part === '..') || /[:*?\x00]/u.test(value)) {
    throw new Error(`不合法的資源相對路徑：${value}`);
  }
  return value;
}

function validatePolicy(manifest) {
  const policy = manifest.resourcePolicy === undefined
    ? { schemaVersion: 1, localPrivate: {} } : manifest.resourcePolicy;
  if (!policy || policy.schemaVersion !== 1 || !policy.localPrivate ||
      typeof policy.localPrivate !== 'object' || Array.isArray(policy.localPrivate)) {
    throw new Error('不支援的 resourcePolicy');
  }
  for (const [name, reason] of Object.entries(policy.localPrivate)) {
    safeRelative(name);
    if (typeof reason !== 'string' || !reason.trim()) throw new Error(`私人資源缺少用途：${name}`);
  }
  return policy;
}

function regularFileWithin(root, relativePath) {
  const target = path.join(root, safeRelative(relativePath));
  try {
    const actual = fs.realpathSync(target);
    const relative = path.relative(fs.realpathSync(root), actual);
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
      throw new Error(`資源連結越出根目錄：${relativePath}`);
    }
    return fs.statSync(actual).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function inspectResources(root, manifest, { profile = 'public-core', capabilityIds } = {}) {
  if (!['public-core', 'local-readiness'].includes(profile)) throw new Error('未知的資源檢查 profile');
  const policy = validatePolicy(manifest);
  if (!Array.isArray(manifest.capabilities)) throw new Error('capabilities 必須是陣列');
  if (capabilityIds && (!Array.isArray(capabilityIds) || capabilityIds.some(id =>
    !manifest.capabilities.some(capability => capability.id === id)))) throw new Error('未知的 capabilityIds');
  const missingPublic = [];
  const privateResources = [];
  for (const capability of manifest.capabilities.filter(item => !capabilityIds || capabilityIds.includes(item.id))) {
    for (const group of ['skills', 'contexts', 'governance']) {
      const resources = capability.load?.[group] || [];
      if (!Array.isArray(resources)) throw new Error(`${capability.id}.${group} 必須是陣列`);
      for (const resource of resources) {
        safeRelative(resource);
        if (Object.hasOwn(policy.localPrivate, resource)) {
          // 公共驗證不讀取、不複製也不要求任何真實私人內容。
          const status = profile === 'public-core' ? 'NOT_INSPECTED'
            : regularFileWithin(root, resource) ? 'PRESENT_NOT_VALIDATED' : 'MISSING_PRIVATE_CONTEXT';
          privateResources.push({ capabilityId: capability.id, path: resource, status, reason: policy.localPrivate[resource] });
        } else if (!regularFileWithin(root, resource)) {
          missingPublic.push(`${capability.id}: ${resource}`);
        }
      }
    }
  }
  return { profile, missingPublic, privateResources, canRunPublicCore: missingPublic.length === 0,
    ready: missingPublic.length === 0 && !privateResources.some(item => item.status === 'MISSING_PRIVATE_CONTEXT') };
}

function assertOnDemandContent(content, label) {
  if (typeof content !== 'string' || !content.trim()) throw new Error(`${label} 內容為空或格式錯誤`);
  const normalized = content.replace(/\r\n/g, '\n');
  if (normalized.startsWith('---\n') && !/^---\n[\s\S]*?\n---(?:\n|$)/u.test(normalized)) {
    throw new Error(`${label} metadata 未閉合`);
  }
  if (/^(?:alwaysApply:\s*true|readAt:\s*(?:session-start|session-init)|trigger:\s*always_on)\s*$/mu.test(normalized)) {
    throw new Error(`${label} 仍標記 session auto-load`);
  }
}

module.exports = { safeRelative, validatePolicy, inspectResources, assertOnDemandContent };
