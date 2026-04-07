# IAST Reference — International Alphabet of Sanskrit Transliteration

This document provides the complete IAST character reference as used in śikṣāmitra, including character definitions, Unicode codepoints, and phonological classification.

---

## Vowels (Svara)

### Simple Vowels

| IAST | Unicode | Devanagari | Duration | Place | Notes |
|------|---------|-----------|----------|-------|-------|
| a | U+0061 | अ | Short (1 mātrā) | Guttural | Open central vowel |
| ā | U+0101 | आ | Long (2 mātrā) | Guttural | Open central, sustained |
| i | U+0069 | इ | Short (1 mātrā) | Palatal | Close front |
| ī | U+012B | ई | Long (2 mātrā) | Palatal | Close front, sustained |
| u | U+0075 | उ | Short (1 mātrā) | Labial | Close back rounded |
| ū | U+016B | ऊ | Long (2 mātrā) | Labial | Close back rounded, sustained |
| ṛ | U+1E5B | ऋ | Short (1 mātrā) | Retroflex | Vocalic r |
| ṝ | U+1E5D | ॠ | Long (2 mātrā) | Retroflex | Long vocalic r |
| ḷ | U+1E37 | ऌ | Short (1 mātrā) | Dental/lateral | Vocalic l |
| ḹ | U+1E39 | ॡ | Long (2 mātrā) | Dental/lateral | Long vocalic l (rare) |

### Compound Vowels (Diphthongs)

| IAST | Unicode | Devanagari | Duration | Composition | Notes |
|------|---------|-----------|----------|-------------|-------|
| e | U+0065 | ए | Long (2 mātrā) | a + i | Treated as long in śikṣāmitra |
| ai | U+0061 U+0069 | ऐ | Long (2 mātrā) | ā + i | Diphthong |
| o | U+006F | ओ | Long (2 mātrā) | a + u | Treated as long |
| au | U+0061 U+0075 | औ | Long (2 mātrā) | ā + u | Diphthong |

**Note**: In śikṣāmitra's classification, `e`, `ai`, `o`, `au` are in `LONG_VOWELS` even though they are sometimes treated differently in other systems. This affects holding type detection.

---

## Consonants (Vyañjana)

### Stops — by Place of Articulation

Each row: voiceless unaspirated, voiceless aspirated, voiced unaspirated, voiced aspirated, nasal

#### Velar (kaṇṭhya — throat)
| IAST | Unicode | Devanagari | Type | Notes |
|------|---------|-----------|------|-------|
| k | U+006B | क | Voiceless unaspirated | Alpa-prāṇa |
| kh | U+006B U+0068 | ख | Voiceless aspirated | Mahā-prāṇa |
| g | U+0067 | ग | Voiced unaspirated | Alpa-prāṇa |
| gh | U+0067 U+0068 | घ | Voiced aspirated | Mahā-prāṇa |
| ṅ | U+1E45 | ङ | Nasal | Class nasal (cannot host holding) |

#### Palatal (tālavya — palate)
| IAST | Unicode | Devanagari | Type | Notes |
|------|---------|-----------|------|-------|
| c | U+0063 | च | Voiceless unaspirated | Alpa-prāṇa |
| ch | U+0063 U+0068 | छ | Voiceless aspirated | Mahā-prāṇa |
| j | U+006A | ज | Voiced unaspirated | Alpa-prāṇa |
| jh | U+006A U+0068 | झ | Voiced aspirated | Mahā-prāṇa |
| ñ | U+00F1 | ञ | Nasal | Class nasal (cannot host holding) |

#### Retroflex (mūrdhanya — cerebral/palate roof)
| IAST | Unicode | Devanagari | Type | Notes |
|------|---------|-----------|------|-------|
| ṭ | U+1E6D | ट | Voiceless unaspirated | Alpa-prāṇa |
| ṭh | U+1E6D U+0068 | ठ | Voiceless aspirated | Mahā-prāṇa |
| ḍ | U+1E0D | ड | Voiced unaspirated | Alpa-prāṇa |
| ḍh | U+1E0D U+0068 | ढ | Voiced aspirated | Mahā-prāṇa |
| ṇ | U+1E47 | ण | Nasal | Class nasal (cannot host holding) |

#### Dental (dantya — teeth)
| IAST | Unicode | Devanagari | Type | Notes |
|------|---------|-----------|------|-------|
| t | U+0074 | त | Voiceless unaspirated | Alpa-prāṇa |
| th | U+0074 U+0068 | थ | Voiceless aspirated | Mahā-prāṇa |
| d | U+0064 | द | Voiced unaspirated | Alpa-prāṇa |
| dh | U+0064 U+0068 | ध | Voiced aspirated | Mahā-prāṇa |
| n | U+006E | न | Nasal | Class nasal (cannot host holding) |

#### Labial (oṣṭhya — lips)
| IAST | Unicode | Devanagari | Type | Notes |
|------|---------|-----------|------|-------|
| p | U+0070 | प | Voiceless unaspirated | Alpa-prāṇa |
| ph | U+0070 U+0068 | फ | Voiceless aspirated | Mahā-prāṇa |
| b | U+0062 | ब | Voiced unaspirated | Alpa-prāṇa |
| bh | U+0062 U+0068 | भ | Voiced aspirated | Mahā-prāṇa |
| m | U+006D | म | Nasal | Class nasal (cannot host holding) |

### Semivowels (Antastha)
| IAST | Unicode | Devanagari | Place | Notes |
|------|---------|-----------|-------|-------|
| y | U+0079 | य | Palatal | Approximant |
| r | U+0072 | र | Retroflex | Approximant (cannot host holding; triggers svarabhakti) |
| l | U+006C | ल | Dental | Lateral |
| ḻ | U+1E3B | ळ | Retroflex | Retroflex lateral; transliterates Devanagari ḷ |
| v | U+0076 | व | Labio-dental | Approximant |

### Sibilants (Ūṣma)
| IAST | Unicode | Devanagari | Place | Notes |
|------|---------|-----------|-------|-------|
| ś | U+015B | श | Palatal | Sibilant (cannot host holding, except at word boundary) |
| ṣ | U+1E63 | ष | Retroflex | Sibilant (cannot host holding, except at word boundary) |
| s | U+0073 | स | Dental | Sibilant (cannot host holding, except at word boundary) |

### Aspirate
| IAST | Unicode | Devanagari | Notes |
|------|---------|-----------|-------|
| h | U+0068 | ह | Glottal aspirate; triggers svarabhakti after r |

### Special Characters

#### Anusvāra (nasal resonance)
| IAST | Unicode | Devanagari | Notes |
|------|---------|-----------|-------|
| ṁ | U+1E41 | ं | Standard IAST anusvara (dot above m) |
| ṃ | U+1E43 | ं | Alternative (dot below m) — normalized to ṁ |

Both represent the same sound. The editor normalizes ṃ → ṁ in pre-processing.

#### Visarga (aspirate breath)
| IAST | Unicode | Devanagari | Notes |
|------|---------|-----------|-------|
| ḥ | U+1E25 | ः | Voiceless glottal fricative; undergoes complex sandhi |

#### Candrabindu (nasalized vowel)
| Notation | Components | Notes |
|----------|-----------|-------|
| m̐ | m + U+0310 | Ṛgvedic nasalization; preserved unchanged in Ṛgveda mode |

---

## Diacritics and Combining Marks

### Svara (pitch accent) marks

| Mark | Unicode | IAST position | Vedic function |
|------|---------|--------------|----------------|
| ̱ (below) | U+0331 | Below character | Anudātta — low pitch |
| ̍ (above) | U+030D | Above character | Svarita — rising pitch |
| ̎ (above) | U+030E | Above character | Udātta — high pitch |
| ˎ | U+02CE | Standalone | Tick / secondary stress |
| ̐ | U+0310 | Above m | Candrabindu — nasalization |

### General combining marks

These are recognized and skipped during letter-finding operations:
- U+0300–U+036F (combining diacritical marks block)

---

## Two-Character Sequences

Sanskrit IAST uses two-character combinations for aspirated consonants. The editor always checks two-character sequences BEFORE single characters:

```javascript
TWO_CHAR_CONSONANTS = ['kh', 'gh', 'ch', 'jh', 'ṭh', 'ḍh', 'th', 'dh', 'ph', 'bh']
TWO_CHAR_VOWELS = ['ai', 'au', 'ṝ', 'ḹ']
```

This ordering is critical: without it, `kh` would be incorrectly parsed as consonant `k` + consonant `h`.

---

## Classification Summary for Grammar Rules

### Short vowels (1 mātrā)
`a  i  u  ṛ  ḷ`

### Long vowels (2 mātrā)
`ā  ī  ū  ṝ  ḹ  e  ai  o  au`

### Consonants that cannot host a holding
`ṅ  ñ  ṇ  n  m  ṁ  ṃ  r  ś  ṣ  s`
(Exception: ś ṣ s CAN host if at word boundary)

### Voiced consonants (trigger ḥ → r)
`g  gh  j  jh  ḍ  ḍh  d  dh  b  bh  m`

### Sibilants (trigger ḥ → same sibilant; trigger svarabhakti from r)
`ś  ṣ  s`

### Svarabhakti triggers (after r)
`s  ś  ṣ  h  ṛ`

### Advaya (block visarga → r)
`a  ā` (when these are the PREVIOUS vowel before ḥ)

---

## Input Normalization Reference

Characters accepted as input that get normalized:

| Input | Normalized to | Reason |
|-------|--------------|--------|
| ṃ | ṁ | Both are anusvara; dot above is canonical |
| ō | o | Devanagari-romanization long o |
| ē | e | Devanagari-romanization long e |
| U+0951 | U+030D | Svarita — Unicode variant |
| U+0952 | U+0331 | Anudātta — Devanagari stress sign |
| U+0332 | U+0331 | Anudātta — combining low line |
| U+1CDA | U+030E | Udātta — South Asian combining mark |
| U+0341 | U+030E | Udātta — combining acute tone |
