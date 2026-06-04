#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将指定目录下所有 .doc 文件转换为 .docx 格式。
使用 Microsoft Word COM 接口（仅 Windows，需安装 Word）。
用法：python convert_doc_to_docx.py <目标目录>
"""

import sys
import os
import time
import pythoncom
import win32com.client


def try_open_and_convert(word, doc_path, docx_path):
    """尝试用给定的 Word 实例打开并转换"""
    doc = word.Documents.Open(
        doc_path,
        ConfirmConversions=False,
        ReadOnly=True,
        AddToRecentFiles=False,
    )
    doc.SaveAs2(docx_path, FileFormat=16)
    doc.Close()
    return True


def convert_with_retry(doc_path, docx_path, max_retries=3):
    """带重试机制的转换，每次用独立的 Word 实例"""
    for attempt in range(max_retries):
        word = None
        try:
            pythoncom.CoInitialize()
            word = win32com.client.Dispatch("Word.Application")
            word.Visible = False
            word.DisplayAlerts = False

            try_open_and_convert(word, doc_path, docx_path)
            return True
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2)
        finally:
            if word:
                try:
                    word.Quit()
                except Exception:
                    pass
            time.sleep(0.5)
    return False


def main():
    if len(sys.argv) < 2:
        print("用法：python convert_doc_to_docx.py <目标目录>")
        sys.exit(1)

    root_dir = sys.argv[1]
    if not os.path.isdir(root_dir):
        print(f"目录不存在: {root_dir}")
        sys.exit(1)

    doc_files = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        for f in filenames:
            if f.lower().endswith(".doc") and not f.lower().endswith(".docx"):
                doc_files.append(os.path.join(dirpath, f))

    print(f"找到 {len(doc_files)} 个 .doc 文件")
    print("=" * 60)

    success = 0
    for doc_path in doc_files:
        docx_path = os.path.splitext(doc_path)[0] + ".docx"

        if os.path.exists(docx_path):
            print(f"  [跳过] 已存在: {os.path.basename(docx_path)}")
            success += 1
            continue

        ok = convert_with_retry(doc_path, docx_path)
        if ok:
            print(f"  [完成] {os.path.basename(doc_path)} -> {os.path.basename(docx_path)}")
            success += 1
        else:
            print(f"  [失败] {os.path.basename(doc_path)}: 重试{3}次均失败")

    print("=" * 60)
    print(f"转换完成: {success}/{len(doc_files)} 成功")


if __name__ == "__main__":
    main()
