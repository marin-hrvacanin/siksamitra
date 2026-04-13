/**
 * transliteration-tables.js — Master phoneme table for all supported scripts.
 *
 * Supported scripts: iast, devanagari, telugu, tamil, itrans
 *
 * Used by:
 *   - keyboard.js (on-screen keyboard display and syllable building)
 *   - (future) editor multi-script support
 *
 * No ES modules — plain global object, consistent with the project's no-bundler policy.
 */

const TransliterationTables = (() => {

    // ─── PHONEME TABLE ─────────────────────────────────────────────────────────
    // Each entry: { iast, devanagari, telugu, tamil, tamilApprox, itrans, type, category }
    // tamil: null = no equivalent; tamilApprox: nearest approximation character
    // type: 'vowel' | 'consonant' | 'special' | 'accent'
    // category: for consonants — 'ka' | 'ca' | 'ta-retroflex' | 'ta-dental' | 'pa' | 'misc' | 'sibilant'

    const PHONEMES = [
        // ── VOWELS ─────────────────────────────────────────────────────────────
        { iast:'a',   devanagari:'अ', telugu:'అ',  tamil:'அ',  tamilApprox:null, itrans:'a',    type:'vowel', category:'vowel' },
        { iast:'ā',   devanagari:'आ', telugu:'ఆ',  tamil:'ஆ',  tamilApprox:null, itrans:'aa',   type:'vowel', category:'vowel' },
        { iast:'i',   devanagari:'इ', telugu:'ఇ',  tamil:'இ',  tamilApprox:null, itrans:'i',    type:'vowel', category:'vowel' },
        { iast:'ī',   devanagari:'ई', telugu:'ఈ',  tamil:'ஈ',  tamilApprox:null, itrans:'ii',   type:'vowel', category:'vowel' },
        { iast:'u',   devanagari:'उ', telugu:'ఉ',  tamil:'உ',  tamilApprox:null, itrans:'u',    type:'vowel', category:'vowel' },
        { iast:'ū',   devanagari:'ऊ', telugu:'ఊ',  tamil:'ஊ',  tamilApprox:null, itrans:'uu',   type:'vowel', category:'vowel' },
        { iast:'ṛ',   devanagari:'ऋ', telugu:'ఋ',  tamil:null, tamilApprox:'ரு', itrans:'R^i',  type:'vowel', category:'vowel' },
        { iast:'ṝ',   devanagari:'ॠ', telugu:'ౠ',  tamil:null, tamilApprox:null, itrans:'R^I',  type:'vowel', category:'vowel' },
        { iast:'ḷ',   devanagari:'ऌ', telugu:'ఌ',  tamil:null, tamilApprox:null, itrans:'L^i',  type:'vowel', category:'vowel' },
        { iast:'ḹ',   devanagari:'ॡ', telugu:'ౡ',  tamil:null, tamilApprox:null, itrans:'L^I',  type:'vowel', category:'vowel' },
        { iast:'e',   devanagari:'ए', telugu:'ఏ',  tamil:'ஏ',  tamilApprox:null, itrans:'e',    type:'vowel', category:'vowel' },
        { iast:'ai',  devanagari:'ऐ', telugu:'ఐ',  tamil:'ஐ',  tamilApprox:null, itrans:'ai',   type:'vowel', category:'vowel' },
        { iast:'o',   devanagari:'ओ', telugu:'ఓ',  tamil:'ஓ',  tamilApprox:null, itrans:'o',    type:'vowel', category:'vowel' },
        { iast:'au',  devanagari:'औ', telugu:'ఔ',  tamil:'ஔ',  tamilApprox:null, itrans:'au',   type:'vowel', category:'vowel' },

        // ── KA-VARGA (velars) ──────────────────────────────────────────────────
        { iast:'k',   devanagari:'क', telugu:'క',  tamil:'க',  tamilApprox:null, itrans:'k',    type:'consonant', category:'ka' },
        { iast:'kh',  devanagari:'ख', telugu:'ఖ',  tamil:null, tamilApprox:'க',  itrans:'kh',   type:'consonant', category:'ka' },
        { iast:'g',   devanagari:'ग', telugu:'గ',  tamil:null, tamilApprox:'க',  itrans:'g',    type:'consonant', category:'ka' },
        { iast:'gh',  devanagari:'घ', telugu:'ఘ',  tamil:null, tamilApprox:'க',  itrans:'gh',   type:'consonant', category:'ka' },
        { iast:'ṅ',   devanagari:'ङ', telugu:'ఙ',  tamil:'ங',  tamilApprox:null, itrans:'N^',   type:'consonant', category:'ka' },

        // ── CA-VARGA (palatals) ────────────────────────────────────────────────
        { iast:'c',   devanagari:'च', telugu:'చ',  tamil:'ச',  tamilApprox:null, itrans:'ch',   type:'consonant', category:'ca' },
        { iast:'ch',  devanagari:'छ', telugu:'ఛ',  tamil:null, tamilApprox:'ச',  itrans:'Ch',   type:'consonant', category:'ca' },
        { iast:'j',   devanagari:'ज', telugu:'జ',  tamil:'ஜ',  tamilApprox:null, itrans:'j',    type:'consonant', category:'ca' },
        { iast:'jh',  devanagari:'झ', telugu:'ఝ',  tamil:null, tamilApprox:'ஜ',  itrans:'jh',   type:'consonant', category:'ca' },
        { iast:'ñ',   devanagari:'ञ', telugu:'ఞ',  tamil:'ஞ',  tamilApprox:null, itrans:'~n',   type:'consonant', category:'ca' },

        // ── ṬA-VARGA (retroflexes) ────────────────────────────────────────────
        { iast:'ṭ',   devanagari:'ट', telugu:'ట',  tamil:'ட',  tamilApprox:null, itrans:'T',    type:'consonant', category:'ta-retroflex' },
        { iast:'ṭh',  devanagari:'ठ', telugu:'ఠ',  tamil:null, tamilApprox:'ட',  itrans:'Th',   type:'consonant', category:'ta-retroflex' },
        { iast:'ḍ',   devanagari:'ड', telugu:'డ',  tamil:null, tamilApprox:'ட',  itrans:'D',    type:'consonant', category:'ta-retroflex' },
        { iast:'ḍh',  devanagari:'ढ', telugu:'ఢ',  tamil:null, tamilApprox:'ட',  itrans:'Dh',   type:'consonant', category:'ta-retroflex' },
        { iast:'ṇ',   devanagari:'ण', telugu:'ణ',  tamil:'ண',  tamilApprox:null, itrans:'N',    type:'consonant', category:'ta-retroflex' },

        // ── TA-VARGA (dentals) ─────────────────────────────────────────────────
        { iast:'t',   devanagari:'त', telugu:'త',  tamil:'த',  tamilApprox:null, itrans:'t',    type:'consonant', category:'ta-dental' },
        { iast:'th',  devanagari:'थ', telugu:'థ',  tamil:null, tamilApprox:'த',  itrans:'th',   type:'consonant', category:'ta-dental' },
        { iast:'d',   devanagari:'द', telugu:'ద',  tamil:null, tamilApprox:'த',  itrans:'d',    type:'consonant', category:'ta-dental' },
        { iast:'dh',  devanagari:'ध', telugu:'ధ',  tamil:null, tamilApprox:'த',  itrans:'dh',   type:'consonant', category:'ta-dental' },
        { iast:'n',   devanagari:'न', telugu:'న',  tamil:'ந',  tamilApprox:null, itrans:'n',    type:'consonant', category:'ta-dental' },

        // ── PA-VARGA (labials) ─────────────────────────────────────────────────
        { iast:'p',   devanagari:'प', telugu:'ప',  tamil:'ப',  tamilApprox:null, itrans:'p',    type:'consonant', category:'pa' },
        { iast:'ph',  devanagari:'फ', telugu:'ఫ',  tamil:null, tamilApprox:'ப',  itrans:'ph',   type:'consonant', category:'pa' },
        { iast:'b',   devanagari:'ब', telugu:'బ',  tamil:null, tamilApprox:'ப',  itrans:'b',    type:'consonant', category:'pa' },
        { iast:'bh',  devanagari:'भ', telugu:'భ',  tamil:null, tamilApprox:'ப',  itrans:'bh',   type:'consonant', category:'pa' },
        { iast:'m',   devanagari:'म', telugu:'మ',  tamil:'ம',  tamilApprox:null, itrans:'m',    type:'consonant', category:'pa' },

        // ── MISC CONSONANTS (semivowels, sibilants, aspirate, retroflex lateral) ─
        { iast:'y',   devanagari:'य', telugu:'య',  tamil:'ய',  tamilApprox:null, itrans:'y',    type:'consonant', category:'misc' },
        { iast:'r',   devanagari:'र', telugu:'ర',  tamil:'ர',  tamilApprox:null, itrans:'r',    type:'consonant', category:'misc' },
        { iast:'l',   devanagari:'ल', telugu:'ల',  tamil:'ல',  tamilApprox:null, itrans:'l',    type:'consonant', category:'misc' },
        { iast:'v',   devanagari:'व', telugu:'వ',  tamil:'வ',  tamilApprox:null, itrans:'v',    type:'consonant', category:'misc' },
        { iast:'ś',   devanagari:'श', telugu:'శ',  tamil:'ஶ',  tamilApprox:null, itrans:'sh',   type:'consonant', category:'sibilant' },
        { iast:'ṣ',   devanagari:'ष', telugu:'ష',  tamil:'ஷ',  tamilApprox:null, itrans:'Sh',   type:'consonant', category:'sibilant' },
        { iast:'s',   devanagari:'स', telugu:'స',  tamil:'ஸ',  tamilApprox:null, itrans:'s',    type:'consonant', category:'sibilant' },
        { iast:'h',   devanagari:'ह', telugu:'హ',  tamil:'ஹ',  tamilApprox:null, itrans:'h',    type:'consonant', category:'misc' },
        { iast:'ḻ',   devanagari:'ळ', telugu:'ళ',  tamil:'ழ',  tamilApprox:null, itrans:'lh',   type:'consonant', category:'misc' },

        // ── SPECIAL / SUPRASEGMENTAL ───────────────────────────────────────────
        { iast:'ṁ',   devanagari:'ं',  telugu:'ం',  tamil:'ஂ',  tamilApprox:null, itrans:'M',    type:'special', category:'special', label:'anusvara' },
        { iast:'ḥ',   devanagari:'ः',  telugu:'ః',  tamil:'ஃ',  tamilApprox:null, itrans:'H',    type:'special', category:'special', label:'visarga' },
        { iast:'\'',  devanagari:'ऽ',  telugu:'ఽ',  tamil:null, tamilApprox:null, itrans:'.a',   type:'special', category:'special', label:'avagraha' },
        { iast:'।',   devanagari:'।',  telugu:'।',  tamil:'।',  tamilApprox:null, itrans:'|',    type:'special', category:'special', label:'danda' },
        { iast:'॥',   devanagari:'॥',  telugu:'॥',  tamil:'॥',  tamilApprox:null, itrans:'||',   type:'special', category:'special', label:'double danda' },
    ];

    // ─── VOWEL SIGN TABLE (mātrās) ─────────────────────────────────────────────
    // Used by convertSyllable() — consonant + vowel sign (not independent vowel form)
    const VOWEL_SIGNS = [
        { iast:'a',  devanagari:'',   telugu:'',   tamil:'',   itrans:'a'   },  // inherent 'a' — no sign
        { iast:'ā',  devanagari:'ा',  telugu:'ా',  tamil:'ா',  itrans:'aa'  },
        { iast:'i',  devanagari:'ि',  telugu:'ి',  tamil:'ி',  itrans:'i'   },
        { iast:'ī',  devanagari:'ी',  telugu:'ీ',  tamil:'ீ',  itrans:'ii'  },
        { iast:'u',  devanagari:'ु',  telugu:'ు',  tamil:'ு',  itrans:'u'   },
        { iast:'ū',  devanagari:'ू',  telugu:'ూ',  tamil:'ூ',  itrans:'uu'  },
        { iast:'ṛ',  devanagari:'ृ',  telugu:'ృ',  tamil:null, itrans:'R^i' },
        { iast:'ṝ',  devanagari:'ॄ',  telugu:'ౄ',  tamil:null, itrans:'R^I' },
        { iast:'ḷ',  devanagari:'ॢ',  telugu:'ౢ',  tamil:null, itrans:'L^i' },
        { iast:'ḹ',  devanagari:'ॣ',  telugu:'ౣ',  tamil:null, itrans:'L^I' },
        { iast:'e',  devanagari:'े',  telugu:'ే',  tamil:'ே',  itrans:'e'   },
        { iast:'ai', devanagari:'ै',  telugu:'ై',  tamil:'ை',  itrans:'ai'  },
        { iast:'o',  devanagari:'ो',  telugu:'ో',  tamil:'ோ',  itrans:'o'   },
        { iast:'au', devanagari:'ौ',  telugu:'ౌ',  tamil:'ௌ',  itrans:'au'  },
    ];

    // Virama (halanta) per script — suppresses inherent 'a' on a consonant
    const VIRAMA = {
        devanagari: '्',
        telugu:     '్',
        tamil:      '்',
        iast:       '',      // IAST: bare consonant = no vowel appended
        itrans:     '',      // ITRANS: same
    };

    // ─── ACCENT MARKS ─────────────────────────────────────────────────────────
    // These are Unicode combining marks — same code point in all scripts
    const ACCENT_MARKS = [
        { iast: '\u0331', label: 'anudātta',  itrans: '_A', description: 'low pitch (macron below)' },
        { iast: '\u030D', label: 'svarita',   itrans: '_S', description: 'high pitch (vertical line above)' },
        { iast: '\u030E', label: 'udātta',    itrans: '_U', description: 'extra-high pitch (double line above)' },
        { iast: '\u0310', label: 'candrabindu', itrans: '.m', description: 'nasalization (candrabindu)' },
    ];

    // ─── FAST LOOKUPS ─────────────────────────────────────────────────────────
    // Build maps for O(1) access
    const _byIAST = new Map();
    for (const p of PHONEMES) _byIAST.set(p.iast, p);

    const _vowelSignByIAST = new Map();
    for (const s of VOWEL_SIGNS) _vowelSignByIAST.set(s.iast, s);

    // Consonant IAST values as a Set for quick type checks
    const CONSONANTS = new Set(
        PHONEMES.filter(p => p.type === 'consonant').map(p => p.iast)
    );
    const VOWELS = new Set(
        PHONEMES.filter(p => p.type === 'vowel').map(p => p.iast)
    );

    // ─── PUBLIC API ────────────────────────────────────────────────────────────

    /**
     * Convert a single IAST phoneme to the target script.
     * Returns null if no equivalent exists in that script.
     * For Tamil approximations, returns the approx character (use hasEquivalent() to check).
     */
    function convert(iastChar, toScript) {
        if (toScript === 'iast') return iastChar;

        // Accent marks pass through unchanged in all scripts
        for (const a of ACCENT_MARKS) {
            if (a.iast === iastChar) return iastChar;
        }

        const p = _byIAST.get(iastChar);
        if (!p) return null;

        if (toScript === 'itrans') return p.itrans || null;

        const val = p[toScript];
        // For Tamil with no equiv, return the approximation (may also be null)
        if (val === null && toScript === 'tamil') return p.tamilApprox || null;
        return val || null;
    }

    /**
     * Returns true if the character has a proper equivalent (not just an approximation).
     */
    function hasEquivalent(iastChar, toScript) {
        if (toScript === 'iast') return true;
        const p = _byIAST.get(iastChar);
        if (!p) return false;
        if (toScript === 'itrans') return !!p.itrans;
        return p[toScript] !== null && p[toScript] !== undefined;
    }

    /**
     * Get the approximation character used when no equivalent exists.
     * Returns null if no approximation is defined.
     */
    function getApproximation(iastChar, toScript) {
        if (toScript !== 'tamil') return null;
        const p = _byIAST.get(iastChar);
        return p ? (p.tamilApprox || null) : null;
    }

    /**
     * Build a consonant+vowel syllable in the target script.
     * Uses the vowel sign (mātrā) form, not the independent vowel form.
     * Returns null if the combination cannot be represented.
     *
     * Examples (script='devanagari'):
     *   convertSyllable('k', 'a', 'devanagari')  → 'क'  (inherent a, no sign)
     *   convertSyllable('k', 'ā', 'devanagari')  → 'का'
     *   convertSyllable('k', 'i', 'devanagari')  → 'कि'
     */
    function convertSyllable(consonantIAST, vowelIAST, toScript) {
        if (toScript === 'iast') {
            return consonantIAST + vowelIAST;
        }
        if (toScript === 'itrans') {
            const cp = _byIAST.get(consonantIAST);
            const vp = _byIAST.get(vowelIAST);
            if (!cp || !vp) return null;
            return (cp.itrans || consonantIAST) + (vp.itrans || vowelIAST);
        }

        const cp = _byIAST.get(consonantIAST);
        if (!cp) return null;
        const baseChar = cp[toScript] || (toScript === 'tamil' ? cp.tamilApprox : null);
        if (!baseChar) return null;

        const signEntry = _vowelSignByIAST.get(vowelIAST);
        if (!signEntry) return null;

        const sign = signEntry[toScript];
        if (sign === null || sign === undefined) {
            // No vowel sign in this script — fall back to IAST label
            return null;
        }

        // sign === '' means inherent 'a' — just the base consonant character
        return baseChar + sign;
    }

    /**
     * Build a bare consonant (consonant + virama) in the target script.
     * In IAST, this is just the consonant string.
     */
    function convertBareConsonant(consonantIAST, toScript) {
        if (toScript === 'iast') return consonantIAST;
        if (toScript === 'itrans') {
            const p = _byIAST.get(consonantIAST);
            return p ? (p.itrans || consonantIAST) : consonantIAST;
        }

        const cp = _byIAST.get(consonantIAST);
        if (!cp) return null;
        const base = cp[toScript] || (toScript === 'tamil' ? cp.tamilApprox : null);
        if (!base) return null;

        const virama = VIRAMA[toScript] || '';
        return base + virama;
    }

    /**
     * Convert a full IAST string to the target script character by character.
     * Handles multi-char IAST tokens (kh, gh, ch, jh, ṭh, ḍh, th, dh, ph, bh, ai, au).
     * Returns the converted string.
     */
    function convertString(iastText, toScript) {
        if (toScript === 'iast') return iastText;
        let result = '';
        let i = 0;
        const TWO_CHAR = new Set(['kh','gh','ch','jh','ṭh','ḍh','th','dh','ph','bh','ai','au','R^','L^']);

        while (i < iastText.length) {
            // Try 3-char tokens first (R^i, R^I, L^i, L^I)
            const three = iastText.slice(i, i + 3);
            if (_byIAST.has(three)) {
                result += convert(three, toScript) || three;
                i += 3;
                continue;
            }
            // Try 2-char tokens
            const two = iastText.slice(i, i + 2);
            if (_byIAST.has(two)) {
                result += convert(two, toScript) || two;
                i += 2;
                continue;
            }
            // Single char
            const one = iastText[i];
            result += convert(one, toScript) || one;
            i++;
        }
        return result;
    }

    /**
     * Get display name for a script identifier.
     */
    function scriptName(script) {
        return { iast:'IAST', devanagari:'Devanagari', telugu:'Telugu', tamil:'Tamil', itrans:'ITRANS' }[script] || script;
    }

    /**
     * Get all phonemes of a given type.
     */
    function getByType(type) {
        return PHONEMES.filter(p => p.type === type);
    }

    return {
        PHONEMES,
        VOWEL_SIGNS,
        VIRAMA,
        ACCENT_MARKS,
        CONSONANTS,
        VOWELS,
        SCRIPTS: ['iast', 'devanagari', 'telugu', 'tamil', 'itrans'],

        convert,
        hasEquivalent,
        getApproximation,
        convertSyllable,
        convertBareConsonant,
        convertString,
        scriptName,
        getByType,
    };
})();
