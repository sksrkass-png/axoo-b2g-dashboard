import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path


# =========================================================
# AXOO B2G
# ART PARTICIPATION ANALYZER v1.0
#
# INPUT
# data/art_notice_text/<RESEARCH_ID>.json
#
# SCHEMA
# data/art_participation_schema.json
#
# OUTPUT
# data/art_participation_analysis/<RESEARCH_ID>.json
#
# IMPORTANT
# - AI 추론 사용 안 함
# - 외부 API 사용 안 함
# - 공고문 실제 문구만 근거로 판정
# - 불명확하면 CHECK
# =========================================================


INPUT_DIR = Path(
    "data/art_notice_text"
)

OUTPUT_DIR = Path(
    "data/art_participation_analysis"
)

SCHEMA_PATH = Path(
    "data/art_participation_schema.json"
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

def compact(
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


def clean_line(
    line
):

    line = compact(
        line
    )

    line = re.sub(
        r"^[\s○◦●•▪■□◆◇▶>※\-–—]+",
        "",
        line
    )

    return line.strip()


def normalize_key(
    text
):

    return re.sub(
        r"\s+",
        "",
        str(
            text or ""
        )
    ).lower()


def unique(
    values
):

    result = []
    seen = set()

    for value in values:

        value = compact(
            value
        )

        if not value:
            continue

        key = normalize_key(
            value
        )

        if key in seen:
            continue

        seen.add(
            key
        )

        result.append(
            value
        )

    return result


def load_json(
    path
):

    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


# ---------------------------------------------------------
# DOCUMENT TEXT
# ---------------------------------------------------------

def get_document_text(
    data
):

    parts = []

    for doc in data.get(
        "documents",
        []
    ):

        if (
            doc.get("status")
            !=
            "ok"
        ):
            continue

        text = compact(
            doc.get(
                "text",
                ""
            )
        )

        if text:
            parts.append(
                text
            )

    return "\n".join(
        parts
    )


def get_lines(
    text
):

    lines = []

    for raw in text.split(
        "\n"
    ):

        line = clean_line(
            raw
        )

        if not line:
            continue

        # HWP 파서 제어문자성 쓰레기 문자열 제거
        if (
            re.fullmatch(
                r"[A-Za-z捤獥汤捯氠瑢漠杳\s]+",
                line
            )
            and
            not re.search(
                r"[가-힣]",
                line
            )
        ):
            continue

        lines.append(
            line
        )

    return lines


# ---------------------------------------------------------
# CONTEXT
# ---------------------------------------------------------

def section_slice(
    lines,
    headings,
    max_lines=14
):

    heading_keys = [
        normalize_key(
            heading
        )
        for heading in headings
    ]

    for index, line in enumerate(
        lines
    ):

        key = normalize_key(
            line
        )

        if not any(
            heading in key
            for heading in heading_keys
        ):
            continue

        result = [
            line
        ]

        for candidate in lines[
            index + 1:
            index + 1 + max_lines
        ]:

            if (
                re.match(
                    r"^(공모개요|작품제출|작품선정|기타유의사항|현장설명|심사)",
                    candidate
                )
                and
                len(result) > 1
            ):
                break

            result.append(
                candidate
            )

        return result

    return []


def context_lines(
    lines,
    keywords,
    before=1,
    after=2,
    limit=12
):

    result = []

    keyword_keys = [
        normalize_key(
            keyword
        )
        for keyword in keywords
    ]

    for index, line in enumerate(
        lines
    ):

        key = normalize_key(
            line
        )

        if not any(
            keyword in key
            for keyword in keyword_keys
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

        if snippet not in result:

            result.append(
                snippet
            )

        if (
            len(result)
            >= limit
        ):
            break

    return result


def matched_sentences(
    lines,
    patterns,
    limit=12
):

    result = []

    for line in lines:

        for pattern in patterns:

            if re.search(
                pattern,
                line,
                re.I
            ):

                result.append(
                    line
                )

                break

        if (
            len(result)
            >= limit
        ):
            break

    return unique(
        result
    )


# ---------------------------------------------------------
# APPLICANT TYPE
# ---------------------------------------------------------

def infer_applicant_type(
    eligibility_lines,
    all_lines
):

    source = (
        eligibility_lines
        or
        context_lines(
            all_lines,
            [
                "응모자격",
                "참가자격",
                "신청자격"
            ],
            before=0,
            after=8,
            limit=4
        )
    )

    text = " / ".join(
        source
    )

    normalized = normalize_key(
        text
    )


    # 개인 + 법인 명시
    patterns = [
        r"개인\s*(?:또는|및|·|/|,)?\s*법인",
        r"법인\s*(?:또는|및|·|/|,)?\s*개인"
    ]

    if any(
        re.search(
            pattern,
            text,
            re.I
        )
        for pattern in patterns
    ):

        return (
            "INDIVIDUAL_OR_CORPORATION",
            matched_sentences(
                source,
                patterns
            )
        )


    # 법인 직접 응모 명시
    corporation_patterns = [
        r"(?:응모|참가|신청)[^\n]{0,30}법인",
        r"법인[^\n]{0,30}(?:응모|참가|신청)\s*(?:가능|할\s*수)",
        r"응모자격[^\n]{0,50}법인"
    ]

    if any(
        re.search(
            pattern,
            text,
            re.I
        )
        for pattern in corporation_patterns
    ):

        return (
            "CORPORATION",
            matched_sentences(
                source,
                corporation_patterns
            )
        )


    # 사업자 직접 참여 명시
    business_patterns = [
        r"(?:사업자|사업체)[^\n]{0,30}(?:응모|참가|신청)\s*(?:가능|할\s*수)",
        r"응모자격[^\n]{0,50}사업자"
    ]

    if any(
        re.search(
            pattern,
            text,
            re.I
        )
        for pattern in business_patterns
    ):

        return (
            "BUSINESS",
            matched_sentences(
                source,
                business_patterns
            )
        )


    # 작가 명의 명시
    artist_patterns = [
        r"작가\s*본인",
        r"작가\s*1인당",
        r"작가\s*1인",
        r"(?:응모자|참가자)[^\n]{0,40}작가",
        r"작가[^\n]{0,35}(?:응모|참가|신청)\s*(?:가능|할\s*수)"
    ]

    if any(
        re.search(
            pattern,
            text,
            re.I
        )
        for pattern in artist_patterns
    ):

        return (
            "ARTIST",
            matched_sentences(
                source,
                artist_patterns
            )
        )


    # 개인 명시
    individual_patterns = [
        r"개인[^\n]{0,30}(?:응모|참가|신청)\s*(?:가능|할\s*수)",
        r"응모자격[^\n]{0,50}개인",
        r"1인당\s*1개\s*작품"
    ]

    if any(
        re.search(
            pattern,
            text,
            re.I
        )
        for pattern in individual_patterns
    ):

        return (
            "INDIVIDUAL",
            matched_sentences(
                source,
                individual_patterns
            )
        )


    # 제한 없음
    open_patterns = [
        r"누구나\s*(?:응모|참가|신청)",
        r"(?:응모|참가|신청)\s*자격[^\n]{0,20}제한\s*없",
        r"자격\s*제한\s*없"
    ]

    if any(
        re.search(
            pattern,
            text,
            re.I
        )
        for pattern in open_patterns
    ):

        return (
            "OPEN",
            matched_sentences(
                source,
                open_patterns
            )
        )


    # 단순히 "제작·설치 가능한 자"만 있으면
    # 법인/개인/작가를 절대 임의 추론하지 않음.
    if (
        "제작" in normalized
        and
        "설치" in normalized
        and
        "가능한자" in normalized
    ):

        return (
            "UNCLEAR",
            unique(
                source[:3]
            )
        )


    return (
        "UNCLEAR",
        unique(
            source[:3]
        )
    )


# ---------------------------------------------------------
# PROXY
# ---------------------------------------------------------

def infer_proxy(
    lines
):

    # -----------------------------------------------------
    # 명시적 대리접수 불가
    # -----------------------------------------------------

    no_patterns = [
        r"대리\s*(?:접수|신청|제출)[^\n]{0,25}(?:불가|금지|허용하지)",
        r"(?:대리신청|대리접수|대리제출)\s*(?:불가|금지)",
        r"본인\s*(?:직접|에\s*한하여)[^\n]{0,30}(?:접수|신청|제출)"
    ]


    no_evidence = matched_sentences(
        lines,
        no_patterns
    )


    if no_evidence:

        return (
            "NO",
            "NOT_STATED",
            no_evidence
        )


    # -----------------------------------------------------
    # 명시적 대리접수 가능
    #
    # 중요:
    # "대리접수 가능"이라는 직접 표현뿐 아니라
    #
    # - 대리접수 시 위임장 제출
    # - 대리인이 접수하는 경우 위임장 제출
    # - 대리 제출의 경우 대리인 신분증 지참
    #
    # 처럼 대리절차가 실제로 규정된 경우도 YES.
    #
    # 단순히 문서 어딘가에 "위임장"만 있다고 해서
    # 대리접수 가능으로 추론하지 않는다.
    # -----------------------------------------------------

    yes_patterns = [

        # 대리인이 실제 접수/신청/제출
        r"대리인이?\s*(?:접수|신청|제출)",

        # 직접적인 가능/허용 표현
        r"대리\s*(?:접수|신청|제출)"
        r"[^\n]{0,25}"
        r"(?:가능|허용)",

        # "대리접수 시 위임장 제출"
        r"대리\s*(?:접수|신청|제출)"
        r"\s*(?:시|할\s*경우|하는\s*경우|의\s*경우)"
        r"[^\n]{0,60}"
        r"(?:위임장|위임서|대리인\s*신분증)",

        # "대리인이 접수하는 경우 위임장"
        r"대리인"
        r"[^\n]{0,50}"
        r"(?:위임장|위임서)",

        # "위임장 및 대리인 신분증 제출"
        # 단, 같은 문장 안에 대리 관련 표현이 있어야 함
        r"(?:위임장|위임서)"
        r"[^\n]{0,50}"
        r"대리인"
    ]


    yes_evidence = matched_sentences(
        lines,
        yes_patterns
    )


    if yes_evidence:

        scope = (
            "SUBMISSION_ONLY"
        )


        # 단순 제출 행위를 넘어
        # 절차·업무·행위 전체 대리라고 명시된 경우만
        # PROCEDURAL_AGENT로 승격
        if any(

            re.search(
                r"(?:절차|업무|행위)"
                r"[^\n]{0,25}"
                r"대리"
                r"|"
                r"대리"
                r"[^\n]{0,25}"
                r"(?:절차|업무|행위)",
                evidence,
                re.I
            )

            for evidence
            in yes_evidence
        ):

            scope = (
                "PROCEDURAL_AGENT"
            )


        return (
            "YES",
            scope,
            yes_evidence
        )


    # -----------------------------------------------------
    # 공고에 대리 규정 없음
    # -----------------------------------------------------

    return (
        "NOT_STATED",
        "NOT_STATED",
        []
    )
