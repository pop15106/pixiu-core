import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const coreModule = process.env.SESSION_WORKFLOW_CORE_MODULE
  ? await import(pathToFileURL(resolve(process.env.SESSION_WORKFLOW_CORE_MODULE)).href)
  : await import(new URL("../../external/session-workflow/packages/session-workflow/core/index.mjs", import.meta.url).href);
const projectResolverModule = process.env.SESSION_WORKFLOW_DEVSPACE_PROJECT_RESOLVER_MODULE
  ? await import(pathToFileURL(resolve(process.env.SESSION_WORKFLOW_DEVSPACE_PROJECT_RESOLVER_MODULE)).href)
  : await import(new URL("./DevSpace.ProjectResolver.mjs", import.meta.url).href);

const {
  assertTaskExecutionAccess,
  createWorkflowController: createCoreWorkflowController,
  fail,
  normalizePath,
  optionalString,
  projectRefFromPath,
  redactSensitiveCredentials,
  requiredString,
  taskAllowsImplicitSelection,
  taskExecutionProjectRef,
} = coreModule;
const { createDevSpaceProjectResolver } = projectResolverModule;

const EFFORTS = new Set(["none", "low", "medium", "high", "xhigh", "max"]);
const AGENT_ID_PATTERN = /^agt_[a-f0-9]{8}$/;
const PROFILE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const RUN_ID_PATTERN = /^run_[A-Za-z0-9]{8,64}$/;

function booleanPolicyValue(value, label, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") fail(`${label} must be a boolean.`);
  return value;
}

function validateIdempotencyKey(value) {
  const key = requiredString(value, "idempotency key", 128);
  if (!IDEMPOTENCY_PATTERN.test(key)) {
    fail("Idempotency key must be 8-128 safe characters (letters, digits, dot, underscore, colon, or dash). ");
  }
  return key;
}

function validateRunId(value) {
  const runId = requiredString(value, "runId", 80);
  if (!RUN_ID_PATTERN.test(runId)) fail("Invalid workflow run ID.");
  return runId;
}

function validateStaleAfterSeconds(value) {
  if (!Number.isInteger(value) || value < 60 || value > 86_400) {
    fail("staleAfterSeconds must be an integer between 60 and 86400 seconds.");
  }
  return value;
}

function internalIdempotencyKey(baseKey, phase) {
  return `internal:${createHash("sha256").update(`${baseKey}:${phase}`).digest("hex").slice(0, 40)}`;
}

export function resolveLocalAgentPolicy(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("Execution policy must be an object.");
  }
  const model = optionalString(input.model, "model", 80);
  if (model && !MODEL_PATTERN.test(model)) fail("Model contains unsupported characters.");
  const reasoningEffort = optionalString(input.reasoningEffort, "reasoning effort", 16);
  if (reasoningEffort && !EFFORTS.has(reasoningEffort)) {
    fail(`Reasoning effort must be one of: ${[...EFFORTS].join(", ")}.`);
  }
  const unsupportedBehavior = requiredString(
    input.unsupportedBehavior ?? "block",
    "unsupported behavior",
    32,
  );
  if (unsupportedBehavior !== "block" && unsupportedBehavior !== "explicit_degrade") {
    fail("Unsupported behavior must be block or explicit_degrade.");
  }
  const requested = {
    ...(model ? { model } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
    deepResearch: booleanPolicyValue(input.deepResearch, "deepResearch", false),
    proMode: booleanPolicyValue(input.proMode, "proMode", false),
    unsupportedBehavior,
  };
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

function latestPendingReview(task) {
  return [...task.reviews].reverse().find((review) => review.status === "pending");
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
      const model = optionalString(input.model, "model", 80);
      if (model && !MODEL_PATTERN.test(model)) fail("Model contains unsupported characters.");
      const effort = optionalString(input.reasoningEffort, "reasoning effort", 16);
      if (effort && !EFFORTS.has(effort)) fail("Unsupported reasoning effort.");
      const prompt = requiredString(input.prompt, "Agent prompt", 20_000);
      const commandArgs = [devSpaceCli, "agents", "run", profile];
      if (model) commandArgs.push("--model", model);
      if (effort) commandArgs.push("--thinking", effort);
      commandArgs.push(prompt);
      const child = spawn(
        nodePath,
        commandArgs,
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

function createDevSpaceExecutionController(coreController, agentAdapter) {
  if (!coreController?.extensions?.mutateTask || !coreController?.extensions?.mutateLatestTask) {
    fail("Session Workflow Core does not expose the required extension mutation seam.");
  }

  return {
    ...coreController,
    agentAdapter,

    async takeoverTask(input) {
      const actor = requiredString(input.actor, "actor", 128);
      const expectedOwner = requiredString(input.expectedOwner, "expected owner", 128);
      if (actor === expectedOwner) fail("Recovery actor must differ from the stale owner.");
      const staleAfterSeconds = validateStaleAfterSeconds(input.staleAfterSeconds);
      if (input.ownerHeartbeatMissing !== true) {
        fail("Stale-owner takeover requires confirmed missing owner heartbeat.");
      }
      if (input.noActiveRunnerObserved !== true) {
        fail("Stale-owner takeover requires confirmation that no active task runner was observed.");
      }
      if (input.executionWatchMissingOrStaleObserved !== true) {
        fail("Stale-owner takeover requires a missing or stale Execution Watch observation.");
      }
      const reason = requiredString(input.reason, "takeover reason", 4_000);
      const requiredNextAction = requiredString(input.requiredNextAction, "required next action", 4_000);

      return coreController.extensions.mutateTask(
        { ...input, action: "stale_owner_takeover" },
        (task, helpers) => {
          if (!["in_progress", "changes_requested", "ready_to_complete"].includes(task.status)) {
            fail("Only owner-held active work can be recovered by stale-owner takeover.");
          }
          if (!task.currentOwner) fail("Task has no current owner to recover.");
          if (task.currentOwner !== expectedOwner) {
            fail(`Expected owner mismatch: current owner is ${task.currentOwner}.`);
          }
          if (task.currentOwner === helpers.actor) {
            fail("Recovery actor already owns this task.");
          }

          const previousUpdatedAtMs = Date.parse(task.updatedAt);
          const takeoverAt = helpers.now();
          const takeoverAtMs = Date.parse(takeoverAt);
          if (!Number.isFinite(previousUpdatedAtMs) || !Number.isFinite(takeoverAtMs)) {
            fail("Workflow task timestamps are invalid for stale-owner recovery.");
          }
          const staleAgeSeconds = Math.floor((takeoverAtMs - previousUpdatedAtMs) / 1_000);
          if (staleAgeSeconds < staleAfterSeconds) {
            fail(
              `Task owner is not stale enough for takeover: observed ${staleAgeSeconds}s, required ${staleAfterSeconds}s.`,
            );
          }

          const previousOwnerEpoch = Number.isInteger(task.ownerEpoch) && task.ownerEpoch >= 0
            ? task.ownerEpoch
            : 0;
          const ownerEpoch = previousOwnerEpoch + 1;
          const recovery = {
            recoveryId: helpers.idFactory("rcv"),
            type: "STALE_OWNER_TAKEOVER",
            fromActor: expectedOwner,
            toActor: helpers.actor,
            previousRevision: task.revision,
            previousOwnerEpoch,
            ownerEpoch,
            previousUpdatedAt: task.updatedAt,
            staleAgeSeconds,
            staleAfterSeconds,
            ownerHeartbeatMissing: true,
            noActiveRunnerObserved: true,
            executionWatchMissingOrStaleObserved: true,
            reason,
            requiredNextAction,
            createdAt: takeoverAt,
          };
          task.currentOwner = helpers.actor;
          task.ownerEpoch = ownerEpoch;
          task.recoveries = [...(Array.isArray(task.recoveries) ? task.recoveries : []), recovery];
          return task;
        },
      );
    },

    async runTask(input) {
      if (input.userAuthorizedModelRun !== true) {
        fail("workflow_run requires explicit user authorization to use an Agent/model in the current conversation.");
      }
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
      const prepared = await coreController.extensions.mutateTask(
        { ...input, action: "run_start" },
        (task, helpers) => {
          if (role === "worker") {
            if (task.status !== "in_progress") fail("Worker Agent requires an in-progress task.");
            if (task.currentOwner !== helpers.actor) {
              fail("Only the current task owner may perform this action.");
            }
          } else {
            if (task.status !== "review_pending") fail("Reviewer Agent requires a pending review.");
            const review = latestPendingReview(task);
            if (!review || review.reviewerActor !== helpers.actor) {
              fail("Only the assigned independent reviewer may start this review run.");
            }
            if (review.producerActor === helpers.actor) fail("Reviewer must be different from producer.");
          }
          const policyResolution = resolveLocalAgentPolicy({
            ...task.executionPolicy,
            ...(input.policyOverride ?? {}),
          });
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
      if (!preparedRun) return prepared;

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
        await coreController.extensions.mutateLatestTask(
          {
            ...input,
            action: "run_failed",
            idempotencyKey: internalIdempotencyKey(
              validateIdempotencyKey(input.idempotencyKey),
              "failed",
            ),
          },
          (task, helpers) => {
            const run = task.runs.find((candidate) => candidate.runId === preparedRun.runId);
            if (run) {
              run.status = "error";
              run.error = redactSensitiveCredentials(
                String(error?.message ?? error),
                "Agent error",
                8_000,
              );
              run.endedAt = helpers.now();
            }
            return task;
          },
        );
        throw error;
      }

      return coreController.extensions.mutateLatestTask(
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
      const task = await coreController.getTask(input);
      const runId = validateRunId(input.runId);
      const run = task.runs.find((candidate) => candidate.runId === runId);
      if (!run) fail(`Unknown workflow run: ${runId}`);
      const actor = requiredString(input.actor, "actor", 128);
      if (run.actor !== actor) fail("Only the run owner may sync this Agent run.");
      if (!run.agentId) fail("Workflow run has no Agent ID yet.");
      const record = await agentAdapter.get(run.agentId);
      return coreController.extensions.mutateTask(
        { ...input, action: "run_sync" },
        (current, helpers) => {
          const currentRun = current.runs.find((candidate) => candidate.runId === runId);
          if (!currentRun) fail(`Unknown workflow run: ${runId}`);
          currentRun.status = requiredString(record.status, "Agent status", 32);
          currentRun.latestResponse = redactSensitiveCredentials(
            record.latestResponse,
            "Agent response",
            100_000,
          );
          currentRun.error = redactSensitiveCredentials(record.error, "Agent error", 20_000);
          currentRun.syncedAt = helpers.now();
          if (["idle", "error", "stopped"].includes(currentRun.status)) {
            currentRun.endedAt = helpers.now();
          }
          return current;
        },
      );
    },
  };
}

export function createWorkflowController(options = {}) {
  const {
    agentAdapter,
    stateDirectory = process.env.DEVSPACE_WORKFLOW_STATE_DIR ?? join(process.cwd(), ".devspace-workflow"),
    ...coreOptions
  } = options;
  const coreController = createCoreWorkflowController({
    ...coreOptions,
    stateDirectory,
  });
  return createDevSpaceExecutionController(coreController, agentAdapter);
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
  const projectResolver = createDevSpaceProjectResolver(workspaces, {
    projectRefFromPath,
    allowedRoots: Array.isArray(config.allowedRoots) ? config.allowedRoots : [],
  });
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
  const projectAccessField = z.enum(["execution_only", "related_explicit"]).optional().describe(
    "Defaults to execution_only. Use related_explicit only when the current user message explicitly names a cross-project task.",
  );
  const taskRoleField = z.enum([
    "execution",
    "reviewer_watch",
    "status_pulse",
    "recovery_supervisor",
    "governance",
  ]).optional();
  const policyFields = {
    model: z.string().min(1).max(80).optional().describe("Optional model override. Set it only when the user explicitly chooses a model."),
    reasoningEffort: z.enum(["none", "low", "medium", "high", "xhigh", "max"]).optional().describe("Optional reasoning override. Set it only when the user explicitly chooses a reasoning level."),
    deepResearch: z.boolean().optional().describe("Request Deep Research for a capable future adapter."),
    proMode: z.boolean().optional().describe("Request API reasoning.mode=pro for a capable future adapter."),
    unsupportedBehavior: z.enum(["block", "explicit_degrade"]).optional(),
  };

  registerAppTool(server, "project_resolve", {
    title: "Resolve project context",
    description: "Resolve an explicitly named project when the user is outside a project workspace. Returns one canonical allowed project root and projectRef. Missing or ambiguous project names fail closed. A read-only lookup never changes the current session execution binding.",
    inputSchema: {
      query: z.string().min(1).max(512).describe(
        "Explicit project name, alias, or absolute path from the current user message.",
      ),
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: readOnly,
  }, async (input) => toolResult(projectResolver.resolveProjectQuery(input.query)));

  registerAppTool(server, "workflow_create", {
    title: "Create workflow task",
    description: "Create a durable DevSpace task for single-session, same-project, or cross-project handoff. Use this automatically when the user clearly says work should continue in another chat, session, or project; the user does not need to say workflow or handoff. Pure coordination does not start an Agent/model. Model and reasoning overrides are optional metadata only.",
    inputSchema: {
      workspaceId: z.string().min(1),
      relatedWorkspaceIds: z.array(z.string().min(1)).max(20).optional(),
      sessionRef: sessionField,
      actor: actorField,
      scope: z.enum(["single_session", "same_project", "cross_project"]),
      objective: z.string().min(1).max(8_000),
      acceptanceCriteria: z.array(z.string().min(1).max(2_000)).min(1).max(50),
      requireReview: z.boolean().optional(),
      taskRole: taskRoleField,
      implicitSelectionAllowed: z.boolean().optional(),
      executionWorkspaceId: z.string().min(1).optional().describe(
        "Optional initial execution project. It must be the primary workspace or one of relatedWorkspaceIds.",
      ),
      ...policyFields,
      idempotencyKey: idempotencyField,
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: mutating,
  }, async (input) => {
    const workspace = projectResolver.resolveWorkspaceId(input.workspaceId);
    const relatedProjects = (input.relatedWorkspaceIds ?? []).map(
      (workspaceId) => projectResolver.resolveWorkspaceId(workspaceId),
    );
    const executionProject = input.executionWorkspaceId
      ? projectResolver.resolveWorkspaceId(input.executionWorkspaceId)
      : workspace;
    return toolResult(await controller.createTask({
      ...input,
      projectRef: workspace.projectRef,
      relatedProjectRefs: relatedProjects.map((project) => project.projectRef),
      executionProjectRef: executionProject.projectRef,
      policy: input,
    }));
  });

  registerAppTool(server, "workflow_list", {
    title: "List workflow tasks",
    description: "List tasks for the current workspace execution project, or get one task by ID. Generic progress and continuation use execution_only: tasks from another primary/execution project are not selected merely because they are newer or cross-project visible. Use related_explicit only when the current user message explicitly names that cross-project task.",
    inputSchema: {
      workspaceId: z.string().min(1),
      sessionRef: sessionField,
      taskId: z.string().min(1).max(80).optional(),
      projectAccessMode: projectAccessField,
      includeNonImplicit: z.boolean().optional().describe(
        "Include Status Pulse, Recovery Supervisor, reviewer-watch, and governance tasks for explicit monitoring only.",
      ),
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: readOnly,
  }, async (input) => {
    const workspace = projectResolver.resolveWorkspaceId(input.workspaceId);
    const projectAccessMode = input.projectAccessMode ?? "execution_only";
    const request = {
      projectRef: workspace.projectRef,
      sessionRef: input.sessionRef,
      ...(input.taskId ? { taskId: input.taskId } : {}),
    };
    if (input.taskId) {
      const task = await controller.getTask(request);
      return toolResult(assertTaskExecutionAccess(task, workspace.projectRef, projectAccessMode));
    }
    const visibleTasks = await controller.listTasks({ ...request, selectionMode: "visible" });
    const tasks = visibleTasks.filter((task) => {
      const projectAllowed = projectAccessMode === "related_explicit"
        || taskExecutionProjectRef(task) === workspace.projectRef;
      const roleAllowed = input.includeNonImplicit === true || taskAllowsImplicitSelection(task);
      return projectAllowed && roleAllowed;
    });
    return toolResult(tasks);
  });

  registerAppTool(server, "workflow_update", {
    title: "Update workflow task",
    description: "Claim, hand off, acknowledge, review, resume, complete, or block a task with revision-based concurrency control. Natural-language continuation intent is enough; users do not need to name claim, handoff, or acknowledge. Do not infer an Agent/model run from workflow coordination.",
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
      targetWorkspaceId: z.string().min(1).optional().describe(
        "For an explicit cross-project handoff, identifies the target execution project.",
      ),
      projectAccessMode: projectAccessField,
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
    const workspace = projectResolver.resolveWorkspaceId(input.workspaceId);
    const targetProject = input.targetWorkspaceId
      ? projectResolver.resolveWorkspaceId(input.targetWorkspaceId)
      : undefined;
    const { targetWorkspaceId: _targetWorkspaceId, ...updateInput } = input;
    return toolResult(await controller.updateTask({
      ...updateInput,
      projectRef: workspace.projectRef,
      projectAccessMode: input.projectAccessMode ?? "execution_only",
      targetExecutionProjectRef: targetProject?.projectRef,
    }));
  });

  registerAppTool(server, "workflow_takeover", {
    title: "Recover stale workflow owner",
    description: "Recover a stale owner only after the user or Recovery Supervisor explicitly identifies this task and project. Project affinity remains enforced; takeover never makes a visibility-only cross-project task an implicit continuation target.",
    inputSchema: {
      workspaceId: z.string().min(1),
      sessionRef: sessionField,
      actor: actorField,
      taskId: z.string().min(1).max(80),
      expectedRevision: z.number().int().positive(),
      expectedOwner: z.string().min(1).max(128),
      staleAfterSeconds: z.number().int().min(60).max(86_400),
      ownerHeartbeatMissing: z.boolean(),
      noActiveRunnerObserved: z.boolean(),
      executionWatchMissingOrStaleObserved: z.boolean(),
      reason: z.string().min(1).max(4_000),
      requiredNextAction: z.string().min(1).max(4_000),
      idempotencyKey: idempotencyField,
      projectAccessMode: projectAccessField,
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: mutating,
  }, async (input) => {
    const workspace = projectResolver.resolveWorkspaceId(input.workspaceId);
    return toolResult(await controller.takeoverTask({
      ...input,
      projectRef: workspace.projectRef,
      projectAccessMode: input.projectAccessMode ?? "execution_only",
    }));
  });

  registerAppTool(server, "workflow_run", {
    title: "Run workflow Agent",
    description: "Start a DevSpace worker or independent reviewer only after the user explicitly asks to use an Agent/model in the current conversation. Pure workflow coordination must use create/list/update without this tool. Model and reasoning overrides are optional; omitted values use the selected DevSpace profile defaults. Unsupported Deep Research/Pro requests are blocked or explicitly degraded.",
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
      userAuthorizedModelRun: z.boolean().describe("Must be true only when the user explicitly authorized using an Agent/model in the current conversation."),
      model: policyFields.model,
      reasoningEffort: policyFields.reasoningEffort,
      deepResearch: policyFields.deepResearch,
      proMode: policyFields.proMode,
      unsupportedBehavior: policyFields.unsupportedBehavior,
      projectAccessMode: projectAccessField,
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: mutating,
  }, async (input) => {
    const workspace = projectResolver.resolveWorkspaceId(input.workspaceId);
    const policyOverride = Object.fromEntries(
      ["model", "reasoningEffort", "deepResearch", "proMode", "unsupportedBehavior"]
        .filter((key) => input[key] !== undefined)
        .map((key) => [key, input[key]]),
    );
    return toolResult(await controller.runTask({
      ...input,
      projectRef: workspace.projectRef,
      projectAccessMode: input.projectAccessMode ?? "execution_only",
      workspaceRoot: workspace.workspaceRoot,
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
      projectAccessMode: projectAccessField,
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: mutating,
  }, async (input) => {
    const workspace = projectResolver.resolveWorkspaceId(input.workspaceId);
    return toolResult(await controller.syncTask({
      ...input,
      projectRef: workspace.projectRef,
      projectAccessMode: input.projectAccessMode ?? "execution_only",
      workspaceRoot: workspace.workspaceRoot,
    }));
  });
}
