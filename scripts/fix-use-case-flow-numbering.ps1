param(
    [string]$SourcePath = (Join-Path $PSScriptRoot '..\docs\REVISED_SYSTEM_USE_CASE_CLEANED.docx'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\docs\REVISED_SYSTEM_USE_CASE_NUMBERING_FIXED.docx')
)

$ErrorActionPreference = 'Stop'

function Copy-SharedFile {
    param([string]$Source, [string]$Destination)

    $inputStream = [IO.File]::Open(
        $Source,
        [IO.FileMode]::Open,
        [IO.FileAccess]::Read,
        [IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete
    )
    try {
        $outputStream = [IO.File]::Create($Destination)
        try {
            $inputStream.CopyTo($outputStream)
        }
        finally {
            $outputStream.Dispose()
        }
    }
    finally {
        $inputStream.Dispose()
    }
}

function Set-FlowCell {
    param(
        [object]$Cell,
        [string[]]$Steps
    )

    $Cell.Range.Text = ($Steps -join "`r")
    $Cell.Range.Font.Name = 'Times New Roman'
    $Cell.Range.Font.Size = 9
    $Cell.Range.Font.Bold = 0
    $Cell.Range.Font.Color = 0
    $Cell.Range.ParagraphFormat.SpaceBefore = 0
    $Cell.Range.ParagraphFormat.SpaceAfter = 0
    $Cell.Range.ParagraphFormat.LeftIndent = 0
    $Cell.Range.ParagraphFormat.FirstLineIndent = 0
    $Cell.Range.ParagraphFormat.LineSpacingRule = 0
    $Cell.VerticalAlignment = 0
}

$source = [IO.Path]::GetFullPath($SourcePath)
$output = [IO.Path]::GetFullPath($OutputPath)

if (-not (Test-Path -LiteralPath $source)) {
    throw "Source document not found: $source"
}

$outputDirectory = Split-Path -Parent $output
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

Copy-SharedFile $source $output

$updates = @(
    [pscustomobject]@{
        Index = 15
        Name = 'Wear Tracker'
        Actor = @(
            '1. Wear the tracker as instructed.',
            '3. Keep the tracker charged and use it during normal daily activity.',
            '5. Allow the tracker or companion service to synchronize available readings.'
        )
        Application = @(
            '2. Collect supported measurements.',
            '4. Report the paired or disconnected state.',
            '6. Make synchronized readings available to ElderCareAI through the connected health service.',
            '7. If the tracker is off, unpaired, or out of power, return no new measurements.'
        )
    },
    [pscustomobject]@{
        Index = 16
        Name = 'View Vitals From Tracker'
        Actor = @(
            '1. Wake the tracker display.',
            '2. Open the supported health or vital tile.',
            '5. Review the measurement and its time or status.',
            '7. Continue wearing the tracker so later readings can synchronize.'
        )
        Application = @(
            '3. Display the supported measurement.',
            '4. If no valid reading exists, show the device-specific unavailable or retry state.',
            '6. Treat the reading as informational and not as a medical diagnosis.'
        )
    },
    [pscustomobject]@{
        Index = 24
        Name = 'Review Emergency Records'
        Actor = @(
            '1. Open Emergency records.',
            '5. Review the selected event, elderly-person identifier, event time, responder, response time, and resolution status.',
            '6. Open related account or alert details when needed.',
            '8. Refresh the records.'
        )
        Application = @(
            '2. Load recent emergency events and related critical alerts.',
            '3. Display saved records in time order.',
            '4. If no records exist, show an empty state.',
            '7. Do not present saved records as live emergency-device monitoring.'
        )
    },
    [pscustomobject]@{
        Index = 26
        Name = 'View System Overview'
        Actor = @(
            '1. Open Overview.',
            '4. Review the available summary cards and recent activity.',
            '5. Select an account, monitor, emergency, report, or security page.',
            '7. Return to Overview and request a refresh when needed.'
        )
        Application = @(
            '2. Load current account counts, access status, recent synchronization records, alerts, emergencies, and audit activity.',
            '3. Display the summary cards, recent activity, and refresh time. Show zero counts or empty states when a category has no records.',
            '6. Open the selected management page.',
            '8. Load and display the latest saved data and update the refresh time.',
            '9. If refresh fails, preserve the last displayed data and show an error.'
        )
    }
)

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($output, $false, $false)

    foreach ($update in $updates) {
        $table = $document.Tables.Item($update.Index)
        $actualName = ($table.Cell(1, 2).Range.Text -replace '[\r\a]', '').Trim()
        if ($actualName -ne $update.Name) {
            throw "Table index $($update.Index) should be '$($update.Name)' but is '$actualName'."
        }

        Set-FlowCell $table.Cell(8, 2) $update.Actor
        Set-FlowCell $table.Cell(8, 3) $update.Application
    }

    $document.Fields.Update() | Out-Null
    $document.Repaginate()
    $document.Save()
    Write-Output "PAGES=$($document.ComputeStatistics(2))"
    Write-Output "Created $output"
}
finally {
    if ($document -ne $null) {
        try { $document.Close($false) } catch { }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document)
    }
    if ($word -ne $null) {
        try { $word.Quit() } catch { }
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
