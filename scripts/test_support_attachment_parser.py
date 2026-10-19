#!/usr/bin/env python3
"""Offline P1 attachment extraction fixtures: no external URLs or credentials."""
import io,json,subprocess,sys,zipfile

def run(fmt,blob):
    proc=subprocess.run([sys.executable,"scripts/extract_support_attachment.py",fmt],input=blob,capture_output=True,timeout=18)
    assert proc.returncode==0,proc.stderr.decode("utf-8",errors="replace")
    return json.loads(proc.stdout)

def zipped(name,xml):
    b=io.BytesIO()
    with zipfile.ZipFile(b,"w") as z:z.writestr(name,xml)
    return b.getvalue()

docx=zipped("word/document.xml",'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>법인 사업자등록증과 사업계획서, 예산서를 제출해야 합니다.</w:t></w:r></w:p></w:body></w:document>')
hwpx=zipped("Contents/section0.xml",'<hs:sec xmlns:hs="urn:hs" xmlns:hp="urn:hp"><hp:p><hp:t>지원대상: 등록된 예술기업 및 문화예술 기획 법인입니다.</hp:t></hp:p></hs:sec>')
assert run("docx",docx)["status"]=="parsed"
assert "사업자등록증" in run("docx",docx)["text"]
assert run("hwpx",hwpx)["status"]=="parsed"
assert "예술기업" in run("hwpx",hwpx)["text"]
assert run("hwp",b"\0"*100)["status"]=="unsupported"
assert run("hwpx",b"fake binary")["status"]=="failed"
from pypdf import PdfWriter
writer=PdfWriter();writer.add_blank_page(width=595,height=842)
buf=io.BytesIO();writer.write(buf)
assert run("pdf",buf.getvalue())["status"]=="image_or_empty"
print("P1 document extraction tests passed: PDF/HWPX/DOCX + unsupported HWP")
