'use strict';

const resourceIdentity = require('./resource-identity-gate');
const mcpCompatibility = require('./mcp-compatibility-gateway');
const extensionPackage = require('./pixiu-extension-package');

function validateExtensionCandidate(candidate, context = {}) {
  const manifestResult = extensionPackage.validateExtensionManifest(candidate?.manifest, context);
  const verification = manifestResult.identity || {
    trustLevel: 'UNVERIFIED',
    reasonCodes: ['RESOURCE_IDENTITY_MISSING'],
  };
  const installDecision = resourceIdentity.decideResourceAccess(verification, 'install');
  const effectivePermissions = extensionPackage.calculateEffectivePermissions(
    candidate?.manifest?.permissions,
    context.hostPermissions,
    context.userPermissions,
    context.policyPermissions,
  );

  const errors = [...manifestResult.errors];
  if (!installDecision.allowed) errors.push(installDecision.code);

  const requestedPermissions = extensionPackage.calculateEffectivePermissions(
    candidate?.manifest?.permissions,
    candidate?.manifest?.permissions,
    candidate?.manifest?.permissions,
    candidate?.manifest?.permissions,
  );
  if (JSON.stringify(effectivePermissions) !== JSON.stringify(requestedPermissions)) {
    errors.push('PERMISSION_NOT_GRANTED');
  }

  const lock = candidate?.manifest
    ? extensionPackage.createExtensionLock(candidate.manifest, candidate.files || {})
    : null;

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)].sort(),
    identity: manifestResult.identity,
    negotiatedMcpVersion: manifestResult.negotiatedMcpVersion,
    installDecision,
    effectivePermissions,
    lock,
  };
}

module.exports = {
  ...resourceIdentity,
  ...mcpCompatibility,
  ...extensionPackage,
  validateExtensionCandidate,
};
