# Implementation Plan: Unified Automatic Audio-to-Text Mapping

**Branch**: `main` (no feature branch; working on `main` per user request — no git operations) | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-unified-audio-alignment/spec.md`

## Summary

Replace the current fragmented audio→text alignment (3 backend "tiers" — DSP phoneme-class guessing, Whisper-boundaries-only, an empty Conformer stub — plus client-side robust/proportional fallbacks and a tier selector UI) with **one unified engine** behind **one button**.

The core insight driving the design: the existing code runs speech recognition but **throws away the transcript**, keeping only word boundaries, then tries to guess phoneme classes (vowel/nasal/sibilant/stop) from raw spectral features — which is unreliable and is the root cause of poor results. The fix is to **fuse all evidence in a single alignment pass**:

1. Approximate speech recognition (`faster-whisper`, already installed, CTranslate2/int8, CPU, no torch needed) → a noisy romanized transcript **with word timestamps**.
2. **Phonetic sequence alignment** (Smith–Waterman, local, skip-both-sides) of the *known* romanized text against that noisy transcript → time anchors. This is the missing piece today.
3. **Silence/rhythm** from a lightweight DSP pass (reuse the reliable VAD in `align_dsp.py`, discard its phoneme classifier) → boundary snapping and pause validation.
4. **Mātrā duration structure** from the editor's existing `projectToEventSequence` (short vowel 1, long vowel 2, holdings 1/2, short/long pause, dīrgha/hrasva) → positional prior, gap filling, and placement validation.

These feed one scoring/assembly process (reuse `align_core.py` `local_alignment` + `assemble_sections`) that prefers in-order placement but tolerates partial coverage and out-of-order sections, emits per-section confidence + status (matched / needs-review / unmatched), and never fabricates coverage. The frontend collapses to a single "Map audio to text" action; the editable region UX and `.smdoc` persistence are unchanged.

## Technical Context

**Language/Version**: Python 3.14.3 (backend, Flask) + JavaScript ES2020+ (frontend, no bundler). Confirmed installed.

**Primary Dependencies**:
- `faster-whisper` 1.2.1 + `ctranslate2` 4.7.1 — **installed**; models `faster-whisper-tiny` + `-small` already cached in `cache/models/` (539 MB total). Runs int8 on CPU, no torch, low RAM. This is the recognition engine.
- `librosa` (installed) — audio decode/resample to 16 kHz mono + silence/energy features.
- `numpy` (installed) — Smith–Waterman + scoring vectorization.
- NOT used: `torchaudio`/MMS forced alignment (torchaudio absent; ~1.2 GB model won't fit the 6.3 GB free disk and is heavier on RAM than this machine allows). `torch` 2.11+cpu happens to be installed but is **not a dependency of this feature**.

**Storage**: Audio regions persist in the existing `.smdoc` format (`audio.attachments[]` with `startTime/endTime/fadeIn/fadeOut`). No schema change required.

**Testing**: `pytest` for backend alignment unit/integration tests (new `tests/` dir); manual end-to-end via the running PyQt app + a sample chant recording. A tiny synthetic fixture (silence-delimited segments) for deterministic checks of the fusion/assembly logic without shipping audio.

**Target Platform**: Windows 11 desktop (PyQt6 + QWebEngineView), fully offline. Verified host: Intel i3-1115G4 (2c/4t), 7.7 GB RAM (~0.5 GB free under load), 6.3 GB free disk, Intel UHD (no CUDA).

**Project Type**: Desktop application (local Flask backend + Quill/JS frontend).

**Performance Goals**: A several-minute recording maps in roughly real-time-or-slower on 2 CPU cores without OOM (whisper tiny ≈ 3–6× realtime; small ≈ 1–2× realtime on this CPU). Single forward recognition pass; alignment is O(text_tokens × transcript_tokens) which is small.

**Constraints**: Fully local/offline (FR-002); no large default download (FR-003) — uses already-cached models; ≤ ~1.5 GB peak RAM (close to host ceiling → prefer tiny by default, small optional); single user-facing mode (FR-001); never fabricate coverage (FR-009); graceful degradation if recognition unavailable (FR-014).

**Scale/Scope**: Documents up to a few hundred sections; recordings up to ~30 min. One audio attachment per mapping run.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is the unpopulated template — **no ratified project-specific principles exist**, so there are no explicit gates to violate. The plan nonetheless adheres to the project's de-facto principles encoded in `CLAUDE.md`:

- **Offline-first, no cloud** ✅ — engine is fully local (FR-002).
- **No build step / vanilla JS** ✅ — frontend changes are plain ES2020+ edits to existing files.
- **Lightweight, reuse over rewrite** ✅ — reuses installed `faster-whisper`, `librosa`, `numpy`, the existing `align_core.py` dataclasses + Smith–Waterman, the existing `projectToEventSequence` prosody model, and the existing region UI + `.smdoc` format. Net dependency footprint: **zero new packages by default**.
- **Single responsibility, no dead modes** ✅ — collapses 7 competing paths into 1 (directly serves FR-001).

**Result**: PASS (no violations; Complexity Tracking table not required).

## Project Structure

### Documentation (this feature)

```text
specs/001-unified-audio-alignment/
├── spec.md              # Feature spec (complete)
├── plan.md              # This file
├── research.md          # Phase 0: engine/algorithm decisions + rationale
├── data-model.md        # Phase 1: entities (targets, regions, evidence, result)
├── quickstart.md        # Phase 1: how to run + verify end-to-end
├── contracts/
│   └── align-run.md     # Phase 1: the single /api/align/run request/response contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (complete)
└── tasks.md             # Phase 2 output (/speckit-tasks — created next)
```

### Source Code (repository root)

```text
# Backend — alignment engine (Python, Flask)
align_service.py     # REPURPOSED: gutted to one path — decode → recognize → fuse → assemble → degrade
align_recognize.py   # NEW: faster-whisper wrapper → romanized transcript tokens + word timestamps
align_roman.py       # NEW: IAST → romanized token sequence (shared by text + transcript sides)
align_fuse.py        # NEW: the unified fusion — phonetic Smith–Waterman of text↔transcript,
                     #      anchor→time mapping, silence snapping, mātrā gap-fill + validation
align_audio.py       # REPURPOSED from align_dsp.py: keep decode + silence/VAD; drop phoneme classifier
align_core.py        # KEPT: dataclasses (TextEvent/AudioEvent/TargetSection/PlacedRegion),
                     #      local_alignment(), assemble_sections(), coarsen_text_events(), pause/svara channels
align_dsp.py         # DELETE (decode + VAD folded into align_audio.py)
align_whisper.py     # DELETE (replaced by align_recognize.py; uses transcript content, not just boundaries)
align_conformer.py   # DELETE (empty stub)

editor.py            # MODIFIED: simplify /api/align/* endpoints to the single engine (drop tier param)

# Frontend — one button, no tiers
dialog-audio-editor.html  # MODIFIED: remove tier <select> + Auto-Split button; relabel one "Map audio to text"
dialog-audio-editor.js    # MODIFIED: remove tier state/localStorage, fallback cascade, auto-split;
                          #           single autoAlign() → /api/align/run; keep manual region editing
editor-quill.js           # MODIFIED (small): forward `events` + `hasSvaras` from _buildTarget so the
                          #                   mātrā prior reaches the backend (currently computed but dropped)
sanskrit_rules.js         # UNCHANGED: projectToEventSequence is the prosody source of truth

# Tests
tests/
├── test_align_roman.py   # IAST → token mapping correctness
├── test_align_fuse.py    # phonetic SW + anchor mapping + partial/OOO on synthetic fixtures
└── fixtures/             # tiny synthetic audio + known-text cases (in-order / partial / swapped)
```

**Structure Decision**: Single desktop app, no new project layout. The backend gains three small new modules (`align_recognize.py`, `align_roman.py`, `align_fuse.py`), repurposes two (`align_service.py`, `align_dsp.py`→`align_audio.py`), keeps `align_core.py`, and deletes three now-obsolete tier modules. The frontend edits are confined to the audio dialog plus a one-line forwarding fix in `editor-quill.js`. No new packages.

## Complexity Tracking

> No constitution violations — table intentionally omitted.
