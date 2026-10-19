"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {fields,status}=require("./sync_airtable_support_candidates");
const real=JSON.parse(fs.readFileSync("data/priority_projects.json","utf8"))
 .filter(x=>x.priorityCategory==="arts_content_support");
assert(real.length>=1,"At least one eligible source record required");
const first=real[0],mapped=fields(first);
assert.equal(mapped["fldVj9VooEtVzFaU7"],"live-"+first.id);
assert.equal(mapped["fldiCBkIAl1hNXb8g"],first.title);
assert.equal(typeof mapped["fldZycGG3GsunqXu1"],"number");
assert(!("fldwnx5fWNknJ8jGk" in mapped),"Do not reset human selection");
assert(!("fldTo44rlhm7Pr6Oe" in mapped),"Do not reset registration status");
assert(!("fld1zUvi8HAqISxmA" in mapped),"Do not alter linked application");
assert.equal(status({deadline:"2025-01-01"}),"마감");
assert.equal(status({deadline:"2099-01-01",verificationStatus:"source_unavailable"}),"원문 재확인");
assert.equal(status({deadline:"2099-01-01",startDate:"2098-01-01"}),"기간상 접수 가능");
assert.ok(mapped["fld9RQNIGOv04uMsD"]?.startsWith("https://")||!mapped["fld9RQNIGOv04uMsD"]);
console.log("Airtable mirror checks passed; source-only fields, no staff work overwritten; "+real.length+" public candidates");
