$ErrorActionPreference = 'Stop'
$documentPath = 'C:\ELDERCAREAI-CAPSTONE\output\documents\ElderCareAI_Revised_Specifications_Reference_Format.docx'
$pdfPath = 'C:\ELDERCAREAI-CAPSTONE\tmp\specification-reference-format\word-render.pdf'
$wordInstance = $null
$wordDocument = $null
try {
    $wordInstance = New-Object -ComObject Word.Application
    $wordInstance.Visible = $false
    $wordInstance.DisplayAlerts = 0
    $wordInstance.AutomationSecurity = 3
    $wordDocument = $wordInstance.Documents.Open($documentPath, $false, $true)
    $wordDocument.Repaginate()
    $wordDocument.ExportAsFixedFormat($pdfPath, 17)
    Write-Output $pdfPath
} finally {
    if ($null -ne $wordDocument) {
        $wordDocument.Close(0)
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wordDocument)
    }
    if ($null -ne $wordInstance) {
        $wordInstance.Quit()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wordInstance)
    }
}
