/**
 * Sanskrit grammatical rules for automatic text processing
 * Ported from śikṣāmitra.pyw
 */

class SanskritRules {
    constructor() {
        // Consonant groups
        this.SKIP_CONSONANTS = new Set(['ṅ', 'ñ', 'ṇ', 'n', 'm', 'ṁ', 'ṃ', 'r', 'ś', 'ṣ', 's']);
        
        this.ALL_CONSONANTS = new Set([
            'k', 'kh', 'g', 'gh', 'ṅ',
            'c', 'ch', 'j', 'jh', 'ñ',
            'ṭ', 'ṭh', 'ḍ', 'ḍh', 'ṇ',
            't', 'th', 'd', 'dh', 'n',
            'p', 'ph', 'b', 'bh', 'm',
            'y', 'r', 'l', 'ḻ', 'v',
            'ś', 'ṣ', 's', 'h',
            'ḥ', 'ṁ', 'ṃ'
        ]);
        
        // Vowels
        this.SHORT_VOWELS = new Set(['a', 'i', 'u', 'ṛ', 'ḷ']);
        this.LONG_VOWELS = new Set(['ā', 'ī', 'ū', 'ṝ', 'ḹ', 'e', 'ai', 'o', 'au']);
        this.VOWELS = new Set([...this.SHORT_VOWELS, ...this.LONG_VOWELS]);
        
        // Svara marks
        this.SVARA_MARKS = new Set([
            '\u0331', '\u030d', '\u030e', '\u02ce', '·'
        ]);
        
        // Two-character consonants (order matters - check longer ones first)
        this.TWO_CHAR_CONSONANTS = ['kh', 'gh', 'ch', 'jh', 'ṭh', 'ḍh', 'th', 'dh', 'ph', 'bh'];
        this.TWO_CHAR_VOWELS = ['ai', 'au', 'ṝ', 'ḹ'];

        // Consonant groupings for nasal assimilation
        this.CONSONANT_GROUPS = {
            'ṅ': new Set(['k', 'kh', 'g', 'gh']),
            'ñ': new Set(['c', 'ch', 'j', 'jh']),
            'ṇ': new Set(['ṭ', 'ṭh', 'ḍ', 'ḍh']),
            'n': new Set(['t', 'th', 'd', 'dh']),
            'm': new Set(['p', 'ph', 'b', 'bh'])
        };

        // Special handling collections for anusvara rules
        this.SPECIAL_SEQUENCES = new Set(['jñ', 'ghn']);
        this.SPECIAL_NON_VOWELS = new Set(['ś', 'ṣ', 's', 'h']);
        this.ADDITIONAL_SPECIAL_NON_VOWELS = new Set(['r']);
        this.NON_VOWELS = new Set([
            'k', 'kh', 'g', 'gh', 'c', 'ch', 'j', 'jh',
            'ṭ', 'ṭh', 'ḍ', 'ḍh', 't', 'th', 'd', 'dh',
            'p', 'ph', 'b', 'bh', 'm', 'y', 'r', 'l', 'v',
            'ś', 'ṣ', 's', 'h'
        ]);
        // Retroflex lateral (ळ) transliterates to ḻ; treat it as a consonant/non-vowel.
        this.NON_VOWELS.add('ḻ');
        this.BASIC_SHORT_VOWELS = new Set(['a', 'i', 'u']);
        this.VISARGA_GROUPS = {
            'ś': new Set(['c', 'ch']),
            'ṣ': new Set(['ṭ', 'ṭh']),
            's': new Set(['t', 'th'])
        };
        this.VISARGA_SPECIAL_SEQUENCE = new Set(['kṣ']);
        this.SIBILANTS = new Set(['ś', 'ṣ', 's']);
        this.VOICED_CONSONANTS = new Set(['g', 'gh', 'j', 'jh', 'ḍ', 'ḍh', 'd', 'dh', 'b', 'bh', 'm']);
        this.ADVAYA = new Set(['a', 'ā']);
        
        // Svarabhakti triggers
        this.SVARABHAKTI_TRIGGERS = new Set(['s', 'ś', 'ṣ', 'h', 'ṛ']);

        // Bīja mantras — sacred seed syllables that should not be transformed.
        // Each ends with ṁ which should remain as-is (no anusvara conversion).
        // A short pause is added after the bīja when followed by a word.
        this.BIJA_MANTRAS = new Set([
            'oṁ', 'auṁ',
            'hrīṁ', 'śrīṁ', 'klīṁ', 'aiṁ', 'sauṁ',
            'krīṁ', 'hlīṁ', 'strīṁ', 'blūṁ', 'glauṁ',
            'hauṁ', 'huṁ', 'phaṭ', 'dūṁ', 'gaṁ',
            'drāṁ', 'grīṁ', 'kṣrauṁ',
        ]);
    }
    
    /**
     * Check if a character (or two-character sequence) is a consonant
     */
    isConsonant(text, pos) {
        if (pos >= text.length) return false;
        
        // Check two-character consonant FIRST (must check longer sequences before shorter)
        // Only check valid two-character consonants (aspirated consonants)
        if (pos + 1 < text.length) {
            const twoChar = text.substring(pos, pos + 2);
            // Only these are valid two-character consonants in IAST
            if (this.TWO_CHAR_CONSONANTS.includes(twoChar)) {
                return twoChar;
            }
        }
        
        // Check single character
        if (this.ALL_CONSONANTS.has(text[pos])) {
            return text[pos];
        }
        
        return null;
    }
    
    /**
     * Check if a character (or two-character sequence) is a vowel
     */
    isVowel(text, pos) {
        if (pos >= text.length) return false;
        
        // Check two-character vowel
        if (pos + 1 < text.length) {
            const twoChar = text.substring(pos, pos + 2);
            if (this.VOWELS.has(twoChar)) {
                return twoChar;
            }
        }
        
        // Check single character
        if (this.VOWELS.has(text[pos])) {
            return text[pos];
        }
        
        return null;
    }
    
    /**
     * Check if character is a svara mark
     */
    isSvaraMark(char) {
        return this.SVARA_MARKS.has(char);
    }
}

class SanskritProcessor {
    constructor() {
        this.rules = new SanskritRules();
        this.source = null;
    }
    
    /**
     * Pre-process raw text to standardize characters
     * Ported from pre_process_raw_text in śikṣāmitra.pyw
     */
    preProcessRawText(text) {
        if (typeof text !== 'string') {
            text = text == null ? '' : String(text);
        }

        text = text.toLowerCase();

        // Standardize tone marks
        text = text.replace(/\u0951/g, '\u030d'); // svarita
        text = text.replace(/\u0952/g, '\u0331'); // anudatta
        text = text.replace(/\u0332/g, '\u0331'); // anudatta variant
        text = text.replace(/\u0320/g, '\u0331'); // anudatta variant
        text = text.replace(/\u0321/g, '\u0331'); // anudatta variant
        text = text.replace(/\u1CDA/g, '\u030e'); // udatta
        text = text.replace(/\u0341/g, '\u030e'); // udatta variant
        
        // Standardize anusvara and visarga
        text = text.replace(/ṃ/g, 'ṁ');
        text = text.replace(/\uA8F3/g, 'ṁ');  // Vedic tiryak (ꣳ) → anusvara
        text = text.replace(/ō/g, 'o');
        text = text.replace(/ē/g, 'e');
        
        // Normalize special sequences
        text = text.replace(/\(g\)m/g, 'ṁ');
        text = text.replace(/\(g\)ṁ/g, 'ṁ');
        text = text.replace(/\(g̱\)ṁ/g, 'ṁ');
        text = text.replace(/\(g̱\)m/g, 'ṁ');

        // Normalize danda punctuation
        text = text.replace(/\.\s*\./g, '॥');
        text = text.replace(/\./g, '।');
        
        return text;
    }

    /**
     * Determine if the character is a combining mark (used for svara/accent)
     */
    isCombiningMark(char) {
        if (!char) return false;
        return /[\u0300-\u036f]/.test(char);
    }

    isCandrabinduSuperscriptChar(text, index) {
        if (!text || index < 0 || index >= text.length) {
            return false;
        }

        const ch = text[index];
        const combiningCandrabindu = '\u0310';

        if (ch === 'g') {
            return index >= 2 && text[index - 1] === combiningCandrabindu && text[index - 2] === 'm';
        }

        if (ch === 'ṁ') {
            return index >= 3 && text[index - 1] === 'g' && text[index - 2] === combiningCandrabindu && text[index - 3] === 'm';
        }

        if (ch === 'm') {
            return index + 1 < text.length && text[index + 1] === combiningCandrabindu;
        }

        return false;
    }

    isAnnotationCharacter(text, index) {
        if (!text || index < 0 || index >= text.length) {
            return false;
        }

        const ch = text[index];
        const combiningCandrabindu = '\u0310';

        // Treat combining candrabindu as annotation-only marker
        if (ch === '\u0310') {
            return true;
        }

        if (this.isCandrabinduSuperscriptChar(text, index)) {
            return true;
        }

        if (ch === 'm' && index + 1 < text.length && text[index + 1] === combiningCandrabindu) {
            return true;
        }

        return false;
    }

    normalizeAnusvaraAnnotations(text) {
        if (!text || !text.length) {
            return text;
        }

        const combiningCandrabindu = '\u0310';
        let result = '';

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (ch === 'm' && i + 1 < text.length && text[i + 1] === combiningCandrabindu) {
                // For Ṛgveda, never convert candrabindu ↔ anusvara.
                // If the source is rigveda, preserve the original candrabindu (m̐) but still
                // strip any superscript g-annotations that may follow from a previous run.
                if (this.source === 'rigveda') {
                    result += 'm' + combiningCandrabindu;
                } else {
                    result += 'ṁ';
                }

                // Skip annotation markers that are typically rendered as Vedic anusvara patterns:
                // - m̐g
                // - m̐gg
                // - m̐gṁ
                let j = i + 2;
                let skippedGs = 0;
                while (j < text.length && text[j] === 'g' && skippedGs < 2) {
                    j++;
                    skippedGs++;
                }

                if (skippedGs > 0 && j < text.length && text[j] === 'ṁ') {
                    j++;
                }

                i = j - 1;
                continue;
            }

            if (ch === combiningCandrabindu) {
                continue;
            }

            if (this.isCandrabinduSuperscriptChar(text, i)) {
                continue;
            }

            result += ch;
        }

        return result;
    }

    /**
     * Find the next letter (non-space, non-mark) after a given position
     * Returns { letter, index }
     */
    findNextLetterInfo(text, pos) {
        let i = pos + 1;
        // console.log(`[DEBUG] findNextLetterInfo starting at ${pos} (char: '${text[pos]}')`);
        while (i < text.length) {
            const ch = text[i];
            // Skip ZWJ, ZWNJ, and other format characters
            if (/[\u200B-\u200D\uFEFF]/.test(ch)) {
                // console.log(`[DEBUG] Skipping format char at ${i}`);
                i++;
                continue;
            }

            const isMark = this.isCombiningMark(ch);
            const isSvara = this.rules.isSvaraMark(ch);
            const isAnnotation = this.isAnnotationCharacter(text, i);
            
            // console.log(`[DEBUG] Checking char at ${i}: '${ch}' (code: ${ch.charCodeAt(0)}). Mark: ${isMark}, Svara: ${isSvara}, Annotation: ${isAnnotation}`);

            if (ch && ch.trim() && !isMark && !isSvara && ch !== '\n' && !isAnnotation) {
                // console.log(`[DEBUG] Found next letter: '${ch}' at ${i}`);
                return { letter: ch, index: i };
            }
            i++;
        }
        // console.log(`[DEBUG] No next letter found`);
        return { letter: '', index: -1 };
    }

    /**
     * Convenience wrapper returning only the next letter
     */
    findNextLetter(text, pos) {
        return this.findNextLetterInfo(text, pos).letter;
    }

    /**
     * Find the previous letter (non-space, non-mark) before a given position
     */
    findPreviousLetter(text, pos) {
        let i = pos - 1;
        while (i >= 0) {
            const ch = text[i];
            if (ch && ch.trim() && !this.isCombiningMark(ch) && !this.rules.isSvaraMark(ch) && ch !== '\n' && !this.isAnnotationCharacter(text, i)) {
                return ch;
            }
            i--;
        }
        return '';
    }
    
    /**
     * Find the previous vowel before a given position
     * Returns: {vowel: string, blocked: boolean, position: number}
     */
    findPreviousVowel(text, pos, blockAtSpace = true) {
        let i = pos - 1;
        while (i >= 0) {
            // Skip pause marks
            if (text[i] === '|') {
                i--;
                continue;
            }
            
            // Skip svara marks
            if (this.rules.isSvaraMark(text[i])) {
                i--;
                continue;
            }
            
            if (text[i].match(/\s/) && blockAtSpace) {
                return { vowel: '', blocked: true, position: -1 };
            }
            
            // Check for anusvara or visarga (treated like vowels for holdings)
            if ((text[i] === 'ṁ' && !this.isCandrabinduSuperscriptChar(text, i)) || text[i] === 'ṃ' || text[i] === 'ḥ') {
                return { vowel: text[i], blocked: false, position: i };
            }
            
            const vowel = this.rules.isVowel(text, i);
            if (vowel && !this.isAnnotationCharacter(text, i)) {
                return { vowel: vowel, blocked: false, position: i };
            }
            
            i--;
        }
        return { vowel: '', blocked: false, position: -1 };
    }
    
    /**
     * Collect samyukta components starting at the given position
     * Components capture consonant value, index, length, and word-boundary metadata
     */
    collectSamyukta(text, pos) {
        const components = [];
        let pointer = pos;
        let boundaryBeforeCurrent = false;
        let wordIndex = 0;
        const combiningCandrabindu = '\u0310';

        while (pointer < text.length) {
            // Skip annotation characters before checking for consonants
            if (this.isAnnotationCharacter(text, pointer)) {
                pointer++;
                continue;
            }

            const consonant = this.rules.isConsonant(text, pointer);
            if (!consonant) break;

            // Skip m̐ (m + candrabindu) entirely - it's an annotation
            if (consonant === 'm' && pointer + consonant.length < text.length && text[pointer + consonant.length] === combiningCandrabindu) {
                pointer += consonant.length + 1; // Skip both 'm' and candrabindu
                continue;
            }

            // Skip superscript annotations (g and ṁ in m̐gṁ)
            if (this.isCandrabinduSuperscriptChar(text, pointer)) {
                pointer += consonant.length;
                continue;
            }

            components.push({
                value: consonant,
                index: pointer,
                length: consonant.length,
                wordBoundaryBefore: boundaryBeforeCurrent,
                wordIndex
            });

            pointer += consonant.length;

            // Skip svara/combining marks and annotation characters immediately after the consonant
            while (pointer < text.length && (this.rules.isSvaraMark(text[pointer]) || this.isCombiningMark(text[pointer]) || this.isAnnotationCharacter(text, pointer))) {
                pointer++;
            }

            let temp = pointer;
            let sawWhitespace = false;

            // Capture whitespace (word boundary) and additional combining marks between consonants
            while (temp < text.length) {
                const ch = text[temp];
                if (ch === '|') {
                    // Pause mark stops the samyukta
                    return { components, nextIndex: pointer };
                }
                if (/\s/.test(ch)) {
                    sawWhitespace = true;
                    temp++;
                    continue;
                }
                if (this.rules.isSvaraMark(ch) || this.isCombiningMark(ch) || this.isAnnotationCharacter(text, temp)) {
                    temp++;
                    continue;
                }
                break;
            }

            const nextConsonant = this.rules.isConsonant(text, temp);
            if (!nextConsonant) {
                pointer = temp;
                break;
            }

            pointer = temp;
            boundaryBeforeCurrent = sawWhitespace;
            if (sawWhitespace) {
                wordIndex += 1;
            }
        }

        return { components, nextIndex: pointer };
    }

    /**
     * Decide which component inside a samyukta receives the holding
     */
    selectHoldingComponent(components) {
        if (!components || components.length < 2) {
            return -1;
        }

        // Dvivarcana: identical consecutive consonants → holding on the first of the pair
        for (let i = 0; i < components.length - 1; i++) {
            if (components[i].value === components[i + 1].value) {
                return i;
            }
        }

        // Cross-word samyuktas: choose the first consonant of the second word
            const crossWordIndex = components.findIndex(comp => comp.wordBoundaryBefore);
            let candidate = crossWordIndex !== -1 ? crossWordIndex : 0;

            // Skip leading consonants that cannot host a holding
            while (candidate < components.length) {
                const comp = components[candidate];
                const skipForValue = this.rules.SKIP_CONSONANTS.has(comp.value);
                const allowDueToBoundary = comp.wordBoundaryBefore && this.rules.SIBILANTS.has(comp.value);

                if (!skipForValue || allowDueToBoundary) {
                    break;
                }
                candidate++;
            }

        if (candidate >= components.length) {
            candidate = components.length - 1;
        }

        return candidate;
    }

    /**
     * Find where holding should be placed.
     * Returns { position, length, type, nextIndex }
     */
    findHoldingPosition(text, pos) {
        const consonant = this.rules.isConsonant(text, pos);
        if (!consonant) {
            return { position: -1, length: 0, type: '', nextIndex: pos + 1 };
        }

        const { components, nextIndex } = this.collectSamyukta(text, pos);
        if (!components || components.length < 2) {
            return { position: -1, length: 0, type: '', nextIndex: pos + consonant.length };
        }

        const componentIndex = this.selectHoldingComponent(components);
        if (componentIndex < 0) {
            return { position: -1, length: 0, type: '', nextIndex };
        }

        const target = components[componentIndex];
        const skipMarks = new Set(['ṁ', 'ṃ', 'ḥ']);

        const resolveVowelInfo = (startIndex) => {
            let info = this.findPreviousVowel(text, startIndex);

            if (info.blocked) {
                info = this.findPreviousVowel(text, startIndex, false);
            }

            while (info && info.vowel && skipMarks.has(info.vowel)) {
                info = this.findPreviousVowel(text, info.position, false);
            }

            return info;
        };

        const vowelInfo = resolveVowelInfo(target.index) || { vowel: '' };
        const vowel = vowelInfo.vowel;
        const type = vowel && this.rules.LONG_VOWELS.has(vowel) ? 'long' : 'short';

        return {
            position: target.index,
            length: target.length,
            type,
            nextIndex
        };
    }
    
    /**
     * Apply holdings automatically to the entire text
     * Returns array of holdings: [{position, length, type}]
     */
    findAllHoldings(text) {
        const holdings = [];
        let i = 0;
        
        while (i < text.length) {
            if (this.isAnnotationCharacter(text, i)) {
                i++;
                continue;
            }

            // Skip pause marks
            if (text[i] === '|') {
                i++;
                continue;
            }
            
            const consonant = this.rules.isConsonant(text, i);
            if (consonant) {
                const holding = this.findHoldingPosition(text, i);
                if (holding.position >= 0 && holding.length > 0) {
                    holdings.push(holding);
                    i = holding.nextIndex !== undefined ? holding.nextIndex : holding.position + holding.length;
                } else {
                    i = holding.nextIndex !== undefined ? holding.nextIndex : i + consonant.length;
                }
            } else if (this.rules.isSvaraMark(text[i])) {
                i++;
            } else {
                i++;
            }
        }
        
        return holdings;
    }

    /**
     * Apply Śikṣā-based anusvara transformations
     * Returns replacements array: [{ index, replacement, changed }]
     */
    applyAnusvaraTransformations(text) {
        const replacements = [];
        if (!text) {
            return { replacements };
        }

        const makePart = (text, superscript = false, applyChangeStyle = true) => ({ text, superscript, applyChangeStyle });
        const candrabinduParts = () => [
            makePart('m'),
            makePart('\u0310')
        ];

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Ṛgveda: also detect candrabindu (m + U+0310) so we can apply change-style
            // in special cases without converting between anusvara and candrabindu.
            const isCandrabindu = this.source === 'rigveda' && char === 'm' && i + 1 < text.length && text[i + 1] === '\u0310';
            if (isCandrabindu) {
                const nextInfo = this.findNextLetterInfo(text, i + 1);
                const next = nextInfo.letter || '';
                const isSpecial = next && (
                    this.rules.SPECIAL_NON_VOWELS.has(next) ||
                    this.rules.ADDITIONAL_SPECIAL_NON_VOWELS.has(next)
                );

                if (isSpecial) {
                    replacements.push({
                        index: i,
                        deleteCount: 2,
                        parts: [...candrabinduParts()],
                        changed: true
                    });
                }

                i++; // skip the combining candrabindu
                continue;
            }

            if (this.isCandrabinduSuperscriptChar(text, i)) {
                continue;
            }
            if (char !== 'ṁ' && char !== 'ṃ') {
                continue;
            }

            // Skip bīja mantras: if this ṁ is at the end of a bīja mantra
            // at the beginning of a line, don't transform it.
            if (this.skipBija) {
                let lineStart = text.lastIndexOf('\n', i - 1) + 1;
                const beforeṁ = text.substring(lineStart, i + 1).trim().toLowerCase();
                if (this.rules.BIJA_MANTRAS.has(beforeṁ)) {
                    continue;
                }
            }

            const prev = this.findPreviousLetter(text, i) || '';
            const nextInfo = this.findNextLetterInfo(text, i);
            const next = nextInfo.letter || '';
            const nextAfterInfo = nextInfo.index >= 0 ? this.findNextLetterInfo(text, nextInfo.index) : { letter: '', index: -1 };
            const nextAfter = nextAfterInfo.letter || '';
            const nextAfterAfterInfo = nextAfterInfo.index >= 0 ? this.findNextLetterInfo(text, nextAfterInfo.index) : { letter: '', index: -1 };
            const nextAfterAfter = nextAfterAfterInfo.letter || '';

            const combinedNextTwo = next && nextAfter ? next + nextAfter : '';
            const combinedNextThree = combinedNextTwo && nextAfterAfter ? combinedNextTwo + nextAfterAfter : '';
            const nextCluster = nextInfo.index >= 0 ? text.slice(nextInfo.index, nextInfo.index + 2) : '';

            let parts = null;
            
            // Check source type to determine rules
            if (this.source === 'yajurveda' || this.source === 'kṛṣṇayajurveda') {
                const isKrsnaYajurveda = this.source === 'kṛṣṇayajurveda';
                const isSpecial = next && (
                    this.rules.SPECIAL_NON_VOWELS.has(next) ||
                    this.rules.ADDITIONAL_SPECIAL_NON_VOWELS.has(next)
                );
                const hasImmediateConsonantAfterSpecial = Boolean(
                    isSpecial && nextAfter && this.rules.NON_VOWELS.has(nextAfter)
                );
                const prevIsBasicShort = prev && this.rules.BASIC_SHORT_VOWELS.has(prev);

                if ((combinedNextThree && this.rules.SPECIAL_SEQUENCES.has(combinedNextThree)) ||
                    (combinedNextTwo && this.rules.SPECIAL_SEQUENCES.has(combinedNextTwo))) {
                    // Highlight only; parts remain null
                } else if (isSpecial) {
                    // Yajurveda special handling:
                    // - Before ś/ṣ/s/h/r: m̐[gṁ]
                    // - Before ś/ṣ/s/h/r + consonant (lupta-āgama): m̐[g]
                    // - If lupta-āgama and previous vowel is a/i/u: m̐[gg]
                    if (hasImmediateConsonantAfterSpecial) {
                        parts = [...candrabinduParts(), makePart('g', true)];
                        if (prevIsBasicShort) {
                            parts.push(makePart('g', true));
                        }
                    } else {
                        parts = [...candrabinduParts(), makePart('g', true), makePart('ṁ', true)];
                    }
                } else if (next === 'v') {
                    parts = [makePart('ṁ'), makePart('u', true)];
                } else if (next === 'l') {
                    parts = [makePart('ṁ'), makePart('l', true)];
                } else if (next === 'y') {
                    parts = [makePart('ṁ'), makePart('i', true)];
                } else {
                    for (const [nasal, group] of Object.entries(this.rules.CONSONANT_GROUPS)) {
                        if ((next && group.has(next)) || (nextCluster && group.has(nextCluster)) || next === nasal) {
                            parts = [makePart(nasal)];
                            break;
                        }
                    }
                }
            } else if (this.source === 'rigveda') {
                // Ṛgveda rules:
                // - Keep nasalized superscripts (ṁ[u], ṁ[l], ṁ[i]) before v/l/y like Yajurveda.
                // - BUT in the special ś/ṣ/s/h/r cases, do NOT generate m̐[gṁ]/m̐[g]/m̐[gg].
                //   Instead preserve the original mark type (anusvara vs candrabindu):
                //   - if original is anusvara, keep it as-is (change-style)
                //   - if original is candrabindu, keep it as-is (change-style)

                const isSpecial = next && (
                    this.rules.SPECIAL_NON_VOWELS.has(next) ||
                    this.rules.ADDITIONAL_SPECIAL_NON_VOWELS.has(next)
                );

                if (isSpecial) {
                    parts = [makePart(char)];
                } else if (next === 'v') {
                    parts = [makePart(char), makePart('u', true)];
                } else if (next === 'l') {
                    parts = [makePart(char), makePart('l', true)];
                } else if (next === 'y') {
                    parts = [makePart(char), makePart('i', true)];
                } else {
                    // Default: keep ṁ and highlight (no Vedic g-forms)
                    parts = [makePart(char)];
                }
            } else {
                // Smṛti / Default rules
                // Currently just highlights the anusvara
                parts = [makePart('ṁ')];
            }

            if (parts && parts.length === 1 && parts[0].text === 'ṁ') {
                // Even if it's just 'ṁ', we want to return it to trigger change-style
                // This handles the non-Vedic case where we just want to highlight the anusvara
            } else if (!parts) {
                // If no special parts were generated (e.g. non-Vedic source), 
                // explicitly set parts to just 'ṁ' to ensure it gets highlighted
                parts = [makePart('ṁ')];
            }

            replacements.push({
                index: i,
                deleteCount: 1,
                parts: parts || undefined,
                changed: Boolean(parts && parts.length)
            });
        }

        return { replacements };
    }

    /**
     * Apply Svarabhakti rules: insert '·' after 'r' if followed by s, ś, ṣ, h, or ṛ
     * Returns replacements array
     */
    applySvarabhaktiTransformations(text) {
        const replacements = [];
        if (!text) {
            return { replacements };
        }

        const makePart = (t, formats = {}) => ({ text: t, formats });

        for (let i = 0; i < text.length - 1; i++) {
            if (text[i] !== 'r') {
                continue;
            }

            // Find the next actual letter, skipping combining marks
            const nextInfo = this.findNextLetterInfo(text, i);
            const nextChar = nextInfo.letter;
            
            console.log(`[Svarabhakti] Found 'r' at ${i}. Next char: '${nextChar}' (code: ${nextChar ? nextChar.charCodeAt(0) : 'N/A'}) at ${nextInfo.index}`);

            if (this.rules.SVARABHAKTI_TRIGGERS.has(nextChar)) {
                // Check if '·' is already present between 'r' and the next char
                let alreadyHasSvarabhakti = false;
                let checkPos = i + 1;
                while (checkPos < nextInfo.index) {
                    if (text[checkPos] === '·') {
                        alreadyHasSvarabhakti = true;
                        break;
                    }
                    checkPos++;
                }
                
                if (alreadyHasSvarabhakti) {
                    // console.log(`[Svarabhakti] Already has mark, skipping.`);
                    continue;
                }

                // Calculate insertion position: after 'r' and its combining marks
                let insertPos = i + 1;
                while (insertPos < text.length && (this.isCombiningMark(text[insertPos]) || this.rules.isSvaraMark(text[insertPos]))) {
                    if (text[insertPos] === '·') {
                        alreadyHasSvarabhakti = true;
                        break;
                    }
                    insertPos++;
                }

                if (alreadyHasSvarabhakti) {
                    continue;
                }

                // console.log(`[Svarabhakti] Inserting at ${insertPos}`);

                // Insert '·' after 'r' (and its marks)
                replacements.push({
                    index: insertPos,
                    deleteCount: 0,
                    parts: [makePart('·', { 'svara-char': true })],
                    changed: true
                });
            }
        }

        return { replacements };
    }

    /**
     * Apply Śikṣā-based visarga transformations
     * Returns replacements array: [{ index, deleteCount, parts, changed }]
     */
    applyVisargaTransformations(text) {
        const replacements = [];
        if (!text) {
            return { replacements };
        }

        const makePart = (t, superscript = false, applyChangeStyle = true) => ({ text: t, superscript, applyChangeStyle });

        for (let i = 0; i < text.length; i++) {
            if (text[i] !== 'ḥ') {
                continue;
            }

            const prev = this.findPreviousLetter(text, i) || '';
            const nextInfo = this.findNextLetterInfo(text, i);
            const next = nextInfo.letter || '';
            const nextAfterInfo = nextInfo.index >= 0 ? this.findNextLetterInfo(text, nextInfo.index) : { letter: '', index: -1 };
            const nextAfter = nextAfterInfo.letter || '';
            const nextPair = next && nextAfter ? next + nextAfter : '';

            let parts = null;

            if (next === 'p') {
                parts = [makePart('ḥ'), makePart('f', true)];
            } else if (next && this.rules.SIBILANTS.has(next)) {
                parts = [makePart(next)];
            } else if ((next && (this.rules.VOICED_CONSONANTS.has(next) || this.rules.VOWELS.has(next))) && !this.rules.ADVAYA.has(prev)) {
                parts = [makePart('r')];
            } else if (nextPair && this.rules.VISARGA_SPECIAL_SEQUENCE.has(nextPair)) {
                parts = [makePart('ḥ:'), ...(prev ? [makePart(prev, true)] : [])];
            } else {
                const combined = nextPair || next;

                for (const [replacement, consonants] of Object.entries(this.rules.VISARGA_GROUPS)) {
                    const matches = Array.from(consonants).some(consonant => {
                        if (!consonant) return false;
                        if (next && next.startsWith(consonant)) return true;
                        if (combined && combined.startsWith(consonant)) return true;
                        return false;
                    });

                    if (matches) {
                        parts = [makePart(replacement)];
                        break;
                    }
                }
            }

            replacements.push({
                index: i,
                deleteCount: 1,
                parts: parts || undefined,
                changed: Boolean(parts && parts.length)
            });
        }

        return { replacements };
    }
    
    /**
     * Find all pause positions according to rules:
     * 1. After "oṁ" - short pause
     * 2. Long vowel followed by short vowel (across word boundary) - long pause
     * 3. Any other vowel combination (across word boundary) - short pause
     * Returns array of pauses: [{position, type}]
     */
    findAllPauses(text) {
        const pauses = [];
        let i = 0;
        
        while (i < text.length) {
            // Skip svara marks
            if (this.rules.isSvaraMark(text[i])) {
                i++;
                continue;
            }
            
            // Check for "oṁ" pattern followed by space
            if (i + 2 < text.length && text[i] === 'o' && text[i + 1] === 'ṁ' && text[i + 2] === ' ') {
                // Insert short pause after "oṁ " (after the space)
                pauses.push({ position: i + 3, type: 'short' });
                i += 3;
                continue;
            }
            
            // Check for vowel at end of word (followed by space)
            const vowel = this.rules.isVowel(text, i);
            if (vowel) {
                // Move past this vowel and any svara marks
                let nextPos = i + vowel.length;
                while (nextPos < text.length && this.rules.isSvaraMark(text[nextPos])) {
                    nextPos++;
                }
                
                // Check if followed by space (word boundary)
                if (nextPos < text.length && text[nextPos] === ' ') {
                    // Skip the space
                    nextPos++;
                    
                    // Skip any svara marks after space
                    while (nextPos < text.length && this.rules.isSvaraMark(text[nextPos])) {
                        nextPos++;
                    }
                    
                    // Check if next word starts with a vowel
                    const nextVowel = this.rules.isVowel(text, nextPos);
                    if (nextVowel) {
                        // We have vowel-space-vowel (word boundary sandhi)
                        const isCurrentLong = this.rules.LONG_VOWELS.has(vowel);
                        const isNextShort = this.rules.SHORT_VOWELS.has(nextVowel);
                        
                        if (isCurrentLong && isNextShort) {
                            // Long vowel followed by short vowel - long pause
                            pauses.push({ position: nextPos, type: 'long' });
                        } else {
                            // Any other vowel combination - short pause
                            pauses.push({ position: nextPos, type: 'short' });
                        }
                    }
                }
                
                i += vowel.length;
            } else {
                i++;
            }
        }
        
        return pauses;
    }

    /**
     * Find positions to insert 'g' in 'jñ'
     */
    findJnaInsertions(text) {
        const matches = [];
        // Match 'jñ'
        const regex = /jñ/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            // Insert 'g' after 'j' (index + 1)
            matches.push({ position: match.index + 1, text: 'g' });
        }
        return matches;
    }

    /**
     * Find positions to insert 'u' in 'sv'
     */
    findSvInsertions(text) {
        const matches = [];
        // Match 'sv'
        const regex = /sv/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            // Insert 'u' after 's' (index + 1)
            matches.push({ position: match.index + 1, text: 'u' });
        }
        return matches;
    }

    /**
     * Find positions to insert 'u' in 'vy'
     */
    findVyInsertions(text) {
        const matches = [];
        // Match 'vy'
        const regex = /vy/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            // Insert 'u' after 'v' (index + 1)
            matches.push({ position: match.index + 1, text: 'u' });
        }
        return matches;
    }
}
