# -*- coding: utf-8 -*-
"""Check the stored SVARA of a chant against the pitch of a recitation.

Forced alignment (`align_shivasankalpa.py`) verifies the LETTERS. It cannot see
svara at all — MMS is a phonetic model and has no notion of tone. But svara *is*
pitch: anudātta is recited below the reciting tone, udātta on it, svarita above
it. So the accents can be checked the same way the text was, by measurement:

  1. align every SYLLABLE of the document to the audio (one MMS "word" per
     syllable, so the aligner returns a span for each);
  2. track F0 with `librosa.pyin` and take the median over each syllable's span;
  3. convert to semitones relative to the median F0 of the whole mantra, which
     is the reciting tone (udātta dominates every mantra by a wide margin);
  4. compare the measured level against the stored svara.

WHAT THIS CAN AND CANNOT SETTLE. A disagreement here is EVIDENCE, not a verdict:
a reciter glides, a syllable can be too short or too breathy to track, and the
svarita in particular is a falling contour whose median sits near the tone. Use
it the way §5J uses the aligner — to find the handful of syllables worth going
back to the printed witnesses for, ranked by how far they are from where the
document says they should be. Nothing here edits a mark.

    PY="D:/Projects/siksamitra/.venv/Scripts/python.exe"
    "$PY" tools/chant/svara_check.py --audio <mp3> --chant shiva-sankalpa-suktam
    "$PY" tools/chant/svara_check.py --audio <mp3> --verse v-27      # one mantra
"""
import argparse
import json
import os
import subprocess
import sys
import wave

import numpy as np

os.environ.setdefault("TORCH_HOME", r"D:\Projects\siksamitra\cache\models")
sys.path.insert(0, r"D:\Projects\siksamitra")

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 16000
NOT_RECITED = {"v-closing"}


def load_audio(path, work):
    os.makedirs(work, exist_ok=True)
    wav = os.path.join(work, "_full16k.wav")
    if not os.path.exists(wav):
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", path,
                        "-ac", "1", "-ar", str(SR), wav], check=True)
    with wave.open(wav, "rb") as w:
        raw = w.readframes(w.getnframes())
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def syllables(doc):
    """[(verse id, index, iast, svara)] for every syllable, in document order."""
    out = []
    for sec in doc["sections"]:
        for v in sec["verses"]:
            if v["id"] in NOT_RECITED:
                continue
            i = 0
            for tk in v["tokens"]:
                if tk["t"] != "syl":
                    continue
                sv = next((u["svara"] for u in tk["units"] if u.get("svara")),
                          None)
                out.append((v["id"], i, tk["iast"], sv))
                i += 1
    return out


def align(x, words):
    import torch
    from torchaudio.pipelines import MMS_FA
    model = MMS_FA.get_model()
    model.eval()
    torch.set_num_threads(max(1, os.cpu_count() or 2))
    wav = torch.from_numpy(x).unsqueeze(0)
    parts, step = [], int(15.0 * SR)
    with torch.inference_mode():
        for s in range(0, wav.size(1), step):
            seg = wav[:, s:min(wav.size(1), s + step)].contiguous()
            if seg.size(1) < int(0.1 * SR):
                continue
            em, _ = model(seg)
            parts.append(em.detach().clone())
    em = torch.cat(parts, dim=1)
    ratio = wav.size(1) / em.size(1) / SR
    with torch.inference_mode():
        spans = MMS_FA.get_aligner()(em[0], MMS_FA.get_tokenizer()(words))
    return spans, ratio


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--chant", default="shiva-sankalpa-suktam")
    ap.add_argument("--verse", default=None)
    ap.add_argument("--work", default=os.path.join(HERE, "_align_work"))
    ap.add_argument("--report", default=None)
    args = ap.parse_args()

    doc = json.load(open(os.path.normpath(os.path.join(
        HERE, "..", "..", "client", "public", "chants",
        args.chant + ".json")), encoding="utf-8"))
    syls = syllables(doc)
    from align_roman import to_phones
    words = ["".join(to_phones(s[2])) or "a" for s in syls]
    print("syllables: %d" % len(syls))

    x = load_audio(args.audio, args.work)
    spans, ratio = align(x, words)

    import librosa
    f0, voiced, _ = librosa.pyin(
        x, sr=SR, fmin=70, fmax=400, frame_length=1024, hop_length=160)
    hop_s = 160 / SR

    rows = []
    for i, (vid, si, iast, sv) in enumerate(syls):
        sp = spans[i]
        if not sp:
            rows.append((vid, si, iast, sv, None, 0.0))
            continue
        a, b = sp[0].start * ratio, sp[-1].end * ratio
        fa, fb = int(a / hop_s), int(b / hop_s)
        seg = f0[fa:max(fb, fa + 1)]
        seg = seg[~np.isnan(seg)]
        conf = sum(float(s.score) for s in sp) / len(sp)
        rows.append((vid, si, iast, sv,
                     float(np.median(seg)) if len(seg) >= 2 else None, conf))

    # semitones relative to the mantra's own reciting tone
    out, by_verse = [], {}
    for r in rows:
        by_verse.setdefault(r[0], []).append(r)
    for vid, rr in by_verse.items():
        base = np.median([r[4] for r in rr if r[4]])
        if not np.isfinite(base):
            continue
        for vid_, si, iast, sv, hz, conf in rr:
            st = 12 * np.log2(hz / base) if hz else None
            out.append((vid_, si, iast, sv, hz, st, conf))

    LEVEL = {"anudatta": "low", None: "tone", "svarita": "high",
             "dirgha-svarita": "high"}

    def measured(st):
        if st is None:
            return None
        if st <= -0.9:
            return "low"
        if st >= 0.9:
            return "high"
        return "tone"

    keep = [r for r in out if args.verse in (None, r[0])]
    bad = []
    counts = {}
    for vid, si, iast, sv, hz, st, conf in keep:
        want, got = LEVEL[sv], measured(st)
        if got is None or conf < 0.35:
            continue
        counts[(want, got)] = counts.get((want, got), 0) + 1
        if want != got:
            bad.append((abs(st), vid, si, iast, sv, st, conf))

    print("\n=== agreement (rows = what the document stores) ===")
    for want in ("low", "tone", "high"):
        row = {g: counts.get((want, g), 0) for g in ("low", "tone", "high")}
        tot = sum(row.values())
        ok = row[want]
        print("  %-5s n=%4d  agree %4d (%5.1f%%)   heard low/tone/high = "
              "%d/%d/%d" % (want, tot, ok, 100 * ok / tot if tot else 0,
                            row["low"], row["tone"], row["high"]))

    bad.sort(reverse=True)
    print("\n=== the 40 syllables furthest from where the document puts them ===")
    print("  %-8s %-4s %-10s %-16s %8s %6s" %
          ("verse", "#", "syllable", "stored", "semitones", "conf"))
    for d, vid, si, iast, sv, st, conf in bad[:40]:
        print("  %-8s %-4d %-10s %-16s %+8.2f %6.2f" %
              (vid, si, iast, sv or "udātta (none)", st, conf))

    if args.report:
        json.dump([{"verse": v, "i": i, "iast": s, "stored": sv,
                    "hz": hz, "semitones": st, "conf": c}
                   for v, i, s, sv, hz, st, c in out],
                  open(args.report, "w"), indent=1)
        print("\nwrote", args.report)


if __name__ == "__main__":
    main()
