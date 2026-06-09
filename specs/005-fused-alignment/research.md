# Research: Fused alignment — measured facts & decisions

## 1. Baseline (measured, bhū sūktam PDF + `u_FzN8wdHg0`, 194 s)
`engine=mms_fa`, 31 matched / 1 warn / 2 unassigned / 39 skipped, **0 out-of-order**, wall 95 s.
Gross placement is good. But boundaries bleed/overlap, e.g.:
- line15 `…sa̱pta te | agne…` `[01:30.41–01:35.08]`
- line16 `sa̱pta | ṛṣayas…`   `[01:34.92–01:38.43]` → **starts 0.16 s before line15 ends → overlap → audible bleed.**

→ **Decision**: the defect is BOUNDARIES, not gross placement. Keep coarse placement; re-derive clean,
non-overlapping, silence-snapped boundaries. This is the highest-value fix for the user's complaint.

## 2. Why MMS-only drifts at boundaries
`align_ctc` emits per-word token spans; `end_k = spans[-1].end`, `start_{k+1} = spans[0].start`,
both via a single global frame→time `ratio` over chunked emissions. Independent per-word ends/starts
can overlap, and there is no allowance for inter-pada pauses/refrains, so the cut lands inside speech.
→ **Decision**: don't trust raw token ends as region edges; place edges from the silence map + rhythm.

## 3. Available signals (reuse, don't rebuild)
- `align_audio.detect_silences` / `snap_to_silence` / `speech_span` — reliable VAD; the boundary oracle.
- `align_ctc.align` — text-driven coarse spans + per-pada CTC score (good driver/anchor source).
- `align_recognize`+`align_fuse` — recognition + phonetic SW spans (independent anchor source; carries
  lines forced-alignment is unsure of, and vice-versa).
- `align_core` mātrā weights (events) — rhythm for inter-anchor distribution + duration sanity.
- svara channel exists but only when marks present → optional bonus (FR-007).

## 4. Anchors → no accumulated drift
Padas where two independent signals agree (MMS span start ≈ phonetic span start within ~0.5 s) or one
is very high confidence become **anchors** with trusted absolute time. Intervening padas are placed by
mātrā-weighted division of the inter-anchor interval, so any boundary error resets at each anchor
(bounded, not cumulative). This is the structural fix for the "offset grows each line" report.

## 5. Bleed-free boundary rule (the core)
For adjacent padas, the audible gap (pause/breath) must belong to **neither** region:
- prefer the longest silence in the boundary window → `end_k = sil.start`, `start_{k+1} = sil.end`.
- else cut at the mātrā-split point and trim both sides inward by ~40 ms.
- add ~40 ms fade-in/out so any residual edge content fades, never clicks/bleeds.
The user explicitly prefers "a hair short" over hearing the neighbor → trim inward, never outward.

## 6. A/B & metrics (no ground truth)
Structural proxies in `manual_e2e`: overlap count (must be 0), % boundaries within a silence,
duration spread vs mātrā expectation, in-order count, coverage. Compare `silence_gap` vs `inward_only`
boundary strategies on the sample; keep the winner (expected: `silence_gap`).

## 7. Alternatives rejected
- **Rewrite to pure forced alignment with `*` star token** — still trusts token edges; doesn't solve
  inter-pada gap ownership; heavier.
- **Pure recognition+phonetic (old engine)** — misses opening verses (why MMS became primary). Fusion
  keeps MMS's coverage AND recognition's independent anchors.
- **Snap outward to include whole speech** — causes the bleed the user hates. Rejected.
