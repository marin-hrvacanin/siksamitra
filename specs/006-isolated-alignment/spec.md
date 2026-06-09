# Feature Specification: Process-isolated alignment engine (low-RAM robustness)

**Branch**: `main` (no git) · **Created**: 2026-06-08 · **Status**: Implemented

**Input**: After `005-fused-alignment` made the backend produce clean, bleed-free regions
(verified standalone), the user reported **gross misplacement** in-app — a pāda playing a different
shloka entirely (the "lekas salekas" line playing shloka-10 audio), with different results between
runs. Root cause (proven via `cache/align_debug.json` from the user's run + direct reproduction):
the Flask server runs as a **daemon thread inside the PyQt process** (`editor.py FlaskServerThread`),
and **importing PyQt6 prepends `…\PyQt6\Qt6\bin` to `PATH`**. Those Qt DLLs **collide with
torch/ctranslate2's native DLLs**, so in the editor process `import torch` dies with Windows
`OSError 1114` ("DLL initialization routine failed") and faster-whisper fails identically. With both
real engines unloadable, `align_service` silently degrades to the **`proportional`** fallback — a
blind mātrā-weighted split with **zero acoustic matching** → placements that "make no sense".
Standalone harnesses worked only because a clean shell never imported PyQt6 (so `Qt6\bin` was never
on PATH). RAM pressure (i3, ~8 GB) is a secondary reason to isolate. The backend engine itself is
correct (both MMS and Whisper place the real text in order — `tests/diag_full.py`).

## Clarifications
- Constraint (unchanged): **everything local/offline**, no cloud, models cached under `cache/`.
- Constraint: **low-RAM machine** — the engine must not have to be co-resident in RAM with the
  document for the duration of a mapping.
- Behavior on failure: **never worse than before** — if isolation can't run, fall back to the
  existing in-process path so mapping still works.

## User Scenarios & Testing

### US1 - In-app mapping matches standalone quality (P1)
Mapping a recitation from inside the editor produces the same clean, bleed-free regions as the
standalone `manual_e2e`/`diag_*` harnesses.
- **Independent Test**: `tests/diag_isolated.py` runs the real engine through `align_runner.py` as a
  child process on bhū sūktam + `u_FzN8wdHg0` and asserts `engine=mms_fa`, `fused=True`, 0 overlaps —
  the same result the in-process harnesses report.
- **Acceptance**:
  1. The engine's ~1.5 GB lives only in the child process and is freed when it exits — never held
     co-resident with the open document.
  2. A child OOM/segfault exits non-zero and the editor survives; the endpoint falls back in-process.
  3. Region times returned via the isolated path are identical to the in-process path.

### US2 - Diagnosable when it still misbehaves (P2)
If a user still sees bleed, the cause (stale persisted regions vs engine fallback vs misapply) is
recoverable without the GUI.
- **Independent Test**: after any `/api/align/run`, `cache/align_debug.json` exists and records the
  engine actually used, `fused`/`isolated` flags, any `ctc_error`/`whisper_error`, and the region
  times.

## Decision
- Add **`align_runner.py`**: a tiny stdlib-only CLI that reads a request JSON file, calls
  `align_service.run`, writes the response JSON file, exits 0/non-zero. No behavior change to the
  engine itself — pure process wrapper. Also exposes **`child_env(base)`** — the critical piece:
  it **strips any `PyQt6` / `Qt6\bin` directory from the child's `PATH`** (and forces UTF-8) so the
  child does NOT inherit the Qt DLL pollution that breaks torch/ctranslate2. Without this the child
  fails exactly as in-process does.
- **`editor.py /api/align/run`**: try `_run_alignment_isolated(payload)` first — spawn the runner as
  a child via `subprocess.run` with `env=child_env(os.environ)`, 600 s timeout, file-based I/O so
  large base64 audio stays off the command line; on non-zero exit / exception, fall back to
  in-process (which in the Qt process can only reach `proportional`, so a healthy child is what
  matters). Tag `diagnostics.isolated=True`; always persist `cache/align_debug.json` (now incl.
  `isolated` + `engine`).

## Out of scope
- The engine algorithm (owned by `001`/`005`). This spec only changes *where* it runs.
- Stale persisted regions from pre-`005` saves: resolved by the user re-running "Map audio to text"
  (the apply path already replaces all regions for the audio on re-map). `align_debug.json` confirms
  whether a still-bleeding doc was re-mapped or is replaying old regions.

## Files
- NEW `align_runner.py` · `editor.py` (`_run_alignment_isolated` + endpoint wiring + debug snapshot)
- NEW `tests/test_align_runner.py` (protocol guard, fast) · `tests/diag_isolated.py` (real-MMS e2e)
- NEW `tests/test_align_service_events.py` (closes the populated-`events` test gap from §7.4)
- `editor-quill.js` (button↔attachment id-collision fix from single-copy audio)
