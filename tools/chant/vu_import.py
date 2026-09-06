#!/usr/bin/env python3
"""
`vu-import` — read a hand-marked PDF into a Veda Union chant document.

ONE CLI, ONE JSON CONTRACT, no per-document code. The two readers beneath it
(`pdf_marks.py`, `pdf_marks_gana.py`) are calibrated against two different
export families and verified at 553/554 and 106/106 rows; one of them recovers
93 letters that an exporter flattened into filled vector paths and that are
absent from the text layer entirely. That calibration is the asset, and it is
why this is Python wrapping Python rather than a rewrite in `pdf.js`.

    python vu_import.py --in file.pdf --out doc.json --report report.json
    python vu_import.py --in file.pdf --family arial      # force a reader
    python vu_import.py --in file.pdf --probe             # what family is it?

Output is a `ChantDoc` (shared/src/chant.ts) plus an `ImportReport` in the same
shape the Word importer produces (03-INTEROP §1), so the two paths are
comparable and a defect in either is visible against the other.

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
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))

FORMAT = "vedaunion.chant"
VERSION = 3

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


# ── the shared vocabulary ────────────────────────────────────────────────────
SVARA_BY_MARK = {
    "̍": "svarita",
    "̎": "dirgha-svarita",
    "̱": "anudatta",
}

# `_classify` names its row kinds; these are what they mean structurally.
ROW_ROLE = {
    "title": "title",
    "subtitle": "subtitle",
    "shloka": "verse",
    "small": "note",
    "body": "prose",
}

_LETTER = re.compile(r"[a-zāīūṛṝḷḹṁṃḥṅñṭḍṇśṣ'ˎ-]", re.IGNORECASE)


def _letters(text: str) -> List[str]:
    """Split a text run into LETTERS, keeping the aspirate digraphs whole.

    The reader coalesces a run carrying identical marks into one event exactly
    so a consumer can see `bh` / `dh` / `ṭh` as single letters; splitting on
    codepoints here would undo that and put a holding box on half a letter.
    """
    out: List[str] = []
    i = 0
    while i < len(text):
        two = text[i : i + 2].lower()
        if len(two) == 2 and two[1] == "h" and two[0] in "kgcjtdpbṭḍ":
            out.append(text[i : i + 2])
            i += 2
            continue
        out.append(text[i])
        i += 1
    return out


def _syllabify(units: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    """One vowel nucleus per syllable, codas kept with the syllable they close.

    Deliberately simpler than the engine's `syllabify`: this is a TRANSCRIPTION,
    and the engine's rule is stated for derived text. Anything subtle here would
    be a second syllabifier, so the rule is the plain one and the result is
    checked against the engine by `vu-chant roundtrip` afterwards.
    """
    vowels = set("aāiīuūṛṝḷḹeo")
    at = [i for i, u in enumerate(units) if u["c"][-1].lower() in vowels]
    if not at:
        return [units] if units else []
    out: List[List[Dict[str, Any]]] = []
    start = 0
    for k, vp in enumerate(at):
        if k + 1 < len(at):
            out.append(units[start : vp + 1])
            start = vp + 1
        else:
            out.append(units[start:])
    # An anusvāra, a visarga or a virāma tick never OPENS a syllable — measured
    # 418 / 439 / 72 to nothing across the shipped corpus.
    never_onset = {"ṁ", "ṃ", "ḥ", "ˎ"}
    for i in range(1, len(out)):
        while len(out[i]) > 1 and out[i][0]["c"] in never_onset:
            out[i - 1].append(out[i].pop(0))
    return [s for s in out if s]


def _tokens(
    events: List[Dict[str, Any]],
    groups: Dict[Any, int],
) -> List[Dict[str, Any]]:
    """One row of events becomes one row of `ChantToken`s.

    `groups` maps a reader box to an `hg` id and is owned by the CALLER, because
    the id has to be unique across the whole VERSE and a verse is several rows.
    Scoping it per row made every line restart at 1, so two unrelated boxes on
    two lines shared an id and the reader drew them as one group: Śrī Rudram
    counted 839 holdings where it has 1900.
    """
    units: List[Dict[str, Any]] = []
    tokens: List[Dict[str, Any]] = []

    def flush() -> None:
        nonlocal units
        for syl in _syllabify(units):
            iast = "".join(u["c"] for u in syl)
            tokens.append({"t": "syl", "units": syl, "iast": iast, "deva": ""})
        units = []

    for e in events:
        kind = e["kind"]
        if kind == "text":
            for ch in _letters(e["text"]):
                if ch == " ":
                    flush()
                    tokens.append({"t": "sp"})
                    continue
                u: Dict[str, Any] = {"c": ch}
                if e.get("hold"):
                    u["hold"] = e["hold"]
                    box = e.get("box")
                    if box is not None:
                        u["hg"] = groups.setdefault(box, len(groups) + 1)
                if e.get("change"):
                    u["change"] = True
                units.append(u)
        elif kind == "svara":
            if units:
                s = SVARA_BY_MARK.get(e["mark"])
                if s is not None:
                    units[-1]["svara"] = s
        elif kind == "candra":
            if units:
                units[-1]["candra"] = True
        elif kind == "sup":
            if units:
                units[-1]["sup"] = units[-1].get("sup", "") + e["text"]
        elif kind == "pause":
            flush()
            tokens.append({"t": "pause", "len": "long" if e["len"] == "long" else "short"})
        elif kind == "ann":
            flush()
            tokens.append({"t": "text", "s": e["text"]})
    flush()
    while tokens and tokens[-1].get("t") == "sp":
        tokens.pop()
    return tokens


def build(paras: List[Dict[str, Any]], title: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Paragraphs -> a `ChantDoc` + an `ImportReport`.

    The grouping rules come from the documents' own layout, measured on
    `sri-rudram-iast.pdf` (610 shloka rows, 502 small rows, 42 subtitle rows):

      subtitle  a SECTION HEADING. 42 of them against the shipped document's
                36 sections.
      shloka    a LINE of a verse, not a verse. A RUN of consecutive shloka
                rows is one verse, its lines separated by `br`: 185 runs
                against the shipped document's 198 verses. Treating each row as
                a verse gave 609, which is the line count and not a structure.
      small     the English under the verse it follows, wrapped across several
                rows at ~90 characters each. Joined and attached to the verse
                the run came after — the shipped document carries 195 of them,
                and an importer that dropped them would be throwing away half
                the document.
      body      the file header and the table of contents' dot-leader rows.
                Dropped: a regenerable index is not content.
      title     the document title, once; a part heading after that.
    """
    sections: List[Dict[str, Any]] = []
    doc_title = ""
    subtitle: Optional[str] = None
    marks = {"hold-short": 0, "hold-long": 0, "svara": 0, "change": 0, "sup": 0,
             "candra": 0, "pause": 0}
    unresolved: List[Dict[str, str]] = []
    syllables = 0

    # The verse being accumulated, and the translation rows that follow it.
    lines: List[List[Dict[str, Any]]] = []
    prose: List[str] = []
    # Reader box -> `hg`, for the verse being built. Reset when the verse is,
    # so ids stay small and a verse's groups are numbered from 1.
    groups: Dict[Any, int] = {}

    def section() -> Dict[str, Any]:
        if not sections:
            sections.append({"id": "sec-1", "title": doc_title or title, "verses": []})
        return sections[-1]

    def flush_prose() -> None:
        """A run of `small` rows is ONE translation, attached to the verse the
        run followed. Rows are joined with a space, not a newline: they are a
        wrapped paragraph, and the wrap points are the PDF's, not the text's."""
        nonlocal prose
        text = " ".join(x.strip() for x in prose if x.strip()).strip()
        prose = []
        if not text:
            return
        sec = sections[-1] if sections else None
        if sec is None or not sec["verses"]:
            return
        v = sec["verses"][-1]
        v["translation"] = {"en": (v.get("translation", {}).get("en", "") + " " + text).strip()}

    def flush_verse() -> None:
        nonlocal lines, syllables, groups
        if not lines:
            groups = {}
            return
        toks: List[Dict[str, Any]] = []
        for i, row in enumerate(lines):
            if i:
                toks.append({"t": "br"})
            toks.extend(row)
        lines = []
        groups = {}
        if not any(t.get("t") == "syl" for t in toks):
            return
        sec = section()
        sec["verses"].append({
            "id": f"{sec['id']}-v{len(sec['verses']) + 1}",
            "n": str(len(sec["verses"]) + 1),
            "tokens": toks,
        })
        for t in toks:
            if t.get("t") == "pause":
                marks["pause"] += 1
            if t.get("t") != "syl":
                continue
            syllables += 1
            for u in t["units"]:
                if u.get("hold") == "short":
                    marks["hold-short"] += 1
                elif u.get("hold") == "long":
                    marks["hold-long"] += 1
                if u.get("svara"):
                    marks["svara"] += 1
                if u.get("change"):
                    marks["change"] += 1
                if u.get("sup"):
                    marks["sup"] += 1
                if u.get("candra"):
                    marks["candra"] += 1

    for p in paras:
        cls = p["cls"]
        text = "".join(e.get("text", "") for e in p["events"]).strip()

        if cls == "shloka":
            flush_prose()
            toks = _tokens(p["events"], groups)
            if any(t.get("t") == "syl" for t in toks):
                lines.append(toks)
            continue

        # Anything that is not a line of the verse ends the verse.
        flush_verse()

        if cls == "small":
            prose.append(text)
            continue

        flush_prose()

        if cls == "title":
            if not doc_title:
                doc_title = text
            elif text:
                sections.append({"id": f"sec-{len(sections) + 1}", "title": text,
                                 "part": text, "verses": []})
            continue

        if cls == "subtitle":
            if text:
                sections.append({"id": f"sec-{len(sections) + 1}", "title": text,
                                 "verses": []})
            continue

        # `body`: the file header and the table of contents. A dot leader is
        # the giveaway, and a regenerable index is not content.
        if ".." in text or text.lower().startswith("file:"):
            continue
        if text and len(text) < 60:
            sections.append({"id": f"sec-{len(sections) + 1}", "title": text, "verses": []})

    flush_verse()
    flush_prose()

    sections = [s for s in sections if s["verses"]]
    translated = sum(
        1 for s in sections for v in s["verses"] if v.get("translation", {}).get("en")
    )
    doc = {
        "format": FORMAT,
        "version": VERSION,
        "title": doc_title or title,
        **({"subtitle": subtitle} if subtitle else {}),
        "titleForms": {},
        "sections": sections,
    }
    report = {
        "structure": {
            "paragraphs": len(paras),
            "sections": len(sections),
            "verses": sum(len(s["verses"]) for s in sections),
            "syllables": syllables,
            "translations": translated,
        },
        "marks": marks,
        "unresolved": unresolved,
    }
    return doc, report


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="vu-import",
        description="Read a hand-marked PDF into a Veda Union chant document.",
    )
    ap.add_argument("--in", dest="src", required=True, help="the .pdf to read")
    ap.add_argument("--out", help="where to write the ChantDoc JSON")
    ap.add_argument("--report", help="where to write the ImportReport JSON")
    ap.add_argument("--family", default="auto", choices=("auto", "calibri", "arial"))
    ap.add_argument("--title", default="", help="the document title, if the PDF has none")
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
    if family == "arial":
        import pdf_marks_gana as reader  # noqa: PLC0415
    else:
        import pdf_marks as reader  # noqa: PLC0415

    try:
        paras, narrowed = reader.extract(str(src))
    except AssertionError as e:
        # The readers assert loudly ON PURPOSE: a re-exported PDF that shifts a
        # recovered letter out of its long box must fail rather than quietly
        # put the letter in the wrong word. Keep both assertions.
        print(f"vu-import: the {family} reader refused this file — {e}", file=sys.stderr)
        return 4
    except Exception as e:  # noqa: BLE001
        print(f"vu-import: the {family} reader failed — {e}", file=sys.stderr)
        return 4

    title = args.title or unicodedata.normalize("NFC", src.stem.replace("_", " "))
    doc, report = build(paras, title)
    report["family"] = family
    report["narrowed"] = narrowed[:40]
    report["narrowedCount"] = len(narrowed)

    if report["structure"]["verses"] == 0:
        print("vu-import: no marked text was found in that file", file=sys.stderr)
        return 3

    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(
            json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
    if args.report:
        Path(args.report).parent.mkdir(parents=True, exist_ok=True)
        Path(args.report).write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    if not args.out and not args.report:
        print(json.dumps({"doc": doc, "report": report}, ensure_ascii=False))

    s = report["structure"]
    print(
        f"vu-import: {family} · {s['paragraphs']} rows → {s['sections']} sections,"
        f" {s['verses']} verses, {s['syllables']} syllables",
        file=sys.stderr,
    )
    print(f"  marks: {report['marks']}", file=sys.stderr)
    if narrowed:
        print(f"  {len(narrowed)} holding boxes collapsed onto their first consonant",
              file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    raise SystemExit(main())
