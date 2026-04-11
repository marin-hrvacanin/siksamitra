# Architecture — śikṣāmitra Editor

This document describes the technical architecture of the śikṣāmitra desktop application.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Operating System                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    editor.py (PyQt6)                      │   │
│  │                                                            │   │
│  │  ┌──────────────┐    ┌──────────────────────────────┐   │   │
│  │  │ Flask Server  │    │    QWebEngineView (Chromium)  │   │   │
│  │  │  (local port) │◄──►│                               │   │   │
│  │  │               │    │   editor.html + JS modules    │   │   │
│  │  │  /api/file/*  │    │   (Quill + Sanskrit engine)   │   │   │
│  │  └──────────────┘    └──────────────────────────────┘   │   │
│  │         │                         │                        │   │
│  │         ▼                         ▼                        │   │
│  │   Local filesystem          QWebChannel bridge             │   │
│  │   (documents/, media/,     (pyqt-bridge.js)               │   │
│  │    Library/, cache/)                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Communication Paths

### 1. HTTP (JavaScript → Flask)

JavaScript uses `fetch()` to call Flask endpoints:

```javascript
// Example: save a file
await fetch('/api/file/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, content: smdocJson })
});
```

All Flask endpoints are local (`localhost:<dynamic_port>`). The port is dynamically assigned at startup to avoid conflicts.

### 2. QWebChannel (JavaScript ↔ PyQt)

For OS-level operations (native file dialogs, window management):

```javascript
// pyqt-bridge.js initializes the channel
new QWebChannel(qt.webChannelTransport, function(channel) {
    window.pybridge = channel.objects.bridge;
});

// Then JS can call Python methods
window.pybridge.openFileDialog(callback);
```

### 3. Direct File Access

Flask serves files from `media/` via `/uploads/<filename>` endpoint. Large font files are embedded as data URIs to avoid HTTP overhead.

---

## Module Dependency Graph

```
editor.html
├── lib/quill.js              (external, bundled)
├── qwebchannel.js            (Qt provided)
├── custom-blots.js           (must load before Quill init)
├── smdoc-format.js           (no dependencies)
├── sanskrit_rules.js         (no dependencies)
├── theme-manager.js          (no dependencies)
├── modal-dialogs.js          (depends on editor-quill state)
├── file-operations.js        (depends on smdoc-format)
├── document-manager.js       (depends on file-operations, smdoc-format)
├── editor-quill.js           (depends on: quill, custom-blots, smdoc-format,
│                              sanskrit_rules, document-manager, file-operations,
│                              modal-dialogs, theme-manager)
└── editor-main.js            (depends on: editor-quill, all others)
```

Loading order in `editor.html` must respect these dependencies.

---

## Flask Server (`editor.py`)

### Startup sequence

1. Find a free local port
2. Start Flask in a daemon thread
3. Initialize QApplication and main window
4. Create QWebEngineView, set URL to `http://localhost:<port>/`
5. Set up QWebChannel and inject `qwebchannel.js` into the page
6. Enter Qt event loop

### Key endpoints

| Endpoint | Method | Input | Output |
|----------|--------|-------|--------|
| `/` | GET | — | `editor.html` content |
| `/api/file/read` | POST | `{ path: string }` | `.smdoc` JSON (decompressed) |
| `/api/file/save` | POST | `{ path: string, content: string }` | Success/error |
| `/api/file/browser` | GET | — | List of recent files |
| `/uploads/<filename>` | GET | — | File from `media/` |
| `/api/file/delete` | POST | `{ path: string }` | Delete a file |
| `/api/file/import-docx` | POST | `{ path: string }` | Import `.docx` as `.smdoc` JSON |
| `/api/recents/remove` | POST | `{ path: string }` | Remove from recent files |
| `/api/library` | GET | — | List library documents |
| `/api/library/browse` | GET | — | Browse library folder structure |
| `/api/library/folder` | POST | `{ path: string }` | Create a library folder |
| `/api/library/rename` | POST | `{ path, newName }` | Rename a library item |
| `/api/library/move` | POST | `{ path, destination }` | Move a library item |
| `/api/library/delete` | POST | `{ path: string }` | Delete a library item |
| `/api/library/save` | POST | `{ path, content }` | Save to library |
| `/api/library/read` | POST | `{ path: string }` | Read from library |
| `/api/library/import` | POST | `{ path: string }` | Import file into library |
| `/api/scratch/save` | POST | `{ content: string }` | Save scratch pad |
| `/api/scratch/load` | GET | — | Load scratch pad |
| `/api/scratch/clear` | POST | — | Clear scratch pad |
| `/api/cache/untitled` | GET/POST/DELETE | — | Auto-save backup management |
| `/api/cache/session` | GET/POST | — | Session state persistence |
| `/api/session/state` | GET/POST | — | Session state (alternate) |
| `/api/preferences` | GET/POST | — | Read/write preferences |
| `/api/preferences/<key>` | GET/PUT | — | Individual preference keys |
| `/api/media/upload` | POST | multipart file | Upload media files |
| `/api/media/list` | GET | — | List available media |
| `/api/sanskritdocs/categories` | GET | — | SanskritDocuments.org categories |
| `/api/sanskritdocs/index/<cat>` | GET | `?q=query` | Search documents in category |
| `/api/sanskritdocs/fetch/<cat>/<file>` | GET | — | Fetch and extract document text |

### Compression

The Python layer handles binary-level LZMA compression:

```python
import lzma

# Saving
compressed = lzma.compress(json_bytes, preset=9 | lzma.PRESET_EXTREME)
file.write(b'SMDI' + compressed)  # SMDI magic prefix (current)

# Reading
if data[:4] == b'SMDI':
    json_bytes = lzma.decompress(data[4:])
elif data[:4] == b'SMDC':
    json_bytes = zlib.decompress(data[4:])  # Legacy zlib format
else:
    json_bytes = data  # Legacy uncompressed plain JSON
```

Magic bytes: `SMDI` = LZMA (current), `SMDC` = zlib (legacy). Both formats are transparently readable. The LZMA preset `9 | PRESET_EXTREME` provides the best compression ratio, which is significant for large documents with embedded base64 audio.

The JavaScript `SMDocFormat` class handles a separate, lighter content compression (whitespace normalization only). The Python LZMA compression is the primary size reduction.

---

## JavaScript Architecture

### `SiksamitraEditor` class (`editor-main.js`)

The top-level orchestrator. Responsibilities:
- Initialize Quill editor
- Set up ribbon tab system
- Connect toolbar buttons to actions
- Set up keyboard shortcuts
- Coordinate all modules

### `SanskritRules` class (`sanskrit_rules.js`)

Pure data class — holds all phonological character sets as JavaScript `Set` objects. No methods beyond data definitions.

### `SanskritProcessor` class (`sanskrit_rules.js`)

Stateful processor — holds reference to `SanskritRules` and a `source` property (text tradition). Implements all grammar rule algorithms as pure functions that return arrays of replacement operations.

**Design principle**: The processor never modifies the editor's DOM directly. It returns a list of operations `[{ index, deleteCount, parts }]` which the caller (in `editor-quill.js`) applies to Quill's delta system.

### `SMDocFormat` object (`smdoc-format.js`)

Static utility object. Methods:
- `create(options)` → document JSON object
- `parse(jsonString)` → normalized document object
- `toHTML(doc, resources)` → full standalone HTML
- `fromHTML(html)` → extract document data from HTML
- `isSMDoc(path)` → boolean check
- Internal: `_compressContent`, `_decompressContent`, `_generateParagraphStylesCSS`, `_getDefaultStyles`

### `EditorBlots` object (`custom-blots.js`)

Utility functions for managing custom Quill formats:
- `toggleHolding(quill, type)` — toggle short/long holding on selection
- `clearHoldings(quill)` — remove all holdings from selection
- `toggleChangeStyle(quill)` — toggle change/variant style
- `setNormalStyle(quill)` — remove change style
- `getCurrentFormat(quill)` → current format state at cursor
- `cleanup(quill)` — remove empty format spans

---

## Quill Integration (`editor-quill.js`)

Quill is initialized with a custom toolbar and these configurations:

### Custom formats registered

All formats from `custom-blots.js` plus additional inline formats:
- `short-holding`
- `long-holding`
- `change`
- `svara-accent`

### Custom modules

The editor extends Quill's behavior through event handlers:
- `text-change` — trigger auto-save, update word count
- `selection-change` — update toolbar state indicators

### Applying grammar rules

When the user triggers automation (Run Agent button):
1. Get the current selection or full document text
2. Extract plain text from Quill's delta
3. Run `SanskritProcessor` rules to get replacement arrays
4. Apply each replacement via Quill's `insertText`, `deleteText`, `formatText` API
5. Preserve all existing Quill formatting where not explicitly changed

---

## Document Lifecycle

### Opening a document

```
User clicks Open
    → file-operations.js: show file dialog
    → Flask /api/file/read: read .smdoc from disk
    → Python: detect SMDI/SMDC prefix, decompress accordingly
    → Python: detect SMDI (lzma) or SMDC (zlib) prefix, decompress accordingly
    → JS: SMDocFormat.parse(jsonString)
    → JS: inject doc.content into Quill editor
    → JS: apply doc.styles.theme
    → JS: restore doc.audio.attachments
    → document-manager.js: update recent files list
    → preferences.json: save updated recents
```

### Saving a document

```
User presses Ctrl+S
    → editor-quill.js: get quill.root.innerHTML (ql-editor content)
    → SMDocFormat.create({ content, title, theme, audioAttachments })
    → JSON.stringify(docObject)
    → Flask /api/file/save: write to disk
    → Python: lzma.compress(json_bytes, preset=9|PRESET_EXTREME), prepend SMDI, write file
    → cache/_last_session.json: update session state
```

### Exporting to HTML / Viewing

```
User clicks Export / View
    → Gather font data URIs (gentium_font_data_uri.txt, palladio_font_data_uri.txt)
    → SMDocFormat.toHTML(doc, { fontDataURI, defaultCSS })
    → Full standalone HTML with all CSS and fonts embedded
    → Uses the same ochre/saffron design system as the editor

For View:
    → pyqt-bridge.js sends viewerWindowRequested signal via QWebChannel
    → Python ViewerWindow class writes temp HTML to cache/viewer_temp/
    → Opens in a separate QWebEngineView window

For Export:
    → File is saved to user-specified location
```

---

## Session Management

`cache/_last_session.json`:
```json
{
  "state": {
    "lastFilePath": "/path/to/last/file.smdoc",
    "lastFileName": "Document Name",
    "savedAt": 1234567890
  }
}
```

On startup, the editor reads this file and offers to restore the last session. The cache directory also holds:
- `_untitled.html` — auto-save backup of untitled document
- `viewer_temp/` — temporary HTML files for preview window

---

## Theme System (`theme-manager.js`)

Three modes: `light`, `dark`, `system`

- Stored in `preferences.json` as `theme_mode`
- Applied by setting `data-theme` attribute on `<body>`
- All colors defined as CSS custom properties with `[data-theme='dark']` overrides
- System mode reads `window.matchMedia('(prefers-color-scheme: dark)')` and listens for changes

CSS variables drive all theme-sensitive colors — no JavaScript color manipulation.

**Switch components**: Toggle switches use a `.switch-knob` `<span>` with an `.on` class for the active state, instead of the more common `::before` + `:checked` pseudo-element pattern. This is a deliberate workaround for a QWebEngineView rendering bug on Windows where pseudo-element transitions on checkbox inputs cause visual glitches.

---

## Font Strategy

The editor embeds fonts as data URIs to eliminate network dependencies:

| Font | File | Usage |
|------|------|-------|
| URW Palladio ITU | `palladio_font_data_uri.txt` | Primary IAST serif font (editor content, export) |
| Gentium Plus | `gentium_font_data_uri.txt` | Alternative IAST serif font |
| IBM Plex Sans | CDN / system | UI chrome font |
| Noto Serif Devanagari | System | Devanagari script rendering |

Additionally, `icon-data.js` contains the application icon as a data URI.

Font data URIs are loaded into JavaScript variables at startup and injected into CSS `@font-face` declarations dynamically. This ensures the editor and exported HTML files render consistently without internet access.

---

## Storage Layout

```
editor/
├── Library/              ← Sample/curated documents (read-only by convention)
│   ├── puruṣa sūktam.smdoc
│   ├── mahisasura mardhini.smdoc
│   └── ...
├── documents/            ← User documents (default save location)
├── media/                ← User media (audio, images referenced in documents)
├── cache/                ← Temporary files (safe to clear)
│   ├── _last_session.json
│   ├── _untitled.html
│   └── viewer_temp/
└── preferences.json      ← User settings (theme, recent files, auto-save)
```
