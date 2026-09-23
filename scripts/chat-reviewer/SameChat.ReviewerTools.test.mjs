import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { registerSameChatReviewerTools } from "./SameChat.ReviewerTools.mjs";

function fakeSchema() {
  const schema = {};
  for (const method of ["min", "max", "int", "positive", "regex", "optional", "describe"]) {
    schema[method] = () => schema;
  }
  return schema;
}

function fakeZod() {
  return {
    string: () => fakeSchema(),
    number: () => fakeSchema(),
    boolean: () => fakeSchema(),
    enum: () => fakeSchema(),
    array: () => fakeSchema(),
    object: () => fakeSchema(),
  };
}

function parseToolResult(value) {
  return JSON.parse(value.structuredContent.result);
}

async function fixture() {
  const stateDirectory = await mkdtemp(join(tmpdir(), "same-chat-review-tools-"));
  const tools = new Map();
  const resources = new Map();
  const z = fakeZod();
  const server = {
    registerResource(name, uri, options, handler) {
      resources.set(uri, { name, uri, options, handler });
    },
  };
  const registration = registerSameChatReviewerTools({
    server,
    z,
    stateDirectory,
    registerAppTool(_server, name, descriptor, handler) {
      tools.set(name, { descriptor, handler });
    },
  });

  return {
    stateDirectory,
    tools,
    resources,
    registration,
    async cleanup() {
      await rm(stateDirectory, { recursive: true, force: true });
    },
  };
}

function requestInput(overrides = {}) {
  return {
    taskId: "tsk_same_chat_tools_001",
    subjectRevision: 11,
    snapshotHash: "sha256:" + "a".repeat(64),
    question: "找出 reconnect 方案的反例",
    criteria: ["race condition", "stale state"],
    objective: "驗證 reconnect 是否安全",
    candidate: "候選方案：只有 transport close 後才 reconnect",
    evidenceRefs: ["repo:scripts/reconnect.js"],
    constraints: ["只做 advisory review"],
    ttlMs: 60_000,
    ...overrides,
  };
}

function finding() {
  return {
    id: "finding-1",
    severity: "high",
    claim: "舊 session close event 可能晚到",
    reason: "若新 session 已建立，舊事件可能誤觸 reconnect。",
    claimRefs: ["claim-reconnect"],
    evidenceRefs: ["repo:scripts/reconnect.js"],
    suggestedTests: ["模擬 late close event"],
  };
}

test("註冊層只新增獨立 Same-Chat 工具，不碰既有 workflow 工具", async () => {
  const f = await fixture();
  try {
    assert.deepEqual(
      [...f.tools.keys()].sort(),
      [
        "same_chat_review_capabilities",
        "same_chat_review_consume",
        "same_chat_review_request",
        "same_chat_review_status",
        "same_chat_review_submit",
      ],
    );
    assert.equal(f.registration.toolNames.length, 5);
    assert.equal(f.registration.resourceUri, "ui://pixiu/same-chat-reviewer/v1.html");
    assert.equal(f.resources.size, 1);
    assert.ok(!f.tools.has("workflow_update"));
  } finally {
    await f.cleanup();
  }
});

test("request tool 掛載 widget 並維持 host E2E fail-closed", async () => {
  const f = await fixture();
  try {
    const tool = f.tools.get("same_chat_review_request");
    assert.equal(
      tool.descriptor._meta.ui.resourceUri,
      "ui://pixiu/same-chat-reviewer/v1.html",
    );
    assert.equal(
      tool.descriptor._meta["openai/outputTemplate"],
      "ui://pixiu/same-chat-reviewer/v1.html",
    );

    const output = parseToolResult(await tool.handler(requestInput()));
    assert.equal(output.request.independentReview, false);
    assert.equal(output.request.canSatisfyRequiredReview, false);
    assert.equal(output.dispatch.preferredStandard, "MCP Apps ui/message");
    assert.equal(output.dispatch.serverPostsMessageAutomatically, false);
    assert.equal(output.dispatch.widgetAttemptsSingleDispatch, true);
    assert.equal(output.dispatch.hostE2EVerified, false);
    assert.equal(output.dispatch.autoContinueVerified, false);
    assert.match(output.reviewerPrompt, /Same-Chat Advisory Review/);
    assert.match(output.reviewerPrompt, /same_chat_review_submit/);
    assert.match(output.reviewerPrompt, /same_chat_review_consume/);
    assert.match(output.reviewerPrompt, /REASSESS \/ REPAIR \/ VERIFY/);
  } finally {
    await f.cleanup();
  }
});

test("request → submit → status → consume 形成可持久接續的協議閉環", async () => {
  const f = await fixture();
  try {
    const created = parseToolResult(
      await f.tools.get("same_chat_review_request").handler(requestInput()),
    );
    const request = created.request;

    const pending = parseToolResult(
      await f.tools.get("same_chat_review_status").handler({ reviewId: request.reviewId }),
    );
    assert.equal(pending.status, "pending");

    const submitted = parseToolResult(
      await f.tools.get("same_chat_review_submit").handler({
        reviewId: request.reviewId,
        taskId: request.taskId,
        subjectRevision: request.subjectRevision,
        snapshotHash: request.snapshotHash,
        verdict: "concerns_found",
        findings: [finding()],
      }),
    );
    assert.equal(submitted.status, "result_received");
    assert.equal(submitted.independentReview, false);

    const ready = parseToolResult(
      await f.tools.get("same_chat_review_status").handler({ reviewId: request.reviewId }),
    );
    assert.equal(ready.status, "result_received");
    assert.equal(ready.result.findings.length, 1);

    const consumed = parseToolResult(
      await f.tools.get("same_chat_review_consume").handler({ reviewId: request.reviewId }),
    );
    assert.equal(consumed.status, "consumed");
    assert.equal(consumed.criticalRelayProposal.completionEffect, "none");
    assert.equal(consumed.criticalRelayProposal.challenges[0].status, "open");
    assert.equal(consumed.criticalRelayProposal.counterEvidence[0].status, "open");
  } finally {
    await f.cleanup();
  }
});

test("submit correlation 與 stored request 不符時拒絕", async () => {
  const f = await fixture();
  try {
    const created = parseToolResult(
      await f.tools.get("same_chat_review_request").handler(requestInput()),
    );
    const request = created.request;

    await assert.rejects(
      f.tools.get("same_chat_review_submit").handler({
        reviewId: request.reviewId,
        taskId: request.taskId,
        subjectRevision: request.subjectRevision + 1,
        snapshotHash: request.snapshotHash,
        verdict: "concerns_found",
        findings: [finding()],
      }),
      /subjectRevision does not match/i,
    );
  } finally {
    await f.cleanup();
  }
});

test("consume 只能一次，不能把同一 reviewer result 重複餵回 CR", async () => {
  const f = await fixture();
  try {
    const created = parseToolResult(
      await f.tools.get("same_chat_review_request").handler(requestInput()),
    );
    const request = created.request;
    await f.tools.get("same_chat_review_submit").handler({
      reviewId: request.reviewId,
      taskId: request.taskId,
      subjectRevision: request.subjectRevision,
      snapshotHash: request.snapshotHash,
      verdict: "no_additional_findings",
      findings: [],
    });
    await f.tools.get("same_chat_review_consume").handler({ reviewId: request.reviewId });
    await assert.rejects(
      f.tools.get("same_chat_review_consume").handler({ reviewId: request.reviewId }),
      /不可 consume/i,
    );
  } finally {
    await f.cleanup();
  }
});

test("capability tool 只能回報 declared readiness，不會冒充真實 host E2E", async () => {
  const f = await fixture();
  try {
    const result = parseToolResult(
      await f.tools.get("same_chat_review_capabilities").handler({
        uiMessage: true,
        toolCall: true,
        sessionCorrelation: true,
        resultSubmissionTool: true,
      }),
    );
    assert.equal(result.protocolReady, true);
    assert.equal(result.capabilityDeclaredOnly, true);
    assert.equal(result.hostE2EVerified, false);
    assert.equal(result.autoContinueVerified, false);
  } finally {
    await f.cleanup();
  }
});

test("MCP Apps resource 使用標準 resourceUri/MIME，widget 有單次 ui/message 與 ChatGPT fallback", async () => {
  const f = await fixture();
  try {
    const resource = f.resources.get("ui://pixiu/same-chat-reviewer/v1.html");
    assert.ok(resource);
    const result = await resource.handler();
    assert.equal(result.contents.length, 1);
    const content = result.contents[0];
    assert.equal(content.uri, "ui://pixiu/same-chat-reviewer/v1.html");
    assert.equal(content.mimeType, "text/html;profile=mcp-app");
    assert.equal(content._meta.ui.prefersBorder, true);
    assert.deepEqual(content._meta.ui.csp.connectDomains, []);
    assert.deepEqual(content._meta.ui.csp.resourceDomains, []);
    assert.match(content.text, /ui\/initialize/);
    assert.match(content.text, /ui\/notifications\/initialized/);
    assert.match(content.text, /ui\/notifications\/tool-result/);
    assert.match(content.text, /ui\/message/);
    assert.match(content.text, /sendFollowUpMessage/);
    assert.match(content.text, /dispatchedReviewId/);
    assert.match(content.text, /dispatchStatus/);
    assert.match(content.text, /重新送出 Reviewer Turn/);
    assert.doesNotMatch(content.text, /same_chat_review_submit/);
    assert.doesNotMatch(content.text, /same_chat_review_consume/);
  } finally {
    await f.cleanup();
  }
});

test("resource 不依賴外部 script/style domain", async () => {
  const f = await fixture();
  try {
    const resource = f.resources.get("ui://pixiu/same-chat-reviewer/v1.html");
    const result = await resource.handler();
    const content = result.contents[0];
    assert.doesNotMatch(content.text, /<script[^>]+src=/i);
    assert.doesNotMatch(content.text, /<link[^>]+href=/i);
    assert.deepEqual(content._meta.ui.csp.connectDomains, []);
    assert.deepEqual(content._meta.ui.csp.resourceDomains, []);
  } finally {
    await f.cleanup();
  }
});
