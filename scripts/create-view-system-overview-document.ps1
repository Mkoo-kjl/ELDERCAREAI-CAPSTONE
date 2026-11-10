param(
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\docs\VIEW_SYSTEM_OVERVIEW_USE_CASE.docx'),
    [string]$FigurePath = (Join-Path $PSScriptRoot '..\docs\VIEW_SYSTEM_OVERVIEW_USE_CASE.png'),
    [string]$PdfPath = (Join-Path $PSScriptRoot '..\tmp\view-system-overview-docx-qa\VIEW_SYSTEM_OVERVIEW_USE_CASE.pdf')
)

$ErrorActionPreference = 'Stop'

function Set-CellText {
    param(
        [object]$Cell,
        [string]$Text,
        [double]$FontSize = 9,
        [bool]$Bold = $false,
        [int]$Alignment = 0,
        [int]$VerticalAlignment = 0
    )

    $Cell.Range.Text = $Text
    $Cell.Range.Font.Name = 'Times New Roman'
    $Cell.Range.Font.Size = $FontSize
    $Cell.Range.Font.Bold = $(if ($Bold) { -1 } else { 0 })
    $Cell.Range.Font.Color = 0
    $Cell.Range.ParagraphFormat.Alignment = $Alignment
    $Cell.Range.ParagraphFormat.SpaceBefore = 0
    $Cell.Range.ParagraphFormat.SpaceAfter = 0
    $Cell.Range.ParagraphFormat.LineSpacingRule = 0
    $Cell.VerticalAlignment = $VerticalAlignment
}

function Add-Paragraph {
    param(
        [object]$Document,
        [string]$Text,
        [double]$FontSize,
        [bool]$Bold = $false,
        [int]$Alignment = 0,
        [double]$SpaceBefore = 0,
        [double]$SpaceAfter = 0
    )

    $range = $Document.Content
    $range.Collapse(0)
    $range.Text = "$Text`r"
    $paragraph = $range.Paragraphs.Item(1)
    $paragraph.Range.Font.Name = 'Times New Roman'
    $paragraph.Range.Font.Size = $FontSize
    $paragraph.Range.Font.Bold = $(if ($Bold) { -1 } else { 0 })
    $paragraph.Range.Font.Color = 0
    $paragraph.Range.ParagraphFormat.Alignment = $Alignment
    $paragraph.Range.ParagraphFormat.SpaceBefore = $SpaceBefore
    $paragraph.Range.ParagraphFormat.SpaceAfter = $SpaceAfter
    $paragraph.Range.ParagraphFormat.LineSpacingRule = 0
    return $paragraph
}

$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$resolvedFigure = [IO.Path]::GetFullPath($FigurePath)
$resolvedPdf = [IO.Path]::GetFullPath($PdfPath)

if (-not (Test-Path -LiteralPath $resolvedFigure)) {
    throw "Figure not found: $resolvedFigure"
}

foreach ($directory in @((Split-Path -Parent $resolvedOutput), (Split-Path -Parent $resolvedPdf))) {
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
}

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Add()

    $section = $document.Sections.Item(1)
    $section.PageSetup.PageWidth = 612
    $section.PageSetup.PageHeight = 792
    $section.PageSetup.TopMargin = 36
    $section.PageSetup.BottomMargin = 36
    $section.PageSetup.LeftMargin = 36
    $section.PageSetup.RightMargin = 36

    $normal = $document.Styles.Item('Normal')
    $normal.Font.Name = 'Times New Roman'
    $normal.Font.Size = 10
    $normal.Font.Color = 0
    $normal.ParagraphFormat.SpaceAfter = 0
    $normal.ParagraphFormat.LineSpacingRule = 0

    $title = Add-Paragraph $document 'View System Overview' 14 $true 1 0 5
    try { $title.Style = $document.Styles.Item('Title') } catch { }
    $title.Range.Font.Name = 'Times New Roman'
    $title.Range.Font.Size = 14
    $title.Range.Font.Bold = -1
    $title.Range.Font.Color = 0
    $title.Range.ParagraphFormat.Alignment = 1
    $title.Range.ParagraphFormat.SpaceAfter = 5
    try { $title.Range.ParagraphFormat.Borders.Enable = 0 } catch { }

    [void](Add-Paragraph $document 'The administrator reviews system summaries and recent activity before opening the relevant management page.' 10 $false 0 0 5)

    $imageParagraph = $document.Content.Paragraphs.Add()
    $imageParagraph.Range.ParagraphFormat.Alignment = 1
    $imageParagraph.Range.ParagraphFormat.SpaceBefore = 0
    $imageParagraph.Range.ParagraphFormat.SpaceAfter = 2
    $imageRange = $imageParagraph.Range
    $imageRange.Collapse(1)
    $shape = $document.InlineShapes.AddPicture($resolvedFigure, $false, $true, $imageRange)
    $shape.LockAspectRatio = -1
    $shape.Width = 455
    $imageParagraph.Range.InsertParagraphAfter()

    [void](Add-Paragraph $document 'Figure 41: View System Overview' 9 $true 1 0 4)
    [void](Add-Paragraph $document 'Table 29' 9.5 $false 0 0 2)
    [void](Add-Paragraph $document 'VIEW SYSTEM OVERVIEW' 10 $true 0 0 3)

    $range = $document.Content
    $range.Collapse(0)
    $table = $document.Tables.Add($range, 8, 3)
    $table.AllowAutoFit = $false
    $table.Borders.Enable = 1
    $table.TopPadding = 2
    $table.BottomPadding = 2
    $table.LeftPadding = 4
    $table.RightPadding = 4

    $table.Columns.Item(1).Width = 100
    $table.Columns.Item(2).Width = 220
    $table.Columns.Item(3).Width = 220

    # The first six rows have one label column and one merged value column.
    for ($row = 1; $row -le 6; $row++) {
        [void]$table.Cell($row, 2).Merge($table.Cell($row, 3))
    }

    $metadata = @(
        @('Use Case Name', 'View System Overview'),
        @('Actor', 'Administrator'),
        @('Brief Description', 'The administrator reviews current account, synchronization, alert, emergency, and administrative activity summaries.'),
        @('Trigger', 'An authenticated administrator opens Overview.'),
        @('Pre-Conditions', 'An active administrator session exists.'),
        @('Post Conditions', 'Current summary counts and recent saved activity are displayed with a refresh time.')
    )

    for ($row = 1; $row -le 6; $row++) {
        Set-CellText $table.Cell($row, 1) $metadata[$row - 1][0] 9 $true 0 1
        Set-CellText $table.Cell($row, 2) $metadata[$row - 1][1] 9 $false 0 1
        $table.Rows.Item($row).AllowBreakAcrossPages = 0
    }

    Set-CellText $table.Cell(7, 1) 'Flow of Activities' 9 $true 0 1
    Set-CellText $table.Cell(7, 2) 'Actor(s)' 9 $true 1 1
    Set-CellText $table.Cell(7, 3) 'Application' 9 $true 1 1
    $table.Rows.Item(7).AllowBreakAcrossPages = 0

    $actorFlow = @(
        '1. Open Overview.',
        '4. Review the available summary cards and recent activity.',
        '5. Select an account, monitor, emergency, report, or security page.',
        '7. Return to Overview and request a refresh when needed.'
    ) -join "`r"

    $applicationFlow = @(
        '2. Load current account counts, access status, recent synchronization records, alerts, emergencies, and audit activity.',
        '3. Display the summary cards, recent activity, and refresh time. Show zero counts or empty states when a category has no records.',
        '6. Open the selected management page.',
        '8. Load and display the latest saved data and update the refresh time. If refresh fails, preserve the last displayed data and show an error.'
    ) -join "`r"

    Set-CellText $table.Cell(8, 1) '' 8.5 $false 0 0
    Set-CellText $table.Cell(8, 2) $actorFlow 8.5 $false 0 0
    Set-CellText $table.Cell(8, 3) $applicationFlow 8.5 $false 0 0
    $table.Rows.Item(8).AllowBreakAcrossPages = 0

    $document.Fields.Update() | Out-Null
    $document.Repaginate()
    $document.SaveAs2($resolvedOutput, 16)
    $document.ExportAsFixedFormat($resolvedPdf, 17)

    $pageCount = $document.ComputeStatistics(2)
    Write-Output "Created $resolvedOutput"
    Write-Output "QA PDF $resolvedPdf"
    Write-Output "Pages $pageCount"
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
