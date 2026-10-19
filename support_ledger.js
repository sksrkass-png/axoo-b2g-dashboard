(function ledger(){
"use strict";
const REF_URL="data/support_ledger_reference.json";
const HEALTH_URL="data/support_collection_health.json";
const TYPE={create:"창작·발표",curate:"전시기획",space:"공간·레지던시",public:"공공미술·건축미술",media:"미디어아트",fair:"페스티벌·아트페어",market:"유통·미술시장",intl:"해외진출",critic:"비평·매체",welfare:"생활·준비금",tech:"기술융합·AI",biz:"예술기업",bid:"입찰·용역"};
const FILTERS={year:"전체",type:"전체",region:"전체",status:"전체",mode:"전체",level:"전체",source:"전체",sort:"STATUS",query:""};
const KEY="axoo_support_ledger_preferences_v1";
let reference=null,referenceError=false,pending=null,health=null,healthPending=null;
const hooked=new WeakSet();
try{const saved=JSON.parse(window.localStorage.getItem(KEY)||"{}");Object.keys(FILTERS).forEach(k=>{if(typeof saved[k]==="string")FILTERS[k]=saved[k]})}catch(e){}
const escape=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=u=>/^https?:\/\/[^\s"'<>]+$/i.test(String(u||""))?String(u):"";
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function normal(v){return String(v||"").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");}
function dateValue(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||""))?v:"";}
function yearOf(x){const m=String(x.title||"").match(/(?:^|[^\d])(202[5-9])(?:년|[^\d]|$)/);return m?Number(m[1]):Number((x.deadline||x.publishedDate||"").slice(0,4))||null;}
function typeOf(x){
  const v=String(x.title||"")+" "+String(x.businessAreaLabel||"");
  if(/비평|연구|매체/.test(v))return"critic";
  if(/생활|준비금|복지|기회소득/.test(v))return"welfare";
  if(/화랑|유통|아트경기|미술시장/.test(v))return"market";
  if(/창업|기업|스타트업|스케일업|사업화|오픈이노베이션/.test(v))return"biz";
  if(/국제|해외|글로벌|협업/.test(v))return"intl";
  if(/AI|실감|미디어|기술|융합|디지털/.test(v))return"tech";
  if(/공공미술|건축물|조형|공공디자인/.test(v))return"public";
  if(/아트페어|축제|페스티벌|행사/.test(v))return"fair";
  if(/전시|기획/.test(v))return"curate";
  if(/공간|레지던시|입주/.test(v))return"space";
  if(/영상|콘텐츠|미디어/.test(v))return"media";
  return"create";
}
function participation(applicants,note,live){
  // Fit rationale is not proof of eligibility.
  const joined=String(applicants||"")+(live?"":" "+String(note||""));
  if(/컨소시엄|공동\s*응모|공동\s*지원|작가-제작사|작가·회사|작가.*회사|회사.*작가/.test(joined))return"협업·컨소시엄";
  if(/개인\s*신청|작가\s*개인|전속작가\s*개인|예술가\s*개인|1인|예술인\s*개인|개인만/.test(joined))return"작가·개인";
  if(/법인|사업자|예술기업|창업기업|유통사업자|제작사|기업|주최\s*단체|기획\s*단체|운영\s*주체|예술단체/.test(joined))return"법인·단체 검토";
  return"자격 확인";
}

function statusOf(x){
 const now=today();
 if(x.kind==="reference"){
   if(x.expected)return {code:"forecast",label:"예상 일정",rank:3};
   // The supplied 2026-10-14 reference explicitly treated all non-future, non-forecast records as closed.
   if(x.deadline&&x.deadline>=now)return{code:"verify",label:"접수 확인 필요",rank:1};
   return{code:"closed",label:"마감·참고",rank:5};
 }
 if(x.deadline&&x.deadline<now)return{code:"closed",label:"마감",rank:5};
 if(x.sourceStatus==="마감")return{code:"verify",label:"원문 재확인",rank:4};
 if(["source_unavailable","stale_previous_run"].includes(x.verificationStatus))return{code:"verify",label:"수집 재확인",rank:4};
 const refreshed=String(x.verifiedAt||"").slice(0,10);
 if(refreshed&&refreshed<new Date(Date.now()-72*3600000).toISOString().slice(0,10))return{code:"verify",label:"수집 오래됨",rank:4};
 if(x.deadline&&x.startDate&&x.startDate>now)return{code:"scheduled",label:"접수 예정(일정상)",rank:2};
 if(x.deadline&&x.deadline>=now)return{code:"open",label:"기간상 접수 가능",rank:0};
 return{code:"verify",label:"접수기간 확인",rank:4};
}
function fromLive(x){
 const y=yearOf(x);
 const row={id:"live-"+x.id,year:y,level:x.sourceLevel||"국가",region:x.region||"전국",organization:x.organization||x.agency||x.source||"발주기관",title:x.title||"",typeCode:typeOf(x),period:[x.startDate,x.deadline].filter(Boolean).join(" ~ ")||"원문 확인",benefit:x.supportDetails||x.detailSummary||"지원 규모는 원문 확인",applicants:x.eligibility||"원문 확인",collaborationNote:x.gradeReason||"",url:x.sourceUrl||x.originalUrl||"",deadline:dateValue(x.deadline||x.endDate),startDate:dateValue(x.startDate),kind:"live",score:Number(x.score)||0,grade:x.grade||"C",sourceCode:x.sourceCode||"",sourceStatus:x.status||"",verificationStatus:x.verificationStatus||"",verifiedAt:x.collectionVerifiedAt||x.collectedAt||"",sourceLastCheckedAt:x.sourceLastCheckedAt||"",companyEligible:x.companyEligible,excluded:x.isExcludedFromPriority===true,confidence:x.analysisConfidence||"low",supportAmount:Number(x.supportAmount)||0,verified:"자동 수집 · 신청자격 원문 재확인"};
 row.mode=participation(row.applicants,row.collaborationNote,x);
 row.status=statusOf(row);return row;
}
function fromRef(x){
 const row={...x,kind:"reference",score:null,grade:"",startDate:"",excluded:false,confidence:"reference",verified:"2026.10.14 참고자료 · 실시간 검증 전"};
 row.mode=participation(row.applicants,row.collaborationNote,null);
 row.status=statusOf(row);return row;
}
function build(live){
 const now=today(),seen=new Set(),items=[];
 const makeKey=x=>String(x.year||"")+"|"+normal(x.title);
 (live||[]).filter(x=>x&&x.priorityCategory==="arts_content_support").forEach(x=>{const r=fromLive(x);seen.add(makeKey(r));items.push(r)});
 (reference?.rows||[]).forEach(x=>{if(x.typeCode==="bid")return;const r=fromRef(x),key=makeKey(r);if(!seen.has(key)){seen.add(key);items.push(r)}});
 return items;
}
function textValue(r){return [r.title,r.organization,r.level,r.region,TYPE[r.typeCode],r.benefit,r.applicants,r.collaborationNote,r.period,r.mode,r.sourceCode].join(" ").toLowerCase();}
function matches(r){
 const f=FILTERS;
 return (f.source==="전체"||r.sourceCode===f.source)
 &&(f.year==="전체"||String(r.year)===f.year)
 &&(f.type==="전체"||r.typeCode===f.type)
 &&(f.region==="전체"||r.region===f.region)
 &&(f.level==="전체"||r.level===f.level)
 &&(f.status==="전체"||r.status.code===f.status)
 &&(f.mode==="전체"||r.mode===f.mode)
 &&(!f.query||textValue(r).includes(f.query.trim().toLowerCase()));
}
function amountRank(r){
 if(r.kind==="live")return r.supportAmount||0;
 const v=String(r.benefit||"");
 if(!/최대|건당|각\s*\d|1인|기업별|팀당|건\s*지원/.test(v))return 0;
 const m=v.match(/(\d+(?:\.\d+)?)\s*(억|천만|백만|만원|만)/);
 if(!m)return 0;
 return Number(m[1])*({억:100000000,천만:10000000,백만:1000000,만원:10000,만:10000}[m[2]]||0);
}
function comparator(a,b){
 const s=FILTERS.sort;
 if(s==="YEAR")return(b.year||0)-(a.year||0)||a.status.rank-b.status.rank;
 if(s==="NEWEST")return String(b.kind==="live"?b.startDate||b.deadline:"").localeCompare(String(a.kind==="live"?a.startDate||a.deadline:""))||a.status.rank-b.status.rank;
 if(s==="DEADLINE")return (a.deadline||"9999-99-99").localeCompare(b.deadline||"9999-99-99")||a.status.rank-b.status.rank;
 if(s==="AMOUNT")return amountRank(b)-amountRank(a)||a.status.rank-b.status.rank;
 if(s==="FIT")return (b.score??-1)-(a.score??-1)||a.status.rank-b.status.rank;
 return a.status.rank-b.status.rank||(a.deadline||"9999-99-99").localeCompare(b.deadline||"9999-99-99")||(b.year||0)-(a.year||0);
}
function chip(group,value,label,count){
 const active=FILTERS[group]===value;
 return `<button type="button" class="ax-ledger-chip ${active?"is-selected":""}" data-ledger-group="${escape(group)}" data-ledger-value="${escape(value)}" aria-pressed="${active}">${escape(label)}${count==null?"":` <small>${count}</small>`}</button>`;
}
function chipRow(label,group,options,rows){return `<div class="ax-ledger-filter-row"><strong>${escape(label)}</strong><div class="ax-ledger-chipbar">${options.map(z=>chip(group,z[0],z[1],z[0]==="전체"?null:rows.filter(r=>String(r[group])===z[0]||(group==="status"&&r.status.code===z[0])).length)).join("")}</div></div>`;}
function selectControl(group,label,options){return `<label class="ax-ledger-select">${escape(label)}<select data-ledger-select="${escape(group)}">${options.map(x=>`<option value="${escape(x[0])}" ${FILTERS[group]===x[0]?"selected":""}>${escape(x[1])}</option>`).join("")}</select></label>`;}
function aLink(r,txt){const u=safeUrl(r.url);return u?`<a href="${escape(u)}" target="_blank" rel="noopener noreferrer">${txt}</a>`:txt;}
function shorten(s,n=160){const t=String(s||"").replace(/\s+/g," ").trim();return t.length>n?t.slice(0,n)+"…":t;}
function rowHtml(r){
 const note=r.kind==="reference"?"참고자료":(r.confidence==="high"?"공식 출처 수집 · 신청자격 재확인":"자동 수집 · 근거 보완 필요");
 return `<tr><td class="ax-year">${escape(r.year||"확인")}</td>
 <td><span class="ax-ledger-status ax-${escape(r.status.code)}">${escape(r.status.label)}</span></td>
 <td class="ax-ledger-agency">${escape(r.organization)}<small>${escape(r.level)} · ${escape(r.region)}</small></td>
 <td class="ax-ledger-name">${aLink(r,escape(r.title))}<small>${escape(note)}${r.excluded?" · 적합도 낮음":""}${r.kind==="live"&&r.verifiedAt?" · 수집 "+escape(r.verifiedAt.slice(0,10)):""}</small></td>
 <td><span class="ax-ledger-tag">${escape(TYPE[r.typeCode]||"기타")}</span></td>
 <td class="ax-ledger-date">${escape(r.period||r.deadline||"확인 필요")}</td>
 <td class="ax-ledger-benefit">${escape(shorten(r.benefit,180))}</td>
 <td class="ax-ledger-target">${escape(shorten(r.applicants,145))}</td>
 <td class="ax-ledger-mode"><strong>${escape(r.mode)}</strong><small>${escape(shorten(r.collaborationNote,100)||"원문에서 자격 확인")}</small></td>
 <td class="ax-ledger-score">${r.score==null?"—":escape(r.score+"점")}<small>${escape(r.kind==="live"?r.grade:"미평가")}</small></td></tr>`;
}
function store(){try{window.localStorage.setItem(KEY,JSON.stringify(FILTERS))}catch(e){}}
function draw(panel,live){
 if(!panel||!panel.isConnected)return;
 const rows=build(live);
 const displayed=rows.filter(matches).sort(comparator);
 const counts=(code)=>rows.filter(r=>r.status.code===code).length;
 const now=rows.filter(r=>r.kind==="live"&&r.status.code==="open"&&!r.excluded).sort(comparator).slice(0,5);
 const years=[...new Set(rows.map(r=>String(r.year)).filter(x=>/^\d{4}$/.test(x)))].sort((a,b)=>Number(b)-Number(a));
 const types=Object.keys(TYPE).filter(x=>x!=="bid").map(x=>[x,TYPE[x]]);
 const modes=["법인·단체 검토","협업·컨소시엄","작가·개인","자격 확인"];
 const sources=[...new Map(rows.filter(r=>r.kind==="live").map(r=>[r.sourceCode,r.organization])).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
 const sourceSummary=Array.isArray(health?.sources)?health.sources:[];
 const allOption=[["전체","전체"]];
 panel.innerHTML=`
 <section class="ax-ledger" aria-label="예술·콘텐츠 연간 지원사업 공고 원장">
 <div class="ax-ledger-head">
  <div><span class="ax-ledger-kicker">AXOO / 04 · SUPPORT OPPORTUNITY LEDGER</span>
  <h2>예술·콘텐츠 지원사업 <em>연간 공고 원장</em></h2>
  <p>국가·광역·기초·민간 지원사업을 폭넓게 검토합니다. 지원 자격과 AXOO 적합도는 별도 판단하며, 입찰·용역은 기존 분류에서 확인하세요.</p></div>
  <div class="ax-ledger-head-meta"><strong>${rows.length}건</strong><span>자동 수집 + 참고 이력</span></div>
 </div>
 <div class="ax-ledger-statrow">
 ${[["전체 공고",rows.length],["기간상 접수 가능",counts("open")],["접수 확인 필요",counts("verify")],["예상 일정",counts("forecast")],["지난 사업·마감",counts("closed")]].map(([k,v])=>`<div class="ax-ledger-stat"><span>${escape(k)}</span><strong>${v}</strong></div>`).join("")}
 </div>
 <section class="ax-ledger-now"><div class="ax-ledger-section-title"><h3>지금 검토할 공고</h3><small>자동 수집 건 중 마감일 확인 가능 · 자격 요건은 원문 재확인</small></div>
 <div class="ax-ledger-nowgrid">${now.length?now.map(r=>`<article class="ax-ledger-nowcard"><span>마감 ${escape(r.deadline||"확인")} · ${escape(r.organization)}</span>${aLink(r,escape(r.title))}<small>${escape(r.mode)} · ${r.score}점</small></article>`).join(""):`<p class="ax-ledger-empty">현재 마감일이 확인된 접수 중 공고가 없습니다. 아래 원장에서 예상·참고 공고를 확인하세요.</p>`}</div></section>
 <section class="ax-ledger-controls" aria-label="지원사업 필터">
 ${chipRow("사업연도","year",[...allOption,...years.map(x=>[x,x+"년"])],rows)}
 ${chipRow("지역","region",[...allOption,["전국","전국"],["서울","서울"],["기타","경기·인천·기타"]],rows)}
 ${chipRow("상태","status",[...allOption,["open","기간상 접수 가능"],["scheduled","접수 예정"],["verify","원문 확인 필요"],["forecast","예상 일정"],["closed","마감·지난 사업"]],rows)}
 ${chipRow("참여 방식","mode",[...allOption,...modes.map(x=>[x,x])],rows)}
 <div class="ax-ledger-bottomcontrols">
  ${selectControl("type","사업 유형",[...allOption,...types])}
  ${selectControl("level","기관 구분",[...allOption,...["국가","광역","기초","민간"].map(x=>[x,x])])}
  ${selectControl("sort","정렬",[["STATUS","현재 검토 우선"],["YEAR","사업연도 최신순"],["DEADLINE","마감일 빠른순"],["NEWEST","자동 수집 최신순"],["AMOUNT","개별 지원액 큰순(추출값)"],["FIT","AXOO 적합도순(자동 수집)"]])}
  <label class="ax-ledger-search">검색<input data-ledger-query type="search" autocomplete="off" placeholder="기관·사업·지원규모·대상·참여 방식" value="${escape(FILTERS.query)}"></label>
  <button type="button" data-ledger-reset class="ax-ledger-reset">초기화</button>
 </div>
 </section>
 <div class="ax-ledger-results"><strong>검색 결과 <b>${displayed.length}</b>건</strong><small>자동 수집 ${displayed.filter(x=>x.kind==="live").length}건 · 참고자료 ${displayed.filter(x=>x.kind==="reference").length}건 · 지원금/자격은 공고문 확인</small></div>
 <div class="ax-ledger-tablebox"><table class="ax-ledger-table"><thead><tr><th>사업연도</th><th>상태</th><th>주관 기관</th><th>사업명</th><th>유형</th><th>접수·공고 기간</th><th>지원 규모·내용</th><th>지원 대상</th><th>참여 방식 / 연계 메모</th><th>AXOO 점수</th></tr></thead>
 <tbody>${displayed.length?displayed.map(rowHtml).join(""):`<tr><td colspan="10" class="ax-ledger-empty">검색 조건에 맞는 공고가 없습니다. 필터를 줄여보세요.</td></tr>`}</tbody></table></div>
 <div class="ax-ledger-notes"><p><strong>자료 구분:</strong> 자동 수집은 KAMS·ARKO·KCDF·KOCCA 및 지역 공식 기관 홈페이지에서 수집한 공고이며, 참고자료는 사용자 제공 <em>시각예술 지원사업 2025–2026</em>(2026.10.14 기준)에서 가져온 과거·예상 공고입니다. 참고자료는 원문·현재 일정 재검증 전이며 ‘예상 일정’은 확정 공고가 아닙니다.</p>
 <p><strong>자격·점수:</strong> ‘법인·단체 검토’는 신청 가능 확정이 아닙니다. 참여 방식은 공고 본문·참고 메모 기반의 분류이며 반드시 신청 주체, 업력, 소재지 및 협약 조건을 확인하세요. 적합도 점수는 자동 수집 공고에만 제공됩니다.</p>
 <p>${referenceError?"참고 원장을 불러오지 못했습니다. 새로고침 후 다시 확인하세요.":!reference?"참고 원장을 불러오는 중입니다…":"참고 공고는 실시간 수집과 구분 표시됩니다."}</p></div>
 </section>`;
}
function attach(panel,live){
 if(hooked.has(panel))return;
 hooked.add(panel);
 panel.addEventListener("click",event=>{
 const btn=event.target.closest("[data-ledger-group],[data-ledger-reset]");if(!btn||!panel.contains(btn))return;
 if(btn.hasAttribute("data-ledger-reset"))Object.keys(FILTERS).forEach(k=>FILTERS[k]=k==="sort"?"STATUS":"전체"),FILTERS.query="";
 else FILTERS[btn.dataset.ledgerGroup]=btn.dataset.ledgerValue;
 store();draw(panel,live);
 });
 panel.addEventListener("change",event=>{
 const el=event.target.closest("[data-ledger-select]");if(!el)return;
 FILTERS[el.dataset.ledgerSelect]=el.value;store();draw(panel,live);
 });
 panel.addEventListener("input",event=>{
 const el=event.target.closest("[data-ledger-query]");if(!el)return;
 const cursor=el.selectionStart;FILTERS.query=el.value;store();draw(panel,live);
 const replacement=panel.querySelector("[data-ledger-query]");if(replacement){replacement.focus();if(cursor!==null)replacement.setSelectionRange(cursor,cursor)}
 });
}
window.AXOOSupportLedger={
 render(panel,live){
   attach(panel,live);
   draw(panel,live);
   if(health===null&&!healthPending){
    healthPending=fetch(HEALTH_URL,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Regional health unavailable");return r.json()}).then(x=>{health=x;draw(panel,live)}).catch(e=>{console.warn("[AXOO 04] regional collection health not loaded",e);draw(panel,live)});
   }
   if(reference===null&&!pending){
     pending=fetch(REF_URL,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Reference load "+r.status);return r.json()}).then(x=>{if(!Array.isArray(x.rows))throw Error("Reference invalid");reference=x;draw(panel,live)}).catch(e=>{referenceError=true;console.warn("[AXOO 04] support ledger reference fetch failed",e);draw(panel,live)});
   }
 }
};
})();
