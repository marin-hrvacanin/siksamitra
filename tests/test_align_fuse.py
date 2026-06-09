"""Tests for the unified fusion (T012, T017, T018, T019, T023).

Targets use phonetically-disjoint consonant sets so placement is deterministic:
  t0 = 'kagaka'  (velars k/g)
  t1 = 'tudutu'  (dentals t/d)
  t2 = 'pababa'  (labials p/b)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from align_fuse import fuse
from align_service import _proportional
from tests.fixtures.synthetic import make_targets, make_tokens

# Phonetically disjoint (distinct consonants AND vowels) so placement is
# unambiguous under the global monotonic aligner.
T0, T1, T2 = 'kiki', 'tutu', 'popo'
SPAN = (0.0, 7.0)


def _by_index(regions):
    return {r.target_index: r for r in regions}


def test_in_order_full():
    targets = make_targets([T0, T1, T2])
    tokens = make_tokens([(T0, 0.0, 2.0), (T1, 2.5, 4.5), (T2, 5.0, 7.0)])
    placed = _by_index(fuse(targets, tokens, [], SPAN))

    for i in (0, 1, 2):
        assert placed[i].status == 'matched', (i, placed[i].status, placed[i].confidence)
    # Each region overlaps its token's true time window.
    assert placed[0].start < 2.0 and placed[0].end > 0.0
    assert placed[1].start < 4.5 and placed[1].end > 2.5
    assert placed[2].start < 7.0 and placed[2].end > 5.0
    # Monotonic, non-overlapping.
    assert placed[0].end <= placed[1].start + 0.05
    assert placed[1].end <= placed[2].start + 0.05


def test_partial_coverage():
    # Audio omits t1 entirely; a real silent gap sits where t1 would be.
    targets = make_targets([T0, T1, T2])
    tokens = make_tokens([(T0, 0.0, 2.0), (T2, 5.0, 7.0)])
    placed = _by_index(fuse(targets, tokens, [], SPAN))

    assert placed[0].status == 'matched'
    assert placed[2].status == 'matched'
    # The absent line must be reported unmatched, never fabricated (SC-003/FR-009).
    assert placed[1].status == 'unassigned', (placed[1].status, placed[1].confidence)
    assert placed[1].start == 0.0 and placed[1].end == 0.0


def test_out_of_order_is_honest():
    # Audio order reversed from text order. The order-prioritized engine must
    # NEVER confidently mis-place a line: any line it does place must overlap
    # its TRUE audio span (others are left honestly unmatched).
    targets = make_targets([T0, T1, T2])
    tokens = make_tokens([(T2, 0.0, 2.0), (T1, 2.5, 4.5), (T0, 5.0, 7.0)])
    true = {0: (5.0, 7.0), 1: (2.5, 4.5), 2: (0.0, 2.0)}
    placed = _by_index(fuse(targets, tokens, [], SPAN))
    for i, p in placed.items():
        if p.status in ('matched', 'warn'):
            lo, hi = true[i]
            assert p.start < hi and p.end > lo, (i, p.start, p.end, 'mis-placed')


def test_no_transcript_all_unassigned():
    targets = make_targets([T0, T1, T2])
    placed = fuse(targets, [], [], SPAN)
    assert all(p.status == 'unassigned' for p in placed)


def test_proportional_degraded():
    # Service fallback when recognition is unavailable: covers the span,
    # everything needs-review (warn) — never confidently matched.
    targets = make_targets([T0, T1, T2])
    placed = _proportional(targets, SPAN)
    assert all(p.status == 'warn' for p in placed)
    assert all(p.confidence < 0.55 for p in placed)
    # Spans the audio, monotonic.
    assert abs(placed[0].start - 0.0) < 1e-6
    assert abs(placed[-1].end - 7.0) < 0.5
    for a, b in zip(placed, placed[1:]):
        assert b.start >= a.start


def test_region_shape_persistable():
    # Every placed region exposes the fields the .smdoc attachment needs (T023).
    targets = make_targets([T0, T1, T2])
    tokens = make_tokens([(T0, 0.0, 2.0), (T1, 2.5, 4.5), (T2, 5.0, 7.0)])
    for p in fuse(targets, tokens, [], SPAN):
        assert isinstance(p.target_index, int)
        assert isinstance(p.start, float) and isinstance(p.end, float)
        assert 0.0 <= p.confidence <= 1.0
        assert p.status in ('matched', 'warn', 'unassigned')
