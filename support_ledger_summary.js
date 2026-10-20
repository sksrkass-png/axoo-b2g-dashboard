(function initAXOOSupportSummary(root){
"use strict";
/* Short source-grounded summaries. Never turn a total program budget into a per-applicant grant. */
const VERIFY="공고문 확인 필요";
const LABELS=["지원규모","지원금액","사업규모","지원금","지원내용","지원혜택","사업내용","공모내용","지원대상","신청자격","지원자격","모집대상","공모대상","공고기간","접수기간","신청기간","신청방법","전형절차","제출서류","선정방법","지원요건","지원제외","참여제한"];
const labelRE=new RegExp("(?:^|\\s)(?:\\d+\\s*[.)]\\s*)?("+LABELS.join("|")+")\\s*(?=[:：]|\\s)","gi");
function plain(value){
 return String(value==null?"":value)
  .replace(/&(?:nbsp|#160);/gi," ")
  .replace(/&(?:middot|bull|#183|#8226);/gi," · ")
  .replace(/&(?:rarr|#8594);/gi," → ")
  .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
  .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/<[^>]*>/g," ")
  .replace(/\s+/g," ").trim();
}
function getSections(value){
 const text=plain(value),matches=[];
 labelRE.lastIndex=0;
 for(const match of text.matchAll(new RegExp(labelRE.source,"gi"))){
  const label=match[1],start=match.index+match[0].length;
  if(label==="지원금"&&/^(?:액|융자)/.test(text.slice(start)))continue;
  matches.push({label,start,end:start});
 }
 for(let i=0;i<matches.length;i++){
  const end=i+1<matches.length?matches[i+1].start-matches[i+1].label.length:text.length;
  matches[i].text=text.slice(matches[i].start,Math.max(matches[i].start,end))
   .replace(/^\s*[:：]\s*/,"").replace(/^\s*(?:ㅇ|○|●|■|·|[-–])\s*/,"").trim();
 }
 return matches;
}
function firstSection(text,types){
 return getSections(text).find(s=>types.includes(s.label)&&s.text&&
    !/^(?:참고|참조|확인하여|공고문\s*참조|별첨\s*참조|붙임\s*참조)/.test(s.text))?.text||"";
}
function shortenMeaningful(value,length){
 let t=plain(value)
  .replace(/^(?:[:：]\s*|[-•]\s*)+/,"")
  .replace(/\s*(?:좋아요\s*\d+|트위터\s+페이스북|목록\s+전체)\b.*$/,"")
  .trim();
 if(!t)return"";
 const after=t.split(/\s+[ㅇ○●■※]\s+|\s+※\s+|\s+①\s+/)[0].trim();
 if(after.length>=14)t=after;
 if(t.length>length){
  const prefix=t.slice(0,length);
  const boundary=Math.max(prefix.lastIndexOf(" "),prefix.lastIndexOf(","),prefix.lastIndexOf(";"));
  t=(boundary>length*.68?prefix.slice(0,boundary):prefix).trim()+"…";
 }
 return t;
}
function scaleOf(row){
 const source=plain(row.benefit||row.supportDetails||"");
 let segment=firstSection(source,["지원규모","지원금액","사업규모","지원금"]);
 if(segment&&/^(?:신청서|확인|참조|없음|미정)/.test(segment))segment="";
 if(segment)return shortenMeaningful(segment,100);
 // Only repeat a monetary statement if explicit in the provided source.
 const monetary=/(?:총\s*|전체\s*|건당\s*|매체당\s*|단체당\s*|팀당\s*|1\s*인(?:당)?\s*|최대\s*|최소\s*|예산\s*)?(?:\d[\d,.]*\s*(?:조|억|천만|백만|만)\s*원?|\d[\d,.]*\s*원)(?:\s*[/／]\s*\d+\s*개\s*내외)?/;
 const match=monetary.exec(source);
 if(match){
  const before=source.slice(Math.max(0,match.index-19),match.index);
  const qualification=/(전체\s*(?:예산|지원|기금)?|총\s*(?:예산|사업비)?|예산\s*|건당\s*|단체당\s*|매체당\s*|최대\s*|최소\s*|1\s*인(?:당)?\s*)$/.exec(before);
  return shortenMeaningful((qualification?qualification[0]:"")+match[0],95);
 }
 const count=/(?:최종\s*)?\d+\s*(?:개사|개\s*단체|건|팀|명)\s*(?:이내|내외|선정|지원)/.exec(source);
 return count?shortenMeaningful(count[0],95):VERIFY;
}
function contentOf(row){
 const source=plain(row.benefit||row.supportDetails||"");
 const section=firstSection(source,["지원내용","지원혜택","사업내용","공모내용"]);
 if(section)return shortenMeaningful(section,120)||VERIFY;
 if(!source)return VERIFY;
 // Reference records often contain "amount, benefit" in one sentence.
 const parts=source.split(/[,，]\s*/);
 const descriptive=parts.find(x=>x.length>=8&&!/^(?:총|예산|규모|건당|최소|최대|최종|연간)\s*[\d,.]+/.test(x)
  &&!/(?:접수|선정)\s*\d+\s*건/.test(x)
  &&(!/\d[\d,.]*\s*(?:억원|억|만원|천만원|원)\b/.test(x)||/지원|전시|제작|운영|공간|프로그램|기획|구축|교육|활동|공연|해외|유통|임대료/.test(x)));
 if(descriptive)return shortenMeaningful(descriptive,120);
 if(/^\s*(?:지원내용|사업내용|참여내용|활동내용)/.test(source))return shortenMeaningful(source,120);
 if(!/^\s*(?:총|전체|예산|건당|단체당|매체당|최대|최소|최종)/.test(source) && !/^\d[\d,.]*\s*(?:억원|억|만원|천만원|원)/.test(source))
  return shortenMeaningful(source,120);
 return VERIFY;
}
function eligibilityOf(row){
 const source=plain(row.applicants||row.eligibility||"");
 if(!source||/^(?:지원대상|신청자격|모집대상)?\s*(?:전체|전국|모두|해당없음|미정|원문 확인)\s*$/.test(source))return VERIFY;
 const section=firstSection(source,["신청자격","지원자격","지원대상","모집대상","공모대상"]);
 return shortenMeaningful(section||source,120)||VERIFY;
}
function summarize(row){
 return{scale:scaleOf(row||{}),content:contentOf(row||{}),eligibility:eligibilityOf(row||{})};
}
root.AXOOSupportSummary={summarize,plain,scaleOf,contentOf,eligibilityOf};
if(typeof module!=="undefined"&&module.exports)module.exports=root.AXOOSupportSummary;
})(typeof window!=="undefined"?window:globalThis);
