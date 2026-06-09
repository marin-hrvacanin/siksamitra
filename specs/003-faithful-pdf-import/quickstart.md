# Quickstart: Faithful PDF Import

## Run the tests
```powershell
cd "C:\Users\Gostinska soba\Desktop\śikṣāmitra\editor"
$env:PYTHONUTF8=1
python -m pytest tests/test_pdf_import.py -q
```
Skips cleanly if PyMuPDF or the sample PDF is absent.

## Inspect the imported HTML directly
```powershell
$env:PYTHONUTF8=1
python -c "from pdf_import import convert_pdf_to_html; print(convert_pdf_to_html(r'C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf'))"
```
Expect: `ql-doc-title`/`ql-doc-subtitle`/`ql-comment-style` paragraphs, shloka `<p>` with
`ql-holding-short`/`ql-holding-long` spans on the right consonants, `ql-short-pause`/
`ql-long-pause` pipes, `ql-svara-true` accents, `ql-doc-translation` lines, verse separators.

## Full PDF → audio round trip (visual)
```powershell
$env:PYTHONUTF8=1
python tests/manual_e2e.py "C:\Users\Gostinska soba\Downloads\bhū sūktam v1.1.pdf" "https://youtu.be/Z_T8DlLwjeU?si=HGhk06dqU-ScTMjv"
```
Prints the per-line timeline; shlokas placed, translations skipped.

## In the app
```powershell
python editor.py
```
Open → PDF Files → pick the PDF → faithful structured import (holdings/pauses included) →
attach the cached recording (`cache\youtube_test\Z_T8DlLwjeU.mp3`) or paste the URL → map →
play all / play each line.
