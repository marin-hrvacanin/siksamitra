# -*- coding: utf-8 -*-
"""Forced alignment using a SANSKRIT-fine-tuned wav2vec2 CTC model (Devanāgarī),
instead of the multilingual generalist MMS. Same pure-torch CTC forced-align
(torchaudio.functional.forced_align) — only the acoustic model changes, which is
the real precision lever for chanted Sanskrit. A/B against the MMS cut: writes to
a SEPARATE audio dir + review, does NOT patch the chant JSON.

    python align_sanskrit.py --chant <chant.json> --audio <file> \
        --audio-out <dir> --slug <slug> --review <html> [--model <hf id>]
"""
from __future__ import annotations
import os, sys, json, argparse, subprocess, wave
import numpy as np
os.environ.setdefault("HF_HOME", r"D:\Projects\siksamitra\cache\hf")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
import torch, torchaudio
from transformers import Wav2Vec2ForCTC, AutoProcessor
from align_robust import decode, rms_env, verse_syllables, to_phones

SR = 16000


def emissions(model, x, chunk_s=25.0):
    """Log-probs (T, C) from the HF wav2vec2 CTC model, chunked for memory."""
    step = int(chunk_s * SR)
    parts = []
    with torch.inference_mode():
        for s in range(0, len(x), step):
            seg = x[s:s + step]
            if len(seg) < int(0.2 * SR):
                continue
            iv = torch.from_numpy(seg).float().unsqueeze(0)
            logits = model(iv).logits[0]                 # (t, C)
            parts.append(torch.log_softmax(logits, dim=-1))
    return torch.cat(parts, dim=0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chant", required=True); ap.add_argument("--audio", required=True)
    ap.add_argument("--audio-out", required=True); ap.add_argument("--slug", required=True)
    ap.add_argument("--report", default=None); ap.add_argument("--review", default=None)
    ap.add_argument("--model", default="addy88/wav2vec2-sanskrit-stt")
    ap.add_argument("--write", action="store_true", help="patch recording.byVerse + audioBase into the chant JSON")
    a = ap.parse_args()

    doc = json.load(open(a.chant, encoding="utf-8"))
    # syllables in order, with (verse_idx, line_idx) and the Devanāgarī form
    vobjs = [v for sec in doc["sections"] for v in sec["verses"]]
    seq = []  # (verse_idx, line_idx, iast, deva)
    for vi, v in enumerate(vobjs):
        syl_deva = [t.get("deva", "") for t in v["tokens"] if t.get("t") == "syl"]
        for (iast, li), dv in zip(verse_syllables(v), syl_deva):
            seq.append((vi, li, iast, dv))
    print(f"{len(vobjs)} verses, {len(seq)} syllables")

    print("loading model", a.model)
    proc = AutoProcessor.from_pretrained(a.model)
    model = Wav2Vec2ForCTC.from_pretrained(a.model); model.eval()
    torch.set_num_threads(max(1, os.cpu_count() or 2))
    vocab = proc.tokenizer.get_vocab()
    is_deva = any('ऀ' <= c <= 'ॿ' for k in vocab for c in k)
    blank = vocab.get("<blank>")                    # explicit CTC blank if present
    if blank is None:
        blank = model.config.pad_token_id if model.config.pad_token_id is not None else vocab.get("<pad>", 0)
    print("vocab:", "devanagari" if is_deva else "roman", "| blank id", blank)

    def syl_text(iast, dv):
        return dv if is_deva else "".join(to_phones(iast))   # romanize IAST for a roman-vocab model

    # target token ids + map each target position -> syllable index
    targets, tgt2syl = [], []
    for si, (vi, li, iast, dv) in enumerate(seq):
        ids = [vocab[ch] for ch in syl_text(iast, dv) if ch in vocab]
        for tid in ids:
            targets.append(tid); tgt2syl.append(si)
    print(f"{len(targets)} target tokens (of {len(seq)} syllables)")

    x, wavpath = decode(a.audio)
    dur = len(x) / SR
    env, hop = rms_env(x)
    em = emissions(model, x)
    T = em.size(0); ratio = len(x) / T / SR
    print(f"audio {dur:.1f}s  emission {T} frames  {ratio:.4f}s/frame")

    tgt = torch.tensor([targets], dtype=torch.int32)
    with torch.inference_mode():
        aligned, scores = torchaudio.functional.forced_align(em.unsqueeze(0), tgt, blank=blank)
    spans = torchaudio.functional.merge_tokens(aligned[0], scores[0].exp(), blank=blank)
    # one span per target token, in order -> syllable onset = first char start
    syl_on = {}; syl_sc = {}
    for i, sp in enumerate(spans):
        si = tgt2syl[i]
        t0 = sp.start * ratio
        if si not in syl_on:
            syl_on[si] = t0; syl_sc[si] = []
        syl_sc[si].append(float(sp.score))

    # ---- downstream: ADAPTIVE, PER-LINE boundaries. Every scale comes from the
    # signal (tempo + THIS recording's own CTC-vs-attack delay); no absolute
    # constants. One segment PER LINE (as chanted); each cut placed at the precise
    # onset of the next line's first syllable — CTC says WHICH syllable, we correct
    # the measured CTC emission delay and snap to the nearest spectral-flux ATTACK.
    # A held final syllable is high-energy, so the cut falls at the next line's
    # attack — after the hold, never mid-hold.
    def smooth(e, w=10):
        return e if len(e) < w else np.convolve(e, np.ones(w) / w, mode="same")
    env_s = smooth(env); env_n = env_s / (float(np.max(env_s)) + 1e-9)

    # spectral-flux onset envelope → delay-free acoustic attacks
    _spec = torch.stft(torch.from_numpy(x).float(), n_fft=512, hop_length=128,
                       window=torch.hann_window(512), return_complex=True).abs()
    _S = torch.log1p(_spec)
    _flux = (_S[:, 1:] - _S[:, :-1]).clamp(min=0).sum(0)
    _flux = (_flux / (_flux.max() + 1e-9)).numpy()
    _fhop = 128 / SR
    _pthr = float(np.mean(_flux) + 0.5 * np.std(_flux))
    pk_t = np.array([i * _fhop for i in range(1, len(_flux) - 1)
                     if _flux[i] > _flux[i - 1] and _flux[i] >= _flux[i + 1] and _flux[i] >= _pthr])

    _onsets = sorted(syl_on.values())
    _gaps = np.diff(_onsets) if len(_onsets) > 1 else np.array([0.3])
    msd = float(np.median(_gaps))                            # median syllable spacing = tempo

    def nearest_peak(t, win):
        if len(pk_t) == 0:
            return None
        i = int(np.searchsorted(pk_t, t)); best = None
        for j in (i - 1, i):
            if 0 <= j < len(pk_t) and abs(pk_t[j] - t) <= win and (best is None or abs(pk_t[j] - t) < abs(pk_t[best] - t)):
                best = j
        return float(pk_t[best]) if best is not None else None

    # systematic CTC emission delay MEASURED from this recording (median of
    # ctc_onset − nearest acoustic attack), removed from every boundary
    _deltas = []
    for o in _onsets:
        p = nearest_peak(o, 0.4 * msd)
        if p is not None:
            _deltas.append(o - p)
    ctc_delay = float(np.median(_deltas)) if _deltas else 0.0

    def boundary(onset):
        t = onset - ctc_delay
        p = nearest_peak(t, 0.25 * msd)                      # snap to the true attack
        return p if p is not None else t

    # per-verse first onset + per-line first onset
    verse_first, line_first = {}, {}
    for si, (vi, li, iast, dv) in enumerate(seq):
        if si not in syl_on:
            continue
        verse_first.setdefault(vi, syl_on[si])
        line_first.setdefault((vi, li), syl_on[si])
    order_vi = sorted(verse_first, key=lambda vi: verse_first[vi])
    lead_gap = round(verse_first[order_vi[0]], 2) if verse_first[order_vi[0]] > 1.0 else 0.0

    voiced_level = float(np.percentile(env_n, 55))

    def last_voice_end(t_from):
        lo = max(0, int(t_from / hop)); idx = lo
        for i in range(lo, len(env_n)):
            if env_n[i] > voiced_level:
                idx = i
        return min(dur, (idx + 1) * hop + 0.5 * msd)

    # verse clip bounds = precise onset of each verse (delay-corrected attack)
    clip = {}; prevb = None
    for k, vi in enumerate(order_vi):
        cs = boundary(verse_first[vi]) if k == 0 else prevb
        if k < len(order_vi) - 1:
            b = max(boundary(verse_first[order_vi[k + 1]]), cs + msd)
        else:
            b = last_voice_end(cs + msd)
        clip[vi] = (cs, b); prevb = b

    os.makedirs(a.audio_out, exist_ok=True)
    # Clip filenames must be unique. `vid.split("-")[-1]` is fine for a single
    # -section sūkta (`v-3` -> `3`), but a multi-section document repeats it:
    # `srirudraprasnah-01-v3` and `srirudraprasnah-02-v3` both yield `v3` and
    # the second cut silently overwrites the first. Fall back to the full id.
    _short = [vobjs[vi]["id"].split("-")[-1] for vi in order_vi]
    _uniq = len(set(_short)) == len(_short)

    def clip_name(vid):
        return vid.split("-")[-1] if _uniq else vid
    # A short fade at each edge. It is not only anti-click: cutting a continuous
    # drone dead at both ends sounds abrupt, and the owner prefers the softer
    # entry. Kept at 60 ms on this material.
    #
    # It is NOT the cause of a swallowed first syllable, which was investigated
    # and is a playback race — a fade is baked into the file and would swallow
    # identically on every play, where the reported symptom was the same clip
    # differing between presses. See `startAt` in ChantReader.
    fd = min(0.06, 0.2 * msd)
    byverse, report = {}, []
    for vi in order_vi:
        cs, ce = clip[vi]
        d = round(ce - cs, 3)
        vid = vobjs[vi]["id"]; n = clip_name(vid)
        fname = f"{a.slug}-{n}.mp3"; fo = max(0.0, d - fd)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{cs:.3f}", "-to", f"{ce:.3f}",
                        "-i", wavpath, "-ac", "1", "-b:a", "64k",
                        "-af", f"afade=t=in:st=0:d={fd:.3f},afade=t=out:st={fo:.3f}:d={fd:.3f}",
                        os.path.join(a.audio_out, fname)], check=True)
        # ONE segment PER LINE; each internal cut at the precise onset of the next
        # line (delay-corrected, attack-snapped). Monotonic, clamped inside the clip.
        lis = sorted({li for (vv, li) in line_first if vv == vi})
        bnds = [cs]
        for li in lis[1:]:
            b = min(max(boundary(line_first[(vi, li)]), bnds[-1] + 0.3 * msd), ce - 0.3 * msd)
            bnds.append(b)
        bnds.append(ce)
        lines = [{"start": round(bnds[i] - cs, 3), "end": round(bnds[i + 1] - cs, 3)}
                 for i in range(len(lis))]
        scs = [s for si in range(len(seq)) if seq[si][0] == vi and si in syl_sc for s in syl_sc[si]]
        conf = sum(scs) / len(scs) if scs else 0.0
        byverse[vid] = {"file": fname, "duration": d, "label": f"Verse {n}", "lines": lines}
        report.append({"verse": vid, "start": round(cs, 2), "end": round(ce, 2), "dur": d,
                       "confidence": round(conf, 3), "padas": len(lines),
                       "lines_abs": [[round(bnds[i], 3), round(bnds[i + 1], 3)] for i in range(len(lis))]})

    cfs = [r["confidence"] for r in report]
    summary = {"model": a.model, "audio_dur": round(dur, 2), "lead_gap": lead_gap,
               "mean_conf": round(sum(cfs) / len(cfs), 3), "min_conf": round(min(cfs), 3),
               "verses": report}
    if a.report:
        json.dump(summary, open(a.report, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False, indent=1))

    if a.write:
        doc["recording"] = {"byVerse": byverse}
        doc["audioBase"] = f"/tests/{a.slug}/audio/"
        json.dump(doc, open(a.chant, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("patched", a.chant)

    if a.review:
        base = "file:///" + os.path.abspath(a.audio_out).replace("\\", "/").replace(" ", "%20")
        blocks = []
        for r in report:
            bv = byverse[r["verse"]]
            pads = "".join(f'<button data-f="{bv["file"]}" data-s="{ln["start"]}" data-e="{ln["end"]}">p{i+1}<em>{ln["start"]}–{ln["end"]}</em></button>'
                           for i, ln in enumerate(bv["lines"]))
            blocks.append(f'<div class=v style="--c:{r["confidence"]}"><h3>{r["verse"]} · {int(r["confidence"]*100)}%</h3>'
                          f'<button class=full data-f="{bv["file"]}" data-s="0" data-e="{bv["duration"]}">▶ verse · {r["dur"]}s</button>'
                          f'<div class=pads>{pads}</div></div>')
        html = f"""<!doctype html><meta charset=utf-8><title>{a.slug} · Sanskrit-model alignment</title>
<style>body{{font-family:system-ui;background:#141021;color:#ece7f6;max-width:820px;margin:1.5rem auto;padding:0 1rem}}
audio{{width:100%;position:sticky;top:0}} .gap{{color:#d8b56a}}
.v{{padding:.5rem .7rem;border-radius:10px;margin:.4rem 0;background:linear-gradient(90deg,hsl(calc(var(--c)*120) 55% 26%),transparent)}}
h3{{margin:.1rem 0 .4rem;font-size:1rem}} .pads{{display:flex;flex-wrap:wrap;gap:.4rem}}
button{{background:#2a2140;color:#ece7f6;border:1px solid #3a2f55;border-radius:7px;padding:.35rem .6rem;cursor:pointer;font:inherit}}
button.full{{background:#5e3fa0;border-color:#5e3fa0}} em{{color:#b79bef;font-style:normal;font-size:.78em;margin-left:.35em}}
button.playing{{outline:2px solid #d8b56a}}</style>
<h1>{a.slug} — Sanskrit-model alignment ({a.model})</h1>
<p class=gap>lead {lead_gap}s · mean {int(summary['mean_conf']*100)}% · min {int(summary['min_conf']*100)}%</p>
<audio id=au controls></audio><p style=font-size:.8rem>Tap a pāda to hear just it.</p>{''.join(blocks)}
<script>const au=document.getElementById('au'),B="{base}";let seg=null,cur=null;
function play(b){{const f=B+"/"+b.dataset.f,s=+b.dataset.s,e=+b.dataset.e;
 const go=()=>{{au.currentTime=s;seg=e;au.play();if(cur)cur.classList.remove('playing');cur=b;b.classList.add('playing');}};
 if(!au.src.endsWith(b.dataset.f)){{au.src=f;au.addEventListener('loadeddata',function o(){{au.removeEventListener('loadeddata',o);go();}});au.load();}}else go();}}
au.addEventListener('timeupdate',()=>{{if(seg!=null&&au.currentTime>=seg){{au.pause();seg=null;if(cur){{cur.classList.remove('playing');cur=null;}}}}}});
document.querySelectorAll('button').forEach(b=>b.onclick=()=>play(b));</script>"""
        open(a.review, "w", encoding="utf-8").write(html)
        print("review ->", a.review)


if __name__ == "__main__":
    main()
