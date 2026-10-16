import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createWorkflowController } from '../DevSpace.WorkflowStore.mjs';
import fixtures from '../../critical-relay/test-support.js';
import relay from '../../critical-relay/relay-evidence.js';
import runner from '../../critical-relay/test-runner.js';
import cr from '../../critical-relay/critical-relay.js';
import lifecycle from '../../critical-relay/lifecycle.js';

const {makeFixture}=fixtures;
const {createEvidenceState,applyRunEvidence}=relay;
const {runPlan}=runner;
const {recordCriticalRelayPhase,evaluateCriticalRelay}=cr;
const {lifecycleBinding,recordEvent,advanceStage}=lifecycle;

async function setup(t,lifecycleOptions={taskType:'development',depth:'standard'}) {
  const f=makeFixture(t);
  const state=createEvidenceState(f.root,f.planPath,{objective:'中性 CR 開發',scope:['sample-0.test.js'],
    lifecycleOptions});
  const controller=createWorkflowController({stateDirectory:path.join(f.root,'.cr/workflow')});
  const base={workspaceRoot:f.root,sessionRef:'lifecycle-session',actor:'producer'};
  const task=await controller.createTask({...base,scope:'same_project',objective:'中性驗收',
    acceptanceCriteria:['有來源及反證'],criticalRelayRequired:true,requireReview:false,
    criticalRelay:state,idempotencyKey:'new-lifecycle-task-001'});
  return {...f,state,controller,base,task};
}
test('createTask 固定 lifecycle 風險與方案，試圖刪除或降級不得提交',async t=>{
  const f=await setup(t);
  assert.deepEqual(f.task.lifecycleBinding,lifecycleBinding(f.state.lifecycle));
  const claimed=await f.controller.updateTask({...f.base,taskId:f.task.taskId,action:'claim',
    expectedRevision:1,idempotencyKey:'claim-lifecycle-001'});
  const no=structuredClone(claimed.criticalRelay);
  delete no.lifecycle;delete no.lifecycleRequired;
  await assert.rejects(f.controller.updateTask({...f.base,taskId:claimed.taskId,
    action:'complete',expectedRevision:claimed.revision,criticalRelay:no,
    idempotencyKey:'remove-lifecycle-001'}),/lifecycle binding/i);
  const lower=structuredClone(claimed.criticalRelay);lower.lifecycle.depth='quick';
  await assert.rejects(f.controller.updateTask({...f.base,taskId:claimed.taskId,
    action:'complete',expectedRevision:claimed.revision,criticalRelay:lower,
    idempotencyKey:'lower-lifecycle-001'}),/lifecycle binding/i);
  const after=await f.controller.getTask({...f.base,taskId:claimed.taskId});
  assert.equal(after.revision,claimed.revision);
});
test('不能只手填測試 passed，缺研究／開發決策仍不算完成',async t=>{
  const f=await setup(t);
  const claimed=await f.controller.updateTask({...f.base,taskId:f.task.taskId,action:'claim',
    expectedRevision:f.task.revision,idempotencyKey:'claim-lifecycle-002'});
  await assert.rejects(f.controller.updateTask({...f.base,taskId:f.task.taskId,
    action:'complete',expectedRevision:claimed.revision,idempotencyKey:'fake-pass-002'}),/completion gate blocked/);
});
test('原有任務沒有 lifecycle 時仍可建立並依原方式操作',async t=>{
  const f=makeFixture(t),state=createEvidenceState(f.root,f.planPath);
  const controller=createWorkflowController({stateDirectory:path.join(f.root,'.cr/workflow')});
  const task=await controller.createTask({workspaceRoot:f.root,scope:'same_project',sessionRef:'legacy-session',
    actor:'producer',objective:'原 CR 任務',acceptanceCriteria:['保留'],
    criticalRelayRequired:true,criticalRelay:state,idempotencyKey:'legacy-lifecycle-001'});
  assert.equal(task.lifecycleBinding,undefined);
});
test('真實 runner → 研究／設計／開發／驗證 → CR 及 ledger 完成閘門',async t=>{
  const f=await setup(t);
  const claimed=await f.controller.updateTask({...f.base,taskId:f.task.taskId,action:'claim',
    expectedRevision:1,idempotencyKey:'claim-e2e-lifecycle-001'});
  const result=await runPlan({workspaceRoot:f.root,planPath:f.planPath});
  assert.equal(result.outcome,'PASS');
  const state=applyRunEvidence(f.root,f.state,result),evidenceId=state.evidence.at(-1).id;
  state.claims=[{id:'claim-fixture',statement:'中性真實測試已通過',status:'supported',
    evidenceRefs:[evidenceId],challengeRefs:['challenge-fixture'],counterEvidenceRefs:[]}];
  state.challenges=[{id:'challenge-fixture',claimRefs:['claim-fixture'],severity:'high',
    status:'resolved',method:'中性錯誤分支反例測試',result:'拒絕假成功'}];
  const record=event=>{state.lifecycle=recordEvent(state.lifecycle,event)};
  const go=()=>{state.lifecycle=advanceStage(state.lifecycle,state)};
  record({id:'source',kind:'source_check',claimRefs:['claim-fixture'],evidenceRefs:[evidenceId],
    method:'讀 runner 原始證據',result:'可回查'});
  record({id:'search',kind:'countersearch',queries:['failure fixture','inconsistent tests'],
    outcome:'NOT_FOUND',method:'核對中性反方測試',result:'本輪未發現其他反證'});
  go();
  record({id:'options',kind:'options_review',method:'比較方案',result:'偏好真實 runner',
    options:[{id:'a',description:'只信人工 PASS',advantages:'省事',disadvantages:'無法稽核'},
      {id:'b',description:'讀原始結果',advantages:'可重現',disadvantages:'耗時'}]});
  record({id:'decision',kind:'decision',selectedId:'b',rationale:'檢查結果與版本',
    evidenceRefs:[evidenceId],challengeRefs:['challenge-fixture'],method:'比對',
    result:'使用 runner 原始證據'});
  go();
  record({id:'change',kind:'change_review',changes:['sample-0.test.js'],failureScenarios:['零測試'],
    claimRefs:['claim-fixture'],challengeRefs:['challenge-fixture'],
    method:'回讀中性 fixture',result:'範圍確認'});
  record({id:'counterexample',kind:'counterexample',challengeRefs:['challenge-fixture'],
    method:'既有 failure 測試案例',result:'失敗不會被偽裝通過'});
  go();
  record({id:'evidence',kind:'evidence_review',testRefs:['command-0'],outcome:'PASS',
    method:'正式 read-back',result:'一筆真實案例通過'});
  record({id:'rechallenge',kind:'rechallenge',challengeRefs:['challenge-fixture'],
    method:'驗證後再查錯誤情境',result:'無新阻擋項'});
  go();
  recordCriticalRelayPhase(state,'RECHALLENGE');state.status='ready';
  assert.equal(evaluateCriticalRelay(state).canComplete,true);
  const done=await f.controller.updateTask({...f.base,taskId:claimed.taskId,action:'complete',
    expectedRevision:claimed.revision,criticalRelay:state,idempotencyKey:'complete-e2e-lifecycle-001'});
  assert.equal(done.status,'completed');
  assert.deepEqual(done.lifecycleBinding,f.task.lifecycleBinding);
  const restored=await f.controller.getTask({...f.base,taskId:done.taskId});
  assert.equal(restored.criticalRelay.lifecycle.stage,'complete');
});
