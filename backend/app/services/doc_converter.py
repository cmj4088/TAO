""".doc→.docx 转换 + docx→PDF 转换
优先 LibreOffice，降级 Word COM
"""
import os
import uuid
import shutil
import subprocess
import tempfile
from pathlib import Path

TEMP_DIR = os.path.join(tempfile.gettempdir(), "tao_app02")
os.makedirs(TEMP_DIR, exist_ok=True)


def _find_libreoffice() -> str | None:
    common_paths = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for p in common_paths:
        if os.path.exists(p):
            return p
    soffice = shutil.which("soffice")
    if soffice:
        return soffice
    return None


def convert_with_libreoffice(filepath: str, fmt: str) -> str | None:
    soffice = _find_libreoffice()
    if not soffice:
        return None

    out_dir = os.path.join(TEMP_DIR, str(uuid.uuid4()))
    os.makedirs(out_dir, exist_ok=True)
    shutil.copy2(filepath, os.path.join(out_dir, os.path.basename(filepath)))

    try:
        result = subprocess.run(
            [soffice, "--headless", "--convert-to", fmt, "--outdir", out_dir, filepath],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            return None

        base = os.path.splitext(os.path.basename(filepath))[0]
        converted = os.path.join(out_dir, f"{base}.{fmt}")
        if os.path.exists(converted):
            return converted

        for f in os.listdir(out_dir):
            if f.lower().endswith(f".{fmt}"):
                return os.path.join(out_dir, f)
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def convert_with_word_com(filepath: str, fmt: str) -> str | None:
    import pythoncom
    import win32com.client

    fmt_map = {"docx": 16, "pdf": 17}
    word_fmt = fmt_map.get(fmt, 16)

    out_path = os.path.join(TEMP_DIR, str(uuid.uuid4()), os.path.basename(filepath))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    word = None
    try:
        pythoncom.CoInitialize()
        word = win32com.client.Dispatch("Word.Application")
        word.Visible = False
        word.DisplayAlerts = False

        doc = word.Documents.Open(filepath, ReadOnly=True)
        base = os.path.splitext(out_path)[0]
        out = f"{base}.{fmt}"
        doc.SaveAs2(out, FileFormat=word_fmt)
        doc.Close()

        if os.path.exists(out):
            return out
        return None
    except Exception:
        return None
    finally:
        if word:
            try:
                word.Quit()
            except Exception:
                pass


def convert_doc_to_docx(filepath: str) -> str | None:
    result = convert_with_libreoffice(filepath, "docx")
    if result:
        return result
    return convert_with_word_com(filepath, "docx")


def convert_docx_to_pdf(filepath: str) -> str | None:
    result = convert_with_libreoffice(filepath, "pdf")
    if result:
        return result
    return convert_with_word_com(filepath, "pdf")


def cleanup_temp(subdir: str):
    path = os.path.join(TEMP_DIR, subdir)
    if os.path.exists(path):
        shutil.rmtree(path, ignore_errors=True)
