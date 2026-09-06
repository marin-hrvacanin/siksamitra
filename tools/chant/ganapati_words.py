# -*- coding: utf-8 -*-
"""Per-word grammar for `gen_ganapati.py`, keyed by the surface AFTER the
anusvāra / visarga transforms (`bhadraṅ`, `karṇebhiś`, `mokṣañ`, `kevalaṅ`…).

`gen_ganapati.attach_words()` reports every surface with no entry and
`check()` asserts word count == syllable-run count per verse, so the grammar
can never drift out of alignment with the token stream (AUTHORING-CHANTS §5C).
Run `gen_ganapati.py --surfaces` to re-derive the key list after editing.

Conventions (AUTHORING-CHANTS §4):
  * `vibhakti` 1..8, 7 = locative, 8 = vocative; `purusha` 1/2/3 =
    uttama/madhyama/prathama.
  * `gana` is rendered inline as `root (gana)`, so it holds the gaṇa and
    nothing else; remarks go in `note`.
  * An upasarga on a FINITE verb gets its own entry beside the root; a preverb
    lexicalised into a nominal or participial stem stays inside that lemma with
    the derivation in `note`.
  * A sandhi-fused surface carries SEVERAL entries (`tvameva`, `jagadi-dan`,
    `sākṣādā-tmā'si`, `khalvidam`, `saiṣā`).
  * `forms` is derived, never hand-typed.

TWO THINGS THIS SOURCE DOES that the table has to answer for:

1.  **The owner splits many compounds at a space** — `kāla trayā-tītaḥ`,
    `rakta vāsasamˎ`, `viśva vedāḥ`, `divasa kṛtam pāpan`, `sūrya grahe`. One
    chunk between spaces is one `WordGram`, so the first member gets an `other`
    entry (a bare stem has no vibhakti) and the member carrying the ending gets
    the full parse, with the whole compound named in its `note`.

2.  **The gum breaks a word in two.** `tuṣṭuvāṁsas` is set, as Taittirīya
    texts print it, as `tuṣṭuvā(gṁ) sas` — with a real space. Both halves carry
    the SAME single entry, so the popover says the same true thing wherever the
    reader taps.

HOMOGRAPHS. The table is keyed by surface, so a surface that is two different
words needs `OVERRIDES[(verse id, word index, surface)]` — `na` is the negative
particle in mantras 11 and 12, but the enclitic `naḥ` of `asmad` in the śānti
pāṭha's `svasti na indraḥ`.
"""
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

M, F, N = 'm', 'f', 'n'
EKA, DVI, BAHU = 'eka', 'dvi', 'bahu'


def _forms(head):
    b = head.replace('ṁ', 'ṃ')
    return {'deva': transliterate(b, sanscript.IAST, sanscript.DEVANAGARI),
            'tel': transliterate(b, sanscript.IAST, sanscript.TELUGU),
            'tam': transliterate(b, sanscript.IAST, sanscript.TAMIL)}


def S(lemma, meaning, gender, vibhakti, vacana, stem=None, note=None):
    """subanta"""
    e = {'lemma': lemma, 'type': 'subanta', 'meaning': meaning,
         'gender': gender, 'vibhakti': vibhakti, 'vacana': vacana,
         'forms': _forms(lemma)}
    if stem:
        e['stem'] = stem
    if note:
        e['note'] = note
    return e


def T(root, meaning, gana, lakara, purusha, vacana, note=None):
    """tiṅanta"""
    e = {'lemma': root, 'type': 'tinanta', 'meaning': meaning, 'root': root,
         'gana': gana, 'lakara': lakara, 'purusha': purusha, 'vacana': vacana,
         'forms': _forms(root)}
    if note:
        e['note'] = note
    return e


def A(lemma, meaning, note=None):
    """avyaya"""
    e = {'lemma': lemma, 'type': 'avyaya', 'meaning': meaning,
         'forms': _forms(lemma)}
    if note:
        e['note'] = note
    return e


def U(lemma, meaning, note=None):
    """upasarga"""
    e = {'lemma': lemma, 'type': 'upasarga', 'meaning': meaning,
         'forms': _forms(lemma)}
    if note:
        e['note'] = note
    return e


def O(lemma, meaning, note=None):
    """A bare stem standing as a member of a compound the source writes with a
    space — a stem has no vibhakti, which is what `other` is for."""
    e = {'lemma': lemma, 'type': 'other', 'meaning': meaning,
         'forms': _forms(lemma)}
    if note:
        e['note'] = note
    return e


# ── shorthands for the words this text repeats ───────────────────────────────
def _tvam(surface_note=None):
    return S('yuṣmad', 'you', None, 1, EKA, note=surface_note)


def _asi():
    return T('as', 'you are', '2 (adādi)', 'laṭ', 2, EKA)


def _asmad_nas(note=None):
    return S('asmad', 'to us', None, 4, BAHU,
             note=note or 'The enclitic <em>naḥ</em>.')


_SPLIT = 'The source writes this compound with a space; this is its first member.'
_GUM = ('The gum breaks the word: Taittirīya texts print '
        '<em>tuṣṭuvā(gṁ) sas</em> in two parts.')
_TUSHTUVAMSAS = S(
    'tuṣṭuvas', 'having praised', M, 1, BAHU,
    note='Perfect active participle (kvasu) of <em>√stu</em>. ' + _GUM)


WORDS = {
    # ── śānti pāṭha — Ṛgveda 1.89.8 ──────────────────────────────────────────
    'oṁ': [A('oṁ', 'the praṇava, the sacred syllable')],
    'bhadraṅ': [S('bhadra', 'what is auspicious', N, 2, EKA)],
    'karṇebhiś': [S('karṇa', 'with the ears', M, 3, BAHU,
                    note='Vedic instrumental plural <em>-ebhiḥ</em> for '
                         '<em>-aiḥ</em>.')],
    'śṛṇuyāma': [T('śru', 'may we hear', '5 (svādi)', 'vidhiliṅ', 1, BAHU)],
    'devāḥ': [S('deva', 'O gods', M, 8, BAHU)],
    'bhadram': [S('bhadra', 'what is auspicious', N, 2, EKA)],
    'paśyemā-kṣabhir': [
        T('dṛś', 'may we see', '1 (bhvādi)', 'vidhiliṅ', 1, BAHU,
          note='Suppletive present stem <em>paśya-</em>.'),
        S('akṣan', 'with the eyes', N, 3, BAHU,
          note='Vedic <em>akṣabhiḥ</em>, from the stem <em>akṣan / akṣi</em>.'),
    ],
    'yajatrāḥ': [S('yajatra', 'O worshipful ones', M, 8, BAHU)],
    'sthiraira-ṅgais': [
        S('sthira', 'with firm', N, 3, BAHU),
        S('aṅga', 'limbs', N, 3, BAHU),
    ],
    'tuṣṭuvām': [_TUSHTUVAMSAS],
    'sas': [_TUSHTUVAMSAS],
    'tanūbhiḥ': [S('tanū', 'with our bodies', F, 3, BAHU)],
    'vyaśema': [
        U('vi', 'apart, through'),
        T('aś', 'may we attain', '5 (svādi)', 'vidhiliṅ', 1, BAHU),
    ],
    'deva': [O('deva', 'god', _SPLIT + ' The compound is '
               '<em>devahita</em>, "allotted by the gods".')],
    'hitaṁ': [S('hita', 'allotted, granted', N, 2, EKA,
                note='Past passive participle of <em>√dhā</em>; second member '
                     'of <em>devahita</em>.')],
    'yadāyuḥ': [
        S('yad', 'whatever', N, 1, EKA),
        S('āyus', 'life-span', N, 1, EKA),
    ],

    # ── śānti pāṭha — Ṛgveda 1.89.6 ──────────────────────────────────────────
    'svasti': [S('svasti', 'well-being, prosperity', N, 2, EKA)],
    'na': [A('na', 'not')],
    'nas': [_asmad_nas()],
    'naḥ': [_asmad_nas()],
    'no': [_asmad_nas()],
    'indro': [S('indra', 'Indra', M, 1, EKA)],
    'vṛddha': [O('vṛddha', 'grown, great', _SPLIT + ' The compound is '
                 '<em>vṛddhaśravas</em>, "of great renown".')],
    'śravāḥ': [S('śravas', 'renown', N, 1, EKA,
                 note='Second member of the bahuvrīhi '
                      '<em>vṛddhaśravāḥ</em>, agreeing with Indra.')],
    'pūṣā': [S('pūṣan', 'Pūṣan', M, 1, EKA)],
    'viśva': [O('viśva', 'all', _SPLIT + ' The compound is '
                '<em>viśvavedas</em>, "all-knowing".')],
    'vedāḥ': [S('vedas', 'knowing', N, 1, EKA,
                note='Second member of the bahuvrīhi '
                     '<em>viśvavedāḥ</em>, agreeing with Pūṣan.')],
    'tārkṣyo': [S('tārkṣya', 'Tārkṣya, Garuḍa', M, 1, EKA)],
    'ariṣṭa': [O('ariṣṭa', 'unharmed', _SPLIT + ' The compound is '
                 '<em>ariṣṭanemi</em>, "whose wheel-rim is unbroken".')],
    'nemiḥ': [S('nemi', 'wheel-rim', M, 1, EKA,
                note='Second member of the bahuvrīhi '
                     '<em>ariṣṭanemiḥ</em>, an epithet of Tārkṣya.')],
    'bṛhaspatir': [S('bṛhaspati', 'Bṛhaspati', M, 1, EKA)],
    'dadhātu': [T('dhā', 'may he grant', '3 (juhotyādi)', 'loṭ', 3, EKA)],
    'śāntiś': [S('śānti', 'peace', F, 1, EKA)],
    'śāntiḥ': [S('śānti', 'peace', F, 1, EKA)],

    # ── mantra 1 ─────────────────────────────────────────────────────────────
    'laṁ': [O('laṁ', 'the bīja of the mūlādhāra cakra',
              'A seed syllable — sound, not a word, and so without grammar.')],
    'namaste': [
        S('namas', 'homage', N, 1, EKA),
        S('yuṣmad', 'to you', None, 4, EKA, note='The enclitic <em>te</em>.'),
    ],
    'gaṇapataye': [S('gaṇapati', 'to the lord of the gaṇas', M, 4, EKA)],
    'tvameva': [_tvam(), A('eva', 'indeed, alone')],
    'pratyakṣan': [A('pratyakṣam', 'manifestly, before the eyes')],
    'tattvamasi': [
        S('tattva', 'the Reality, that-ness', N, 1, EKA,
          note='The phrase also sounds the mahāvākya '
               '<em>tat tvam asi</em>, "that thou art".'),
        _asi(),
    ],
    'kevalaṅ': [A('kevalam', 'solely, absolutely')],
    'kartā\'si': [S('kartṛ', 'the maker', M, 1, EKA), _asi()],
    'kevalan': [A('kevalam', 'solely, absolutely')],
    'dhartā\'si': [S('dhartṛ', 'the upholder', M, 1, EKA), _asi()],
    'kevalaṁ': [A('kevalam', 'solely, absolutely')],
    'hartā\'si': [S('hartṛ', 'the destroyer', M, 1, EKA), _asi()],
    'sarvaṅ': [S('sarva', 'all', N, 1, EKA)],
    'khalvidam': [A('khalu', 'indeed'), S('idam', 'this', N, 1, EKA)],
    'brahmā\'si': [S('brahman', 'the Absolute', N, 1, EKA), _asi()],
    'tvaṁ': [_tvam()],
    'sākṣādā-tmā\'si': [
        A('sākṣāt', 'evidently, directly'),
        S('ātman', 'the Self', M, 1, EKA),
        _asi(),
    ],
    'nityamˎ': [A('nityam', 'always, everlastingly')],

    # ── mantra 2 ─────────────────────────────────────────────────────────────
    'ṛtaṁ': [S('ṛta', 'what is right', N, 2, EKA)],
    'vacmi': [T('vac', 'I say', '2 (adādi)', 'laṭ', 1, EKA)],
    'satyaṁ': [S('satya', 'what is true', N, 2, EKA)],

    # ── mantra 3 ─────────────────────────────────────────────────────────────
    'ava': [T('av', 'protect', '1 (bhvādi)', 'loṭ', 2, EKA)],
    'tvam': [_tvam()],
    'māmˎ': [S('asmad', 'me', None, 2, EKA)],
    'mām': [S('asmad', 'me', None, 2, EKA)],
    'vaktāramˎ': [S('vaktṛ', 'the speaker', M, 2, EKA)],
    'śrotāramˎ': [S('śrotṛ', 'the listener', M, 2, EKA)],
    'dātāramˎ': [S('dātṛ', 'the giver', M, 2, EKA)],
    'dhātāramˎ': [S('dhātṛ', 'the sustainer', M, 2, EKA)],
    'avā-nūcānama-va': [
        T('av', 'protect', '1 (bhvādi)', 'loṭ', 2, EKA),
        S('anūcāna', 'one who has recited the Veda', M, 2, EKA,
          note='Perfect participle of <em>anu-√vac</em>.'),
        T('av', 'protect', '1 (bhvādi)', 'loṭ', 2, EKA),
    ],
    'śiṣyamˎ': [S('śiṣya', 'the pupil', M, 2, EKA)],
    'paścāt': [A('paścāt', 'from behind')],
    'tātˎ': [A('tāt', 'from that quarter',
               'The Vedic ablatival adverb suffix <em>-tāt</em>. '
               '<em>paścāttāt</em>, <em>purastāt</em>, <em>uttarāttāt</em> are '
               'single adverbs; the source sets the suffix apart as it is '
               'recited.')],
    'puras': [A('puras', 'from in front')],
    'avo-ttarāt': [
        T('av', 'protect', '1 (bhvādi)', 'loṭ', 2, EKA),
        S('uttara', 'from the north', M, 5, EKA),
    ],
    'dakṣiṇāt': [S('dakṣiṇa', 'from the south', M, 5, EKA)],
    'co-rdhvāt': [A('ca', 'and'), S('ūrdhva', 'from above', M, 5, EKA)],
    'avā-dharāt': [
        T('av', 'protect', '1 (bhvādi)', 'loṭ', 2, EKA),
        S('adhara', 'from below', M, 5, EKA),
    ],
    'sarvato': [A('sarvatas', 'from all sides')],
    'pāhi': [T('pā', 'protect', '2 (adādi)', 'loṭ', 2, EKA)],
    'samantātˎ': [A('samantāt', 'from every side')],

    # ── mantra 4 ─────────────────────────────────────────────────────────────
    'vāṅmayas': [S('vāṅmaya', 'consisting of speech', M, 1, EKA)],
    'tvañ': [_tvam()],
    'cinmayaḥ': [S('cinmaya', 'consisting of consciousness', M, 1, EKA)],
    'tvamā-nandamayas': [
        _tvam(), S('ānandamaya', 'consisting of bliss', M, 1, EKA)],
    'brahmamayaḥ': [S('brahmamaya', 'consisting of the Absolute', M, 1, EKA)],
    'saccidānandā-dvitīyo\'si': [
        S('saccidānanda', 'being, consciousness and bliss', M, 1, EKA),
        S('advitīya', 'without a second', M, 1, EKA),
        _asi(),
    ],
    'pratyakṣam': [A('pratyakṣam', 'manifestly, before the eyes')],
    'brahmā-si': [S('brahman', 'the Absolute', N, 1, EKA), _asi()],
    'jñānamayo': [S('jñānamaya', 'consisting of knowledge', M, 1, EKA)],
    'vijñānamayo\'si': [
        S('vijñānamaya', 'consisting of discernment', M, 1, EKA), _asi()],

    # ── mantra 5 ─────────────────────────────────────────────────────────────
    'sarvañ': [S('sarva', 'all', N, 1, EKA)],
    'jagadi-dan': [
        S('jagat', 'the moving world', N, 1, EKA),
        S('idam', 'this', N, 1, EKA),
    ],
    'tvatto': [S('yuṣmad', 'from you', None, 5, EKA)],
    'jāyate': [T('jan', 'is born', '4 (divādi)', 'laṭ', 3, EKA)],
    'tvattas': [S('yuṣmad', 'from you', None, 5, EKA)],
    'tiṣṭhati': [T('sthā', 'stands, endures', '1 (bhvādi)', 'laṭ', 3, EKA)],
    'tvayi': [S('yuṣmad', 'in you', None, 7, EKA)],
    'layame-ṣyati': [
        S('laya', 'dissolution', M, 2, EKA),
        T('i', 'will go', '2 (adādi)', 'lṛṭ', 3, EKA),
    ],
    'pratye-ti': [
        U('prati', 'back, towards'),
        T('i', 'returns', '2 (adādi)', 'laṭ', 3, EKA),
    ],
    'bhūmirā-po\'nalo\'nilo': [
        S('bhūmi', 'earth', F, 1, EKA),
        S('ap', 'the waters', F, 1, BAHU),
        S('anala', 'fire', M, 1, EKA),
        S('anila', 'wind', M, 1, EKA),
    ],
    'nabhaḥ': [S('nabhas', 'the sky', N, 1, EKA)],
    'catvāri': [S('catur', 'four', N, 2, BAHU)],
    'vāk': [S('vāc', 'of speech', F, 1, EKA,
              note='First member of <em>vākpadāni</em>, the four divisions of '
                   'speech: parā, paśyantī, madhyamā, vaikharī.')],
    'padāni': [S('pada', 'the divisions', N, 2, BAHU)],

    # ── mantra 6 ─────────────────────────────────────────────────────────────
    'tvaṅ': [_tvam()],
    'guṇatrayā-tītaḥ': [
        S('guṇatrayātīta', 'beyond the three guṇas', M, 1, EKA,
          note='<em>guṇa-traya-atīta</em>.')],
    'avasthātrayā-tītaḥ': [
        S('avasthātrayātīta', 'beyond the three states', M, 1, EKA,
          note='<em>avasthā-traya-atīta</em> — waking, dream and deep sleep.')],
    'tvan': [_tvam()],
    'dehatrayā-tītaḥ': [
        S('dehatrayātīta', 'beyond the three bodies', M, 1, EKA,
          note='<em>deha-traya-atīta</em> — kāraṇa, sūkṣma and sthūla śarīra.')],
    'kāla': [O('kāla', 'time', _SPLIT + ' The compound is '
               '<em>kālatrayātīta</em>, "beyond the three times".')],
    'trayā-tītaḥ': [
        S('trayātīta', 'beyond the three', M, 1, EKA,
          note='Second member of <em>kālatrayātītaḥ</em> — past, present and '
               'future.')],
    'mūlādhāre': [S('mūlādhāra', 'in the mūlādhāra cakra', M, 7, EKA)],
    'sthito\'si': [
        S('sthita', 'situated', M, 1, EKA,
          note='Past passive participle of <em>√sthā</em>.'),
        _asi(),
    ],
    'śaktitrayā-tmakaḥ': [
        S('śaktitrayātmaka', 'having the three powers as your nature',
          M, 1, EKA,
          note='<em>śakti-traya-ātmaka</em> — icchā, jñāna and kriyā.')],
    'tvāṁ': [S('yuṣmad', 'you', None, 2, EKA)],
    'yogino': [S('yogin', 'the yogins', M, 1, BAHU)],
    'dhyāyanti': [T('dhyai', 'meditate upon', '1 (bhvādi)', 'laṭ', 3, BAHU)],
    'nityaṁ': [A('nityam', 'always')],
    'brahmā': [S('brahman', 'Brahmā', M, 1, EKA)],
    'viṣṇus': [S('viṣṇu', 'Viṣṇu', M, 1, EKA)],
    'rudras': [S('rudra', 'Rudra', M, 1, EKA)],
    'tvami-ndras': [_tvam(), S('indra', 'Indra', M, 1, EKA)],
    'tvama-gnis': [_tvam(), S('agni', 'Agni', M, 1, EKA)],
    'vāyus': [S('vāyu', 'Vāyu', M, 1, EKA)],
    'sūryas': [S('sūrya', 'Sūrya', M, 1, EKA)],
    'candramās': [S('candramas', 'the moon', M, 1, EKA)],
    'brahma': [S('brahman', 'the Absolute', N, 1, EKA)],
    'bhūrbhuvas': [
        S('bhū', 'earth', F, 1, EKA, note='The first vyāhṛti.'),
        S('bhuvas', 'the mid-region', N, 1, EKA,
          note='The second vyāhṛti.'),
    ],
    'svaromˎ': [
        A('svar', 'the heavenly region', 'The third vyāhṛti.'),
        A('oṁ', 'the praṇava, the sacred syllable'),
    ],

    # ── mantra 7 — the gaṇeśa vidyā ──────────────────────────────────────────
    'gaṇā-dim': [
        O('gaṇa', 'the word "gaṇa"'),
        S('ādi', 'the beginning of', M, 2, EKA,
          note='<em>gaṇādim</em> — the first sound of <em>gaṇa</em>, i.e. '
               '<em>g</em>.'),
    ],
    'pūrvamu-ccārya': [
        A('pūrvam', 'first, beforehand'),
        U('ud', 'up, out'),
        T('car', 'having pronounced', '1 (bhvādi), caus. uccāraya-', 'lyap',
          3, EKA, note='Gerund in <em>-ya</em> after a preverb.'),
    ],
    'varṇā-din': [
        O('varṇa', 'the alphabet'),
        S('ādi', 'the beginning of', M, 2, EKA,
          note='<em>varṇādim</em> — the first letter of the alphabet, i.e. '
               '<em>a</em>.'),
    ],
    'tadanantaramˎ': [A('tadanantaram', 'immediately after that')],
    'anusvāraḥ': [S('anusvāra', 'the anusvāra', M, 1, EKA)],
    'parataraḥ': [S('paratara', 'coming after, beyond', M, 1, EKA)],
    'ardhendu': [O('ardhendu', 'the crescent moon',
                   _SPLIT + ' The compound is <em>ardhendulasita</em>.')],
    'lasitamˎ': [S('lasita', 'adorned with', N, 1, EKA,
                   note='Past participle of <em>√las</em>; second member of '
                        '<em>ardhendulasitam</em>.')],
    'tāreṇa': [S('tāra', 'by the praṇava', M, 3, EKA,
                 note='<em>tāra</em> is a name of <em>oṁ</em>.')],
    'ṛddhamˎ': [S('ṛddha', 'made to resound, enriched', N, 1, EKA,
                  note='Past passive participle of <em>√ṛdh</em>.')],
    'etat': [S('etad', 'this', N, 1, EKA)],
    'tava': [S('yuṣmad', 'your', None, 6, EKA)],
    'manu': [O('manu', 'incantation',
               _SPLIT + ' The compound is <em>manusvarūpa</em>, "the form of '
               'the mantra".')],
    'svarūpamˎ': [S('svarūpa', 'own form', N, 1, EKA)],
    'gakāraḥ': [S('gakāra', 'the letter ga', M, 1, EKA)],
    'pūrva': [O('pūrva', 'prior', _SPLIT + ' The compound is '
                '<em>pūrvarūpa</em>.')],
    'rūpamˎ': [S('rūpa', 'form', N, 1, EKA)],
    'akāro': [S('akāra', 'the letter a', M, 1, EKA)],
    'madhyama': [O('madhyama', 'middle', _SPLIT + ' The compound is '
                   '<em>madhyamarūpa</em>.')],
    'anusvāraś': [S('anusvāra', 'the anusvāra', M, 1, EKA)],
    'cā-ntya': [A('ca', 'and'),
                O('antya', 'last', _SPLIT + ' The compound is '
                  '<em>antyarūpa</em>.')],
    'binduru-ttara': [
        S('bindu', 'the dot', M, 1, EKA),
        O('uttara', 'upper, following', _SPLIT + ' The compound is '
          '<em>uttararūpa</em>.'),
    ],
    'nādas': [S('nāda', 'the subtle sound', M, 1, EKA)],
    'sandhānamˎ': [S('sandhāna', 'the joining', N, 1, EKA)],
    'samhitā': [S('saṁhitā', 'close conjunction', F, 1, EKA)],
    'sandhiḥ': [S('sandhi', 'the euphonic junction', M, 1, EKA)],
    'saiṣā': [S('tad', 'that', F, 1, EKA), S('etad', 'this', F, 1, EKA)],
    'gāṇeśavidyā': [S('gāṇeśavidyā', 'the knowledge of Gaṇeśa', F, 1, EKA)],
    'gaṇaka': [S('gaṇaka', 'Gaṇaka', M, 1, EKA)],
    'ṛṣiḥ': [S('ṛṣi', 'is the seer', M, 1, EKA)],
    'nicṛdgāyatrī': [S('nicṛdgāyatrī', 'the nicṛd-gāyatrī metre', F, 1, EKA)],
    'chandaḥ': [S('chandas', 'is the metre', N, 1, EKA)],
    'śrī': [O('śrī', 'venerable', 'Honorific prefixed to the deity’s '
              'name.')],
    'mahāgaṇapatir': [S('mahāgaṇapati', 'Mahāgaṇapati', M, 1, EKA)],
    'devatā': [S('devatā', 'is the deity', F, 1, EKA)],
    'gaṁ': [O('gaṁ', 'the bīja of Gaṇapati',
              'A seed syllable — sound, not a word, and so without grammar.')],
    'namaḥ': [S('namas', 'homage', N, 1, EKA)],

    # ── mantra 8 — the gaṇeśa gāyatrī ────────────────────────────────────────
    'ekadantāya': [S('ekadanta', 'to the single-tusked one', M, 4, EKA)],
    'vidmahe': [T('vid', 'may we know', '2 (adādi)', 'laṭ', 1, BAHU)],
    'vakratuṇḍāya': [S('vakratuṇḍa', 'to the curved-trunked one', M, 4, EKA)],
    'dhīmahi': [T('dhī', 'may we meditate', '3 (juhotyādi)', 'āśīrliṅ', 1,
                  BAHU)],
    'tan': [S('tad', 'that', N, 1, EKA)],
    'dantī': [S('dantin', 'the tusked one', M, 1, EKA)],
    'pracodayātˎ': [
        U('pra', 'forth'),
        T('cud', 'may he impel', '10 (curādi), caus. codaya-', 'vidhiliṅ', 3,
          EKA),
    ],

    # ── mantra 9 — the form of Gaṇeśa ────────────────────────────────────────
    'ekadantañ': [S('ekadanta', 'the single-tusked one', M, 2, EKA)],
    'caturhastam': [S('caturhasta', 'four-handed', M, 2, EKA)],
    'pāśama-ṅkuśa': [
        S('pāśa', 'a noose', M, 2, EKA),
        O('aṅkuśa', 'a goad', _SPLIT + ' The compound is '
          '<em>aṅkuśadhāriṇam</em>.'),
    ],
    'dhāriṇamˎ': [S('dhārin', 'bearing', M, 2, EKA)],
    'radañ': [S('rada', 'a tusk', M, 2, EKA)],
    'ca': [A('ca', 'and')],
    'varadaṁ': [S('varada', 'the boon-giving gesture', M, 2, EKA)],
    'hastair': [S('hasta', 'with his hands', M, 3, BAHU)],
    'bibhrāṇam': [S('bibhrāṇa', 'bearing', M, 2, EKA,
                    note='Present middle participle of <em>√bhṛ</em>.')],
    'mūṣaka': [O('mūṣaka', 'a mouse', _SPLIT + ' The compound is '
                 '<em>mūṣakadhvaja</em>.')],
    'dhvajamˎ': [S('dhvaja', 'as his banner', M, 2, EKA)],
    'raktaṁ': [S('rakta', 'red', M, 2, EKA)],
    'lambo-daraṁ': [S('lambodara', 'the pendulous-bellied one', M, 2, EKA)],
    'śūrpa': [O('śūrpa', 'a winnowing basket', _SPLIT + ' The compound is '
                '<em>śūrpakarṇaka</em>.')],
    'karṇakaṁ': [S('karṇaka', 'eared', M, 2, EKA,
                   note='Second member of <em>śūrpakarṇakam</em>, "with ears '
                        'like winnowing baskets".')],
    'rakta': [O('rakta', 'red')],
    'vāsasamˎ': [S('vāsas', 'garment', N, 2, EKA,
                   note='Second member of the bahuvrīhi '
                        '<em>raktavāsasam</em>, "red-robed".')],
    'gandhā-nuliptā-ṅgaṁ': [
        S('gandhānuliptāṅga', 'his limbs anointed with fragrance', M, 2, EKA,
          note='<em>gandha-anulipta-aṅga</em>.')],
    'puṣpais': [S('puṣpa', 'with flowers', N, 3, BAHU)],
    'supūjitamˎ': [S('supūjita', 'well worshipped', M, 2, EKA)],
    'bhaktā-nukampinan': [
        S('bhaktānukampin', 'compassionate to his devotees', M, 2, EKA)],
    'devañ': [S('deva', 'the god', M, 2, EKA)],
    'jagat': [O('jagat', 'of the world', _SPLIT + ' The compound is '
                '<em>jagatkāraṇa</em>.')],
    'kāraṇama-cyutamˎ': [
        S('kāraṇa', 'the cause', N, 2, EKA),
        S('acyuta', 'imperishable', N, 2, EKA),
    ],
    'āvirbhūtañ': [S('āvirbhūta', 'having become manifest', M, 2, EKA,
                     note='<em>āvis</em> + past participle of '
                          '<em>√bhū</em>.')],
    'sṛṣṭyā-dau': [S('sṛṣṭyādi', 'at the beginning of creation', M, 7, EKA,
                     note='<em>sṛṣṭi-ādi</em>.')],
    'prakṛteḥ': [S('prakṛti', 'than primordial nature', F, 5, EKA)],
    'puruṣāt': [S('puruṣa', 'than the Puruṣa', M, 5, EKA)],
    'paramˎ': [S('para', 'higher', N, 2, EKA)],
    'evan': [A('evam', 'thus')],
    'dhyāyati': [T('dhyai', 'meditates', '1 (bhvādi)', 'laṭ', 3, EKA)],
    'yo': [S('yad', 'who', M, 1, EKA)],
    'sa': [S('tad', 'he', M, 1, EKA)],
    'yogī': [S('yogin', 'a yogin', M, 1, EKA)],
    'yogināṁ': [S('yogin', 'of the yogins', M, 6, BAHU)],
    'varaḥ': [S('vara', 'the best', M, 1, EKA)],

    # ── mantra 10 — the eight names ──────────────────────────────────────────
    'namo': [S('namas', 'homage', N, 1, EKA)],
    'vrātapataye': [S('vrātapati', 'to the lord of the hosts', M, 4, EKA)],
    'pramathapataye': [
        S('pramathapati', 'to the lord of the pramathas', M, 4, EKA,
          note='The pramathas are Śiva’s attendants.')],
    'namaste\'stu': [
        S('namas', 'homage', N, 1, EKA),
        S('yuṣmad', 'to you', None, 4, EKA, note='The enclitic <em>te</em>.'),
        T('as', 'let there be', '2 (adādi)', 'loṭ', 3, EKA),
    ],
    'lambo-darāyai-kadantāya': [
        S('lambodara', 'to the pendulous-bellied one', M, 4, EKA),
        S('ekadanta', 'to the single-tusked one', M, 4, EKA),
    ],
    'vighnavināśine': [
        S('vighnavināśin', 'to the destroyer of obstacles', M, 4, EKA)],
    'śivasutāya': [S('śivasuta', 'to the son of Śiva', M, 4, EKA)],
    'varadamūrtaye': [
        S('varadamūrti', 'to the embodiment of boon-giving', M, 4, EKA)],

    # ── mantra 11 — the phalaśruti ───────────────────────────────────────────
    'etada-tharvaśīrṣaṁ': [
        S('etad', 'this', N, 2, EKA),
        S('atharvaśīrṣa', 'Atharvaśīrṣa', N, 2, EKA),
    ],
    'yo\'dhīte': [
        S('yad', 'who', M, 1, EKA),
        U('adhi', 'over, upon'),
        T('i', 'studies, recites', '2 (adādi)', 'laṭ', 3, EKA),
    ],
    'bhūyāya': [S('bhūya', 'for becoming', N, 4, EKA,
                  note='Second member of <em>brahmabhūyāya</em>, "for '
                       'becoming the Absolute".')],
    'kalpate': [T('kḷp', 'is fit', '1 (bhvādi)', 'laṭ', 3, EKA)],
    'sarva': [O('sarva', 'all', _SPLIT + ' The compound is '
                '<em>sarvavighna</em>.')],
    'vighnair': [S('vighna', 'by obstacles', M, 3, BAHU)],
    'bādhyate': [T('bādh', 'is obstructed', '1 (bhvādi)', 'laṭ', 3, EKA,
                   note='Passive (karmaṇi prayoga).')],
    'sarvatra': [A('sarvatra', 'everywhere')],
    'sukhame-dhate': [
        S('sukha', 'happiness', N, 2, EKA),
        T('edh', 'increases', '1 (bhvādi)', 'laṭ', 3, EKA),
    ],
    'pañca': [O('pañcan', 'five', _SPLIT + ' The compound is '
                '<em>pañcamahāpāpa</em>.')],
    'mahāpāpāt': [S('mahāpāpa', 'from the great sin', N, 5, EKA)],
    'pramucyate': [
        U('pra', 'forth, completely'),
        T('muc', 'is released', '6 (tudādi)', 'laṭ', 3, EKA,
          note='Passive (karmaṇi prayoga).'),
    ],
    'sāyama-dhīyāno': [
        A('sāyam', 'in the evening'),
        U('adhi', 'over, upon'),
        S('adhīyāna', 'studying', M, 1, EKA,
          note='Present middle participle of <em>adhi-√i</em>.'),
    ],
    'divasa': [O('divasa', 'day', _SPLIT + ' The compound is '
                 '<em>divasakṛta</em>, "done by day".')],
    'kṛtam': [S('kṛta', 'done', N, 2, EKA)],
    'pāpan': [S('pāpa', 'sin', N, 2, EKA)],
    'nāśayati': [T('naś', 'destroys', '4 (divādi), caus. nāśaya-', 'laṭ', 3,
                   EKA)],
    'prātara-dhīyāno': [
        A('prātar', 'at dawn'),
        U('adhi', 'over, upon'),
        S('adhīyāna', 'studying', M, 1, EKA,
          note='Present middle participle of <em>adhi-√i</em>.'),
    ],
    'rātri': [O('rātri', 'night', _SPLIT + ' The compound is '
                '<em>rātrikṛta</em>, "done by night".')],
    'sāyam': [A('sāyam', 'in the evening')],
    'prātaḥ': [A('prātar', 'at dawn')],
    'prayuñjāno': [
        U('pra', 'forth'),
        S('prayuñjāna', 'applying himself', M, 1, EKA,
          note='Present middle participle of <em>pra-√yuj</em>.'),
    ],
    'pāpo\'pāpo': [
        S('pāpa', 'the sinner', M, 1, EKA),
        S('apāpa', 'free from sin', M, 1, EKA),
    ],
    'bhavati': [T('bhū', 'becomes', '1 (bhvādi)', 'laṭ', 3, EKA)],
    'sarvatrā-dhīyāno\'pavighno': [
        A('sarvatra', 'everywhere'),
        S('adhīyāna', 'studying', M, 1, EKA,
          note='Present middle participle of <em>adhi-√i</em>.'),
        S('apavighna', 'free from obstacles', M, 1, EKA),
    ],
    'dharmā-rtha': [
        O('dharma', 'righteousness'),
        O('artha', 'wealth', 'A dvandva the source writes with spaces: '
          '<em>dharma-artha-kāma-mokṣam</em>.'),
    ],
    'kāma': [O('kāma', 'desire')],
    'mokṣañ': [S('mokṣa', 'liberation', M, 2, EKA,
                 note='The member of the dvandva that carries the ending.')],
    'vindati': [T('vid', 'obtains', '6 (tudādi)', 'laṭ', 3, EKA)],
    'idama-tharvaśīrṣama-śiṣyāya': [
        S('idam', 'this', N, 1, EKA),
        S('atharvaśīrṣa', 'Atharvaśīrṣa', N, 1, EKA),
        S('aśiṣya', 'to a non-disciple', M, 4, EKA),
    ],
    'deyamˎ': [S('deya', 'to be given', N, 1, EKA,
                 note='Gerundive of <em>√dā</em>.')],
    'yadi': [A('yadi', 'if')],
    'mohād': [S('moha', 'out of delusion', M, 5, EKA)],
    'dāsyati': [T('dā', 'will give', '3 (juhotyādi)', 'lṛṭ', 3, EKA)],
    'pāpīyān': [S('pāpīyas', 'the more sinful', M, 1, EKA,
                  note='Comparative of <em>pāpa</em>.')],
    'sahasrā-vartanād': [
        S('sahasrāvartana', 'from a thousand repetitions', N, 5, EKA,
          note='<em>sahasra-āvartana</em>.')],
    'yaṁ': [S('yad', 'whatever', M, 2, EKA)],
    'yaṅ': [S('yad', 'whatever', M, 2, EKA,
              note='The repetition <em>yaṁ yaṁ</em> is distributive: '
                   '"whichever".')],
    'kāmama-dhīte': [
        S('kāma', 'desire', M, 2, EKA),
        U('adhi', 'over, upon'),
        T('i', 'studies, recites', '2 (adādi)', 'laṭ', 3, EKA),
    ],
    'tama-nena': [
        S('tad', 'that', M, 2, EKA),
        S('idam', 'by this', N, 3, EKA),
    ],
    'sādhayetˎ': [T('sādh', 'he may accomplish',
                    '5 (svādi), caus. sādhaya-', 'vidhiliṅ', 3, EKA)],

    # ── mantra 12 ────────────────────────────────────────────────────────────
    'anena': [S('idam', 'with this', N, 3, EKA)],
    'gaṇapatima-bhiṣiñcati': [
        S('gaṇapati', 'Gaṇapati', M, 2, EKA),
        U('abhi', 'towards, over'),
        T('sic', 'sprinkles, consecrates', '6 (tudādi)', 'laṭ', 3, EKA),
    ],
    'vāgmī': [S('vāgmin', 'eloquent', M, 1, EKA)],
    'caturthyāma-naśnan': [
        S('caturthī', 'on the fourth lunar day', F, 7, EKA),
        S('anaśnat', 'not eating', M, 1, EKA,
          note='Negated present participle of <em>√aś</em> — i.e. fasting.'),
    ],
    'japati': [T('jap', 'mutters, recites', '1 (bhvādi)', 'laṭ', 3, EKA)],
    'vidyāvān': [S('vidyāvat', 'possessed of knowledge', M, 1, EKA)],
    'itya-tharvaṇa': [
        A('iti', 'thus'),
        O('atharvaṇa', 'of Atharvan', _SPLIT + ' The compound is '
          '<em>atharvaṇavākya</em>.'),
    ],
    'vākyamˎ': [S('vākya', 'the word, the statement', N, 1, EKA)],
    'brahmā-dyā-varaṇaṁ': [
        S('brahmādyāvaraṇa', 'the covering that begins with Brahmā', N, 2, EKA,
          note='<em>brahma-ādi-āvaraṇa</em>.')],
    'vidyān': [T('vid', 'he should know', '2 (adādi)', 'vidhiliṅ', 3, EKA)],
    'bibheti': [T('bhī', 'fears', '3 (juhotyādi)', 'laṭ', 3, EKA)],
    'kadācane-ti': [A('kadācana', 'at any time'), A('iti', 'thus')],

    # ── mantra 13 ────────────────────────────────────────────────────────────
    'dūrvā-ṅkurair': [
        S('dūrvāṅkura', 'with dūrvā shoots', M, 3, BAHU,
          note='<em>dūrvā-aṅkura</em> — the sacred bent grass.')],
    'yajati': [T('yaj', 'worships, sacrifices', '1 (bhvādi)', 'laṭ', 3, EKA)],
    'vaiśravaṇo-pamo': [
        S('vaiśravaṇopama', 'like Vaiśravaṇa', M, 1, EKA,
          note='<em>vaiśravaṇa-upama</em> — Kubera, the lord of wealth.')],
    'lājair': [S('lāja', 'with parched grain', M, 3, BAHU)],
    'yaśovān': [S('yaśovat', 'famous', M, 1, EKA)],
    'medhāvān': [S('medhāvin', 'wise', M, 1, EKA)],
    'modaka': [O('modaka', 'modaka sweets', _SPLIT + ' The compound is '
                 '<em>modakasahasra</em>.')],
    'sahasreṇa': [S('sahasra', 'with a thousand', N, 3, EKA)],
    'vāñchita': [O('vāñchita', 'desired', _SPLIT + ' The compound is '
                   '<em>vāñchitaphala</em>.')],
    'phalama-vāpnoti': [
        S('phala', 'the fruit', N, 2, EKA),
        U('ava', 'down, away'),
        T('āp', 'obtains', '5 (svādi)', 'laṭ', 3, EKA),
    ],
    'yas': [S('yad', 'who', M, 1, EKA)],
    'sājya': [O('sājya', 'together with ghee',
                '<em>sa-ājya</em>. ' + _SPLIT + ' The compound is '
                '<em>sājyasamidh</em>.')],
    'samidbhir': [S('samidh', 'with kindling sticks', F, 3, BAHU)],
    'sarvaṁ': [S('sarva', 'everything', N, 2, EKA)],
    'labhate': [T('labh', 'obtains', '1 (bhvādi)', 'laṭ', 3, EKA)],

    # ── mantra 14 ────────────────────────────────────────────────────────────
    'aṣṭau': [S('aṣṭan', 'eight', M, 2, BAHU)],
    'brāhmaṇān': [S('brāhmaṇa', 'brāhmaṇas', M, 2, BAHU)],
    'samyag': [A('samyak', 'properly, thoroughly')],
    'grāhayitvā': [T('grah', 'having caused to learn',
                     '9 (kryādi), caus. grāhaya-', 'ktvā', 3, EKA)],
    'sūrya': [O('sūrya', 'the sun')],
    'varcasvī': [S('varcasvin', 'lustrous', M, 1, EKA,
                   note='Second member of <em>sūryavarcasvī</em>, "lustrous '
                        'as the sun".')],
    'grahe': [S('graha', 'at the eclipse', M, 7, EKA,
                note='Second member of <em>sūryagrahe</em>, "at a solar '
                     'eclipse".')],
    'mahānadyām': [S('mahānadī', 'on a great river', F, 7, EKA)],
    'pratimā': [O('pratimā', 'an image', _SPLIT + ' The compound is '
                  '<em>pratimāsannidhi</em>.')],
    'sannidhau': [S('sannidhi', 'in the presence of', M, 7, EKA)],
    'vā': [A('vā', 'or')],
    'japtvā': [T('jap', 'having muttered', '1 (bhvādi)', 'ktvā', 3, EKA)],
    'siddhamantro': [S('siddhamantra', 'one whose mantra is accomplished',
                       M, 1, EKA)],
    'mahāvighnāt': [S('mahāvighna', 'from the great obstacle', M, 5, EKA)],
    'mahādoṣāt': [S('mahādoṣa', 'from the great affliction', M, 5, EKA)],
    'mahāpratyavāyāt': [
        S('mahāpratyavāya', 'from the great detriment', M, 5, EKA)],
    'sarvavid': [S('sarvavid', 'all-knowing', M, 1, EKA)],
    'ya': [S('yad', 'who', M, 1, EKA)],
    'evaṁ': [A('evam', 'thus')],
    'veda': [T('vid', 'knows', '2 (adādi)', 'laṭ', 3, EKA)],
    'ityu-paniṣatˎ': [
        A('iti', 'thus'),
        S('upaniṣad', 'the upaniṣad', F, 1, EKA),
    ],
}


#: Homographs — the surface is the same, the word is not.
#: `svasti na indraḥ` is the enclitic <em>naḥ</em> of `asmad`, not the negative
#: particle, and it stands in both śānti pāṭhas.
OVERRIDES = {
    ('santi-patha-v2', 1, 'na'): [_asmad_nas()],
    ('santi-patha-2-v2', 1, 'na'): [_asmad_nas()],
}
