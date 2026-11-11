#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { boundedPath, readJson, digestObject } = require('./test-plan');
const { processIdentity, ownerIdentity, sameOwner, pidStatus } = require('./process-identity');
const SCHEMA = 'pixiu.auxiliary-lock.v1';
const LOCKS = { control: '.cr/control.lock', install: 'workflow-install.lock' };
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value);
const noop = () => {};

function layout(root, kind) {
  if (!Object.hasOwn(LOCKS, kind)) throw new Error('AUX_LOCK_KIND_INVALID');
  const base = path.resolve(root);
  for (let current = base; current !== path.dirname(current); current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('AUX_LOCK_LINK_BLOCKED');
  }
  const relative = LOCKS[kind];
  return { root: fs.realpathSync(base), kind, relative, chain: `${relative}.chain` };
}
function location(config, name, missing = false) { return boundedPath(config.root, name, { mustExist: !missing }); }
function nodePath(config, id, type) {
  if (!uuid(id)) throw new Error('AUX_LOCK_OPERATION_ID_INVALID');
  return `${config.chain}/${id}.${type}.json`;
}
function readRecord(config, relative) {
  try {
    const record = readJson(config.root, relative);
    if (record?.schemaVersion !== SCHEMA || record.kind !== config.kind || !uuid(record.operationId) ||
        !sameOwner(config.root, record) || !Number.isSafeInteger(record.pid) || record.pid < 1 ||
        typeof record.birth !== 'string' || !record.birth || !['ACQUIRE', 'RECOVER'].includes(record.transition) ||
        (record.previousId !== null && !uuid(record.previousId))) throw new Error('AUX_LOCK_IDENTITY_INVALID');
    return record;
  } catch (error) {
    if (error.code === 'ENOENT') throw error;
    throw new Error(`AUX_LOCK_INVALID_OR_LEGACY:${error.message}`);
  }
}

function tail(config) {
  const firstPath = location(config, config.relative, true);
  if (!fs.existsSync(firstPath)) return null;
  let relative = config.relative, prior = null;
  const seen = new Set();
  for (let depth = 1; depth <= 100000; depth++) {
    const record = readRecord(config, relative);
    if (seen.has(record.operationId) || record.previousId !== (prior?.operationId || null) ||
        record.previousDigest !== (prior ? digestObject(prior) : null)) throw new Error('AUX_LOCK_CHAIN_INVALID');
    seen.add(record.operationId);
    const canonical = readRecord(config, nodePath(config, record.operationId, 'owner'));
    if (digestObject(canonical) !== digestObject(record)) throw new Error('AUX_LOCK_OWNER_CHANGED');
    const nextPath = nodePath(config, record.operationId, 'next');
    if (fs.existsSync(location(config, nextPath, true))) { prior = record; relative = nextPath; continue; }
    const donePath = nodePath(config, record.operationId, 'done');
    let released = false;
    if (fs.existsSync(location(config, donePath, true))) {
      const done = readJson(config.root, donePath);
      if (done.operationId !== record.operationId || done.ownerDigest !== digestObject(record) || done.status !== 'RELEASED') {
        throw new Error('AUX_LOCK_RELEASE_INVALID');
      }
      released = true;
    }
    return { record, released, depth };
  }
  throw new Error('AUX_LOCK_HISTORY_LIMIT');
}

function publish(config, destination, value, onStep, label) {
  fs.mkdirSync(location(config, config.chain, true), { recursive: true });
  const prepared = `${config.chain}/${randomUUID()}.prepared.json`;
  const bytes = Buffer.from(JSON.stringify(value) + '\n');
  const fd = fs.openSync(location(config, prepared, true), 'wx', 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  onStep(`${label}-prepared`, value);
  // 同卷硬連結只在目的名稱不存在時發布完整紀錄；競爭者不覆寫、不刪除任何世代。
  fs.linkSync(location(config, prepared), location(config, destination, true));
  onStep(`${label}-published`, value);
}

function createLease(config, prior, transition, onStep = noop) {
  const identity = { schemaVersion: SCHEMA, kind: config.kind, operationId: randomUUID(),
    previousId: prior?.operationId || null, previousDigest: prior ? digestObject(prior) : null,
    transition, ...ownerIdentity(config.root), ...processIdentity(), createdAt: new Date().toISOString() };
  publish(config, nodePath(config, identity.operationId, 'owner'), identity, onStep, 'owner');
  const claim = prior ? nodePath(config, prior.operationId, 'next') : config.relative;
  // owner 與 claim 使用同一份已持久化內容。每個世代只能有一個 next。
  fs.linkSync(location(config, nodePath(config, identity.operationId, 'owner')), location(config, claim, true));
  onStep('claim-published', identity);
  const assertOwned = () => {
    const current = tail(config);
    if (!current || current.released || current.record.operationId !== identity.operationId ||
        digestObject(current.record) !== digestObject(identity)) throw new Error('AUX_LOCK_OWNERSHIP_CHANGED');
  };
  return {
    identity,
    assertOwned,
    release() {
      const current = tail(config);
      if (current?.record.operationId === identity.operationId && current.released) return;
      assertOwned();
      publish(config, nodePath(config, identity.operationId, 'done'), {
        operationId: identity.operationId, ownerDigest: digestObject(identity), status: 'RELEASED',
        releasedAt: new Date().toISOString()
      }, onStep, 'release');
    }
  };
}

function acquireAuxiliaryLock(root, kind, { onStep = noop } = {}) {
  const config = layout(root, kind);
  const current = tail(config);
  if (current && !current.released) throw new Error('AUX_LOCK_BUSY_RECOVERY_REQUIRED');
  return createLease(config, current?.record, 'ACQUIRE', onStep);
}
function inspectAuxiliaryLock(root, kind) {
  const config = layout(root, kind);
  const current = tail(config);
  if (!current) return { kind, status: 'ABSENT', chainLength: 0 };
  const status = current.released ? 'IDLE' : pidStatus(current.record.pid) === 'DEAD' ? 'RECOVERY_REQUIRED' : 'HELD_OR_UNKNOWN';
  return { kind, status, chainLength: current.depth, operationId: current.record.operationId,
    ownerDigest: digestObject(current.record), identity: current.record };
}
function recoverAuxiliaryLock(root, kind, { authorized = false, operationId, ownerDigest, onStep = noop } = {}) {
  if (authorized !== true || !uuid(operationId) || typeof ownerDigest !== 'string') throw new Error('AUX_LOCK_EXPLICIT_AUTHORIZATION_REQUIRED');
  const config = layout(root, kind);
  const current = tail(config);
  if (!current || current.released || current.record.operationId !== operationId || digestObject(current.record) !== ownerDigest) {
    throw new Error('AUX_LOCK_RECOVERY_TARGET_CHANGED');
  }
  // 即使 PID 已重用也不碰活程序；不按鎖齡恢復，也不派生另一個可殘留的恢復鎖。
  if (pidStatus(current.record.pid) !== 'DEAD') throw new Error('AUX_LOCK_OWNER_ALIVE_OR_UNKNOWN');
  const lease = createLease(config, current.record, 'RECOVER', onStep);
  lease.release();
  return { kind, recoveredOperationId: operationId, recoveryOperationId: lease.identity.operationId,
    status: 'IDLE', processesKilled: 0, stateChanged: false };
}
function withAuxiliaryLock(root, kind, operation) {
  if (typeof operation !== 'function' || operation.constructor?.name === 'AsyncFunction') throw new Error('AUX_LOCK_SYNCHRONOUS_OPERATION_REQUIRED');
  const lease = acquireAuxiliaryLock(root, kind);
  let primary, releaseAllowed = true;
  try {
    const result = operation(lease);
    if (result && typeof result.then === 'function') {
      // 非 async 宣告仍可回傳 Promise；保持鎖住，不能在未完成寫入時提早釋放。
      releaseAllowed = false;
      throw new Error('AUX_LOCK_ASYNC_RESULT_REQUIRES_REVIEW');
    }
    return result;
  }
  catch (error) { primary = error; throw error; }
  finally {
    if (releaseAllowed) {
      try { lease.release(); }
      catch (error) { if (!primary) throw error; if (typeof primary === 'object') primary.releaseError = error.message; }
    }
  }
}

if (require.main === module) {
  try {
    const [action, kind, a, b, authorization, targetRoot] = process.argv.slice(2);
    if (action === 'inspect') console.log(JSON.stringify(inspectAuxiliaryLock(path.resolve(a || '.'), kind)));
    else if (action === 'recover' && authorization === '--authorized') {
      console.log(JSON.stringify(recoverAuxiliaryLock(path.resolve(targetRoot || '.'), kind, { authorized: true, operationId: a, ownerDigest: b })));
    } else throw new Error('用法：auxiliary-lock.js inspect control|install [root]；recover control|install <operationId> <ownerDigest> --authorized [root]');
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
module.exports = { acquireAuxiliaryLock, inspectAuxiliaryLock, recoverAuxiliaryLock, withAuxiliaryLock };
