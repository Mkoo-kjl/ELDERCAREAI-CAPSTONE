param([Parameter(Mandatory=$true)][string]$InputDoc,[Parameter(Mandatory=$true)][string]$OutputPdf)
$ErrorActionPreference='Stop'
$word=$null
$document=$null
try {
  $word=New-Object -ComObject Word.Application
  $word.Visible=$false
  $word.DisplayAlerts=0
  $document=$word.Documents.Open($InputDoc,$false,$true,$false)
  $document.Repaginate()
  $pages=$document.ComputeStatistics(2)
  $document.ExportAsFixedFormat($OutputPdf,17)
  Write-Output "Word exported $pages pages."
} finally {
  $saveChanges=0
  if($null -ne $document){$document.Close([ref]$saveChanges);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)}
  if($null -ne $word){$word.Quit([ref]$saveChanges);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)}
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
