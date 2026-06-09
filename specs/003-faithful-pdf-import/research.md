# Research: Faithful PDF Import — measured facts & decisions

All facts below were **measured directly** from `C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf`
(2 pages) with PyMuPDF, this session. They are the empirical basis for the plan.

## 1. Document colors (body region, 45 < y < 800)

| Color (hex) | Count (p1) | Meaning | Editor markup |
|-------------|-----------:|---------|---------------|
| `7f807f` | 929 | gray italic — translation / comment | `ql-doc-translation` / `ql-comment-style` (paragraph) |
| `000000` | 604 | black — main shloka text | plain |
| `943634` | 102 | dark red — Vedic accent glyphs (combining) | `ql-svara-true` span |
| `0070c0` | 25 | blue — change-style transformation glyphs **and** short-pause pipe | `ql-change-style` / `ql-short-pause` |
| `7e7f7e` | 16 | gray — subtitle | `ql-doc-subtitle` (paragraph) |
| `c00000` | 2 | bright red — long-pause pipe | `ql-long-pause` |

→ The existing constants `ACCENT_RED=0x943634`, `CHANGE_BLUE=0x0070c0`,
`GRAY_SUBTITLE=0x7e7f7e`, `GRAY_ITALIC=0x7f807f` are **correct** and retained.
New constants needed: `PAUSE_LONG_RED=0xc00000`, `PAUSE_SHORT_BLUE=0x0070c0` (== CHANGE_BLUE).

**Decision**: A `|` glyph is a pause; its color picks the type. Because blue is shared with
change-style, classify the pipe **by character first** (`c == '|'`), then color. Black
`।`/`॥` (also size 16) are ordinary verse punctuation — never pauses.

## 2. Holding boxes (vector layer)

- `page.get_drawings()` on p1 yields **415 green filled rects**, fill `(0.324, 0.508, 0.207)`.
- They union-find–cluster (bbox overlap, 1pt slop) into **83 logical boxes**, ~5 edge rects
  each (a border drawn as top/right/bottom/left/corner thin rectangles).
- Per-box minimum edge thickness clusters at exactly three values: **{0.12, 0.24, 0.96}**.

**Decision**: `kind = 'long' if min_edge_thickness >= 0.5 else 'short'`. The 0.5 threshold sits
in the wide empty gap between the thin cluster (0.12, 0.24 → short) and the thick value
(0.96 → long). A test asserts the observed clusters straddle 0.5.

**Decision**: Cluster edge rects with union-find over bbox overlap (±1pt). Box bounds =
union of member rects; thickness = min over member rects of `min(width, height)`.

## 3. Box → character mapping (the core overlay)

Overlaying each box onto per-character bboxes (`get_text("rawdict")`, base chars only, same
baseline, center-x containment ±1pt) produced clean, vowel-free consonant runs:

```
short bh   long n    long d    long v   long t   short k  short m  short t
short th   long v    long g    short nn short nn long d   short g  long p
... short ddh ... short kh ... long dd ... short cch ... long s ...
```

Single consonants (d, t, k, p, g, …), aspirates (bh, kh, th), and geminate/conjunct clusters
(nn, tt, dd, ddh, cch) all map exactly; **no vowel was ever captured** because source boxes are
drawn tightly around the consonant(s).

**Decision**: Match by base-char center-x within the box x-range, restricted to chars on the
box's baseline (|char_yc − box_yc| < 10pt). Wrap the whole contiguous matched run in one
holding span. Following vowels and combining marks outside the box bounds stay outside the span
(combining marks attached to a held base char ride inside, in their own `ql-svara-true` span).

**Decision (1-to-1 over grammar rule)**: Wrap exactly what the box covers, even when that is a
multi-char geminate ("tt") or conjunct ("ddh"). Faithfulness to the source overrides the
"first consonant only" grammar heuristic, which belongs to the separate Run-Agent transform.

## 4. Accent encoding parity (target markup)

Saved Vedic docs encode accents as a bare combining mark wrapped in a styled span:

- `Library/puruṣa sūktam.smdoc`: `…cha<span class="ql-svara-true">̱</span>…` (anudātta),
  `…vṛ<span class="ql-svara-true">̍</span>…` (svarita), `…daivī<span class="ql-svara-true">̎</span>…` (udātta).

Feature 002's importer already emits exactly this. **No change** to accent handling beyond
moving from span- to char-granularity (which preserves it).

## 5. Holding + accent/change/superscript co-occurrence

Saved docs show holdings wrapping a base char that may itself carry inner markup, e.g.
`<span class="ql-holding-long">g</span>`, and elsewhere change-style/superscript compose:
`<sup><span class="ql-change-style">u</span></sup>`. A held char with an accent must therefore
nest as `…<span class="ql-holding-short">t<span class="ql-svara-true">̍</span></span>…`.

**Decision**: Holding is the **outer** wrapper; accent/change/superscript markup is emitted
**inside** it for the chars in the run. Implement emission per-char within an open holding span.

## 6. Header / footer (unchanged from 002, re-confirmed)

- Top running header at y≈33.8 ("bhū sūktam   kṛṣṇa yajurvedīya   <page#>") — dropped by the
  top y-band.
- Bottom footer at y≈828 ("About VedaUnion … http://vedaunion.org/ …", blue URLs `0563c1`) —
  dropped by the bottom y-band. Note `0563c1` ≠ `0070c0`, so footer blue is not confused with
  change-style.

## 7. Alternatives considered

- **Re-derive holdings via the grammar engine instead of importing** — rejected: the user
  defined "import" as faithful reproduction; engine re-derivation is a separate opt-in step and
  would not match the source where the author hand-adjusted holdings.
- **Span-level overlay of boxes** — rejected: a span can contain several chars, so a box can't
  be pinned to the right character without per-char bboxes. Char-aware reconstruction is
  required (the central change of this feature).
- **Threshold on box height/area instead of edge thickness** — rejected: height is the line
  height (constant); only edge (stroke) thickness separates short from long.
