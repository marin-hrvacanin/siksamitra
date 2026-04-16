# śikṣāmitra

**śikṣāmitra** (Sanskrit: *śikṣā* "phonetics" + *mitra* "friend") – a specialized desktop editor for Vedic and classical Sanskrit text.

---

śikṣāmitra is a desktop application for transcribing, annotating, and studying Vedic texts in IAST transliteration. It implements the principles of **Śikṣā** – the Vedāṅga (auxiliary science) of phonetics – covering *varṇa* (letters), *svara* (pitch/accent), *mātrā* (duration), *balam* (force), *sāma* (linking), and *santāna* (continuity). Developed by Marin Hrvacanin inspired by the work of Davor Virkes.

<!– TODO: Add screenshot –>

---

## Features

### Text Processing

- Bidirectional Devanagari/IAST transliteration with proper handling of Vedic svara combining marks (U+0951, U+0952, U+1CDA) — marks are drained after each syllable and emitted on the correct IAST character
- Support for U+A8F3 (ꣳ Vedic tiryak) mapped to ṁ
- Unicode normalization and character standardization
- Automatic pre-processing: lowercasing, danda conversion (`.` to `।`, `..` to `॥`), ṃ/ṁ normalization
- Canonical svara mark conversion (U+0951, U+0952, U+1CDA variants normalized to standard forms)
- Bīja mantra preservation: common seed syllables (oṁ, hrīṁ, śrīṁ, klīṁ, etc.) at line start are excluded from anusvara transformation

### Vedic Grammar Engine

Source-aware phonological rule engine supporting multiple Vedic traditions:

| Rule | Description |
| --- | --- |
| Anusvara transformations | Nasal assimilation based on following consonant class; tradition-specific behavior for Rgveda, Yajurveda, Krsna Yajurveda, and Smrti |
| Visarga sandhi | Automatic transformation of visarga based on following consonant and preceding vowel |
| Svarabhakti epenthesis | Insertion of middle dot after r before sibilants, h, or r |
| Pause detection | Short (`\ | ) and long (\ | \ | `) pauses at word boundaries based on vowel length |
| Special insertions | Vedic pronunciation rules: jñ → jgñ, sv → suv, vy → vuy (walks Quill positions directly to handle combining marks) |

### Svara Accent System

Three Vedic pitch accents rendered as Unicode combining diacritics:

| Accent | Unicode | Display | Description |
| --- | --- | --- | --- |
| Anudatta | U+0331 | a̱ | Low pitch – combining macron below |
| Svarita | U+030D | a̍ | Rising pitch – vertical stroke above |
| Udatta | U+030E | a̎ | Extra high pitch – double vertical stroke above |
| Candrabindu | U+0310 | m̐ | Nasalized resonance (Rgvedic) |

### Holdings (Samyukta Marking)

Visual border markers applied to the first consonant of a consonant cluster:

| Type | Appearance | Condition |
| --- | --- | --- |
| Short holding | Thin green border | Preceding vowel is short (a, i, u, r, l) |
| Long holding | Thick green border | Preceding vowel is long (a, i, u, r, l, e, ai, o, au) |

Consonants that cannot host a holding: ṅ ñ ṇ n m ṁ ṃ r ś ṣ s.

### Rich Text Editing

- Quill.js-based editor with custom blots
- Paragraph styles: Title, Subtitle, Section, Subsection, Translation, Comment
- Bold, italic, underline formatting
- Font selection (URW Palladio ITU, Gentium Plus, IBM Plex Sans)
- Custom blots for holdings, change marks, and svara accents

### Audio

- Embed recitation audio directly in `.smdoc` documents
- Multi-region audio editor with selected-only, show-all, hide-all, and per-region visibility control
- Fade-in and fade-out support on each region, preserved through save/load and export
- Automatic audio matching for the selected text, with the clicked region staged first in the editor
- Script-aware auto-match weighting across IAST, Devanagari, Telugu, Tamil, and Kannada text
- For interleaved shloka/translation layouts, matching follows the chosen target lines in order (include only shloka lines when audio contains recitation only)
- Audio stored as base64 data URIs within the document file
- See `documents/audio-editing-and-matching.md` for the full workflow and data model

### Text Import

- **SanskritDocuments.org**: Browse and import texts by category (Veda, Upaniṣad, Stotra, etc.) with automatic verse splitting, preamble separation, and Devanagari text extraction
- **Shlokam.org**: Search and import individual ślokas
- Import source selection persisted in localStorage
- **DOCX import**: Import `.docx` files via python-docx (optional dependency)

### Export

- Standalone HTML export with embedded fonts and complete styling
- Full-fidelity viewer with all holdings, pauses, and svara marks preserved

### Themes

- **Light** – "Ochre and Saffron" palette (ochre primary, saffron accent, warm paper background)
- **Dark** – deep black background with softened ochre and green tones
- System theme detection supported

### Document Format (.smdoc)

- Custom JSON-based format storing content, metadata, styles, and audio
- Audio attachments store region timing plus fade metadata (`fadeIn`, `fadeOut`) so playback and export can reconstruct the full behavior
- LZMA compression at preset 9 with EXTREME flag; `SMDI` magic byte prefix
- Legacy zlib-compressed files (`SMDC` prefix) and plain JSON files remain readable
- Content stores only the editor innerHTML, not the full HTML shell

---

## Installation

### Prerequisites

- Python 3.10+
- pip

### Steps

```bash
# Clone or download the project
cd sikshamitra/editor

# Install Python dependencies
pip install -r requirements.txt
```

No internet connection is required after installation. All fonts and libraries are bundled locally.

---

## Usage

```bash
python editor.py
```

The application starts a local Flask server on a dynamically assigned port and opens a PyQt6 desktop window with an embedded web engine. All processing and file operations are entirely local.

### Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl+N | New document |
| Ctrl+O | Open document |
| Ctrl+S | Save document |
| Ctrl+Shift+S | Save As |
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+U | Underline |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Desktop shell | Python 3.x + PyQt6 (QWebEngineView) |
| Local API | Flask |
| Frontend | HTML5 + JavaScript (ES2020+) + CSS3 |
| Rich text editor | Quill.js with custom blots |
| Document format | .smdoc (LZMA-compressed JSON) |
| Fonts | URW Palladio ITU, Gentium Plus, IBM Plex Sans |

No build step, no bundler, no transpiler. JavaScript runs directly in the embedded browser.

---

## Project Structure

```
editor/
├── editor.py                  -- Entry point: PyQt6 app + Flask server
├── editor.html                -- Main UI shell (ribbon, toolbar, editor)
├── editor-main.js             -- SiksamitraEditor orchestrator class
├── editor-quill.js            -- Quill integration and toolbar logic
├── sanskrit_rules.js          -- Grammar engine (SanskritRules + SanskritProcessor)
├── smdoc-format.js            -- .smdoc format: save, load, compress, export
├── custom-blots.js            -- Custom Quill blots (holdings, change, svara)
├── document-manager.js        -- File browser and session management
├── file-operations.js         -- File I/O via Flask API
├── modal-dialogs.js           -- UI dialog components
├── theme-manager.js           -- Theme switching and persistence
├── pyqt-bridge.js             -- JS <-> PyQt QWebChannel bridge
├── styles.css                 -- Complete design system (CSS custom properties)
├── preferences.json           -- User preferences (theme, recents, auto-save)
├── requirements.txt           -- Python dependencies
├── lib/                       -- Vendored libraries (Quill.js)
├── icons/                     -- SVG icon set
├── Library/                   -- Sample .smdoc documents
├── documents/                 -- Technical documentation (architecture, grammar, format specs, audio workflow)
├── media/                     -- Audio and image attachments
├── design/                    -- Design assets
└── cache/                     -- Temporary files (safe to clear)
```

---

## Document Format (.smdoc)

Documents are saved as `.smdoc` files containing a JSON structure:

```json
{
  "version": 1,
  "content": "<editor innerHTML>",
  "meta": {
    "title": "...",
    "created": 1234567890,
    "modified": 1234567890,
    "author": ""
  },
  "styles": { ... },
  "audio": { ... }
}
```

The `styles` and `audio` fields are omitted when empty. The `content` field stores only the Quill editor innerHTML – the full HTML document shell is reconstructed at export time.

**Compression**: Current files use LZMA at preset 9 + EXTREME with a 4-byte `SMDI` magic prefix. Legacy files with the `SMDC` prefix (zlib) and plain-text JSON files are transparently decompressed on read.

---

## Grammar Rules Overview

| Rule | Engine Method | Summary |
| --- | --- | --- |
| Pre-processing | preProcessRawText | Normalize Unicode, lowercase, convert dandas and svara variants |
| Anusvara | applyAnusvaraTransformations | Nasal assimilation by consonant class; source-specific behavior for sibilants; bīja mantra exclusion |
| Visarga | applyVisargaTransformations | Sandhi rules for visarga based on following/preceding phonemes |
| Transliteration | devanagariToIAST | Devanagari → IAST with Vedic svara mark draining |
| Insertions | applyAutomaticInsertions | jñ/sv/vy insertions via Quill position walking |
| Svarabhakti | applySvarabhaktiTransformations | Epenthetic dot after r + sibilant/glottal/ṛ |
| Holdings | findAllHoldings | Samyukta detection with dvivarcana and cross-word rules |
| Pauses | findAllPauses | Word-boundary pause marks based on vowel length |

Full rule specifications are documented in `CLAUDE.md` and `documents/grammar-rules.md`.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to your branch (`git push origin feature/your-feature`)
5. Open a pull request

Please ensure all Sanskrit terminology follows IAST conventions.

---

## License

<!– TODO: Add license –>

---

## About Veda Union

[Veda Union](https://vedaunion.org) is dedicated to the preservation and systematic study of Vedic knowledge. The Siksa module of their educational platform covers the phonetic science of Sanskrit, forming the foundation for correct Vedic recitation and textual scholarship.
