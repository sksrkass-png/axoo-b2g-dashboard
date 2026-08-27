from __future__ import annotations

import io
import json
import os
import re
import struct
import sys
import urllib.request
import zipfile
import zlib

from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET


# =========================================================
# AXOO B2G
# 건축물 미술작품 공고 첨부파일 TEXT 추출기
#
# INPUT
# data/art_notice_attachments.json
#
# OUTPUT
# data/art_notice_text/<RESEARCH_ID>.json
#
# DEPENDENCIES
# olefile
# pypdf
#
# TEST
# ART_NOTICE_ID=external-10a9592b4d5eec3a
# =========================================================


ROOT_DIR = (
    Path(__file__)
    .resolve()
    .parent
    .parent
)


ATTACHMENTS_PATH = (
    ROOT_DIR
    / "data"
    / "art_notice_attachments.json"
)


OUTPUT_DIR = (
    ROOT_DIR
    / "data"
    / "art_notice_text"
)


TARGET_ID = (
    os.environ
    .get(
        "ART_NOTICE_ID",
        ""
    )
    .strip()
)


MAX_TEXT_CHARS = 500_000


USER_AGENT = (
    "Mozilla/5.0 "
    "AXOO-B2G-Research/1.0"
)


# ---------------------------------------------------------
# 기본 유틸
# ---------------------------------------------------------

def normalize_text(
    text: str
) -> str:

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
            "\x00",
            ""
        )
    )


    lines: list[str] = []


    for line in text.splitlines():

        line = re.sub(
            r"[ \t]+",
            " ",
            line
        ).strip()


        if line:

            lines.append(
                line
            )


    return "\n".join(
        lines
    )



def safe_text(
    text: str
) -> tuple[str, bool]:

    text = normalize_text(
        text
    )


    if (
        len(text) <=
        MAX_TEXT_CHARS
    ):

        return (
            text,
            False
        )


    return (
        text[
            :MAX_TEXT_CHARS
        ],
        True
    )



def get_extension(
    name: str
) -> str:

    return (
        Path(
            name
        )
        .suffix
        .lower()
    )



def download_file(
    url: str,
    referer: str = ""
) -> bytes:

    headers = {
        "User-Agent":
            USER_AGENT,

        "Accept":
            "*/*"
    }


    if referer:

        headers[
            "Referer"
        ] = referer


    request = (
        urllib.request
        .Request(
            url,
            headers=headers
        )
    )


    with (
        urllib.request
        .urlopen(
            request,
            timeout=60
        )
    ) as response:

        return response.read()


# ---------------------------------------------------------
# HWPX
# ---------------------------------------------------------

def extract_hwpx(
    data: bytes
) -> str:

    texts: list[str] = []


    with zipfile.ZipFile(
        io.BytesIO(
            data
        )
    ) as archive:

        section_names = [
            name
            for name
            in archive.namelist()
            if re.search(
                r"(?:^|/)section\d+\.xml$",
                name,
                re.IGNORECASE
            )
        ]


        section_names.sort(
            key=lambda value: (
                int(
                    re.search(
                        r"section(\d+)",
                        value,
                        re.IGNORECASE
                    ).group(1)
                )
                if re.search(
                    r"section(\d+)",
                    value,
                    re.IGNORECASE
                )
                else 999999
            )
        )


        for name in section_names:

            xml_data = (
                archive
                .read(
                    name
                )
            )


            root = (
                ET.fromstring(
                    xml_data
                )
            )


            section_texts: list[str] = []


            for element in root.iter():

                if (
                    element.text and
                    element.text.strip()
                ):

                    section_texts.append(
                        element.text
                    )


            if section_texts:

                texts.append(
                    "\n".join(
                        section_texts
                    )
                )


    return normalize_text(
        "\n".join(
            texts
        )
    )


# ---------------------------------------------------------
# PDF
# ---------------------------------------------------------

def extract_pdf(
    data: bytes
) -> str:

    try:

        from pypdf import PdfReader

    except ImportError as error:

        raise RuntimeError(
            "pypdf가 설치되어 있지 않습니다."
        ) from error


    reader = PdfReader(
        io.BytesIO(
            data
        )
    )


    texts: list[str] = []


    for page in reader.pages:

        page_text = (
            page.extract_text()
            or ""
        )


        if page_text.strip():

            texts.append(
                page_text
            )


    return normalize_text(
        "\n".join(
            texts
        )
    )


# ---------------------------------------------------------
# HWP 5.x
# ---------------------------------------------------------

HWPTAG_PARA_TEXT = 67


def clean_hwp_para(
    raw_text: str
) -> str:

    output: list[str] = []


    for char in raw_text:

        code = ord(
            char
        )


        if char in (
            "\n",
            "\t"
        ):

            output.append(
                char
            )

            continue


        # HWP 내부 제어문자 제거
        if code < 32:

            continue


        # Unicode replacement 제거
        if code == 0xFFFD:

            continue


        output.append(
            char
        )


    return "".join(
        output
    )



def parse_hwp_records(
    stream_data: bytes
) -> list[str]:

    paragraphs: list[str] = []


    position = 0
    total_length = len(
        stream_data
    )


    while (
        position + 4 <=
        total_length
    ):

        header = struct.unpack_from(
            "<I",
            stream_data,
            position
        )[0]


        position += 4


        tag_id = (
            header &
            0x3FF
        )


        size = (
            header >>
            20
        ) & 0xFFF


        if size == 0xFFF:

            if (
                position + 4 >
                total_length
            ):

                break


            size = struct.unpack_from(
                "<I",
                stream_data,
                position
            )[0]


            position += 4


        if (
            position + size >
            total_length
        ):

            break


        payload = (
            stream_data[
                position:
                position + size
            ]
        )


        position += size


        if (
            tag_id !=
            HWPTAG_PARA_TEXT
        ):

            continue


        try:

            paragraph = (
                payload
                .decode(
                    "utf-16-le",
                    errors="ignore"
                )
            )

        except Exception:

            continue


        paragraph = clean_hwp_para(
            paragraph
        ).strip()


        if paragraph:

            paragraphs.append(
                paragraph
            )


    return paragraphs



def extract_hwp(
    data: bytes
) -> str:

    try:

        import olefile

    except ImportError as error:

        raise RuntimeError(
            "olefile이 설치되어 있지 않습니다."
        ) from error


    source = io.BytesIO(
        data
    )


    if not olefile.isOleFile(
        source
    ):

        raise RuntimeError(
            "유효한 HWP OLE 파일이 아닙니다."
        )


    source.seek(
        0
    )


    ole = olefile.OleFileIO(
        source
    )


    try:

        compressed = False


        if ole.exists(
            "FileHeader"
        ):

            header = (
                ole
                .openstream(
                    "FileHeader"
                )
                .read()
            )


            if len(
                header
            ) >= 40:

                flags = struct.unpack_from(
                    "<I",
                    header,
                    36
                )[0]


                compressed = bool(
                    flags & 0x01
                )


        section_paths = []


        for stream_path in (
            ole.listdir(
                streams=True,
                storages=False
            )
        ):

            joined = "/".join(
                stream_path
            )


            if re.match(
                r"^BodyText/Section\d+$",
                joined,
                re.IGNORECASE
            ):

                section_paths.append(
                    stream_path
                )


        section_paths.sort(
            key=lambda value: (
                int(
                    re.search(
                        r"Section(\d+)",
                        "/".join(
                            value
                        ),
                        re.IGNORECASE
                    ).group(1)
                )
            )
        )


        paragraphs: list[str] = []


        for section_path in section_paths:

            section_data = (
                ole
                .openstream(
                    section_path
                )
                .read()
            )


            if compressed:

                try:

                    section_data = (
                        zlib.decompress(
                            section_data,
                            -15
                        )
                    )

                except zlib.error:

                    # 일부 HWP는 stream별 상태가 다를 수 있으므로
                    # 원본 stream으로 한 번 더 시도
                    pass


            paragraphs.extend(
                parse_hwp_records(
                    section_data
                )
            )


        full_text = normalize_text(
            "\n".join(
                paragraphs
            )
        )


        # BodyText 추출이 실패한 경우 Preview Text 사용
        if (
            not full_text and
            ole.exists(
                "PrvText"
            )
        ):

            preview = (
                ole
                .openstream(
                    "PrvText"
                )
                .read()
            )


            full_text = normalize_text(
                preview.decode(
                    "utf-16-le",
                    errors="ignore"
                )
            )


        return full_text

    finally:

        ole.close()


# ---------------------------------------------------------
# 파일 타입별 추출
# ---------------------------------------------------------

def extract_document_text(
    name: str,
    data: bytes
) -> str:

    extension = get_extension(
        name
    )


    if extension == ".hwp":

        return extract_hwp(
            data
        )


    if extension == ".hwpx":

        return extract_hwpx(
            data
        )


    if extension == ".pdf":

        return extract_pdf(
            data
        )


    raise RuntimeError(
        f"지원하지 않는 파일 형식: {extension}"
    )


# ---------------------------------------------------------
# 공고 한 건
# ---------------------------------------------------------

def process_notice(
    notice: dict[str, Any]
) -> dict[str, Any]:

    research_id = (
        str(
            notice.get(
                "researchId",
                ""
            )
        )
        .strip()
    )


    title = (
        str(
            notice.get(
                "title",
                ""
            )
        )
        .strip()
    )


    source_url = (
        str(
            notice.get(
                "sourceUrl",
                ""
            )
        )
        .strip()
    )


    print(
        "\n========================================"
    )

    print(
        research_id
    )

    print(
        title
    )

    print(
        "========================================"
    )


    documents: list[
        dict[str, Any]
    ] = []


    for attachment in (
        notice.get(
            "attachments",
            []
        )
        or []
    ):

        name = (
            str(
                attachment.get(
                    "name",
                    ""
                )
            )
            .strip()
        )


        url = (
            str(
                attachment.get(
                    "url",
                    ""
                )
            )
            .strip()
        )


        print(
            "\n[DOWNLOAD]",
            name
        )


        document: dict[str, Any] = {
            "name":
                name,

            "url":
                url,

            "extension":
                get_extension(
                    name
                ),

            "status":
                "pending",

            "text":
                "",

            "textLength":
                0,

            "truncated":
                False
        }


        try:

            data = download_file(
                url,
                source_url
            )


            print(
                "Bytes:",
                len(
                    data
                )
            )


            text = (
                extract_document_text(
                    name,
                    data
                )
            )


            text, truncated = safe_text(
                text
            )


            if text.strip():

                document[
                    "status"
                ] = "ok"

            else:

                if (
                    document[
                        "extension"
                    ] == ".pdf"
                ):

                    document[
                        "status"
                    ] = (
                        "empty_text_scan_possible"
                    )

                else:

                    document[
                        "status"
                    ] = (
                        "empty_text"
                    )


            document[
                "text"
            ] = text


            document[
                "textLength"
            ] = len(
                text
            )


            document[
                "truncated"
            ] = truncated


            print(
                "Text:",
                len(
                    text
                ),
                "chars"
            )


        except Exception as error:

            document[
                "status"
            ] = "error"


            document[
                "error"
            ] = str(
                error
            )


            print(
                "ERROR:",
                error
            )


        documents.append(
            document
        )


    success_count = sum(
        1
        for document
        in documents
        if document.get(
            "status"
        ) == "ok"
    )


    if (
        not documents
    ):

        status = (
            "no_attachments"
        )

    elif (
        success_count ==
        len(
            documents
        )
    ):

        status = (
            "ok"
        )

    elif (
        success_count >
        0
    ):

        status = (
            "partial"
        )

    else:

        status = (
            "failed"
        )


    return {
        "researchId":
            research_id,

        "title":
            title,

        "source":
            notice.get(
                "source",
                ""
            ),

        "sourceUrl":
            source_url,

        "status":
            status,

        "documentCount":
            len(
                documents
            ),

        "successCount":
            success_count,

        "documents":
            documents
    }


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

def main() -> None:

    if not ATTACHMENTS_PATH.exists():

        raise FileNotFoundError(
            "먼저 "
            "extract_art_notice_attachments.js를 "
            "실행해야 합니다.\n"
            f"Missing: {ATTACHMENTS_PATH}"
        )


    notices = json.loads(
        ATTACHMENTS_PATH.read_text(
            encoding="utf-8"
        )
    )


    if TARGET_ID:

        notices = [
            notice
            for notice
            in notices
            if notice.get(
                "researchId"
            ) == TARGET_ID
        ]


    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )


    print(
        "AXOO ART NOTICE TEXT EXTRACTOR"
    )

    print(
        "Targets:",
        len(
            notices
        )
    )


    for notice in notices:

        result = process_notice(
            notice
        )


        research_id = (
            result[
                "researchId"
            ]
        )


        if not research_id:

            continue


        output_path = (
            OUTPUT_DIR
            / f"{research_id}.json"
        )


        output_path.write_text(
            json.dumps(
                result,
                ensure_ascii=False,
                indent=2
            )
            + "\n",
            encoding="utf-8"
        )


        print(
            "\nSaved:",
            output_path.relative_to(
                ROOT_DIR
            )
        )


if __name__ == "__main__":

    try:

        main()

    except Exception as error:

        print(
            "\nFATAL:",
            error,
            file=sys.stderr
        )

        sys.exit(
            1
        )
