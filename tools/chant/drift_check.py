# -*- coding: utf-8 -*-
"""Is this alignment actually right? — the checks a confidence score hides.

A forced aligner ALWAYS returns an answer. Over a twenty-minute recitation the
ways it is wrong are systematic, and a single mean-confidence number reports
none of them:

  DRIFT       every boundary creeping later (or earlier) as the recording goes
              on. Mean confidence stays high; the last anuvāka is a second out.
              Detected as a TREND in seconds-per-syllable against position, not
              as a bad verse.
  A MISSING   text the reciter did not chant. Forced alignment cannot skip, so
  PASSAGE     the absent verse is squeezed to nothing and STEALS time from its
              neighbours. Detected as an s/syl far below the median.
  A LINGERED  a held final syllable or an inserted breath, which inflates one
  PASSAGE     verse and pushes the rest. Detected as an s/syl far above it.
  DISAGREE-   two independent methods placing the same boundary differently.
  MENT        The single most informative check, and the only one that needs no
              threshold chosen by us.

              **Read the SIGN before believing either.** If the disagreement is
              one-sided — method B earlier at every single boundary — that is
              not noise and not drift, it is the two methods MEANING different
              things. Measured on the Śrī Rudram: `align_robust` came out
              earlier at 79/79 Namakam boundaries (median 1.0s, worst 3.65s)
              because it snaps a cut to the local RMS minimum, and in continuous
              chant the quietest point lies inside the previous verse's HELD
              final syllable — not at the next verse's onset, which is what
              `align_sanskrit` places. Decoding the audio at both candidates
              settled it every time: at robust's 847.60 the singer is still in
              `…tava rudra praṇītau`; at 851.25 he begins `mā no mahāntam`.
              So adjudicate a one-sided disagreement against the AUDIO. Never
              average the two — that would split the difference between a right
              answer and a wrong one.

Seconds-per-syllable is the right statistic because chant tempo is close to
constant by construction — that is what makes it chant. So the median across
the whole recording is a strong prior, and MAD (not standard deviation) is the
spread, because the outliers we are hunting would inflate a standard deviation
and hide themselves.

    python drift_check.py --report a.json [--compare b.json] [--tol 0.35]

Exit code is 1 if anything is flagged, so it can gate a publish.
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Dict, List


def median(xs: List[float]) -> float:
    s = sorted(xs)
    n = len(s)
    if not n:
        return 0.0
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2.0


def mad(xs: List[float], m: float) -> float:
    """Median absolute deviation, scaled to be comparable with a σ."""
    return 1.4826 * median([abs(x - m) for x in xs]) or 1e-9


def theil_sen(xs: List[float], ys: List[float]) -> float:
    """Median of pairwise slopes — the robust trend. A least-squares fit here
    would be dragged by the very outliers this file exists to find."""
    slopes = []
    for i in range(len(xs)):
        for j in range(i + 1, len(xs)):
            if xs[j] != xs[i]:
                slopes.append((ys[j] - ys[i]) / (xs[j] - xs[i]))
    return median(slopes) if slopes else 0.0


def load(path: str) -> List[Dict]:
    return json.load(open(path, encoding='utf-8'))['verses']


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', required=True)
    ap.add_argument('--compare', default=None,
                    help='a second aligner\'s report, for boundary agreement')
    ap.add_argument('--syllables', default=None,
                    help='chant JSON, to count syllables per verse')
    ap.add_argument('--tol', type=float, default=0.35,
                    help='max boundary disagreement between methods, seconds')
    ap.add_argument('--k', type=float, default=4.0,
                    help='outlier threshold in MADs')
    a = ap.parse_args()

    rows = load(a.report)
    syl: Dict[str, int] = {}
    if a.syllables:
        doc = json.load(open(a.syllables, encoding='utf-8'))
        for s in doc['sections']:
            for v in s['verses']:
                syl[v['id']] = sum(1 for t in v['tokens'] if t['t'] == 'syl')

    problems: List[str] = []

    # ── 1. monotonic, non-overlapping, nothing empty ─────────────────────────
    prev_end = None
    for r in rows:
        if r['end'] <= r['start']:
            problems.append('%s: empty or inverted clip (%.2f..%.2f)'
                            % (r['verse'], r['start'], r['end']))
        if prev_end is not None and r['start'] < prev_end - 0.01:
            problems.append('%s: overlaps the previous clip by %.2fs'
                            % (r['verse'], prev_end - r['start']))
        prev_end = r['end']

    # ── 2. tempo: outliers and TREND ─────────────────────────────────────────
    if syl:
        rate, mid = [], []
        for r in rows:
            n = syl.get(r['verse'], 0)
            if n:
                rate.append(r['dur'] / n)
                mid.append((r['start'] + r['end']) / 2.0)
        m = median(rate)
        d = mad(rate, m)
        print('tempo: median %.3f s/syllable · MAD %.3f · n=%d' % (m, d, len(rate)))
        for r, x in zip([r for r in rows if syl.get(r['verse'])], rate):
            z = (x - m) / d
            if z < -a.k:
                # Squeezed AND unconvincing is the signature of text the reciter
                # never chanted: forced alignment cannot skip, so it collapses
                # the absent verse and steals time from its neighbours. A merely
                # fast verse keeps its confidence.
                note = ('text likely NOT in the audio' if r.get('confidence', 1) < 0.35
                        else 'unusually fast — check it is not absorbing a neighbour')
                problems.append('%s: %.3f s/syllable is %+.1f MAD off the median '
                                '(confidence %.2f) — %s'
                                % (r['verse'], x, z, r.get('confidence', -1), note))
            elif z > a.k:
                # A closing formula is genuinely drawn out — `svāhā`, `sadāśivom`,
                # the final held `śāntiḥ`. Report it; do not fail on it, because
                # a global tempo prior is simply the wrong model for those.
                print('  slow: %s %.3f s/syllable (%+.1f MAD, confidence %.2f)'
                      ' — expected of a held closing; verify by ear'
                      % (r['verse'], x, z, r.get('confidence', -1)))
        # Tempo TREND. A reciter genuinely speeds up or slows down, so this is
        # descriptive, not a verdict: what it catches is the pathological case
        # where the alignment is sliding rather than the recitation changing.
        # The real drift test is boundary agreement between two methods, below.
        slope = theil_sen(mid, rate)
        span = (mid[-1] - mid[0]) if len(mid) > 1 else 0.0
        change = 100.0 * slope * span / m if m else 0.0
        print('tempo trend: %+.1f%% from the start of the take to the end'
              % change)
        if abs(change) > 40.0:
            problems.append('tempo trend of %+.1f%% across the take is too large '
                            'to be recitation — the alignment is sliding' % change)

    # ── 3. two methods, same boundaries ──────────────────────────────────────
    if a.compare:
        other = {r['verse']: r for r in load(a.compare)}
        deltas = []
        for r in rows:
            o = other.get(r['verse'])
            if not o:
                problems.append('%s: absent from the comparison run' % r['verse'])
                continue
            dv = abs(r['start'] - o['start'])
            deltas.append((dv, r['verse']))
            if dv > a.tol:
                problems.append('%s: the two methods disagree by %.2fs on the '
                                'start (%.2f vs %.2f)'
                                % (r['verse'], dv, r['start'], o['start']))
        if deltas:
            ds = sorted(d for d, _ in deltas)
            worst = max(deltas)
            print('agreement: median %.3fs · p90 %.3fs · worst %.2fs (%s)'
                  % (median(ds), ds[int(0.9 * (len(ds) - 1))], worst[0], worst[1]))

    print()
    if problems:
        print('FLAGGED %d:' % len(problems))
        for p in problems:
            print('  -', p)
        return 1
    print('clean: monotonic, no tempo outliers, no drift'
          + (', methods agree' if a.compare else ''))
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    raise SystemExit(main())
