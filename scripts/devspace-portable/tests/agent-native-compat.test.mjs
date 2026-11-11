import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createDevSpaceAgentAdapter } from "../DevSpace.WorkflowStore.mjs";

const execute = promisify(execFile);
const packageRoot = process.env.DEVSPACE_TEST_PACKAGE_ROOT ?? join(dirname(realpathSync(process.execPath)), "node_modules", "@waishnav", "devspace");
const cliPath = join(packageRoot, "dist", "cli.js");
const adminPath = fileURLToPath(new URL("../DevSpace.AgentAdmin.mjs", import.meta.url));

async function fixture(t) {
  const version = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")).version;
  assert.equal(version, "1.0.8", "本組固定驗證目前已安裝的 1.0.8，不下載相依");
  const root = await mkdtemp(join(tmpdir(), "pixiu-native-store-"));
  const { createLocalAgentStore } = await import(pathToFileURL(join(packageRoot, "dist", "local-agent-store.js")).href);
  const stateDir = join(root, "state");
  const store = createLocalAgentStore(stateDir);
  t.after(async () => { store.close(); await rm(root, { recursive:true, force:true }); });
  // 只建立隔離狀態紀錄，不建立 daemon、worker、模型或業務資料。
  const record = store.create({ workspaceId:"isolated-compat", workspaceRoot:root, profileName:"test-no-model", provider:"codex" });
  const env = { ...process.env, DEVSPACE_STATE_DIR:stateDir, DEVSPACE_ALLOWED_ROOTS:root, DEVSPACE_OAUTH_OWNER_TOKEN:"test-only-not-a-real-owner-token-20260908" };
  return { root, stateDir, store, record, env };
}

test("Workflow adapter 可讀 1.0.8 的隔離狀態，並遵守注入的環境", async (t) => {
  const f = await fixture(t);
  const adapter = createDevSpaceAgentAdapter({ devSpaceCli:cliPath, env:f.env });
  const result = await adapter.get(f.record.id);
  assert.equal(result.agentId, f.record.id);
  assert.equal(result.status, "starting");
  assert.equal(f.store.get(f.record.id).status, "starting");
});

test("AgentAdmin list 與 show 使用 1.0.8 的 stateDir 介面", async (t) => {
  const f = await fixture(t);
  const settings = { env:f.env, cwd:f.root, windowsHide:true, timeout:10000 };
  const list = JSON.parse((await execute(process.execPath, [adminPath, cliPath, "list"], settings)).stdout);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, f.record.id);
  const show = JSON.parse((await execute(process.execPath, [adminPath, cliPath, "show", f.record.id], settings)).stdout);
  assert.equal(show.id, f.record.id);
  assert.equal(show.status, "starting");
});

test("1.0.8 沒有原生單一停止證據時，不得只改 stopped 假稱停止", async (t) => {
  const f = await fixture(t);
  await assert.rejects(execute(process.execPath, [adminPath, cliPath, "mark-stopped", f.record.id], { env:f.env, cwd:f.root, windowsHide:true, timeout:10000 }), /NATIVE_STOP_UNSUPPORTED/);
  assert.equal(f.store.get(f.record.id).status, "starting");
});
