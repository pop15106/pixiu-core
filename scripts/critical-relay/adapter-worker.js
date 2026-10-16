'use strict';

// 以 Node 官方測試事件承載原生 adapter 案例；外部報告仍由完成閘門獨立回讀。
const test=require('node:test');
const assert=require('node:assert/strict');
const {runAdapter}=require('./evidence-adapters');
test('原生驗證 adapter',async t=>{
  const command=JSON.parse(process.env.CR_ADAPTER_COMMAND);
  const receipt=await runAdapter(process.cwd(),command,process.env.CR_TEST_RUN_ID);
  for(const item of receipt.summary.cases){
    await t.test(item.name,()=>assert.equal(item.status,'passed','原生案例必須實際通過'));
  }
  assert.equal(receipt.summary.clean,true,'原生程序與所有必要案例均需成功，零筆不得通過');
});
