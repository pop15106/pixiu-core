import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hostname, tmpdir } from "node:os";

// 此驗證入口只執行下列固定測試；不啟動模型、不安裝套件，也不重啟既有服務。
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidenceDirectory = join(root, "docs", "validation", `20260908-full-auto-work-${stamp}`);
await mkdir(evidenceDirectory, { recursive: true });
// 子程序共用本輪唯一暫存區，舊測試留下的檔案也只在此區內清理。
const isolatedTempRoot = await mkdtemp(join(tmpdir(), "pixiu-safe-validation-"));
const powershell = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const base = "scripts/devspace-portable/tests/";
const tests = [
  { name: "deployment-guard", executable: powershell, args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", base + "run-workflow-deployment-guard-tests.ps1"] },
  { name: "native-http-mcp", executable: process.execPath, args: ["--test", base + "workflow-native-mcp.test.mjs"] },
  { name: "workflow-store", executable: process.execPath, args: ["--test", base + "workflow-store.test.mjs"] },
  { name: "router", executable: process.execPath, args: ["--test", "scripts/router/resolve-capabilities.test.js"] },
  { name: "skill-metadata-tests", executable: process.execPath, args: ["--test", "scripts/skills/validate-skill-metadata.test.js"] },
  { name: "skill-metadata-source", executable: process.execPath, args: ["scripts/skills/validate-skill-metadata.js", "skills"] },
  { name: "skill-metadata-published", executable: process.execPath, args: ["scripts/skills/validate-skill-metadata.js", ".agents/skills"] },
  { name: "oneclick", executable: powershell, args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", base + "run-tests.ps1"] },
  { name: "portable-package", executable: powershell, args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", base + "run-portable-package-tests.ps1"] },
  { name: "reconnect-wrapper", executable: powershell, args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", base + "run-reconnect-cmd-tests.ps1"] },
  { name: "watchdog", executable: powershell, args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", base + "run-watchdog-tests.ps1"] },
];
const digest = (content) => createHash("sha256").update(content).digest("hex");
const records = [];
const startedAt = new Date().toISOString();
console.log(`EVIDENCE_DIRECTORY=${evidenceDirectory}`);

for (const specification of tests) {
  const start = Date.now();
  console.log(`START ${specification.name}`);
  const output = await new Promise((resolveResult) => {
    const child = spawn(specification.executable, specification.args, {
      cwd: root,
      env: { ...process.env, TEMP: isolatedTempRoot, TMP: isolatedTempRoot, TMPDIR: isolatedTempRoot },
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let launchError;
    child.stdout.on("data", (data) => stdout.push(data));
    child.stderr.on("data", (data) => stderr.push(data));
    child.once("error", (error) => { launchError = error.message; });
    child.once("close", (code, signal) => resolveResult({ code, signal, launchError, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) }));
  });
  const stdoutFile = `${specification.name}.stdout.log`;
  const stderrFile = `${specification.name}.stderr.log`;
  await writeFile(join(evidenceDirectory, stdoutFile), output.stdout);
  await writeFile(join(evidenceDirectory, stderrFile), output.stderr);
  const outputText = output.stdout.toString("utf8");
  const record = {
    name: specification.name,
    command: [specification.executable, ...specification.args],
    environment: "WINDOWS_NATIVE_PROCESS_ISOLATED_TESTS",
    exitCode: output.code,
    signal: output.signal,
    launchError: output.launchError ?? null,
    durationMs: Date.now() - start,
    stdoutFile,
    stdoutSha256: digest(output.stdout),
    stderrFile,
    stderrSha256: digest(output.stderr),
    summaryLines: outputText.split(/\r?\n/).filter((line) => /^(Tests:|Workflow deployment guard:|# tests |# pass |# fail |# skipped |# cancelled |已檢查 |Skill metadata )/.test(line)),
    status: output.code === 0 && !output.launchError ? "PASS" : "FAIL",
  };
  records.push(record);
  await writeFile(join(evidenceDirectory, "summary.json"), JSON.stringify({ startedAt, updatedAt: new Date().toISOString(), host: hostname(), platform: process.platform, node: process.version, sourceRoot: root, evidenceDirectory, deploymentCompleted: false, modelTestsExecuted: false, tests: records }, null, 2) + "\n");
  console.log(JSON.stringify({ name: record.name, status: record.status, exitCode: record.exitCode, summary: record.summaryLines }));
  if (record.status !== "PASS") console.log(outputText.slice(-4000) + output.stderr.toString("utf8").slice(-4000));
}

// 日誌雜湊須與落地後重新讀取的內容一致，報告才可用來追溯本輪結果。
for (const record of records) {
  for (const stream of ["stdout", "stderr"]) {
    const content = await readFile(join(evidenceDirectory, record[`${stream}File`]));
    if (digest(content) !== record[`${stream}Sha256`]) throw new Error(`EVIDENCE_READBACK_MISMATCH: ${record.name}/${stream}`);
  }
}
console.log(`EVIDENCE_READBACK_PASS ${records.length} test groups`);
let cleanupError = null;
try {
  await rm(isolatedTempRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
} catch (error) {
  cleanupError = error.message;
}
await writeFile(join(evidenceDirectory, "summary.json"), JSON.stringify({ startedAt, completedAt: new Date().toISOString(), host: hostname(), platform: process.platform, node: process.version, sourceRoot: root, evidenceDirectory, isolatedTempRoot, cleanupError, deploymentCompleted: false, modelTestsExecuted: false, tests: records }, null, 2) + "\n");
console.log(`TEMP_CLEANUP=${cleanupError ?? "PASS"}`);
console.log(`EVIDENCE_DIRECTORY=${evidenceDirectory}`);
process.exitCode = records.every((record) => record.status === "PASS") && cleanupError === null ? 0 : 1;
