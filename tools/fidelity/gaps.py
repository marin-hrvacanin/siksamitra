"""
WHERE THE SPACING DIFFERS, by what follows what.

Every pair of consecutive lines both documents put on one page, grouped by the
kind of the two lines (a mantra line, a translation, a comment, a heading),
with how far apart HE sets them and how far apart WE do. A spacing rule that is
wrong shows as one group with one constant difference — which is what makes it
fixable by a token rather than by eye.

    python tools/fidelity/gaps.py HIS.pdf OURS.pdf
"""
import sys
from collections import defaultdict
from statistics import median

from compare_pdf import lines_of, compare


def kind(l):
    if l['size'] >= 21:
        return 'H2'
    if l['size'] >= 17.5:
        return 'H3'
    if l['size'] >= 15.5 and l['face'] == 'sans':
        return 'verse'
    if l['italic'] and l['face'] == 'serif':
        return 'comment' if l['x0'] < 80 else 'comment+'
    return f"{l['face']}{l['size']:.0f}"


def main():
    his, ours = lines_of(sys.argv[1]), lines_of(sys.argv[2])
    _, matched, _ = compare(his, ours)
    groups = defaultdict(list)
    for i in range(1, len(matched)):
        (ph, po), (h, o) = matched[i - 1], matched[i]
        if ph['page'] != h['page'] or po['page'] != o['page']:
            continue
        groups[(kind(ph), kind(h))].append((round(h['y'] - ph['y'], 2), round(o['y'] - po['y'], 2)))
    rows = sorted(groups.items(), key=lambda kv: -len(kv[1]))
    print(f"{'from -> to':28} {'n':>5} {'his':>8} {'ours':>8} {'diff':>7} {'off':>5}")
    for (a, b), pairs in rows[:30]:
        hs = median(p[0] for p in pairs)
        os = median(p[1] for p in pairs)
        off = sum(1 for p in pairs if abs(p[0] - p[1]) > 0.75)
        print(f"{a + ' -> ' + b:28} {len(pairs):5} {hs:8.2f} {os:8.2f} {os - hs:7.2f} {off:5}")


if __name__ == '__main__':
    main()
