'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
let ownBirth;

function processBirth(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('RECOVERY_INVALID_PID');
  if (process.platform === 'linux') {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return `${fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()}:${fields[19]}`;
  }
  if (process.platform === 'win32') {
    const shell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const output = execFileSync(shell, ['-NoProfile', '-NonInteractive', '-Command',
      `$ErrorActionPreference='Stop'; [string](Get-Process -Id ${pid}).StartTime.ToUniversalTime().Ticks`],
    { encoding: 'utf8', windowsHide: true, timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    if (!/^\d+$/u.test(output)) throw new Error('RECOVERY_PROCESS_BIRTH_UNAVAILABLE');
    return output;
  }
  throw new Error('RECOVERY_PLATFORM_UNSUPPORTED');
}
function pidStatus(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return 'UNKNOWN';
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux') {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      if (['Z', 'X'].includes(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0])) return 'DEAD';
    }
    return 'ALIVE';
  } catch (error) { return ['ESRCH', 'ENOENT'].includes(error.code) ? 'DEAD' : 'UNKNOWN'; }
}
function processIdentity(pid = process.pid) {
  // 只快取目前程序自己的建立時間；其他 PID 每次重新查詢，避免重用誤判。
  if (pid === process.pid) { ownBirth ??= processBirth(pid); return { pid, birth: ownBirth }; }
  return { pid, birth: processBirth(pid) };
}
function ownerIdentity(root) {
  return { workspaceRoot: fs.realpathSync(root), hostname: os.hostname(), owner: os.userInfo().username };
}
function sameOwner(root, record) {
  return Object.entries(ownerIdentity(root)).every(([key, value]) => record?.[key] === value);
}
module.exports = { processIdentity, ownerIdentity, sameOwner, pidStatus };
