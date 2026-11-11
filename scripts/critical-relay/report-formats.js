'use strict';

// 依原生報告中的案例計算結果；拒絕零案例、略過、重試後才成功及不一致統計。
function summarize(cases) {
  const counts={total:cases.length,passed:0,failed:0,skipped:0,todo:0,cancelled:0};
  for(const item of cases){if(!Object.hasOwn(counts,item.status))throw Error('REPORT_STATUS_INVALID');counts[item.status]++;}
  return {cases,counts,clean:counts.total>0&&counts.passed===counts.total};
}
function xmlTree(xml){
  if(typeof xml!=='string'||Buffer.byteLength(xml)>8*1024*1024||/<!DOCTYPE|<!ENTITY/iu.test(xml))throw Error('JUNIT_XML_UNSAFE');
  const document={name:'#document',children:[]},stack=[document];
  const tokens=xml.match(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>|[^<]+/gu)||[];
  if(tokens.join('')!==xml||tokens.length>200000)throw Error('JUNIT_XML_INVALID');
  const decode=value=>value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);/giu,token=>{
    const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
    if(named[token])return named[token];
    const number=token.startsWith('&#x')?parseInt(token.slice(3,-1),16):Number(token.slice(2,-1));
    if(!Number.isSafeInteger(number)||number<1||number>0x10ffff)throw Error('JUNIT_XML_ENTITY_INVALID');
    return String.fromCodePoint(number);
  });
  for(const token of tokens){
    if(token.startsWith('<!--')||token.startsWith('<?')||token.startsWith('<![CDATA['))continue;
    if(!token.startsWith('<')){if(stack.length===1&&token.trim())throw Error('JUNIT_XML_INVALID');continue;}
    if(token.startsWith('</')){if(token!==`</${stack.at(-1).name}>`||stack.length===1)throw Error('JUNIT_XML_UNBALANCED');stack.pop();continue;}
    const open=/^<([\w:.-]+)([\s\S]*?)(\/?)>$/u.exec(token);
    if(!open)throw Error('JUNIT_XML_INVALID');
    const attrs={},body=open[2];let offset=0;
    const pattern=/\s+([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gy;
    while(offset<body.length){
      if(!body.slice(offset).trim())break;
      pattern.lastIndex=offset;const attr=pattern.exec(body);
      if(!attr||Object.hasOwn(attrs,attr[1]))throw Error('JUNIT_XML_ATTRIBUTES_INVALID');
      const value=attr[2]??attr[3];
      if(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/iu.test(value))throw Error('JUNIT_XML_ENTITY_INVALID');
      attrs[attr[1]]=decode(value);offset=pattern.lastIndex;
    }
    const node={name:open[1],attrs,children:[]};stack.at(-1).children.push(node);
    if(!open[3])stack.push(node);
    if(stack.length>128)throw Error('JUNIT_XML_TOO_DEEP');
  }
  if(stack.length!==1||document.children.length!==1||!['testsuite','testsuites'].includes(document.children[0].name))throw Error('JUNIT_XML_INVALID_ROOT');
  return document.children[0];
}
function parseJUnit(xml){
  const root=xmlTree(xml);
  function collect(node){
    if(node.name==='testcase'){
      if(!node.attrs.name||node.children.some(x=>x.name==='testcase'))throw Error('JUNIT_CASE_INVALID');
      const names=new Set(node.children.map(x=>x.name));
      const status=['failed','failure','error'].includes(node.attrs.status)||['failure','error','flakyFailure','flakyError','rerunFailure','rerunError'].some(x=>names.has(x))?'failed'
        :names.has('skipped')||node.attrs.status==='notrun'?'skipped':'passed';
      return [{name:(node.attrs.classname||'')+'::'+node.attrs.name,status}];
    }
    if(!['testsuite','testsuites'].includes(node.name))return [];
    if(node.children.some(x=>['failure','error'].includes(x.name)))throw Error('JUNIT_SUITE_ERROR');
    const cases=node.children.flatMap(collect),summary=summarize(cases);
    if(node.attrs.failures!==undefined||node.attrs.errors!==undefined){
      const failures=node.attrs.failures||'0',errors=node.attrs.errors||'0';
      if(!/^\d+$/u.test(failures)||!/^\d+$/u.test(errors)||Number(failures)+Number(errors)!==summary.counts.failed)
        throw Error('JUNIT_COUNTS_MISMATCH');
    }
    for(const [key,value] of Object.entries({tests:cases.length,skipped:summary.counts.skipped})){
      if(node.attrs[key]!==undefined){
        if(!/^\d+$/u.test(node.attrs[key]))throw Error('JUNIT_COUNTS_INVALID');
        // JUnit 將 failures 與 errors 分開；統一後核對兩者總和。
        const actual=Number(node.attrs[key]);
        if(!Number.isSafeInteger(actual)||actual!==value)throw Error('JUNIT_COUNTS_MISMATCH');
      }
    }
    return cases;
  }
  return summarize(collect(root));
}
function parsePlaywright(text){
  const report=JSON.parse(text);
  if(!Array.isArray(report.suites)||!Array.isArray(report.errors)||report.errors.length)throw Error('PLAYWRIGHT_REPORT_INVALID');
  const cases=[];
  function visit(suites,prefix=''){
    for(const suite of suites){
      if(!Array.isArray(suite.specs))throw Error('PLAYWRIGHT_SUITE_INVALID');
      for(const spec of suite.specs){
        if(!Array.isArray(spec.tests)||!spec.tests.length)throw Error('PLAYWRIGHT_SPEC_INVALID');
        for(const item of spec.tests){
          if(!Array.isArray(item.results)||!item.results.length)throw Error('PLAYWRIGHT_RESULTS_MISSING');
          const passed=item.expectedStatus==='passed'&&item.status==='expected'&&item.results.length===1&&
            item.results[0].status==='passed'&&!(item.results[0].errors||[]).length;
          cases.push({name:prefix+suite.title+'::'+spec.title+'::'+(item.projectName||''),status:passed?'passed':'failed'});
        }
      }
      if(suite.suites)visit(suite.suites,prefix+suite.title+'::');
    }
  }
  visit(report.suites);
  const result=summarize(cases);
  if(!report.stats||!['expected','unexpected','flaky','skipped'].every(key=>Number.isSafeInteger(report.stats[key])&&report.stats[key]>=0))throw Error('PLAYWRIGHT_COUNTS_INVALID');
  if(report.stats.expected!==result.counts.passed||report.stats.unexpected+report.stats.flaky+report.stats.skipped!==result.counts.failed)throw Error('PLAYWRIGHT_COUNTS_MISMATCH');
  return result;
}
module.exports={summarize,parseJUnit,parsePlaywright};
