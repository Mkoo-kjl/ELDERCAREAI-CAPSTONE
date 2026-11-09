from pathlib import Path
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT,WD_CELL_VERTICAL_ALIGNMENT,WD_ROW_HEIGHT_RULE
from docx.oxml import OxmlElement

OUT=Path('C:/ELDERCAREAI-CAPSTONE/output/documents/2026-11-09-focused-testing')
OUT.mkdir(parents=True,exist_ok=True)

SCREENS=[
('Sign in','Phone app opening screen','Capture the Google sign-in button and app name.',[
 'Open ElderCareAI and choose Sign in with Google. Use the caregiver account for the selected patient.',
 'If sign-in is cancelled or fails, remain on this screen and retry. The dashboard opens after a valid session and setup check.',
 'For the report, conceal the account email if it appears in the chooser.']),
('Caregiver and patient setup','First sign-in onboarding','Capture the caregiver profile and patient profile screens separately.',[
 'Enter the caregiver details, then create or select the older-adult profile. Required fields must be complete before continuing.',
 'The selected older adult determines whose vitals, sleep, location, medications and alerts are shown.',
 'Hide birth dates, phone numbers, addresses and medical conditions in report screenshots.']),
('Connect Galaxy Watch6','Profile or setup watch integration','Capture Connect or change watch and the paired device status.',[
 'Pair the watch to the patient profile and confirm the Galaxy Watch6 appears as connected.',
 'Allow sensor, activity and location permissions on the watch. Keep the watch signed into the correct patient pairing.',
 'If pairing fails, check the watch connection and retry before collecting new readings.']),
('Watch monitoring','ElderCareAI on the watch','Photograph the watch with monitoring active and, if needed, Live walk active.',[
 'Open ElderCareAI on the watch and start monitoring. The watch sends available readings while it has a connection.',
 'For a live walk, start its location mode outdoors. Wait for a reliable GPS fix before using the small home safe zone.',
 'A watch photo is acceptable when watch screenshots are unavailable.']),
('Caregiver dashboard','Home tab','Capture live vital cards with visible values, labels and measurement times.',[
 'The dashboard summarizes the selected patient. Each vital displays its latest available reading and a text status.',
 'A fresh heart-rate update can change the display label without reopening the screen. The alert rule remains above 110 BPM.',
 'A waiting or stale label means a fresh measurement is unavailable; it is not a normal reading.']),
('Vital signs','Health tab Vitals','Capture heart rate, oxygen, sleep, steps, skin temperature and stress if present.',[
 'Scroll through the vital cards. Each card shows an actual value, units, status and the time it was measured.',
 'Blood oxygen can come from a manual spot check or recorded overnight history; sleep is imported after Samsung Health sync.',
 'Stress is an HRV-based estimate and not a medical-grade diagnosis. Missing metrics may remain unavailable.']),
('Vital detail and history','Tap a vital card','Capture one vital detail with its dated reading and status explanation.',[
 'Tap a card to view the value and supporting history. Check that the date and time belong to that measurement.',
 'Read Normal, Attention Required or Critical labels as app review categories, not medical diagnoses.',
 'Use this screen to show a real saved reading rather than a sample value.']),
('Health analytics','Health tab Analytics','Capture the date filter, line chart, bar chart and a selected timestamp.',[
 'Choose a metric and date range. The chart uses saved database readings for the selected patient.',
 'Switch between line and thin bar views. Inspect a point to see its original value and measurement time.',
 'Daily steps show a day total rather than adding cumulative samples together.']),
('Health history sync','Profile or Settings Health History','Capture the sync status and one saved sleep history entry.',[
 'Use the Health History section to import recorded sleep and overnight oxygen from the paired patient watch.',
 'Tap Sync Health History when a new Samsung Health record is available; background checks may also run when Android permits.',
 'A No new data result means the source has no additional record for the selected patient.']),
('Live location and safe zone','Live location tracking','Capture the watch marker, accuracy or source label, and safe-zone circle.',[
 'Start Live walk on the watch while it has internet. The phone map follows incoming watch positions.',
 'Set the home center on the actual house and select the radius. Review the accuracy indicator before treating an exit as reliable.',
 'For a demo, leave the phone still and walk with only the watch within Wi-Fi coverage. Hide exact house coordinates in the report.']),
('Medication list','Care plan Medications','Capture one medication card showing image, 12-hour time and Taken status.',[
 'Add or edit a medication with its name, dose, instructions, frequency and reminder time. Times display with AM or PM.',
 'Each medication can have its own image; a default image appears when none is uploaded.',
 'Mark a due dose Taken and check that the list updates. Use a demonstration medication for screenshots.']),
('Prescription draft with Elle','Care plan Scan or upload prescription','Capture the Elle entry card and the editable extracted draft.',[
 'Choose or capture a prescription image. Elle extracts readable fields as a draft only.',
 'Compare medication name, dose, frequency and dates against the original prescription; correct every mistake.',
 'Confirm before saving. An unconfirmed draft must not create an active medication schedule.']),
('Appointments','Care plan Appointments','Capture a saved upcoming appointment showing patient, purpose, date and time.',[
 'Add the appointment details and save. The reminder is based on its scheduled date and time.',
 'Review it as upcoming, ongoing, past or completed. Editing or rescheduling should update the care plan order.',
 'For reminder evidence, create a safe demonstration appointment a few minutes ahead.']),
('Care schedule','Care plan Schedule','Capture two scheduled items in chronological order.',[
 'Open Schedule to review medications and appointments together. Items on the same day sort by their actual time.',
 'Completed activities have a different status from upcoming activities.',
 'When two reminders share one time, dismiss the first popup and capture the second popup separately.']),
('Alerts and notifications','Alerts tab','Capture collapsed Automatic vital alerts, SOS action, and one dated notification.',[
 'Expand Automatic vital alerts to see the review rules. A real crossing saves an alert for the selected patient.',
 'Open Notifications to inspect the event and recorded time. Background phone notifications require permission and push registration.',
 'Sound depends on the phone notification channel and sound settings. Do not use a fabricated vital reading as evidence.']),
('Emergency contacts and SOS','Alerts and Settings','Capture contact order with numbers covered, plus the emergency action.',[
 'In Settings, enter caregiver, family member and doctor names and numbers in priority order.',
 'Open the SOS contact list to choose a person to call. Opening it does not automatically dial anyone.',
 'A confirmed watch SOS creates an emergency event and caregiver alert when delivery is available.']),
('Elle assistant','Elle tab','Capture a non-identifying question and its answer.',[
 'Ask Elle about an existing saved record, such as a dated heart-rate reading, medication or health trend.',
 'Check that the response is grounded in available patient data. Elle should not invent readings or diagnose illness.',
 'For a report screenshot, use a demonstration question without private patient details.']),
('Settings and exports','Profile or Settings','Capture watch integration, background notifications and PDF export options.',[
 'Use Settings to review the linked watch, Health History, emergency contacts and notification setup.',
 'Health-vitals and medication-schedule PDF exports use saved records for the selected patient.',
 'Before a closed-app notification demo, allow Android notifications and check the caregiver phone is registered.']),
('Administrator overview and accounts','Web administrator portal','Capture Overview, then Manage accounts with identifying fields covered.',[
 'Sign in with an active administrator account. Overview shows system counts and recent activity.',
 'Manage accounts lists caregivers and linked older adults. Confirm an edit, suspension or deletion before changing records.',
 'Use a demonstration record for destructive-action screenshots; avoid deleting real patient data.']),
('Administrator monitoring and reports','Web administrator portal','Capture System monitor, Alerts and notifications, and Generate reports.',[
 'Review device and sync age in System monitor. Inspect alert and emergency history in Alerts and notifications.',
 'Set report dates and export the available CSV. An empty result should show no data rather than a fabricated row.',
 'Manage security is for administrator access and audit review. Conceal account identifiers in screenshots.']),
]

d=Document();s=d.sections[0];s.page_width=Inches(8.5);s.page_height=Inches(11)
s.left_margin=s.right_margin=Inches(.8);s.top_margin=s.bottom_margin=Inches(.6)
d.styles['Normal'].font.name='Times New Roman';d.styles['Normal'].font.size=Pt(10.5)
d.styles['Title'].font.name='Times New Roman';d.styles['Title'].font.size=Pt(17);d.styles['Title'].font.color.rgb=RGBColor(0,0,0)
d.styles['Subtitle'].font.name='Times New Roman';d.styles['Subtitle'].font.size=Pt(11);d.styles['Subtitle'].font.color.rgb=RGBColor(0,0,0)
for style_name in ('Title','Subtitle'):
    style=d.styles[style_name]._element
    for child in list(style.get_or_add_pPr()):
        if child.tag.endswith('pBdr'):style.get_or_add_pPr().remove(child)
d.styles['Heading 1'].font.name='Times New Roman';d.styles['Heading 1'].font.size=Pt(14);d.styles['Heading 1'].font.color.rgb=RGBColor(0,0,0)
d.add_paragraph('ElderCareAI User Guide',style='Title')
for child in list(d.paragraphs[-1]._p.get_or_add_pPr()):
    if child.tag.endswith('pBdr'):d.paragraphs[-1]._p.get_or_add_pPr().remove(child)
d.add_paragraph('Caregiver phone app Galaxy Watch6 and administrator portal',style='Subtitle')
d.add_paragraph('This guide explains the current screens and tells you exactly what to capture for the project report. The figure spaces are placeholders for screenshots from your installed app and administrator portal. Replace each space with the named screen after verifying that it shows real demonstration data.')
d.add_paragraph('Before taking screenshots',style='Heading 1')
for item in ['Use the correct caregiver and older-adult account.','Hide names, phone numbers, addresses, medical notes and exact home coordinates.','Keep watch monitoring and the phone internet connection active during live vital or GPS demonstrations.','Do not present app review labels or Elle suggestions as medical diagnosis.']:
    d.add_paragraph(item,style='List Bullet')

for number,(title,route,shot,bullets) in enumerate(SCREENS,1):
    d.add_page_break()
    d.add_paragraph(f'{number}  {title}',style='Heading 1')
    d.add_paragraph(f'Screen: {route}')
    d.add_paragraph(f'What to screenshot: {shot}')
    t=d.add_table(rows=1,cols=1);t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    t.columns[0].width=Inches(3.15)
    row=t.rows[0];row.height=Inches(3.85);row.height_rule=WD_ROW_HEIGHT_RULE.EXACTLY
    c=row.cells[0];c.width=Inches(3.15);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
    c.text=f'INSERT SCREENSHOT HERE\n\n{title}'
    for p in c.paragraphs:
        p.alignment=WD_ALIGN_PARAGRAPH.CENTER
        for run in p.runs:run.font.color.rgb=RGBColor(80,100,104);run.font.size=Pt(12)
    pr=c._tc.get_or_add_tcPr();sh=OxmlElement('w:shd');sh.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill','F2F6F3');pr.append(sh)
    borders=OxmlElement('w:tcBorders');pr.append(borders)
    for side in ('top','left','bottom','right'):
        edge=OxmlElement('w:'+side);edge.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val','single');edge.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sz','8');borders.append(edge)
    p=d.add_paragraph(f'Figure {number}: {title}');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    for r in p.runs:r.bold=True
    for bullet in bullets:d.add_paragraph(bullet,style='List Bullet')

d.save(OUT/'ElderCareAI_Detailed_User_Guide.docx')
print('Wrote guide',OUT/'ElderCareAI_Detailed_User_Guide.docx',len(SCREENS),'screens')
