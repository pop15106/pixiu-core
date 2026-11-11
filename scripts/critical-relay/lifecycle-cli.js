#!/usr/bin/env node
'use strict';

// 單一 CR fallback state 的受控 CLI；只操作 .cr 私有狀態，沒有模型／子 Agent 或背景排程。
const fs = require('node:fs');
const { readJson, atomicJson, boundedPath } = require('./test-plan');
const { withControl } = require('./run-recovery');
const { recordCriticalRelayPhase, evaluateCriticalRelay } = require('./critical-relay');
const { lifecycleBinding, verifyLifecycleBinding, recordEvent, advanceStage,
  reopenLifecycle, evaluateLifecycle } = require('./lifecycle');
const STATE = '.cr/state.json', BINDING = '.cr/lifecycle-binding.json';

function inspect(root) {
  const state = readJson(root, STATE), pin = readJson(root, BINDING);
  if (state.lifecycleRequired !== true || !verifyLifecycleBinding(pin,state.lifecycle))
    throw new Error('LIFECYCLE_BINDING_CHANGED_OR_MISSING');
  return { lifecycle: state.lifecycle, evaluation: evaluateLifecycle(state.lifecycle,state),
    overallGate: evaluateCriticalRelay(state) };
}

function update(root, action, payload) {
  if (!['record','advance','reopen'].includes(action)) throw new Error('LIFECYCLE_ACTION_INVALID');
  return withControl(root, () => {
    if (fs.existsSync(boundedPath(root,'.cr/runner.lock',{mustExist:false})))throw Error('LIFECYCLE_RUN_ACTIVE');
    if (fs.existsSync(boundedPath(root,'.cr/migration-pending.json',{mustExist:false})))throw Error('LIFECYCLE_MIGRATION_PENDING');
    const state=readJson(root,STATE), pin=readJson(root,BINDING);
    if(state.lifecycleRequired!==true||!verifyLifecycleBinding(pin,state.lifecycle))
      throw Error('LIFECYCLE_BINDING_CHANGED_OR_MISSING');
    if(action==='record')state.lifecycle=recordEvent(state.lifecycle,payload,state);
    else if(action==='advance')state.lifecycle=advanceStage(state.lifecycle,state);
    else{
      if(!payload||![...state.evidence,...state.counterEvidence].some(x=>x.id===payload.evidenceRef))
        throw Error('LIFECYCLE_REOPEN_EVIDENCE_MISSING');
      state.lifecycle=reopenLifecycle(state.lifecycle,payload);
      // 新反證保留舊輪證據，但使本輪 completion/verification 失效。
      recordCriticalRelayPhase(state,'REASSESS');
      state.status='active';
      if(state.executionContract){
        state.executionContract.verification=null;
        state.executionContract.verificationRun=null;
      }
      if(state.researchRequired)state.researchVerification=null;
      for(const item of state.completionCriteria){item.satisfied=false;item.evidenceRefs=[];}
    }
    state.nextAction=action==='advance'?'CR Lifecycle 進入 '+state.lifecycle.stage+'；待實際蒐證'
      :action==='reopen'?'新反證成立，重做研究及必要驗證'
        :'CR Lifecycle 已保留事件 '+payload.id+'；待階段驗收';
    atomicJson(root,STATE,state);
    return {action,cycle:state.lifecycle.cycle,stage:state.lifecycle.stage,
      entries:state.lifecycle.entries.length,nextAction:state.nextAction};
  });
}

if(require.main===module){
  try{
    const [action,payloadPath]=process.argv.slice(2);
    if(action==='status'){
      const {lifecycle,evaluation,overallGate}=inspect(process.cwd());
      // 預設查詢只回傳進度摘要，不將私有來源和業務原文印到工具日誌。
      console.log(JSON.stringify({lifecycle:{schemaVersion:lifecycle.schemaVersion,
        taskType:lifecycle.taskType,depth:lifecycle.depth,stage:lifecycle.stage,
        cycle:lifecycle.cycle,eventCount:lifecycle.entries.length},
        canComplete:evaluation.canComplete,blockingReasons:evaluation.blockingReasons,
        criticalRelayCanComplete:overallGate.canComplete},null,2));
    }else if(['record','advance','reopen'].includes(action)){
      if(action!=='advance'&&(typeof payloadPath!=='string'||!payloadPath.startsWith('.cr/')))
        throw Error('LIFECYCLE_INPUT_MUST_BE_PRIVATE_CR_JSON');
      console.log(JSON.stringify(update(process.cwd(),action,action==='advance'?null:readJson(process.cwd(),payloadPath))));
    }else throw Error('用法：lifecycle-cli.js status | record .cr/<event>.json | advance | reopen .cr/<reason>.json');
  }catch(error){console.error(error.message);process.exitCode=2;}
}
module.exports={inspect,update};
