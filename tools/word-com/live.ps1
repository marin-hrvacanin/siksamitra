# WORD ITSELF, DRIVEN OVER COM — the half of the add-in nothing else can test.
#
# `apps/word-addin/src/word/client.ts` says in its own header that none of it
# can be unit-tested: there is no headless Word, and `office-addin-mock` does
# not mock collections — `paragraphs` is one. This is the answer.
# `Range.InsertXML` and `Range.WordOpenXML` are the COM twins of the add-in's
# `insertOoxml` and `getOoxml`, over the same flat OPC package, so what Word
# does here is what Word does in the task pane.
#
# NODE OWNS THE MEANING; THIS OWNS WORD. Every payload is built by the add-in's
# own code before this runs and every answer is decoded by it afterwards. This
# script neither reads nor writes WordprocessingML: it hands Word a package,
# asks for one back, and reports the numbers only Word can state.
#
# NOTHING IS SAVED, and that is deliberate twice over.
#
#   IT IS WHAT THE ADD-IN DOES. The pane calls `insertOoxml` and `getOoxml`; it
#   never saves. The person saves afterwards, with Ctrl+S. A gate that saved
#   would be testing a step the add-in does not take — and Word's own
#   save-and-reload fidelity is already measured by `check:export:word`, which
#   round-trips every corpus document through a real `.docx`.
#
#   AND IT CANNOT BE DONE FROM HERE. `SaveAs2` from an invisible instance
#   blocks indefinitely on this machine — measured at eighteen minutes on 100%
#   of a core, with no dialog: enumerating the process's own windows found only
#   the hidden main frame and an `MsoWorkPane`. Every variant blocks the same
#   way, including `SaveAs`, no format argument, saving to `%TEMP%`, and
#   `Save()` on a document opened from an existing file — with Word signed in
#   and licensed. The first-save flow of a current Microsoft 365 Word wants a
#   surface it has not got.
#
# HIS DOCUMENT IS OPENED READ-ONLY and closed without saving, so the file on
# disk is never touched.
#
#   powershell -File tools/word-com/live.ps1 -Job <json> -Out <json>
#
# THE VARIABLE IS NOT CALLED `$job`. `param([string]$Job)` type-constrains that
# name and PowerShell is case-insensitive, so assigning the parsed object to
# `$job` COERCES it to a string and every property read afterwards is silently
# $null. That cost a debugging session.
param(
  [Parameter(Mandatory = $true)][string]$Job,
  [Parameter(Mandatory = $true)][string]$Out
)

$ErrorActionPreference = 'Stop'

# EVERY STEP ANNOUNCES ITSELF. A COM call into Word can block with no output
# and no window, and the first version of this sat for eighteen minutes with
# nothing to say which call it was in.
function Step($what) { Write-Host "    $what" }

$plan = Get-Content -LiteralPath $Job -Raw -Encoding UTF8 | ConvertFrom-Json
$result = [ordered]@{}
$dir = Split-Path -Parent (Resolve-Path -LiteralPath $Job)

function Save-Text($name, $text) {
  # NO BOM. Node hands these to the add-in's own reader, and a byte-order mark
  # in front of a flat OPC package is a character before the root element —
  # the reader's first regex then misses.
  [System.IO.File]::WriteAllText(
    (Join-Path $dir $name), $text, (New-Object System.Text.UTF8Encoding($false)))
  return $name
}

# Word's own answer for each paragraph: which style it resolved, in which face
# and size. A style that failed to arrive leaves the paragraph in Word's 11 pt
# Calibri, and nothing about that looks wrong.
function Probe($doc) {
  $out = @()
  foreach ($p in $doc.Paragraphs) {
    $rng = $p.Range
    $out += [ordered]@{
      style = $rng.Style.NameLocal
      font = $rng.Font.Name
      size = $rng.Font.Size
      text = $rng.Text
    }
  }
  return $out
}

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0

try {
  $result.version = "$($word.Version) build $($word.Build)"
  Step "Word $($word.Version) build $($word.Build)"

  # ══ 1. a fresh document, and what the specimen puts in it ════════════════
  Step 'a fresh document'
  $fresh = $word.Documents.Add()
  # One word of text, so the body is not empty — an empty body's OOXML is a
  # special case and not the one a person is ever in.
  $fresh.Content.Text = 'agnim'
  $result.freshBody = Save-Text 'live-fresh.xml' $fresh.Content.WordOpenXML

  Step 'inserting the specimen'
  $end = $fresh.Content
  $end.Collapse(0)   # wdCollapseEnd
  $end.InsertXML((Get-Content -LiteralPath $plan.specimen -Raw -Encoding UTF8))
  $result.afterSpecimenBody = Save-Text 'live-after-specimen.xml' $fresh.Content.WordOpenXML
  $result.paragraphsAfterSpecimen = $fresh.Paragraphs.Count
  $result.specimenParagraphs = Probe $fresh

  # THE STYLE NAMES WORD SHOWS, which only Word can say: a localised Word has
  # its own name for a built-in style, and the add-in must never depend on that
  # — it addresses styles by id. Reported so the difference stays visible.
  $result.resolvedNames = @($fresh.Styles | ForEach-Object {
      try { $_.NameLocal } catch { '' } } | Where-Object { $_ -ne '' })

  # ══ 2. does a style survive its text being deleted ═══════════════════════
  # The whole basis of "Add the styles", and undocumented.
  Step 'deleting the specimen again'
  $fresh.Content.Delete() | Out-Null
  $result.afterDeleteBody = Save-Text 'live-after-delete.xml' $fresh.Content.WordOpenXML
  $result.paragraphsAfterDelete = $fresh.Paragraphs.Count

  # ══ 3. one marked line, inserted and read back ═══════════════════════════
  Step 'a marked line, on its own'
  $marked = $word.Documents.Add()
  $marked.Content.InsertXML((Get-Content -LiteralPath $plan.marked -Raw -Encoding UTF8))
  $result.markedBody = Save-Text 'live-marked.xml' $marked.Content.WordOpenXML
  $result.markedText = $marked.Content.Text
  $result.markedParagraphs = Probe $marked
  # THE FIRST LETTER'S SIZE. `Range.Font.Size` over a range of mixed sizes
  # answers 9999999 — Word's sentinel for "they differ" — and a marked mantra
  # line genuinely does differ: letters at 16 pt, a `Svara` at 18. So the
  # paragraph's real type size is asked of one letter.
  $result.markedFirstLetterSize = $marked.Content.Characters.Item(1).Font.Size
  $marked.Close(0)

  # ══ 4. HIS OWN DOCUMENT, written back through Word ═══════════════════════
  # The one that matters. Node read his file outside Word, decoded the mantra
  # lines with the add-in's reader, and wrote out what the add-in WOULD put
  # back. That goes into the real document in real Word here, and Word's own
  # OOXML comes back for Node to decode and compare.
  if ($plan.his -and (Test-Path -LiteralPath $plan.his.file)) {
    Step 'opening his document, read-only'
    $his = $word.Documents.Open(
      (Resolve-Path -LiteralPath $plan.his.file).Path, $false, $true)
    $result.hisParagraphsWord = $his.Paragraphs.Count
    $result.hisBodyBefore = Save-Text 'live-his-before.xml' $his.Content.WordOpenXML

    # ONE AT A TIME, WITH THE COUNT AFTER EACH. `InsertXML` over a
    # paragraph's range is supposed to replace exactly that paragraph, and a
    # write that consumes its neighbour shifts every index after it — which
    # is how a whole-document re-mark writes a mantra into the wrong line.
    # So the count is recorded per write and Node reports which one moved it.
    $written = 0
    $counts = @()
    foreach ($one in $plan.his.writes) {
      $index = [int]$one.index + 1              # COM paragraphs are 1-based
      if ($index -lt 1 -or $index -gt $his.Paragraphs.Count) { continue }
      $was = $his.Paragraphs.Count
      $xml = Get-Content -LiteralPath (Join-Path $dir $one.file) -Raw -Encoding UTF8
      $target = $his.Paragraphs.Item($index).Range
      if ($plan.his.mode -eq 'content') {
        # WITHOUT THE PARAGRAPH MARK. A paragraph's `Range` ends AFTER its
        # mark, and replacing that consumed the following paragraph when the
        # following paragraph was empty — measured: 872 became 871 at one
        # write, and every index after it was then off by one.
        $target.SetRange($target.Start, [Math]::Max($target.Start, $target.End - 1))
      }
      $target.InsertXML($xml)
      $now = $his.Paragraphs.Count
      Step "  paragraph $index : $was -> $now"
      $counts += [ordered]@{ index = $index; was = $was; now = $now }
      $written += 1
    }
    $result.hisCounts = $counts
    $result.hisWritten = $written
    $result.hisParagraphsAfter = $his.Paragraphs.Count
    $result.hisBodyAfter = Save-Text 'live-his-after.xml' $his.Content.WordOpenXML
    # NOT SAVED. The file on disk is untouched; `0` is wdDoNotSaveChanges.
    $his.Close(0)
  }

  try { $fresh.Close(0) } catch { }
} finally {
  try { $word.Quit(0) } catch { }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

# NO BOM HERE EITHER. `Set-Content -Encoding UTF8` writes one, and
# `JSON.parse` rejects a byte-order mark with "Unexpected token" — which
# names the character and not the cause.
[System.IO.File]::WriteAllText($Out, ($result | ConvertTo-Json -Depth 8),
  (New-Object System.Text.UTF8Encoding($false)))
Write-Output "wrote $Out"
