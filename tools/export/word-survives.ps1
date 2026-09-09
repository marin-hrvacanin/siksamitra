# Does Word keep the document we hid in the file?
#
# THE ONE CLAIM `word/parts.ts` MAKES THAT CODE CANNOT CHECK. A custom XML data
# store part is the OOXML mechanism for private data and is documented as
# preserved, but "documented as" is not "measured", and everything the export
# promises rests on it. So this opens the file in a REAL Word, saves it, closes
# it, and hands the saved copy back for the importer to read.
#
# It is NOT part of `check:export:word`. That gate has to pass on a build
# machine with no Office installed. This is run by hand when the mechanism
# changes, and its result is recorded in docs/EXPORT-WORD-PDF.md.
#
#   powershell -File tools/export/word-survives.ps1 -In <path.docx> -Out <path.docx>
#   powershell -File tools/export/word-survives.ps1 -In <a.docx> -Out <b.docx> -Pdf <b.pdf>
#
# `-Pdf` additionally asks Word to PRINT the file. That is how the Word/PDF
# agreement in `gate-pdf.mjs` was calibrated against a real Word rather than
# against a simulation of one; the numbers are in docs/EXPORT-WORD-PDF.md.
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out,
  [string]$Pdf
)

$ErrorActionPreference = 'Stop'
$In = (Resolve-Path $In).Path
$Out = [System.IO.Path]::GetFullPath($Out)
if (Test-Path $Out) { Remove-Item $Out -Force }

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  Write-Output ("word " + $word.Version)
  # ConfirmConversions/AddToRecentFiles off, ReadOnly off: an open that asks a
  # question is an open that hangs a headless run.
  $doc = $word.Documents.Open($In, $false, $false)
  Write-Output ("opened  paragraphs=" + $doc.Paragraphs.Count)
  # The datastore, as Word itself sees it — before any save.
  Write-Output ("customXmlParts=" + $doc.CustomXMLParts.Count)
  foreach ($p in $doc.CustomXMLParts) {
    if ($p.NamespaceURI -like 'urn:sikshamitra*') {
      Write-Output ("  ours: " + $p.NamespaceURI + " " + $p.XML.Length + " chars")
    }
  }
  # 16 = wdFormatDocumentDefault (.docx), 17 = wdFormatPDF
  $doc.SaveAs2($Out, 16)
  Write-Output ("saved   " + $Out)
  if ($Pdf) {
    $pdfPath = [System.IO.Path]::GetFullPath($Pdf)
    if (Test-Path $pdfPath) { Remove-Item $pdfPath -Force }
    $doc.SaveAs2($pdfPath, 17)
    Write-Output ("printed " + $pdfPath)
  }
  $doc.Close(0)
} finally {
  $word.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
