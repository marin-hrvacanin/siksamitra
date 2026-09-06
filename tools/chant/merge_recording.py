# -*- coding: utf-8 -*-
"""Merge an aligned subset's `recording.byVerse` into the full chant JSON.

A long document is aligned in PARTS: the Śrī Rudram's Namakam has a recitation
and its nyāsa sections do not, so the aligner runs over a subset (built by
keeping whole sections and dropping any verse the reciter did not chant) and
this puts the result back where it belongs. Verse ids are preserved through the
subset, so the merge is by id and cannot mis-key.

A verse with no entry is not an error and never gets a fabricated one: the
reader simply offers no audio for it, which is the honest rendering of "this
line is not on the recording".

    python merge_recording.py --into <full.json> --from <aligned-subset.json> \
        --audio-base /tests/sri-rudram/audio/
"""

from __future__ import annotations

import argparse
import json
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--into', required=True)
    ap.add_argument('--from', dest='src', nargs='+', required=True)
    ap.add_argument('--audio-base', required=True)
    a = ap.parse_args()

    full = json.load(open(a.into, encoding='utf-8'))
    by: dict = {}
    for path in a.src:
        part = json.load(open(path, encoding='utf-8'))
        got = (part.get('recording') or {}).get('byVerse') or {}
        if not got:
            raise SystemExit('%s carries no recording.byVerse — align it first'
                             % path)
        clash = sorted(set(got) & set(by))
        if clash:
            raise SystemExit('%s re-claims verses already covered: %r'
                             % (path, clash))
        by.update(got)
        print('  %s: %d clips' % (path, len(got)))

    ids = {v['id'] for s in full['sections'] for v in s['verses']}
    unknown = sorted(set(by) - ids)
    if unknown:
        raise SystemExit('aligned verses that are not in the target: %r' % unknown)

    full['recording'] = {'byVerse': {vid: by[vid] for s in full['sections']
                                    for v in s['verses'] if (vid := v['id']) in by}}
    full['audioBase'] = a.audio_base
    # `features.audio` was false while the document had no recording; it has one
    # now, for part of itself.
    feats = full.get('features') or {}
    feats.pop('audio', None)
    full['features'] = feats or None
    if full['features'] is None:
        del full['features']

    with open(a.into, 'w', encoding='utf-8') as f:
        json.dump(full, f, ensure_ascii=False, indent=1)
        f.write('\n')

    covered = len(full['recording']['byVerse'])
    print('merged %d clips into %s (%d verses total, %d without audio)'
          % (covered, a.into, len(ids), len(ids) - covered))
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
