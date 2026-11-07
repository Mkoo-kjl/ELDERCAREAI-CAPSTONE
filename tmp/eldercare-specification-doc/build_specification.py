from pathlib import Path
from datetime import datetime, timezone
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT = Path(r'C:\ELDERCAREAI-CAPSTONE')
OUT = ROOT / 'output' / 'documents' / 'ElderCareAI_Revised_Implementation_and_System_Specifications.docx'
OUT.parent.mkdir(parents=True, exist_ok=True)
doc = Document()
NEXT_PAGE = False
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.top_margin = sec.bottom_margin = Inches(0.75)
sec.left_margin = sec.right_margin = Inches(1)
sec.header_distance = sec.footer_distance = Inches(0.3)

for name in ['Normal', 'Title', 'Subtitle', 'Heading 1', 'Heading 2', 'Heading 3', 'Caption']:
    sty = doc.styles[name]
    sty.font.name = 'Times New Roman'
    sty.font.color.rgb = RGBColor(0, 0, 0)
    rpr = sty._element.get_or_add_rPr()
    fonts = rpr.rFonts
    for attr in list(fonts.attrib):
        if 'theme' in attr.lower(): del fonts.attrib[attr]
    for tag in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
        fonts.set(qn('w:' + tag), 'Times New Roman')
    for node in list(rpr):
        if node.tag in (qn('w:spacing'), qn('w:kern')): rpr.remove(node)
    ppr = sty._element.find(qn('w:pPr'))
    if ppr is not None:
        for node in list(ppr):
            if node.tag in (qn('w:pBdr'), qn('w:numPr')): ppr.remove(node)
normal = doc.styles['Normal']
normal.font.size = Pt(11)
normal.paragraph_format.line_spacing = 1.08
normal.paragraph_format.space_after = Pt(6)
for name, size in [('Title', 18), ('Heading 1', 14), ('Heading 2', 12), ('Heading 3', 11)]:
    s = doc.styles[name]
    s.font.size = Pt(size)
    s.font.bold = True
    s.paragraph_format.space_before = Pt(10 if name != 'Title' else 0)
    s.paragraph_format.space_after = Pt(7)
    s.paragraph_format.keep_with_next = True
doc.styles['Subtitle'].font.size = Pt(11)
doc.styles['Subtitle'].font.italic = False
doc.styles['Subtitle'].paragraph_format.space_after = Pt(10)
doc.styles['Caption'].font.size = Pt(10)
doc.styles['Caption'].font.italic = True
doc.styles['Caption'].paragraph_format.keep_with_next = True
doc.styles['Caption'].paragraph_format.space_after = Pt(5)

# A restrained running header and an automatic page number.
hp = sec.header.paragraphs[0]
hp.text = 'ElderCareAI | Implementation and System Specifications'
hp.runs[0].font.name = 'Times New Roman'
hp.runs[0].font.size = Pt(9)
hp.runs[0].font.color.rgb = RGBColor(0, 0, 0)
fp = sec.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
fp.add_run('Page ').font.size = Pt(9)
field = OxmlElement('w:fldSimple')
field.set(qn('w:instr'), 'PAGE')
fp._p.append(field)

def p(text='', bold_lead=None, after=6, size=None):
    pp = doc.add_paragraph()
    if bold_lead:
        pp.add_run(bold_lead).bold = True
        pp.add_run(text)
    else:
        pp.add_run(text)
    pp.paragraph_format.space_after = Pt(after)
    pp.paragraph_format.widow_control = True
    if size:
        for run in pp.runs:
            run.font.size = Pt(size)
    return pp

def heading(text, level=1):
    global NEXT_PAGE
    pp = doc.add_heading(text, level)
    if NEXT_PAGE:
        pp.paragraph_format.page_break_before = True
        NEXT_PAGE = False
    return pp

def page():
    global NEXT_PAGE
    NEXT_PAGE = True

def caption(text):
    return doc.add_paragraph(text, 'Caption')

def hyperlink(pp, text, url):
    link = OxmlElement('w:hyperlink')
    link.set(qn('r:id'), pp.part.relate_to(url, RT.HYPERLINK, is_external=True))
    rr = OxmlElement('w:r')
    pr = OxmlElement('w:rPr')
    c = OxmlElement('w:color'); c.set(qn('w:val'), '18586A'); pr.append(c)
    u = OxmlElement('w:u'); u.set(qn('w:val'), 'single'); pr.append(u)
    size = OxmlElement('w:sz'); size.set(qn('w:val'), '19'); pr.append(size)
    fonts = OxmlElement('w:rFonts')
    fonts.set(qn('w:ascii'), 'Times New Roman'); fonts.set(qn('w:hAnsi'), 'Times New Roman'); pr.append(fonts)
    rr.append(pr)
    tt = OxmlElement('w:t'); tt.text = text; rr.append(tt)
    link.append(rr); pp._p.append(link)

def sources(items):
    pp = p('Technical references: ', size=9.5, after=5)
    for i, (text, url) in enumerate(items):
        if i: pp.add_run('; ')
        hyperlink(pp, text, url)
    pp.add_run('. Accessed 3 November 2026.')
    for run in pp.runs: run.font.size = Pt(9.5)
    return pp

def table(headers, rows, widths, center=(), right=(), bold_rows=(), font=10.5, pad=75):
    tt = doc.add_table(rows=1, cols=len(headers))
    tt.alignment = WD_TABLE_ALIGNMENT.CENTER
    tt.autofit = False
    pr = tt._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for side in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        b = OxmlElement('w:' + side)
        for k, v in [('val', 'single'), ('sz', '5'), ('color', 'D9D9D9')]: b.set(qn('w:' + k), v)
        borders.append(b)
    pr.append(borders)
    for col, width in zip(tt.columns, widths): col.width = Inches(width)
    for j, h in enumerate(headers): tt.rows[0].cells[j].text = h
    for row in rows:
        cells = tt.add_row().cells
        for j, value in enumerate(row): cells[j].text = str(value)
    for i, row in enumerate(tt.rows):
        row_pr = row._tr.get_or_add_trPr()
        cant = OxmlElement('w:cantSplit'); row_pr.append(cant)
        if i == 0:
            repeat = OxmlElement('w:tblHeader'); row_pr.append(repeat)
        for j, cell in enumerate(row.cells):
            cell.width = Inches(widths[j])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            tcpr = cell._tc.get_or_add_tcPr()
            mar = OxmlElement('w:tcMar')
            for side, val in [('top', pad), ('bottom', pad), ('left', 100), ('right', 100)]:
                el = OxmlElement('w:' + side); el.set(qn('w:w'), str(val)); el.set(qn('w:type'), 'dxa'); mar.append(el)
            tcpr.append(mar)
            if i == 0 or i - 1 in bold_rows:
                sh = OxmlElement('w:shd'); sh.set(qn('w:fill'), 'E9EEF0' if i == 0 else 'F4F4F4'); tcpr.append(sh)
            for pp in cell.paragraphs:
                pp.paragraph_format.space_before = Pt(0)
                pp.paragraph_format.space_after = Pt(0)
                pp.paragraph_format.line_spacing = 1.02
                pp.paragraph_format.widow_control = True
                if j in center: pp.alignment = WD_ALIGN_PARAGRAPH.CENTER
                elif j in right: pp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                for run in pp.runs:
                    run.font.name = 'Times New Roman'
                    run.font.size = Pt(font)
                    run.font.color.rgb = RGBColor(0, 0, 0)
                    run.bold = i == 0 or i - 1 in bold_rows
    p('', after=2, size=3)
    return tt

def req(n, title, text):
    return p(text, bold_lead=f'{n}. {title} ', after=7)

# PAGE 1 — complete budget, with user-confirmed revised figures.
doc.add_paragraph('ElderCareAI', 'Title')
doc.add_paragraph('An AI-Driven IoT System for Elderly Monitoring and Caregiver Support', 'Subtitle')
heading('1. Implementation Budget and Cost Specification')
p('The following budget covers one development laptop, one Android phone, one Galaxy Watch6, one month of internet and electricity, and a project food allowance. Amounts are expressed in Philippine pesos (PHP).')
caption('Table 1. Estimated implementation cost')
budget = [
    ('Laptop', 'One unit', '₱30,000.00'),
    ('Android phone', 'One unit', '₱14,000.00'),
    ('Samsung Galaxy Watch6', 'One unit', '₱4,500.00'),
    ('Hardware subtotal', '', '₱48,500.00'),
    ('Visual Studio Code and Android Studio', 'No-cost development tools', '₱0.00'),
    ('React Native, Expo and required SDKs', 'Prototype development', '₱0.00'),
    ('Supabase', 'Free-plan allowance', '₱0.00'),
    ('Firebase FCM and Expo Push Service', 'No-cost messaging services', '₱0.00'),
    ('Gemini API and Expo build services', 'Within available no-cost quotas', '₱0.00'),
    ('Software subtotal', '', '₱0.00'),
    ('Internet connection', 'One month', '₱1,699.00'),
    ('Electricity', 'One month', '₱3,000.00'),
    ('Food allowance', 'Project allowance', '₱2,000.00'),
    ('Operating and miscellaneous subtotal', '', '₱6,699.00'),
    ('TOTAL IMPLEMENTATION BUDGET', 'One-month budget basis', '₱55,199.00'),
]
table(['Item', 'Cost basis', 'Estimated amount'], budget, [2.95, 2.05, 1.5], right=(2,), bold_rows=(3,9,13,14), font=10.5)
p('The laptop and phone amounts are retained from the proposed budget. The watch, internet and electricity amounts reflect the revised project estimates. The food allowance is treated as a single project expense.', size=10.5)
p('Internet and electricity total ₱4,699.00 per month. For a longer implementation period, add ₱4,699.00 for each additional month. The one-month total does not include labor, repairs, store-publishing fees, or paid cloud/API usage beyond the budgeted no-cost allowances.', size=10.5)
p('Zero-cost software entries describe the prototype budget, not unlimited service capacity or an open-source license for every product. Review provider quotas before expanding the system.', size=10.5)
sources([
    ('Supabase pricing', 'https://supabase.com/pricing'),
    ('Firebase pricing', 'https://firebase.google.com/pricing'),
    ('Expo service costs', 'https://docs.expo.dev/faq/'),
    ('Expo Push Service cost', 'https://docs.expo.dev/push-notifications/faq/'),
    ('Gemini API pricing', 'https://ai.google.dev/gemini-api/docs/pricing'),
])

# PAGE 2 — software specification, in a single coherent comparison.
page()
heading('2. Software Specification')
p('ElderCareAI uses a custom Android mobile application, a native Wear OS watch application, a web administration portal, and a Supabase cloud backend. Galaxy Watch6 supplies supported sensor and GPS updates. The phone imports sleep and recorded oxygen history through the Samsung Health Data SDK.')
caption('Table 2. Software development and deployment requirements')
software = [
    ('Mobile application', 'React Native, Expo and TypeScript / JavaScript', 'Caregiver dashboard, live readings, map, care plans, alerts, reports and Elle AI.'),
    ('Mobile build', 'Custom Android APK with native modules', 'Includes Samsung data access and Android push support. Expo Go cannot load these custom native integrations.'),
    ('Watch application', 'Kotlin, Android SDK and Wear OS', 'Collects supported sensor and GPS updates; provides monitoring controls, spot oxygen measurement, SOS and medication actions.'),
    ('Health integrations', 'Samsung Health Sensor SDK and Samsung Health Data SDK', 'The watch SDK supplies supported sensor readings. The phone SDK imports available sleep and recorded oxygen history.'),
    ('Database and cloud services', 'Supabase PostgreSQL, Auth, Realtime and Storage', 'Stores accounts, patient records, vital events, location updates, care schedules and alerts; synchronizes authorized views.'),
    ('Server-side processing', 'TypeScript in Supabase Edge Functions; PostgreSQL SQL functions', 'Uses a Deno-compatible Edge Runtime, with database rules, scheduled work and notification queues.'),
    ('Notifications', 'Expo Notifications, Expo Push Service and Firebase Cloud Messaging v1', 'Delivers Android push alerts and care reminders; uses Android sound channels and local reminders where configured.'),
    ('AI assistance', 'Gemini API through server-side functions', 'Elle answers caregiver questions using saved patient context. Historical fact queries use stored records; statistical trends support summaries.'),
    ('Administration portal', 'HTML, CSS and JavaScript in a modern browser', 'Authorized administration of accounts, patient records, stored monitoring data, reports and audit history.'),
    ('Development tools', 'Visual Studio Code, Android Studio, Android SDK, Gradle, JDK and Node.js', 'Supports mobile/web development and APK builds. Node.js is development tooling; the Edge Functions runtime is Deno-compatible.'),
]
table(['Component', 'Technology', 'Purpose'], software, [1.25,2.0,3.25], font=10.5, pad=80)
p('Install the phone and watch applications with compatible signing credentials. Configure Google sign-in, Samsung SDK access, backend secrets and Firebase/Expo credentials. Developer testing and public distribution have different Samsung SDK access requirements; production use must satisfy Samsung’s applicable registration process.', bold_lead='Deployment requirements. ', size=10.5)
sources([
    ('Expo custom native code', 'https://docs.expo.dev/workflow/customizing/'),
    ('Supabase Edge Functions', 'https://supabase.com/docs/guides/functions'),
    ('Expo FCM v1 credentials', 'https://docs.expo.dev/push-notifications/fcm-credentials/'),
])

# PAGE 3 — separate development-computer requirements from runtime devices.
page()
heading('3. Hardware Specification')
p('The development computer, caregiver phone and patient watch perform different functions and therefore have separate requirements. The following development baseline is intended for a physical-device testing workflow; emulator use requires additional resources.')
caption('Table 3. Development computer requirements')
table(['Component', 'Minimum baseline', 'Recommended configuration'], [
    ('Operating system', '64-bit Windows 10 supported by the development tools', 'A currently supported 64-bit Windows release'),
    ('Processor', 'Compatible 64-bit processor; virtualization support for emulator use', 'Recent Intel Core i5 / AMD Ryzen 5 class or better'),
    ('Memory', '8 GB RAM for Android Studio without an emulator', '16 GB for physical-device work; 32 GB for heavier emulator use'),
    ('Storage', 'Space for Android Studio, SDKs, Gradle caches and project files', 'SSD with at least 32 GB free for tools, plus project and build space'),
    ('Display and connectivity', '1280 × 800 display; internet and USB or wireless debugging', '1920 × 1080 or higher; stable internet and USB access'),
], [1.2,2.6,2.7], font=10.5)
caption('Table 4. Runtime devices and infrastructure')
table(['Device / service', 'Requirement'], [
    ('Caregiver Android phone', 'Android 10 / API 29 or later; Bluetooth, Wi-Fi or mobile data, location services and notification support. Google Play services are needed for FCM delivery. Android 13 or later is preferred for current permission controls.'),
    ('Patient smartwatch', 'Samsung Galaxy Watch6 with a supported Wear OS / Health Sensor Service version, the ElderCareAI watch APK, enabled sensor and location permissions, and adequate charge.'),
    ('Health history on phone', 'Samsung Health 6.30.2 or later and Galaxy Wearable, with the patient’s watch paired to the same phone. Grant the required sleep and blood-oxygen read access.'),
    ('Administrator workstation', 'A laptop or desktop with a modern web browser and a secure internet connection. A dedicated on-premises database server is not required.'),
    ('Network and power', 'Internet access for uploads and cloud services; Bluetooth for watch–phone features where used. Provide the proper phone/watch chargers. Active sensors and GPS increase battery use.'),
], [1.35,5.15], font=10.5)
p('Sensor scope. The watch provides optical heart-rate/oxygen sensing, wrist skin-temperature sensing, motion sensing and GPS. Sleep and stress are derived records or calculations rather than separate physical sensors. GPS accuracy depends on permissions, signal conditions and a valid location fix. Compatibility with other watch models requires separate testing.', size=10.5)
sources([
    ('Android Studio system requirements', 'https://developer.android.com/studio/install'),
    ('Samsung Health Data SDK requirements', 'https://developer.samsung.com/health/data/overview.html'),
])

# PAGE 4 — user roles, followed by core program functions.
page()
heading('4. Human Resource Specification')
p('ElderCareAI supports three user groups. Access to patient information depends on the authenticated user’s role and assigned records.')
heading('4.1 Caregiver', 2)
p('The caregiver manages the assigned older adult’s profile, pairs the watch, reviews readings and location, maintains medications and appointments, responds to alerts, and consults Elle AI. The caregiver also enables notification permissions and checks whether displayed data is current.')
heading('4.2 System Administrator', 2)
p('The administrator uses the web portal to manage authorized user accounts and patient records, review stored monitoring data and audit activity, and generate system reports. Administrative privileges must be restricted to approved personnel.')
heading('4.3 Older Adult / Watch Wearer', 2)
p('The older adult wears the Galaxy Watch6, keeps it charged, and uses the watch’s monitoring, spot oxygen, SOS and medication controls as needed. The caregiver can assist with setup and permissions. A separate caregiver-style phone account is not required simply to wear the paired watch.')
heading('5. Program Specification')
heading('5.1 Functional Requirements', 2)
req('FR-01', 'Authentication and profiles.', 'Provide caregiver Google sign-in and separate authenticated administrator access. Maintain caregiver, patient and emergency-contact details with role-based access.')
req('FR-02', 'Watch integration.', 'Pair the Galaxy Watch6 with the correct patient, request the necessary permissions, display connection status and provide monitoring start/stop controls.')
req('FR-03', 'Health monitoring.', 'Display supported heart rate, oxygen, wrist skin temperature, steps, sleep and derived stress/HRV information with units and individual measurement times.')
req('FR-04', 'Vital-event history.', 'Save every accepted new vital event with its original time and source. Retain unacknowledged watch samples for retry and prevent duplicate retry records. Missing metrics remain blank rather than being fabricated.')
req('FR-05', 'Location tracking.', 'Display the patient’s latest valid watch location and update the map when new positions arrive. Indicate location age or accuracy so an old fix is not presented as current movement.')
req('FR-06', 'Medications and appointments.', 'Create, update and display care schedules, instructions and reminders. Synchronize supported medication “Taken” actions between watch and app, with clear save and reminder-setup feedback.')

# PAGE 5 — remaining functional requirements and realistic collection behavior.
page()
heading('5.1 Functional Requirements (continued)', 2)
req('FR-07', 'Threshold alerts.', 'Evaluate valid uploaded readings against the configured app review rules. Save threshold warnings in Alerts and Notifications, apply duplicate/cooldown controls, and queue caregiver push delivery.')
req('FR-08', 'SOS and notifications.', 'Allow a watch SOS request to create a caregiver alert. Deliver SOS, vital warnings, medication reminders and appointment reminders through the configured notification paths. SOS is an assistance request, not an automatic emergency-services dispatch.')
req('FR-09', 'Health history import.', 'Import permitted sleep and recorded oxygen data from the selected patient watch through the phone’s health history integration. Retry failed uploads without inventing or duplicating readings.')
req('FR-10', 'Elle AI and analytics.', 'Answer questions about saved patient history, summarize trends and provide clearly qualified statistical insights. Distinguish missing data from a confirmed negative result; avoid diagnosis or guaranteed health predictions.')
req('FR-11', 'Reports.', 'Provide patient vital-history and medication-schedule PDF exports, together with authorized administrative reporting.')
req('FR-12', 'Administration and settings.', 'Support account and record management, audit review, device status, notification preferences and sound settings. Expose clear permission, connectivity and synchronization errors.')
heading('5.2 Data Collection and Update Behavior', 2)
caption('Table 5. Availability of monitored data')
table(['Data', 'Collection and update behavior'], [
    ('Heart rate', 'Updates from valid delivered watch sensor events while monitoring. New accepted readings are logged individually, including values above the warning threshold.'),
    ('Blood oxygen (SpO₂)', 'Manual spot measurements and optional automatic spot checks while the watch app is in the foreground. Recorded overnight oxygen is imported when available; this is not a continuous background oxygen stream.'),
    ('Wrist skin temperature', 'Uses valid supported skin-contact readings. This value is wrist skin temperature, not core body temperature.'),
    ('HRV / stress level', 'Rolling RMSSD HRV is calculated from valid beat intervals over about 30–60 seconds. A personal reference supports an experimental 0–100 stress estimate; no score is invented while the baseline is insufficient.'),
    ('Steps', 'Uses step-counter updates while monitoring. Time when monitoring is off cannot be assumed to have complete step coverage.'),
    ('Sleep', 'Imports actual sleep sessions after they are available through the health-history SDK. It does not stream second by second or guarantee delivery immediately on waking.'),
], [1.25,5.25], font=10.5)
p('Live updates are limited by sensor delivery, signal quality, connection state and upload success. Each vital retains its own measurement time. The stress estimate is experimental and not medical grade.', size=10.5)
sources([('Samsung sensor data and on-demand limitations', 'https://developer.samsung.com/health/sensor/guide/data-specifications.html')])

# PAGE 6 — exact current thresholds and the original nonfunctional scope.
page()
heading('5.3 Automatic Vital Review Rules', 2)
p('The following are the current application review rules. They are not individualized medical limits and should not be presented as a diagnosis or as proof that a patient is safe.')
caption('Table 6. Configured threshold warnings')
table(['Metric', 'Warning condition', 'Evaluation basis'], [
    ('Heart rate', 'Below 50 BPM or above 110 BPM', 'A valid new recorded sample. Exactly 110 BPM does not meet the high-rate rule.'),
    ('SpO₂', 'Below 95%', 'An accepted spot or imported oxygen reading; continuous coverage is not implied.'),
    ('Sleep duration', 'Recorded session below 5 hours', 'Evaluated after the sleep record becomes available and is imported.'),
    ('Wrist skin temperature', 'Change of at least 0.8°C AND at least 2 standard deviations', 'Requires at least five recent same-watch reference readings; uses up to seven readings within 24 hours.'),
    ('HRV, stress and steps', 'No automatic threshold configured', 'Displayed and recorded where available; these values do not currently generate automatic threshold warnings.'),
], [1.25,2.2,3.05], font=10.5)
p('A qualifying reading can create a warning after upload. Repeated notices for an active live rule are limited to one per hour; a return to range and a new crossing reset it. Imported records use deduplication. Push work is triggered after database commit, with scheduled recovery. Android and network conditions affect delivery.', size=10.5)
heading('5.4 Nonfunctional Requirements', 2)
req('NFR-01', 'Data quality.', 'Validate values, timestamps and sensor quality. Mark missing or stale data clearly. Consumer wearable readings and derived scores must not be represented as clinical-grade measurements.')
req('NFR-02', 'Security and privacy.', 'Use authenticated access, role checks, database row-level policies and encrypted network communication. Keep privileged backend, AI and push credentials out of client code.')
req('NFR-03', 'Reliability and integrity.', 'Use event identifiers, acknowledgments and retries to reduce data loss and duplicate history. Preserve independent measurement times and source details.')
req('NFR-04', 'Responsiveness.', 'Display new accepted data and queue threshold alerts promptly. Sensor intervals, continuous coverage and notification arrival times cannot be guaranteed.')
req('NFR-05', 'Background operation.', 'Support Android push when the app is not open, using the correct APK, credentials, registration and permission. Force-stop, offline state, battery policies, muted channels and Do Not Disturb can affect delivery or sound.')
req('NFR-06', 'Usability and compatibility.', 'Use readable labels, units, clear controls and understandable errors. Validate supported Android phones, Galaxy Watch6 and modern-browser administrator access.')
req('NFR-07', 'Maintainability and capacity.', 'Keep mobile, watch and backend modules organized and testable. Monitor database growth, cloud quotas, failures and retry queues as the number of patients and recorded samples increases.')

# PAGE 7 — preserve the three proponents and six modules each.
page()
heading('6. Proposed Module Assignments')
p('This proposed allocation covers the updated Galaxy Watch6 system, health-history import, Elle AI and notifications. Each proponent owns six modules for implementation and testing, for a total of 18 modules.')
caption('Table 7. Module ownership and user participation')
modules = [
    ('Kristoffer James G. Layos', 'Landing page and role dashboards', '—','Yes','Yes'),
    ('', 'Login, authentication and role control', '—','Yes','Yes'),
    ('', 'Profiles and settings', '—','Yes','Yes'),
    ('', 'Caregiver account management', '—','—','Yes'),
    ('', 'Administrator access management', '—','—','Yes'),
    ('', 'Security and audit logs', '—','—','Yes'),
    ('John Wayne C. Planos', 'Watch pairing and sensor integration', 'Yes','Yes','—'),
    ('', 'Live vital signs and activity', 'Yes','Yes','—'),
    ('', 'Oxygen measurement and sleep history', 'Yes','Yes','—'),
    ('', 'HRV and experimental stress estimate', 'Yes','Yes','—'),
    ('', 'Medication and appointment care', 'Yes','Yes','—'),
    ('', 'Health history and PDF reports', '—','Yes','Yes'),
    ('Melvence R. Bagonggong', 'SOS and caregiver response', 'Yes','Yes','—'),
    ('', 'Automatic vital-threshold alerts', '—','Yes','Yes'),
    ('', 'GPS tracking and map updates', 'Yes','Yes','—'),
    ('', 'Caregiver push and reminder notifications', '—','Yes','Yes'),
    ('', 'Elle AI and health analytics', '—','Yes','—'),
    ('', 'System reports and device-status monitoring', '—','—','Yes'),
]
tt = table(['Proponent', 'Assigned module', 'Watch\nwearer', 'Caregiver', 'Admin'], modules, [1.35,3.05,0.7,0.78,0.62], center=(2,3,4), font=10.5, pad=70)
for start in (1, 7, 13):
    cell = tt.cell(start,0).merge(tt.cell(start+5,0))
    cell.text = modules[start-1][0]
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    for pp in cell.paragraphs:
        pp.paragraph_format.line_spacing = 1.02
        pp.paragraph_format.space_after = Pt(0)
        for run in pp.runs:
            run.font.name = 'Times New Roman'; run.font.size = Pt(10.5)
p('“Yes” indicates use or participation, including wearing the watch. It does not grant permissions. A dash indicates no primary participation. Role totals overlap because modules can serve several groups.', size=10.5)
caption('Table 8. Module participation totals (one point per included module)')
counts = []
for name, start in [('Kristoffer James G. Layos',0), ('John Wayne C. Planos',6), ('Melvence R. Bagonggong',12)]:
    counts.append((name, '6', *[str(sum(row[j]=='Yes' for row in modules[start:start+6])) for j in (2,3,4)]))
counts.append(('TOTAL', '18', '7', '14', '10'))
table(['Proponent', 'Modules', 'Watch wearer', 'Caregiver', 'Admin'], counts, [2.7,.7,1.05,1.05,1.0], center=(1,2,3,4), bold_rows=(3,), font=10.5, pad=65)

# Keep pricing references with the financial assumptions without creating a
# detached references page. All technical links are ordinary editable links.
first_section_note = doc.paragraphs[0]  # retained for XML checks below

doc.core_properties.title = 'ElderCareAI: Revised Implementation and System Specifications'
doc.core_properties.subject = 'Implementation budget, software, hardware, users, program requirements and module assignments'
doc.core_properties.author = 'ElderCareAI Project Team'
doc.core_properties.keywords = 'ElderCareAI, Galaxy Watch6, implementation budget, system specifications'
doc.core_properties.comments = ''
doc.core_properties.created = datetime(2026,11,3,0,0,tzinfo=timezone.utc)
doc.core_properties.modified = datetime(2026,11,3,0,0,tzinfo=timezone.utc)

# Deterministic checks for the supplied costs and the proposed role matrix.
assert 30000 + 14000 + 4500 == 48500
assert 1699 + 3000 + 2000 == 6699
assert 48500 + 6699 == 55199
assert len(modules) == 18
assert [sum(row[j]=='Yes' for row in modules) for j in (2,3,4)] == [7,14,10]
assert all(sum(1 for _ in modules[s:s+6]) == 6 for s in (0,6,12))
doc.save(OUT)
print(OUT)
