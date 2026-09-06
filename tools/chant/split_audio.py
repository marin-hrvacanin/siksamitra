# -*- coding: utf-8 -*-
import wave, struct, math, subprocess, os, json

SCRATCH = r"C:\Users\marin\AppData\Local\Temp\claude\D--Projects-vedaunion\e84b47d8-cfb9-41b6-b655-5f9b4fa03ab9\scratchpad"
FULL = SCRATCH + r"\durga-full.mp3"
WIN = SCRATCH + r"\dw\win.wav"
OUTDIR = r"D:\Projects\vedaunion\app\client\public\tests\durga-suktam\audio"
WIN_START = 4.5           # win.wav was trimmed starting here
ONSET = 5.0               # first mantra onset (over the intro/om)
END = 149.8               # end of the sūktam window
SYL = [44, 43, 41, 44, 45, 40, 43, 24]   # v-1..v-8 syllable counts (v-9 śānti: no audio)

# ---- RMS envelope at 0.1s from win.wav ----
w = wave.open(WIN, 'rb'); n = w.getnframes(); sr = w.getframerate()
samp = struct.unpack("<%dh" % n, w.readframes(n)); w.close()
step = 0.1
win = int(step * sr)
env = []
for i in range(0, n, win):
    seg = samp[i:i + win]
    if not seg:
        break
    env.append(math.sqrt(sum(x * x for x in seg) / len(seg)))
# light smoothing
sm = env[:]
for i in range(1, len(env) - 1):
    sm[i] = (env[i - 1] + env[i] + env[i + 1]) / 3.0

def t_to_idx(t):
    return int(round((t - WIN_START) / step))

def snap(t, radius=2.5):
    lo = max(0, t_to_idx(t - radius))
    hi = min(len(sm) - 1, t_to_idx(t + radius))
    best = t_to_idx(t); bestv = sm[best] if best < len(sm) else 1e18
    for k in range(lo, hi + 1):
        if sm[k] < bestv:
            bestv = sm[k]; best = k
    return WIN_START + best * step

# ---- proportional interior boundaries, snapped to local minima ----
total = sum(SYL)
T = END - ONSET
cum = 0
bounds = [ONSET]
for s in SYL[:-1]:
    cum += s
    tprop = ONSET + (cum / total) * T
    bounds.append(round(snap(tprop), 2))
bounds.append(END)

segs = []
for i in range(len(SYL)):
    a, b = bounds[i], bounds[i + 1]
    segs.append((a, b))

os.makedirs(OUTDIR, exist_ok=True)
rec = {}
print("verse | start   end    dur   file")
for i, (a, b) in enumerate(segs):
    vid = f"v-{i+1}"
    fname = f"durga-{i+1}.mp3"
    out = os.path.join(OUTDIR, fname)
    dur = round(b - a, 2)
    subprocess.run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", FULL, "-ss", f"{a:.3f}", "-to", f"{b:.3f}",
        "-ac", "1", "-ar", "44100", "-b:a", "64k", out
    ], check=True)
    rec[vid] = {"file": fname, "duration": f"{dur:.2f}", "label": str(i + 1)}
    print(f"{vid:5} | {a:6.2f} {b:6.2f} {dur:6.2f}  {fname}")

with open(SCRATCH + r"\dw\byverse.json", "w", encoding="utf-8") as f:
    json.dump(rec, f, ensure_ascii=False, indent=1)
print("TOTAL span:", round(END - ONSET, 2), "s")
print("wrote byverse.json")
