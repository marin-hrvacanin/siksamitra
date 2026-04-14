/**
 * keyboard.js — Sanskrit on-screen keyboard for śikṣāmitra.
 *
 * Requires: transliteration-tables.js (loaded first in keyboard.html)
 *
 * Layout
 * ──────
 *  Left: 5 rows of consonant / special keys
 *  Right: 5 × 3 grid of vowel buttons that update in-place when a consonant is selected
 *
 * Insertion model
 * ───────────────
 *  • Click consonant key  → insert base form (inherent-a in Indic, bare letter in IAST);
 *                            mark consonant as "active"; vowel grid switches to combinations.
 *  • Click vowel button (active consonant)  → append the mātrā sign; Unicode rendering
 *                            combines it with the preceding consonant automatically.
 *                            'a' in Indic = no-op (inherent vowel already inserted).
 *  • Click vowel button (no active)         → insert independent vowel form.
 *  • Click ◌ (virama) button               → append virama to form bare consonant.
 *  • Click ⌫                               → backspace in editor.
 *  • Click ⎵ / ↵                           → space / newline.
 *
 * Cross-window communication: BroadcastChannel('siksamitra-kb')
 */

class SanskritKeyboard {

    // ── LAYOUT DATA ────────────────────────────────────────────────────────

    // Five consonant/special rows — each entry is an IAST string or a special token.
    // Special tokens: '⌫' = backspace, '_SPC' = space, '_ENT' = enter,
    //                 '_A' '_S' '_U' '_CM' = Vedic accent marks,
    //                 '_VRM' = virama (standalone halanta key)
    static CONSONANT_ROWS = [
        ['k','kh','g','gh','ṅ',  'c','ch','j','jh','ñ'],
        ['ṭ','ṭh','ḍ','ḍh','ṇ',  't','th','d','dh','n'],
        ['p','ph','b','bh','m',  'y','r','l','ḻ','v'],
        ['ś','ṣ','s','h',        'ṁ','ḥ',"'",'।','॥','_VRM','⌫'],
        // Row 5: Vedic accents + rare extras + space + enter
        ['_A','_S','_U','_CM',   'ḷ','ḹ','ꣳ',   '_SPC','_ENT'],
    ];

    // 5 × 3 vowel grid (left-to-right, top-to-bottom).
    // 'BARE' = bare-consonant / virama slot (changes meaning based on activeConsonant).
    static VOWEL_GRID = [
        ['a', 'ā',  'i' ],
        ['ī', 'u',  'ū' ],
        ['ṛ', 'e',  'ai'],
        ['o', 'au', 'BARE'],
        ['ṝ', 'ḷ',  'ḹ' ],
    ];

    // Human-readable labels for special tokens (shown inside the key)
    static SPECIAL_LABELS = {
        '_A':   'ˎ',    // anudātta
        '_S':   '᷇',    // svarita  (vertical line above on 'a')
        '_U':   '᷈',    // udātta
        '_CM':  'm̐',   // candrabindu
        '_SPC': '⎵',
        '_ENT': '↵',
        '_VRM': '◌्',   // virama displayed on inherent-a marker
        '⌫':   '⌫',
    };

    // Unicode characters emitted by special tokens
    static SPECIAL_CHARS = {
        '_A':   '\u0331',  // combining macron below (anudātta)
        '_S':   '\u030D',  // combining vertical line above (svarita)
        '_U':   '\u030E',  // combining double vertical line above (udātta)
        '_CM':  '\u0310',  // combining candrabindu
        '_SPC': ' ',
        '_ENT': '\n',
        '_VRM': null,      // virama is script-dependent; handled separately
        '⌫':   null,      // handled as backspace event
    };

    static SPECIAL_TITLES = {
        '_A':   'Anudātta (low pitch) — U+0331',
        '_S':   'Svarita (high pitch) — U+030D',
        '_U':   'Udātta (extra-high pitch) — U+030E',
        '_CM':  'Candrabindu — U+0310',
        '_SPC': 'Space',
        '_ENT': 'New line',
        '_VRM': 'Virama / halanta (bare consonant sign)',
        '⌫':   'Backspace',
    };

    constructor() {
        this.primaryScript   = 'iast';
        this.secondaryScript = 'none';
        this.activeConsonant = null;         // IAST value of selected consonant, or null

        this._consonantBtns  = new Map();    // iastVal → <button>
        this._vowelBtns      = [];           // [{btn, vowelIAST}]
    }

    // ── INIT ──────────────────────────────────────────────────────────────

    init() {
        this._initDropdowns();
        this._initKeyboardShortcuts();
        this._syncTheme();
        this.render();
    }

    // ── THEME ──────────────────────────────────────────────────────────────

    _syncTheme() {
        const apply = (t) => {
            if (t === 'system') t = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', t);
            document.body.setAttribute('data-theme', t);
        };
        apply(localStorage.getItem('siksamitra-theme') || 'light');
        window.addEventListener('storage', (e) => { if (e.key === 'siksamitra-theme') apply(e.newValue || 'light'); });
    }

    // ── DROPDOWNS ──────────────────────────────────────────────────────────

    _initDropdowns() {
        this._wireDropdown('primaryScriptDropdown', (val) => {
            this.primaryScript = val;
            if (this.secondaryScript === val) {
                this.secondaryScript = 'none';
                this._setDropdownValue('secondaryScriptDropdown', 'none');
            }
            this.activeConsonant = null;
            this.render();
        });
        this._wireDropdown('secondaryScriptDropdown', (val) => {
            if (val !== 'none' && val === this.primaryScript) return;
            this.secondaryScript = val;
            this.render();
        });
    }

    _wireDropdown(ddId, onChange) {
        const dd = document.getElementById(ddId);
        if (!dd) return;
        const trigger = dd.querySelector('.custom-dropdown-trigger');
        const options = dd.querySelectorAll('.custom-dropdown-option');
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-dropdown.open').forEach(el => { if (el !== dd) el.classList.remove('open'); });
            dd.classList.toggle('open');
        });
        options.forEach(opt => {
            opt.addEventListener('click', () => {
                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                trigger.textContent = opt.textContent;
                dd.dataset.value = opt.dataset.value;
                dd.classList.remove('open');
                onChange(opt.dataset.value);
            });
        });
        document.addEventListener('click', () => dd.classList.remove('open'));
    }

    _setDropdownValue(ddId, value) {
        const dd = document.getElementById(ddId);
        if (!dd) return;
        const trigger = dd.querySelector('.custom-dropdown-trigger');
        dd.querySelectorAll('.custom-dropdown-option').forEach(opt => {
            const match = opt.dataset.value === value;
            opt.classList.toggle('selected', match);
            if (match) { trigger.textContent = opt.textContent; dd.dataset.value = value; }
        });
    }

    // ── KEYBOARD SHORTCUTS ─────────────────────────────────────────────────

    _initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.activeConsonant = null;
                this._rebuildVowelSection();
            }
        });
    }

    // ── RENDER ─────────────────────────────────────────────────────────────

    render() {
        this._renderConsonantSection();
        this._renderVowelSection();
    }

    // ── CONSONANT SECTION ──────────────────────────────────────────────────

    _renderConsonantSection() {
        const container = document.getElementById('kbConsonants');
        container.innerHTML = '';
        this._consonantBtns.clear();

        SanskritKeyboard.CONSONANT_ROWS.forEach((row, rowIdx) => {
            const rowEl = document.createElement('div');
            rowEl.className = 'kb-row';
            if (rowIdx === SanskritKeyboard.CONSONANT_ROWS.length - 1) {
                rowEl.classList.add('kb-row-special');
            }

            for (const key of row) {
                const btn = this._makeConsonantKey(key, rowIdx);
                rowEl.appendChild(btn);
            }
            container.appendChild(rowEl);
        });
    }

    _makeConsonantKey(key, rowIdx) {
        const T = TransliterationTables;
        const isSpecialToken = key.startsWith('_') || key === '⌫';
        const isConsonant = !isSpecialToken && T.CONSONANTS && T.CONSONANTS.has(key);

        const btn = document.createElement('button');
        btn.className = 'kb-key';
        btn.addEventListener('mousedown', e => e.preventDefault());

        if (key === '_SPC') {
            btn.classList.add('kb-key-space');
        } else if (key === '⌫') {
            btn.classList.add('kb-key-wide');
        }

        if (isSpecialToken || !isConsonant) {
            // Special key or non-consonant phoneme (ṁ, ḥ, ', ।, ॥, ḷ, ḹ, ꣳ)
            btn.classList.add('kb-key-special');
            const label = SanskritKeyboard.SPECIAL_LABELS[key];
            const title = SanskritKeyboard.SPECIAL_TITLES[key];

            if (label) {
                // Token with fixed label
                btn.innerHTML = `<span class="kb-key-primary">${label}</span>`;
                if (title) btn.title = title;
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this._onSpecialClick(key);
                });
            } else {
                // IAST phoneme (not a consonant): ṁ ḥ ' । ॥ ḷ ḹ ꣳ
                this._populatePhonemeKey(btn, key);
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this._onPhonemeClick(key);
                });
            }
        } else {
            // Consonant key
            this._populateConsonantKey(btn, key);
            this._consonantBtns.set(key, btn);
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this._onConsonantClick(key);
            });
        }

        return btn;
    }

    _populateConsonantKey(btn, iastVal) {
        const T = TransliterationTables;
        const script = this._effectiveScript();
        const display = this._baseDisplay(iastVal, script);

        const pSpan = document.createElement('span');
        pSpan.className = 'kb-key-primary';
        pSpan.textContent = display || iastVal;
        btn.dataset.script = script;
        btn.appendChild(pSpan);
        btn.title = this._consonantTooltip(iastVal);

        if (this.secondaryScript !== 'none') {
            const secScript = this.secondaryScript;
            // Use syllable form (consonant + inherent 'a') so secondary matches primary:
            // e.g. Devanagari 'ख' primary → IAST secondary shows 'kha', not bare 'kh'
            const T2 = TransliterationTables;
            const secDisplay = T2.convertSyllable(iastVal, 'a', secScript)
                               || T2.convert(iastVal, secScript)
                               || iastVal;
            if (secDisplay && secDisplay !== display) {
                const sSpan = document.createElement('span');
                sSpan.className = 'kb-key-secondary';
                sSpan.textContent = secDisplay;
                btn.appendChild(sSpan);
            }
        }
    }

    _populatePhonemeKey(btn, iastVal) {
        const T = TransliterationTables;
        const script = this._effectiveScript();
        const display = T.convert(iastVal, script);

        const pSpan = document.createElement('span');
        pSpan.className = 'kb-key-primary';
        pSpan.textContent = display || iastVal;
        btn.dataset.script = script;
        btn.appendChild(pSpan);

        if (this.secondaryScript !== 'none') {
            const secDisplay = T.convert(iastVal, this.secondaryScript);
            if (secDisplay && secDisplay !== display) {
                const sSpan = document.createElement('span');
                sSpan.className = 'kb-key-secondary';
                sSpan.textContent = secDisplay;
                btn.appendChild(sSpan);
            }
        }
    }

    // ── VOWEL SECTION ──────────────────────────────────────────────────────

    _renderVowelSection() {
        const container = document.getElementById('kbVowels');
        container.innerHTML = '';
        this._vowelBtns = [];

        for (const row of SanskritKeyboard.VOWEL_GRID) {
            const rowEl = document.createElement('div');
            rowEl.className = 'kb-vrow';
            for (const vowelIAST of row) {
                const { btn, entry } = this._makeVowelButton(vowelIAST);
                this._vowelBtns.push(entry);
                rowEl.appendChild(btn);
            }
            container.appendChild(rowEl);
        }
    }

    _makeVowelButton(vowelIAST) {
        const btn = document.createElement('button');
        btn.className = 'kb-vkey';
        btn.addEventListener('mousedown', e => e.preventDefault());
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            this._onVowelClick(vowelIAST);
        });

        const pSpan = document.createElement('span');
        pSpan.className = 'kb-vkey-primary';
        btn.appendChild(pSpan);

        const sSpan = document.createElement('span');
        sSpan.className = 'kb-vkey-secondary';
        btn.appendChild(sSpan);

        const entry = { btn, vowelIAST, pSpan, sSpan };
        this._fillVowelButton(entry);
        return { btn, entry };
    }

    _fillVowelButton({ btn, vowelIAST, pSpan, sSpan }) {
        const T = TransliterationTables;
        const script = this._effectiveScript();
        const active = this.activeConsonant;

        btn.classList.remove('kb-vkey-active', 'kb-vkey-inactive', 'kb-vkey-bare', 'kb-vkey-inherent');
        btn.disabled = false;
        sSpan.textContent = '';
        btn.dataset.script = script;

        if (vowelIAST === 'BARE') {
            btn.classList.add('kb-vkey-bare');
            if (active) {
                // Show bare consonant (consonant + virama)
                const bareStr = this._bareConsonantDisplayStr(active, script);
                pSpan.textContent = bareStr || (active + '◌');
                btn.disabled = false;
                btn.title = active + ' + virama (bare consonant)';
            } else {
                pSpan.textContent = '◌';
                btn.disabled = true;
                btn.title = 'Bare consonant — click a consonant first';
            }
            return;
        }

        if (active) {
            // Show consonant + vowel combination
            const syllable = T.convertSyllable(active, vowelIAST, script);
            if (syllable === null) {
                pSpan.textContent = '—';
                btn.disabled = true;
                btn.title = 'Not available in ' + T.scriptName(script);
            } else {
                pSpan.textContent = syllable;
                btn.disabled = false;
                btn.title = active + vowelIAST;

                // Secondary label — show just the vowel phoneme, not the full syllable
                if (this.secondaryScript !== 'none') {
                    const secVowel = T.convert(vowelIAST, this.secondaryScript);
                    if (secVowel && secVowel !== pSpan.textContent) {
                        sSpan.textContent = secVowel;
                    }
                }

            }
        } else {
            // Show standalone vowel
            const standalone = T.convert(vowelIAST, script);
            pSpan.textContent = standalone || vowelIAST;
            btn.disabled = false;
            btn.title = vowelIAST;

            if (this.secondaryScript !== 'none') {
                const secStandalone = T.convert(vowelIAST, this.secondaryScript);
                if (secStandalone && secStandalone !== standalone) {
                    sSpan.textContent = secStandalone;
                }
            }
        }
    }

    _rebuildVowelSection() {
        for (const entry of this._vowelBtns) this._fillVowelButton(entry);
    }

    // ── KEY CLICK HANDLERS ─────────────────────────────────────────────────

    _onConsonantClick(iastVal) {
        const char = this._charForInsert(iastVal);
        this._broadcast({ type: 'insert', char });

        this.activeConsonant = iastVal;
        this._rebuildVowelSection();
    }

    _onVowelClick(vowelIAST) {
        if (vowelIAST === 'BARE') {
            if (this.activeConsonant) {
                const virama = this._viraimaChar();
                if (virama) this._broadcast({ type: 'insert', char: virama });
            }
            this._clearActive();
            return;
        }

        if (this.activeConsonant) {
            const append = this._vowelAppendChar(vowelIAST);
            if (append) this._broadcast({ type: 'insert', char: append });
            this._clearActive();
        } else {
            // No active consonant — insert standalone vowel form
            const standalone = this._standaloneVowelChar(vowelIAST);
            if (standalone) this._broadcast({ type: 'insert', char: standalone });
        }
    }

    _onSpecialClick(key) {
        if (key === '⌫') {
            this._broadcast({ type: 'backspace' });
            // Keep active consonant so user can continue after a correction
            return;
        }
        if (key === '_VRM') {
            // Standalone virama — inserts into text regardless of active state
            const virama = this._viraimaChar();
            if (virama) this._broadcast({ type: 'insert', char: virama });
            this._clearActive();
            return;
        }

        const char = SanskritKeyboard.SPECIAL_CHARS[key];
        if (char !== null && char !== undefined) {
            this._broadcast({ type: 'insert', char });
        }
        // Clear active for space / enter; keep it for accents (you might accent then add vowel)
        if (key === '_SPC' || key === '_ENT') this._clearActive();
    }

    _onPhonemeClick(iastVal) {
        const char = this._charForNonConsonant(iastVal);
        if (char) this._broadcast({ type: 'insert', char });
        this._clearActive();
    }

    _clearActive() {
        this.activeConsonant = null;
        this._rebuildVowelSection();
    }

    _updateConsonantHighlights() {
        this._consonantBtns.forEach((btn, iastVal) => {
            btn.classList.toggle('kb-key-active', iastVal === this.activeConsonant);
        });
    }

    // ── CHARACTER RESOLUTION ───────────────────────────────────────────────

    _effectiveScript() {
        return this.primaryScript;
    }

    /**
     * Base display of a consonant for the key face.
     * In Indic scripts uses the CV=a form (base glyph).
     * In IAST/ITRANS uses the bare phoneme.
     */
    _baseDisplay(iastVal, script) {
        const T = TransliterationTables;
        if (script === 'iast' || script === 'itrans') return T.convert(iastVal, script) || iastVal;
        // Indic: show base glyph (consonant with inherent a = CV syllable display)
        const syl = T.convertSyllable(iastVal, 'a', script);
        return syl !== null ? syl : (T.convert(iastVal, script) || iastVal);
    }

    /**
     * Character to insert when a consonant key is clicked.
     * Indic: base glyph (consonant with inherent a).
     * IAST / ITRANS: bare phoneme.
     */
    _charForInsert(iastVal) {
        const T = TransliterationTables;
        const script = this._effectiveScript();
        if (script === 'iast') return iastVal;
        if (script === 'itrans') return T.convert(iastVal, 'itrans') || iastVal;
        const syl = T.convertSyllable(iastVal, 'a', script);
        return syl !== null ? syl : (T.convert(iastVal, script) || iastVal);
    }

    /**
     * Character to insert for non-consonant phonemes in the left section
     * (ṁ, ḥ, avagraha, dandas, ḷ, ḹ, ꣳ).
     */
    _charForNonConsonant(iastVal) {
        const T = TransliterationTables;
        const script = this._effectiveScript();
        return T.convert(iastVal, script) || iastVal;
    }

    /**
     * Returns only the vowel sign (mātrā) to APPEND after an already-inserted
     * consonant. The Unicode renderer combines it automatically.
     * Returns null for 'a' in Indic (inherent vowel — no-op).
     */
    _vowelAppendChar(vowelIAST) {
        const T = TransliterationTables;
        const script = this._effectiveScript();
        const sign = T.VOWEL_SIGNS.find(s => s.iast === vowelIAST);
        if (!sign) return null;
        if (script === 'iast')   return vowelIAST;
        if (script === 'itrans') return sign.itrans || null;
        const raw = sign[script];
        return (raw !== null && raw !== undefined && raw !== '') ? raw : null;
    }

    /**
     * Returns the standalone (independent) vowel form for inserting when
     * no consonant is active.
     */
    _standaloneVowelChar(vowelIAST) {
        const T = TransliterationTables;
        const script = this._effectiveScript();
        return T.convert(vowelIAST, script) || vowelIAST;
    }

    /**
     * Returns the virama (halanta) character for the current script.
     * Returns null for IAST/ITRANS where there is no combining virama.
     */
    _viraimaChar() {
        const T = TransliterationTables;
        const script = this._effectiveScript();
        return T.VIRAMA[script] || null;
    }

    /**
     * Returns the full bare-consonant string for display in the BARE button.
     * e.g. 'k' in Devanagari → 'क्' (consonant + virama combining).
     */
    _bareConsonantDisplayStr(consonantIAST, script) {
        const T = TransliterationTables;
        return T.convertBareConsonant(consonantIAST, script) || null;
    }

    _consonantTooltip(iastVal) {
        const T = TransliterationTables;
        const parts = [];
        if (this._effectiveScript() !== 'iast') parts.push('IAST: ' + iastVal);
        const it = T.convert(iastVal, 'itrans');
        if (it && it !== iastVal && this._effectiveScript() !== 'itrans' && this.secondaryScript !== 'itrans') {
            parts.push('ITRANS: ' + it);
        }
        return parts.join(' · ') || iastVal;
    }

    // ── SEND ──────────────────────────────────────────────────────────────

    _broadcast(msg) {
        const char = msg.type === 'backspace' ? '\x08' : msg.char;
        if (!char && msg.type !== 'backspace') return;
        fetch('/api/keyboard/insert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ char: char || '\x08' }),
        }).catch(() => {});
    }
}

// ── BOOTSTRAP ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    if (typeof TransliterationTables === 'undefined') {
        console.error('[keyboard] TransliterationTables not loaded');
        return;
    }
    window._kb = new SanskritKeyboard();
    window._kb.init();
});
