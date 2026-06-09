"""Tests for pdf_import (T011). Skips gracefully if PyMuPDF or the sample PDF
is unavailable, so the suite stays green on machines without them."""
import os
import re
import sys
import unicodedata

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

fitz = pytest.importorskip("fitz")  # PyMuPDF
from pdf_import import (  # noqa: E402
    convert_pdf_to_html, _extract_holdings, HOLDING_EDGE_THRESHOLD,
)

# The sample lives in the user's Downloads; fall back to a fixtures copy.
_CANDIDATES = [
    r"C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf",
    os.path.join(os.path.dirname(__file__), "fixtures", "bhu_suktam.pdf"),
]
_PDF = next((p for p in _CANDIDATES if os.path.isfile(p)), None)
pytestmark = pytest.mark.skipif(_PDF is None, reason="sample Veda Union PDF not available")

_ACCENTS = set("̱̍̎ˎ")


def _rows(html):
    out = []
    for m in re.finditer(r'<p(?:\s+class="([^"]*)")?>(.*?)</p>', html, re.S):
        cls = m.group(1) or ''
        import html as _h
        txt = _h.unescape(re.sub('<[^>]+>', '', m.group(2))).strip()
        if txt:
            out.append((cls, txt))
    return out


def test_structure_and_accents():
    rows = _rows(convert_pdf_to_html(_PDF))
    classes = [c for c, _ in rows]
    assert classes.count('ql-doc-title') >= 1
    assert classes.count('ql-doc-subtitle') >= 1
    assert any(c == 'ql-doc-comment' for c in classes)         # source citation (block class)
    assert sum(1 for c in classes if c == 'ql-doc-translation') >= 5  # translations

    # Shloka line 1 reconstructs exactly (accents on the right base chars).
    target = unicodedata.normalize('NFC', "bhūmi̍r bhū̱mnā dyaur va̍ri̱ṇā'ntari̍kṣam mahi̱tvā ।")
    got = next((unicodedata.normalize('NFC', t) for c, t in rows if t.startswith('bhūmi')), '')
    assert got == target, repr(got)


def test_no_header_no_tofu_no_stranded_accents():
    rows = _rows(convert_pdf_to_html(_PDF))
    # No private-use / replacement glyphs anywhere.
    for _c, t in rows:
        assert not any('' <= ch <= '' or ch == '�' for ch in t), repr(t)
    # Accent marks never stranded on gray (comment/translation) lines.
    for c, t in rows:
        if c in ('ql-doc-translation', 'ql-doc-comment'):
            assert not (set(t) & _ACCENTS), ('stranded accent', c, repr(t))
    # Running header line ("bhū sūktam   kṛṣṇa yajurvedīya") is not in the body.
    assert not any(t.strip().startswith('bhū sūktam') and 'kṛṣṇa yajurvedīya' in t for _c, t in rows)


# ── Feature 003: faithful holdings + pauses ──────────────────────────────────

def _box_counts():
    doc = fitz.open(_PDF)
    short = long = 0
    thicks = []
    try:
        for pno in range(doc.page_count):
            for b in _extract_holdings(doc[pno]):
                thicks.append(b['thick'])
                if b['kind'] == 'long':
                    long += 1
                else:
                    short += 1
    finally:
        doc.close()
    return short, long, thicks


def test_holdings_match_boxes_one_to_one():
    """Every green box in the source becomes exactly one holding span, with the correct
    short/long type — no holdings added, none missed (SC-001)."""
    html = convert_pdf_to_html(_PDF)
    n_short_spans = len(re.findall(r'ql-holding-short', html))
    n_long_spans = len(re.findall(r'ql-holding-long', html))
    box_short, box_long, _ = _box_counts()
    assert box_short > 0 and box_long > 0, 'sample should contain both holding types'
    assert n_short_spans == box_short, (n_short_spans, box_short)
    assert n_long_spans == box_long, (n_long_spans, box_long)


def test_edge_thickness_clusters_straddle_threshold():
    """The observed per-box border thickness has a thin (short) cluster below the threshold
    and a thick (long) cluster at/above it (SC-001 basis)."""
    _, _, thicks = _box_counts()
    assert any(t < HOLDING_EDGE_THRESHOLD for t in thicks)
    assert any(t >= HOLDING_EDGE_THRESHOLD for t in thicks)


def test_holding_multichar_runs_and_no_lost_inner_markup():
    """A box spanning a cluster (aspirate/geminate/conjunct) wraps all its base chars in ONE
    span; accents/change-style inside a row are preserved, not dropped (SC-004)."""
    html = convert_pdf_to_html(_PDF)
    runs = re.findall(r'<span class="ql-holding-(?:short|long)">(.*?)</span>', html, re.S)
    # At least one multi-character holding run (e.g. bh / th / nn / ddh).
    multi = [r for r in runs if len(re.sub('<[^>]+>', '', r)) >= 2]
    assert multi, 'expected at least one multi-character holding run'
    # Inner accent/change markup may appear inside holdings; if any does, it stays well-formed.
    for r in runs:
        assert r.count('<span') == r.count('</span>'), repr(r)


def test_pauses_classified_by_color():
    """Red pipes → long-pause, blue pipes → short-pause; a blue pipe is never emitted as a
    change-style glyph; black daṇḍas stay plain (SC-002)."""
    html = convert_pdf_to_html(_PDF)
    assert len(re.findall(r'<span class="ql-short-pause">\|</span>', html)) > 0
    assert len(re.findall(r'<span class="ql-long-pause">\|</span>', html)) > 0
    # No blue pipe leaked into change-style.
    assert re.search(r'<span class="ql-change-style">\|</span>', html) is None
    # Daṇḍas are not wrapped in any pause span.
    assert re.search(r'<span class="ql-(?:short|long)-pause">[।॥]</span>', html) is None


def test_graceful_no_false_holdings_on_plain_pdf(tmp_path):
    """A plain text PDF (no green boxes, no colored pipes) imports with zero holding/pause
    spans and does not raise (SC-006)."""
    pdf_path = str(tmp_path / "plain.pdf")
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "agnim ile purohitam yajnasya devam rtvijam")
    doc.save(pdf_path)
    doc.close()
    html = convert_pdf_to_html(pdf_path)
    assert 'ql-holding-' not in html
    assert 'pause' not in html
    assert 'agnim' in html
