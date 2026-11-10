param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,
    [Parameter(Mandatory = $true)]
    [string]$ReferenceImage,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [Parameter(Mandatory = $true)]
    [string]$PdfPath
)

$ErrorActionPreference = 'Stop'

function Get-CellText {
    param([object]$Cell)
    return $Cell.Range.Text.Trim([char]13, [char]7, [char]32)
}

function Set-CellText {
    param([object]$Cell, [string]$Text)
    $fontName = $Cell.Range.Font.Name
    $fontSize = $Cell.Range.Font.Size
    $bold = $Cell.Range.Font.Bold
    $alignment = $Cell.Range.ParagraphFormat.Alignment
    $Cell.Range.Text = $Text
    if ($fontName) { $Cell.Range.Font.Name = $fontName }
    if ($fontSize -gt 0) { $Cell.Range.Font.Size = $fontSize }
    $Cell.Range.Font.Bold = $bold
    $Cell.Range.ParagraphFormat.Alignment = $alignment
}

function Find-TextRange {
    param([object]$Document, [string]$Text)
    $range = $Document.Content.Duplicate
    $range.Find.ClearFormatting()
    $range.Find.Text = $Text
    $range.Find.Forward = $true
    $range.Find.Wrap = 0
    if ($range.Find.Execute()) { return $range }
    return $null
}

function Replace-AllText {
    param([object]$Document, [string]$OldText, [string]$NewText)
    $range = $Document.Content.Duplicate
    $range.Find.ClearFormatting()
    $range.Find.Replacement.ClearFormatting()
    $range.Find.Text = $OldText
    $range.Find.Replacement.Text = $NewText
    $range.Find.Forward = $true
    $range.Find.Wrap = 1
    $range.Find.Format = $false
    $range.Find.MatchCase = $true
    $range.Find.MatchWholeWord = $false
    [void]$range.Find.Execute($OldText, $true, $false, $false, $false, $false, $true, 1, $false, $NewText, 2)
}

function Get-TableByUseCaseName {
    param([object]$Document, [string]$Name)
    foreach ($table in $Document.Tables) {
        if ($table.Rows.Count -ge 1 -and $table.Columns.Count -ge 2) {
            try {
                if ((Get-CellText $table.Cell(1, 2)) -eq $Name) { return $table }
            }
            catch { }
        }
    }
    return $null
}

function Rename-UseCase {
    param([object]$Document, [string]$OldName, [string]$NewName)
    $table = Get-TableByUseCaseName $Document $OldName
    if ($null -eq $table) { throw "Could not locate use case table: $OldName" }
    Set-CellText $table.Cell(1, 2) $NewName
    return $table
}

function Rewrite-UseCaseTable {
    param(
        [object]$Table,
        [string]$Name,
        [string]$Actor,
        [string]$Description,
        [string]$Trigger,
        [string]$Preconditions,
        [string]$Postconditions,
        [string[]]$ActorSteps,
        [string[]]$ApplicationSteps
    )
    Set-CellText $Table.Cell(1, 2) $Name
    Set-CellText $Table.Cell(2, 2) $Actor
    Set-CellText $Table.Cell(3, 2) $Description
    Set-CellText $Table.Cell(4, 2) $Trigger
    Set-CellText $Table.Cell(5, 2) $Preconditions
    Set-CellText $Table.Cell(6, 2) $Postconditions
    Set-CellText $Table.Cell(8, 2) (($ActorSteps | ForEach-Object -Begin { $number = 0 } -Process { $number++; "$number. $_" }) -join "`r")
    Set-CellText $Table.Cell(8, 3) (($ApplicationSteps | ForEach-Object -Begin { $number = 0 } -Process { $number++; "$number. $_" }) -join "`r")
}

function Format-InsertedParagraph {
    param([object]$Paragraph, [int]$Bold, [int]$Alignment, [double]$Size, [double]$SpaceAfter)
    $Paragraph.Range.Font.Name = 'Times New Roman'
    $Paragraph.Range.Font.Size = $Size
    $Paragraph.Range.Font.Bold = $Bold
    $Paragraph.Range.Font.Color = 0
    $Paragraph.Format.Alignment = $Alignment
    $Paragraph.Format.SpaceAfter = $SpaceAfter
}

function New-SpecificationTable {
    param([object]$Document, [object]$Range)
    $table = $Document.Tables.Add($Range, 8, 3)
    for ($row = 6; $row -ge 1; $row--) {
        $currentRow = $table.Rows.Item($row)
        $currentRow.Cells.Item(2).Merge($currentRow.Cells.Item(3))
    }
    try { $table.Style = 'Table Grid' } catch { }
    $table.Borders.Enable = 1
    $table.AllowAutoFit = $false
    $table.Range.Font.Name = 'Times New Roman'
    $table.Range.Font.Size = 10
    $table.Range.ParagraphFormat.SpaceBefore = 0
    $table.Range.ParagraphFormat.SpaceAfter = 0
    $table.Range.ParagraphFormat.LineSpacingRule = 0
    $table.TopPadding = 2
    $table.BottomPadding = 2
    $table.LeftPadding = 3
    $table.RightPadding = 3
    $labels = @('Use Case Name', 'Actor', 'Brief Description', 'Trigger', 'Pre-Conditions', 'Post Conditions')
    for ($row = 1; $row -le 6; $row++) {
        Set-CellText $table.Cell($row, 1) $labels[$row - 1]
        $table.Cell($row, 1).Range.Font.Bold = -1
        $table.Cell($row, 1).Width = 90
        $table.Cell($row, 2).Width = 420
        $table.Rows.Item($row).AllowBreakAcrossPages = 0
    }
    Set-CellText $table.Cell(7, 1) 'Flow of Activities'
    Set-CellText $table.Cell(7, 2) 'Actor(s)'
    Set-CellText $table.Cell(7, 3) 'Application'
    $table.Rows.Item(7).Range.Font.Bold = -1
    $table.Cell(7, 1).Width = 90
    $table.Cell(7, 2).Width = 210
    $table.Cell(7, 3).Width = 210
    $table.Cell(8, 1).Width = 90
    $table.Cell(8, 2).Width = 210
    $table.Cell(8, 3).Width = 210
    $table.Rows.Item(7).AllowBreakAcrossPages = 0
    $table.Rows.Item(8).AllowBreakAcrossPages = 0
    return $table
}

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($SourcePath, $false, $false)

    # Complete the truncated opening sentence without changing its paragraph format.
    $intro = Find-TextRange $document 'This diagram shows how different entities interact within the ElderCareAI system.'
    if ($null -ne $intro) {
        $introParagraph = $intro.Paragraphs.Item(1)
        $introParagraph.Range.Text = "This diagram shows how the Caregiver, Elderly Person, and Administrator interact within the ElderCareAI system. It identifies each actor's responsibilities and the system functions available to them.`r"
    }

    # Restore the supplied overall use case diagram directly before its existing caption.
    $figure15 = Find-TextRange $document 'Figure 15: ElderCareAI Current Use Case Diagram'
    if ($null -eq $figure15) { throw 'Could not locate Figure 15 caption.' }
    $captionParagraph = $figure15.Paragraphs.Item(1)
    $captionParagraph.Range.InsertBefore("USE_CASE_IMAGE_PLACEHOLDER`r")
    $placeholder = Find-TextRange $document 'USE_CASE_IMAGE_PLACEHOLDER'
    if ($null -eq $placeholder) { throw 'Could not create diagram placeholder.' }
    $placeholder.Text = ''
    $placeholder.ParagraphFormat.Alignment = 1
    $shape = $document.InlineShapes.AddPicture($ReferenceImage, $false, $true, $placeholder)
    $shape.LockAspectRatio = -1
    $shape.Width = 320

    # Rename the direct matches while preserving every existing table's layout.
    $renameMap = [ordered]@{
        'Caregiver Google Sign In' = 'Authenticate Caregiver'
        'Admin Sign In' = 'Authenticate Admin'
        'Review Alerts and Reminders' = 'Review Health Alerts'
        'Review Health Trends' = 'Analyze Health Trends'
        'Chat with Elle' = 'Consult Elle'
        'Manage Profiles' = 'Manage User Profiles'
        'Generate Admin Reports' = 'Export Admin Reports'
        'Manage Security' = 'Manage System Security'
        'Manage Care Reminders' = 'Manage Care Plans'
        'Manage Caregiver Notes' = 'Manage Care Plans'
        'Review Admin Alerts' = 'Review Emergency Records'
    }
    foreach ($entry in $renameMap.GetEnumerator()) {
        [void](Rename-UseCase $document $entry.Key $entry.Value)
    }

    # Keep captions and table titles consistent with the diagram wording.
    $textReplacements = @(
        @('CAREGIVER GOOGLE SIGN IN', 'AUTHENTICATE CAREGIVER'),
        @('ADMIN SIGN IN', 'AUTHENTICATE ADMIN'),
        @('Review Alerts and Reminders', 'Review Health Alerts'),
        @('REVIEW ALERTS AND REMINDERS', 'REVIEW HEALTH ALERTS'),
        @('Review Health Trends', 'Analyze Health Trends'),
        @('REVIEW HEALTH TRENDS', 'ANALYZE HEALTH TRENDS'),
        @('Chat with Elle', 'Consult Elle'),
        @('CHAT WITH ELLE', 'CONSULT ELLE'),
        @('Manage Profiles', 'Manage User Profiles'),
        @('MANAGE PROFILES', 'MANAGE USER PROFILES'),
        @('Generate Admin Reports', 'Export Admin Reports'),
        @('GENERATE ADMIN REPORTS', 'EXPORT ADMIN REPORTS'),
        @('Manage Security', 'Manage System Security'),
        @('MANAGE SECURITY', 'MANAGE SYSTEM SECURITY'),
        @('Manage Care Reminders', 'Manage Care Plans'),
        @('MANAGE CARE REMINDERS', 'MANAGE CARE PLANS'),
        @('Manage Caregiver Notes', 'Manage Care Plans'),
        @('MANAGE CAREGIVER NOTES', 'MANAGE CARE PLANS'),
        @('Review Admin Alerts', 'Review Emergency Records'),
        @('REVIEW ADMIN ALERTS', 'REVIEW EMERGENCY RECORDS')
    )
    foreach ($entry in $textReplacements) {
        Replace-AllText $document $entry[0] $entry[1]
    }

    # Repurpose the closest existing integration tables for the two Elderly Person use cases.
    $wearTracker = Get-TableByUseCaseName $document 'Connect Google Health'
    if ($null -eq $wearTracker) { throw 'Could not locate Connect Google Health table.' }
    Rewrite-UseCaseTable $wearTracker 'Wear Tracker' 'Elderly Person' `
        'The elderly person wears a compatible tracker so it can collect supported health measurements for later synchronization.' `
        'The elderly person puts on and uses the configured tracker.' `
        'The tracker is charged, configured, and paired with the connected health service.' `
        'Supported measurements are collected and become available to the connected health service when the device synchronizes.' `
        @('Wear the tracker as instructed.', 'Keep the tracker charged and use it during normal daily activity.', 'Allow the tracker or companion service to synchronize available readings.') `
        @('Collect supported measurements.', 'Report the paired or disconnected state.', 'Make synchronized readings available to ElderCareAI through the connected health service.', 'If the tracker is off, unpaired, or out of power, return no new measurements.')

    $viewVitals = Get-TableByUseCaseName $document 'Sync Health Data'
    if ($null -eq $viewVitals) { throw 'Could not locate Sync Health Data table.' }
    Rewrite-UseCaseTable $viewVitals 'View Vitals From Tracker' 'Elderly Person' `
        'The elderly person views a supported current or recent measurement on the tracker or its paired device interface.' `
        'The elderly person checks the tracker for a vital reading.' `
        'The tracker supports the selected vital and has a valid reading.' `
        'The measurement is displayed for personal awareness without changing ElderCareAI records.' `
        @('Wake the tracker display.', 'Open the supported health or vital tile.', 'Review the measurement and its time or status.', 'Continue wearing the tracker so later readings can synchronize.') `
        @('Display the supported measurement.', 'If no valid reading exists, show the device-specific unavailable or retry state.', 'Treat the reading as informational and not as a medical diagnosis.')

    Replace-AllText $document 'Connect Google Health' 'Wear Tracker'
    Replace-AllText $document 'CONNECT GOOGLE HEALTH' 'WEAR TRACKER'
    Replace-AllText $document 'Sync Health Data' 'View Vitals From Tracker'
    Replace-AllText $document 'SYNC HEALTH DATA' 'VIEW VITALS FROM TRACKER'

    # Keep the additional analysis and notes figures, but align their table names to their parent diagram use cases.
    $analysisTable = Get-TableByUseCaseName $document 'Analyze Health Data'
    if ($null -ne $analysisTable) { Set-CellText $analysisTable.Cell(1, 2) 'Analyze Health Trends' }
    Replace-AllText $document 'Figure 32: Analyze Health Data' 'Figure 32: Analyze Health Trends Analysis Flow'
    Replace-AllText $document 'ANALYZE HEALTH DATA' 'ANALYZE HEALTH TRENDS'

    # Narrow caregiver alerts to the health-alert scope shown in the supplied diagram.
    $healthAlerts = Get-TableByUseCaseName $document 'Review Health Alerts'
    if ($null -ne $healthAlerts) {
        Rewrite-UseCaseTable $healthAlerts 'Review Health Alerts' 'Caregiver' `
            'The caregiver reviews saved health alerts and related in-app notifications, then updates the applicable status.' `
            'The caregiver opens Alerts or follows a notification route.' `
            'A caregiver session and elderly-person profile exist.' `
            'Selected alerts or notifications are marked read, resolved, or cleared as permitted.' `
            @('Open Alerts.', 'Choose a saved alert or notification.', 'Review its severity, message, time, and status.', 'Mark the item read or resolve the alert when appropriate.') `
            @('Load health alerts and caregiver notifications.', 'Save the selected status change.', 'If no records exist, show an empty state.', 'Clearing a notification does not delete the underlying health alert or emergency record.')
    }

    # Align the administrator emergency table with its specific diagram use case.
    $emergencyTable = Get-TableByUseCaseName $document 'Review Emergency Records'
    if ($null -ne $emergencyTable) {
        Rewrite-UseCaseTable $emergencyTable 'Review Emergency Records' 'Administrator' `
            'The administrator reviews saved emergency events and their related critical alerts and delivery status.' `
            'The administrator opens Emergency records or follows an overview activity link.' `
            'An active administrator session exists.' `
            'The latest emergency status, response details, related alerts, and event times are displayed.' `
            @('Open Emergency records.', 'Review the selected event, elderly-person identifier, event time, responder, response time, and resolution status.', 'Open related account or alert details when needed.', 'Refresh the records.') `
            @('Load recent emergency events and related critical alerts.', 'Display saved records in time order.', 'If no records exist, show an empty state.', 'Do not present saved records as live emergency-device monitoring.')
    }

    # Add the one diagram use case that has no dedicated table in the source document.
    $prefix = $document.Range($document.Content.End - 1, $document.Content.End - 1)
    $prefix.InsertBreak(7)
    $prefix = $document.Range($document.Content.End - 1, $document.Content.End - 1)
    $prefix.InsertAfter("View System Overview`rThe administrator reviews system summaries and recent activity before opening the relevant management page.`rTable 29`rVIEW SYSTEM OVERVIEW`r")
    $headingRange = Find-TextRange $document 'View System Overview'
    if ($null -ne $headingRange) {
        $headingParagraph = $headingRange.Paragraphs.Item(1)
        Format-InsertedParagraph $headingParagraph -1 1 11 4
        $headingParagraph.Format.PageBreakBefore = -1
    }
    $overviewDescription = Find-TextRange $document 'The administrator reviews system summaries and recent activity before opening the relevant management page.'
    if ($null -ne $overviewDescription) { Format-InsertedParagraph $overviewDescription.Paragraphs.Item(1) 0 0 11 4 }
    $tableNumber = Find-TextRange $document 'Table 29'
    if ($null -ne $tableNumber) { Format-InsertedParagraph $tableNumber.Paragraphs.Item(1) 0 0 11 0 }
    $overviewTitle = Find-TextRange $document 'VIEW SYSTEM OVERVIEW'
    if ($null -ne $overviewTitle) { Format-InsertedParagraph $overviewTitle.Paragraphs.Item(1) -1 1 11 0 }

    $overviewInsert = $document.Range($document.Content.End - 1, $document.Content.End - 1)
    $overviewTable = New-SpecificationTable $document $overviewInsert
    Rewrite-UseCaseTable $overviewTable 'View System Overview' 'Administrator' `
        'The administrator reviews current account, synchronization, alert, emergency, and administrative activity summaries.' `
        'An authenticated administrator opens Overview.' `
        'An active administrator session exists.' `
        'Current summary counts and recent saved activity are displayed with a refresh time.' `
        @('Open Overview.', 'Review the available summary cards and recent activity.', 'Open the selected account, monitor, emergency, report, or security page.', 'Refresh the overview when needed.') `
        @('Load current account counts, access status, recent synchronization records, alerts, emergencies, and audit activity.', 'Display zero counts or empty states when a category has no records.', 'If refresh fails, preserve the last displayed data and show an error.')

    # Update the overview description to reflect the restored image and the added table.
    $overviewText = Find-TextRange $document 'The overview shows the authenticated caregiver and administrator scopes'
    if ($null -ne $overviewText) {
        $overviewText.Paragraphs.Item(1).Range.Text = "The overview identifies the Caregiver, Elderly Person, and Administrator use cases. The existing detailed figures and formatted tables are retained, and the View System Overview table is added to complete the diagram's use case list.`r"
    }

    $document.Fields.Update() | Out-Null
    $document.Repaginate()
    $document.SaveAs2($OutputPath, 16)
    $document.ExportAsFixedFormat($PdfPath, 17)
    Write-Output ("Created {0} with {1} tables, {2} images, and {3} pages" -f $OutputPath, $document.Tables.Count, $document.InlineShapes.Count, $document.ComputeStatistics(2))
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
