'use strict';

const { redact } = require('./test-plan');
const path = require('node:path');
const SCHEMA = 'pixiu.node-events.v1';
const emptyCounts = () => ({ total: 0, passed: 0, failed: 0, skipped: 0, todo: 0, cancelled: 0 });
const encode = value => JSON.stringify(value, (key, item) => typeof item === 'string' ? redact(item) : item) + '\n';

// 使用 Node 官方事件，stdout 文字只記成 log，不能注入假測試結果。
module.exports = async function* reporter(events) {
  const stack = [];
  const counts = emptyCounts();
  let nativeSummary = null;
  let ordinal = 0;
  for await (const { type, data } of events) {
    if (type === 'test:start') {
      const level = data.nesting || 0;
      if (level > 0 && stack[level - 1]) stack[level - 1].hasChildren = true;
      stack[level] = { hasChildren: false };
    } else if (type === 'test:pass' || type === 'test:fail') {
      const level = data.nesting || 0;
      // Node 22 會把沒有案例的檔案回報為 line=1、column=1 的檔案測試。
      // 這類檔案層結果不算真正案例；有歧義時採保守拒絕，不補算通過數。
      const fileWrapper = level === 0 && data.line === 1 && data.column === 1 &&
        typeof data.file === 'string' && typeof data.name === 'string' && path.resolve(data.name) === path.resolve(data.file);
      const container = stack[level]?.hasChildren || data.details?.type === 'suite' || typeof data.line !== 'number' || fileWrapper;
      const failureType = data.details?.error?.failureType || '';
      const status = data.skip !== undefined && data.skip !== false ? 'skipped'
        : data.todo !== undefined && data.todo !== false ? 'todo'
          : /cancelled/iu.test(failureType) ? 'cancelled' : type === 'test:pass' ? 'passed' : 'failed';
      if (!container) { counts.total++; counts[status]++; }
      yield encode({ schemaVersion: SCHEMA, record: container ? 'container' : 'case', ordinal: ++ordinal,
        name: data.name, file: data.file, line: data.line, status,
        error: data.details?.error ? { code: data.details.error.code, failureType,
          message: data.details.error.message } : null });
      stack.length = level;
    } else if (type === 'test:summary') {
      nativeSummary = { success: data.success, counts: data.counts };
    } else if (type === 'test:stdout' || type === 'test:stderr') {
      yield encode({ schemaVersion: SCHEMA, record: 'log', stream: type, message: data.message });
    }
  }
  yield encode({ schemaVersion: SCHEMA, record: 'end', counts, nativeSummary });
};
