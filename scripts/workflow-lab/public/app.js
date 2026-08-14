'use strict';

const state = {
  token: null,
  modules: [],
  defaultSequence: [],
  moduleOrder: [],
  selectedModules: new Set(),
  projects: [],
  activeRun: null,
  pollTimer: null,
  liveAvailable: false
};

const terminalStatuses = new Set(['green', 'red', 'failed', 'cancelled']);
const statusLabels = {
  queued: '排隊中',
  running: '執行中',
  paused: '等待核准',
  green: 'GREEN',
  red: 'RED',
  failed: '失敗',
  cancelled: '已取消',
  RUNNING: '執行中',
  GREEN: 'GREEN',
  RED: 'RED'
};

const elements = {
  requirement: document.querySelector('#requirement-input'),
  businessLogic: document.querySelector('#business-logic-input'),
  expectedOutcome: document.querySelector('#expected-outcome-input'),
  constraints: document.querySelector('#constraints-input'),
  sensitiveTerms: document.querySelector('#sensitive-terms-input'),
  acceptanceCriteria: document.querySelector('#acceptance-criteria-input'),
  upstreamArtifacts: document.querySelector('#upstream-artifacts-input'),
  modeOffline: document.querySelector('#mode-offline'),
  modeLive: document.querySelector('#mode-live'),
  inputNeedToKnow: document.querySelector('#input-need-to-know'),
  inputRaw: document.querySelector('#input-raw'),
  selectionSingle: document.querySelector('#selection-single'),
  selectionPartial: document.querySelector('#selection-partial'),
  selectionFull: document.querySelector('#selection-full'),
  fixtureMode: document.querySelector('#fixture-mode'),
  testScenario: document.querySelector('#test-scenario'),
  moduleList: document.querySelector('#module-list'),
  advancedOrder: document.querySelector('#advanced-order-toggle'),
  unsafeOrder: document.querySelector('#unsafe-order-toggle'),
  projectSource: document.querySelector('#project-source'),
  projectFleet: document.querySelector('#project-fleet'),
  projectPath: document.querySelector('#project-path'),
  runWorkflow: document.querySelector('#run-workflow'),
  cancelRun: document.querySelector('#cancel-run'),
  approvalPanel: document.querySelector('#approval-panel'),
  approvalMessage: document.querySelector('#approval-message'),
  approvalReturnModule: document.querySelector('#approval-return-module'),
  approveRun: document.querySelector('#approve-run'),
  rejectRun: document.querySelector('#reject-run'),
  runSummary: document.querySelector('#run-summary'),
  runStepList: document.querySelector('#run-step-list'),
  artifactList: document.querySelector('#artifact-list'),
  artifactViewer: document.querySelector('#artifact-viewer'),
  runLog: document.querySelector('#run-log'),
  healthDot: document.querySelector('#health-dot'),
  healthLabel: document.querySelector('#health-label'),
  liveAvailability: document.querySelector('#live-availability'),
  toast: document.querySelector('#toast')
};

async function fetchJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const method = options.method || 'GET';
  if (method !== 'GET') {
    headers.set('content-type', 'application/json');
    headers.set('X-Pixiu-Workflow-Token', state.token);
  }
  const response = await fetch(url, { ...options, method, headers });
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = { error: `HTTP ${response.status}` };
  }
  if (!response.ok) {
    const error = new Error(payload.error || `HTTP ${response.status}`);
    error.statusCode = response.status;
    error.code = payload.code;
    throw error;
  }
  return payload;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 5000);
}

function splitLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function selectedRadio(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function isRunBusy(run) {
  return Boolean(run && !terminalStatuses.has(run.status));
}

function updateBusyState() {
  const busy = isRunBusy(state.activeRun);
  elements.runWorkflow.disabled = busy;
  elements.cancelRun.hidden = !busy;
  elements.modeOffline.disabled = busy;
  elements.modeLive.disabled = busy;
  elements.moduleList.querySelectorAll('input, button').forEach((control) => {
    control.disabled = busy;
  });
  elements.healthDot.classList.toggle('is-busy', busy);
  elements.healthLabel.textContent = busy ? 'Workflow 執行中' : '服務正常';
}

function moduleById(moduleId) {
  return state.modules.find((module) => module.id === moduleId);
}

function normalizeSelectionForMode() {
  const selectionMode = selectedRadio('selection-mode');
  if (selectionMode === 'full') {
    state.selectedModules = new Set(state.defaultSequence);
  } else if (selectionMode === 'single') {
    const current = state.moduleOrder.find((moduleId) => state.selectedModules.has(moduleId));
    state.selectedModules = new Set([current || state.moduleOrder[0]].filter(Boolean));
  } else if (state.selectedModules.size === 0) {
    state.selectedModules = new Set(
      ['translator', 'pm', 'sa'].filter((moduleId) => state.moduleOrder.includes(moduleId))
    );
  }
  renderModules();
}

function moveModule(moduleId, direction) {
  const index = state.moduleOrder.indexOf(moduleId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= state.moduleOrder.length) {
    return;
  }
  const next = [...state.moduleOrder];
  [next[index], next[target]] = [next[target], next[index]];
  state.moduleOrder = next;
  renderModules();
}

function createModuleCard(module, index) {
  const card = document.createElement('article');
  card.className = 'module-card';
  card.dataset.moduleId = module.id;

  const order = document.createElement('span');
  order.className = 'module-order';
  order.textContent = String(index + 1).padStart(2, '0');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = state.selectedModules.has(module.id);
  checkbox.disabled = selectedRadio('selection-mode') === 'full';
  checkbox.setAttribute('aria-label', `選擇 ${module.name}`);
  checkbox.addEventListener('change', () => {
    if (selectedRadio('selection-mode') === 'single' && checkbox.checked) {
      state.selectedModules.clear();
    }
    if (checkbox.checked) {
      state.selectedModules.add(module.id);
    } else {
      state.selectedModules.delete(module.id);
    }
    normalizeSelectionForMode();
  });

  const info = document.createElement('div');
  info.className = 'module-info';
  const title = document.createElement('strong');
  title.textContent = module.name;
  const meta = document.createElement('small');
  const access = {
    none: '本機契約',
    'read-only': 'Live 唯讀',
    'worktree-read': 'Worktree 唯讀',
    'worktree-write': 'Worktree 寫入'
  }[module.liveAccess] || module.liveAccess;
  meta.textContent = `${module.kind} · ${access}`;
  info.append(title, meta);

  const controls = document.createElement('div');
  controls.className = 'module-move-controls';
  const up = document.createElement('button');
  up.type = 'button';
  up.className = 'icon-button';
  up.textContent = '↑';
  up.title = '向上移動';
  up.hidden = !elements.advancedOrder.checked;
  up.disabled = index === 0;
  up.addEventListener('click', () => moveModule(module.id, -1));
  const down = document.createElement('button');
  down.type = 'button';
  down.className = 'icon-button';
  down.textContent = '↓';
  down.title = '向下移動';
  down.hidden = !elements.advancedOrder.checked;
  down.disabled = index === state.moduleOrder.length - 1;
  down.addEventListener('click', () => moveModule(module.id, 1));
  controls.append(up, down);

  card.append(order, checkbox, info, controls);
  return card;
}

function renderModules() {
  const cards = state.moduleOrder
    .map(moduleById)
    .filter(Boolean)
    .map(createModuleCard);
  elements.moduleList.replaceChildren(...cards);
  updateBusyState();
}

function renderProjects() {
  const options = [document.createElement('option')];
  options[0].value = '';
  options[0].textContent = state.projects.length ? '請選擇 Fleet 專案' : '沒有可用 Fleet 專案';
  for (const project of state.projects) {
    const option = document.createElement('option');
    option.value = project.path;
    option.textContent = project.name || project.path;
    options.push(option);
  }
  elements.projectFleet.replaceChildren(...options);
}

function formatDuration(run) {
  if (!run?.startedAt) {
    return '尚未開始';
  }
  const end = run.finishedAt ? Date.parse(run.finishedAt) : Date.now();
  const duration = Math.max(0, end - Date.parse(run.startedAt));
  return duration < 1000 ? `${duration} ms` : `${(duration / 1000).toFixed(1)} 秒`;
}

function createStatusPill(status) {
  const pill = document.createElement('span');
  pill.className = `status-pill status-${String(status || 'queued').toLowerCase()}`;
  pill.textContent = statusLabels[status] || status;
  return pill;
}

function renderSteps(run) {
  if (!run.steps.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = run.status === 'paused' ? '尚未進入角色模組。' : '等待角色輸出…';
    elements.runStepList.replaceChildren(empty);
    return;
  }

  const rows = run.steps.map((step, index) => {
    const row = document.createElement('article');
    row.className = 'step-row';

    const number = document.createElement('span');
    number.className = 'step-number';
    number.textContent = String(index + 1).padStart(2, '0');

    const info = document.createElement('div');
    info.className = 'step-info';
    const title = document.createElement('strong');
    title.textContent = step.name || moduleById(step.moduleId)?.name || step.moduleId;
    const meta = document.createElement('small');
    const reason = step.reason ? ` · ${step.reason}` : '';
    meta.textContent = `第 ${step.iteration || 1} 輪${reason}`;
    info.append(title, meta);

    row.append(number, info, createStatusPill(step.status));
    return row;
  });
  elements.runStepList.replaceChildren(...rows);
}

async function showArtifact(runId, artifactId) {
  try {
    const payload = await fetchJson(`/api/runs/${runId}/artifacts/${artifactId}`);
    elements.artifactViewer.textContent = JSON.stringify(payload.artifact, null, 2);
  } catch (error) {
    showToast(error.message);
  }
}

function renderArtifacts(run) {
  if (!run.artifacts.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = '目前沒有可持久化產物。原文直通模式的產物不會出現在這裡。';
    elements.artifactList.replaceChildren(empty);
    elements.artifactViewer.textContent = '選擇 Artifact 後顯示內容。';
    return;
  }
  const buttons = run.artifacts.map((artifact) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'artifact-button';
    const title = document.createElement('strong');
    title.textContent = artifact.type;
    const meta = document.createElement('small');
    meta.textContent = `${moduleById(artifact.moduleId)?.name || artifact.moduleId} · ${artifact.bytes} bytes`;
    button.append(title, meta);
    button.addEventListener('click', () => showArtifact(run.id, artifact.id));
    return button;
  });
  elements.artifactList.replaceChildren(...buttons);
}

function renderApproval(run) {
  const approval = run.pendingApproval;
  elements.approvalPanel.hidden = run.status !== 'paused' || !approval;
  if (!approval) {
    return;
  }
  elements.approvalMessage.textContent = approval.message || '等待你的決定。';
  const isReturn = approval.kind === 'red-return';
  elements.approvalReturnModule.parentElement.hidden = !isReturn;
  elements.approveRun.textContent = isReturn ? '退回並重新執行' : '核准並繼續';

  if (isReturn) {
    const options = run.moduleSequence.map((moduleId) => {
      const option = document.createElement('option');
      option.value = moduleId;
      option.textContent = moduleById(moduleId)?.name || moduleId;
      option.selected = moduleId === approval.recommendedModuleId;
      return option;
    });
    elements.approvalReturnModule.replaceChildren(...options);
  }
}

function renderRun(run) {
  state.activeRun = run;
  if (!run) {
    elements.runSummary.textContent = '尚未執行 Workflow。';
    elements.runLog.textContent = '等待執行…';
    updateBusyState();
    return;
  }

  elements.runSummary.textContent = `${statusLabels[run.status] || run.status} · 第 ${run.iteration} 輪 · ${formatDuration(run)}`;
  elements.runSummary.className = `run-summary run-${run.status}`;
  elements.runLog.textContent = run.log || 'Workflow 已建立，等待模組輸出…';
  elements.runLog.scrollTop = elements.runLog.scrollHeight;
  renderSteps(run);
  renderArtifacts(run);
  renderApproval(run);
  updateBusyState();
}

async function pollRun(runId) {
  window.clearTimeout(state.pollTimer);
  try {
    const payload = await fetchJson(`/api/runs/${runId}`);
    renderRun(payload.run);
    if (['queued', 'running'].includes(payload.run.status)) {
      state.pollTimer = window.setTimeout(() => pollRun(runId), 900);
    }
  } catch (error) {
    showToast(error.message);
    state.pollTimer = window.setTimeout(() => pollRun(runId), 1800);
  }
}

function selectedSequence() {
  const selectionMode = selectedRadio('selection-mode');
  if (selectionMode === 'full') {
    return [...state.defaultSequence];
  }
  const sequence = state.moduleOrder.filter((moduleId) => state.selectedModules.has(moduleId));
  if (selectionMode === 'single') {
    return sequence.slice(0, 1);
  }
  return sequence;
}

function parseUpstreamArtifacts() {
  const text = elements.upstreamArtifacts.value.trim();
  if (!text) {
    return {};
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`手動上游 Artifacts JSON 格式錯誤：${error.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('手動上游 Artifacts 必須是 JSON 物件。');
  }
  return parsed;
}

function buildWorkflowRequest() {
  const mode = selectedRadio('execution-mode');
  const inputMode = selectedRadio('input-mode');
  const selectionMode = selectedRadio('selection-mode');
  const moduleSequence = selectedSequence();
  if (!elements.requirement.value.trim() && !elements.businessLogic.value.trim()) {
    throw new Error('需求描述與商業邏輯至少填一項。');
  }
  if (!moduleSequence.length) {
    throw new Error('至少選擇一個角色模組。');
  }
  if (mode === 'live' && !elements.projectPath.value.trim()) {
    throw new Error('Live Smoke 必須選擇目標專案。');
  }

  return {
    mode,
    inputMode,
    selectionMode,
    fixtureMode: elements.fixtureMode.value,
    testScenario: elements.testScenario.value,
    requirement: elements.requirement.value,
    businessLogic: elements.businessLogic.value,
    expectedOutcome: elements.expectedOutcome.value,
    constraints: splitLines(elements.constraints.value),
    sensitiveTerms: splitLines(elements.sensitiveTerms.value),
    acceptanceCriteria: splitLines(elements.acceptanceCriteria.value),
    inputArtifacts: parseUpstreamArtifacts(),
    project: {
      source: elements.projectSource.value,
      path: elements.projectPath.value.trim()
    },
    moduleSequence,
    advancedOrder: elements.advancedOrder.checked,
    allowUnsafeOrder: elements.unsafeOrder.checked
  };
}

async function startWorkflow() {
  let workflowRequest;
  try {
    workflowRequest = buildWorkflowRequest();
    if (workflowRequest.inputMode === 'raw-pass-through'
      && !window.confirm('原文直通會增加敏感資訊暴露。流程仍會先停在伺服器核准點，確定要建立 Run？')) {
      return;
    }
    if (workflowRequest.allowUnsafeOrder
      && !window.confirm('不安全順序可能刻意跳過上游契約。確定要建立測試 Run？')) {
      return;
    }
    if (workflowRequest.mode === 'live'
      && !window.confirm('Live Smoke 會消耗 Codex 額度；PG 會在核准後建立隔離 Worktree。確定要繼續？')) {
      return;
    }

    const payload = await fetchJson('/api/runs', {
      method: 'POST',
      body: JSON.stringify(workflowRequest)
    });
    workflowRequest = null;
    renderRun(payload.run);
    if (['queued', 'running'].includes(payload.run.status)) {
      await pollRun(payload.run.id);
    }
  } catch (error) {
    showToast(error.message);
  } finally {
    workflowRequest = null;
  }
}

async function approveRun() {
  if (!state.activeRun?.pendingApproval) {
    return;
  }
  const approval = state.activeRun.pendingApproval;
  const body = approval.kind === 'red-return'
    ? { action: 'return', moduleId: elements.approvalReturnModule.value }
    : { action: 'approve' };
  try {
    const payload = await fetchJson(`/api/runs/${state.activeRun.id}/approve`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    renderRun(payload.run);
    await pollRun(payload.run.id);
  } catch (error) {
    showToast(error.message);
  }
}

async function rejectRun() {
  if (!state.activeRun) {
    return;
  }
  try {
    const payload = await fetchJson(`/api/runs/${state.activeRun.id}/reject`, {
      method: 'POST',
      body: '{}'
    });
    renderRun(payload.run);
    await pollRun(payload.run.id);
  } catch (error) {
    showToast(error.message);
  }
}

async function cancelRun() {
  if (!state.activeRun) {
    return;
  }
  try {
    const payload = await fetchJson(`/api/runs/${state.activeRun.id}/cancel`, {
      method: 'POST',
      body: '{}'
    });
    renderRun(payload.run);
  } catch (error) {
    showToast(error.message);
  }
}

function bindControls() {
  document.querySelectorAll('input[name="selection-mode"]').forEach((control) => {
    control.addEventListener('change', normalizeSelectionForMode);
  });
  elements.advancedOrder.addEventListener('change', () => {
    elements.unsafeOrder.disabled = !elements.advancedOrder.checked;
    if (!elements.advancedOrder.checked) {
      elements.unsafeOrder.checked = false;
      state.moduleOrder = [...state.modules]
        .sort((left, right) => left.defaultOrder - right.defaultOrder)
        .map((module) => module.id);
    }
    renderModules();
  });
  elements.projectSource.addEventListener('change', () => {
    const useFleet = elements.projectSource.value === 'fleet';
    elements.projectFleet.disabled = !useFleet;
    elements.projectPath.readOnly = useFleet;
    if (!useFleet) {
      elements.projectFleet.value = '';
    }
  });
  elements.projectFleet.addEventListener('change', () => {
    elements.projectPath.value = elements.projectFleet.value;
  });
  elements.runWorkflow.addEventListener('click', startWorkflow);
  elements.cancelRun.addEventListener('click', cancelRun);
  elements.approveRun.addEventListener('click', approveRun);
  elements.rejectRun.addEventListener('click', rejectRun);
}

async function initialize() {
  bindControls();
  try {
    const session = await fetchJson('/api/session');
    state.token = session.token;
    state.liveAvailable = session.liveAvailable;
    elements.liveAvailability.textContent = session.liveAvailable
      ? 'Live Smoke 可用'
      : 'Live Smoke 目前不可用';
    elements.liveAvailability.classList.toggle('is-unavailable', !session.liveAvailable);

    const [modulePayload, projectPayload] = await Promise.all([
      fetchJson('/api/modules'),
      fetchJson('/api/projects')
    ]);
    state.modules = modulePayload.modules;
    state.defaultSequence = modulePayload.defaultSequence;
    state.moduleOrder = [...state.modules]
      .sort((left, right) => left.defaultOrder - right.defaultOrder)
      .map((module) => module.id);
    state.selectedModules = new Set(
      ['translator', 'pm', 'sa'].filter((moduleId) => state.moduleOrder.includes(moduleId))
    );
    state.projects = projectPayload.projects;
    renderProjects();
    renderModules();
    renderRun(
      session.activeRun
      || modulePayload.activeRun
      || session.latestRun
      || modulePayload.latestRun
    );
    if (state.activeRun && ['queued', 'running'].includes(state.activeRun.status)) {
      await pollRun(state.activeRun.id);
    }
  } catch (error) {
    elements.healthDot.classList.add('is-error');
    elements.healthLabel.textContent = '服務連線失敗';
    showToast(error.message);
  }
}

initialize();
