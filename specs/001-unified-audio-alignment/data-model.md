# Phase 1 Data Model: Unified Automatic Audio-to-Text Mapping

Entities are mostly **reused** from `align_core.py` (Python dataclasses) and the dialog's JS region/target objects. This document records fields, relationships, and validation rules; new/changed fields are flagged.

## TargetSection (text to locate) — reuse `align_core.TargetSection`

One unit of text to be found in the audio (typically a line/verse).

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `index` | int | editor order | Expected order position (drives in-order prior). |
| `text` | str | editor | Raw section text. |
| `level` | str | editor | title/section/line/translation/comment — used to skip non-chant lines. |
| `iastNormalized` | str | `editor-quill.js` | Script-normalized IAST; romanized for SW (Decision 4). |
| `syllables` | int | editor | Fallback weight when events absent. |
| `events` | TextEvent[] | `projectToEventSequence` | **MUST now be forwarded** from `_buildTarget` (Decision 7). |
| `hasSvaras` | bool | editor | **MUST now be forwarded**; gates optional pitch checks. |
| `pauseAfterHint` | bool | editor | Section ends at a danda/pause → expect trailing silence. |
| `romanTokens` | str[] | NEW (`align_roman`) | Derived: romanized token sequence for SW. |
| `totalMatras` | float | NEW (derived) | Σ `events[].matras`; basis of expected duration. |

**Validation**: `index` unique and contiguous; `iastNormalized` non-empty for chantable levels; `events` may be empty (degrade to `syllables`).

## TextEvent — reuse `align_core.TextEvent` (unchanged)

`{ type: SIL|VOW_S|VOW_L|NAS|SIB|STOP|APP, matras: float, svara: udatta|anudatta|svarita|None, char: str }`. Mātrā values from `projectToEventSequence`: short vowel 1.0, long vowel 2.0, holdings 1/2 units, nasal 0.5, sibilant 0.8, consonant 0.5, visarga 0.6, single danda 1.0, double danda 2.0, soft pause 0.25.

## TranscriptToken (recognition evidence) — NEW (`align_recognize`)

A recognized word/segment from faster-whisper.

| Field | Type | Notes |
|-------|------|-------|
| `text` | str | Recognized word (Devanagari or roman). |
| `start` | float | Word start time (s). |
| `end` | float | Word end time (s). |
| `romanTokens` | str[] | Same romanization as text side (shared alphabet). |
| `prob` | float | Whisper word probability (weak confidence signal). |

**Validation**: `0 ≤ start < end ≤ duration`; tokens sorted by `start`.

## SilenceInterval (rhythm evidence) — NEW (`align_audio`)

`{ start: float, end: float }` — detected low-energy gaps; used to snap region boundaries and validate `pauseAfterHint`. Derived from existing VAD in (old) `align_dsp.py`.

## Anchor (fusion intermediate) — NEW (`align_fuse`)

A correspondence produced by phonetic SW between a text position and an audio time.

| Field | Type | Notes |
|-------|------|-------|
| `targetIndex` | int | Which section the matched text token belongs to. |
| `textPos` | int | Token position within the concatenated text. |
| `audioTime` | float | Time from the matched transcript token. |
| `score` | float | Phonetic match quality (0–1). |

## PlacedRegion (result) — reuse `align_core.PlacedRegion`

| Field | Type | Notes |
|-------|------|-------|
| `target_index` | int | Section this region maps to. |
| `start` / `end` | float | Region span (s), boundaries silence-snapped. |
| `confidence` | float | 0–1; from anchor density × match quality × duration agreement. |
| `status` | str | `matched` (≥0.55) / `warn`=needs-review (0.35–0.55) / `unassigned`=unmatched (<0.35). |
| `channel_breakdown` | dict | Per-signal contributions (phonetic, duration, pause, prior) for diagnostics. |

**State transitions**: `unassigned → matched/warn` when anchors found; any → user-edited (manual override clears auto status; FR-011). Thresholds reuse `align_core` `UNASSIGNED_BELOW`=0.35, `WARN_BELOW`=0.55.

## AudioRegion (persisted) — reuse existing dialog/`.smdoc` shape (unchanged)

`{ id, start, end, label, targetIndex, hidden, fadeIn, fadeOut, confidence }` in the dialog; persisted in `.smdoc` `audio.attachments[]` as `{ id, label, src, startTime, endTime, fadeIn, fadeOut }`. **No schema change** (FR-012). A `PlacedRegion` maps 1:1 onto one of these.

## MappingResult (engine output) — response of `/api/align/run`

| Field | Type | Notes |
|-------|------|-------|
| `engine` | str | `whisper-tiny` / `whisper-small` / `proportional` (degraded). |
| `regions` | PlacedRegion[] | One per target (or omitted/`unassigned` when unmatched). |
| `unassigned` | int[] | Target indices with no confident placement. |
| `speech_span` | [float,float] | First/last detected speech time. |
| `summary` | {matched,warn,unassigned} | Counts for user feedback (FR-013). |
| `diagnostics` | dict | transcript token count, anchor count, silence count, timings. |

## Relationships

```
TargetSection 1──1 PlacedRegion 1──1 AudioRegion(persisted)
TargetSection ──< TextEvent
TranscriptToken + SilenceInterval ──(fusion)──> Anchor ──(assemble)──> PlacedRegion
MappingResult ──< PlacedRegion
```
