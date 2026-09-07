import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path


# =========================================================
# AXOO B2G
# ART PARTICIPATION ANALYZER v1.3
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
# RULES
# - AI 추론 사용 안 함
# - 외부 API 사용 안 함
# - 공고문 실제 문구만 근거로 판정
# - 불명확하면 CHECK
# - LOW confidence면 반드시 CHECK
#
# v1.3
# - 응모자격 / 참가자격 / 신청자격 섹션을
#   문서 전체에서 모두 수집
# - 공고문 요약본 + 상세 지침서가 한 파일 안에
#   반복 포함되는 실제 HWP 구조 대응
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

    text = (
        text
        .replace(
            "\r\n",
            "\n"
        )
        .replace(
            "\r",
            "\n"
        )
        .replace(
            "\u00a0",
            " "
        )
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
            >=
            limit
        ):

            break

    return unique(
        result
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
            doc.get(
                "status"
            )
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

        # HWP 추출 시 생기는
        # 제어문자성 쓰레기 문자열 제거
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

def is_section_boundary(
    line
):

    value = clean_line(
        line
    )


    # 숫자형 제목
    # 5. 응모자격
    # 6-1. 작품제작 방향
    if re.match(
        r"^\d+(?:-\d+)?\s*[.)]?\s*\S+",
        value
    ):

        return True


    # 주요 제목형
    if re.match(
        (
            r"^(?:"
            r"목적|"
            r"사업명|"
            r"공모개요|"
            r"응모자격|"
            r"참가자격|"
            r"신청자격|"
            r"공모일정|"
            r"작품접수|"
            r"접수방법|"
            r"제출방법|"
            r"제출도서|"
            r"작품제출|"
            r"작품선정|"
            r"계약방법|"
            r"공모조건|"
            r"당선작품|"
            r"기타유의사항|"
            r"기타\s*유의사항|"
            r"현장설명|"
            r"심사"
            r")"
        ),
        value,
        re.I
    ):

        return True


    return False


def section_slices(
    lines,
    headings,
    max_lines=14
):

    heading_keys = [

        normalize_key(
            heading
        )

        for heading
        in headings
    ]

    collected = []


    for index, line in enumerate(
        lines
    ):

        key = normalize_key(
            line
        )


        if not any(

            heading
            in
            key

            for heading
            in heading_keys

        ):

            continue


        current = [
            line
        ]


        for candidate in lines[
            index + 1:
            index + 1 + max_lines
        ]:

            candidate_key = normalize_key(
                candidate
            )


            # 동일 종류의 자격 제목이 다시 나오면
            # 현재 섹션을 끝내고
            # 바깥 루프에서 새 섹션으로 다시 수집
            if any(

                heading
                in
                candidate_key

                for heading
                in heading_keys

            ):

                break


            if (
                len(current)
                >
                1
                and
                is_section_boundary(
                    candidate
                )
            ):

                break


            current.append(
                candidate
            )


        collected.extend(
            current
        )


    return unique(
        collected
    )


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

        for keyword
        in keywords
    ]

    for index, line in enumerate(
        lines
    ):

        key = normalize_key(
            line
        )

        if not any(

            keyword
            in
            key

            for keyword
            in keyword_keys

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
            >=
            limit
        ):

            break

    return result


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
            limit=8
        )
    )

    text = " / ".join(
        source
    )

    normalized = normalize_key(
        text
    )


    # -----------------------------------------------------
    # 개인 전용 +
    # 법인 / 사업자 명시 금지
    # -----------------------------------------------------

    individual_only_patterns = [

        r"개인을?\s*대상으로\s*하는\s*공모",

        (
            r"개인[^/\n]{0,35}"
            r"(?:법인|사업자|사업체)"
            r"[^/\n]{0,35}"
            r"(?:응모|참가|신청)"
            r"\s*(?:불가|금지)"
        ),

        (
            r"(?:법인|사업자|사업체)"
            r"[^/\n]{0,35}"
            r"(?:응모|참가|신청)"
            r"\s*(?:불가|금지)"
        )
    ]


    if any(

        re.search(
            pattern,
            text,
            re.I
        )

        for pattern
        in individual_only_patterns

    ):

        evidence = matched_sentences(
            source,
            individual_only_patterns
        )

        return (
            "INDIVIDUAL",
            evidence
            or
            unique(
                source[:3]
            )
        )


    # -----------------------------------------------------
    # 개인 + 법인 직접 응모 가능
    # -----------------------------------------------------

    individual_corp_patterns = [

        (
            r"개인\s*"
            r"(?:또는|및|·|/|,)\s*"
            r"법인"
            r"[^/\n]{0,40}"
            r"(?:응모|참가|신청)?"
            r"\s*(?:가능|허용|할\s*수)"
        ),

        (
            r"법인\s*"
            r"(?:또는|및|·|/|,)\s*"
            r"개인"
            r"[^/\n]{0,40}"
            r"(?:응모|참가|신청)?"
            r"\s*(?:가능|허용|할\s*수)"
        ),

        (
            r"(?:"
            r"개인\s*(?:또는|및|·|/|,)\s*법인"
            r"|"
            r"법인\s*(?:또는|및|·|/|,)\s*개인"
            r")"
            r"\s*(?:응모|참가|신청)"
        )
    ]


    if any(

        re.search(
            pattern,
            text,
            re.I
        )

        for pattern
        in individual_corp_patterns

    ):

        return (
            "INDIVIDUAL_OR_CORPORATION",
            matched_sentences(
                source,
                individual_corp_patterns
            )
        )


    # -----------------------------------------------------
    # 법인 직접 응모
    # -----------------------------------------------------

    corporation_patterns = [

        (
            r"법인"
            r"[^/\n]{0,35}"
            r"(?:응모|참가|신청)"
            r"\s*(?:가능|허용|할\s*수)"
        ),

        (
            r"(?:응모|참가|신청)"
            r"[^/\n]{0,35}"
            r"법인"
            r"[^/\n]{0,20}"
            r"(?:가능|허용)"
        )
    ]


    if any(

        re.search(
            pattern,
            text,
            re.I
        )

        for pattern
        in corporation_patterns

    ):

        return (
            "CORPORATION",
            matched_sentences(
                source,
                corporation_patterns
            )
        )


    # -----------------------------------------------------
    # 사업자 직접 응모
    # -----------------------------------------------------

    business_patterns = [

        (
            r"(?:사업자|사업체)"
            r"[^/\n]{0,35}"
            r"(?:응모|참가|신청)"
            r"\s*(?:가능|허용|할\s*수)"
        ),

        (
            r"(?:응모|참가|신청)"
            r"[^/\n]{0,35}"
            r"(?:사업자|사업체)"
            r"[^/\n]{0,20}"
            r"(?:가능|허용)"
        )
    ]


    if any(

        re.search(
            pattern,
            text,
            re.I
        )

        for pattern
        in business_patterns

    ):

        return (
            "BUSINESS",
            matched_sentences(
                source,
                business_patterns
            )
        )


    # -----------------------------------------------------
    # 작가 명의 응모
    # -----------------------------------------------------

    artist_patterns = [

        r"작가\s*본인",

        r"작가\s*1인당",

        r"작가\s*1인",

        # 실제 공모문:
        # 대한민국 국적을 가진 자(작가)
        r"자\s*\(\s*작가\s*\)",

        (
            r"대한민국\s*국적"
            r"[^/\n]{0,80}"
            r"\(\s*작가\s*\)"
        ),

        (
            r"(?:응모자|참가자)"
            r"[^/\n]{0,45}"
            r"작가"
        ),

        (
            r"작가"
            r"[^/\n]{0,40}"
            r"(?:응모|참가|신청)"
            r"\s*(?:가능|허용|할\s*수)"
        ),

        (
            r"(?:응모자는?|참가자는?)"
            r"[^/\n]{0,45}"
            r"작가"
        )
    ]


    if any(

        re.search(
            pattern,
            text,
            re.I
        )

        for pattern
        in artist_patterns

    ):

        evidence = matched_sentences(
            source,
            artist_patterns
        )

        return (
            "ARTIST",
            evidence
            or
            unique(
                source[:4]
            )
        )


    # -----------------------------------------------------
    # 개인 응모
    # -----------------------------------------------------

    individual_patterns = [

        (
            r"개인"
            r"[^/\n]{0,35}"
            r"(?:응모|참가|신청)"
            r"\s*(?:가능|허용|할\s*수)"
        ),

        r"1인당\s*1개\s*작품",

        (
            r"만\s*\d+\s*세\s*이상"
            r"[^/\n]{0,30}"
            r"개인"
        )
    ]


    if any(

        re.search(
            pattern,
            text,
            re.I
        )

        for pattern
        in individual_patterns

    ):

        return (
            "INDIVIDUAL",
            matched_sentences(
                source,
                individual_patterns
            )
        )


    # -----------------------------------------------------
    # 제한 없음
    # -----------------------------------------------------

    open_patterns = [

        r"누구나\s*(?:응모|참가|신청)",

        (
            r"(?:응모|참가|신청)"
            r"\s*자격"
            r"[^/\n]{0,25}"
            r"제한\s*없"
        ),

        r"자격\s*제한\s*없"
    ]


    if any(

        re.search(
            pattern,
            text,
            re.I
        )

        for pattern
        in open_patterns

    ):

        return (
            "OPEN",
            matched_sentences(
                source,
                open_patterns
            )
        )


    # -----------------------------------------------------
    # 제작·설치 가능한 자
    # 만으로는 임의 추론 금지
    # -----------------------------------------------------

    if (
        "제작"
        in
        normalized
        and
        "설치"
        in
        normalized
        and
        "가능한자"
        in
        normalized
    ):

        return (
            "UNCLEAR",
            unique(
                source[:4]
            )
        )


    return (
        "UNCLEAR",
        unique(
            source[:4]
        )
    )


# ---------------------------------------------------------
# PROXY
# ---------------------------------------------------------

def infer_proxy(
    lines
):

    no_patterns = [

        (
            r"대리\s*"
            r"(?:접수|신청|제출)"
            r"[^\n]{0,25}"
            r"(?:불가|금지|허용하지)"
        ),

        (
            r"(?:대리신청|대리접수|대리제출)"
            r"\s*(?:불가|금지)"
        ),

        (
            r"본인\s*"
            r"(?:직접|에\s*한하여)"
            r"[^\n]{0,30}"
            r"(?:접수|신청|제출)"
        )
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


    yes_patterns = [

        (
            r"대리인이?"
            r"\s*(?:접수|신청|제출)"
        ),

        (
            r"대리\s*"
            r"(?:접수|신청|제출)"
            r"[^\n]{0,25}"
            r"(?:가능|허용)"
        ),

        (
            r"대리\s*"
            r"(?:접수|신청|제출)"
            r"\s*"
            r"(?:"
            r"시|"
            r"할\s*경우|"
            r"하는\s*경우|"
            r"의\s*경우"
            r")"
            r"[^\n]{0,60}"
            r"(?:"
            r"위임장|"
            r"위임서|"
            r"대리인\s*신분증"
            r")"
        ),

        (
            r"대리인"
            r"[^\n]{0,50}"
            r"(?:위임장|위임서)"
        ),

        (
            r"(?:위임장|위임서)"
            r"[^\n]{0,50}"
            r"대리인"
        )
    ]


    yes_evidence = matched_sentences(
        lines,
        yes_patterns
    )


    if yes_evidence:

        scope = (
            "SUBMISSION_ONLY"
        )


        if any(

            re.search(
                (
                    r"(?:절차|업무|행위)"
                    r"[^\n]{0,25}"
                    r"대리"
                    r"|"
                    r"대리"
                    r"[^\n]{0,25}"
                    r"(?:절차|업무|행위)"
                ),
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


    return (
        "NOT_STATED",
        "NOT_STATED",
        []
    )


# ---------------------------------------------------------
# POWER OF ATTORNEY
# ---------------------------------------------------------

def infer_power_of_attorney(
    lines
):

    not_required_patterns = [

        (
            r"(?:위임장|위임서)"
            r"[^\n]{0,25}"
            r"(?:"
            r"불필요|"
            r"필요\s*없|"
            r"제출하지\s*않"
            r")"
        )
    ]


    required_patterns = [

        (
            r"(?:위임장|위임서)"
            r"[^\n]{0,40}"
            r"(?:제출|지참|첨부|필수|필요)"
        ),

        (
            r"(?:제출|구비)"
            r"\s*서류"
            r"[^\n]{0,80}"
            r"(?:위임장|위임서)"
        ),

        (
            r"대리인"
            r"[^\n]{0,55}"
            r"(?:위임장|위임서)"
        ),

        (
            r"대리\s*"
            r"(?:접수|신청|제출)"
            r"[^\n]{0,60}"
            r"(?:위임장|위임서)"
        )
    ]


    no_evidence = matched_sentences(
        lines,
        not_required_patterns
    )


    if no_evidence:

        return (
            "NOT_REQUIRED",
            no_evidence
        )


    required_evidence = matched_sentences(
        lines,
        required_patterns
    )


    if required_evidence:

        return (
            "REQUIRED",
            required_evidence
        )


    return (
        "NOT_STATED",
        []
    )


# ---------------------------------------------------------
# JOINT APPLICATION
# ---------------------------------------------------------

def infer_joint(
    lines
):

    no_patterns = [

        r"단독\s*응모만\s*가능",

        (
            r"공동\s*"
            r"(?:응모|참여|신청)"
            r"[^\n]{0,25}"
            r"(?:불가|금지|허용하지)"
        ),

        r"공동응모\s*불가"
    ]


    conditional_patterns = [

        (
            r"공동\s*"
            r"(?:응모|참여|신청)"
            r"[^\n]{0,60}"
            r"(?:조건|경우에\s*한|한하여)"
        ),

        (
            r"(?:조건부|경우에\s*한하여)"
            r"[^\n]{0,60}"
            r"공동\s*"
            r"(?:응모|참여|신청)"
        )
    ]


    yes_patterns = [

        (
            r"공동\s*"
            r"(?:응모|참여|신청)"
            r"[^\n]{0,30}"
            r"(?:가능|허용)"
        ),

        (
            r"(?:단독|개별)"
            r"\s*(?:또는|및)\s*"
            r"공동\s*응모"
        )
    ]


    no_evidence = matched_sentences(
        lines,
        no_patterns
    )


    if no_evidence:

        return (
            "NO",
            no_evidence
        )


    conditional_evidence = matched_sentences(
        lines,
        conditional_patterns
    )


    if conditional_evidence:

        return (
            "CONDITIONAL",
            conditional_evidence
        )


    yes_evidence = matched_sentences(
        lines,
        yes_patterns
    )


    if yes_evidence:

        return (
            "YES",
            yes_evidence
        )


    return (
        "NOT_STATED",
        []
    )


# ---------------------------------------------------------
# PRODUCTION COMPANY JOINT
# ---------------------------------------------------------

def infer_production_company_joint(
    joint_status,
    lines
):

    no_patterns = [

        (
            r"제작\s*업체"
            r"[^\n]{0,50}"
            r"공동\s*"
            r"(?:응모|참여|신청)"
            r"[^\n]{0,25}"
            r"(?:불가|금지)"
        ),

        (
            r"제작\s*업체"
            r"[^\n]{0,35}"
            r"(?:참여|응모)"
            r"\s*불가"
        )
    ]


    yes_patterns = [

        (
            r"제작\s*업체"
            r"[^\n]{0,50}"
            r"공동\s*"
            r"(?:응모|참여|신청)"
            r"[^\n]{0,25}"
            r"(?:가능|허용)?"
        ),

        (
            r"공동\s*"
            r"(?:응모|참여|신청)"
            r"[^\n]{0,50}"
            r"제작\s*업체"
        ),

        (
            r"제작\s*업체를?"
            r"\s*포함한\s*"
            r"공동\s*응모"
        ),

        (
            r"작가"
            r"[^\n]{0,25}"
            r"(?:및|와|과|\+)"
            r"\s*제작\s*업체"
            r"[^\n]{0,30}"
            r"공동\s*응모"
            r"\s*(?:가능|허용)?"
        )
    ]


    no_evidence = matched_sentences(
        lines,
        no_patterns
    )


    if no_evidence:

        return (
            "NO",
            no_evidence
        )


    yes_evidence = matched_sentences(
        lines,
        yes_patterns
    )


    if yes_evidence:

        if (
            joint_status
            ==
            "CONDITIONAL"
        ):

            return (
                "CONDITIONAL",
                yes_evidence
            )


        return (
            "YES",
            yes_evidence
        )


    return (
        "NOT_STATED",
        []
    )


# ---------------------------------------------------------
# JOINT PARTIES
# ---------------------------------------------------------

def infer_joint_parties(
    joint_status,
    joint_evidence,
    production_status,
    production_evidence
):

    if joint_status not in {
        "YES",
        "CONDITIONAL"
    }:

        return (
            [],
            []
        )


    source = unique(
        (joint_evidence or [])
        +
        (production_evidence or [])
    )

    text = " / ".join(
        source
    )

    parties = []


    if (
        production_status
        in {
            "YES",
            "CONDITIONAL"
        }
        or
        re.search(
            r"제작\s*업체|제작사",
            text,
            re.I
        )
    ):

        parties.append(
            "PRODUCTION_COMPANY"
        )


    if re.search(
        r"법인",
        text,
        re.I
    ):

        parties.append(
            "CORPORATION"
        )


    if re.search(
        r"사업자|사업체",
        text,
        re.I
    ):

        parties.append(
            "BUSINESS"
        )


    if re.search(
        r"작가",
        text,
        re.I
    ):

        parties.append(
            "ARTIST"
        )


    if re.search(
        r"개인",
        text,
        re.I
    ):

        parties.append(
            "INDIVIDUAL"
        )


    if (
        source
        and
        not parties
    ):

        parties.append(
            "UNCLEAR"
        )


    return (
        parties,
        source
    )


# ---------------------------------------------------------
# EXPLICIT AXOO BLOCK
# ---------------------------------------------------------

def infer_blocked(
    lines
):

    patterns = [

        (
            r"개인을?\s*대상으로\s*하는\s*공모"
            r"[^\n]{0,60}"
            r"(?:법인|사업자|사업체)"
            r"[^\n]{0,30}"
            r"(?:응모|참가|신청)?"
            r"\s*(?:불가|금지)"
        ),

        (
            r"법인"
            r"[^\n]{0,35}"
            r"(?:응모|참가|신청|공동참여)"
            r"[^\n]{0,25}"
            r"(?:불가|금지)"
        ),

        (
            r"(?:"
            r"제작업체|"
            r"제작\s*업체|"
            r"사업자|"
            r"사업체|"
            r"업체"
            r")"
            r"[^\n]{0,35}"
            r"(?:응모|참가|공동참여)"
            r"[^\n]{0,25}"
            r"(?:불가|금지)"
        ),

        (
            r"작가\s*본인에\s*한하"
            r"[^\n]{0,60}"
            r"(?:대리|공동)"
            r"[^\n]{0,35}"
            r"불가"
        )
    ]


    return matched_sentences(
        lines,
        patterns
    )


# ---------------------------------------------------------
# AXOO MODE
# ---------------------------------------------------------

def choose_modes(
    applicant_type,
    proxy_submission,
    joint_status,
    joint_parties,
    production_company_joint,
    blocked_evidence
):

    modes = []


    # -----------------------------------------------------
    # DIRECT
    # -----------------------------------------------------

    if applicant_type in {

        "INDIVIDUAL_OR_CORPORATION",
        "CORPORATION",
        "BUSINESS",
        "OPEN"

    }:

        modes.append(
            "DIRECT"
        )


    # -----------------------------------------------------
    # JOINT
    #
    # 단순 공동응모 가능은 JOINT가 아님.
    # 법인 / 사업자 / 제작업체 참여 근거 필요.
    # -----------------------------------------------------

    joint_axoo = (

        joint_status
        in {
            "YES",
            "CONDITIONAL"
        }

        and

        any(

            party
            in {
                "CORPORATION",
                "PRODUCTION_COMPANY",
                "BUSINESS"
            }

            for party
            in joint_parties

        )
    )


    if (
        joint_axoo
        or
        production_company_joint
        in {
            "YES",
            "CONDITIONAL"
        }
    ):

        modes.append(
            "JOINT"
        )


    # -----------------------------------------------------
    # PROXY
    # -----------------------------------------------------

    if (
        proxy_submission
        ==
        "YES"
    ):

        modes.append(
            "PROXY"
        )


    # -----------------------------------------------------
    # BLOCKED
    # -----------------------------------------------------

    if (
        blocked_evidence
        and
        not modes
    ):

        modes.append(
            "BLOCKED"
        )


    # -----------------------------------------------------
    # ARTIST ONLY
    # -----------------------------------------------------

    if (
        not blocked_evidence
        and
        applicant_type
        in {
            "ARTIST",
            "INDIVIDUAL"
        }
        and
        not any(

            mode
            in {
                "DIRECT",
                "JOINT",
                "PROXY"
            }

            for mode
            in modes

        )
    ):

        modes.append(
            "ARTIST_ONLY"
        )


    # -----------------------------------------------------
    # CHECK
    # -----------------------------------------------------

    if not modes:

        modes = [
            "CHECK"
        ]


    return unique(
        modes
    )


# ---------------------------------------------------------
# CONFIDENCE / PRIMARY
# ---------------------------------------------------------

def confidence_for(
    applicant_type,
    modes,
    evidence
):

    if (
        modes
        ==
        ["CHECK"]
    ):

        return (
            "LOW"
        )


    if (
        applicant_type
        ==
        "UNCLEAR"
    ):

        return (
            "LOW"
        )


    if evidence:

        return (
            "HIGH"
        )


    return (
        "MEDIUM"
    )


def primary_mode(
    modes,
    schema
):

    priority = (
        schema[
            "axoo_entry_mode"
        ][
            "primary_priority"
        ]
    )


    for mode in priority:

        if mode in modes:

            return mode


    return (
        "CHECK"
    )


def build_evidence(
    *groups
):

    values = []


    for group in groups:

        values.extend(
            group or []
        )


    values = unique(
        values
    )


    return " | ".join(
        values[:6]
    )


# ---------------------------------------------------------
# ANALYZE
# ---------------------------------------------------------

def analyze(
    data,
    schema
):

    text = get_document_text(
        data
    )

    lines = get_lines(
        text
    )


    # -----------------------------------------------------
    # v1.3
    #
    # 문서 전체에서 모든 자격 섹션 수집
    #
    # 예:
    # 1) 공고 요약
    #    응모자격 ... 대한민국 국적을 가진 자
    #
    # 2) 상세 공모지침서
    #    응모자격 ... 대한민국 국적을 가진 자(작가)
    #
    # 둘 다 분석
    # -----------------------------------------------------

    eligibility_lines = section_slices(

        lines,

        [
            "응모자격",
            "참가자격",
            "신청자격"
        ],

        max_lines=12
    )


    (
        applicant_type,
        applicant_evidence
    ) = infer_applicant_type(

        eligibility_lines,
        lines
    )


    (
        proxy_submission,
        proxy_scope,
        proxy_evidence
    ) = infer_proxy(
        lines
    )


    (
        power_of_attorney,
        power_evidence
    ) = infer_power_of_attorney(
        lines
    )


    (
        joint_application,
        joint_evidence
    ) = infer_joint(
        lines
    )


    (
        production_company_joint,
        production_evidence
    ) = infer_production_company_joint(

        joint_application,
        lines
    )


    # 제작업체 공동응모가 명확한데
    # joint_application이 비어 있으면 정합성 보정
    if (
        joint_application
        ==
        "NOT_STATED"
        and
        production_company_joint
        in {
            "YES",
            "CONDITIONAL"
        }
    ):

        joint_application = (

            "CONDITIONAL"

            if
            production_company_joint
            ==
            "CONDITIONAL"

            else
            "YES"
        )


    (
        joint_allowed_parties,
        joint_party_evidence
    ) = infer_joint_parties(

        joint_application,
        joint_evidence,
        production_company_joint,
        production_evidence
    )


    blocked_evidence = infer_blocked(
        lines
    )


    evidence = build_evidence(

        applicant_evidence,
        proxy_evidence,
        power_evidence,
        joint_evidence,
        joint_party_evidence,
        production_evidence,
        blocked_evidence
    )


    modes = choose_modes(

        applicant_type,
        proxy_submission,
        joint_application,
        joint_allowed_parties,
        production_company_joint,
        blocked_evidence
    )


    confidence = confidence_for(

        applicant_type,
        modes,
        evidence
    )


    # LOW confidence는 반드시 CHECK
    if (
        confidence
        ==
        "LOW"
    ):

        modes = [
            "CHECK"
        ]


    primary = primary_mode(

        modes,
        schema
    )


    sort_priority = int(

        schema[
            "axoo_entry_mode"
        ][
            "sort_priority"
        ]
        .get(
            primary,
            80
        )
    )


    return {

        "applicant_type":
            applicant_type,

        "axoo_entry_mode":
            modes,

        "primary_axoo_entry_mode":
            primary,

        "proxy_submission":
            proxy_submission,

        "proxy_scope":
            proxy_scope,

        "power_of_attorney":
            power_of_attorney,

        "joint_application":
            joint_application,

        "joint_allowed_parties":
            joint_allowed_parties,

        "production_company_joint":
            production_company_joint,

        "participation_evidence":
            evidence,

        "participation_confidence":
            confidence,

        "entry_sort_priority":
            sort_priority
    }


# ---------------------------------------------------------
# VALIDATION
# ---------------------------------------------------------

def validate(
    result,
    schema
):

    checks = {

        "applicant_type":
            schema[
                "applicant_type"
            ][
                "values"
            ],

        "proxy_submission":
            schema[
                "proxy_submission"
            ][
                "values"
            ],

        "proxy_scope":
            schema[
                "proxy_scope"
            ][
                "values"
            ],

        "power_of_attorney":
            schema[
                "power_of_attorney"
            ][
                "values"
            ],

        "joint_application":
            schema[
                "joint_application"
            ][
                "values"
            ],

        "production_company_joint":
            schema[
                "production_company_joint"
            ][
                "values"
            ],

        "participation_confidence":
            schema[
                "participation_confidence"
            ][
                "values"
            ]
    }


    for key, allowed in checks.items():

        if (
            result.get(
                key
            )
            not in
            allowed
        ):

            raise ValueError(
                "Invalid "
                +
                key
                +
                ": "
                +
                str(
                    result.get(
                        key
                    )
                )
            )


    allowed_modes = set(

        schema[
            "axoo_entry_mode"
        ][
            "values"
        ]
    )


    for mode in result.get(
        "axoo_entry_mode",
        []
    ):

        if (
            mode
            not in
            allowed_modes
        ):

            raise ValueError(
                "Invalid axoo_entry_mode: "
                +
                mode
            )


    allowed_parties = set(

        schema[
            "joint_allowed_parties"
        ][
            "values"
        ]
    )


    for party in result.get(
        "joint_allowed_parties",
        []
    ):

        if (
            party
            not in
            allowed_parties
        ):

            raise ValueError(
                "Invalid joint_allowed_parties: "
                +
                party
            )


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    if not RESEARCH_ID:

        raise SystemExit(
            "ART_NOTICE_ID is required"
        )


    input_path = (

        INPUT_DIR
        /
        (
            RESEARCH_ID
            +
            ".json"
        )
    )


    if not input_path.exists():

        raise SystemExit(
            "Input not found: "
            +
            str(
                input_path
            )
        )


    if not SCHEMA_PATH.exists():

        raise SystemExit(
            "Schema not found: "
            +
            str(
                SCHEMA_PATH
            )
        )


    data = load_json(
        input_path
    )


    schema = load_json(
        SCHEMA_PATH
    )


    result = analyze(
        data,
        schema
    )


    validate(
        result,
        schema
    )


    output = {

        "researchId":
            RESEARCH_ID,

        "title":
            data.get(
                "title",
                ""
            ),

        "status":
            "ok",

        "generatedAt":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "schemaVersion":
            schema.get(
                "version",
                "1.0.0"
            ),

        "participation":
            result
    }


    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )


    output_path = (

        OUTPUT_DIR
        /
        (
            RESEARCH_ID
            +
            ".json"
        )
    )


    output_path.write_text(

        json.dumps(
            output,
            ensure_ascii=False,
            indent=2
        )
        +
        "\n",

        encoding="utf-8"
    )


    print(

        json.dumps(
            output,
            ensure_ascii=False,
            indent=2
        )
    )


if __name__ == "__main__":

    main()
