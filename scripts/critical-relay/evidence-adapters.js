'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {isDeepStrictEqual}=require('node:util');
const {boundedPath,readJson,readText,atomicJson,digestObject,hash,redact,isObject}=require('./test-plan');
const {parseJUnit,parsePlaywright,summarize}=require('./report-formats');
const ADAPTERS=Object.freeze({'node-test':['test'],'junit-command':['test','api','ui'],
  'playwright-command':['ui'],'build-command':['build'],'http-json':['api']});
const MAX_BYTES=8*1024*1024;
function validateAdapterCommand(command){
  if(!ADAPTERS[command.adapter]?.includes(command.evidenceKind))throw Error('ADAPTER_OR_EVIDENCE_KIND_UNSUPPORTED');
  if(command.adapter!=='node-test'&&!command.file.endsWith('.json'))throw Error('ADAPTER_SPEC_JSON_REQUIRED');
}
function loadSpec(root,command){
  validateAdapterCommand(command);
  const spec=readJson(root,command.file);
  if(spec.schemaVersion!=='pixiu.adapter-spec.v1'||spec.adapter!==command.adapter)throw Error('ADAPTER_SPEC_INVALID');
  if(spec.adapter==='http-json'){
    if(!Array.isArray(spec.allowedOrigins)||!spec.allowedOrigins.length||!Array.isArray(spec.requests)||!spec.requests.length)throw Error('HTTP_PLAN_INVALID');
    for(const request of spec.requests){
      const url=new URL(request.url);
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!spec.allowedOrigins.includes(url.origin)||
          !['GET','HEAD'].includes(request.method||'GET')||!Number.isInteger(request.expectedStatus)||
          request.expectedStatus<100||request.expectedStatus>599||typeof request.id!=='string'||!request.id.trim()||
          [...url.searchParams.keys()].some(x=>/token|password|secret|api.?key/iu.test(x)))throw Error('HTTP_REQUEST_NOT_ALLOWED');
    }
    if(new Set(spec.requests.map(x=>x.id)).size!==spec.requests.length)throw Error('HTTP_REQUEST_ID_DUPLICATE');
  }else{
    if(!isObject(spec.exec)||typeof spec.exec.executable!=='string'||!spec.exec.executable.trim()||
        !Array.isArray(spec.exec.args)||!spec.exec.args.every(x=>typeof x==='string'&&!/[\x00\r\n]/u.test(x)))throw Error('ADAPTER_EXEC_INVALID');
    if(spec.exec.cwd!==undefined&&spec.exec.cwd!=='.')boundedPath(root,spec.exec.cwd);
    if(spec.exec.envFromHost!==undefined&&(!Array.isArray(spec.exec.envFromHost)||
        spec.exec.envFromHost.some(x=>typeof x!=='string'||!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(x)||
          /^(?:NODE_OPTIONS|NODE_TEST_CONTEXT|CR_|LD_PRELOAD|DYLD_)/iu.test(x))))throw Error('ADAPTER_ENV_INVALID');
    const files=spec.adapter==='build-command'?spec.artifacts:spec.reports;
    if(!Array.isArray(files)||!files.length||new Set(files).size!==files.length)throw Error('ADAPTER_OUTPUTS_REQUIRED');
    for(const file of files){boundedPath(root,file,{mustExist:false});if(file.startsWith('.cr/'))throw Error('ADAPTER_OUTPUT_MUST_BE_PROJECT_FILE');}
  }
  return spec;
}
function resolveExecutable(name,env){
  const candidates=path.isAbsolute(name)?[name]:(name.includes('/')||name.includes('\\'))?[]:
    String(env.PATH||env.Path||'').split(path.delimiter).flatMap(dir=>{
      const base=path.join(dir,name);
      return process.platform==='win32'&&!path.extname(name)?['.exe','.cmd','.bat'].map(ext=>base+ext):[base];
    });
  const file=candidates.find(x=>fs.existsSync(x)&&fs.statSync(x).isFile());
  if(!file)throw Error('ADAPTER_EXECUTABLE_NOT_FOUND: '+name);
  return fs.realpathSync(file);
}
function executableIdentity(file){return {path:file,sha256:hash(fs.readFileSync(file))};}
function invocation(executable,args){
  if(process.platform==='win32'&&/\.(cmd|bat)$/iu.test(executable)){
    // 批次檔只能經 cmd 啟動；拒絕會再解譯的字元，不以 shell 拼接任意參數。
    if([executable,...args].some(x=>/["%!?&|<>^\r\n]/u.test(x)))throw Error('ADAPTER_BATCH_ARGUMENT_UNSAFE');
    return {file:path.join(process.env.SystemRoot||'C:\\Windows','System32','cmd.exe'),
      args:['/d','/s','/c','"'+[executable,...args].map(x=>'"'+x+'"').join(' ')+'"'],windowsVerbatimArguments:true};
  }
  return {file:executable,args};
}
async function executeNative(root,spec,command,runId){
  const env={};
  for(const name of ['PATH','Path','SystemRoot','SYSTEMROOT','ComSpec','TEMP','TMP','TMPDIR','LANG',...(spec.exec.envFromHost||[])]){
    if(process.env[name]!==undefined)env[name]=process.env[name];
  }
  const executable=resolveExecutable(spec.exec.executable,env),identity=executableIdentity(executable);
  const start=Date.now(),cwd=spec.exec.cwd&&spec.exec.cwd!=='.'?boundedPath(root,spec.exec.cwd):root;
  const call=invocation(executable,spec.exec.args);
  const stdoutPath=`.cr/runs/${runId}/${command.id}.native-stdout.log`,stderrPath=`.cr/runs/${runId}/${command.id}.native-stderr.log`;
  // 原生日誌逐行去敏並落盤，程序中斷時保留已完成行，不宣稱成功。
  const fds=[stdoutPath,stderrPath].map(file=>fs.openSync(boundedPath(root,file,{mustExist:false}),'wx',0o600));
  return new Promise((resolve,reject)=>{
    let output=['',''],buffers=['',''],bytes=0,error=null;
    const child=spawn(call.file,call.args,{cwd,env,windowsHide:true,shell:false,
      windowsVerbatimArguments:call.windowsVerbatimArguments,stdio:['ignore','pipe','pipe']});
    const flush=(i,text)=>{const clean=redact(text);output[i]+=clean;fs.writeSync(fds[i],clean);fs.fsyncSync(fds[i]);};
    for(const [i,stream] of [child.stdout,child.stderr].entries()){
      stream.setEncoding('utf8');stream.on('data',chunk=>{
        try{
          bytes+=Buffer.byteLength(chunk);if(bytes>MAX_BYTES){error=Error('ADAPTER_OUTPUT_LIMIT');child.kill();return;}
          buffers[i]+=chunk;let at;
          while((at=buffers[i].indexOf('\n'))>=0){flush(i,buffers[i].slice(0,at+1));buffers[i]=buffers[i].slice(at+1);}
        }catch(e){error=e;child.kill();}
      });
    }
    child.on('error',e=>{error=e;});
    child.on('close',(exitCode,signal)=>{
      try{
        for(let i=0;i<2;i++)if(buffers[i])flush(i,buffers[i]);
        if(error)reject(error);
        else resolve({executable:identity,argv:spec.exec.args,cwd,exitCode,signal,
          startedAt:new Date(start).toISOString(),endedAt:new Date().toISOString(),
          stdoutPath,stdoutDigest:hash(output[0]),stderrPath,stderrDigest:hash(output[1])});
      }catch(e){reject(e);}finally{fds.forEach(fd=>fs.closeSync(fd));}
    });
  });
}
function fileSnapshot(root,file){
  const target=boundedPath(root,file,{mustExist:false});
  if(!fs.existsSync(target))return null;
  const stat=fs.statSync(target);
  if(!stat.isFile()||stat.size>MAX_BYTES)throw Error('ADAPTER_REPORT_FILE_INVALID');
  return {mtimeMs:stat.mtimeMs,size:stat.size,sha256:hash(fs.readFileSync(target))};
}
function parseReports(adapter,contents){
  if(adapter==='build-command')return summarize(contents.map((_,i)=>({name:'產物-'+i,status:'passed'})));
  const parse=adapter==='junit-command'?parseJUnit:parsePlaywright;
  return summarize(contents.flatMap(text=>parse(text).cases));
}
function validateHttpResponse(request,response){
  if(response.status!==request.expectedStatus)throw Error('HTTP_STATUS_MISMATCH: '+request.id);
  if(request.bodyIncludes!==undefined&&(typeof request.bodyIncludes!=='string'||!response.body.includes(request.bodyIncludes)))throw Error('HTTP_BODY_MISMATCH: '+request.id);
  if(request.expectedJson!==undefined&&!isDeepStrictEqual(JSON.parse(response.body),request.expectedJson))throw Error('HTTP_JSON_MISMATCH: '+request.id);
}
async function runAdapter(root,command,runId){
  const spec=loadSpec(root,command),prefix=`.cr/runs/${runId}/${command.id}`;
  const receipt={schemaVersion:'pixiu.adapter-evidence.v1',adapter:command.adapter,runId,commandId:command.id,
    specDigest:digestObject(spec),startedAt:new Date().toISOString(),native:null,files:[],responses:[]};
  let parsed;
  if(spec.adapter==='http-json'){
    const cases=[];
    for(const request of spec.requests){
      const response=await fetch(request.url,{method:request.method||'GET',redirect:'error',signal:AbortSignal.timeout(Math.max(100,command.timeoutMs-500))});
      const chunks=[];let length=0;
      for await(const chunk of response.body||[]){length+=chunk.length;if(length>MAX_BYTES)throw Error('HTTP_BODY_LIMIT');chunks.push(Buffer.from(chunk));}
      const body=Buffer.concat(chunks).toString('utf8');
      const evidence={id:request.id,url:request.url,status:response.status,body:redact(body)};
      receipt.responses.push(evidence);
      let status='passed';try{validateHttpResponse(request,evidence);}catch{status='failed';}
      cases.push({name:request.id,status});
    }
    parsed=summarize(cases);
  }else{
    const outputs=spec.adapter==='build-command'?spec.artifacts:spec.reports;
    const before=outputs.map(file=>fileSnapshot(root,file));
    receipt.native=await executeNative(root,spec,command,runId);
    const contents=[];
    for(const [index,file] of outputs.entries()){
      const after=fileSnapshot(root,file),prior=before[index];
      if(!after||after.size===0||after.mtimeMs<Date.parse(receipt.native.startedAt)-1000||
          (prior&&prior.mtimeMs===after.mtimeMs&&prior.sha256===after.sha256))throw Error('ADAPTER_OUTPUT_MISSING_OR_STALE: '+file);
      const original=fs.readFileSync(boundedPath(root,file));
      const bytes=spec.adapter==='build-command'?original:Buffer.from(redact(original.toString('utf8')));
      const savedPath=`${prefix}.artifact-${index}`;
      fs.writeFileSync(boundedPath(root,savedPath,{mustExist:false}),bytes,{flag:'wx',mode:0o600});
      receipt.files.push({sourcePath:file,savedPath,sha256:hash(bytes),size:bytes.length,fresh:true});
      contents.push(bytes.toString('utf8'));
    }
    parsed=parseReports(spec.adapter,contents);
    if(receipt.native.exitCode!==0||receipt.native.signal)parsed.clean=false;
  }
  receipt.endedAt=new Date().toISOString();receipt.summary=parsed;
  atomicJson(root,`${prefix}.adapter.json`,receipt);
  return receipt;
}
function verifyAdapter(root,command,runId){
  const spec=loadSpec(root,command),prefix=`.cr/runs/${runId}/${command.id}`;
  const receipt=readJson(root,`${prefix}.adapter.json`);
  if(receipt.schemaVersion!=='pixiu.adapter-evidence.v1'||receipt.runId!==runId||receipt.commandId!==command.id||
      receipt.adapter!==command.adapter||receipt.specDigest!==digestObject(spec)||!Number.isFinite(Date.parse(receipt.endedAt)))throw Error('ADAPTER_RECEIPT_INVALID');
  let parsed;
  if(spec.adapter==='http-json'){
    if(!Array.isArray(receipt.responses)||receipt.responses.length!==spec.requests.length)throw Error('HTTP_EVIDENCE_MISSING');
    const cases=spec.requests.map((request,i)=>{
      const response=receipt.responses[i];if(response.id!==request.id||response.url!==request.url)throw Error('HTTP_EVIDENCE_ID_MISMATCH');
      validateHttpResponse(request,response);return {name:request.id,status:'passed'};
    });
    parsed=summarize(cases);
  }else{
    const native=receipt.native;
    if(!native||native.exitCode!==0||native.signal!==null||!native.executable||
        native.executable.path!==resolveExecutable(spec.exec.executable,process.env)||
        digestObject(native.executable)!==digestObject(executableIdentity(native.executable.path))||
        digestObject(native.argv)!==digestObject(spec.exec.args)||
        native.cwd!==(spec.exec.cwd&&spec.exec.cwd!=='.'?boundedPath(root,spec.exec.cwd):root))throw Error('ADAPTER_NATIVE_PROCESS_INVALID');
    for(const stream of ['stdout','stderr']){
      if(native[stream+'Path']!==`${prefix}.native-${stream}.log`||hash(readText(root,native[stream+'Path']))!==native[stream+'Digest'])throw Error('ADAPTER_NATIVE_LOG_CHANGED');
    }
    const outputs=spec.adapter==='build-command'?spec.artifacts:spec.reports;
    if(!Array.isArray(receipt.files)||receipt.files.length!==outputs.length)throw Error('ADAPTER_REPORTS_MISSING');
    const contents=receipt.files.map((file,i)=>{
      if(file.sourcePath!==outputs[i]||file.savedPath!==`${prefix}.artifact-${i}`||file.fresh!==true)throw Error('ADAPTER_ARTIFACT_PATH_INVALID');
      const bytes=fs.readFileSync(boundedPath(root,file.savedPath));
      if(!bytes.length||bytes.length!==file.size||hash(bytes)!==file.sha256)throw Error('ADAPTER_ARTIFACT_CHANGED');
      return bytes.toString('utf8');
    });
    parsed=parseReports(spec.adapter,contents);
  }
  if(!parsed.clean||digestObject(parsed)!==digestObject(receipt.summary))throw Error('ADAPTER_REPORT_NOT_PASSED');
  return {counts:parsed.counts,receiptDigest:digestObject(receipt)};
}
module.exports={ADAPTERS,validateAdapterCommand,loadSpec,runAdapter,verifyAdapter,invocation,parseReports};
