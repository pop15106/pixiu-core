'use strict';

const crypto = require('node:crypto');

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, code) {
  if (!isPlainObject(value)) {
    const error = new TypeError(code);
    error.code = code;
    throw error;
  }
}

function assertExactKeys(value, allowedKeys, code) {
  assertPlainObject(value, code);
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key) || !allowed.has(key)) {
      const error = new TypeError(code);
      error.code = code;
      error.field = key;
      throw error;
    }
  }
}

function requireString(value, field, options = {}) {
  const maxLength = options.maxLength || 256;
  if (typeof value !== 'string') {
    const error = new TypeError(`${field}_INVALID`);
    error.code = `${field}_INVALID`;
    throw error;
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    const error = new TypeError(`${field}_INVALID`);
    error.code = `${field}_INVALID`;
    throw error;
  }
  return normalized;
}

function requirePositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    const error = new TypeError(`${field}_INVALID`);
    error.code = `${field}_INVALID`;
    throw error;
  }
  return value;
}

function normalizeInstant(value, field) {
  const source = requireString(value, field, { maxLength: 64 });
  const match = source.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/u,
  );
  const fail = () => {
    const error = new TypeError(`${field}_INVALID`);
    error.code = `${field}_INVALID`;
    throw error;
  };
  if (!match) fail();

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) fail();
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > maxDay) fail();
  if (match[8] !== 'Z') {
    const offsetHour = Number(match[8].slice(1, 3));
    const offsetMinute = Number(match[8].slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) fail();
  }

  const millis = Date.parse(source);
  if (!Number.isFinite(millis)) fail();
  return new Date(millis).toISOString();
}

function normalizeStringSet(value, field, options = {}) {
  if (!Array.isArray(value) || value.length === 0 || value.length > (options.maxItems || 64)) {
    const error = new TypeError(`${field}_INVALID`);
    error.code = `${field}_INVALID`;
    throw error;
  }
  const pattern = options.pattern || /^[a-z0-9][a-z0-9._:-]{0,127}$/u;
  const normalized = value.map((item) => requireString(item, field, { maxLength: 128 }).toLowerCase());
  if (normalized.some((item) => !pattern.test(item))) {
    const error = new TypeError(`${field}_INVALID`);
    error.code = `${field}_INVALID`;
    throw error;
  }
  if (new Set(normalized).size !== normalized.length) {
    const error = new TypeError(`${field}_DUPLICATE`);
    error.code = `${field}_DUPLICATE`;
    throw error;
  }
  return normalized.sort();
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    const output = {};
    for (const key of Object.keys(value).sort()) output[key] = canonicalize(value[key]);
    return output;
  }
  return value;
}

function canonicalStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalStringify(value), 'utf8').digest('hex')}`;
}

function withoutKeys(value, keys) {
  const omitted = new Set(keys);
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if (!omitted.has(key)) output[key] = child;
  }
  return output;
}

function sameCanonicalValue(left, right) {
  return canonicalStringify(left) === canonicalStringify(right);
}

module.exports = {
  assertExactKeys,
  assertPlainObject,
  canonicalStringify,
  deepFreeze,
  isPlainObject,
  normalizeInstant,
  normalizeStringSet,
  requirePositiveInteger,
  requireString,
  sameCanonicalValue,
  sha256Digest,
  withoutKeys,
};
