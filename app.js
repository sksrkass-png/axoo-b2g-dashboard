function getArtPeriodText(item) {
  const start = String(item.periodStart || "").trim();
  const end = String(item.periodEnd || "").trim();

  if (start && end) {
    return start === end
      ? start
      : `${start} ~ ${end}`;
  }

  return start || end || "확인 필요";
}


function getArtDateConfidenceText(item) {
  const confidence = String(
    item.dateConfidence || ""
  ).toUpperCase();

  if (confidence === "HIGH") {
    return "● 확인됨";
  }

  if (confidence === "MEDIUM") {
    return "● 부분 확인";
  }

  return "● 확인 필요";
}


function createArtCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  const keywords = Array.isArray(item.keywords)
    ? item.keywords
    : [];

  const sourceUrl = safeUrl(item.sourceUrl);

  const reviewKey = getArtReviewKey(item);

  const effectiveDeadline =
    item.deadline ||
    item.periodEnd ||
    "";

  const deadlineInfo = getDDay(
    effectiveDeadline
  );

  const periodText = getArtPeriodText(
    item
  );

  const confidenceText =
    getArtDateConfidenceText(item);

  const actionText =
    item.nextAction ||
    item.recommendedAction ||
    "공고 원문 확인 후 접수 기간, 설치 조건, 작품 규모, 제출 서류 검토";


  card.innerHTML = `
    <div class="card-top">

      <div class="badges">

        <span class="badge category">
          ${escapeHtml(
            safeText(
              getArtSourceLabel(item)
            )
          )}
        </span>

        <span class="badge category">
          ${escapeHtml(
            safeText(
              item.category ||
              "건축물 미술작품"
            )
          )}
        </span>

        <span class="badge category">
          ${escapeHtml(
            safeText(
              item.status ||
              "공모"
            )
          )}
        </span>

      </div>


      <div class="score-group">

        <div class="deadline-badge ${deadlineInfo.className}">
          ${escapeHtml(
            deadlineInfo.label
          )}
        </div>

        <div class="score">
          ${escapeHtml(
            safeText(item.region)
          )}
        </div>

      </div>

    </div>


    <h2>
      ${escapeHtml(
        safeText(item.title)
      )}
    </h2>


    <div class="meta">

      <div>
        <span>기관</span>
        ${escapeHtml(
          safeText(item.agency)
        )}
      </div>

      <div>
        <span>지역</span>
        ${escapeHtml(
          safeText(item.region)
        )}
      </div>


      <div>
        <span>공고일</span>
        ${escapeHtml(
          safeText(
            item.publishedDate
          )
        )}
      </div>


      <div>
        <span>공모기간</span>
        ${escapeHtml(
          periodText
        )}
      </div>


      <div>
        <span>마감일</span>
        ${escapeHtml(
          safeText(
            effectiveDeadline
          )
        )}
      </div>


      <div>
        <span>날짜 확인</span>
        ${escapeHtml(
          confidenceText
        )}
      </div>


      <div>
        <span>예산</span>
        공고문 참조
      </div>


      <div>
        <span>확인 방식</span>
        공고문/첨부파일 확인
      </div>

    </div>


    <div class="keywords">

      ${keywords
        .map(
          keyword => `
            <span class="keyword">
              ${escapeHtml(keyword)}
            </span>
          `
        )
        .join("")}

    </div>


    <div class="reason">
      공고일·공모기간·마감일을
      공고 원문 기준으로 자동 검증합니다.
      날짜가 명확하지 않은 경우에는
      추정값 대신 확인 필요 상태로 유지합니다.
    </div>


    <p class="action">
      추천 액션:
      ${escapeHtml(
        safeText(actionText)
      )}
    </p>


    ${createReviewControl(
      reviewKey
    )}


    ${
      sourceUrl
        ? `
          <a
            class="link"
            href="${sourceUrl}"
            target="_blank"
            rel="noopener noreferrer"
          >
            공고문 보기
          </a>
        `
        : ""
    }

  `;

  return card;
}
