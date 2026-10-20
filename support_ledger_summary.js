(function initAXOOSupportSummary(root){
"use strict";
/**
 * Evidence-grounded field summaries. Operates only on extracted data already
 * attached to the matching notice. Unknown fields stay unknown; NEVER infer
 * amounts or applicant eligibility from a title.
 */
const UNKNOWN={
 scale:"지원금액 미확인",
 content:"상세내용 확인 필요",
 eligibility:"신청자격 미확인"
};
const TYPE_LABELS={
 scale:["지원규모","지원금액","사업규모","지원금","지원총액"],
 content:["지원내용","지원혜택","사업내용","공모내용"],
 eligibility:["지원대상","신청자격","지원자격","모집대상","공모대상","신청대상"]
};
const STOP_LABELS=["공고기간","접수기간","신청기간","신청방법","전형절차","제출서류","선정방법","지원요건","지원제외","참여제한","신청제외","지원신청","지원기간","지원절차","문의처","문의사항"];
const LABELS=[...new Set([...Object.values(TYPE_LABELS).flat(),...STOP_LABELS])].sort((a,b)=>b.length-a.length);
const LABEL_RE=new RegExp("(?:^|\\s|[·;])(?:\\d+\\s*[.)]\\s*)?("+LABELS.join("|")+")\\s*(?=[:：\\s]|$)","gi");
const MONEY=/(?:\d[\d,]*(?:\.\d+)?\s*(?:조|억|천만|백만|만)\s*원?|\d[\d,]*(?:\.\d+)?\s*원)/;
const COUNT=/\d[\d,]*(?:\.\d+)?\s*(?:개사|개\s*단체|팀|개팀|명|건|개소|곳)\s*(?:이내|내외|선정|지원|모집|규모)?/;
const CONNECTORS=/^(?:및|또는|혹은|등|그리고|and|or|와|과|,|·|[-–])$/i;
const GENERIC=/^(?:(?:공고문|원문|첨부파일|별첨|붙임)\s*(?:참고|참조|확인(?:\s*필요)?)|(?:확인\s*필요|미정|없음|미확인|해당없음|참조|참고|전체|전국|모두|지원대상\s*전체|지원\s*규모는\s*원문\s*확인))$/i;
function plain(value){
 return String(value==null?"":value).replace(/<[^>]*>/g," ")
 .replace(/&(?:nbsp|#160);/gi," ")
 .replace(/&(?:middot|bull|#183|#8226);/gi," · ")
 .replace(/&(?:rarr|#8594);/gi," → ")
 .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
 .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
 .replace(/[\u200b-\u200d\ufeff]/g,"").replace(/\s+/g," ").trim();
}
function sections(value){
 const text=plain(value),found=[];
 for(const m of text.matchAll(new RegExp(LABEL_RE.source,"gi"))){
  if(m[1]==="지원금"&&/^(?:액|융자)/.test(text.slice(m.index+m[0].length)))continue;
  found.push({label:m[1],from:m.index,begin:m.index+m[0].length});
 }
 return found.map((m,i)=>({
  label:m.label,
  text:text.slice(m.begin,i+1<found.length?found[i+1].from:text.length)
     .replace(/^\s*[:：]\s*/,"").replace(/^\s*(?:ㅇ|○|●|■|·|[-–]|\d+[.)])\s*/,"").trim()
 }));
}
function meaningful(value,type){
 const t=plain(value).replace(/^[:：•\-–,·\s]+|[:：•\-–,·\s]+$/g,"").trim();
 if(!t||GENERIC.test(t)||CONNECTORS.test(t))return false;
 if(/^(?:지원(?:규모|내용|대상|금액|자격)|신청자격|모집대상|공고내용)\s*(?:원문\s*확인|확인(?:\s*필요)?|미확인|참조|미정)$/.test(t))return false;
 if(/^(?:및|또는|혹은|그리고)\s|(?:\s|^)(?:및|또는|혹은|그리고)$/.test(t))return false;
 if(/^(?:공고문|붙임|별첨|첨부파일)\s*(?:참조|확인)/.test(t))return false;
 if(/^(?:접수기간|신청방법|전형절차|서류제출|문의처|문의사항|제출서류|심사방법|선정결과)\b/.test(t))return false;
 if(type==="scale")return MONEY.test(t)||COUNT.test(t);
 if(type==="content"){
  if(t.length<5||/^(?:참여|신청|지원|사업|대상|지원사업|모집내용|공고내용)$/.test(t))return false;
  if(/^(?:지원\s*금액|전체?\s*예산|지원\s*규모|사업\s*예산|건당|최대|최소)\b/.test(t)&&!/(?:활동|전시|제작|운영|기획|지원|창작|공간|교육|서비스|홍보|연계|제공|프로그램)/.test(t))return false;
  if(/^(?:(?:총|예산|규모|건당|최소|최대|최종|연간|1인)\s*){0,3}[\d,.]+\s*(?:조|억|천만|백만|만)?\s*원?(?:\s|$)/.test(t))return false;
  if(/^(?:\d+[\d,.]*\s*(?:건|명|개소|개사)\s*(?:접수|선정)|접수\s*\d+[\d,.]*\s*건)/.test(t))return false;
  return true;
 }
 if(type==="eligibility"){
  if(t.length<3||/^(?:지원대상|신청자격|모집대상|대상자?)\s*(?:전체|미정|없음)$/.test(t))return false;
  if(/^(?:증빙\s*서류|서류\s*제출|사업자등록증\s*제출|제출방법|심사|전형)\b/.test(t))return false;
  return true;
 }
 return false;
}
function concise(value,type,limit){
 let t=plain(value).replace(/^\s*(?:ㅇ|○|●|■|·|[-–]|\d+[.)])\s*/,"").replace(/^\s*[:：]\s*/,"").trim();
 if(!meaningful(t,type))return"";
 // A second bullet usually describes a separate benefit; avoid splicing clauses.
 const bits=t.split(/\s+(?:ㅇ|○|●|■|※)\s+|\s+※\s+/);
 if(bits[0]&&bits[0].length>=11&&meaningful(bits[0],type))t=bits[0];
 if(t.length>limit){
  const head=t.slice(0,limit);
  const end=Math.max(head.lastIndexOf(" "),head.lastIndexOf(","),head.lastIndexOf(";"));
  t=(end>limit*.62?head.slice(0,end):head).trim()+"…";
 }
 return meaningful(t.replace(/…$/,""),type)?t:"";
}
function sectionValue(source,type,limit){
 const allowed=TYPE_LABELS[type];
 for(const field of sections(source)){
  if(allowed.includes(field.label)){
   const c=concise(field.text,type,limit);
   if(c)return c;
  }
 }
 return"";
}
function fieldSource(row,type){
 if(type==="eligibility")return plain(row.applicants||row.eligibility||"");
 return plain(row.benefit||row.supportDetails||row.detailSummary||"");
}
function parsedSnippets(row,type){
 const docs=row.documents||row.documentReview;
 if(docs?.status!=="parsed"||!Array.isArray(docs.snippets)||!Array.isArray(docs.files))return[];
 const files=new Set(docs.files.filter(f=>f.status==="parsed").map(f=>f.url).filter(Boolean));
 const terms=type==="scale"?/지원\s*(?:규모|금액|총액)|사업\s*규모|지원금|예산/i:
             type==="content"?/지원\s*내용|지원\s*혜택|사업\s*내용|공모\s*내용/i:
             /지원\s*(?:대상|자격)|신청\s*자격|모집\s*대상/i;
 return docs.snippets.filter(s=>files.has(s.sourceUrl)&&terms.test(s.label||"")&&plain(s.quote));
}
function monetaryScale(source){
 const text=plain(source);
 if(!text||/^(?:공고문|원문|참고)\s*(?:확인|참조)/.test(text))return"";
 const match=MONEY.exec(text);
 if(match){
  const left=text.slice(Math.max(0,match.index-36),match.index);
  if(/(?:보증금|자부담|납부|수수료|참가비|등록비|과태료|지출|계약보증금)\s*$/.test(left))return"";
  const qualifier=/(?:(?:건당|개사당|단체당|팀당|1\s*인(?:당)?)\s*(?:최대|최소)?|총\s*(?:사업비|지원액|예산|지원금|기금)?|전체\s*(?:사업비|예산|지원금)?|최대|최소|예산)\s*$/.exec(left)?.[0]||"";
  const phrase=qualifier+match[0];
  return concise(phrase,"scale",100);
 }
 const count=COUNT.exec(text);
 if(count&&!/(?:접수|응모|제출)\s*\d/.test(text.slice(Math.max(0,count.index-12),count.index))){
  return concise(count[0],"scale",100);
 }
 return"";
}
function scaleOf(row){
 const original=fieldSource(row,"scale");
 const direct=sectionValue(original,"scale",100);
 if(direct)return direct;
 const monetary=monetaryScale(original);
 if(monetary)return monetary;
 for(const s of parsedSnippets(row,"scale")){
  const v=sectionValue(s.quote,"scale",100)||monetaryScale(s.quote);
  if(v)return v;
 }
 return UNKNOWN.scale;
}
function contentOf(row){
 const original=fieldSource(row,"content");
 const direct=sectionValue(original,"content",120);
 if(direct)return direct;
 // An explicitly stated scale is not sufficient evidence of the actual services.
 if(!sections(original).some(x=>TYPE_LABELS.scale.includes(x.label))){
  const parts=original.split(/[,，]\s*/);
  for(const part of parts){
   const value=concise(part,"content",120);
   if(value&&!(MONEY.test(value)&&!/전시|제작|운영|공간|프로그램|기획|활동|연계|서비스|제공|교육|창작|지원/.test(value)))return value;
  }
 }
 for(const s of parsedSnippets(row,"content")){
  const value=sectionValue(s.quote,"content",120);
  if(value)return value;
 }
 return UNKNOWN.content;
}
function eligibilityOf(row){
 const original=fieldSource(row,"eligibility");
 const direct=sectionValue(original,"eligibility",120);
 if(direct)return direct;
 // If a heading exists but has no meaningful value, do not use the whole notice.
 if(!sections(original).some(x=>TYPE_LABELS.eligibility.includes(x.label))){
  const value=concise(original,"eligibility",120);
  if(value)return value;
 }
 for(const s of parsedSnippets(row,"eligibility")){
  const value=sectionValue(s.quote,"eligibility",120);
  if(value)return value;
 }
 return UNKNOWN.eligibility;
}
function summarize(row){
 const r=row||{};
 return {scale:scaleOf(r),content:contentOf(r),eligibility:eligibilityOf(r)};
}
root.AXOOSupportSummary={summarize,plain,scaleOf,contentOf,eligibilityOf,meaningful,UNKNOWN};
if(typeof module!=="undefined"&&module.exports)module.exports=root.AXOOSupportSummary;
})(typeof window!=="undefined"?window:globalThis);
