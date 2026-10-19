#!/usr/bin/env python3
"""Extract only text from a bounded, already-downloaded official grant attachment.
stdin: <=10MB bytes; argv[1]: pdf, hwpx or docx. stdout: single JSON status.
Binary HWP and scanned documents are not silently treated as readable.
"""
import io, json, re, sys, zipfile, xml.etree.ElementTree as ET

MAX_INPUT=10*1024*1024
MAX_TEXT=26000
MAX_ZIP_INFLATED=40*1024*1024

def ret(status,text="",reason="",pages=0):
    print(json.dumps({"status":status,"text":re.sub(r"\s+"," ",text or "").strip()[:MAX_TEXT],"reason":str(reason)[:220],"pages":pages},ensure_ascii=False))

def main():
    fmt=(sys.argv[1] if len(sys.argv)>1 else "").lower()
    blob=sys.stdin.buffer.read(MAX_INPUT+1)
    if len(blob)>MAX_INPUT:return ret("too_large",reason="Attachment exceeds 10 MB limit")
    if fmt=="hwp":return ret("unsupported",reason="Binary HWP cannot be reliably extracted here; manually review original")
    if fmt=="pdf":
        try:
            from pypdf import PdfReader
        except ImportError:
            return ret("unsupported",reason="pypdf is not installed on runner")
        try:
            reader=PdfReader(io.BytesIO(blob),strict=False)
            num=len(reader.pages)
            texts=[]
            for page in list(reader.pages)[:35]:
                try:texts.append(page.extract_text(extraction_mode="plain") or "")
                except Exception:continue
                if sum(map(len,texts))>=MAX_TEXT:break
            text="\n".join(texts)
            return ret("parsed" if len(text.strip())>=30 else "image_or_empty",text,
                       "" if len(text.strip())>=30 else "No extractable text; possibly scanned PDF",num)
        except Exception as exc:
            return ret("failed",reason=type(exc).__name__)
    if fmt not in {"hwpx","docx"}:return ret("unsupported",reason="Unknown attachment type")
    if not zipfile.is_zipfile(io.BytesIO(blob)):return ret("failed",reason="Not a valid OOXML/HWPX ZIP")
    try:
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            files=z.infolist()
            if len(files)>800 or sum(x.file_size for x in files)>MAX_ZIP_INFLATED:
                return ret("too_large",reason="Compressed archive exceeds expansion limit")
            if fmt=="docx":names=["word/document.xml"]
            else:
                names=sorted([x.filename for x in files if re.search(r"Contents/section\d+\.xml$",x.filename,re.I)])
            if not names:return ret("failed",reason="No document text sections found")
            texts=[]
            for name in names[:45]:
                try:
                    tree=ET.fromstring(z.read(name))
                    for node in tree.iter():
                        tag=node.tag.rsplit("}",1)[-1].lower()
                        if tag in {"t","text"} and node.text:
                            texts.append(node.text)
                        elif tag in {"p","paragraph"}:texts.append("\n")
                except Exception:continue
                if sum(map(len,texts))>=MAX_TEXT:break
            text=" ".join(texts)
            return ret("parsed" if len(text.strip())>=30 else "image_or_empty",text,
                       "" if len(text.strip())>=30 else "No machine-readable text in document")
    except Exception as exc:
        return ret("failed",reason=type(exc).__name__)

if __name__=="__main__":main()
