param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath,
    [Parameter(Mandatory = $true)]
    [string]$ReferenceImage,
    [Parameter(Mandatory = $true)]
    [string]$PdfPath
)

$ErrorActionPreference = 'Stop'

function New-UseCase {
    param(
        [string]$Id,
        [string]$Name,
        [string]$Actor,
        [string]$Purpose,
        [string]$Trigger,
        [string]$Preconditions,
        [string]$Postconditions,
        [string[]]$MainFlow,
        [string[]]$Alternates
    )
    [pscustomobject]@{
        Id = $Id
        Name = $Name
        Actor = $Actor
        Purpose = $Purpose
        Trigger = $Trigger
        Preconditions = $Preconditions
        Postconditions = $Postconditions
        MainFlow = $MainFlow
        Alternates = $Alternates
    }
}

$useCases = @(
    (New-UseCase 'UC 01' 'Authenticate Caregiver' 'Caregiver' `
        'Establish a protected caregiver session and route the caregiver to onboarding or the dashboard.' `
        'The caregiver opens ElderCareAI and selects Continue with Google.' `
        'The app has valid authentication configuration and the device can open the system sign-in browser.' `
        'A valid session is stored, the caregiver profile is synchronized, and the next authorized screen opens.' `
        @('Open ElderCareAI and select Continue with Google.', 'Select the Google account and approve the requested access.', 'Validate the callback and create the authenticated session.', 'Synchronize the caregiver profile and open the first incomplete onboarding step or the dashboard.') `
        @('If sign-in is canceled or fails, keep the caregiver signed out and show a retry message.', 'If the account cannot be authorized, do not open protected screens.')),

    (New-UseCase 'UC 02' 'Complete Onboarding' 'Caregiver' `
        'Collect the information and consent choices required to set up caregiving functions.' `
        'The app detects an authenticated caregiver with incomplete onboarding.' `
        'The caregiver has a valid session.' `
        'Completed steps are time-stamped and the caregiver enters the dashboard; optional tracker and location steps may be skipped.' `
        @('Review the introduction.', 'Enter caregiver information.', 'Enter the elderly person and emergency-contact details.', 'Connect or skip the health integration and choose whether to allow foreground phone location.', 'Save progress and open the dashboard.') `
        @('If required information is invalid, keep the form open and identify the fields to correct.', 'If an optional integration is skipped, record the choice and continue onboarding.')),

    (New-UseCase 'UC 03' 'View Dashboard' 'Caregiver' `
        'Show the latest saved health status, care-plan preview, synchronization state, and shortcuts.' `
        'The caregiver opens the Home screen or returns to the app.' `
        'Authentication and onboarding are complete; health readings may be unavailable.' `
        'The latest available care and health information is displayed without changing the underlying records.' `
        @('Open the dashboard or pull to refresh.', 'Load the elderly person profile, care plan, doctor contact, latest vitals, and sync metadata.', 'Show current values, measurement times, and explicit empty or disconnected states.', 'Open a selected health metric, care-plan item, doctor shortcut, or sync-location view.') `
        @('If no readings exist, show an empty state instead of a fabricated value.', 'If synchronization returns no new data, preserve the latest saved readings and report the result.')),

    (New-UseCase 'UC 04' 'Review Health Insights' 'Caregiver' `
        'Present non-diagnostic summaries that compare recent readings with the elderly person''s saved history.' `
        'The caregiver opens Health and selects Insights.' `
        'The caregiver is signed in; synchronized history may be partial.' `
        'Available summaries are displayed, or the app explains that more readings are required.' `
        @('Open Health and select Insights.', 'Load available synchronized vital history.', 'Compare the newest supported readings with recent personal averages when enough data exists.', 'Review the explanation, source, and safety caution for a selected metric.') `
        @('If the history is insufficient, show how many additional readings are needed.', 'If a metric is unavailable, show an explicit unavailable state.')),

    (New-UseCase 'UC 05' 'Analyze Health Trends' 'Caregiver' `
        'Show short-term statistical trends from distinct saved readings without presenting a diagnosis.' `
        'The caregiver opens Health and selects the trends or predictions view.' `
        'At least four distinct readings are required for a supported metric projection.' `
        'A trend with a sample-based confidence label is shown, or an insufficient-data message appears.' `
        @('Open the health trends view.', 'Build a time-ordered series from distinct synchronized readings.', 'Calculate the supported trend and confidence label.', 'Review the projected direction, sample size, source, and safety limitation.') `
        @('If fewer than four distinct readings exist, do not calculate a trend.', 'If the series is invalid or incomplete, preserve the saved data and show a clear limitation.')),

    (New-UseCase 'UC 06' 'Review Health Alerts' 'Caregiver' `
        'Let the caregiver review and update saved health alerts and related in-app notifications.' `
        'The caregiver opens Alerts or follows a notification route.' `
        'A caregiver session and an elderly-person profile exist.' `
        'Selected alerts or notifications are marked read, resolved, or cleared as permitted.' `
        @('Open the Alerts screen.', 'Load recent health alerts and saved caregiver notifications.', 'Review severity, message, event time, and current status.', 'Mark an alert read or resolved, or mark a notification read.', 'Clear selected notification records when desired.') `
        @('If no records exist, show an empty state.', 'Clearing a notification does not delete the underlying health alert or emergency record.')),

    (New-UseCase 'UC 07' 'Activate SOS Emergency' 'Caregiver' `
        'Record an emergency event and start the configured emergency-contact call after confirmation.' `
        'The caregiver presses SOS and confirms activation.' `
        'A caregiver session and elderly-person profile exist; automatic calling requires a valid emergency phone number.' `
        'The emergency event, critical alert, and in-app notification are saved; the dialer opens when a number is available.' `
        @('Press SOS and review the warning.', 'Confirm the emergency action.', 'Save the emergency event with the latest available vital snapshot.', 'Create a critical health alert and caregiver notification.', 'Open the phone dialer for the saved emergency contact.') `
        @('If the caregiver cancels, create no emergency records and start no call.', 'If no valid number exists, save the emergency records and explain that the call could not start.')),

    (New-UseCase 'UC 08' 'Consult Elle' 'Caregiver' `
        'Provide non-diagnostic care guidance informed by permitted saved care data.' `
        'The caregiver opens Elle, selects a quick topic, or enters a question.' `
        'The caregiver is signed in and the care-assistant service is available.' `
        'The question and response are saved in the active chat session, with optional links to relevant app functions.' `
        @('Open Elle and enter or select a question.', 'Create or reuse the active conversation.', 'Send the question with only the permitted saved-care context.', 'Display and save the response.', 'Follow an in-app action or start a new conversation when desired.') `
        @('If the service fails, show a safe retry message.', 'If a request seeks diagnosis or unsafe guidance, provide a safety-limited response and direct the caregiver to appropriate professional or emergency help.')),

    (New-UseCase 'UC 09' 'Manage User Profiles' 'Caregiver' `
        'Maintain caregiver, elderly-person, profile-photo, and doctor-contact information.' `
        'The caregiver opens Settings and selects a profile or doctor action.' `
        'Authentication and onboarding are complete.' `
        'Validated profile, photo, or doctor changes are saved and reflected in the app.' `
        @('Open Settings and select the profile to manage.', 'Edit caregiver or elderly-person information.', 'Optionally select a supported profile photo.', 'Add or update the doctor name, phone number, and photo.', 'Validate, save, and refresh the profile display.') `
        @('If a field is invalid, keep the entered data and show field-level feedback.', 'If an image upload fails, keep the existing photo.')),

    (New-UseCase 'UC 10' 'Manage Health Records' 'Caregiver' `
        'Maintain medical-history information and completed checkup records for the elderly person.' `
        'The caregiver opens Settings and selects Manage health records.' `
        'A caregiver session and elderly-person profile exist.' `
        'Validated medical history and completed checkups are saved and the current records reload.' `
        @('Open Manage health records.', 'Load the elderly-person profile and recent completed checkups.', 'Edit and save medical-history text.', 'Add a completed checkup dated today or earlier.', 'Review the refreshed health-record list.') `
        @('If the medical-history entry is invalid, retain the text and show correction guidance.', 'Reject a completed checkup date that is in the future.')),

    (New-UseCase 'UC 11' 'Manage Care Plans' 'Caregiver' `
        'Create and maintain medications, appointments, reminder settings, taken-dose logs, and caregiver notes.' `
        'The caregiver opens Care and selects a care-plan category.' `
        'A caregiver session and elderly-person profile exist; device permission is required for local reminders.' `
        'Validated care items are saved, reminders are scheduled when permitted, and the care plan reflects current status.' `
        @('Open Care and select Medications, Appointments, or Notes.', 'Add or edit the care-plan item.', 'Validate required fields, dates, and reminder settings.', 'Save the item and schedule a local reminder when permission is available.', 'Record a taken dose or update a note as applicable.') `
        @('If validation fails, keep the editor open and identify the correction.', 'If notification permission is unavailable, save the care item without a scheduled local notification.', 'Delete only the selected item after explicit confirmation.')),

    (New-UseCase 'UC 12' 'Export Care Reports' 'Caregiver' `
        'Generate a shareable PDF for saved health readings or active medication schedules.' `
        'The caregiver selects a report type under Data Management.' `
        'A caregiver session and elderly-person profile exist; the selected report requires at least one matching record.' `
        'A PDF containing the relevant details, timestamps, tables, summaries, and safety notes opens in the share sheet.' `
        @('Open Settings and select a care report.', 'Load the elderly-person profile and matching records.', 'Verify that reportable data exists.', 'Generate the organized PDF.', 'Open the platform share dialog.') `
        @('If no matching records exist, explain that the selected report cannot yet be generated.', 'If generation fails, keep the data unchanged and show a retry message.')),

    (New-UseCase 'UC 13' 'Configure App Settings' 'Caregiver' `
        'Manage integrations, permissions, appearance, and caregiver sign-out.' `
        'The caregiver opens Settings and selects a configuration action.' `
        'Authentication and onboarding are complete; the operating system may restrict permission changes.' `
        'The selected setting is updated, the relevant system settings page opens, or the caregiver is signed out.' `
        @('Open Settings.', 'Review health integration, notification, location, and theme status.', 'Connect or disconnect the health integration, or open device permission settings.', 'Change the theme preference.', 'Sign out when desired.') `
        @('If the operating system blocks an in-app permission change, open the appropriate device settings page.', 'If sign-out succeeds, clear the session and return to the sign-in screen.')),

    (New-UseCase 'UC 14' 'View Sync Location' 'Caregiver' `
        'Show the latest authorized foreground phone-location event saved during an eligible health synchronization.' `
        'The caregiver opens Last sync location.' `
        'Foreground phone-location consent is enabled and at least one eligible synchronization has saved a location.' `
        'The latest authorized event appears on the map, or the app explains why no location is available.' `
        @('Open Last sync location.', 'Load the newest saved synchronization-location record.', 'Render the location and event time on the map.', 'Review the location as synchronization context rather than continuous tracking.') `
        @('If consent is disabled or no eligible event exists, show an empty state.', 'A health synchronization may still complete when location cannot be recorded.')),

    (New-UseCase 'UC 15' 'Authenticate Admin' 'Administrator' `
        'Establish an administrator session for the separate web portal.' `
        'The administrator opens the portal and submits credentials.' `
        'A valid authentication account exists with an active administrator record.' `
        'The system overview opens for an active administrator; rejected access remains on the sign-in screen.' `
        @('Open the administrator portal.', 'Enter the administrator username or email and password.', 'Submit the credential form.', 'Authenticate the credentials and validate the administrator role and active status.', 'Open the system overview and keep the session in memory.') `
        @('If credentials are invalid, show a safe sign-in error.', 'If the account lacks an active administrator role, clear the rejected session and deny portal access.')),

    (New-UseCase 'UC 16' 'Recover Admin Password' 'Administrator' `
        'Let an administrator reset a forgotten password through an email verification flow.' `
        'The administrator selects Forgot password.' `
        'The administrator can access the configured email account.' `
        'A valid recovery session updates the password and returns the user to sign-in.' `
        @('Enter the administrator username or email and request recovery.', 'Open the newest recovery email and enter its verification code.', 'Validate the code and recovery session for the same email.', 'Enter and confirm a new password.', 'Update the password, clear recovery state, and return to sign-in.') `
        @('Invalid, expired, or rate-limited attempts keep the portal locked and show safe feedback.', 'If the password update fails, remain on the recovery screen.')),

    (New-UseCase 'UC 17' 'View System Overview' 'Administrator' `
        'Summarize saved system data, account status, recent activity, and items that need administrative review.' `
        'An authenticated administrator opens Overview.' `
        'An active administrator session exists.' `
        'Current summary counts and recent saved activity are displayed with a refresh time.' `
        @('Open Overview.', 'Load caregiver and elderly-person counts, access-status summaries, recent sync records, alerts, emergencies, and administrative activity.', 'Display the available summary cards and recent records.', 'Open the selected account, monitor, emergency, report, or security page.', 'Refresh the overview when needed.') `
        @('If a category has no records, show a zero count or empty state.', 'If refresh fails, preserve the last displayed data and show an error.')),

    (New-UseCase 'UC 18' 'Manage Accounts' 'Administrator' `
        'Review caregiver accounts, linked elderly people, supported profile fields, access status, and confirmed deletions.' `
        'The administrator opens Accounts.' `
        'An active administrator session exists.' `
        'Authorized edits, status changes, or confirmed deletions are applied and audited.' `
        @('Open Accounts and browse caregiver records.', 'Select a caregiver and view linked elderly-person details.', 'Edit supported profile fields when necessary.', 'Activate or suspend caregiver access.', 'Confirm permanent deletion by entering the required name.') `
        @('Reject unsupported or invalid profile changes.', 'If deletion confirmation does not match, leave the account and linked records unchanged.')),

    (New-UseCase 'UC 19' 'Monitor System Data' 'Administrator' `
        'Review reported tracker-connection state and recent saved health synchronization records.' `
        'The administrator opens System monitor or selects Refresh.' `
        'An active administrator session exists.' `
        'The latest available connection and synchronization records appear with an updated refresh time.' `
        @('Open System monitor.', 'Load reported paired-device state and recent vital writes.', 'Review source, measurement time, saved time, and state-change time.', 'Review recent related administrative activity.', 'Refresh the monitor view.') `
        @('If no records exist, show an explicit empty state.', 'Label reported connection information as saved state, not live device telemetry.')),

    (New-UseCase 'UC 20' 'Review Emergency Records' 'Administrator' `
        'Review saved emergency events and their related critical alerts and notification delivery status.' `
        'The administrator opens the emergency-records view or follows an overview activity link.' `
        'An active administrator session exists.' `
        'The latest emergency status, response details, related alerts, and event times are displayed.' `
        @('Open Emergency records.', 'Load recent emergency events and related critical alert data.', 'Review the elderly-person identifier, event time, responder, response time, and resolution status.', 'Open a related account or alert when additional context is needed.', 'Refresh the records.') `
        @('If no emergency records exist, show an empty state.', 'The portal presents saved records and does not claim live emergency-device monitoring.')),

    (New-UseCase 'UC 21' 'Export Admin Reports' 'Administrator' `
        'Export a formula-safe CSV for an authorized saved-data category and date range.' `
        'The administrator opens Reports and submits a report request.' `
        'An active administrator session exists; matching saved data may be available.' `
        'A CSV downloads when rows exist and the report action is recorded in administrative activity.' `
        @('Open Reports and select a report category.', 'Choose the From and To dates.', 'Validate the date range and configured row limit.', 'Retrieve the matching authorized records.', 'Escape spreadsheet-formula prefixes, create the CSV, download it, and record the action.') `
        @('Reject an invalid or excessive date range with a clear message.', 'If no matching rows exist, do not create an empty misleading report.')),

    (New-UseCase 'UC 22' 'Manage System Security' 'Administrator' `
        'Manage administrator access, caregiver access status, audit activity, and secure sign-out.' `
        'The administrator opens Security.' `
        'An active administrator session exists.' `
        'Authorized security changes are applied and audited; safeguards protect the current and final active administrator.' `
        @('Open Security.', 'Review administrators, caregiver access options, current-session details, and audit activity.', 'Invite an administrator by email.', 'Activate, suspend, or delete an eligible administrator, or change caregiver access.', 'Sign out when finished.') `
        @('Block deletion or suspension that would remove the current or final active administrator.', 'Record accepted security changes and explain rejected ones.')),

    (New-UseCase 'UC 23' 'Wear Tracker' 'Elderly Person' `
        'Use a compatible wearable tracker so it can collect supported health measurements for later synchronization.' `
        'The elderly person puts on and uses the configured tracker.' `
        'The tracker is charged, configured, and paired with the connected health service.' `
        'Supported measurements are collected and become available to the connected health service when the device synchronizes.' `
        @('Wear the tracker as instructed by the device manufacturer.', 'Allow the tracker to collect supported measurements during normal use.', 'Keep the tracker charged and within its normal synchronization conditions.', 'Allow the tracker or its companion service to upload available readings.') `
        @('If the tracker is off, unpaired, or out of power, no new measurements are available.', 'ElderCareAI does not directly control or continuously stream data from the tracker.')),

    (New-UseCase 'UC 24' 'View Vitals From Tracker' 'Elderly Person' `
        'View supported measurements on the wearable tracker or its paired device interface.' `
        'The elderly person checks the tracker for a current or recent measurement.' `
        'The tracker supports the selected vital and has a valid reading.' `
        'The measurement is displayed for personal awareness without changing ElderCareAI records.' `
        @('Wake the tracker display.', 'Open the supported health or vital tile.', 'Review the available measurement and its time or status.', 'Continue wearing the tracker so later readings can synchronize through the connected health service.') `
        @('If no valid measurement exists, the tracker shows its device-specific unavailable or retry state.', 'A tracker reading is not a diagnosis and does not replace professional medical assessment.'))
)

function Add-Paragraph {
    param(
        [object]$Document,
        [string]$Text,
        [string]$Style = 'Normal',
        [double]$Size = 11,
        [int]$Bold = 0,
        [int]$Alignment = 0,
        [double]$SpaceBefore = 0,
        [double]$SpaceAfter = 6
    )
    $paragraph = $Document.Content.Paragraphs.Add()
    $paragraph.Range.Text = $Text
    try { $paragraph.Style = $Style } catch { }
    $paragraph.Range.Font.Name = 'Times New Roman'
    $paragraph.Range.Font.Size = $Size
    $paragraph.Range.Font.Bold = $Bold
    $paragraph.Range.Font.Color = 0
    $paragraph.Format.Alignment = $Alignment
    $paragraph.Format.SpaceBefore = $SpaceBefore
    $paragraph.Format.SpaceAfter = $SpaceAfter
    $paragraph.Format.LineSpacingRule = 0
    $paragraph.Range.InsertParagraphAfter()
    return $paragraph
}

function Add-PageBreak {
    param([object]$Document)
    $range = $Document.Content
    $range.Collapse(0)
    $range.InsertBreak(7)
}

function Set-CellText {
    param(
        [object]$Cell,
        [string]$Text,
        [double]$Size = 10,
        [int]$Bold = 0,
        [int]$Color = 0,
        [int]$Alignment = 0
    )
    $Cell.Range.Text = $Text
    $Cell.Range.Font.Name = 'Times New Roman'
    $Cell.Range.Font.Size = $Size
    $Cell.Range.Font.Bold = $Bold
    $Cell.Range.Font.Color = $Color
    $Cell.Range.ParagraphFormat.Alignment = $Alignment
    $Cell.Range.ParagraphFormat.SpaceBefore = 0
    $Cell.Range.ParagraphFormat.SpaceAfter = 0
    $Cell.Range.ParagraphFormat.LineSpacingRule = 0
    $Cell.VerticalAlignment = 1
}

function Add-SummaryTable {
    param([object]$Document)
    $range = $Document.Content
    $range.Collapse(0)
    $table = $Document.Tables.Add($range, 4, 3)
    $table.AllowAutoFit = $false
    $table.Columns.Item(1).Width = 78
    $table.Columns.Item(2).Width = 42
    $table.Columns.Item(3).Width = 390
    $table.Borders.Enable = 1
    $table.TopPadding = 5
    $table.BottomPadding = 5
    $table.LeftPadding = 5
    $table.RightPadding = 5
    $table.Rows.Item(1).HeadingFormat = -1
    Set-CellText $table.Cell(1, 1) 'Actor' 10 -1 16777215 1
    Set-CellText $table.Cell(1, 2) 'Count' 10 -1 16777215 1
    Set-CellText $table.Cell(1, 3) 'Use Cases' 10 -1 16777215 1
    for ($column = 1; $column -le 3; $column++) {
        $table.Cell(1, $column).Shading.BackgroundPatternColor = 7884319
    }
    $caregiverNames = ($useCases | Where-Object Actor -eq 'Caregiver' | ForEach-Object Name) -join '; '
    $adminNames = ($useCases | Where-Object Actor -eq 'Administrator' | ForEach-Object Name) -join '; '
    $elderNames = ($useCases | Where-Object Actor -eq 'Elderly Person' | ForEach-Object Name) -join '; '
    Set-CellText $table.Cell(2, 1) 'Caregiver' 9.5 -1 0 0
    Set-CellText $table.Cell(2, 2) '14' 9.5 0 0 1
    Set-CellText $table.Cell(2, 3) $caregiverNames 9.5 0 0 0
    Set-CellText $table.Cell(3, 1) 'Administrator' 9.5 -1 0 0
    Set-CellText $table.Cell(3, 2) '8' 9.5 0 0 1
    Set-CellText $table.Cell(3, 3) $adminNames 9.5 0 0 0
    Set-CellText $table.Cell(4, 1) 'Elderly Person' 9.5 -1 0 0
    Set-CellText $table.Cell(4, 2) '2' 9.5 0 0 1
    Set-CellText $table.Cell(4, 3) $elderNames 9.5 0 0 0
    $table.Range.InsertParagraphAfter()
}

function Add-UseCaseTable {
    param(
        [object]$Document,
        [object]$UseCase,
        [int]$TableNumber
    )
    [void](Add-Paragraph $Document ("Table {0} {1} Specification" -f $TableNumber, $UseCase.Name) 'Normal' 9 0 1 0 4)
    $range = $Document.Content
    $range.Collapse(0)
    $table = $Document.Tables.Add($range, 9, 2)
    $table.AllowAutoFit = $false
    $table.Columns.Item(1).Width = 105
    $table.Columns.Item(2).Width = 405
    $table.Borders.Enable = 1
    $table.TopPadding = 4
    $table.BottomPadding = 4
    $table.LeftPadding = 5
    $table.RightPadding = 5
    $table.Rows.Item(1).HeadingFormat = -1
    Set-CellText $table.Cell(1, 1) 'Field' 10 -1 16777215 1
    Set-CellText $table.Cell(1, 2) 'Specification' 10 -1 16777215 1
    $table.Cell(1, 1).Shading.BackgroundPatternColor = 7884319
    $table.Cell(1, 2).Shading.BackgroundPatternColor = 7884319
    $fields = @(
        @('Use Case Name', $UseCase.Name),
        @('Primary Actor', $UseCase.Actor),
        @('Brief Description', $UseCase.Purpose),
        @('Trigger', $UseCase.Trigger),
        @('Preconditions', $UseCase.Preconditions),
        @('Postconditions', $UseCase.Postconditions),
        @('Main Flow', (($UseCase.MainFlow | ForEach-Object -Begin { $step = 0 } -Process { $step++; "$step. $_" }) -join "`r")),
        @('Alternate Flows', (($UseCase.Alternates | ForEach-Object -Begin { $alt = 0 } -Process { $alt++; "$alt. $_" }) -join "`r"))
    )
    for ($row = 2; $row -le 9; $row++) {
        Set-CellText $table.Cell($row, 1) $fields[$row - 2][0] 9.5 -1 0 0
        Set-CellText $table.Cell($row, 2) $fields[$row - 2][1] 9.5 0 0 0
        $table.Rows.Item($row).AllowBreakAcrossPages = 0
        if (($row % 2) -eq 1) {
            $table.Cell($row, 1).Shading.BackgroundPatternColor = 16447219
            $table.Cell($row, 2).Shading.BackgroundPatternColor = 16447219
        }
    }
    $table.Range.InsertParagraphAfter()
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
    $section.PageSetup.TopMargin = 50.4
    $section.PageSetup.BottomMargin = 50.4
    $section.PageSetup.LeftMargin = 50.4
    $section.PageSetup.RightMargin = 50.4

    $normal = $document.Styles.Item('Normal')
    $normal.Font.Name = 'Times New Roman'
    $normal.Font.Size = 11
    $normal.Font.Color = 0
    $normal.ParagraphFormat.SpaceAfter = 6
    $normal.ParagraphFormat.LineSpacingRule = 0

    foreach ($styleName in @('Title', 'Heading 1', 'Heading 2')) {
        $style = $document.Styles.Item($styleName)
        $style.Font.Name = 'Times New Roman'
        $style.Font.Color = 0
        $style.Font.Bold = -1
    }
    $document.Styles.Item('Title').Font.Size = 20
    $document.Styles.Item('Heading 1').Font.Size = 14
    $document.Styles.Item('Heading 2').Font.Size = 12

    $title = Add-Paragraph $document 'ElderCareAI Use Case Specifications' 'Title' 20 -1 1 12 10
    $title.Range.ParagraphFormat.Borders.Item(-3).LineStyle = 0
    [void](Add-Paragraph $document 'This document defines how the Caregiver, Elderly Person, and Administrator interact with ElderCareAI. The revised catalog follows the supplied use case diagram and standardizes the actor boundaries, use case names, and expected outcomes.' 'Normal' 11 0 0 0 8)
    [void](Add-Paragraph $document 'The catalog contains 24 use cases: 14 for the Caregiver, 8 for the Administrator, and 2 for the Elderly Person. Tracker readings reach ElderCareAI through the connected health service; the system does not claim direct, continuous tracker streaming or background location tracking.' 'Normal' 11 0 0 0 10)
    [void](Add-Paragraph $document 'Actor and Use Case Summary' 'Heading 1' 14 -1 0 8 6)
    Add-SummaryTable $document

    Add-PageBreak $document
    [void](Add-Paragraph $document 'System Use Case Diagram' 'Heading 1' 14 -1 0 0 8)
    [void](Add-Paragraph $document 'The diagram identifies the system boundary and the use cases available to each actor. The detailed specifications that follow use the same labels.' 'Normal' 11 0 0 0 8)
    $imageParagraph = $document.Content.Paragraphs.Add()
    $imageParagraph.Format.Alignment = 1
    $imageRange = $imageParagraph.Range
    $shape = $document.InlineShapes.AddPicture($ReferenceImage, $false, $true, $imageRange)
    $shape.LockAspectRatio = -1
    $shape.Width = 342
    $imageParagraph.Range.InsertParagraphAfter()
    [void](Add-Paragraph $document 'Figure 15 ElderCareAI Use Case Diagram' 'Normal' 9.5 0 1 4 0)

    Add-PageBreak $document
    [void](Add-Paragraph $document 'Use Case Specifications' 'Heading 1' 14 -1 0 0 4)
    [void](Add-Paragraph $document 'Each specification states the actor, purpose, trigger, conditions, main flow, and alternate outcomes for one use case in the diagram.' 'Normal' 10.5 0 0 0 8)

    $tableNumber = 4
    for ($index = 0; $index -lt $useCases.Count; $index++) {
        if ($index -gt 0) {
            Add-PageBreak $document
        }
        $useCase = $useCases[$index]
        [void](Add-Paragraph $document ("{0} {1}" -f $useCase.Id, $useCase.Name) 'Heading 2' 12 -1 0 0 6)
        Add-UseCaseTable $document $useCase $tableNumber
        $tableNumber++
    }

    Add-PageBreak $document
    [void](Add-Paragraph $document 'Storyboard' 'Heading 1' 14 -1 0 0 8)
    [void](Add-Paragraph $document 'The ElderCareAI flow begins when the caregiver authenticates and completes onboarding. The caregiver then uses the dashboard, health insights, trend analysis, alerts, SOS, Elle, profiles, health records, care plans, reports, settings, and the last authorized sync location. The administrator uses a separate portal to authenticate, recover access, review the system overview, manage accounts, monitor saved data, review emergency records, export reports, and manage security. The elderly person wears the configured tracker and can view supported measurements on the device. Available tracker readings synchronize through the connected health service before ElderCareAI stores and presents them.' 'Normal' 11 0 0 0 8)
    [void](Add-Paragraph $document 'Scope Note' 'Heading 1' 14 -1 0 8 6)
    [void](Add-Paragraph $document 'ElderCareAI does not directly pair to the tracker, continuously stream wearable readings, diagnose illness, locate the tracker, create geofences, or perform background GPS tracking. Caregiver location is optional foreground context saved only during eligible synchronization events. Health insights and trends provide decision support and safety cautions, not medical diagnosis.' 'Normal' 11 0 0 0 0)

    foreach ($currentSection in $document.Sections) {
        $footer = $currentSection.Footers.Item(1)
        $footer.Range.ParagraphFormat.Alignment = 2
        $footer.Range.Font.Name = 'Times New Roman'
        $footer.Range.Font.Size = 9
        $footer.Range.Text = 'Page '
        $footerRange = $footer.Range
        $footerRange.Collapse(0)
        [void]$footerRange.Fields.Add($footerRange, -1, 'PAGE', $true)
    }

    $document.Fields.Update() | Out-Null
    $document.Repaginate()
    $directory = Split-Path -Parent $OutputPath
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $document.SaveAs2($OutputPath, 16)
    $document.ExportAsFixedFormat($PdfPath, 17)
    $pageCount = $document.ComputeStatistics(2)
    Write-Output ("Created {0} with {1} pages" -f $OutputPath, $pageCount)
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
