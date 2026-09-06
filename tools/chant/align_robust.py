# -*- coding: utf-8 -*-
"""Robust chant audio<->text alignment (non-accumulating, confidence-scored).

Unlike a single global CTC forced pass (which assumes the audio is EXACTLY the
text 1:1 and lets a local mismatch shift everything after it), this:

  Stage 1  GLOBAL pass over the whole recording (MMS_FA) just to get the rough
           ORDER of verses, then RE-ANCHOR each verse independently inside a
           padded window around its rough span. Because each verse is solved in
           its own local window, a bad/again-chanted/elongated verse cannot drag
           the others — error can't accumulate past a verse boundary.
  Stage 2  Energy envelope: snap each inter-verse boundary to the nearest local
           RMS minimum (the recitation is a continuous drone with no true
           silences), and detect a LEADING GAP (an intro oṁ / invocation that
           the text does not cover) instead of forcing the text onto it.
  Stage 3  Per-verse CONFIDENCE (mean CTC token prob) + explicit gaps, a review
           HTML to eyeball/scrub, per-verse mp3 cuts, and byVerse patched into
           the chant JSON.

Run:  python align_robust.py --chant <chant.json> --audio <file> \
          --audio-out <public/tests/<slug>/audio> --slug <slug>
Reuses Śikṣāmitra's MMS aligner + romanizer via sys.path (self-contained
otherwise). Local-only; nothing here is wired into the app build.
"""
import os, sys, json, argparse, subprocess, wave, math
import numpy as np

os.environ.setdefault("TORCH_HOME", r"D:\Projects\siksamitra\cache\models")
sys.path.insert(0, r"D:\Projects\siksamitra")  # align_roman.to_phones
import torch
from torchaudio.pipelines import MMS_FA
from align_roman import to_phones

SR = 16000


# ---------------------------------------------------------------- text
def verse_padas(v):
    """Split a verse's tokens into padas (at line breaks) -> IAST strings."""
    padas, cur = [], []
    for t in v["tokens"]:
        tt = t.get("t")
        if tt == "br":
            if cur:
                padas.append("".join(cur).strip())
                cur = []
        elif tt == "syl":
            cur.append(t.get("iast", ""))
        elif tt == "sp":
            cur.append(" ")
    if cur:
        padas.append("".join(cur).strip())
    return [p for p in padas if p]


def verse_syllables(v):
    """Ordered syllables with the DISPLAY line index each belongs to (line index
    increments at each `br`). Lets us align at syllable granularity — where the
    ONSETS are reliable — then aggregate back up to per-line audio segments."""
    out, li = [], 0
    for t in v["tokens"]:
        tt = t.get("t")
        if tt == "br":
            li += 1
        elif tt == "syl":
            out.append((t.get("iast", ""), li))
    return out


# ---------------------------------------------------------------- audio
def decode(path, hp=100):
    """ffmpeg -> 16k mono wav with a gentle high-pass to tame the drone."""
    out = path + ".16k.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR),
         "-af", f"highpass=f={hp}", out], check=True)
    with wave.open(out, "rb") as w:
        raw = w.readframes(w.getnframes())
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    return x, out


def rms_env(x, hop=0.02):
    h = int(hop * SR)
    n = len(x) // h
    e = np.array([np.sqrt(np.mean(x[i * h:(i + 1) * h] ** 2) + 1e-9) for i in range(n)])
    return e, hop


def snap_to_min(t, env, hop, win=0.45):
    """Snap a boundary time to the lowest-energy frame within +/- win seconds."""
    c = int(t / hop)
    lo = max(0, c - int(win / hop)); hi = min(len(env), c + int(win / hop))
    if hi <= lo:
        return t
    return (lo + int(np.argmin(env[lo:hi]))) * hop


# ---------------------------------------------------------------- MMS
def build_emissions(model, wav, chunk_s=15.0):
    step = int(chunk_s * SR)
    if wav.size(1) <= step:
        with torch.inference_mode():
            em, _ = model(wav)
        return em
    parts = []
    with torch.inference_mode():
        for s in range(0, wav.size(1), step):
            seg = wav[:, s:min(wav.size(1), s + step)].contiguous()
            if seg.size(1) < int(0.1 * SR):
                continue
            em, _ = model(seg)
            parts.append(em.detach().clone()); del em
    return torch.cat(parts, dim=1)


def align_words(aligner, tokenizer, em_frames, words):
    """Force-align `words` within an emission slice. Returns per-word (s,e,score)
    in FRAME units relative to the slice."""
    tokens = tokenizer(words)
    with torch.inference_mode():
        spans = aligner(em_frames, tokens)
    out = []
    for sp in spans:
        if not sp:
            out.append(None); continue
        out.append((sp[0].start, sp[-1].end,
                    sum(float(s.score) for s in sp) / max(1, len(sp))))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chant", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--audio-out", required=True)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--report", default=None)
    ap.add_argument("--review", default=None)
    ap.add_argument("--pad", type=float, default=3.0, help="re-anchor window pad (s)")
    ap.add_argument("--write", action="store_true",
                    help="patch recording.byVerse + audioBase into the chant JSON")
    a = ap.parse_args()

    doc = json.load(open(a.chant, encoding="utf-8"))
    verses, vsyls = [], []  # verses[i]=(id,padas); vsyls[i]=[(roman_syllable, line_idx), ...]
    for v in (v for sec in doc["sections"] for v in sec["verses"]):
        padas = verse_padas(v); syls = verse_syllables(v)
        if not padas or not syls:
            continue
        verses.append((v["id"], padas))
        vsyls.append([("".join(to_phones(s)) or s, li) for s, li in syls])
    flat = [(vi, "".join(to_phones(p))) for vi, (_, padas) in enumerate(verses) for p in padas]
    print(f"{len(verses)} verses, {sum(len(s) for s in vsyls)} syllables")

    x, wavpath = decode(a.audio)
    dur = len(x) / SR
    env, hop = rms_env(x)
    print(f"audio {dur:.1f}s")

    model = MMS_FA.get_model(); model.eval()
    torch.set_num_threads(max(1, os.cpu_count() or 2))
    tokenizer = MMS_FA.get_tokenizer(); aligner = MMS_FA.get_aligner()

    wav = torch.from_numpy(x).unsqueeze(0)
    em = build_emissions(model, wav)
    ratio = wav.size(1) / em.size(1) / SR  # sec / frame
    F = em.size(1)
    print(f"emission {F} frames  {ratio:.4f}s/frame")

    # --- Stage 1a: GLOBAL pass -> rough per-verse [start,end]
    g = align_words(aligner, tokenizer, em[0], [r for _, r in flat])
    rough = {}
    for (vi, _), sp in zip(flat, g):
        if sp is None:
            continue
        st, en = sp[0] * ratio, sp[1] * ratio
        if vi not in rough:
            rough[vi] = [st, en]
        else:
            rough[vi][0] = min(rough[vi][0], st); rough[vi][1] = max(rough[vi][1], en)

    # --- Stage 1b: RE-ANCHOR each verse locally at SYLLABLE granularity.
    # Syllable ONSETS are reliable; word/pada END times lag on sustained chant
    # (the model rides the transition into the next syllable). So we align every
    # syllable and anchor all boundaries to onsets — never to an end or to a
    # midpoint of laggy ends (that midpoint is what made each line grab the next
    # line's first sound and shortened the following line).
    vsp = []  # per verse: [(start_abs, end_abs, score, line_idx), ...]
    for vi, (vid, padas) in enumerate(verses):
        if vi not in rough:
            vsp.append([]); continue
        rs, re_ = rough[vi]
        f0 = max(0, int((rs - a.pad) / ratio)); f1 = min(F, int((re_ + a.pad) / ratio))
        if f1 - f0 < 3:
            vsp.append([]); continue
        loc = align_words(aligner, tokenizer, em[0][f0:f1], [r for r, _ in vsyls[vi]])
        vsp.append([((f0 + p[0]) * ratio, (f0 + p[1]) * ratio, p[2], li)
                    for (r, li), p in zip(vsyls[vi], loc) if p])

    placed = [(vi, s) for vi, s in enumerate(vsp) if s]
    placed.sort(key=lambda r: r[1][0][0])
    order_vi = [vi for vi, _ in placed]
    v_onset = {vi: s[0][0] for vi, s in placed}        # first-syllable onset per verse
    lead_gap = round(v_onset[order_vi[0]], 2) if v_onset[order_vi[0]] > 1.0 else 0.0

    def smooth(e, w=10):
        return e if (w <= 1 or len(e) < w) else np.convolve(e, np.ones(w) / w, mode="same")
    env_s = smooth(env)

    def trough_before(onset, back):
        """Energy dip just BEFORE an onset — the natural cut in front of a unit,
        breath present or not. Onset-anchored, so a laggy end time can never push
        the cut past the next unit's first sound."""
        lo = max(0, int((onset - back) / hop)); hi = min(len(env_s), int((onset + 0.05) / hop))
        return onset if hi - lo < 2 else (lo + int(np.argmin(env_s[lo:hi]))) * hop

    def last_voice_end(t_from):
        lo = max(0, int(t_from / hop)); thr = 0.15 * float(np.max(env)); idx = lo
        for i in range(lo, len(env)):
            if env[i] > thr:
                idx = i
        return min(dur, (idx + 1) * hop + 0.4)

    # --- Stage 2: verse clip end = trough before the NEXT verse's first onset
    # (a breath sits there); final verse extends to end-of-voice.
    clip = {}
    prevb = None
    for k, vi in enumerate(order_vi):
        cs = v_onset[vi] if k == 0 else prevb
        if k < len(order_vi) - 1:
            b = max(trough_before(v_onset[order_vi[k + 1]], 0.8), cs + 0.5)
        else:
            b = last_voice_end(vsp[vi][-1][1] - 0.5)
        clip[vi] = (cs, b); prevb = b

    # --- Stage 3: cut per-verse mp3 + onset-anchored per-line offsets + confidence.
    # Natural-edit polish: trim to the voiced edges (minimal dead air, attack/tail
    # kept) then a very short fade in/out — clips start/end like a human edit.
    os.makedirs(a.audio_out, exist_ok=True)
    voiced_thr = 0.18 * float(env_s.max())

    def voiced_bounds(t0, t1):
        lo = max(0, int(t0 / hop)); hi = min(len(env_s), int(t1 / hop))
        idx = [i for i in range(lo, hi) if env_s[i] > voiced_thr]
        return (idx[0] * hop, (idx[-1] + 1) * hop) if idx else (t0, t1)

    byverse, report = {}, []
    for vi in order_vi:
        cs, ce = clip[vi]
        on, off = voiced_bounds(cs, ce)
        clip_s = max(cs, on - 0.10); clip_e = min(ce, off + 0.18)
        if clip_e - clip_s < 0.4:
            clip_s, clip_e = cs, ce
        d = round(clip_e - clip_s, 3)
        vid = verses[vi][0]; n = vid.split("-")[-1]
        fname = f"{a.slug}-{n}.mp3"; fo = max(0.0, d - 0.05)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{clip_s:.3f}", "-to", f"{clip_e:.3f}",
                        "-i", wavpath, "-ac", "1", "-b:a", "64k",
                        "-af", f"afade=t=in:st=0:d=0.025,afade=t=out:st={fo:.3f}:d=0.05",
                        os.path.join(a.audio_out, fname)], check=True)
        # per-line boundaries = trough before each line's FIRST-syllable onset
        # (onset-anchored → a line clip never grabs the next line's first sound)
        rows = vsp[vi]
        line_first = {}
        for st, en, sc, li in rows:
            line_first.setdefault(li, st)
        lis = sorted(line_first)
        bounds_abs = [clip_s]
        for li in lis[1:]:
            b = min(max(trough_before(line_first[li], 0.30), bounds_abs[-1] + 0.12), clip_e - 0.05)
            bounds_abs.append(b)
        bounds_abs.append(clip_e)
        lines = [{"start": round(bounds_abs[i] - clip_s, 3), "end": round(bounds_abs[i + 1] - clip_s, 3)}
                 for i in range(len(lis))]
        conf = sum(sc for *_, sc, _ in rows) / len(rows)
        byverse[vid] = {"file": fname, "duration": d, "label": f"Verse {n}", "lines": lines}
        report.append({"verse": vid, "start": round(clip_s, 2), "end": round(clip_e, 2), "dur": d,
                       "confidence": round(conf, 3), "padas": len(lines)})

    conf = [r["confidence"] for r in report]
    summary = {"audio_dur": round(dur, 2), "lead_gap": lead_gap,
               "n_verses": len(report), "mean_conf": round(sum(conf) / len(conf), 3),
               "min_conf": round(min(conf), 3), "verses": report}
    if a.report:
        json.dump(summary, open(a.report, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    # patch chant JSON byVerse + audioBase — ONLY when asked. This script is
    # also used as an independent CROSS-CHECK of another aligner's output, and
    # patching unconditionally silently replaced that aligner's byVerse (and its
    # clip filenames) with this one's, in the very file the comparison was about
    # to be merged from. `align_sanskrit.py` has always required --write; so does
    # this now.
    if a.write:
        doc["recording"] = {"byVerse": byverse}
        doc["audioBase"] = f"/tests/{a.slug}/audio/"
        json.dump(doc, open(a.chant, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    else:
        print("(not patching %s — pass --write to)" % a.chant)

    # review html \u2014 PER-P\u0100DA: hear each p\u0101da (its offset clip) or the whole verse
    if a.review:
        base = "file:///" + os.path.abspath(a.audio_out).replace("\\", "/").replace(" ", "%20")
        blocks = []
        for r in report:
            vid = r["verse"]; bv = byverse[vid]
            pads = "".join(
                f'<button class=p data-f="{bv["file"]}" data-s="{ln["start"]}" data-e="{ln["end"]}">p{i+1}<em>{ln["start"]}\u2013{ln["end"]}s</em></button>'
                for i, ln in enumerate(bv["lines"]))
            blocks.append(
                f'<div class=v style="--c:{r["confidence"]}"><h3>{vid} \u00b7 {int(r["confidence"]*100)}%</h3>'
                f'<button class=full data-f="{bv["file"]}" data-s="0" data-e="{bv["duration"]}">\u25b6 whole verse \u00b7 {r["dur"]}s</button>'
                f'<div class=pads>{pads}</div></div>')
        body = "".join(blocks)
        html = f"""<!doctype html><meta charset=utf-8><title>{a.slug} alignment</title>
<style>body{{font-family:system-ui;background:#1a1524;color:#ece7f6;max-width:820px;margin:1.5rem auto;padding:0 1rem}}
h1{{font-weight:600}} .gap{{color:#d8b56a}} audio{{width:100%;position:sticky;top:0;z-index:2}}
.v{{padding:.55rem .7rem;border-radius:10px;margin:.5rem 0;background:linear-gradient(90deg,hsl(calc(var(--c)*120) 55% 26%),transparent)}}
h3{{margin:.1rem 0 .45rem;font-size:1rem}} .pads{{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.4rem}}
button{{background:#2a2140;color:#ece7f6;border:1px solid #3a2f55;border-radius:7px;padding:.35rem .6rem;cursor:pointer;font:inherit}}
button.full{{background:#5e3fa0;border-color:#5e3fa0}} button em{{color:#b79bef;font-style:normal;font-size:.78em;margin-left:.4em}}
button.playing{{outline:2px solid #d8b56a}}</style>
<h1>{a.slug} \u2014 per-p\u0101da review</h1>
<p class=gap>Leading gap {summary['lead_gap']}s \u00b7 mean {int(summary['mean_conf']*100)}% \u00b7 min {int(summary['min_conf']*100)}%</p>
<audio id=au controls></audio>
<p style=font-size:.8rem>Tap a p\u0101da to hear just that p\u0101da; \u201cwhole verse\u201d plays the full clip. Tint = confidence.</p>
{body}
<script>const au=document.getElementById('au'),B="{base}";let seg=null,cur=null;
function play(b){{const f=B+"/"+b.dataset.f,s=+b.dataset.s,e=+b.dataset.e;
 const go=()=>{{au.currentTime=s;seg=e;au.play();if(cur)cur.classList.remove('playing');cur=b;b.classList.add('playing');}};
 if(!au.src.endsWith(b.dataset.f)){{au.src=f;au.addEventListener('loadeddata',function o(){{au.removeEventListener('loadeddata',o);go();}});au.load();}}else go();}}
au.addEventListener('timeupdate',()=>{{if(seg!=null&&au.currentTime>=seg){{au.pause();seg=null;if(cur){{cur.classList.remove('playing');cur=null;}}}}}});
document.querySelectorAll('button').forEach(b=>b.onclick=()=>play(b));</script>"""
        open(a.review, "w", encoding="utf-8").write(html)

    print(json.dumps(summary, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
