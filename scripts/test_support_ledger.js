(async function test() {
  "use strict";
  const assert=require("node:assert/strict");
  const fs=require("node:fs");
  const vm=require("node:vm");
  const ref=JSON.parse(fs.readFileSync("data/support_ledger_reference.json","utf8"));
  const live=JSON.parse(fs.readFileSync("data/priority_projects.json","utf8"))
    .filter(x=>x.priorityCategory==="arts_content_support");
  assert.equal(ref.rows.length,73,"73 reference grants");
  assert.equal(ref.rows.filter(x=>x.typeCode==="bid").length,0,"No bid notices in 04");
  assert.deepEqual([...new Set(ref.rows.map(r=>r.year))].sort(),[2025,2026,2027]);
  assert.equal(new Set(ref.rows.map(r=>r.typeCode)).size,12);
  assert.equal(new Set(ref.rows.map(r=>r.id)).size,73);
  assert.ok(ref.rows.every(x=>x.verification==="reference_only"),"References must not claim live verification");
  assert.ok(live.length>0);
  const html=fs.readFileSync("index.html","utf8");
  const priority=fs.readFileSync("dashboard_priority_update.js","utf8");
  assert.ok(html.includes("support_ledger.css?v="));
  assert.ok(html.includes("support_ledger.js?v="));
  assert.ok(html.indexOf('src="support_ledger.js')<html.indexOf('src="dashboard_priority_update.js'));
  assert.ok(priority.includes('if (tab === "support" && window.AXOOSupportLedger)'));
  const listeners={};
  const panel={isConnected:true,innerHTML:"",addEventListener(name,handler){listeners[name]=handler;},querySelector(){return null;},contains(){return true;}};
  const store={};
  const context={
    window:{localStorage:{getItem(k){return store[k]||null},setItem(k,v){store[k]=v}}},
    fetch:async url=>{
      assert.equal(url,"data/support_ledger_reference.json");
      return{ok:true,json:async()=>ref};
    },
    console,Intl,Date,WeakSet
  };
  vm.runInNewContext(fs.readFileSync("support_ledger.js","utf8"),context,{filename:"support_ledger.js"});
  context.window.AXOOSupportLedger.render(panel,live);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.match(panel.innerHTML,/연간 공고 원장/);
  assert.match(panel.innerHTML,/시각예술전시·행사지원/);
  assert.match(panel.innerHTML,/2026년 방송영상콘텐츠후반작업지원/);
  assert.match(panel.innerHTML,/예상 일정/);
  assert.match(panel.innerHTML,/마감·참고|지난 사업/);
  assert.ok(!panel.innerHTML.includes("언폴드엑스 2026 운영 대행 용역"),"No bids in ledger");
  assert.ok(panel.innerHTML.includes("참고자료 73건"),"Reference rows should render");
  // Clicking a year chip must filter without changing other panels.
  listeners.click({target:{closest(){return{hasAttribute(){return false},dataset:{ledgerGroup:"year",ledgerValue:"2027"}}}}});
  assert.ok(panel.innerHTML.includes("2027년"));
  assert.ok(!panel.innerHTML.includes("시각예술 창작산실 (단년·다년)"));
  // Reset restores all reference years.
  listeners.click({target:{closest(){return{hasAttribute(name){return name==="data-ledger-reset"},dataset:{}}}}});
  assert.ok(panel.innerHTML.includes("시각예술 창작산실 (단년·다년)"));
  console.log("AXOO 04 support ledger checks passed: "+ref.rows.length+" reference rows + "+live.length+" live rows");
})().catch(e=>{console.error(e);process.exitCode=1;});
