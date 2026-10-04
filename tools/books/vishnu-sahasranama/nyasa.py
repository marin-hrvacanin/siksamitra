# His nyāsa svaras, as his Lalitā, Rudram and sādhanā place them (counted from a line's end):
#   …namaḥ: 5̍ 3̱ 1̍ (the closing ॥ line: 5̍ 3̱) · …chandaḥ: 3̍ 2̱ · …kīlakam: 5̍ 3̱
#   …astrāya phaṭ, …digbandhaḥ: 2̱ · anything else: 4̍ 2̱
import json,re,unicodedata,sys
P='out/vsn/vsn-book.json'
d=json.load(open(P,encoding='utf-8')); doc=d.get('doc',d)
V=re.compile(r'ai|au|[aāiīuūṛṝḷḹeo]')
TITLES={'nyāsaḥ','ṛṣyādi nyāsaḥ','karanyāsaḥ','hṛdayādi nyāsaḥ','laṁ ityādi pañcapūjā'}
def plan(body, closing):
    w=re.sub(r'[^a-zāīūṛṝḷḹṅñṭḍṇśṣṁḥ]','',body.split()[-1]) if body.split() else ''
    if w.endswith('namaḥ'): return [(5,'svarita'),(3,'anudatta')]+([] if closing else [(1,'svarita')])
    if w.endswith('phaṭ') or 'digbandh' in w or 'digvimok' in w: return [(2,'anudatta')]
    if w.endswith('chandaḥ'): return [(3,'svarita'),(2,'anudatta')]
    if w.endswith('kīlakam'): return [(5,'svarita'),(3,'anudatta')]
    return [(4,'svarita'),(2,'anudatta')]
n=0
for s in doc['sections']:
    if s.get('title') not in TITLES or (s.get('profile') or {}).get('preset')!='smarta': continue
    for it in s.get('items',[]):
        if it.get('t')!='verse': continue
        text=it['text']; marks=it['marks']
        have={m[1] for m in marks if m[0]=='svara'}
        at=0
        for line in text.split('\n'):
            m=re.search(r'[।॥]',line)
            body=line[:m.start()] if m else line
            closing = bool(m) and line[m.start()]=='॥'
            vs=[(at+x.start(), len(x.group(0))) for x in V.finditer(body)]
            for k,val in plan(body, closing):
                if k<=len(vs):
                    pos,ln=vs[-k]
                    if pos not in have: marks.append(['svara',pos,ln,val]); n+=1
            at+=len(line)+1
        marks.sort(key=lambda m:(m[1], 0 if m[0]=='syl' else 1))
# hariḥ | oṁ — the visarga kept, a short pause before the praṇava
for s in doc['sections']:
    if s.get('title')=='śrī viṣṇu sahasranāma stotram':
        it=[i for i in s['items'] if i.get('t')=='verse'][0]
        it['text']='hariḥ  oṁ ॥'; it['marks']=[['pause',6,0,'short']]
json.dump(d,open(P,'w',encoding='utf-8'),ensure_ascii=False)
print('svaras placed',n)
