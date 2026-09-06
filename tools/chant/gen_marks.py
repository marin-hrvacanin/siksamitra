# -*- coding: utf-8 -*-
"""
Offline saṅkalpa marking generator.
Applies HOLDINGS + ANUSVĀRA + VISARGA + SVARABHAKTI (no svara, no jñ/sv/vy
insertions; pauses only the bīja's own) to plain IAST fragments and emits
marked token arrays
in the same shape the chant reader uses:
  { t:'syl', units:[{c, hold?, hg?, change?, sup?}], iast, deva }
  { t:'sp' }
  { t:'punct', iast, deva }
Devanāgarī per syllable via indic_transliteration (ꣳ -> anusvāra).
"""
import json, sys, re, io
from indic_transliteration import sanscript

# ---- letter sets -----------------------------------------------------------
TWO = ['kh','gh','ch','jh','ṭh','ḍh','th','dh','ph','bh','ai','au']
SHORT_V = set('aiuṛḷ')
LONG_V = set(['ā','ī','ū','ṝ','ḹ','e','o','ai','au'])
VOWELS = set(['a','i','u','ṛ','ḷ']) | LONG_V
CONS = set(['k','kh','g','gh','ṅ','c','ch','j','jh','ñ','ṭ','ṭh','ḍ','ḍh','ṇ',
            't','th','d','dh','n','p','ph','b','bh','m','y','r','l','ḻ','v',
            'ś','ṣ','s','h'])
ANU='ṁ'; VIS='ḥ'
# SKIP_CONSONANTS (sanskrit_rules.js L9): consonants that cannot HOST a holding.
# `ḥ` is deliberately NOT in it — the engine lets a visarga host (duḥkha).
SKIP = set(['ṅ','ñ','ṇ','n','m','ṁ','ṃ','r','ś','ṣ','s'])
SIBILANT = set(['ś','ṣ','s'])
# findHoldingPosition's `skipMarks`: stepped over when looking back for the
# vowel that decides long/short, because they are not vowels themselves.
HOLD_SKIP_MARKS = set(['ṁ','ṃ','ḥ'])
PRANAVA = set(['oṁ','oṃ','auṁ','om'])  # `om` = the praṇava carrying the gum
VOICED = set(['g','gh','j','jh','ḍ','ḍh','d','dh','b','bh','m',
              'y','r','l','v','h','n','ṅ','ñ','ṇ'])
# anusvāra homorganic targets
STOP_GROUP = {
    'ṅ': set(['k','kh','g','gh']),
    'ñ': set(['c','ch','j','jh']),
    'ṇ': set(['ṭ','ṭh','ḍ','ḍh']),
    'n': set(['t','th','d','dh']),
    'm': set(['p','ph','b','bh']),
}
BIJA = set(['oṁ','auṁ','hrīṁ','śrīṁ','klīṁ','aiṁ','sauṁ','krīṁ','hlīṁ','strīṁ',
            'blūṁ','glauṁ','hauṁ','huṁ','phaṭ','dūṁ','gaṁ','drāṁ','grīṁ','kṣrauṁ',
            # `guṁ` and `paṁ` open the guru vandanam. They are here on the
            # evidence of the Veda Union sādhana's OWN marked text, which
            # prints `guṁ | gurubhyo` and `paṁ | parama gurubhyo` with the
            # anusvāra intact — where the ordinary rule would have given `guṅ`
            # before g- and `pam` before p-. A bīja keeps its anusvāra.
            'guṁ','paṁ'])

# Rules the owner has ruled on that the Śikṣāmitra JS does NOT implement.
# Kept switchable because every candidate rule is decided by re-measuring
# agreement against his own marked chants — MARKING-RULES §2.3.
RULES = {
    # a verse/line-INITIAL cluster is never boxed
    'no_initial_box': True,
    # how a same-point-of-articulation pair is recognised — see `_same_point`.
    # 'aspirate' (shipped) | 'homorganic' | 'all' (rejected) | False
    'crossword_host': 'aspirate',
}

def norm(s):
    s = s.lower().replace('ṃ','ṁ')
    s = re.sub(r'[-,]', ' ', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

CANDRA = '̐'   # combining candrabindu — the Vedic nasal

def parse_letters(word):
    """word (no spaces) -> list of letter strings.

    The Vedic anusvāra (the *gum*) is authored in the source the way
    Śikṣāmitra authors it — `m` + U+0310, optionally followed by the
    superscript reading aid `g`, `gg` or `gṁ` (sanskrit_rules.js L386-408).
    It is kept as ONE letter here so the whole run becomes a single unit
    carrying `candra` + `sup`, exactly as purusha-suktam.json stores it.
    """
    out=[]; i=0
    while i < len(word):
        if word[i]=='m' and i+1 < len(word) and word[i+1]==CANDRA:
            j=i+2; g=''
            while j < len(word) and word[j]=='g' and len(g)<2:
                g+='g'; j+=1
            if g and j < len(word) and word[j]==ANU:
                g+=ANU; j+=1
            out.append('m'+CANDRA+g); i=j; continue
        two = word[i:i+2]
        if two in TWO:
            out.append(two); i+=2; continue
        out.append(word[i]); i+=1
    return out

def is_vowel(ch): return ch in VOWELS
def is_cons(ch): return ch in CONS or ch==ANU or ch==VIS

def to_deva(iast_syl):
    d = sanscript.transliterate(iast_syl, sanscript.IAST, sanscript.DEVANAGARI)
    return d.replace('ꣳ','ं')  # Vedic tiryak -> anusvāra sign

# ---- core: build a flat element list with word ids + pause breaks ----------
class L:
    __slots__=('ch','word','vowel','cons','hold','hg','change','sup','candra',
              'sbhakti')
    def __init__(self, ch, word):
        self.candra=False; self.sup=None
        # the gum arrives as one letter `m` + U+0310 (+ `g`/`gg`) (+ `ṁ`):
        # the base letter is `m`, the nasal becomes `candra`, and the g-run
        # becomes the IAST-only superscript reading aid.
        if ch.startswith('m'+CANDRA):
            tail = ch[2:]
            ch = 'm'
            self.candra = True
            if tail: self.sup = tail
        self.ch=ch; self.word=word
        self.vowel=is_vowel(ch); self.cons=is_cons(ch)
        self.hold=None; self.hg=None; self.change=False; self.sbhakti=False

def build(fragment):
    """Return list of 'segments' where each is ('letters', [L...], word_meta)
    Actually simpler: returns (elems, tokens_layout).
    elems: flat list; each item is either an L or ('pause', text)."""
    s = norm(fragment)
    parts = s.split(' ')
    elems=[]      # flat: L or ('pause', '|'/'||')
    word_is_bija=[]  # per word id
    wid=-1
    for i, p in enumerate(parts):
        if p=='' : continue
        if set(p) <= set('|'):   # pause token
            elems.append(('pause', p))
            continue
        if set(p) <= set('/'):   # `//` — a LINE break (see LINE-INITIAL below)
            elems.append(('br', p))
            continue
        wid+=1
        bija = (p in BIJA)
        word_is_bija.append(bija)
        letters = parse_letters(p)
        for ch in letters:
            elems.append(L(ch, wid))
        # VU convention (and Śikṣāmitra own BIJA_MANTRAS note): EVERY
        # praṇava is followed by a short pause — `oṁ | sumukhāya namaḥ`. The
        # owner's `pūrṇakumbha mantra.smdoc` opens exactly so:
        #   <p>oṁ <span class="ql-short-pause">|</span> na kar…
        # It is inserted HERE, before holdings run, because a pause mark ENDS a
        # saṁyukta (MARKING-RULES §2.1): `oṁ | sumukhāya` therefore gets NO
        # holding on that `s`, while `upavītaṁ samarpayāmi` — same ṁ + space +
        # s, no pause — does.
        # …but a praṇava that CLOSES the line takes none — `… suvar oṁ ||`
        # ends the recitation; a pause after it would hang.
        # What counts as "nothing follows" must include the DEVANĀGARĪ daṇḍas,
        # not just the ASCII ones. `harir oṁ ।` was still getting a pause,
        # because `।` (U+0964) is not in `|/` and so read as real text after
        # the praṇava — the owner has reported the hanging pause twice.
        _CLOSERS = set('|/।॥')
        rest = [q for q in parts[i+1:] if q and not (set(q) <= _CLOSERS)]
        # …and a praṇava with a BREAK ALREADY WRITTEN AFTER IT takes none
        # either. `oṁ | aparādha…` was rendering `oṁ` + the automatic short
        # pause + the authored daṇḍa — two marks for one break, which is the
        # same fault as the hanging pause above seen from the other side.
        # THE RULE, once, for both: never add a pause where a break is
        # already there. The next part is enough to decide it; whatever
        # follows further on is irrelevant.
        nxt = next((q for q in parts[i+1:] if q), None)
        already_broken = nxt is not None and set(nxt) <= _CLOSERS
        # a praṇava carrying the gum is still a praṇava: `om̐gṁ` -> `om`
        p_bare = p.replace(CANDRA, '').rstrip('g' + ANU) if CANDRA in p else p
        # EVERY BĪJA takes the short pause, not only the praṇava. The Veda
        # Union sādhana and the Śrī Rudram prastāvanā both print the guru
        # vandanam as `guṁ | gurubhyo namaḥ`, `paṁ | parama gurubhyo namaḥ` —
        # the seed syllable stands on its own before the words it opens. The
        # rule was written for `oṁ` alone and so left those two unpaused.
        if (p in PRANAVA or p_bare in PRANAVA or p in BIJA) and rest                 and not already_broken:
            elems.append(('ompause', '|'))
    return apply_hiatus_pauses(elems), word_is_bija

# `findAllPauses` (sanskrit_rules.js L1033-1100). Three rules; only the first
# was ported until now:
#   1. after a praṇava / bīja            -> SHORT   (done in `build`, above)
#   2. long vowel | word boundary | SHORT vowel -> LONG
#   3. any other vowel | boundary | vowel       -> SHORT
# Rules 2-3 are VOWEL HIATUS: two vowels meeting across a word join without
# coalescing. `vāyur vā apām` holds `ā` and `a` apart, and because the first is
# long and the second short it is the LONG pause.
#
# NOT corroborated by the owner's own marked chants — measured, and they contain
# no hiatus at all, so the case never arises there. The authority is his engine.
SHORT_V_SET = set(['a', 'i', 'u', 'ṛ', 'ḷ'])


def apply_hiatus_pauses(elems):
    """Insert the vowel-hiatus pause between two words. Runs BEFORE holdings
    (MARKING-RULES §7), which is why it lives in `build`'s tail: a pause is a
    saṁyukta barrier, and the barrier has to be in place before the scan."""
    out = []
    for k, e in enumerate(elems):
        out.append(e)
        if not isinstance(e, L) or not e.vowel:
            continue
        nxt = None
        for f in elems[k+1:]:
            if isinstance(f, tuple):
                nxt = None
                break                      # a break/pause already separates them
            nxt = f
            break
        if nxt is None or not nxt.vowel or nxt.word == e.word:
            continue
        long_then_short = e.ch in LONG_V and nxt.ch in SHORT_V_SET
        out.append(('vpause', 'long' if long_then_short else 'short'))
    return out


def letter_indices(elems):
    return [i for i,e in enumerate(elems) if isinstance(e,L)]

def prev_vowel_len(elems, idx):
    """nearest vowel strictly before idx, not crossing a pause. Return 'long'/'short'/None."""
    i=idx-1
    while i>=0:
        e=elems[i]
        if isinstance(e,tuple) and e[0]=='pause': return None
        if isinstance(e,L) and e.vowel:
            return 'long' if e.ch in LONG_V else 'short'
        i-=1
    return None

def next_letter(elems, idx):
    """next L after idx, not crossing pause. Return (L or None)."""
    i=idx+1
    while i<len(elems):
        e=elems[i]
        if isinstance(e,tuple) and e[0]=='pause': return None
        if isinstance(e,L): return e
        i+=1
    return None

# `SPECIAL_SEQUENCES` (sanskrit_rules.js L46): before `jñ` or `ghn` the anusvāra
# is KEPT and only highlighted — it does not take the homorganic nasal. Verified
# against the engine, not the prose transcription. It occurs nowhere in the four
# shipped chants (measured), so adding it changed no output; it is here so the
# first text that does hit it is not marked wrong silently.
SPECIAL_SEQUENCES = (('j', 'ñ'), ('gh', 'n'))


def _starts_special_sequence(elems, i):
    nx = next_letter(elems, i)
    if nx is None:
        return False
    after = None
    seen = False
    for e in elems[i+1:]:
        if isinstance(e, tuple):
            continue
        if not seen:
            seen = True
            continue
        after = e.ch
        break
    return (nx.ch, after) in SPECIAL_SEQUENCES


def apply_anusvara(elems, word_is_bija):
    for i,e in enumerate(elems):
        if isinstance(e,L) and e.ch==ANU:
            if word_is_bija[e.word]:
                continue
            if _starts_special_sequence(elems, i):
                continue          # jñ / ghn — kept, never assimilated
            nx = next_letter(elems,i)
            if nx is None: continue
            for nas,grp in STOP_GROUP.items():
                if nx.ch in grp:
                    e.ch=nas; e.change=True
                    break
            # else retained ṁ, no mark

def apply_visarga(elems):
    for i,e in enumerate(elems):
        if isinstance(e,L) and e.ch==VIS:
            nx = next_letter(elems,i)
            # the preceding vowel char itself (the a/ā test of ADVAYA)
            pvc=None
            j=i-1
            while j>=0:
                ee=elems[j]
                if isinstance(ee,tuple) and ee[0]=='pause': break
                if isinstance(ee,L) and ee.vowel: pvc=ee.ch; break
                j-=1
            if nx is None: continue
            n=nx.ch
            if n in ('c','ch'): e.ch='ś'; e.change=True
            elif n in ('ṭ','ṭh'): e.ch='ṣ'; e.change=True
            elif n in ('t','th'): e.ch='s'; e.change=True
            elif n in SIBILANT: e.ch=n; e.change=True
            elif n in ('p','ph'): e.sup='f'; e.change=True  # keep ḥ
            elif (n in VOICED or is_vowel(n)) and pvc not in ('a','ā'):
                e.ch='r'; e.change=True
            # else retain ḥ, no mark (incl. k/kh, and aḥ/āḥ + voiced/vowel)

def _mark_gum_change(elems):
    """The gum realises an underlying ANUSVĀRA before a sibilant or `h`, so it
    is a sandhi variant and carries `change` — exactly as purusha-suktam.json
    stores it (`dam̐gṁ sarvam` → the `m` has change:true). A word-final `m`
    that was always an `m` does not.
    """
    for k, e in enumerate(elems):
        if not (isinstance(e, L) and e.candra):
            continue
        nx = None
        for ee in elems[k+1:]:
            if isinstance(ee, L):
                nx = ee; break
        if nx is not None and (nx.ch in SIBILANT or nx.ch == 'h'):
            e.change = True


def _collect_samyukta(elems, i):
    """Port of `SanskritRules.collectSamyukta` (sanskrit_rules.js L523–604).

    The maximal run of consonants beginning at `i`. Whitespace does NOT break
    the run — it only marks the following component as starting a new word —
    but a pause mark DOES. Returns (components, next_index) where a component
    is (index, L, word_boundary_before).
    """
    comps=[]; n=len(elems); j=i; boundary=False
    while j<n:
        e=elems[j]
        if isinstance(e,tuple) or not e.cons:
            break
        comps.append((j,e,boundary))
        k=j+1
        # a LINE break behaves exactly like a word space: it does not end the
        # saṁyukta (measured — treating it as a break costs 8 of his boxes)
        while k<n and isinstance(elems[k],tuple) and elems[k][0]=='br':
            k+=1
        if k>=n:
            j=k; break
        nxt=elems[k]
        if isinstance(nxt,tuple):      # a pause ends the saṁyukta
            j=k; break
        if not nxt.cons:
            j=k; break
        boundary = (nxt.word != e.word)
        j=k
    return comps, j

# the five stop vargas (nasals excluded — they are in SKIP and cannot host).
# Two stops of the same varga share a POINT OF ARTICULATION.
VARGA = {}
for _v in ('k kh g gh', 'c ch j jh', 'ṭ ṭh ḍ ḍh', 't th d dh', 'p ph b bh'):
    for _c in _v.split():
        VARGA[_c] = _v[0]


def _unaspirated(c):
    """`kh`->`k`, `dh`->`d`; anything else unchanged."""
    return c[:-1] if len(c) == 2 and c.endswith('h') else c


def _same_point(mode, a, b):
    """THE RULE (the owner, 2026-08):

        "if we have consonant cluster with the same (c+c, t+t) or (t+th, c+ch)
         and so on, then it always goes on the first one… even if the consonant
         cluster is split between two words."

    One predicate, not two: dvivarcana is the degenerate case of a pair sharing
    a point of articulation. A word boundary is irrelevant — it applies inside a
    word and across a join alike.

    Modes, kept selectable so MARKING-RULES §2.3's measurements stay
    reproducible:
      `aspirate`   (SHIPPED) identical, or differing only by aspiration
      `homorganic`          any two stops of the same varga — adds the VOICING
                            pairs (t+d, k+g). Measured; see §2.3.
      `all`                 not a point-of-articulation test at all; handled in
                            `_select_holding_component` (cross-word only).
      False                 identical only — the pre-ruling behaviour.
    """
    if a == b:
        return True                       # c+c, t+t
    if mode in (False, None, 'all'):
        return False
    if VARGA.get(a) is None or VARGA.get(a) != VARGA.get(b):
        return False                      # not two stops of one varga
    if mode == 'homorganic':
        return True                       # …including t+d, k+g
    return _unaspirated(a) == _unaspirated(b)   # t+th, c+ch, d+dh


def _select_holding_component(comps):
    """Which member of a saṁyukta hosts the box.

    Ports `selectHoldingComponent` (sanskrit_rules.js L610–647) with the owner's
    2026-08 ruling folded in as ONE predicate — see MARKING-RULES §2.1. The JS
    treats dvivarcana as a special case and decides a cross-word cluster the
    same way as an intra-word one; the owner does neither.
    """
    if len(comps)<2:
        return -1
    # the word boundary, if the cluster crosses one
    b = next((k for k,c in enumerate(comps) if c[2]), -1)
    mode = RULES['crossword_host']
    # 1. SAME POINT OF ARTICULATION -> the FIRST of the pair, wherever it sits.
    #    `tac|chaṁ`, `śarad|dhaviḥ`, `karma`… and no skip-walk: the owner's rule
    #    names the host outright.
    for k in range(len(comps)-1):
        if _same_point(mode, comps[k][1].ch, comps[k+1][1].ch):
            return k
    if mode == 'all' and b > 0:
        # the broad reading — ANY differing cross-word pair hosts on the first
        # word's final. Measured and rejected; kept only to reproduce §2.3.
        cand = b-1
    else:
        # 2. otherwise a cluster split across words hosts on the SECOND word's
        #    initial; an intra-word cluster on its first consonant.
        cand = b if b >= 0 else 0
    # 3. step forward over consonants that cannot host — unless it is a sibilant
    #    that BEGINS the second word, which can. A WORD-FINAL visarga cannot
    #    host either (`durgiḥ pracodayāt` boxes the `p`); inside a word it can
    #    (`duḥkha`), which is why `ḥ` is not in SKIP.
    while cand < len(comps):
        _, l, bnd = comps[cand]
        skip = l.ch in SKIP or (l.ch == VIS and cand < b)
        if (not skip) or (bnd and l.ch in SIBILANT):
            break
        cand += 1
    # 4. everything was skipped -> fall back to the LAST consonant
    if cand >= len(comps):
        cand = len(comps)-1
    return cand

def _find_prev_vowel(elems, idx, block_at_space=True):
    """Port of `findPreviousVowel` (sanskrit_rules.js L487–518).

    Returns (value, blocked, position). `value` is a vowel, or one of ṁ/ṃ/ḥ —
    which the engine returns like a vowel so the caller can step over them.
    Pause marks are skipped; a word space blocks unless `block_at_space` is off.
    """
    right = elems[idx].word if isinstance(elems[idx],L) else None
    i = idx-1
    while i>=0:
        e=elems[i]
        if isinstance(e,tuple):        # pause marks are stepped over
            i-=1; continue
        if block_at_space and right is not None and e.word != right:
            return ('', True, -1)
        if e.ch in HOLD_SKIP_MARKS:
            return (e.ch, False, i)
        if e.vowel:
            return (e.ch, False, i)
        right = e.word
        i-=1
    return ('', False, -1)

def _holding_vowel(elems, idx):
    """`resolveVowelInfo` inside findHoldingPosition: look back from the HOST
    letter; if a word space blocked the search, retry across it; step over
    ṁ/ṃ/ḥ. An empty result means `short` (the engine's default)."""
    v, blocked, pos = _find_prev_vowel(elems, idx)
    if blocked:
        v, blocked, pos = _find_prev_vowel(elems, idx, False)
    while v and v in HOLD_SKIP_MARKS:
        v, blocked, pos = _find_prev_vowel(elems, pos, False)
    return v

def _line_first_letters(elems):
    """Indices of the first LETTER of every line — the fragment's first letter
    and the first after each `//`. Used by the never-box-an-initial-cluster
    rule."""
    out=set(); need=True
    for k,e in enumerate(elems):
        if isinstance(e,tuple):
            if e[0]=='br': need=True
            continue
        if need:
            out.add(k); need=False
    return out

def apply_holdings(elems):
    """Port of `findAllHoldings` (sanskrit_rules.js L689–731).

    One holding per saṁyukta, on one letter, so every `hg` group is a single
    letter and the numbering is per fragment (== per rendered line).
    """
    hg=0; n=len(elems); i=0
    line_first = _line_first_letters(elems)
    while i<n:
        e=elems[i]
        if isinstance(e,tuple) or not e.cons:
            i+=1; continue
        comps, nxt = _collect_samyukta(elems, i)
        step = nxt if nxt>i else i+1
        if len(comps)>=2 and RULES['no_initial_box'] and comps[0][0] in line_first:
            # OWNER'S RULING: "we never box the initial clusters" — a cluster
            # that opens a verse or a line stays bare (`tripādūrdhva`,
            # `brāhmaṇo`, `prajāpatiś`, `hrīś`, `pratnoṣi`, `prātar`).
            i = step; continue
        if len(comps)>=2:
            k = _select_holding_component(comps)
            if k>=0:
                idx, target, _ = comps[k]
                hg+=1
                target.hold = 'long' if _holding_vowel(elems, idx) in LONG_V else 'short'
                target.hg = hg
        i = step

# ---- syllabify a word's letters into tokens --------------------------------
def syllabify(word_letters):
    """word_letters: list of L. Return list of syllables, each a list of L."""
    # find nucleus (vowel) positions
    vpos=[k for k,l in enumerate(word_letters) if l.vowel]
    if not vpos:
        # no vowel (e.g. lone punct) -> whole thing one 'syllable' (rare)
        return [word_letters] if word_letters else []
    sylls=[]
    # onset of first syllable: consonants before first vowel
    start=0
    for si,vp in enumerate(vpos):
        # onset = consonants from `start` up to vp
        onset = word_letters[start:vp]
        nucleus = word_letters[vp]
        if si+1 < len(vpos):
            next_vp=vpos[si+1]
            # consonants between this vowel and next vowel -> onset of NEXT syllable
            syl = onset + [nucleus]
            sylls.append(syl)
            start = vp+1
        else:
            # last syllable: onset + nucleus + trailing coda (rest)
            coda = word_letters[vp+1:]
            syl = onset + [nucleus] + coda
            sylls.append(syl)
            start=len(word_letters)
    return sylls

def unit_of(l):
    u={'c':l.ch}
    if l.hold: u['hold']=l.hold; u['hg']=l.hg
    if l.change: u['change']=True
    if l.sup: u['sup']=l.sup
    if l.candra: u['candra']=True
    # the dot is drawn BEFORE the letter and outside any holding box, so it is
    # a property of this letter and never of the box (MARKING-RULES §6)
    if l.sbhakti: u['sbhakti']=True
    return u

def emit_tokens(elems):
    tokens=[]
    # group consecutive L by word, interleave sp / punct
    i=0; n=len(elems); last_word=None
    # build per-word letter lists in order, with separators
    buf=[];
    def flush_word():
        nonlocal buf
        if not buf: return
        sylls=syllabify(buf)
        for syl in sylls:
            units=[unit_of(l) for l in syl]
            iast=''.join(l.ch for l in syl)
            deva='ॐ' if iast in ('oṁ','oṃ') else to_deva(iast)
            tokens.append({'t':'syl','units':units,'iast':iast,'deva':deva})
        buf=[]
    prev_was_word=False
    while i<n:
        e=elems[i]
        if isinstance(e,tuple) and e[0]=='vpause':
            # vowel hiatus — SPACED ON BOTH SIDES, which is how the owner's own
            # marked files set it: `śa ne ␣ «long» ␣ a bhi`. Note this differs
            # from the praṇava's pause, which he sets with no trailing space
            # (`oṁ ␣ «short» tac`) — so the two cannot share a layout. Dropping
            # the trailing space glues the pause to the next syllable, the same
            # fault as the reported `namaḥ।harir oṁ`.
            flush_word()
            tokens.append({'t':'sp'})
            tokens.append({'t':'pause','len':e[1]})
            tokens.append({'t':'sp'})
            prev_was_word=False
            i+=1; continue
        if isinstance(e,tuple) and e[0]=='ompause':
            # the praṇava's short pause — a `pause` token, not a daṇḍa. Laid out
            # `syl(oṁ) · sp · pause · syl(…)`, matching purusha-suktam.json.
            flush_word()
            tokens.append({'t':'sp'})
            tokens.append({'t':'pause','len':'short'})
            prev_was_word=False
            i+=1; continue
        if isinstance(e,tuple) and e[0]=='br':
            flush_word()
            tokens.append({'t':'br'})
            prev_was_word=False
            i+=1; continue
        if isinstance(e,tuple) and e[0]=='pause':
            flush_word()
            # A daṇḍa is a WORD, spaced like one: every chant JSON stores it as
            # `sp · danda · sp` (purusha-suktam has 27 of them, and 0 without).
            # Without the spaces the reader prints `namaḥ।hariḥ`.
            if tokens and tokens[-1].get('t')!='sp':
                tokens.append({'t':'sp'})
            txt=e[1]
            deva='॥' if len(txt)>=2 else '।'
            tokens.append({'t':'punct','iast':txt,'deva':deva})
            tokens.append({'t':'sp'})
            prev_was_word=False
            i+=1; continue
        # it's an L
        if buf and e.word!=buf[-1].word:
            flush_word()
            tokens.append({'t':'sp'})
        buf.append(e)
        prev_was_word=True
        i+=1
    flush_word()
    # strip trailing sp
    while tokens and tokens[-1].get('t')=='sp':
        tokens.pop()
    return tokens

# ---- svarabhakti (MARKING-RULES §6) ---------------------------------------
# An epenthetic vowel heard between a consonant and a following sound, written
# `·` before the letter and drawn as a filled dot OUTSIDE any holding box.
#
# THE TRIGGER SET IS NARROWER THAN §6'S PROSE, and the owner's own files are
# what narrowed it. Read literally ("a consonant and a following s ś ṣ h ṛ") the
# rule fires on `kṣ`, `sm`, `śś`, `ts` — and he marks none of those: `lakṣmīś`
# in purusha-suktam v-26 is bare on the very line that carries a dot, and `k`+`ṣ`
# stands unmarked 46 times across his three chants. Measured instead:
#
#   ALL 8 of his dots — purusha v-3 `rṣā`, v-10 `rhi`, v-17 `rṣṇo`, v-26 `rśve`;
#   durga v-1 `rṣa`, v-4 `rṣi`, v-5 `rṣa`; bhagya v-8 `rṣa` — sit on a `ś ṣ h`
#   immediately preceded by `r`, and NO `r` + `ś/ṣ/h` contact in those files is
#   left unmarked. 8 for 8, with no counter-example available in the corpus.
#
# APPLIED AFTER the holdings rather than at §7's step 3, and that is not a
# re-ordering: in Śikṣāmitra the dot is a CHARACTER in the text, which is why it
# has to be inserted before the cluster scan reads the line; here it is a FLAG on
# a unit, invisible to the scan. The owner's data confirms the two are the same —
# his `pārśve` boxes the `v` (r and ś both unhostable), which is exactly what the
# scan produces with no dot present at all.
SBHAKTI_AFTER = 'r'
SBHAKTI_TRIGGERS = frozenset(['ś', 'ṣ', 'h'])


def apply_svarabhakti(elems):
    """Set `sbhakti` on a `ś ṣ h` directly preceded by `r`."""
    prev = None                      # the last LETTER, across word spaces
    for e in elems:
        if isinstance(e, tuple):     # a pause / line break separates the two
            prev = None
            continue
        if e.ch in SBHAKTI_TRIGGERS and prev is not None and prev.ch == SBHAKTI_AFTER:
            e.sbhakti = True
        prev = e


# ---- reading aids (MARKING-RULES §7 step 2) --------------------------------
# Śikṣāmitra inserts a SUPERSCRIPT letter inside three consonant pairs
# (`sanskrit_rules.js` L1104-1145): `findJnaInsertions` puts a `g` inside `jñ`,
# `findVyInsertions` a `u` inside `vy`, `findSvInsertions` a `u` inside `sv`.
# Which of the three the owner actually uses was MEASURED across his four
# hand-marked chants (purusha, durga, bhagya, sri-rudram):
#
#   vy -> u    29 of 29        universal — always applied
#   jñ -> g    14 of 32        all 14 in purusha-suktam, none of sri-rudram's 18
#   sv -> u     2 of 30        effectively not applied
#   ghn        0 of 3          `ghn` is in SPECIAL_SEQUENCES for the ANUSVĀRA
#                              rule only; the engine has no insertion for it
#
# `vy` is unanimous. `jñ` was split between two of his own files, and he ruled
# on it (2026-08): "between j and ñ, g should be inserted as per our
# convention". `sv` is not the house habit and is deliberately NOT implemented —
# adding it would put a raised `u` on 28 letters he leaves bare.
#
# Applied as a FLAG on the letter, not as a character in the text, so it cannot
# move a holding box — the same treatment as svarabhakti (§6). That this is
# equivalent is checkable in his own data: `bhavyam` in purusha-suktam carries
# `sup:"u"` AND the holding on the same `v`, so the raised letter never breaks
# the saṁyukta it sits inside.
READING_AIDS = {('j', 'ñ'): 'g', ('v', 'y'): 'u'}


def apply_reading_aids(elems):
    """Set `sup` on the first letter of a `jñ` / `vy` pair inside ONE word."""
    for i, e in enumerate(elems):
        if not isinstance(e, L):
            continue
        nxt = elems[i + 1] if i + 1 < len(elems) else None
        if not isinstance(nxt, L) or nxt.word != e.word:
            continue
        aid = READING_AIDS.get((e.ch, nxt.ch))
        # never overwrite the gum's own reading aid
        if aid and not e.sup:
            e.sup = aid


def mark(fragment):
    """IAST fragment -> chant-v2 tokens.

    MARKING-RULES §7 fixes the order: pauses, then HOLDINGS, then anusvāra,
    then visarga. Holdings must run FIRST so a box lands on the letter as
    written; the substitutions then only recolour letters, they never move a
    box. Doing it the other way round shifts every box by one letter.
    """
    if not fragment or not fragment.strip():
        return []
    elems, wbija = build(fragment)      # 4. pauses (incl. the praṇava pause)
    apply_holdings(elems)               # 5. holdings
    apply_anusvara(elems, wbija)        # 6. anusvāra
    apply_visarga(elems)                # 7. visarga
    _mark_gum_change(elems)             # 8. the gum is an anusvāra variant
    apply_svarabhakti(elems)            # §6 — a flag, so it moves no box
    apply_reading_aids(elems)           # §7 step 2 — likewise a flag
    return emit_tokens(elems)

# ===========================================================================
# VALIDATION against ground-truth chant JSON (holdings + change + sup only)
# ===========================================================================
def reconstruct_verse_iast(verse):
    """Build connected IAST string from tokens, sp->space, danda/bar/pause->' | '."""
    out=[]
    for tk in verse['tokens']:
        t=tk['t']
        if t=='syl': out.append(tk['iast'])
        elif t=='sp': out.append(' ')
        elif t in ('bar','danda'): out.append(' | ')
        elif t=='pause': out.append(' | ')
        elif t=='br': out.append(' ')
    return ''.join(out)

def gt_units(verse):
    """flatten ground-truth syllable units with hold/change/sup (ignore svara/sbhakti)."""
    seq=[]
    for tk in verse['tokens']:
        if tk['t']!='syl': continue
        for u in tk['units']:
            seq.append((u['c'], u.get('hold'), bool(u.get('change')), u.get('sup')))
    return seq

def my_units(iast):
    toks=mark(iast)
    seq=[]
    for tk in toks:
        if tk['t']!='syl': continue
        for u in tk['units']:
            seq.append((u['c'], u.get('hold'), bool(u.get('change')), u.get('sup')))
    return seq

def validate(path, label, max_verses=6):
    data=json.load(open(path, encoding='utf-8'))
    print(f"\n=== validate {label} ===")
    total=0; holdmatch=0; holdgt=0; holdmine=0
    for sec in data['sections']:
        for v in sec['verses'][:max_verses]:
            iast=reconstruct_verse_iast(v)
            gt=gt_units(v)
            mine=my_units(iast)
            # align by char sequence (chars should match ignoring anusvara transforms)
            gi=0; mi=0
            gtchars=[x[0] for x in gt]; mychars=[x[0] for x in mine]
            # compare holdings position by walking; report per-verse holding sets
            gholds=[(k,x) for k,x in enumerate(gt) if x[1]]
            mholds=[(k,x) for k,x in enumerate(mine) if x[1]]
            holdgt+=len(gholds); holdmine+=len(mholds)
            # crude char-level compare where lengths match
            if len(gt)==len(mine):
                for a,b in zip(gt,mine):
                    if a[1]==b[1]: holdmatch+= (1 if a[1] else 0)
            # print first verse detail
    return

def breaks_of(fragment):
    """The BREAK MARKS a line comes out with, in order — 'pause' for the short
    pause, the daṇḍa itself for a daṇḍa. The pause after a praṇava or a bīja is
    added by this module rather than authored, so it is the one mark an author
    cannot see in the source line, and it has twice been wrong: hanging off the
    end of a line, and doubled up against a daṇḍa already written there."""
    out = []
    for tk in mark(fragment):
        if tk['t'] == 'pause':
            out.append('pause')       # added here, never authored
        elif tk['t'] in ('punct', 'br'):
            out.append(tk.get('iast') or tk.get('s') or tk['t'])   # authored
    return out


def holdings_of(fragment):
    """[(letter, 'short'|'long')] in order — the self-test's view of a line."""
    out=[]
    for tk in mark(fragment):
        if tk['t']!='syl': continue
        for u in tk['units']:
            if u.get('hold'):
                out.append((u['c'], u['hold']))
    return out


# The regression suite. `parameṣṭhi` / `gurubhyo` are MARKING-RULES §2.2's
# calibration pair, read off the owner's own document; the rest are read off
# his marked durga-suktam.json / purusha-suktam.json and his
# `pūrṇakumbha mantra.smdoc`.
# The automatic pause after a praṇava or a bīja: it goes in where the syllable
# OPENS something, and nowhere else. Both failures below were reported from the
# page, not caught here, which is why they are now cases.
PAUSE_CASES = [
    # it opens the line -> the pause is added
    ('oṁ sumukhāya namaḥ',        ['pause']),
    ('guṁ gurubhyo namaḥ |',      ['pause', '|']),
    # it CLOSES the line -> no pause, whichever daṇḍa is written
    ('bhūr bhuvas suvar oṁ ||',   ['||']),
    ('harir oṁ |',                ['|']),
    # a break is ALREADY THERE -> the daṇḍa stands alone, no pause against it
    ('oṁ | aparādha sahasrāṇi',   ['|']),
    ('oṁ || aparādha sahasrāṇi',  ['||']),
]

CASES = [
    # MARKING-RULES §2.2 — the calibration pair
    ('parameṣṭhi',              [('ṭh','long')]),
    ('gurubhyo',                [('bh','short')]),
    # the owner's report: a sibilant that begins the second word of a
    # cross-word cluster CAN host, and the vowel is found across the space
    ('upavītaṁ samarpayāmi',    [('s','short'), ('p','short')]),
    # …but a pause ENDS the saṁyukta, so the identical ṁ + space + s does not
    # form a cluster after the praṇava
    ('oṁ sumukhāya namaḥ',      []),
    ('oṁ prāṇāya svāhā',        [('p','long'), ('v','short')]),
    # dvivarcana -> the FIRST of the pair (durga-suktam v-8)
    ('tanno durgiḥ pracodayāt', [('n','short'), ('g','short'), ('p','short')]),
    # everything skipped -> the LAST consonant of the cluster (durga v-1, v-2)
    ('naḥ parṣadati',           [('p','short'), ('ṣ','short')]),
    ('varṇāṁ tapasā',           [('ṇ','short'), ('t','long')]),
    ('karma',                   [('m','short')]),
    # cross-word sibilant + the long vowel found back across the space
    ('durgāṁ devīṁ śaraṇam',    [('g','short'), ('d','long'), ('ś','long')]),
    ('oṁ śāntiḥ śāntiḥ śāntiḥ', [('t','long'), ('ś','short'), ('t','long'),
                                 ('ś','short'), ('t','long')]),
    ('asmān svastibhiḥ',        [('m','short'), ('s','long'), ('t','short')]),
    # a lone consonant is never boxed
    ('namaḥ',                   []),
    ('jātavedase',              []),
    # OWNER'S RULING: a verse/line-INITIAL cluster is never boxed — `tr` and
    # `br` stay bare, the rest of the line is marked as usual
    ('tripādūrdhva udait puruṣaḥ', [('dh','long'), ('p','long')]),
    ('brāhmaṇo asya mukham',    [('h','long'), ('y','short')]),
    ('namaḥ // prajāpataye svāhā', [('p','short'), ('v','long')]),
    # OWNER'S RULING: across a word join, a HOMORGANIC pair — two stops of the
    # same varga, differing only by aspiration and/or voicing — hosts on the
    # FIRST word's final consonant…
    ('tac chaṁ yoḥ',            [('c','short'), ('y','short')]),   # c / ch
    ('śarad dhaviḥ',            [('d','short')]),                  # d / dh
    # …but VOICING is NOT part of the shipped rule: `t + dh` and `k + gh`
    # differ in voicing too, so they host on the second word's initial like any
    # other split cluster. (The `homorganic` mode would host them on the first
    # — measured a tie, not shipped; MARKING-RULES §2.3.)
    ('agnau tat dhāma',         [('g','short'), ('dh','short')]),
    ('sa vāk ghoṣaḥ',           [('gh','long')]),
    # …but any pair from DIFFERENT vargas still hosts on the second word's
    # initial, and an identical pair still takes dvivarcana's first
    ('yat puruṣaṁ vyadadhuḥ',   [('p','short'), ('v','short')]),
    ('sanāc ca hotā',           [('c','long')]),
]

# The reading aids, measured off his own files (see `apply_reading_aids`).
AID_CASES = [
    ('brahma jajñānam',   [('j', 'g')]),          # jñ -> raised g
    ('yajñāt sarva hutaḥ', [('j', 'g')]),
    ('vāyavyān',          [('v', 'u')]),          # vy -> raised u
    ('yad bhavyam',       [('v', 'u')]),
    ('svāhā',             []),                    # sv takes NO aid
    ('jaghnivāṁsam',      []),                    # ghn takes no aid either
    ('yaj jyotiḥ',        []),                    # `j` not before `ñ`
]


def aids_of(fragment):
    out = []
    for tk in mark(fragment):
        if tk['t'] != 'syl':
            continue
        for u in tk['units']:
            if u.get('sup') and not u.get('candra') and u['c'] != VIS:
                out.append((u['c'], u['sup']))
    return out


def selftest():
    bad=0
    for text, want in CASES:
        got = holdings_of(text)
        ok = got==want
        bad += 0 if ok else 1
        print(f"{'ok ' if ok else 'FAIL'} {text:28s} {got}" + ('' if ok else f"  want {want}"))
    print()
    for text, want in PAUSE_CASES:
        got = breaks_of(text)
        ok = got==want
        bad += 0 if ok else 1
        print(f"{'ok ' if ok else 'FAIL'} {text:28s} {got}" + ('' if ok else f"  want {want}"))
    print()
    for text, want in AID_CASES:
        got = aids_of(text)
        ok = got==want
        bad += 0 if ok else 1
        print(f"{'ok ' if ok else 'FAIL'} {text:28s} {got}" + ('' if ok else f"  want {want}"))
    return bad


if __name__=='__main__':
    import os
    if '--selftest' in sys.argv or len(sys.argv)==1:
        bad = selftest()
        print()
        total = len(CASES) + len(PAUSE_CASES) + len(AID_CASES)
        print(f"{total-bad}/{total} holding + break + reading-aid cases pass")
        sys.exit(1 if bad else 0)
