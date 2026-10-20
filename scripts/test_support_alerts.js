(function test(){
 "use strict";
 const assert=require("node:assert/strict");
 const {calculate,policyOf,daysLeft,F}=require("./create_support_alerts");
 const now="2026-10-20",policy={id:"recConfig",createdTime:"2026-10-20T01:39:36.000Z",fields:{
  [F.config.name]:"AXOO B2G 공식 공고 알림 정책",
  [F.config.newOn]:true,[F.config.d7]:true,[F.config.d3]:true,[F.config.emailOn]:false,
  [F.config.min]:45,[F.config.cap]:12}};
 const candidate=(id,created,title,deadline="2026-10-29",fit=55,mode="법인 직접 신청 검토",status="기간상 접수 가능")=>({id,createdTime:created,fields:{
  [F.candidate.id]:"live-"+id,[F.candidate.title]:title,[F.candidate.url]:"https://example.org/"+id,
  [F.candidate.org]:"공식기관",[F.candidate.end]:deadline,[F.candidate.fit]:fit,[F.candidate.mode]:{name:mode},
  [F.candidate.status]:{name:status}
 }});
 const old=candidate("recOLD","2026-10-19T11:00:00.000Z","기존 공고");
 const fresh=candidate("recNEW","2026-10-20T01:40:00.000Z","새 아트 콜라보 기획 지원");
 const low=candidate("recLOW","2026-10-20T01:43:00.000Z","저적합도 공고","2026-10-29",20);
 const closed=candidate("recEX","2026-10-20T01:43:00.000Z","마감한 사업","2026-10-17",67);
 const unknown=candidate("recUNKNOWN","2026-10-20T01:43:00.000Z","판별 미완료","2026-10-29",67,"자격 확인 필요");
 const mg=(id,deadline,stage="서류 준비",internalDate="",owner=null)=>({id,fields:{
  [F.managed.title]:"지원 사업 "+id,[F.managed.stage]:{name:stage},
  [F.managed.official]:deadline,[F.managed.internal]:internalDate,[F.managed.owner]:owner,
  [F.managed.url]:"https://example.org/grant/"+id,[F.managed.id]:"live-"+id,[F.managed.org]:"기관"
 }});
 assert.equal(daysLeft("2026-10-27",now),7);
 assert.equal(daysLeft("2026-10-23",now),3);
 assert.equal(daysLeft("2026-10-20",now),0);
 assert.equal(daysLeft("2026-10-19",now),-1);
 assert.equal(daysLeft("",now),null);
 let events=calculate({settings:policy,candidates:[old,fresh,low,closed,unknown],current:now});
 assert.equal(events.length,1,"No backlog, low fit or ineligible sources");
 assert.equal(events[0].key,"NEW:recNEW");
 assert.equal(events[0].fields[F.alert.delivery],"알림함 등록");
 const managed=[mg("recD7","2026-10-27"),mg("recD3","2026-10-23"),mg("recTODAY","2026-10-20"),
   mg("recWAIT","2026-10-22","결과 대기"),mg("recDONE","2026-10-27","제출 완료"),mg("recOLD","2026-10-18"),
   mg("recINTERNAL","2026-11-10","서류 준비","2026-10-25")];
 events=calculate({settings:policy,candidates:[old,fresh],managed,current:now});
 assert.equal(events.length,5);
 assert(events.some(x=>x.key==="D7:recD7:2026-10-27"));
 assert(events.some(x=>x.key==="D3:recD3:2026-10-23"));
 assert(events.some(x=>x.key==="D3:recTODAY:2026-10-20"));
 assert(events.some(x=>x.key==="D7:recINTERNAL:2026-10-25"));
 assert(!events.some(x=>x.key.includes("recDONE")));
 const repeated=calculate({settings:policy,candidates:[old,fresh],managed,current:now,previousKeys:new Set(events.map(x=>x.key))});
 assert.equal(repeated.length,0,"No duplicate alerts on rerun");
 const moved=calculate({settings:policy,candidates:[],managed:[mg("recD7","2026-10-30")],current:now,previousKeys:new Set(events.map(x=>x.key))});
 assert.equal(moved.length,0);
 const modified=calculate({settings:policy,candidates:[],managed:[mg("recD7","2026-10-26")],current:now,previousKeys:new Set(events.map(x=>x.key))});
 assert.equal(modified.length,1,"Changed deadlines make a new distinct event");
 const capped={...policy,fields:{...policy.fields,[F.config.cap]:1,[F.config.emailOn]:true,[F.config.email]:"team@example.org"}};
 const new2=candidate("recNEW2","2026-10-20T01:42:00.000Z","두번째 새 공고");
 events=calculate({settings:capped,candidates:[fresh,new2],current:now});
 assert.equal(events.length,1,"Limit new notifications per cycle");
 assert.equal(events[0].fields[F.alert.email],"team@example.org");
 assert.equal(events[0].fields[F.alert.delivery],"이메일 발송 대기");
 assert.equal(policyOf(policy).activated,"2026-10-20T01:39:36.000Z");
 console.log("P5 notification eligibility, D-7/D-3, dedup, priority, activation cutoff, email gates: PASS");
})();
