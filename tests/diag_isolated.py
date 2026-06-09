#!/usr/bin/env python
"""Validate the isolated-process path end-to-end with real MMS + audio.

Mimics editor.py `_run_alignment_isolated`: writes a request (base64 audio + real
targets) to a temp file, runs align_runner.py as a child process, reads the
response, and checks the regions are bleed-free — confirming the isolation
wrapper produces the same correct result as the in-process engine.

    PYTHONUTF8=1 python tests/diag_isolated.py
"""
import base64
import html
import json
import os
import re
import subprocess
import sys
import tempfile

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from pdf_import import convert_pdf_to_html

PDF = r"C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf"
MP3 = os.path.join(BASE, 'cache', 'youtube_test', 'u_FzN8wdHg0.mp3')
CLS2LVL = {'ql-doc-title': 'title', 'ql-doc-subtitle': 'subtitle',
           'ql-comment-style': 'comment', 'ql-doc-translation': 'translation'}


def _fmt(t):
    t = float(t)
    return f'{int(t // 60):02d}:{t % 60:05.2f}'


def main():
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
        env = dict(os.environ)
        env['PYTHONUTF8'] = '1'
        env['PYTHONIOENCODING'] = 'utf-8'
        print('Running align_runner.py as a child process …', flush=True)
        proc = subprocess.run([sys.executable, os.path.join(BASE, 'align_runner.py'),
                               req, resp], capture_output=True, env=env, timeout=600)
        print(f'child exit={proc.returncode}', flush=True)
        if proc.returncode != 0:
            print(proc.stderr.decode('utf-8', 'replace')[-1000:])
            return
        with open(resp, 'r', encoding='utf-8') as f:
            res = json.load(f)

    by = {r['targetIndex']: r for r in res['regions']}
    print(f"engine={res['engine']} summary={res['summary']} "
          f"fused={res['diagnostics'].get('fused')}")
    placed = []
    for i, (lvl, t) in enumerate(lines):
        if lvl != 'line':
            continue
        r = by.get(i, {})
        if r.get('status') in ('matched', 'warn'):
            placed.append((r['start'], r['end']))
            if len(placed) <= 4:
                print(f"  [{_fmt(r['start'])}-{_fmt(r['end'])}]  {t[:40]}")
    placed.sort()
    ov = sum(1 for (s0, e0), (s1, e1) in zip(placed, placed[1:]) if e0 - s1 > 1e-3)
    print(f"BLEED: {ov} overlapping pairs — want 0")
    print("OK isolated path works" if ov == 0 and proc.returncode == 0 else "PROBLEM")


if __name__ == '__main__':
    main()
