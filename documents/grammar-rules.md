# Grammar Rules — śikṣāmitra Implementation Reference

This document provides the complete specification of all Sanskrit phonological rules implemented in the śikṣāmitra editor (`sanskrit_rules.js`). It describes both the traditional rule and its technical implementation.

---

## Audio Matching Note

The audio editor does not change the grammar rules above. It uses the same normalized IAST text, combining marks, and punctuation output when it stages region labels and automatic matching ranges.

For the full audio workflow, see `documents/audio-editing-and-matching.md`.
## The Phonological Pipeline

When the user triggers "Run Agent" (automation), the editor applies rules in this exact order to the selected text. Each step receives the text as modified by all previous steps, and the Quill selection is updated after each step to reflect the new text length.

1. **Transliterate** — Devanagari → IAST (with Vedic svara mark draining)
2. **Standardize** — Normalize Unicode, lowercase, danda conversion
3. **Insert g in jñ** — jñ → j[g]ñ
4. **Insert u in sv** — sv → s[u]v
5. **Insert u in vy** — vy → v[u]y
6. **Svarabhakti** — Insert · after r before sibilant/h/ṛ
7. **Pauses** — Insert | or || at word boundaries
8. **Holdings** — Mark consonant clusters with short/long borders
9. **Anusvara** — Transform ṁ based on following consonant and source
10. **Visarga** — Transform ḥ based on following consonant
11. **Ṛgveda svarita adjustments** — Accent mark adjustments (only for Ṛgveda source)
12. **Final m tick** — Add tick mark (ˎ) at segment-ending m

Each rule stage returns a list of replacement operations (index, deleteCount, parts) which are then applied to the Quill editor's delta operations.

---

## 1. Pre-Processing (`preProcessRawText`)

Standardizes input before all other rules run.

### Unicode normalization

| Input character(s) | Normalized to | Meaning |
|-------------------|--------------|---------|
| U+0951 (Devanagari stress sign udatta) | U+030D | Svarita mark |
| U+0952 (Devanagari stress sign anudatta) | U+0331 | Anudatta mark |
| U+0332 (combining low line) | U+0331 | Anudatta mark |
| U+0320 (combining minus sign below) | U+0331 | Anudatta mark |
| U+0321 (combining latin small letter i below) | U+0331 | Anudatta mark |
| U+1CDA (combining latin small letter u below) | U+030E | Udatta mark |
| U+0341 (combining acute tone mark) | U+030E | Udatta mark |
| ṃ (U+1E43, dot below) | ṁ (U+1E41, dot above) | Anusvara normalization |
| U+A8F3 (ꣳ Vedic tiryak) | ṁ | Vedic anusvara variant |
| ō (macron o) | o | Devanagari-style long o → standard |
| ē (macron e) | e | Devanagari-style long e → standard |

### Text normalization

| Input | Output | Rule |
|-------|--------|------|
| `(g)m` or `(g)ṁ` or `(g̱)ṁ` | ṁ | Strip previous-run annotations |
| `.` | `।` (danda) | Sentence boundary |
| `. .` or `..` | `॥` (double danda) | Verse boundary |

All text is lowercased first.

---

## 2. Anusvāra Transformations (`applyAnusvaraTransformations`)

### Bīja mantra exclusion

When `skipBija` is enabled (default), common bīja mantras at the start of a line are preserved unchanged — their anusvara is not transformed. The set `BIJA_MANTRAS` includes: oṁ, auṁ, hrīṁ, śrīṁ, klīṁ, aiṁ, sauṁ, krīṁ, hlīṁ, strīṁ, blūṁ, glauṁ, hauṁ, huṁ, phaṭ, dūṁ, gaṁ, drāṁ, grīṁ, kṣrauṁ.

### Traditional rule

The anusvāra (ṁ/ṃ) represents a nasal resonance that assimilates to the place of articulation of the following consonant. This is the rule of *anusvāra* (*anunāsika*) in Sanskrit phonology.

### Character sets

```
CONSONANT_GROUPS = {
    ṅ  →  {k, kh, g, gh}      (velar class)
    ñ  →  {c, ch, j, jh}      (palatal class)
    ṇ  →  {ṭ, ṭh, ḍ, ḍh}     (retroflex class)
    n  →  {t, th, d, dh}      (dental class)
    m  →  {p, ph, b, bh}      (labial class)
}

SPECIAL_NON_VOWELS = {ś, ṣ, s, h}    (sibilants + glottal)
ADDITIONAL_SPECIAL_NON_VOWELS = {r}   (semivowel r)
```

### Rule table by source

#### Yajurveda / Kṛṣṇa Yajurveda

| Following letter(s) | Result | Display |
|--------------------|--------|---------|
| k/kh/g/gh | ṅ | Plain nasal (no superscript) |
| c/ch/j/jh | ñ | Plain nasal |
| ṭ/ṭh/ḍ/ḍh | ṇ | Plain nasal |
| t/th/d/dh | n | Plain nasal |
| p/ph/b/bh | m | Plain nasal |
| v | ṁ + [u]superscript | Semi-vowel context |
| l | ṁ + [l]superscript | Lateral context |
| y | ṁ + [i]superscript | Palatal glide context |
| ś/ṣ/s/h/r (alone, no immediate consonant after) | m̐ + [g]superscript + [ṁ]superscript | Full lupta-āgama |
| ś/ṣ/s/h/r + consonant, prev vowel = a/i/u | m̐ + [g]superscript + [g]superscript | Double-g lupta-āgama |
| ś/ṣ/s/h/r + consonant, prev vowel ≠ a/i/u | m̐ + [g]superscript | Single-g lupta-āgama |
| Special sequences (jñ, ghn) | Highlight only (no transformation) | — |

**m̐** = m + U+0310 (combining candrabindu)
Superscript items appear in `<change>` style (italic blue, raised).

#### Ṛgveda

| Following letter(s) | Result |
|--------------------|--------|
| ś/ṣ/s/h/r | Preserve original (ṁ or m̐), apply change-style only |
| v | original + [u]superscript |
| l | original + [l]superscript |
| y | original + [i]superscript |
| nasal class (k/c/ṭ/t/p series) | Same nasal assimilation as other sources |
| all others | Highlight ṁ with change-style |

**Key distinction**: In Ṛgveda, the candrabindu (m̐) is NEVER converted to anusvara (ṁ), and anusvara is NEVER converted to candrabindu. Each is preserved and style-highlighted.

#### Smṛti / Default (no source set)

| Following letter(s) | Result |
|--------------------|--------|
| any nasal class | Appropriate nasal |
| all others | Highlight ṁ with change-style (no phonological conversion) |

---

## 3. Candrabindu Annotations

The candrabindu (m + U+0310 = m̐) is a special Vedic marking for nasalized resonance. It plays a unique role in the editor:

- It is treated as an **annotation-only character** for positional calculations (does not count as a "letter" for finding next/previous context)
- Patterns `m̐g`, `m̐gg`, `m̐gṁ` are recognized as previous-run annotations and stripped during normalization
- In Ṛgveda mode: preserved always
- In all other modes: normalized to ṁ during `normalizeAnusvaraAnnotations`

### Detection function (`isCandrabinduSuperscriptChar`)

A character at position `i` is a candrabindu superscript annotation if:
- `text[i] === 'g'` and `text[i-1] === U+0310` and `text[i-2] === 'm'`
- `text[i] === 'ṁ'` and `text[i-1] === 'g'` and `text[i-2] === U+0310` and `text[i-3] === 'm'`
- `text[i] === 'm'` and `text[i+1] === U+0310`

---

## 4. Visarga Transformations (`applyVisargaTransformations`)

### Traditional rule

The visarga (ḥ) is a voiceless glottal fricative that undergoes sandhi (euphonic combination) with the following sound. The specific transformation depends on the next consonant and the preceding vowel.

### Rule table

| Next letter | Prev vowel | Result | Notes |
|-------------|-----------|--------|-------|
| p | — | ḥ + f[superscript] | Rare; before labial p |
| ś/ṣ/s (sibilant) | — | same sibilant | Direct assimilation |
| c/ch | — | ś | Palatal sibilant |
| ṭ/ṭh | — | ṣ | Retroflex sibilant |
| t/th | — | s | Dental sibilant |
| voiced consonant or vowel | NOT a/ā | r | Becomes approximant r |
| voiced consonant or vowel | a/ā | no change | Advaya exception |
| kṣ | — | ḥ: + prev_vowel[superscript] | Special sequence |

The `VISARGA_GROUPS` mapping:
```
ś  →  {c, ch}
ṣ  →  {ṭ, ṭh}
s  →  {t, th}
```

`VOICED_CONSONANTS` = g gh j jh ḍ ḍh d dh b bh m
`ADVAYA` = {a, ā} (vowels that block visarga → r transformation)

---

## 5. Holdings (Samyukta Marking)

### Traditional rule

In Vedic recitation, consonant clusters (samyukta-akṣara, double/multiple consonants) require special pronunciation. A marking is placed on a specific consonant in the cluster to indicate:
- That a cluster exists and must be pronounced distinctly
- Whether the cluster follows a short or long vowel (affecting timing)

### Algorithm

#### Step 1: `collectSamyukta(text, pos)`

Starting at position `pos` (must be a consonant), walk forward collecting all consecutive consonants:
- Skip svara marks (U+0331, U+030D, etc.) and combining marks
- Skip annotation characters (candrabindu and its superscripts)
- Track word boundaries (spaces) — note `wordBoundaryBefore` and `wordIndex` for each component
- **Stop** if a pause mark `|` is encountered (clusters cannot cross pauses)
- **Stop** if no consonant follows

Returns: `{ components: [{value, index, length, wordBoundaryBefore, wordIndex}], nextIndex }`

#### Step 2: `selectHoldingComponent(components)`

Chooses which component receives the holding mark:

1. **Dvivarcana rule** (identical consecutive): If `components[i].value === components[i+1].value`, the holding goes on `components[i]` (first of the pair)
2. **Cross-word rule**: Find the first component where `wordBoundaryBefore === true` (first consonant of the second word)
3. **Default**: Start from index 0
4. **Skip rule**: Skip any candidate whose consonant is in `SKIP_CONSONANTS` = {ṅ ñ ṇ n m ṁ ṃ r ś ṣ s}, UNLESS it is a sibilant appearing at a word boundary (`wordBoundaryBefore === true`)

#### Step 3: Determine holding type

Look backwards from the target consonant to find the nearest preceding vowel:
- Skip ṁ, ṃ, ḥ (treated as intermediate marks, not vowels for this purpose)
- If vowel is in `LONG_VOWELS` → **long holding** (CSS: `long-holding`, thicker border)
- Otherwise → **short holding** (CSS: `short-holding`, thinner border)

#### Visual rendering

```css
.short-holding {
    border: 1px solid #10b981;   /* thin green */
    border-radius: 3px;
}
.long-holding {
    border: 2px solid #10b981;   /* thicker green */
    border-radius: 3px;
}
```

In dark mode: `#34d399` (lighter green).

---

## 6. Svarabhakti (`applySvarabhaktiTransformations`)

### Traditional rule

Svarabhakti is the insertion of an epenthetic sound to ease pronunciation of difficult consonant sequences. In this implementation, a middle dot `·` is inserted after `r` when it is followed by specific consonants.

### Trigger set

`SVARABHAKTI_TRIGGERS` = {s, ś, ṣ, h, ṛ}

### Rule

When `text[i] === 'r'`:
1. Find the next actual letter (skip combining marks, svara marks, ZWJ)
2. If that letter is in `SVARABHAKTI_TRIGGERS`:
   - Check that `·` is not already present between `r` and the trigger
   - Insert `·` immediately after `r` (and any of its combining marks)
   - The `·` is styled with `svara-char` format (red, Palladio font)

---

## 7. Pause Detection (`findAllPauses`)

### Traditional rule

Pauses (*santāna*) mark the natural breathing points in Vedic recitation. They occur at certain vowel junctions across word boundaries.

### Rule table

| Pattern | Type | Inserted at |
|---------|------|------------|
| `oṁ` + space + next word | Short pause | After the space (before next word) |
| Long vowel + space + short vowel | Long pause | Before the short vowel |
| Any vowel + space + any vowel | Short pause | Before the second vowel |

**Long vowels**: ā ī ū ṝ ḹ e ai o au
**Short vowels**: a i u ṛ ḷ

Pause marks are visual-only inline elements (`ql-short-pause` or `ql-long-pause`), colored blue and red respectively.

---

## 8. Special Insertions (`applyAutomaticInsertions`)

These insertions use a Quill-position-walking algorithm instead of regex on extracted text. The algorithm walks through Quill positions character by character using `quill.getText(i, 1)`, skipping combining marks (U+0300-U+036F, U+0310) between the first and second characters of each digraph. This avoids offset mismatches caused by combining marks in the extracted text.

Inserted characters are formatted as superscript in change-style (italic blue). The operation is idempotent — if the superscript character is already present at the target position, it is skipped.

### jñ → jgñ

In traditional Sanskrit pronunciation, the sequence `jñ` is pronounced with an intermediate `g`:
- Walk positions to find `j` followed by `ñ` (skipping combining marks)
- Insert `g` in superscript change-style before `ñ`
- Result: `jgñ`

### sv → suv

Vedic pronunciation of `sv`:
- Walk positions to find `s` followed by `v` (skipping combining marks)
- Insert `u` in superscript change-style before `v`
- Result: `suv`

### vy → vuy

Vedic pronunciation of `vy`:
- Walk positions to find `v` followed by `y` (skipping combining marks)
- Insert `u` in superscript change-style before `y`
- Result: `vuy`

---

## Navigation Utilities

### `findNextLetterInfo(text, pos)`

Finds the next meaningful letter after position `pos`:
- Skips: ZWJ (U+200B–U+200D), ZWNJ (U+FEFF), combining marks (U+0300–U+036F), svara marks, annotation characters, newlines, spaces
- Returns: `{ letter: string, index: number }` or `{ letter: '', index: -1 }`

### `findPreviousLetter(text, pos)`

Finds the nearest meaningful letter before position `pos`:
- Skips: combining marks, svara marks, newlines, annotation characters, spaces
- Returns the letter character string, or `''`

### `findPreviousVowel(text, pos, blockAtSpace=true)`

Finds the nearest preceding vowel:
- Skips: pause marks `|`, svara marks
- By default, stops at a space (word boundary) unless `blockAtSpace=false`
- Treats ṁ, ṃ, ḥ as intermediate marks (skips them to find the actual vowel)
- Returns: `{ vowel: string, blocked: boolean, position: number }`

---

## Character Class Definitions

```javascript
// Characters that cannot host a holding
SKIP_CONSONANTS = {ṅ, ñ, ṇ, n, m, ṁ, ṃ, r, ś, ṣ, s}

// All IAST consonants
ALL_CONSONANTS = {k, kh, g, gh, ṅ, c, ch, j, jh, ñ, ṭ, ṭh, ḍ, ḍh, ṇ, t, th, d, dh, n,
                  p, ph, b, bh, m, y, r, l, ḻ, v, ś, ṣ, s, h, ḥ, ṁ, ṃ}

// Short vowels (1 mātrā)
SHORT_VOWELS = {a, i, u, ṛ, ḷ}

// Long vowels (2 mātrā)
LONG_VOWELS = {ā, ī, ū, ṝ, ḹ, e, ai, o, au}

// Two-character consonants (must check before single char)
TWO_CHAR_CONSONANTS = [kh, gh, ch, jh, ṭh, ḍh, th, dh, ph, bh]

// Two-character vowels
TWO_CHAR_VOWELS = [ai, au, ṝ, ḹ]

// Unicode svara marks
SVARA_MARKS = {U+0331, U+030D, U+030E, U+02CE, ·}
```

---

## Unicode Reference

| Character | Unicode | Name | Usage |
|-----------|---------|------|-------|
| ṁ | U+1E41 | Latin small m with dot above | Standard anusvara |
| ṃ | U+1E43 | Latin small m with dot below | Alternate anusvara (normalized to ṁ) |
| ḥ | U+1E25 | Latin small h with dot below | Visarga |
| U+0310 | Combining candrabindu | Vedic nasalization mark (m̐) |
| U+0331 | Combining macron below | Anudātta accent |
| U+030D | Combining vertical line above | Svarita accent |
| U+030E | Combining double vertical line above | Udātta accent |
| U+02CE | Modifier letter low grave | Tick / secondary stress |
| ḻ | U+1E3B | Latin small l with line below | Retroflex lateral (ḷ) |
| · | U+00B7 | Middle dot | Svarabhakti epenthesis mark |
| । | U+0964 | Devanagari danda | Sentence-end pause |
| ॥ | U+0965 | Devanagari double danda | Verse-end pause |
| ऽ | U+093D | Devanagari avagraha | Missing letter marker |
| U+A8F3 | ꣳ Vedic tiryak | Vedic anusvara variant (normalized to ṁ) |

---

## Transliteration (`devanagariToIAST`)

The Devanagari-to-IAST transliterator converts selected Devanagari text to IAST while preserving Quill formatting attributes.

### Vedic svara mark handling

After each transliterated syllable (consonant+vowel or independent vowel), a `drainVedicMarks()` helper consumes any immediately following Vedic combining marks and emits the corresponding IAST combining marks attached to the last character of that syllable:

| Devanagari mark | Unicode | IAST combining mark | Unicode |
|----------------|---------|---------------------|---------|
| ॒ (anudātta) | U+0952 | ̱ (macron below) | U+0331 |
| ॑ (svarita) | U+0951 | ̍ (vertical line above) | U+030D |
| ᳚ (double svarita) | U+1CDA | ̎ (double vertical line above) | U+030E |

Example: `पु॒` = प(p) + उ(u) + ॒ → `pu̱` (the ̱ attaches to u)

### Special character mappings

| Devanagari | IAST |
|-----------|------|
| ं (anusvara, U+0902) | ṁ |
| ꣳ (Vedic tiryak, U+A8F3) | ṁ |
| ः (visarga) | ḥ |
| ँ (candrabindu) | m̐ |
| ऽ (avagraha) | ' |
| । (danda) | \| |
| ॥ (double danda) | \|\| |
| ॐ (om) | oṁ |
| ०-९ (digits) | 0-9 |

### Conjuncts

Virama (्) + consonant chains are followed without inserting inherent `a` between consonants. Bracket annotations `[text]` are passed through unchanged.

---

## Ṛgveda Svarita Adjustments (`applyRigvedaSvaritaRules`)

Only runs when text source is `rigveda`. Has two passes:

### Pass A — Accent swapping (text change)

Walks through the text looking for svarita marks (U+030D). For each svarita found:

**Rule 1 — Long vowel svarita → dīrgha svarita:**
If the svarita is on a long vowel (ā, ī, ū, ṝ, ḹ, e, ai, o, au), replace the svarita (U+030D) with dīrgha svarita / udātta (U+030E).

Example: `hotā̍raṁ` → `hotā̎raṁ` (the ̍ on long ā becomes ̎)

**Rule 2 — Anusvara svarita with preceding short vowel:**
If the svarita is on an ṁ and the vowel before the ṁ is short (a, i, u, ṛ, ḷ), replace svarita with dīrgha svarita.

Example: `taṁ̍` with preceding short vowel → `taṁ̎`

### Pass B — Dīrgha-char formatting (format change only)

Walks through the text looking for remaining svarita marks (U+030D) that are on **short vowels** (a, i, u, ṛ, ḷ):

**Rule 3 — Short vowel svarita → add dīrgha formatting:**
If the svarita is on a short vowel, apply `dirgha-char` CSS formatting (blue horizontal overline) to that vowel.

**Exception:** If immediately after the short vowel there is a consonant cluster (samyukta) that already has a holding applied, do NOT add the dīrgha formatting. The holding takes precedence.

---

## Final M Ending Tick (`applyFinalMEndingTick`)

Scans through the text looking for segment boundaries (newlines, dandas). If a segment ends with `m` (possibly followed by combining marks), insert a tick mark ˎ (U+02CE) after the m and its combining marks.

The tick is inserted only at actual segment endings, not mid-word.

---

## Visual Styling Summary

| Element | CSS class | Visual |
|---------|-----------|--------|
| Short holding | `short-holding` | Thin green border (1px solid) |
| Long holding | `long-holding` | Thick green border (2px solid) |
| Change style | `change` (tag: `<change>`) | Italic, blue |
| Superscript | `script: super` | Raised text |
| Short pause | `ql-short-pause` | Blue `|`, bold |
| Long pause | `ql-long-pause` | Red `||`, bold |
| Svarabhakti dot | `ql-svara-char` | Red, bold, Palladio font |
| Svara accent mark | `ql-svara-char` | Red, weight 800 |
| Dīrgha overline | `ql-dirgha-char` | Blue horizontal line above (via ::before pseudo-element) |
| Candrabindu | m + U+0310 | Change-style (m̐) |

---

## Source Variants

| Source value | Tradition | Key differences |
|-------------|-----------|----------------|
| `yajurveda` | Yajurveda (Śukla) | Full m̐[gṁ]/m̐[g]/m̐[gg] anusvara patterns; ṁ[u]/ṁ[l]/ṁ[i] before semivowels |
| `kṛṣṇayajurveda` | Kṛṣṇa Yajurveda | Same as yajurveda |
| `rigveda` | Ṛgveda | Preserve candrabindu before ś/ṣ/s/h/r (no conversion); svarita adjustment rules apply |
| `smriti` / default | Classical | Highlight anusvara only (no Vedic patterns); no svarita adjustments |
