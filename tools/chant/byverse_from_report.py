# -*- coding: utf-8 -*-
"""Rebuild `recording.byVerse` from an aligner's REPORT, and check it on disk.

The report is the durable artefact of an alignment run: per verse it carries the
clip bounds, the per-line absolute boundaries and the confidence. The chant JSON
that the run patched is not durable — a later run over the same file (an
independent aligner used as a cross-check, say) overwrites it. Rebuilding from
the report makes the timings traceable to the run that produced the mp3s, and
`--audio-dir` verifies that: every referenced file must exist, and every file
must be referenced.

    python byverse_from_report.py --report mms-report.json \\
        --into subset.json --slug sri-rudram --audio-dir <dir>
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys


def probe_duration(path: str) -> float:
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                          'format=duration', '-of', 'default=nw=1:nk=1', path],
                         capture_output=True, text=True).stdout.strip()
    return float(out) if out else 0.0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', required=True)
    ap.add_argument('--into', required=True, help='the chant JSON to patch')
    ap.add_argument('--slug', required=True)
    ap.add_argument('--audio-dir', default=None)
    ap.add_argument('--tol', type=float, default=0.15,
                    help='allowed mp3-vs-report duration difference, seconds')
    a = ap.parse_args()

    rep = json.load(open(a.report, encoding='utf-8'))
    doc = json.load(open(a.into, encoding='utf-8'))
    ids = {v['id'] for s in doc['sections'] for v in s['verses']}

    by = {}
    for r in rep['verses']:
        vid = r['verse']
        if vid not in ids:
            raise SystemExit('report names a verse not in %s: %s' % (a.into, vid))
        cs = r['start']
        lines = [{'start': round(s - cs, 3), 'end': round(e - cs, 3)}
                 for s, e in r['lines_abs']]
        by[vid] = {'file': '%s-%s.mp3' % (a.slug, vid),
                   'duration': r['dur'],
                   'label': 'Verse %s' % vid.split('-')[-1].lstrip('v'),
                   'lines': lines}

    if a.audio_dir:
        on_disk = {f for f in os.listdir(a.audio_dir) if f.endswith('.mp3')}
        want = {v['file'] for v in by.values()}
        missing, extra = sorted(want - on_disk), sorted(on_disk - want)
        if missing:
            raise SystemExit('%d referenced clip(s) not on disk: %r'
                             % (len(missing), missing[:5]))
        bad = []
        for vid, v in by.items():
            d = probe_duration(os.path.join(a.audio_dir, v['file']))
            if abs(d - v['duration']) > a.tol:
                bad.append((vid, round(d, 3), v['duration']))
        if bad:
            raise SystemExit('clip duration disagrees with the report — these '
                             'mp3s are from a DIFFERENT run: %r' % bad[:5])
        print('  %d clips verified on disk (durations within %.2fs)'
              % (len(want), a.tol))
        if extra:
            print('  note: %d unreferenced file(s) in %s (another run\'s?)'
                  % (len(extra), a.audio_dir))

    doc['recording'] = {'byVerse': by}
    with open(a.into, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    print('%s: byVerse rebuilt from %s (%d clips)'
          % (a.into, os.path.basename(a.report), len(by)))
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
