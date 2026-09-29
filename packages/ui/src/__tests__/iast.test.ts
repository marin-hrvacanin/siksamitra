/**
 * TYPING IAST — the table, against the file it was transcribed from.
 *
 * The leader map and the palette are v1's, and the value of this file is that
 * they STAY v1's. `editor-quill.js` `setupIASTShortcuts` (L5641-5647) is the
 * running code the owner has used for years; a well-meaning correction here —
 * dropping the duplicate `J`, "fixing" `ṁ` to `ṃ` — changes a habit.
 *
 * AND THE PALETTE MAY NOT LIE. v1's dialog titled `ṅ` "F9+G" and `ñ` "F9+J"
 * while its own shortcut table maps `G` and `J` both to `ñ` and `N` to `ṅ`.
 * So it told you a chord that produces a different letter, and the chord for
 * `ṅ` was not shown at all. `leaderFor` derives the hint FROM the map, and the
 * checks below are what make that derivation worth having.
 */
import { describe, expect, it } from 'vitest';
import {
  IAST_LEADER, IAST_LEADER_KEY, IAST_PALETTE, leaderFor, leaderStep,
} from '../iast.js';

describe('the leader map is his', () => {
  it('is nineteen entries, transcribed verbatim', () => {
    /* Nineteen keys for eighteen characters: `G` and `J` both give `ñ`. */
    expect(Object.keys(IAST_LEADER)).toHaveLength(19);
    expect(new Set(Object.values(IAST_LEADER)).size).toBe(18);
  });

  it('every entry, spelled out — so a change to one is a change to this file', () => {
    expect(IAST_LEADER).toEqual({
      a: 'ā', i: 'ī', u: 'ū', r: 'ṛ', R: 'ṝ',
      l: 'ḷ', L: 'ḹ', m: 'ṁ', h: 'ḥ',
      t: 'ṭ', T: 'ṭh', d: 'ḍ', D: 'ḍh', n: 'ṇ',
      s: 'ś', S: 'ṣ', G: 'ñ', J: 'ñ', N: 'ṅ',
    });
  });

  it('and it is CASE-SENSITIVE, which is half of it', () => {
    /* `r` is ṛ and `R` is ṝ; `t` is ṭ and `T` is ṭh. A case-insensitive
       lookup would make nine of the eighteen characters unreachable. */
    expect(IAST_LEADER['r']).not.toBe(IAST_LEADER['R']);
    expect(IAST_LEADER['t']).not.toBe(IAST_LEADER['T']);
    expect(IAST_LEADER['d']).not.toBe(IAST_LEADER['D']);
    expect(IAST_LEADER['l']).not.toBe(IAST_LEADER['L']);
    expect(IAST_LEADER['s']).not.toBe(IAST_LEADER['S']);
  });

  it('the leader is F9, not a chord', () => {
    /* A leader and not a modifier is the whole point: the range is reachable
       with no chord and no OS keyboard layout, on a machine where AltGr
       already means something. */
    expect(IAST_LEADER_KEY).toBe('F9');
  });
});

describe('one press after the leader', () => {
  it('a mapped key gives its character', () => {
    expect(leaderStep('a')).toEqual({ insert: 'ā' });
    expect(leaderStep('T')).toEqual({ insert: 'ṭh' });
  });

  it('a modifier is NOT the second key', () => {
    /*
     * THE CAPITAL HALF IS TYPED WITH SHIFT — F9 then Shift+T for `ṭh` — so
     * consuming the leader on the Shift keydown makes nine of the eighteen
     * characters unreachable. `null` means "still armed".
     */
    for (const key of ['Shift', 'Control', 'Alt', 'Meta']) {
      expect(leaderStep(key), key).toBeNull();
    }
  });

  it('and an unmapped key is a miss, which ends the leader', () => {
    /* `'miss'` rather than `null`: F9 then `q` means the person meant a
       diacritic and named one that does not exist. It ends the leader and
       inserts nothing — it must not insert `q` into a mantra. */
    expect(leaderStep('q')).toBe('miss');
    expect(leaderStep('Enter')).toBe('miss');
    expect(leaderStep('F9')).toBe('miss');
  });
});

describe('the palette cannot say something the keyboard does not do', () => {
  const keys = IAST_PALETTE.flatMap((g) => g.keys);

  it('every hint it shows is the map’s own answer', () => {
    /*
     * THE FAULT IN v1's DIALOG. It titled `ṅ` "F9+G", and F9+G gives `ñ`.
     * Derived rather than typed, the hint is right by construction — and this
     * is the check that the derivation is used.
     */
    for (const key of keys) {
      const leader = leaderFor(key.ch);
      if (leader === undefined) continue;
      expect(IAST_LEADER[leader], `${key.ch} claims F9+${leader}`).toBe(key.ch);
    }
  });

  it('and every character the leader can type is ON the palette', () => {
    /* Otherwise a character is reachable only by a shortcut nobody can
       discover — which is what "F9+N gives ṅ" was in v1. */
    const shown = new Set(keys.map((k) => k.ch));
    for (const ch of Object.values(IAST_LEADER)) {
      expect(shown.has(ch), `${ch} is not on the palette`).toBe(true);
    }
  });

  it('ṅ has a hint at all, which v1 never showed', () => {
    expect(leaderFor('ṅ')).toBe('N');
    expect(leaderFor('ñ')).toBe('G');
  });
});

describe('the palette is the varṇamālā, not a bag of odd characters', () => {
  it('eight groups, in the order the grammar teaches them', () => {
    expect(IAST_PALETTE.map((g) => g.group)).toEqual([
      'Vowels & special', 'Gutturals', 'Palatals', 'Retroflexes', 'Dentals',
      'Labials', 'Semivowels & sibilants', 'Vedic & punctuation',
    ]);
  });

  it('the five stop series have five each', () => {
    /* k kh g gh ṅ — the shape of the table a reciter learned it from. A
       series with four is a series with a letter missing. */
    for (const name of ['Gutturals', 'Palatals', 'Retroflexes', 'Dentals', 'Labials']) {
      const group = IAST_PALETTE.find((g) => g.group === name)!;
      expect(group.keys, name).toHaveLength(5);
    }
  });

  it('a combining mark is drawn on a carrier letter', () => {
    /*
     * A lone U+0331 on a button is an invisible key. What is INSERTED is the
     * bare mark — it lands on whatever letter the caret is after — and what is
     * SHOWN carries it.
     */
    const vedic = IAST_PALETTE.find((g) => g.group === 'Vedic & punctuation')!;
    const combining = vedic.keys.filter((k) => k.show !== undefined);
    expect(combining.length).toBeGreaterThanOrEqual(4);
    for (const key of combining) {
      expect(key.show!.length, key.name).toBeGreaterThan(key.ch.length);
      expect(key.show!.endsWith(key.ch), key.name).toBe(true);
    }
  });

  it('and every key inserts something', () => {
    /* An empty key is a key that does nothing, and v1's tables had blank
       cells for layout. Those are layout, not keys. */
    for (const key of IAST_PALETTE.flatMap((g) => g.keys)) {
      expect(key.ch.length, key.name ?? key.ch).toBeGreaterThan(0);
    }
  });

  it('no character is offered twice', () => {
    /* Two keys that insert the same letter is a table nobody trimmed. */
    const all = IAST_PALETTE.flatMap((g) => g.keys).map((k) => k.ch);
    expect(new Set(all).size).toBe(all.length);
  });
});
