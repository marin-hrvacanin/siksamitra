# Veda Union Markings — Visual System Reference

This document describes all special markings and visual conventions used in the śikṣāmitra editor for Vedic text annotation, as defined by Veda Union's Śikṣā curriculum.

---

## Overview

The śikṣāmitra marking system covers six dimensions of Vedic recitation as defined in the classical Śikṣā texts:

| Śikṣā element | Sanskrit | Editor feature |
|---------------|---------|----------------|
| 1. Letters (phonemes) | Varṇa | IAST transliteration with full consonant/vowel set |
| 2. Pitch accent | Svara | Combining diacritics (Anudātta/Svarita/Udātta) |
| 3. Duration | Mātrā | Short/long vowel distinction (1 vs 2 mātrā) |
| 4. Force | Balam | Aspiration (alpa-prāṇa / mahā-prāṇa consonant pairs) |
| 5. Linking | Sāma | Sandhi rules (anusvāra, visarga, svarabhakti) |
| 6. Continuity/pausing | Santāna | Pause marks (| and ||) |

---

## 1. Pitch Accents (Svara Marks)

Vedic Sanskrit uses three pitch accents. The śikṣāmitra editor represents them as Unicode combining diacritical marks applied directly to IAST letters.

### Anudātta — Low Pitch

- **Unicode**: U+0331 (COMBINING MACRON BELOW)
- **Visual**: Horizontal line below the character — a̱
- **Traditional description**: The "not-raised" tone; the naturally low baseline pitch
- **In Quill**: Applied via the "Anudatta" svara button
- **Accepted input variants**: U+0952, U+0332, U+0320, U+0321 (all normalized to U+0331)

### Svarita — Rising/Mixed Pitch

- **Unicode**: U+030D (COMBINING VERTICAL LINE ABOVE)
- **Visual**: Short vertical stroke above the character — á̍ (alongside the vowel)
- **Traditional description**: A pitch that rises from anudātta and may fall; occurs naturally after udātta
- **In Quill**: Applied via the "Svarita" svara button
- **Accepted input variants**: U+0951 (normalized to U+030D)

### Udātta — High Pitch

- **Unicode**: U+030E (COMBINING DOUBLE VERTICAL LINE ABOVE)
- **Visual**: Double vertical stroke above the character — ̎
- **Traditional description**: The "raised" tone; the main high-pitch accent that governs a word's accentuation
- **In Quill**: Applied via the "Udatta" svara button
- **Accepted input variants**: U+1CDA, U+0341 (both normalized to U+030E)

### Tick / Secondary Stress

- **Unicode**: U+02CE (MODIFIER LETTER LOW GRAVE)
- **Visual**: ˎ (below, resembling a low grave accent)
- **In Quill**: Applied via the "Tick" svara button

### Dīrgha Svarita (Long Svarita)

- Marked with `ql-dirgha-char` CSS class
- Rendered as a blue overline above the character (CSS `::before` pseudo-element)
- Applies only in Ṛgveda mode (`applyRigvedaSvaritaRules`)
- **Long vowel rule**: Svarita (U+030D) on a long vowel (ā, ī, ū, ṝ, ḹ, e, ai, o, au) is replaced with dīrgha svarita (U+030E)
- **Short vowel rule**: Svarita on a short vowel (a, i, u, ṛ, ḷ) applies `dirgha-char` blue overline formatting — unless a holding is already applied to an adjacent consonant cluster
- **Anusvara svarita rule**: Svarita on ṁ with a preceding short vowel is replaced with dīrgha svarita

### Final M Tick Mark

- **Unicode**: U+02CE (MODIFIER LETTER LOW GRAVE) = ˎ
- Inserted after `m` (and any combining marks) at segment endings (before newlines, dandas)
- Applied by `applyFinalMEndingTick()` as the last step in the automation pipeline

---

## 2. Candrabindu — Nasalized Resonance

- **Unicode**: m + U+0310 (COMBINING CANDRABINDU) = m̐
- **Visual**: m with a crescent-moon mark above
- **Traditional description**: Represents the nasalized nasal resonance (anunāsika) specific to Ṛgvedic recitation
- **Behavior**:
  - In **Ṛgveda** mode: preserved as m̐ (never converted to ṁ)
  - In **other modes**: normalized to ṁ (anusvara) during processing
- **Annotation role**: The candrabindu and its superscript forms (m̐g, m̐gg, m̐gṁ) are treated as annotation-only characters — they do not affect positional calculations for other rules

---

## 3. Holdings (Samyukta Marking)

Holdings visually mark the first consonant of a consonant cluster (samyukta-akṣara, a group of two or more consecutive consonants without intervening vowel). They indicate:
1. That a cluster is present (special pronunciation care needed)
2. Whether the cluster follows a short or long vowel

### Short Holding

- **CSS class**: `span.short-holding`
- **Visual**: Thin green border around the consonant
- **Border**: `1px solid #10b981` (light mode), `1px solid #34d399` (dark mode)
- **Border radius**: 3px
- **Trigger**: The preceding vowel before the cluster is a **short vowel** (a i u ṛ ḷ)
- **Example**: In the word `karma`, the cluster `rm` — if preceded by short `a` — would place a short holding on `r`

### Long Holding

- **CSS class**: `span.long-holding`
- **Visual**: Thicker green border around the consonant
- **Border**: `2px solid #10b981` (light mode), `2px solid #34d399` (dark mode)
- **Border radius**: 3px
- **Trigger**: The preceding vowel is a **long vowel** (ā ī ū ṝ ḹ e ai o au)

### Which consonant gets the holding

The selection algorithm:
1. **Dvivarcana** (geminate/doubled consonants): If the cluster contains two identical consecutive consonants, the first receives the holding
2. **Cross-word clusters**: The first consonant of the second word in a cross-word cluster is the candidate
3. **Default**: First consonant of the cluster
4. **Skip rule**: Skip consonants that cannot host a holding: ṅ ñ ṇ n m ṁ ṃ r ś ṣ s

**Exception**: Sibilants (ś ṣ s) CAN host a holding if they appear at a word boundary (cross-word position).

### Consonants that cannot host a holding

| Consonant | Reason |
|-----------|--------|
| ṅ ñ ṇ n | Class nasals — they assimilate before following consonant |
| m ṁ ṃ | Labial nasal / anusvara — not hosting position |
| r | Approximant — does not function as holding consonant |
| ś ṣ s | Sibilants — except at word boundaries |

---

## 4. Pause Marks (Santāna)

Pause marks indicate breathing/recitation pauses according to Vedic śikṣā rules. They appear as vertical line characters inline in the text.

### Short Pause `|`

- **CSS class**: `ql-short-pause`
- **Color**: Blue (`#2563eb`)
- **Weight**: Bold
- **Triggers**:
  - After `oṁ` + space (before the next word)
  - Any vowel at end of word + space + any vowel at start of next word (general vowel-vowel junction)

### Long Pause `||`

- **CSS class**: `ql-long-pause`
- **Color**: Red (`#dc2626`)
- **Weight**: Bold
- **Trigger**: Long vowel at end of word + space + short vowel at start of next word

### Danda and Double Danda

Sanskrit punctuation for sentence and verse boundaries (not generated by pause rules, but input directly):
- `।` (U+0964, Devanagari danda) — sentence end
- `॥` (U+0965, Devanagari double danda) — verse/section end

---

## 5. Svarabhakti Mark `·`

- **Character**: U+00B7 (MIDDLE DOT)
- **CSS class**: `ql-svara-char` (red, Palladio font)
- **Traditional description**: An epenthetic sound inserted to ease pronunciation when `r` precedes a difficult consonant
- **Trigger**: `r` followed by s, ś, ṣ, h, or ṛ
- **Position**: Inserted immediately after `r` and any combining marks on it

---

## 6. Anusvara Superscript Annotations (Vedic)

In Yajurveda mode, the transformation of ṁ before ś/ṣ/s/h/r produces complex annotations:

### m̐[gṁ] — Full form

Before ś/ṣ/s/h/r when followed by a vowel (no immediate consonant):
- m̐ = m + U+0310 (candrabindu, normal size)
- [g] = g in superscript, change-style (italic blue)
- [ṁ] = ṁ in superscript, change-style

### m̐[gg] — Double-g lupta-āgama

Before ś/ṣ/s/h/r + consonant, when preceding vowel is a, i, or u:
- m̐ = m + U+0310
- [g] = first superscript g
- [g] = second superscript g

### m̐[g] — Single-g lupta-āgama

Before ś/ṣ/s/h/r + consonant, when preceding vowel is NOT a, i, or u:
- m̐ = m + U+0310
- [g] = single superscript g

### Rendering

Superscript elements appear in `<change>` tag (ChangeStyle blot):
- Font style: italic
- Color: `#1d4ed8` (blue, light mode); `#60a5fa` (dark mode)
- Positionally raised as superscript via CSS/Quill formatting

---

## 7. Text Style Conventions

### Change Style (`<change>` tag)

Used for:
- Superscript annotations in anusvara transformations
- Textual variants and editorial revisions
- Visual: italic, blue

### Translation Style (`.ql-doc-translation`, `.ql-translation-style`)

- Italic, smaller (0.85em), gray color
- Used for English or secondary-language translations of Sanskrit text
- Block-level or inline

### Comment Style (`.ql-comment-style`)

- Italic, amber background with left border
- Used for scholarly comments and glosses

### Svara Character Style (`.ql-svara-char`)

- Font: URW Palladio ITU (or Times New Roman fallback)
- Weight: 800 (extra bold)
- Color: Red (`#cc1b1b` light, `#ff4d4d` dark)
- Used for: svarabhakti dots, and some svara accent rendering

### Dīrgha Character Style (`.ql-dirgha-char`)

- Renders a blue horizontal overline above the character using CSS `::before`
- Color: `#1d4ed8` (light mode), `#60a5fa` (dark mode)
- Thickness: 0.08em
- Extension: 0.12em beyond character edges

---

## 8. Paragraph / Block Styles

These apply to entire paragraphs and define document structure:

| CSS Class | Display Name | Visual |
|-----------|-------------|--------|
| `ql-doc-title` | Title | 1.75em, weight 600, amber bottom border |
| `ql-doc-subtitle` | Subtitle | 0.85em, uppercase, gray, spaced |
| `ql-doc-section` | Section | 1.15em, weight 600, left orange border |
| `ql-doc-subsection` | Subsection | 0.9em, weight 600, subtle left border |
| `ql-doc-translation` | Translation | Italic, 0.85em, gray |

---

## 9. Bīja Mantra Preservation

When the `skipBija` setting is enabled (default), common bīja mantras (sacred seed syllables) at the start of a line are excluded from anusvara transformation. Their ṁ remains unchanged.

### Recognized bīja mantras

oṁ, auṁ, hrīṁ, śrīṁ, klīṁ, aiṁ, sauṁ, krīṁ, hlīṁ, strīṁ, blūṁ, glauṁ, hauṁ, huṁ, phaṭ, dūṁ, gaṁ, drāṁ, grīṁ, kṣrauṁ

### Detection

The text from the start of the line up to and including the ṁ is trimmed, lowercased, and checked against the `BIJA_MANTRAS` set. If it matches, the anusvara transformation is skipped for that occurrence.

---

## Audio Workflow Note

Audio attachments preserve this visual system during playback and export. The audio editor can stage the selected region first, then let you hide or show individual ranges without changing the underlying text layer.

For the full audio workflow, see `documents/audio-editing-and-matching.md`.

---

## 10. Audio Attachments

Documents may embed audio recitation files:
- Stored as base64 data URIs in the `.smdoc` file
- Displayed inline as a small circular play button (ochre border, 28px diameter)
- Play state toggles between play/stop icons
- CSS class: `.audio-play-button` with `.audio-icon`
- Option to hide audio buttons: `body.hide-audio .audio-play-button { display: none }`

---

## Color System Summary

| Color | Hex (light) | Usage |
|-------|-------------|-------|
| Ochre | `#b8813d` | Primary UI — buttons, borders |
| Saffron | `#d97706` | Accent — title borders, highlights |
| Green | `#10b981` | Holdings (short and long) |
| Blue | `#2563eb` | Short pause, change style, dīrgha |
| Red | `#dc2626` | Long pause, svara chars |
| Amber | `rgba(251,191,36,0.25)` | Comment background |
| Amber border | `#f59e0b` | Comment left border |
| Dark text | `#1a1816` | Primary text |
| Gray | `#78716c` | Subtitle, subsection, translation |
