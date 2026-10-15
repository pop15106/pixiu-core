import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { prepareSessionBundle, baselineDigests } from '../prepare-session-workflow-cr.mjs';
import { verifyBundle, installBundle, rollbackBundle, sessionWorkflowFiles } from '../workflow-bundle.mjs';
import support from '../../critical-relay/test-support.js';
import stateTools from '../../critical-relay/relay-evidence.js';
import runner from '../../critical-relay/test-runner.js';
import relay from '../../critical-relay/critical-relay.js';

// 需明確指定已核對的舊 runtime；不搜尋憑證，不自動採用其他帳本。
const baseline = process.env.PIXIU_SESSION_BASELINE_DIR;
assert.ok(baseline, '需以 PIXIU_SESSION_BASELINE_DIR 指定已授權的 schema 3 runtime');
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(),'pixiu-session-cr-suite-'));
const bundle = path.join(suiteRoot,'bundle');
prepareSessionBundle(repo,baseline,bundle);
const {default: bundledRunner}=await import(pathToFileURL(path.join(bundle,'scripts/critical-relay/test-runner.js')).href);
const {default: bundledStateTools}=await import(pathToFileURL(path.join(bundle,'scripts/critical-relay/relay-evidence.js')).href);
const {default: bundledVerifier}=await import(pathToFileURL(path.join(bundle,'scripts/critical-relay/evidence-verifier.js')).href);
const core = await import(pathToFileURL(path.join(bundle,'scripts/devspace-portable/SessionWorkflow.Core.mjs')).href);
const adapter = await import(pathToFileURL(path.join(bundle,'scripts/devspace-portable/DevSpace.WorkflowStore.mjs')).href);
const bridge = await import(pathToFileURL(path.join(bundle,'scripts/devspace-portable/SessionWorkflow.CrBridge.mjs')).href);
test.after(()=>fs.rmSync(suiteRoot,{recursive:true,force:true}));
const hash = bytes=>createHash('sha256').update(bytes).digest('hex');

function fixture(t) {
  let f;
  // 家用機 Node 24.13 的遞迴刪除 Git fixture 已實測原生退出；改以獨立 PowerShell 清理本案例目錄。
  // 只接受 makeFixture 建立的系統暫存目錄，清理失敗仍使測試失敗。
  const lifecycle = { after() { t.after(() => {
    if (process.platform !== 'win32') return fs.rmSync(f.root,{recursive:true,force:true});
    if (path.dirname(f.root) !== os.tmpdir() || !path.basename(f.root).startsWith('pixiu 證據 fixture ')) throw new Error('FIXTURE_CLEANUP_SCOPE');
    execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$ErrorActionPreference='Stop'; Remove-Item -LiteralPath '${f.root.replaceAll("'","''")}' -Recurse -Force`],{windowsHide:true,timeout:15000});
  }); } };
  f = support.makeFixture(lifecycle);
  const stateDirectory=path.join(f.root,'.cr/ledger');
  const controller=adapter.createWorkflowController({stateDirectory});
  const state=stateTools.createEvidenceState(f.root,f.planPath);
  const base={workspaceRoot:f.root,projectRef:core.projectRefFromPath(f.root),sessionRef:'compatibility-fixture',actor:'producer'};
  return {...f,stateDirectory,controller,state,base};
}
function input(f,extra={}) {return {...f.base,scope:'same_project',objective:'中性相容性驗證',acceptanceCriteria:['原事件完整性及 CR 閘門'],requireReview:false,policy:{},idempotencyKey:randomUUID(),...extra};}
async function create(f,extra={}) {return f.controller.createTask(input(f,{criticalRelayRequired:true,criticalRelay:f.state,...extra}));}
async function update(f,task,action,extra={}) {return f.controller.updateTask({...f.base,taskId:task.taskId,expectedRevision:task.revision,action,idempotencyKey:randomUUID(),...extra});}
function ledgerBytes(f) {const target=path.join(f.stateDirectory,'workflow-events.jsonl');return fs.existsSync(target)?fs.readFileSync(target):Buffer.alloc(0);}
async function verified(f) {
  const result=await bundledRunner.runPlan({workspaceRoot:f.root,planPath:f.planPath});
  assert.equal(result.outcome,'PASS');
  assert.equal(bundledVerifier.verifyRun(f.root,f.binding,result).canComplete,true,'反例注入前先確認有效的原始證據');
  const state=bundledStateTools.applyRunEvidence(f.root,f.state,result);
  const evidence=state.evidence.at(-1).id;
  state.claims=[{id:'claim-fixture',statement:'中性測試已真正通過',status:'supported',evidenceRefs:[evidence],challengeRefs:['challenge-fixture'],counterEvidenceRefs:[]}];
  state.challenges=[{id:'challenge-fixture',claimRefs:['claim-fixture'],severity:'high',status:'resolved',method:'本檔另以缺檔與版本變動測試拒絕路徑',result:'中性正常流程通過'}];
  relay.recordCriticalRelayPhase(state,'RECHALLENGE');state.status='ready';
  assert.equal(relay.evaluateCriticalRelay(state).canComplete,true,JSON.stringify(relay.evaluateCriticalRelay(state)));
  return {state,result};
}

test('指定已知三個舊模組；未知版本在建立目的地前拒絕',t=>{
  const dir=fs.mkdtempSync(path.join(suiteRoot,'bad-source-'));
  for(const name of Object.keys(baselineDigests))fs.copyFileSync(path.join(baseline,name),path.join(dir,name));
  fs.appendFileSync(path.join(dir,'SessionWorkflow.Core.mjs'),'\n// 中性變動');
  const destination=path.join(dir,'new');
  assert.throws(()=>prepareSessionBundle(repo,dir,destination),/BASELINE_CHANGED/);
  assert.equal(fs.existsSync(destination),false);
});

test('compatibility 套件包括 18 個模組並保留 takeover 與專案解析註冊',()=>{
  assert.equal(verifyBundle(bundle).files.length,sessionWorkflowFiles.length);
  assert.deepEqual(adapter.criticalRelayRuntime.ledgerSchemas,[1,2,3]);
  const source=fs.readFileSync(path.join(bundle,'scripts/devspace-portable/DevSpace.WorkflowStore.mjs'),'utf8');
  for(const text of ['workflow_takeover','project_resolve','criticalRelayRequired: z.boolean()','workspaceRoot: workspace.workspaceRoot'])assert.ok(source.includes(text));
});

test('CR 缺少狀態或必要計劃時建立失敗，不留下任務',async t=>{
  const f=fixture(t);
  await assert.rejects(create(f,{criticalRelay:undefined}),/SESSION_CR/);
  const broken=structuredClone(f.state);broken.executionContract.verificationBinding.planDigest='a'.repeat(64);
  await assert.rejects(create(f,{criticalRelay:broken}));
  assert.equal(ledgerBytes(f).length,0);
});

test('新任務仍為 schema 3，claim 正常且 required 不可降級',async t=>{
  const f=fixture(t);let task=await create(f);assert.equal(task.schemaVersion,3);
  task=await update(f,task,'claim');const before=ledgerBytes(f);
  await assert.rejects(update(f,task,'complete',{criticalRelayRequired:false}),/不可降級/);
  assert.deepEqual(ledgerBytes(f),before);
  assert.equal(task.criticalRelayRequired,true);
});

test('只有欄位 passed 無真實證據不能 complete',async t=>{
  const f=fixture(t);let task=await create(f);task=await update(f,task,'claim');const before=ledgerBytes(f);
  await assert.rejects(update(f,task,'complete'),/閘門/);
  assert.deepEqual(ledgerBytes(f),before);
});

test('真實測試與 RECHALLENGE 可完成；同 revision 競爭只提交一次',async t=>{
  const f=fixture(t);let task=await create(f);task=await update(f,task,'claim');
  const {state}=await verified(f);
  const replies=await Promise.allSettled([update(f,task,'complete',{criticalRelay:state}),update(f,task,'complete',{criticalRelay:state})]);
  assert.equal(replies.filter(x=>x.status==='fulfilled').length,1,replies.map(x=>x.reason?.stack).join('\n'));
  const done=replies.find(x=>x.status==='fulfilled').value;
  assert.equal(done.status,'completed');assert.equal(done.schemaVersion,3);
  assert.equal(ledgerBytes(f).toString().trim().split('\n').length,3);
});

test('移除原始輸出時正式 core 完成入口拒絕，帳本未變動',async t=>{
  const f=fixture(t);let task=await create(f);task=await update(f,task,'claim');const {state,result}=await verified(f);
  fs.unlinkSync(path.join(f.root,result.commands[0].stdoutPath));const before=ledgerBytes(f);
  await assert.rejects(update(f,task,'complete',{criticalRelay:state}),/原始證據/);
  assert.deepEqual(ledgerBytes(f),before);
});

test('extension mutateTask 也不能繞過 CR 完成閘門',async t=>{
  const f=fixture(t);let task=await create(f);task=await update(f,task,'claim');const before=ledgerBytes(f);
  await assert.rejects(f.controller.extensions.mutateTask({...f.base,taskId:task.taskId,expectedRevision:task.revision,action:'custom_complete',idempotencyKey:randomUUID()},current=>({...current,status:'completed'})),/閘門/);
  assert.deepEqual(ledgerBytes(f),before);
});

test('extension mutateLatestTask 不能刪除 CR 再完成',async t=>{
  const f=fixture(t);const task=await create(f);const before=ledgerBytes(f);
  await assert.rejects(f.controller.extensions.mutateLatestTask({...f.base,taskId:task.taskId,action:'custom_bypass',idempotencyKey:randomUUID()},current=>({...current,criticalRelayRequired:false,status:'completed'})),/移除/);
  assert.deepEqual(ledgerBytes(f),before);
});

test('CR 新增多專案或錯根目錄時明確拒絕',async t=>{
  const f=fixture(t);
  await assert.rejects(create(f,{scope:'cross_project',relatedProjectRefs:['project:other']}),/多專案/);
  await assert.rejects(create(f,{projectRef:'project:wrong'}),/專案與驗證/);
  assert.equal(ledgerBytes(f).length,0);
});

test('非持有者無法夾帶證據更新；必要 binding 不能被替換',async t=>{
  const f=fixture(t);let task=await create(f);task=await update(f,task,'claim');const changed=structuredClone(f.state);
  changed.executionContract.verificationBinding.planDigest='b'.repeat(64);
  await assert.rejects(update(f,task,'block',{criticalRelay:changed,reason:'中性測試'}));
  await assert.rejects(f.controller.extensions.mutateTask({...f.base,actor:'other',criticalRelay:f.state,taskId:task.taskId,expectedRevision:task.revision,action:'metadata_change',idempotencyKey:randomUUID()},current=>current),/持有者/);
});

test('交接保留狀態，來源改變後接手必須重驗',async t=>{
  const f=fixture(t);let task=await create(f);task=await update(f,task,'claim');const {state}=await verified(f);
  task=await update(f,task,'handoff',{criticalRelay:state,toActor:'receiver',contextSnapshot:'中性回歸',deliverables:['fixture'],openItems:[],requiredNextAction:'回讀來源'});
  fs.writeFileSync(path.join(f.root,'new.txt'),'新來源');
  task=await update(f,task,'acknowledge',{actor:'receiver'});
  assert.equal(task.criticalRelay.phase,'REASSESS');
  assert.equal(task.criticalRelay.executionContract.verification,null);
});

test('原非 CR 任務的建立、接手與完成不被改成 CR',async t=>{
  const f=fixture(t);let task=await f.controller.createTask(input(f));task=await update(f,task,'claim');task=await update(f,task,'complete');
  assert.equal(task.status,'completed');assert.equal(task.criticalRelayRequired,undefined);
});

test('舊 ledger 鎖即使過期仍保留，不按時間刪除未知持有者',async t=>{
  const f=fixture(t);fs.mkdirSync(f.stateDirectory,{recursive:true});const lock=path.join(f.stateDirectory,'workflow.lock');
  fs.writeFileSync(lock,'中性未知舊鎖');fs.utimesSync(lock,new Date(0),new Date(0));
  await assert.rejects(f.controller.createTask(input(f)),/保留原鎖/);
  assert.equal(fs.readFileSync(lock,'utf8'),'中性未知舊鎖');
});

test('相容套件安裝與回復保留原入口及帳本 bytes',t=>{
  const bin=fs.mkdtempSync(path.join(suiteRoot,'install-'));
  const original='export const old=true;';fs.writeFileSync(path.join(bin,'DevSpace.WorkflowStore.mjs'),original);
  fs.writeFileSync(path.join(bin,'workflow-events.jsonl'),'中性帳本');
  const receipt=installBundle(bundle,bin);assert.equal(receipt.compatibilityProfile,'session-workflow-v3-cr-v1');
  rollbackBundle(bin,receipt.receiptId);
  assert.equal(fs.readFileSync(path.join(bin,'DevSpace.WorkflowStore.mjs'),'utf8'),original);
  assert.equal(fs.readFileSync(path.join(bin,'workflow-events.jsonl'),'utf8'),'中性帳本');
});

test('原 schema 3 專案與角色回歸案例直接使用 patched core',()=>{
  const source=process.env.PIXIU_SESSION_CORE_REGRESSION;
  assert.ok(source,'需指定原核心的 core-project-scope.test.mjs');
  const text=fs.readFileSync(source,'utf8');assert.equal(text.split('../core/index.mjs').length,2);
  const copied=path.join(suiteRoot,'original-scope.test.mjs');
  const coreUrl=pathToFileURL(path.join(bundle,'scripts/devspace-portable/SessionWorkflow.Core.mjs')).href;
  fs.writeFileSync(copied,text.replace('../core/index.mjs',coreUrl));
  const result=execFileSync(process.execPath,['--test','--test-reporter=tap',copied],{encoding:'utf8',windowsHide:true,timeout:60000,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('NODE_TEST')))});
  assert.match(result,/# fail 0/);console.log(result.trim());
});
