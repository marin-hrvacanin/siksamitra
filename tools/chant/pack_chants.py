#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bring every shipped chant JSON to the house delivery format, WITHOUT touching
its content.

Two things, and only two:

  MINIFY. `puja-vidhi.json` shipped at 1920 KB of which 957 KB was indentation,
  and the browser parses every byte before a syllable renders. The other chants
  are indented too. These files are generated and never read by hand — read the
  generator instead.

  CACHE-BUST THE FIGURES. Figures are served with `Cache-Control: public,
  max-age=604800` and no ETag, and a plate is REPLACED AT THE SAME FILENAME
  when it is redrawn — so a browser that has seen the page keeps showing the
  old drawing for up to a week. A hash of the file's own bytes changes the URL
  exactly when the drawing changes.

WHY THIS IS A SEPARATE SCRIPT AND NOT A REGENERATION. The sūktas come from
PDF-parse pipelines (`parse_chant.py`, `parse_bhagya.py`, `build_words*.py`)
whose inputs and hand-corrections are not all reproducible on demand. Re-running
them to change whitespace would risk changing text. This reads what is already
shipped, rewrites the bytes, and ASSERTS the parsed document is deep-equal to
what it started with — so "no difference for the reader" is verified, not hoped.

It does NOT convert v2 documents to v3. The reader normalises v2 through
`normalizeChantDoc`, so the version costs nothing at runtime, and a semantic
conversion is a content change that belongs in the generators.

Usage:
    python tools/chant/pack_chants.py            # rewrite in place
    python tools/chant/pack_chants.py --check    # report only, change nothing
"""
import argparse
import copy
import glob
import hashlib
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CHANTS = os.path.normpath(os.path.join(HERE, "..", "..", "client", "public", "chants"))
PUBLIC = os.path.normpath(os.path.join(HERE, "..", "..", "client", "public"))


def bust(doc):
    """Append a content hash to every figure src. Returns how many changed."""
    n = 0
    for f in doc.get("figures") or []:
        src = f.get("src") or ""
        if not src.startswith("/") or "?v=" in src:
            continue
        path = os.path.normpath(os.path.join(PUBLIC, src.lstrip("/")))
        if not os.path.exists(path):
            raise SystemExit(f"figure file missing: {src}")
        with open(path, "rb") as fh:
            f["src"] = src + "?v=" + hashlib.md5(fh.read()).hexdigest()[:8]
        n += 1
    return n


def strip_bust(doc):
    """A copy with figure query strings removed, for comparing like with like."""
    d = copy.deepcopy(doc)
    for f in d.get("figures") or []:
        if isinstance(f.get("src"), str):
            f["src"] = f["src"].split("?")[0]
    return d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(CHANTS, "*.json")))
    files += sorted(glob.glob(os.path.join(CHANTS, "variants", "*.json")))

    before = after = 0
    changed = []
    for path in files:
        raw = io.open(path, encoding="utf-8").read()
        doc = json.loads(raw)
        original = strip_bust(doc)

        busted = bust(doc)
        out = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))

        # THE GUARANTEE: what a reader receives must be the same document.
        assert strip_bust(json.loads(out)) == original, \
            f"{os.path.basename(path)}: content changed — refusing to write"

        b, a = len(raw.encode()), len(out.encode())
        before += b
        after += a
        if out != raw:
            changed.append((os.path.basename(path), b // 1024, a // 1024, busted))
            if not args.check:
                io.open(path, "w", encoding="utf-8").write(out)

    for name, b, a, busted in changed:
        note = f"  (+{busted} figure urls hashed)" if busted else ""
        print(f"  {name:34} {b:5} KB -> {a:4} KB{note}")
    if not changed:
        print(f"all {len(files)} chant files already in house format")
        return 0
    verb = "would save" if args.check else "saved"
    print(f"\n{len(changed)} of {len(files)} files rewritten; "
          f"{before/1024:.0f} KB -> {after/1024:.0f} KB ({verb} {(before-after)/1024:.0f} KB)")
    return 1 if args.check else 0


if __name__ == "__main__":
    sys.exit(main())
