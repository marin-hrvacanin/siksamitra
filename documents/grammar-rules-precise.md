# Grammar Rules — Precise Specification

This document describes every grammar transformation rule implemented in the śikṣāmitra editor, with exact input→output for every case and source variant. It is derived directly from the code in `sanskrit_rules.js` and `editor-quill.js`.

---

## Pipeline Order

When "Run Agent" is invoked, transformations run in this exact sequence on the selected text:

1. **Transliterate** — Devanagari → IAST
2. **Standardize** — normalize Unicode, lowercase, danda conversion
3. **Insert g in jñ** — jñ → j[g]ñ
4. **Insert u in sv** — sv → s[u]v
5. **Insert u in vy** — vy → v[u]y
6. **Svarabhakti** — insert · after r before sibilant/h/ṛ
7. **Pauses** — insert | or || at word boundaries
8. **Holdings** — mark consonant clusters with short/long borders
9. **Anusvara** — transform ṁ based on following consonant and source
10. **Visarga** — transform ḥ based on following consonant
11. **Ṛgveda svarita adjustments** — accent mark adjustments (only for Ṛgveda source)
12. **Final m tick** — add tick mark (ˎ) at segment-ending m

Each step receives the text AS MODIFIED by all previous steps. The Quill selection is updated after each step to reflect the new text length.

---

## 1. Transliteration (Devanagari → IAST)

Straightforward character mapping. Vedic combining marks are preserved and positioned on the correct IAST syllable.

### Vowels

| Independent | Sign (after consonant) | IAST |
|------------|----------------------|------|
| अ | (inherent) | a |
| आ | ा | ā |
| इ | ि | i |
| ई | ी | ī |
| उ | ु | u |
| ऊ | ू | ū |
| ऋ | ृ | ṛ |
| ॠ | ॄ | ṝ |
| ऌ | ॢ | ḷ |
| ॡ | ॣ | ḹ |
| ए | े | e |
| ऐ | ै | ai |
| ओ | ो | o |
| औ | ौ | au |

### Consonants

Standard IAST mapping. Conjuncts: virama (्) + consonant chains are rendered without inherent 'a' between them.

### Vedic Accent Marks

| Devanagari | Unicode | IAST combining mark | Unicode |
|-----------|---------|---------------------|---------|
| ॒ (anudātta) | U+0952 | ̱ (macron below) | U+0331 |
| ॑ (svarita) | U+0951 | ̍ (vertical line above) | U+030D |
| ᳚ (double svarita) | U+1CDA | ̎ (double vertical line above) | U+030E |

**Positioning rule:** After transliterating a syllable (consonant+vowel or independent vowel), any immediately following Vedic combining marks are emitted as the corresponding IAST combining marks attached to the last character of that syllable.

Example: `पु॒` = प(p) + उ(u) + ॒ → `pu̱` (the ̱ attaches to u)

### Other special characters

| Devanagari | IAST |
|-----------|------|
| ं (anusvara) | ṁ |
| ः (visarga) | ḥ |
| ँ (candrabindu) | m̐ |
| ऽ (avagraha) | ' |
| । (danda) | \| |
| ॥ (double danda) | \|\| |
| ०-९ (digits) | 0-9 |

---

## 2. Standardize (`preProcessRawText`)

- Lowercase all text
- Normalize Unicode svara variants to canonical forms:
  - U+0951 → U+030D (svarita)
  - U+0952, U+0332, U+0320, U+0321 → U+0331 (anudātta)
  - U+1CDA, U+0341 → U+030E (udātta/double svarita)
- Normalize ṃ → ṁ, ō → o, ē → e
- Strip previous-run annotation patterns: `(g)m`, `(g)ṁ` → ṁ
- Convert `.` → `।` and `..` → `॥`

---

## 3. Special Character Insertions

Pronunciation guide characters inserted in **change-style** (italic blue) with superscript:

| Pattern | Result | Note |
|---------|--------|------|
| jñ | j**g**ñ | `g` inserted between j and ñ |
| sv | s**u**v | `u` inserted between s and v |
| vy | v**u**y | `u` inserted between v and y |

The inserted character is displayed superscripted in change-style. It does NOT participate in holding selection (holdings are applied based on the underlying consonant pattern, not the annotation).

---

## 4. Svarabhakti (Epenthesis)

Insert middle dot `·` (styled as `svara-char`: red, bold) after `r` when `r` is immediately followed by:

| Trigger | Example |
|---------|---------|
| r + s | r·s |
| r + ś | r·ś |
| r + ṣ | r·ṣ |
| r + h | r·h |
| r + ṛ | r·ṛ |

The `·` is inserted after `r` and any combining marks attached to it.

---

## 5. Pause Detection (`findAllPauses`)

| Pattern | Pause Type | Visual |
|---------|-----------|--------|
| `oṁ` + space + word | Short pause `\|` inserted after the space | Blue \|, bold |
| Long vowel (ā ī ū ṝ ḹ e ai o au) + space + short vowel (a i u ṛ ḷ) | Long pause `\|\|` | Red \|\|, bold |
| Any vowel + space + any vowel | Short pause `\|` | Blue \|, bold |

The pause is inserted at the position of the second word's vowel (before it).

---

## 6. Holdings (Samyukta Marking)

A **holding** is a visual border applied to one consonant within a consonant cluster (samyukta).

### What is a samyukta (consonant cluster)?

Two or more consecutive consonants with NO vowel between them. Clusters **CAN span word boundaries** (across spaces). Clusters are **terminated by pause marks** (`|`).

When walking through text to find clusters, the algorithm skips:
- Combining marks (U+0300–U+036F)
- Svara marks (U+0331, U+030D, U+030E, U+02CE, ·)
- Annotation characters (candrabindu U+0310 and related)
- Whitespace (treated as potential word boundary, not cluster terminator)

**ṁ (anusvara) and ḥ (visarga) are treated as consonants** for cluster detection purposes. They are in `ALL_CONSONANTS` and `SKIP_CONSONANTS`.

### Which consonant gets the holding? (`selectHoldingComponent`)

The algorithm applies these rules **in priority order** (first match wins):

**Rule 1 — Dvivarcana (identical consecutive consonants):**
If two consecutive consonants in the cluster are identical (e.g., `dd`, `tt`, `cc`), the **first** of the identical pair gets the holding. This rule has highest priority and overrides all others, including cross-word rules.

**Rule 2 — Cross-word boundary:**
If the cluster spans a word boundary (space), start the search at the **first consonant of the second word** (the first consonant after the space).

If there is no cross-word boundary, start from the **first consonant of the cluster** (index 0).

**Rule 3 — Skip rule (linear scan):**
From the starting position (determined by Rule 2), scan forward through the cluster's consonants:
- If the current consonant is NOT in `SKIP_CONSONANTS`, it gets the holding. **Stop.**
- If the current consonant IS in `SKIP_CONSONANTS`, skip it and check the next one.
- **Exception:** A sibilant (ś, ṣ, s) at a word boundary (first consonant of a word) is NOT skipped — it CAN host a holding.

**Rule 4 — Fallback:**
If ALL consonants in the cluster are in `SKIP_CONSONANTS` (and none qualify for the sibilant exception), the **last** consonant of the cluster gets the holding.

### SKIP_CONSONANTS

The following consonants are skipped during holding selection (unless overridden by a rule above):

`ṅ ñ ṇ n m ṁ ṃ r ś ṣ s`

Note: these consonants CAN host a holding if they are the fallback (Rule 4) or if they are sibilants at a word boundary.

### Holding type (short vs long)

Determined by the **vowel preceding the target consonant** (skipping ṁ, ṃ, ḥ to find the actual vowel):

| Preceding vowel | Holding type | CSS class | Visual |
|-----------------|-------------|-----------|--------|
| Short (a, i, u, ṛ, ḷ) | Short | `short-holding` | Thin green border (1px) |
| Long (ā, ī, ū, ṝ, ḹ, e, ai, o, au) | Long | `long-holding` | Thick green border (2px) |

### Examples

| Text | Cluster | Rule | Target | Type |
|------|---------|------|--------|------|
| `agni` | gn | Linear (g not in SKIP) | g | short (a) |
| `taṁ yajñasya` | ṁy | Cross-word: y is first after space; ṁ is SKIP → y | y | short (a from taṁ's preceding vowel) |
| `jñasya` | jñ | Linear (j not in SKIP) | j | depends on preceding vowel |
| `asya` | sy | Linear: s is SKIP → y | y | short (a) |
| `tvam` | tv | Linear (t not in SKIP) | t | depends on preceding vowel |
| `tvijam` | j + m at word end... | Depends on cluster detection | j | depends |
| `iddeveṣu` | dd | Dvivarcana (identical) | first d | depends |

---

## 7. Anusvara Transformations (`applyAnusvaraTransformations`)

The anusvara (ṁ) transforms based on the **following letter** (found by `findNextLetterInfo` which skips combining marks, svara marks, spaces, and annotation characters) and the **text source**.

### All sources — Nasal assimilation before stop consonants:

| Following consonant | ṁ becomes |
|--------------------|-----------|
| k, kh, g, gh | ṅ |
| c, ch, j, jh | ñ |
| ṭ, ṭh, ḍ, ḍh | ṇ |
| t, th, d, dh | n |
| p, ph, b, bh | m |

These replacements are marked with **change-style** (italic blue).

### Yajurveda / Kṛṣṇayajurveda — Before special consonants (ś, ṣ, s, h, r):

| Context | Previous vowel | Result |
|---------|---------------|--------|
| ṁ before ś/ṣ/s/h/r + consonant after (lupta-āgama) | a, i, u (basic short) | m̐**gg** (candrabindu + superscript gg) |
| ṁ before ś/ṣ/s/h/r + consonant after (lupta-āgama) | other vowel | m̐**g** (candrabindu + superscript g) |
| ṁ before ś/ṣ/s/h/r alone (no consonant follows) | — | m̐**gṁ** (candrabindu + superscript gṁ) |

Where m̐ = m + U+0310 (combining candrabindu). Superscript parts are in change-style.

### Yajurveda / Kṛṣṇayajurveda — Before semivowels:

| Following | Result |
|-----------|--------|
| v | ṁ**u** (ṁ + superscript u in change-style) |
| l | ṁ**l** (ṁ + superscript l in change-style) |
| y | ṁ**i** (ṁ + superscript i in change-style) |

### Ṛgveda:

| Following | Result |
|-----------|--------|
| ś, ṣ, s, h, r | Preserve original ṁ with change-style only (no candrabindu conversion, no superscript) |
| v | ṁ**u** |
| l | ṁ**l** |
| y | ṁ**i** |

### Smṛti / default:

All anusvara positions: highlight ṁ with change-style only. No conversion, no superscripts.

---

## 8. Visarga Transformations (`applyVisargaTransformations`)

| Following letter(s) | Previous vowel | ḥ becomes |
|---------------------|---------------|-----------|
| c, ch | — | ś (change-style) |
| ṭ, ṭh | — | ṣ (change-style) |
| t, th | — | s (change-style) |
| ś, ṣ, s (same sibilant) | — | same sibilant (change-style) |
| voiced consonant (g gh j jh ḍ ḍh d dh b bh m) or vowel | NOT a, NOT ā | r (change-style) |
| p | — | ḥ + superscript **f** (change-style) |
| kṣ | — | ḥ: + superscript of previous vowel |

---

## 9. Ṛgveda Svarita Adjustments (`applyRigvedaSvaritaRules`)

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

This causes the short vowel with svarita to be visually marked with a blue overline, indicating it should be elongated in recitation.

---

## 10. Final M Ending Tick (`applyFinalMEndingTick`)

Scans through the text looking for segment boundaries (newlines, dandas). If a segment ends with `m` (possibly followed by combining marks), insert a tick mark ˎ (U+02CE) after the m and its combining marks.

The tick is inserted only at actual segment endings, not mid-word.

---

## Visual Styling Summary

| Element | CSS class | Visual |
|---------|-----------|--------|
| Short holding | `ql-holding-short` | Thin green border (1px solid) |
| Long holding | `ql-holding-long` | Thick green border (2px solid) |
| Change style | `ql-change-style` | Italic, blue |
| Superscript | `script: super` | Raised text |
| Short pause | `ql-short-pause` | Blue `\|`, bold |
| Long pause | `ql-long-pause` | Red `\|\|`, bold |
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
