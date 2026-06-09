#!/usr/bin/env python
"""Build a standalone website example from a .smdoc, with SINGLE-COPY audio.

Reads a .smdoc, strips the per-attachment inline audio (the editor inlines it once
per line — 32× here = 251 MB), embeds each distinct audio ONCE, and emits a
self-contained HTML whose playback resolves audio by id and plays each line's
[start,end] with fades. Backward compatible: an attachment that still carries its
own src is used as-is.

    PYTHONUTF8=1 python tests/build_example.py <in.smdoc> <out.html> "<Title>"
"""
import base64
import html as _html
import json
import lzma
import os
import re
import sys
import zlib

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read_smdoc(path):
    raw = open(path, 'rb').read()
    if raw[:4] == b'SMDI':
        data = lzma.decompress(raw[4:])
    elif raw[:4] == b'SMDC':
        data = zlib.decompress(raw[4:])
    else:
        data = raw
    return json.loads(data)


_AUDIO_TAG_RE = re.compile(r'<audio\b[^>]*></audio>|<audio\b[^>]*/?>', re.I | re.S)
_DATAURI_RE = re.compile(r'data:audio/[^;"\']+;base64,[A-Za-z0-9+/=]+')


def dedupe_audio(content):
    """Return (content_without_inline_audio, {audio_id: data_uri}).

    Strips data-audio-src="…" and inner <audio …src=…> from every attachment,
    recording the first data URI seen per audio id so it can be embedded once."""
    id_to_uri = {}

    # Capture id -> first data URI from data-audio-src on each attachment span.
    for m in re.finditer(r'data-audio-id="([^"]*)"[^>]*?data-audio-src="(data:audio[^"]+)"', content):
        id_to_uri.setdefault(m.group(1), m.group(2))
    # Fallback: any <audio src="data:..."> tied to a nearby id (best-effort).
    if not id_to_uri:
        ids = re.findall(r'data-audio-id="([^"]*)"', content)
        uris = _DATAURI_RE.findall(content)
        if ids and uris:
            id_to_uri[ids[0]] = uris[0]

    # Strip the heavy inline copies.
    content = re.sub(r'\sdata-audio-src="data:audio[^"]*"', '', content)
    content = _AUDIO_TAG_RE.sub('', content)        # drop per-line <audio> elements
    content = _DATAURI_RE.sub('', content)          # any stray inline data URIs
    return content, id_to_uri


def build_html(content, title, id_to_uri, theme='light'):
    shared = ''.join(
        f'<audio data-shared-audio="{_html.escape(aid)}" src="{uri}" preload="auto" '
        f'style="display:none"></audio>\n'
        for aid, uri in id_to_uri.items()
    )
    # Inline the FULL editor stylesheet so the content (holdings, pauses, svaras,
    # comments, translations, paragraph styles) renders exactly as in the editor. The
    # editor-chrome rules (toolbar/ribbon) simply match nothing here and are harmless.
    shared_css = ''
    for css_file in ('styles.css', 'viewer-export-shared.css'):
        try:
            shared_css += '\n' + open(os.path.join(BASE, css_file), encoding='utf-8').read()
        except Exception:
            pass

    # Single-copy playback: one shared <audio> per id; each .ql-audio-attachment gets a
    # play button that plays its [start,end] with fades. Backward compatible — if an
    # attachment carries its own <audio src>, that element is used instead of the shared one.
    script = r"""
<script>
(function(){
  var shared = {};
  document.querySelectorAll('audio[data-shared-audio]').forEach(function(a){ shared[a.getAttribute('data-shared-audio')] = a; });
  var anyShared = Object.keys(shared)[0];
  var playing = null;
  function stop(){ if(playing){ try{playing.audio.pause();}catch(e){} if(playing.btn) playing.btn.textContent='▶'; if(playing.onT) playing.audio.removeEventListener('timeupdate', playing.onT); playing=null; } }
  document.querySelectorAll('.ql-audio-attachment').forEach(function(att){
    var id = att.getAttribute('data-audio-id') || anyShared;
    var own = att.querySelector('audio[src]');
    var audio = own || shared[id] || (anyShared ? shared[anyShared] : null);
    if(!audio) return;
    var start = parseFloat(att.getAttribute('data-start-time'))||0;
    var endA = att.getAttribute('data-end-time');
    var end = (endA!=null && endA!=='') ? parseFloat(endA) : null;
    var fi = parseFloat(att.getAttribute('data-fade-in'))||0;
    var fo = parseFloat(att.getAttribute('data-fade-out'))||0;
    var btn = document.createElement('button');
    btn.className='play-cut'; btn.type='button'; btn.textContent='▶';
    btn.title='Play this line';
    var p = att.closest('p') || att.parentNode;
    if(p && p.parentNode){ p.style.position='relative'; btn.style.cssText='position:absolute;left:-2.4em;top:0.1em;'; p.insertBefore(btn, p.firstChild); }
    btn.addEventListener('click', function(e){
      e.preventDefault();
      var wasMe = playing && playing.audio===audio && playing.btn===btn;
      stop();
      if(wasMe) return;
      try{ audio.currentTime = start; }catch(e){}
      var onT = function(){
        var t = audio.currentTime;
        var v = 1;
        if(fi>0 && t < start+fi) v = Math.max(0,(t-start)/fi);
        if(fo>0 && end!=null && t > end-fo) v = Math.min(v, Math.max(0,(end-t)/fo));
        audio.volume = Math.max(0,Math.min(1,v));
        if(end!=null && t >= end){ stop(); }
      };
      audio.addEventListener('timeupdate', onT);
      playing = {audio:audio, btn:btn, onT:onT};
      audio.play().then(function(){ btn.textContent='■'; }).catch(function(){});
    });
  });
})();
</script>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="śikṣāmitra">
<title>{_html.escape(title)}</title>
<link rel="icon" href="../../favicon.ico" type="image/x-icon">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Gentium+Plus:ital,wght@0,400;0,700;1,400&family=IBM+Plex+Sans:wght@300;400;500;600&family=Noto+Serif+Devanagari:wght@400;600&display=swap" rel="stylesheet">
<style>
{shared_css}
body{{margin:0;background:var(--bg-body,#f5f3f0);}}
.paper{{max-width:820px;margin:2rem auto;background:#fff;padding:3rem 3.5rem;box-shadow:0 4px 24px rgba(0,0,0,.08);border-radius:6px;}}
.ql-editor{{font-family:'Gentium Plus','Noto Serif Devanagari',Georgia,serif;font-size:20px;line-height:1.7;color:#1a1816;}}
.play-cut{{cursor:pointer;border:1px solid #b8813d;background:#fff;color:#b8813d;border-radius:50%;width:1.7em;height:1.7em;font-size:0.7em;line-height:1;padding:0;}}
.play-cut:hover{{background:#b8813d;color:#fff;}}
.back{{font-family:'IBM Plex Sans',sans-serif;font-size:0.8rem;padding:1rem 0 0 1rem;}}
.back a{{color:#6b6560;text-decoration:none;}}
</style>
</head>
<body data-theme="{theme}">
<div class="back"><a href="../">← examples</a></div>
{shared}
<div class="paper"><div class="content"><div class="ql-editor">{content}</div></div></div>
{script}
</body>
</html>"""


def main():
    inp, out, title = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else 'Example')
    doc = read_smdoc(inp)
    content = doc.get('content', '')
    theme = (doc.get('styles') or {}).get('theme', 'light')
    print(f'content in: {len(content):,} bytes; attachments: {content.count("ql-audio-attachment")}')
    content, id_to_uri = dedupe_audio(content)
    total_audio = sum(len(u) for u in id_to_uri.values())
    print(f'unique audios: {len(id_to_uri)} ({total_audio:,} b64 bytes); content after strip: {len(content):,} bytes')
    out_html = build_html(content, title, id_to_uri, theme)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(out_html)
    print(f'wrote {out}: {os.path.getsize(out):,} bytes')


if __name__ == '__main__':
    main()
