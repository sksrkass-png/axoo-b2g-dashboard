import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path


INPUT_DIR = Path("data/art_notice_text")
OUTPUT_DIR = Path("data/art_notice_analysis")

RESEARCH_ID = os.environ.get(
    "ART_NOTICE_ID",
    ""
).strip()


# ---------------------------------------------------------
# Text helpers
# ---------------------------------------------------------

def normalize_space(text):
    text = str(text or "")
    text = text.replace("\r\n", "\n")
    text = text.replace("\r", "\n")
    text = text.replace("\u00a0", " ")

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


def looks_like_garbage(line):
    line = line.strip()

    if not line:
        return False

    # HWP 내부 제어문자 찌꺼기 제거용
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


def clean_text(text):
    text = normalize_space(text)

    lines = []

    for raw_line in text.split("\n"):
        line = raw_line.strip()

        if not line:
            continue

        if looks_like_garbage(line):
            continue

        lines.append(line)

    return "\n".join(lines)


def unique_lines(text):
    seen = set()
    result = []

    for line in text.split("\n"):
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

        seen.add(key)
        result.append(line)

    return result


def compact_value(text):
    text = normalize_space(text)
    text = text.replace("\n", " ")

    return re.sub(
        r"\s+",
        " ",
        text
    ).strip()


# ---------------------------------------------------------
# Evidence helpers
# ---------------------------------------------------------

def find_matching_lines(
    lines,
    keywords,
    limit=6
):
    matches = []

    for line in lines:
        normalized = line.lower()

        if any(
            keyword.lower() in normalized
            for keyword in keywords
        ):
            if line not in matches:
                matches.append(line)

        if len(matches) >= limit:
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

    for index, line in enumerate(lines):
        normalized = line.lower()

        if not any(
            keyword.lower() in normalized
            for keyword in keywords
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
            lines[start:end]
        )

        if snippet not in results:
            results.append(snippet)

        if len(results) >= limit:
            break

    return results


def field_result(
    value="",
    evidence=None
):
    evidence = evidence or []

    value = compact_value(value)

    return {
        "status": (
            "found"
            if value or evidence
            else "not_found"
        ),
        "value": value,
        "evidence": evidence
    }


# ---------------------------------------------------------
# Structured extraction
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
            "응모 자격"
        ],
        after=4
    )

    values = []

    for snippet in evidence:
        parts = snippet.split(" / ")

        for part in parts:
            if (
                "만 " in part
                or "가능한 자" in part
                or "응모불가" in part
                or "응모 불가" in part
                or "개인" in part
            ):
                values.append(part)

    value = " / ".join(
        dict.fromkeys(values)
    )

    return field_result(
        value,
        evidence
    )


def extract_budget(
    text,
    lines
):
    patterns = [
        r"각\s*([\d,]+)\s*천원",
        r"설치비[\s\S]{0,120}?([\d,]+)\s*천원",
        r"작품비[\s\S]{0,80}?([\d,]+)\s*천원",
    ]

    amount = ""

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            re.I
        )

        if match:
            amount = match.group(1)
            break

    evidence = find_context(
        lines,
        [
            "설치비",
            "사업비",
            "작품비",
            "94,000"
        ],
        before=1,
        after=5
    )

    value = ""

    if amount:
        clean_amount = amount.replace(
            ",",
            ""
        )

        try:
            won = int(
                clean_amount
            ) * 1000

            value = (
                f"작품당 {won:,}원"
            )

        except ValueError:
            value = (
                f"{amount}천원"
            )

    return field_result(
        value,
        evidence
    )


def extract_artwork_count(
    text,
    lines
):
    count = ""

    patterns = [
        r"작품수[\s\S]{0,80}?(\d+)",
        r"(\d+)\s*작품",
        r"(\d+)\s*점"
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text
        )

        if match:
            count = match.group(1)
            break

    evidence = find_context(
        lines,
        [
            "작품수",
            "작품 수"
        ],
        after=5
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


def extract_installation_date(
    text,
    lines
):
    match = re.search(
        r"(20\d{2})년\s*(\d{1,2})월",
        text
    )

    value = ""

    if match:
        value = (
            f"{match.group(1)}년 "
            f"{int(match.group(2))}월"
        )

    evidence = find_context(
        lines,
        [
            "설치(예정)일",
            "설치예정일",
            "설치 예정",
            "설치기간"
        ],
        after=4
    )

    return field_result(
        value,
        evidence
    )


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
            "구조적 안전",
            "안전성",
            "시공방법",
            "공사 진행"
        ],
        limit=8
    )

    values = []

    for line in evidence:
        if any(
            keyword in line
            for keyword in [
                "허용하중",
                "설치기간",
                "설치위치",
                "설치(예정)일",
                "공사 진행"
            ]
        ):
            values.append(line)

    return field_result(
        " / ".join(
            dict.fromkeys(values)
        ),
        evidence
    )


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
            "규모",
            "허용하중",
            "1.2톤"
        ],
        limit=8
    )

    load_match = re.search(
        r"허용하중은?\s*([\d.]+)\s*톤\s*/?\s*m[²2]",
        text,
        re.I
    )

    value_parts = []

    if load_match:
        value_parts.append(
            "허용하중 "
            f"{load_match.group(1)}톤/㎡"
        )

    size_lines = [
        line
        for line in evidence
        if (
            "규모" in line
            or "가로" in line
            or "허용하중" in line
        )
    ]

    value_parts.extend(
        size_lines
    )

    return field_result(
        " / ".join(
            dict.fromkeys(
                value_parts
            )
        ),
        evidence
    )


def extract_application_period(
    text,
    lines
):
    patterns = [
        (
            r"접수일시[:：]?\s*"
            r"(20\d{2})년\s*"
            r"(\d{1,2})월\s*"
            r"(\d{1,2})일"
            r"\s*[~～\-]\s*"
            r"(?:(20\d{2})년\s*)?"
            r"(?:(\d{1,2})월\s*)?"
            r"(\d{1,2})일"
        ),
        (
            r"접수기간[:：]?\s*"
            r"([^\n]+)"
        )
    ]

    value = ""

    match = re.search(
        patterns[0],
        text
    )

    if match:
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

        value = (
            f"{start_year}-"
            f"{int(start_month):02d}-"
            f"{int(start_day):02d}"
            " ~ "
            f"{end_year}-"
            f"{int(end_month):02d}-"
            f"{int(end_day):02d}"
        )

    else:
        match = re.search(
            patterns[1],
            text
        )

        if match:
            value = match.group(1)

    evidence = find_context(
        lines,
        [
            "접수일시",
            "접수기간"
        ],
        after=2
    )

    return field_result(
        value,
        evidence
    )


def extract_judging_announcement(
    text,
    lines
):
    match = re.search(
        r"심사\s*발표일?[:：]?\s*"
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

    evidence = find_context(
        lines,
        [
            "심사 발표",
            "심사발표",
            "당선자",
            "선정되지 않은"
        ],
        after=2
    )

    return field_result(
        value,
        evidence
    )


def extract_submission_documents(
    text,
    lines
):
    evidence = find_context(
        lines,
        [
            "제출도서",
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
        limit=12
    )

    keywords = [
        "도판",
        "작품설명서",
        "응모신청서",
        "사용계획서",
        "서약서",
        "개인정보",
        "작가경력서",
        "신분증"
    ]

    items = []

    for line in lines:
        if any(
            keyword in line
            for keyword in keywords
        ):
            items.append(line)

    items = list(
        dict.fromkeys(items)
    )

    return field_result(
        " / ".join(
            items[:12]
        ),
        evidence
    )


def extract_submission_method(
    text,
    lines
):
    evidence = find_context(
        lines,
        [
            "작품 제출",
            "이메일",
            "우편",
            "마감일 17:00",
            "도착한 작품"
        ],
        after=3,
        limit=8
    )

    email_match = re.search(
        r"[\w.\-+]+@[\w.\-]+\.\w+",
        text
    )

    value_parts = []

    if "이메일" in text:
        value_parts.append(
            "이메일 접수"
        )

    if "우편" in text:
        value_parts.append(
            "출력물 별도 우편 제출"
        )

    if email_match:
        value_parts.append(
            email_match.group(0)
        )

    time_match = re.search(
        r"마감일\s*(\d{1,2}:\d{2})",
        text
    )

    if time_match:
        value_parts.append(
            f"마감 {time_match.group(1)}"
        )

    return field_result(
        " / ".join(
            dict.fromkeys(
                value_parts
            )
        ),
        evidence
    )


def extract_judging_criteria(
    text,
    lines
):
    evidence = find_context(
        lines,
        [
            "심사기준",
            "평가기준",
            "평가 기준",
            "심사 방법",
            "심사방법",
            "배점",
            "예술성",
            "조화",
            "안전성"
        ],
        after=5,
        limit=8
    )

    value_lines = find_matching_lines(
        lines,
        [
            "심사기준",
            "평가기준",
            "배점",
            "예술성",
            "환경과의 조화",
            "안전성"
        ],
        limit=8
    )

    return field_result(
        " / ".join(
            value_lines
        ),
        evidence
    )


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
            "어떠한 표기",
            "연작",
            "시리즈"
        ],
        after=3,
        limit=10
    )

    caution_lines = []

    caution_keywords = [
        "접수 불가",
        "접수불가",
        "수정/변경/보완",
        "불이익",
        "표기할 수 없음",
        "연작",
        "시리즈",
        "응모불가",
        "응모 불가"
    ]

    for line in lines:
        if any(
            keyword in line
            for keyword in caution_keywords
        ):
            caution_lines.append(line)

    caution_lines = list(
        dict.fromkeys(
            caution_lines
        )
    )

    return field_result(
        " / ".join(
            caution_lines[:10]
        ),
        evidence
    )


# ---------------------------------------------------------
# Analysis builder
# ---------------------------------------------------------

def build_analysis(data):
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
            "name": document.get(
                "name",
                ""
            ),
            "status": document.get(
                "status",
                ""
            ),
            "textLength": len(
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
        for field in fields.values()
        if field.get("status") == "found"
    )

    return {
        "researchId": data.get(
            "researchId",
            ""
        ),

        "title": data.get(
            "title",
            ""
        ),

        "status": "ok",

        "analyzer": (
            "axoo_art_notice_analysis_v1"
        ),

        "generatedAt": (
            datetime.now(
                timezone.utc
            ).isoformat()
        ),

        "source": (
            "art_notice_text"
        ),

        "documentCount": len(
            documents
        ),

        "documents": cleaned_documents,

        "analysisSummary": {
            "fieldCount": len(
                fields
            ),
            "foundCount": found_count,
            "missingCount": (
                len(fields)
                - found_count
            )
        },

        "fields": fields
    }


# ---------------------------------------------------------
# File runner
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

        return [target]

    return sorted(
        INPUT_DIR.glob(
            "*.json"
        )
    )


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
        "AXOO ART NOTICE ANALYZER"
    )

    print(
        f"Targets: {len(targets)}"
    )

    success_count = 0

    for path in targets:
        print("")
        print(
            "=" * 50
        )

        print(
            f"INPUT: {path}"
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
            ) + "\n",
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
            summary["foundCount"],
            "/",
            summary["fieldCount"]
        )

        for key, field in (
            analysis["fields"].items()
        ):
            status = field.get(
                "status"
            )

            value = field.get(
                "value",
                ""
            )

            preview = value[:100]

            print(
                f"- {key}: "
                f"{status} | "
                f"{preview}"
            )

        print(
            f"Saved: {output_path}"
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
        len(targets)
    )


if __name__ == "__main__":
    main()
