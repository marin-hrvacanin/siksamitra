#!/usr/bin/env python
"""Dump the full imported line list (index, level, text) — fast, no torch."""
import html
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pdf_import import convert_pdf_to_html

PDF = r"C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf"
CLS2LVL = {'ql-doc-title': 'title', 'ql-doc-subtitle': 'subtitle',
           'ql-comment-style': 'comment', 'ql-doc-translation': 'translation'}


def main():
    doc_html = convert_pdf_to_html(PDF)
    i = 0
    for m in re.finditer(r'<p(?:\s+class="([^"]*)")?>(.*?)</p>', doc_html, re.S):
        cls = m.group(1) or ''
        txt = html.unescape(re.sub('<[^>]+>', '', m.group(2))).strip()
        if not txt:
            continue
        lvl = CLS2LVL.get(cls, 'line')
        print(f"{i:3d} [{lvl:>11}] {txt}")
        i += 1


if __name__ == '__main__':
    main()
