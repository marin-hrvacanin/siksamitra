import json,re,glob,sys,unicodedata
N=lambda s:unicodedata.normalize('NFC',s)
SUP=str.maketrans('0123456789','⁰¹²³⁴⁵⁶⁷⁸⁹')
rows=json.load(open('rows.json',encoding='utf-8'))
seg=json.load(open('seg.json',encoding='utf-8'))
G={}
for f in sorted(glob.glob('g*.txt')):
    for l in open(f,encoding='utf-8'):
        if not l.strip(): continue
        n,sp,gl=l.rstrip('\n').split('\t'); G[int(n)]=(N(sp),gl.strip())
bad=0
def letters(s): return re.sub(r"[\s\-#+]",'',s)
verses=[]
for o in seg:
    names=o['names']
    if not all(n in G for n in names): break
    lines=[[],[]]; gl=[[],[]]
    firstline=o['starts'][0][0]
    for i,n in enumerate(names):
        r=rows[n-1]; assert r[1]==n
        sp,g=G[n]
        if letters(sp)!=letters(N(r[2])):
            print('MISMATCH',n,repr(r[2]),'vs',repr(sp)); bad+=1
        li=0 if o['starts'][i][0]==firstline else 1
        num=str(n).translate(SUP)
        w=sp.replace('#',num) if '#' in sp else sp+num
        lines[li].append(w); gl[li].append(f'{num}{g}')
    def join(ws):
        out=''
        for w in ws:
            if w.startswith('+'): out+=w[1:]; continue
            out+= w if (out=='' or w.startswith("'")) else ' '+w
        return out
    spaced=[join(lines[0])+' ।', join(lines[1])+' ॥']
    tr='; '.join(gl[0]+gl[1])
    verses.append({'v':o['v'],'at':f"{o['lines'][0][0]}-{o['lines'][-1][0]}",'spaced':spaced,'translation':tr})
json.dump(verses,open('stotram_verses.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
print('verses ready',len(verses),'bad',bad)
for v in verses[:3]: print(v)
