/**
 * Sanskrit grammatical rules for automatic text processing
 * Ported from śikṣāmitra.pyw
 */

class SanskritRules {
    constructor() {
        // Consonant groups
        this.SKIP_CONSONANTS = new Set(['ṅ', 'ñ', 'ṇ', 'n', 'm', 'r', 'ś', 'ṣ', 's']);
        
        this.ALL_CONSONANTS = new Set([
            'k', 'kh', 'g', 'gh', 'ṅ',
            'c', 'ch', 'j', 'jh', 'ñ',
            'ṭ', 'ṭh', 'ḍ', 'ḍh', 'ṇ',
            't', 'th', 'd', 'dh', 'n',
            'p', 'ph', 'b', 'bh', 'm',
            'y', 'r', 'l', 'v',
            'ś', 'ṣ', 's', 'h',
            'ḥ', 'ṁ', 'ṃ'
        ]);
        
        // Vowels
        this.SHORT_VOWELS = new Set(['a', 'i', 'u', 'ṛ', 'ḷ']);
        this.LONG_VOWELS = new Set(['ā', 'ī', 'ū', 'ṝ', 'ḹ', 'e', 'ai', 'o', 'au']);
        this.VOWELS = new Set([...this.SHORT_VOWELS, ...this.LONG_VOWELS]);
        
        // Svara marks
        this.SVARA_MARKS = new Set([
            '\u0331', '\u030d', '\u030e', '\u02ce'
        ]);
        
        // Two-character consonants (order matters - check longer ones first)
        this.TWO_CHAR_CONSONANTS = ['kh', 'gh', 'ch', 'jh', 'ṭh', 'ḍh', 'th', 'dh', 'ph', 'bh'];
        this.TWO_CHAR_VOWELS = ['ai', 'au', 'ṝ', 'ḹ'];
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
    }
    
    /**
     * Pre-process raw text to standardize characters
     * Ported from pre_process_raw_text in śikṣāmitra.pyw
     */
    preProcessRawText(text) {
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
        text = text.replace(/ō/g, 'o');
        text = text.replace(/ē/g, 'e');
        
        // Normalize special sequences
        text = text.replace(/\(g\)m/g, 'ṁ');
        text = text.replace(/\(g\)ṁ/g, 'ṁ');
        text = text.replace(/\(g̱\)ṁ/g, 'ṁ');
        text = text.replace(/\(g̱\)m/g, 'ṁ');
        
        return text;
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
            if (text[i] === 'ṁ' || text[i] === 'ṃ' || text[i] === 'ḥ') {
                return { vowel: text[i], blocked: false, position: i };
            }
            
            const vowel = this.rules.isVowel(text, i);
            if (vowel) {
                return { vowel: vowel, blocked: false, position: i };
            }
            
            i--;
        }
        return { vowel: '', blocked: false, position: -1 };
    }
    
    /**
     * Find the length of samyukta (consonant cluster) starting at pos
     */
    findSamyuktaLength(text, pos, countMarks = true) {
        let length = 0;
        let i = pos;
        
        while (i < text.length) {
            if (text[i].match(/\s/) || text[i] === '\n') {
                i++;
            } else if (text[i] === '|') {
                // Skip pause marks
                i++;
            } else if (countMarks && this.rules.isSvaraMark(text[i])) {
                i++;
            } else {
                const consonant = this.rules.isConsonant(text, i);
                if (consonant) {
                    length++;
                    i += consonant.length;
                } else {
                    break;
                }
            }
        }
        
        return length;
    }
    
    /**
     * Find where holding should be placed
     * Returns: {position: number, length: number, type: string}
     */
    findHoldingPosition(text, pos) {
        const consonant = this.rules.isConsonant(text, pos);
        if (!consonant) {
            return { position: 0, length: 0, type: '' };
        }
        
        const samyuktaLength = this.findSamyuktaLength(text, pos, false);
        if (samyuktaLength <= 1) {
            return { position: 0, length: 0, type: '' };
        }
        
        const { vowel, blocked: isStartOfWord } = this.findPreviousVowel(text, pos);
        
        if (vowel === '') {
            if (isStartOfWord) {
                // Just return the first consonant with its natural length
                return { position: pos, length: consonant.length, type: 'short' };
            }
            return { position: 0, length: 0, type: '' };
        }
        
        const holdingType = this.rules.LONG_VOWELS.has(vowel) ? 'long' : 'short';
        
        let holdingLength = consonant.length;
        let holdingPosition = pos; // Position of FIRST consonant in samyukta
        let i = pos;
        let passedOverSpace = false;
        let lastConsonantBeforeSpace = null;
        let lastConsonantBeforeSpacePos = -1;
        
        // Traverse the samyukta to find its length
        while (i < text.length) {
            if (text[i].match(/\s/) || text[i] === '\n') {
                if (!passedOverSpace) {
                    const cons = this.rules.isConsonant(text, holdingPosition);
                    if (cons) {
                        lastConsonantBeforeSpace = cons;
                        lastConsonantBeforeSpacePos = holdingPosition;
                    }
                }
                passedOverSpace = true;
                i++;
            } else if (text[i] === '|') {
                // Skip pause marks
                i++;
            } else if (this.rules.isSvaraMark(text[i])) {
                i++;
            } else {
                const cons = this.rules.isConsonant(text, i);
                if (!cons) break;
                
                // If we passed over space, this is the first consonant of next word
                if (passedOverSpace) {
                    // For dvirvacana (double consonant), holding goes on first word's last consonant
                    if (cons === lastConsonantBeforeSpace) {
                        holdingPosition = lastConsonantBeforeSpacePos;
                        holdingLength = lastConsonantBeforeSpace.length;
                        // Continue scanning to find the END of the samyukta
                        i += cons.length;
                        // Keep going through remaining consonants in the cluster
                        while (i < text.length) {
                            if (this.rules.isSvaraMark(text[i])) {
                                i++;
                            } else {
                                const nextCons = this.rules.isConsonant(text, i);
                                if (!nextCons) break; // Hit a vowel or end - samyukta is done
                                i += nextCons.length;
                            }
                        }
                        // Important: return the position AFTER the entire samyukta
                        // so findAllHoldings doesn't try to process any consonants in this cluster again
                        return { position: holdingPosition, length: holdingLength, type: holdingType, endPos: i };
                    } else {
                        // Otherwise holding goes on this first consonant of second word
                        holdingPosition = i;
                        holdingLength = cons.length;
                        // Continue scanning to find the END of the samyukta
                        i += cons.length;
                        // Keep going through remaining consonants in the cluster
                        while (i < text.length) {
                            if (this.rules.isSvaraMark(text[i])) {
                                i++;
                            } else {
                                const nextCons = this.rules.isConsonant(text, i);
                                if (!nextCons) break; // Hit a vowel or end - samyukta is done
                                i += nextCons.length;
                            }
                        }
                        // Return with endPos so we skip the entire samyukta
                        return { position: holdingPosition, length: holdingLength, type: holdingType, endPos: i };
                    }
                }
                
                // Don't update holdingPosition - it stays on the FIRST consonant
                // Just move forward in the text
                i += cons.length;
            }
        }
        
        // Skip over SKIP_CONSONANTS
        let currentCons = this.rules.isConsonant(text, holdingPosition);
        while (currentCons && this.rules.SKIP_CONSONANTS.has(currentCons)) {
            holdingPosition += currentCons.length;
            if (holdingPosition >= text.length) break;
            currentCons = this.rules.isConsonant(text, holdingPosition);
        }
        
        // Final holding position
        currentCons = this.rules.isConsonant(text, holdingPosition);
        if (currentCons) {
            // The holding is just the consonant itself
            // If it's a two-character consonant like "bh", currentCons.length will be 2
            // If it's a single character like "s", currentCons.length will be 1
            return { position: holdingPosition, length: currentCons.length, type: holdingType };
        }
        
        return { position: 0, length: 0, type: '' };
    }
    
    /**
     * Apply holdings automatically to the entire text
     * Returns array of holdings: [{position, length, type}]
     */
    findAllHoldings(text) {
        const holdings = [];
        let i = 0;
        
        while (i < text.length) {
            // Skip pause marks
            if (text[i] === '|') {
                i++;
                continue;
            }
            
            const consonant = this.rules.isConsonant(text, i);
            if (consonant) {
                const holding = this.findHoldingPosition(text, i);
                if (holding.position > 0 && holding.length > 0) {
                    holdings.push(holding);
                    // If endPos is specified (for dvirvacana), skip to there
                    // Otherwise skip past the holding position
                    if (holding.endPos !== undefined) {
                        i = holding.endPos;
                    } else {
                        i = holding.position + holding.length;
                    }
                } else {
                    i += consonant.length;
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
}
