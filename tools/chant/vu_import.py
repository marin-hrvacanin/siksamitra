#!/usr/bin/env python3
"""
`vu-import` — read a hand-marked PDF PAGE: its rows, letters and marks.

ONE CLI, ONE JSON CONTRACT, no per-document code. The two readers beneath it
(`pdf_marks.py`, `pdf_marks_gana.py`) are calibrated against two different
export families and verified at 553/554 and 106/106 rows; one of them recovers
93 letters that an exporter flattened into filled vector paths and that are
absent from the text layer entirely. That calibration is the asset, and it is
why this is Python wrapping Python rather than a rewrite in `pdf.js`.

    python vu_import.py --in file.pdf --out doc.json --report report.json
    python vu_import.py --in file.pdf --family arial      # force a reader
    python vu_import.py --in file.pdf --probe             # what family is it?

OUTPUT IS THE PAGE, NOT A DOCUMENT: `{family, narrowed, rows}`, the rows
`pdf_marks.extract` reads. `@siksamitra/interop` (`pdf/page-rows.ts`) turns
them into the Word-style paragraphs the `.docx` importer reads and builds the
document with the SAME builder and run reader. This file used to cut syllables
and build tokens itself — a second implementation of both, which put every
hyphen on the wrong syllable and dropped the Ṛgvedic overline.

Exit codes: 0 ok · 2 bad input · 3 nothing found · 4 the reader refused.

WHAT THIS DELIBERATELY DOES NOT DO. It does not re-derive a single mark. Every
holding, every svara, every change colour is TRANSCRIBED from the vector and
text layers of a page the owner marked by hand, and the document it writes has
no `src` — which is the format's own way of saying "this is attested, do not
regenerate it" (01 §2.3). Rule zero, at the import boundary.

See specs/chant-editor/03-INTEROP.md §3.
"""
from __future__ import annotations

import argparse
import json

import sys

from pathlib import Path
from typing import Dict, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))


# The two families, and what tells them apart before a single row is parsed.
# Printing the span fonts first is two minutes that saves an afternoon.
CALIBRI_HINTS = ("calibri",)
ARIAL_HINTS = ("arial", "urwpalladio")


def probe(path: str) -> Tuple[str, Dict[str, int]]:
    """Which reader this PDF needs, and the font evidence for saying so."""
    import pymupdf  # noqa: PLC0415  (imported late so --help works without it)

    fonts: Dict[str, int] = {}
    doc = pymupdf.open(path)
    try:
        for pno in range(min(doc.page_count, 6)):
            for block in doc[pno].get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        fonts[span["font"]] = fonts.get(span["font"], 0) + len(span["text"])
    finally:
        doc.close()

    weight = {"calibri": 0, "arial": 0}
    for name, n in fonts.items():
        low = name.lower()
        if any(h in low for h in CALIBRI_HINTS):
            weight["calibri"] += n
        elif any(h in low for h in ARIAL_HINTS):
            weight["arial"] += n
    family = "calibri" if weight["calibri"] >= weight["arial"] else "arial"
    return family, fonts


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="vu-import",
        description="Read a hand-marked PDF into a Veda Union chant document.",
    )
    ap.add_argument("--in", dest="src", required=True, help="the .pdf to read")
    ap.add_argument("--rows", required=False, help="where to write the rows JSON")
    ap.add_argument("--family", default="auto", choices=("auto", "calibri", "arial"))
    ap.add_argument("--probe", action="store_true",
                    help="print the span fonts and the detected family, and stop")
    args = ap.parse_args()

    src = Path(args.src)
    if not src.is_file():
        print(f"vu-import: no such file: {src}", file=sys.stderr)
        return 2

    try:
        detected, fonts = probe(str(src))
    except Exception as e:  # noqa: BLE001 — the message is the product here
        print(f"vu-import: could not open {src}: {e}", file=sys.stderr)
        return 2

    if args.probe:
        print(f"family: {detected}")
        for name, n in sorted(fonts.items(), key=lambda kv: -kv[1]):
            print(f"  {n:7}  {name}")
        return 0

    family = detected if args.family == "auto" else args.family
    fell_back = None

    def read(fam: str):
        reader = __import__("pdf_marks_gana" if fam == "arial" else "pdf_marks")
        return reader.extract(str(src))

    try:
        paras, narrowed = read(family)
    except (AssertionError, KeyError) as e:
        # The arial reader is calibrated to ONE document's outlined letters, and
        # it asserts loudly ON PURPOSE when a letter it knows is not where it
        # knows it — a re-exported copy must fail rather than put a letter in
        # the wrong word. But when it was only CHOSEN by font (auto), a refusal
        # means "this is not my document", and the generic reader is right.
        # An outline it has no entry for (KeyError) is the same refusal: his
        # bhū sūktam v1.1 is in Arial and is not that document.
        if args.family != "auto" or family != "arial":
            print(f"vu-import: the {family} reader refused this file — {e}", file=sys.stderr)
            return 4
        fell_back = str(e)[:200]
        family = "calibri"
        paras, narrowed = read(family)
    except Exception as e:  # noqa: BLE001
        print(f"vu-import: the {family} reader failed — {e}", file=sys.stderr)
        return 4

    if not any(p["cls"] == "shloka" for p in paras):
        print("vu-import: no marked text was found in that file", file=sys.stderr)
        return 3

    out = {"family": family, "fellBack": fell_back, "narrowed": narrowed[:40],
           "narrowedCount": len(narrowed), "rows": paras}
    text = json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n"
    if args.rows:
        Path(args.rows).parent.mkdir(parents=True, exist_ok=True)
        Path(args.rows).write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)
    print(f"vu-import: {family}{' (fell back)' if fell_back else ''} · {len(paras)} rows", file=sys.stderr)
    return 0

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
