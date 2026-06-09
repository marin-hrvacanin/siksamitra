# Implementation Plan: Fused, bleed-free alignment

**Branch**: `main` (no git) · **Date**: 2026-06-08 · **Spec**: [spec.md](./spec.md)

## Summary
Add a single fusion+refinement layer, `align_fused.py`, that takes coarse per-pada placements from
the strongest available driver (MMS forced alignment; phonetic-recognition fuse as fallback) plus the
silence map and mātrā weights, and produces **clean, monotonic, non-overlapping, silence-snapped**
regions with a small fade — eliminating the bleed/chop. Cross-signal agreements act as **anchors**;
intervening padas are placed by mātrā rhythm between anchors so boundary error can't accumulate.
Wire it as the final stage in `align_service.run` (engine-agnostic; improves every driver). Extend
`tests/manual_e2e.py` to report bleed/silence/duration metrics and A/B the boundary strategy.

## Technical Context
Python 3.14, offline. Reuses `align_audio`, `align_ctc`, `align_recognize`, `align_fuse`,
`align_roman`, `align_core`. New module `align_fused.py`. No new deps. Tests: `tests/` + manual E2E.
Budget ~1–3 min/clip. No git.

## Design

### Inputs
- `placed_coarse`: List[PlacedRegion] from the driver (MMS primary / fuse fallback), in target order.
- `targets`: chant TargetSection list (mātrā via events, svara flag).
- `silences`: List[(s,e)]; `speech_span`: (start,end). (`align_audio`.)

### Algorithm (`refine`)
1. **Order & anchors.** Keep only matched/warn coarse regions as candidate anchors; sort by start.
   Discard anchors that violate monotonic order (keep the higher-confidence one). Speech start/end
   are implicit anchors.
2. **Rhythm fill.** For each maximal run of padas between two anchors (or speech edges), distribute
   the interval by mātrā weight to get provisional boundaries for the in-between (low-confidence /
   unassigned) padas — this re-syncs at every anchor (FR-004, kills drift).
3. **Boundary snapping (bleed-free, FR-001/2).** For each adjacent pair (k, k+1) compute the search
   window `[max(center_k, prov_boundary-W), min(center_{k+1}, prov_boundary+W)]`. Pick the best
   silence in it (prefer the longest / closest). If found: `end_k = silence.start`,
   `start_{k+1} = silence.end` → gap belongs to neither. If none: `cut = prov_boundary`;
   `end_k = cut - TRIM`, `start_{k+1} = cut + TRIM` (inward trim). Enforce `end_k ≥ start_k+ε`.
4. **Edges.** `start_0` = snap speech onset; `end_last` = snap speech offset.
5. **Fades (FR-005).** Set `fadeIn = fadeOut = min(FADE, 0.25*dur)` (e.g. 40 ms) on each region.
6. **Confidence.** Combine driver confidence + duration-plausibility (region dur vs mātrā-expected)
   + boundary-on-silence bonus + (svara bonus only if marks present). Demote implausible spans.
7. **Honesty.** Padas with no anchor and no usable rhythm slot (e.g. recording skipped them) stay
   unassigned; never fabricated.

### Boundary-strategy A/B (SC-005)
- `silence_gap` (default): cut in silence, gap to neither + inward trim fallback.
- `inward_only`: always cut at provisional boundary − TRIM / + TRIM (no silence search).
Test harness reports overlaps, %boundaries-on-silence, duration spread for each → pick `silence_gap`
unless `inward_only` wins on the sample.

### Integration
`align_service.run`: after `placed` is computed (MMS or fuse), call
`align_fused.refine(placed, chant, silences, span, ...)`; emit `fadeIn/fadeOut` in the region dicts.
JS `installRegionsFromMapped` already maps start/end/confidence; extend it to read optional
`fadeIn/fadeOut` so the suggested fades apply (small, additive JS change).

## Risks & Mitigations
- **No GUI iteration here** → validate via `manual_e2e` structural metrics + unit tests on `refine`
  with synthetic regions/silences; user does listening UAT.
- **Over-trimming** → TRIM small (~40 ms) + fades; snapping prefers real silence.
- **Anchor errors** → only high-confidence, order-consistent anchors; rhythm fill bounded to the
  inter-anchor interval.
- **Regression** → refinement is additive after existing engines; fallbacks unchanged.

## Complexity Tracking
No constitution gates; not applicable.
