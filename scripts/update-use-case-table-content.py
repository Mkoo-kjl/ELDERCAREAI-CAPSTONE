from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Pt


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "output" / "ElderCareAI_Use_Case_Current_Flow_Rechecked_Base.docx"
OUTPUT = ROOT / "output" / "ElderCareAI_Use_Case_Current_Flow_Rechecked.docx"


# The two sign-in tables intentionally follow the reference document's exact
# main-step/substep convention: step 5 is the application decision, followed
# by 5.1 and 5.2 outcomes.
SIGN_IN_FLOWS = {
    "Caregiver Google Sign In": (
        [
            "1. Open the app and select Continue with Google.",
            "3. Select the Google account.",
            "4. Approve the requested sign-in access.",
        ],
        [
            "2. Display the Google authentication page through the system browser.",
            "5. Validate the OAuth callback and create the Supabase session.",
            "    5.1. If authentication succeeds, synchronize the caregiver profile and open the first incomplete onboarding step or Home.",
            "    5.2. Else, keep the caregiver signed out and display a retry message.",
        ],
    ),
    "Admin Sign In": (
        [
            "1. Open the administrator portal.",
            "3. Enter the administrator username or email and password.",
            "4. Select the Log in button.",
        ],
        [
            "2. Display the administrator credential form without storing a session on disk.",
            "5. Authenticate the credentials and validate the active administrator role.",
            "    5.1. If the account is valid and active, open Overview and keep the session in memory.",
            "    5.2. Else, clear the rejected session and display the applicable access error.",
        ],
    ),
}


# Conditional outcomes are added beneath their existing parent application
# step. Tables without a decision keep their existing numbered flow unchanged.
SUBSTEPS = {
    "Review Alerts and Reminders": {
        "8.": [
            "    8.1. If the selected record is a saved notification, delete the requested notification row or rows.",
            "    8.2. Else, retain the health-alert and emergency-history records.",
        ],
    },
    "Complete Onboarding": {
        "4.": [
            "    4.1. If the caregiver information is valid, save the profile and continue.",
            "    4.2. Else, identify the fields that must be corrected.",
        ],
        "6.": [
            "    6.1. If the older-adult and emergency-contact details are valid, save them and continue.",
            "    6.2. Else, keep the form open and display validation feedback.",
        ],
    },
    "View Dashboard": {
        "4.": [
            "    4.1. If new Google Health readings are available, save them and refresh the visible values.",
            "    4.2. Else, preserve the latest saved values and show an explicit no-new-data or disconnected state.",
        ],
    },
    "Review Health Insights": {
        "4.": [
            "    4.1. If enough history exists, compare the newest reading with the recent personal average.",
            "    4.2. Else, display that more synchronized readings are required.",
        ],
    },
    "Review Health Trends": {
        "4.": [
            "    4.1. If at least four distinct readings exist, calculate the trend and confidence label.",
            "    4.2. Else, display the insufficient-data state.",
        ],
    },
    "Chat with Elle": {
        "4.": [
            "    4.1. If guidance is returned, display it and save both messages in the active session.",
            "    4.2. Else, show a safe retry message without presenting diagnostic advice.",
        ],
    },
    "Manage Health Records": {
        "4.": [
            "    4.1. If the medical-history entry is valid, save it to the older-adult profile.",
            "    4.2. Else, retain the entered text and display correction guidance.",
        ],
        "6.": [
            "    6.1. If the checkup date is today or earlier, save it as a completed appointment.",
            "    6.2. Else, reject the future completion date and keep the form open.",
        ],
    },
    "Manage Profiles": {
        "4.": [
            "    4.1. If the selected profile fields are valid, save and refresh the profile.",
            "    4.2. Else, display field-level validation feedback.",
        ],
        "6.": [
            "    6.1. If the selected image is supported, upload it and save its storage URL.",
            "    6.2. Else, keep the existing photo and display an upload error.",
        ],
    },
    "Manage Accounts": {
        "4.": [
            "    4.1. If the edited fields are supported and valid, save the profile changes.",
            "    4.2. Else, reject the unsupported or invalid changes.",
        ],
        "8.": [
            "    8.1. If the typed confirmation matches, delete the selected account and linked records.",
            "    8.2. Else, cancel deletion and leave the records unchanged.",
        ],
    },
    "Monitor System Data": {
        "2.": [
            "    2.1. If saved connection or sync records exist, display the newest records.",
            "    2.2. Else, display an explicit empty state rather than live-device telemetry.",
        ],
    },
    "Generate Admin Reports": {
        "4.": [
            "    4.1. If the date range is valid, retrieve up to the configured row limit.",
            "    4.2. Else, display the date-range validation error.",
        ],
        "6.": [
            "    6.1. If matching rows exist, create and download the formula-safe CSV and record the report event.",
            "    6.2. Else, show that no matching records are available.",
        ],
    },
    "Manage Security": {
        "6.": [
            "    6.1. If the requested change passes the current-administrator and final-administrator safeguards, apply and audit it.",
            "    6.2. Else, block the change and explain the safeguard.",
        ],
    },
    "Connect Google Health": {
        "4.": [
            "    4.1. If authorization succeeds, store the tokens in the protected server-side token table.",
            "    4.2. Else, record the skipped or disconnected state without blocking app use.",
        ],
        "6.": [
            "    6.1. If compatible paired devices are reported, save the count and connected state.",
            "    6.2. Else, save a zero-device or unavailable state.",
        ],
    },
    "Sync Health Data": {
        "4.": [
            "    4.1. If new readings are available, normalize them and preserve their measurement timestamps.",
            "    4.2. Else, report that no new readings were returned.",
        ],
        "6.": [
            "    6.1. If saving succeeds, publish the database changes and update the latest sync time.",
            "    6.2. Else, keep the prior data and display an actionable sync error.",
        ],
    },
    "Review Health Anomalies and Details": {
        "4.": [
            "    4.1. If enough saved history exists, evaluate personal-baseline deviation as well as fixed review thresholds.",
            "    4.2. Else, evaluate the available fixed thresholds and explain the history limitation.",
        ],
        "8.": [
            "    8.1. If Elle returns an observation, display it with the informational-only notice.",
            "    8.2. Else, keep the metric details available and show the safe insight-unavailable fallback.",
        ],
    },
    "Manage Care Reminders": {
        "2.": [
            "    2.1. If the required fields and dates are valid, allow the care item to be saved.",
            "    2.2. Else, keep the form open and display validation feedback.",
        ],
        "4.": [
            "    4.1. If notification permission is available, schedule the local reminder and store its identifier.",
            "    4.2. Else, save the care item without a scheduled notification.",
        ],
    },
    "View Sync Location": {
        "4.": [
            "    4.1. If foreground location permission and eligible-sync conditions are met, save one phone-location event.",
            "    4.2. Else, complete the sync without saving a location.",
        ],
        "6.": [
            "    6.1. If a saved location exists, render the newest event on the map.",
            "    6.2. Else, display the no-location-available state.",
        ],
    },
    "Activate SOS Emergency": {
        "2.": [
            "    2.1. If the caregiver confirms, continue with the emergency workflow.",
            "    2.2. Else, cancel without creating records or starting a call.",
        ],
        "6.": [
            "    6.1. If a valid emergency phone exists, open the phone dialer after saving the emergency records.",
            "    6.2. Else, save the emergency records and show that no call could be started.",
        ],
    },
    "Manage Caregiver Notes": {
        "4.": [
            "    4.1. If the note contains non-empty content, insert or update it.",
            "    4.2. Else, reject the save and keep the note editor open.",
        ],
        "8.": [
            "    8.1. If deletion is confirmed, delete only the selected note and refresh the list.",
            "    8.2. Else, leave the note unchanged.",
        ],
    },
    "Export Care Reports": {
        "2.": [
            "    2.1. If matching health or medication records exist, enable report generation.",
            "    2.2. Else, explain that the selected report has no records to export.",
        ],
    },
    "Configure App Settings": {
        "4.": [
            "    4.1. If the requested integration or permission action is available, run it or open the required system settings page.",
            "    4.2. Else, keep the current setting and display its unavailable or restricted status.",
        ],
    },
    "Review Admin Alerts": {
        "4.": [
            "    4.1. If records exist, display them in their respective tables.",
            "    4.2. Else, show the explicit empty state for that category.",
        ],
    },
    "Recover Admin Password": {
        "4.": [
            "    4.1. If the newest code and recovery session are valid, allow the administrator to set a new password.",
            "    4.2. Else, show invalid, expired, or rate-limited feedback and keep the portal locked.",
        ],
        "6.": [
            "    6.1. If the password update succeeds, clear the recovery session and return to sign in.",
            "    6.2. Else, retain the recovery screen and display the update error.",
        ],
    },
}


def existing_lines(cell):
    return [paragraph.text.strip() for paragraph in cell.paragraphs if paragraph.text.strip()]


def with_substeps(lines, additions):
    output = []
    for line in lines:
        output.append(line)
        prefix = line.split(maxsplit=1)[0] if line else ""
        output.extend(additions.get(prefix, ()))
    return output


def write_flow_cell(cell, lines):
    cell.text = ""
    for index, line in enumerate(lines):
        paragraph = cell.paragraphs[0] if index == 0 else cell.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
        paragraph.paragraph_format.space_before = Pt(0)
        paragraph.paragraph_format.space_after = Pt(1)
        paragraph.paragraph_format.line_spacing = 1.0
        run = paragraph.add_run(line)
        run.font.name = "Arial"
        run.font.size = Pt(9.0)
        fonts = run._element.get_or_add_rPr().get_or_add_rFonts()
        fonts.set(qn("w:ascii"), "Arial")
        fonts.set(qn("w:hAnsi"), "Arial")
    cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP


def main():
    document = Document(SOURCE)
    updated = []
    for table in document.tables:
        title = table.cell(0, 1).text.strip()
        actor_cell = table.cell(7, 1)
        app_cell = table.cell(7, 2)
        if title in SIGN_IN_FLOWS:
            actor_lines, app_lines = SIGN_IN_FLOWS[title]
            write_flow_cell(actor_cell, actor_lines)
            write_flow_cell(app_cell, app_lines)
            updated.append(title)
            continue
        additions = SUBSTEPS.get(title)
        if additions:
            write_flow_cell(actor_cell, existing_lines(actor_cell))
            write_flow_cell(app_cell, with_substeps(existing_lines(app_cell), additions))
            updated.append(title)
    document.save(OUTPUT)
    print(f"Updated {len(updated)} tables")
    print(OUTPUT)


if __name__ == "__main__":
    main()
