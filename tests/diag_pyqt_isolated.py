#!/usr/bin/env python
"""DEFINITIVE end-to-end test under the REAL failure condition.

Imports PyQt6 FIRST (so `…\\PyQt6\\Qt6\\bin` is prepended to PATH exactly as in the
running editor), then runs the isolated alignment the way editor.py now does —
spawning align_runner.py with align_runner.child_env (which strips Qt from PATH).
If the fix works we get engine=mms_fa with in-order placement; the old behaviour
(inheriting the polluted PATH) would yield engine=proportional.

    PYTHONUTF8=1 python tests/diag_pyqt_isolated.py
"""
import base64
import html
import json
import os
import re
import subprocess
import sys
import tempfile

# Pollute PATH exactly like the editor process does.
import PyQt6.QtCore  # noqa: F401

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from pdf_import import convert_pdf_to_html
from align_runner import child_env

PDF = r"C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf"
MP3 = os.path.join(BASE, 'cache', 'youtube_test', 'u_FzN8wdHg0.mp3')
CLS2LVL = {'ql-doc-title': 'title', 'ql-doc-subtitle': 'subtitle',
           'ql-comment-style': 'comment', 'ql-doc-translation': 'translation'}


def _fmt(t):
    t = float(t)
    return f'{int(t // 60):02d}:{t % 60:05.2f}'


def main():
    qt_on_path = any('Qt6' in p for p in os.environ['PATH'].split(os.pathsep))
    print(f"Qt6 on PARENT PATH (reproduces app): {qt_on_path}", flush=True)

    doc_html = convert_pdf_to_html(PDF)
    lines = []
    for m in re.finditer(r'<p(?:\s+class="([^"]*)")?>(.*?)</p>', doc_html, re.S):
        cls = m.group(1) or ''
        txt = html.unescape(re.sub('<[^>]+>', '', m.group(2))).strip()
        if txt:
            lines.append((CLS2LVL.get(cls, 'line'), txt))
    raw = open(MP3, 'rb').read()
    b64 = base64.b64encode(raw).decode('ascii')
    targets = [{'index': i, 'text': t, 'level': lvl, 'iastNormalized': t, 'events': []}
               for i, (lvl, t) in enumerate(lines)]
    payload = {'audio': f'data:audio/mpeg;base64,{b64}', 'mime': 'audio/mpeg',
               'targets': targets}

    with tempfile.TemporaryDirectory() as td:
        req = os.path.join(td, 'req.json')
        resp = os.path.join(td, 'resp.json')
        with open(req, 'w', encoding='utf-8') as f:
            json.dump(payload, f, ensure_ascii=False)
        env = child_env(os.environ)
        print("Spawning align_runner with sanitized child_env …", flush=True)
        proc = subprocess.run([sys.executable, os.path.join(BASE, 'align_runner.py'),
                               req, resp], capture_output=True, env=env, timeout=600)
        print(f"child exit={proc.returncode}", flush=True)
        if proc.returncode != 0:
            print(proc.stderr.decode('utf-8', 'replace')[-800:])
            return
        with open(resp, 'r', encoding='utf-8') as f:
            res = json.load(f)

    by = {r['targetIndex']: r for r in res['regions']}
    print(f"engine={res['engine']} summary={res['summary']} "
          f"fused={res['diagnostics'].get('fused')}")
    # Spot-check the lekas refrain (lines 47-49) and shloka 10 (43-44).
    prev = -1.0
    ooo = 0
    for i in (43, 44, 47, 48, 49):
        r = by.get(i, {})
        if r.get('status') in ('matched', 'warn'):
            if r['start'] < prev - 0.5:
                ooo += 1
            prev = r['start']
            print(f"  {i:3d} [{_fmt(r['start'])}-{_fmt(r['end'])}] {r['status']}  {by_text(i)}")
        else:
            print(f"  {i:3d}  unassigned  {by_text(i)}")
    ok = res['engine'] == 'mms_fa' and ooo == 0
    print("VERDICT:", "FIXED — real MMS ran in-app condition, in order"
          if ok else f"PROBLEM engine={res['engine']} ooo={ooo}")


_LINES_CACHE = {}


def by_text(i):
    return _LINES_CACHE.get(i, '')


if __name__ == '__main__':
    # populate text cache for printing
    doc_html = convert_pdf_to_html(PDF)
    _i = 0
    for m in re.finditer(r'<p(?:\s+class="([^"]*)")?>(.*?)</p>', doc_html, re.S):
        txt = html.unescape(re.sub('<[^>]+>', '', m.group(2))).strip()
        if txt:
            _LINES_CACHE[_i] = txt[:42]
            _i += 1
    main()
