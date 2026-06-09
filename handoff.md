# śikṣāmitra — Handoff for the next session

**Purpose of this file:** hand to a fresh agent so it can continue with the
spec-kit workflow. Covers the overall idea, what's built, the immediate next
task (faithful PDF holding extraction), and the **audio-matching** feature
(which the user has NOT yet successfully tested in-app — see the blocking UX bug).

**Hard rules (from the user):**
- Do **not** `git commit` or `git push` anything. Work in the tree on `main`; the user reviews/commits.
- Everything runs **locally / offline**. No cloud APIs.
- Use the **spec-kit** cycle for non-trivial work (skills installed in `.claude/skills/speckit-*`):
  `/speckit-specify → /speckit-plan → /speckit-tasks → /speckit-implement`.
  (If the harness can't invoke them via the Skill tool, execute the steps in each
  `.claude/skills/speckit-*/SKILL.md` directly — same artifacts. Branch creation is
  disabled, so no git side-effects.)

---

## 1. The vision (what this is for)

śikṣāmitra (Veda Union) is a desktop editor for Vedic/Sanskrit text. Target workflow,
which must become **dead simple and extraordinarily accurate**:

> Import a text (Veda Union **PDF**, Word, or Devanagari paste) → **apply the changes**
> (grammar engine: holdings, pauses, svara styling) → paste a **YouTube URL** → the audio
> is auto-mapped onto the shlokas with clean, slightly-faded cuts; play all or play each line.

Two pillars:
1. **Import** (must be *faithful* — "import" means reproduce the source exactly).
2. **Audio↔text mapping** (must be accurate, in-order, translations excluded).

---

## 2. Environment (verified this session)

- Windows 11, **Python 3.14.3**, PyQt6 + Flask + Quill.js (no build step).
- Hardware: **Intel i3 (2c/4t), ~8 GB RAM (often <1 GB free), ~5 GB free disk, no GPU.** Lightweight matters; close apps before heavy runs.
- Installed & working: `torch 2.11.0+cpu`, `torchaudio 2.11.0+cpu`, `faster-whisper 1.2.1`, `ctranslate2 4.7.1`, `librosa`, `numpy`, `PyMuPDF 1.27`, `yt-dlp`, **ffmpeg on PATH**.
- Model caches live in `cache/` (**gitignored**): MMS model `cache/models/hub` (~1.2 GB, already downloaded); faster-whisper tiny/small in `cache/models/`.
- Run the app: `python editor.py`. Run tests: `python -m pytest tests/ -q` (13 pass). Use `PYTHONUTF8=1` for any script printing Sanskrit (Windows cp1252 console).

---

## 3. What's already built (this + prior sessions)

### Audio→text mapping engine (feature `specs/001-unified-audio-alignment/`)
One Flask entry: `POST /api/align/run` → `align_service.run`. Engine order:
- **PRIMARY: `align_ctc.py`** — Meta **MMS wav2vec2/CTC forced alignment** (`torchaudio.pipelines.MMS_FA`). Text-driven (aligns KNOWN text phones to audio frames), so it places passages Whisper can't recognize. **Emissions MUST be computed in chunks** (15 s) — a single full-clip pass *segfaults* on this RAM. Model auto-downloads to gitignored `cache/`.
- **FALLBACK: Whisper** — `align_recognize.py` (faster-whisper, small default→tiny) + `align_fuse.py` (phonetic Smith–Waterman, global-monotonic + order-constrained recovery). Then **proportional** (mātrā durations) if all else fails.
- Shared: `align_roman.py` (IAST **and** Devanagari → 21-phone alphabet; both fold identically — this is what makes alignment work), `align_audio.py` (decode 16 kHz mono + silence detection), `align_core.py` (dataclasses, Smith–Waterman, `phonetic_similarity`, thresholds).
- Non-chant levels (`title/subtitle/comment/translation`) are **skipped** from mapping (translations never grab audio).
- **Measured result** on bhū sūktam + its YouTube recording: **MMS 31/34 mantra lines matched, 0 out-of-order**, ~2 min on this laptop. (Whisper-only missed the opening verses — that's why MMS is primary.)

### YouTube fetch (test convenience)
- `youtube_audio.py` (yt-dlp + ffmpeg → mp3 in `cache/youtube_test/`), `POST /api/align/youtube`, CLI `youtube_map.py`, and a **"Paste YouTube URL → Fetch & map"** box inside the audio-editor dialog (`dialog-audio-editor.*`).
- **Manual E2E harness:** `python tests/manual_e2e.py "<pdf>" "<youtube url>"` → prints the per-line timeline. This is the fastest way to test mapping.

### PDF import (feature `specs/002-veda-union-pdf-import/`) — `pdf_import.py`
PyMuPDF reads per-span font/size/color/position and reconstructs structure:
- Classifies **title / subtitle / comment(source) / shloka / translation**; drops running header + page numbers (y-band).
- **Two-pass row clustering** reattaches the dark-red Vedic **accent glyphs** to the correct base char (fixes accent leakage). Line 1 reconstructs exactly: `bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam mahi̱tvā ।`.
- Emits **editor-native markup** (verified against `Library/rudram.smdoc`, `puruṣa sūktam.smdoc`):
  - svaras → `<span class="ql-svara-true">̱</span>`
  - change-style → `<span class="ql-change-style">…</span>`; superscripts compose: `<sup><span class="ql-change-style">f</span></sup>`
  - **verses grouped**: pādas are consecutive `<p>`; verses separated by an empty `<p class=""><br></p>` (a verse ends on `॥`).
- Wired: `POST /api/file/import-pdf` (`editor.py`), open-flow branch in `document-manager.js`, and `.pdf` added to the Open dialog filter (`editor.py` ~line 2177/2231).

### Tests: `tests/` (13 passing) — `test_align_roman.py`, `test_align_fuse.py`, `test_pdf_import.py` (skips if PyMuPDF/PDF absent), fixtures in `tests/fixtures/`.

---

## 4. THE IMMEDIATE NEXT TASK — faithful PDF holding extraction (do this via spec-kit)

**Decision (user):** since the action is "import", it must be *faithful* — reproduce the
PDF exactly, **including holdings**. (Regenerating holdings via "Run Agent" is a separate
transform step, not import.) So: extract the holdings that are physically in the PDF.

**The format is already decoded (don't re-investigate):**
- Holdings are **green filled-rectangle boxes** in the PDF *vector* layer (not text), via `page.get_drawings()`. Fill RGB ≈ `(0.324, 0.508, 0.207)`.
- **Short vs long** = border/edge thickness: thin edge (~0.2 pt) → `ql-holding-short`; thick edge (~1.0 pt) → `ql-holding-long`.
- The box **x-range** identifies the consonant it surrounds; a holding wraps the **first consonant of a cluster**.
- Native target markup: `<span class="ql-holding-short">d</span>` / `<span class="ql-holding-long">g</span>`.

**The real work:** matching a box to the exact consonant *character* needs per-character
positions — use `page.get_text("rawdict")` (gives per-char bbox) instead of span-level, then
overlay holdings onto the reconstructed text and wrap the matching char. This means making
`pdf_import.py`'s reconstruction **char-aware** (currently span-aware). Verify against
`C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf` so the import is exact.

**Acceptance:** imported bhū sūktam shows the same holdings (short/long) on the same
consonants as the source PDF, with svaras/change/superscripts/verse-grouping already correct.

---

## 5. KNOWN ISSUES / BUGS (prioritized — the user says "very buggy overall")

1. **[BLOCKER for testing audio] No YouTube-URL entry point in the insert flow.**
   The user does `Ctrl+A → Insert → Media → Upload new audio`, which only opens the native
   file browser. The "Fetch & map" URL box is buried in the audio-editor dialog, which only
   opens *after* attaching a local file. **Fix:** add a "From YouTube URL" option to the
   Insert → Media flow (paste a URL → backend `/api/align/youtube` downloads → attaches +
   opens the editor + auto-maps). Find the insert-media UI in `editor-quill.js`
   (`insertAudioButton` → `attachAudioToCurrentSelection`) / `modal-dialogs.js`.
2. **Audio matching not yet validated through the GUI.** It's proven at the engine/CLI level
   (MMS 31/34), but the full in-app path (select text → attach → dialog → map → regions on
   waveform → play) has not been user-tested end to end. Do a QA pass.
3. **PDF subtitle** ("kṛṣṇa yajurvedīya") renders **UPPERCASE** ("KRSNA…") because
   `ql-doc-subtitle` has `text-transform: uppercase`. Decide: keep, or classify that line
   differently / strip the transform.
4. **MMS tail:** the last 2–3 lines (optional dhyāna + śānti) come back **unassigned**, and a
   couple of repetitive refrain lines get over-long spans. Consider enabling the MMS `*` star
   token to absorb gaps, and clamping implausibly long spans.
5. General audio-dialog QA: fades, play-all vs play-individual, region editing, `.smdoc`
   persistence of auto regions.

---

## 6. How to TEST right now (until issue #1 is fixed)

**Fastest (terminal, shows the mapping):**
```
cd "C:\Users\Gostinska soba\Desktop\śikṣāmitra\editor"
python tests/manual_e2e.py "C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf" "https://youtu.be/Z_T8DlLwjeU?si=HGhk06dqU-ScTMjv"
```
(Imports the PDF, fetches the audio, maps via MMS, prints `[mm:ss–mm:ss] matched 0.xx` per line; translations shown as skipped.)

**In-app (visual), current clunky path:**
1. `python editor.py`
2. **Open** the PDF (it now appears in the Open dialog's "PDF Files" filter) → structured import.
3. The YouTube audio is already cached at `cache\youtube_test\Z_T8DlLwjeU.mp3` (or run the CLI above once to fetch it).
4. Select the verse paragraphs → **Insert → Media → Upload new audio** → choose that mp3.
5. The **audio-editor dialog** opens and **auto-maps** (~2 min, MMS). It also has the **"Paste YouTube URL → Fetch & map"** box for re-fetching. Regions appear on the waveform; Play = all, per-region play = individual.

---

## 7. Key files

| Area | Files |
|------|-------|
| Audio engine | `align_service.py`, `align_ctc.py` (MMS), `align_recognize.py`, `align_fuse.py`, `align_roman.py`, `align_audio.py`, `align_core.py` |
| YouTube | `youtube_audio.py`, `youtube_map.py`, `/api/align/youtube` in `editor.py` |
| PDF import | `pdf_import.py`, `/api/file/import-pdf` in `editor.py`, branch in `document-manager.js` |
| Audio UI | `dialog-audio-editor.html` / `.js` (map button, Fetch&map box, fades, playback) |
| Editor core | `editor-quill.js` (insert-media flow, `_buildTarget`), `modal-dialogs.js` |
| Specs | `specs/001-unified-audio-alignment/`, `specs/002-veda-union-pdf-import/` |
| Tests | `tests/` + `tests/manual_e2e.py` |
| Grammar (holdings/pauses/svara source of truth) | `sanskrit_rules.js` |

---

## 8. Suggested order for the next session
1. `/speckit-specify` the **PDF holding extraction** task (§4) → plan → tasks → implement → verify against the real PDF.
2. Then fix **issue #1** (YouTube URL in the Insert→Media flow) so the user can finally test audio matching the simple way.
3. Then a full **audio-mapping GUI QA pass** (§5.2–#5) and the MMS tail/refrain refinements (§5.4).
