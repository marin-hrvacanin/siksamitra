# THE ADD-IN, PRESSED IN REAL WORD - each command, as a press runs it.
#
# The COM gates hand Word our XML and read back Word's; they never run the
# add-in. This does: the selection is placed through COM, each command is run
# in the add-in's own runtime (`press.mjs`, over the WebView2 debugging port),
# and Node decodes what Word now holds with the add-in's own reader
# (`tools/word-ui.ts`). What it reaches that nothing else does is the add-in's
# Office.js half - the caret bookmarks, the dialogs, the document's settings -
# running in Word's own runtime.
#
# Why not the ribbon itself: a button invoked through UI Automation was
# measured not to reach the add-in every time, and once its keystrokes went
# into the document. A press calls the command's `ExecuteFunction`; so does this.
#
#   powershell -File tools/word-ui/drive.ps1 -Plan <json> -Out <json>
#
# The plan is a list of steps: { text, style } puts a paragraph in the active
# document; { xml } inserts a flat OPC package instead; { select: [from, to] }
# selects characters of paragraph 1; { fn } runs that command; { dialog } clicks
# the button of that label in the open dialog; { type } types at the caret;
# { lines } puts several paragraphs in; { sel } selects across them; { undo }
# is Word's own; { js } runs code in the add-in's runtime; { unstyle } deletes
# every custom style; { read } saves the body's OOXML. Plain ASCII: Windows PowerShell reads a
# script with no byte-order mark in the ANSI code page.
param(
  [Parameter(Mandatory = $true)][string]$Plan,
  [Parameter(Mandatory = $true)][string]$Out
)
$ErrorActionPreference = 'Stop'

# NOT `$plan`: PowerShell's names are case-insensitive, so that would BE the
# string-typed `$Plan` above, and the parsed plan would be coerced back into a
# string (the same trap `word-com/live.ps1` records).
$todo = Get-Content -LiteralPath $Plan -Raw -Encoding UTF8 | ConvertFrom-Json
$dir = Split-Path -Parent (Resolve-Path -LiteralPath $Plan)
$result = [ordered]@{ steps = @() }
$press = Join-Path $PSScriptRoot 'press.mjs'

function Save-Text($name, $text) {
  [System.IO.File]::WriteAllText((Join-Path $dir $name), $text, (New-Object System.Text.UTF8Encoding($false)))
  return $name
}

function Press($fn) {
  & node $press fn $fn
  if ($LASTEXITCODE -ne 0) { throw "calling '$fn' failed" }
}

# The document to work in, by its path when one is given (`WORD_UI_DOC`) -
# with two Words running, "the active one" may be the wrong one - and
# otherwise the active document of the running Word.
if ($env:WORD_UI_DOC) {
  $word = $null
  foreach ($d in ([Runtime.InteropServices.Marshal]::BindToMoniker($env:WORD_UI_DOC)).Application.Documents) {
    if ($d.Name -eq (Split-Path -Leaf $env:WORD_UI_DOC)) { $doc = $d; $word = $d.Application }
  }
  if ($null -eq $word) { throw "no open document at $env:WORD_UI_DOC" }
  $doc.Activate()
} else {
  $word = [Runtime.InteropServices.Marshal]::GetActiveObject('Word.Application')
  $doc = $word.ActiveDocument
}

$n = 0
foreach ($s in $todo.steps) {
  $n += 1
  $rec = [ordered]@{ step = $n }
  try {
    if ($s.text -ne $null) {
      # A CLEAN line: `Content.Text` alone keeps whatever character style the
      # text had, so a line typed after a test inherited the last one's boxes.
      $doc.Content.Delete() | Out-Null
      $all = $doc.Content
      $all.Style = -1            # wdStyleNormal
      $all.Font.Reset()
      $all.Text = $s.text
      $all = $doc.Content
      $all.Style = -66           # wdStyleDefaultParagraphFont: no character style
      $all.Font.Reset()
      if ($s.style -ne $null) { try { $doc.Paragraphs.Item(1).Style = $s.style } catch { $rec.styleMissing = $true } }
    }
    if ($s.lines -ne $null) {
      # Several paragraphs, each { text, style }: clean, as `text` is.
      $doc.Content.Delete() | Out-Null
      $all = $doc.Content
      $all.Style = -1
      $all.Font.Reset()
      $all.Text = (@($s.lines | ForEach-Object { [string]$_.text }) -join "`r")
      $all = $doc.Content
      $all.Style = -66
      $all.Font.Reset()
      $i = 0
      foreach ($l in @($s.lines)) {
        $i += 1
        if ($l.style -ne $null) { try { $doc.Paragraphs.Item($i).Style = [string]$l.style } catch { $rec.styleMissing = $true } }
      }
    }
    if ($s.sel -ne $null) {
      # [p1, o1, p2, o2]: paragraph p1 (1-based) at offset o1 to paragraph p2
      # at o2; an offset of -1 is that paragraph's end, before its mark.
      $at = {
        param($p, $o)
        # From the paragraph's FIRST LETTER: inside a content control the
        # paragraph's range begins at the control's own start marker - a
        # position of its own, with no text (measured: paragraph 0-12, control
        # content 1-10) - and offset 0 to 1 selected the marker, not the letter.
        $r = $doc.Paragraphs.Item([int]$p).Range
        if ([int]$o -lt 0) { return $r.End - 1 }
        $b = $r.Start
        while ($b -lt $r.End -and [string]::IsNullOrEmpty($doc.Range($b, $b + 1).Text)) { $b += 1 }
        return $b + [int]$o
      }
      $doc.Range((& $at $s.sel[0] $s.sel[1]), (& $at $s.sel[2] $s.sel[3])).Select()
    }
    if ($s.undo -ne $null) {
      # Word's own undo, as Ctrl+Z: what one command did must be one step back.
      $rec.undone = $doc.Undo([int]$s.undo)
    }
    if ($s.said -ne $null) {
      & node $press said ([string]$s.said)
      if ($LASTEXITCODE -ne 0) { throw "the message was not '$($s.said)'" }
      Start-Sleep -Milliseconds 600
    }
    if ($s.upload -ne $null) {
      & node $press upload ([string]$s.upload)
      if ($LASTEXITCODE -ne 0) { throw "could not choose $($s.upload) in the pane" }
      Start-Sleep -Milliseconds ([int]($s.wait | ForEach-Object { if ($_) { $_ } else { 6000 } }))
    }
    if ($s.js -ne $null) {
      # As base64: Windows PowerShell mangles the double quotes in an argument
      # it hands a native program, and JSON is all double quotes.
      $code = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([string]$s.js))
      & node $press eval $code
      if ($LASTEXITCODE -ne 0) { throw "the runtime refused: $($s.js)" }
    }
    if ($s.secondDoc -ne $null) {
      # A blank document of the check's own beside the test one: Word refuses
      # an add-in a content control whenever another document is open.
      $extra = $word.Documents.Add()
      $doc.Activate()
    }
    if ($s.closeSecond -ne $null -and $extra -ne $null) { $extra.Close(0); $extra = $null; $doc.Activate() }
    if ($s.closeDialogs -ne $null) {
      # An add-in dialog left from a run that was stopped, or from a runtime
      # since reloaded, answers no button: its reply goes to a page that is
      # gone. Word opens one dialog at a time, so it blocks every command
      # after it. Closed as a window - only the add-in's, in THIS Word.
      Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
      $A = [System.Windows.Automation.AutomationElement]
      $main = $A::FromHandle([IntPtr]$word.ActiveWindow.Hwnd)
      $byClass = New-Object System.Windows.Automation.PropertyCondition($A::ClassNameProperty, 'NUIDialog')
      $rec.closed = 0
      foreach ($d in $main.FindAll([System.Windows.Automation.TreeScope]::Descendants, $byClass)) {
        if ($d.Current.Name -like '*mitra*said.html*') {
          $d.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Close()
          $rec.closed += 1
        }
      }
    }
    if ($s.unstyle -ne $null) {
      # Every custom style out of the (test) document: a document of his has
      # none of ours, and a style already present is one Word keeps.
      $doc.Content.Delete() | Out-Null
      foreach ($st in @($doc.Styles)) { if (-not $st.BuiltIn) { try { $st.Delete() } catch { } } }
    }
    if ($s.xml -ne $null) {
      $doc.Content.Text = ''
      $doc.Content.InsertXML((Get-Content -LiteralPath (Join-Path $dir $s.xml) -Raw -Encoding UTF8))
    }
    if ($s.select -ne $null) {
      $para = $doc.Paragraphs.Item(1).Range
      $doc.Range($para.Start + [int]$s.select[0], $para.Start + [int]$s.select[1]).Select()
    }
    if ($s.fn -ne $null) {
      # A COMMAND IS VERIFIED, not waited for: the paragraph is watched for the
      # change it should make. `still` says it is meant to change nothing yet
      # (it asks first, or refuses).
      $before = $doc.Content.WordOpenXML
      Press $s.fn
      $changed = $false
      $deadline = (Get-Date).AddMilliseconds(([int]($s.wait | ForEach-Object { if ($_) { $_ } else { 10000 } })))
      while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 400
        if ($s.still -ne $null) { continue }
        if ($doc.Content.WordOpenXML -ne $before) { $changed = $true; break }
      }
      if ($s.still -eq $null -and -not $changed) { throw "'$($s.fn)' changed nothing" }
      Start-Sleep -Milliseconds 700
    }
    if ($s.dialog -ne $null) {
      & node $press dialog $s.dialog
      if ($LASTEXITCODE -ne 0) { throw "no '$($s.dialog)' button in any dialog" }
      Start-Sleep -Milliseconds ([int]($s.wait | ForEach-Object { if ($_) { $_ } else { 3000 } }))
    }
    if ($s.wait -ne $null -and $s.fn -eq $null -and $s.dialog -eq $null) { Start-Sleep -Milliseconds ([int]$s.wait) }
    if ($s.type -ne $null) {
      # Typed as a person types, at the caret, in Word's own typing.
      $word.Selection.TypeText([string]$s.type)
      Start-Sleep -Milliseconds 300
    }
    if ($s.read -ne $null) {
      $rec.body = Save-Text "ui-$n.xml" $doc.Content.WordOpenXML
      $rec.text = $doc.Paragraphs.Item(1).Range.Text
      $sel = $word.Selection
      # Parenthesised: a comma binds tighter than a minus in PowerShell.
      $first = $doc.Paragraphs.Item(1).Range.Start
      $rec.selection = @(($sel.Start - $first), ($sel.End - $first))
    }
    $rec.ok = $true
  } catch {
    $rec.ok = $false
    $rec.error = "$_"
  }
  $result.steps += $rec
}
[System.IO.File]::WriteAllText($Out, ($result | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
