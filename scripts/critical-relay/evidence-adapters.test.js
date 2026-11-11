'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {makeFixture}=require('./test-support');
const {atomicJson,bindPlan,readJson}=require('./test-plan');
const {runPlan}=require('./test-runner');
const {verifyRun}=require('./evidence-verifier');
const {parseJUnit,parsePlaywright}=require('./report-formats');
const goodXml='<testsuite tests="1" failures="0" errors="0" skipped="0"><testcase name="real case"/></testsuite>';
const goodPlaywright={suites:[{title:'ui',specs:[{title:'button',tests:[{expectedStatus:'passed',status:'expected',results:[{status:'passed',errors:[]}]}]}]}],errors:[],stats:{expected:1,unexpected:0,flaky:0,skipped:0}};
function setup(t,adapter='junit-command',contents=goodXml,program){
  const f=makeFixture(t),kind=adapter==='build-command'?'build':adapter==='playwright-command'?'ui':'test';
  fs.appendFileSync(path.join(f.root,'.gitignore'),'\n/out/\n');
  fs.writeFileSync(path.join(f.root,'producer.cjs'),program||`const fs=require('node:fs');fs.mkdirSync('out',{recursive:true});fs.writeFileSync('out/result',${JSON.stringify(contents)});`);
  atomicJson(f.root,'adapter.json',{schemaVersion:'pixiu.adapter-spec.v1',adapter,exec:{executable:process.execPath,args:['producer.cjs']},[adapter==='build-command'?'artifacts':'reports']:['out/result']});
  f.plan.commands=[{id:'native',adapter,file:'adapter.json',evidenceKind:kind,required:true,timeoutMs:20000,criterionRefs:['criterion-fixture']}];
  f.plan.criteria[0].requiredEvidenceKinds=[kind];atomicJson(f.root,'plan.json',f.plan);f.binding=bindPlan(f.root,f.planPath);return f;
}
const run=f=>runPlan({workspaceRoot:f.root,planPath:f.planPath});
const check=(f,r)=>verifyRun(f.root,f.binding,{runId:r.runId,resultPath:r.resultPath});
test('JUnit 依案例核對統計，拒絕隱藏錯誤、零筆、略過與 DTD',()=>{
  assert.equal(parseJUnit(goodXml).clean,true);
  for(const xml of ['<testsuite/>','<testsuite><testcase name="skip"><skipped/></testcase></testsuite>','<testsuite><testcase name="flaky"><flakyFailure/></testcase></testsuite>'])assert.equal(parseJUnit(xml).clean,false);
  for(const xml of ['<testsuite errors="1"><testcase name="x"/></testsuite>','<testsuite tests="9"><testcase name="x"/></testsuite>','<!DOCTYPE x><testsuite/>','<testsuite><testcase></testsuite>'])assert.throws(()=>parseJUnit(xml));
});
test('Playwright 拒絕略過、重試、全域錯誤與矛盾統計',()=>{
  assert.equal(parsePlaywright(JSON.stringify(goodPlaywright)).clean,true);
  for(const mutate of [r=>r.errors.push({message:'setup failed'}),r=>r.stats.expected++,r=>{r.stats.expected=0;r.stats.skipped=1;},r=>delete r.stats,r=>r.suites[0].specs[0].tests[0].results.push({status:'passed'})]){
    const r=structuredClone(goodPlaywright);mutate(r);let rejected=false;try{rejected=!parsePlaywright(JSON.stringify(r)).clean;}catch{rejected=true;}assert.equal(rejected,true);
  }
});
for(const [adapter,contents] of [['junit-command',goodXml],['playwright-command',JSON.stringify(goodPlaywright)],['build-command','compiled fixture bytes']]){
  test(`${adapter} 真實子程序、原始報告、正式 runner 與回讀`,async t=>{
    const f=setup(t,adapter,contents),r=await run(f);
    assert.equal(r.outcome,'PASS',JSON.stringify(r.commands));assert.equal(r.commands[0].counts.total,1);
    assert.equal(check(f,r).canComplete,true,JSON.stringify(check(f,r)));
    const receipt=readJson(f.root,`.cr/runs/${r.runId}/native.adapter.json`);assert.equal(receipt.native.exitCode,0);
    assert.equal(receipt.native.executable.path,fs.realpathSync(process.execPath));
    fs.appendFileSync(path.join(f.root,receipt.files[0].savedPath),'tampered');assert.equal(check(f,r).canComplete,false);
  });
}
for(const [name,xml,program] of [['零筆','<testsuite/>'],['略過','<testsuite><testcase name="skip"><skipped/></testcase></testsuite>'],['錯誤統計','<testsuite errors="1"><testcase name="x"/></testsuite>'],['非零結束碼',goodXml,`const fs=require('node:fs');fs.mkdirSync('out',{recursive:true});fs.writeFileSync('out/result',${JSON.stringify(goodXml)});process.exitCode=1;`],['過期報告',goodXml,'console.log("did not run tests");']]){
  test(`原生 ${name} 不能通過`,async t=>{
    const f=setup(t,'junit-command',xml,program);
    if(name==='過期報告'){fs.mkdirSync(path.join(f.root,'out'));fs.writeFileSync(path.join(f.root,'out/result'),goodXml);}
    const r=await run(f);assert.equal(r.outcome,'FAIL',JSON.stringify(r));assert.equal(check(f,r).canComplete,false);
  });
}
test('HTTP adapter 實際連 loopback API 並檢查 UTF8 JSON 與失敗狀態',async t=>{
  const http=require('node:http');const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');const bytes=Buffer.from(JSON.stringify({message:'查核成功'}));res.write(bytes.subarray(0,14));setTimeout(()=>res.end(bytes.subarray(14)),10);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const f=setup(t),origin=`http://127.0.0.1:${server.address().port}`;
  const spec={schemaVersion:'pixiu.adapter-spec.v1',adapter:'http-json',allowedOrigins:[origin],requests:[{id:'health',url:origin+'/health',expectedStatus:200,expectedJson:{message:'查核成功'}}]};
  atomicJson(f.root,'adapter.json',spec);f.plan.commands[0].adapter='http-json';f.plan.commands[0].evidenceKind='api';f.plan.criteria[0].requiredEvidenceKinds=['api'];atomicJson(f.root,'plan.json',f.plan);f.binding=bindPlan(f.root,f.planPath);
  const passed=await run(f);assert.equal(passed.outcome,'PASS',JSON.stringify(passed.commands));assert.equal(check(f,passed).canComplete,true);
  spec.requests[0].expectedStatus=201;atomicJson(f.root,'adapter.json',spec);const failed=await run(f);assert.equal(failed.outcome,'FAIL');
});
