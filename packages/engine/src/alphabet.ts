/**
 * The letter sets. DATA ONLY — no logic lives here.
 *
 * Transcribed from `tools/chant/gen_marks.py` (itself a port of Śikṣāmitra's
 * `sanskrit_rules.js`). These sets used to exist in three copies — the JS
 * engine, `gen_marks.py` and `tokens.py`; this is now the one home.
 *
 * See docs/MARKING-RULES.md §1 and specs/chant-editor/02-ENGINE.md §1.
 */

/** Combining candrabindu — the Vedic nasal (the *gum*). */
export const CANDRA = '̐';
/** Anusvāra. */
export const ANU = 'ṁ';
/** Visarga. */
export const VIS = 'ḥ';
/** The virāma tick — the clipped final stop. Part of the text, never a pause. */
export const VIRAMA_TICK = 'ˎ';

/**
 * Conjunct-boundary controls — the information IAST loses (01 §2.5).
 *
 * Devanāgarī writes `क्त्य` as one stacked conjunct, but whether it is composed
 * `kt` + `ya` or `k` + `tya` is a real choice, and IAST writes `ktya` either
 * way. ZWNJ / ZWJ are the standard, lossless mechanism and round-trip to
 * Devanāgarī natively: virāma + ZWNJ IS how Unicode suppresses a ligature.
 *
 * They are ANNOTATION characters: invisible to the saṁyukta scan, to the
 * vowel-nucleus count and to the long/short look-back. They change what an
 * akṣara is, never what the letters are.
 */
export const ZWNJ = '‌';
export const ZWJ = '‍';

/**
 * The form boundary, for a romanisation whose forms can merge.
 *
 * U+034F COMBINING GRAPHEME JOINER. Its Unicode-defined purpose is exactly
 * this: block two characters from being treated as one unit, without changing
 * how either renders. It is invisible, it is inert in collation and search, and
 * it is NOT ZWNJ — which already means a conjunct split, and would be two
 * meanings on one character.
 *
 * ITRANS needs it because `sh` is both one phoneme and `s` + `h`, and `aa` is
 * both one vowel and `a` + `a`. Without a boundary the pair reads back as the
 * single letter and the script is lossy for text the corpus happens not to
 * contain.
 */
export const FORM_BOUNDARY = '͏';

/** The author-facing ASCII forms. `.` and `-` are taken (daṇḍa; word space). */
export const CJ_SPLIT_ASCII = '_';
export const CJ_JOIN_ASCII = '+';

/**
 * Characters that are stepped over everywhere a letter is expected: the svara
 * combining marks, the candrabindu, the svarabhakti dot and the conjunct
 * controls. `SVARA_MARKS` in `sanskrit_rules.js` L28, extended.
 */
export const ANNOTATION = new Set(['̱', '̍', '̎', 'ˎ', '·', CANDRA, ZWNJ, ZWJ, FORM_BOUNDARY]);

/** Two-character letters. A digraph is ONE letter and therefore one unit. */
export const DIGRAPHS = [
  'kh', 'gh', 'ch', 'jh', 'ṭh', 'ḍh', 'th', 'dh', 'ph', 'bh', 'ai', 'au',
] as const;

export const SHORT_VOWELS = new Set(['a', 'i', 'u', 'ṛ', 'ḷ']);
export const LONG_VOWELS = new Set(['ā', 'ī', 'ū', 'ṝ', 'ḹ', 'e', 'o', 'ai', 'au']);
export const VOWELS = new Set([...SHORT_VOWELS, ...LONG_VOWELS]);

export const CONSONANTS = new Set([
  'k', 'kh', 'g', 'gh', 'ṅ',
  'c', 'ch', 'j', 'jh', 'ñ',
  'ṭ', 'ṭh', 'ḍ', 'ḍh', 'ṇ',
  't', 'th', 'd', 'dh', 'n',
  'p', 'ph', 'b', 'bh', 'm',
  'y', 'r', 'l', 'ḻ', 'v',
  'ś', 'ṣ', 's', 'h',
]);

/**
 * Consonants that cannot HOST a holding (`SKIP_CONSONANTS`,
 * `sanskrit_rules.js` L9).
 *
 * `ḥ` is deliberately NOT in this set: inside a word a visarga can host
 * (`duḥkha`). A WORD-FINAL `ḥ` cannot, and that is handled positionally in the
 * host-selection rule, not by membership here.
 */
export const SKIP = new Set(['ṅ', 'ñ', 'ṇ', 'n', 'm', 'ṁ', 'ṃ', 'r', 'ś', 'ṣ', 's']);

export const SIBILANTS = new Set(['ś', 'ṣ', 's']);

/**
 * The whole voiced series — stops, nasals, semivowels and `h`.
 *
 * MARKING-RULES §5 records that this table was once written as the stops
 * alone, which read as though `ḥ` before `y r l v h` or a nasal other than `m`
 * were left unchanged. It is not: that is ordinary visarga sandhi, and the
 * shipped chants depend on it.
 */
export const VOICED = new Set([
  'g', 'gh', 'j', 'jh', 'ḍ', 'ḍh', 'd', 'dh', 'b', 'bh',
  'm', 'n', 'ṅ', 'ñ', 'ṇ',
  'y', 'r', 'l', 'v', 'h',
]);

/**
 * Letters that can never OPEN a syllable — they close the one before.
 *
 * Measured across all eleven shipped documents: the anusvāra is a coda 418
 * times and an onset never, the visarga 439 times against one transcription
 * slip, the virāma tick 72 times against none. The syllabifier's default rule
 * (an onset attaches to the following vowel) puts `chaṁyorā` as `cha · ṁyo`,
 * which is the wrong akṣara in every script — the corpus writes `chaṁ · yo`.
 */
export const NEVER_ONSET = new Set([ANU, 'ṃ', VIS, VIRAMA_TICK]);

/** Stepped over when looking back for the vowel that decides long vs short. */
export const HOLD_SKIP_MARKS = new Set(['ṁ', 'ṃ', 'ḥ']);

/** Anusvāra → the homorganic nasal, by the following stop's class. */
export const STOP_GROUP: ReadonlyArray<readonly [string, ReadonlySet<string>]> = [
  ['ṅ', new Set(['k', 'kh', 'g', 'gh'])],
  ['ñ', new Set(['c', 'ch', 'j', 'jh'])],
  ['ṇ', new Set(['ṭ', 'ṭh', 'ḍ', 'ḍh'])],
  ['n', new Set(['t', 'th', 'd', 'dh'])],
  ['m', new Set(['p', 'ph', 'b', 'bh'])],
];

/** The five stop vargas. Two stops of one varga share a point of articulation.
 *  Nasals are excluded — they are in `SKIP` and cannot host. */
export const VARGA: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const v of ['k kh g gh', 'c ch j jh', 'ṭ ṭh ḍ ḍh', 't th d dh', 'p ph b bh']) {
    for (const c of v.split(' ')) m.set(c, v[0]!);
  }
  return m;
})();

export const PRANAVA = new Set(['oṁ', 'oṃ', 'auṁ', 'om']);

/**
 * Bīja mantras. Their anusvāra is NEVER assimilated, and each takes the short
 * pause that opens what follows.
 *
 * `guṁ` and `paṁ` are here on the evidence of the Veda Union sādhana's own
 * marked text, which prints `guṁ | gurubhyo` and `paṁ | parama gurubhyo` with
 * the anusvāra intact — where the ordinary rule would have given `guṅ` before
 * `g-` and `pam` before `p-`.
 */
export const BIJA = new Set([
  'oṁ', 'auṁ', 'hrīṁ', 'śrīṁ', 'klīṁ', 'aiṁ', 'sauṁ', 'krīṁ', 'hlīṁ', 'strīṁ',
  'blūṁ', 'glauṁ', 'hauṁ', 'huṁ', 'phaṭ', 'dūṁ', 'gaṁ', 'drāṁ', 'grīṁ', 'kṣrauṁ',
  'guṁ', 'paṁ',
]);

/**
 * Before `jñ` or `ghn` the anusvāra is KEPT and only highlighted — it does not
 * take the homorganic nasal (`SPECIAL_SEQUENCES`, `sanskrit_rules.js` L46).
 *
 * Verified against the engine rather than the prose transcription. It occurs
 * nowhere in the four shipped chants, so adding it changed no output; it is
 * here so that the first text which does hit it is not marked wrong silently.
 */
export const SPECIAL_SEQUENCES: ReadonlyArray<readonly [string, string]> = [
  ['j', 'ñ'],
  ['gh', 'n'],
];

/**
 * The reading aids, measured across the owner's four hand-marked chants:
 *
 *   vy → u    29 of 29   universal
 *   jñ → g    14 of 32   split between his own files; he ruled it IN (2026-08)
 *   sv → u     2 of 30   NOT the house habit — deliberately absent
 *   ghn        0 of 3    in SPECIAL_SEQUENCES for the anusvāra rule only
 */
export const READING_AIDS: ReadonlyArray<readonly [readonly [string, string], string]> = [
  [['j', 'ñ'], 'g'],
  [['v', 'y'], 'u'],
];

/**
 * Svarabhakti fires on a `ś ṣ h` immediately preceded by `r`.
 *
 * The trigger set in `sanskrit_rules.js` ("a consonant and a following
 * s ś ṣ h ṛ") is far too wide taken literally: it would fire on `kṣ`, `sm`,
 * `śś`, `ts`, and the owner marks none of those — `lakṣmīś` stands bare on the
 * very line that carries a dot, and `k`+`ṣ` is unmarked 46 times across his
 * three chants. Measured instead: all 8 of his dots sit on a `ś ṣ h` directly
 * after an `r`, and no such contact in those files is left unmarked.
 */
export const SBHAKTI_AFTER = 'r';
export const SBHAKTI_TRIGGERS = new Set(['ś', 'ṣ', 'h']);

export function isVowel(ch: string): boolean {
  return VOWELS.has(ch);
}

export function isConsonant(ch: string): boolean {
  return CONSONANTS.has(ch) || ch === ANU || ch === VIS;
}

/** `kh` → `k`, `dh` → `d`; anything else unchanged. */
export function unaspirated(c: string): string {
  return c.length === 2 && c.endsWith('h') ? c.slice(0, -1) : c;
}

/**
 * Split a space-free word into letters.
 *
 * The gum is authored the way Śikṣāmitra authors it — `m` + U+0310, optionally
 * followed by the superscript reading aid `g`, `gg` or `gṁ`. It is kept as ONE
 * letter so the whole run becomes a single unit carrying `candra` + `sup`,
 * exactly as `purusha-suktam.json` stores it.
 */
export function parseLetters(word: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < word.length) {
    if (word[i] === 'm' && word[i + 1] === CANDRA) {
      let j = i + 2;
      let g = '';
      while (j < word.length && word[j] === 'g' && g.length < 2) {
        g += 'g';
        j += 1;
      }
      if (g && j < word.length && word[j] === ANU) {
        g += ANU;
        j += 1;
      }
      out.push('m' + CANDRA + g);
      i = j;
      continue;
    }
    const two = word.slice(i, i + 2);
    if ((DIGRAPHS as readonly string[]).includes(two)) {
      out.push(two);
      i += 2;
      continue;
    }
    out.push(word[i]!);
    i += 1;
  }
  return out;
}

/**
 * The control character a conjunct boundary emits after the virāma.
 *
 * ZWNJ / ZWJ, not the ASCII `_` / `+`: they are zero-width format characters,
 * invisible, inert in collation and search, and already the canonical internal
 * form. Here rather than in a script module because it is the same character
 * in every script, and it was briefly written out in two of them.
 */
export const cjControl = (cj: 'split' | 'join' | undefined): string => {
  if (cj === 'split') return ZWNJ;
  if (cj === 'join') return ZWJ;
  return '';
};
