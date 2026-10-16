'use strict';

// 研究證據只回讀已取得的來源，不執行網路搜尋，也不把來源驗收當作程式測試。
const {readJson, readText, digestObject, hash, isObject, boundedPath} = require('./test-plan');
const fs=require('node:fs'),path=require('node:path');
const PROFILE='research-evidence-v1';
function assertResearchTransition(previous,next){
  if(!previous?.researchRequired)return;
  if(next?.researchRequired!==true||!Array.isArray(next.researchHistory)||next.researchHistory.length<(previous.researchHistory||[]).length||
      (previous.researchHistory||[]).some((item,i)=>digestObject(item)!==digestObject(next.researchHistory[i])))
    throw Error('RESEARCH_HISTORY_REWRITTEN');
}
function loadResearchPlan(root, planPath) {
  const plan=readJson(root,planPath);
  const id=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{0,79}$/u.test(x);
  if(plan.schemaVersion!=='pixiu.research-plan.v1'||!id(plan.id)||
      !Number.isSafeInteger(plan.revision)||plan.revision<1||!Array.isArray(plan.criteria)||!plan.criteria.length||
      !Array.isArray(plan.sources)||!plan.sources.length)
    throw Error('RESEARCH_PLAN_REQUIRED: 請提供來源驗收計畫，不使用 Node 測試計畫');
  const criteria=new Set();
  for(const item of plan.criteria){
    if(!id(item.id)||criteria.has(item.id)||typeof item.criterion!=='string'||!item.criterion.trim())throw Error('RESEARCH_CRITERIA_INVALID');
    criteria.add(item.id);
  }
  const seen=new Set(),covered=new Set();
  for(const source of plan.sources){
    if(!id(source.id)||seen.has(source.id)||typeof source.locator!=='string'||
        !/^(https?:\/\/|repo:|git:|doi:)\S+$/u.test(source.locator)||
        !Array.isArray(source.criterionRefs)||!source.criterionRefs.length||source.criterionRefs.some(x=>!criteria.has(x)))
      throw Error('RESEARCH_SOURCE_INVALID');
    boundedPath(root,source.file,{mustExist:false});
    if(source.file.startsWith('.cr/'))throw Error('RESEARCH_SOURCE_MUST_BE_INPUT');
    seen.add(source.id);source.criterionRefs.forEach(x=>covered.add(x));
  }
  if([...criteria].some(x=>!covered.has(x)))throw Error('RESEARCH_CRITERIA_UNCOVERED');
  return plan;
}
function validateResearchBinding(root,binding){
  if(!isObject(binding)||binding.profile!==PROFILE||typeof binding.planPath!=='string'||binding.planPath.startsWith('.cr/'))
    throw Error('RESEARCH_BINDING_REQUIRED');
  const plan=loadResearchPlan(root,binding.planPath);
  if(digestObject(plan)!==binding.planDigest)throw Error('RESEARCH_PLAN_CHANGED');
  return {profile:PROFILE,planPath:binding.planPath,planDigest:binding.planDigest};
}
function createResearchState(root,planPath,{objective,lifecycleOptions={taskType:'research',depth:'standard'}}={}){
  if(planPath.startsWith('.cr/'))throw Error('RESEARCH_PLAN_MUST_BE_INPUT');
  const plan=loadResearchPlan(root,planPath);
  const {createCriticalRelay}=require('./critical-relay');
  const {createLifecycle}=require('./lifecycle');
  return {...createCriticalRelay({objective:objective||'依固定來源計畫研究與反證，不宣稱執行產品測試',
    completionCriteria:plan.criteria,lifecycle:createLifecycle({...lifecycleOptions,taskType:'research'})}),
    researchRequired:true,researchBinding:{profile:PROFILE,planPath,planDigest:digestObject(plan)},
    researchVerification:null,researchHistory:[]};
}
function readSources(root,plan){
  return plan.sources.map(source=>{
    const content=readText(root,source.file);
    if(!content.trim())throw Error('RESEARCH_SOURCE_EMPTY: '+source.id);
    return {id:source.id,file:source.file,locator:source.locator,sha256:hash(content),bytes:Buffer.byteLength(content)};
  });
}
function captureResearchEvidence(root,state){
  validateResearchBinding(root,state.researchBinding);
  if(state.researchRequired!==true||state.mode!=='general'||state.executionContract)throw Error('RESEARCH_MODE_INVALID');
  const plan=loadResearchPlan(root,state.researchBinding.planPath),sources=readSources(root,plan);
  const next=structuredClone(state);
  const checkpoint={planDigest:state.researchBinding.planDigest,sources};
  const digest=digestObject(checkpoint);
  if(next.researchVerification?.digest===digest)return next;
  const snapshots=sources.map(source=>{
    const file=`.cr/research/${digest}/${source.id}.txt`,target=boundedPath(root,file,{mustExist:false});
    fs.mkdirSync(path.dirname(target),{recursive:true});
    const content=readText(root,source.file);
    if(hash(content)!==source.sha256)throw Error('RESEARCH_SOURCE_CHANGED_DURING_CAPTURE');
    if(fs.existsSync(target)){if(hash(readText(root,file))!==source.sha256)throw Error('RESEARCH_SNAPSHOT_CHANGED');}
    else fs.writeFileSync(target,content,{flag:'wx',mode:0o600});
    return {id:source.id,file,sha256:source.sha256};
  });
  next.researchVerification={...checkpoint,digest,snapshots,recordedAt:new Date().toISOString()};
  next.researchHistory=[...(next.researchHistory||[]),next.researchVerification];
  for(const source of sources){
    const evidenceId='research-'+source.id+'-'+source.sha256.slice(0,16);
    if(!next.evidence.some(x=>x.id===evidenceId))next.evidence.push({id:evidenceId,source:source.locator,
      provenance:'來源檔案實際回讀；其原文真偽與論點仍需人工查核',file:source.file,sha256:source.sha256});
  }
  if(next.lifecycle.entries.some(x=>x.cycle===next.lifecycle.cycle&&x.stage==='verification')){
    next.lifecycle=require('./lifecycle').reopenLifecycle(next.lifecycle,
      {reason:'研究來源改變，重新查核論點與反證',evidenceRef:next.evidence.at(-1).id});
  }
  for(const criterion of next.completionCriteria){
    criterion.satisfied=true;
    criterion.evidenceRefs=plan.sources.filter(x=>x.criterionRefs.includes(criterion.id)).map(x=>{
      const source=sources.find(s=>s.id===x.id);return 'research-'+source.id+'-'+source.sha256.slice(0,16);
    });
  }
  require('./critical-relay').recordCriticalRelayPhase(next,'VERIFY');
  next.status='active';next.nextAction='完成來源、反證與 Lifecycle 覆核，再記錄 RECHALLENGE';
  return next;
}
function verifyResearchEvidence(root,state,binding){
  try{
    const pin=validateResearchBinding(root,binding);
    if(state.researchRequired!==true||state.mode!=='general'||state.executionContract||
        digestObject(state.researchBinding)!==digestObject(pin)||state.lifecycle?.taskType!=='research')throw Error('RESEARCH_MODE_OR_BINDING_CHANGED');
    const plan=loadResearchPlan(root,pin.planPath),checkpoint={planDigest:pin.planDigest,sources:readSources(root,plan)};
    if(!isObject(state.researchVerification)||state.researchVerification.digest!==digestObject(checkpoint)||
        digestObject(state.researchVerification.sources)!==digestObject(checkpoint.sources))throw Error('RESEARCH_SOURCE_READBACK_REQUIRED');
    if(digestObject(state.completionCriteria.map(x=>x.id).sort())!==digestObject(plan.criteria.map(x=>x.id).sort()))throw Error('RESEARCH_CRITERIA_CHANGED');
    if(!Array.isArray(state.researchHistory)||!state.researchHistory.length||digestObject(state.researchHistory.at(-1))!==digestObject(state.researchVerification))throw Error('RESEARCH_HISTORY_MISMATCH');
    for(const expected of plan.criteria){
      const actual=state.completionCriteria.find(x=>x.id===expected.id);
      const refs=plan.sources.filter(x=>x.criterionRefs.includes(expected.id)).map(x=>{const source=checkpoint.sources.find(s=>s.id===x.id);return 'research-'+source.id+'-'+source.sha256.slice(0,16);});
      if(actual.criterion!==expected.criterion||actual.satisfied!==true||digestObject(actual.evidenceRefs)!==digestObject(refs))throw Error('RESEARCH_CRITERIA_EVIDENCE_CHANGED');
    }
    if(!Array.isArray(state.researchVerification.snapshots)||state.researchVerification.snapshots.length!==checkpoint.sources.length)throw Error('RESEARCH_SNAPSHOT_MISSING');
    for(const [index,source] of checkpoint.sources.entries()){
      const saved=state.researchVerification.snapshots[index];
      if(saved.id!==source.id||saved.file!==`.cr/research/${state.researchVerification.digest}/${source.id}.txt`||
          saved.sha256!==source.sha256||hash(readText(root,saved.file))!==source.sha256)throw Error('RESEARCH_SNAPSHOT_CHANGED');
      const id='research-'+source.id+'-'+source.sha256.slice(0,16),entry=state.evidence.find(x=>x.id===id);
      if(!entry||entry.sha256!==source.sha256||entry.source!==source.locator||entry.file!==source.file)throw Error('RESEARCH_EVIDENCE_CHANGED');
    }
    return {canComplete:true,blockingReasons:[]};
  }catch(error){return {canComplete:false,blockingReasons:[error.message]};}
}
module.exports={assertResearchTransition,PROFILE,loadResearchPlan,validateResearchBinding,createResearchState,captureResearchEvidence,verifyResearchEvidence};
