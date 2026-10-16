'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {makeFixture}=require('./test-support');
const {initializeFallback}=require('./relay-evidence');
const {atomicJson,readJson,digestObject}=require('./test-plan');
const entry=path.join(__dirname,'lifecycle-cli.js');

function fixture(t) {
  const f=makeFixture(t);
  atomicJson(f.root,'research.json',{schemaVersion:'pixiu.research-plan.v1',id:'research',revision:1,
    criteria:[{id:'criterion-a',criterion:'核對來源'}],sources:[{id:'source-a',file:'sample-0.test.js',locator:'repo:fixture',criterionRefs:['criterion-a']}]});
  f.planPath='research.json';
  const state=initializeFallback(f.root,f.planPath,
    {lifecycleOptions:{taskType:'research',depth:'quick'}});
  state.claims.push({id:'claim-a',statement:'可驗證研究主張',status:'open',evidenceRefs:[],challengeRefs:[]});
  state.evidence.push({id:'evidence-a',source:'repo:fixture',provenance:'中性來源'});
  atomicJson(f.root,'.cr/state.json',state);
  return f;
}
function execute(f,action,payload) {
  if(payload)atomicJson(f.root,'.cr/command.json',payload);
  return spawnSync(process.execPath,[entry,action,...(payload?['.cr/command.json']:[])],
    {cwd:f.root,encoding:'utf8',windowsHide:true,timeout:25000});
}

test('CLI 只返回進度摘要，完整來源留在 .cr state',t=>{
  const f=fixture(t);const r=execute(f,'status');
  assert.equal(r.status,0,r.stderr);
  const result=JSON.parse(r.stdout);
  assert.equal(result.lifecycle.stage,'research');
  assert.equal(result.lifecycle.depth,'quick');
  assert.equal(result.canComplete,false);
  assert.equal(r.stdout.includes('repo:fixture'),false);
});
test('必須有來源與反向搜尋才能 advance；失敗不改 state',t=>{
  const f=fixture(t),before=digestObject(readJson(f.root,'.cr/state.json'));
  assert.equal(execute(f,'advance').status,2);
  assert.equal(digestObject(readJson(f.root,'.cr/state.json')),before);
  assert.equal(execute(f,'record',{id:'source',kind:'source_check',
    claimRefs:['claim-a'],evidenceRefs:['evidence-a'],method:'讀來源',result:'存在'}).status,0);
  assert.equal(execute(f,'record',{id:'search',kind:'countersearch',queries:['negative outcome'],
    outcome:'NOT_FOUND',method:'反向搜尋',result:'暫時未發現'}).status,0);
  const r=execute(f,'advance');assert.equal(r.status,0,r.stderr);
  assert.equal(JSON.parse(r.stdout).stage,'verification');
});
test('重新開啟需要真實 evidence ID，且會使既有驗收失效',t=>{
  const f=fixture(t);
  const bad=execute(f,'reopen',{reason:'新反證',evidenceRef:'invented'});
  assert.equal(bad.status,2);assert.match(bad.stderr,/EVIDENCE_MISSING/);
  const good=execute(f,'reopen',{reason:'新來源',evidenceRef:'evidence-a'});
  assert.equal(good.status,0,good.stderr);
  const state=readJson(f.root,'.cr/state.json');
  assert.equal(state.lifecycle.cycle,2);
  assert.equal(state.executionContract,undefined);
  assert.equal(state.researchVerification,null);
  state.lifecycleRequired=false;
  atomicJson(f.root,'.cr/state.json',state);
  assert.equal(execute(f,'advance').status,2);
});
test('固定 binding 被移除或不是 .cr 私有輸入時拒絕',t=>{
  const f=fixture(t);
  assert.equal(execute(f,'record').status,2);
  assert.equal(execute(f,'invalid').status,2);
  fs.unlinkSync(path.join(f.root,'.cr/lifecycle-binding.json'));
  assert.equal(execute(f,'advance').status,2);
});
test('正式 init-lifecycle 在舊 state 存在時不會覆寫',t=>{
  const f=makeFixture(t);
  atomicJson(f.root,'research.json',{schemaVersion:'pixiu.research-plan.v1',id:'research',revision:1,
    criteria:[{id:'criterion-a',criterion:'核對來源'}],sources:[{id:'source-a',file:'sample-0.test.js',locator:'repo:fixture',criterionRefs:['criterion-a']}]});
  f.planPath='research.json';
  const init=()=>spawnSync(process.execPath,[path.join(__dirname,'relay-evidence.js'),
    'init-lifecycle',f.planPath,'research','quick'],{
      cwd:f.root,encoding:'utf8',windowsHide:true,timeout:25000});
  const a=init();assert.equal(a.status,0,a.stderr);
  assert.equal(readJson(f.root,'.cr/state.json').lifecycle.taskType,'research');
  assert.equal(readJson(f.root,'.cr/lifecycle-binding.json').depth,'quick');
  const b=init();assert.equal(b.status,2);assert.match(b.stderr,/已有 CR fallback/);
});

require('./research-evidence.test');
