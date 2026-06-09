"""Guards the isolated-process mapping protocol (align_runner.py).

The Flask endpoint runs the engine in a child process so torch/MMS does not
contend for RAM with the open document. This test exercises the file-in/file-out
protocol without torch or audio (empty audio → the engine's honest 'none' path),
confirming the child runs, exits 0, and writes a well-formed response the endpoint
can consume."""
import json
import os
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_runner_roundtrip(tmp_path):
    req = tmp_path / 'req.json'
    resp = tmp_path / 'resp.json'
    # Empty targets → align_service returns its 'no targets' result before touching
    # the (torch/ffmpeg) audio path, exercising the full read-request → run →
    # write-response → exit-0 protocol fast and deterministically. The unicode text
    # field also confirms UTF-8 round-trips through the child.
    req.write_text(json.dumps({
        'audio': '', 'mime': 'audio/mpeg', 'note': 'oṁ namaḥ', 'targets': [],
    }, ensure_ascii=False), encoding='utf-8')

    env = dict(os.environ)
    env['PYTHONUTF8'] = '1'
    env['PYTHONIOENCODING'] = 'utf-8'
    proc = subprocess.run(
        [sys.executable, os.path.join(BASE, 'align_runner.py'), str(req), str(resp)],
        capture_output=True, env=env, timeout=120,
    )
    assert proc.returncode == 0, proc.stderr.decode('utf-8', 'replace')
    assert resp.exists()
    result = json.loads(resp.read_text(encoding='utf-8'))
    # Well-formed response shape the endpoint relies on.
    for key in ('engine', 'regions', 'summary', 'diagnostics'):
        assert key in result, (key, result)
    assert isinstance(result['regions'], list)


def test_runner_bad_args():
    proc = subprocess.run([sys.executable, os.path.join(BASE, 'align_runner.py')],
                          capture_output=True, timeout=60)
    assert proc.returncode != 0
