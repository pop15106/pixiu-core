'use strict';
const fs=require('node:fs'),path=require('node:path');
const {fileURLToPath}=require('node:url');
// 僅輸出載入中的模組版本與 PID，不讀取任務、憑證或服務環境。
function reportLoadedRuntime(moduleUrl,integrationProfile,ledgerSchemas){
  const manifestPath=path.resolve(path.dirname(fileURLToPath(moduleUrl)),'../../WORKFLOW-BUNDLE.json');
  const manifest=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):null;
  const result=Object.freeze({event:'pixiu.cr.runtime.loaded',integrationProfile,ledgerSchemas,
    executionSchema:'pixiu.cr-execution.v2',pid:process.pid,node:process.version,loadedAt:new Date().toISOString(),
    loadedModule:moduleUrl,bundleDigest:manifest?.contentDigest||null,sourceCommit:manifest?.sourceCommit||null,
    sourceDirty:manifest?.sourceDirty??null});
  // PowerShell 5 的 Stop 模式會將原生 stderr 視為錯誤；僅服務啟動明確要求時輸出。
  if(process.env.PIXIU_CR_RUNTIME_DIAGNOSTICS==='1')process.stderr.write(JSON.stringify(result)+'\n');
  return result;
}
module.exports={reportLoadedRuntime};
