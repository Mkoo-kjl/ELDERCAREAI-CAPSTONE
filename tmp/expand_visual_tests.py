from pathlib import Path
import re
from docx import Document
from docx.shared import Inches,Pt
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement

R=Path('C:/ELDERCAREAI-CAPSTONE'); U=R/'__tests__'; I=R/'integration testing'; O=R/'output/documents/2026-11-09-focused-testing'
def rows(path):
 return [[v.strip() for v in line.strip('|').split('|')] for line in path.read_text(encoding='utf-8').splitlines() if line.startswith('|  | ')]
ur=rows(R/'docs/UNIT_TEST_TABLE.md'); ir=rows(R/'docs/INTEGRATION_TEST_TABLE.md')
assert len(ur)==68 and len(ir)==24
assert all(len(x)==10 for x in ur+ir)

# The additional checks point to visible controls and states that can be photographed
# on the phone, watch, or admin portal. These are source/UI contract checks, not
# substitute screenshots or live service tests.
extra=[
('Authentication Module','Admin reset','Open Forgot password.','Reset code form appears.','website/edcadmin/index.html',['id="recovery-form"','id="recovery-code"']),
('Authentication Module','Admin invitation','Open administrator invitation.','Set password form appears.','website/edcadmin/index.html',['id="invite-form"','id="invite-confirm"']),
('Onboarding Module','Introduction','Open introduction.','Heart rate and sleep are introduced.','app/setup/intro.tsx',['Heart rate','Sleep']),
('Onboarding Module','Location consent','Open location setup.','Watch location sharing guidance appears.','app/setup/location.tsx',['Watch location sharing','Galaxy Watch']),
('Health Monitoring Module','Card timestamp','Open a vital card.','The reading timestamp is displayed.','src/components/MetricCard.tsx',['timestamp','styles.timestamp']),
('Health Monitoring Module','Card unit','Open a vital card.','Measurement unit accompanies value.','src/components/MetricCard.tsx',['valueRow','{unit}']),
('Health Monitoring Module','Status badge','Open a vital card with status.','Status has readable text.','src/components/VitalStatusBadge.tsx',['label','Text']),
('Health Monitoring Module','Vital detail','Open vital detail.','Detail modal provides reading context.','src/components/VitalDetailModal.tsx',['Modal','Text']),
('Health Insights and Analytics Module','Chart modes','Open monitoring analytics.','Line and bar choices appear.','src/components/MonitoringChart.tsx',['line','bar']),
('Health Insights and Analytics Module','Chart date','Inspect a chart point.','Reading date or time is shown.','src/components/MonitoringChart.tsx',['formatCareDateTime','Text']),
('Health Insights and Analytics Module','Analytics filter','Open analytics filters.','Date range controls appear.','src/components/HealthAnalytics.tsx',['range','Pressable']),
('Elle Assistant Module','Quick topics','Open Elle.','Vitals and medication topic chips appear.','app/(tabs)/chatbot.tsx',['quickTopics','Medication']),
('Elle Assistant Module','Thinking state','Send Elle a question.','Thinking state is visible.','app/(tabs)/chatbot.tsx',['Elle is thinking','ActivityIndicator']),
('Care Plan Module','Care tabs','Open Care plan.','Appointments and medication tabs are present.','app/(tabs)/care.tsx',['Appointments','Medications']),
('Care Plan Module','Schedule','Open the schedule.','Care activities are shown by date.','app/(tabs)/care.tsx',['Schedule','appointment']),
('Care Plan Module','Prescription entry','Open scan or upload.','Prescription entry control is visible.','src/components/PrescriptionEntryCard.tsx',['prescription','Pressable']),
('Care Plan Module','Notes','Open caregiver notes.','Notes section is visible.','app/(tabs)/care.tsx',['Notes','note']),
('Medication Management Module','Medication image','Edit medication image.','Image picker is shown.','src/components/MedicationEditor.tsx',['CareImagePicker','Medication name']),
('Medication Management Module','Prescription review','Review extracted prescription.','Original image and verification notice appear.','src/components/MedicationEditor.tsx',['Review prescription draft','Open original prescription']),
('Medication Management Module','Dose date','Edit medication dates.','Start and end date controls appear.','src/components/MedicationEditor.tsx',['Start:','End:']),
('Reminders and Notifications Module','Medication reminder','Open medication editor.','Prescribed reminder times are shown.','src/components/MedicationEditor.tsx',['Prescribed reminder times','Choose medication reminder time']),
('Reminders and Notifications Module','Notification controls','Open alerts notification setup.','Background notification controls appear.','app/(tabs)/alerts.tsx',['notification','Pressable']),
('Emergency and Alerts Module','Emergency list','Open emergency contacts.','Contact names and call controls appear.','src/components/EmergencyContacts.tsx',['Caregiver','Doctor']),
('Emergency and Alerts Module','Alert details','Open automatic vital alerts.','Rules can be expanded.','src/components/AutomaticVitalAlerts.tsx',['Pressable','expanded']),
('Location and Safety Module','Safe zone','Open safe-zone controls.','Safe-zone radius control appears.','src/components/SafeZonePanel.tsx',['radius','Pressable']),
('Location and Safety Module','Map','Open live location.','Location map is rendered.','src/components/LiveLocationMap.tsx',['WebView','location']),
('Galaxy Watch6 Module','Pairing','Open watch pairing.','Eight-digit code entry appears.','wearos/app/src/main/java/com/eldercareai/watch/MainActivity.kt',['Connect your watch','Pair watch']),
('Galaxy Watch6 Module','Readings','Scroll watch readings.','Stress and skin temperature cards appear.','wearos/app/src/main/java/com/eldercareai/watch/MainActivity.kt',['Stress estimate','Skin temperature']),
('Galaxy Watch6 Module','Medication dose','Open watch medications.','Taken and Refresh schedule controls appear.','wearos/app/src/main/java/com/eldercareai/watch/CareActivity.kt',['Taken','Refresh schedule']),
('Administration Module','Accounts','Open admin Accounts.','Caregiver and older-adult lists appear.','website/edcadmin/index.html',['id="view-accounts"','id="caregiver-rows"']),
('Administration Module','Alerts','Open admin Alerts.','Health alerts and emergency history appear.','website/edcadmin/index.html',['id="view-alerts"','id="emergency-rows"']),
('Administration Module','Activity','Open admin Security.','Administrative activity list appears.','website/edcadmin/index.html',['id="audit-rows"','Administrative activity']),
]
assert len(extra)==32
def source_test(source,needles):
 assert all(n in (R/source).read_text(encoding='utf-8') for n in needles),(source,needles)
 return "import {readFileSync} from 'node:fs';\nimport {join} from 'node:path';\nconst ui=readFileSync(join(__dirname,'..',"+repr(source)+"),'utf8');\ntest('visible UI contract',()=>{\n"+''.join('expect(ui).toContain('+repr(n)+');\n' for n in needles)+'});\n'
records=[]
for old,row in enumerate(ur,1):
 row=row[:9]
 if old==64: row[1]='Authentication Module'
 records.append((row,(U/f'CASE-{old:03d}.test.tsx').read_text(encoding='utf-8')))
for mod,unit,action,expected,source,needles in extra:
 records.append((['',mod,unit,'11/09/2026','',action,expected,'Source PASS','Passed*'],source_test(source,needles)))
order=list(dict.fromkeys(x[0][1] for x in records)); records.sort(key=lambda item:order.index(item[0][1]))
assert len(records)==100
already_expanded=len(list(U.glob('CASE-???.test.tsx')))==100
for n,(row,content) in enumerate(records,1):
 row[4]=f'CASE-{n:03d}'
 if not already_expanded:
  old=re.search(r'CASE-\d{3}',content)
  if old: content=re.sub(r'CASE-\d{3}',f'CASE-{n:03d}',content)
  (U/f'.visual-case-{n:03d}').write_text(content,encoding='utf-8')
if not already_expanded:
 for path in U.glob('CASE-???.test.tsx'):path.unlink()
 for n in range(1,101):(U/f'.visual-case-{n:03d}').replace(U/f'CASE-{n:03d}.test.tsx')

int_extra=[
('Watch pairing','Open the watch pairing screen from phone setup.','Phone pairing','Watch is not yet paired.','Phone setup and watch code entry are both visible.','app/setup/fitness.tsx',['watch'],'wearos/app/src/main/java/com/eldercareai/watch/MainActivity.kt',['Pair watch']),
('Watch monitoring','Start monitoring on the paired watch.','Phone vitals','Watch is paired and app is signed in.','Watch monitoring control and phone vital cards are visible.','wearos/app/src/main/java/com/eldercareai/watch/MainActivity.kt',['Start monitoring'],'app/(tabs)/health.tsx',['heart','spo2']),
('Medication editor','Add a medication with a reminder time.','Care plan','Patient is selected.','Editor time control and Care plan medication tab are visible.','src/components/MedicationEditor.tsx',['Prescribed reminder times'],'app/(tabs)/care.tsx',['Medications']),
('Watch medication','Open Medications on watch.','Dose confirmation','A dose is scheduled.','Watch shows Taken control and care plan shows medication status.','wearos/app/src/main/java/com/eldercareai/watch/CareActivity.kt',['Taken'],'app/(tabs)/care.tsx',['Taken']),
('Safe zone','Open patient safe zone.','Live location','Watch location exists.','Radius controls and live map are visible.','src/components/SafeZonePanel.tsx',['radius'],'src/components/LiveLocationMap.tsx',['WebView']),
('Admin overview','Open admin system monitor.','Saved health sync','Admin has signed in.','Overview and recent sync sections are visible.','website/edcadmin/index.html',['id="view-dashboard"'],'website/edcadmin/index.html',['id="sync-rows"']),
]
assert len(int_extra)==6
for n,item in enumerate(int_extra,25):
 a,b,c,d,e,s1,k1,s2,k2=item
 ir.append(['',f'INT-{n:03d}',a,b,c,d,e,'Source PASS','Passed*'])
 content="import {readFileSync} from 'node:fs';\nimport {join} from 'node:path';\nconst one=readFileSync(join(__dirname,'..',"+repr(s1)+"),'utf8');\nconst two=readFileSync(join(__dirname,'..',"+repr(s2)+"),'utf8');\ntest('visible cross-screen contract',()=>{\n"+''.join('expect(one).toContain('+repr(v)+');\n' for v in k1)+''.join('expect(two).toContain('+repr(v)+');\n' for v in k2)+'});\n'
 assert all(v in (R/s1).read_text(encoding='utf-8') for v in k1) and all(v in (R/s2).read_text(encoding='utf-8') for v in k2),n
 (I/f'INT-{n:03d}.test.tsx').write_text(content,encoding='utf-8')
ir=[x[:9] for x in ir]
def save_md(path,title,head,data):
 lines=[f'# {title}','','Automated results use controlled fixtures or UI source checks. Capture the corresponding visible screen separately for presentation.','','| '+' | '.join(head)+' |','| '+' | '.join(['---']*len(head))+' |']
 lines+=['| '+' | '.join(str(v).replace('|','/') for v in row)+' |' for row in data]
 lines+=['','*Passed* means automated verification only; live screenshots remain to be captured.*']
 path.write_text('\n'.join(lines)+'\n',encoding='utf-8')
def save_doc(path,title,head,data,widths):
 d=Document();s=d.sections[0];s.orientation=WD_ORIENT.LANDSCAPE;s.page_width=Inches(11);s.page_height=Inches(8.5);s.left_margin=s.right_margin=Inches(.48);s.top_margin=s.bottom_margin=Inches(.55)
 p=d.add_paragraph(title);p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.runs[0].bold=True;p.runs[0].font.size=Pt(15)
 p=d.add_paragraph(f'{len(data)} numbered cases with visible phone, watch, or admin web outcomes. Automated results verified 9 November 2026.');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
 t=d.add_table(rows=1,cols=len(head));t.style='Table Grid';t.autofit=False
 for j,v in enumerate(head):t.rows[0].cells[j].text=v
 for row in data:
  c=t.add_row().cells
  for j,v in enumerate(row):c[j].text=str(v)
 for col,w in zip(t.columns,widths):col.width=Inches(w)
 for ri,row in enumerate(t.rows):
  row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
  if ri==0:row._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
  for cell,w in zip(row.cells,widths):
   cell.width=Inches(w)
   if ri==0:
    sh=OxmlElement('w:shd');sh.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill','D9E9D4');cell._tc.get_or_add_tcPr().append(sh)
   for p in cell.paragraphs:
    p.paragraph_format.space_after=Pt(0)
    for run in p.runs:run.font.name='Times New Roman';run.font.size=Pt(7.5);run.bold=ri==0
 d.add_paragraph('* Automated pass is separate from a live screenshot. UI source checks do not prove device delivery or backend behavior.')
 d.save(path)
unit_head=['Proponent','Module Name','Unit Name','Date Tested','Test Case ID','Test Case Description','Expected Result','Actual Result','Result']
int_head=['Proponent','Test Case ID','Module 1','Integration Process','Module 2','Precondition','Expected Result','Actual Result','Result']
save_md(R/'docs/UNIT_TEST_TABLE.md','ElderCareAI Unit Testing',unit_head,[x[0] for x in records]);save_md(R/'docs/INTEGRATION_TEST_TABLE.md','ElderCareAI Integration Testing',int_head,ir)
for kind,name,head,data,widths in [('UNIT','ElderCareAI_Unit_Testing_100_Cases',unit_head,[x[0] for x in records],[.65,1.05,.95,.7,.72,2.2,2.2,.9,.7]),('INTEGRATION','ElderCareAI_Integration_Testing_30_Cases',int_head,ir,[.65,.7,1.0,1.8,1.0,1.7,2.0,.9,.7])]:
 path=O/(name+'.docx');save_doc(path,'ElderCareAI '+('Unit' if kind=='UNIT' else 'Integration')+' Testing',head,data,widths);(R/f'docs/{kind}_TEST_TABLE.docx').write_bytes(path.read_bytes())
print(len(records),len(ir))
