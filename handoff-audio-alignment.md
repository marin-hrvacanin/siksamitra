# Handoff — śikṣāmitra audio↔text alignment (bleed bug) + recent work

**For**: the next agent. **Date**: 2026-06-08. **Author**: previous session (Claude).

Read this top to bottom. The headline problem (still unsolved) is in **§3**. Everything
else (PDF import, memory fix, UI) is done and working; it's context.

---

## 0. Hard rules (from the user — do not violate)
- **No git.** Do **not** `git commit`/`push`/branch. Work in the tree on `main`; the user reviews.
- **Everything local/offline.** No cloud APIs. Models cached under `cache/` (gitignored).
- **Use the spec-kit cycle** for non-trivial work, **autonomously**: specify → plan → tasks →
  analyze → implement, writing artifacts to `specs/NNN-*/`. The skills live in
  `.claude/skills/speckit-*`. The user is fine with you running the WHOLE cycle without asking,
  then doing the implementation, as long as you don't touch git. Branch creation is disabled.
- **Low-RAM machine**: Intel i3, ~8 GB RAM (often <1 GB free), no GPU. Heavy runs are slow
  (~90 s for one MMS pass). Use `run_in_background` for mapping runs. `PYTHONUTF8=1` for any
  script that prints Sanskrit (Windows cp1252 console).
- Run app: `py editor.py` (Python 3.14, PyQt6 + Flask + Quill, no build step).

## 1. The goal / vision
Dead-simple, accurate flow: **import a Veda Union PDF → apply grammar → paste a YouTube URL →
audio auto-maps onto each shloka with clean, slightly-faded cuts → play each line.**
The user wants to listen to **each pāda individually** and hear *only that pāda* (no bleed,
no clipped syllable). Future: split a pāda into words and play word-groups.

## 2. What is DONE and working (context — don't redo)
All via the autonomous speckit cycle; artifacts under `specs/`.

- **`specs/003-faithful-pdf-import/`** — `pdf_import.py` rewritten **character-aware**; imports
  Veda Union PDFs 1-to-1 incl. **holdings** (green vector boxes → `ql-holding-short/long`),
  **pauses** (colored pipes → `ql-short/long-pause`), accents, change-style, superscripts,
  verse grouping. Tests: `tests/test_pdf_import.py` (7, green). **User confirmed import is good.**
- **`specs/004-single-copy-audio/`** — audio is stored **once** in memory (`audioLibrary`,
  keyed by id); the live DOM holds no base64 (de-duped on load, inflated only for save/export).
  Fixed a `MemoryError`/choppiness: the untitled-autosave (`saveUntitled` in `document-manager.js`)
  now posts **light** deduped content (was posting heavy standalone HTML with audio inflated →
  ~200 MB JSON body → crash). `/api/cache/untitled` (editor.py ~1681) hardened.
- **Audio-editor dialog UX** (`dialog-audio-editor.*`): a **blocking loading overlay** now gates
  decode + the ~2-min mapping so the editor isn't interactive/choppy mid-process; **Sections panel
  hides non-chant** (title/subtitle/comment/translation) by default with a "Show non-chant" toggle.
- **YouTube URL entry in Insert→Media**: `dialog-audio-picker.html` now has a "Fetch Audio from
  URL" field that downloads via `POST /api/align/youtube` and attaches like a local upload.

## 3. THE UNSOLVED PROBLEM — audio→text region boundaries bleed (creeping offset)

### Symptom (user, in-app, recording `https://www.youtube.com/watch?v=u_FzN8wdHg0`, bhū sūktam PDF)
- Line 1 region plays only "…mahi" — the word "mahitvā" is cut; "tvā" is missing.
- Line 2 plays "tvā" (the previous line's tail) then its own content, and also ends early.
- The offset **compounds** down the document. By "pi̱tara̍ñ ca pra̱yanth suva̍ḥ", pressing play
  "literally just plays the remaining part of the previous line" — i.e. that line's region
  contains the PREVIOUS line's audio, none of its own. **This is the core bug. Unsolved.**

### Root cause (confirmed via diagnostics)
MMS forced alignment (`align_ctc.py`, the primary engine) **compresses each pāda**: it aligns the
clear core phones and drops the elongated tail/head (Vedic recitation stretches vowels a lot) into
an **unassigned gap between consecutive lines**. Example from the diagnostic (line 1 = idx 3):
- MMS placed it `06.67–11.90` and line 2 at `13.16–…`, leaving `11.90–13.16` (≈ "tvā" + breath)
  assigned to neither. So per-pāda token edges from MMS are NOT trustworthy region boundaries.

### What I built to fix it (and it's NOT working in-app — see §3.1)
`specs/005-fused-alignment/` + new module **`align_fused.py`** with `refine(placed, targets,
silences, speech_span)`: takes the coarse per-pāda placements and re-derives clean boundaries —
confident placements become **anchors**, padas between them are placed by **mātrā rhythm**
(re-syncs at anchors → no cumulative drift), and each inter-pāda boundary is snapped to the
**strongest real pause (≥0.18 s) in the gap MMS left between the two lines**, splitting that gap so
each line keeps its own audio. Inward-trim + ~40 ms fade when no pause exists (continuous chant).
Text the recording skips stays **unassigned** (never fabricated). Wired as the final stage in
`align_service.run` (after MMS/whisper), emitting `fadeIn/fadeOut` per region.

Unit tests `tests/test_align_fused.py` (5, green) prove: 0 overlaps, silence-snap, inward-trim,
honest-unassigned, rhythm-fill, svara-independence.

### 3.1 THE KEY DISCREPANCY TO CHASE FIRST  ⚠️
My standalone diagnostic **`tests/diag_align.py`** calls `align_ctc.align` + `align_fused.refine`
**directly** and shows the fix WORKING: after the last change, line 1 became `04.13–12.61`
(keeps "tvā"), boundary in the real 0.55 s pause (12.61–13.16); ~30/32 boundaries land in real
0.5 s+ verse-breaths; 0 overlaps. **But the user says the app is "exactly the same as before."**

So the in-app path (`/api/align/run` → `align_service.run`) is almost certainly NOT producing what
`diag_align.py` produces. **Prime suspects, investigate in this order:**

1. **`refine` throws inside `align_service.run` and is silently swallowed** → it falls back to raw
   MMS regions = the old bleed. In `align_service.py` the call is wrapped in
   `try/except` that sets `diagnostics['fused_error']`. **Check the `/api/align/run` response
   `diagnostics` for `fused_error` / whether `fused: true`.** `diag_align.py` builds targets
   differently from `align_service` (it does NOT run `coarsen_text_events`; align_service does, at
   ~line 128), so `refine` may hit data in-service it doesn't hit in the diagnostic. **Run
   `tests/manual_e2e.py` — it goes through `align_service.run` (the real path) — and compare its
   line-1 boundary to `diag_align.py`. I kicked off such a run as I wrote this; see §3.2 for the
   result (or re-run it).** If manual_e2e shows the OLD boundary, the bug is in the
   align_service↔refine wiring/exception; if it shows the NEW boundary, the bug is downstream
   (stale regions / JS / playback).
2. **Stale / cached regions**: did the user actually **re-run "Map audio to text"** after the code
   change? If the doc had regions mapped by the OLD code and was saved/reopened, playback uses the
   OLD regions. Confirm the map was re-run; consider clearing `cache/`.
3. **JS not applying refined edges**: `runAnchorAlign` (dialog-audio-editor.js ~1832) builds
   `mapped` from `result.regions` (now includes `fadeIn/fadeOut`) → `installRegionsFromMapped`
   (~2008). Verify the regions actually installed have the refined start/end, not something
   recomputed client-side.
4. **Playback path uses different bounds**: precise playback is
   `_playPreciseAttachmentRange` (editor-quill.js ~13790) reading `startTime/endTime` from the
   attachment dataset. Verify the applied attachment's `data-start-time/end-time` equal the refined
   region, and that `_applyAudioEditorResult` (editor-quill.js ~5244) writes them through.

### 3.2 Result of the align_service.run verification (manual_e2e) — ⭐ DECISIVE
I ran `manual_e2e.py` (the REAL `align_service.run` path, same as `/api/align/run` the app calls)
AFTER the boundary fix. **The backend output is CORRECT — no bleed:**
```
engine=mms_fa  matched 32  warn 0  unassigned 2  skipped 39
[00:04.13-00:12.61] matched 0.76 fade=0.04  bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam …   <- keeps "tvā"
[00:13.16-00:20.01] matched 0.86 fade=0.04  u̱pasthe̍ te devya-dite̱'gnima̍-nnā̱dama̱-…
[00:20.63-00:26.31] matched 0.93 fade=0.04  ā'yaṅ gauḥf pṛśni̍ra-kramī̱da-sa̍nan mā̱ta…
[00:26.90-00:29.84] matched 0.84 fade=0.04  pi̱tara̍ñ ca pra̱yanth suva̍ḥ ॥ 2॥           <- proper own region
```
`fade=0.04` present ⇒ `align_fused.refine` DID run inside `align_service.run` and produced the good
boundaries. **So the engine/backend is NOT the bug.** "pi̱tara̍ñ ca…" has its own correct region
`[26.90–29.84]` here, yet in the app the user hears only the previous line's tail for that line.

**CONCLUSION: the bug is downstream of the backend — almost certainly STALE REGIONS (the doc was
mapped by the OLD code and not re-mapped) or the JS APPLY/PLAYBACK path not using these refined
times. Focus there. Do NOT rewrite the engine first.**

## 4. If the fused approach is fundamentally not enough — the better algorithm the user wants
The user explicitly said: *"Why can't we combine a bunch of different approaches into one? Use the
old rhythm/syllable approach but use word recognition as anchors and wrap the rest. Or svaras/tones.
It should also work on texts without holdings/svaras."* They chose (via a question):
**fused matcher, accuracy-first (~1–3 min OK), bias against bleed (a hair short ≫ hearing the
neighbour), tiny fades, per-pāda now but keep it word-splittable.**

The robust target design (only partially realized in `align_fused.py`): **segment-based assignment.**
- Detect **speech segments** = audio between *real* pauses (≥ ~0.20 s; the silence map has 31
  stop-closures of 0.10–0.20 s that must be ignored — see `detect_silences` in `align_audio.py`,
  `min_silence_s` default 0.12 is too low for boundary use).
- There are usually MORE pauses than padas (95 ≥0.20 s vs 32 lines here): pauses occur within
  padas too. So **assign consecutive segments to padas with a DP** that (a) uses MMS/recognition
  as a *soft positional prior* for which segment ≈ which pāda, (b) matches each pāda's assigned
  duration to its **mātrā/syllable** expectation, and (c) puts boundaries ONLY at real pauses
  (never mid-word) — falling back to a proportional split within a segment only where there is
  genuinely no pause (continuous refrains like "lekas salekas… / ketas saketas…").
- This is essentially what the OLD engine did (`align_core.assemble_sections`, the rhythm/syllable
  matcher the user said "matched nicely"). Forced alignment (MMS) should be **one anchor signal**,
  not the boundary source.

## 5. The mapping engine — files & flow
Entry: `POST /api/align/run` (editor.py ~4xxx) → `align_service.run(request)`.
- `align_audio.py` — decode 16 kHz mono, `detect_silences`, `speech_span`, `snap_to_silence`.
- `align_ctc.py` — **PRIMARY**: Meta MMS wav2vec2 forced alignment (torch+torchaudio, ~1.2 GB model
  in `cache/models`, CPU, emissions chunked 15 s to bound RAM). Per-pāda token spans + CTC score.
  **This is what compresses padas (the root cause).**
- `align_recognize.py` + `align_fuse.py` — FALLBACK: faster-whisper transcript + phonetic
  Smith–Waterman (`align_core.phonetic_similarity`), then proportional mātrā layout.
- `align_roman.py` — IAST & Devanagari → shared 21-phone alphabet (the thing that makes matching
  work across scripts).
- `align_core.py` — dataclasses (`TargetSection`, `PlacedRegion`, `TextEvent`), SW, mātrā,
  `assemble_sections` (the old rhythm matcher — reusable for §4), thresholds.
- `align_fused.py` — **NEW** fusion + bleed-free boundary refinement (my fix; not working in-app).
- Non-chant levels (title/subtitle/comment/translation) are **skipped** (never mapped).

## 6. How to test (no GUI needed for the engine)
- **Engine via the real service path** (USE THIS to reproduce the app):
  `PYTHONUTF8=1 python tests/manual_e2e.py "C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf" "https://www.youtube.com/watch?v=u_FzN8wdHg0"`
  → prints per-line `[mm:ss-mm:ss] status conf` + `MONOTONIC` + `BLEED:` (overlap count).
- **Boundary diagnostic** (direct refine, bypasses align_service):
  `PYTHONUTF8=1 python tests/diag_align.py "<pdf>" "<url>"` → dumps silences (with durations),
  raw MMS spans vs refined, and flags each boundary `PAUSE(...)` vs `IN-SPEECH!!`. **Compare its
  output to manual_e2e's — if they differ, the align_service↔refine wiring is the bug (§3.1).**
- Audio is cached at `cache/youtube_test/u_FzN8wdHg0.mp3` (and `Z_T8DlLwjeU.mp3`).
- Unit tests: `PYTHONUTF8=1 python -m pytest tests/ -q` (currently 23 green — but green tests did
  NOT catch this in-app bug; that's the lesson: add an integration test through `align_service.run`).
- **Add a missing test**: an integration test that calls `align_service.run` with real-ish targets
  and asserts boundaries land in pauses + no `fused_error` in diagnostics. The unit tests only
  exercise `refine` directly, which is exactly the gap that hid this bug.

## 7. Suggested order for the next session  (the backend is CORRECT — see §3.2; chase the frontend)
1. **STALE REGIONS first (most likely):** Have the user open the doc, **re-run "Map audio to text"**
   from scratch on a FRESH attach (not a doc that was mapped+saved by old code), and re-test. If
   that fixes it, the problem was simply old persisted regions. Consider clearing `cache/` and any
   `.smdoc` that has old regions. Confirm the dialog's "Apply" writes the NEW region times.
2. **Trace the JS apply/playback path** (the regions the app actually plays):
   - `dialog-audio-editor.js`: `runAnchorAlign` (~1832) builds `mapped` from `result.regions`
     (includes refined `start/end/fadeIn/fadeOut`) → `installRegionsFromMapped` (~2008). **Log the
     installed regions' start/end and compare to the `/api/align/run` JSON.** Confirm nothing
     client-side recomputes/overrides them (e.g. an old auto-split, a proportional fallback, or
     `decodeAudioForWaveform`'s old auto-match path that I removed — double check it's gone).
   - On **Apply**: `applyChanges` (dialog) → `audio_editor_apply` → `_applyAudioEditorResult`
     (editor-quill.js ~5244) inserts attachments with `startTime/endTime` from the region. **Log
     each inserted attachment's `data-start-time/end-time`.**
   - **Playback**: `_playPreciseAttachmentRange` (editor-quill.js ~13790) uses `startTime/endTime`
     from the attachment dataset + the decoded buffer. Confirm it plays `[start,end]` of THIS
     attachment, not a stale/`0..duration` range. (Note the recent single-copy audio change: src is
     resolved by id via `resolveAudioSrc` — make sure the right buffer is used.)
3. Only if the backend is somehow not what the app receives: check `/api/align/run` response in the
   running app (DevTools / a logged dump) and confirm `diagnostics.fused === true`, no `fused_error`,
   and the region times match `manual_e2e`.
4. **Add the missing integration test** (this whole bug hid because tests only exercised `refine`
   directly and `manual_e2e` was not re-run through `align_service.run` after each change): a test
   that calls `align_service.run` end-to-end (or at least asserts the dialog→apply→attachment
   `start/end` equal the mapped regions).
5. Verify with the user by **LISTENING** — structural metrics (no-overlap, on-pause%) looked good
   while the app was still wrong, so trust the ear over the proxies.
6. Long-term robustness (only if MMS compression still bites on other recordings): the
   **segment-based DP** in §4 (MMS as a soft anchor; boundaries only at real pauses).

## 8. Files touched this session (all uncommitted, on `main`)
- PDF: `pdf_import.py`, `tests/test_pdf_import.py`.
- Audio storage: `editor-quill.js` (blot + dedupe + getSerializableHTML + playback-by-id),
  `document-manager.js` (saveUntitled light, save sites), `file-operations.js`, `editor.py`
  (cache_untitled hardening).
- Audio UI: `dialog-audio-editor.html`/`.js` (loading overlay, sections filter, fades),
  `dialog-audio-picker.html` (YouTube URL field).
- Alignment: `align_fused.py` (NEW), `align_service.py` (wired refine + emit fades),
  `tests/test_align_fused.py` (NEW), `tests/manual_e2e.py` (BLEED metric), `tests/diag_align.py` (NEW diagnostic).
- Specs: `specs/003-*`, `specs/004-*`, `specs/005-*`. Docs: `CLAUDE.md`,
  `documents/audio-editing-and-matching.md`.

## 9. Tunables in `align_fused.py` (if refine IS running but boundaries are off)
`_TRIM=0.04`, `_FADE=0.04`, `_SNAP_WINDOW=0.6`, `_MIN_SIL=0.10`, `_MIN_REGION=0.18`,
`_FILL_GAP_FRACTION=0.55`. Boundary search uses the inter-MMS gap and `_best_pause(..., min_len=0.18)`.
Raising `min_len` toward 0.22–0.25 ignores stop-closures more aggressively.

---

## 10. SESSION UPDATE — 2026-06-08 (agent 2): backend confirmed correct; isolated the engine
Acting on §3.2's steer (chase the frontend, don't rewrite the engine). Findings & changes:

### What I proved
- **Backend is correct even with the APP's exact payload.** New A/B harness `tests/diag_events.py`
  runs the REAL `align_service.run` on the cached audio TWICE — once with `events=[]` (the
  `manual_e2e` payload) and once with **populated per-syllable `events`** (the app payload shape,
  which exercises `coarsen_text_events` + the non-uniform `_weight()` in `refine` — the path
  `manual_e2e` never touched, §3.1's open question). Result: **byte-identical, 0 overlaps in both**
  (`engine=mms_fa`, `fused=True`, line 1 keeps "tvā" `04.13–12.61`). So `events` is NOT the divergence.
- **`refine` guarantees non-overlapping regions for ANY engine** (it re-derives boundaries from
  anchors+silence). Therefore an in-app **engine fallback alone cannot reproduce compounding bleed** —
  refine would still clean it. ⟹ a compounding in-app bleed is almost certainly **STALE REGIONS
  persisted by pre-`005` code** (the doc is replaying old saved region times = literally "same as
  before"). FIX: user must re-run "Map audio to text" (apply already replaces all regions for that audio).

### Root-cause for the in-app↔standalone discrepancy (the one CODE cause)
- Flask is a **daemon thread inside the PyQt process** (`editor.py:2128 FlaskServerThread`). So MMS
  (torch ~1.5 GB) loaded in-process competes with WebEngine + open doc (39 MB puruṣa sūktam!) + audio
  on an 8 GB/<1 GB-free machine → OOM/thrash/segfault → degrade or fail. Standalone harnesses get a
  fresh process with full RAM headroom → MMS succeeds. **That headroom is why standalone works and
  in-app may not.**

### Changes made (all uncommitted, on `main`)
1. **Process isolation** — `align_runner.py` (NEW): stdlib CLI, reads request JSON → `align_service.run`
   → writes response JSON. `editor.py /api/align/run` now calls `_run_alignment_isolated(payload)`
   (spawns the runner as a child, file-based I/O, `PYTHONUTF8=1`, 600 s timeout); on non-zero exit /
   exception it **falls back to in-process** (never worse than before). torch lives only in the child,
   freed on exit; a segfault kills only the child. **Validated e2e** by `tests/diag_isolated.py`:
   child exit 0, `engine=mms_fa`, `fused=True`, 0 overlaps, region times identical to in-process.
2. **Diagnostics** — `/api/align/run` always writes `cache/align_debug.json` (engine used,
   `fused`/`isolated` flags, any `ctc_error`/`whisper_error`, speech_span, region times). **NEXT
   SESSION: after the user re-maps in-app, READ THIS FILE** — it settles stale-regions vs fallback vs
   misapply instantly. If `engine=mms_fa, fused=true, isolated=true` and region times look like
   §3.2 but playback is still wrong → it's stale regions (doc not re-mapped) or JS apply; if
   `engine` is whisper/proportional or `ctc_error` set → isolation/torch problem in the child.
3. **Button↔attachment id-collision fix** (`editor-quill.js`) — single-copy audio makes ALL
   attachments share one `data-audio-id`, so `updateAudioButtonPositions`'s `[data-audio-id=…]`
   lookup returned the SAME first button for every line (buttons piled onto one line on
   scroll/resize). Now uses a direct `attachment._buttonContainer` node reference set at build time.
4. **Tests** (suite now 28 green): `tests/test_align_service_events.py` (closes §7.4 gap — coarsen+refine
   with populated non-uniform real-text events stays bleed-free), `tests/test_align_runner.py`
   (isolation protocol guard, fast/torch-free). Diagnostics: `tests/diag_events.py`, `tests/diag_isolated.py`.
- Spec: `specs/006-isolated-alignment/spec.md`. Docs: CLAUDE.md audio section updated.

### What's left to confirm (needs the user / GUI — I could not drive it)
- Have the user **re-map a FRESH attach in-app** and LISTEN. Then `cat cache/align_debug.json`.
  If still wrong with a clean debug snapshot, the residual is stale regions or JS apply — trace
  `_applyAudioEditorResult` writing `data-start-time/end-time` (editor-quill.js ~5301) against the
  debug regions. The single-copy re-fetch edge case (old attachments under a DIFFERENT audio id
  survive STEP-1 cleanup) is worth a look if they re-fetched the YouTube audio rather than re-mapping
  the same attachment.

---

## 11. SESSION UPDATE — 2026-06-09 (agent 2 cont.): ⭐ TRUE ROOT CAUSE FOUND & FIXED
The user reported **gross misplacement** (a pāda playing a completely different shloka — e.g. the
"lekas salekas" line 47 playing shloka-10 audio from lines 43-44), not just bleed, and **different
results between runs**. This is a DIFFERENT bug from the boundary bleed of §3-§10.

### What it was (proven, not guessed)
`cache/align_debug.json` from the user's actual in-app run showed: **`engine: "proportional"`**,
`whisper_error: ImportError(OSError 1114 "DLL initialization routine failed")`, `ctc_error: null`
(torch import returned False from `ctc_available()`). So **in-app BOTH real engines failed to load**
and it silently degraded to `proportional` — a blind mātrā split with **no acoustic matching at
all**. That is why placement "made no sense": proportional just slices the timeline by syllable
count, so a pāda lands wherever its fraction falls (≈right early on when tempo is uniform → "first
run majority fine, offset at the end"; arbitrary later → "plays a pāda from earlier").

### Why (confirmed empirically, editor-quill/editor.py)
**Importing PyQt6 prepends `…\PyQt6\Qt6\bin` to `os.environ['PATH']`.** Those Qt DLLs collide with
torch's / ctranslate2's native DLLs, so **in the editor process `import torch` raises the exact
`OSError 1114`** (reproduced directly: `import PyQt6.QtCore` then `import torch` → 1114). Both
engines need those libs → both fail → proportional. My standalone harnesses worked only because a
clean shell never imported PyQt6, so `Qt6\bin` was never on PATH. **And my §10 isolation child still
failed** because it inherited the poisoned PATH via `dict(os.environ)`.

### The fix (validated end-to-end under the real condition)
`align_runner.child_env(base)` strips any `PyQt6` / `Qt6\bin` entry from the child's PATH (+ forces
UTF-8). `editor.py /api/align/run` spawns the isolated child with this env. Proven by
`tests/diag_pyqt_isolated.py`: a parent that **imports PyQt6 first** (Qt6 on PATH, reproducing the
app) then runs the isolated align → **`engine=mms_fa`**, line 47 at its own `02:09-02:16`, shloka 10
at `01:58-02:08`, **0 out-of-order**. Regression-locked by `tests/test_child_env.py` (incl. a
PyQt6-pollution→child-loads-torch e2e). Diagnostics now also record `isolated` + `engine`; an
`engine` of `proportional` in `align_debug.json` is the tell that the real engines didn't load.

### Diagnostics added this session (reusable)
`tests/diag_dumptext.py` (full line list), `tests/diag_full.py` (per-line placement for BOTH
engines + out-of-order flags — both engines are in-order/correct on real text, ruling the backend
out), `tests/diag_isolated.py` / `tests/diag_pyqt_isolated.py` (isolation e2e, the latter under Qt
pollution). Suite: **32 green**. Spec updated: `specs/006-isolated-alignment/spec.md`.

### Next session
The user must **re-map in-app with the updated `editor.py`** and listen. Confirm via
`cache/align_debug.json` that `engine` is now `mms_fa` (or `whisper-*`) and `isolated: true` — NOT
`proportional`. If it is still `proportional`, read `ctc_error`/`whisper_error` there: the child's
PATH/env still has a conflict (widen the strip in `align_runner.child_env`).

---

## 12. SESSION UPDATE — 2026-06-09 (agent 2 cont.): MMS now runs in-app; honest-unassign + UX
The DLL fix (§11) worked — `cache/align_debug.json` confirmed `engine=mms_fa, isolated=true`. The
user then reported residual **gross misplacement at the end of the document**: an out-of-audio verse
(the optional gāyatrī "tanno dharāḥ", line 68) was getting a confident region and **stealing the
audio of the real last line of shloka 12** (line 59 "puṇyaṁ ślokaṁ"); plus "no failure message".

### Is recognition the answer? NO — tested, Whisper is useless on this chant.
`tests/diag_recognize.py` (whisper-tiny): transcribed **nothing for the first ~2 min** and emitted
**Chinese ("天下")** with 0.9 prob for the last 15 s. So ASR cannot anchor mapping for Vedic chant.
**MMS forced alignment IS the "use the words" approach** and is correct for present text — `tests/
diag_scores.py` shows real lines score CTC **0.64–0.98**; the out-of-audio gāyatrī scored **0.32**
(clean separation). The bug was that `refine` laundered that 0.32 into `matched 0.61` and pulled its
start back across unassigned lines 59/67 to grab line 59's audio.

### Fix (in `align_fused.refine`, validated by `diag_scores.py` re-run)
1. **`_CONF_FLOOR = 0.40`** — an anchor scoring below it is UNASSIGNED, not placed (out-of-audio).
2. **No confidence inflation** — refined conf capped near the raw CTC score (`base + 0.12`), so a
   weak line stays visibly low / unassigned instead of becoming a confident false match.
3. **No cross-unassigned stealing** — when document lines between two anchors are unassigned, their
   gap audio is left alone (each anchor only tidies to a silence within ±0.30 s of its own edge).
4. **`_FILL_GAP_FRACTION 0.55 → 0.75`** — rhythm-fill only when the gap closely matches expected
   length (honest-unassigned over fabricated, per the user).
Result on bhū sūktam: line 68 (gāyatrī) → **unassigned** (was stealing 59's audio); lines 59/67 →
unassigned; **all 31 real lines unchanged/correct; 0 regressions**. Line 59 still gets no cut (its
audio is genuinely hard for MMS and ASR can't help) — honest gap the user can fill by hand.
Regression tests: `test_low_ctc_anchor_is_unassigned_not_fabricated`,
`test_anchor_does_not_steal_audio_across_unassigned_line` (in `tests/test_align_fused.py`).

### Surfacing ("no failure message")
`dialog-audio-editor.js`: chant lines with no placement are now marked **`unmatched`** (distinct
from non-chant `skipped`); the post-map status is computed over CHANT lines only, says e.g. "31
matched, 3 not found in audio … see the Sections list", and is **pinned** (no auto-clear) for any
warning/error. Proportional now shows a loud `⚠ Speech engine unavailable` error.

### UX (`dialog-audio-editor.html/.js`)
- Removed the redundant **YouTube URL field** from the editor toolbar (it lives in the picker before
  the editor). Replaced with a **🗑 Delete cut** button that removes the selected region(s) via the
  existing `removeSelectedRegions` (keeps the audio; only the cut + its play button go). Enabled when
  a region is selected. `fetchYouTubeAndMap` is now dead code (left in place, unreferenced).
- Per-region "x" on the waveform was suggested by the user but NOT done (toolbar button + the
  Regions-list remove button cover it) — a future nicety.

### Still needs the user's ear (could not drive GUI)
- Re-map in-app and listen. The **tail of line 49 ("viyantu ॥11॥")** ending a hair early is a
  sub-second boundary-snap issue I could not tune blind (backend shows 49 → `02:24.78–02:33.90`,
  next line at `02:34.50`, comment 53 correctly `skipped` — so "viyantu attached to the comment" is
  NOT in the current backend; likely it was the old proportional run). If still cut, it's the
  `_best_pause` window picking a within-pada silence — needs the audio to tune.
- Suite now **34 green**. Diagnostics added: `tests/diag_scores.py`, `tests/diag_recognize.py`.

---

## 13. SESSION UPDATE — 2026-06-09 (agent 2 cont.): segment+mātrā recovery; comment block class
The DLL fix made MMS run in-app; the user then reported the real accuracy bugs: lines **cut off**
(trailing words), **one line entirely missing** (line 59, which IS in the audio), and audio on a
**comment** ("om" on "taittirīya saṁhitā 1.5.3"). Tested Whisper as an anchor — **useless on chant**
(`diag_recognize.py`: nothing for 2 min, Chinese "天下" at the end). So MMS forced alignment stays
the engine; fixed its failure modes in `align_fused.refine` (validated by replaying cached MMS via
`tests/iter_refine.py` — see `tests/cache_raw_mms.py`, instant iteration, no 97 s MMS re-run):

1. **Low-CTC not anchored** — an anchor must score ≥ `_CONF_FLOOR` (0.40). The out-of-audio gāyatrī
   (0.32) was anchoring and occupying line 59's audio; now it falls into the None-run.
2. **Tail-keeping boundary** — cut at the LATEST real breath (≥`_MIN_BREATH` 0.22 s) *before the next
   pada's onset* (`_latest_breath`, window capped at `sb`), so a pada keeps its last syllable
   ("nā", "viyantu") without grabbing the next pada's start.
3. **Segment + mātrā recovery** (`_speech_segments`, `_content_after/_before`) — for unplaced padas
   between anchors, the gap's real breath-bounded speech segments + cumulative mātrā (≤1.25× slack)
   decide how many padas are actually present; assign in order, the first is always recovered,
   extras only if the audio holds them, the rest stay UNASSIGNED. Recovers line 59; leaves the
   skipped gāyatrī unassigned. Both `_content_after` (skip the left anchor's compressed tail) and the
   mātrā gate are essential.
End-to-end through real `align_service.run` (manual_e2e): **32 matched in-order, 0 overlaps**, line 59
recovered `02:58.45–03:03.08`, line 58 keeps "nā" `…–02:57.91`, gāyatrī UNMATCHED, comments skipped.

**Comment misclassification (root cause + fix).** The user's doc had comments as
`<p><span class="ql-comment-style">…</span></p>` — classless `<p>`, so `_getLineLevel` (paragraph
class only) returned 'line' → comments became chant and got audio. Cause: `comment-style` is an
INLINE Quill format, so the PDF import's block `<p class="ql-comment-style">` was demoted on load.
Fixes: (a) registered a **block** `comment-block` / `ql-doc-comment` format + clipboard matcher + CSS
(editor-quill.js); (b) PDF import now emits `ql-doc-comment` for citations (`pdf_import.py
STYLE_CLASS`); (c) `_getLineLevel` also detects inline `ql-comment-style`/`ql-translation-style` by
content (backward-compat for old docs). Re-import gives clean, round-tripping, non-chant comments.

**Surfacing & UX.** Unmatched chant lines are now marked `unmatched` (distinct from `skipped`
non-chant); the post-map status counts CHANT lines only, says "N not found in audio … see Sections",
and is pinned (no auto-clear) for warnings/errors. Removed the redundant YouTube URL field from the
audio-editor toolbar; added a **🗑 Delete cut** button (deletes selected region(s) via
`removeSelectedRegions`, keeps the audio).

**Tunables** (`align_fused.py`): `_CONF_FLOOR=0.40`, `_MIN_BREATH=0.22`, recovery mātrā slack `1.25`,
`_FILL_GAP_FRACTION=0.75`. **Dev harness**: `tests/cache_raw_mms.py` (cache MMS once) +
`tests/iter_refine.py` (replay refine in ms) — use this to tune boundaries without the 97 s MMS run.
Suite **36 green**. Diagnostics: `diag_scores.py` (raw-vs-refined per line), `diag_recognize.py`,
`diag_dumptext.py`, `diag_full.py`.

### Still needs the user's EAR (sub-second, can't tune blind)
- Re-import the PDF + re-attach the URL, re-map, LISTEN. Confirm: comments have no audio; line 59
  plays; "nā"/"viyantu" aren't clipped; gāyatrī has no cut. If a tail/onset is still a hair off, it's
  a `_MIN_BREATH`/`_latest_breath`-window tuning question — give me the line and what you hear.
