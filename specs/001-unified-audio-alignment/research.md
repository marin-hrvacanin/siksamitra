# Phase 0 Research: Unified Automatic Audio-to-Text Mapping

All decisions below were validated against (a) the verified host environment, (b) the existing codebase (`align_*.py`, `dialog-audio-editor.js`, `sanskrit_rules.js`), and (c) current (2025–2026) forced-alignment practice.

## Decision 1 — Recognition engine: `faster-whisper` (CTranslate2), not torchaudio/MMS

- **Decision**: Use the already-installed `faster-whisper` 1.2.1 (CTranslate2 4.7.1) with the **already-cached** `faster-whisper-tiny` (default) / `-small` (optional) models, int8, CPU, language hint `sa` (Sanskrit; Whisper supports it) with `hi` fallback. Word-level timestamps enabled.
- **Rationale**:
  - Host has **6.3 GB free disk, ~0.5 GB free RAM, 2 CPU cores, no GPU**. Lightweight is mandatory, not optional.
  - `faster-whisper` runs on CTranslate2 (int8) — **no torch needed**, ~75 MB (tiny) / ~250 MB (small) working set, already installed and cached. Zero new download for the default path (FR-003).
  - We need **timing + rough phonetics**, not an accurate transcript: the text is known. Whisper's noisy Sanskrit output is sufficient as one evidence source (see Decision 3).
- **Alternatives considered**:
  - *torchaudio MMS_FA (CTC forced alignment)* — technically the most accurate "align known text" tool and language-agnostic, BUT requires `torchaudio` (absent) + a ~1.2 GB model that does not fit comfortably in 6.3 GB free disk, and the torch inference path is heavier on RAM than this host tolerates. **Rejected on hardware grounds.** (Revisit as an optional high-accuracy backend if the user later runs on a stronger machine.)
  - *Bidwill/whisper-medium-sanskrit* (user-linked) — WER ~24.9 but **medium** (~1.5 GB, 3–4 GB RAM). **Rejected**: would swap this 8 GB/0.5-GB-free machine and consume a quarter of free disk.
  - *Bidwill/whisper-small-sanskrit* (WER ~27.9, ~250 MB int8 after CTranslate2 conversion) — **viable as an OPTIONAL** quality upgrade (convertible with `ct2-transformers-converter`), not the default, to respect "no large download by default."
  - *Cloud ASR API* — **rejected**: violates offline-first (FR-002) and the user explicitly said "do it locally."

## Decision 2 — Drop spectral phoneme-class guessing; keep only silence/VAD from DSP

- **Decision**: Repurpose `align_dsp.py` into `align_audio.py`, keeping `decode_audio` + the RMS/ZCR silence (VAD) detection, and **deleting** the per-frame phoneme classifier (`classify_frames`, `segments_from_classes`, pitch/`pyin`, `attach_f0_contours`).
- **Rationale**: Classifying frames into VOW_S/VOW_L/NAS/SIB/STOP from raw spectra is acoustically unreliable and is the documented root cause of today's poor alignment. Silence detection, by contrast, is robust and genuinely useful for snapping boundaries to pauses (FR-004c). The mātrā model already supplies the "expected duration" signal the classifier was approximating.
- **Alternatives considered**: Keep and tune the classifier — rejected; tuning a fundamentally noisy signal is lower-value than using the transcript content we already compute.

## Decision 3 — The unified fusion: phonetic Smith–Waterman of known text ↔ transcript

- **Decision**: One alignment pass in `align_fuse.py`:
  1. Romanize both the **known text** (per section, concatenated with section-boundary markers) and the **whisper transcript** to a common token alphabet (Decision 4).
  2. Run **local Smith–Waterman** (skip-both-sides) between the two token sequences. Match score = **phonetic similarity** (exact token, then class-similarity, e.g. retroflex≈dental, aspirate≈plain). This reuses the SW machinery already in `align_core.py` (`local_alignment`, `_sw_numpy`).
  3. Each text↔transcript correspondence carries the transcript token's **word timestamp** → a set of (text-position, audio-time) **anchors**.
  4. A **positional prior** (Gaussian around the section's expected time, from mātrā-cumulative fraction × speech span) biases placement toward in-order while permitting out-of-order (lower-prior but reachable) — the prior already exists in `assemble_sections`.
  5. **Assemble** per-section regions with `assemble_sections` (monotonic-preferring, non-overlap, neighbor bonus): anchor-dense spans define matched regions; gaps between anchors are filled proportionally by **mātrā duration**; boundaries are **snapped** to the nearest silence from Decision 2.
- **Rationale**: This is the literal embodiment of FR-004 — recognition + phonetic/textual similarity + rhythm/silence + mātrā duration fused in ONE decision process. It uses the transcript *content* (today discarded), which is what lets it handle partial coverage (unmatched text = no anchors) and out-of-order (SW finds the local match regardless of order, prior only biases).
- **Alternatives considered**:
  - *Boundary-only Whisper + proportional split* (today's effective behavior) — rejected; ignores content, can't detect partial/OOO, fabricates coverage.
  - *Pure DTW of MFCCs vs TTS-synthesized text (aeneas-style)* — rejected; needs a Sanskrit TTS voice (none lightweight/offline confirmed) and DTW is weak on out-of-order.

## Decision 4 — Romanization to a shared token alphabet (`align_roman.py`)

- **Decision**: A Python `romanize_iast(text)` that NFD-normalizes, drops combining marks, and maps IAST to a compact ASCII-ish token set shared by both the text side and the whisper-transcript side: `ā→a, ī→i, ū→u, ṛ→ri, ḷ→li, e→e, o→o, ai→ai, au→au, ṁ/ṃ→m, ḥ→h, ś/ṣ/s→s(sh), ṭ→t, ḍ→d, ṇ→n, ṅ→ng, ñ→ny`, aspirates → base(+h). Whisper output (Devanagari or romanized) is run through the same normalizer so both sides share an alphabet.
- **Rationale**: SW needs both sequences in one alphabet. Lossy folding (retroflex→dental etc.) is fine because phonetic *similarity* — not exact identity — drives scoring, and folding increases robustness to whisper errors. The editor already produces `iastNormalized` per target, so the text side is clean input.
- **Alternatives considered**: `uroman` — rejected as an extra dependency for marginal benefit; our mapping is small, testable, and Sanskrit-specific.

## Decision 5 — Single endpoint + single frontend action

- **Decision**: Keep `POST /api/align/run` but **drop the `tier` field**; rename response `tier_used`→`engine`; preserve `regions[]` (`targetIndex/start/end/confidence/status`) so the dialog's `runAnchorAlign` consumer changes minimally. Frontend: remove the tier `<select>`, the `Auto-Split` button, `state.alignTier` + its localStorage, and the client-side `robust`/`proportional`/`detectSpeechIntervals` fallback cascade in `autoAlignRegions`. One button → `autoAlign()` → endpoint.
- **Rationale**: Directly implements FR-001 (one mode) while minimizing churn to the editable-region UX (FR-011) and `.smdoc` persistence (FR-012), which stay as-is.
- **Alternatives considered**: New endpoint name — rejected; needless churn.

## Decision 6 — Graceful degradation (FR-014)

- **Decision**: If `faster-whisper` import/model load fails, the engine still returns a **proportional** mapping from mātrā durations + silence boundaries, all sections marked `needs-review` with low confidence, `engine:"proportional"` in diagnostics. Never hard-fail the dialog.
- **Rationale**: Honors FR-014 and FR-009 (low confidence surfaced, not faked).

## Decision 7 — Mātrā prior must actually reach the backend

- **Decision**: Fix `editor-quill.js _buildTarget` to forward the already-computed `events` + `hasSvaras` onto each target (today they're computed in `_buildAudioAlignmentProfile` but not attached). `coarsen_text_events` then has real input.
- **Rationale**: Without this, the mātrā prior degrades to syllable-count weighting. One-line forwarding fix; high value for FR-005.

## Resolved unknowns

| Unknown | Resolution |
|---------|-----------|
| Which engine fits the hardware? | faster-whisper int8 tiny (default) / small (optional); no torchaudio. |
| Does Whisper support Sanskrit? | Yes (`sa`); noisy but usable as evidence. `hi` as fallback hint. |
| How to handle partial/OOO? | Local skip-both-sides SW on content + soft positional prior; absent text → no anchors → unmatched. |
| How do durations participate? | Positional prior + proportional gap-fill + duration validation, from existing `projectToEventSequence`. |
| New dependencies? | None by default (all installed/cached). Optional: Sanskrit CT2 model. |
