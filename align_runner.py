#!/usr/bin/env python
"""align_runner.py — run the audio→text mapping engine in an ISOLATED process.

The Flask server runs as a daemon thread *inside* the PyQt process (editor.py
`FlaskServerThread`). MMS forced alignment (torch + ~1.5 GB model) loaded into
that same process contends for RAM with the WebEngine, the open document (which
can be tens of MB), and decoded audio — on a low-RAM machine that means OOM /
thrash / a torch segfault that would take the whole editor down, and a silent
degrade to a weaker engine (the in-app↔standalone discrepancy behind the bleed
report).

Running the engine here, as a short-lived child process, fixes that:
  * torch's ~1.5 GB lives only in the child and is freed when it exits, never
    held co-resident with the document;
  * a segfault/OOM kills only the child (non-zero exit) — the editor survives
    and the caller falls back to in-process alignment;
  * the child has the same clean RAM headroom as a standalone run, which is the
    condition under which MMS is known to succeed.

Protocol (file-based, to keep large base64 audio off the command line):
    python align_runner.py <request.json> <response.json>
`request.json` is the same dict align_service.run expects. The result dict is
written to `response.json`. Exit 0 on success, non-zero on failure.
"""
import json
import os
import sys


def child_env(base=None):
    """Build the environment for the alignment child process.

    The decisive fix for the in-app failure: importing PyQt6 prepends its
    `…\\PyQt6\\Qt6\\bin` to PATH, and those Qt DLLs collide with torch/ctranslate2's
    native DLLs — `import torch` then dies with Windows OSError 1114 ("DLL
    initialization routine failed"), and a child inheriting that PATH fails the same
    way, forcing the engine down to the blind `proportional` fallback. Stripping any
    PyQt6 / `Qt6\\bin` directory from PATH lets the child load torch cleanly and run
    real MMS forced alignment. UTF-8 is forced so Sanskrit round-trips on Windows."""
    env = dict(base if base is not None else os.environ)
    env['PYTHONUTF8'] = '1'
    env['PYTHONIOENCODING'] = 'utf-8'
    parts = env.get('PATH', '').split(os.pathsep)
    clean = [p for p in parts
             if 'pyqt6' not in p.lower()
             and ('qt6' + os.sep + 'bin') not in p.lower().replace('/', os.sep)]
    env['PATH'] = os.pathsep.join(clean)
    return env


def main(argv):
    if len(argv) != 3:
        sys.stderr.write('usage: align_runner.py <request.json> <response.json>\n')
        return 2
    req_path, resp_path = argv[1], argv[2]
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        with open(req_path, 'r', encoding='utf-8') as f:
            request = json.load(f)
    except Exception as e:
        sys.stderr.write(f'failed to read request: {e!r}\n')
        return 3
    try:
        from align_service import run as _run
        result = _run(request)
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.stderr.write(f'align_service.run failed: {e!r}\n')
        return 4
    try:
        with open(resp_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False)
    except Exception as e:
        sys.stderr.write(f'failed to write response: {e!r}\n')
        return 5
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
