# -*- coding: utf-8 -*-
"""Extract per-verse chunk surfaces (matching ChantReader.chunkVerse) and plain
IAST (per verse + per pada) for the durga chant."""
import json, sys

JSON = r"D:\Projects\vedaunion\app\client\public\chants\durga-suktam.json"
d = json.load(open(JSON, encoding="utf-8"))

def chunks(tokens):
    """Runs of consecutive syl tokens => words (like chunkVerse). Returns list of
    (surface, plain) where surface=concat iast, plain=concat unit chars (no '-')."""
    out = []
    cur = []
    def flush():
        if cur:
            surface = "".join(s["iast"] for s in cur)
            plain = "".join(u["c"] for s in cur for u in s["units"] if u["c"] not in ("-", "'"))
            out.append((surface, plain))
            cur.clear()
    for tk in tokens:
        if tk["t"] == "syl":
            cur.append(tk)
        else:
            flush()
    flush()
    return out

def padas(tokens):
    """Split verse into padas on br/danda; plain IAST per pada for alignment."""
    lines = [[]]
    for tk in tokens:
        if tk["t"] in ("br", "danda"):
            if any(x["t"] == "syl" for x in lines[-1]):
                lines.append([])
        else:
            lines[-1].append(tk)
    res = []
    for ln in lines:
        txt = "".join(s["iast"] for s in ln if s["t"] == "syl")
        if txt.strip():
            res.append(txt)
    return res

allv = []
for sec in d["sections"]:
    for v in sec["verses"]:
        allv.append(v)

out = {}
for v in allv:
    ch = chunks(v["tokens"])
    pd = padas(v["tokens"])
    plain = "".join(u["c"] for tk in v["tokens"] if tk["t"] == "syl"
                     for u in tk["units"] if u["c"] not in ("-", "'"))
    out[v["id"]] = {"n": v.get("n"), "nwords": len(ch),
                    "surfaces": [c[0] for c in ch],
                    "plain": plain, "padas": pd}

json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else "extract.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

for vid, info in out.items():
    print(f"\n=== {vid} (n={info['n']}) — {info['nwords']} words ===")
    print("PLAIN:", info["plain"])
    print("PADAS:")
    for p in info["padas"]:
        print("   ", p)
    print("SURFACES:", " | ".join(info["surfaces"]))
