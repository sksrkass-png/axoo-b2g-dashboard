# AXOO B2G P5 — 신규 공고 / D-7 / D-3 알림 운영

## 실제 실행 구조 (2026-10-20)
- 공용 Airtable Base: `applM2n5kScusEfYr`.
- `✦ B2G 지원알림` (`tblrfYMQNXVu1nD7J`): 중복 방지용 이벤트 키, 읽음/보류 상태, 알림 유형, 원문 URL, 관리 공고 링크, 발송 상태.
- `✦ B2G 알림설정` (`tblSn72ne3aB0TSKf`): 신규 공고 / D-7 / D-3 사용 여부, 적합도 하한, 1회 상한, 수신 이메일 및 이메일 ON/OFF.
- 초기 설정 레코드: `recJak8sCWcwZutQQ`, 생성 시간 `2026-10-20T01:39:36.000Z`. 이 시각 **이후**에 후보 DB에 새로 만들어진 공고만 신규 공고 알림 대상.
- Airtable 공동관리 Interface:
  - 알림함 `https://airtable.com/applM2n5kScusEfYr/paga5K65AZi8SHJIi`
  - 알림 설정 `https://airtable.com/applM2n5kScusEfYr/pag6YNkNTdWNaIFrV`
- GitHub `scripts/create_support_alerts.js`: 후보 생성·신청관리를 확인하고 알림함에 신규 레코드만 추가.
- GitHub `.github/workflows/collect-support-programs.yml`: 기존 2시간 공식 수집 → Airtable 후보 반영 → P5 단위 테스트 → 알림함 기록.
- GitHub Actions 암호화 Secret `AIRTABLE_PAT`을 사용하며 웹사이트 JS에는 포함하지 않음.

## 알림 조건과 중복 방지
- **신규 공고**: 새로 Airtable 후보 DB에 **등록된 시각**이 초기 알림설정 생성 시각 이후이고, Research ID가 `live-`로 시작하며, 지원 가능 일정 추출됨, 상태가 '기간상 접수 가능' 또는 '접수 예정', AXOO 적합도 **45점 이상**, 법인/작가 협업/컨소시엄 검토 대상으로 분류된 공식 공고. 기존 69건 및 사용자가 올린 73건의 참고 이력은 소급 발송하지 않음. 1회 신규 최대 12건.
- **마감 D-7**: 공용 `✦ B2G 지원관리`에 등록된 미제출 공고의 관리 마감까지 **4~7일** 남은 경우 1회.
- **마감 D-3**: 공용 지원관리에 등록된 미제출 공고의 관리 마감까지 **0~3일** 남은 경우 1회.
- 보류, 제출 완료, 결과 대기, 선정, 미선정 등 종료 단계는 마감 알림 제외.
- 내부 마감일이 등록되면 공식 마감일보다 우선. 공식 마감과 다른지 Airtable에서 확인해야 함.
- 이벤트 키 `NEW:<candidate_record_id>`, `D7:<managed_record_id>:<deadline>`, `D3:<managed_record_id>:<deadline>`를 기존 알림함과 비교해 **동일 공고·동일 기한의 재알림을 방지**. 마감일 자체가 변경되면 새로운 기한 기준 알림이 가능합니다.
- Airtable 알림의 `미확인/확인/보류` 및 팀 협업 기록은 자동 수집기가 변경하지 않음.

## 이메일 알림 설정 (옵션, 현재 미사용)
1. `07 지원알림 운영 설정`에서 **수신 이메일**을 입력하고 **이메일 발송 사용** 체크.
2. `https://airtable.com/applM2n5kScusEfYr/wflTDd0HZHU7qS8n9`에 생성한 `P5｜신규·마감 알림 이메일 발송 (수신자 설정 후 ON)` 자동화를 확인하고 **Turn on**.
3. 조건: `✦ B2G 지원알림`의 **전달 상태 = 이메일 발송 대기 + 수신 이메일 있음** → Airtable 기본 이메일 발송 → `이메일 발송 완료`로 수정.
4. 이메일 수신자 설정과 자동화 ON 전에는 외부로 이메일을 보내지 않고 Airtable 알림함만 기록. 설정 변경은 기존 알림을 임의로 재발송하지 않음.

## 운영 제한과 검수
- 실제 사이트에서 공고가 접수 가능한지, 법인이 법적 신청자격을 충족하는지는 자동 알림이 보장하지 않음. **공고 원문 최종 확인 필수**.
- GitHub Actions 예약 실행은 2시간 간격이며 수집 시간만큼 알림이 지연될 수 있음. 즉시 웹훅·스트리밍은 아님.
- Airtable 알림함의 `확인` 상태는 팀원이 수동으로 지정; 이메일 알림의 발송 상태와 별개.
- 실무 지원관리 테이블에 공고가 **0건이면** 마감 알림도 **0건**이 정상.
- 새 알림 기준 시각을 바꾸려면 기존 설정 레코드의 생성 시각은 바뀌지 않으므로 개발자 검토 필요. 기존 알림을 삭제하여 재발송시키지 말 것.
- `node scripts/test_support_alerts.js`는 기한 계산·중복 방지·알림 제한·이메일 게이트를 검증하며 `verify-support-ledger.yml`과 수집 워크플로 모두에 포함.
