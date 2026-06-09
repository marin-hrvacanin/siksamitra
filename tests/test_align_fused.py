"""Unit tests for align_fused.refine — fast, no torch/audio. Validates bleed-free
boundaries, silence snapping, inward trim, edge snapping, fades, and honest unassigned."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from align_core import PlacedRegion, TargetSection, TextEvent  # noqa: E402
from align_fused import refine  # noqa: E402


def _t(idx, syl):
    return TargetSection(index=idx, text='x' * syl, level='line', syllables=syl,
                         events=[TextEvent(type='VOW_S', matras=1.0, char='a') for _ in range(syl)])


def _overlapping_case():
    # 4 padas, coarse placements that OVERLAP (simulating the bleed bug).
    targets = [_t(0, 6), _t(1, 6), _t(2, 6), _t(3, 6)]
    placed = [
        PlacedRegion(0, 0.2, 6.0, 0.7, 'matched'),
        PlacedRegion(1, 5.8, 11.5, 0.7, 'matched'),   # starts before p0 ends
        PlacedRegion(2, 11.4, 17.2, 0.7, 'matched'),  # overlap
        PlacedRegion(3, 17.1, 29.0, 0.7, 'matched'),  # overlap
    ]
    silences = [(0.0, 0.2), (5.0, 5.5), (11.0, 11.6), (17.0, 17.4), (29.5, 30.0)]
    span = (0.2, 29.8)
    return placed, targets, silences, span


def test_no_overlap_and_silence_snapped():
    placed, targets, silences, span = _overlapping_case()
    out = refine(placed, targets, silences, span, strategy='silence_gap')
    reg = [p for p in out if p.status in ('matched', 'warn')]
    assert len(reg) == 4, [(p.target_index, p.status) for p in out]
    reg.sort(key=lambda p: p.start)
    # No overlaps: each region ends at or before the next begins (bleed-free).
    for a, b in zip(reg, reg[1:]):
        assert a.end <= b.start + 1e-6, (a.target_index, a.end, b.target_index, b.start)
    # The boundary between pada0 and pada1 lands in the (5.0,5.5) silence: gap to neither.
    p0 = next(p for p in out if p.target_index == 0)
    p1 = next(p for p in out if p.target_index == 1)
    assert abs(p0.end - 5.0) < 0.2, p0.end
    assert abs(p1.start - 5.5) < 0.2, p1.start
    # Fades suggested on every placed region.
    for p in reg:
        assert p.channel_breakdown.get('fadeIn', 0) > 0
        assert p.channel_breakdown.get('fadeOut', 0) > 0


def test_inward_trim_when_no_silence():
    # Two padas meeting in a region with NO silence near the boundary.
    targets = [_t(0, 4), _t(1, 4)]
    placed = [PlacedRegion(0, 0.1, 5.1, 0.7, 'matched'),
              PlacedRegion(1, 4.9, 10.0, 0.7, 'matched')]  # overlap, no silence between
    silences = [(0.0, 0.1), (9.9, 10.0)]
    out = refine(placed, targets, silences, (0.1, 9.9), strategy='inward_only')
    reg = sorted([p for p in out if p.status in ('matched', 'warn')], key=lambda p: p.start)
    assert len(reg) == 2
    a, b = reg
    assert a.end <= b.start + 1e-6           # no bleed
    assert b.start - a.end >= 0.05            # inward trim leaves a small gap (not outward)


def test_unassigned_when_audio_too_short():
    # pada1 sits between two anchors with almost no audio gap → recording skipped it.
    targets = [_t(0, 6), _t(1, 6), _t(2, 6)]
    placed = [PlacedRegion(0, 0.2, 6.0, 0.8, 'matched'),
              PlacedRegion(1, 0.0, 0.0, 0.1, 'unassigned'),
              PlacedRegion(2, 6.2, 12.0, 0.8, 'matched')]  # only 0.2s gap for pada1
    silences = [(6.0, 6.2)]
    out = refine(placed, targets, silences, (0.2, 12.0))
    p1 = next(p for p in out if p.target_index == 1)
    assert p1.status == 'unassigned', p1   # not fabricated


def test_rhythm_fill_between_anchors():
    # pada1 unplaced by the driver but a real gap exists → rhythm-filled, bleed-free.
    targets = [_t(0, 6), _t(1, 6), _t(2, 6)]
    placed = [PlacedRegion(0, 0.2, 6.0, 0.8, 'matched'),
              PlacedRegion(1, 0.0, 0.0, 0.1, 'unassigned'),
              PlacedRegion(2, 12.5, 18.0, 0.8, 'matched')]  # big gap [6.0,12.5] for pada1
    silences = [(6.0, 6.4), (12.0, 12.5)]
    out = refine(placed, targets, silences, (0.2, 18.0))
    p1 = next(p for p in out if p.target_index == 1)
    assert p1.status in ('matched', 'warn'), p1
    reg = sorted([p for p in out if p.status in ('matched', 'warn')], key=lambda p: p.start)
    for a, b in zip(reg, reg[1:]):
        assert a.end <= b.start + 1e-6        # still no bleed


def test_svara_independence():
    # refine must behave identically whether or not targets carry svaras.
    placed, targets, silences, span = _overlapping_case()
    out_plain = refine(placed, targets, silences, span)
    for t in targets:
        for e in t.events:
            e.svara = 'udatta'
    out_svara = refine(placed, targets, silences, span)
    assert [(p.target_index, round(p.start, 2), round(p.end, 2)) for p in out_plain] == \
           [(p.target_index, round(p.start, 2), round(p.end, 2)) for p in out_svara]
