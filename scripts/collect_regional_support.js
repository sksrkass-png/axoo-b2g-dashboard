"use strict";
// Regional grant collector v1 — fetches public institution pages. No API key required.
// Failure is per source; an unavailable site never erases existing evidence.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { analyzeSupportProgram, extractSupportDetail, htmlToText } = require("./support_program_intelligence");
const ROOT = process.cwd();
const OUT = path.join(ROOT, "data/support_regional_programs.json");
const HEALTH = path.join(ROOT, "data/support_collection_health.json");
const SOURCES = [
  { code:"SCAS", name:"서울문화재단", level:"광역", region:"서울", url:"https://www.scas.kr/biz/list", detail:/\/biz\/detail\/\d+/i },
  { code:"GGCF", name:"경기문화재단", level:"광역", region:"기타", url:"https://www.ggcf.kr/boards/businessNotices/articles?category=03", detail:/\/boards\/businessNotices\/articles\/\d+/i },
  { code:"IFAC", name:"인천문화재단", level:"광역", region:"기타", url:"https://ifac.or.kr/artsSupProjects/supProjects/list.do?key=m2501143953255", detail:/\/artsSupProjects\/supProjects\/(?:view|detail)\.do/i },
  { code:"BSCF", name:"부산문화재단", level:"광역", region:"기타", url:"https://www.bscf.or.kr/view.do?no=1010", detail:/pbancSn=\d+/i },
  { code:"SEOUL", name:"서울특별시", level:"광역", region:"서울", url:"https://mediahub.seoul.go.kr/competition/competitionList.do", detail:/\/(?:gongmo\/\d+|competition\/(?:competitionView|competitionDetail)\.do)/i }
];
const REJECT=/(선정\s*결과|최종\s*선정|선정\s*안내|선정자\s*발표|결과\s*발표|최종\s*결과|합격자|입찰|용역|채용|인턴십|수강생|교육생|조사\s*설문|만족도\s*조사|당첨자)/;
const GRANT=/(지원|공모|모집|전시|기획|시각|미술|예술|콘텐츠|크리에이티브|디자인|미디어|창업|프로젝트|문화)/;
const LIMIT=20; // Max detail pages per source and run.
const JST=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const nowIso=()=>new Date().toISOString();
const clean=s=>String(s??"").replace(/\s+/g," ").trim();
const sha=s=>crypto.createHash("sha1").update(s).digest("hex").slice(0,14);
const read=(p,fallback)=>{try{return JSON.parse(fs.readFileSync(p,"utf8"))}catch{return fallback}};
const save=(p,value)=>fs.writeFileSync(p,JSON.stringify(value,null,2)+"\n");
function urlOf(href,base) {
  try {const url=new URL(href.replace(/&amp;/g,"&"),base);return /^https?:$/.test(url.protocol)?url.toString():""} catch{return""}
}
function textFromHtml(s) {return htmlToText(s).replace(/\s+/g," ").trim();}
function anchors(html,base) {
  const result=[],pattern=/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi;let m;
  while((m=pattern.exec(html))){
    const attr=m[1],inner=m[2];
    let h=attr.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]||"";
    if(!h||/^javascript:/i.test(h)){
      const js=attr.match(/(?:\/biz\/detail\/\d+|\/boards\/businessNotices\/articles\/\d+|\/artsSupProjects\/supProjects\/view\.do\?[^"' ]+|\/gongmo\/\d+)/i);
      if(js)h=js[0];
    }
    const u=urlOf(h,base);
    if(!u)continue;
    let title=clean(textFromHtml(inner.replace(/<!--[\s\S]*?-->/g," ")));
    // List links often wrap visible title and badges in the same anchor.
    title=title.replace(/^(?:공모|지원사업|모집|공고|진행중|마감|접수중)\s+/,"");
    if(title.length<7||title.length>230)continue;
    result.push({url:u,title});
  }
  return result;
}
function parseDate(d) {
  const m=String(d).match(/(20\d{2})\s*(?:년|[.\-/])\s*(\d{1,2})\s*(?:월|[.\-/])\s*(\d{1,2})/);
  if(!m)return"";
  const [y,mo,day]=m.slice(1).map(Number);
  const result=[String(y),String(mo).padStart(2,"0"),String(day).padStart(2,"0")].join("-");
  const dt=new Date(result+"T00:00:00Z");
  return Number.isNaN(dt.getTime())||dt.toISOString().slice(0,10)!==result?"":result;
}
function dateRange(text) {
  // Prefer explicitly labelled application/registration dates, not project execution periods.
  const normalized=clean(text).slice(0,15000);
  const labels=/(접수기간|신청기간|모집기간|신청\s*접수|접수\s*일정|공모기간)/g;
  let m;
  while((m=labels.exec(normalized))){
    const window=normalized.slice(m.index,m.index+245);
    const dates=[...window.matchAll(/20\d{2}\s*(?:년|[.\-/])\s*\d{1,2}\s*(?:월|[.\-/])\s*\d{1,2}/g)].map(x=>parseDate(x[0])).filter(Boolean);
    if(dates.length>=2)return {startDate:dates[0],deadline:dates[1],basis:m[1]};
    if(dates.length===1)return {startDate:"",deadline:dates[0],basis:m[1]+" 1일자"};
  }
  return {startDate:"",deadline:"",basis:"원문에서 접수 일정 추출 실패"};
}
function status(start,deadline) {
  const t=JST();
  if(!deadline)return"확인 필요";
  if(deadline<t)return"마감";
  if(start&&start>t)return"접수 예정";
  // Dates alone are not an official confirmation that application is currently available.
  return"기간상 접수 가능";
}
function isCandidate(title,source) {
  return GRANT.test(title)&&!REJECT.test(title)&&title.length>=8;
}
function getTitle(html,fallback){
  // Do not overwrite descriptive list title with a generic page title.
  const title=html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
  const parsed=title?clean(textFromHtml(title[1])):"";
  return parsed.length>=10&&parsed.length<=145&&!/^(?:지원사업|공고|게시판|상세보기|재단소개)/.test(parsed)?parsed:fallback;
}
async function getHtml(url){
  const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),12500);
  try {
    const response=await fetch(url,{signal:ctl.signal,redirect:"follow",headers:{"User-Agent":"Mozilla/5.0 (compatible; AXOOGrantsResearch/1.0)","Accept-Language":"ko-KR,ko;q=0.9","Accept":"text/html,application/xhtml+xml"}});
    if(!response.ok)throw Error("HTTP "+response.status);
    const type=response.headers.get("content-type")||"";
    if(!type.includes("html")&&!type.includes("text"))throw Error("Unexpected content-type "+type);
    const body=await response.text();
    if(body.length<500)throw Error("HTML too short");
    return body;
  } finally {clearTimeout(timer)}
}
function mapCandidate({source,detailUrl,title,html,verifiedAt}){
  const detail=extractSupportDetail(html);
  const full=textFromHtml(html);
  // Some sites wrap the notice in a non-heading template: preserve list title.
  const canonicalTitle=title
    .replace(/\s+대상\s+.*$/,"")
    .replace(/\s+20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}[.\s\S]*$/,"")
    .trim(); // Remove list-only applicant and date badges, preserve announcement identity.
  if(!isCandidate(title,source)||!isCandidate(canonicalTitle,source))return null;
  const dates=dateRange(full);
  // SCAS displays applicant eligibility in the listing card when the notice body has none.
  const listingApplicant=title.match(/\s대상\s(.+?)\s(?:진행중|진행예정|마감|~20\d{2})/)?.[1]||"";
  if(!detail.eligibility&&listingApplicant)detail.eligibility="지원대상: "+listingApplicant;
  const fit=analyzeSupportProgram({title:canonicalTitle,...detail,sourceCode:source.code});
  const flagged=fit.isExcluded===true;
  const description=detail.supportDetails||detail.detailSummary||"";
  const id=source.code.toLowerCase()+"-"+sha(detailUrl);
  return {
    id,category:"arts_content_support",categoryLabel:"예술·콘텐츠 지원사업",
    priorityCategory:"arts_content_support",priorityCategoryLabel:"예술·콘텐츠 지원사업",
    source:source.name,sourceCode:source.code,sourceType:"지원사업",
    title:canonicalTitle,organization:source.name,agency:source.name,
    sourceLevel:source.level,region:source.region,
    sourceUrl:detailUrl,originalUrl:detailUrl,documentUrl:"",
    startDate:dates.startDate,deadline:dates.deadline,endDate:dates.deadline,
    postedDate:"",publishedDate:"",status:status(dates.startDate,dates.deadline),
    statusBasis:dates.basis,collectionVerifiedAt:verifiedAt,sourceLastCheckedAt:verifiedAt,
    verificationStatus:dates.deadline?"date_extracted":"date_unconfirmed",
    sourceDetailVerified:true,
    supportAmount:detail.supportAmount||null,budget:detail.supportAmount||null,
    eligibility:detail.eligibility||"",supportDetails:description,
    detailSummary:detail.detailSummary||"",application:detail.application||"",
    field:fit.businessAreaLabel,businessArea:fit.businessArea,businessAreaLabel:fit.businessAreaLabel,
    businessAreas:fit.businessAreas,matchedKeywords:fit.matchedKeywords,
    matchedPriorityKeywords:fit.matchedKeywords,
    score:fit.score,axooFitScore:fit.score,grade:fit.grade,fitVerdict:fit.fitVerdict,
    scoreBreakdown:fit.scoreBreakdown,scoreReasons:fit.scoreReasons,
    analysisBasis:fit.analysisBasis,analysisConfidence:fit.analysisConfidence,
    companyEligible:fit.companyEligible===true,
    gradeReason:fit.reason,axooFitReason:fit.reason,
    nextAction:"공식 원문에서 신청 주체·업력·소재지·접수시간 확인",
    recommendedAction:"공식 원문에서 신청 주체·업력·소재지·접수시간 확인",
    isPriority:!flagged,isExcludedFromPriority:flagged,
    exclusionReason:flagged?"공고 유형 확인 필요":"",
    collectedAt:JST(),updatedAt:JST(),collectionVersion:"regional_official_html_v1"
  };
}
function distinct(items){
  const seen=new Set();return items.filter(x=>{const key=x.url.split("#")[0];if(seen.has(key))return false;seen.add(key);return true});
}
async function processSource(source,oldRows) {
  const checkedAt=nowIso();
  try {
    const html=await getHtml(source.url);
    const candidates=distinct(anchors(html,source.url).filter(a=>source.detail.test(a.url)&&isCandidate(a.title,source))).slice(0,LIMIT);
    if(!candidates.length) {
      const samples=anchors(html,source.url).filter(x=>GRANT.test(x.title)).slice(0,8).map(x=>x.url+" "+x.title.slice(0,50));
      const marker=source.code==="IFAC"?"2027 인천문화재단":source.code==="BSCF"?"2026년":"미디어아트";
      const at=html.indexOf(marker);
      const snippet=at>=0?html.slice(Math.max(0,at-850),at+1100).replace(/\s+/g," "):"not found";
      throw Error("No recognized official grant links; selector may have changed. HTML length="+html.length+" candidate anchors="+anchors(html,source.url).length+" samples="+samples.join(" | ")+" nearMarker="+snippet);
    }
    const rows=[];const errors=[];
    for(const item of candidates){
      try{
        const detailHtml=await getHtml(item.url);
        const row=mapCandidate({source,detailUrl:item.url,title:item.title,html:detailHtml,verifiedAt:checkedAt});
        if(row)rows.push(row);
        else errors.push("Rejected candidate "+item.title.slice(0,90));
      } catch(err){errors.push(item.url+" "+err.message)}
    }
    if(!rows.length)throw Error("Detail verification failed for all "+candidates.length+" links: "+errors.slice(0,3).join("; ")+" titles="+candidates.slice(0,3).map(x=>x.title).join(" | "));
    // Preserve items from previous successful visits for archiving, but don't label stale items current.
    const byId=new Map(oldRows.filter(x=>x.sourceCode===source.code&&isCandidate(x.title,source)).map(x=>[x.id,x]));
    for(const x of rows)byId.set(x.id,x);
    const merged=[...byId.values()].map(x=>{
      if(rows.some(r=>r.id===x.id))return x;
      return {...x,verificationStatus:"stale_previous_run",status:"확인 필요"};
    }).slice(0,120);
    return {rows:merged,health:{code:source.code,name:source.name,url:source.url,region:source.region,state:errors.length?"partial":"ok",checkedAt,lastSuccessAt:checkedAt,found:candidates.length,verified:rows.length,errors:errors.slice(0,4)}};
  }catch(err){
    const held=oldRows.filter(x=>x.sourceCode===source.code&&isCandidate(x.title,source)).map(x=>({...x,verificationStatus:"source_unavailable",status:"확인 필요"}));
    return {rows:held,health:{code:source.code,name:source.name,url:source.url,region:source.region,state:"failed",checkedAt,found:0,verified:0,errors:[err.message]}};
  }
}
async function main(){
  const existing=read(OUT,[]);const previous=read(HEALTH,{sources:[]});
  const health={version:1,updatedAt:nowIso(),interval:"every 2 hours (GitHub Actions cron; not live push)",sources:[]};
  const out=[];
  for(const src of SOURCES){
    const result=await processSource(src,existing);
    const prev=previous.sources?.find(x=>x.code===src.code);
    if(!result.health.lastSuccessAt&&prev?.lastSuccessAt)result.health.lastSuccessAt=prev.lastSuccessAt;
    out.push(...result.rows);health.sources.push(result.health);
    console.log(src.code,result.health.state,"verified:",result.health.verified,"retained:",result.rows.length,"errors:",result.health.errors.join(" | ").slice(0,1150));
  }
  const unique=new Map();out.forEach(x=>unique.set(x.id,x));
  save(OUT,[...unique.values()]);
  save(HEALTH,health);
  console.log("Regional official grants:",unique.size,"working sources:",health.sources.filter(x=>x.state!=="failed").length+"/"+SOURCES.length);
  // At least one source must work on first run; reject a full outage only if no usable records exist.
  if(!unique.size&&health.sources.every(x=>x.state==="failed"))console.warn("All new regional adapters failed. Baseline collector remains active; health states are FAILED, not fresh.");
}
if(require.main===module)main().catch(err=>{console.error(err);process.exitCode=1});
module.exports={SOURCES,anchors,dateRange,parseDate,status,isCandidate,mapCandidate,processSource};
