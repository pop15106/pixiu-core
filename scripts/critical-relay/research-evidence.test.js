'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {atomicJson,readJson}=require('./test-plan');
const {initializeFallback}=require('./relay-evidence');
const {captureResearchEvidence}=require('./research-evidence');
const {verifyStateEvidence}=require('./evidence-verifier');
const {evaluateCriticalRelay,recordCriticalRelayPhase,checkFile}=require('./critical-relay');
const {recordEvent,advanceStage}=require('./lifecycle');
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cr-research-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'source.txt'),'Neutral primary-source excerpt.');
  atomicJson(root,'research.json',{schemaVersion:'pixiu.research-plan.v1',id:'research',revision:1,
    criteria:[{id:'criterion-a',criterion:'確認來源'}],sources:[{id:'source-a',file:'source.txt',locator:'repo:source',criterionRefs:['criterion-a']}]});
  const initial=initializeFallback(root,'research.json',{lifecycleOptions:{taskType:'research',depth:'quick'}});
  return {root,initial,binding:readJson(root,'.cr/verification-binding.json')};
}
function complete(f){
  const state=captureResearchEvidence(f.root,f.initial),ref=state.evidence[0].id;
  state.claims=[{id:'claim-a',statement:'中性來源已回讀',status:'supported',evidenceRefs:[ref],challengeRefs:['challenge-a'],counterEvidenceRefs:[]}];
  state.challenges=[{id:'challenge-a',claimRefs:['claim-a'],severity:'high',status:'resolved',method:'檢查來源空白及變動',result:'負例確實阻擋'}];
  const record=e=>state.lifecycle=recordEvent(state.lifecycle,e,state);
  record({id:'source',kind:'source_check',claimRefs:['claim-a'],evidenceRefs:[ref],method:'逐字回讀',result:'有內容'});
  record({id:'countersearch',kind:'countersearch',queries:['empty source','changed source'],outcome:'NOT_FOUND',method:'檢查 fixture 原文',result:'限定本機 fixture，未推論外部事實'});
  state.lifecycle=advanceStage(state.lifecycle,state);
  record({id:'review',kind:'evidence_review',evidenceRefs:[ref],outcome:'PASS',method:'比對 digest',result:'一致'});
  record({id:'rechallenge',kind:'rechallenge',challengeRefs:['challenge-a'],method:'重查來源',result:'未變'});
  state.lifecycle=advanceStage(state.lifecycle,state);recordCriticalRelayPhase(state,'RECHALLENGE');return state;
}
test('純研究在無 Git、無 Node 測試下完成來源與 CR 閘門',t=>{
  const f=fixture(t),state=complete(f);assert.equal(state.mode,'general');assert.equal(state.executionContract,undefined);assert.deepEqual(state.tests,[]);
  assert.equal(verifyStateEvidence(state,f.root,f.binding).canComplete,true);
  assert.equal(evaluateCriticalRelay(state).canComplete,true,JSON.stringify(evaluateCriticalRelay(state)));
  atomicJson(f.root,'.cr/state.json',state);
  const cli=require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,'critical-relay.js'),'check','.cr/state.json'],{cwd:f.root,encoding:'utf8',windowsHide:true});assert.equal(cli.status,0,cli.stdout+cli.stderr);
});
test('來源改變、binding 移除或驗收計畫替換皆不得完成',t=>{
  const f=fixture(t),state=complete(f);
  fs.writeFileSync(path.join(f.root,'source.txt'),'new contrary excerpt');
  assert.equal(verifyStateEvidence(state,f.root,f.binding).canComplete,false);
  const updated=captureResearchEvidence(f.root,state);assert.equal(updated.lifecycle.cycle,2);assert.equal(evaluateCriticalRelay(updated).canComplete,false);
  assert.equal(updated.researchHistory.length,2);assert.equal(updated.lifecycle.entries.length,state.lifecycle.entries.length);
  const downgrade={...state,researchRequired:false};delete downgrade.researchBinding;
  assert.equal(verifyStateEvidence(downgrade,f.root,f.binding).canComplete,false);
  const plan=readJson(f.root,'research.json');plan.criteria[0].criterion='改成容易條件';atomicJson(f.root,'research.json',plan);
  assert.equal(verifyStateEvidence(state,f.root,f.binding).canComplete,false);
});
test('正式 workflow 支援研究契約與完成閘門',async t=>{
  const f=fixture(t),state=complete(f);const {createWorkflowController}=await import('../devspace-portable/DevSpace.WorkflowStore.mjs');
  const controller=createWorkflowController({stateDirectory:path.join(f.root,'.cr/workflow')}),base={workspaceRoot:f.root,sessionRef:'research',actor:'producer'};
  let task=await controller.createTask({...base,scope:'same_project',objective:'研究驗收',acceptanceCriteria:['來源'],criticalRelayRequired:true,criticalRelay:f.initial,requireReview:false,idempotencyKey:'research-create-001'});
  task=await controller.updateTask({...base,taskId:task.taskId,expectedRevision:task.revision,action:'claim',idempotencyKey:'research-claim-001'});
  task=await controller.updateTask({...base,taskId:task.taskId,expectedRevision:task.revision,action:'complete',criticalRelay:state,idempotencyKey:'research-complete-001'});
  assert.equal(task.status,'completed');
});

test('研究交接若原文改變，接手時清除驗收且保留歷史',async t=>{
  const f=fixture(t),state=complete(f);const {createWorkflowController}=await import('../devspace-portable/DevSpace.WorkflowStore.mjs');
  const controller=createWorkflowController({stateDirectory:path.join(f.root,'.cr/workflow')}),base={workspaceRoot:f.root,sessionRef:'research',actor:'producer'};
  let task=await controller.createTask({...base,scope:'same_project',objective:'研究交接',acceptanceCriteria:['來源'],criticalRelayRequired:true,criticalRelay:state,requireReview:false,idempotencyKey:'research-handoff-create'});
  task=await controller.updateTask({...base,taskId:task.taskId,expectedRevision:task.revision,action:'claim',idempotencyKey:'research-handoff-claim'});
  const rewritten=structuredClone(state);rewritten.researchHistory=[];
  await assert.rejects(controller.updateTask({...base,taskId:task.taskId,expectedRevision:task.revision,action:'handoff',toActor:'receiver',contextSnapshot:'中性來源',deliverables:['source'],openItems:[],requiredNextAction:'重讀',criticalRelay:rewritten,idempotencyKey:'research-bad-history'}),/RESEARCH_HISTORY_REWRITTEN/);
  task=await controller.updateTask({...base,taskId:task.taskId,expectedRevision:task.revision,action:'handoff',toActor:'receiver',contextSnapshot:'中性來源',deliverables:['source'],openItems:[],requiredNextAction:'重讀',criticalRelay:state,idempotencyKey:'research-handoff-next'});
  fs.writeFileSync(path.join(f.root,'source.txt'),'contrary source');
  task=await controller.updateTask({...base,actor:'receiver',taskId:task.taskId,expectedRevision:task.revision,action:'acknowledge',idempotencyKey:'research-handoff-ack'});
  assert.equal(task.criticalRelay.researchVerification,null);assert.equal(task.criticalRelay.researchHistory.length,1);assert.equal(task.criticalRelay.phase,'REASSESS');
});

// 從正式事件 API 建立尚未驗證的研究狀態，覆蓋 PR #15 的來源變動反例。
function researchInProgress(f,stage='verification'){
  const state=captureResearchEvidence(f.root,f.initial),ref=state.evidence[0].id;
  state.claims=[{id:'claim-a',statement:'來源內容已核對',status:'supported',evidenceRefs:[ref],challengeRefs:['challenge-a'],counterEvidenceRefs:[]}];
  state.challenges=[{id:'challenge-a',claimRefs:['claim-a'],severity:'high',status:'resolved',method:'核對來源版本',result:'目前仍為初版來源'}];
  const record=event=>state.lifecycle=recordEvent(state.lifecycle,event,state);
  record({id:'source-before-change',kind:'source_check',claimRefs:['claim-a'],evidenceRefs:[ref],method:'回讀初版來源',result:'初版有內容'});
  if(stage!=='source_check')record({id:'counter-before-change',kind:'countersearch',queries:['changed source','stale review'],outcome:'NOT_FOUND',method:'查找初版來源的反例',result:'僅限測試來源，未推論外部事實'});
  if(stage==='verification')state.lifecycle=advanceStage(state.lifecycle,state);
  return state;
}

for(const stage of ['source_check','countersearch','verification']){
  test(`研究在 ${stage} 後改源必須重開週期，舊事件不能直接完成`,t=>{
    const f=fixture(t),state=researchInProgress(f,stage),before=structuredClone(state);
    assert.deepEqual(captureResearchEvidence(f.root,state),state);
    fs.writeFileSync(path.join(f.root,'source.txt'),'Revised primary-source excerpt.');
    const updated=captureResearchEvidence(f.root,state);
    assert.equal(updated.lifecycle.cycle,state.lifecycle.cycle+1);
    assert.equal(updated.lifecycle.stage,'research');
    assert.deepEqual(updated.lifecycle.entries,state.lifecycle.entries);
    assert.deepEqual(updated.researchHistory.slice(0,-1),state.researchHistory);
    assert.notEqual(updated.researchVerification.digest,state.researchVerification.digest);
    assert.doesNotThrow(()=>require('./lifecycle').assertLifecycleTransition(state.lifecycle,updated.lifecycle));
    assert.equal(evaluateCriticalRelay(updated).canComplete,false);
    assert.throws(()=>advanceStage(updated.lifecycle,updated),/LIFECYCLE_STAGE_BLOCKED/);
    assert.throws(()=>recordEvent(updated.lifecycle,{id:'reuse-review',kind:'evidence_review',evidenceRefs:updated.completionCriteria[0].evidenceRefs,outcome:'PASS',method:'只補驗證事件',result:'嘗試沿用舊研究'},updated),/LIFECYCLE_EVENT_INVALID/);
    assert.deepEqual(state,before);
  });
}

test('尚無研究事件的來源更新保持原週期，相同內容回讀不追加歷史',t=>{
  const f=fixture(t),state=captureResearchEvidence(f.root,f.initial);
  fs.writeFileSync(path.join(f.root,'source.txt'),'Updated before any research event.');
  const updated=captureResearchEvidence(f.root,state);
  assert.equal(updated.lifecycle.cycle,1);
  assert.deepEqual(updated.lifecycle.entries,[]);
  assert.equal(updated.researchHistory.length,2);
  assert.deepEqual(captureResearchEvidence(f.root,updated),updated);
});

test('新週期尚無事件時再次改源，不因舊週期紀錄重複開輪',t=>{
  const f=fixture(t),state=researchInProgress(f);
  fs.writeFileSync(path.join(f.root,'source.txt'),'Second source revision.');
  const reopened=captureResearchEvidence(f.root,state);
  assert.equal(reopened.lifecycle.cycle,2);
  fs.writeFileSync(path.join(f.root,'source.txt'),'Third source revision.');
  const updated=captureResearchEvidence(f.root,reopened);
  assert.equal(updated.lifecycle.cycle,2);
  assert.deepEqual(updated.lifecycle,reopened.lifecycle);
  assert.equal(updated.researchHistory.length,3);
});

test('正式 sources CLI 在驗證前改源後阻擋跳階及完成',t=>{
  const f=fixture(t),state=researchInProgress(f);
  atomicJson(f.root,'.cr/state.json',state);
  fs.writeFileSync(path.join(f.root,'source.txt'),'Changed before verification events.');
  const cli=(file,...args)=>require('node:child_process').spawnSync(process.execPath,[path.join(__dirname,file),...args],{cwd:f.root,encoding:'utf8',windowsHide:true});
  const captured=cli('relay-evidence.js','sources');
  assert.equal(captured.status,0,captured.stdout+captured.stderr);
  const updated=readJson(f.root,'.cr/state.json');
  assert.equal(updated.lifecycle.cycle,2);
  assert.equal(updated.lifecycle.stage,'research');
  assert.deepEqual(updated.lifecycle.entries,state.lifecycle.entries);
  const advance=cli('lifecycle-cli.js','advance');
  assert.equal(advance.status,2,advance.stdout+advance.stderr);
  assert.match(advance.stderr,/LIFECYCLE_STAGE_BLOCKED/);
  const gate=cli('critical-relay.js','check','.cr/state.json');
  assert.notEqual(gate.status,null,gate.error?.message);
  assert.notEqual(gate.status,0,gate.stdout+gate.stderr);
});

test('改源後重新研究與反證可以完成，舊歷史仍完整保留',t=>{
  const f=fixture(t),state=researchInProgress(f);
  fs.writeFileSync(path.join(f.root,'source.txt'),'New source reviewed in the next cycle.');
  const updated=captureResearchEvidence(f.root,state),refs=updated.completionCriteria[0].evidenceRefs;
  assert.equal(updated.lifecycle.cycle,2);
  updated.claims[0].evidenceRefs=[...refs];
  updated.challenges[0].result='重新核對新來源，舊事件不能跳過研究';
  const record=event=>updated.lifecycle=recordEvent(updated.lifecycle,event,updated);
  record({id:'source-after-change',kind:'source_check',claimRefs:['claim-a'],evidenceRefs:refs,method:'回讀新來源',result:'內容與新摘要一致'});
  record({id:'counter-after-change',kind:'countersearch',queries:['new source contradiction','stale lifecycle entries'],outcome:'NOT_FOUND',method:'重新查找新來源反例',result:'限定本輪測試來源，未找到反證'});
  updated.lifecycle=advanceStage(updated.lifecycle,updated);
  record({id:'review-after-change',kind:'evidence_review',evidenceRefs:refs,outcome:'PASS',method:'核對本輪來源快照',result:'摘要一致'});
  record({id:'rechallenge-after-change',kind:'rechallenge',challengeRefs:['challenge-a'],method:'再次核對原文與週期',result:'新來源已重新研究'});
  updated.lifecycle=advanceStage(updated.lifecycle,updated);
  recordCriticalRelayPhase(updated,'RECHALLENGE');
  assert.equal(verifyStateEvidence(updated,f.root,f.binding).canComplete,true);
  const gate=evaluateCriticalRelay(updated);
  assert.equal(gate.canComplete,true,JSON.stringify(gate));
  assert.deepEqual(updated.lifecycle.entries.slice(0,state.lifecycle.entries.length),state.lifecycle.entries);
  assert.doesNotThrow(()=>require('./lifecycle').assertLifecycleTransition(state.lifecycle,updated.lifecycle));
});
