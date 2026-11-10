from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT, WD_ROW_HEIGHT_RULE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from storyboard_details import DETAILS
from storyboard_logic import LOGIC
import re

ROOT=Path('C:/ELDERCAREAI-CAPSTONE')
OUT=ROOT/'output/documents/2026-11-10-storyboard'
OUT.mkdir(parents=True,exist_ok=True)

# Each record is grounded in the existing phone, watch, or admin screens.
# Five-column item rows follow the attached storyboard reference.
screens=[
('Authentication Module','Phone sign in','Phone - Sign in, showing Google button','Caregivers start a Google sign-in session and continue to their saved profile or onboarding.',[('Google sign-in','Button','Yes','OAuth action','N/A'),('Status or error','Text','No','VARCHAR','N/A')],['Tap Google sign-in.','If sign-in succeeds, continue to the matching caregiver setup step or Home.','If sign-in fails, show an error and remain on the sign-in screen.']),
('Onboarding Module','Caregiver setup','Phone - Tell us about you form','The caregiver enters their own profile details before adding an older adult.',[('Full name','Textbox','Yes','VARCHAR','120'),('Phone number','Textbox','Yes','VARCHAR','40'),('Age and profile details','Input fields','As shown','Mixed','N/A'),('Continue','Button','Yes','Action','N/A')],['Enter required caregiver details.','Invalid or missing details keep the user on the form with field feedback.','A valid save advances to older-adult setup.']),
('Onboarding Module','Older adult setup','Phone - Who are you caring for form','The caregiver records the selected older adult and emergency contact information.',[('Name and birth date','Input fields','Yes','VARCHAR / DATE','N/A'),('Health profile','Input fields','As shown','Mixed','N/A'),('Emergency contact','Textbox','Yes','VARCHAR','N/A'),('Continue','Button','Yes','Action','N/A')],['Enter the older adult and emergency contact details.','Correct invalid or missing fields before saving.','A successful save advances to watch connection.']),
('Wearable Connection Module','Galaxy Watch6 connection','Phone - Connect Galaxy Watch6 with pairing code','A watch is paired to the selected patient profile so measurements and location belong to the right person.',[('Pairing code','Code display','Yes','CHAR','8'),('Watch connection','Status','Yes','ENUM','N/A'),('Pair or continue','Button','Yes','Action','N/A')],['Generate or display the pairing code on the phone.','Enter the same code in ElderCareAI on the Galaxy Watch6.','Show connection status after the watch claims the code.']),
('Galaxy Watch6 Module','Watch monitoring','Watch - Main screen showing Start monitoring and readings','The watch starts a foreground monitoring session and displays the most recent available measurements.',[('Start monitoring','Button','Yes','Action','N/A'),('Heart rate','Reading','When available','NUMERIC','bpm'),('Other readings','Cards','When available','NUMERIC','N/A'),('Location status','Status','Yes','Text','N/A')],['Tap Start monitoring and grant watch permissions.','The watch displays measured values and their age as they arrive.','Location and sharing status reflect the watch session; a network connection is needed to upload.']),
('Galaxy Watch6 Module','Blood oxygen spot check','Watch - Blood oxygen measurement screen','The wearer can request a foreground SpO2 spot check; optional repeat checks require this screen to remain open.',[('Measure blood oxygen','Button','Yes','Action','N/A'),('SpO2 result','Reading','When available','NUMERIC','%'),('Auto checks','Switch','No','BOOLEAN','N/A')],['Start monitoring before opening the oxygen screen.','Keep the watch snug and remain still during the spot check.','Show the result when the sensor succeeds; leaving the screen stops optional auto checks.']),
('Caregiver Dashboard Module','Home dashboard','Phone - Home dashboard with patient name and vital cards','The dashboard summarizes the selected older adult, latest saved readings, and current care tasks.',[('Patient name','Text','Yes','VARCHAR','N/A'),('Vital cards','Cards','When available','NUMERIC','N/A'),('Care previews','List','When available','OBJECT','N/A'),('Sync now','Button','No','Action','N/A')],['Load only the selected patient record.','Display each available reading with status text and measurement time.','Open the corresponding health or care detail when a card is tapped.']),
('Health Monitoring Module','Vitals','Phone - Health Vitals tab with six metric cards','The Health screen displays heart rate, blood oxygen, sleep, steps, wrist temperature, and the stress estimate when recorded.',[('Metric value','Card','When available','NUMERIC','N/A'),('Status label','Text','Yes','VARCHAR','N/A'),('Measured time','Text','When available','TIMESTAMP','N/A'),('Metric detail','Tap action','No','Action','N/A')],['Read saved and newly received measurements for the selected patient.','Show readable status labels alongside colors; show no reading when data is absent.','Tap a metric to inspect its detail and history.']),
('Health Monitoring Module','Vital detail','Phone - Open Heart rate or another vital card','The detail view provides the latest value, its recorded time, status, and available history or source context.',[('Latest value','Reading','When available','NUMERIC','N/A'),('Status and context','Text','Yes','VARCHAR','N/A'),('History','List','When available','OBJECT','N/A'),('Close','Button','Yes','Action','N/A')],['Open a vital card.','Display the selected metric and real saved readings only.','Close the detail to return to the dashboard or Health screen.']),
('Health Analytics Module','Monitoring analytics','Phone - Health Analytics with line chart and date filter','Caregivers can view measured trends and records within a chosen date range.',[('Date range','Date pickers','Yes','DATE','N/A'),('Line or bar chart','Chart','When data exists','OBJECT','N/A'),('Summary statistics','Text','When data exists','NUMERIC','N/A'),('Record list','List','When data exists','OBJECT','N/A')],['Choose a metric and date range.','Load matching database records and display their timestamps.','Switch line or bar mode and inspect a plotted reading.']),
('Health Analytics Module','Insights and anomalies','Phone - AI Insights or Anomalies tab','The app presents general wellness context and flags readings that match its review rules.',[('Insight cards','Cards','When data exists','OBJECT','N/A'),('Status label','Text','Yes','VARCHAR','N/A'),('Measurement time','Text','When data exists','TIMESTAMP','N/A'),('Advice note','Text','Yes','VARCHAR','N/A')],['Analyze only available recorded data.','Display a waiting state when data is insufficient.','Show concerning readings as review guidance, without presenting a medical diagnosis.']),
('Health History Module','Health records and sleep sync','Phone - Health records and Profile health history sync','Recorded health history, checkups, and sleep import are shown for the selected older adult.',[('Saved records','List','When available','OBJECT','N/A'),('Sleep session','Record','When available','NUMERIC','hours'),('Sync health history','Button','No','Action','N/A')],['Open saved health history or trigger the health-history sync.','Import available sleep records from the paired patient watch through the phone.','Show saved history and a clear empty or error state when records are unavailable.']),
('Location and Safety Module','Live location and safe zone','Phone - Live location tracking with watch marker and safe-zone circle','The map displays the selected watch route and a caregiver-set safe zone.',[('Watch marker','Map marker','When available','COORDINATE','N/A'),('Safe-zone center','Map control','Yes','COORDINATE','N/A'),('Radius','Control','Yes','INTEGER','meters'),('Location age','Text','When available','DURATION','N/A')],['Start watch monitoring and keep watch internet available.','Place the safe-zone center and choose a radius.','Update the marker from accepted watch positions; show waiting or stale status when no fresh fix exists.']),
('Care Plan Module','Medications','Phone - Care plan Medications tab with a saved medication card','Caregivers can view scheduled medicines, dose status, image, and actions.',[('Medication image','Image','No','FILE','N/A'),('Name and dosage','Text','Yes','VARCHAR','N/A'),('Reminder time','Text','If scheduled','TIME','12-hour'),('Taken, Edit, Delete','Buttons','Yes','Action','N/A')],['Open the selected patient medication list.','Add or edit a schedule with caregiver-confirmed details.','Mark a dose Taken and show the updated status on the card.']),
('Care Plan Module','Prescription review','Phone - Scan or upload prescription then review draft','An uploaded prescription produces an editable draft that the caregiver checks against the original before saving.',[('Prescription image','Image','Yes','FILE','N/A'),('Extracted fields','Form','When found','VARCHAR','N/A'),('Confirmation','Checkbox','Yes','BOOLEAN','N/A'),('Save medication','Button','Yes','Action','N/A')],['Capture or select the original prescription.','Review and correct every extracted field, including time and dosage.','Confirm against the original before the medication schedule is saved.']),
('Care Plan Module','Appointments and schedule','Phone - Care plan Appointments and Schedule tabs','Appointments and care tasks are displayed in time order with upcoming and completed states.',[('Appointment details','Form or card','Yes','VARCHAR','N/A'),('Date and time','Picker or text','Yes','DATETIME','N/A'),('Schedule timeline','List','When available','OBJECT','N/A'),('Reminder','Notification','When enabled','Action','N/A')],['Create an appointment with patient, purpose, date, and time.','Sort saved activities by their scheduled date and time.','Show the reminder at its due time when permissions and delivery are available.']),
('Alerts and Emergency Module','Alerts and SOS','Phone - Alerts Emergency tab and watch Request assistance screen','Caregivers review vital alerts and SOS requests and can contact priority people.',[('Alert list','List','When available','OBJECT','N/A'),('SOS','Button','Yes','Action','N/A'),('Priority contacts','List','When saved','VARCHAR','N/A'),('Respond or resolve','Button','When available','Action','N/A')],['A watch SOS requires explicit confirmation; phone SOS also asks for confirmation.','A new event appears in the caregiver alert history and may notify the phone when push is configured.','Caregiver reviews the event, contacts the appropriate person, and records a response.']),
('Elle Assistant Module','Elle care assistant','Phone - Elle chat with a question and response','Elle summarizes available care data and provides navigation to related app screens.',[('Question input','Textbox','Yes','VARCHAR','N/A'),('Send','Button','Yes','Action','N/A'),('Response','Message','When available','TEXT','N/A'),('Related action','Button','When available','Action','N/A')],['Enter or select a question.','Show the reply or a service error; do not invent unavailable patient readings.','Open a related care screen when an action appears.']),
('Settings and Reports Module','Profile and exports','Phone - Profile showing watch, doctor contact, and report actions','Settings contain account and patient information, integrations, emergency contacts, and PDF export actions.',[('Account and patient','Cards','Yes','OBJECT','N/A'),('Doctor contact','Card','When saved','VARCHAR','N/A'),('Health PDF','Button','No','Action','N/A'),('Medication PDF','Button','No','Action','N/A')],['Open the caregiver profile and selected patient information.','Manage available contacts and watch connection.','Choose a report and share the generated PDF when data is available.']),
('Administration Module','Admin sign in and overview','Admin web - Sign in and Overview','An authorized administrator signs in to review high-level account and health-activity information.',[('Username or email','Textbox','Yes','VARCHAR','254'),('Password','Textbox','Yes','VARCHAR','N/A'),('Overview metrics','Cards','After sign in','INTEGER','N/A'),('Recent activity','Lists','When available','OBJECT','N/A')],['Enter administrator credentials on the web portal.','Reject invalid access with a visible message.','After authorization, show the Overview with saved system metrics.']),
('Administration Module','Admin accounts and monitor','Admin web - Accounts and System monitor','The administrator reviews caregiver and older-adult records and recent saved syncs.',[('Caregiver accounts','Table','When available','OBJECT','N/A'),('Older adult profiles','Table','When selected','OBJECT','N/A'),('Connected devices','Table','When available','OBJECT','N/A'),('Recent health syncs','Table','When available','OBJECT','N/A')],['Open Accounts to inspect linked profiles.','Open System monitor to review connection state and recent database writes.','Use Reports or Alerts and notifications for more detail as needed.']),
]
assert len(screens)==len(DETAILS)==21
screens=[(module,name,shot,description,DETAILS[index][0],LOGIC[index]) for index,(module,name,shot,description,_,_) in enumerate(screens,1)]

def shade(cell,fill):
 tcPr=cell._tc.get_or_add_tcPr();sh=OxmlElement('w:shd');sh.set(qn('w:fill'),fill);tcPr.append(sh)
def border(cell):
 tcPr=cell._tc.get_or_add_tcPr();b=OxmlElement('w:tcBorders')
 for side in ('top','left','bottom','right'):
  v=OxmlElement('w:'+side);v.set(qn('w:val'),'single');v.set(qn('w:sz'),'5');v.set(qn('w:color'),'8F9E91');b.append(v)
 tcPr.append(b)

d=Document();sec=d.sections[0];sec.page_width=Inches(8.5);sec.page_height=Inches(11);sec.top_margin=Inches(.6);sec.bottom_margin=Inches(.58);sec.left_margin=Inches(.9);sec.right_margin=Inches(.9)
styles=d.styles;styles['Normal'].font.name='Times New Roman';styles['Normal'].font.size=Pt(10)
styles['Normal'].paragraph_format.space_after=Pt(4)
styles['Title'].font.name='Times New Roman';styles['Title'].font.size=Pt(16);styles['Title'].font.color.rgb=RGBColor(0,0,0)
styles['Title'].paragraph_format.space_after=Pt(7)
for child in list(styles['Title']._element.get_or_add_pPr()):
 if child.tag.endswith('pBdr'):styles['Title']._element.get_or_add_pPr().remove(child)

# A small first-page introduction makes this a standalone chapter while preserving
# the reference's simple screen-by-screen structure.
p=d.add_paragraph('ElderCareAI System Storyboard',style='Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p=d.add_paragraph('This storyboard documents the main caregiver phone screens, Galaxy Watch6 screens, and administrator web screens. Each figure box identifies the screenshot to insert. The items and logic describe the current system at a general level; live screenshots should show the installed build and real demonstration records.')
p.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY

for idx,(module,name,shot,description,items,logic) in enumerate(screens,1):
 if idx>1:d.add_page_break()
 for label,value in [('Module Name',module),('Screen No',str(idx)),('Screen Name',name)]:
  p=d.add_paragraph();p.paragraph_format.space_after=Pt(2);r=p.add_run(label+': ');r.bold=True;p.add_run(value)
 p=d.add_paragraph();p.paragraph_format.space_after=Pt(6);r=p.add_run('Description: ');r.bold=True;p.add_run(description)
 p=d.add_paragraph();p.paragraph_format.space_after=Pt(0)
 box=d.add_table(rows=1,cols=1);box.alignment=WD_TABLE_ALIGNMENT.CENTER;box.autofit=False
 w=Inches(5.5 if shot.startswith('Admin') else 3.25)
 box.columns[0].width=w;cell=box.cell(0,0);cell.width=w;cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
 box.rows[0].height=Inches(2.45 if len(items)>=12 else 2.8 if shot.startswith('Admin') else 3.0)
 box.rows[0].height_rule=WD_ROW_HEIGHT_RULE.AT_LEAST
 shade(cell,'F7F8F7');border(cell)
 para=cell.paragraphs[0];para.alignment=WD_ALIGN_PARAGRAPH.CENTER
 r=para.add_run('INSERT SCREENSHOT');r.bold=True;r.font.size=Pt(12);r.font.color.rgb=RGBColor(70,90,74)
 para=cell.add_paragraph(shot);para.alignment=WD_ALIGN_PARAGRAPH.CENTER
 for run in para.runs:run.font.size=Pt(9)
 cap=d.add_paragraph();cap.alignment=WD_ALIGN_PARAGRAPH.CENTER;cap.paragraph_format.space_before=Pt(4);cap.paragraph_format.space_after=Pt(8)
 cap.add_run(f'Figure {idx}: ');r=cap.add_run(name);r.bold=True;r.underline=True
 table=d.add_table(rows=1,cols=5);table.style='Table Grid';table.alignment=WD_TABLE_ALIGNMENT.CENTER;table.autofit=False
 headings=['ITEMS','TYPE','REQUIRED?','DATA TYPE','SIZE'];widths=[1.75,1.2,1.0,1.2,1.1]
 for j,h in enumerate(headings):table.rows[0].cells[j].text=h
 for item in items:
  cells=table.add_row().cells
  for j,value in enumerate(item):cells[j].text=str(value)
 for col,width in zip(table.columns,widths):col.width=Inches(width)
 for ri,row in enumerate(table.rows):
  row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
  if ri==0:
   repeat=OxmlElement('w:tblHeader');repeat.set(qn('w:val'),'true');row._tr.get_or_add_trPr().append(repeat)
  for cell,width in zip(row.cells,widths):
   cell.width=Inches(width);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER;border(cell)
   if ri==0:shade(cell,'DFEBD9')
   for para in cell.paragraphs:
    para.alignment=WD_ALIGN_PARAGRAPH.CENTER;para.paragraph_format.space_after=Pt(0)
    for run in para.runs:run.font.name='Times New Roman';run.font.size=Pt(8.5);run.bold=ri==0
 p=d.add_paragraph();p.paragraph_format.space_before=Pt(9);p.paragraph_format.space_after=Pt(3);p.add_run('Logic:').bold=True
 for step in (line.strip() for line in logic.splitlines() if line.strip()):
  match=re.match(r'^(\d+(?:\.\d+)*\.)\s+',step)
  assert match, (idx,step)
  level=match.group(1).count('.')
  p=d.add_paragraph(step)
  p.paragraph_format.left_indent=Inches(.22+(.20*(level-1)))
  p.paragraph_format.first_line_indent=Inches(-.22)
  p.paragraph_format.space_after=Pt(2)
  p.paragraph_format.keep_together=True
  for run in p.runs:run.font.size=Pt(9)

d.add_page_break();p=d.add_paragraph('Screenshot Capture Checklist',style='Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
d.add_paragraph('Replace each gray figure box with the screen named below. Use the same patient account throughout a demonstration. Hide personal names, phone numbers, medical notes, tokens, and exact home coordinates before sharing the document.')
for idx,(_,name,shot,*_) in enumerate(screens,1):
 p=d.add_paragraph(f'Figure {idx}. {shot}',style='List Number');p.paragraph_format.space_after=Pt(2)
footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)

path=OUT/'ElderCareAI_System_Storyboard_Complete.docx';d.save(path);print(path,len(screens))
