from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml import OxmlElement

ROOT=Path('C:/ELDERCAREAI-CAPSTONE')
OUT=ROOT/'output/documents/2026-11-08-current-system'
OUT.mkdir(parents=True,exist_ok=True)

def clean(doc):
    body=doc._element.body
    for child in list(body):
        if not child.tag.endswith('sectPr'): body.remove(child)
    return doc

def page(doc):
    section=doc.sections[0]
    section.page_width=Inches(8.5);section.page_height=Inches(11)
    section.top_margin=Inches(.7);section.bottom_margin=Inches(.7)
    section.left_margin=Inches(.72);section.right_margin=Inches(.72)
    for style in ['Normal','Title','Heading 1','Heading 2']:
        doc.styles[style].font.name='Times New Roman'
    doc.styles['Normal'].font.size=Pt(10.5)
    doc.styles['Title'].font.size=Pt(16)
    doc.styles['Title'].font.color.rgb=RGBColor(0,0,0)
    doc.styles['Heading 1'].font.size=Pt(12)
    doc.styles['Heading 1'].font.color.rgb=RGBColor(0,0,0)
    return doc

def shade(cell,color):
    tcPr=cell._tc.get_or_add_tcPr();element=OxmlElement('w:shd');element.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill',color);tcPr.append(element)

def table(doc,heads,rows,widths=None):
    t=doc.add_table(rows=1,cols=len(heads));t.style='Table Grid';t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    for i,text in enumerate(heads):t.rows[0].cells[i].text=text;shade(t.rows[0].cells[i],'DCE6ED')
    for row in rows:
        cells=t.add_row().cells
        for i,text in enumerate(row):cells[i].text=str(text)
    for row in t.rows:
        for i,cell in enumerate(row.cells):
            cell.vertical_alignment=1
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after=Pt(2)
                for run in paragraph.runs:run.font.name='Times New Roman';run.font.size=Pt(8)
    for cell in t.rows[0].cells:
        for p in cell.paragraphs:
            for run in p.runs:run.bold=True
    if widths:
        for row in t.rows:
            for cell,width in zip(row.cells,widths):cell.width=Inches(width)
    for row in t.rows[1:]:
        for cell in row.cells:shade(cell,'F6F8FA' if row._tr.getparent().index(row._tr)%2 else 'FFFFFF')
    return t

def fit_test_table(doc,widths):
    section=doc.sections[0]
    section.orientation=WD_ORIENT.LANDSCAPE
    section.page_width=Inches(11);section.page_height=Inches(8.5)
    section.left_margin=Inches(.5);section.right_margin=Inches(.5)
    section.top_margin=Inches(.55);section.bottom_margin=Inches(.55)
    tbl=doc.tables[0]
    tbl.autofit=False
    for col,width in zip(tbl.columns,widths): col.width=Inches(width)
    for row in tbl.rows:
        for cell,width in zip(row.cells,widths):
            cell.width=Inches(width)
            cell.vertical_alignment=1
            tcPr=cell._tc.get_or_add_tcPr()
            borders=tcPr.first_child_found_in('w:tcBorders')
            if borders is None:
                borders=OxmlElement('w:tcBorders');tcPr.append(borders)
            for side in ('top','left','bottom','right'):
                edge=OxmlElement(f'w:{side}')
                edge.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val','single')
                edge.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sz','4')
                borders.append(edge)
            for p in cell.paragraphs:
                p.paragraph_format.space_after=Pt(0)
                for run in p.runs:
                    run.font.name='Times New Roman';run.font.size=Pt(7.3)
    for cell in tbl.rows[0].cells:
        for p in cell.paragraphs:
            for run in p.runs:run.bold=True
    header=tbl.rows[0]._tr.get_or_add_trPr()
    repeat=OxmlElement('w:tblHeader');repeat.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val','true');header.append(repeat)
    return doc

UNIT=[
('CASE-074','Vitals','BPM display bands','Compare 49, 50, 79, 80, 110 and 111 BPM.','Labels change at 50 and 80; warning remains strictly above 110.','care-usability.test.ts'),
('CASE-075','Vitals','Other status labels','Check saved oxygen, sleep, activity, HRV stress and skin temperature.','Each metric has a readable label with an appropriate state.','care-usability.test.ts'),
('CASE-076','Medication','Time parsing','Convert midnight, noon and database seconds into 12-hour time.','AM/PM values are correct and invalid times rejected.','care-usability.test.ts'),
('CASE-077','Medication','Time zone boundaries','Convert Manila medication times and reject DST gaps.','Saved wall clocks are not interpreted as UTC.','care-usability.test.ts'),
('CASE-078','Care plan','Chronology','Sort same-day dose times and appointment phases.','Events use actual date and time; completed status is distinct.','care-usability.test.ts'),
('CASE-079','Analytics','Chart integrity','Reduce 200 readings for display.','Original endpoints and extremes remain; no average is invented.','monitoring-chart.test.tsx'),
('CASE-080','Analytics','Chart controls','Switch line and thin bar display and inspect a reading.','Both chart modes and original timestamps are available.','monitoring-chart.test.tsx'),
('CASE-081','Steps','Daily total','Read cumulative step samples around Manila midnight.','One maximum per calendar day; samples are not summed.','monitoring-chart.test.tsx'),
('CASE-082','Reminders','Local ownership','Deliver repeating reminders to account and patient scope.','Different delivery dates have distinct IDs; foreign scope is rejected.','monitoring-chart.test.tsx'),
('CASE-083','Reminders','Popup queue','Queue two events with one duplicate.','Each unique event appears once in sequence.','care-usability.test.ts'),
('CASE-084','Medication','Prescription draft','Normalize incomplete extracted prescription fields.','Unknown times, dose and prescriber stay blank.','care-usability.test.ts'),
('CASE-085','Emergency','Contact priority','Read contacts stored in an arbitrary order.','Caregiver, family member and doctor are always ordered 1 to 3.','emergency-contacts.test.tsx'),
('CASE-086','Alerts','Collapsible rules','Open and close automatic vital alerts.','Rules begin collapsed and are accessible when expanded.','care-ui-updates.test.tsx'),
('CASE-087','Prescription','Elle entry','Open optional prescription scan from Elle card.','Elle illustration and draft-review entry are visible.','care-ui-updates.test.tsx'),
]
INT=[
('INT-026','Watch alert','Foreground queue','Two local care reminders fire together while app is open.','Medication and appointment each show a separate popup and play audio.','watch-sos-observer.test.tsx'),
('INT-027','Notification owner','Caregiver session','A reminder carries a different account or patient.','No foreign-account or foreign-patient popup appears.','watch-sos-observer.test.tsx'),
('INT-028','Monitoring records','Analytics chart','Supabase returns saved readings and a new event.','Actual values, timestamps and live updates appear; foreign rows are omitted.','care-images-analytics.test.tsx'),
('INT-029','Watch steps','Daily history','Daily step RPC returns a saved total, then a higher update.','One displayed day changes to the new total without double-counting.','care-images-analytics.test.tsx'),
('INT-030','Medication image','Private storage','Save an image and request its display URL.','Owner and patient path is used; an expiring signed URL loads it.','care-images-analytics.test.tsx'),
('INT-031','Prescription draft','Medication save','Caregiver edits extracted text, adds a photo and confirms.','No medication saves before confirmation; corrected fields are saved.','medication-editor.test.tsx'),
('INT-032','Emergency contacts','Dial action','Open contact priority and choose caregiver.','Priority list appears and only selected number opens the dialer.','emergency-contacts.test.tsx'),
('INT-033','Care plan','Appointments','Load past, future and completed visits into Schedule.','Upcoming visits sort by date/time and completed activity is separate.','care-timeline.test.tsx'),
]

unit=Document(ROOT/'docs/UNIT_TEST_TABLE.docx')
unit.paragraphs[1].text='Jest and React Native Testing Library  |  CASE-001 to CASE-087 selected test cases'
for id,module,name,action,expected,source in UNIT:
    cells=unit.tables[0].add_row().cells
    for cell,value in zip(cells,['',module,name,'',id,action,expected,'Performed as expected','Passed']):cell.text=value
unit.add_paragraph('CASE-074 to CASE-087 each have a matching CASE-###.test.tsx source file. CASE-088 to CASE-127 are additional numbered regression suites. The complete run passed 272 tests in 160 suites on 9 November 2026. Tests using mocked native or service boundaries still require actual watch and phone evidence for device delivery.')
fit_test_table(page(unit),[.58,.95,.9,.56,.63,2.18,2.23,1.25,.55]).save(OUT/'ElderCareAI_Unit_Testing_Current.docx')

integ=Document(ROOT/'docs/INTEGRATION_TEST_TABLE.docx')
integ.paragraphs[1].text='Integration testing covers INT-001 to INT-033, each in a matching INT-###.test.tsx file. The complete Jest run passed 272 tests in 160 suites on 9 November 2026.'
for id,module,process,action,expected,source in INT:
    cells=integ.tables[0].add_row().cells
    values=['',id,module,action,process,'Controlled test fixture exists',expected,'Performed as expected','Passed']
    for cell,value in zip(cells,values):cell.text=value
integ.add_paragraph('INT-026 to INT-033 each have a matching numbered source file. Supabase queries and native interfaces are mocked in these app tests. The separate isolated PostgreSQL watch-migration run covers daily step deduplication and database access; physical notification and GPS delivery still need device demonstration.')
fit_test_table(page(integ),[.58,.66,.85,1.70,.90,1.58,2.00,1.10,.60]).save(OUT/'ElderCareAI_Integration_Testing_Current.docx')

SCREENS=[
('Sign in','Capture the Sign in with Google button.','Open the new phone build; sign in with the caregiver account.'),
('Care setup','Capture caregiver and older-adult setup with private fields concealed.','Complete profiles and continue to the wearable step.'),
('Watch pairing','Capture Connect or change watch and the paired Galaxy Watch6 status.','Pair the patient watch and allow sensor, activity and location permissions.'),
('Watch monitoring','Capture the watch with Start monitoring or the active live walk state.','Open ElderCareAI on the watch and start monitoring; a watch screenshot or photo is suitable.'),
('Home dashboard','Capture current vitals and their text status badges.','Check that incoming watch BPM changes its label; 80 to 110 is the high display band.'),
('Health vitals','Capture BPM, oxygen, sleep, steps, skin temperature and stress when available.','Show the actual measurement time; unavailable metrics may show waiting or baseline text.'),
('Vital detail','Capture the heart-rate detail and one status label.','Tap a vital card to see its original value, time and general wellness explanation.'),
('Health history','Capture Settings > Health History with its sync status and one saved sleep record.','Sleep and overnight oxygen are imported after Samsung Health records and syncs them.'),
('Analytics','Capture Line and Bar chart modes, date filter and one selected timestamp.','Open Health > Analytics; change metric or date range and inspect actual saved measurements.'),
('Preventive insights','Capture Health > AI Insights for one recorded vital.','Read the dated general wellness context; it does not establish a diagnosis.'),
('Live location','Capture the watch marker, location source, accuracy and safe-zone outline.','Start watch live walk outdoors with internet; confirm the marker changes while phone stays still.'),
('Medication list','Capture Care > Medications with image, 12-hour reminder time and status.','Use a demonstration medication if the actual list contains private details.'),
('Prescription draft','Capture Elle prescription card and the review form.','Choose an image, inspect the draft, correct errors and confirm against the original before saving.'),
('Care schedule','Capture Care > Schedule with two different times and an activity status.','Check chronological order for future appointments and medications.'),
('Appointment','Capture Care > Appointments and a saved upcoming visit.','Enter purpose, date, time, doctor and location; check the 15-minute and at-time reminders.'),
('Alerts and SOS','Capture collapsed Automatic vital alerts and visible SOS button.','Open Alerts; expand rules for a second screenshot if showing review thresholds.'),
('Emergency contacts','Capture caregiver, family and doctor priority with numbers concealed.','Set names and phones in Settings; open the SOS contact list without placing a test call.'),
('Notifications','Capture two saved messages or a single alert with original time.','For a same-time demonstration, schedule two safe demo reminders and dismiss each popup in turn.'),
('Elle assistant','Capture a non-identifying question and its answer.','Ask about existing saved records; confirm the response is based on available data.'),
('Settings and exports','Capture Galaxy Watch6 integration, background notification option and PDF exports.','Enable background notifications on the caregiver phone when Firebase is configured.'),
]

guide=page(clean(Document(ROOT/'docs/ELDERCAREAI_USER_GUIDE.docx')))
guide.add_paragraph('ElderCareAI Caregiver User Guide',style='Title')
guide.add_paragraph('Phone application 1.4.1 and Galaxy Watch6 application 1.4.5. This guide follows the current caregiver workflow and names the screen to capture for each report figure. Use a demonstration account or conceal names, phone numbers, medical notes and exact map coordinates.')
guide.add_paragraph('Watch heart rate and live location update while monitoring and connectivity are active. Spot oxygen requires a manual measurement; sleep and overnight records arrive after Samsung Health sync. Missing data is not a normal measurement. App status bands and the HRV stress estimate are not medical diagnoses.')
for number,(title,shot,steps) in enumerate(SCREENS,1):
    guide.add_heading(f'{number} {title}',level=1)
    p=guide.add_paragraph(f'Figure {number}. {title}. {shot}');p.runs[0].italic=True
    guide.add_paragraph(steps)
guide.add_heading('Screenshot checklist for the administrator portal',level=1)
for label,desc in [
 ('Admin sign in','Separate administrator account sign-in; hide credentials.'),
 ('Overview','Caregiver and patient counts, sync age and recent events.'),
 ('Manage accounts','Caregiver list and its linked older-adult profiles; hide identifying fields.'),
 ('System monitor','Watch pairing and vital sync status, with IDs masked.'),
 ('Alerts and notifications','Alert, notification and emergency lists with personal details concealed.'),
 ('Generate reports','Date filters and a CSV report action; do not show patient identifiers.'),
 ('Manage security','Admin list and audit activity, with emails and IDs concealed.')]:
    guide.add_paragraph(f'{label}: {desc}',style='List Bullet')
guide.add_heading('Demonstration checks',level=1)
guide.add_paragraph('For a same-time reminder check, save a demonstration medication and appointment several minutes ahead at the same time. Keep the app open, dismiss the first popup and capture the second separately. Use the phone notification list for background evidence. Clear demonstration entries afterward.')
guide.add_paragraph('For GPS, keep the paired phone stationary and watch the source and accuracy indicator while the watch wearer walks within Wi-Fi coverage. A 10–20 metre home safe zone should be tested only after a fresh accurate watch fix; poor accuracy can delay the exit decision.')
guide.save(OUT/'ElderCareAI_User_Guide_Current.docx')

workflow=page(clean(Document(ROOT/'docs/ELDERCAREAI_USER_GUIDE.docx')))
workflow.add_paragraph('ElderCareAI Program and Administrator Workflows',style='Title')
workflow.add_paragraph('These flows describe the current phone, watch and administrator portal. The accompanying editable Mermaid files contain the diagrams. Yes and No branches below define the major decisions and their next steps.')
workflow.add_heading('Program workflow',level=1)
table(workflow,['Step','Decision or action','Yes path','No path'],[
 ('1','Caregiver sign in succeeds','Check setup and patient profile.','Show error and retry sign in.'),
 ('2','Caregiver and patient setup complete','Check watch pairing.','Resume missing setup forms.'),
 ('3','Galaxy Watch6 paired and permissions granted','Start watch monitoring.','Pair or repair connection and permissions.'),
 ('4','Monitoring active and internet available','Upload watch vitals and location to Supabase.','Show waiting or offline status; retry on connection.'),
 ('5','A valid new watch reading or position arrives','Update cards, history, analytics and map.','Keep last timed reading visible as stale or waiting.'),
 ('6','An app alert rule crosses a threshold','Save alert, show in app, and route push when configured.','Continue monitoring without a threshold alert.'),
 ('7','Health history has new sleep or overnight oxygen','Import recorded history to the selected patient.','Keep existing history; show no new data.'),
 ('8','Watch position is fresh and reliable enough for safe-zone review','Check distance from the saved home center.','Show uncertain location and wait for a better fix.'),
 ('9','Watch leaves the safe zone after accuracy checks','Save a location alert and notify the caregiver.','Continue showing position on the map.'),
 ('10','Medication or appointment reminder is due','Show each unique reminder and record delivery.','Keep the next scheduled item in the care plan.'),
 ('11','Caregiver chooses a care action','Open medications, appointments, notes or timeline.','Use health analytics, Elle or location screens.'),
 ('12','Prescription image extracted and caregiver confirms','Save corrected medication and schedule.','Keep editable draft; no medication is activated.'),
 ('13','SOS confirmed','Save emergency event and show priority contacts.','Return to monitoring without creating SOS.'),
 ('14','Continue monitoring','Repeat upload and review cycle.','Stop watch monitoring and sign out when finished.'),
 ],[.55,2.0,2.35,2.15])
workflow.add_paragraph('Medication and appointment reminders carry separate event identities. If two occur together while the app is open, their popups appear in sequence. Closed-app push requires a registered phone, notification permission and internet connectivity.')
workflow.add_heading('Administrator workflow',level=1)
table(workflow,['Step','Decision or action','Yes path','No path'],[
 ('1','Administrator sign in succeeds','Verify admin role and active status.','Show sign-in error and retry.'),
 ('2','Administrator access allowed','Open Overview dashboard.','Deny access; keep the admin portal closed.'),
 ('3','Account task selected','Review caregiver and linked patient records.','Choose monitor, alerts, reports or security.'),
 ('4','Account edit or status change confirmed','Save change and refresh list.','Cancel without changing records.'),
 ('5','Permanent deletion confirmed by typed name','Delete selected record and linked data.','Leave record in place.'),
 ('6','Monitoring or alerts task selected','Review device status, sync age, alerts and audit activity.','Continue to reports or security.'),
 ('7','Report filters valid and rows exist','Export requested CSV for selected dates.','Adjust filters or show no-data result.'),
 ('8','Admin security action confirmed','Update other admin access and review audit.','Return to security view unchanged.'),
 ('9','Another task remains','Return to Overview or choose another section.','Sign out and end admin session.'),
 ],[.55,2.0,2.35,2.15])
workflow.add_paragraph('The portal currently exposes Overview, Manage accounts, System monitor, Alerts and notifications, Generate reports, and Manage security. Account deletion and admin access changes require explicit confirmation in the portal.')
workflow.save(OUT/'ElderCareAI_Workflows_Current.docx')
print('Created four DOCX files in',OUT)
