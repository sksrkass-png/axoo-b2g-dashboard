import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


# =========================================================
# AXOO B2G
# ART PARTICIPATION INDEX BUILDER v1.0
#
# INPUT
# data/art_participation_analysis/*.json
#
# SCHEMA
# data/art_participation_schema.json
#
# OUTPUT
# data/art_participation_index.json
#
# PURPOSE
# - 개별 참여방식 분석 JSON을
#   Research Dashboard가 한 번에 읽을 수 있는
#   단일 Index JSON으로 통합
#
# - art_commissions.json 수정하지 않음
# - art_commissions_archive.json 수정하지 않음
# - Project Control 데이터 수정하지 않음
#
# MATCH STRATEGY
# 1. researchId
# 2. normalized title
#
# 같은 제목의 분석 결과가 여러 개 있어도
# 판정 내용이 동일하면 안전하게 하나로 통합
#
# 서로 다른 판정이면
# CHECK / CONFLICT로 강등
# =========================================================


ROOT_DIR = Path(
    __file__
).resolve().parent.parent


ANALYSIS_DIR = (
    ROOT_DIR
    /
    "data"
    /
    "art_participation_analysis"
)


SCHEMA_PATH = (
    ROOT_DIR
    /
    "data"
    /
    "art_participation_schema.json"
)


OUTPUT_PATH = (
    ROOT_DIR
    /
    "data"
    /
    "art_participation_index.json"
)


REQUIRED_FIELDS = [

    "applicant_type",
    "axoo_entry_mode",
    "primary_axoo_entry_mode",
    "proxy_submission",
    "proxy_scope",
    "power_of_attorney",
    "joint_application",
    "joint_allowed_parties",
    "production_company_joint",
    "participation_evidence",
    "participation_confidence",
    "entry_sort_priority"
]


# ---------------------------------------------------------
# BASIC
# ---------------------------------------------------------

def load_json(
    path
):

    return json.loads(
        path.read_text(
            encoding="utf-8"
        )
    )


def normalize_title(
    value
):

    text = unicodedata.normalize(
        "NFKC",
        str(
            value or ""
        )
    )

    text = text.lower().strip()


    # 공백 / 문장부호 제거
    # 한글, 영문, 숫자, 한자 등
    # 실제 글자 자체는 유지
    text = re.sub(
        r"[\W_]+",
        "",
        text,
        flags=re.UNICODE
    )


    return text


def participation_fingerprint(
    participation
):

    relevant = {

        key:
            participation.get(
                key
            )

        for key
        in REQUIRED_FIELDS
    }


    return json.dumps(
        relevant,
        ensure_ascii=False,
        sort_keys=True,
        separators=(
            ",",
            ":"
        )
    )


# ---------------------------------------------------------
# VALIDATION
# ---------------------------------------------------------

def validate_participation(
    participation,
    schema
):

    missing = [

        key

        for key
        in REQUIRED_FIELDS

        if key
        not in
        participation
    ]


    if missing:

        raise ValueError(
            "Missing participation fields: "
            +
            ", ".join(
                missing
            )
        )


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

        value = participation.get(
            key
        )


        if value not in allowed:

            raise ValueError(
                f"Invalid {key}: {value}"
            )


    allowed_modes = set(

        schema[
            "axoo_entry_mode"
        ][
            "values"
        ]
    )


    for mode in participation.get(
        "axoo_entry_mode",
        []
    ):

        if mode not in allowed_modes:

            raise ValueError(
                "Invalid axoo_entry_mode: "
                +
                str(
                    mode
                )
            )


    allowed_parties = set(

        schema[
            "joint_allowed_parties"
        ][
            "values"
        ]
    )


    for party in participation.get(
        "joint_allowed_parties",
        []
    ):

        if party not in allowed_parties:

            raise ValueError(
                "Invalid joint_allowed_parties: "
                +
                str(
                    party
                )
            )


# ---------------------------------------------------------
# RECORD LOAD
# ---------------------------------------------------------

def load_records(
    schema
):

    records = []


    if not ANALYSIS_DIR.exists():

        return records


    for path in sorted(
        ANALYSIS_DIR.glob(
            "*.json"
        )
    ):

        data = load_json(
            path
        )


        if (
            data.get(
                "status"
            )
            !=
            "ok"
        ):

            raise ValueError(
                "Participation analysis status is not OK: "
                +
                path.name
            )


        research_id = str(
            data.get(
                "researchId",
                ""
            )
        ).strip()


        if not research_id:

            raise ValueError(
                "Missing researchId: "
                +
                path.name
            )


        title = str(
            data.get(
                "title",
                ""
            )
        ).strip()


        participation = data.get(
            "participation",
            {}
        )


        if not isinstance(
            participation,
            dict
        ):

            raise ValueError(
                "Invalid participation object: "
                +
                path.name
            )


        validate_participation(
            participation,
            schema
        )


        records.append({

            "researchId":
                research_id,

            "title":
                title,

            "titleKey":
                normalize_title(
                    title
                ),

            "generatedAt":
                data.get(
                    "generatedAt",
                    ""
                ),

            "schemaVersion":
                data.get(
                    "schemaVersion",
                    schema.get(
                        "version",
                        "1.0.0"
                    )
                ),

            "participation":
                participation
        })


    return records


# ---------------------------------------------------------
# TITLE INDEX
# ---------------------------------------------------------

def build_title_index(
    records,
    schema
):

    groups = defaultdict(
        list
    )


    for record in records:

        title_key = record.get(
            "titleKey",
            ""
        )


        if not title_key:

            continue


        groups[
            title_key
        ].append(
            record
        )


    output = {}

    conflict_count = 0


    defaults = dict(

        schema.get(
            "record_defaults",
            {}
        )
    )


    for title_key in sorted(
        groups.keys()
    ):

        group = groups[
            title_key
        ]


        fingerprints = defaultdict(
            list
        )


        for record in group:

            fingerprint = (
                participation_fingerprint(
                    record[
                        "participation"
                    ]
                )
            )


            fingerprints[
                fingerprint
            ].append(
                record
            )


        research_ids = sorted(

            record[
                "researchId"
            ]

            for record
            in group
        )


        if (
            len(
                fingerprints
            )
            ==
            1
        ):

            participation = dict(
                group[0][
                    "participation"
                ]
            )


            output[
                title_key
            ] = {

                "status":
                    "OK",

                "title":
                    group[0].get(
                        "title",
                        ""
                    ),

                "researchIds":
                    research_ids,

                "participation":
                    participation
            }


            continue


        # -------------------------------------------------
        # 동일 제목인데 판정 결과가 서로 다르면
        # Dashboard에서 추정하지 않도록 CHECK 강등
        # -------------------------------------------------

        conflict_count += 1


        conflict_participation = dict(
            defaults
        )


        conflict_participation[
            "participation_evidence"
        ] = (
            "동일 제목의 참여방식 분석 결과가 서로 달라 확인이 필요합니다."
        )


        output[
            title_key
        ] = {

            "status":
                "CONFLICT",

            "title":
                group[0].get(
                    "title",
                    ""
                ),

            "researchIds":
                research_ids,

            "participation":
                conflict_participation
        }


    return (
        output,
        conflict_count
    )


# ---------------------------------------------------------
# RESEARCH ID INDEX
# ---------------------------------------------------------

def build_research_index(
    records
):

    output = {}


    for record in records:

        research_id = record[
            "researchId"
        ]


        output[
            research_id
        ] = {

            "title":
                record.get(
                    "title",
                    ""
                ),

            "titleKey":
                record.get(
                    "titleKey",
                    ""
                ),

            "generatedAt":
                record.get(
                    "generatedAt",
                    ""
                ),

            "participation":
                record[
                    "participation"
                ]
        }


    return output


# ---------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------

def build_mode_counts(
    records
):

    counter = Counter()


    for record in records:

        mode = (

            record[
                "participation"
            ]
            .get(
                "primary_axoo_entry_mode",
                "CHECK"
            )
        )


        counter[
            mode
        ] += 1


    preferred_order = [

        "DIRECT",
        "JOINT",
        "PROXY",
        "ARTIST_ONLY",
        "CHECK",
        "BLOCKED"
    ]


    result = {}


    for mode in preferred_order:

        result[
            mode
        ] = int(
            counter.get(
                mode,
                0
            )
        )


    return result


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    if not SCHEMA_PATH.exists():

        raise SystemExit(
            "Schema not found: "
            +
            str(
                SCHEMA_PATH
            )
        )


    schema = load_json(
        SCHEMA_PATH
    )


    records = load_records(
        schema
    )


    if not records:

        raise SystemExit(
            "No participation analysis records found"
        )


    research_index = (
        build_research_index(
            records
        )
    )


    (
        title_index,
        conflict_count
    ) = build_title_index(
        records,
        schema
    )


    mode_counts = (
        build_mode_counts(
            records
        )
    )


    output = {

        "version":
            "1.0.0",

        "schemaVersion":
            schema.get(
                "version",
                "1.0.0"
            ),

        "generatedAt":
            datetime.now(
                timezone.utc
            ).isoformat(),

        "sourceCount":
            len(
                records
            ),

        "researchIdCount":
            len(
                research_index
            ),

        "titleGroupCount":
            len(
                title_index
            ),

        "conflictCount":
            conflict_count,

        "modeCounts":
            mode_counts,

        "records":
            records,

        "byResearchId":
            research_index,

        "byTitle":
            title_index
    }


    OUTPUT_PATH.write_text(

        json.dumps(
            output,
            ensure_ascii=False,
            indent=2
        )
        +
        "\n",

        encoding="utf-8"
    )


    print("")
    print(
        "========================================"
    )

    print(
        "AXOO ART PARTICIPATION INDEX COMPLETE"
    )

    print(
        "Source records:",
        len(
            records
        )
    )

    print(
        "Title groups:",
        len(
            title_index
        )
    )

    print(
        "Conflicts:",
        conflict_count
    )

    print(
        "Modes:",
        json.dumps(
            mode_counts,
            ensure_ascii=False
        )
    )

    print(
        "Output:",
        OUTPUT_PATH
    )

    print(
        "========================================"
    )


if __name__ == "__main__":

    main()
