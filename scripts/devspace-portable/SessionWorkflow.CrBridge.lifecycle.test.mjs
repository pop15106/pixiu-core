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
