import json
import sys
from pathlib import Path


# =========================================================
# AXOO B2G
# ART PARTICIPATION RULE QA v1.0
#
# 실제 운영 데이터 수정 없음
# 임시 JSON 생성 없음
# 메모리 안에서 판정 규칙만 검증
#
# TEST CASES
# 1. ARTIST_ONLY
# 2. BLOCKED
# 3. PROXY
# 4. JOINT
# 5. DIRECT
# 6. CHECK
# =========================================================


ROOT = Path(__file__).resolve().parents[1]

SCRIPTS_DIR = ROOT / "scripts"

if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(
        0,
        str(SCRIPTS_DIR)
    )


import build_art_participation_analysis as analyzer


SCHEMA_PATH = (
    ROOT
    / "data"
    / "art_participation_schema.json"
)


SCHEMA = json.loads(
    SCHEMA_PATH.read_text(
        encoding="utf-8"
    )
)


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def make_notice(
    title,
    text
):

    return {
        "researchId":
            "rule-test",

        "title":
            title,

        "status":
            "ok",

        "documents": [
            {
                "name":
                    "rule-test.txt",

                "status":
                    "ok",

                "text":
                    text
            }
        ]
    }


def assert_equal(
    case_name,
    field,
    actual,
    expected
):

    if actual != expected:

        raise AssertionError(
            "\n"
            + "=" * 60
            + "\nCASE FAILED: "
            + case_name
            + "\nFIELD: "
            + field
            + "\nEXPECTED: "
            + repr(expected)
            + "\nACTUAL: "
            + repr(actual)
            + "\n"
            + "=" * 60
        )


def run_case(
    case
):

    data = make_notice(
        case["name"],
        case["text"]
    )


    result = analyzer.analyze(
        data,
        SCHEMA
    )


    expected = case[
        "expected"
    ]


    for field, value in expected.items():

        assert_equal(
            case["name"],
            field,
            result.get(field),
            value
        )


    print(
        "✅ PASS | "
        + case["name"]
        + " | "
        + result.get(
            "primary_axoo_entry_mode",
            ""
        )
    )


    return result


# ---------------------------------------------------------
# TEST CASES
# ---------------------------------------------------------

CASES = [

    # =====================================================
    # 1. ARTIST ONLY
    # =====================================================

    {
        "name":
            "ARTIST_ONLY",

        "text":
            """
5. 응모자격
응모자는 작품을 제작·설치할 수 있는 작가
단독 응모만 가능, 작가 1인당 1개 작품만 응모 가능
            """,

        "expected": {
            "applicant_type":
                "ARTIST",

            "axoo_entry_mode":
                [
                    "ARTIST_ONLY"
                ],

            "primary_axoo_entry_mode":
                "ARTIST_ONLY",

            "proxy_submission":
                "NOT_STATED",

            "joint_application":
                "NO",

            "joint_allowed_parties":
                [],

            "participation_confidence":
                "HIGH",

            "entry_sort_priority":
                40
        }
    },


    # =====================================================
    # 2. BLOCKED
    # =====================================================

    {
        "name":
            "BLOCKED",

        "text":
            """
5. 응모자격
공고일 현재 만 20세 이상인 개인
개인을 대상으로 하는 공모로 법인이나 사업자로 응모불가
            """,

        "expected": {
            "applicant_type":
                "INDIVIDUAL",

            "axoo_entry_mode":
                [
                    "BLOCKED"
                ],

            "primary_axoo_entry_mode":
                "BLOCKED",

            "proxy_submission":
                "NOT_STATED",

            "joint_application":
                "NOT_STATED",

            "joint_allowed_parties":
                [],

            "participation_confidence":
                "HIGH",

            "entry_sort_priority":
                90
        }
    },


    # =====================================================
    # 3. PROXY
    # =====================================================

    {
        "name":
            "PROXY",

        "text":
            """
5. 응모자격
응모자는 작품을 제작·설치할 수 있는 작가

8. 접수방법
대리접수 시 위임장 및 대리인 신분증 제출
            """,

        "expected": {
            "applicant_type":
                "ARTIST",

            "axoo_entry_mode":
                [
                    "PROXY"
                ],

            "primary_axoo_entry_mode":
                "PROXY",

            "proxy_submission":
                "YES",

            "proxy_scope":
                "SUBMISSION_ONLY",

            "power_of_attorney":
                "REQUIRED",

            "joint_application":
                "NOT_STATED",

            "participation_confidence":
                "HIGH",

            "entry_sort_priority":
                30
        }
    },


    # =====================================================
    # 4. JOINT
    # =====================================================

    {
        "name":
            "JOINT",

        "text":
            """
5. 응모자격
응모자는 미술작품 제작 및 설치가 가능한 작가

6. 공동응모
작가 및 제작업체 공동응모 가능
            """,

        "expected": {
            "applicant_type":
                "ARTIST",

            "axoo_entry_mode":
                [
                    "JOINT"
                ],

            "primary_axoo_entry_mode":
                "JOINT",

            "joint_application":
                "YES",

            "joint_allowed_parties":
                [
                    "PRODUCTION_COMPANY",
                    "ARTIST"
                ],

            "production_company_joint":
                "YES",

            "participation_confidence":
                "HIGH",

            "entry_sort_priority":
                20
        }
    },


    # =====================================================
    # 5. DIRECT
    # =====================================================

    {
        "name":
            "DIRECT",

        "text":
            """
5. 응모자격
대한민국 국적을 가진 개인 또는 법인 응모 가능
별도의 법인 참여 제한 없음
            """,

        "expected": {
            "applicant_type":
                "INDIVIDUAL_OR_CORPORATION",

            "axoo_entry_mode":
                [
                    "DIRECT"
                ],

            "primary_axoo_entry_mode":
                "DIRECT",

            "proxy_submission":
                "NOT_STATED",

            "joint_application":
                "NOT_STATED",

            "participation_confidence":
                "HIGH",

            "entry_sort_priority":
                10
        }
    },


    # =====================================================
    # 6. CHECK
    # =====================================================

    {
        "name":
            "CHECK",

        "text":
            """
5. 응모자격
공고일 현재 미술작품 제작·설치가 가능한 자
            """,

        "expected": {
            "applicant_type":
                "UNCLEAR",

            "axoo_entry_mode":
                [
                    "CHECK"
                ],

            "primary_axoo_entry_mode":
                "CHECK",

            "proxy_submission":
                "NOT_STATED",

            "joint_application":
                "NOT_STATED",

            "participation_confidence":
                "LOW",

            "entry_sort_priority":
                80
        }
    }
]


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    print("")
    print(
        "========================================"
    )

    print(
        "AXOO ART PARTICIPATION RULE QA"
    )

    print(
        "========================================"
    )


    passed = 0


    for case in CASES:

        run_case(
            case
        )

        passed += 1


    print("")
    print(
        "========================================"
    )

    print(
        "✅ ALL RULE TESTS PASSED"
    )

    print(
        "PASSED: "
        + str(passed)
        + " / "
        + str(len(CASES))
    )

    print(
        "========================================"
    )


if __name__ == "__main__":
    main()
