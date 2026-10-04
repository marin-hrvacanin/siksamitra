import re,json,unicodedata,sys
N=lambda s: unicodedata.normalize('NFC',s)
def load(f): return {int(l.split('|')[0]):N(l.split('|',1)[1][1:]).rstrip('\n') for l in open(f,encoding='utf-8') if '|' in l}
w1=load('w1.txt'); w3=load('w3.txt')
names={}
for k,l in w3.items():
    m=re.match(r'(\d+) oṁ (.+?) namaḥ',l)
    if m and int(m.group(1)) not in names: names[int(m.group(1))]=m.group(2).replace(' ','')
verses=[];cur=[]
for n in range(172,388):
    l=w1[n]
    if not l.strip() or 'nama iti' in l: continue
    cur.append((n,l))
    m=re.search(r'॥\s*(\d+)\s*॥',l)
    if m: verses.append((int(m.group(1)),cur)); cur=[]
SKIP=set(' \tṁ\n।')
def clean(c): return c.replace('ṁ','').replace('ṅ','n').replace('ñ','n')
OVR=json.load(open('ovr.json',encoding='utf-8')) if len(sys.argv)>1 else {}
out=[];ptr=1
for vn,ls in verses:
    V='';amap=[]
    for (ln,l) in ls:
        t=re.sub(r'\(.*?\)','',l); t=re.sub(r'॥.*','',t)
        if vn==1: t=t.replace('oṁ ','',1)
        i=0
        while i<len(t):
            ch=t[i]
            if t.startswith("''",i): V+='ā'; amap.append((ln,i)); i+=2; continue
            if ch=="'": V+='a'; amap.append((ln,i)); i+=1; continue
            if ch in SKIP: i+=1; continue
            V+=clean(ch); amap.append((ln,i)); i+=1
    starts=[0]; idx=[ptr]
    def core(k):
        nm=names[k]
        if str(k) in OVR: return clean(OVR[str(k)])
        w=re.split(r"[ ']",nm)[0]
        for e in ['āyai','āya','aye','ave','yai','ne','re','e']:
            if w.endswith(e) and len(w)-len(e)>=2: w=w[:-len(e)]; break
        return clean(w)[:4]
    while True:
        cand=ptr+len(idx)
        if cand>1000: break
        c=core(cand); prevc=core(idx[-1])
        f=V.find(c, starts[-1]+max(1,len(prevc)-1))
        if f<0: break
        starts.append(f); idx.append(cand)
    segs=[V[starts[i]:(starts[i+1] if i+1<len(starts) else len(V))] for i in range(len(starts))]
    out.append({'v':vn,'names':idx,'segs':segs,'starts':[amap[s] for s in starts],'lines':ls})
    ptr=idx[-1]+1
print('ended at',ptr-1, file=sys.stderr)
json.dump(out,open('seg.json','w',encoding='utf-8'),ensure_ascii=False)
for o in out: print(o['v'],len(o['names']),' | '.join(f"{n}:{s}" for n,s in zip(o['names'],o['segs'])))
