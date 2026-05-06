'use strict';

/**
 * ECC Hook Flag Utilities
 * Controls which hooks are active based on ECC_HOOK_PROFILE and ECC_DISABLED_HOOKS.
 *
 * Environment Variables:
 *   ECC_HOOK_PROFILE   - 'minimal' | 'standard' | 'strict'  (default: 'standard')
 *   ECC_DISABLED_HOOKS - comma-separated list of hook IDs to disable
 */

const VALID_PROFILES = ['minimal', 'standard', 'strict'];

/**
 * Returns the current normalized ECC_HOOK_PROFILE.
 * Falls back to 'standard' if unset or invalid.
 *
 * @returns {'minimal'|'standard'|'strict'}
 */
function getCurrentProfile() {
  const raw = String(process.env.ECC_HOOK_PROFILE || 'standard').toLowerCase().trim();
  return VALID_PROFILES.includes(raw) ? raw : 'standard';
}

/**
 * Returns the Set of explicitly disabled hook IDs from ECC_DISABLED_HOOKS.
 *
 * @returns {Set<string>}
 */
function getDisabledHooks() {
  return new Set(
    String(process.env.ECC_DISABLED_HOOKS || '')
      .split(',')
      .map(v => v.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Determines whether a hook should run.
 *
 * @param {string} hookId - The hook identifier (e.g. 'post:edit:format').
 * @param {object} [options]
 * @param {string} [options.profiles] - Comma-separated list of profiles that activate
 *   this hook. Defaults to 'standard,strict'.
 * @returns {boolean}
 */
function isHookEnabled(hookId, options) {
  const opts = options || {};

  // 1. Explicit per-hook disable list
  const disabledHooks = getDisabledHooks();
  if (disabledHooks.has(String(hookId || '').toLowerCase())) {
    return false;
  }

  // 2. Profile check
  const profilesCsv = opts.profiles || 'standard,strict';
  const allowedProfiles = profilesCsv
    .split(',')
    .map(p => p.trim().toLowerCase())
    .filter(Boolean);

  const currentProfile = getCurrentProfile();
  return allowedProfiles.includes(currentProfile);
}

module.exports = { isHookEnabled, getCurrentProfile, getDisabledHooks };
