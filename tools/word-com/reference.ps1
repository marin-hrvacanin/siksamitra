# HIS DOCUMENTS, EVERY MANTRA LINE WRITTEN BACK BY WORD ITSELF.
#
# The half of `tools/word-live-reference.ts` that only Word can do. Node built
# every payload with the add-in's own code — exactly what `writeLines` hands
# `insertOoxml` — and this hands each to `Range.InsertXML`, the COM twin of
# `insertOoxml`, over the same paragraph's CONTENT (never its mark; see
# `live.ps1` for the paragraph that replacing the mark ate). Then Word's own
# OOXML comes back, and Node compares what Word would draw with his original.
#
# Every document is opened READ-ONLY and closed without saving. Nothing on
# disk is touched.
#
#   powershell -File tools/word-com/reference.ps1 -Job <json> -Out <json>
param(
  [Parameter(Mandatory = $true)][string]$Job,
  [Parameter(Mandatory = $true)][string]$Out
)

$ErrorActionPreference = 'Stop'
function Step($what) { Write-Host "    $what" }

$plan = Get-Content -LiteralPath $Job -Raw -Encoding UTF8 | ConvertFrom-Json
$dir = Split-Path -Parent (Resolve-Path -LiteralPath $Job)
$result = [ordered]@{ docs = @() }

function Save-Text($name, $text) {
  # NO BOM: a byte-order mark before a flat OPC package is a character before
  # the root element, and the reader's first regex then misses.
  [System.IO.File]::WriteAllText((Join-Path $dir $name), $text, (New-Object System.Text.UTF8Encoding($false)))
  return $name
}

# The Word this starts, by process id: `Quit` was measured not to end it
# every time, and each run left an invisible Word of ~230 MB behind - five of
# them ran the machine out of memory. Only THIS process is stopped, never a
# Word the person has open.
$wordsBefore = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
$word = New-Object -ComObject Word.Application
$ours = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $wordsBefore -notcontains $_.Id } | ForEach-Object { $_.Id })
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $result.version = "$($word.Version) build $($word.Build)"
  Step "Word $($result.version)"
  $n = 0
  foreach ($d in $plan.docs) {
    $n += 1
    Step "opening $($d.name), read-only"
    $doc = $word.Documents.Open((Resolve-Path -LiteralPath $d.file).Path, $false, $true)
    # HIDDEN TEXT SHOWN, so Word counts every paragraph our reader does. With it
    # hidden Word leaves out a paragraph whose mark is hidden (his Devi hides
    # 21: 3900 against 3921), and an index into one list is not an index into
    # the other. The add-in maps across that (`model/paragraph-index.ts`).
    $doc.ActiveWindow.View.ShowHiddenText = $true
    $before = $doc.Paragraphs.Count
    $moved = @()
    $refused = @()
    $written = 0
    $k = 0
    foreach ($w in $d.writes) {
      $index = [int]$w.index + 1   # COM paragraphs are 1-based
      $was = $doc.Paragraphs.Count
      $target = $doc.Paragraphs.Item($index).Range
      $target.SetRange($target.Start, [Math]::Max($target.Start, $target.End - 1))
      # A write Word REFUSES is recorded, not fatal: the gate says which line,
      # and the other lines of the document are still measured.
      try {
        $target.InsertXML((Get-Content -LiteralPath (Join-Path $dir $w.file) -Raw -Encoding UTF8))
      } catch {
        $refused += [ordered]@{ index = $w.index; error = "$($_.Exception.Message)" }
        $k += 1
        continue
      }
      $now = $doc.Paragraphs.Count
      if ($now -ne $was) { $moved += [ordered]@{ index = $w.index; was = $was; now = $now } }
      $written += 1
      $k += 1
      if ($k % 200 -eq 0) { Step "  $k of $($d.writes.Count)" }
    }
    $result.docs += [ordered]@{
      name = $d.name
      paragraphs = $before
      after = $doc.Paragraphs.Count
      written = $written
      moved = $moved
      refused = $refused
      body = Save-Text "after-$n.xml" $doc.Content.WordOpenXML
    }
    # `0` is wdDoNotSaveChanges: his file is never written.
    $doc.Close(0)
  }
} finally {
  try { $word.Quit(0) } catch { }
  Start-Sleep -Milliseconds 1500
  foreach ($id in $ours) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
[System.IO.File]::WriteAllText($Out, ($result | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
