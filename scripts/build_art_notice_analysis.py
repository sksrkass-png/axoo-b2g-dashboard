import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path


# =========================================================
# AXOO B2G
# ART NOTICE STRUCTURED ANALYZER v2
#
# INPUT
# data/art_notice_text/<RESEARCH_ID>.json
#
# OUTPUT
# data/art_notice_analysis/<RESEARCH_ID>.json
#
# No AI / No external API
# Rule-based deterministic parser
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


    # Legacy HWP parser에서 발생하는
    # 제어문자성 문자열 제거
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

        value = str(
            value or ""
        ).strip()


        if not value:

            continue


        if value in seen:

            continue


        seen.add(
            value
        )

        result.append(
            value
        )


    return result


# ---------------------------------------------------------
# EVIDENCE HELPERS
# ---------------------------------------------------------

def find_matching_lines(
    lines,
    keywords,
    limit=6
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
    limit=4
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



def field_result(
    value="",
    evidence=None
):

    evidence = (
        evidence or []
    )

    value = compact_value(
        value
    )


    # v2:
    # 근거만 있고 실제 추출값이 없으면
    # found 처리하지 않는다.
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
            evidence
    }


# ---------------------------------------------------------
# COMMON EXTRACTORS
# ---------------------------------------------------------

def extract_artwork_count_number(
    text,
    lines
):

    # 가장 우선:
    # HWP 표 구조
    #
    # 작품수
    # 종류
    # ...
    # 각 94,000
    # 2

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
                    1 <=
                    number <=
                    100
                ):

                    return number


    patterns = [
        r"작품수[\s\S]{0,100}?(\d+)",
        r"작품\s*수[\s\S]{0,100}?(\d+)",
        r"총\s*(\d+)\s*작품",
        r"(\d+)\s*작품",
        r"(\d+)\s*점"
    ]


    for pattern in patterns:

        match = re.search(
            pattern,
            text
        )


        if match:

            try:

                number = int(
                    match.group(1)
                )


                if (
                    1 <=
                    number <=
                    100
                ):

                    return number

            except ValueError:

                pass


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
        after=4
    )


    values = []


    for snippet in evidence:

        parts = snippet.split(
            " / "
        )


        for part in parts:

            if (
                "만 " in part
                or "가능한 자" in part
                or "응모불가" in part
                or "응모 불가" in part
                or "참가불가" in part
                or "참가 불가" in part
                or "개인" in part
                or "법인" in part
            ):

                values.append(
                    part
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
            "설치비",
            "작품비",
            "사업비",
            "94,000",
            "공과금"
        ],
        before=2,
        after=7,
        limit=6
    )


    amount_thousand = None


    # -----------------------------------------------------
    # 1. 가장 일반적인 형태
    # 각 94,000천원
    # -----------------------------------------------------

    patterns = [
        r"각\s*([\d,]+)\s*천원",

        r"작품당\s*([\d,]+)\s*천원",

        r"설치비[\s\S]{0,150}?"
        r"([\d,]+)\s*천원",

        r"작품비[\s\S]{0,150}?"
        r"([\d,]+)\s*천원"
    ]


    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            re.I
        )


        if not match:

            continue


        try:

            amount_thousand = int(
                match.group(1)
                .replace(
                    ",",
                    ""
                )
            )

            break

        except ValueError:

            pass


    # -----------------------------------------------------
    # 2. HWP TABLE 대응
    #
    # 설치비
    # (천원)
    # 작품수
    # ...
    # 각 94,000
    # 2
    # -----------------------------------------------------

    if amount_thousand is None:

        table_has_thousand_unit = any(
            "(천원)" in line
            or "단위: 천원" in line
            or "단위 : 천원" in line
            for line in lines
        )


        if table_has_thousand_unit:

            for line in lines:

                match = re.search(
                    r"(?:^|\s)"
                    r"각\s*"
                    r"([\d,]+)"
                    r"(?:\s|$)",
                    line
                )


                if not match:

                    continue


                try:

                    candidate = int(
                        match.group(1)
                        .replace(
                            ",",
                            ""
                        )
                    )


                    # 천원 단위 작품비로
                    # 현실적인 범위만 허용
                    if (
                        1000 <=
                        candidate <=
                        10000000
                    ):

                        amount_thousand = (
                            candidate
                        )

                        break

                except ValueError:

                    pass


    # -----------------------------------------------------
    # 3. 설치비 표 주변 숫자 직접 탐색
    # -----------------------------------------------------

    if amount_thousand is None:

        for index, line in enumerate(
            lines
        ):

            if "설치비" not in line:

                continue


            nearby = lines[
                index:
                min(
                    len(lines),
                    index + 12
                )
            ]


            unit_is_thousand = any(
                "(천원)" in item
                for item in nearby
            )


            if not unit_is_thousand:

                continue


            for candidate_line in nearby:

                match = re.search(
                    r"각\s*([\d,]+)",
                    candidate_line
                )


                if not match:

                    continue


                try:

                    amount_thousand = int(
                        match.group(1)
                        .replace(
                            ",",
                            ""
                        )
                    )

                    break

                except ValueError:

                    pass


            if amount_thousand is not None:

                break


    if amount_thousand is None:

        return field_result(
            "",
            evidence
        )


    amount_won = (
        amount_thousand *
        1000
    )


    artwork_count = (
        extract_artwork_count_number(
            text,
            lines
        )
    )


    value_parts = [
        f"작품당 {amount_won:,}원"
    ]


    if artwork_count:

        total_won = (
            amount_won *
            artwork_count
        )


        value_parts.append(
            f"{artwork_count}점"
        )

        value_parts.append(
            f"총 {total_won:,}원"
        )


    # 사업비 포함 범위 표시
    if (
        "모든 공과금 및 경비를 포함"
        in text
    ):

        value_parts.append(
            "공과금 및 경비 포함"
        )


    return field_result(
        " / ".join(
            value_parts
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
            "작품수",
            "작품 수"
        ],
        after=7
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
            "설치(예정)일",
            "설치예정일",
            "설치 예정일",
            "설치 예정"
        ],
        after=7
    )


    value = ""


    # 설치예정일 주변을 우선 탐색
    for snippet in evidence:

        match = re.search(
            r"(20\d{2})년\s*"
            r"(\d{1,2})월",
            snippet
        )


        if match:

            value = (
                f"{match.group(1)}년 "
                f"{int(match.group(2))}월"
            )

            break


    # fallback
    if not value:

        match = re.search(
            r"설치(?:\(예정\))?일"
            r"[\s\S]{0,150}?"
            r"(20\d{2})년\s*"
            r"(\d{1,2})월",
            text
        )


        if match:

            value = (
                f"{match.group(1)}년 "
                f"{int(match.group(2))}월"
            )


    return field_result(
        value,
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
            "허용하중",
            "설치기간",
            "설치위치",
            "설치 위치",
            "공사 진행",
            "설치(예정)일",
            "구조적 안전"
        ],
        limit=10
    )


    values = []


    for line in evidence:

        if any(
            keyword in line
            for keyword in [
                "허용하중",
                "설치기간",
                "설치위치",
                "설치 위치",
                "공사 진행",
                "설치(예정)일"
            ]
        ):

            values.append(
                line
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
# 작품 규모 / 하중
# ---------------------------------------------------------

def extract_artwork_scale(
    text,
    lines
):

    evidence = find_matching_lines(
        lines,
        [
            "가로×세로×높이",
            "가로 x 세로 x 높이",
            "가로×세로",
            "작품 및 좌대의 규모",
            "허용하중",
            "1.2톤"
        ],
        limit=8
    )


    value_parts = []


    load_patterns = [
        r"허용하중은?\s*"
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


    for line in evidence:

        if (
            "가로" in line
            or "규모" in line
            or "허용하중" in line
        ):

            value_parts.append(
                line
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
            "접수 기간"
        ],
        after=3
    )


    pattern = (
        r"(?:접수일시|접수기간|접수 기간)"
        r"[:：]?\s*"
        r"(20\d{2})년\s*"
        r"(\d{1,2})월\s*"
        r"(\d{1,2})일"
        r"\s*[~～\-∼]\s*"
        r"(?:(20\d{2})년\s*)?"
        r"(?:(\d{1,2})월\s*)?"
        r"(\d{1,2})일"
    )


    match = re.search(
        pattern,
        text
    )


    value = ""


    if match:

        start_year = (
            match.group(1)
        )

        start_month = (
            match.group(2)
        )

        start_day = (
            match.group(3)
        )

        end_year = (
            match.group(4)
            or start_year
        )

        end_month = (
            match.group(5)
            or start_month
        )

        end_day = (
            match.group(6)
        )


        value = (
            f"{start_year}-"
            f"{int(start_month):02d}-"
            f"{int(start_day):02d}"
            " ~ "
            f"{end_year}-"
            f"{int(end_month):02d}-"
            f"{int(end_day):02d}"
        )


    return field_result(
        value,
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
            "심사 발표",
            "심사발표",
            "당선자",
            "선정되지 않은"
        ],
        after=3
    )


    match = re.search(
        r"심사\s*발표일?"
        r"[:：]?\s*"
        r"(20\d{2})년\s*"
        r"(\d{1,2})월\s*"
        r"(\d{1,2})일",
        text
    )


    value = ""


    if match:

        value = (
            f"{match.group(1)}-"
            f"{int(match.group(2)):02d}-"
            f"{int(match.group(3)):02d}"
        )


    return field_result(
        value,
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
            "제출도서",
            "제출서류",
            "응모서류",
            "도판 이미지",
            "작품설명서",
            "응모신청서",
            "사용계획서",
            "서약서",
            "개인정보",
            "작가경력서",
            "신분증"
        ],
        after=3,
        limit=14
    )


    keywords = [
        "도판 이미지",
        "도판 A1",
        "작품설명서",
        "응모신청서",
        "설치금액 사용계획서",
        "사용계획서",
        "서약서",
        "개인정보 수집",
        "작가경력서",
        "신분증 사본",
        "출력물"
    ]


    items = []


    for line in lines:

        if any(
            keyword in line
            for keyword in keywords
        ):

            items.append(
                line
            )


    items = dedupe(
        items
    )


    return field_result(
        " / ".join(
            items[:14]
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
            "작품 제출은",
            "이메일",
            "우편",
            "마감일 17:00",
            "도착한 작품"
        ],
        after=3,
        limit=8
    )


    value_parts = []


    # 실제 작품 제출 문맥이 있을 때만
    # 이메일 접수로 판단
    submission_email_match = re.search(
        r"작품\s*제출"
        r"[\s\S]{0,180}?"
        r"이메일"
        r"\s*\(?"
        r"([\w.\-+]+@[\w.\-]+\.\w+)"
        r"\)?",
        text
    )


    if submission_email_match:

        value_parts.append(
            "이메일 접수"
        )

        value_parts.append(
            submission_email_match.group(
                1
            )
        )


    elif (
        "작품 제출은" in text
        and "이메일" in text
    ):

        value_parts.append(
            "이메일 접수"
        )


        email_match = re.search(
            r"[\w.\-+]+@"
            r"[\w.\-]+\.\w+",
            text
        )


        if email_match:

            value_parts.append(
                email_match.group(0)
            )


    if (
        "출력물은 이메일 접수 후"
        in text
        and "우편" in text
    ):

        value_parts.append(
            "출력물 별도 우편 제출"
        )


    time_match = re.search(
        r"마감일\s*"
        r"(\d{1,2}:\d{2})",
        text
    )


    if time_match:

        value_parts.append(
            f"마감 {time_match.group(1)}"
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


    # 긴 서술형 문장은 제목으로 인정하지 않음
    if len(line) > 50:

        return False


    cleaned = re.sub(
        r"^[\s◆■□●○◦\-※]+",
        "",
        line
    )


    cleaned = re.sub(
        r"^\d+\s*[\.\)]\s*",
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
    max_lines=12
):

    result = []


    for index in range(
        start_index + 1,
        min(
            len(lines),
            start_index + 1 + max_lines
        )
    ):

        line = lines[index].strip()


        # 다음 번호 섹션이 시작하면 종료
        if re.match(
            r"^\d+\s*[\.\)]\s*",
            line
        ):

            break


        if line:

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


    # -----------------------------------------------------
    # 1. 실제 섹션 제목 탐색
    # -----------------------------------------------------

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

            # 개인정보/서약서 등
            # 후속 서식 영역 오검출 방지
            if any(
                keyword in item
                for keyword in [
                    "개인정보 수집",
                    "생년월일",
                    "성 명 :",
                    "서약합니다",
                    "서약서"
                ]
            ):

                break


            meaningful.append(
                item
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


    # -----------------------------------------------------
    # 2. 배점표 / 평가항목 표 탐색
    #
    # 반드시 평가항목 계열 + 배점 계열이
    # 동시에 존재해야 심사기준으로 인정
    # -----------------------------------------------------

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
            after=8,
            limit=5
        )


        values = find_matching_lines(
            lines,
            [
                "평가항목",
                "평가 항목",
                "심사항목",
                "심사 항목",
                "배점",
                "점수"
            ],
            limit=12
        )


        return field_result(
            " / ".join(
                dedupe(
                    values
                )
            ),
            evidence
        )


    # -----------------------------------------------------
    # v2:
    #
    # "예술성과 구조적 안전성"
    # "심사방법 및 심사기준에 의한 결과"
    #
    # 같은 일반 문장은 심사기준으로 인정하지 않는다.
    # -----------------------------------------------------

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
            "공모 유의사항",
            "유의사항",
            "접수 불가",
            "수정/변경/보완",
            "불이익",
            "연작",
            "시리즈"
        ],
        after=4,
        limit=10
    )


    caution_keywords = [
        "접수 불가",
        "접수불가",
        "수정/변경/보완",
        "수정·변경·보완",
        "불이익",
        "작성자를 인지",
        "어떠한 표기",
        "연작",
        "시리즈 작품",
        "응모불가",
        "응모 불가"
    ]


    caution_lines = []


    for line in lines:

        if any(
            keyword in line
            for keyword in caution_keywords
        ):

            caution_lines.append(
                line
            )


    caution_lines = dedupe(
        caution_lines
    )


    return field_result(
        " / ".join(
            caution_lines[:10]
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
            "axoo_art_notice_analysis_v2",

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
        "AXOO ART NOTICE ANALYZER v2"
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


            preview = value[:160]


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
