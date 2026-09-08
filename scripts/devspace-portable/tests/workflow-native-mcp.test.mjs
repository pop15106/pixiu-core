import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, access } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL, fileURLToPath } from "node:url";
import { registerDevSpaceWorkflowTools } from "../DevSpace.WorkflowStore.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const packageRoot = process.env.DEVSPACE_TEST_PACKAGE_ROOT ?? join(dirname(realpathSync(process.execPath)), "node_modules", "@waishnav", "devspace");
const installedRequire = createRequire(join(packageRoot, "package.json"));
const loadInstalled = (name) => import(pathToFileURL(installedRequire.resolve(name)).href);

async function treeFingerprint(root) {
  const records = [];
  async function walk(path, prefix = "") {
    for (const item of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = `${prefix}${item.name}`;
      if (item.isDirectory()) await walk(join(path, item.name), `${name}/`);
      else records.push([name, digest(await readFile(join(path, item.name)))]);
    }
  }
  await walk(root);
  return digest(JSON.stringify(records));
}

function parsedResult(result) {
  assert.notEqual(result.isError, true, result.content?.[0]?.text ?? "MCP 工具回傳失敗");
  return JSON.parse(result.structuredContent?.result ?? result.content[0].text);
}

async function mustReject(client, name, args, expectedMessage) {
  let message;
  try {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, true, "輸入應被原生結構或工具控制器拒絕");
    message = result.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
  } catch (error) {
    if (error?.code === "ERR_ASSERTION") throw error;
    assert.ok(error instanceof Error);
    message = error.message;
  }
  // 必須核對拒絕原因，連線中斷等無關錯誤不得讓負向測試通過。
  assert.match(message, expectedMessage);
}

test("既有 WorkflowStore 的真實 Zod 與隔離 HTTP MCP 回歸", { timeout: 45000 }, async (t) => {
  // 相依只取目前已安裝的 DevSpace 套件，不下載或安裝任何套件。
  const [{ McpServer }, { StreamableHTTPServerTransport }, { Client }, { StreamableHTTPClientTransport }, { registerAppTool }, { z }] = await Promise.all([
    loadInstalled("@modelcontextprotocol/sdk/server/mcp.js"),
    loadInstalled("@modelcontextprotocol/sdk/server/streamableHttp.js"),
    loadInstalled("@modelcontextprotocol/sdk/client/index.js"),
    loadInstalled("@modelcontextprotocol/sdk/client/streamableHttp.js"),
    loadInstalled("@modelcontextprotocol/ext-apps/server"),
    loadInstalled("zod"),
  ]);
  const root = await mkdtemp(join(tmpdir(), "pixiu-workflow-native-mcp-"));
  const stateDirectory = join(root, "ledger");
  const workspaceA = join(root, "project-a");
  const workspaceB = join(root, "project-b");
  const forbiddenMarker = join(root, "unexpected-model-start");
  const forbiddenCli = join(root, "model-forbidden.mjs");
  const originalState = process.env.DEVSPACE_WORKFLOW_STATE_DIR;
  const originalCli = process.env.DEVSPACE_WORKFLOW_CLI;
  let httpServer;
  let client;
  let mcpServer;
  t.after(async () => {
    await client?.close().catch(() => {});
    await mcpServer?.close().catch(() => {});
    if (httpServer) {
      httpServer.closeAllConnections();
      await new Promise((resolve) => httpServer.close(resolve));
    }
    if (originalState === undefined) delete process.env.DEVSPACE_WORKFLOW_STATE_DIR;
    else process.env.DEVSPACE_WORKFLOW_STATE_DIR = originalState;
    if (originalCli === undefined) delete process.env.DEVSPACE_WORKFLOW_CLI;
    else process.env.DEVSPACE_WORKFLOW_CLI = originalCli;
    await rm(root, { recursive: true, force: true });
  });
  await Promise.all([stateDirectory, workspaceA, workspaceB].map((path) => mkdir(path)));
  // 即使拒絕模型的閘門出錯，也只會執行這個固定替身，絕不啟動模型。
  await writeFile(forbiddenCli, `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(forbiddenMarker)}, 'unexpected'); throw new Error('MODEL_RUN_FORBIDDEN_IN_TEST');\n`);
  process.env.DEVSPACE_WORKFLOW_STATE_DIR = stateDirectory;
  process.env.DEVSPACE_WORKFLOW_CLI = forbiddenCli;
  mcpServer = new McpServer({ name: "pixiu-legacy-workflow-acceptance", version: "20260908-test" });
  registerDevSpaceWorkflowTools({
    server: mcpServer,
    config: { allowedRoots: [workspaceA, workspaceB] },
    workspaces: {
      getWorkspace(id) {
        if (id === "native-a") return { root: workspaceA };
        if (id === "native-b") return { root: workspaceB };
        throw new Error("UNKNOWN_TEST_WORKSPACE");
      },
    },
    registerAppTool,
    z,
  });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID, enableJsonResponse: true });
  await mcpServer.connect(transport);
  httpServer = createServer((request, response) => {
    transport.handleRequest(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(0, "127.0.0.1", resolve);
  });
  const address = httpServer.address();
  assert.equal(typeof address, "object");
  assert.notEqual(address.port, 4187);
  assert.notEqual(address.port, 7676);
  client = new Client({ name: "pixiu-native-mcp-regression", version: "20260908-test" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`)));
  const common = { workspaceId: "native-a", sessionRef: "native-mcp-20260908", actor: "native-test-owner" };
  let task;

  await t.test("真實工具註冊與 HTTP 協定交握", async () => {
    const response = await client.listTools();
    const names = response.tools.map((tool) => tool.name).sort();
    assert.deepEqual(names, ["workflow_create", "workflow_list", "workflow_run", "workflow_sync", "workflow_update"]);
    const schema = response.tools.find((tool) => tool.name === "workflow_update").inputSchema;
    assert.ok(schema.properties.action.enum.includes("claim"));
    assert.ok(!schema.properties.action.enum.includes("pause"));
    console.log(JSON.stringify({ environment: "ISOLATED_WINDOWS_HTTP_MCP_LEGACY", packageRoot, devSpaceVersion: JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")).version, sourceSha256: digest(await readFile(fileURLToPath(new URL("../DevSpace.WorkflowStore.mjs", import.meta.url)))), tools: names, fullAutoPauseAvailable: false }));
  });
  await t.test("合法任務可透過真實結構建立", async () => {
    task = parsedResult(await client.callTool({ name: "workflow_create", arguments: { ...common, scope: "same_project", objective: "隔離測試，不執行模型", acceptanceCriteria: ["只修改測試暫存帳本"], requireReview: false, idempotencyKey: "native-create-20260908" } }));
    assert.match(task.taskId, /^tsk_/);
    assert.equal(task.revision, 1);
  });
  await t.test("不合法型別被真實 Zod 拒絕", async () => {
    const before = await treeFingerprint(stateDirectory);
    await mustReject(client, "workflow_create", { ...common, scope: "same_project", objective: "拒絕此輸入", acceptanceCriteria: "不是陣列", idempotencyKey: "native-invalid-20260908" }, /acceptanceCriteria/i);
    assert.equal(await treeFingerprint(stateDirectory), before);
  });
  await t.test("唯讀查詢不改帳本位元組", async () => {
    const before = await treeFingerprint(stateDirectory);
    const read = parsedResult(await client.callTool({ name: "workflow_list", arguments: { workspaceId: common.workspaceId, sessionRef: common.sessionRef, taskId: task.taskId } }));
    assert.equal(read.taskId, task.taskId);
    assert.equal(await treeFingerprint(stateDirectory), before);
  });
  await t.test("目前原生結構明確沒有新版 pause，不冒充整合成功", async () => {
    const before = await treeFingerprint(stateDirectory);
    await mustReject(client, "workflow_update", { ...common, taskId: task.taskId, action: "pause", expectedRevision: task.revision, idempotencyKey: "native-pause-20260908" }, /action|Invalid option/i);
    assert.equal(await treeFingerprint(stateDirectory), before);
  });
  await t.test("舊流程 claim 可用並保留 revision 檢查", async () => {
    task = parsedResult(await client.callTool({ name: "workflow_update", arguments: { ...common, taskId: task.taskId, action: "claim", expectedRevision: task.revision, idempotencyKey: "native-claim-20260908" } }));
    assert.equal(task.status, "in_progress");
    const before = await treeFingerprint(stateDirectory);
    await mustReject(client, "workflow_update", { ...common, taskId: task.taskId, action: "block", reason: "舊版號應拒絕", expectedRevision: 1, idempotencyKey: "native-stale-20260908" }, /Stale revision/i);
    assert.equal(await treeFingerprint(stateDirectory), before);
  });
  await t.test("跨專案指定同一任務仍被拒絕", async () => {
    const before = await treeFingerprint(stateDirectory);
    await mustReject(client, "workflow_list", { workspaceId: "native-b", sessionRef: common.sessionRef, taskId: task.taskId }, /outside this task's project scope/i);
    assert.equal(await treeFingerprint(stateDirectory), before);
  });
  await t.test("未授權模型執行被拒絕且沒有啟動替身", async () => {
    const before = await treeFingerprint(stateDirectory);
    await mustReject(client, "workflow_run", { ...common, taskId: task.taskId, role: "worker", expectedRevision: task.revision, userAuthorizedModelRun: false, idempotencyKey: "native-model-denied-20260908" }, /requires explicit user authorization/i);
    assert.equal(await treeFingerprint(stateDirectory), before);
    await assert.rejects(access(forbiddenMarker), { code: "ENOENT" });
  });
});
