# AXOO 04 — Official Grant Collection Operating Guide

## Purpose
AXOO's "04 예술·콘텐츠 지원" is an **opportunity ledger**, not a final eligibility/legal decision. Keep all art/grant candidates discoverable while separating automatic observations from application certainty. Procurement/bid notices belong in tabs 02/03/05 and must not be mixed into the 04 grant catalog.

## Flow
1. GitHub Actions `.github/workflows/collect-support-programs.yml` starts every 2 hours (UTC cron `40 */2 * * *`; scheduled runs may be delayed by GitHub).
2. The original `scripts/collect_support_programs.js` checks KAMS, ARKO, KCDF, KOCCA official HTML sources.
3. `scripts/collect_regional_support.js` checks official listing pages SCAS, GGCF, IFAC, BSCF, Seoul; detail fetches are attempted per listing item. Per-source failures are recorded, without silently claiming a successful refresh.
4. Two source outputs (`data/support_programs.json`, `data/support_regional_programs.json`) are merged by `scripts/build_priority_projects.js` into `data/priority_projects.json`; duplicate detail URLs are suppressed.
5. `data/support_collection_health.json` reports the additional official source statuses, last check, latest success, and extraction diagnostics. This is not a substitute for verifying KAMS/ARKO/KCDF/KOCCA workflow logs.
6. GitHub Pages loads the stored JSON on page open. It does **not** call institution APIs at the instant a visitor visits.
7. The 73 entries in `data/support_ledger_reference.json` are from the user's HTML reference (2026-10-14). These are historical/forecast data and **never** considered live-verified notices.

## Official sources
Original: KAMS, ARKO, KCDF, KOCCA.
Additional collectors: Seoul Culture Foundation (SCAS), Gyeonggi Cultural Foundation (GGCF), Incheon Foundation for Arts and Culture (IFAC), Busan Cultural Foundation (BSCF), Seoul Metropolitan Government (mediahub.seoul.go.kr).
An adapter is **operational** only if the latest health record says `ok` or `partial` with a positive `verified` count. A configured source that fails parsing is *not* operational. Check the latest workflow and health report after every markup change. No API key is required for the HTML collectors.

## Source integrity & timing
- `startDate`, `deadline`, `statusBasis`, `collectionVerifiedAt`, `verificationStatus`, `sourceDetailVerified` are data facts, not guarantees of registration.
- "기간상 접수 가능" means the published application window *appears* active, **not** that the portal accepts applications now.
- A missing deadline yields "접수기간 확인". A failed source yields a caution state; previously fetched records are retained with `verificationStatus` indicating stale/unavailable source.
- Do not use the execution/project period as the application deadline.
- Applicant eligibility, location restrictions, institution accreditation, business history, documentation, and consortium rules require reviewing the original notice. `companyEligible` and AXOO fit score are only automated hints.
- Reference "예상 일정" is never promoted to a confirmed notice solely based on last year's schedule.

## Operations / tests
- The workflow runs `node scripts/test_support_program_intelligence.js`, `node scripts/test_regional_support.js`, both collectors, and the builder. Changes to the annual-ledger UI are checked by `.github/workflows/verify-support-ledger.yml`.
- New/changed official sites: change a single source adapter, add a regression fixture, commit, and check the GitHub Actions result and the actual `data/support_collection_health.json`.
- Do not delete all previous records on an HTTP failure. Do not count unrelated navigation, selection results, recruitment, or bidding notices as active support grants.
- If a source remains broken, prioritize official API/RSS feeds when documented and available. Do not invent undocumented API endpoints or imply full nationwide coverage.

## Current scope limit
The source network covers nine named portals. Full coverage of every municipal and private grant-making institution is a separate expansion. GitHub Action execution is scheduled near-real-time, **not push/stream real-time**.
