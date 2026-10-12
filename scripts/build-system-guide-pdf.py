"""Build the repository-based ElderCareAI system guide PDF."""

from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "ElderCareAI_System_Guide.pdf"
FONTS = ROOT / "website" / "assets" / "fonts"

for name, file in [
    ("Inter", "inter-regular.ttf"),
    ("InterMedium", "inter-medium.ttf"),
    ("InterSemi", "inter-semibold.ttf"),
    ("InterBold", "inter-bold.ttf"),
]:
    pdfmetrics.registerFont(TTFont(name, str(FONTS / file)))
pdfmetrics.registerFontFamily(
    "Inter", normal="Inter", bold="InterBold", italic="Inter", boldItalic="InterBold"
)

INK = colors.HexColor("#173331")
BODY = colors.HexColor("#344744")
MUTED = colors.HexColor("#627572")
TEAL = colors.HexColor("#227C73")
PALE = colors.HexColor("#E9F5F1")
BLUE = colors.HexColor("#E9F2FA")
YELLOW = colors.HexColor("#FFF4C8")
RULE = colors.HexColor("#DCE8E4")
WHITE = colors.white
PAGE_W, PAGE_H = A4
CONTENT_W = PAGE_W - 38 * mm


def style(name, size, leading, color=BODY, font="Inter", space_after=0, alignment=TA_LEFT):
    return ParagraphStyle(
        name=name,
        fontName=font,
        fontSize=size,
        leading=leading,
        textColor=color,
        spaceAfter=space_after,
        alignment=alignment,
        allowWidows=0,
        allowOrphans=0,
    )


ST = {
    "eyebrow": style("eyebrow", 8, 11, TEAL, "InterBold", 8),
    "cover": style("cover", 31, 35, INK, "InterBold", 12),
    "lead": style("lead", 13, 19, BODY, "Inter", 18),
    "h1": style("h1", 19, 24, INK, "InterBold", 7),
    "h2": style("h2", 11.6, 15, INK, "InterBold", 5),
    "body": style("body", 9.45, 14.2, BODY, "Inter", 6),
    "small": style("small", 8.2, 11.7, BODY, "Inter", 3),
    "bullet": style("bullet", 9.25, 13.8, BODY, "Inter", 5),
    "tablehead": style("tablehead", 8, 11.2, INK, "InterBold"),
    "table": style("table", 8.05, 11.3, BODY),
    "caption": style("caption", 8.4, 12, MUTED, "Inter"),
    "callout": style("callout", 9.2, 13.5, INK, "InterMedium"),
}


def p(text, kind="body"):
    return Paragraph(text, ST[kind])


def heading(text, kind="h2"):
    return KeepTogether([p(escape(text), kind), Spacer(1, 1.5 * mm)])


def bullets(items):
    result = []
    for item in items:
        result.append(p("<font color='#227C73'><b>\u2022</b></font>  " + item, "bullet"))
    return result


def grid(headers, rows, widths, font_size=None):
    data = [[p(escape(h), "tablehead") for h in headers]]
    data += [[p(cell, "table") for cell in row] for row in rows]
    table = Table(data, colWidths=widths, hAlign="LEFT", repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PALE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 9),
                ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                ("TOPPADDING", (0, 0), (-1, 0), 9),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 9),
                ("TOPPADDING", (0, 1), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 7),
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, RULE),
                ("LINEBELOW", (0, 1), (-1, -2), 0.35, RULE),
            ]
        )
    )
    return table


def callout(title, content, background=PALE):
    box = Table(
        [[p("<b>" + escape(title) + "</b><br/>" + content, "callout")]],
        colWidths=[CONTENT_W],
    )
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), background),
                ("LEFTPADDING", (0, 0), (-1, -1), 13),
                ("RIGHTPADDING", (0, 0), (-1, -1), 13),
                ("TOPPADDING", (0, 0), (-1, -1), 11),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 11),
            ]
        )
    )
    return box


class SystemFlow(Flowable):
    def __init__(self, width=CONTENT_W, height=74):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        labels = [
            ("Inspire 3", "measures"),
            ("Google Health", "receives"),
            ("Supabase", "stores"),
            ("Mobile app", "shows"),
        ]
        gap = 21
        box_w = (self.width - 3 * gap) / 4
        y = 17
        for i, (label, detail) in enumerate(labels):
            x = i * (box_w + gap)
            c.setFillColor(PALE if i != 2 else BLUE)
            c.roundRect(x, y, box_w, 48, 8, fill=1, stroke=0)
            c.setFillColor(INK)
            c.setFont("InterBold", 9.1)
            c.drawCentredString(x + box_w / 2, y + 29, label)
            c.setFillColor(MUTED)
            c.setFont("Inter", 7.7)
            c.drawCentredString(x + box_w / 2, y + 14, detail)
            if i < 3:
                mid = x + box_w + gap / 2
                c.setStrokeColor(TEAL)
                c.setLineWidth(1.35)
                c.line(x + box_w + 4, y + 24, mid + 5, y + 24)
                c.line(mid + 5, y + 24, mid + 1, y + 27)
                c.line(mid + 5, y + 24, mid + 1, y + 21)


def page(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setFillColor(TEAL)
        canvas.rect(0, PAGE_H - 9, PAGE_W, 9, fill=1, stroke=0)
        canvas.setFont("InterBold", 8)
        canvas.setFillColor(INK)
        canvas.drawString(19 * mm, PAGE_H - 19 * mm, "ELDERCAREAI  /  SYSTEM GUIDE")
    canvas.setStrokeColor(RULE)
    canvas.line(19 * mm, 18 * mm, PAGE_W - 19 * mm, 18 * mm)
    canvas.setFont("Inter", 7.4)
    canvas.setFillColor(MUTED)
    canvas.drawString(19 * mm, 13 * mm, "Repository snapshot  |  12 October 2026")
    canvas.drawRightString(PAGE_W - 19 * mm, 13 * mm, str(doc.page))
    canvas.restoreState()


story = []


def add(*items):
    story.extend(items)


def new_page(number, title, subtitle):
    add(PageBreak(), p(f"{number:02d}  /  {escape(subtitle.upper())}", "eyebrow"), p(escape(title), "h1"))


# 1 - Orientation
logo = ROOT / "website" / "assets" / "eldercare-logo.png"
if logo.exists():
    add(Image(str(logo), width=33 * mm, height=33 * mm), Spacer(1, 16 * mm))
else:
    add(Spacer(1, 25 * mm))
add(
    p("SYSTEM HANDBOOK  /  VERSION 1.0", "eyebrow"),
    p("ElderCareAI<br/>System Guide", "cover"),
    p("A practical explanation of the app, the watch-to-phone data flow, the technology behind it, and the administrator website.", "lead"),
    Spacer(1, 6 * mm),
    SystemFlow(),
    Spacer(1, 10 * mm),
    callout(
        "The system in one sentence",
        "A caregiver signs in, links an older adult and Google Health, then sees synchronized health readings and care tasks in the mobile app; an authorized administrator oversees accounts and system records on a separate website.",
    ),
    Spacer(1, 8 * mm),
    p("What this guide covers", "h2"),
    grid(
        ["Understand", "Operate", "Maintain"],
        [[
            "Technology stack, architecture, database, and security.",
            "Caregiver workflow, vitals, reminders, Elle, SOS, and reports.",
            "Admin website, deployments, tests, and troubleshooting.",
        ]],
        [CONTENT_W / 3] * 3,
    ),
    Spacer(1, 8 * mm),
    p("Prepared from the checked-out source code, commit 5f460e0. This describes implemented behavior, not a medical certification or a guarantee that third-party services are continuously available.", "caption"),
)


# 2 - Tech stack
new_page(1, "What the system is built with", "technology")
add(p("ElderCareAI has three user-facing parts: an Android/iOS caregiver app, a public landing website, and a restricted admin website. They share a Supabase backend.", "body"))
add(
    grid(
        ["Part", "Languages and framework", "What it does"],
        [
            ["Mobile app", "TypeScript + TSX; React 19.1; React Native 0.81.5; Expo SDK 54; Expo Router 6", "Native-style screens, navigation, forms, health dashboard, local notifications, location, and PDF exports."],
            ["Public website", "HTML, CSS, JavaScript", "Static Home, Features, About, Contact, and team content."],
            ["Admin website", "HTML, CSS, JavaScript", "Protected management dashboard at <b>/edcadmin/</b>; hosted separately from the app binary."],
            ["Backend API", "Deno TypeScript; Supabase Edge Functions", "Google Health OAuth/sync/webhook, Elle assistant, and admin operations."],
            ["Database and auth", "PostgreSQL + SQL migrations; Supabase Auth, Storage, Realtime, Row Level Security", "Stores profiles, care history, readings, messages, access roles, and audit entries."],
            ["Testing and builds", "Jest + React Native Testing Library; TypeScript compiler; Expo Application Services (EAS)", "Unit/component tests, type checks, development APKs, and installable release builds."],
        ],
        [100, 172, CONTENT_W - 272],
    ),
    Spacer(1, 5 * mm),
    heading("How the pieces communicate"),
    *bullets(
        [
            "The app signs in through <b>Supabase Auth</b> and calls Supabase over HTTPS with a public/publishable key.",
            "<b>Edge Functions</b> use protected server-side secrets to call Google Health and Gemini. The app does not contain those secrets.",
            "<b>PostgreSQL</b> stores patient and care data. Supabase Realtime sends changed vital rows to an open app over a live connection.",
            "The static website can be deployed on <b>Vercel</b>; the admin page calls its authorized Edge Function, not the database with an embedded service key.",
        ]
    ),
    callout(
        "Not a direct Bluetooth watch app",
        "ElderCareAI does not pair with the Inspire 3 itself. The watch's companion/Google Health ecosystem must publish new readings before the app can receive them.",
        BLUE,
    ),
)


# 3 - flow
new_page(2, "From watch measurement to the Home card", "data flow")
add(
    SystemFlow(),
    Spacer(1, 5 * mm),
    grid(
        ["Stage", "What happens", "Who controls the delay?"],
        [
            ["1. Measure", "Inspire 3 records a reading such as heart rate or sleep.", "The tracker and its sensor schedule."],
            ["2. Upload", "Its connected phone/Google Health receives the new data.", "Bluetooth, internet, app background access, and Google/Fitbit sync."],
            ["3. Notify", "An active Google Health subscriber calls the Supabase webhook for supported data changes.", "Google's notification delivery and subscription/consent."],
            ["4. Fetch + save", "The server validates the webhook, requests recent Google Health data, and writes a <b>vital_sign_logs</b> row when a value or measurement time changes.", "Google API and deployed Supabase functions."],
            ["5. Display", "Supabase Realtime updates Home while the app is open; reopening the app loads the latest saved row.", "Phone connectivity and database subscription."],
        ],
        [72, 262, CONTENT_W - 334],
    ),
    Spacer(1, 5 * mm),
    heading("Automatic, but not instantaneous"),
    *bullets(
        [
            "The <b>webhook</b> is the primary server-side automatic path. It can update the database even when ElderCareAI is closed.",
            "When the app is in the foreground, it also silently checks again after a watch-sync or BPM measurement marker becomes about <b>15 minutes old</b>, with bounded retries. The timer checks the due state every 15 seconds; it does not create a new measurement.",
            "<b>Sync now</b> and pull-to-refresh remain manual fallbacks. They request the latest Google Health data but cannot force the watch or Google Health app to upload a reading.",
            "<b>Measured at</b> means when the body reading was recorded. <b>Last checked/synced</b> means when Google Health was queried. They are intentionally different timestamps.",
        ]
    ),
    callout("Core truth", "If Google Health has no newer sample, ElderCareAI correctly keeps the old value and shows its increasing age. A fresh database check is not a fresh BPM.", YELLOW),
)


# 4 - caregiver journey
new_page(3, "What a caregiver does in the app", "user journey")
add(
    grid(
        ["Step", "Screen or action", "Outcome"],
        [
            ["1", "Sign in with Google", "Supabase OAuth returns to the mobile app and creates a session."],
            ["2", "Read the short introduction", "The new-user onboarding progress is saved."],
            ["3", "Enter caregiver and older-adult information", "Profiles, contact details, medical context, and photos can be managed."],
            ["4", "Connect Google Health / Inspire 3 ecosystem", "Consent allows the server to read supported measurements. Skipping leaves vitals disconnected or empty."],
            ["5", "Choose phone-location consent", "Only foreground phone location can be recorded on an authorized sync."],
            ["6", "Use Home and the bottom tabs", "Review readings, plan care, ask Elle, inspect alerts, and update settings."],
        ],
        [43, 200, CONTENT_W - 243],
    ),
    Spacer(1, 5 * mm),
    heading("Home and health"),
    *bullets(
        [
            "<b>Home</b> shows the selected older adult, latest vitals, device/connection state, upcoming appointments, medications and notes, a doctor-call shortcut, and last recorded phone location.",
            "Vital cards cover <b>heart rate, oxygen saturation, sleep, steps, overnight skin temperature, and HRV</b> when the source supplies those values. A card opens details, recent readings, timing/source context, and Elle's reading-specific explanation.",
            "The <b>Health</b> area provides insights against personal history, simple trend predictions, and anomaly checks. These are statistical aids, not a trained clinical diagnosis.",
            "<b>Sleep history</b> is stored with vital logs. The app describes duration relative to a general 7-8 hour older-adult guide; it does <b>not</b> claim that hours alone prove sleep quality or calculate a validated sleep score.",
        ]
    ),
    callout("What the six cards do not mean", "Skin temperature is an overnight skin reading, not core temperature. Missing measurements stay missing; the app should not invent blood pressure, strain, or other unsupported metrics.", BLUE),
)


# 5 - care and safety
new_page(4, "Care tasks, alerts, location, and Elle", "daily operation")
add(
    heading("Care plan and records"),
    *bullets(
        [
            "The <b>Care</b> tab manages medication schedules and taken-dose logs, appointments, and caregiver notes. Items can be added, edited, and removed where the screen allows.",
            "<b>Settings - Manage Health Records</b> maintains the older adult's medical context and uses the existing profile, appointment, and medication data; there is no separate health-records table for this screen.",
            "Settings also includes caregiver/older-adult profile editing, saved doctor contact, Google Health connection controls, notification preferences, theme, and shareable health/medication PDF reports.",
        ]
    ),
    heading("Notifications and SOS"),
    *bullets(
        [
            "With phone permission, appointment and scheduled medication reminders are <b>local device notifications</b>. Daily, twice-daily, and weekly medications can be scheduled; as-needed medicine has no automatic reminder.",
            "A newly synchronized unusual heart-rate or SpO2 value can create a <b>local warning</b> when the app processes that change and notification permission is available. This is not guaranteed server push to a closed phone.",
            "The <b>Alerts</b> area shows saved alerts, caregiver notifications, and emergency history. A caregiver can review, clear, or resolve the relevant items.",
            "<b>SOS</b> is caregiver-initiated: it records the emergency/alert/notification, plays the warning behavior, and opens a call to the saved emergency contact. It does not automatically call emergency services.",
        ]
    ),
    heading("Location and AI"),
    *bullets(
        [
            "The map uses the <b>caregiver phone's last permitted foreground sync location</b> and OpenStreetMap/Leaflet tiles. It is not live watch GPS or continuous tracking.",
            "<b>Elle</b> is a Gemini-backed caregiver assistant. Its server function supplies authorized profile, doctor, recent vitals, medications, appointments, notes, and alerts as context; conversations are stored in chat session/message tables.",
            "Elle can explain patterns and suggest when to seek help, but must not diagnose or prescribe. Availability depends on the Gemini API; demand, quota, or connectivity can temporarily prevent a reply.",
        ]
    ),
)


# 6 - admin
new_page(5, "What the admin website can do", "administration")
add(
    p("The public site and the admin portal are static web pages. The admin portal is opened directly at <b>/edcadmin/</b>; hiding its link is only a navigation choice, not the access control.", "body"),
    grid(
        ["Area", "Administrator capability"],
        [
            ["Dashboard", "Review caregiver/older-adult counts, saved wearable-connection status, recent readings, alerts, and emergencies."],
            ["Accounts", "Inspect and edit caregivers and older-adult profiles; suspend/reactivate caregivers; request deletion with confirmation. Foreign-key rules can prevent a hard delete."],
            ["Monitor", "Review stored sync/connection information and recent system records. The device count reflects saved onboarding state, not a live watch ping."],
            ["Reports", "Export CSV for vitals, alerts, activities/audit, appointments, medications, and medical history, within server-enforced limits."],
            ["Security", "Invite and manage additional admins, inspect the audit history, and suspend/activate/delete eligible admin accounts."],
        ],
        [105, CONTENT_W - 105],
    ),
    Spacer(1, 5 * mm),
    heading("Who can access what?"),
    *bullets(
        [
            "A <b>caregiver</b> uses the mobile app and is limited by database Row Level Security (RLS) to authorized care data.",
            "An <b>admin</b> signs in with a separate Supabase Auth account whose <b>user_access</b> row is active and has the admin role. The admin function rechecks authorization on every request.",
            "<b>Suspending a caregiver</b> blocks access to protected app data. The account and historical records remain until separately deleted; the mobile session is rejected/signed out on its next access check.",
            "<b>Suspending an admin</b> blocks portal API access. The portal prevents self-removal and removal of the final active admin. Admin changes and exports are recorded in <b>admin_audit_log</b>.",
            "The browser uses a <b>publishable</b> Supabase key. Protected server secrets stay in Edge Functions. The portal keeps its access token in page memory and signs out after about 15 minutes idle.",
        ]
    ),
    callout("Privacy caveat", "The existing profile-photo Storage bucket is public. Suspending an account blocks writes, but previously published photo URLs can still be reachable until the storage design is changed.", YELLOW),
)


# 7 - data model
new_page(6, "Where information is stored", "database")
add(
    p("Supabase PostgreSQL holds the application's source-of-truth records. Tables are connected by IDs: a caregiver owns older-adult profiles; each older adult owns care schedules, readings, notes, appointments, and alerts. Google tokens are server-protected.", "body"),
    grid(
        ["Group", "Main tables", "Purpose"],
        [
            ["Identity", "auth.users; caregivers; profiles; user_access; onboarding_progress", "Sign-in identity, caregiver details, role/status, and setup state."],
            ["Older adult", "elderly_profiles; doctor_contacts", "Patient details, medical context, emergency contact, and saved doctor."],
            ["Wearable", "google_health_oauth_states; google_health_tokens; vital_sign_logs; wearable_sync_locations", "Authorization, protected tokens, timestamped readings/sleep history, and consented phone location."],
            ["Care plan", "medication_schedules; medication_logs; appointments; caregiver_notes", "Doses, medication adherence, visits/checkups, and notes."],
            ["Safety", "health_alerts; caregiver_notifications; emergency_events", "Alerts, caregiver-visible messages, and SOS records."],
            ["AI + audit", "ai_chatbot_sessions; ai_chatbot_messages; admin_audit_log", "Conversation history and administrator action/export history."],
        ],
        [79, 235, CONTENT_W - 314],
    ),
    Spacer(1, 5 * mm),
    heading("Important data rules"),
    *bullets(
        [
            "<b>vital_sign_logs</b> stores the consolidated health snapshot. Per-metric measurement timestamps preserve the age of each actual reading, apart from the last successful API check time.",
            "Recent sleep sessions are kept in the vital log's <b>sleep_history</b> JSON field; the temporary standalone sleep_sessions table was removed by a later migration.",
            "The webhook inserts/updates only when source readings or their measurement times change. Repeated checks should not manufacture a new BPM.",
            "RLS protects caregiver-facing tables. Admin-wide operations go through a server function with a separate role check and audit trail.",
        ]
    ),
    callout("Relationships in plain words", "One caregiver can care for linked older adults; one older adult can have many readings, appointments, medication schedules, notes, alerts, and emergencies. One medication schedule can have many dose logs.", BLUE),
)


# 8 - setup, run, proof
new_page(7, "Running, releasing, and checking the system", "operations")
add(
    heading("Development and release"),
    grid(
        ["Task", "How it is done"],
        [
            ["Local setup", "Install Node dependencies with <b>npm install</b>. Set public Supabase URL/key in the mobile <b>.env</b>. Apply ordered SQL migrations and deploy Edge Functions to the matching Supabase project."],
            ["Development app", "Use an Expo development client and <b>npm start</b> / Metro. Native configuration changes require rebuilding the installed development APK."],
            ["Installable Android app", "An EAS <b>preview</b> build makes an internal APK that runs without a Metro server. A <b>production</b> build targets store distribution."],
            ["Website", "Deploy the <b>website</b> folder as a static site, for example on Vercel. The /edcadmin/config.js file contains public configuration only; the website and mobile app deploy independently."],
            ["Server services", "Configure Google OAuth/scopes, Health API subscriber/webhook secret, Supabase Auth redirects, Edge Function secrets, Gemini key, and admin-role rows. Keep secret/service-role keys off devices and static pages."],
        ],
        [117, CONTENT_W - 117],
    ),
    Spacer(1, 5 * mm),
    heading("Checks that demonstrate it works"),
    *bullets(
        [
            "Run <b>npm run typecheck</b> and <b>npm test</b>. Jest/React Native Testing Library tests cover mocked component/logic cases, not a real wearable or production service.",
            "On a phone, sign in and complete onboarding; verify caregiver and older-adult records appear in the database.",
            "Obtain a <b>new</b> Inspire 3 reading. Confirm Google Health has it, then verify a newer per-metric measurement time in <b>vital_sign_logs</b> and an open Home card change without manual refresh.",
            "Test a medication reminder, appointment reminder, manual SOS, Elle response, and report export with permitted accounts.",
            "Sign in as a separate admin; verify own-role access, a caregiver suspension, a report export, and an audit entry. Confirm a suspended caregiver cannot read protected data.",
        ]
    ),
)


# 9 - limits/source map
new_page(8, "What to remember and where to look", "limits and references")
add(
    callout("Clinical boundary", "ElderCareAI is a caregiver support tool. A device measurement, statistical insight, Elle reply, or threshold notification is not a diagnosis and should not replace professional or emergency care.", YELLOW),
    Spacer(1, 5 * mm),
    heading("Common misunderstandings"),
    *bullets(
        [
            "<b>Automatic sync is not a continuous live BPM stream.</b> The Fitbit/phone must first get a new reading into Google Health; the webhook and in-app checks can only fetch data already available there.",
            "<b>15 minutes is a retry threshold, not a promised update interval.</b> An unchanged reading may correctly remain visible beyond it.",
            "<b>Saved connected status is not proof of a currently connected watch.</b> The device may be out of range, off, or waiting to upload.",
            "<b>Local reminders are not backend push alerts.</b> They depend on device permissions and the installed app; abnormal-reading warnings are not a guaranteed closed-app emergency service.",
            "<b>Phone location is not live elder tracking.</b> It is an optional foreground location recorded during an authorized sync.",
            "<b>Admin security is not the secret URL.</b> It is separate Auth, live role/status checks, database policies, server authorization, and audit records.",
        ]
    ),
    heading("Source map for technical follow-up"),
    grid(
        ["Question", "Repository location"],
        [
            ["Dependencies / run commands", "package.json; app.json; eas.json; README.md"],
            ["Screens / navigation", "app/; src/components/; src/providers/"],
            ["Automatic refresh", "src/providers/HealthDataProvider.tsx; src/lib/automatic-health-sync.ts"],
            ["Google Health and Elle", "supabase/functions/google-health-*; supabase/functions/ai-care-assistant/"],
            ["Admin and role rules", "website/edcadmin/README.md; supabase/functions/admin-portal/; supabase/migrations/20261011000000_admin_access.sql"],
            ["Database model", "supabase/migrations/; docs/ELDERCAREAI_DATABASE_DESIGN.dbml (older diagram; check newer migrations too)"],
        ],
        [170, CONTENT_W - 170],
    ),
    Spacer(1, 6 * mm),
    p("Prepared from source at commit 5f460e0 on 12 October 2026. Deployed behavior can differ if the production app, database migrations, Google Health subscriber, or Edge Functions are at different revisions. Verify sensitive claims on the actual deployment.", "caption"),
)


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        rightMargin=19 * mm,
        leftMargin=19 * mm,
        topMargin=27 * mm,
        bottomMargin=24 * mm,
        title="ElderCareAI System Guide",
        author="ElderCareAI project documentation",
        subject="Architecture, features, data flow, administration, and operations",
    )
    doc.build(story, onFirstPage=page, onLaterPages=page)
    print(OUT)


if __name__ == "__main__":
    main()
