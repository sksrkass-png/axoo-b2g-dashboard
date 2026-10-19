# AXOO B2G P2.1 — Airtable 공동 지원관리 운영 가이드

## 상태 (2026-10-19)
- 신규 Airtable Base: `AXOO B2G 지원관리`, `app59It3ijZvl0szJ` — https://airtable.com/app59It3ijZvl0szJ
- 기존 건축물 미술작품용 Project Control과 **완전 분리**.
- 테이블 3종:
  - `지원사업 관리` (`tblL1eHwfvbEP7epH`): 실제 검토/지원 업무의 단일 원장.
  - `실행 업무` (`tblupc4SS30MeE5TG`): 지원사업 연결형 To Do.
  - `자동수집 공고 후보` (`tblsWgVeEHJB1Tbtb`): GitHub 공고 원장 스냅샷. 초기 69건 등록.
- Airtable Interface `AXOO B2G | 지원사업 공동관리` 게시 완료: 단계별 현황, 디렉터 검토 원장, 마감 캘린더, 실행 업무, 자동수집 후보 5개 페이지.
- Airtable 자동화 `P2.1｜검토 대상으로 선택 → 지원사업 관리 등록` 작성·검증 완료. **초기 상태 OFF**. 아래 1단계에서 직접 ON 필요.
- GitHub Pages의 04번에는 **Airtable 공동관리 열기** 버튼을 추가. 기존 P2 로컬 브라우저 기능과 분리됨.

## 최초 연결 — 계정 소유자 필수 작업

### 1. Airtable 내부 후보→지원관리 전환 자동화 켜기
1. https://airtable.com/app59It3ijZvl0szJ/wfl0BZ8OKN3gOP65Z 열기.
2. 트리거가 `자동수집 공고 후보: 검토 대상으로 선택=true AND 관리 등록=미등록`인지 확인.
3. 작업 `지원사업 관리에 레코드 생성 → 공고 후보의 관리 등록=등록 완료, 연결된 지원관리 연결` 확인.
4. **Turn on / 활성화**로 변경. Airtable 정책상 외부 연결 도구가 직접 활성화하지 않음.
5. Airtable `자동수집 공고 후보`에서 1건을 골라 `검토 대상으로 선택` 체크 → `지원사업 관리` 테이블에서 생성 확인.
6. 최초 테스트 후 등록된 실제 공고는 유지하되, 불필요한 것은 담당자가 검토 상태를 조정.

### 2. GitHub → Airtable 신규 공고 2시간 갱신 활성화 (비밀키 설정)
1. Airtable 계정의 [Developer Hub](https://airtable.com/create/tokens)에서 Personal Access Token 생성.
2. 최소 권한: `data.records:read`, `data.records:write`; **리소스는 이 신규 베이스(`app59It3ijZvl0szJ`)만 허용**.
3. 생성한 PAT를 **채팅/저장소 코드/브라우저에 절대 넣지 말고**, GitHub 저장소 `sksrkass-png/axoo-b2g-dashboard` → **Settings → Secrets and variables → Actions → New repository secret**에 이름 **`AIRTABLE_PAT`**로 등록:
   https://github.com/sksrkass-png/axoo-b2g-dashboard/settings/secrets/actions
4. 저장하면 다음 `Collect Support Programs` 워크플로 실행부터 `scripts/sync_airtable_support_candidates.js`가 후보 원장을 최신화.
5. GitHub Actions 실행 로그의 `Sync official support candidates to Airtable`을 확인. 미설정 시 스크립트는 `SKIPPED`를 기록하고 기존 Airtable을 변경하지 않음.

## 실제 사용법
- 04 지원사업 대시보드 → `Airtable 공동 지원관리` 링크 열기.
- Airtable `05 자동수집 공고 후보`에서 지원할 공고 `검토 대상으로 선택` 체크.
- 자동화가 ON인 경우 `지원사업 관리`로 **신규 등록**되고 후보의 `관리 등록`이 `등록 완료`로 바뀜.
- `01 단계별 현황` 또는 `02 디렉터 검토 원장`에서 담당자 지정, 단계 선택, 우선순위, 내부 마감, 진행률, 다음 업무 및 제출 상황 관리.
- `04 세부 업무 To Do`의 `지원사업` 연결 필드로 업무를 원장에 연결.
- `03 지원 마감 캘린더`에서 팀 내부 마감일 확인.

## 데이터 무결성 / 비밀키
- Airtable PAT는 **GitHub Actions Secrets에서만 읽음**, GitHub Pages JS/HTML에 포함되지 않음.
- 동기화는 후보 테이블의 **공식 데이터만** 신규 생성/갱신: 공고명, Research ID, 출처, 공식 마감일, 회사 참여 방식, 적합도, 근거.
- `검토 대상으로 선택`, `관리 등록`, `연결된 지원관리`, 팀원의 `담당자·진행률·메모·최종 결과`는 자동 수집 코드가 수정하지 않음.
- 기존 후보 69건은 스냅샷이며, GitHub Secret 설정 전에는 **새 공고 자동 동기화가 비활성**.
- 기존 브라우저 P2 기록은 **자동으로 Airtable에 이관되지 않음**. 해당 기기에서 JSON 백업을 받아 별도 이관 검토 필요.
- `지원사업 관리`의 원문 자격 분류는 **법적 신청 가능 판정이 아님**. 공식 신청 자격과 실적·소재지 제한을 확인.
- GitHub Pages 04번의 `+ 로컬 검토 등록`은 브라우저 전용; **Airtable 공동관리와 다른 별도 기능**.
- Airtable 베이스를 함께 사용할 팀원은 베이스/Interface에 초대해야 접근 가능.

## 파일과 테스트
- `scripts/sync_airtable_support_candidates.js`: 동기화 코드. 삭제 없음, 새로운 후보 추가, 공식 메타데이터만 수정.
- `scripts/test_airtable_candidate_sync.js`: Research ID 일치, 사람이 관리하는 필드가 자동 업데이트 대상에서 빠졌는지 검사.
- `.github/workflows/collect-support-programs.yml`: 기존 2시간 공식 공고 수집 완료 후 Airtable 동기화(비밀키 없으면 건너뜀).
- `.github/workflows/verify-support-ledger.yml`: 빠른 UI 및 미러 검증.
