'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCriticalRelay, recordCriticalRelayPhase, evaluateCriticalRelay, buildHandoffSnapshot,
  verifyHandoffSnapshot } = require('./critical-relay');
const { createLifecycle, lifecycleBinding, verifyLifecycleBinding, classifyDepth, recordEvent, advanceStage,
  reopenLifecycle, evaluateLifecycle, assertLifecycleTransition, verificationContext } = require('./lifecycle');

function setup(type='development',depth='standard',riskSignals=[]) {
  const state=createCriticalRelay({objective:'中性研究與開發驗證',
    completionCriteria:['至少一項可回查條件'],
    lifecycle:createLifecycle({taskType:type,depth,riskSignals})});
  state.claims.push({id:'claim-a',statement:'可驗證主張',status:'supported',
    evidenceRefs:['evidence-a'],challengeRefs:['challenge-a'],counterEvidenceRefs:[]});
  state.evidence.push({id:'evidence-a',source:'repo:fixture/source',
    provenance:'中性測試用來源'});
  state.challenges.push({id:'challenge-a',status:'resolved',severity:'high',
    claimRefs:['claim-a'],method:'反例測試',result:'已確認'});
  state.tests.push({id:'test-a',status:'passed',required:true});
  state.completionCriteria[0].satisfied=true;
  state.completionCriteria[0].evidenceRefs=['evidence-a','test-a'];
  state.nextAction='保存交付證據';
  recordCriticalRelayPhase(state,'VERIFY');
  recordCriticalRelayPhase(state,'RECHALLENGE');
  return state;
}
function record(state,event) {
  state.lifecycle=recordEvent(state.lifecycle, state.lifecycle.cycle>1?
    {...event,id:event.id+'-'+state.lifecycle.cycle}:event);
}
function advance(state) {state.lifecycle=advanceStage(state.lifecycle,state)}
function research(state,counter=false) {
  record(state,{id:'source',kind:'source_check',method:'讀取原始來源',result:'可追溯',
    claimRefs:['claim-a'],evidenceRefs:['evidence-a']});
  if(counter) {
    state.counterEvidence.push({id:'counter-a',source:'repo:fixture/counter',claimRefs:['claim-a'],
      severity:'high',status:'addressed'});
    state.claims[0].counterEvidenceRefs=['counter-a'];
    state.claims[0].counterEvidenceStatus='addressed';
  }
  record(state,{id:'countersearch',kind:'countersearch',method:'反向查詢',result:counter?'找到反證':'未找到反證，不代表正確',
    queries:['failure','contrary example'],outcome:counter?'FOUND':'NOT_FOUND',
    counterEvidenceRefs:counter?['counter-a']:[]});
  if(counter)record(state,{id:'reassessment',kind:'reassessment',method:'比較不同來源',result:'修正假設',
    counterEvidenceRefs:['counter-a']});
  advance(state);
}
function design(state) {
  record(state,{id:'options',kind:'options_review',method:'方案比較',result:'評估取捨',
    options:[{id:'a',description:'新增套件',advantages:'方便',disadvantages:'相依升級'},
      {id:'b',description:'現有能力',advantages:'零新依賴',disadvantages:'需額外測試'}]});
  record(state,{id:'decision',kind:'decision',method:'使用 evidence 選擇',result:'採用 b',
    selectedId:'b',rationale:'小範圍且可驗證',evidenceRefs:['evidence-a'],challengeRefs:['challenge-a']});
  advance(state);
}
function development(state) {
  record(state,{id:'change',kind:'change_review',method:'讀取中性 diff',result:'範圍可控',
    changes:['fixture.js'],failureScenarios:['空測試','資料錯誤'],
    claimRefs:['claim-a'],challengeRefs:['challenge-a']});
  record(state,{id:'counterexample',kind:'counterexample',method:'注入錯誤輸入',
    result:'真實反例驗證可阻擋',challengeRefs:['challenge-a']});
  advance(state);
}
function verification(state) {
  record(state,{id:'evidence-review',kind:'evidence_review',method:'回讀測試證據',
    result:'已驗證',outcome:'PASS',evidenceRefs:['evidence-a'],testRefs:['test-a']});
  record(state,{id:'rechallenge',kind:'rechallenge',method:'驗證後重新挑戰',
    result:'無新的反證',challengeRefs:['challenge-a']});
  advance(state);
}
function complete(type='development') {
  const s=setup(type);research(s);if(type==='development'){design(s);development(s)}verification(s);return s;
}

test('舊 CR State 沒有 lifecycle 可保持相容',()=>{
  const old=createCriticalRelay({objective:'原流程',completionCriteria:['舊驗收']});
  assert.equal(old.lifecycle,undefined);
  assert.ok(!evaluateCriticalRelay(old).blockingReasons.some(x=>x.includes('LIFECYCLE')));
});
test('開發所有階段完成後才可交棒，handoff 完整保留紀錄及 digest',()=>{
  const state=complete();
  assert.deepEqual(state.lifecycle.stageHistory,['research','design','development','verification','complete']);
  assert.equal(evaluateLifecycle(state.lifecycle,state).canComplete,true);
  assert.equal(evaluateCriticalRelay(state).canComplete,true);
  const handoff=buildHandoffSnapshot(state);
  assert.equal(verifyHandoffSnapshot(handoff).canAccept,true);
  handoff.lifecycle.entries[0].result='竄改';
  assert.equal(verifyHandoffSnapshot(handoff).digestMatches,false);
});
test('純研究不偽裝有開發或程式建置',()=>{
  const state=complete('research');
  assert.equal(state.lifecycle.stageHistory.includes('development'),false);
  assert.equal(evaluateCriticalRelay(state).canComplete,true);
});
test('預設 Standard；不可降低高風險深度',()=>{
  assert.equal(createLifecycle().depth,'standard');
  assert.equal(createLifecycle({depth:'quick'}).depth,'quick');
  assert.throws(()=>createLifecycle({riskSignals:['security'],depth:'standard'}),/RISK_DOWNGRADE/);
  assert.throws(()=>createLifecycle({riskSignals:['cross-repo'],depth:'quick'}),/RISK_DOWNGRADE/);
  assert.throws(()=>createLifecycle({riskSignals:['cross-repo','unknown-framework'],depth:'standard'}),/RISK_DOWNGRADE/);
  assert.throws(()=>classifyDepth(['unknown']),/SIGNALS_INVALID/);
});
test('來源查核或反向查詢缺失會阻止研究階段前進',()=>{
  const state=setup();
  assert.throws(()=>advance(state),/STAGE_BLOCKED/);
  record(state,{id:'source',kind:'source_check',method:'讀檔',result:'存在',
    claimRefs:['claim-a'],evidenceRefs:['evidence-a']});
  assert.throws(()=>advance(state),/STAGE_BLOCKED/);
});
test('發現反證但未重新評估不能前進',()=>{
  const state=setup();
  state.counterEvidence.push({id:'counter-a',source:'repo:counter',claimRefs:['claim-a'],status:'addressed'});
  state.claims[0].counterEvidenceRefs=['counter-a'];state.claims[0].counterEvidenceStatus='addressed';
  record(state,{id:'source',kind:'source_check',method:'讀來源',result:'存在',claimRefs:['claim-a'],evidenceRefs:['evidence-a']});
  record(state,{id:'search',kind:'countersearch',method:'反向搜尋',result:'有反證',queries:['failure'],
    outcome:'FOUND',counterEvidenceRefs:['counter-a']});
  assert.throws(()=>advance(state),/REASSESS/);
});
test('研究必須先查原始來源再找反證；決策不能先於方案比較',()=>{
  const s=setup();
  record(s,{id:'query',kind:'countersearch',method:'先查詢',result:'已查',outcome:'NOT_FOUND',queries:['error']});
  record(s,{id:'source',kind:'source_check',method:'後核對',result:'不符合順序',
    claimRefs:['claim-a'],evidenceRefs:['evidence-a']});
  assert.throws(()=>advance(s),/STAGE_BLOCKED/);
  const s2=setup();research(s2);
  record(s2,{id:'decision',kind:'decision',method:'先選擇',result:'已選',
    selectedId:'b',rationale:'猜測',evidenceRefs:['evidence-a'],challengeRefs:['challenge-a']});
  record(s2,{id:'options',kind:'options_review',method:'後比較',result:'順序不對',
    options:[{id:'a',description:'a',advantages:'快',disadvantages:'貴'},
      {id:'b',description:'b',advantages:'便宜',disadvantages:'慢'}]});
  assert.throws(()=>advance(s2),/先於決策/);
});
test('Deep 使用兩個不同來源定位，不能以不同 ID 重複同 URL',()=>{
  const s=setup('development','deep',['security']);
  record(s,{id:'source',kind:'source_check',method:'原文',result:'第一份',
    claimRefs:['claim-a'],evidenceRefs:['evidence-a']});
  record(s,{id:'query',kind:'countersearch',method:'反向搜尋',result:'暫無',
    outcome:'NOT_FOUND',queries:['negative']});
  assert.throws(()=>advance(s),/兩個不同來源/);
  s.evidence.push({id:'evidence-b',source:'repo:fixture/source'});
  record(s,{id:'second',kind:'source_check',method:'其他記錄',result:'相同位置',
    claimRefs:['claim-a'],evidenceRefs:['evidence-b']});
  assert.throws(()=>advance(s),/兩個不同來源/);
  s.evidence[1].source='repo:other/document';
  advance(s);assert.equal(s.lifecycle.stage,'design');
});
test('程式實作必須明確風險與反例',()=>{
  const s=setup();research(s);design(s);
  record(s,{id:'change',kind:'change_review',method:'核對 diff',result:'內容',
    changes:['file.js'],claimRefs:['claim-a'],challengeRefs:['challenge-a']});
  assert.throws(()=>advance(s),/STAGE_BLOCKED/);
});
test('必要測試失敗與先 RECHALLENGE 後 VERIFY 均不能通過',()=>{
  const s=setup();research(s);design(s);development(s);
  s.tests[0].status='failed';
  record(s,{id:'evidence-review',kind:'evidence_review',method:'假設成功',result:'不可靠',
    outcome:'PASS',testRefs:['test-a']});
  record(s,{id:'rechallenge',kind:'rechallenge',method:'事後反方',result:'仍未過',
    challengeRefs:['challenge-a']});
  assert.throws(()=>advance(s),/STAGE_BLOCKED/);
  const s2=setup();research(s2);design(s2);development(s2);
  record(s2,{id:'rechallenge',kind:'rechallenge',method:'先反方',result:'不合順序',challengeRefs:['challenge-a']});
  record(s2,{id:'review',kind:'evidence_review',method:'後驗證',result:'通過',outcome:'PASS',testRefs:['test-a']});
  assert.throws(()=>advance(s2),/先回讀證據/);
});
test('缺少來源、假的反證引用、跳階段不能標完成',()=>{
  const s=complete();
  s.lifecycle.entries[0].evidenceRefs=['fake'];
  assert.equal(evaluateCriticalRelay(s).canComplete,false);
  const other=complete();delete other.lifecycle;
  assert.match(evaluateCriticalRelay(other).blockingReasons.join('|'),/LIFECYCLE_SCHEMA_INVALID/);
  const third=complete();third.lifecycle.stageHistory=['research','complete'];
  assert.equal(evaluateLifecycle(third.lifecycle,third).canComplete,false);
});
test('重新啟動一輪保留舊歷史、新一輪尚未通過',()=>{
  const s=complete();const old=s.lifecycle.entries.length;
  s.lifecycle=reopenLifecycle(s.lifecycle,{reason:'新的反證',evidenceRef:'evidence-a'});
  assert.equal(s.lifecycle.cycle,2);assert.equal(s.lifecycle.entries.length,old);
  assert.equal(evaluateLifecycle(s.lifecycle,s).canComplete,false);
  research(s);design(s);development(s);verification(s);
  assert.equal(evaluateLifecycle(s.lifecycle,s).canComplete,true);
});
test('生命週期固定政策不得刪除或改小風險',()=>{
  const s=complete();
  const pin=lifecycleBinding(s.lifecycle);
  assert.equal(verifyLifecycleBinding(pin,s.lifecycle),true);
  s.lifecycle.depth='quick';
  assert.equal(verifyLifecycleBinding(pin,s.lifecycle),false);
  s.lifecycle=complete().lifecycle;
  s.lifecycleRequired=false;
  assert.match(evaluateCriticalRelay(s).blockingReasons.join('|'),/不可降級/);
});

test('v2 覆核綁定真實 run 與來源，只有新 phase 名稱不能沿用舊覆核',()=>{
  const state=setup();research(state);design(state);development(state);
  state.executionContract={schemaVersion:'pixiu.cr-execution.v2',
    source:{headSha:'a'.repeat(40),changeDigest:'b'.repeat(64)},
    verification:{headSha:'a'.repeat(40),changeDigest:'b'.repeat(64)},
    verificationRun:{runId:'run-one'},verificationBinding:{planDigest:'c'.repeat(64)}};
  const add=event=>state.lifecycle=recordEvent(state.lifecycle,event,state);
  add({id:'bound-review',kind:'evidence_review',method:'回讀本輪',result:'完成',outcome:'PASS',testRefs:['test-a']});
  add({id:'bound-rechallenge',kind:'rechallenge',method:'反證本輪',result:'完成',challengeRefs:['challenge-a']});
  advance(state);
  assert.equal(evaluateLifecycle(state.lifecycle,state).canComplete,true);
  assert.deepEqual(state.lifecycle.entries.at(-1).verificationContext,verificationContext(state));
  state.executionContract.verificationRun.runId='run-two';
  recordCriticalRelayPhase(state,'VERIFY');recordCriticalRelayPhase(state,'RECHALLENGE');
  assert.match(evaluateLifecycle(state.lifecycle,state).blockingReasons.join('|'),/STALE_VERIFICATION/);
});

test('既有生命週期事件只能追加；拒絕 cycle 倒退、改寫與刪除歷史',()=>{
  const old=complete();
  const next=reopenLifecycle(old.lifecycle,{reason:'新反證',evidenceRef:'evidence-a'});
  assert.doesNotThrow(()=>assertLifecycleTransition(old.lifecycle,next));
  assert.throws(()=>assertLifecycleTransition(next,old.lifecycle),/CYCLE_REGRESSED/);
  for(const field of ['entries','stageHistory','reopenHistory']){
    const changed=structuredClone(next);changed[field].pop();
    assert.throws(()=>assertLifecycleTransition(next,changed),/HISTORY/);
  }
  const changed=structuredClone(next);changed.entries[0].result='改寫舊判斷';
  assert.throws(()=>assertLifecycleTransition(next,changed),/HISTORY/);
});
