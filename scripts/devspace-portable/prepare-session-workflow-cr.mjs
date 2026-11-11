#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runtimeFiles, sessionWorkflowFiles, verifyBundle, probeBundle } from './workflow-bundle.mjs';

// 僅接受已逐檔回讀且與家用機 canonical core 相符的基準，不猜測其他版本補丁位置。
export const baselineDigests = Object.freeze({
  'SessionWorkflow.Core.mjs': '8511b8759f6c5b59f750736242338565a9ee3536eb7fb08ffa8b3044113e5cf7',
  'DevSpace.WorkflowStore.mjs': '25c208e806724e444a9ed3aa69b1cb5f44d4b6fd64b2c405307400fb483921fd',
  'SessionWorkflow.DevSpaceProjectResolver.mjs': 'eba7194eb31e5656381f6c8e88f2478f6771b9cd248e9e6b064ee4f3d1f72eb6'
});
const hash = value => createHash('sha256').update(value).digest('hex');
function plain(file) {
  for (let current = path.resolve(file); ; current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('SESSION_BUNDLE_LINK_BLOCKED');
    if (current === path.dirname(current)) break;
  }
}
function replace(text, before, after, expected = 1) {
  const parts = text.split(before);
  if (parts.length - 1 !== expected) throw new Error(`SESSION_PATCH_POINT_MISMATCH:${before.slice(0,70)}`);
  return parts.join(after);
}
export function patchCore(source) {
  let text = source.replace(/\r\n/g, '\n');
  text = "import { enforceCriticalRelay, withCompatibleLedgerLock } from './SessionWorkflow.CrBridge.mjs';\n" + text;
  const start = text.indexOf('async function withLock(paths, operation) {');
  const end = text.indexOf('\nfunction applyUpdate(task, input, helpers) {', start);
  if (start < 0 || end < 0) throw new Error('SESSION_LOCK_PATCH_POINT_MISSING');
  text = text.slice(0,start) + 'async function withLock(paths, operation) {\n  return withCompatibleLedgerLock(paths, operation);\n}\n' + text.slice(end);
  text = replace(text,
    '      const next = upgradeTaskToV3(await mutator(mutableTask, { actor, idFactory, now }));',
    '      const next = upgradeTaskToV3(await mutator(mutableTask, { actor, idFactory, now }));\n      enforceCriticalRelay(task, next, input, projectRef, projectRefFromPath);', 2);
  text = replace(text,
    '        return clone(\n          await appendTaskEvent(paths, state, {',
    '        enforceCriticalRelay(null, task, input, projectRef, projectRefFromPath);\n        return clone(\n          await appendTaskEvent(paths, state, {');
  return text;
}
export function patchAdapter(source) {
  let text = source.replace(/\r\n/g, '\n');
  const start = text.indexOf('const coreModule = process.env.SESSION_WORKFLOW_CORE_MODULE');
  const end = text.indexOf('\n\nconst {', start);
  if (start < 0 || end < 0) throw new Error('SESSION_ADAPTER_PATCH_POINT_MISSING');
  // 套件固定所有相依，避免環境變數把新版核心轉向不含閘門的舊核心。
  text = text.slice(0,start) + "const coreModule = await import('./SessionWorkflow.Core.mjs');\nconst projectResolverModule = await import('./SessionWorkflow.DevSpaceProjectResolver.mjs');" + text.slice(end);
  text = replace(text, '      requireReview: z.boolean().optional(),',
    '      requireReview: z.boolean().optional(),\n      criticalRelayRequired: z.boolean().optional(),\n      criticalRelay: z.unknown().optional().describe("完整 CR v2 狀態；在原 ledger 交易內重新驗證"),');
  text = replace(text, '      reason: z.string().min(1).max(4_000).optional(),',
    '      reason: z.string().min(1).max(4_000).optional(),\n      criticalRelayRequired: z.boolean().optional(),\n      criticalRelay: z.unknown().optional(),');
  text = replace(text, '      ...input,\n      projectRef: workspace.projectRef,\n      relatedProjectRefs:',
    '      ...input,\n      workspaceRoot: workspace.workspaceRoot,\n      projectRef: workspace.projectRef,\n      relatedProjectRefs:');
  text = replace(text, '      ...updateInput,\n      projectRef: workspace.projectRef,',
    '      ...updateInput,\n      workspaceRoot: workspace.workspaceRoot,\n      projectRef: workspace.projectRef,');
  return text + '\nexport const criticalRelayRuntime = Object.freeze({ integrationProfile: "session-workflow-v3-cr-v1", ledgerSchemas: [1,2,3], executionSchema: "pixiu.cr-execution.v2", pid: process.pid, loadedAt: new Date().toISOString() });\n';
}
export function prepareSessionBundle(sourceRoot, installedBin, destination) {
  plain(destination);
  if (fs.existsSync(destination)) throw new Error('SESSION_DESTINATION_EXISTS');
  const baseline = {};
  for (const [name,digest] of Object.entries(baselineDigests)) {
    const file = path.join(installedBin, name); plain(file);
    const bytes = fs.readFileSync(file);
    if (hash(bytes) !== digest) throw new Error(`SESSION_BASELINE_CHANGED:${name}`);
    baseline[name] = bytes.toString('utf8');
  }
  const entries = new Map();
  for (const file of runtimeFiles) {
    plain(path.join(sourceRoot,file));
    entries.set(file, fs.readFileSync(path.join(sourceRoot,file)));
  }
  const prefix = 'scripts/devspace-portable/';
  entries.set(prefix+'DevSpace.WorkflowStore.mjs', Buffer.from(patchAdapter(baseline['DevSpace.WorkflowStore.mjs'])));
  entries.set(prefix+'SessionWorkflow.Core.mjs', Buffer.from(patchCore(baseline['SessionWorkflow.Core.mjs'])));
  entries.set(prefix+'SessionWorkflow.DevSpaceProjectResolver.mjs', Buffer.from(baseline['SessionWorkflow.DevSpaceProjectResolver.mjs']));
  plain(path.join(sourceRoot,prefix+'SessionWorkflow.CrBridge.mjs'));
  entries.set(prefix+'SessionWorkflow.CrBridge.mjs',fs.readFileSync(path.join(sourceRoot,prefix+'SessionWorkflow.CrBridge.mjs')));
  const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8',windowsHide:true}).trim();
  const sourceDirty=execFileSync('git',['status','--porcelain=v1','--',...runtimeFiles,prefix+'SessionWorkflow.CrBridge.mjs',prefix+'prepare-session-workflow-cr.mjs',prefix+'workflow-bundle.mjs'],{cwd:sourceRoot,encoding:'utf8',windowsHide:true}).trim().length>0;
  const files=sessionWorkflowFiles.map(file=>({path:file,sha256:hash(entries.get(file)),length:entries.get(file).length}));
  const manifest={schemaVersion:'pixiu.workflow-bundle.v1',sourceCommit,sourceDirty,
    compatibilityProfile:'session-workflow-v3-cr-v1',baselineDigests,
    contentDigest:hash(JSON.stringify(files.map(item=>[item.path,item.sha256]))),
    executionSchema:'pixiu.cr-execution.v2',entry:runtimeFiles[0],files};
  fs.mkdirSync(destination,{recursive:true});
  for (const [file,bytes] of entries) {
    const target=path.join(destination,file); fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,bytes,{flag:'wx',mode:0o600});
  }
  fs.writeFileSync(path.join(destination,'WORKFLOW-BUNDLE.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
  verifyBundle(destination);
  return probeBundle(destination);
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2),upgrade=args[0]==='upgrade';if(upgrade)args.shift();
    const [source,installed,destination]=args;
    if (!source||!installed||!destination) throw new Error('用法：prepare-session-workflow-cr.mjs <sourceRoot> <已核對的舊bin> <新目的地>');
    console.log(JSON.stringify((upgrade?upgradeSessionBundle:prepareSessionBundle)(path.resolve(source),path.resolve(installed),path.resolve(destination))));
  } catch(error) { console.error(error.message);process.exitCode=2; }
}

// 已部署 schema-3 套件升級：保留該機原有 ledger adapter/core，只更新 CR runtime。
export function upgradeSessionBundle(sourceRoot,installedBundle,destination){
  plain(installedBundle);plain(destination);
  if(fs.existsSync(destination))throw Error('SESSION_DESTINATION_EXISTS');
  const manifest=JSON.parse(fs.readFileSync(path.join(installedBundle,'WORKFLOW-BUNDLE.json'),'utf8'));
  const added=new Set(['research-evidence.js','evidence-adapters.js','report-formats.js','adapter-worker.js','runtime-info.js']);
  const legacy=sessionWorkflowFiles.filter(file=>!added.has(path.basename(file)));
  const expected=manifest.files?.length===legacy.length?legacy:sessionWorkflowFiles;
  if(manifest.schemaVersion!=='pixiu.workflow-bundle.v1'||manifest.compatibilityProfile!=='session-workflow-v3-cr-v1'||
      manifest.executionSchema!=='pixiu.cr-execution.v2'||manifest.entry!==runtimeFiles[0]||
      !Array.isArray(manifest.files)||manifest.files.length!==expected.length||new Set(manifest.files.map(x=>x.path)).size!==expected.length||
      expected.some(file=>!manifest.files.some(x=>x.path===file))||
      JSON.stringify(manifest.baselineDigests)!==JSON.stringify(baselineDigests))throw Error('SESSION_UPGRADE_MANIFEST_INVALID');
  for(const item of manifest.files){
    const target=path.join(installedBundle,item.path);plain(target);
    const bytes=fs.readFileSync(target);if(bytes.length!==item.length||hash(bytes)!==item.sha256)throw Error('SESSION_UPGRADE_HASH_MISMATCH');
  }
  if(hash(JSON.stringify(manifest.files.map(x=>[x.path,x.sha256])))!==manifest.contentDigest)throw Error('SESSION_UPGRADE_DIGEST_MISMATCH');
  const entries=new Map(runtimeFiles.map(file=>{plain(path.join(sourceRoot,file));return [file,fs.readFileSync(path.join(sourceRoot,file))];}));
  for(const name of ['DevSpace.WorkflowStore.mjs','SessionWorkflow.Core.mjs','SessionWorkflow.DevSpaceProjectResolver.mjs']){
    const file='scripts/devspace-portable/'+name;entries.set(file,fs.readFileSync(path.join(installedBundle,file)));
  }
  const bridge='scripts/devspace-portable/SessionWorkflow.CrBridge.mjs';plain(path.join(sourceRoot,bridge));entries.set(bridge,fs.readFileSync(path.join(sourceRoot,bridge)));
  const packaged=fs.existsSync(path.join(sourceRoot,'WORKFLOW-BUNDLE.json'))?verifyBundle(sourceRoot):null;
  const sourceCommit=packaged?.sourceCommit||execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8',windowsHide:true}).trim();
  const sourceDirty=packaged?packaged.sourceDirty:execFileSync('git',['status','--porcelain=v1','--',...runtimeFiles,bridge,'scripts/devspace-portable/prepare-session-workflow-cr.mjs'],{cwd:sourceRoot,encoding:'utf8',windowsHide:true}).trim().length>0;
  const files=sessionWorkflowFiles.map(file=>({path:file,sha256:hash(entries.get(file)),length:entries.get(file).length}));
  const next={schemaVersion:'pixiu.workflow-bundle.v1',sourceCommit,sourceDirty,compatibilityProfile:'session-workflow-v3-cr-v1',baselineDigests,previousBundleDigest:manifest.contentDigest,
    contentDigest:hash(JSON.stringify(files.map(x=>[x.path,x.sha256]))),executionSchema:'pixiu.cr-execution.v2',entry:runtimeFiles[0],files};
  fs.mkdirSync(destination,{recursive:true});
  for(const [file,bytes] of entries){const target=path.join(destination,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx',mode:0o600});}
  fs.writeFileSync(path.join(destination,'WORKFLOW-BUNDLE.json'),JSON.stringify(next,null,2)+'\n',{flag:'wx',mode:0o600});
  verifyBundle(destination);return probeBundle(destination);
}
