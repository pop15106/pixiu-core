import reviewerModule from "./same-chat-reviewer.js";

const {
  buildReviewerPrompt,
  consumeReviewResult,
  createReviewRequest,
  createReviewResult,
  evaluateHostCapabilities,
  getReviewState,
  requestFromState,
  reserveReview,
  submitReviewResult,
  toCriticalRelayProposal,
} = reviewerModule;

function fail(message) {
  throw new Error(message);
}

function resultEnvelope(value) {
  const result = JSON.stringify(value, null, 2);
  return {
    content: [{ type: "text", text: result }],
    structuredContent: { result },
  };
}

function assertCorrelation(input, request) {
  if (input.taskId !== request.taskId) fail("taskId does not match the stored review request.");
  if (input.subjectRevision !== request.subjectRevision) {
    fail("subjectRevision does not match the stored review request.");
  }
  if (input.snapshotHash !== request.snapshotHash) {
    fail("snapshotHash does not match the stored review request.");
  }
}

export function registerSameChatReviewerTools({
  server,
  registerAppTool,
  z,
  stateDirectory,
}) {
  if (!server || !registerAppTool || !z || !stateDirectory) {
    fail("Same-Chat Reviewer tool registration is missing dependencies.");
  }

  const outputSchema = { result: z.string() };
  const modelOnlyMeta = { _meta: {} };
  const readOnly = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
  const mutating = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };

  const findingSchema = z.object({
    id: z.string().min(1).max(160),
    severity: z.enum(["low", "medium", "high", "critical"]),
    claim: z.string().min(1).max(4_000),
    reason: z.string().min(1).max(6_000),
    claimRefs: z.array(z.string().min(1).max(160)).min(1).max(20),
    evidenceRefs: z.array(z.string().min(1).max(1_000)).max(50).optional(),
    suggestedTests: z.array(z.string().min(1).max(1_000)).max(20).optional(),
  });

  registerAppTool(server, "same_chat_review_request", {
    title: "Request Same-Chat advisory review",
    description:
      "Create a Same-Chat advisory review request bound to a fixed revision and snapshot hash. " +
      "This is not an independent review and cannot satisfy workflow requireReview or complete a CR task. " +
      "The returned reviewerPrompt is intended for a future MCP Apps ui/message host adapter; this tool does not post a ChatGPT message by itself.",
    inputSchema: {
      taskId: z.string().min(1).max(160),
      subjectRevision: z.number().int().positive(),
      snapshotHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
      question: z.string().min(1).max(4_000),
      criteria: z.array(z.string().min(1).max(1_000)).min(1).max(20),
      objective: z.string().min(1).max(4_000),
      candidate: z.string().min(1).max(12_000),
      evidenceRefs: z.array(z.string().min(1).max(1_000)).max(50).optional(),
      constraints: z.array(z.string().min(1).max(1_000)).max(20).optional(),
      ttlMs: z.number().int().positive().max(15 * 60 * 1000).optional(),
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: mutating,
  }, async (input) => {
    const request = createReviewRequest({
      taskId: input.taskId,
      subjectRevision: input.subjectRevision,
      snapshotHash: input.snapshotHash,
      question: input.question,
      criteria: input.criteria,
      ttlMs: input.ttlMs,
    });
    reserveReview(stateDirectory, request);
    const reviewerPrompt = buildReviewerPrompt(request, {
      objective: input.objective,
      candidate: input.candidate,
      evidenceRefs: input.evidenceRefs ?? [],
      constraints: input.constraints ?? [],
    });

    return resultEnvelope({
      request,
      reviewerPrompt,
      dispatch: {
        preferredStandard: "MCP Apps ui/message",
        chatgptCompatibilityAlias: "window.openai.sendFollowUpMessage",
        postsMessageAutomatically: false,
        hostE2EVerified: false,
        autoContinueVerified: false,
      },
    });
  });

  registerAppTool(server, "same_chat_review_submit", {
    title: "Submit Same-Chat advisory review result",
    description:
      "Submit the structured result for an existing Same-Chat advisory review. " +
      "The correlation fields must match the stored request. The result remains advisory and cannot approve independent review or complete CR.",
    inputSchema: {
      reviewId: z.string().min(1).max(160),
      taskId: z.string().min(1).max(160),
      subjectRevision: z.number().int().positive(),
      snapshotHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
      verdict: z.enum(["concerns_found", "no_additional_findings", "blocked"]),
      findings: z.array(findingSchema).max(50),
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: mutating,
  }, async (input) => {
    const stored = getReviewState(stateDirectory, input.reviewId);
    const request = requestFromState(stored.state);
    assertCorrelation(input, request);
    const result = createReviewResult(request, {
      verdict: input.verdict,
      findings: input.findings,
    });
    const submitted = submitReviewResult(stateDirectory, request, result);
    return resultEnvelope({
      reviewId: request.reviewId,
      status: submitted.state.status,
      advisoryOnly: true,
      independentReview: false,
      canSatisfyRequiredReview: false,
    });
  });

  registerAppTool(server, "same_chat_review_status", {
    title: "Get Same-Chat advisory review status",
    description:
      "Read the durable state for a Same-Chat advisory review. This does not consume or approve the result.",
    inputSchema: {
      reviewId: z.string().min(1).max(160),
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: readOnly,
  }, async (input) => {
    const stored = getReviewState(stateDirectory, input.reviewId);
    return resultEnvelope({
      reviewId: input.reviewId,
      status: stored.state.status,
      request: stored.state.request,
      result: stored.state.result,
      independentReview: false,
      canSatisfyRequiredReview: false,
    });
  });

  registerAppTool(server, "same_chat_review_consume", {
    title: "Consume Same-Chat advisory review",
    description:
      "Consume one submitted Same-Chat advisory result and convert findings into open CR challenge/counterEvidence proposals. " +
      "The proposals remain unresolved and have no completion effect.",
    inputSchema: {
      reviewId: z.string().min(1).max(160),
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: mutating,
  }, async (input) => {
    const consumed = consumeReviewResult(stateDirectory, input.reviewId);
    return resultEnvelope({
      status: consumed.state.status,
      result: consumed.result,
      criticalRelayProposal: toCriticalRelayProposal(consumed.result),
    });
  });

  registerAppTool(server, "same_chat_review_capabilities", {
    title: "Evaluate Same-Chat host capabilities",
    description:
      "Evaluate host-declared Same-Chat UI capabilities. These booleans are declarations only; the result never claims host E2E or auto-continue verification.",
    inputSchema: {
      uiMessage: z.boolean(),
      toolCall: z.boolean(),
      sessionCorrelation: z.boolean(),
      resultSubmissionTool: z.boolean(),
    },
    outputSchema,
    ...modelOnlyMeta,
    annotations: readOnly,
  }, async (input) => resultEnvelope(evaluateHostCapabilities(input)));

  return {
    stateDirectory,
    toolNames: [
      "same_chat_review_request",
      "same_chat_review_submit",
      "same_chat_review_status",
      "same_chat_review_consume",
      "same_chat_review_capabilities",
    ],
  };
}
