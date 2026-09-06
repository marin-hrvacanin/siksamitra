# -*- coding: utf-8 -*-
"""MMS forced alignment of the Durga Suktam verses (per pada) to the recording.
Run from this dir (dw) so scratchpad/inspect.py does NOT shadow stdlib inspect."""
import os, sys, json, subprocess, wave
import numpy as np
os.environ.setdefault('TORCH_HOME', r'D:\Projects\siksamitra\cache\models')
sys.path.insert(0, r'D:\Projects\siksamitra')  # for align_roman

import torch, torchaudio
from torchaudio.pipelines import MMS_FA
from align_roman import to_phones

SCRATCH = r"C:\Users\marin\AppData\Local\Temp\claude\D--Projects-vedaunion\e84b47d8-cfb9-41b6-b655-5f9b4fa03ab9\scratchpad"
FULL = os.path.join(SCRATCH, "durga-full.mp3")
EXTRACT = os.path.join(SCRATCH, "extract.json")
W0, W1 = 3.0, 156.0          # window (s) of full recording to align within
SR = 16000

data = json.load(open(EXTRACT, encoding="utf-8"))
order = [f"v-{i}" for i in range(1, 9)]   # verses 1..8 have audio

# Build pada targets in document order: list of (vid, pada_idx, roman)
targets = []
for vid in order:
    for pi, pada in enumerate(data[vid]["padas"]):
        roman = "".join(to_phones(pada))
        targets.append((vid, pi, roman))
words = [t[2] for t in targets]
print("padas:", len(words))
for t in targets:
    print("  ", t[0], t[1], t[2])

# ---- decode window to 16k mono wav via ffmpeg, read via wave
WAVPATH = os.path.join(SCRATCH, "dw", "_window16k.wav")
subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", str(W0), "-to", str(W1),
                "-i", FULL, "-ac", "1", "-ar", str(SR), WAVPATH], check=True)
with wave.open(WAVPATH, "rb") as w:
    assert w.getframerate() == SR and w.getnchannels() == 1
    raw = w.readframes(w.getnframes())
samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
wav = torch.from_numpy(samples).unsqueeze(0)
n = wav.size(1)
print(f"window {W0}-{W1}s  samples={n}  dur={n/SR:.2f}s")

# ---- model
model = MMS_FA.get_model()
model.eval()
torch.set_num_threads(max(1, os.cpu_count() or 2))
tokenizer = MMS_FA.get_tokenizer()
aligner = MMS_FA.get_aligner()

def emissions(waveform, chunk_s=15.0):
    step = int(chunk_s * SR)
    if waveform.size(1) <= step:
        with torch.inference_mode():
            em, _ = model(waveform)
        return em
    parts = []
    with torch.inference_mode():
        for s in range(0, waveform.size(1), step):
            seg = waveform[:, s:min(waveform.size(1), s + step)].contiguous()
            if seg.size(1) < int(0.1 * SR):
                continue
            em, _ = model(seg)
            parts.append(em.detach().clone())
            del em
    return torch.cat(parts, dim=1)

em = emissions(wav)
ratio = wav.size(1) / em.size(1) / SR
print("emission frames:", em.size(1), "sec/frame:", round(ratio, 4))

tokens = tokenizer(words)
with torch.inference_mode():
    token_spans = aligner(em[0], tokens)

# per-pada start/end/score (relative to window start), then absolute
rows = []
for i, (vid, pi, roman) in enumerate(targets):
    spans = token_spans[i]
    if not spans:
        rows.append((vid, pi, None, None, 0.0)); continue
    st = spans[0].start * ratio
    en = spans[-1].end * ratio
    sc = sum(float(s.score) for s in spans) / max(1, len(spans))
    rows.append((vid, pi, W0 + st, W0 + en, sc))

print("\n=== PER-PADA (absolute s) ===")
for vid, pi, st, en, sc in rows:
    if st is None:
        print(f"  {vid} p{pi}: UNPLACED score={sc:.3f}")
    else:
        print(f"  {vid} p{pi}: {st:7.2f} -> {en:7.2f}  ({en-st:5.2f}s)  score={sc:.3f}")

# aggregate to verse boundaries
verse = {}
for vid, pi, st, en, sc in rows:
    if st is None:
        continue
    if vid not in verse:
        verse[vid] = [st, en, [sc]]
    else:
        verse[vid][0] = min(verse[vid][0], st)
        verse[vid][1] = max(verse[vid][1], en)
        verse[vid][2].append(sc)

print("\n=== PER-VERSE (raw, absolute s) ===")
out = {}
for vid in order:
    if vid in verse:
        st, en, scs = verse[vid]
        out[vid] = {"start": round(st, 3), "end": round(en, 3),
                    "score": round(sum(scs)/len(scs), 3)}
        print(f"  {vid}: {st:7.2f} -> {en:7.2f}  ({en-st:5.2f}s)  meanscore={sum(scs)/len(scs):.3f}")

json.dump({"window": [W0, W1], "verse_raw": out,
           "rows": [(v, p, s, e, sc) for v, p, s, e, sc in rows]},
          open(os.path.join(SCRATCH, "align_out.json"), "w"), indent=1)
print("\nWROTE align_out.json")
