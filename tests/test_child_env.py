"""Regression guard for the in-app gross-misplacement root cause.

Importing PyQt6 prepends `…\\PyQt6\\Qt6\\bin` to PATH; those Qt DLLs collide with
torch/ctranslate2 (`import torch` → Windows OSError 1114), so the in-app engine —
and any child inheriting that PATH — silently degrades to the blind `proportional`
fallback (acoustically meaningless placement). `align_runner.child_env` strips Qt
dirs from the child's PATH so the engine actually runs. These tests lock that in."""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
from align_runner import child_env  # noqa: E402


def test_strips_qt_bin_from_path():
    sep = os.pathsep
    qt = r'C:\Py\Lib\site-packages\PyQt6\Qt6\bin'
    keep1 = r'C:\Py'
    keep2 = r'C:\Windows\System32'
    base = {'PATH': sep.join([qt, keep1, keep2])}
    env = child_env(base)
    parts = env['PATH'].split(sep)
    assert qt not in parts                      # Qt bin removed
    assert keep1 in parts and keep2 in parts    # everything else kept
    assert env['PYTHONUTF8'] == '1'
    assert env['PYTHONIOENCODING'] == 'utf-8'


def test_handles_forward_slashes_and_pyqt_substring():
    sep = os.pathsep
    qt_fwd = 'C:/Py/site-packages/PyQt6/Qt6/bin'
    pyqt_other = r'C:\x\PyQt6\somethingelse'
    keep = r'C:\keep'
    env = child_env({'PATH': sep.join([qt_fwd, pyqt_other, keep])})
    parts = env['PATH'].split(sep)
    assert keep in parts
    assert qt_fwd not in parts        # qt6/bin via forward slashes still stripped
    assert pyqt_other not in parts    # any PyQt6 dir stripped (belt-and-suspenders)


def test_empty_path_safe():
    env = child_env({})
    assert env['PATH'] == ''


def _has(mod):
    try:
        __import__(mod)
        return True
    except Exception:
        return False


@pytest.mark.skipif(not (_has('torch') and _has('PyQt6')),
                    reason='needs torch + PyQt6 to reproduce the DLL clash')
def test_child_loads_torch_after_pyqt_pollution(tmp_path):
    """End-to-end: a parent that imported PyQt6 (Qt6 now on PATH) spawns a child with
    child_env(); the child must import torch successfully (rc 0). Without the strip the
    child would fail with OSError 1114 and the engine would fall to proportional."""
    code = (
        "import PyQt6.QtCore, os, subprocess, sys;"
        "sys.path.insert(0, r'" + os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + "');"
        "from align_runner import child_env;"
        "assert any('Qt6' in p for p in os.environ['PATH'].split(os.pathsep)), 'Qt not on PATH?';"
        "env=child_env(os.environ);"
        "r=subprocess.run([sys.executable,'-c','import torch,torchaudio'],env=env,capture_output=True);"
        "sys.exit(r.returncode)"
    )
    proc = subprocess.run([sys.executable, '-c', code], capture_output=True, timeout=180)
    assert proc.returncode == 0, proc.stderr.decode('utf-8', 'replace')[-400:]
