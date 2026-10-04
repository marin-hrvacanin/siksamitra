# Open OUR exported .docx in a Word of our own, let Word fill its fields
# (contents page numbers, running heads), and save the .docx and its PDF.
# Never touches a Word the person has open: if one is running, we only ever
# close our own document and never Quit.
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Docx,
  [Parameter(Mandatory = $true)][string]$Pdf
)
$ErrorActionPreference = 'Stop'
$In = (Resolve-Path $In).Path
$Docx = [System.IO.Path]::GetFullPath($Docx)
$Pdf = [System.IO.Path]::GetFullPath($Pdf)
$wasRunning = @(Get-Process WINWORD -ErrorAction SilentlyContinue).Count -gt 0
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
$doc = $null
try {
  $doc = $word.Documents.Open($In, $false, $false, $false)
  Write-Output ("opened, pages before fields: " + $doc.ComputeStatistics(2))
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
  foreach ($story in $doc.StoryRanges) {
    $r = $story
    while ($r -ne $null) { $null = $r.Fields.Update(); $r = $r.NextStoryRange }
  }
  foreach ($sec in $doc.Sections) {
    foreach ($h in $sec.Headers) { $null = $h.Range.Fields.Update() }
    foreach ($f in $sec.Footers) { $null = $f.Range.Fields.Update() }
  }
  foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
  $doc.Repaginate()
  Write-Output ("pages: " + $doc.ComputeStatistics(2) + "  toc entries: " + $doc.TablesOfContents.Count)
  if (Test-Path $Docx) { Remove-Item $Docx -Force }
  $doc.SaveAs2($Docx, 16)
  if (Test-Path $Pdf) { Remove-Item $Pdf -Force }
  $doc.SaveAs2($Pdf, 17)
  Write-Output ("saved " + $Docx)
  Write-Output ("printed " + $Pdf)
} finally {
  if ($doc -ne $null) { $doc.Close(0) }
  if (-not $wasRunning -and $word.Documents.Count -eq 0) { $word.Quit() }
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
}
