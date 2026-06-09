#!/usr/bin/env python
"""
youtube_map.py — test the unified audio→text mapping straight from a URL.

Usage:
    python youtube_map.py "<youtube_url>" path/to/text.txt
    python youtube_map.py "<youtube_url>" "agnimīḷe purohitaṁ\nyajñasya devam"
    python youtube_map.py "<url>" text.txt --model small --transcript

  * <text> is either a path to a UTF-8 file (one section/line per line) or
    inline text (use real newlines, or \\n which is split on).
  * --model  tiny (default) | small
  * --transcript  also print what the recognizer heard (debug aid)

Downloads audio with yt-dlp+ffmpeg, runs the exact same engine the editor uses,
and prints a timeline of where each line was placed. The downloaded MP3 path is
printed too, so you can drag it into the editor to see the waveform.
"""

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def _fmt(t):
    t = float(t)
    return f'{int(t // 60):02d}:{t % 60:05.2f}'


def _load_lines(text_arg):
    if os.path.isfile(text_arg):
        with open(text_arg, encoding='utf-8') as f:
            raw = f.read()
    else:
        raw = text_arg.replace('\\n', '\n')
    return [ln.strip() for ln in raw.splitlines() if ln.strip()]


def main():
    ap = argparse.ArgumentParser(description='Map a YouTube recording to known text.')
    ap.add_argument('url', help='YouTube (or any yt-dlp) URL')
    ap.add_argument('text', help='path to a text file OR inline text (one section per line)')
    ap.add_argument('--model', default='tiny', choices=['tiny', 'small'])
    ap.add_argument('--transcript', action='store_true', help='print recognizer output')
    args = ap.parse_args()

    lines = _load_lines(args.text)
    if not lines:
        print('ERROR: no text sections found.', file=sys.stderr)
        sys.exit(1)

    from youtube_audio import download_audio
    print(f'Downloading audio from {args.url} …')
    meta = download_audio(args.url)
    print(f'  "{meta["title"]}"  ({_fmt(meta["duration"])})  ->  {meta["path"]}')

    with open(meta['path'], 'rb') as f:
        raw = f.read()

    targets = [{'index': i, 'text': ln, 'iastNormalized': ln, 'events': []}
               for i, ln in enumerate(lines)]

    from align_service import run
    print(f'Mapping {len(lines)} section(s) with model={args.model} … (first run warms up)')
    t0 = time.perf_counter()
    res = run({'audio': raw, 'mime': 'audio/mpeg', 'model': args.model, 'targets': targets})
    dt = time.perf_counter() - t0

    d = res.get('diagnostics', {})
    print()
    print(f'engine   : {res["engine"]}')
    print(f'summary  : {res["summary"]}')
    print(f'span     : {_fmt(res["speech_span"][0])} – {_fmt(res["speech_span"][1])}')
    print(f'diag     : tokens={d.get("tokens")} lang={d.get("language")} '
          f'silences={d.get("silence_intervals")} recognize_ms={d.get("recognize_ms")} '
          f'fuse_ms={d.get("fuse_ms")}'
          + (f' DEGRADED({d.get("reason","")})' if d.get('degraded') else ''))
    print(f'wall     : {dt:.1f}s')
    print('-' * 72)
    for r in res['regions']:
        i = r['targetIndex']
        line = lines[i] if 0 <= i < len(lines) else ''
        line = (line[:48] + '…') if len(line) > 49 else line
        if r['status'] == 'unassigned':
            print(f'  [    --:--–--:--   ]  UNMATCHED        {line}')
        else:
            badge = {'matched': 'matched ', 'warn': 'review  '}.get(r['status'], r['status'])
            print(f'  [{_fmt(r["start"])}–{_fmt(r["end"])}]  {badge} {r["confidence"]:.2f}   {line}')
    print('-' * 72)

    if args.transcript:
        try:
            from align_audio import decode_16k_mono
            from align_recognize import recognize
            samples, sr = decode_16k_mono(raw, 'audio/mpeg')
            tokens, _span, _diag = recognize(samples, sr, args.model)
            print('\nRecognizer heard:')
            print('  ' + ' '.join(tok.text for tok in tokens))
        except Exception as e:
            print(f'(transcript unavailable: {e})')


if __name__ == '__main__':
    main()
