'use strict';

const state = {
  token: null,
  modules: [],
  activeRun: null,
  latestResults: new Map(),
  pollTimer: null
};

const elements = {
  cancelRun: document.querySelector('#cancel-run'),
  healthDot: document.querySelector('#health-dot'),
  healthLabel: document.querySelector('#health-label'),
  integrationRun: document.querySelector('#integration-run'),
  moduleGrid: document.querySelector('#module-grid'),
  moduleSummary: document.querySelector('#module-summary'),
  runLog: document.querySelector('#run-log'),
  runSummary: document.querySelector('#run-summary'),
  stepList: document.querySelector('#step-list'),
  toast: document.querySelector('#toast')
};

const terminalStatuses = new Set(['passed', 'failed', 'cancelled']);
const statusLabels = {
  cancelled: '已取消',
  failed: '失敗',
  passed: '通過',
  pending: '等待中',
  queued: '排隊中',
  running: '執行中'
};

async function fetchJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.method && options.method !== 'GET') {
    headers.set('content-type', 'application/json');
    headers.set('X-Pixiu-Test-Token', state.token);
  }
  const response = await fetch(url, { ...options, headers });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 4200);
}

function formatDuration(run) {
  if (!run.startedAt) {
    return '尚未開始';
  }
  const end = run.finishedAt ? Date.parse(run.finishedAt) : Date.now();
  const elapsed = Math.max(0, end - Date.parse(run.startedAt));
  if (elapsed < 1000) {
    return `${elapsed} ms`;
  }
  return `${(elapsed / 1000).toFixed(1)} 秒`;
}

function statusClass(status) {
  return `status-${status || 'pending'}`;
}

function updateBusyState() {
  const busy = Boolean(state.activeRun && !terminalStatuses.has(state.activeRun.status));
  document.querySelectorAll('[data-run-module]').forEach((button) => {
    button.disabled = busy;
  });
  elements.integrationRun.disabled = busy;
  elements.cancelRun.hidden = !busy;
  elements.healthDot.classList.toggle('is-busy', busy);
  elements.healthLabel.textContent = busy ? '測試執行中' : '服務正常';
}

function renderModules() {
  const modules = state.modules.filter((module) => module.kind === 'module');
  elements.moduleSummary.textContent = `${modules.length} 個可獨立執行模組`;
  elements.moduleGrid.replaceChildren(...modules.map((module) => {
    const latest = state.latestResults.get(module.id);
    const card = document.createElement('article');
    card.className = 'module-card';

    const heading = document.createElement('div');
    heading.className = 'module-card-heading';
    heading.innerHTML = `
      <div>
        <p class="module-meta">約 ${module.estimatedMinutes} 分鐘</p>
        <h3>${module.name}</h3>
      </div>
      <span class="status-pill ${statusClass(latest?.status)}">${latest ? statusLabels[latest.status] : '未執行'}</span>
    `;

    const description = document.createElement('p');
    description.className = 'module-description';
    description.textContent = module.description;

    const footer = document.createElement('div');
    footer.className = 'module-card-footer';
    const latestText = document.createElement('small');
    latestText.textContent = latest ? `最近耗時 ${formatDuration(latest)}` : '尚無本次啟動後紀錄';
    const button = document.createElement('button');
    button.className = 'module-button';
    button.type = 'button';
    button.dataset.runModule = module.id;
    button.textContent = '執行此模組';
    button.addEventListener('click', () => startRun(module.id));
    footer.append(latestText, button);

    card.append(heading, description, footer);
    return card;
  }));
  updateBusyState();
}

function renderRun(run) {
  state.activeRun = run;
  if (!run) {
    elements.runSummary.textContent = '尚未執行測試。';
    elements.stepList.replaceChildren();
    elements.runLog.textContent = '等待測試輸出…';
    updateBusyState();
    return;
  }

  elements.runSummary.textContent = `${run.moduleName}｜${statusLabels[run.status]}｜${formatDuration(run)}`;
  elements.runLog.textContent = run.log || '測試程序已啟動，等待輸出…';
  elements.runLog.scrollTop = elements.runLog.scrollHeight;
  elements.stepList.replaceChildren(...run.steps.map((step) => {
    const row = document.createElement('div');
    row.className = 'step-row';
    row.innerHTML = `
      <span class="step-indicator ${statusClass(step.status)}"></span>
      <strong>${step.label}</strong>
      <span>${statusLabels[step.status]}</span>
      <small>${step.exitCode === null ? '' : `exit ${step.exitCode}`}</small>
    `;
    return row;
  }));

  if (terminalStatuses.has(run.status)) {
    state.latestResults.set(run.moduleId, run);
    if (run.moduleId === 'integration-all') {
      for (const step of run.steps) {
        if (terminalStatuses.has(step.status)) {
          state.latestResults.set(step.moduleId, {
            ...run,
            moduleId: step.moduleId,
            status: step.status,
            startedAt: step.startedAt,
            finishedAt: step.finishedAt
          });
        }
      }
    }
    renderModules();
  }
  updateBusyState();
}

async function pollRun(runId) {
  window.clearTimeout(state.pollTimer);
  try {
    const payload = await fetchJson(`/api/runs/${runId}`);
    renderRun(payload.run);
    if (!terminalStatuses.has(payload.run.status)) {
      state.pollTimer = window.setTimeout(() => pollRun(runId), 900);
    }
  } catch (error) {
    showToast(error.message);
    state.pollTimer = window.setTimeout(() => pollRun(runId), 1800);
  }
}

async function startRun(moduleId) {
  try {
    const payload = await fetchJson('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ moduleId })
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
    await pollRun(payload.run.id);
  } catch (error) {
    showToast(error.message);
  }
}

async function initialize() {
  try {
    const session = await fetchJson('/api/session');
    state.token = session.token;
    const modulePayload = await fetchJson('/api/modules');
    state.modules = modulePayload.modules;
    state.activeRun = modulePayload.activeRun;
    renderModules();
    renderRun(state.activeRun);
    if (state.activeRun && !terminalStatuses.has(state.activeRun.status)) {
      await pollRun(state.activeRun.id);
    }
  } catch (error) {
    elements.healthLabel.textContent = '服務連線失敗';
    elements.healthDot.classList.add('is-error');
    showToast(error.message);
  }
}

elements.integrationRun.addEventListener('click', () => startRun('integration-all'));
elements.cancelRun.addEventListener('click', cancelRun);
initialize();
