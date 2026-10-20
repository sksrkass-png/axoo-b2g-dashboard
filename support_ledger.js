(function ledger(){
"use strict";
const REF_URL="data/support_ledger_reference.json";
const REF_SCORES_URL="data/support_ledger_reference_scores.json";
const REFERENCE_SCORE_VERSION="AXOO_FIT_V2_2026_10";
let referenceScores=new Map(),referenceScoresError=false;
const HEALTH_URL="data/support_collection_health.json";
const TYPE={create:"창작·발표",curate:"전시기획",space:"공간·레지던시",public:"공공미술·건축미술",media:"미디어아트",fair:"페스티벌·아트페어",market:"유통·미술시장",intl:"해외진출",critic:"비평·매체",welfare:"생활·준비금",tech:"기술융합·AI",biz:"예술기업",bid:"입찰·용역"};
const FILTERS={year:"전체",type:"전체",region:"전체",status:"전체",mode:"전체",level:"전체",source:"전체",sort:"STATUS",query:"",showClosed:false};
const KEY="axoo_support_ledger_preferences_v1";
let reference=null,referenceError=false,pending=null,health=null,healthPending=null;
let lastLive=[];
const hooked=new WeakSet(),liveByPanel=new WeakMap();
try{const saved=JSON.parse(window.localStorage.getItem(KEY)||"{}");Object.keys(FILTERS).forEach(k=>{if(k!=="showClosed"&&typeof saved[k]===typeof FILTERS[k])FILTERS[k]=saved[k]});if(FILTERS.status==="closed")FILTERS.status="전체"}catch(e){}
const escape=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=u=>/^https?:\/\/[^\s"'<>]+$/i.test(String(u||""))?String(u):"";
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function normal(v){return String(v||"").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");}
function dateValue(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||""))?v:"";}
function yearOf(x){const m=String(x.title||"").match(/(?:^|[^\d])(202[5-9])(?:년|[^\d]|$)/);return m?Number(m[1]):(x.sourceCode==="SCAS"?null:(Number((x.deadline||x.publishedDate||"").slice(0,4))||null));}
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
 const row={id:"live-"+x.id,year:y,level:x.sourceLevel||"국가",region:x.region||"전국",organization:x.organization||x.agency||x.source||"발주기관",title:x.title||"",typeCode:typeOf(x),period:[x.startDate,x.deadline].filter(Boolean).join(" ~ ")||"원문 확인",benefit:x.supportDetails||x.detailSummary||"지원 규모는 원문 확인",applicants:x.eligibility||"원문 확인",collaborationNote:x.gradeReason||"",url:x.sourceUrl||x.originalUrl||"",deadline:dateValue(x.deadline||x.endDate),startDate:dateValue(x.startDate),kind:"live",score:Number(x.score)||0,grade:x.grade||"C",scoreBreakdown:Array.isArray(x.scoreBreakdown)?x.scoreBreakdown:[],analysisBasis:x.analysisBasis||"공고 제목",scoreReasons:Array.isArray(x.scoreReasons)?x.scoreReasons:[],sourceCode:x.sourceCode||"",sourceStatus:x.status||"",verificationStatus:x.verificationStatus||"",verifiedAt:x.collectionVerifiedAt||x.collectedAt||"",sourceLastCheckedAt:x.sourceLastCheckedAt||"",review:x.applicationReview||null,documents:x.documentReview||null,companyEligible:x.companyEligible,excluded:x.isExcludedFromPriority===true,confidence:x.analysisConfidence||"low",supportAmount:Number(x.supportAmount)||0,verified:"자동 수집 · 신청자격 원문 재확인"};
 row.mode=(row.review&&row.review.participationLabel)||participation(row.applicants,row.collaborationNote,x);
 row.status=statusOf(row);return row;
}
function fromRef(x){
 const grade=referenceScores.get(x.id);
 const valid=grade&&grade.scoringVersion===REFERENCE_SCORE_VERSION&&grade.evaluationStatus==="provisional_reference_only"&&Number.isFinite(grade.score);
 const row={...x,kind:"reference",score:valid?grade.score:null,grade:valid?grade.grade:"",
  scoreBreakdown:valid&&Array.isArray(grade.scoreBreakdown)?grade.scoreBreakdown:[],
  analysisBasis:valid?grade.analysisBasis:"참고자료 · 원문 미검증",
  scoreReasons:valid?grade.scoreReasons:[],
  startDate:"",excluded:false,confidence:"reference",
  verified:"2026.10.14 참고자료 · 실시간 검증 전"};
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
 return (f.showClosed||r.status.code!=="closed")
 &&(f.source==="전체"||r.sourceCode===f.source)
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
 const note=r.kind==="reference"?(r.score!=null?"참고자료 · 임시 채점":"참고자료 · 원문 미확인"):(r.confidence==="high"?"공식 출처 수집 · 신청자격 재확인":"자동 수집 · 근거 보완 필요");
 const evidence=r.review?.evidence||[];
 const constraints=r.review?.restrictions||[];
 const docFiles=r.documents?.files||[];
 const shortSummary=window.AXOOSupportSummary?.summarize(r)||{scale:"공고문 확인 필요",content:"공고문 확인 필요",eligibility:"공고문 확인 필요"};
 const scoring=Array.isArray(r.scoreBreakdown)?r.scoreBreakdown:[];
 const scoreDetails=scoring.length
   ?`<details class="ax-ledger-score-detail"><summary>배점 보기</summary><ul>${scoring.map(x=>`<li><span>${escape(x.label||"평가항목")}</span><strong>${escape((Number(x.score)||0)>0?"+":"")}${escape(Number(x.score)||0)}점</strong></li>`).join("")}</ul>
     <p>평가 근거: ${escape(r.analysisBasis||"자동 분석")} · 실제 신청 자격·선정 가능성은 별도 검토</p></details>`
   :"";
 const auditState={
   parsed:"파일 텍스트 추출 · 공고 관련성 확인 필요",no_attachment_detected:"첨부파일 없음",
   attachment_not_readable:"첨부 텍스트 미확인",manual_review_required:"수동 확인 필요",
   source_unavailable:"공식 사이트 접근 실패",pending_review:"첨부 분석 대기",
   not_scanned:"첨부 미분석",no_official_url:"링크 미확인"
 }[r.documents?.status]||"첨부 분석 대기";
 const evidenceHtml=r.kind==="live"
  ?`<details class="ax-ledger-evidence"><summary>검증 근거 · ${escape(auditState)}</summary>
      <div><strong>신청 자격 판단</strong> ${escape(r.review?.decisionNote||"자동 판별 미완료. 신청 주체와 조건을 공고에서 확인하세요.")}</div>
      ${evidence.length?evidence.map(x=>`<p><b>${escape(x.field)}</b> ${escape(shorten(x.quote,250))}</p>`).join(""):"<p>신청 대상의 명시적 근거가 부족합니다.</p>"}
      ${constraints.length?`<div><b>제한조건 단서</b> ${constraints.map(x=>escape(x.label+": "+shorten(x.quote,85))).join(" / ")}</div>`:""}
      ${r.review?.submissionDocuments?.length?`<div><b>제출서류 단서</b> ${escape(r.review.submissionDocuments.join(" · "))}</div>`:""}
      ${r.documents?.snippets?.length?`<div><b>첨부파일 문구 (해당 사업과의 관련성 확인 필요)</b>
        ${r.documents.snippets.slice(0,5).map(x=>`<p>${escape(x.label)}: ${escape(shorten(x.quote,185))}</p>`).join("")}
        </div>`:""}
      ${docFiles.map(x=>`<p>· ${safeUrl(x.url)?`<a href="${escape(x.url)}" target="_blank" rel="noopener noreferrer">${escape(shorten(x.label||x.format||"첨부파일",55))}</a>`:escape(shorten(x.label||"첨부파일",55))} — ${escape(x.status)}${x.reason?" ("+escape(shorten(x.reason,70))+")":""}</p>`).join("")}
    </details>`: "";
 return `<tr><td class="ax-year">${escape(r.year||"확인")}</td>
 <td><span class="ax-ledger-status ax-${escape(r.status.code)}">${escape(r.status.label)}</span></td>
 <td class="ax-ledger-agency">${escape(r.organization)}<small>${escape(r.level)} · ${escape(r.region)}</small></td>
 <td class="ax-ledger-name">${aLink(r,escape(r.title))}<small>${escape(note)}${r.excluded?" · 적합도 낮음":""}${r.kind==="live"&&r.verifiedAt?" · 수집 "+escape(r.verifiedAt.slice(0,10)):""}</small></td>
 <td><span class="ax-ledger-tag">${escape(TYPE[r.typeCode]||"기타")}</span></td>
 <td class="ax-ledger-date">${escape(r.period||r.deadline||"확인 필요")}</td>
 <td class="ax-ledger-benefit">
   <div class="ax-ledger-summary-line"><strong>✦ 지원규모</strong><span>${escape(shortSummary.scale)}</span></div>
   <div class="ax-ledger-summary-line"><strong>✦ 지원내용</strong><span>${escape(shortSummary.content)}</span></div>
 </td>
 <td class="ax-ledger-target">
   <div class="ax-ledger-summary-line"><strong>✦ 신청자격</strong><span>${escape(shortSummary.eligibility)}</span></div>
 </td>
 <td class="ax-ledger-mode"><strong>${escape(r.mode)}</strong><small>${escape(r.kind==="live"?"자동 판별 · 자격 확정 아님":shorten(r.collaborationNote,100)||"참고 이력")}</small>${evidenceHtml}</td>
 <td class="ax-ledger-score">${r.score==null?"—":escape(r.score+"점")}<small>${escape(r.kind==="reference"?(r.score==null?"미평가":r.grade+" · 임시 평가"):r.grade)}</small>${scoreDetails}</td>
 <td class="ax-ledger-pipeline-action">${window.AXOOSupportPipeline?.buttonFor(r)||""}</td></tr>`;
}
function store(){try{window.localStorage.setItem(KEY,JSON.stringify(FILTERS))}catch(e){}}
function daysUntil(dateText){
 if(!dateText)return null;
 return Math.round((Date.parse(dateText+"T00:00:00Z")-Date.parse(today()+"T00:00:00Z"))/86400000);
}
function updateSummaryKpis(rows){
 if(typeof document==="undefined")return;
 const list=Array.isArray(rows)?rows:[];
 const metrics=[
  ["totalCount","진행 중","OPEN",list.filter(r=>r.status.code==="open").length],
  ["sCount","7일 내 마감","D-7",list.filter(r=>{const days=daysUntil(r.deadline);return r.status.code==="open"&&days!==null&&days>=0&&days<=7}).length],
  ["aCount","우선 검토","HIGH FIT",list.filter(r=>r.kind==="live"&&r.status.code!=="closed"&&!r.excluded&&(r.grade==="S"||r.grade==="A"||r.score>=70)).length],
  ["bCount","확인 필요","REVIEW",list.filter(r=>r.status.code==="verify").length]
 ];
 metrics.forEach(([id,label,caption,value])=>{
  const valueNode=document.getElementById(id);if(!valueNode)return;
  valueNode.textContent=String(value);
  const card=valueNode.closest?.(".summary-card");
  const labelNode=card?.querySelector("span"),captionNode=card?.querySelector("small");
  if(labelNode)labelNode.textContent=label;
  if(captionNode)captionNode.textContent=caption;
 });
 const caption=document.querySelector?.(".today-panel .section-caption");
 if(caption)caption.textContent=`지원사업 필터 기준 · 마감 공고 ${FILTERS.showClosed?"포함":"제외"}`;
}
function draw(panel,live){
 if(!panel||!panel.isConnected)return;
 lastLive=Array.isArray(live)?live:[];
 const rows=build(live);
 const displayed=rows.filter(matches).sort(comparator);
 const counts=(code)=>rows.filter(r=>r.status.code===code).length;
 const now=displayed.filter(r=>r.kind==="live"&&r.status.code==="open"&&!r.excluded&&r.score>=40&&["corporate_review","artist_collab_review","consortium_review"].includes(r.review?.participationCode)).slice(0,5);
 const years=[...new Set(rows.map(r=>String(r.year)).filter(x=>/^\d{4}$/.test(x)))].sort((a,b)=>Number(b)-Number(a));
 const types=Object.keys(TYPE).filter(x=>x!=="bid").map(x=>[x,TYPE[x]]);
 const modes=[...new Set(rows.map(r=>r.mode))].sort((a,b)=>{
   const priority=["법인 직접 신청 검토","작가·예술단체 협업 검토","컨소시엄 참여 검토","자격 확인 필요","개인 신청 중심","법인 신청 제한 단서","법인·단체 검토","협업·컨소시엄","작가·개인","자격 확인"];
   return priority.indexOf(a)-priority.indexOf(b);
 });
 const sources=[...new Map(rows.filter(r=>r.kind==="live").map(r=>[r.sourceCode,r.organization])).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
 const sourceSummary=Array.isArray(health?.sources)?health.sources:[];
 const allOption=[["전체","전체"]];
 panel.innerHTML=`
 <section class="ax-ledger" aria-label="예술·콘텐츠 지원사업 공고 모아보기">
 <div class="ax-ledger-head">
  <div><span class="ax-ledger-kicker">AXOO / 04 · SUPPORT OPPORTUNITIES</span>
  <h2>예술·콘텐츠 지원사업 공고 모아보기</h2>
  <p>여러 기관의 지원사업 공고를 한곳에서 찾고 비교할 수 있습니다. 현재 접수 가능한 공고를 먼저 보여주며, 신청 자격과 일정은 공식 공고에서 다시 확인하세요.</p></div>
  <div class="ax-ledger-head-meta"><strong>${displayed.length}건</strong><span>현재 조건에 표시</span></div>
 </div>
 <div class="ax-ledger-statrow">
 ${[["전체 공고",rows.length],["기간상 접수 가능",counts("open")],["접수 확인 필요",counts("verify")],["예상 일정",counts("forecast")],["지난 사업·마감",counts("closed")]].map(([k,v])=>`<div class="ax-ledger-stat"><span>${escape(k)}</span><strong>${v}</strong></div>`).join("")}
 </div>
 <section class="ax-ledger-source-status" aria-label="공식 기관 수집 상태">
  <strong>공식 수집원 모니터링 · 2시간 간격</strong>
  <div>${sourceSummary.length?sourceSummary.map(x=>`<span class="ax-ledger-source ${x.state==="failed"?"is-failed":x.state==="partial"?"is-partial":"is-ok"}" title="${escape(x.checkedAt||"")}">${escape(x.name)} · ${x.state==="failed"?"수집 실패":x.state==="partial"?"부분 성공":"수집 정상"} (${Number(x.verified)||0}건)</span>`).join(""):"<span>지역 수집원 확인 결과를 불러오는 중입니다. 기존 4개 국가기관은 별도 자동 수집합니다.</span>"}</div>
  <small>최근 실행: ${escape(health?.updatedAt?new Date(health.updatedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"}):"확인 중")} · 실패한 기관은 오래된 기록을 신규 공고로 간주하지 않습니다.</small>
 </section>
 <section class="ax-ledger-now"><div class="ax-ledger-section-title"><h3>지금 검토할 공고</h3><small>기간상 신청 가능 공고 · 실제 접수 및 신청 자격은 원문 재확인</small></div>
 <div class="ax-ledger-nowgrid">${now.length?now.map(r=>`<article class="ax-ledger-nowcard"><span>마감 ${escape(r.deadline||"확인")} · ${escape(r.organization)}</span>${aLink(r,escape(r.title))}<small>${escape(r.mode)} · ${r.score}점</small>${window.AXOOSupportPipeline?.buttonFor(r)||""}</article>`).join(""):`<p class="ax-ledger-empty">현재 접수 기간이 확인된 공고가 없습니다. 아래 목록에서 예상·참고 공고를 확인하세요.</p>`}</div></section>
 <section class="ax-ledger-controls" aria-label="지원사업 필터">
 ${chipRow("사업연도","year",[...allOption,...years.map(x=>[x,x+"년"])],rows)}
 ${chipRow("지역","region",[...allOption,["전국","전국"],["서울","서울"],["기타","경기·인천·기타"]],rows)}
 ${chipRow("상태","status",[...allOption,["open","기간상 접수 가능"],["scheduled","접수 예정"],["verify","원문 확인 필요"],["forecast","예상 일정"],["closed","마감·지난 사업"]],rows)}
 ${chipRow("참여 방식","mode",[...allOption,...modes.map(x=>[x,x])],rows)}
 <div class="ax-ledger-bottomcontrols">
  ${selectControl("source","수집 기관",[...allOption,...sources])}
  ${selectControl("type","사업 유형",[...allOption,...types])}
  ${selectControl("level","기관 구분",[...allOption,...["국가","광역","기초","민간"].map(x=>[x,x])])}
  ${selectControl("sort","정렬",[["STATUS","현재 검토 우선"],["YEAR","사업연도 최신순"],["DEADLINE","마감일 빠른순"],["NEWEST","자동 수집 최신순"],["AMOUNT","개별 지원액 큰순(추출값)"],["FIT","AXOO 적합도순(임시 점수 포함)"]])}
   <button type="button" class="ax-ledger-closed-toggle ${FILTERS.showClosed?"is-active":""}" data-ledger-closed-toggle aria-pressed="${FILTERS.showClosed}">${FILTERS.showClosed?"마감 공고 숨기기":"마감 공고 보기"} <small>${counts("closed")}</small></button>
  <label class="ax-ledger-search">검색<input data-ledger-query type="search" autocomplete="off" placeholder="기관·사업·지원규모·대상·참여 방식" value="${escape(FILTERS.query)}"></label>
  <button type="button" data-ledger-reset class="ax-ledger-reset">초기화</button>
 </div>
 </section>
 <div class="ax-ledger-results"><strong>검색 결과 <b>${displayed.length}</b>건</strong><small>자동 수집 ${displayed.filter(x=>x.kind==="live").length}건 · 참고자료 ${displayed.filter(x=>x.kind==="reference").length}건 · 자격 자동분류 ${displayed.filter(x=>x.review).length}건 · 첨부 분석 ${displayed.filter(x=>x.documents?.status==="parsed").length}건</small></div>
 <div class="ax-ledger-tablebox"><table class="ax-ledger-table"><thead><tr><th>사업연도</th><th>상태</th><th>주관 기관</th><th>사업명</th><th>유형</th><th>접수·공고 기간</th><th>지원 규모·내용</th><th>지원 대상</th><th>참여 방식 / 연계 메모</th><th>AXOO 점수</th><th>내 관심 공고</th></tr></thead>
 <tbody>${displayed.length?displayed.map(rowHtml).join(""):`<tr><td colspan="11" class="ax-ledger-empty">검색 조건에 맞는 공고가 없습니다. 필터를 줄여보세요.</td></tr>`}</tbody></table></div>
 <div class="ax-ledger-notes"><p><strong>자료 구분:</strong> 자동 수집은 KAMS·ARKO·KCDF·KOCCA 및 지역 공식 기관 홈페이지에서 수집한 공고이며, 참고자료는 사용자 제공 <em>시각예술 지원사업 2025–2026</em>(2026.10.14 기준)에서 가져온 과거·예상 공고입니다. 참고자료는 원문·현재 일정 재검증 전이며 ‘예상 일정’은 확정 공고가 아닙니다.</p>
 <p><strong>자격·점수:</strong> ‘법인·단체 검토’는 신청 가능 확정이 아닙니다. 참여 방식은 공고 본문·참고 메모 기반의 분류이며 반드시 신청 주체, 업력, 소재지 및 협약 조건을 확인하세요. AXOO FIT v2는 자동 수집 공고와 참고자료에 모두 적용합니다. 참고자료의 점수는 제목·짧은 요약만으로 계산한 ‘임시 평가’이며, 공고 원문 검증·법인 신청자격 확인과 무관합니다. 점수 아래 ‘배점 보기’에서 산출 근거를 확인하세요.</p>
  <p>${referenceError?"참고 공고 목록을 불러오지 못했습니다. 새로고침 후 다시 확인하세요.":!reference?"참고 공고 목록을 불러오는 중입니다…":referenceScoresError?"임시 평가 점수 파일을 확인하지 못했습니다. 참고 공고는 원문 확인 전까지 미평가로 표시됩니다.":"참고 공고는 임시 점수와 원문 미검증 상태를 함께 표시합니다."}</p></div>
 </section>`;
 updateSummaryKpis(displayed);
 window.AXOOSupportPipeline?.render(panel,rows,()=>draw(panel,live));
}
function attach(panel,live){
 if(hooked.has(panel))return;
 hooked.add(panel);
 panel.addEventListener("click",event=>{
 const btn=event.target.closest("[data-ledger-group],[data-ledger-reset],[data-ledger-closed-toggle]");if(!btn||!panel.contains(btn))return;
 if(btn.hasAttribute("data-ledger-reset"))Object.assign(FILTERS,{year:"전체",type:"전체",region:"전체",status:"전체",mode:"전체",level:"전체",source:"전체",sort:"STATUS",query:"",showClosed:false});
 else if(btn.hasAttribute("data-ledger-closed-toggle")){FILTERS.showClosed=!FILTERS.showClosed;if(!FILTERS.showClosed&&FILTERS.status==="closed")FILTERS.status="전체";}
 else {FILTERS[btn.dataset.ledgerGroup]=btn.dataset.ledgerValue;if(btn.dataset.ledgerGroup==="status"&&btn.dataset.ledgerValue==="closed")FILTERS.showClosed=true;}
 store();draw(panel,liveByPanel.get(panel)||live);
 });
 panel.addEventListener("change",event=>{
 const el=event.target.closest("[data-ledger-select]");if(!el)return;
 FILTERS[el.dataset.ledgerSelect]=el.value;store();draw(panel,liveByPanel.get(panel)||live);
 });
 panel.addEventListener("input",event=>{
 const el=event.target.closest("[data-ledger-query]");if(!el)return;
 const cursor=el.selectionStart;FILTERS.query=el.value;store();draw(panel,liveByPanel.get(panel)||live);
 const replacement=panel.querySelector("[data-ledger-query]");if(replacement){replacement.focus();if(cursor!==null)replacement.setSelectionRange(cursor,cursor)}
 });
}
window.AXOOSupportLedger={
 render(panel,live){
   liveByPanel.set(panel,Array.isArray(live)?live:[]);
   attach(panel,live);
   draw(panel,live);
   if(health===null&&!healthPending){
    healthPending=fetch(HEALTH_URL,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Regional health unavailable");return r.json()}).then(x=>{health=x;draw(panel,live)}).catch(e=>{console.warn("[AXOO 04] regional collection health not loaded",e);draw(panel,live)});
   }
   if(reference===null&&!pending){
     pending=fetch(REF_URL,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("Reference load "+r.status);return r.json()}).then(async x=>{
       if(!Array.isArray(x.rows))throw Error("Reference invalid");
       reference=x;
       try {
         const result=await fetch(REF_SCORES_URL,{cache:"no-store"});
         if(!result.ok)throw Error("Reference provisional score load "+result.status);
         const rated=await result.json();
         if(rated.scoringVersion!==REFERENCE_SCORE_VERSION||rated.sourceReferenceAsOf!==x.referenceAsOf||!Array.isArray(rated.rows)||rated.rows.length!==x.rows.length)
           throw Error("Reference provisional scores stale or incomplete");
         const byId=new Map(rated.rows.map(z=>[z.id,z]));
         if(byId.size!==x.rows.length||x.rows.some(z=>!byId.has(z.id)))
           throw Error("Reference provisional score ID mismatch");
         if(rated.rows.some(z=>z.evaluationStatus!=="provisional_reference_only"||z.verified!==false||!Number.isFinite(z.score)||z.score>69||z.score<0))
           throw Error("Reference provisional scores have invalid evidence state");
         referenceScores=byId;
         referenceScoresError=false;
       } catch(err) {
         referenceScoresError=true;
         console.warn("[AXOO 04] reference provisional scoring unavailable; preserving original references",err);
       }
       draw(panel,live);
     }).catch(e=>{referenceError=true;console.warn("[AXOO 04] support ledger reference fetch failed",e);draw(panel,live)});
   }
  },
  refreshSummary(){updateSummaryKpis(build(lastLive).filter(matches).sort(comparator));}
};
})();
