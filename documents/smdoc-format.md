# .smdoc File Format Specification

The `.smdoc` format (śikṣāmitra document) is the native file format for the śikṣāmitra editor. It is designed to store only essential content and configuration, reconstructing the full document shell at runtime.

---

## Overview

| Property | Value |
|----------|-------|
| MIME type | `application/x-sikshamitra-document` |
| Extension | `.smdoc` |
| Base format | JSON |
| Compression | LZMA (Python layer, current) / zlib (legacy) + whitespace normalization (JS layer) |
| Version | 1 |

---

## File Structure

An `.smdoc` file is one of:
1. **SMDI-prefixed LZMA binary** — current format (best compression)
2. **SMDC-prefixed zlib binary** — legacy format (still readable)
3. **Plain JSON** — very old or manually created documents

### Detection (Python)

```python
import lzma
import zlib

with open(path, 'rb') as f:
    data = f.read()

if data[:4] == b'SMDI':
    # Current format: LZMA compressed
    json_bytes = lzma.decompress(data[4:])
elif data[:4] == b'SMDC':
    # Legacy format: zlib compressed
    json_bytes = zlib.decompress(data[4:])
else:
    # Very old: plain JSON
    json_bytes = data

doc = json.loads(json_bytes)
```

Magic bytes: `SMDI` = LZMA (current), `SMDC` = zlib (legacy). Both are transparently readable.

---

## JSON Schema

```json
{
  "version": 1,
  "content": "<HTML string>",
  "meta": {
    "title": "string",
    "created": 1234567890,
    "modified": 1234567890,
    "author": "string (optional)"
  },
  "styles": {
    "theme": "light | dark",
    "paragraphStyles": {
      "doc-title": {
        "color": "#hex",
        "fontSize": "1.75em",
        "fontWeight": "600",
        "fontStyle": "normal | italic",
        "textAlign": "left | center | right | justify"
      },
      "doc-subtitle": { ... },
      "doc-section": { ... },
      "doc-subsection": { ... },
      "doc-translation": { ... }
    },
    "customCSS": "string (raw CSS)"
  },
  "audio": {
    "attachments": [
      {
        "id": "unique-string-id",
        "label": "Display label",
        "src": "data:audio/mpeg;base64,...",
        "startTime": 0,
        "endTime": null
      }
    ]
  }
}
```

### Field semantics

**`version`** (integer, required)
- Always `1` in current version
- Parser warns (but continues) if version > 1

**`content`** (string, required)
- The `innerHTML` of the Quill editor's `.ql-editor` div
- Contains only content HTML: `<p>`, `<span>`, `<strong>`, `<em>`, `<u>`, `<s>`, `<sub>`, `<sup>`, `<change>`, and holding spans
- Does NOT contain the document shell, CSS, fonts, or scripts
- The full HTML is reconstructed by `SMDocFormat.toHTML()` at export time

**`meta.created`**, **`meta.modified`** (integer)
- Unix timestamps in seconds (`Math.floor(Date.now() / 1000)`)
- `created` is set once at document creation; `modified` updates on every save

**`styles`** (object, optional)
- Omitted entirely if all values are defaults
- `theme` omitted if `"light"` (light is default)
- `paragraphStyles` omitted if no custom overrides
- `customCSS` omitted if empty

**`audio`** (object, optional)
- Omitted entirely if no audio attachments
- Audio stored as full base64 data URIs (can be large — primary driver of LZMA compression)

---

## Content HTML Conventions

The `content` field stores HTML with these conventions:

### Paragraph types

| HTML | Quill class | Meaning |
|------|------------|---------|
| `<p>` | (default) | Normal paragraph |
| `<p class="ql-doc-title">` | ql-doc-title | Document title |
| `<p class="ql-doc-subtitle">` | ql-doc-subtitle | Subtitle |
| `<p class="ql-doc-section">` | ql-doc-section | Section heading |
| `<p class="ql-doc-subsection">` | ql-doc-subsection | Subsection |
| `<p class="ql-doc-translation">` | ql-doc-translation | Translation |

### Inline formats

| HTML | Meaning |
|------|---------|
| `<strong>` | Bold |
| `<em>` | Italic |
| `<u>` | Underline |
| `<s>` | Strikethrough |
| `<sub>` | Subscript |
| `<sup>` | Superscript |
| `<span class="short-holding">` | Short holding (samyukta) |
| `<span class="long-holding">` | Long holding (samyukta) |
| `<change>` | Change/variant style |
| `<span class="ql-short-pause">` | Short pause mark `|` |
| `<span class="ql-long-pause">` | Long pause mark `||` |
| `<span class="ql-svara-char">` | Svarabhakti dot, svara chars |
| `<span class="ql-dirgha-char">` | Dīrgha (long vowel overline) |

### Inline styles (Quill standard)

Quill stores some formatting as inline `style` attributes:
- `style="color: #hex"` — text color
- `style="background-color: #hex"` — highlight color
- `style="font-family: 'Font Name'"` — font
- `style="font-size: Npx"` — size

---

## Compression

### JavaScript layer (content only)

`SMDocFormat._compressContent()` performs lightweight whitespace normalization:
- Multiple spaces between tags → single space
- Multiple consecutive newlines → single newline
- Leading/trailing whitespace trimmed

This is not true compression — it reduces JSON verbosity.

### Python layer (full file)

`lzma.compress(json_bytes, preset=9 | lzma.PRESET_EXTREME)` compresses the complete JSON:
- Preset 9 with `PRESET_EXTREME` = maximum compression (best ratio, slower)
- Magic bytes `SMDI` (4 bytes) prepended to identify LZMA-compressed files
- Legacy files with `SMDC` magic use zlib and are still transparently decompressed on read
- Typical ratio: 5–20x for text-heavy documents, more for base64 audio

---

## Creating a New Document

```javascript
const doc = SMDocFormat.create({
    content: quill.root.innerHTML,
    title: 'My Document',
    theme: 'dark',
    paragraphStyles: null,    // null = use defaults
    audioAttachments: [],     // empty = no audio field
    customCSS: null           // null = no custom CSS
});

const jsonString = JSON.stringify(doc);
// → send to Flask /api/file/save
```

---

## Parsing a Document

```javascript
try {
    const doc = SMDocFormat.parse(jsonString);
    // doc.content → inject into Quill
    // doc.meta.title → set window title
    // doc.styles.theme → apply theme
    // doc.audio.attachments → restore audio players
} catch (e) {
    console.error('Invalid .smdoc file:', e);
}
```

The parser handles:
- Double-encoded JSON (backward compatibility with early buggy saves)
- Missing optional fields (all default gracefully)
- Version mismatch (warning only, continues parsing)

---

## Converting to Full HTML

```javascript
const html = SMDocFormat.toHTML(doc, {
    fontDataURI: palladioFontDataURI,   // from palladio_font_data_uri.txt
    faviconDataURI: iconDataURI,         // from icon_data_uri.txt
    defaultCSS: ''                        // additional CSS to inject
});
```

The output is a fully self-contained HTML file with:
- Embedded `@font-face` for URW Palladio ITU
- All CSS custom properties (ochre/saffron design system)
- Theme toggle button (light↔dark)
- Audio play buttons if attachments exist
- Print styles

---

## Example: Minimal Document

```json
{
  "version": 1,
  "content": "<p>oṁ namaḥ śivāya</p>"
}
```

Fields `meta`, `styles`, `audio` all omitted — the parser provides defaults.

---

## Example: Full Document

```json
{
  "version": 1,
  "content": "<p class=\"ql-doc-title\">Puruṣa Sūktam</p><p class=\"ql-doc-subtitle\">Ṛgveda X.90</p><p>sahasraśīrṣā <span class=\"short-holding\">p</span>uruṣaḥ</p>",
  "meta": {
    "title": "Puruṣa Sūktam",
    "created": 1700000000,
    "modified": 1700001234
  },
  "styles": {
    "theme": "dark"
  },
  "audio": {
    "attachments": [
      {
        "id": "audio-001",
        "label": "Recitation",
        "src": "data:audio/mpeg;base64,//uQxAAA...",
        "startTime": 0,
        "endTime": null
      }
    ]
  }
}
```
