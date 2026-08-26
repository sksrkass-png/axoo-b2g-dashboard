name: Collect Art Commissions

on:
  workflow_dispatch:

  schedule:
    # GitHub Actions cron은 UTC 기준.
    # 00:00 UTC = 한국시간 오전 09:00
    - cron: "0 0 * * *"


permissions:
  contents: write


concurrency:
  group: collect-art-commissions
  cancel-in-progress: false


jobs:

  collect:

    runs-on: ubuntu-latest


    steps:

      # --------------------------------------------------
      # 1. Repository
      # --------------------------------------------------

      - name: Checkout repository
        uses: actions/checkout@v4


      # --------------------------------------------------
      # 2. Node
      # --------------------------------------------------

      - name: Setup Node.js
        uses: actions/setup-node@v4

        with:
          node-version: "20"


      # --------------------------------------------------
      # 3. 경기 + 서울 + 인천
      #
      # 각 지역:
      # 최대 3회 재시도
      #
      # 한 지역이 실패해도
      # 다른 지역은 계속 실행
      # --------------------------------------------------

      - name: Collect regional art commissions
        run: node scripts/run_art_collectors.js


      # --------------------------------------------------
      # 4. 원문 날짜 검증
      # --------------------------------------------------

      - name: Normalize collected dates
        run: node scripts/normalize_art_dates.js


      # --------------------------------------------------
      # 5. 마감 공고 LIVE 제거
      #
      # collect_art_commissions.js의
      # --prune-expired 모드는
      # source와 관계없이
      # isExpired=true 데이터를 제거한다.
      # --------------------------------------------------

      - name: Remove expired items from live feed
        run: node scripts/collect_art_commissions.js --prune-expired


      # --------------------------------------------------
      # 6. Archive current flag 재계산
      # --------------------------------------------------

      - name: Refresh archive current flags
        run: node scripts/normalize_art_dates.js


      # --------------------------------------------------
      # 7. 변경 여부 확인
      # --------------------------------------------------

      - name: Check changes
        id: changes
        shell: bash

        run: |

          if git diff --quiet -- \
            data/art_commissions.json \
            data/art_commissions_archive.json; then

            echo "changed=false" >> "$GITHUB_OUTPUT"

          else

            echo "changed=true" >> "$GITHUB_OUTPUT"

          fi


      # --------------------------------------------------
      # 8. 변경된 경우만 Commit
      # --------------------------------------------------

      - name: Commit collected art commissions
        if: steps.changes.outputs.changed == 'true'
        shell: bash

        run: |

          git config user.name \
            "github-actions[bot]"

          git config user.email \
            "41898282+github-actions[bot]@users.noreply.github.com"


          git add \
            data/art_commissions.json \
            data/art_commissions_archive.json


          git commit \
            -m "Collect current art commissions"


          git push
