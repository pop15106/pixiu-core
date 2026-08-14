#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

class RedactionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RedactionError';
    this.code = code;
  }
}

function createRedactor(options = {}) {
  const sensitiveTerms = Array.isArray(options.sensitiveTerms)
    ? options.sensitiveTerms
        .filter((term) => typeof term === 'string' && term.length > 0)
        .map((term, index) => ({ term, placeholder: `{{SENSITIVE_${index + 1}}}`, order: index }))
        .sort((left, right) => right.term.length - left.term.length || left.order - right.order)
    : [];
  const canaryFactory = typeof options.canaryFactory === 'function'
    ? options.canaryFactory
    : () => `CANARY-${crypto.randomBytes(12).toString('hex')}`;
  const canaries = new Set();

  function redactText(value) {
    let result = String(value);
    for (const { term, placeholder } of sensitiveTerms) {
      result = result.split(term).join(placeholder);
    }
    for (const canary of canaries) {
      result = result.split(canary).join('{{CANARY_REDACTED}}');
    }
    return result;
  }

  function cloneAndRedact(value, seen) {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === 'string') {
      return redactText(value);
    }
    if (['number', 'boolean'].includes(typeof value)) {
      return value;
    }
    if (typeof value !== 'object') {
      throw new RedactionError('UNSAFE_REDACTION_VALUE', '資料包含不可安全處理的型別');
    }
    if (seen.has(value)) {
      throw new RedactionError('UNSAFE_REDACTION_VALUE', '資料包含循環參照');
    }
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        return value.map((item) => cloneAndRedact(item, seen));
      }
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new RedactionError('UNSAFE_REDACTION_VALUE', '只允許一般物件與陣列');
      }
      const result = {};
      for (const key of Object.keys(value)) {
        if (FORBIDDEN_KEYS.has(key)) {
          throw new RedactionError('UNSAFE_REDACTION_KEY', `資料包含禁止鍵：${key}`);
        }
        result[key] = cloneAndRedact(value[key], seen);
      }
      return result;
    } finally {
      seen.delete(value);
    }
  }

  function redactValue(value) {
    return cloneAndRedact(value, new WeakSet());
  }

  function collectStrings(value, seen, output) {
    if (value === null || value === undefined) {
      return;
    }
    if (typeof value === 'string') {
      output.push(value);
      return;
    }
    if (['number', 'boolean'].includes(typeof value)) {
      return;
    }
    if (typeof value !== 'object') {
      throw new RedactionError('UNSAFE_REDACTION_VALUE', '資料包含不可持久化的型別');
    }
    if (seen.has(value)) {
      throw new RedactionError('UNSAFE_REDACTION_VALUE', '資料包含循環參照');
    }
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        for (const item of value) {
          collectStrings(item, seen, output);
        }
        return;
      }
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new RedactionError('UNSAFE_REDACTION_VALUE', '只允許一般物件與陣列');
      }
      for (const key of Object.keys(value)) {
        if (FORBIDDEN_KEYS.has(key)) {
          throw new RedactionError('UNSAFE_REDACTION_KEY', `資料包含禁止鍵：${key}`);
        }
        output.push(key);
        collectStrings(value[key], seen, output);
      }
    } finally {
      seen.delete(value);
    }
  }

  function assertSafeForPersistence(value) {
    const strings = [];
    collectStrings(value, new WeakSet(), strings);
    for (const text of strings) {
      for (const { term } of sensitiveTerms) {
        if (text.includes(term)) {
          throw new RedactionError(
            'PERSISTENCE_SENSITIVE_CONTENT',
            '持久化內容包含尚未遮罩的敏感資料'
          );
        }
      }
      for (const canary of canaries) {
        if (text.includes(canary)) {
          throw new RedactionError('CANARY_LEAK', '持久化內容包含 Canary Secret');
        }
      }
    }
    return true;
  }

  function createCanary() {
    const canary = String(canaryFactory());
    if (!canary) {
      throw new RedactionError('INVALID_CANARY', 'Canary 不可為空');
    }
    canaries.add(canary);
    return canary;
  }

  return Object.freeze({
    assertSafeForPersistence,
    createCanary,
    redactText,
    redactValue
  });
}

module.exports = {
  RedactionError,
  createRedactor
};
