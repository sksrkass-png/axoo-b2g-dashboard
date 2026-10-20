(function P5(){
  "use strict";
  const BASE="applM2n5kScusEfYr",PREFIX="https://api.airtable.com/v0/"+BASE+"/";
  const T={config:"tblSn72ne3aB0TSKf",candidate:"tblwuEYAPKkA5BEVs",managed:"tblh8ArxjYKf46Tv0",alerts:"tblrfYMQNXVu1nD7J"};
  const F={
   config:{name:"fldxMA1Ayq8kw0pBU",email:"fldxCoKsOhFAgT0BQ",newOn:"fldqtvFwwZsGGFyG3",d7:"fldM36Mtncw5kVFZm",d3:"fldVqkPnME2OWtl1M",emailOn:"fldHVsMqI01878Pwd",min:"fldp3nG0SFmyoueGD",cap:"flddKw2c6DjGIpThU"},
   candidate:{title:"fldNCe5SdjlOFVB7O",id:"flddGu8HySNRqIoyJ",url:"fldkvwwF165BU1L4r",org:"fld5kIh1Ogf3JlzYz",status:"fldpF1bms8kq8H4fj",end:"fldgZX910ImKkPKUE",mode:"fldYX0kJwLMPAAa5N",fit:"fldjA4F9QIT9wHyfN"},
   managed:{title:"fldwluozqFPFYprpc",id:"fldMfwJOVjh81GFr0",url:"fldc4W6WcxsHhWWwh",org:"fldxEsyhSUkpLjeTf",stage:"fldr1lg7mhOxnpcoa",owner:"fldp2aU0jUksJBTCA",official:"fldU368fNyAHazfJr",internal:"fld0qt7jhzVnu27ZH"},
   alert:{title:"fld26AFusYJvo3u6B",key:"fldVXRTthPNmF2Mnd",kind:"fldom4FXc5cjkX2hd",priority:"fldqf1P9Z39c2jsCM",ack:"fld2QvgZOZEu7WICD",delivery:"fldi4XgrHLZeLPIaD",email:"fldHICHjqbjCmVdRK",body:"fldU68FTI0i3JK6kC",id:"fldA3AnlQzvrjae1k",org:"fldRwJpdWlkdPYcyg",url:"fldIvA9718kyPUosQ",end:"fldWstdmNbOnQNDLD",days:"fldlzkQKcTivwn58z",at:"fldsWpthipKyIL6nk",owner:"fld5VCuZzZZ1VI2Tk",managed:"fldKxehXvixYt8s7x",candidate:"fldQn5Iza1fG6aCoh"}
  };
  const eligible=new Set(["법인 직접 신청 검토","작가·예술단체 협업 검토","컨소시엄 참여 검토"]);
  const activeStages=new Set(["관심 등록","적격성 검토","지원 결정","서류 준비","내부 검토"]);
  const activeStates=new Set(["기간상 접수 가능","접수 예정"]);
  const name=x=>x&&typeof x==="object"?x.name||"":String(x||"");
  const validDate=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||""))?String(x):"";
  const url=x=>/^https:\/\/[^\s"'<>\x00-\x1f]+$/i.test(String(x||""))?x:"";
  const fmt=x=>String(x||"").replace(/\s+/g," ").trim().slice(0,250);
  const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const daysLeft=(deadline,now)=>validDate(deadline)&&validDate(now)?Math.round((Date.parse(deadline+"T00:00:00Z")-Date.parse(now+"T00:00:00Z"))/86400000):null;
  const policyOf=r=>{
    if(!r)return null;
    const v=r.fields||{},f=F.config;
    return {activated:r.createdTime||"",newOn:v[f.newOn]===true,d7:v[f.d7]===true,d3:v[f.d3]===true,
     emailOn:v[f.emailOn]===true,email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v[f.email]||"")?v[f.email]:"",
     min:Math.max(0,Math.min(100,Number(v[f.min]??45))),cap:Math.max(0,Math.min(40,Math.floor(Number(v[f.cap]??12))))};
  };
  function buildEvent({key,kind,title,high=false,body,id,org,url:href,end,days,managed,candidate,owner,email}){
    const f=F.alert,fields={
      [f.title]:fmt(title),[f.key]:key,[f.kind]:kind,[f.priority]:high?"높음":"보통",
      [f.ack]:"미확인",[f.delivery]:email?"이메일 발송 대기":"알림함 등록",
      [f.body]:String(body||"").slice(0,3000),[f.id]:String(id||"").slice(0,180),[f.org]:fmt(org),
      [f.at]:new Date().toISOString()
    };
    if(email)fields[f.email]=email;
    if(url(href))fields[f.url]=href;
    if(validDate(end))fields[f.end]=end;
    if(Number.isInteger(days))fields[f.days]=days;
    if(managed)fields[f.managed]=[managed];
    if(candidate)fields[f.candidate]=[candidate];
    if(owner?.id&&/^usr[A-Za-z0-9]{14}$/.test(owner.id))fields[f.owner]={id:owner.id};
    return {key,fields};
  }
  function calculate({settings,candidates=[],managed=[],previousKeys=new Set(),current=today()}){
    const cfg=policyOf(settings);if(!cfg)return [];
    const known=new Set(previousKeys),out=[];
    const add=e=>{if(!known.has(e.key)){known.add(e.key);out.push(e);}};
    let newAdded=0;
    const c=F.candidate;
    for(const rec of [...candidates].sort((a,b)=>String(a.createdTime).localeCompare(String(b.createdTime)))){
      if(!cfg.newOn||newAdded>=cfg.cap)break;
      const r=rec.fields||{},remaining=daysLeft(r[c.end],current),key="NEW:"+rec.id;
      if(known.has(key)||!rec.createdTime||rec.createdTime<=cfg.activated)continue;
      if(!String(r[c.id]||"").startsWith("live-")||!eligible.has(name(r[c.mode]))||!activeStates.has(name(r[c.status])))continue;
      if((Number(r[c.fit])||0)<cfg.min||remaining===null||remaining<0)continue;
      const body=`[AXOO B2G] 새 공식 공고\n사업: ${r[c.title]}\n기관: ${r[c.org]}\n기간상 상태: ${name(r[c.status])}\n마감일: ${r[c.end]} (D-${remaining})\n예상 적합도: ${r[c.fit]}점 / 참여 방식: ${name(r[c.mode])}\n지원 자격과 현재 접수 여부는 공식 원문을 확인하세요.\n${r[c.url]||""}`;
      add(buildEvent({key,kind:"신규 공고",title:"🆕 신규 지원공고 | "+r[c.title],high:remaining<=3,body,id:r[c.id],org:r[c.org],url:r[c.url],end:r[c.end],days:remaining,candidate:rec.id,email:cfg.emailOn?cfg.email:""}));
      newAdded++;
    }
    const m=F.managed;
    for(const rec of managed){
      const r=rec.fields||{};
      if(!activeStages.has(name(r[m.stage])))continue;
      const internal=validDate(r[m.internal]);
      const deadline=internal||validDate(r[m.official]),d=daysLeft(deadline,current);
      if(d===null||d<0||d>7)continue;
      const tier=d<=3?"D3":"D7";
      if(tier==="D3"&&!cfg.d3||tier==="D7"&&!cfg.d7)continue;
      const key=tier+":"+rec.id+":"+deadline;if(known.has(key))continue;
      const title=(tier==="D3"?"🚨 D-3 마감 임박 | ":"⏳ D-7 마감 임박 | ")+r[m.title];
      const body=`[AXOO B2G 지원관리]\n사업: ${r[m.title]}\n단계: ${name(r[m.stage])}\n담당: ${r[m.owner]?.name||"미배정"}\n${internal?"내부 마감":"공식 마감"}: ${deadline} (${d===0?"D-DAY":"D-"+d})\n공식 공고: ${r[m.url]||"미확인"}\n서류와 제출 상태를 확인하세요.`;
      add(buildEvent({key,kind:tier==="D3"?"D-3 마감":"D-7 마감",title,high:tier==="D3",body,id:r[m.id]||"live-"+rec.id,org:r[m.org],url:r[m.url],end:deadline,days:d,managed:rec.id,owner:r[m.owner],email:cfg.emailOn?cfg.email:""}));
    }
    return out;
  }
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function fetchAPI(token,method,uri,payload){
    for(let i=0;i<5;i++){
      let res;
      try{res=await fetch(uri,{method,headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json","Accept":"application/json"},body:payload?JSON.stringify(payload):undefined});}
      catch(e){if(i===4)throw e;await wait(500*2**i);continue}
      if(res.status===429||res.status>=500){if(i===4)throw Error("HTTP "+res.status);await wait(700*2**i);continue}
      if(!res.ok)throw Error("Airtable "+res.status+": "+(await res.text()).slice(0,240));
      return res.json();
    }
    throw Error("Airtable retry exhausted");
  }
  async function readAll(token,table,keys=[]){
    const arr=[];let offset="";
    for(let page=0;page<30;page++){
      const u=new URL(PREFIX+table);u.searchParams.set("pageSize","100");u.searchParams.set("returnFieldsByFieldId","true");
      keys.forEach(k=>u.searchParams.append("fields[]",k));
      if(offset)u.searchParams.set("offset",offset);
      const r=await fetchAPI(token,"GET",u.toString());
      arr.push(...(r.records||[]));
      if(!r.offset)return arr;
      offset=r.offset;await wait(260);
    }
    throw Error("Airtable > 3000 records, increase paging");
  }
  async function run(){
    const token=process.env.AIRTABLE_PAT;
    if(!token){console.warn("[AXOO P5] AIRTABLE_PAT absent; alerts skipped");return}
    const configs=await readAll(token,T.config);
    const cfgRow=configs.find(x=>x.fields?.[F.config.name]==="AXOO B2G 공식 공고 알림 정책")||configs[0];
    if(!cfgRow){console.warn("[AXOO P5] Policy missing; no events emitted");return}
    const [candidates,managed,alerts]=await Promise.all([
      readAll(token,T.candidate,Object.values(F.candidate)),
      readAll(token,T.managed,Object.values(F.managed)),
      readAll(token,T.alerts,[F.alert.key])
    ]);
    const previousKeys=new Set(alerts.map(x=>x.fields?.[F.alert.key]).filter(Boolean));
    const events=calculate({settings:cfgRow,candidates,managed,previousKeys,current:today()});
    const policy=policyOf(cfgRow);
    console.log("[AXOO P5] evaluated "+candidates.length+" candidates, "+managed.length+" managed, "+alerts.length+" previous alerts; new "+events.filter(e=>e.fields[F.alert.kind]==="신규 공고").length+", deadlines "+events.filter(e=>e.fields[F.alert.kind]!=="신규 공고").length+"; email "+(policy.emailOn&&policy.email?"enabled":"disabled"));
    if(process.env.ALERT_DRY_RUN==="1"){console.log("[AXOO P5] dry-run event keys",events.map(x=>x.key));return}
    let written=0;
    for(let i=0;i<events.length;i+=10){
      const res=await fetchAPI(token,"POST",PREFIX+T.alerts,{records:events.slice(i,i+10).map(e=>({fields:e.fields})),typecast:false});
      written+=(res.records||[]).length;await wait(300);
    }
    console.log("[AXOO P5] created "+written+" new Airtable outbox notifications");
  }
  module.exports={T,F,calculate,policyOf,daysLeft};
  if(require.main===module)run().catch(e=>{console.error("[AXOO P5]",e);process.exitCode=1});
})();
