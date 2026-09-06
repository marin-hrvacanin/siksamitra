# -*- coding: utf-8 -*-
"""Re-cut clips from an alignment report, without re-running the alignment.

The bounds in the report ARE the alignment, so changing anything about how the
edges are treated is just ffmpeg and must not cost another pass over the
acoustic model. Use it to change the edge fade, the bitrate or the channel
layout of an existing set of clips.

    python recut.py --report mms-report.json --audio "<take>.mp3" \
        --out <dir> --slug sri-rudram [--fade 0.06]

On the fade: `align_sanskrit.py` ramps each clip in and out over
`min(0.06, 0.2 × median syllable spacing)` — 60 ms on chant. That is deliberate
and the owner prefers it: cutting a continuous drone dead at both ends sounds
abrupt. It is NOT the cause of a swallowed first syllable, which was chased down
to a playback race in the reader (`startAt` in ChantReader) — a fade is baked
into the file, so it would swallow identically on every play, whereas the
symptom was the same clip differing between presses.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', required=True)
    ap.add_argument('--audio', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--slug', required=True)
    ap.add_argument('--fade', type=float, default=0.008,
                    help='anti-click ramp, seconds (NOT an artistic fade)')
    a = ap.parse_args()

    rep = json.load(open(a.report, encoding='utf-8'))
    os.makedirs(a.out, exist_ok=True)
    fd = a.fade
    for r in rep['verses']:
        cs, ce = r['start'], r['end']
        dur = ce - cs
        fo = max(0.0, dur - fd)
        name = '%s-%s.mp3' % (a.slug, r['verse'])
        subprocess.run(
            ['ffmpeg', '-y', '-v', 'error', '-ss', '%.3f' % cs, '-to', '%.3f' % ce,
             '-i', a.audio, '-ac', '1', '-b:a', '64k',
             '-af', 'afade=t=in:st=0:d=%.4f,afade=t=out:st=%.4f:d=%.4f' % (fd, fo, fd),
             os.path.join(a.out, name)], check=True)
    print('re-cut %d clips into %s with a %.0f ms ramp'
          % (len(rep['verses']), a.out, fd * 1000))
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
