import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  appendFile,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SCOPES = new Set(["single_session", "same_project", "cross_project"]);
const EFFORTS = new Set(["none", "low", "medium", "high", "xhigh", "max"]);
const UNSUPPORTED_BEHAVIORS = new Set(["block", "explicit_degrade"]);
const UPDATE_ACTIONS = new Set([
  "claim",
  "handoff",
  "acknowledge",
  "request_review",
  "submit_review",
  "resume",
  "complete",
  "block",
]);
const REVIEW_VERDICTS = new Set(["approved", "changes_required", "blocked"]);
const AGENT_ID_PATTERN = /^agt_[a-f0-9]{8}$/;
const PROFILE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const GENESIS_HASH = "0".repeat(64);

function fail(message) {
  throw new Error(message);
}

function requiredString(value, label, maxLength = 8_000) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) fail(`${label} exceeds ${maxLength} characters.`);
  return normalized;
}

function optionalString(value, label, maxLength = 8_000) {
  if (value === undefined || value === null) return undefined;
  return requiredString(value, label, maxLength);
}

function stringArray(value, label, { min = 0, max = 50, itemMax = 2_000 } = {}) {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  if (value.length < min || value.length > max) {
    fail(`${label} must contain between ${min} and ${max} items.`);
  }
  return value.map((item, index) => requiredString(item, `${label}[${index}]`, itemMax));
}

function booleanValue(value, label, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") fail(`${label} must be a boolean.`);
  return value;
}

function normalizePath(path) {
  return resolve(requiredString(path, "workspace root", 1_024));
}

function pathKey(path) {
  const normalized = normalizePath(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function uniquePaths(paths) {
  const seen = new Set();
  const result = [];
  for (const path of paths) {
    const normalized = normalizePath(path);
    const key = pathKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function validateIdempotencyKey(value) {
  const key = requiredString(value, "idempotency key", 128);
  if (!IDEMPOTENCY_PATTERN.test(key)) {
    fail("Idempotency key must be 8-128 safe characters (letters, digits, dot, underscore, colon, or dash). ");
  }
  return key;
}

function validateExpectedRevision(value) {
  if (!Number.isInteger(value) || value < 1) fail("expectedRevision must be a positive integer.");
  return value;
}

function validatePolicy(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("Execution policy must be an object.");
  }
  const model = requiredString(input.model, "model", 80);
  if (!MODEL_PATTERN.test(model)) fail("Model contains unsupported characters.");
  const reasoningEffort = requiredString(input.reasoningEffort, "reasoning effort", 16);
  if (!EFFORTS.has(reasoningEffort)) {
    fail(`Reasoning effort must be one of: ${[...EFFORTS].join(", ")}.`);
  }
  const unsupportedBehavior = requiredString(
    input.unsupportedBehavior ?? "block",
    "unsupported behavior",
    32,
  );
  if (!UNSUPPORTED_BEHAVIORS.has(unsupportedBehavior)) {
    fail("Unsupported behavior must be block or explicit_degrade.");
  }
  return {
    model,
    reasoningEffort,
    deepResearch: booleanValue(input.deepResearch, "deepResearch", false),
    proMode: booleanValue(input.proMode, "proMode", false),
    unsupportedBehavior,
  };
}

export function resolveLocalAgentPolicy(input) {
  const requested = validatePolicy(input);
  const unsupported = [];
  if (requested.deepResearch) unsupported.push("Deep Research");
  if (requested.proMode) unsupported.push("Pro mode");
  if (unsupported.length > 0 && requested.unsupportedBehavior === "block") {
    fail(`The DevSpace local Agent adapter does not support ${unsupported.join(" or ")}.`);
  }
  return {
    requested,
    effective: {
      model: requested.model,
      reasoningEffort: requested.reasoningEffort,
      deepResearch: false,
      proMode: false,
      adapter: "devspace_local_agent",
    },
    warnings: unsupported.map(
      (capability) =>
        `${capability} was explicitly degraded because the DevSpace local Agent adapter cannot enable it.`,
    ),
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function internalIdempotencyKey(baseKey, phase) {
  return `internal:${sha256(`${baseKey}:${phase}`).slice(0, 40)}`;
}

function clone(value) {
  return structuredClone(value);
}

function defaultIdFactory(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function latestPendingHandoff(task) {
  return [...task.handoffs].reverse().find((handoff) => handoff.status === "pending");
}

function latestPendingReview(task) {
  return [...task.reviews].reverse().find((review) => review.status === "pending");
}

function taskIsVisible(task, workspaceRoot, sessionRef) {
  const workspaceAllowed = task.projectRoots.some((root) => pathKey(root) === pathKey(workspaceRoot));
  if (!workspaceAllowed) return false;
  if (task.scope === "single_session") return task.sessionRef === sessionRef;
  return true;
}

function assertTaskVisible(task, workspaceRoot, sessionRef) {
  const workspaceAllowed = task.projectRoots.some((root) => pathKey(root) === pathKey(workspaceRoot));
  if (!workspaceAllowed) fail("Current workspace is outside this task's project scope.");
  if (task.scope === "single_session" && task.sessionRef !== sessionRef) {
    fail("Current session is outside this task's single-session scope.");
  }
}

function assertOwner(task, actor) {
  if (task.currentOwner !== actor) fail("Only the current task owner may perform this action.");
}

function validateTaskId(value) {
  const taskId = requiredString(value, "taskId", 80);
  if (!/^tsk_[A-Za-z0-9]{8,64}$/.test(taskId)) fail("Invalid workflow task ID.");
  return taskId;
}

function validateRunId(value) {
  const runId = requiredString(value, "runId", 80);
  if (!/^run_[A-Za-z0-9]{8,64}$/.test(runId)) fail("Invalid workflow run ID.");
  return runId;
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function canonicalEvent(event) {
  const { hash: _hash, ...withoutHash } = event;
  return JSON.stringify(withoutHash);
}

function parseLedger(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const tasks = new Map();
  const idempotency = new Map();
  const hashes = [];
  let previousHash = GENESIS_HASH;
  for (let index = 0; index < lines.length; index += 1) {
    let event;
    try {
      event = JSON.parse(lines[index]);
    } catch {
      fail(`Workflow ledger integrity failure at line ${index + 1}: invalid JSON.`);
    }
    if (event.schemaVersion !== 1 || event.previousHash !== previousHash) {
      fail(`Workflow ledger integrity failure at line ${index + 1}: broken hash chain.`);
    }
    const expectedHash = sha256(canonicalEvent(event));
    if (event.hash !== expectedHash) {
      fail(`Workflow ledger integrity failure at line ${index + 1}: event hash mismatch.`);
    }
    if (!event.task || event.task.taskId !== event.taskId || event.task.revision !== event.revision) {
      fail(`Workflow ledger integrity failure at line ${index + 1}: invalid task snapshot.`);
    }
    const prior = tasks.get(event.taskId);
    const expectedRevision = prior ? prior.revision + 1 : 1;
    if (event.revision !== expectedRevision) {
      fail(`Workflow ledger integrity failure at line ${index + 1}: non-sequential revision.`);
    }
    if (idempotency.has(event.idempotencyKey)) {
      fail(`Workflow ledger integrity failure at line ${index + 1}: duplicate idempotency key.`);
    }
    tasks.set(event.taskId, event.task);
    idempotency.set(event.idempotencyKey, event.taskId);
    previousHash = event.hash;
    hashes.push(event.hash);
  }
  return { tasks, idempotency, hashes, eventCount: lines.length, lastHash: previousHash };
}

async function readState(paths) {
  await mkdir(paths.stateDirectory, { recursive: true });
  let ledgerText = "";
  try {
    ledgerText = await readFile(paths.ledger, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const state = parseLedger(ledgerText);
  try {
    const snapshot = JSON.parse(await readFile(paths.snapshot, "utf8"));
    if (!Number.isInteger(snapshot.eventCount) || snapshot.eventCount < 0) {
      fail("Workflow snapshot integrity failure: invalid event count.");
    }
    if (state.eventCount < snapshot.eventCount) {
      fail("Workflow ledger integrity failure: ledger was truncated.");
    }
    if (snapshot.eventCount > 0 && state.hashes[snapshot.eventCount - 1] !== snapshot.lastHash) {
      fail("Workflow ledger integrity failure: snapshot prefix does not match ledger.");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return state;
}

async function writeSnapshot(paths, state) {
  const temporary = `${paths.snapshot}.${randomUUID().replaceAll("-", "")}.tmp`;
  const document = {
    schemaVersion: 1,
    eventCount: state.eventCount,
    lastHash: state.lastHash,
    tasks: [...state.tasks.values()],
  };
  try {
    await writeFile(temporary, JSON.stringify(document, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, paths.snapshot);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

async function appendTaskEvent(paths, state, input) {
  const withoutHash = {
    schemaVersion: 1,
    eventId: input.eventId,
    taskId: input.task.taskId,
    action: input.action,
    actor: input.actor,
    idempotencyKey: input.idempotencyKey,
    revision: input.task.revision,
    at: input.at,
    previousHash: state.lastHash,
    task: input.task,
  };
  const event = { ...withoutHash, hash: sha256(JSON.stringify(withoutHash)) };
  await appendFile(paths.ledger, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
  state.tasks.set(input.task.taskId, input.task);
  state.idempotency.set(input.idempotencyKey, input.task.taskId);
  state.hashes.push(event.hash);
  state.eventCount += 1;
  state.lastHash = event.hash;
  await writeSnapshot(paths, state);
  return input.task;
}

async function withLock(paths, operation) {
  await mkdir(paths.stateDirectory, { recursive: true });
  const startedAt = Date.now();
  let handle;
  while (!handle) {
    try {
      handle = await open(paths.lock, "wx", 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const lockStat = await stat(paths.lock).catch(() => undefined);
      if (lockStat && Date.now() - lockStat.mtimeMs > 30_000) {
        await rm(paths.lock, { force: true });
        continue;
      }
      if (Date.now() - startedAt > 5_000) fail("Workflow state is busy; retry with the same idempotency key.");
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
    }
  }
  try {
    return await operation();
  } finally {
    await handle.close().catch(() => {});
    await rm(paths.lock, { force: true }).catch(() => {});
  }
}

function applyUpdate(task, input, helpers) {
  const next = clone(task);
  const actor = requiredString(input.actor, "actor", 128);
  switch (input.action) {
    case "claim": {
      if (task.status !== "open") fail("Only an open task can be claimed.");
      next.status = "in_progress";
      next.currentOwner = actor;
      break;
    }
    case "handoff": {
      if (task.status !== "in_progress" && task.status !== "changes_requested") {
        fail("Only active work can be handed off.");
      }
      assertOwner(task, actor);
      const toActor = requiredString(input.toActor, "handoff target", 128);
      if (toActor === actor) fail("Handoff target must differ from the current owner.");
      next.handoffs.push({
        handoffId: helpers.idFactory("hnd"),
        fromActor: actor,
        toActor,
        contextSnapshot: requiredString(input.contextSnapshot, "context snapshot", 20_000),
        deliverables: stringArray(input.deliverables, "deliverables", { min: 1, max: 50 }),
        openItems: stringArray(input.openItems, "open items", { min: 0, max: 50 }),
        requiredNextAction: requiredString(input.requiredNextAction, "required next action", 4_000),
        status: "pending",
        createdAt: helpers.now(),
      });
      next.status = "handoff_pending";
      break;
    }
    case "acknowledge": {
      if (task.status !== "handoff_pending") fail("Task has no pending handoff to acknowledge.");
      const handoff = latestPendingHandoff(next);
      if (!handoff || handoff.toActor !== actor) fail("Only the handoff target may acknowledge it.");
      handoff.status = "acknowledged";
      handoff.acknowledgedAt = helpers.now();
      next.currentOwner = actor;
      next.status = "in_progress";
      break;
    }
    case "request_review": {
      if (task.status !== "in_progress") fail("Only in-progress work can enter review.");
      assertOwner(task, actor);
      const reviewerActor = requiredString(input.reviewerActor, "reviewer actor", 128);
      if (reviewerActor === actor) fail("Reviewer must be different from producer.");
      next.reviews.push({
        reviewId: helpers.idFactory("rev"),
        producerActor: actor,
        reviewerActor,
        subjectRef: requiredString(input.subjectRef, "review subject", 2_000),
        subjectRevision: task.revision,
        criteria: stringArray(input.criteria, "review criteria", { min: 1, max: 50 }),
        status: "pending",
        createdAt: helpers.now(),
      });
      next.status = "review_pending";
      break;
    }
    case "submit_review": {
      if (task.status !== "review_pending") fail("Task has no pending review.");
      const review = latestPendingReview(next);
      if (!review || review.reviewerActor !== actor) fail("Only the assigned reviewer may submit this review.");
      const verdict = requiredString(input.verdict, "review verdict", 32);
      if (!REVIEW_VERDICTS.has(verdict)) {
        fail("Review verdict must be approved, changes_required, or blocked.");
      }
      review.verdict = verdict;
      review.findings = stringArray(input.findings, "review findings", { min: 1, max: 100 });
      review.status = "completed";
      review.completedAt = helpers.now();
      next.status =
        verdict === "approved"
          ? "ready_to_complete"
          : verdict === "changes_required"
            ? "changes_requested"
            : "blocked";
      break;
    }
    case "resume": {
      if (task.status !== "changes_requested") fail("Only changes-requested work can resume.");
      assertOwner(task, actor);
      next.status = "in_progress";
      break;
    }
    case "complete": {
      assertOwner(task, actor);
      if (task.requireReview) {
        if (task.status !== "ready_to_complete") fail("Task requires an approved review before completion.");
      } else if (task.status !== "in_progress") {
        fail("Only in-progress work can be completed.");
      }
      next.status = "completed";
      next.completedAt = helpers.now();
      break;
    }
    case "block": {
      if (["completed", "blocked"].includes(task.status)) fail("Task is already terminal.");
      if (task.currentOwner && task.currentOwner !== actor) assertOwner(task, actor);
      next.status = "blocked";
      next.blockedReason = requiredString(input.reason, "blocked reason", 4_000);
      break;
    }
    default:
      fail(`Unsupported workflow action: ${input.action}`);
  }
  return next;
}

function buildAgentPrompt(task, role, additionalPrompt) {
  const lines = [
    `DevSpace workflow task: ${task.taskId}`,
    `Role: ${role}`,
    `Task revision: ${task.revision}`,
    `Objective: ${task.objective}`,
    "Acceptance criteria:",
    ...task.acceptanceCriteria.map((criterion) => `- ${criterion}`),
  ];
  const handoff = task.handoffs.at(-1);
  if (handoff) {
    lines.push(
      "Latest handoff:",
      `Context: ${handoff.contextSnapshot}`,
      `Deliverables: ${handoff.deliverables.join(", ")}`,
      `Open items: ${handoff.openItems.join(", ") || "none"}`,
      `Required next action: ${handoff.requiredNextAction}`,
    );
  }
  const review = latestPendingReview(task);
  if (role === "reviewer" && review) {
    lines.push(
      `Review subject: ${review.subjectRef}`,
      `Fixed producer revision: ${review.subjectRevision}`,
      "Review criteria:",
      ...review.criteria.map((criterion) => `- ${criterion}`),
    );
  }
  if (additionalPrompt) lines.push("Additional instruction:", additionalPrompt);
  const prompt = lines.join("\n");
  if (prompt.length > 20_000) fail("Generated Agent prompt exceeds 20,000 characters.");
  return prompt;
}

export function createWorkflowController(options = {}) {
  const stateDirectory = resolve(
    options.stateDirectory ?? process.env.DEVSPACE_WORKFLOW_STATE_DIR ?? join(process.cwd(), ".devspace-workflow"),
  );
  const paths = {
    stateDirectory,
    ledger: join(stateDirectory, "workflow-events.jsonl"),
    snapshot: join(stateDirectory, "workflow-state.json"),
    lock: join(stateDirectory, "workflow.lock"),
  };
  const idFactory = options.idFactory ?? defaultIdFactory;
  const now = options.now ?? (() => new Date().toISOString());
  const agentAdapter = options.agentAdapter;

  async function findIdempotentResult(state, key, workspaceRoot, sessionRef) {
    const taskId = state.idempotency.get(key);
    if (!taskId) return undefined;
    const task = state.tasks.get(taskId);
    if (!task) fail("Workflow ledger integrity failure: idempotency target is missing.");
    assertTaskVisible(task, workspaceRoot, sessionRef);
    return clone(task);
  }

  async function commitMutation(input, mutator) {
    const workspaceRoot = normalizePath(input.workspaceRoot);
    const sessionRef = requiredString(input.sessionRef, "sessionRef", 256);
    const actor = requiredString(input.actor, "actor", 128);
    const taskId = validateTaskId(input.taskId);
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    const expectedRevision = validateExpectedRevision(input.expectedRevision);
    return withLock(paths, async () => {
      const state = await readState(paths);
      const duplicate = await findIdempotentResult(state, idempotencyKey, workspaceRoot, sessionRef);
      if (duplicate) return duplicate;
      const task = state.tasks.get(taskId);
      if (!task) fail(`Unknown workflow task: ${taskId}`);
      assertTaskVisible(task, workspaceRoot, sessionRef);
      if (task.revision !== expectedRevision) {
        fail(`Stale revision: expected ${expectedRevision}, current revision is ${task.revision}.`);
      }
      const next = await mutator(clone(task), { actor, idFactory, now });
      next.revision = task.revision + 1;
      next.updatedAt = now();
      return clone(
        await appendTaskEvent(paths, state, {
          eventId: idFactory("evt"),
          task: next,
          action: input.action,
          actor,
          idempotencyKey,
          at: now(),
        }),
      );
    });
  }

  async function commitInternalMutation(input, mutator) {
    const workspaceRoot = normalizePath(input.workspaceRoot);
    const sessionRef = requiredString(input.sessionRef, "sessionRef", 256);
    const actor = requiredString(input.actor, "actor", 128);
    const taskId = validateTaskId(input.taskId);
    const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
    return withLock(paths, async () => {
      const state = await readState(paths);
      const duplicate = await findIdempotentResult(state, idempotencyKey, workspaceRoot, sessionRef);
      if (duplicate) return duplicate;
      const task = state.tasks.get(taskId);
      if (!task) fail(`Unknown workflow task: ${taskId}`);
      assertTaskVisible(task, workspaceRoot, sessionRef);
      const next = await mutator(clone(task), { actor, idFactory, now });
      next.revision = task.revision + 1;
      next.updatedAt = now();
      return clone(
        await appendTaskEvent(paths, state, {
          eventId: idFactory("evt"),
          task: next,
          action: input.action,
          actor,
          idempotencyKey,
          at: now(),
        }),
      );
    });
  }

  const controller = {
    agentAdapter,

    async createTask(input) {
      const workspaceRoot = normalizePath(input.workspaceRoot);
      const sessionRef = requiredString(input.sessionRef, "sessionRef", 256);
      const actor = requiredString(input.actor, "actor", 128);
      const scope = requiredString(input.scope, "scope", 32);
      if (!SCOPES.has(scope)) fail(`Scope must be one of: ${[...SCOPES].join(", ")}.`);
      const relatedRoots = uniquePaths(input.relatedWorkspaceRoots ?? []);
      if (scope !== "cross_project" && relatedRoots.length > 0) {
        fail("Related workspace roots are allowed only for cross_project scope.");
      }
      const projectRoots = uniquePaths([workspaceRoot, ...relatedRoots]);
      if (scope === "cross_project" && projectRoots.length < 2) {
        fail("cross_project scope requires at least two distinct workspace roots.");
      }
      const idempotencyKey = validateIdempotencyKey(input.idempotencyKey);
      const objective = requiredString(input.objective, "objective", 8_000);
      const acceptanceCriteria = stringArray(input.acceptanceCriteria, "acceptance criteria", {
        min: 1,
        max: 50,
      });
      const policy = validatePolicy(input.policy);
      return withLock(paths, async () => {
        const state = await readState(paths);
        const duplicate = await findIdempotentResult(state, idempotencyKey, workspaceRoot, sessionRef);
        if (duplicate) return duplicate;
        const createdAt = now();
        const task = {
          schemaVersion: 1,
          taskId: idFactory("tsk"),
          scope,
          projectRoots,
          sessionRef,
          objective,
          acceptanceCriteria,
          requireReview: booleanValue(input.requireReview, "requireReview", true),
          executionPolicy: policy,
          status: "open",
          currentOwner: null,
          revision: 1,
          createdBy: actor,
          createdAt,
          updatedAt: createdAt,
          handoffs: [],
          reviews: [],
          runs: [],
        };
        return clone(
          await appendTaskEvent(paths, state, {
            eventId: idFactory("evt"),
            task,
            action: "create",
            actor,
            idempotencyKey,
            at: now(),
          }),
        );
      });
    },

    async getTask(input) {
      const state = await readState(paths);
      const task = state.tasks.get(validateTaskId(input.taskId));
      if (!task) fail(`Unknown workflow task: ${input.taskId}`);
      assertTaskVisible(
        task,
        normalizePath(input.workspaceRoot),
        requiredString(input.sessionRef, "sessionRef", 256),
      );
      return clone(task);
    },

    async listTasks(input) {
      const state = await readState(paths);
      const workspaceRoot = normalizePath(input.workspaceRoot);
      const sessionRef = requiredString(input.sessionRef, "sessionRef", 256);
      return [...state.tasks.values()]
        .filter((task) => taskIsVisible(task, workspaceRoot, sessionRef))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(clone);
    },

    async updateTask(input) {
      const action = requiredString(input.action, "action", 32);
      if (!UPDATE_ACTIONS.has(action)) fail(`Unsupported workflow action: ${action}`);
      return commitMutation({ ...input, action }, (task, helpers) =>
        applyUpdate(task, { ...input, action }, helpers),
      );
    },

    async runTask(input) {
      if (!agentAdapter?.start) fail("DevSpace Agent adapter is not configured.");
      const role = requiredString(input.role, "run role", 16);
      if (role !== "worker" && role !== "reviewer") fail("Run role must be worker or reviewer.");
      const profile = requiredString(
        input.profile ?? (role === "reviewer" ? "codex-qa-tester" : "codex-worker"),
        "Agent profile",
        64,
      );
      if (!PROFILE_PATTERN.test(profile)) fail("Agent profile contains unsupported characters.");
      const additionalPrompt = optionalString(input.prompt, "additional prompt", 8_000);
      let preparedRun;
      const prepared = await commitMutation(
        { ...input, action: "run_start" },
        (task, helpers) => {
          if (role === "worker") {
            if (task.status !== "in_progress") fail("Worker Agent requires an in-progress task.");
            assertOwner(task, helpers.actor);
          } else {
            if (task.status !== "review_pending") fail("Reviewer Agent requires a pending review.");
            const review = latestPendingReview(task);
            if (!review || review.reviewerActor !== helpers.actor) {
              fail("Only the assigned independent reviewer may start this review run.");
            }
            if (review.producerActor === helpers.actor) fail("Reviewer must be different from producer.");
          }
          const requestedPolicy = validatePolicy({
            ...task.executionPolicy,
            ...(input.policyOverride ?? {}),
          });
          const policyResolution = resolveLocalAgentPolicy(requestedPolicy);
          preparedRun = {
            runId: helpers.idFactory("run"),
            role,
            actor: helpers.actor,
            profile,
            status: "starting",
            requestedPolicy: policyResolution.requested,
            effectivePolicy: policyResolution.effective,
            warnings: policyResolution.warnings,
            startedAt: helpers.now(),
          };
          task.runs.push(preparedRun);
          return task;
        },
      );
      if (!preparedRun) {
        return prepared;
      }
      const prompt = buildAgentPrompt(prepared, role, additionalPrompt);
      let adapterResult;
      try {
        adapterResult = await agentAdapter.start({
          workspaceRoot: normalizePath(input.workspaceRoot),
          workspaceId: optionalString(input.workspaceId, "workspaceId", 256),
          profile,
          model: preparedRun.effectivePolicy.model,
          reasoningEffort: preparedRun.effectivePolicy.reasoningEffort,
          prompt,
        });
        if (!AGENT_ID_PATTERN.test(adapterResult?.agentId ?? "")) {
          fail("DevSpace Agent adapter returned an invalid Agent ID.");
        }
      } catch (error) {
        await commitInternalMutation(
          {
            ...input,
            action: "run_failed",
            idempotencyKey: internalIdempotencyKey(
              validateIdempotencyKey(input.idempotencyKey),
              "failed",
            ),
          },
          (task) => {
            const run = task.runs.find((candidate) => candidate.runId === preparedRun.runId);
            if (run) {
              run.status = "error";
              run.error = String(error?.message ?? error).slice(0, 8_000);
              run.endedAt = now();
            }
            return task;
          },
        );
        throw error;
      }
      return commitInternalMutation(
        {
          ...input,
          action: "run_started",
          idempotencyKey: internalIdempotencyKey(
            validateIdempotencyKey(input.idempotencyKey),
            "started",
          ),
        },
        (task) => {
          const run = task.runs.find((candidate) => candidate.runId === preparedRun.runId);
          if (!run) fail("Prepared workflow run is missing.");
          run.agentId = adapterResult.agentId;
          run.status = "running";
          return task;
        },
      );
    },

    async syncTask(input) {
      if (!agentAdapter?.get) fail("DevSpace Agent adapter is not configured.");
      const task = await controller.getTask(input);
      const runId = validateRunId(input.runId);
      const run = task.runs.find((candidate) => candidate.runId === runId);
      if (!run) fail(`Unknown workflow run: ${runId}`);
      const actor = requiredString(input.actor, "actor", 128);
      if (run.actor !== actor) fail("Only the run owner may sync this Agent run.");
      if (!run.agentId) fail("Workflow run has no Agent ID yet.");
      const record = await agentAdapter.get(run.agentId);
      return commitMutation(
        { ...input, action: "run_sync" },
        (current) => {
          const currentRun = current.runs.find((candidate) => candidate.runId === runId);
          if (!currentRun) fail(`Unknown workflow run: ${runId}`);
          currentRun.status = requiredString(record.status, "Agent status", 32);
          currentRun.latestResponse = optionalString(
            record.latestResponse,
            "Agent response",
            100_000,
          );
          currentRun.error = optionalString(record.error, "Agent error", 20_000);
          currentRun.syncedAt = now();
          if (["idle", "error", "stopped"].includes(currentRun.status)) currentRun.endedAt = now();
          return current;
        },
      );
    },
  };
  return controller;
}

function collectChild(child, timeoutMs = 15_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    let stdout = "";
    let stderr = "";
    const append = (current, chunk) => (current + chunk.toString("utf8")).slice(-64_000);
    child.stdout?.on("data", (chunk) => {
      stdout = append(stdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = append(stderr, chunk);
    });
    const timeout = setTimeout(() => child.kill(), timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        rejectPromise(new Error(`DevSpace Agent command failed (${code}): ${(stderr || stdout).trim()}`));
        return;
      }
      resolvePromise({ stdout, stderr });
    });
  });
}

export function createDevSpaceAgentAdapter(options = {}) {
  const devSpaceCli = resolve(
    options.devSpaceCli ?? process.env.DEVSPACE_WORKFLOW_CLI ?? fail("DEVSPACE_WORKFLOW_CLI is required."),
  );
  const nodePath = resolve(options.nodePath ?? process.execPath);
  const inheritedEnv = options.env ?? process.env;
  let storeModulesPromise;

  async function storeModules() {
    if (!storeModulesPromise) {
      const distDirectory = dirname(devSpaceCli);
      storeModulesPromise = Promise.all([
        import(pathToFileURL(join(distDirectory, "config.js")).href),
        import(pathToFileURL(join(distDirectory, "local-agent-store.js")).href),
      ]);
    }
    return storeModulesPromise;
  }

  return {
    async start(input) {
      const profile = requiredString(input.profile, "Agent profile", 64);
      if (!PROFILE_PATTERN.test(profile)) fail("Agent profile contains unsupported characters.");
      const model = requiredString(input.model, "model", 80);
      if (!MODEL_PATTERN.test(model)) fail("Model contains unsupported characters.");
      const effort = requiredString(input.reasoningEffort, "reasoning effort", 16);
      if (!EFFORTS.has(effort)) fail("Unsupported reasoning effort.");
      const prompt = requiredString(input.prompt, "Agent prompt", 20_000);
      const child = spawn(
        nodePath,
        [devSpaceCli, "agents", "run", profile, "--model", model, "--thinking", effort, prompt],
        {
          cwd: normalizePath(input.workspaceRoot),
          env: {
            ...inheritedEnv,
            DEVSPACE_WORKSPACE_ID: input.workspaceId ?? "",
          },
          shell: false,
          windowsHide: process.platform === "win32",
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const result = await collectChild(child);
      const agentId = result.stdout.match(/agt_[a-f0-9]{8}/)?.[0];
      if (!agentId) fail(`DevSpace Agent command returned no Agent ID: ${result.stdout.trim()}`);
      return { agentId };
    },

    async get(agentId) {
      if (!AGENT_ID_PATTERN.test(agentId)) fail("Invalid DevSpace Agent ID.");
      const [{ loadConfig }, { createLocalAgentStore }] = await storeModules();
      const store = createLocalAgentStore(loadConfig());
      try {
        const record = store.get(agentId);
        if (!record) fail(`Unknown DevSpace Agent ID: ${agentId}`);
        return {
          agentId,
          status: record.status,
          latestResponse: record.latestResponse,
          error: record.error,
        };
      } finally {
        store.close();
      }
    },
  };
}

function toolResult(value) {
  const result = JSON.stringify(value, null, 2);
  return {
    content: [{ type: "text", text: result }],
    structuredContent: { result },
  };
}

export function registerDevSpaceWorkflowTools({
  server,
  config,
  workspaces,
  registerAppTool,
  z,
}) {
  if (!server || !config || !workspaces || !registerAppTool || !z) {
    fail("DevSpace workflow tool registration is missing dependencies.");
  }
  const stateDirectory = requiredString(
    process.env.DEVSPACE_WORKFLOW_STATE_DIR,
    "DEVSPACE_WORKFLOW_STATE_DIR",
    1_024,
  );
  const controller = createWorkflowController({
    stateDirectory,
    agentAdapter: createDevSpaceAgentAdapter(),
  });
  const outputSchema = { result: z.string() };
  const modelOnlyMeta = { _meta: {} };
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const mutating = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const sessionField = z.string().min(1).max(256).describe("Caller-defined stable session or conversation key.");
  const actorField = z.string().min(1).max(128).describe("Stable actor name for this Web session or Agent.");
  const idempotencyField = z.string().min(8).max(128).describe("Unique retry key; reuse it only for the same operation.");
  const policyFields = {
    model: z.string().min(1).max(80).describe("Requested model, for example gpt-5.6-sol or gpt-5.6-terra."),
    reasoningEffort: z.enum(["none", "low", "medium", "high", "xhigh", "max"]),
    deepResearch: z.boolean().optional().describe("Request Deep Research for a capable future adapter."),
    proMode: z.boolean().optional().describe("Request API reasoning.mode=pro for a capable future adapter."),
    unsupportedBehavior: z.enum(["block", "explicit_degrade"]).optional(),
  };

  registerAppTool(server, "workflow_create", {
    title: "Create workflow task",
    description: "Create a durable DevSpace task for single-session, same-project, or cross-project handoff. Records requested model, reasoning effort, Deep Research, and Pro mode.",
    inputSchema: {
      workspaceId: z.string().min(1),
      relatedWorkspaceIds: z.array(z.string().min(1)).max(20).optional(),
      sessionRef: sessionField,
      actor: actorField,
      scope: z.enum(["single_session", "same_project", "cross_project"]),
      objective: z.string().min(1).max(8_000),
      acceptanceCriteria: z.array(z.string().min(1).max(2_000)).min(1).max(50),
      requireReview: z.boolean().optional(),
      ...policyFields,
      idempotencyKey: idempotencyField,
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: mutating,
  }, async (input) => {
    const workspace = workspaces.getWorkspace(input.workspaceId);
    const relatedWorkspaceRoots = (input.relatedWorkspaceIds ?? []).map(
      (workspaceId) => workspaces.getWorkspace(workspaceId).root,
    );
    return toolResult(await controller.createTask({
      ...input,
      workspaceRoot: workspace.root,
      relatedWorkspaceRoots,
      policy: input,
    }));
  });

  registerAppTool(server, "workflow_list", {
    title: "List workflow tasks",
    description: "List tasks visible to the current workspace/session, or get one task by ID.",
    inputSchema: {
      workspaceId: z.string().min(1),
      sessionRef: sessionField,
      taskId: z.string().min(1).max(80).optional(),
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: readOnly,
  }, async (input) => {
    const workspace = workspaces.getWorkspace(input.workspaceId);
    const request = { ...input, workspaceRoot: workspace.root };
    return toolResult(input.taskId ? await controller.getTask(request) : await controller.listTasks(request));
  });

  registerAppTool(server, "workflow_update", {
    title: "Update workflow task",
    description: "Claim, hand off, acknowledge, review, resume, complete, or block a task with revision-based concurrency control.",
    inputSchema: {
      workspaceId: z.string().min(1),
      sessionRef: sessionField,
      actor: actorField,
      taskId: z.string().min(1).max(80),
      action: z.enum(["claim", "handoff", "acknowledge", "request_review", "submit_review", "resume", "complete", "block"]),
      expectedRevision: z.number().int().positive(),
      idempotencyKey: idempotencyField,
      toActor: z.string().min(1).max(128).optional(),
      contextSnapshot: z.string().min(1).max(20_000).optional(),
      deliverables: z.array(z.string().min(1).max(2_000)).max(50).optional(),
      openItems: z.array(z.string().min(1).max(2_000)).max(50).optional(),
      requiredNextAction: z.string().min(1).max(4_000).optional(),
      reviewerActor: z.string().min(1).max(128).optional(),
      subjectRef: z.string().min(1).max(2_000).optional(),
      criteria: z.array(z.string().min(1).max(2_000)).max(50).optional(),
      verdict: z.enum(["approved", "changes_required", "blocked"]).optional(),
      findings: z.array(z.string().min(1).max(2_000)).max(100).optional(),
      reason: z.string().min(1).max(4_000).optional(),
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: mutating,
  }, async (input) => {
    const workspace = workspaces.getWorkspace(input.workspaceId);
    return toolResult(await controller.updateTask({ ...input, workspaceRoot: workspace.root }));
  });

  registerAppTool(server, "workflow_run", {
    title: "Run workflow Agent",
    description: "Start a DevSpace worker or independent reviewer using this run's selected model and reasoning effort. Unsupported Deep Research/Pro requests are blocked or explicitly degraded.",
    inputSchema: {
      workspaceId: z.string().min(1),
      sessionRef: sessionField,
      actor: actorField,
      taskId: z.string().min(1).max(80),
      role: z.enum(["worker", "reviewer"]),
      profile: z.string().min(1).max(64).optional(),
      prompt: z.string().min(1).max(8_000).optional(),
      expectedRevision: z.number().int().positive(),
      idempotencyKey: idempotencyField,
      model: policyFields.model.optional(),
      reasoningEffort: policyFields.reasoningEffort.optional(),
      deepResearch: policyFields.deepResearch,
      proMode: policyFields.proMode,
      unsupportedBehavior: policyFields.unsupportedBehavior,
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: mutating,
  }, async (input) => {
    const workspace = workspaces.getWorkspace(input.workspaceId);
    const policyOverride = Object.fromEntries(
      ["model", "reasoningEffort", "deepResearch", "proMode", "unsupportedBehavior"]
        .filter((key) => input[key] !== undefined)
        .map((key) => [key, input[key]]),
    );
    return toolResult(await controller.runTask({
      ...input,
      workspaceRoot: workspace.root,
      policyOverride,
    }));
  });

  registerAppTool(server, "workflow_sync", {
    title: "Sync workflow Agent",
    description: "Read a DevSpace Agent session and append its current status/output to the workflow ledger.",
    inputSchema: {
      workspaceId: z.string().min(1),
      sessionRef: sessionField,
      actor: actorField,
      taskId: z.string().min(1).max(80),
      runId: z.string().min(1).max(80),
      expectedRevision: z.number().int().positive(),
      idempotencyKey: idempotencyField,
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: mutating,
  }, async (input) => {
    const workspace = workspaces.getWorkspace(input.workspaceId);
    return toolResult(await controller.syncTask({ ...input, workspaceRoot: workspace.root }));
  });
}
