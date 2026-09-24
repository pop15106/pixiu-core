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


const SAME_CHAT_REVIEWER_RESOURCE_URI = "ui://pixiu/same-chat-reviewer/v1.html";
const SAME_CHAT_REVIEWER_MIME_TYPE = "text/html;profile=mcp-app";
const SAME_CHAT_REVIEWER_WIDGET_HTML = String.raw`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Pixiu Same-Chat Reviewer</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 0; padding: 12px; }
    .card { border: 1px solid rgba(127,127,127,.35); border-radius: 12px; padding: 12px; }
    .title { font-weight: 700; margin-bottom: 6px; }
    .status { font-size: 13px; opacity: .85; white-space: pre-wrap; }
    button { margin-top: 10px; padding: 7px 12px; border-radius: 8px; border: 1px solid rgba(127,127,127,.45); cursor: pointer; }
    button[hidden] { display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">Pixiu Same-Chat Reviewer</div>
    <div id="status" class="status">等待 review request…</div>
    <button id="retry" type="button" hidden>重新送出 Reviewer Turn</button>
  </div>
  <script>
    (function () {
      "use strict";
      var statusEl = document.getElementById("status");
      var retryButton = document.getElementById("retry");
      var pendingRequests = new Map();
      var nextRequestId = 1;
      var latestToolOutput = null;
      var standardReady = false;
      var inFlight = false;
      var memoryDispatchedReviewId = null;

      function setStatus(text, retry) {
        statusEl.textContent = String(text || "");
        retryButton.hidden = !retry;
      }

      function request(method, params, timeoutMs) {
        var id = nextRequestId++;
        window.parent.postMessage({ jsonrpc: "2.0", id: id, method: method, params: params }, "*");
        return new Promise(function (resolve, reject) {
          var timer = window.setTimeout(function () {
            pendingRequests.delete(id);
            reject(new Error(method + " timeout"));
          }, timeoutMs || 5000);
          pendingRequests.set(id, {
            resolve: function (value) { window.clearTimeout(timer); resolve(value); },
            reject: function (error) { window.clearTimeout(timer); reject(error); }
          });
        });
      }

      function notify(method, params) {
        window.parent.postMessage({ jsonrpc: "2.0", method: method, params: params || {} }, "*");
      }

      async function initializeStandardBridge() {
        if (standardReady) return true;
        try {
          await request("ui/initialize", {
            protocolVersion: "2026-01-26",
            appInfo: { name: "pixiu-same-chat-reviewer", title: "Pixiu Same-Chat Reviewer", version: "1.0.0" },
            appCapabilities: {}
          }, 4000);
          notify("ui/notifications/initialized", {});
          standardReady = true;
          return true;
        } catch (_error) {
          return false;
        }
      }

      function parseOutput(raw) {
        if (!raw || typeof raw !== "object") return null;
        var encoded = raw.result;
        if (typeof encoded !== "string") return null;
        try {
          var value = JSON.parse(encoded);
          if (!value || !value.request || typeof value.reviewerPrompt !== "string") return null;
          return value;
        } catch (_error) {
          return null;
        }
      }

      function getPersistedState() {
        var openai = window.openai;
        var state = openai && openai.widgetState;
        return state && typeof state === "object" ? state : {};
      }

      function persistState(nextState) {
        var openai = window.openai;
        if (openai && typeof openai.setWidgetState === "function") {
          openai.setWidgetState(nextState);
        }
      }

      function alreadyDispatched(reviewId) {
        if (memoryDispatchedReviewId === reviewId) return true;
        var state = getPersistedState();
        return state.dispatchedReviewId === reviewId && state.dispatchStatus === "sent";
      }

      async function sendViaStandard(prompt) {
        var ready = await initializeStandardBridge();
        if (!ready) throw new Error("MCP Apps standard bridge unavailable");
        var result = await request("ui/message", {
          role: "user",
          content: [{ type: "text", text: prompt }]
        }, 10000);
        if (result && result.isError) throw new Error("Host rejected ui/message");
        return "ui/message";
      }

      async function sendViaChatGptCompatibility(prompt) {
        var openai = window.openai;
        if (!openai || typeof openai.sendFollowUpMessage !== "function") {
          throw new Error("ChatGPT follow-up bridge unavailable");
        }
        await openai.sendFollowUpMessage({ prompt: prompt, scrollToBottom: true });
        return "window.openai.sendFollowUpMessage";
      }

      async function dispatch(value, manualRetry) {
        if (!value || inFlight) return;
        var reviewId = value.request.reviewId;
        if (!manualRetry && alreadyDispatched(reviewId)) {
          setStatus("Reviewer Turn 已送出；等待 ChatGPT 產生審查並回填結果。", false);
          return;
        }

        inFlight = true;
        retryButton.hidden = true;
        setStatus("正在要求 ChatGPT 建立 Same-Chat Reviewer Turn…", false);
        persistState({ dispatchedReviewId: reviewId, dispatchStatus: "dispatching" });

        try {
          var transport;
          try {
            transport = await sendViaStandard(value.reviewerPrompt);
          } catch (_standardError) {
            transport = await sendViaChatGptCompatibility(value.reviewerPrompt);
          }
          memoryDispatchedReviewId = reviewId;
          persistState({ dispatchedReviewId: reviewId, dispatchStatus: "sent", transport: transport });
          setStatus(
            "Reviewer Turn 已送出（" + transport + "）。\\n" +
            "送出成功不等於審查完成；必須等 same_chat_review_submit / consume 成功後才算結果回填。",
            false
          );
        } catch (error) {
          persistState({ dispatchedReviewId: reviewId, dispatchStatus: "failed" });
          setStatus("無法自動送出 Reviewer Turn：" + String(error && error.message || error), true);
        } finally {
          inFlight = false;
        }
      }

      function hydrate(raw) {
        var value = parseOutput(raw);
        if (!value) return;
        latestToolOutput = raw;
        dispatch(value, false);
      }

      window.addEventListener("message", function (event) {
        if (event.source !== window.parent) return;
        var message = event.data;
        if (!message || message.jsonrpc !== "2.0") return;

        if (message.id !== undefined && pendingRequests.has(message.id)) {
          var pending = pendingRequests.get(message.id);
          pendingRequests.delete(message.id);
          if (message.error) pending.reject(message.error);
          else pending.resolve(message.result);
          return;
        }

        if (message.method === "ui/notifications/tool-result") {
          hydrate(message.params && message.params.structuredContent);
        }
      }, { passive: true });

      window.addEventListener("openai:set_globals", function () {
        if (window.openai && window.openai.toolOutput) hydrate(window.openai.toolOutput);
      }, { passive: true });

      retryButton.addEventListener("click", function () {
        var value = parseOutput(latestToolOutput || (window.openai && window.openai.toolOutput));
        if (value) dispatch(value, true);
      });

      if (window.openai && window.openai.toolOutput) {
        hydrate(window.openai.toolOutput);
      }
    })();
  </script>
</body>
</html>`;

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

  if (typeof server.registerResource !== "function") {
    fail("Same-Chat Reviewer requires server.registerResource for the MCP Apps widget.");
  }

  server.registerResource(
    "pixiu-same-chat-reviewer",
    SAME_CHAT_REVIEWER_RESOURCE_URI,
    {},
    async () => ({
      contents: [
        {
          uri: SAME_CHAT_REVIEWER_RESOURCE_URI,
          mimeType: SAME_CHAT_REVIEWER_MIME_TYPE,
          text: SAME_CHAT_REVIEWER_WIDGET_HTML,
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
            },
            "openai/widgetDescription":
              "Pixiu Same-Chat Reviewer dispatches one advisory reviewer turn and shows dispatch status.",
          },
        },
      ],
    }),
  );

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
      "The tool returns reviewerPrompt and renders the Same-Chat Reviewer widget. " +
      "The widget attempts one ui/message dispatch (with ChatGPT compatibility fallback), but dispatch success is not review completion.",
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
    _meta: {
      ui: { resourceUri: SAME_CHAT_REVIEWER_RESOURCE_URI },
      "openai/outputTemplate": SAME_CHAT_REVIEWER_RESOURCE_URI,
      "openai/toolInvocation/invoking": "Preparing Same-Chat review…",
      "openai/toolInvocation/invoked": "Same-Chat review ready.",
    },
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
        serverPostsMessageAutomatically: false,
        widgetAttemptsSingleDispatch: true,
        standardResourceUri: SAME_CHAT_REVIEWER_RESOURCE_URI,
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
    resourceUri: SAME_CHAT_REVIEWER_RESOURCE_URI,
    toolNames: [
      "same_chat_review_request",
      "same_chat_review_submit",
      "same_chat_review_status",
      "same_chat_review_consume",
      "same_chat_review_capabilities",
    ],
  };
}
