(function P2Module(){
"use strict";
const STORAGE="axoo_b2g_support_pipeline_p2_v1", VERSION=1;
const AIRTABLE_BASE="https://airtable.com/applM2n5kScusEfYr";
const AIRTABLE_CANDIDATES="https://airtable.com/applM2n5kScusEfYr/pag9HMvdDhUYq7ORu";
const AIRTABLE_DIRECTOR="https://airtable.com/applM2n5kScusEfYr/pagL4ZaUaOndFiVoS";
const AIRTABLE_ALERTS="https://airtable.com/applM2n5kScusEfYr/paga5K65AZi8SHJIi";
const AIRTABLE_ALERT_SETTINGS="https://airtable.com/applM2n5kScusEfYr/pag6YNkNTdWNaIFrV";
const STATUS=[["INTEREST","관심 등록"],["ELIGIBILITY","적격성 검토"],["DECIDED","지원 결정"],["PREPARING","서류 준비"],["INTERNAL_REVIEW","내부 검토"],["SUBMITTED","제출 완료"],["AWAITING","결과 대기"],["AWARDED","선정"],["DECLINED","미선정"],["ON_HOLD","보류"]];
const TASKS=["원문·신청자격 확인","지원 여부 결정","증빙·제출서류 확보","신청서·예산서 작성","제출·접수증 보관"];
const name=x=>STATUS.find(a=>a[0]===x)?.[1]||"관심 등록";
const clean=(v,max=2500)=>String(v||"").replace(/[\x00-\x1f]/g," ").trim().slice(0,max);
const escape=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||""))?v:"";
const link=v=>/^https:\/\/[^\s"'<>]+$/i.test(String(v||""))?v:"";
const timestamp=()=>new Date().toISOString();
let records={},rows=new Map(),panel=null,callback=null,selected="",notice="",filter="ALL",search="";
const normalize=v=>({
 id:clean(v.id,180),title:clean(v.title,300),organization:clean(v.organization,160),
 sourceUrl:link(v.sourceUrl),sourceKind:v.sourceKind==="reference"?"reference":"live",
 sourceDeadline:date(v.sourceDeadline),deadline:date(v.deadline),deadlineOverride:!!v.deadlineOverride,
 status:STATUS.some(x=>x[0]===v.status)?v.status:"INTEREST",
 priority:["HIGH","MEDIUM","LOW"].includes(v.priority)?v.priority:"MEDIUM",
 owner:clean(v.owner,80),progress:Math.max(0,Math.min(100,Math.round(Number(v.progress)||0))),
 nextAction:clean(v.nextAction,1000),detail:clean(v.detail,3000),result:clean(v.result,700),
 tasks:TASKS.map((label,i)=>({label,done:!!v.tasks?.[i]?.done})),
 createdAt:clean(v.createdAt,36)||timestamp(),updatedAt:clean(v.updatedAt,36)||timestamp(),
 submittedAt:clean(v.submittedAt,36),
 history:Array.isArray(v.history)?v.history.slice(-25).map(x=>({at:clean(x.at,36),note:clean(x.note,200)})):[]
});
function read(){
 try{
  const raw=window.localStorage.getItem(STORAGE),v=JSON.parse(raw||"null");
  if(v?.format!=="AXOO_P2"||v.version!==VERSION||!Array.isArray(v.records))return{};
  return Object.fromEntries(v.records.slice(0,600).filter(x=>x&&typeof x.id==="string"&&/^(live-|reference-)/.test(x.id)).map(x=>[x.id,normalize(x)]));
 }catch(err){console.warn("P2 local data not loaded",err);return{}}
}
function save(){
 try{window.localStorage.setItem(STORAGE,JSON.stringify({format:"AXOO_P2",version:VERSION,exportedAt:timestamp(),records:Object.values(records)}));return true}
 catch(err){notice="브라우저 저장에 실패했습니다. 저장공간·시크릿 모드를 확인하세요.";return false}
}
function snapshot(r){
 return normalize({id:r.id,title:r.title,organization:r.organization,sourceUrl:r.url,sourceKind:r.kind,
 sourceDeadline:r.deadline,deadline:r.deadline,status:"INTEREST",priority:"MEDIUM",progress:0,
 nextAction:"공고 원문과 신청 자격 검토",history:[{at:timestamp(),note:"관심 공고 등록"}]});
}
function syncSource(){
 for(const [id,v] of Object.entries(records)){
  const r=rows.get(id);if(!r)continue;
  v.title=clean(r.title,300)||v.title;v.organization=clean(r.organization,160)||v.organization;
  v.sourceUrl=link(r.url)||v.sourceUrl;
  if(r.deadline&&r.deadline!==v.sourceDeadline){
   v.sourceDeadline=r.deadline;
   if(!v.deadlineOverride)v.deadline=r.deadline;
  }
 }
}
function days(dateText){
 if(!date(dateText))return"미정";
 const current=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const n=Math.round((Date.parse(dateText+"T00:00:00Z")-Date.parse(current+"T00:00:00Z"))/86400000);
 return n===0?"D-DAY":n<0?"D+"+Math.abs(n):"D-"+n;
}
const select=(v,values)=>values.map(x=>`<option value="${escape(x[0])}" ${v===x[0]?"selected":""}>${escape(x[1])}</option>`).join("");
function board(){
 const rank={HIGH:0,MEDIUM:1,LOW:2};
 const list=Object.values(records).sort((a,b)=>(rank[a.priority]??1)-(rank[b.priority]??1)||(a.deadline||"9999").localeCompare(b.deadline||"9999")||b.updatedAt.localeCompare(a.updatedAt));
 const active=list.filter(x=>!["AWARDED","DECLINED","ON_HOLD"].includes(x.status)).length;
 const filtered=list.filter(x=>(filter==="ALL"||x.status===filter)&&(!search||[x.title,x.organization,x.owner,x.nextAction].join(" ").toLowerCase().includes(search.toLowerCase())));
 return `<div class="ax-p2-stats"><span><b>${list.length}</b>등록 공고</span><span><b>${active}</b>진행 중</span><span><b>${list.filter(x=>["SUBMITTED","AWAITING"].includes(x.status)).length}</b>제출·결과 대기</span><span><b>${list.filter(x=>x.status==="AWARDED").length}</b>선정</span></div>
 <div class="ax-p2-tools"><label>단계 <select data-p2-filter>${select(filter,[["ALL","전체"],...STATUS])}</select></label>
 <label>검색 <input type="search" data-p2-query value="${escape(search)}" placeholder="사업명·담당자·기관"></label>
 <button type="button" data-p2-csv>CSV 보고용 내보내기</button>
 <button type="button" data-p2-export>JSON 백업</button>
 <label class="ax-p2-import">JSON 가져오기<input data-p2-import type="file" accept=".json,application/json" hidden></label></div>
 <div class="ax-p2-scroll"><table class="ax-p2-table"><thead><tr><th>관심 사업·기관</th><th>진행 단계</th><th>우선순위</th><th>담당자</th><th>내부 마감</th><th>진행률</th><th>다음 작업</th><th>관리</th></tr></thead>
 <tbody>${filtered.map(v=>`<tr><td><b>${escape(v.title)}</b><small>${escape(v.organization)} · ${v.sourceKind==="reference"?"참고자료":"공식 수집"}</small></td>
 <td>${escape(name(v.status))}</td><td><span class="ax-p2-priority ax-${escape(v.priority.toLowerCase())}">${v.priority==="HIGH"?"높음":v.priority==="LOW"?"낮음":"보통"}</span></td><td>${escape(v.owner||"미배정")}</td>
 <td>${escape(v.deadline||"미정")}<small>${escape(days(v.deadline))}</small></td>
 <td><div class="ax-p2-progress"><i style="width:${v.progress}%"></i></div>${v.progress}%</td>
 <td>${escape(v.nextAction||"미입력")}</td>
 <td><button data-p2-edit="${escape(v.id)}" type="button">관리</button></td></tr>`).join("")||`<tr><td colspan="8" class="ax-p2-empty">등록된 공고가 없습니다. 하단 공고의 ‘검토 등록’을 눌러 추가하세요.</td></tr>`}</tbody></table></div>`;
}
function form(){
 const v=records[selected];if(!v)return"";
 const recent=v.history.slice(-4).reverse();
 return `<form data-p2-form class="ax-p2-edit"><div class="ax-p2-edit-head"><div><b>${escape(v.title)}</b>
 <small>${escape(v.organization)} · ${v.sourceKind==="reference"?"참고 이력 (재확인 필수)":"자동 수집 (신청자격 확인 필수)"}</small></div><button type="button" data-p2-close>닫기 ✕</button></div>
 <div class="ax-p2-fields">
 <label>진행 단계<select name="status">${select(v.status,STATUS)}</select></label>
 <label>담당자<input name="owner" maxlength="80" value="${escape(v.owner)}" placeholder="담당자 입력"></label>
 <label>우선순위<select name="priority">${select(v.priority,[["HIGH","높음"],["MEDIUM","보통"],["LOW","낮음"]])}</select></label>
 <label>진행률 (%)<input name="progress" type="number" min="0" max="100" step="5" value="${v.progress}"></label>
 <label>내부 마감일<input name="deadline" type="date" value="${escape(v.deadline)}"></label>
 <div class="ax-p2-official-deadline">공고 원문 마감일: <b>${escape(v.sourceDeadline||"미확인")}</b></div>
 <label class="ax-p2-wide">다음 실행 업무<input name="nextAction" maxlength="1000" value="${escape(v.nextAction)}"></label>
 <label class="ax-p2-wide">세부 검토·진척 사항<textarea name="detail" maxlength="3000" rows="3">${escape(v.detail)}</textarea></label>
 <label class="ax-p2-wide">최종 결과·피드백<textarea name="result" maxlength="700" rows="2">${escape(v.result)}</textarea></label></div>
 <fieldset><legend>지원 준비 체크리스트</legend><div class="ax-p2-tasks">${TASKS.map((t,i)=>`<label><input type="checkbox" name="task${i}" ${v.tasks[i].done?"checked":""}>${escape(t)}</label>`).join("")}</div></fieldset>
 <div class="ax-p2-actions"><button type="submit" class="ax-p2-save">변경사항 저장</button>
 ${link(v.sourceUrl)?`<a target="_blank" rel="noopener noreferrer" href="${escape(v.sourceUrl)}">공식 공고 열기 ↗</a>`:""}
 <button type="button" data-p2-remove="${escape(v.id)}">관리 목록에서 제외</button></div>
 ${recent.length?`<div class="ax-p2-history"><b>최근 변경 이력</b>${recent.map(h=>`<p>${escape(h.at.slice(0,10))} · ${escape(h.note)}</p>`).join("")}</div>`:""}
 </form>`;
}
function draw(){
 if(!panel?.isConnected)return;
 const anchor=panel.querySelector(".ax-ledger-now");if(!anchor)return;
 panel.querySelector(".ax-p2")?.remove();
 const section=document.createElement("section");section.className="ax-p2";section.id="axooSupportPipeline";
 section.innerHTML=`<div class="ax-p21-shared"><div><strong>👥 P2.1 · Airtable 공동 지원관리</strong><p>회사 팀원이 함께 관리하는 DB입니다. ‘05 자동수집 공고 후보’에서 검토 대상으로 선택하면, Airtable 자동화 활성화 후 공동 지원관리로 전환됩니다.</p></div><div class="ax-p21-links"><a href="${AIRTABLE_CANDIDATES}" target="_blank" rel="noopener noreferrer">공고 후보에서 선택 ↗</a><a href="${AIRTABLE_DIRECTOR}" target="_blank" rel="noopener noreferrer">디렉터 검토 원장 ↗</a><a href="${AIRTABLE_ALERTS}" target="_blank" rel="noopener noreferrer">🔔 신규·마감 알림함 ↗</a><a href="${AIRTABLE_ALERT_SETTINGS}" target="_blank" rel="noopener noreferrer">알림 설정 ↗</a></div></div><div class="ax-p2-heading"><span>AXOO / P2 · BROWSER-LOCAL BACKUP</span><h3>⭐ 브라우저 임시 지원관리</h3>
 <p>관심 → 적격성 검토 → 지원 결정 → 서류 준비 → 제출 → 결과 관리. <b>현재 브라우저에만 저장됩니다.</b> 팀원·다른 기기에 자동 동기화되지 않으므로 JSON 내보내기/가져오기로 백업·전달해 주세요.</p></div>
 ${notice?`<p class="ax-p2-notice" role="status">${escape(notice)}</p>`:""}
 ${board()}${form()}`;
 anchor.insertAdjacentElement("beforebegin",section);
}
function edit(id){
 const r=rows.get(id);if(!records[id]&&r){records[id]=snapshot(r);notice="검토 목록에 등록했습니다. 현재 브라우저에만 저장됩니다.";save()}
 if(!records[id]){notice="해당 공고의 저장기록이 없습니다.";draw();return}
 selected=id;draw();
 panel.querySelector(".ax-p2-edit")?.scrollIntoView({behavior:"smooth",block:"nearest"});
}
function download(text,type,filename){
 const url=URL.createObjectURL(new Blob([text],{type}));
 const a=document.createElement("a");a.href=url;a.download=filename;
 document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function exportCsv(){
 const columns=["공고 ID","사업명","기관","구분","공식 원문","진행 단계","우선순위","담당자","공고 마감","내부 마감","진행률(%)","다음 실행 업무","세부 검토 내용","최종 결과","체크리스트 완료(개)","최종 수정일"];
 const field=v=>{const raw=String(v??"");const safe=/^[=+@\-\t\r]/.test(raw)?"\u0027"+raw:raw;return "\u0022"+safe.replace(/\u0022/g,"\u0022\u0022")+"\u0022"};
 const lines=[columns.map(field).join(",")];
 Object.values(records).forEach(v=>lines.push([v.id,v.title,v.organization,v.sourceKind,v.sourceUrl,name(v.status),v.priority,v.owner,v.sourceDeadline,v.deadline,v.progress,v.nextAction,v.detail,v.result,v.tasks.filter(x=>x.done).length,v.updatedAt].map(field).join(",")));
 download("\uFEFF"+lines.join("\r\n"),"text/csv;charset=utf-8","AXOO_support_pipeline_"+timestamp().slice(0,10)+".csv");
 notice="CSV 보고용 파일을 내보냈습니다. 내부 업무 정보가 포함될 수 있으므로 공유 대상에 주의하세요.";draw();
}
function exportJson(){
 const data=JSON.stringify({format:"AXOO_P2",version:VERSION,exportedAt:timestamp(),records:Object.values(records)},null,2);
 download(data,"application/json;charset=utf-8","AXOO_support_pipeline_"+timestamp().slice(0,10)+".json");
 notice="이 브라우저의 지원관리 기록을 JSON 파일로 내보냈습니다.";draw();
}
async function importJson(file){
 if(!file)return;
 if(file.size>1500000){notice="파일 용량은 1.5MB 이하여야 합니다.";draw();return}
 try{
  const data=JSON.parse(await file.text());
  if(data.format!=="AXOO_P2"||data.version!==VERSION||!Array.isArray(data.records)||data.records.length>600)throw Error("지원관리 파일 형식이 맞지 않습니다.");
  let accepted=0;
  for(const x of data.records){
   if(typeof x?.id!=="string"||!/^(live-|reference-)/.test(x.id))continue;
   const r=normalize(x),old=records[r.id];
   if(!old||r.updatedAt>old.updatedAt){records[r.id]=r;accepted++}
  }
  save();notice=`${accepted}건을 가져왔습니다. 기존 기록보다 수정일이 최신인 항목만 반영했습니다.`;
 }catch(err){notice="파일 가져오기 실패: "+clean(err.message,130)}
 draw();
}
function listen(host){
 if(host._axP2Bound)return;host._axP2Bound=true;
 host.addEventListener("click",e=>{
  const b=e.target.closest("[data-p2-add],[data-p2-edit],[data-p2-close],[data-p2-remove],[data-p2-export],[data-p2-csv]");
  if(!b||!host.contains(b))return;
  if(b.hasAttribute("data-p2-add")){edit(b.dataset.p2Add);return}
  if(b.hasAttribute("data-p2-edit")){edit(b.dataset.p2Edit);return}
  if(b.hasAttribute("data-p2-close")){selected="";notice="";draw();return}
  if(b.hasAttribute("data-p2-export")){exportJson();return}
  if(b.hasAttribute("data-p2-csv")){exportCsv();return}
  if(b.hasAttribute("data-p2-remove")){
   if(!window.confirm("이 브라우저에 저장된 지원관리 기록을 삭제할까요?"))return;
   delete records[b.dataset.p2Remove];selected="";save();notice="관리 목록에서 제외했습니다.";callback?.();return;
  }
 });
 host.addEventListener("change",async e=>{
  if(e.target.matches("[data-p2-filter]")){filter=e.target.value;draw()}
  if(e.target.matches("[data-p2-import]")){await importJson(e.target.files?.[0])}
 });
 host.addEventListener("input",e=>{
  if(!e.target.matches("[data-p2-query]"))return;
  const cursor=e.target.selectionStart;search=e.target.value;draw();
  const input=panel.querySelector("[data-p2-query]");
  input?.focus();if(input&&cursor!==null)input.setSelectionRange(cursor,cursor);
 });
 host.addEventListener("submit",e=>{
  if(!e.target.matches("[data-p2-form]"))return;
  e.preventDefault();
  const v=records[selected];if(!v)return;
  const f=new FormData(e.target),prev=v.status;
  v.status=STATUS.some(x=>x[0]===f.get("status"))?f.get("status"):"INTEREST";
  v.owner=clean(f.get("owner"),80);
  v.priority=["HIGH","MEDIUM","LOW"].includes(f.get("priority"))?f.get("priority"):"MEDIUM";
  v.progress=Math.max(0,Math.min(100,Math.round(Number(f.get("progress"))||0)));
  v.deadline=date(f.get("deadline"));v.deadlineOverride=v.deadline!==v.sourceDeadline;
  v.nextAction=clean(f.get("nextAction"),1000);v.detail=clean(f.get("detail"),3000);
  v.result=clean(f.get("result"),700);
  v.tasks=TASKS.map((label,i)=>({label,done:f.has("task"+i)}));
  if(v.status==="SUBMITTED"&&!v.submittedAt)v.submittedAt=timestamp();
  v.updatedAt=timestamp();
  v.history.push({at:v.updatedAt,note:prev===v.status?"진척 사항 수정":`${name(prev)} → ${name(v.status)}`});
  v.history=v.history.slice(-25);
  save();notice="지원관리 내용을 저장했습니다.";callback?.();
 });
}
records=read();
window.AXOOSupportPipeline={
 buttonFor(r){return `<button type="button" class="ax-p2-row-add" data-p2-add="${escape(r.id)}">${records[r.id]?"✎ 로컬 "+escape(name(records[r.id].status)):"+ 로컬 검토 등록"}</button>`},
 render(host,list,redraw){panel=host;callback=redraw;rows=new Map((list||[]).map(x=>[x.id,x]));listen(host);syncSource();draw()},
 getSnapshot(){return Object.values(records).map(x=>({id:x.id,status:x.status,owner:x.owner,deadline:x.deadline,progress:x.progress}))},
 getStorageInfo(){return {storage:"browser-local",key:STORAGE,count:Object.keys(records).length}}
};
})();
