import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path


# =========================================================
# AXOO B2G
# ART NOTICE STRUCTURED ANALYZER v3
#
# INPUT
# data/art_notice_text/<RESEARCH_ID>.json
#
# OUTPUT
# data/art_notice_analysis/<RESEARCH_ID>.json
#
# No AI / No external API
# Rule-based deterministic parser
#
# v3 goals
# - 공고문 전체를 기준으로 12개 실무 검토 필드 추출
# - 문서 양식/개인정보 본문/서약서 boilerplate 오검출 억제
# - 접수일자·시간, 결과발표, 이메일 접수 등 표현 변형 대응
# - 작품수/작품비 표 오독 방지
# - 제출서류는 실제 제출 패키지와 서식명 중심으로 정리
# =========================================================


INPUT_DIR = Path(
    "data/art_notice_text"
)

OUTPUT_DIR = Path(
    "data/art_notice_analysis"
)


RESEARCH_ID = (
    os.environ
    .get(
        "ART_NOTICE_ID",
        ""
    )
    .strip()
)


FIELD_KEYS = [
    "eligibility",
    "artBudget",
    "artworkCount",
    "installationDate",
    "installationConditions",
    "artworkScale",
    "applicationPeriod",
    "judgingAnnouncement",
    "submissionDocuments",
    "submissionMethod",
    "judgingCriteria",
    "cautions"
]


# ---------------------------------------------------------
# TEXT HELPERS
# ---------------------------------------------------------

def normalize_space(
    text
):

    text = str(
        text or ""
    )

    text = text.replace(
        "\r\n",
        "\n"
    )

    text = text.replace(
        "\r",
        "\n"
    )

    text = text.replace(
        "\u00a0",
        " "
    )

    text = re.sub(
        r"[ \t]+",
        " ",
        text
    )

    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text
    )

    return text.strip()


def looks_like_garbage(
    line
):

    line = str(
        line or ""
    ).strip()

    if not line:
        return False

    # Legacy HWP parser 제어문자성 문자열
    if re.fullmatch(
        r"[A-Za-z捤獥汤捯氠瑢漠杳\s]+",
        line
    ):

        korean = re.findall(
            r"[가-힣]",
            line
        )

        if not korean:
            return True

    return False


def clean_text(
    text
):

    text = normalize_space(
        text
    )

    lines = []

    for raw_line in text.split(
        "\n"
    ):

        line = raw_line.strip()

        if not line:
            continue

        if looks_like_garbage(
            line
        ):
            continue

        lines.append(
            line
        )

    return "\n".join(
        lines
    )


def unique_lines(
    text
):

    seen = set()
    result = []

    for line in text.split(
        "\n"
    ):

        line = line.strip()

        if not line:
            continue

        key = re.sub(
            r"\s+",
            " ",
            line
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        result.append(
            line
        )

    return result


def compact_value(
    text
):

    text = normalize_space(
        text
    )

    text = text.replace(
        "\n",
        " "
    )

    return re.sub(
        r"\s+",
        " ",
        text
    ).strip()


def dedupe(
    values
):

    result = []
    seen = set()

    for value in values:

        value = compact_value(
            value
        )

        if not value:
            continue

        key = re.sub(
            r"\s+",
            "",
            value
        ).lower()

        if key in seen:
            continue

        seen.add(
            key
        )

        result.append(
            value
        )

    return result


def clean_bullet(
    line
):

    line = compact_value(
        line
    )

    line = re.sub(
        r"^[\s○◦●•▪■□◆◇⚫▶>※\-–—]+",
        "",
        line
    )

    return line.strip()


def looks_like_heading(
    line
):

    line = compact_value(
        line
    )

    if not line:
        return False

    if len(line) > 70:
        return False

    patterns = [
        r"^○\s*",
        r"^\d+\s*[.)]\s*",
        r"^[가-힣A-Za-z0-9 ()/·]+\s*[:：]\s*$"
    ]

    return any(
        re.match(
            pattern,
            line
        )
        for pattern
        in patterns
    )


def is_boilerplate_line(
    line
):

    compact = re.sub(
        r"\s+",
        "",
        str(
            line or ""
        )
    )

    if not compact:
        return True

    patterns = [
        r"개인정보수집및이용에동의함",
        r"동의하지않음",
        r"개인정보보호법제?15조",
        r"개인정보보호법제?16조",
        r"개인정보보호법제?22조",
        r"귀하는귀하의판단에따라",
        r"수집하려는개인정보항목",
        r"개인정보보유및이용기간",
        r"정보주체성명",
        r"생년월일:",
        r"성명:",
        r"신청인:",
        r"서약합니다",
        r"이의를제기하지않"
    ]

    return any(
        re.search(
            pattern,
            compact
        )
        for pattern
        in patterns
    )


# ---------------------------------------------------------
# EVIDENCE HELPERS
# ---------------------------------------------------------

def find_matching_lines(
    lines,
    keywords,
    limit=8
):

    matches = []

    for line in lines:

        normalized = (
            line.lower()
        )

        if any(
            keyword.lower()
            in normalized
            for keyword
            in keywords
        ):

            if line not in matches:
                matches.append(
                    line
                )

        if (
            len(matches)
            >= limit
        ):
            break

    return matches


def find_context(
    lines,
    keywords,
    before=0,
    after=2,
    limit=5
):

    results = []

    for index, line in enumerate(
        lines
    ):

        normalized = (
            line.lower()
        )

        if not any(
            keyword.lower()
            in normalized
            for keyword
            in keywords
        ):
            continue

        start = max(
            0,
            index - before
        )

        end = min(
            len(lines),
            index + after + 1
        )

        snippet = " / ".join(
            lines[
                start:end
            ]
        )

        if snippet not in results:
            results.append(
                snippet
            )

        if (
            len(results)
            >= limit
        ):
            break

    return results


def capture_after_heading(
    lines,
    heading_keywords,
    max_lines=8
):

    for index, line in enumerate(
        lines
    ):

        compact = compact_value(
            line
        )

        if not any(
            keyword in compact
            for keyword
            in heading_keywords
        ):
            continue

        result = []

        for candidate in lines[
            index + 1:
            min(
                len(lines),
                index + 1 + max_lines
            )
        ]:

            candidate = candidate.strip()

            if not candidate:
                continue

            # 다음 큰 섹션 시작
            if (
                candidate.startswith(
                    "○"
                )
                and result
            ):
                break

            result.append(
                candidate
            )

        return result

    return []


def field_result(
    value="",
    evidence=None
):

    evidence = dedupe(
        evidence or []
    )

    value = compact_value(
        value
    )

    status = (
        "found"
        if value
        else "not_found"
    )

    return {
        "status":
            status,

        "value":
            value,

        "evidence":
            evidence[:20]
    }


# ---------------------------------------------------------
# DATE HELPERS
# ---------------------------------------------------------

def normalize_korean_datetime(
    year,
    month,
    day,
    hour=None,
    minute=None
):

    value = (
        f"{int(year):04d}-"
        f"{int(month):02d}-"
        f"{int(day):02d}"
    )

    if hour is not None:

        value += (
            f" {int(hour):02d}:"
            f"{int(minute or 0):02d}"
        )

    return value


def find_date_range(
    text
):

    pattern = re.compile(
        r"(20\d{2})\s*[.\-/년]\s*"
        r"(\d{1,2})\s*[.\-/월]\s*"
        r"(\d{1,2})\s*(?:일)?"
        r"(?:\s*\([^)]*\))?"
        r"\s*[~～∼\-]\s*"
        r"(?:(20\d{2})\s*[.\-/년]\s*)?"
        r"(?:(\d{1,2})\s*[.\-/월]\s*)?"
        r"(\d{1,2})\s*(?:일)?"
    )

    match = pattern.search(
        text
    )

    if not match:
        return None

    start_year = match.group(1)
    start_month = match.group(2)
    start_day = match.group(3)

    end_year = (
        match.group(4)
        or start_year
    )

    end_month = (
        match.group(5)
        or start_month
    )

    end_day = match.group(6)

    return (
        normalize_korean_datetime(
            start_year,
            start_month,
            start_day
        ),
        normalize_korean_datetime(
            end_year,
            end_month,
            end_day
        )
    )


def find_single_date_time(
    text
):

    pattern = re.compile(
        r"(20\d{2})\s*[.\-/년]\s*"
        r"(\d{1,2})\s*[.\-/월]\s*"
        r"(\d{1,2})\s*(?:일|\.)?"
        r"(?:\s*\([^)]*\))?"
        r"(?:\s*(\d{1,2})\s*(?:시|:)"
        r"\s*(\d{1,2})?\s*(?:분)?)?"
    )

    match = pattern.search(
        text
    )

    if not match:
        return None

    return normalize_korean_datetime(
        match.group(1),
        match.group(2),
        match.group(3),
        match.group(4),
        match.group(5)
    )


# ---------------------------------------------------------
# COMMON EXTRACTORS
# ---------------------------------------------------------

def extract_artwork_count_number(
    text,
    lines
):

    # 1) 의미가 가장 명확한 공모 대상 문구
    explicit_patterns = [
        r"공모\s*대상\s*[:：]?"
        r"[^\n]{0,100}?"
        r"총\s*(\d+)\s*점",

        r"(?:조각|미술)\s*작품"
        r"[^\n]{0,60}?"
        r"총\s*(\d+)\s*점",

        r"설치\s*작품\s*수\s*[:：]?"
        r"\s*(\d+)\s*점"
    ]

    for pattern in explicit_patterns:

        match = re.search(
            pattern,
            text,
            re.I
        )

        if match:

            number = int(
                match.group(1)
            )

            if (
                1 <= number <= 100
            ):
                return number

    # 2) HWP 표 구조
    for index, line in enumerate(
        lines
    ):

        if line.strip() not in [
            "작품수",
            "작품 수"
        ]:
            continue

        search_end = min(
            len(lines),
            index + 10
        )

        for candidate in lines[
            index + 1:
            search_end
        ]:

            candidate = (
                candidate.strip()
            )

            if re.fullmatch(
                r"\d+",
                candidate
            ):

                number = int(
                    candidate
                )

                if (
                    1 <= number <= 100
                ):
                    return number

    return None


# ---------------------------------------------------------
# 참가자격
# ---------------------------------------------------------

def extract_eligibility(
    text,
    lines
):

    evidence = find_context(
        lines,
        [
            "응모자격",
            "참가자격",
            "응모 자격",
            "참가 자격"
        ],
        after=6,
        limit=4
    )

    section = capture_after_heading(
        lines,
        [
            "응모자격",
            "참가자격",
            "응모 자격",
            "참가 자격"
        ],
        max_lines=7
    )

    values = []

    source_lines = (
        section
        if section
        else lines
    )

    for line in source_lines:

        clean = clean_bullet(
            line
        )

        if any(
            keyword in clean
            for keyword in [
                "만 ",
                "대한민국 국적",
                "응모 가능",
                "응모가능",
                "응모 불가",
                "응모불가",
                "참가 불가",
                "참가불가",
                "단독 응모",
                "공동 응모",
                "개 작품",
                "개인",
                "법인"
            ]
        ):

            if not is_boilerplate_line(
                clean
            ):
                values.append(
                    clean
                )

    return field_result(
        " / ".join(
            dedupe(
                values
            )
        ),
        evidence
    )


# ---------------------------------------------------------
# 작품비
# ---------------------------------------------------------

def extract_budget(
    text,
    lines
):

    evidence = find_context(
        lines,
        [
            "설치 금액",
            "설치비",
            "작품비",
            "사업비",
            "합계",
            "작가창작비",
            "공과금"
        ],
        before=1,
        after=5,
        limit=8
    )

    value_parts = []
    amount_won = None

    # 1) 가장 신뢰도 높은 "설치 금액: 총 N원"
    direct_won_patterns = [
        r"(?:작품\s*)?설치\s*금액"
        r"\s*[:：]?\s*(?:총\s*)?"
        r"([\d,]+)\s*원",

        r"(?:작품비|미술작품비)"
        r"\s*[:：]?\s*(?:총\s*)?"
        r"([\d,]+)\s*원"
    ]

    for pattern in direct_won_patterns:

        match = re.search(
            pattern,
            text,
            re.I
        )

        if not match:
            continue

        candidate = int(
            match.group(1)
            .replace(
                ",",
                ""
            )
        )

        if candidate >= 1000000:
            amount_won = candidate
            break

    # 2) 천원 단위 직접 표기
    if amount_won is None:

        thousand_patterns = [
            r"(?:작품당|각)\s*"
            r"([\d,]+)\s*천원",

            r"(?:설치\s*금액|작품비|합계)"
            r"[^\n]{0,80}?"
            r"([\d,]+)\s*천원"
        ]

        for pattern in thousand_patterns:

            match = re.search(
                pattern,
                text,
                re.I
            )

            if not match:
                continue

            candidate = int(
                match.group(1)
                .replace(
                    ",",
                    ""
                )
            )

            if (
                1000 <=
                candidate <=
                10000000
            ):

                amount_won = (
                    candidate *
                    1000
                )
                break

    # 3) 표 안에 단위가 따로 있고 값만 존재하는 경우
    if amount_won is None:

        table_has_thousand_unit = any(
            "(천원)" in line
            or "단위: 천원" in line
            or "단위 : 천원" in line
            for line in lines
        )

        if table_has_thousand_unit:

            for line in lines:

                match = re.search(
                    r"(?:합계|각)?\s*"
                    r"([\d,]{4,})\s*"
                    r"(?:천원)?$",
                    line
                )

                if not match:
                    continue

                candidate = int(
                    match.group(1)
                    .replace(
                        ",",
                        ""
                    )
                )

                if (
                    1000 <=
                    candidate <=
                    10000000
                ):

                    amount_won = (
                        candidate *
                        1000
                    )
                    break

    if amount_won is not None:

        value_parts.append(
            f"설치 금액 {amount_won:,}원"
        )

    if (
        "제세공과금" in text
        and (
            "비용 일체" in text
            or "경비" in text
        )
    ):

        value_parts.append(
            "제세공과금 및 제작·설치 비용 일체 포함"
        )

    artist_fee = re.search(
        r"작가창작비"
        r"[\s\S]{0,100}?"
        r"(\d{1,3})\s*%\s*이내",
        text
    )

    if artist_fee:

        value_parts.append(
            "작가창작비 "
            f"{artist_fee.group(1)}% 이내"
        )

    return field_result(
        " / ".join(
            dedupe(
                value_parts
            )
        ),
        evidence
    )


# ---------------------------------------------------------
# 작품 수
# ---------------------------------------------------------

def extract_artwork_count(
    text,
    lines
):

    count = (
        extract_artwork_count_number(
            text,
            lines
        )
    )

    evidence = find_context(
        lines,
        [
            "공모 대상",
            "작품수",
            "작품 수"
        ],
        after=3,
        limit=5
    )

    value = (
        f"{count}점"
        if count
        else ""
    )

    return field_result(
        value,
        evidence
    )


# ---------------------------------------------------------
# 설치 예정일
# ---------------------------------------------------------

def extract_installation_date(
    text,
    lines
):

    evidence = find_context(
        lines,
        [
            "미술작품 설치 예정",
            "설치 예정 기한",
            "설치예정일",
            "설치 예정일",
            "사용승인 예정"
        ],
        after=2,
        limit=5
    )

    patterns = [
        r"미술작품\s*설치\s*예정"
        r"(?:\s*기한|\s*일)?"
        r"\s*[:：]?\s*"
        r"(20\d{2})\s*년\s*"
        r"0?(\d{1,2})\s*월",

        r"설치\s*예정\s*(?:기한|일)?"
        r"\s*[:：]?\s*"
        r"(20\d{2})\s*년\s*"
        r"0?(\d{1,2})\s*월"
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            re.I
        )

        if match:

            return field_result(
                (
                    f"{match.group(1)}년 "
                    f"{int(match.group(2))}월"
                ),
                evidence
            )

    return field_result(
        "",
        evidence
    )


# ---------------------------------------------------------
# 설치 조건
# ---------------------------------------------------------

def extract_installation_conditions(
    text,
    lines
):

    evidence = find_matching_lines(
        lines,
        [
            "설치 위치",
            "설치위치",
            "수경시설",
            "잔디구역",
            "설치규모",
            "구조적 안정",
            "구조적안정",
            "공사 진행 상황",
            "허용하중"
        ],
        limit=14
    )

    values = []

    for line in evidence:

        clean = clean_bullet(
            line
        )

        if (
            len(clean) < 5
            or clean in [
                "미술작품 설치위치",
                "미술작품 설치위치(세부)"
            ]
        ):
            continue

        if any(
            keyword in clean
            for keyword in [
                "설치 위치",
                "설치위치",
                "수경시설",
                "잔디구역",
                "설치규모",
                "구조적 안정",
                "구조적안정",
                "공사 진행 상황",
                "허용하중"
            ]
        ):

            values.append(
                clean
            )

    return field_result(
        " / ".join(
            dedupe(
                values
            )[:8]
        ),
        evidence
    )


# ---------------------------------------------------------
# 작품 규모 / 하중
# ---------------------------------------------------------

def extract_artwork_scale(
    text,
    lines
):

    evidence = find_matching_lines(
        lines,
        [
            "작품 크기",
            "가로×세로×높이",
            "가로 x 세로 x 높이",
            "허용하중",
            "총중량",
            "단위중량",
            "㎡당 하중",
            "설치규모"
        ],
        limit=12
    )

    value_parts = []

    # 실제 수치 치수
    dimension_patterns = [
        r"(\d+(?:\.\d+)?)\s*(m|cm|mm)"
        r"\s*[×xX*]\s*"
        r"(\d+(?:\.\d+)?)\s*(m|cm|mm)"
        r"(?:\s*[×xX*]\s*"
        r"(\d+(?:\.\d+)?)\s*(m|cm|mm))?"
    ]

    for pattern in dimension_patterns:

        match = re.search(
            pattern,
            text,
            re.I
        )

        if match:

            value_parts.append(
                "작품 치수 "
                + compact_value(
                    match.group(0)
                )
            )
            break

    # 하중 수치
    load_patterns = [
        r"허용하중"
        r"[^\n]{0,50}?"
        r"([\d.]+)\s*톤"
        r"\s*/?\s*m[²2]",

        r"([\d.]+)\s*톤"
        r"\s*/?\s*m[²2]"
    ]

    for pattern in load_patterns:

        match = re.search(
            pattern,
            text,
            re.I
        )

        if match:

            value_parts.append(
                "허용하중 "
                f"{match.group(1)}톤/㎡"
            )
            break

    # 수치가 없더라도 실제 제약 문장은 의미 있음
    for line in lines:

        clean = clean_bullet(
            line
        )

        compact = re.sub(
            r"\s+",
            "",
            clean
        )

        if (
            "설치규모" in compact
            and "현장설명서" in compact
            and "적합" in compact
        ):

            value_parts.append(
                clean
            )

        if (
            "총중량" in compact
            and (
                "단위중량" in compact
                or "㎡당하중" in compact
            )
            and (
                "표기" in compact
                or "기재" in compact
            )
        ):

            value_parts.append(
                "작품도판·작품설명서에 "
                "총중량 및 단위중량 표기"
            )

    # 단순 "(가로×세로×높이, m단위)" 양식 라벨만으로는
    # found 처리하지 않는다.
    return field_result(
        " / ".join(
            dedupe(
                value_parts
            )[:6]
        ),
        evidence
    )


# ---------------------------------------------------------
# 접수 기간
# ---------------------------------------------------------

def extract_application_period(
    text,
    lines
):

    evidence = find_context(
        lines,
        [
            "접수일시",
            "접수기간",
            "접수 기간",
            "작품접수",
            "작품 접수",
            "일자/시간",
            "일자 / 시간",
            "마감시간"
        ],
        before=1,
        after=3,
        limit=8
    )

    # 1) 명시적 접수기간 / 작품접수 + 날짜 범위
    for snippet in evidence:

        date_range = find_date_range(
            snippet
        )

        if date_range:

            value = (
                f"{date_range[0]}"
                " ~ "
                f"{date_range[1]}"
            )

            # 마지막 시각이 있으면 추가
            time_match = re.search(
                r"(\d{1,2})\s*"
                r"(?:시|:)\s*"
                r"(\d{1,2})?\s*"
                r"(?:분)?"
                r"\s*(?:까지|마감)?",
                snippet
            )

            if time_match:

                value += (
                    " "
                    f"{int(time_match.group(1)):02d}:"
                    f"{int(time_match.group(2) or 0):02d}"
                    "까지"
                )

            return field_result(
                value,
                evidence
            )

    # 2) "작품제출" 다음에
    #    - 일자/시간: 2026.09.21 16시까지
    for index, line in enumerate(
        lines
    ):

        if (
            "작품제출" not in line
            and "작품 제출" not in line
        ):
            continue

        nearby = " / ".join(
            lines[
                index:
                min(
                    len(lines),
                    index + 8
                )
            ]
        )

        match = re.search(
            r"(?:일자\s*/?\s*시간|"
            r"접수\s*일시|"
            r"제출\s*일시)"
            r"\s*[:：]?\s*"
            r"(20\d{2})\s*[.\-/년]\s*"
            r"(\d{1,2})\s*[.\-/월]\s*"
            r"(\d{1,2})\s*(?:일|\.)?"
            r"(?:\s*\([^)]*\))?"
            r"\s*(\d{1,2})\s*(?:시|:)"
            r"\s*(\d{1,2})?\s*(?:분)?"
            r"\s*(?:까지|마감)?",
            nearby,
            re.I
        )

        if match:

            value = normalize_korean_datetime(
                match.group(1),
                match.group(2),
                match.group(3),
                match.group(4),
                match.group(5)
            )

            if (
                "까지" in match.group(0)
                or "마감" in nearby
            ):
                value += "까지"

            if nearby not in evidence:
                evidence.append(
                    nearby
                )

            return field_result(
                value,
                evidence
            )

    # 3) 전체 문서의 "일자/시간" fallback
    match = re.search(
        r"일자\s*/?\s*시간"
        r"\s*[:：]?\s*"
        r"(20\d{2})\s*[.\-/년]\s*"
        r"(\d{1,2})\s*[.\-/월]\s*"
        r"(\d{1,2})\s*(?:일|\.)?"
        r"(?:\s*\([^)]*\))?"
        r"\s*(\d{1,2})\s*(?:시|:)"
        r"\s*(\d{1,2})?\s*(?:분)?",
        text,
        re.I
    )

    if match:

        return field_result(
            normalize_korean_datetime(
                match.group(1),
                match.group(2),
                match.group(3),
                match.group(4),
                match.group(5)
            ) + "까지",
            evidence
        )

    return field_result(
        "",
        evidence
    )


# ---------------------------------------------------------
# 심사 발표
# ---------------------------------------------------------

def extract_judging_announcement(
    text,
    lines
):

    evidence = find_context(
        lines,
        [
            "작품선정 결과 발표",
            "선정 결과 발표",
            "심사 발표",
            "심사발표",
            "당선작",
            "당선자"
        ],
        after=2,
        limit=6
    )

    patterns = [
        r"작품선정\s*결과\s*발표"
        r"\s*[:：]?\s*([^\n]{1,180})",

        r"선정\s*결과\s*발표"
        r"\s*[:：]?\s*([^\n]{1,180})",

        r"심사\s*발표"
        r"(?:일)?\s*[:：]?\s*"
        r"([^\n]{1,180})"
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            re.I
        )

        if not match:
            continue

        value = clean_bullet(
            match.group(1)
        )

        if value:
            return field_result(
                value,
                evidence
            )

    return field_result(
        "",
        evidence
    )


# ---------------------------------------------------------
# 제출 서류
# ---------------------------------------------------------

def extract_submission_documents(
    text,
    lines
):

    evidence = find_context(
        lines,
        [
            "제출 서류",
            "제출서류",
            "응모작품의 제출물",
            "도판이미지 JPG",
            "도판 이미지 jpg",
            "응모서류일체",
            "응모서류 일체"
        ],
        after=10,
        limit=8
    )

    items = []

    # 1) 제출 파일 패키지
    for line in lines:

        compact = compact_value(
            line
        )

        if re.search(
            r"도판\s*이미지\s*JPG",
            compact,
            re.I
        ):

            if (
                "제출물은" in compact
                and "응모서류" in compact
            ):
                # 요약 문장 자체 대신 아래 개별 항목 사용
                continue

            if (
                re.search(
                    r"(?:①|1[.)])?\s*"
                    r"도판\s*이미지\s*JPG",
                    compact,
                    re.I
                )
            ):

                cleaned = clean_bullet(
                    re.sub(
                        r"^[①1.)\s]+",
                        "",
                        compact
                    )
                )

                items.append(
                    cleaned
                )

        if re.search(
            r"응모서류\s*일체",
            compact,
            re.I
        ):

            if (
                "제출물은" in compact
                and "도판" in compact
            ):
                continue

            if (
                "PDF" in compact.upper()
                or "서식" in compact
            ):

                cleaned = clean_bullet(
                    re.sub(
                        r"^[②2.)\s]+",
                        "",
                        compact
                    )
                )

                items.append(
                    cleaned
                )

    # 2) 실제 서식 제목
    # "[서식 1]~[서식 6]" 범위 표기는 제외하고,
    # "[서식 1] 응모 신청서" 같은 제목만 수집.
    form_pattern = re.compile(
        r"^[【\[]\s*서식\s*(\d+)"
        r"\s*[】\]]\s*(.+)$"
    )

    forms = {}

    for line in lines:

        match = form_pattern.match(
            compact_value(
                line
            )
        )

        if not match:
            continue

        number = int(
            match.group(1)
        )

        name = clean_bullet(
            match.group(2)
        )

        if not name:
            continue

        if (
            name.startswith(
                "~"
            )
            or "[서식" in name
            or "【서식" in name
        ):
            continue

        if (
            len(name) > 80
            or is_boilerplate_line(
                name
            )
        ):
            continue

        if (
            1 <= number <= 20
            and number not in forms
        ):

            forms[number] = name

    for number in sorted(
        forms
    ):

        items.append(
            f"서식 {number} · "
            f"{forms[number]}"
        )

    # 3) 실제 제출 제약 중 핵심
    for line in lines:

        compact = re.sub(
            r"\s+",
            "",
            line
        )

        if (
            "작품도판" in compact
            and "작품설명서" in compact
            and "총중량" in compact
            and (
                "단위중량" in compact
                or "㎡당하중" in compact
            )
        ):

            items.append(
                "작품도판·작품설명서에 "
                "총중량 및 단위중량 표기"
            )

    return field_result(
        " / ".join(
            dedupe(
                items
            )[:14]
        ),
        evidence
    )


# ---------------------------------------------------------
# 접수 방식
# ---------------------------------------------------------

def extract_submission_method(
    text,
    lines
):

    evidence = find_context(
        lines,
        [
            "제출 방법",
            "제출방법",
            "이메일 제출",
            "이메일 접수",
            "메일 주소",
            "우편",
            "택배",
            "방문 접수"
        ],
        after=3,
        limit=8
    )

    value_parts = []

    method_match = re.search(
        r"제출\s*방법"
        r"\s*[:：]?\s*"
        r"([^\n]{1,180})",
        text,
        re.I
    )

    if method_match:

        method_text = clean_bullet(
            method_match.group(1)
        )

        if (
            "이메일" in method_text
        ):

            value_parts.append(
                "이메일 제출"
            )

        elif method_text:

            value_parts.append(
                method_text
            )

        if (
            "우편" in method_text
            and "불가" in method_text
        ):

            value_parts.append(
                "우편·택배·방문 접수 불가"
            )

    email_match = re.search(
        r"(?:메일|이메일)\s*주소"
        r"\s*[:：]?\s*"
        r"([\w.+\-]+@[\w.\-]+\.\w+)",
        text,
        re.I
    )

    if email_match:

        value_parts.append(
            email_match.group(1)
        )

    if (
        not value_parts
        and "이메일" in text
    ):

        contextual_email = re.search(
            r"(?:작품\s*제출|제출\s*방법)"
            r"[\s\S]{0,220}?"
            r"([\w.+\-]+@[\w.\-]+\.\w+)",
            text,
            re.I
        )

        if contextual_email:

            value_parts.append(
                "이메일 제출"
            )

            value_parts.append(
                contextual_email.group(1)
            )

    return field_result(
        " / ".join(
            dedupe(
                value_parts
            )
        ),
        evidence
    )


# ---------------------------------------------------------
# 심사기준
# ---------------------------------------------------------

def is_section_heading(
    line,
    keywords
):

    line = str(
        line or ""
    ).strip()

    if not line:
        return False

    if len(line) > 50:
        return False

    cleaned = re.sub(
        r"^[\s◆■□●○◦\-※]+",
        "",
        line
    )

    cleaned = re.sub(
        r"^\d+\s*[.)]\s*",
        "",
        cleaned
    )

    cleaned = cleaned.strip()

    for keyword in keywords:

        if cleaned == keyword:
            return True

        if cleaned.startswith(
            keyword + " "
        ):
            return True

        if cleaned.startswith(
            keyword + ":"
        ):
            return True

        if cleaned.startswith(
            keyword + "："
        ):
            return True

    return False


def capture_section(
    lines,
    start_index,
    max_lines=14
):

    result = []

    for index in range(
        start_index + 1,
        min(
            len(lines),
            start_index + 1 + max_lines
        )
    ):

        line = lines[
            index
        ].strip()

        if not line:
            continue

        if (
            re.match(
                r"^\d+\s*[.)]\s*",
                line
            )
            and result
        ):
            break

        if (
            line.startswith(
                "○"
            )
            and result
        ):
            break

        result.append(
            line
        )

    return result


def extract_judging_criteria(
    text,
    lines
):

    heading_keywords = [
        "심사기준",
        "심사 기준",
        "평가기준",
        "평가 기준",
        "심사방법",
        "심사 방법",
        "평가방법",
        "평가 방법"
    ]

    # 1) 명시적 섹션 제목만 인정
    for index, line in enumerate(
        lines
    ):

        if not is_section_heading(
            line,
            heading_keywords
        ):
            continue

        section_lines = (
            capture_section(
                lines,
                index,
                max_lines=15
            )
        )

        meaningful = []

        for item in section_lines:

            if is_boilerplate_line(
                item
            ):
                break

            compact = compact_value(
                item
            )

            # 서약서 문장 방지
            if (
                "심사위원" in compact
                and "이의를" in compact
            ):
                break

            meaningful.append(
                compact
            )

        meaningful = dedupe(
            meaningful
        )

        if meaningful:

            evidence = [
                " / ".join(
                    [
                        line,
                        *meaningful[:8]
                    ]
                )
            ]

            return field_result(
                " / ".join(
                    meaningful[:8]
                ),
                evidence
            )

    # 2) 평가항목 + 배점 표가 동시에 있을 때만 인정
    has_evaluation_header = any(
        any(
            keyword in line
            for keyword in [
                "평가항목",
                "평가 항목",
                "심사항목",
                "심사 항목"
            ]
        )
        for line in lines
    )

    has_score_header = any(
        any(
            keyword in line
            for keyword in [
                "배점",
                "점수",
                "평점"
            ]
        )
        for line in lines
    )

    if (
        has_evaluation_header
        and has_score_header
    ):

        evidence = find_context(
            lines,
            [
                "평가항목",
                "평가 항목",
                "심사항목",
                "심사 항목",
                "배점"
            ],
            after=10,
            limit=5
        )

        values = []

        for snippet in evidence:

            for part in snippet.split(
                " / "
            ):

                if (
                    is_boilerplate_line(
                        part
                    )
                ):
                    continue

                values.append(
                    compact_value(
                        part
                    )
                )

        values = dedupe(
            values
        )

        return field_result(
            " / ".join(
                values[:10]
            ),
            evidence
        )

    # "안전성", "예술성" 같은 단어가 다른 서식에 있다는 이유만으로
    # 심사기준 found 처리하지 않는다.
    return field_result(
        "",
        []
    )


# ---------------------------------------------------------
# 유의사항
# ---------------------------------------------------------

def extract_cautions(
    text,
    lines
):

    evidence = find_context(
        lines,
        [
            "기타 유의사항",
            "공모 유의사항",
            "유의사항",
            "접수 불가",
            "수정, 변경, 보완 불가",
            "수정·변경·보완 불가",
            "불이익"
        ],
        after=5,
        limit=10
    )

    caution_lines = []

    for line in lines:

        clean = clean_bullet(
            line
        )

        if is_boilerplate_line(
            clean
        ):
            continue

        if any(
            keyword in clean
            for keyword in [
                "접수 불가",
                "접수불가",
                "수정, 변경, 보완 불가",
                "수정·변경·보완 불가",
                "수정/변경/보완",
                "심사자료 반환 불가",
                "자체폐기",
                "불이익",
                "현장설명서 내용을 충분히 숙지",
                "연작",
                "시리즈 작품",
                "응모 불가",
                "응모불가"
            ]
        ):

            caution_lines.append(
                clean
            )

    return field_result(
        " / ".join(
            dedupe(
                caution_lines
            )[:10]
        ),
        evidence
    )


# ---------------------------------------------------------
# ANALYSIS BUILDER
# ---------------------------------------------------------

def build_analysis(
    data
):

    documents = data.get(
        "documents",
        []
    )

    cleaned_documents = []
    combined_parts = []

    for document in documents:

        raw_text = document.get(
            "text",
            ""
        )

        cleaned = clean_text(
            raw_text
        )

        if cleaned:

            combined_parts.append(
                cleaned
            )

        cleaned_documents.append({
            "name":
                document.get(
                    "name",
                    ""
                ),

            "status":
                document.get(
                    "status",
                    ""
                ),

            "textLength":
                len(
                    cleaned
                )
        })

    combined_text = "\n".join(
        combined_parts
    )

    lines = unique_lines(
        combined_text
    )

    normalized_text = "\n".join(
        lines
    )

    fields = {

        "eligibility":
            extract_eligibility(
                normalized_text,
                lines
            ),

        "artBudget":
            extract_budget(
                normalized_text,
                lines
            ),

        "artworkCount":
            extract_artwork_count(
                normalized_text,
                lines
            ),

        "installationDate":
            extract_installation_date(
                normalized_text,
                lines
            ),

        "installationConditions":
            extract_installation_conditions(
                normalized_text,
                lines
            ),

        "artworkScale":
            extract_artwork_scale(
                normalized_text,
                lines
            ),

        "applicationPeriod":
            extract_application_period(
                normalized_text,
                lines
            ),

        "judgingAnnouncement":
            extract_judging_announcement(
                normalized_text,
                lines
            ),

        "submissionDocuments":
            extract_submission_documents(
                normalized_text,
                lines
            ),

        "submissionMethod":
            extract_submission_method(
                normalized_text,
                lines
            ),

        "judgingCriteria":
            extract_judging_criteria(
                normalized_text,
                lines
            ),

        "cautions":
            extract_cautions(
                normalized_text,
                lines
            )
    }

    found_count = sum(
        1
        for field
        in fields.values()
        if field.get(
            "status"
        ) == "found"
    )

    missing_fields = [
        key
        for key, field
        in fields.items()
        if field.get(
            "status"
        ) != "found"
    ]

    return {

        "researchId":
            data.get(
                "researchId",
                ""
            ),

        "title":
            data.get(
                "title",
                ""
            ),

        "status":
            "ok",

        "analyzer":
            "axoo_art_notice_analysis_v3",

        "generatedAt":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "source":
            "art_notice_text",

        "documentCount":
            len(
                documents
            ),

        "documents":
            cleaned_documents,

        "analysisSummary": {

            "fieldCount":
                len(
                    fields
                ),

            "foundCount":
                found_count,

            "missingCount":
                (
                    len(fields)
                    - found_count
                ),

            "missingFields":
                missing_fields
        },

        "fields":
            fields
    }


# ---------------------------------------------------------
# TARGET FILES
# ---------------------------------------------------------

def get_targets():

    if RESEARCH_ID:

        target = (
            INPUT_DIR
            / f"{RESEARCH_ID}.json"
        )

        if not target.exists():

            raise SystemExit(
                "Input file not found: "
                f"{target}"
            )

        return [
            target
        ]

    return sorted(
        INPUT_DIR.glob(
            "*.json"
        )
    )


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    targets = get_targets()

    if not targets:

        raise SystemExit(
            "No art notice text files found."
        )

    print(
        "========================================"
    )

    print(
        "AXOO ART NOTICE ANALYZER v3"
    )

    print(
        "Targets:",
        len(
            targets
        )
    )

    print(
        "========================================"
    )

    success_count = 0

    for path in targets:

        print("")

        print(
            "=" * 50
        )

        print(
            "INPUT:",
            path
        )

        data = json.loads(
            path.read_text(
                encoding="utf-8"
            )
        )

        analysis = build_analysis(
            data
        )

        research_id = (
            analysis.get(
                "researchId"
            )
            or path.stem
        )

        output_path = (
            OUTPUT_DIR
            / f"{research_id}.json"
        )

        output_path.write_text(
            json.dumps(
                analysis,
                ensure_ascii=False,
                indent=2
            )
            + "\n",
            encoding="utf-8"
        )

        summary = analysis[
            "analysisSummary"
        ]

        print(
            "Research ID:",
            research_id
        )

        print(
            "Title:",
            analysis.get(
                "title"
            )
        )

        print(
            "Fields:",
            summary[
                "foundCount"
            ],
            "/",
            summary[
                "fieldCount"
            ]
        )

        print("")

        for key, field in (
            analysis[
                "fields"
            ].items()
        ):

            status = field.get(
                "status"
            )

            value = field.get(
                "value",
                ""
            )

            preview = value[:180]

            print(
                f"- {key}: "
                f"{status} | "
                f"{preview}"
            )

        if summary[
            "missingFields"
        ]:

            print("")

            print(
                "Missing:",
                ", ".join(
                    summary[
                        "missingFields"
                    ]
                )
            )

        print("")

        print(
            "Saved:",
            output_path
        )

        success_count += 1

    print("")

    print(
        "=" * 50
    )

    print(
        "Analysis complete:",
        success_count,
        "/",
        len(
            targets
        )
    )


if __name__ == "__main__":

    main()
