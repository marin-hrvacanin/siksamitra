"""
THE DAṆḌAS, AS HIS PAGE DRAWS THEM — a face of two glyphs, made here.

His files set the daṇḍas in Mangal, which is Microsoft's and is not on every
machine — not on this one, and not on the bot's server. Its daṇḍas are plain
bars, and measured off the Mangal his own PDFs embed (bhū sūktam v1.1, the
sādhanā v9.1.13), at 2048 units to the em:

    ।  advance 854,  one bar  x 416–592,             y −107 to 1389
    ॥  advance 1254, two bars x 416–592 and 816–992, y −107 to 1389

A rectangle is not a design anyone owns. So the face is ours: those two
glyphs, drawn from those numbers, under the project's own licence — and a
daṇḍa on our page is his daṇḍa, at his width, his height and his weight,
on any machine. It stays text, so a copy, a search and a PDF's text layer
still read `।`.

    .venv/Scripts/python tools/fonts/danda.py

writes `assets/fonts/siksamitra-danda-400-normal.ttf` (`LOCAL_FAMILIES` in the manifest).
"""
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UPM = 2048
TOP, FOOT = 1389, -107
BAR = (416, 592)
SECOND = (816, 992)
OUT = 'assets/fonts/siksamitra-danda-400-normal.ttf'


def bars(*spans):
    pen = TTGlyphPen(None)
    for x0, x1 in spans:
        # Clockwise, as TrueType fills an outer contour.
        pen.moveTo((x0, FOOT))
        pen.lineTo((x0, TOP))
        pen.lineTo((x1, TOP))
        pen.lineTo((x1, FOOT))
        pen.closePath()
    return pen.glyph()


def notdef():
    pen = TTGlyphPen(None)
    pen.moveTo((128, 0)); pen.lineTo((128, 1320)); pen.lineTo((896, 1320)); pen.lineTo((896, 0)); pen.closePath()
    return pen.glyph()


def main():
    fb = FontBuilder(UPM, isTTF=True)
    order = ['.notdef', 'danda', 'doubledanda']
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({0x0964: 'danda', 0x0965: 'doubledanda'})
    fb.setupGlyf({'.notdef': notdef(), 'danda': bars(BAR), 'doubledanda': bars(BAR, SECOND)})
    fb.setupHorizontalMetrics({'.notdef': (1024, 128), 'danda': (854, BAR[0]), 'doubledanda': (1254, BAR[0])})
    fb.setupHorizontalHeader(ascent=TOP, descent=FOOT)
    names = {
        'familyName': 'Siksamitra Danda',
        'styleName': 'Regular',
        'uniqueFontIdentifier': 'Siksamitra Danda Regular',
        'fullName': 'Siksamitra Danda Regular',
        'psName': 'SiksamitraDanda-Regular',
        'version': 'Version 1.000',
        'copyright': 'The daṇḍas of the owner\'s page, drawn by the śikṣāmitra project.',
        'licenseDescription': 'SIL Open Font License 1.1',
        'licenseInfoURL': 'https://openfontlicense.org',
    }
    fb.setupNameTable(names)
    fb.setupOS2(sTypoAscender=TOP, sTypoDescender=FOOT, sTypoLineGap=0,
                usWinAscent=TOP, usWinDescent=-FOOT, fsType=0, achVendID='SIKS')
    fb.setupPost()
    fb.save(OUT)
    print(f'wrote {OUT}')


if __name__ == '__main__':
    main()
