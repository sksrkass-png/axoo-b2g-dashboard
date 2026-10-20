(function testP2(){
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const js=fs.readFileSync("support_pipeline.js","utf8");
const registry={},listeners={},added=[];
const window={localStorage:{getItem:k=>registry[k]||null,setItem:(k,v)=>{registry[k]=v}},confirm:()=>true};
const document={createElement:(tag)=>({tagName:tag,className:"",innerHTML:"",insertAdjacentElement(){},remove(){},scrollIntoView(){} }),body:{appendChild(){} }};
const host={isConnected:true,querySelector(selector){
 if(selector===".ax-ledger-now")return{insertAdjacentElement:(pos,el)=>{added.push(el.innerHTML)}};
 return null;
},addEventListener(type,fn){listeners[type]=fn},contains(){return true}};
const ctx={window,document,Intl,Date,Number,String,Math,Map,Object,Array,console,FormData:class{
 constructor(element){this.data=element.values}
 get(k){return this.data[k]||""}
 has(k){return Object.hasOwn(this.data,k)}
}};
vm.runInNewContext(js,ctx,{filename:"support_pipeline.js"});
const api=window.AXOOSupportPipeline;
assert(api);
assert.equal(api.getStorageInfo().storage,"browser-local");
const row={id:"live-test-01",title:"2027 전시 기획 지원",organization:"테스트기관",kind:"live",
 deadline:"2026-11-30",url:"https://example.org/official/notice"};
const ref={id:"reference-002",title:"2025 예상 공고",organization:"참고 기관",kind:"reference",deadline:"",url:""};
function render(){api.render(host,[row,ref],render)}
render();
assert(added.at(-1).includes("브라우저 임시 지원관리"));
assert(added.at(-1).includes("Airtable 공동 지원관리"));
assert(added.at(-1).includes("applM2n5kScusEfYr"));
assert(added.at(-1).includes("paga5K65AZi8SHJIi"),"P5 shared Airtable inbox must be linked");
assert(added.at(-1).includes("pag6YNkNTdWNaIFrV"),"P5 policy settings must be linked");
assert.match(api.buttonFor(row),/검토 등록/);
const addButton={dataset:{p2Add:row.id},hasAttribute:(x)=>x==="data-p2-add"};
listeners.click({target:{closest:()=>addButton}});
assert.equal(api.getSnapshot().length,1);
assert.equal(api.getSnapshot()[0].status,"INTEREST");
assert.match(api.buttonFor(row),/관심 등록/);
const editorHtml=added.at(-1);
assert(editorHtml.includes("공고 원문 마감일"));
assert(editorHtml.includes("지원 준비 체크리스트"));
const values={status:"PREPARING",owner:"재형",priority:"HIGH",progress:"60",deadline:"2026-11-22",
 nextAction:"예산서·참여작가 포트폴리오 준비",detail:"디렉터 검토 대기",result:"",task0:"on",task2:"on"};
listeners.submit({target:{matches:q=>q==="[data-p2-form]",values},preventDefault(){}});
assert.equal(api.getSnapshot()[0].status,"PREPARING");
assert.equal(api.getSnapshot()[0].owner,"재형");
assert.equal(api.getSnapshot()[0].progress,60);
assert.equal(api.getSnapshot()[0].deadline,"2026-11-22");
const raw=JSON.parse(Object.values(registry)[0]);
assert.equal(raw.format,"AXOO_P2");
assert(raw.records[0].deadlineOverride);
assert.equal(raw.records[0].tasks[0].done,true);
assert.equal(raw.records[0].tasks[1].done,false);
assert.equal(raw.records[0].sourceDeadline,"2026-11-30");
row.deadline="2026-12-01";
render();
const after=JSON.parse(Object.values(registry)[0]);
assert.equal(after.records[0].deadline,"2026-11-22");
const newWindow={localStorage:window.localStorage,confirm:()=>true};
const fresh={...ctx,window:newWindow};
vm.runInNewContext(js,fresh,{filename:"support_pipeline.js"});
assert.equal(newWindow.AXOOSupportPipeline.getSnapshot()[0].owner,"재형");
assert.equal(newWindow.AXOOSupportPipeline.getSnapshot()[0].status,"PREPARING");
assert(!api.buttonFor(ref).includes("PREPARING"));
console.log("P2 local-first grant workflow tests passed");
})();
