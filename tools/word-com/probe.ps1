# WHAT WORD ACTUALLY DOES, asked of Word.
#
# Three questions the add-in's design turns on, and not one of them is
# answerable from Microsoft's documentation:
#
#   1. What parts does a range's OOXML package contain? `Paragraph.getOoxml()`
#      is what the add-in reads a paragraph with, and whether `styles.xml`
#      comes back with it decides whether the pane can tell a fresh document
#      from a prepared one at all.
#   2. Does inserting a package that DEFINES styles leave those styles in the
#      document after the inserted text is deleted again? "Add the styles" is
#      that, and if Word drops definitions it no longer sees used, the button
#      cannot work the quiet way and has to leave a specimen behind.
#   3. Does a `w:sectPr` at the end of an inserted body change the page?
#
# `Range.WordOpenXML` and `Range.InsertXML` are the COM equivalents of
# `getOoxml` and `insertOoxml` — the same flat OPC package on both sides — so
# the answers hold for the add-in.
#
# Usage: powershell -File tools/word-com/probe.ps1 -Job <json> -Out <json>
param(
  [Parameter(Mandatory = $true)][string]$Job,
  [Parameter(Mandatory = $true)][string]$Out
)

$ErrorActionPreference = 'Stop'
# NOT `$job`: `param([string]$Job)` type-constrains that name, and PowerShell is
# case-insensitive — assigning an object to it COERCES it to a string, and every
# property read afterwards is silently $null.
$plan = Get-Content -LiteralPath $Job -Raw -Encoding UTF8 | ConvertFrom-Json
$result = [ordered]@{}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

function Close-Doc($doc) {
  try { $doc.Close(0) } catch { }
}

try {
  $result.version = $word.Version
  $result.build = $word.Build

  # ── 1. what a fresh document's OOXML package contains ───────────────────
  $doc = $word.Documents.Add()
  $doc.Content.Text = 'agnim'
  $pkg = $doc.Paragraphs.Item(1).Range.WordOpenXML
  $result.freshPackageBytes = $pkg.Length
  $result.freshParts = @(
    [regex]::Matches($pkg, 'pkg:name="([^"]+)"') | ForEach-Object { $_.Groups[1].Value }
  )
  $result.freshDeclaresTranslit = $pkg.Contains('w:styleId="Translit"')

  # ── 2. insert the specimen, read the styles, delete it, read again ───────
  $specimen = Get-Content -LiteralPath $plan.specimen -Raw -Encoding UTF8
  $end = $doc.Content
  $end.Collapse(0)          # wdCollapseEnd
  $end.InsertXML($specimen)

  $result.afterInsert = @($doc.Styles | ForEach-Object {
      try { $_.NameLocal } catch { '' }
    } | Where-Object { $plan.wanted -contains $_ })

  $afterPkg = $doc.Content.WordOpenXML
  $result.afterInsertDeclares = @(
    [regex]::Matches($afterPkg, 'w:styleId="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } |
      Sort-Object -Unique | Where-Object { $plan.wanted -contains $_ }
  )
  $result.afterInsertText = $doc.Content.Text.Substring(0, [Math]::Min(400, $doc.Content.Text.Length))

  # Delete everything the insertion added, and ask again.
  $doc.Content.Delete() | Out-Null
  $result.afterDelete = @($doc.Styles | ForEach-Object {
      try { $_.NameLocal } catch { '' }
    } | Where-Object { $plan.wanted -contains $_ })

  # ── 3. does a trailing sectPr change the page ───────────────────────────
  $before = [ordered]@{ w = $doc.PageSetup.PageWidth; h = $doc.PageSetup.PageHeight;
    left = $doc.PageSetup.LeftMargin; top = $doc.PageSetup.TopMargin }
  $result.pageBefore = $before
  if ($plan.sectPr) {
    $sect = Get-Content -LiteralPath $plan.sectPr -Raw -Encoding UTF8
    $r = $doc.Content
    $r.Collapse(0)
    $r.InsertXML($sect)
    $result.pageAfter = [ordered]@{ w = $doc.PageSetup.PageWidth; h = $doc.PageSetup.PageHeight;
      left = $doc.PageSetup.LeftMargin; top = $doc.PageSetup.TopMargin;
      sections = $doc.Sections.Count }
  }

  Close-Doc $doc
} finally {
  try { $word.Quit(0) } catch { }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
  [GC]::Collect()
}

$result | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $Out -Encoding UTF8
Write-Output "wrote $Out"
