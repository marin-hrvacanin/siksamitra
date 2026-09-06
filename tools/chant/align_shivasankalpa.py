# -*- coding: utf-8 -*-
"""MMS forced alignment of `shiva-sankalpa-suktam.json` to the recitation.

Two jobs, and the first is the important one:

  1. **VERIFY THE TEXT.** A forced alignment is the only check available that
     the text this document ships is the text the reciter actually says. The
     per-mantra confidence scores and the gaps between consecutive mantras are
     the signal: a mantra whose score collapses, or whose span overlaps its
     neighbour, means the written text and the audio have drifted apart.
  2. **CUT** one mp3 per mantra, snapping each boundary to the local energy dip
     (the recitation is a continuous drone with no true silences), monotonic
     and non-overlapping, into `client/public/tests/<slug>/audio/`.

    PY="D:/Projects/siksamitra/.venv/Scripts/python.exe"
    "$PY" tools/chant/align_shivasankalpa.py --audio <path to the mp3>
    "$PY" tools/chant/align_shivasankalpa.py --audio <path> --cut

Run it from `tools/chant` so `scratchpad/inspect.py` cannot shadow stdlib
`inspect`. Needs the Śikṣāmitra venv (torch / torchaudio) and `ffmpeg`.
"""
import argparse
import json
import os
import subprocess
import sys
import wave

import numpy as np

os.environ.setdefault("TORCH_HOME", r"D:\Projects\siksamitra\cache\models")
sys.path.insert(0, r"D:\Projects\siksamitra")          # for align_roman

HERE = os.path.dirname(os.path.abspath(__file__))
SLUG = "shiva-sankalpa-suktam"
CHANT = os.path.normpath(os.path.join(
    HERE, "..", "..", "client", "public", "chants", SLUG + ".json"))
OUTDIR = os.path.normpath(os.path.join(
    HERE, "..", "..", "client", "public", "tests", SLUG, "audio"))
SR = 16000
#: The recording covers the thirty-nine mantras only. The closing hṛdaya nyāsa
#: (`oṁ namo bhagavate rudrāya | śivasaṅkalpaṁ hṛdayāya namaḥ`) is printed in
#: the Mahānyāsa editions and is part of the section, but the Challakere
#: Brothers track ends with mantra 39 — verified: including it in the aligned
#: text scored .276 against .385 without it, and squeezed mantra 39's refrain
#: into 1.2 s. Aligning it would drag every boundary near the end.
NOT_RECITED = {"v-closing"}


def verse_padas(doc):
    """[(verse id, [pāda strings])] in document order — the rendered lines."""
    out = []
    for sec in doc["sections"]:
        for v in sec["verses"]:
            padas, cur = [], []
            for tk in v["tokens"]:
                if tk["t"] == "syl":
                    cur.append(tk["iast"])
                elif tk["t"] == "sp":
                    cur.append(" ")
                elif tk["t"] in ("br", "danda", "pause", "num"):
                    if tk["t"] == "br":
                        s = "".join(cur).strip()
                        if s:
                            padas.append(s)
                        cur = []
                    else:
                        cur.append(" ")
            s = "".join(cur).strip()
            if s:
                padas.append(s)
            if v["id"] not in NOT_RECITED:
                out.append((v["id"], padas))
    return out


def to_wav(audio, path, t0=0.0, t1=None):
    cmd = ["ffmpeg", "-y", "-v", "error"]
    if t0:
        cmd += ["-ss", str(t0)]
    if t1:
        cmd += ["-to", str(t1)]
    cmd += ["-i", audio, "-ac", "1", "-ar", str(SR), path]
    subprocess.run(cmd, check=True)
    with wave.open(path, "rb") as w:
        assert w.getframerate() == SR and w.getnchannels() == 1
        raw = w.readframes(w.getnframes())
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def align(samples, words):
    import torch
    from torchaudio.pipelines import MMS_FA
    wav = torch.from_numpy(samples).unsqueeze(0)
    model = MMS_FA.get_model()
    model.eval()
    torch.set_num_threads(max(1, os.cpu_count() or 2))
    tokenizer = MMS_FA.get_tokenizer()
    aligner = MMS_FA.get_aligner()

    step = int(15.0 * SR)
    parts = []
    with torch.inference_mode():
        for s in range(0, wav.size(1), step):
            seg = wav[:, s:min(wav.size(1), s + step)].contiguous()
            if seg.size(1) < int(0.1 * SR):
                continue
            em, _ = model(seg)
            parts.append(em.detach().clone())
            del em
    em = torch.cat(parts, dim=1)
    ratio = wav.size(1) / em.size(1) / SR
    tokens = tokenizer(words)
    with torch.inference_mode():
        spans = aligner(em[0], tokens)
    return spans, ratio


def rms_envelope(x):
    hop, win = int(0.010 * SR), int(0.030 * SR)
    nfr = (len(x) - win) // hop
    r = np.empty(nfr, dtype=np.float32)
    for i in range(nfr):
        seg = x[i * hop:i * hop + win]
        r[i] = np.sqrt(np.mean(seg * seg) + 1e-9)
    k = 5
    return np.convolve(r, np.ones(k) / k, mode="same")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--cut", action="store_true")
    ap.add_argument("--work", default=os.path.join(HERE, "_align_work"))
    args = ap.parse_args()
    os.makedirs(args.work, exist_ok=True)

    doc = json.load(open(CHANT, encoding="utf-8"))
    vp = verse_padas(doc)
    from align_roman import to_phones
    targets = [(vid, i, "".join(to_phones(p)))
               for vid, padas in vp for i, p in enumerate(padas)]
    print("mantras: %d · pādas: %d" % (len(vp), len(targets)))

    wavpath = os.path.join(args.work, "_full16k.wav")
    x = to_wav(args.audio, wavpath)
    print("audio: %.2f s" % (len(x) / SR))

    spans, ratio = align(x, [t[2] for t in targets])
    rows = []
    for i, (vid, pi, roman) in enumerate(targets):
        sp = spans[i]
        if not sp:
            rows.append((vid, pi, None, None, 0.0))
            continue
        rows.append((vid, pi, sp[0].start * ratio, sp[-1].end * ratio,
                     sum(float(s.score) for s in sp) / len(sp)))

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

    order = [vid for vid, _ in vp]
    print("\n=== PER-MANTRA (s) ===")
    prev_end, worst = None, []
    for vid in order:
        if vid not in verse:
            print("  %-10s UNPLACED" % vid)
            worst.append((0.0, vid))
            continue
        st, en, scs = verse[vid]
        sc = sum(scs) / len(scs)
        gap = "" if prev_end is None else "  gap %+.2f" % (st - prev_end)
        print("  %-10s %7.2f -> %7.2f  (%5.2f s)  score %.3f%s"
              % (vid, st, en, en - st, sc, gap))
        prev_end = en
        worst.append((sc, vid))
    worst.sort()
    print("\nlowest-confidence mantras:",
          ", ".join("%s %.3f" % (v, s) for s, v in worst[:5]))
    json.dump({"verse": {k: {"start": round(v[0], 3), "end": round(v[1], 3),
                             "score": round(sum(v[2]) / len(v[2]), 3)}
                         for k, v in verse.items()},
               "rows": rows},
              open(os.path.join(args.work, "align_out.json"), "w"), indent=1)

    if not args.cut:
        return

    # ---- boundaries snapped to the local energy dip -----------------------
    env = rms_envelope(x)
    nfr = len(env)

    def dip(a, b):
        fa, fb = max(0, int(round(a / 0.010))), min(nfr - 1,
                                                    int(round(b / 0.010)))
        if fb <= fa:
            return (a + b) / 2
        return (fa + int(np.argmin(env[fa:fb + 1]))) * 0.010

    edges = []
    first = verse[order[0]][0]
    edges.append(max(0.0, dip(max(0.0, first - 0.9), max(0.02, first - 0.05))))
    for i in range(len(order) - 1):
        e, s = verse[order[i]][1], verse[order[i + 1]][0]
        edges.append(dip(min(e, s), max(e, s)) if s > e else (e + s) / 2)
    last = verse[order[-1]][1]
    edges.append(min(len(x) / SR, dip(last + 0.05, min(len(x) / SR,
                                                       last + 2.5))))
    for i in range(1, len(edges)):
        edges[i] = max(edges[i], edges[i - 1] + 0.2)

    os.makedirs(OUTDIR, exist_ok=True)
    rec = {}
    print("\n=== CUTS ===")
    for i, vid in enumerate(order):
        a0, a1 = edges[i], edges[i + 1]
        name = "%s.mp3" % vid
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", "%.3f" % a0,
                        "-to", "%.3f" % a1, "-i", args.audio, "-ac", "1",
                        "-b:a", "64k", os.path.join(OUTDIR, name)], check=True)
        rec[vid] = {"file": name, "duration": round(a1 - a0, 2)}
        print("  %-10s %7.2f -> %7.2f  (%5.2f s)  %s"
              % (vid, a0, a1, a1 - a0, name))
    json.dump(rec, open(os.path.join(args.work, "byverse.json"), "w"),
              ensure_ascii=False, indent=1)
    print("\nwrote %d clips to %s" % (len(rec), OUTDIR))
    print("byverse.json written — merge it into the chant with "
          "`merge_recording.py` or paste into the generator")


if __name__ == "__main__":
    main()
