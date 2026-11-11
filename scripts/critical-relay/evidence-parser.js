'use strict';

const { digestObject, isObject } = require('./test-plan');
const KEYS = ['total', 'passed', 'failed', 'skipped', 'todo', 'cancelled'];
function validCounts(value) {
  return isObject(value) && KEYS.every(key => Number.isSafeInteger(value[key]) && value[key] >= 0) &&
    value.total === KEYS.slice(1).reduce((sum, key) => sum + value[key], 0);
}

function parseTestOutput(output) {
  const records = output.trim().split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line));
  if (!records.length || records.some(item => item.schemaVersion !== 'pixiu.node-events.v1' ||
    !['case', 'container', 'log', 'end'].includes(item.record))) throw new Error('reporter 格式錯誤');
  const endings = records.filter(item => item.record === 'end');
  if (endings.length !== 1 || records.at(-1) !== endings[0]) throw new Error('reporter 沒有唯一完整終態');
  const end = endings[0];
  if (!validCounts(end.counts) || !isObject(end.nativeSummary) ||
      typeof end.nativeSummary.success !== 'boolean') throw new Error('reporter 統計不合法');
  const counts = Object.fromEntries(KEYS.map(key => [key, 0]));
  const cases = records.filter(item => item.record === 'case');
  const seen = new Set();
  for (const item of records.filter(item => ['case', 'container'].includes(item.record))) {
    if (!Number.isSafeInteger(item.ordinal) || item.ordinal < 1 || seen.has(item.ordinal) ||
        typeof item.name !== 'string' || !KEYS.slice(1).includes(item.status)) throw new Error('案例資料不合法');
    seen.add(item.ordinal);
    if (item.record === 'case') { counts.total++; counts[item.status]++; }
  }
  if (digestObject(counts) !== digestObject(end.counts)) throw new Error('reporter 統計與案例明細不一致');
  const nativeCounts = end.nativeSummary.counts;
  const nativeClean = isObject(nativeCounts) && ['failed', 'cancelled', 'skipped', 'todo'].every(key => nativeCounts[key] === 0);
  const containerFailure = records.some(item => item.record === 'container' && item.status !== 'passed');
  return { counts, cases, clean: counts.total > 0 && counts.passed === counts.total &&
    end.nativeSummary.success === true && nativeClean && !containerFailure };
}
module.exports = { parseTestOutput, validCounts };
