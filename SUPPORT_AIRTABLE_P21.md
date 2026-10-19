# AXOO B2G P2.1 — 기존 공용 Airtable 내부 운영

## 현재 기준 (2026-10-19)
**기존 공용 베이스:** https://airtable.com/applM2n5kScusEfYr
원래의 ARTIST DB, CLIENT DB, B2G 영업 DB 등 기존 테이블은 변경하지 않고, 아래 3개를 추가함.

| 테이블 | Table ID | 목적 |
|---|---|---|
| ✦ B2G 지원공고 후보 | tblwuEYAPKkA5BEVs | GitHub 04 공식 공고 수집 결과 미러. 기존 신규 베이스에서 69건 마이그레이션 |
| ✦ B2G 지원관리 | tblh8ArxjYKf46Tv0 | 검토·지원 결정·서류·담당·마감·진척·제출·결과 관리 |
| ✦ B2G 지원실행 To Do | tblHAcJHCgEfJKVcV | 담당자별 세부 업무. 지원사업 연계 링크 필드 포함 |

새 인터페이스 **AXOO B2G | 04 지원사업 공동관리** `pbdLXa2eBO51UhI5O`는 같은 공용 베이스 내부에 있고 게시 완료.
- [01 단계별 현황](https://airtable.com/applM2n5kScusEfYr/pagWH6XUkQJfro0wr)
- [02 디렉터 검토 원장](https://airtable.com/applM2n5kScusEfYr/pagL4ZaUaOndFiVoS)
- [03 마감 캘린더](https://airtable.com/applM2n5kScusEfYr/pagcfyVB8DG9fxg69)
- [04 세부 To Do](https://airtable.com/applM2n5kScusEfYr/pagncxtTDCa9sAakz)
- [05 자동수집 후보](https://airtable.com/applM2n5kScusEfYr/pag9HMvdDhUYq7ORu)

## 계정 사용자가 완료해야 할 최초 설정
### 1. 새 공용 베이스 자동화 활성화
1. [공용 베이스용 후보→지원관리 자동화](https://airtable.com/applM2n5kScusEfYr/wfl2E0RrZa1Jh4tMi)를 연다.
2. 트리거: `✦ B2G 지원공고 후보`의 `검토 대상으로 선택=true`, `관리 등록=미등록`.
3. 액션: `✦ B2G 지원관리` 신규 생성 → 원본 후보의 `관리 등록=등록 완료` 및 `연결된 지원관리` 연결.
4. 내용 확인 후 **Turn on**. Airtable 자동화는 사용자 확인 없이는 개발 도구에서 직접 켤 수 없음.
5. 대표 공고 1건만 선택해 정상 등록되는지 확인. 예시·임시 공고를 새로 만들 필요는 없음.
6. **이전 별도 베이스의 [기존 자동화](https://airtable.com/app59It3ijZvl0szJ/wfl0BZ8OKN3gOP65Z)는 Turn off**로 전환. 사용자가 앞서 ON으로 설정한 구형 베이스의 자동화이므로 혼선 방지용이며, 베이스나 기존 공고 기록 자체는 삭제하지 않음.

### 2. GitHub Actions → 공용 Airtable 자동 업데이트 연결
1. [Airtable Developer Hub](https://airtable.com/create/tokens)에서 Personal Access Token 생성.
2. 최소 권한: `data.records:read`, `data.records:write`. 허용 리소스를 **기존 공용 베이스 `applM2n5kScusEfYr`만** 선택.
3. 비밀키는 채팅이나 GitHub 코드에 붙이지 말 것. [GitHub Actions Secrets](https://github.com/sksrkass-png/axoo-b2g-dashboard/settings/secrets/actions)에서 Repository secret `AIRTABLE_PAT`으로 직접 저장.
4. 다음 `Collect Support Programs` 실행부터 `scripts/sync_airtable_support_candidates.js`가 후보 원장의 공고 공식정보를 증분 업데이트함.
5. 설정 전에는 `SKIPPED`가 정상이며 **Airtable 69건은 최초 이관 당시의 스냅샷**이다. 비밀키 생성만으로 설정이 끝난 것은 아니고, Actions 실행 로그에서 API 성공을 확인해야 한다.

## 사용법
1. AXOO GitHub 대시보드 04 예술·콘텐츠 지원 → **Airtable 공동관리** 링크.
2. [05 자동수집 후보](https://airtable.com/applM2n5kScusEfYr/pag9HMvdDhUYq7ORu)에서 실제 검토할 공고의 체크박스 선택.
3. 자동화가 켜졌다면 [02 디렉터 검토 원장](https://airtable.com/applM2n5kScusEfYr/pagL4ZaUaOndFiVoS)에 등록.
4. 담당자·참여 방식·내부 마감일·업무·진행률·진척 사항·최종 결과를 기록하고, 필요한 실행 업무를 [04 To Do](https://airtable.com/applM2n5kScusEfYr/pagncxtTDCa9sAakz)에서 지원사업과 연결.

## 데이터 무결성·보안
- 자동수집 코드는 후보 테이블만 갱신. 팀원이 관리하는 체크박스, 관리 등록 상태, 연결된 지원관리, 담당자·메모·진행률·성과 기록은 변경하지 않음.
- Research ID를 기준으로 생성/갱신하며, 수정된 공고 정보만 업데이트하고 기존 후보를 삭제하지 않음.
- GitHub Actions에 `AIRTABLE_PAT`이 없으면 외부 업데이트를 실행하지 않음. 토큰은 브라우저 JavaScript·정적 GitHub Pages HTML에 사용하지 않음.
- 구형 별도 베이스(`app59It3ijZvl0szJ`)의 공고 69건은 그대로 보존. 이관 시점에 선택된 후보와 진행 중 지원관리 건수는 0건이었음.
- 브라우저 로컬 P2 기록은 본인 PC에만 남으며 Airtable로 자동 이관되지 않음.
- 기존 `✦ B2G 영업 DB`(`tblFUtk51yQvts893`) 등은 변경하지 않음.
- 지원자격 자동 판정은 실제 법적 신청 자격의 확정 판정이 아니므로 공식 공고 원문 재확인 필요.
