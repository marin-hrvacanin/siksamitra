# -*- coding: utf-8 -*-
"""Alignment Studio — local, dev-only manual alignment editor for chants.

The workflow: given the chant TEXT (our `vedaunion.chant` JSON) and a recitation
(YouTube URL or local audio file), it (1) runs the automatic aligner for a rough
cut, then (2) opens a local web editor where each line is rendered in the SAME
brand style as the site (chant.css) with a draggable audio-cutter under it — drag
the start/end handles, hear the line, and (3) Save exports the adjusted chant
format (per-verse mp3s + per-line offsets), re-cutting the audio from the source.

Automatic alignment is only ever a starting point; continuous chant needs a human
to place the final boundary — this makes that fast. Dev-only, never shipped.

    python align_studio.py --chant ../../client/public/chants/<slug>.json \
        --audio "<youtube-url|file>" --slug <slug> [--model <hf id>] [--port 8756]

Deps (venv): torch/torchaudio, transformers, indic_transliteration, yt-dlp, ffmpeg.
"""
from __future__ import annotations
import os, sys, json, argparse, subprocess, wave, webbrowser, threading, html, io
import numpy as np
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, "..", ".."))          # app/
CHANT_CSS = os.path.join(APP, "client", "src", "components", "chant", "chant.css")
SR = 16000


def sh(*a):
    subprocess.run(list(a), check=True)


def get_audio(src, workdir):
    """Return a local media file for `src` (download if it's a URL)."""
    if src.startswith("http"):
        out = os.path.join(workdir, "src.%(ext)s")
        subprocess.run([sys.executable, "-m", "yt_dlp", "-f", "bestaudio", "-o", out, src], check=True)
        for f in os.listdir(workdir):
            if f.startswith("src."):
                return os.path.join(workdir, f)
        raise SystemExit("download failed")
    return src


def peaks(wav16k_path, per_sec=50):
    with wave.open(wav16k_path, "rb") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    step = SR // per_sec
    n = len(x) // step
    pk = [float(np.max(np.abs(x[i * step:(i + 1) * step])) if step else 0.0) for i in range(n)]
    m = max(pk) or 1.0
    return [round(p / m, 3) for p in pk], per_sec, len(x) / SR


def line_syllables(v):
    """Split a verse's tokens into display lines; each line = list of syllables,
    each syllable = {iast, deva, units:[{c,hold,change}]} for brand-style render."""
    lines, cur = [], []
    for t in v.get("tokens", []):
        tt = t.get("t")
        if tt == "br":
            lines.append(cur); cur = []
        elif tt == "syl":
            cur.append({"iast": t.get("iast", ""), "deva": t.get("deva", ""),
                        "units": [{"c": u.get("c", ""), "hold": u.get("hold"), "change": bool(u.get("change"))}
                                  for u in t.get("units", [])]})
    lines.append(cur)
    return [ln for ln in lines if ln]


def build_html(cfg):
    css = open(CHANT_CSS, encoding="utf-8").read() if os.path.exists(CHANT_CSS) else ""
    data = json.dumps(cfg["data"], ensure_ascii=False)
    return f"""<!doctype html><html><head><meta charset=utf-8><title>Alignment Studio · {html.escape(cfg['slug'])}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Hanken+Grotesk:wght@400;600&family=Gentium+Book+Plus&family=Noto+Serif+Devanagari&display=swap" rel="stylesheet">
<style>
/* brand tokens (light) so the imported chant.css classes render like the site */
:root{{--color-vellum:#faf7f0;--color-vellum-dim:#f3edde;--color-vellum-warm:#ebe2cc;--color-ink:#2a1b47;--color-ink-soft:#3a2862;--color-ink-mute:#6b5c7e;--color-ink-light:#9a8fa8;--color-rule:#d5cfc1;--color-rule-violet:#c8b9d8;--color-violet:#5e3fa0;--color-violet-deep:#432c75;--color-violet-glow:#8b6ec8;--color-gold:#b58e4a;--color-hold:#4e7a3f;--color-svara:#b23a2e;--color-change:#3d6fb4;--fs:1.35rem}}
{css}
*{{box-sizing:border-box}} body{{margin:0;background:#efe9db;color:var(--color-ink);font-family:"Hanken Grotesk",system-ui,sans-serif}}
header{{position:sticky;top:0;z-index:5;background:#1a1524;color:#ece7f6;padding:.7rem 1.2rem;display:flex;gap:1rem;align-items:center}}
header h1{{font-family:"Cormorant Garamond",serif;font-weight:600;margin:0;font-size:1.3rem}}
header .sp{{flex:1}} button{{font:inherit;cursor:pointer;border-radius:8px;border:1px solid #3a2f55;background:#2a2140;color:#ece7f6;padding:.4rem .8rem}}
#save{{background:#5e3fa0;border-color:#5e3fa0;font-weight:600}} .ok{{color:#8fd18f}}
main{{max-width:1000px;margin:1.2rem auto;padding:0 1rem}}
.verse{{background:#faf7f0;border:1px solid var(--color-rule);border-radius:14px;padding:1rem 1.1rem;margin:1rem 0;box-shadow:0 10px 30px -18px rgba(30,20,50,.4)}}
.verse h2{{font-family:"Cormorant Garamond",serif;font-weight:600;font-size:1rem;color:var(--color-violet);margin:.1rem 0 .8rem}}
.row{{display:grid;grid-template-columns:1fr;gap:.35rem;padding:.6rem 0;border-top:1px dashed var(--color-rule)}}
.row:first-of-type{{border-top:0}}
.ltext .pada{{font-size:1.25rem}}
.wrap{{position:relative;height:64px;background:#0f0c17;border-radius:8px;overflow:hidden;user-select:none}}
canvas{{display:block;width:100%;height:100%}}
.handle{{position:absolute;top:0;bottom:0;width:10px;margin-left:-5px;cursor:ew-resize;background:#d8b56a}}
.handle.e{{background:#b79bef}} .sel{{position:absolute;top:0;bottom:0;background:rgba(139,110,200,.18);pointer-events:none}}
.ctr{{display:flex;gap:.5rem;align-items:center;font-size:.75rem;color:var(--color-ink-mute);font-variant-numeric:tabular-nums}}
.ctr button{{background:#efe9db;color:var(--color-ink);border-color:var(--color-rule);padding:.25rem .6rem}}
</style></head><body>
<header><h1>Alignment Studio · {html.escape(cfg['slug'])}</h1><span class=sp></span>
<span id=msg style="font-size:.8rem;color:#b79bef"></span>
<button id=save>Save &amp; export</button></header>
<main id=app>loading…</main>
<audio id=au preload=auto src="/full.mp3"></audio>
<script>
const DATA = {data};
const PPS = DATA.pps, DUR = DATA.dur, PK = DATA.peaks;
const au = document.getElementById('au');
let segEnd = null;
au.addEventListener('timeupdate', ()=>{{ if(segEnd!=null && au.currentTime>=segEnd){{au.pause();segEnd=null;}} }});

function renderUnits(syl){{  // mirror MarkedText: group consecutive units sharing a holding
  const out=[]; let i=0; const u=syl.units.length?syl.units:[{{c:syl.iast}}];
  while(i<u.length){{ const h=u[i].hold;
    if(h){{ let j=i; const run=[]; while(j<u.length && u[j].hold===h){{run.push(u[j]);j++;}}
      out.push(`<span class="hold hold-${{h}}">`+run.map(r=>`<span class="u${{r.change?' is-change':''}}">${{r.c}}</span>`).join('')+`</span>`); i=j; }}
    else {{ out.push(`<span class="u${{u[i].change?' is-change':''}}">${{u[i].c}}</span>`); i++; }} }}
  return `<span class="syl">`+out.join('')+`</span>`; }}

function drawWave(cv, t0, t1){{ const ctx=cv.getContext('2d'); const W=cv.width=cv.clientWidth, H=cv.height=cv.clientHeight;
  ctx.clearRect(0,0,W,H); ctx.fillStyle='#4a3f66';
  const i0=Math.max(0,Math.floor(t0*PPS)), i1=Math.min(PK.length,Math.ceil(t1*PPS));
  for(let i=i0;i<i1;i++){{ const x=(i-i0)/(i1-i0)*W, h=PK[i]*H*0.9; ctx.fillRect(x,(H-h)/2,Math.max(1,W/(i1-i0)),h); }} }}

const bounds = {{}};  // vid -> [[s,e],...]
function buildRow(vid, li, s, e, syls){{
  const pad=Math.max(0.6,(e-s)*0.4); const t0=Math.max(0,s-pad), t1=Math.min(DUR,e+pad);
  const row=document.createElement('div'); row.className='row';
  row.innerHTML=`<div class="ltext"><div class="pada pada--iast"><div class="pada-line">${{syls.map(renderUnits).join('<span class=wsp> </span>')}}</div></div></div>
    <div class="wrap"><canvas></canvas><div class="sel"></div><div class="handle s"></div><div class="handle e"></div></div>
    <div class="ctr"><button class="play">▶ line</button><span class="rd"></span></div>`;
  const wrap=row.querySelector('.wrap'), cv=row.querySelector('canvas'), sel=row.querySelector('.sel');
  const hs=row.querySelector('.handle.s'), he=row.querySelector('.handle.e'), rd=row.querySelector('.rd');
  const toX=t=>(t-t0)/(t1-t0)*wrap.clientWidth, toT=x=>t0+x/wrap.clientWidth*(t1-t0);
  function place(){{ hs.style.left=toX(s)+'px'; he.style.left=toX(e)+'px'; sel.style.left=toX(s)+'px'; sel.style.width=(toX(e)-toX(s))+'px';
    rd.textContent=`${{s.toFixed(2)}}s → ${{e.toFixed(2)}}s  (${{(e-s).toFixed(2)}}s)`; bounds[vid][li]=[s,e]; }}
  function drag(h, set){{ h.onpointerdown=ev=>{{ h.setPointerCapture(ev.pointerId);
    h.onpointermove=e2=>{{ const x=e2.clientX-wrap.getBoundingClientRect().left; set(Math.max(t0,Math.min(t1,toT(x)))); place(); }};
    h.onpointerup=()=>{{h.onpointermove=null;h.onpointerup=null;}}; }}; }}
  drag(hs, t=>{{ s=Math.min(t,e-0.05); }}); drag(he, t=>{{ e=Math.max(t,s+0.05); }});
  row.querySelector('.play').onclick=()=>{{ au.currentTime=s; segEnd=e; au.play(); }};
  requestAnimationFrame(()=>{{ drawWave(cv,t0,t1); place(); }});
  return row;
}}
function render(){{ const app=document.getElementById('app'); app.innerHTML='';
  for(const v of DATA.verses){{ bounds[v.id]=[]; const vd=document.createElement('div'); vd.className='verse';
    vd.innerHTML=`<h2>${{v.id}}${{v.n?(' · '+v.n):''}}</h2>`;
    v.lines.forEach((ln,li)=>{{ bounds[v.id][li]=[ln.s,ln.e]; vd.appendChild(buildRow(v.id,li,ln.s,ln.e,ln.syls)); }});
    app.appendChild(vd); }} }}
render();
window.addEventListener('resize',render);
document.getElementById('save').onclick=async()=>{{ const msg=document.getElementById('msg'); msg.textContent='saving…';
  const r=await fetch('/save',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify({{bounds}})}});
  const j=await r.json(); msg.innerHTML=j.ok?`<span class=ok>saved ✓ ${{j.files}} files</span>`:'error'; }};
</script></body></html>"""


def recut_and_write(cfg, bounds):
    """Save handler: for each verse, clip = [min line start, max line end]; re-cut
    from the full source with short fades; per-line offsets relative to the clip;
    patch the chant JSON's recording.byVerse + audioBase."""
    doc = json.load(open(cfg["chant"], encoding="utf-8"))
    out = cfg["audio_out"]; os.makedirs(out, exist_ok=True)
    byverse = {}; nfiles = 0
    for v in doc["sections"] and [v for s in doc["sections"] for v in s["verses"]]:
        vid = v["id"]
        if vid not in bounds or not bounds[vid]:
            continue
        segs = bounds[vid]
        cs = min(s for s, e in segs); ce = max(e for s, e in segs)
        n = vid.split("-")[-1]; fname = f"{cfg['slug']}-{n}.mp3"
        d = round(ce - cs, 3); fd = min(0.06, 0.2 * max(0.1, (ce - cs) / max(1, len(segs))))
        fo = max(0.0, d - fd)
        sh("ffmpeg", "-y", "-v", "error", "-ss", f"{cs:.3f}", "-to", f"{ce:.3f}", "-i", cfg["full_src"],
           "-ac", "1", "-b:a", "64k",
           "-af", f"afade=t=in:st=0:d={fd:.3f},afade=t=out:st={fo:.3f}:d={fd:.3f}",
           os.path.join(out, fname))
        nfiles += 1
        lines = [{"start": round(s - cs, 3), "end": round(e - cs, 3)} for s, e in segs]
        byverse[vid] = {"file": fname, "duration": d, "label": f"Verse {n}", "lines": lines}
    doc["recording"] = {"byVerse": byverse}
    doc["audioBase"] = f"/tests/{cfg['slug']}/audio/"
    json.dump(doc, open(cfg["chant"], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return nfiles


def serve(cfg):
    html_page = build_html(cfg)

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            if self.path == "/" or self.path.startswith("/index"):
                body = html_page.encode("utf-8")
                self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
            elif self.path.startswith("/full.mp3"):
                with open(cfg["full_web"], "rb") as f:
                    body = f.read()
                self.send_response(200); self.send_header("Content-Type", "audio/mpeg")
                self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
            else:
                self.send_response(404); self.end_headers()

        def do_POST(self):
            if self.path != "/save":
                self.send_response(404); self.end_headers(); return
            n = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(n) or b"{}")
            try:
                files = recut_and_write(cfg, payload.get("bounds", {}))
                resp = {"ok": True, "files": files}
            except Exception as e:  # noqa
                resp = {"ok": False, "error": str(e)[:200]}
            b = json.dumps(resp).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(b))); self.end_headers(); self.wfile.write(b)

    srv = HTTPServer(("127.0.0.1", cfg["port"]), H)
    url = f"http://127.0.0.1:{cfg['port']}/"
    print(f"\nAlignment Studio: {url}\n(edit the boundaries, Save to export; Ctrl+C to stop)")
    threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("stopped")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chant", required=True); ap.add_argument("--audio", required=True)
    ap.add_argument("--slug", required=True)
    ap.add_argument("--model", default="MahmoudAshraf/mms-300m-1130-forced-aligner")
    ap.add_argument("--port", type=int, default=8756)
    ap.add_argument("--build-only", action="store_true", help="run align + write the editor HTML to a file, don't serve")
    a = ap.parse_args()

    work = os.path.join(HERE, ".studio", a.slug); os.makedirs(work, exist_ok=True)
    audio = get_audio(a.audio, work)
    full_web = os.path.join(work, "full.mp3")
    sh("ffmpeg", "-y", "-v", "error", "-i", audio, "-ac", "1", "-b:a", "96k", full_web)
    wav16 = os.path.join(work, "full.16k.wav")
    sh("ffmpeg", "-y", "-v", "error", "-i", audio, "-ac", "1", "-ar", str(SR), wav16)

    # 1. automatic rough alignment (starting point)
    audio_out = os.path.abspath(os.path.join(APP, "client", "public", "tests", a.slug, "audio"))
    report = os.path.join(work, "report.json")
    print("running automatic alignment (starting point)…")
    sh(sys.executable, os.path.join(HERE, "align_sanskrit.py"), "--chant", a.chant, "--audio", audio,
       "--audio-out", audio_out, "--slug", a.slug, "--model", a.model, "--report", report, "--write")

    rep = json.load(open(report, encoding="utf-8"))
    labs = {r["verse"]: r.get("lines_abs", []) for r in rep["verses"]}
    doc = json.load(open(a.chant, encoding="utf-8"))
    pk, pps, dur = peaks(wav16)

    verses = []
    for v in (v for s in doc["sections"] for v in s["verses"]):
        vid = v["id"]; syl_lines = line_syllables(v); ab = labs.get(vid, [])
        lines = []
        for li, syls in enumerate(syl_lines):
            s, e = (ab[li] if li < len(ab) else [0.0, dur])
            lines.append({"s": s, "e": e, "syls": syls})
        if lines:
            verses.append({"id": vid, "n": v.get("n"), "lines": lines})

    cfg = {"slug": a.slug, "chant": os.path.abspath(a.chant), "audio_out": audio_out,
           "full_web": full_web, "full_src": audio, "port": a.port,
           "data": {"pps": pps, "dur": round(dur, 3), "peaks": pk, "verses": verses}}

    if a.build_only:
        p = os.path.join(work, "studio.html")
        open(p, "w", encoding="utf-8").write(build_html(cfg))
        print("wrote", p, "| verses", len(verses))
        return
    serve(cfg)


if __name__ == "__main__":
    main()
