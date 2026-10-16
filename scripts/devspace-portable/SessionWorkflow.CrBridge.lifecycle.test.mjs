import test from 'node:test';
import assert from 'node:assert/strict';
import * as bridge from './SessionWorkflow.CrBridge.mjs';
import relay from '../critical-relay/relay-evidence.js';
import fixtures from '../critical-relay/test-support.js';
import lifecycle from '../critical-relay/lifecycle.js';

function setup(t) {
  const f=fixtures.makeFixture(t);
  const state=relay.createEvidenceState(f.root,f.planPath,{scope:['sample-0.test.js'],
    lifecycleOptions:{taskType:'development',depth:'standard'}});
  const projectRef='project:fixture';
  const task={schemaVersion:3,scope:'same_project',projectRefs:[projectRef],
    currentOwner:'owner',status:'in_progress',criticalRelayRequired:true};
  const input={criticalRelay:state,actor:'owner',workspaceRoot:f.root};
  return {...f,state,projectRef,task,input};
}
test('家用機 schema3 橋接會將新 Lifecycle 政策鎖定於 task',t=>{
  const f=setup(t);
  const task=bridge.enforceCriticalRelay(null,f.task,f.input,f.projectRef,()=>f.projectRef);
  assert.deepEqual(task.lifecycleBinding,lifecycle.lifecycleBinding(f.state.lifecycle));
  assert.equal(task.criticalRelayRequired,true);
});
test('schema3 舊 Ledger 任務不可在接力時刪除或降級 Lifecycle',t=>{
  const f=setup(t);
  const prior=bridge.enforceCriticalRelay(null,f.task,f.input,f.projectRef,()=>f.projectRef);
  const removed=structuredClone(f.state);delete removed.lifecycle;delete removed.lifecycleRequired;
  assert.throws(()=>bridge.enforceCriticalRelay(prior,structuredClone(prior),
    {criticalRelay:removed,actor:'owner',workspaceRoot:f.root},
    f.projectRef,()=>f.projectRef),/Lifecycle/);
  const lower=structuredClone(f.state);lower.lifecycle.depth='quick';
  assert.throws(()=>bridge.enforceCriticalRelay(prior,structuredClone(prior),
    {criticalRelay:lower,actor:'owner',workspaceRoot:f.root},
    f.projectRef,()=>f.projectRef),/Lifecycle/);
});

test('schema3 正式更新拒絕倒退 cycle 或改寫已保存事件',t=>{
  const f=setup(t);
  f.state.evidence.push({id:'new-evidence',source:'repo:fixture/new'});
  const old=structuredClone(f.state);
  f.state.lifecycle=lifecycle.reopenLifecycle(f.state.lifecycle,{reason:'新反證',evidenceRef:'new-evidence'});
  const prior=bridge.enforceCriticalRelay(null,f.task,{...f.input,criticalRelay:f.state},f.projectRef,()=>f.projectRef);
  assert.throws(()=>bridge.enforceCriticalRelay(prior,structuredClone(prior),
    {...f.input,criticalRelay:old},f.projectRef,()=>f.projectRef),/CYCLE_REGRESSED/);
});

test('schema3 研究契約保留來源歷史，來源變動使接手驗收失效',async t=>{
  const {atomicJson}=await import('../critical-relay/test-plan.js');const fs=await import('node:fs');const path=await import('node:path');
  const research=await import('../critical-relay/research-evidence.js');const f=fixtures.makeFixture(t);
  atomicJson(f.root,'research.json',{schemaVersion:'pixiu.research-plan.v1',id:'research',revision:1,criteria:[{id:'criterion-a',criterion:'來源'}],sources:[{id:'source-a',file:'sample-0.test.js',locator:'repo:fixture',criterionRefs:['criterion-a']}]});
  const state=research.captureResearchEvidence(f.root,relay.createEvidenceState(f.root,'research.json',{lifecycleOptions:{taskType:'research',depth:'quick'}}));
  const projectRef='project:fixture',input={actor:'owner',workspaceRoot:f.root,criticalRelay:state};
  const prior=bridge.enforceCriticalRelay(null,{schemaVersion:3,scope:'same_project',projectRefs:[projectRef],currentOwner:'owner',status:'in_progress',criticalRelayRequired:true},input,projectRef,()=>projectRef);
  const broken=structuredClone(state);broken.researchHistory=[];
  assert.throws(()=>bridge.enforceCriticalRelay(prior,structuredClone(prior),{...input,criticalRelay:broken},projectRef,()=>projectRef),/RESEARCH_HISTORY_REWRITTEN/);
  fs.appendFileSync(path.join(f.root,'sample-0.test.js'),'\n// changed');
  const ack=bridge.enforceCriticalRelay(prior,structuredClone(prior),{...input,action:'acknowledge'},projectRef,()=>projectRef);
  assert.equal(ack.criticalRelay.researchVerification,null);assert.equal(ack.criticalRelay.researchHistory.length,1);
});
