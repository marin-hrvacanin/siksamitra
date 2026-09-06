# -*- coding: utf-8 -*-
"""Turn MMS per-verse spans into clean, monotonic, gap/overlap-free cuts by
snapping each inter-verse boundary to the local low-energy dip, then re-encode
durga-1..8.mp3 (mono/44100/64k) from the full recording."""
import os, json, wave, subprocess
import numpy as np

SCRATCH = r"C:\Users\marin\AppData\Local\Temp\claude\D--Projects-vedaunion\e84b47d8-cfb9-41b6-b655-5f9b4fa03ab9\scratchpad"
FULL = os.path.join(SCRATCH, "durga-full.mp3")
WAVPATH = os.path.join(SCRATCH, "dw", "_window16k.wav")
OUTDIR = r"D:\Projects\vedaunion\app\client\public\tests\durga-suktam\audio"
A = json.load(open(os.path.join(SCRATCH, "align_out.json")))
W0 = A["window"][0]
SR = 16000

# ---- energy envelope of the window (rel seconds)
with wave.open(WAVPATH, "rb") as w:
    raw = w.readframes(w.getnframes())
x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
HOP = int(0.010 * SR)          # 10 ms
WIN = int(0.030 * SR)          # 30 ms
nfr = (len(x) - WIN) // HOP
rms = np.empty(nfr, dtype=np.float32)
for i in range(nfr):
    seg = x[i*HOP:i*HOP+WIN]
    rms[i] = np.sqrt(np.mean(seg*seg) + 1e-9)
# light smoothing
k = 5
rms = np.convolve(rms, np.ones(k)/k, mode="same")
def t2f(t): return int(round(t / 0.010))
def f2t(f): return f * 0.010
def argmin_dip(a, b):
    """rel-time of min-RMS frame in [a,b] (rel seconds)."""
    fa, fb = max(0, t2f(a)), min(nfr-1, t2f(b))
    if fb <= fa: return (a+b)/2
    return f2t(fa + int(np.argmin(rms[fa:fb+1])))

vr = A["verse_raw"]
order = [f"v-{i}" for i in range(1, 9)]
rel = {v: (vr[v]["start"]-W0, vr[v]["end"]-W0) for v in order}

# boundaries between verse v and v+1: dip in [end_v, start_v+1]
bnd = {}
for i in range(7):
    e = rel[order[i]][1]; s = rel[order[i+1]][0]
    bnd[i] = argmin_dip(min(e, s), max(e, s)) if s > e else (e+s)/2
# lead-in before verse 1 and tail after verse 8
v1s = rel["v-1"][0]; v8e = rel["v-8"][1]
lead = argmin_dip(v1s-0.7, v1s-0.05)
tail = argmin_dip(v8e+0.1, v8e+2.2)

# assemble clip [start,end] in rel, then absolute
edges = [lead] + [bnd[i] for i in range(7)] + [tail]
clips = {}
print("=== CUTS (absolute s) ===")
durs = {}
for i, v in enumerate(order):
    rs, re = edges[i], edges[i+1]
    a0, a1 = W0+rs, W0+re
    clips[v] = (a0, a1)
    durs[v] = round(a1 - a0, 2)
    print(f"  {v}: {a0:7.2f} -> {a1:7.2f}   dur={a1-a0:5.2f}s")
# monotonic / non-overlap check
prev = None
ok = True
for v in order:
    a0, a1 = clips[v]
    if a1 <= a0 or (prev is not None and a0 < prev - 1e-6):
        ok = False
    prev = a1
print("monotonic non-overlapping:", ok, " sum=", round(sum(durs.values()), 2))

# ---- re-encode
os.makedirs(OUTDIR, exist_ok=True)
for i, v in enumerate(order):
    a0, a1 = clips[v]
    out = os.path.join(OUTDIR, f"durga-{i+1}.mp3")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{a0:.3f}", "-to", f"{a1:.3f}",
                    "-i", FULL, "-ac", "1", "-ar", "44100", "-b:a", "64k", out], check=True)

# verify measured durations
print("\n=== MEASURED CLIP DURATIONS ===")
meas = {}
for i, v in enumerate(order):
    out = os.path.join(OUTDIR, f"durga-{i+1}.mp3")
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1", out],
                       capture_output=True, text=True)
    d = float(r.stdout.strip())
    meas[v] = round(d, 2)
    print(f"  durga-{i+1}.mp3: {d:.2f}s  ({os.path.getsize(out)} bytes)")
json.dump({v: f"{meas[v]:.2f}" for v in order},
          open(os.path.join(SCRATCH, "durations.json"), "w"), indent=1)
print("WROTE durations.json")
