import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createWorkflowController,
  registerDevSpaceWorkflowTools,
  resolveLocalAgentPolicy,
} from "../DevSpace.WorkflowStore.mjs";
import {
  createWorkflowController as createStandaloneWorkflowController,
  projectRefFromPath,
} from "../../../external/session-workflow/packages/session-workflow/core/index.mjs";
import { createStandaloneProjectResolver } from "../../../external/session-workflow/packages/session-workflow/adapters/standalone-project-resolver.mjs";

function workflowFixturePath(name) {
  return fileURLToPath(
    new URL(`../../../specs/active/02-standalone-session-workflow/fixtures/${name}`, import.meta.url),
  );
}

async function createFixture(options = {}) {
  const stateDirectory = await mkdtemp(join(tmpdir(), "devspace-workflow-test-"));
  let sequence = 0;
  const adapterCalls = [];
  const controller = createWorkflowController({
    stateDirectory,
    idFactory(prefix) {
      sequence += 1;
      return `${prefix}_${String(sequence).padStart(8, "0")}`;
    },
    now() {
      sequence += 1;
      return new Date(Date.UTC(2026, 7, 12, 0, 0, sequence)).toISOString();
    },
    agentAdapter: {
      async start(input) {
        adapterCalls.push(input);
        return { agentId: `agt_${String(adapterCalls.length).padStart(8, "0")}` };
      },
      async get(agentId) {
        return options.agentRecord ?? {
          agentId,
          status: "idle",
          latestResponse: "verified output",
        };
      },
    },
  });
  return {
    controller,
    stateDirectory,
    adapterCalls,
    async cleanup() {
      await rm(stateDirectory, { recursive: true, force: true });
    },
  };
}

function baseCreate(overrides = {}) {
  return {
    workspaceRoot: "C:\\Projects\\alpha",
    relatedWorkspaceRoots: [],
    sessionRef: "session-a",
    actor: "alice",
    scope: "same_project",
    objective: "Implement a durable handoff flow",
    acceptanceCriteria: ["A second session can acknowledge the handoff"],
    requireReview: true,
    policy: {
      model: "gpt-5.6-sol",
      reasoningEffort: "xhigh",
      deepResearch: false,
      proMode: false,
      unsupportedBehavior: "block",
    },
    idempotencyKey: "create-alpha-001",
    ...overrides,
  };
}

test("standalone core exposes coordination only and has no DevSpace runtime boundary", async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), "standalone-core-boundary-"));
  try {
    const controller = createStandaloneWorkflowController({ stateDirectory });
    assert.equal(controller.runTask, undefined);
    assert.equal(controller.syncTask, undefined);
    assert.equal(controller.agentAdapter, undefined);

    const source = await readFile(
      fileURLToPath(new URL("../../../external/session-workflow/packages/session-workflow/core/index.mjs", import.meta.url)),
      "utf8",
    );
    assert.doesNotMatch(source, /DEVSPACE_WORKFLOW_STATE_DIR/);
    assert.doesNotMatch(source, /DevSpace local Agent|DevSpace Agent adapter/);
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("standalone core creates and lists tasks without DevSpace runtime", async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), "session-workflow-core-test-"));
  try {
    const controller = createStandaloneWorkflowController({ stateDirectory });
    const created = await controller.createTask(baseCreate({ requireReview: false }));
    const listed = await controller.listTasks({
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-b",
    });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].taskId, created.taskId);
    assert.equal(listed[0].revision, 1);
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("standalone project resolver derives stable isolated project refs", () => {
  const resolver = createStandaloneProjectResolver({ namespace: "friend-web" });
  const alphaFirst = resolver.resolveProjectKey("alpha");
  const alphaSecond = resolver.resolveProjectKey("alpha");
  const beta = resolver.resolveProjectKey("beta");
  assert.equal(alphaFirst.projectRef, alphaSecond.projectRef);
  assert.notEqual(alphaFirst.projectRef, beta.projectRef);
  assert.match(alphaFirst.projectRef, /^friend-web:[a-f0-9]{64}$/);
});

test("schema v2 project refs isolate same-project and cross-project visibility", async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), "session-workflow-v2-test-"));
  try {
    const controller = createStandaloneWorkflowController({ stateDirectory });
    const created = await controller.createTask({
      ...baseCreate({
        workspaceRoot: undefined,
        relatedWorkspaceRoots: undefined,
        requireReview: false,
      }),
      projectRef: "project:alpha",
      relatedProjectRefs: ["project:beta"],
      scope: "cross_project",
      idempotencyKey: "create-v2-project-001",
    });
    assert.equal(created.schemaVersion, 2);
    assert.deepEqual(created.projectRefs, ["project:alpha", "project:beta"]);
    assert.equal("projectRoots" in created, false);

    const visibleFromBeta = await controller.listTasks({
      projectRef: "project:beta",
      sessionRef: "session-b",
    });
    assert.equal(visibleFromBeta.length, 1);

    const hiddenFromGamma = await controller.listTasks({
      projectRef: "project:gamma",
      sessionRef: "session-c",
    });
    assert.equal(hiddenFromGamma.length, 0);
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("v1 ledger can migrate to v2 on project-ref mutation without rewriting old hashes", async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), "session-workflow-v1-v2-test-"));
  try {
    const source = await readFile(
      workflowFixturePath("v1-valid.jsonl"),
      "utf8",
    );
    await writeFile(join(stateDirectory, "workflow-events.jsonl"), source, "utf8");
    const originalLines = source.trim().split(/\r?\n/);
    const originalLast = JSON.parse(originalLines.at(-1));
    const controller = createStandaloneWorkflowController({ stateDirectory });
    const projectRef = projectRefFromPath("C:\\Fixture\\Project");
    const migrated = await controller.updateTask({
      projectRef,
      sessionRef: "fixture-session-b",
      actor: "fixture-b",
      taskId: "tsk_fixture000001",
      action: "acknowledge",
      expectedRevision: 3,
      idempotencyKey: "fixture-ack-v2-0001",
    });
    assert.equal(migrated.schemaVersion, 2);
    assert.deepEqual(migrated.projectRefs, [projectRef]);
    assert.equal("projectRoots" in migrated, false);
    assert.equal(migrated.revision, 4);

    const migratedLedger = await readFile(join(stateDirectory, "workflow-events.jsonl"), "utf8");
    const migratedLines = migratedLedger.trim().split(/\r?\n/);
    assert.equal(migratedLines.length, 4);
    assert.equal(migratedLines[0], originalLines[0]);
    assert.equal(migratedLines[1], originalLines[1]);
    assert.equal(migratedLines[2], originalLines[2]);
    const v2Event = JSON.parse(migratedLines[3]);
    assert.equal(v2Event.schemaVersion, 2);
    assert.equal(v2Event.previousHash, originalLast.hash);
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("static v2 fixture replays with project-ref visibility", async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), "session-workflow-v2-fixture-test-"));
  try {
    const source = await readFile(
      workflowFixturePath("v2-valid.jsonl"),
      "utf8",
    );
    await writeFile(join(stateDirectory, "workflow-events.jsonl"), source, "utf8");
    const controller = createStandaloneWorkflowController({ stateDirectory });
    const listed = await controller.listTasks({
      projectRef: "project:beta",
      sessionRef: "v2-session-b",
    });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].schemaVersion, 2);
    assert.equal(listed[0].revision, 2);
    assert.equal(listed[0].status, "in_progress");
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("static v1-to-v2 fixture preserves the original chain and replays the migrated task", async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), "session-workflow-v1-v2-fixture-test-"));
  try {
    const source = await readFile(
      workflowFixturePath("v1-to-v2-valid.jsonl"),
      "utf8",
    );
    await writeFile(join(stateDirectory, "workflow-events.jsonl"), source, "utf8");
    const fixtureProjectRef = JSON.parse(source.trim().split(/\r?\n/).at(-1)).task.projectRefs[0];
    const controller = createStandaloneWorkflowController({ stateDirectory });
    const task = await controller.getTask({
      taskId: "tsk_fixture000001",
      projectRef: fixtureProjectRef,
      sessionRef: "fixture-session-b",
    });
    assert.equal(task.schemaVersion, 2);
    assert.equal(task.revision, 4);
    assert.equal(task.status, "in_progress");
    assert.equal(task.currentOwner, "fixture-b");
  } finally {
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("create is idempotent and replay produces the same task", async () => {
  const fixture = await createFixture();
  try {
    const first = await fixture.controller.createTask(baseCreate());
    const duplicate = await fixture.controller.createTask(baseCreate());
    assert.equal(first.taskId, duplicate.taskId);
    assert.equal(first.revision, 1);

    const replayedController = createWorkflowController({
      stateDirectory: fixture.stateDirectory,
      agentAdapter: fixture.controller.agentAdapter,
    });
    const replayed = await replayedController.getTask({
      taskId: first.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "another-session",
    });
    assert.deepEqual(replayed, first);
  } finally {
    await fixture.cleanup();
  }
});

test("persistent workflow fields reject credential-like values before ledger creation", async () => {
  const fixture = await createFixture();
  try {
    await assert.rejects(
      fixture.controller.createTask(
        baseCreate({
          objective: "Call the service with api_key=fixture-secret-value-1234",
          idempotencyKey: "reject-secret-create-001",
        }),
      ),
      /sensitive credential/i,
    );
    await assert.rejects(
      fixture.controller.createTask(
        baseCreate({
          objective: 'Load {"apiKey":"fixture-json-secret-value-5678"}',
          idempotencyKey: "reject-json-secret-create-001",
        }),
      ),
      /sensitive credential/i,
    );
    await assert.rejects(
      readFile(join(fixture.stateDirectory, "workflow-events.jsonl"), "utf8"),
      (error) => error?.code === "ENOENT",
    );
  } finally {
    await fixture.cleanup();
  }
});

test("compare-and-swap allows exactly one concurrent claim", async () => {
  const fixture = await createFixture();
  try {
    const task = await fixture.controller.createTask(baseCreate());
    const attempts = await Promise.allSettled([
      fixture.controller.updateTask({
        taskId: task.taskId,
        workspaceRoot: "C:\\Projects\\alpha",
        sessionRef: "session-b",
        actor: "bob",
        action: "claim",
        expectedRevision: 1,
        idempotencyKey: "claim-bob-001",
      }),
      fixture.controller.updateTask({
        taskId: task.taskId,
        workspaceRoot: "C:\\Projects\\alpha",
        sessionRef: "session-c",
        actor: "carol",
        action: "claim",
        expectedRevision: 1,
        idempotencyKey: "claim-carol-001",
      }),
    ]);
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((result) => result.status === "rejected").length, 1);
    assert.match(attempts.find((result) => result.status === "rejected").reason.message, /stale revision/i);
  } finally {
    await fixture.cleanup();
  }
});

test("scope boundaries reject the wrong session or project", async () => {
  const fixture = await createFixture();
  try {
    const single = await fixture.controller.createTask(
      baseCreate({
        scope: "single_session",
        idempotencyKey: "create-single-001",
      }),
    );
    await assert.rejects(
      fixture.controller.getTask({
        taskId: single.taskId,
        workspaceRoot: "C:\\Projects\\alpha",
        sessionRef: "session-b",
      }),
      /session scope/i,
    );

    const cross = await fixture.controller.createTask(
      baseCreate({
        scope: "cross_project",
        relatedWorkspaceRoots: ["C:\\Projects\\beta"],
        idempotencyKey: "create-cross-001",
      }),
    );
    const visibleFromBeta = await fixture.controller.getTask({
      taskId: cross.taskId,
      workspaceRoot: "C:\\Projects\\beta",
      sessionRef: "session-b",
    });
    assert.equal(visibleFromBeta.taskId, cross.taskId);
    await assert.rejects(
      fixture.controller.getTask({
        taskId: cross.taskId,
        workspaceRoot: "C:\\Projects\\gamma",
        sessionRef: "session-b",
      }),
      /project scope/i,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("handoff requires a structured packet and target acknowledgment", async () => {
  const fixture = await createFixture();
  try {
    let task = await fixture.controller.createTask(baseCreate());
    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "claim",
      expectedRevision: task.revision,
      idempotencyKey: "claim-alice-001",
    });
    await assert.rejects(
      fixture.controller.updateTask({
        taskId: task.taskId,
        workspaceRoot: "C:\\Projects\\alpha",
        sessionRef: "session-a",
        actor: "alice",
        action: "handoff",
        expectedRevision: task.revision,
        idempotencyKey: "handoff-invalid-001",
        toActor: "bob",
      }),
      /context snapshot/i,
    );

    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "handoff",
      expectedRevision: task.revision,
      idempotencyKey: "handoff-valid-001",
      toActor: "bob",
      contextSnapshot: "Worker finished the storage layer.",
      deliverables: ["DevSpace.WorkflowStore.mjs"],
      openItems: ["Wire MCP tools"],
      requiredNextAction: "Add server registration",
    });
    assert.equal(task.status, "handoff_pending");
    await assert.rejects(
      fixture.controller.updateTask({
        taskId: task.taskId,
        workspaceRoot: "C:\\Projects\\alpha",
        sessionRef: "session-c",
        actor: "carol",
        action: "acknowledge",
        expectedRevision: task.revision,
        idempotencyKey: "ack-carol-001",
      }),
      /handoff target/i,
    );
    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-b",
      actor: "bob",
      action: "acknowledge",
      expectedRevision: task.revision,
      idempotencyKey: "ack-bob-001",
    });
    assert.equal(task.currentOwner, "bob");
    assert.equal(task.handoffs.at(-1).status, "acknowledged");
  } finally {
    await fixture.cleanup();
  }
});

test("independent review is fixed to a revision and gates completion", async () => {
  const fixture = await createFixture();
  try {
    let task = await fixture.controller.createTask(baseCreate());
    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "claim",
      expectedRevision: task.revision,
      idempotencyKey: "review-claim-001",
    });
    await assert.rejects(
      fixture.controller.updateTask({
        taskId: task.taskId,
        workspaceRoot: "C:\\Projects\\alpha",
        sessionRef: "session-a",
        actor: "alice",
        action: "request_review",
        expectedRevision: task.revision,
        idempotencyKey: "self-review-001",
        reviewerActor: "alice",
        subjectRef: "git:abc123",
        criteria: ["Tests pass"],
      }),
      /different from producer/i,
    );
    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "request_review",
      expectedRevision: task.revision,
      idempotencyKey: "request-review-001",
      reviewerActor: "bob",
      subjectRef: "git:abc123",
      criteria: ["Tests pass", "Scope boundaries hold"],
    });
    assert.equal(task.reviews.at(-1).subjectRevision, 2);
    await assert.rejects(
      fixture.controller.updateTask({
        taskId: task.taskId,
        workspaceRoot: "C:\\Projects\\alpha",
        sessionRef: "session-a",
        actor: "alice",
        action: "complete",
        expectedRevision: task.revision,
        idempotencyKey: "premature-complete-001",
      }),
      /approved review/i,
    );
    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-b",
      actor: "bob",
      action: "submit_review",
      expectedRevision: task.revision,
      idempotencyKey: "approve-review-001",
      verdict: "approved",
      findings: ["All acceptance checks passed"],
    });
    assert.equal(task.status, "ready_to_complete");
    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "complete",
      expectedRevision: task.revision,
      idempotencyKey: "complete-after-review-001",
    });
    assert.equal(task.status, "completed");
  } finally {
    await fixture.cleanup();
  }
});

test("local policy blocks or explicitly records unsupported Deep Research and Pro", () => {
  const requested = {
    model: "gpt-5.6-sol",
    reasoningEffort: "high",
    deepResearch: true,
    proMode: true,
    unsupportedBehavior: "block",
  };
  assert.throws(() => resolveLocalAgentPolicy(requested), /does not support.*Deep Research.*Pro/i);

  const resolved = resolveLocalAgentPolicy({
    ...requested,
    unsupportedBehavior: "explicit_degrade",
  });
  assert.equal(resolved.effective.deepResearch, false);
  assert.equal(resolved.effective.proMode, false);
  assert.equal(resolved.effective.model, "gpt-5.6-sol");
  assert.equal(resolved.effective.reasoningEffort, "high");
  assert.equal(resolved.warnings.length, 2);
});

test("workflow_run requires explicit user authorization before starting an Agent", async () => {
  const fixture = await createFixture();
  try {
    let task = await fixture.controller.createTask(baseCreate());
    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "claim",
      expectedRevision: task.revision,
      idempotencyKey: "auth-gate-claim-001",
    });
    await assert.rejects(
      fixture.controller.runTask({
        taskId: task.taskId,
        workspaceRoot: "C:\\Projects\\alpha",
        sessionRef: "session-a",
        actor: "alice",
        role: "worker",
        expectedRevision: task.revision,
        idempotencyKey: "auth-gate-run-001",
      }),
      /explicit user authorization/i,
    );
    assert.equal(fixture.adapterCalls.length, 0);
  } finally {
    await fixture.cleanup();
  }
});

test("authorized workflow_run can omit model and reasoning overrides", async () => {
  const fixture = await createFixture();
  try {
    let task = await fixture.controller.createTask(
      baseCreate({ policy: {}, idempotencyKey: "profile-default-create-001" }),
    );
    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "claim",
      expectedRevision: task.revision,
      idempotencyKey: "profile-default-claim-001",
    });
    task = await fixture.controller.runTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      role: "worker",
      userAuthorizedModelRun: true,
      expectedRevision: task.revision,
      idempotencyKey: "profile-default-run-001",
    });
    assert.equal(fixture.adapterCalls[0].model, undefined);
    assert.equal(fixture.adapterCalls[0].reasoningEffort, undefined);
    assert.equal(task.runs.at(-1).effectivePolicy.model, undefined);
    assert.equal(task.runs.at(-1).effectivePolicy.reasoningEffort, undefined);
  } finally {
    await fixture.cleanup();
  }
});

test("worker run receives selected model and effort, then sync records output", async () => {
  const fixture = await createFixture();
  try {
    let task = await fixture.controller.createTask(baseCreate());
    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "claim",
      expectedRevision: task.revision,
      idempotencyKey: "run-claim-001",
    });
    task = await fixture.controller.runTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      role: "worker",
      profile: "codex-worker",
      userAuthorizedModelRun: true,
      expectedRevision: task.revision,
      idempotencyKey: "run-worker-001",
    });
    assert.equal(fixture.adapterCalls[0].model, "gpt-5.6-sol");
    assert.equal(fixture.adapterCalls[0].reasoningEffort, "xhigh");
    assert.equal(task.runs.at(-1).agentId, "agt_00000001");

    task = await fixture.controller.syncTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      runId: task.runs.at(-1).runId,
      expectedRevision: task.revision,
      idempotencyKey: "sync-worker-001",
    });
    assert.equal(task.runs.at(-1).status, "idle");
    assert.equal(task.runs.at(-1).latestResponse, "verified output");
  } finally {
    await fixture.cleanup();
  }
});

test("Agent sync redacts credential-like runtime output before persistence", async () => {
  const fixture = await createFixture({
    agentRecord: {
      status: "idle",
      latestResponse: [
        "completed with Bearer fixture-runtime-token-1234",
        "-----BEGIN PRIVATE KEY-----",
        "fixture-private-material-9012",
        "-----END PRIVATE KEY-----",
      ].join("\n"),
      error:
        '{"authorization":"Basic Zml4dHVyZS1iYXNpYy1zZWNyZXQtdmFsdWU="}',
    },
  });
  try {
    let task = await fixture.controller.createTask(
      baseCreate({ idempotencyKey: "redact-runtime-create-001" }),
    );
    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "claim",
      expectedRevision: task.revision,
      idempotencyKey: "redact-runtime-claim-001",
    });
    task = await fixture.controller.runTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      role: "worker",
      userAuthorizedModelRun: true,
      expectedRevision: task.revision,
      idempotencyKey: "redact-runtime-run-001",
    });
    task = await fixture.controller.syncTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      runId: task.runs.at(-1).runId,
      expectedRevision: task.revision,
      idempotencyKey: "redact-runtime-sync-001",
    });

    assert.match(task.runs.at(-1).latestResponse, /\[REDACTED\]/);
    assert.match(task.runs.at(-1).error, /\[REDACTED\]/);
    const ledger = await readFile(join(fixture.stateDirectory, "workflow-events.jsonl"), "utf8");
    assert.doesNotMatch(
      ledger,
      /fixture-runtime-token-1234|Zml4dHVyZS1iYXNpYy1zZWNyZXQtdmFsdWU=|fixture-private-material-9012/,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("retrying workflow_run with the same key does not start a second Agent", async () => {
  const fixture = await createFixture();
  try {
    let task = await fixture.controller.createTask(baseCreate({ idempotencyKey: "retry-create-001" }));
    task = await fixture.controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "claim",
      expectedRevision: task.revision,
      idempotencyKey: "retry-claim-001",
    });
    const runRequest = {
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      role: "worker",
      userAuthorizedModelRun: true,
      expectedRevision: task.revision,
      idempotencyKey: "retry-run-001",
    };
    const first = await fixture.controller.runTask(runRequest);
    const retry = await fixture.controller.runTask(runRequest);
    assert.equal(fixture.adapterCalls.length, 1);
    assert.equal(retry.revision, first.revision);
    assert.equal(retry.runs.length, 1);
    assert.equal(retry.runs[0].agentId, first.runs[0].agentId);
  } finally {
    await fixture.cleanup();
  }
});

test("Agent start finalization preserves a concurrent handoff revision", async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), "devspace-workflow-run-race-"));
  let releaseStart;
  let notifyStarted;
  const startWasCalled = new Promise((resolveStarted) => {
    notifyStarted = resolveStarted;
  });
  const allowStartToFinish = new Promise((resolveRelease) => {
    releaseStart = resolveRelease;
  });
  const controller = createWorkflowController({
    stateDirectory,
    agentAdapter: {
      async start() {
        notifyStarted();
        await allowStartToFinish;
        return { agentId: "agt_1a2b3c4d" };
      },
      async get() {
        return { status: "running" };
      },
    },
  });
  try {
    let task = await controller.createTask(baseCreate({ idempotencyKey: "race-create-001" }));
    task = await controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "claim",
      expectedRevision: task.revision,
      idempotencyKey: "race-claim-001",
    });
    const runPromise = controller.runTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      role: "worker",
      userAuthorizedModelRun: true,
      expectedRevision: task.revision,
      idempotencyKey: "race-run-001",
    });
    await startWasCalled;
    task = await controller.getTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
    });
    assert.equal(task.runs.at(-1).status, "starting");
    task = await controller.updateTask({
      taskId: task.taskId,
      workspaceRoot: "C:\\Projects\\alpha",
      sessionRef: "session-a",
      actor: "alice",
      action: "handoff",
      expectedRevision: task.revision,
      idempotencyKey: "race-handoff-001",
      toActor: "bob",
      contextSnapshot: "The Agent is still starting.",
      deliverables: ["prepared run"],
      openItems: ["sync result"],
      requiredNextAction: "Acknowledge and sync",
    });
    releaseStart();
    const finalized = await runPromise;
    assert.equal(finalized.status, "handoff_pending");
    assert.equal(finalized.runs.at(-1).agentId, "agt_1a2b3c4d");
    assert.equal(finalized.runs.at(-1).status, "running");
    assert.equal(finalized.revision, task.revision + 1);
  } finally {
    releaseStart?.();
    await rm(stateDirectory, { recursive: true, force: true });
  }
});

test("ledger hash tampering fails closed", async () => {
  const fixture = await createFixture();
  try {
    await fixture.controller.createTask(baseCreate());
    const ledgerPath = join(fixture.stateDirectory, "workflow-events.jsonl");
    const ledger = await readFile(ledgerPath, "utf8");
    await writeFile(ledgerPath, ledger.replace("durable handoff", "tampered handoff"), "utf8");
    const reopened = createWorkflowController({ stateDirectory: fixture.stateDirectory });
    await assert.rejects(
      reopened.listTasks({
        workspaceRoot: "C:\\Projects\\alpha",
        sessionRef: "session-a",
      }),
      /integrity/i,
    );
  } finally {
    await fixture.cleanup();
  }
});

test("MCP registration exposes five workflow tools and functional create/list handlers", async () => {
  const stateDirectory = await mkdtemp(join(tmpdir(), "devspace-workflow-mcp-"));
  const previousStateDirectory = process.env.DEVSPACE_WORKFLOW_STATE_DIR;
  const previousCli = process.env.DEVSPACE_WORKFLOW_CLI;
  const chain = () => {
    const schema = {};
    for (const method of ["min", "max", "int", "positive", "optional", "describe"]) {
      schema[method] = () => schema;
    }
    return schema;
  };
  const z = {
    string: chain,
    boolean: chain,
    number: chain,
    enum: chain,
    array: chain,
  };
  const registered = new Map();
  try {
    process.env.DEVSPACE_WORKFLOW_STATE_DIR = stateDirectory;
    process.env.DEVSPACE_WORKFLOW_CLI = process.execPath;
    registerDevSpaceWorkflowTools({
      server: {},
      config: {},
      workspaces: {
        getWorkspace(workspaceId) {
          if (workspaceId === "ws-alpha") return { root: "C:\\Projects\\alpha" };
          if (workspaceId === "ws-beta") return { root: "C:\\Projects\\beta" };
          throw new Error("Unknown workspace");
        },
      },
      registerAppTool(_server, name, descriptor, handler) {
        registered.set(name, { descriptor, handler });
      },
      z,
    });
    assert.deepEqual([...registered.keys()], [
      "workflow_create",
      "workflow_list",
      "workflow_update",
      "workflow_run",
      "workflow_sync",
    ]);
    for (const registration of registered.values()) {
      assert.deepEqual(registration.descriptor._meta, {});
    }
    assert.ok(
      "userAuthorizedModelRun" in registered.get("workflow_run").descriptor.inputSchema,
      "workflow_run exposes an explicit user-authorization gate",
    );
    assert.match(
      registered.get("workflow_create").descriptor.description,
      /another chat, session, or project/i,
      "workflow_create advertises natural-language cross-session intent",
    );
    assert.match(
      registered.get("workflow_list").descriptor.description,
      /continue, resume, or take over/i,
      "workflow_list advertises resume/take-over discovery",
    );
    assert.match(
      registered.get("workflow_update").descriptor.description,
      /Natural-language continuation intent is enough/i,
      "workflow_update does not require tool-name vocabulary",
    );
    const createdResponse = await registered.get("workflow_create").handler({
      workspaceId: "ws-alpha",
      relatedWorkspaceIds: ["ws-beta"],
      sessionRef: "session-web-a",
      actor: "planner-a",
      scope: "cross_project",
      objective: "Coordinate two projects",
      acceptanceCriteria: ["Both roots can see the task"],
      requireReview: true,
      idempotencyKey: "mcp-create-001",
    });
    const created = JSON.parse(createdResponse.structuredContent.result);
    assert.equal(created.scope, "cross_project");
    assert.equal(created.schemaVersion, 2);
    assert.deepEqual(created.projectRefs, [
      projectRefFromPath("C:\\Projects\\alpha"),
      projectRefFromPath("C:\\Projects\\beta"),
    ]);
    assert.equal("projectRoots" in created, false);
    assert.equal(created.executionPolicy.model, undefined);
    assert.equal(created.executionPolicy.reasoningEffort, undefined);
    const listedResponse = await registered.get("workflow_list").handler({
      workspaceId: "ws-beta",
      sessionRef: "session-web-b",
    });
    const listed = JSON.parse(listedResponse.structuredContent.result);
    assert.equal(listed[0].taskId, created.taskId);
  } finally {
    if (previousStateDirectory === undefined) delete process.env.DEVSPACE_WORKFLOW_STATE_DIR;
    else process.env.DEVSPACE_WORKFLOW_STATE_DIR = previousStateDirectory;
    if (previousCli === undefined) delete process.env.DEVSPACE_WORKFLOW_CLI;
    else process.env.DEVSPACE_WORKFLOW_CLI = previousCli;
    await rm(stateDirectory, { recursive: true, force: true });
  }
});
