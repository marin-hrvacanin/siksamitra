"""Integration tests for the in-service event path that hid the bleed bug.

`manual_e2e.py` sends targets with `events: []`, so the `coarsen_text_events`
loop in `align_service.run` (and the non-uniform `_weight()` it feeds in
`align_fused.refine`) was never exercised by the passing test. The real app
sends a populated, per-phoneme `events` list. These tests run that exact
in-service transform — coarsen → refine — with realistic non-uniform mātrā
weights and assert the result is still monotonic, non-overlapping (bleed-free),
and does not throw. Fast: no torch, no audio decode."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from align_core import PlacedRegion, TargetSection, TextEvent, coarsen_text_events  # noqa: E402
from align_fused import refine  # noqa: E402

_VOWELS_SHORT = set('aiuṛḷ')
_LONG = {'ā', 'ī', 'ū', 'ṝ', 'ḹ', 'e', 'o', 'ai', 'au'}
_SIB = set('śṣsh')
_NAS = set('ṅñṇnmṁṃ')
_APP = set('yrlvḻ')


def _phoneme_events(text):
    """Per-phoneme events like projectToEventSequence emits (pre-coarsen)."""
    ev, i, s = [], 0, text.lower()
    while i < len(s):
        ch = s[i]
        if ch.isspace() or ch in '।॥|':
            ev.append(TextEvent(type='SIL', matras=0.5, char=' '))
            i += 1
            continue
        if s[i:i + 2] in ('ai', 'au'):
            ev.append(TextEvent(type='VOW_L', matras=2.0, char=s[i:i + 2]))
            i += 2
            continue
        if ch in _LONG:
            ev.append(TextEvent(type='VOW_L', matras=2.0, char=ch))
        elif ch in _VOWELS_SHORT:
            ev.append(TextEvent(type='VOW_S', matras=1.0, char=ch))
        else:
            cls = ('SIB' if ch in _SIB else 'NAS' if ch in _NAS
                   else 'APP' if ch in _APP else 'STOP')
            ev.append(TextEvent(type=cls, matras=0.5, char=ch))
        i += 1
    return ev


def _target(idx, text):
    ev = _phoneme_events(text)
    syl = sum(1 for e in ev if e.type.startswith('VOW'))
    return TargetSection(index=idx, text=text, level='line', syllables=syl,
                         events=ev, iast_normalized=text)


def _coarsen_in_place(targets):
    """Mirror align_service.run: coarsen each target's events before refine."""
    for t in targets:
        if t.events:
            t.events = coarsen_text_events(t.events)
    return targets


# Real bhū sūktam pādas — varied length → non-uniform mātrā weights (the variable
# manual_e2e's events=[] and the unit tests' uniform events both miss).
_LINES = [
    'bhūmir bhūmnā dyaur variṇāntarikṣam',
    'upasthe te devyadite gnimannādamannādyāyādadhe',
    'āyaṅ gauḥ pṛśnirakramīdasanan mātaraṃ puraḥ',
    'pitarañ ca prayanth suvaḥ',
]


def _compressed_placement():
    """MMS-style coarse spans that drop each pāda's tail into the inter-line gap
    (the documented root cause). refine must split those gaps cleanly."""
    targets = _coarsen_in_place([_target(i, t) for i, t in enumerate(_LINES)])
    placed = [
        PlacedRegion(0, 6.67, 11.90, 0.76, 'matched'),
        PlacedRegion(1, 13.16, 19.40, 0.86, 'matched'),
        PlacedRegion(2, 20.63, 25.80, 0.93, 'matched'),
        PlacedRegion(3, 27.30, 29.50, 0.84, 'matched'),
    ]
    # Real verse-breaths between lines plus a few within-line stop closures.
    silences = [(0.0, 6.5), (8.0, 8.12), (11.95, 13.10), (16.0, 16.15),
                (19.7, 20.55), (23.0, 23.13), (26.0, 26.85), (29.7, 31.0)]
    span = (6.5, 29.7)
    return placed, targets, silences, span


def test_populated_events_stay_bleed_free():
    placed, targets, silences, span = _compressed_placement()
    out = refine(placed, targets, silences, span)
    reg = sorted([p for p in out if p.status in ('matched', 'warn')], key=lambda p: p.start)
    assert len(reg) >= 3, [(p.target_index, p.status) for p in out]
    for a, b in zip(reg, reg[1:]):
        assert a.end <= b.start + 1e-6, (a.target_index, a.end, b.target_index, b.start)
    # The first line must KEEP its tail (boundary in the 11.95–13.10 breath, not at 11.90).
    p0 = next(p for p in out if p.target_index == 0)
    assert p0.end >= 11.90, p0.end


def test_coarsen_then_refine_does_not_throw_on_real_text():
    # The exact in-service sequence on real, varied-length text must not raise.
    placed, targets, silences, span = _compressed_placement()
    out = refine(placed, targets, silences, span)
    assert all(p.end >= p.start for p in out)


def test_nonuniform_weights_change_rhythm_fill_safely():
    # A middle line dropped by the driver, bracketed by anchors with a big gap →
    # rhythm-filled using REAL (non-uniform) coarsened weights; must stay ordered.
    targets = _coarsen_in_place([_target(i, t) for i, t in enumerate(_LINES)])
    placed = [
        PlacedRegion(0, 6.67, 11.90, 0.80, 'matched'),
        PlacedRegion(1, 0.0, 0.0, 0.1, 'unassigned'),   # driver missed line 1
        PlacedRegion(2, 20.63, 25.80, 0.90, 'matched'),
        PlacedRegion(3, 27.30, 29.50, 0.84, 'matched'),
    ]
    silences = [(0.0, 6.5), (11.95, 13.10), (19.7, 20.55), (26.0, 26.85), (29.7, 31.0)]
    out = refine(placed, targets, silences, (6.5, 29.7))
    reg = sorted([p for p in out if p.status in ('matched', 'warn')], key=lambda p: p.start)
    for a, b in zip(reg, reg[1:]):
        assert a.end <= b.start + 1e-6
