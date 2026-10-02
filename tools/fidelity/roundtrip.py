"""
THE SAME DOCUMENT, BACK — two documents compared field by field.

    python tools/fidelity/roundtrip.py A.json B.json [--show 25]

Every difference, by path, between the document as it was read and as it
came back from a round trip through another format. Nothing is normalised:
a round trip that changes anything at all is a round trip that loses it.
"""
import json
import sys


def walk(x, y, path, out, limit):
    if len(out) >= limit:
        return
    if type(x) != type(y):
        out.append(f'{path}: {str(x)[:80]!r} != {str(y)[:80]!r}')
        return
    if isinstance(x, dict):
        for k in sorted(set(x) | set(y)):
            if k not in x or k not in y:
                out.append(f'{path}.{k}: only in {"the first" if k in x else "the second"}: {str(x.get(k, y.get(k)))[:80]}')
                continue
            walk(x[k], y[k], f'{path}.{k}', out, limit)
    elif isinstance(x, list):
        if len(x) != len(y):
            out.append(f'{path}: length {len(x)} != {len(y)}')
        for i, (p, q) in enumerate(zip(x, y)):
            walk(p, q, f'{path}[{i}]', out, limit)
    elif x != y:
        out.append(f'{path}: {str(x)[:80]!r} != {str(y)[:80]!r}')


def main():
    a = json.load(open(sys.argv[1], encoding='utf-8'))
    b = json.load(open(sys.argv[2], encoding='utf-8'))
    limit = int(sys.argv[sys.argv.index('--show') + 1]) if '--show' in sys.argv else 25
    out = []
    walk(a, b, '', out, 100000)
    print(f'{len(out)} difference(s)')
    print('\n'.join(out[:limit]))
    return 1 if out else 0


if __name__ == '__main__':
    sys.exit(main())
