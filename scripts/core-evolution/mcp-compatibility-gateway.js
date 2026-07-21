'use strict';

const SUPPORTED_VERSIONS = Object.freeze(['2025-11-25', '2026-07-28-rc']);

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isReleaseCandidate(version) {
  return version.endsWith('-rc');
}

function negotiateMcpVersion(clientVersions, serverVersions, options = {}) {
  const client = new Set(Array.isArray(clientVersions) ? clientVersions : []);
  const server = new Set(Array.isArray(serverVersions) ? serverVersions : []);
  const allowReleaseCandidate = options.allowReleaseCandidate === true;

  const compatible = SUPPORTED_VERSIONS
    .filter((version) => client.has(version) && server.has(version))
    .filter((version) => allowReleaseCandidate || !isReleaseCandidate(version));

  const version = compatible.at(-1);
  if (!version) {
    throw createError('MCP_NO_COMPATIBLE_VERSION', '找不到可協商的 MCP 版本');
  }

  return Object.freeze({
    version,
    releaseCandidate: isReleaseCandidate(version),
  });
}

function validateCanonicalTool(tool) {
  const errors = [];
  if (!tool || typeof tool !== 'object') {
    return { valid: false, errors: ['TOOL_REQUIRED'] };
  }
  if (typeof tool.id !== 'string' || tool.id.trim() === '') {
    errors.push('TOOL_ID_REQUIRED');
  }
  if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
    errors.push('TOOL_INPUT_SCHEMA_REQUIRED');
  }
  if (tool.inputSchema && tool.inputSchema.type !== 'object') {
    errors.push('TOOL_INPUT_SCHEMA_OBJECT_REQUIRED');
  }
  return { valid: errors.length === 0, errors };
}

function assertSupportedVersion(version) {
  if (!SUPPORTED_VERSIONS.includes(version)) {
    throw createError('MCP_VERSION_UNSUPPORTED', `不支援的 MCP 版本：${version}`);
  }
}

function toCanonicalTool(version, tool) {
  assertSupportedVersion(version);
  if (!tool || typeof tool !== 'object') {
    throw createError('MCP_TOOL_INVALID', 'MCP Tool 必須是物件');
  }

  const canonical = {
    id: tool.name,
    description: tool.description || '',
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema || null,
    capabilities: {
      readOnly: tool.annotations?.readOnlyHint === true,
      destructive: tool.annotations?.destructiveHint === true,
      openWorld: tool.annotations?.openWorldHint === true,
    },
    metadata: tool._meta ? { ...tool._meta } : {},
  };

  const validation = validateCanonicalTool(canonical);
  if (!validation.valid) {
    throw createError('MCP_TOOL_INVALID', validation.errors.join(','));
  }
  return Object.freeze(canonical);
}

function fromCanonicalTool(version, canonical) {
  assertSupportedVersion(version);
  const validation = validateCanonicalTool(canonical);
  if (!validation.valid) {
    throw createError('MCP_TOOL_INVALID', validation.errors.join(','));
  }

  const annotations = {};
  if (canonical.capabilities?.readOnly) annotations.readOnlyHint = true;
  if (canonical.capabilities?.destructive) annotations.destructiveHint = true;
  if (canonical.capabilities?.openWorld) annotations.openWorldHint = true;

  const result = {
    name: canonical.id,
    description: canonical.description || '',
    inputSchema: canonical.inputSchema,
  };
  if (canonical.outputSchema) result.outputSchema = canonical.outputSchema;
  if (Object.keys(annotations).length > 0) result.annotations = annotations;
  if (canonical.metadata && Object.keys(canonical.metadata).length > 0) {
    result._meta = { ...canonical.metadata };
  }
  return result;
}

module.exports = {
  SUPPORTED_VERSIONS,
  negotiateMcpVersion,
  validateCanonicalTool,
  toCanonicalTool,
  fromCanonicalTool,
};
