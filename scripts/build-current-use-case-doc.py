from __future__ import annotations

import math
import os
import textwrap
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "ElderCareAI_Use_Case_Current_Flow_Rechecked_Base.docx"
QA_DIR = ROOT / "output" / "use_case_recheck"
ASSET_DIR = QA_DIR / "assets"

NAVY = "173B4F"
BLUE = "2D607A"
TEAL = "2B8A78"
LIGHT_TEAL = "EEF8F6"
LIGHT_BLUE = "EDF4FB"
LIGHT_AMBER = "FFF7E8"
AMBER = "B57720"
GRID = "000000"
PALE_BLUE = "F3F8FB"


@dataclass(frozen=True)
class UseCase:
    number: int
    title: str
    actors: tuple[str, ...]
    description: str
    trigger: str
    preconditions: str
    postconditions: str
    nodes: tuple[str, ...]
    activities: tuple[tuple[str, str], ...]
    branches: tuple[tuple[int, int, str], ...] = ()
    right_actor_target: int | None = None


CASES = (
    UseCase(16, "Caregiver Google Sign In", ("Caregiver",),
        "The caregiver authenticates with Google through Supabase and is routed to the first unfinished setup step or the protected Home screen.",
        "The caregiver opens ElderCareAI and selects Continue with Google.",
        "The app has valid Supabase configuration and the device can open the system authentication browser.",
        "A persisted Supabase session exists, the caregiver profile is synchronized, and the app opens setup or Home.",
        ("Open App", "Select Google", "Authorize Account", "Open Setup or Home", "Review Sign In Error"),
        (("1. Open the app and select Continue with Google.", "2. Start Google OAuth with PKCE in the system browser."),
         ("3. Select and authorize a Google account.", "4. Exchange the callback code for a persisted Supabase session."),
         ("5. Continue after authentication.", "6. Route to the first incomplete onboarding step or Home."),
         ("7. Review any sign-in error and retry.", "8. Keep the user signed out when authorization fails.")),
        ((2, 4, "failure"),)),
    UseCase(17, "Admin Sign In", ("Administrator",),
        "An administrator signs in to the separate web portal, where the server verifies the session, administrator role, and active status.",
        "The administrator opens the admin portal and submits credentials.",
        "A separate Supabase Auth account exists and has an active admin record in user_access.",
        "The Overview opens for an active administrator; rejected access remains on the sign-in screen with an error.",
        ("Open Admin Portal", "Enter Credentials", "Verify Admin Access", "Open Overview", "Review Access Error"),
        (("1. Open the administrator portal.", "2. Display the credential form without storing a session on disk."),
         ("3. Enter the admin username or email and password.", "4. Authenticate with Supabase Auth and validate the active admin role."),
         ("5. Continue after successful verification.", "6. Open Overview and record the authenticated session in memory."),
         ("7. Review an invalid-credential or access error.", "8. Clear the rejected session and keep the portal locked.")),
        ((2, 4, "failure"),)),
    UseCase(18, "Complete Onboarding", ("Caregiver",),
        "A newly authenticated caregiver completes the introduction, caregiver profile, older-adult profile, Google Health step, and optional phone-location consent.",
        "The app detects that onboarding_progress is incomplete.",
        "The caregiver has a valid Supabase session.",
        "Each completed step is timestamped and the caregiver enters Home; wearable and location steps may be skipped.",
        ("Review Introduction", "Save Caregiver Profile", "Save Older Adult Profile", "Connect or Skip Google Health", "Allow or Skip Location", "Open Home"),
        (("1. Review or skip the introduction.", "2. Save intro completion in onboarding_progress."),
         ("3. Enter caregiver information.", "4. Validate and save the caregiver profile."),
         ("5. Enter older-adult and emergency-contact details.", "6. Validate and save the older-adult profile."),
         ("7. Connect Google Health or skip the wearable step.", "8. Store the connection state and paired-device count when available."),
         ("9. Allow foreground phone location or continue without it.", "10. Save the choice, complete onboarding, and open Home."))),
    UseCase(19, "View Dashboard", ("Caregiver",),
        "The caregiver reviews the latest synchronized readings, measurement times, care-plan preview, doctor shortcut, tracker sync status, and last saved sync location.",
        "The caregiver opens Home or returns to the foreground.",
        "Authentication and onboarding are complete; empty states are allowed when no readings exist.",
        "The latest available care and health status is displayed, with optional navigation to details, Care, doctor calling, or the location map.",
        ("Open Home", "Reconcile Health Data", "Review Vital Cards", "Open Vital Details", "Open Care or Location"),
        (("1. Open Home or pull to refresh.", "2. Load profile, care-plan, doctor, latest vital, and sync metadata."),
         ("3. Request Sync now when needed.", "4. Reconcile Google Health and update the visible sync result."),
         ("5. Review vital cards and measured times.", "6. Show current values or explicit empty/disconnected states."),
         ("7. Open a metric, Care preview, doctor shortcut, or location.", "8. Navigate to the selected detail without changing the underlying record."))),
    UseCase(20, "Review Alerts and Reminders", ("Caregiver",),
        "The caregiver reviews health alerts, saved notifications, and emergency history, then marks, resolves, or clears the applicable records.",
        "The caregiver opens the Alerts tab or follows a notification route.",
        "A caregiver session and older-adult profile exist.",
        "Selected alerts or notifications are marked, resolved, or cleared while emergency history remains available unless explicitly resolved.",
        ("Open Alerts", "Review Health Alerts", "Review Notifications", "Mark or Resolve", "Clear Notifications", "Review Emergency History"),
        (("1. Open Alerts and choose Alerts, Notifications, or Emergency.", "2. Load health_alerts, caregiver_notifications, and emergency_events."),
         ("3. Review the selected record.", "4. Display severity, message, delivery/read state, and event time."),
         ("5. Mark an alert read or resolved, or mark a notification read.", "6. Save the selected state change."),
         ("7. Clear one or all saved notifications when desired.", "8. Delete only notification rows; retain health alerts and emergency history."))),
    UseCase(21, "Review Health Insights", ("Caregiver",),
        "The caregiver reviews data-driven summaries that compare the newest synchronized readings with recent personal averages and explicit review thresholds.",
        "The caregiver opens Health and selects AI Insights.",
        "The caregiver is signed in; synchronized history may be empty or partial.",
        "The app displays available metric summaries or a clear message that more readings are needed.",
        ("Open Health", "Select AI Insights", "Compare Recent Baselines", "Review Metric Summaries", "Open Vital Details"),
        (("1. Open Health and select AI Insights.", "2. Load the available synchronized vital history."),
         ("3. Review heart rate, SpO2, sleep, steps, skin temperature, or HRV summaries.", "4. Compare the newest values with recent personal averages when enough data exists."),
         ("5. Open a related metric.", "6. Show its latest value, recent values, source explanation, and caution."))),
    UseCase(22, "Review Health Trends", ("Caregiver",),
        "The caregiver reviews short-term statistical trend projections calculated from distinct synchronized readings, including the sample-based confidence label.",
        "The caregiver opens Health and selects Predictions.",
        "At least four distinct readings are needed for a metric projection; otherwise the waiting state is shown.",
        "A non-diagnostic trend or an explicit insufficient-data message is displayed.",
        ("Open Health", "Select Predictions", "Check Sample Count", "Review Trend and Confidence", "Collect More Data"),
        (("1. Open Health and select Predictions.", "2. Build metric series from synchronized history."),
         ("3. Review a supported trend.", "4. Apply simple linear regression and label confidence from sample count and fit."),
         ("5. Continue collecting readings when a projection is unavailable.", "6. Explain that at least four distinct readings per metric are required.")),
        ((2, 4, "limited data"),)),
    UseCase(23, "Chat with Elle", ("Caregiver",),
        "The caregiver asks Elle a care-related question and receives non-diagnostic guidance informed by available saved care data.",
        "The caregiver opens Elle, selects a quick topic, or enters a question.",
        "The caregiver is signed in and the ai-care-assistant function is deployed with its Gemini key.",
        "The conversation is saved in the active chat session and the caregiver may follow a suggested in-app action or start a new chat.",
        ("Open Elle", "Enter Question", "Send Question", "Review Guidance", "Follow Action or Start New Chat"),
        (("1. Open Elle and enter or select a question.", "2. Create or reuse an active chatbot session."),
         ("3. Send the question.", "4. Call the care assistant with the permitted saved-care context."),
         ("5. Review the response and optional action links.", "6. Save both messages and keep the response within non-diagnostic safety limits."),
         ("7. Start a new chat when desired.", "8. Close the prior active session and clear the visible conversation."))),
    UseCase(24, "Manage Health Records", ("Caregiver",),
        "The caregiver maintains medical-history text and completed checkup records while reviewing the current active medication schedules.",
        "The caregiver opens Settings and selects Manage health records.",
        "A caregiver session and older-adult profile exist.",
        "Validated history and checkup entries are saved and the current records reload.",
        ("Open Health Records", "Update Medical History", "Add Completed Checkup", "Review Active Medications", "Save Records"),
        (("1. Open Manage health records.", "2. Load the older-adult profile, recent completed checkups, and active medications."),
         ("3. Edit medical-history text.", "4. Validate and save the updated older-adult medical history."),
         ("5. Add a completed checkup dated today or earlier.", "6. Save the checkup as a completed appointment record."),
         ("7. Review active medications.", "8. Display medication details managed from the Care tab."))),
    UseCase(25, "Manage Profiles", ("Caregiver",),
        "The caregiver edits caregiver and older-adult information, uploads profile photos, and adds or updates the saved doctor contact.",
        "The caregiver opens Settings and selects a profile or doctor action.",
        "Authentication and onboarding are complete.",
        "Validated profile, photo, or doctor changes are saved and reflected in the app.",
        ("Open Settings", "Edit Caregiver Profile", "Edit Older Adult Profile", "Upload Profile Photos", "Save Doctor Contact", "Confirm Changes"),
        (("1. Open Settings.", "2. Load caregiver, older-adult, photo, and doctor details."),
         ("3. Edit caregiver or older-adult information.", "4. Validate and save the selected profile."),
         ("5. Select a caregiver or older-adult photo.", "6. Upload the image and save its storage URL."),
         ("7. Add or edit the doctor name, phone, and photo.", "8. Validate the phone, save the contact, and refresh the display."))),
    UseCase(26, "Manage Accounts", ("Administrator",),
        "The administrator pages through caregiver accounts, views linked older adults, edits allowed profile fields, changes caregiver access status, or permanently deletes confirmed records.",
        "The administrator opens Accounts.",
        "An active administrator session exists.",
        "Authorized edits, status changes, or confirmed deletions are applied and audited.",
        ("Open Accounts", "Select Caregiver", "View Linked Older Adults", "Edit Profile", "Activate or Suspend", "Confirm Deletion"),
        (("1. Open Accounts and page through caregivers.", "2. Return caregiver profiles, access status, and linked older-adult counts."),
         ("3. Select a caregiver and optionally edit a caregiver or older-adult profile.", "4. Validate and save only the supported profile fields."),
         ("5. Activate or suspend caregiver access.", "6. Update user_access and record the administrative action."),
         ("7. Type the required name to confirm permanent deletion.", "8. Delete the selected profile/account and linked records through the secured admin service."))),
    UseCase(27, "Monitor System Data", ("Administrator",),
        "The administrator reviews onboarding-reported device connection state and recent saved health sync records, including measured time, saved time, and source.",
        "The administrator opens System monitor or selects Refresh.",
        "An active administrator session exists.",
        "The latest available connection and sync records are displayed with an updated timestamp.",
        ("Open System Monitor", "Review Device States", "Review Recent Syncs", "Compare Measured and Saved Times", "Refresh Data"),
        (("1. Open System monitor.", "2. Load connection states reported during onboarding and recent vital writes."),
         ("3. Review paired-device count and state-change time.", "4. Label this as connection state, not live device telemetry."),
         ("5. Review sync source, measured time, and saved time.", "6. Show the newest records and recent admin activity."),
         ("7. Select Refresh.", "8. Reload the current monitor view and update the displayed refresh time."))),
    UseCase(28, "Generate Admin Reports", ("Administrator",),
        "The administrator exports a CSV for a selected saved-data category and date range, subject to the portal's 90-day and 2,000-row limits.",
        "The administrator opens Reports and submits a report request.",
        "An active administrator session exists and matching saved data may be available.",
        "A formula-safe CSV downloads when rows exist and the report action is recorded in administrative activity.",
        ("Open Reports", "Select Report Type", "Select Date Range", "Generate Report", "Download CSV", "Review Audit Activity"),
        (("1. Open Reports and select a report type.", "2. Offer health readings, alerts, appointments, medications, medical history, or admin activity."),
         ("3. Choose From and To dates, then generate.", "4. Validate the date range and retrieve no more than the configured limit."),
         ("5. Download the CSV when data exists.", "6. Escape spreadsheet-formula prefixes, create the file, and record the report event."))),
    UseCase(29, "Manage Security", ("Administrator",),
        "The administrator invites administrators, changes administrator or caregiver access, deletes non-current administrators, reviews audit activity, and signs out.",
        "The administrator opens Security.",
        "An active administrator session exists.",
        "Authorized security changes are applied and audited; safeguards prevent removal of the final active administrator.",
        ("Open Security", "Invite Administrator", "Change Access Status", "Delete Eligible Administrator", "Review Audit Activity", "Sign Out"),
        (("1. Open Security.", "2. Load administrators, caregiver status options, current session details, and recent audit rows."),
         ("3. Invite an administrator by email.", "4. Create the invitation and show its delivery result."),
         ("5. Activate, suspend, or delete an eligible administrator; or change caregiver access.", "6. Enforce current/final-admin safeguards and record accepted changes."),
         ("7. Review activity or sign out.", "8. Clear the in-memory session and return to the locked portal."))),
    UseCase(30, "Connect Google Health", ("Caregiver", "Google Health"),
        "The caregiver authorizes Google Health API v4, and Google Health reports compatible paired devices without ElderCareAI directly pairing to a tracker.",
        "The caregiver opens the integration step in onboarding or Settings.",
        "The caregiver has a Google Health account; any tracker to be used is already paired through Google Health.",
        "The authorization and paired-device count are saved, or the app records a skipped/disconnected state without blocking use.",
        ("Open Google Health Integration", "Authorize Health Access", "Select Google Account", "Check Paired Devices", "Confirm Connected or Skipped"),
        (("1. Open the Google Health integration.", "2. Start the server-side OAuth flow with the required read-only scopes."),
         ("3. Select and authorize the Google Health account.", "4. Store tokens only in the protected server-side token table."),
         ("5. Allow Google Health to return its paired-device list.", "6. Read the available paired-device count and connection status."),
         ("7. Confirm the result or skip.", "8. Save onboarding status and continue without inventing a direct Bluetooth connection.")),
        right_actor_target=3),
    UseCase(31, "Sync Health Data", ("Caregiver", "Google Health"),
        "ElderCareAI reconciles available Google Health readings after manual requests, app startup or foreground events, due checks while the app is active, or supported webhook notifications, then updates the caregiver view through Realtime.",
        "A manual Sync now request, app startup or foreground event, due active-app check, or supported Google Health webhook occurs.",
        "Google Health is authorized; a paired tracker must first upload a reading to Google Health for new data to exist.",
        "Available readings are time-stamped and stored, the UI receives updates, and sync time or an actionable error is shown.",
        ("Start Manual or Automatic Sync", "Request Google Health Data", "Save Available Readings", "Update Dashboard in Realtime", "Review Sync Time or Error"),
        (("1. Request Sync now or allow a startup, foreground, timed, or webhook reconciliation trigger.", "2. Call the authenticated server sync path; active-app checks occur when saved data is stale rather than streaming directly from the watch."),
         ("3. Provide readings already uploaded by the tracker.", "4. Normalize available metrics and preserve measurement timestamps."),
         ("5. Review the updated dashboard.", "6. Upsert vital logs, publish database changes, and show the latest sync or error state.")),
        right_actor_target=1),
    UseCase(32, "Review Health Anomalies and Details", ("Caregiver",),
        "The caregiver reviews threshold and personal-baseline anomaly checks, opens metric details, and may receive a concise Elle insight for a recorded value.",
        "The caregiver selects Anomalies or opens a vital card in Health or Home.",
        "A caregiver session exists; synchronized history may be empty or partial.",
        "The app displays anomaly or no-anomaly results, metric history and safety context, and an optional non-diagnostic Elle insight.",
        ("Open Health or a Vital Card", "Load Saved Vital History", "Review Anomaly Checks", "Open Metric Details", "Request Elle Insight", "Review Safety Context"),
        (("1. Open Anomalies or select a vital card.", "2. Load recent vital_sign_logs visible under caregiver access rules."),
         ("3. Review threshold and personal-baseline checks.", "4. Apply configured limits and deviation checks when enough history exists."),
         ("5. Open metric details.", "6. Show the latest value, recent history, data source, and metric-specific caution."),
         ("7. Review the Elle insight when available.", "8. Request a concise saved-data-based observation and show a safe fallback if it is unavailable."))),
    UseCase(33, "Manage Care Reminders", ("Caregiver",),
        "The caregiver creates or edits medication and appointment schedules, the device schedules local reminders when permission is available, and the caregiver records a dose after confirming it was taken.",
        "The caregiver opens Care and selects Medications or Appointments.",
        "A caregiver session and older-adult profile exist; device notification permission is required for scheduled reminders.",
        "The care item is saved, on-device notification identifiers are stored when scheduled, and confirmed doses are recorded in medication_logs.",
        ("Open Care", "Save Medication or Appointment", "Schedule Device Reminder", "Record Confirmed Dose", "Review Status"),
        (("1. Open Care and add or edit a medication or future appointment.", "2. Validate required fields, reminder time, and future appointment date."),
         ("3. Save the care item.", "4. Store the schedule and request local notifications when applicable."),
         ("5. Confirm that the older adult took the medication, then record the dose.", "6. Insert a taken medication log and recalculate today's due/taken status."),
         ("7. Review reminder or permission feedback.", "8. Keep the care item saved even if notification permission is not granted."))),
    UseCase(34, "View Sync Location", ("Caregiver",),
        "With optional foreground permission, a successful app-initiated health sync may save the caregiver phone's location for later map viewing.",
        "The caregiver opens Last sync location or completes a successful eligible sync.",
        "Foreground phone-location consent is enabled and an eligible health sync succeeds; otherwise an empty state is valid.",
        "The newest authorized phone-location event is shown on an OpenStreetMap-backed map, or the app explains why no location is available.",
        ("Allow Foreground Phone Location", "Complete Eligible Health Sync", "Open Last Sync Location", "Load Newest Saved Event", "View Map or Empty State"),
        (("1. Allow foreground phone location or leave it disabled.", "2. Store the caregiver's consent choice without requesting background tracking."),
         ("3. Complete an eligible successful sync while the app is open.", "4. Save one phone-location event when permission and sync conditions are met."),
         ("5. Open Last sync location.", "6. Load the newest wearable_sync_locations row and render it with Leaflet, or show an empty state."))),
    UseCase(35, "Activate SOS Emergency", ("Caregiver",),
        "The caregiver confirms SOS, after which the app logs an emergency event, creates a critical health alert and in-app notification, and calls the saved emergency contact when a number exists.",
        "The caregiver presses SOS on the Alerts screen and confirms activation.",
        "A caregiver session and older-adult profile exist; a saved emergency phone is needed for automatic calling.",
        "The emergency, alert, and notification are saved; the phone dialer opens when a valid emergency contact number is available.",
        ("Press SOS", "Confirm Activation", "Log Emergency and Vital Snapshot", "Create Critical Alert", "Call Emergency Contact", "Resolve Emergency Later"),
        (("1. Press SOS and review the confirmation warning.", "2. Require explicit confirmation because SOS creates records and starts a call."),
         ("3. Confirm activation.", "4. Vibrate/play the alert sound and save emergency_events with the latest available vital snapshot."),
         ("5. Continue the emergency action.", "6. Create a critical health alert and in-app notification, then open the phone dialer for the saved contact."),
         ("7. Mark the event resolved later when appropriate.", "8. Save responder and response time while keeping emergency history."))),
    UseCase(36, "Manage Caregiver Notes", ("Caregiver",),
        "The caregiver creates, edits, pins, unpins, and deletes care notes associated with the older adult.",
        "The caregiver opens Care and selects Notes.",
        "A caregiver session and older-adult profile exist.",
        "The note list reflects the saved content and pin state, or removes a note after confirmed deletion.",
        ("Open Care Notes", "Add or Edit Note", "Save Note", "Pin or Unpin Note", "Confirm Note Deletion"),
        (("1. Open Care and select Notes.", "2. Load notes for the current older-adult profile."),
         ("3. Add note content or edit an existing note.", "4. Validate non-empty content and insert or update caregiver_notes."),
         ("5. Pin or unpin a note.", "6. Save is_pinned and refresh ordering."),
         ("7. Confirm deletion when needed.", "8. Delete only the selected note and refresh the list."))),
    UseCase(37, "Export Care Reports", ("Caregiver",),
        "The caregiver generates a branded, shareable PDF for synchronized health readings or saved medication schedules, including active and inactive status, from Settings.",
        "The caregiver selects Health vitals PDF or Medication schedule PDF under Data Management.",
        "A caregiver session and older-adult profile exist; the selected report needs at least one matching health or medication record.",
        "The app generates a PDF with patient and caregiver details, tables, timestamps, summaries, and safety notes, then opens the share sheet.",
        ("Open Data Management", "Choose Health or Medication Report", "Load Report Records", "Generate PDF", "Share Report"),
        (("1. Open Settings and select a report type.", "2. Verify the older-adult profile and load the matching records."),
         ("3. Continue when records exist.", "4. Build a branded report with organized tables, summary details, and safety notes."),
         ("5. Share the report.", "6. Print HTML to PDF and open the platform share dialog."))),
    UseCase(38, "Configure App Settings", ("Caregiver",),
        "The caregiver manages Google Health connection, notification permission, foreground phone-location consent, dark mode, and sign-out from Settings.",
        "The caregiver opens Settings and selects an integration, permission, preference, or account action.",
        "Authentication and onboarding are complete; phone settings may restrict permission changes.",
        "The chosen setting is updated or the relevant phone settings page opens with clear status feedback.",
        ("Open Settings", "Connect or Disconnect Google Health", "Manage Notification Permission", "Manage Phone Location", "Toggle Dark Mode", "Sign Out"),
        (("1. Open Settings.", "2. Load integration, notification, location, and theme status."),
         ("3. Connect/disconnect Google Health or manage phone permissions.", "4. Run the supported app action or open system settings when required."),
         ("5. Toggle Dark Mode.", "6. Persist and apply the theme preference."),
         ("7. Sign out when desired.", "8. Clear the Supabase session and return to Login."))),
    UseCase(39, "Review Admin Alerts", ("Administrator",),
        "The administrator reviews saved health alerts, caregiver notifications, and emergency history in the portal.",
        "The administrator opens Alerts and notifications or follows a recent-activity link from Overview.",
        "An active administrator session exists.",
        "The portal displays the latest saved alert, delivery, and emergency status information without presenting it as live device telemetry.",
        ("Open Alerts and Notifications", "Review Health Alerts", "Review Notification Delivery", "Review Emergency History", "Refresh View"),
        (("1. Open Alerts and notifications.", "2. Load recent health alerts, notifications, and emergency events through the secured admin function."),
         ("3. Review severity, status, delivery, patient ID, and event time.", "4. Render the records in separate tables and show explicit empty states."),
         ("5. Select Refresh when needed.", "6. Reload the view and update the displayed refresh time."))),
    UseCase(40, "Recover Admin Password", ("Administrator",),
        "An administrator requests a recovery email, verifies the newest one-time code, sets a new password, and returns to sign in.",
        "The administrator selects Forgot password on the portal.",
        "The administrator enters the configured admin username or email and can access that email account.",
        "A valid recovery session updates the password; invalid, expired, or rate-limited attempts show safe feedback without opening the portal.",
        ("Request Password Reset", "Receive Recovery Email", "Enter Verification Code", "Verify Recovery Session", "Set New Password", "Return to Sign In", "Review Invalid or Expired Code"),
        (("1. Enter the admin username or email and select Forgot password.", "2. Request a Supabase recovery email and show non-enumerating feedback."),
         ("3. Enter the newest 6- to 8-digit verification code.", "4. Verify the code and recovery session for the same email."),
         ("5. Enter and confirm a new password.", "6. Update the authenticated user's password and clear the recovery session."),
         ("7. Sign in with the new password.", "8. Return to the normal admin sign-in form.")),
        ((3, 6, "invalid or expired"),)),
)


# UML extension relationships are written as (base use-case index, extending
# use-case index).  The arrow is drawn from the extension toward the base.
EXTEND_RELATIONSHIPS = {
    18: ((2, 4),),
    19: ((2, 4),),
    20: ((0, 4), (0, 5)),
    21: ((3, 4),),
    23: ((3, 4),),
    24: ((0, 3),),
    25: ((0, 3), (0, 4)),
    26: ((1, 3), (1, 4), (1, 5)),
    27: ((0, 4),),
    28: ((3, 5),),
    29: ((0, 3), (0, 5)),
    30: ((0, 4),),
    31: ((0, 4),),
    32: ((3, 4),),
    33: ((1, 3),),
    34: ((2, 4),),
    35: ((0, 5),),
    36: ((2, 3), (0, 4)),
    37: ((3, 4),),
    38: ((0, 4), (0, 5)),
    39: ((0, 4),),
}


def font(size: int, bold: bool = False, italic: bool = False):
    candidates = []
    if bold and italic:
        candidates = [r"C:\Windows\Fonts\timesbi.ttf"]
    elif bold:
        candidates = [r"C:\Windows\Fonts\timesbd.ttf", r"C:\Windows\Fonts\arialbd.ttf"]
    elif italic:
        candidates = [r"C:\Windows\Fonts\timesi.ttf"]
    else:
        candidates = [r"C:\Windows\Fonts\times.ttf", r"C:\Windows\Fonts\arial.ttf"]
    for candidate in candidates:
        if os.path.exists(candidate):
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def wrapped(draw: ImageDraw.ImageDraw, text: str, max_width: int, face) -> list[str]:
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and draw.textbbox((0, 0), candidate, font=face)[2] > max_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def centered_multiline(draw, box, text, face, fill="#111111"):
    x0, y0, x1, y1 = box
    lines = wrapped(draw, text, int((x1 - x0) * .82), face)
    line_height = face.size + 5
    y = (y0 + y1 - line_height * len(lines)) / 2
    for line in lines[:3]:
        bbox = draw.textbbox((0, 0), line, font=face)
        draw.text(((x0 + x1 - (bbox[2] - bbox[0])) / 2, y), line, font=face, fill=fill)
        y += line_height


def dashed_line(draw, start, end, fill="#526875", width=3, dash=16, gap=10):
    dx, dy = end[0] - start[0], end[1] - start[1]
    distance = math.hypot(dx, dy)
    if distance == 0:
        return
    ux, uy = dx / distance, dy / distance
    cursor = 0.0
    while cursor < distance:
        segment_end = min(cursor + dash, distance)
        draw.line(
            [(start[0] + ux * cursor, start[1] + uy * cursor),
             (start[0] + ux * segment_end, start[1] + uy * segment_end)],
            fill=fill,
            width=width,
        )
        cursor += dash + gap


def arrow(draw, start, end, label="", dashed=False):
    if dashed:
        dashed_line(draw, start, end)
    else:
        draw.line([start, end], fill="#526875", width=3)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    length = 14
    points = [end,
              (end[0] - length * math.cos(angle - .45), end[1] - length * math.sin(angle - .45)),
              (end[0] - length * math.cos(angle + .45), end[1] - length * math.sin(angle + .45))]
    draw.polygon(points, fill="#526875")
    if label:
        mx, my = (start[0] + end[0]) / 2, (start[1] + end[1]) / 2
        face = font(20, italic=True)
        bbox = draw.textbbox((0, 0), label, font=face)
        label_y = my - 31
        draw.rectangle((mx - (bbox[2] - bbox[0]) / 2 - 7, label_y - 2,
                        mx + (bbox[2] - bbox[0]) / 2 + 7, label_y + 25), fill="white")
        draw.text((mx - (bbox[2] - bbox[0]) / 2, label_y), label, font=face, fill="#526875")


def ellipse_edge(center, toward, rx=154, ry=62):
    dx = toward[0] - center[0]
    dy = toward[1] - center[1]
    if dx == 0 and dy == 0:
        return center
    scale = 1 / math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
    return center[0] + dx * scale, center[1] + dy * scale


def arrow_between(draw, source, target, label="", dashed=True):
    start = ellipse_edge(source, target)
    end = ellipse_edge(target, source)
    arrow(draw, start, end, label, dashed=dashed)


def arrow_between_sized(draw, source, target, label, rx, ry):
    start = ellipse_edge(source, target, rx=rx, ry=ry)
    end = ellipse_edge(target, source, rx=rx, ry=ry)
    arrow(draw, start, end, label, dashed=True)


def draw_actor(draw, x, y, label):
    draw.ellipse((x - 24, y - 92, x + 24, y - 44), outline="#173B4F", width=4, fill="white")
    draw.line((x, y - 44, x, y + 30), fill="#173B4F", width=4)
    draw.line((x - 42, y - 18, x + 42, y - 18), fill="#173B4F", width=4)
    draw.line((x, y + 30, x - 38, y + 88), fill="#173B4F", width=4)
    draw.line((x, y + 30, x + 38, y + 88), fill="#173B4F", width=4)
    bbox = draw.textbbox((0, 0), label, font=font(29, bold=True))
    draw.text((x - (bbox[2] - bbox[0]) / 2, y + 100), label, font=font(29, bold=True), fill="#173B4F")


def positions(count: int):
    layouts = {
        5: [(520, 360), (820, 220), (820, 500), (1180, 220), (1180, 500)],
        6: [(500, 360), (770, 190), (770, 530), (1120, 190), (1120, 530), (1440, 360)],
        7: [(470, 360), (700, 190), (700, 530), (980, 190), (980, 530), (1270, 190), (1390, 510)],
    }
    return layouts.get(count, [(440 + i * 240, 360) for i in range(count)])


def draw_case(case: UseCase, path: Path):
    width, height = 1800, 760
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((290, 54, 1570, 705), radius=12, outline="#173B4F", width=4, fill="white")
    title_face = font(38, bold=True)
    bbox = draw.textbbox((0, 0), "ElderCareAI", font=title_face)
    draw.text(((width - (bbox[2] - bbox[0])) / 2, 70), "ElderCareAI", font=title_face, fill="#173B4F")
    coords = positions(len(case.nodes))
    node_boxes = []
    explicit_extensions = EXTEND_RELATIONSHIPS.get(case.number, ())
    extension_nodes = {extension for _, extension in explicit_extensions}
    extension_nodes.update(target for _, target, _ in case.branches)
    branch_nodes = {target for _, target, _ in case.branches}
    for idx, (label, (cx, cy)) in enumerate(zip(case.nodes, coords)):
        rx, ry = (154, 62)
        box = (cx - rx, cy - ry, cx + rx, cy + ry)
        node_boxes.append(box)
        fill = LIGHT_BLUE if idx == len(case.nodes) - 1 else LIGHT_TEAL
        outline = "#416F9E" if idx == len(case.nodes) - 1 else "#257967"
        if idx in extension_nodes:
            fill, outline = LIGHT_AMBER, "#B57720"
        draw.ellipse(box, fill=f"#{fill}", outline=outline, width=3)
        centered_multiline(draw, box, label, font(25, bold=True))
    required_nodes = [idx for idx in range(len(coords)) if idx not in extension_nodes]
    for source, target in zip(required_nodes, required_nodes[1:]):
        arrow_between(draw, coords[source], coords[target], "<<include>>")
    for base, extension in explicit_extensions:
        arrow_between(draw, coords[extension], coords[base], "<<extend>>")
    for source, target, label in case.branches:
        arrow_between(draw, coords[target], coords[source], "<<extend>>")
        if label and target in branch_nodes:
            box = node_boxes[target]
            face = font(17, italic=True)
            bbox = draw.textbbox((0, 0), label, font=face)
            draw.text(((box[0] + box[2] - (bbox[2] - bbox[0])) / 2, box[3] + 8),
                      label, font=face, fill="#8A5B1B")
    draw_actor(draw, 130, 345, case.actors[0])
    draw.line((170, 345, node_boxes[0][0], coords[0][1]), fill="#263F4C", width=3)
    if len(case.actors) > 1:
        draw_actor(draw, 1670, 345, case.actors[1])
        target_index = case.right_actor_target if case.right_actor_target is not None else len(case.nodes) - 1
        draw.line((1630, 345, node_boxes[target_index][2], coords[target_index][1]), fill="#263F4C", width=3)
    image.save(path, quality=95)


def draw_overall(path: Path):
    width, height = 1800, 1250
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((230, 55, 1570, 1120), radius=10, outline="#173B4F", width=4, fill="#FBFDFE")
    centered_multiline(draw, (550, 70, 1250, 135), "ElderCareAI Current Scope", font(39, bold=True), "#173B4F")
    draw.line((900, 145, 900, 875), fill="#C9D7DF", width=2)
    centered_multiline(draw, (260, 140, 890, 190), "CAREGIVER MOBILE APP", font(25, bold=True), "#24556F")
    centered_multiline(draw, (910, 140, 1550, 190), "ADMIN PORTAL", font(25, bold=True), "#24556F")
    caregiver = ["Google Sign In", "Complete Onboarding", "View Dashboard", "Review Health", "Manage Care and Notes", "Review Alerts and SOS", "Ask Elle", "Manage Profiles and Records", "Export PDF Reports", "Configure Settings", "View Sync Location"]
    admin = ["Admin Sign In", "Recover Password", "View Overview", "Manage Accounts", "Monitor System Data", "Review Alerts", "Export CSV Reports", "Manage Security"]
    caregiver_coords = []
    for index, label in enumerate(caregiver):
        col, row = index % 2, index // 2
        cx, cy = 420 + col * 300, 230 + row * 108
        caregiver_coords.append((cx, cy))
        box = (cx - 125, cy - 38, cx + 125, cy + 38)
        draw.ellipse(box, fill=f"#{LIGHT_TEAL}", outline=f"#{TEAL}", width=3)
        centered_multiline(draw, box, label, font(19, bold=True))
    admin_coords = []
    for index, label in enumerate(admin):
        col, row = index % 2, index // 2
        cx, cy = 1070 + col * 300, 230 + row * 138
        admin_coords.append((cx, cy))
        box = (cx - 125, cy - 38, cx + 125, cy + 38)
        draw.ellipse(box, fill=f"#{LIGHT_BLUE}", outline="#476F9D", width=3)
        centered_multiline(draw, box, label, font(19, bold=True))
    arrow_between_sized(draw, caregiver_coords[0], caregiver_coords[1], "<<include>>", 125, 38)
    arrow_between_sized(draw, admin_coords[0], admin_coords[2], "<<include>>", 125, 38)
    arrow_between_sized(draw, admin_coords[1], admin_coords[0], "<<extend>>", 125, 38)
    draw_actor(draw, 105, 475, "Caregiver")
    draw.line((145, 475, 295, 338), fill="#263F4C", width=3)
    draw_actor(draw, 1690, 475, "Administrator")
    draw.line((1650, 475, 1495, 368), fill="#263F4C", width=3)
    draw.line((270, 885, 1530, 885), fill="#C9D7DF", width=2)
    centered_multiline(draw, (500, 895, 1300, 945), "CONNECTED SERVICES", font(25, bold=True), "#24556F")
    services = ["Google Health API v4", "Supabase Data and Realtime", "Gemini Guidance", "Device Notifications"]
    for index, label in enumerate(services):
        cx = 405 + index * 330
        box = (cx - 135, 965, cx + 135, 1045)
        draw.ellipse(box, fill="#FFF7E6", outline="#B87924", width=3)
        centered_multiline(draw, box, label, font(18, bold=True))
    image.save(path, quality=95)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=29, start=72, bottom=29, end=72):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = borders.find(qn(f"w:{edge}"))
        if tag is None:
            tag = OxmlElement(f"w:{edge}")
            borders.append(tag)
        tag.set(qn("w:val"), "single")
        tag.set(qn("w:sz"), "6")
        tag.set(qn("w:color"), GRID)


def set_repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    element = OxmlElement("w:tblHeader")
    element.set(qn("w:val"), "true")
    tr_pr.append(element)


def set_run_font(run, name="Times New Roman", size=10, bold=False, color="000000"):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor.from_string(color)
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:hAnsi"), name)


def write_cell(cell, text, *, bold=False, color="000000", align=WD_ALIGN_PARAGRAPH.LEFT,
               size=10.5, font_name="Arial", vertical=WD_ALIGN_VERTICAL.CENTER):
    cell.text = ""
    p = cell.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.0
    run = p.add_run(text)
    set_run_font(run, name=font_name, size=size, bold=bold, color=color)
    cell.vertical_alignment = vertical
    set_cell_margins(cell)


def write_flow_cell(cell, lines, *, bold=False):
    cell.text = ""
    first = True
    for line in lines:
        p = cell.paragraphs[0] if first else cell.add_paragraph()
        first = False
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.05
        set_run_font(p.add_run(line), name="Arial", size=9.8, bold=bold)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
    set_cell_margins(cell, top=55, start=72, bottom=55, end=72)


def add_use_case_table(doc: Document, case: UseCase):
    table = doc.add_table(rows=8, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    widths = (Inches(1.10), Inches(2.70), Inches(2.70))
    rows = [
        ("Use Case Name", case.title),
        ("Actor", ", ".join(case.actors)),
        ("Brief Description", case.description),
        ("Trigger", case.trigger),
        ("Pre-Conditions", case.preconditions),
        ("Post Conditions", case.postconditions),
    ]
    for index, (label, value) in enumerate(rows):
        row = table.rows[index]
        label_cell = row.cells[0]
        value_cell = row.cells[1].merge(row.cells[2])
        write_cell(label_cell, label, bold=True, size=10.5)
        write_cell(value_cell, value, bold=(index == 0), size=10.5)
        label_cell.width = widths[0]
        value_cell.width = Inches(5.40)
    header = table.rows[6]
    flow = table.rows[7]
    flow_label = header.cells[0].merge(flow.cells[0])
    write_cell(flow_label, "Flow of Activities", bold=True, size=10.5,
               vertical=WD_ALIGN_VERTICAL.TOP)
    for cell, label, width in zip((header.cells[1], header.cells[2]), ("Actor(s)", "Application"), widths[1:]):
        write_cell(cell, label, bold=True, size=10.5)
        cell.width = width
    actor_lines = [pair[0] for pair in case.activities]
    app_lines = [pair[1] for pair in case.activities]
    write_flow_cell(flow.cells[1], actor_lines)
    write_flow_cell(flow.cells[2], app_lines)
    flow_label.width = widths[0]
    flow.cells[1].width = widths[1]
    flow.cells[2].width = widths[2]
    set_table_borders(table)
    return table


def set_document_defaults(doc: Document):
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.8)
    section.bottom_margin = Inches(0.8)
    section.left_margin = Inches(1.0)
    section.right_margin = Inches(1.0)
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(11)
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")
    for style_name, size in (("Title", 22), ("Heading 1", 14), ("Heading 2", 12)):
        style = styles[style_name]
        style.font.name = "Times New Roman"
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor(0, 0, 0)
        style._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
        style._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")
    title_ppr = styles["Title"]._element.get_or_add_pPr()
    title_border = title_ppr.find(qn("w:pBdr"))
    if title_border is not None:
        title_ppr.remove(title_border)
    styles["Title"].font.bold = True
    styles["Heading 1"].font.bold = True
    styles["Heading 2"].font.bold = True


def add_caption(doc, figure_number, title):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    run = p.add_run(f"Figure {figure_number}: {title}")
    set_run_font(run, size=11, bold=True)


def add_description(doc, text):
    p = doc.add_paragraph()
    # Keep a visible gap below longer centered captions in Word/PDF output.
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(5)
    p.paragraph_format.line_spacing = 1.05
    p.paragraph_format.keep_with_next = False
    run = p.add_run(text)
    set_run_font(run, size=11)


def add_coverage_table(doc):
    rows = [
        ("Existing flows corrected", "Figures 16-34", "Replaced stale table language about direct streaming, live GPS, geofencing, clinical prediction, and PDF admin exports."),
        ("Emergency feature added", "Figure 35", "Documents confirmed SOS logging, alert creation, notification creation, calling, and later resolution."),
        ("Care notes added", "Figure 36", "Documents add/edit, pin/unpin, and confirmed deletion."),
        ("Caregiver reports added", "Figure 37", "Documents health-vitals and medication-schedule PDF generation and sharing."),
        ("Settings added", "Figure 38", "Documents Google Health connection, notification and location permissions, dark mode, and sign-out."),
        ("Admin alert review added", "Figure 39", "Documents the portal's alert, notification-delivery, and emergency-history view."),
        ("Admin recovery added", "Figure 40", "Documents email recovery, code verification, password replacement, and safe failure states."),
    ]
    table = doc.add_table(rows=1, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for cell, label, width in zip(table.rows[0].cells, ("Audit result", "Coverage", "Current-flow correction"), (1.55, 1.25, 4.35)):
        write_cell(cell, label, bold=True, color="FFFFFF", align=WD_ALIGN_PARAGRAPH.CENTER, size=9.5)
        set_cell_shading(cell, NAVY)
        cell.width = Inches(width)
    set_repeat_header(table.rows[0])
    for idx, record in enumerate(rows):
        row = table.add_row()
        for cell, value, width in zip(row.cells, record, (1.55, 1.25, 4.35)):
            write_cell(cell, value, size=9.3)
            cell.width = Inches(width)
            if idx % 2:
                set_cell_shading(cell, PALE_BLUE)
    set_table_borders(table)


def build():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    draw_overall(ASSET_DIR / "figure-15.png")
    for case in CASES:
        draw_case(case, ASSET_DIR / f"figure-{case.number}.png")

    doc = Document()
    set_document_defaults(doc)
    title = doc.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(0)
    title.paragraph_format.space_after = Pt(6)
    title.add_run("ElderCareAI Current Use Case Documentation")
    intro = doc.add_paragraph()
    intro.paragraph_format.line_spacing = 1.05
    intro.paragraph_format.space_after = Pt(6)
    run = intro.add_run(
        "This document presents the implemented caregiver and administrator workflows. Each diagram uses standard UML include and extend relationships, and each matching table separates actor actions from application responses."
    )
    set_run_font(run, size=10.5)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(2)
    p.add_run().add_picture(str(ASSET_DIR / "figure-15.png"), width=Inches(6.0))
    add_caption(doc, 15, "ElderCareAI Current Use Case Diagram")
    add_description(doc,
        "The overview shows the authenticated caregiver and administrator scopes plus the connected services that support synchronization, data updates, guidance, and device notifications. Detailed Figures 16 through 40 define the implemented flows and their alternate states.")

    for case in CASES:
        picture = doc.add_paragraph()
        picture.paragraph_format.page_break_before = True
        picture.alignment = WD_ALIGN_PARAGRAPH.CENTER
        picture.paragraph_format.space_after = Pt(1)
        picture.paragraph_format.keep_with_next = True
        picture.add_run().add_picture(str(ASSET_DIR / f"figure-{case.number}.png"), width=Inches(5.75))
        add_caption(doc, case.number, case.title)
        add_description(doc, case.description)
        table_caption = doc.add_paragraph()
        table_caption.paragraph_format.space_before = Pt(1)
        table_caption.paragraph_format.space_after = Pt(1)
        table_caption.paragraph_format.keep_with_next = True
        run = table_caption.add_run(f"Table {case.number - 12}")
        set_run_font(run, name="Arial", size=10.5)
        table_title = doc.add_paragraph()
        table_title.paragraph_format.space_before = Pt(0)
        table_title.paragraph_format.space_after = Pt(4)
        table_title.paragraph_format.keep_with_next = True
        run = table_title.add_run(case.title.upper())
        set_run_font(run, name="Arial", size=10.5)
        add_use_case_table(doc, case)

    doc.add_page_break()
    heading = doc.add_paragraph("Storyboard", style="Heading 1")
    heading.paragraph_format.space_after = Pt(7)
    story = (
        "The ElderCareAI storyboard begins with Google sign-in and an optional, resumable setup sequence for caregiver information, the older-adult profile, Google Health, and foreground phone-location consent. "
        "After setup, the caregiver uses the Home, Health, Alerts, Elle, Care, and Settings tabs. Home summarizes the latest synchronized measurements and care plan; Health presents personal-baseline insights, simple trend projections, anomalies, and metric details; Alerts contains health alerts, saved notifications, SOS activation, and emergency history; Elle provides non-diagnostic care guidance; Care manages medications, appointments, taken-dose logs, and caregiver notes; Settings manages profiles, doctor contact, Google Health, PDF reports, permissions, theme, and sign-out. "
        "The separate administrator portal supports overview metrics, account management, connection and sync monitoring, alert review, CSV reports, administrator security, password recovery, audit activity, and sign-out. Google Health supplies available readings through manual, foreground, timed active-app, and webhook reconciliation; Supabase stores and distributes authorized records; Gemini supports Elle; and mobile services schedule local reminders."
    )
    p = doc.add_paragraph()
    p.paragraph_format.line_spacing = 1.15
    p.paragraph_format.space_after = Pt(8)
    set_run_font(p.add_run(story), size=11)
    note = doc.add_paragraph()
    note.paragraph_format.space_before = Pt(8)
    note.paragraph_format.line_spacing = 1.1
    lead = note.add_run("Scope note. ")
    set_run_font(lead, size=10.5, bold=True)
    set_run_font(note.add_run(
        "ElderCareAI does not directly pair to the tracker, continuously stream Fitbit readings, track background GPS, locate the watch, create geofences, diagnose illness, or generate administrator PDFs. The implemented flows use Google Health, foreground phone-location events tied to eligible syncs, statistical decision support, caregiver PDF sharing, and administrator CSV exports."
    ), size=10.5)

    core = doc.core_properties
    core.title = "ElderCareAI Current Use Case Documentation"
    core.subject = "Current use case diagrams and matching tables with UML include and extend relationships"
    core.author = "ElderCareAI Project Team"
    core.keywords = "ElderCareAI, use cases, caregiver, administrator, Google Health"
    doc.save(OUTPUT)
    print(f"Created {OUTPUT}")
    print(f"Created {len(CASES) + 1} figure images in {ASSET_DIR}")


if __name__ == "__main__":
    build()
