"use strict";
/**
 * P0: Conservative applicant eligibility, separated from creative fit.
 * Outputs mean candidates to REVIEW, never legally confirmed corporate eligibility.
 * Evidence quotes originate only from the supplied official eligibility/applicant text.
 */
const cut=(v,n=260)=>String(v||"").replace(/\s+/g," ").trim().slice(0,n);
const NEGATIVE=/법인\s*(?:및\s*기업\s*)?(?:신청|지원|참여)\s*(?:불가|제외|제한)|기업\s*(?:신청|참여)\s*(?:불가|제외)|사업자\s*(?:신청|지원)\s*(?:불가|제외)/;
const DIRECT=/(?:사업자등록증|법인\s*사업자|법인사업자|법인\s*또는\s*개인사업자|국내\s*법인|사업자\s*등록\s*(?:완료|기업)|사업을\s*영위하는\s*(?:기업|법인)|예술기업|기업\s*법인|기업\s*및\s*(?:단체|법인)|법인\s*및\s*(?:단체|기업)|개인사업자)/;
const ARTS=/(?:전업\s*)?예술가|예술인|작가|시각예술\s*기획자|예술단체|기획단체|문화예술단체|전시\s*기획자|뮤지션|공연단체/;
const PARTNER=/컨소시엄|공동\s*(?:신청|지원|참여|수행)|주관기관.*참여기관|협력\s*기관|참여\s*기업|공동제작/;
const INDIVIDUAL=/개인\s*(?:전용|한정|대상|자격)|(?:신청|지원)\s*(?:대상|자격)?\s*[:：]?\s*(?:만\s*)?(?:개인\s*예술인|개인\s*작가|예술가\s*개인)|1인\s*(?:창작자|예술가)|소속기관\s*없이/;
const RESTRICTIONS={
 residency:{label:"소재지·거주지",re:/서울\s*(?:소재|거주|활동)|경기(?:도)?\s*(?:소재|거주|활동)|인천\s*(?:소재|거주|활동)|부산\s*(?:소재|거주|활동)|사업장\s*소재지|주민등록(?:상)?\s*(?:주소|거주지)|지역\s*제한/},
 age:{label:"연령",re:/만\s*\d{2}\s*세|(?:\d{2})세\s*(?:이하|미만)|청년\s*(?:예술인|기업|창업)|출생(?:년도|연도)|나이\s*제한/},
 tenure:{label:"업력",re:/창업\s*\d+\s*년|업력\s*\d+\s*년|설립\s*\d+\s*년|사업자등록\s*\d+\s*년|창업\s*(?:초기|도약)/},
 credentials:{label:"신청 증빙·등록",re:/예술활동증명|사업자등록증|법인등록|고유번호증|문화예술단체\s*등록|독립제작사신고필증|전시\s*실적|매출액\s*증빙/},
 contribution:{label:"자부담·매칭",re:/자부담|자기\s*부담|민간\s*매칭|대응\s*자금|사업비\s*\d+(?:\.\d+)?\s*%\s*(?:이상)?\s*부담/},
};
const DOCUMENT_PATTERNS=/(제출서류|신청서|사업계획서|포트폴리오|견적서|예산서|사업자등록증|법인등기부|고유번호증|예술활동증명서|동의서|실적증명서|증빙서류)/g;
function extractApplicationReview(item){
  const raw=cut(item?.eligibility,3400), application=cut(item?.application,3400),
        support=cut(item?.supportDetails,3200),
        documents=(item?.documentReview?.extractedText||"").slice(0,13000);
  // A portal filter header such as "지원대상 전체" is NOT applicant evidence.
  const generic=/^(?:지원대상|신청자격|지원자격|모집대상)?\s*(?:전체|전국|모두|전체\s*지역\s*전국)?$/;
  const eligible=generic.test(raw)||raw.length<12?"":raw;
  // A generic application manual may mention company registration, but that does not
  // mean this particular grant is open to corporations. Applicant status must come
  // from the notice's OWN eligibility field, not an attached platform user guide.
  const body=eligible;
  const text=[body,application,support].join(" ");
  const flags=Object.entries(RESTRICTIONS).flatMap(([code,v])=>{
    const m=text.match(v.re);
    if(!m)return[];
    const index=text.indexOf(m[0]);
    return [{code,label:v.label,quote:cut(text.slice(Math.max(0,index-35),index+125),160)}];
  });
  const submission=[...new Set([...application.matchAll(DOCUMENT_PATTERNS)].map(m=>m[0]))].slice(0,12);
  const direct=DIRECT.exec(body),arts=ARTS.exec(body),partner=PARTNER.exec(body);
  const negative=NEGATIVE.exec(body),individual=INDIVIDUAL.exec(body);
  let code="needs_review",label="자격 확인 필요",basis="";
  if(negative){
    code="not_eligible";label="법인 신청 제한 단서";basis=negative[0];
  }else if(partner){
    code="consortium_review";label="컨소시엄 참여 검토";basis=partner[0];
  }else if(individual){
    code="individual_only";label="개인 신청 중심";basis=individual[0];
  }else if(direct){
    code="corporate_review";label="법인 직접 신청 검토";basis=direct[0];
  }else if(arts){
    code="artist_collab_review";label="작가·예술단체 협업 검토";basis=arts[0];
  }
  const evidence=[];
  if(basis&&eligible.includes(basis))evidence.push({field:"신청 자격",quote:cut(eligible.slice(Math.max(0,eligible.indexOf(basis)-60),eligible.indexOf(basis)+200),260),source:item?.sourceUrl||"",sourceType:"공고 자격 안내"});
  // Machine-readable attachment text is displayed for human review only until
  // its project-specific relevance is verified; it never grants corporate eligibility.
  return {
    version:"p0_eligibility_review_v1",participationCode:code,participationLabel:label,
    applicantBasis:cut(basis,80),evidence,
    restrictions:flags,
    submissionDocuments:submission,
    missingEvidence:!eligible,
    detailQuality:eligible.length>=28?"eligibility_parsed":eligible?"eligibility_short":"not_verified",
    decisionNote:"신청 대상 본문만으로 보수적으로 분류했습니다. 공통 이용안내 PDF의 법인등록 문구는 법인 신청 근거가 아닙니다. 신청 주체·공고 원문·제한조건은 담당자가 재확인해야 합니다.",
    documentAudit:{status:item?.documentReview?.status||"not_scanned",files:Array.isArray(item?.documentReview?.files)?item.documentReview.files:[]}
  };
}
module.exports={extractApplicationReview,RESTRICTIONS};
