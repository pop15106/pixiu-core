'use strict';

const crypto = require('node:crypto');
const {
  normalizeResourceIdentity,
  verifyResourceIdentity,
} = require('./resource-identity-gate');
const { negotiateMcpVersion } = require('./mcp-compatibility-gateway');

const PERMISSION_GROUPS = Object.freeze(['filesystem', 'network', 'process', 'secrets']);

function uniqueSorted(values) {
  return [...new Set(Array.isArray(values) ? values : [])].sort();
}

function calculateEffectivePermissions(requested = {}, host = {}, user = {}, policy = {}) {
  const result = {};
  for (const group of PERMISSION_GROUPS) {
    const requestedSet = new Set(uniqueSorted(requested[group]));
    const hostSet = new Set(uniqueSorted(host[group]));
    const userSet = new Set(uniqueSorted(user[group]));
    const policySet = new Set(uniqueSorted(policy[group]));

    result[group] = [...requestedSet]
      .filter((value) => hostSet.has(value) && userSet.has(value) && policySet.has(value))
      .sort();
  }
  return result;
}

function validateExtensionManifest(manifest, context = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['MANIFEST_REQUIRED'] };
  }

  if (manifest.schemaVersion !== 'pixiu.extension/v1') errors.push('SCHEMA_VERSION_UNSUPPORTED');
  if (typeof manifest.id !== 'string' || !manifest.id.trim()) errors.push('EXTENSION_ID_REQUIRED');
  if (typeof manifest.name !== 'string' || !manifest.name.trim()) errors.push('EXTENSION_NAME_REQUIRED');
  if (typeof manifest.version !== 'string' || !manifest.version.trim()) errors.push('EXTENSION_VERSION_REQUIRED');
  if (!manifest.publisher?.id) errors.push('PUBLISHER_REQUIRED');
  if (!manifest.source) errors.push('SOURCE_REQUIRED');
  if (!Array.isArray(manifest.compatibility?.mcp) || manifest.compatibility.mcp.length === 0) {
    errors.push('MCP_COMPATIBILITY_REQUIRED');
  }
  if (!Array.isArray(manifest.compatibility?.hosts) || !manifest.compatibility.hosts.includes(context.host)) {
    errors.push('HOST_NOT_SUPPORTED');
  }

  let identity = null;
  if (manifest.source) {
    try {
      const normalized = normalizeResourceIdentity(manifest.source);
      identity = verifyResourceIdentity(normalized, context.identityEvidence || {});
      if (identity.trustLevel === 'BLOCKED') errors.push('RESOURCE_BLOCKED');
    } catch (error) {
      errors.push(error.code || 'RESOURCE_IDENTITY_INVALID');
    }
  }

  let negotiatedMcpVersion = null;
  if (Array.isArray(manifest.compatibility?.mcp)) {
    try {
      negotiatedMcpVersion = negotiateMcpVersion(
        context.clientMcpVersions || [],
        manifest.compatibility.mcp,
        { allowReleaseCandidate: context.allowReleaseCandidate === true },
      ).version;
    } catch (error) {
      errors.push(error.code || 'MCP_COMPATIBILITY_FAILED');
    }
  }

  return {
    valid: errors.length === 0,
    errors: uniqueSorted(errors),
    identity,
    negotiatedMcpVersion,
  };
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function createExtensionLock(manifest, files = {}) {
  const normalizedFiles = Object.keys(files)
    .sort()
    .map((path) => ({
      path,
      digest: crypto.createHash('sha256').update(String(files[path])).digest('hex'),
    }));

  const payload = stableSerialize({
    manifest,
    files: normalizedFiles,
  });

  return {
    schemaVersion: 'pixiu.extension.lock/v1',
    extensionId: manifest.id,
    version: manifest.version,
    files: normalizedFiles,
    digest: {
      algorithm: 'sha256',
      value: crypto.createHash('sha256').update(payload).digest('hex'),
    },
  };
}

module.exports = {
  validateExtensionManifest,
  calculateEffectivePermissions,
  createExtensionLock,
};
