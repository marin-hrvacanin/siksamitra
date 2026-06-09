# Quickstart & Verification: Unified Audio-to-Text Mapping

## Prerequisites (already satisfied on the dev host)

- Python deps installed: `faster-whisper` 1.2.1, `ctranslate2` 4.7.1, `librosa`, `numpy`.
- Whisper models cached: `cache/models/models--Systran--faster-whisper-tiny` and `-small`.
- No new packages, no model download required for the default path.

## Run the app

```powershell
python editor.py
```

## Manual end-to-end (the real acceptance test)

1. Open or paste a known multi-line Sanskrit/Vedic text into the editor.
2. Attach an audio recording that chants that text (e.g. a YouTube download saved as mp3).
3. Click the single **"Map audio to text"** button in the audio editor dialog. (There is no tier selector and no separate Auto-Split.)
4. Observe progress, then the result: one region per line, each with a confidence/status badge (matched / needs-review / unmatched), and a summary count.
5. Play a few regions — audio heard must match the line (US1 / SC-001, SC-002).
6. Drag a boundary, set a fade, **Apply**, save the `.smdoc`, reopen — edits persist (US3 / SC-007).

### Targeted scenario checks
- **Partial coverage (SC-003)**: use audio missing one line → that line shows *unmatched*; others stay correct.
- **Out-of-order (SC-004)**: use audio with two lines swapped → both placed at their true audio spans.
- **No speech / wrong file**: silent or music-only file → engine reports it could not map; sections left for manual assignment (no fabricated regions, FR-009).
- **Degraded (FR-014)**: temporarily rename the whisper cache → mapping still returns a proportional best-effort, all *needs-review*.

## Automated backend checks

```powershell
python -m pytest tests/ -q
```

- `test_align_roman.py` — IAST→token mapping (ā→a, ś/ṣ/s→s, ṭ→t, aspirates→base+h, ṁ→m, ḥ→h, vocalic ṛ→ri …).
- `test_align_fuse.py` — on synthetic silence-delimited fixtures: in-order full coverage → all matched; one segment removed → its target unassigned; two segments swapped → placed at true times; empty transcript → degraded proportional.

## Success signals
- One action, no mode choice (FR-001 / SC-006).
- ≥90% of sections overlap their true span on a clean recording (SC-001); boundaries within ~0.25 s (SC-002).
- Completes on the 2-core/8 GB host for a several-minute clip without OOM and with progress feedback (SC-005).
- Nothing uncertain is presented as confident (FR-009).
