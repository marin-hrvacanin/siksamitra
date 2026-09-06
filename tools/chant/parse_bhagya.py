# -*- coding: utf-8 -*-
"""Convert the Durga Suktam importer HTML -> vedaunion.chant v2 JSON (mirrors purusha)."""
import json, re, unicodedata
from html.parser import HTMLParser
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate

SCRATCH = r"C:\Users\marin\AppData\Local\Temp\claude\D--Projects-vedaunion\e84b47d8-cfb9-41b6-b655-5f9b4fa03ab9\scratchpad"
HTML_IN = SCRATCH + r"\bhagya.html"
JSON_OUT = r"D:\Projects\vedaunion\app\client\public\chants\bhagya-suktam.json"

SVARA_MARK = {'\u0331': 'anudatta', '\u030d': 'svarita', '\u030e': 'dirgha-svarita'}
STRIP_SVARA = set(SVARA_MARK) | {'\u0951', '\u0952', '\u0310'}
DROP_CHARS = {'\u02ce'}  # modifier letter low grave (typographic artifact)

MULTI = ['kh', 'gh', 'ch', 'jh', '\u1e6dh', '\u1e0dh', 'th', 'dh', 'ph', 'bh', 'ai', 'au']
VOWELS = set('a\u0101i\u012bu\u016b\u1e5b\u1e5d\u1e37\u1e39eo\u0113\u014d') | {'ai', 'au'}
CODA_CHARS = set('\u1e41\u1e43\u1e25-\u1e96\u1e2b')  # anusvara(dot-above), anusvara(dot-below), visarga, hyphen, upadhmaniya
KNOWN = set('kgcjtdnpbmyrlvsh') | set(
    '\u1e45\u00f1\u1e6d\u1e0d\u1e47\u015b\u1e63\u1e41\u1e43\u1e25\u1e5b\u1e5d\u1e37\u1e39'
    'a\u0101i\u012bu\u016beo\u0113\u014d\u1e3b\u1e96\u1e2b') | {'-'}


def norm_translit(iast):
    s = ''.join(c for c in iast if c not in STRIP_SVARA)
    s = s.replace('\u1e41', '\u1e43')  # anusvara dot-above -> dot-below for sanscript
    return s


def derive_scripts(iast):
    if iast == 'o\u1e41':  # om -> sacred glyphs (matches purusha)
        return '\u0950', '\u0c13\u0c02', '\u0bd0'
    if iast == "'":
        return '\u093d', '\u0c3d', '\u093d'
    b = norm_translit(iast)
    return (transliterate(b, sanscript.IAST, sanscript.DEVANAGARI),
            transliterate(b, sanscript.IAST, sanscript.TELUGU),
            transliterate(b, sanscript.IAST, sanscript.TAMIL))


# ---------------------------------------------------------------- HTML parse
class ParaParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.paras = []            # list of (cls, events)
        self.cur_cls = None
        self.events = None
        self.stack = []            # list of dicts describing open inline tags
        self.hold_counter = 0
        self.sup_buf = None        # collecting sup text

    def _flags(self):
        hold = None; hold_id = None; change = False; svara = False; pause = None; sup = False
        for f in self.stack:
            if f.get('hold'):
                hold = f['hold']; hold_id = f['hold_id']
            if f.get('change'):
                change = True
            if f.get('svara'):
                svara = True
            if f.get('pause'):
                pause = f['pause']
            if f.get('sup'):
                sup = True
        return hold, hold_id, change, svara, pause, sup

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        cls = d.get('class', '')
        if tag == 'p':
            self.cur_cls = cls.strip()
            self.events = []
            self.hold_counter = 0
            return
        if self.events is None:
            return
        frame = {'tag': tag}
        if tag == 'sup':
            frame['sup'] = True
            self.sup_buf = ''
        if 'ql-holding-short' in cls:
            self.hold_counter += 1
            frame['hold'] = 'short'; frame['hold_id'] = self.hold_counter
        elif 'ql-holding-long' in cls:
            self.hold_counter += 1
            frame['hold'] = 'long'; frame['hold_id'] = self.hold_counter
        if 'ql-change-style' in cls:
            frame['change'] = True
        if 'ql-svara-true' in cls:
            frame['svara'] = True
        if 'ql-short-pause' in cls:
            frame['pause'] = 'short'
        if 'ql-long-pause' in cls:
            frame['pause'] = 'long'
        self.stack.append(frame)

    def handle_endtag(self, tag):
        if tag == 'p':
            if self.events is not None:
                self.paras.append((self.cur_cls, self.events))
            self.events = None
            self.cur_cls = None
            return
        if self.events is None or not self.stack:
            return
        frame = self.stack.pop()
        if frame.get('sup'):
            self.events.append({'kind': 'sup', 'text': self.sup_buf or ''})
            self.sup_buf = None

    def handle_data(self, data):
        if self.events is None:
            return
        hold, hold_id, change, svara, pause, sup = self._flags()
        if '\x01' in data:
            # U+0001 is the candrabindu marker glyph (Yajurveda gṁ nasalisation)
            for ch in data:
                if ch == '\x01':
                    self.events.append({'kind': 'candra'})
                elif not ch.isspace():
                    self.events.append({'kind': 'text', 'text': ch, 'hold': hold,
                                        'hold_id': hold_id, 'change': change})
            return
        if pause:
            if '|' in data:
                self.events.append({'kind': 'pause', 'len': pause})
            return
        if svara:
            for ch in data:
                if ch in SVARA_MARK:
                    self.events.append({'kind': 'svara', 'name': SVARA_MARK[ch]})
            return
        if sup:
            self.sup_buf = (self.sup_buf or '') + data
            return
        self.events.append({'kind': 'text', 'text': data, 'hold': hold,
                            'hold_id': hold_id, 'change': change})


def para_text(events):
    return ''.join(e['text'] for e in events if e['kind'] == 'text')


# ---------------------------------------------------------------- tokenize
def strip_annotations(text):
    text = text.replace('svarabhakti', '')
    for q in ('\u201c', '"'):
        if q in text:
            text = text[:text.index(q)]
    text = ''.join(c for c in text if c not in DROP_CHARS and not unicodedata.combining(c)
                   and ord(c) >= 32)
    return text


def tokenize_iast(text):
    out = []
    i = 0
    n = len(text)
    while i < n:
        two = text[i:i + 2]
        if two in MULTI:
            out.append(('letter', two)); i += 2; continue
        c = text[i]
        if c == ' ':
            out.append(('space',)); i += 1; continue
        if c == '\u0964':
            out.append(('danda', '\u0964')); i += 1; continue
        if c == '\u0965':
            out.append(('danda', '\u0965')); i += 1; continue
        if c.isdigit():
            out.append(('digit', c)); i += 1; continue
        if c in ("'", '\u2019'):
            out.append(('avagraha',)); i += 1; continue
        if c == '\u00b7':
            out.append(('sbhakti',)); i += 1; continue
        if c in ('.', ',', '(', ')', ';', ':'):
            i += 1; continue  # stray punctuation from notes
        out.append(('letter', c)); i += 1
    return out


def is_vowel(c):
    return c in VOWELS


def is_coda(u):
    return u.get('candra') or u['c'] in CODA_CHARS


def syllabify(units):
    if not units:
        return []
    vpos = [k for k, u in enumerate(units) if is_vowel(u['c'])]
    if not vpos:
        return [units]
    syls = []
    start = 0
    for idx, vp in enumerate(vpos):
        last = idx == len(vpos) - 1
        j = vp + 1
        while j < len(units) and is_coda(units[j]):
            j += 1
        end = len(units) if last else j
        syls.append(units[start:end])
        start = end
    if start < len(units):  # trailing (shouldn't happen)
        syls[-1] = syls[-1] + units[start:]
    return syls


def make_syl(units):
    iast = ''.join(u['c'] for u in units)
    deva, tel, tam = derive_scripts(iast)
    out_units = []
    for u in units:
        d = {'c': u['c']}
        if u.get('hold'):
            d['hold'] = u['hold']
            d['hg'] = u['hg']
        if u.get('change'):
            d['change'] = True
        if u.get('svara'):
            d['svara'] = u['svara']
        if u.get('sup'):
            d['sup'] = u['sup']
        if u.get('candra'):
            d['candra'] = True
        if u.get('sbhakti'):
            d['sbhakti'] = True
        out_units.append(d)
    return {'t': 'syl', 'units': out_units, 'iast': iast,
            'deva': deva, 'tel': tel, 'tam': tam}


AVAGRAHA_SYL = {'t': 'syl', 'units': [{'c': "'"}], 'iast': "'",
                'deva': '\u093d', 'tel': '\u0c3d', 'tam': '\u093d'}


def events_to_items(events):
    """events (one shloka line) -> flat item list with letter-units + separators."""
    items = []
    pending_sbhakti = False
    for ev in events:
        k = ev['kind']
        if k == 'text':
            txt = strip_annotations(ev['text'])
            for tok in tokenize_iast(txt):
                t = tok[0]
                if t == 'letter':
                    u = {'c': tok[1], 'hold': ev.get('hold'),
                         'hg': ev.get('hold_id'), 'change': ev.get('change'),
                         'svara': None, 'sup': '', 'candra': False,
                         'sbhakti': pending_sbhakti}
                    pending_sbhakti = False
                    items.append({'kind': 'letter', 'u': u})
                elif t == 'space':
                    items.append({'kind': 'space'})
                elif t == 'danda':
                    items.append({'kind': 'danda', 's': tok[1]})
                elif t == 'digit':
                    items.append({'kind': 'digit', 'c': tok[1]})
                elif t == 'avagraha':
                    items.append({'kind': 'avagraha'})
                elif t == 'sbhakti':
                    pending_sbhakti = True
        elif k == 'svara':
            for it in reversed(items):
                if it['kind'] == 'letter':
                    it['u']['svara'] = ev['name']
                    break
        elif k == 'sup':
            for it in reversed(items):
                if it['kind'] == 'letter':
                    it['u']['sup'] = (it['u']['sup'] or '') + ev['text']
                    break
        elif k == 'candra':
            u = {'c': 'm', 'hold': None, 'hg': None, 'change': True,
                 'svara': None, 'sup': '', 'candra': True, 'sbhakti': False}
            items.append({'kind': 'letter', 'u': u})
        elif k == 'pause':
            items.append({'kind': 'pause', 'len': ev['len']})
    return items


def items_to_tokens(items):
    tokens = []
    run = []

    def flush():
        for syl_units in syllabify(run):
            tokens.append(make_syl(syl_units))
        run.clear()

    i = 0
    while i < len(items):
        it = items[i]
        k = it['kind']
        if k == 'letter':
            run.append(it['u'])
            i += 1
            continue
        flush()
        if k == 'space':
            tokens.append({'t': 'sp'})
        elif k == 'pause':
            tokens.append({'t': 'pause', 'len': it['len']})
        elif k == 'avagraha':
            tokens.append(dict(AVAGRAHA_SYL))
        elif k == 'danda':
            # detect verse-number pattern: danda(0965) [space] digits danda(0965)
            if it['s'] == '\u0965':
                j = i + 1
                digits = ''
                seen_space = False
                while j < len(items):
                    kj = items[j]['kind']
                    if kj == 'space' and not digits:
                        seen_space = True; j += 1; continue
                    if kj == 'digit':
                        digits += items[j]['c']; j += 1; continue
                    break
                if digits and j < len(items) and items[j]['kind'] == 'danda' and items[j]['s'] == '\u0965':
                    tokens.append({'t': 'danda', 's': '\u0965'})
                    tokens.append({'t': 'num', 's': digits})
                    tokens.append({'t': 'danda', 's': '\u0965'})
                    i = j + 1
                    continue
            tokens.append({'t': 'danda', 's': it['s']})
        elif k == 'digit':
            pass  # stray digit not part of verse number -> drop
        i += 1
    flush()
    return tokens


def verse_end_number(events):
    """Return (ended, number|None). Verse ends when line has a double danda 0965."""
    txt = para_text(events)
    if '\u0965' not in txt:
        return (False, None)
    m = re.search(r'\u0965\s*(\d+)\s*\u0965', txt)
    if m:
        return (True, m.group(1))
    return (True, None)


# ---------------------------------------------------------------- build doc
def strip_cite(text):
    """Drop a trailing source citation like 'RV 1.99', 'AVS 7.63', 'TA 10.2', 'DV'."""
    text = text.strip()
    m = re.search(r'\s+([A-Z\u1e5a\u015a\u1e62][\w\u015b\u1e5b\u1e62\u015a\u1e5a.\u0301]*'
                  r'(?:\s?[\d]+(?:\.\d+)*)?)\s*$', text)
    if m:
        cand = m.group(1)
        # only strip if it looks like an abbreviation (<=6 leading letters, has digits or all-caps-ish)
        lead = re.match(r'[A-Za-z\u1e5a\u015a\u1e62\u015b\u1e5b\u1e63.]+', cand).group(0)
        if len(lead.replace('.', '')) <= 5 and (re.search(r'\d', cand) or cand.isupper() or lead.isupper() or cand == 'DV'):
            return text[:m.start()].strip(), cand.strip()
    return text, None


def main():
    html = open(HTML_IN, encoding='utf-8').read()
    p = ParaParser()
    p.feed(html)

    doc_title = None
    doc_subtitle_raw = None
    verses = []          # list of dicts {n, lines[], tr[], cm[], cites[]}
    cur = None
    last = None

    for cls, events in p.paras:
        txt = para_text(events).strip()
        if cls == 'ql-doc-title':
            doc_title = txt
            continue
        if cls == 'ql-doc-subtitle':
            doc_subtitle_raw = txt
            continue
        if cls == 'ql-doc-comment':
            if last is not None:
                body, cite = strip_cite(txt)
                if body:
                    last['cm'].append(body)
                if cite:
                    last['cites'].append(cite)
            continue
        if cls == 'ql-doc-translation':
            if last is not None:
                last['tr'].append(txt)
            continue
        # shloka / body line
        if not txt or txt == '':
            continue
        if cur is None:
            cur = {'n': None, 'lines': [], 'tr': [], 'cm': [], 'cites': []}
        cur['lines'].append(events)
        ended, num = verse_end_number(events)
        if ended:
            cur['n'] = num
            verses.append(cur)
            last = cur
            cur = None
    if cur is not None:
        verses.append(cur)

    # build token streams per verse
    for v in verses:
        toks = []
        lines = v['lines']
        for li, ev in enumerate(lines):
            items = events_to_items(ev)
            toks.extend(items_to_tokens(items))
            if li < len(lines) - 1:
                toks.append({'t': 'br'})
        v['tokens'] = toks
        tr = ' '.join(v['tr']).strip()
        cm = ' '.join(v['cm']).strip()
        full = (tr + ' ' + cm).strip() if cm else tr
        full, cite = strip_cite(full)
        if cite and cite not in v['cites']:
            v['cites'].append(cite)
        v['translation'] = full

    print('num verses parsed:', len(verses))
    for i, v in enumerate(verses):
        nsyl = sum(1 for t in v['tokens'] if t['t'] == 'syl')
        print(f"  v{i+1}: n={v['n']!r} lines={len(v['lines'])} syl={nsyl} cites={v['cites']}")
        print('     tr:', (v['translation'][:90] + ('...' if len(v['translation'])>90 else '')))

    # ---- assemble sections (single section, all parsed verses)
    def mkverse(vid, v, n):
        d = {'id': vid, 'n': n, 'tokens': v['tokens']}
        if v['translation']:
            d['translation'] = {'en': v['translation']}
        return d

    sec = {'id': 'sec-1', 'label': 'Bhāgya Sūktam',
           'source': 'kṛṣṇayajurveda · Taittirīya Brāhmaṇa 2.8.9 · Ṛgveda 7.41',
           'verses': [mkverse(f'v-{i+1}', verses[i], verses[i]['n'] or str(i+1)) for i in range(len(verses))]}

    tf_iast = 'bhāgya sūktam'
    tfd, tft, tfm = derive_scripts_title(tf_iast)

    doc = {
        'format': 'vedaunion.chant',
        'version': 2,
        'id': 'bhagya-suktam',
        'title': tf_iast,
        'subtitle': 'Hymn for fortune and the awakening of dawn',
        'source': 'kṛṣṇayajurveda · Taittirīya Brāhmaṇa 2.8.9',
        'primaryScript': 'iast',
        'scripts': ['iast', 'devanagari', 'telugu', 'tamil'],
        'titleForms': {'iast': tf_iast, 'devanagari': tfd, 'telugu': tft, 'tamil': tfm},
        'sections': [sec],
        'recording': {'byVerse': {}},
        'audioBase': '/tests/bhagya-suktam/audio/',
    }
    with open(JSON_OUT, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print('WROTE', JSON_OUT)
    # dump syllable counts for audio split
    counts = {}
    for s in doc['sections']:
        for v in s['verses']:
            counts[v['id']] = sum(1 for t in v['tokens'] if t['t'] == 'syl')
    print('SYLCOUNTS', json.dumps(counts))


def derive_scripts_title(iast):
    b = norm_translit(iast)
    return (transliterate(b, sanscript.IAST, sanscript.DEVANAGARI),
            transliterate(b, sanscript.IAST, sanscript.TELUGU),
            transliterate(b, sanscript.IAST, sanscript.TAMIL))


if __name__ == '__main__':
    main()
