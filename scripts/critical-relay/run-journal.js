'use strict';

const fs = require('node:fs');
const { boundedPath, atomicJson, redact } = require('./test-plan');

// 逐行持久化完整事件；沒有完整終態的日誌永遠不算成功。
function createRunJournal(root, runPath, commandId) {
  const prefix = `${runPath}/${commandId}`;
  const stdoutPath = `${prefix}.stdout.jsonl`;
  const stderrPath = `${prefix}.stderr.log`;
  const stdoutFd = fs.openSync(boundedPath(root, stdoutPath, { mustExist: false }), 'wx', 0o600);
  let stderrFd;
  try { stderrFd = fs.openSync(boundedPath(root, stderrPath, { mustExist: false }), 'wx', 0o600); }
  catch (error) { fs.closeSync(stdoutFd); throw error; }
  const buffers = { stdout: '', stderr: '' };
  const checkpoint = { schemaVersion: 'pixiu.run-journal.v1', commandId, eventCount: 0,
    stdoutBytes: 0, stderrBytes: 0, complete: false, partialStdout: false };
  let closed = false;
  function appendLine(line, stream) {
    const text = stream === 'stdout' ? line : redact(line);
    const bytes = Buffer.from(text, 'utf8');
    const fd = stream === 'stdout' ? stdoutFd : stderrFd;
    let offset = 0;
    while (offset < bytes.length) offset += fs.writeSync(fd, bytes, offset, bytes.length - offset);
    fs.fsyncSync(fd);
    checkpoint[`${stream}Bytes`] += bytes.length;
    if (stream === 'stdout') checkpoint.eventCount++;
    atomicJson(root, `${prefix}.progress.json`, checkpoint);
  }
  return {
    stdoutPath, stderrPath,
    append(value, stream) {
      if (closed || !Object.hasOwn(buffers, stream)) throw new Error('JOURNAL_CLOSED_OR_BAD_STREAM');
      buffers[stream] += value;
      let newline;
      let outputLimit = false;
      while ((newline = buffers[stream].indexOf('\n')) >= 0) {
        const line = buffers[stream].slice(0, newline + 1);
        buffers[stream] = buffers[stream].slice(newline + 1);
        appendLine(line, stream);
        if (stream === 'stdout') {
          try { const event = JSON.parse(line); if (event.schemaVersion === 'pixiu.node-events.v1' && event.record === 'limit') outputLimit = true; }
          catch { /* 無效完整行保留於日誌，由正式解析器拒絕。 */ }
        }
      }
      return { outputLimit };
    },
    close() {
      if (closed) return;
      try {
        if (buffers.stderr) appendLine(buffers.stderr, 'stderr');
        if (buffers.stdout) {
          checkpoint.partialStdout = true;
          // 截斷資料只保存長度與 digest，不在公開事件檔中拼造完整事件。
          const { hash } = require('./test-plan');
          checkpoint.partialStdoutBytes = Buffer.byteLength(buffers.stdout);
          checkpoint.partialStdoutDigest = hash(buffers.stdout);
        }
        checkpoint.complete = true;
        atomicJson(root, `${prefix}.progress.json`, checkpoint);
      } finally { closed = true; fs.closeSync(stdoutFd); fs.closeSync(stderrFd); }
    }
  };
}
module.exports = { createRunJournal };
