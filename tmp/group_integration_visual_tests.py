from pathlib import Path
import re
from docx import Document
from docx.shared import Inches,Pt
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement

R=Path('C:/ELDERCAREAI-CAPSTONE'); D=R/'integration testing'; O=R/'output/documents/2026-11-09-focused-testing'
lines=(R/'docs/INTEGRATION_TEST_TABLE.md').read_text(encoding='utf-8').splitlines()
old=[[x.strip() for x in line.strip('|').split('|')] for line in lines if line.startswith('|  | ')]
assert len(old)==30 and all(len(row)==9 for row in old)

def module_for(i):
 if i in (1,2):return 'Authentication Module'
 if i in (3,4,5,6,7,8,14,20,21):return 'Health Monitoring and Analytics Module'
 if i in (9,10,11,12,15,22,24,27):return 'Medication and Care Plan Module'
 if i in (13,17):return 'Appointments and Reminders Module'
 if i in (16,18):return 'Elle Assistant Module'
 if i in (19,23):return 'Emergency and Alerts Module'
 if i==29:return 'Location and Safety Module'
 if i in (25,26,28):return 'Galaxy Watch6 Module'
 return 'Administration Module'

records=[]
for i,row in enumerate(old,1):
 row[2]=module_for(i)
 records.append((row,(D/f'INT-{i:03d}.test.tsx').read_text(encoding='utf-8')))

extra=[
('Authentication Module','Open admin sign-in and recovery.','Admin recovery','Portal is available.','Sign-in and reset-code forms appear.','website/edcadmin/index.html',['id="login-form"'],'website/edcadmin/index.html',['id="recovery-form"']),
('Health Monitoring and Analytics Module','Open vitals and saved analytics.','Date-filtered chart','A patient has saved readings.','Health cards and analytics date filter appear.','app/(tabs)/health.tsx',['Heart Rate'],'src/components/HealthAnalytics.tsx',['From: {from}']),
('Health Monitoring and Analytics Module','Select a health record from the chart.','Recorded detail','Saved readings exist.','Chart selection and original reading time appear.','src/components/MonitoringChart.tsx',['Next chart reading'],'src/components/HealthAnalytics.tsx',['formatCareDateTime(point.at)']),
('Medication and Care Plan Module','Choose a medication image and review schedule.','Medication card','Medication editor is open.','Image picker and medication card are visible.','src/components/MedicationEditor.tsx',['CareImagePicker'],'app/(tabs)/care.tsx',['<CareImage']),
('Medication and Care Plan Module','Scan a prescription and review its draft.','Medication editor','Caregiver selects a prescription.','Scan entry and original-prescription review appear.','src/components/PrescriptionEntryCard.tsx',['prescription'],'src/components/MedicationEditor.tsx',['Review prescription draft']),
('Appointments and Reminders Module','Open appointments and see reminder details.','Appointment alert','A future visit is saved.','Appointment form and notification details are available.','app/(tabs)/care.tsx',['Appointments'],'src/lib/notifications.ts',['appointment']),
('Emergency and Alerts Module','Expand vital rules and open alert details.','Alert response','A saved alert exists.','Rules and alert response screen are visible.','src/components/AutomaticVitalAlerts.tsx',['Automatic vital alerts'],'app/alert-response.tsx',['Alert']),
('Location and Safety Module','Set a safe zone and view watch movement.','Live map','Watch has a location fix.','Radius control and map follow control appear.','src/components/SafeZonePanel.tsx',['radius'],'src/components/LiveLocationMap.tsx',['Follow location']),
('Galaxy Watch6 Module','Open watch oxygen and phone oxygen card.','Blood oxygen','Watch monitoring is active.','Spot-check control and phone oxygen card appear.','wearos/app/src/main/java/com/eldercareai/watch/OxygenActivity.kt',['Measure blood oxygen'],'app/(tabs)/health.tsx',['Blood Oxygen']),
('Administration Module','Open account and security management.','Admin security','Admin is signed in.','Account records and security controls appear.','website/edcadmin/index.html',['id="caregiver-rows"'],'website/edcadmin/index.html',['id="security-form"']),
]
assert len(extra)==10
for module,process,second,pre,expected,p1,k1,p2,k2 in extra:
 a=(R/p1).read_text(encoding='utf-8');b=(R/p2).read_text(encoding='utf-8')
 assert all(x in a for x in k1),(p1,k1)
 assert all(x in b for x in k2),(p2,k2)
 code="import {readFileSync} from 'node:fs';\nimport {join} from 'node:path';\nconst first=readFileSync(join(__dirname,'..',"+repr(p1)+"),'utf8');\nconst second=readFileSync(join(__dirname,'..',"+repr(p2)+"),'utf8');\ntest('visible integration controls',()=>{\n"+''.join('expect(first).toContain('+repr(v)+');\n' for v in k1)+''.join('expect(second).toContain('+repr(v)+');\n' for v in k2)+'});\n'
 records.append((['','',module,process,second,pre,expected,'Source PASS','Passed*'],code))

order=['Authentication Module','Health Monitoring and Analytics Module','Medication and Care Plan Module','Appointments and Reminders Module','Elle Assistant Module','Emergency and Alerts Module','Location and Safety Module','Galaxy Watch6 Module','Administration Module']
records.sort(key=lambda item:order.index(item[0][2]))
assert len(records)==40
for n,(row,code) in enumerate(records,1):
 row[1]=f'INT-{n:03d}'
 code=re.sub(r'INT-\d{3}',f'INT-{n:03d}',code)
 (D/f'.grouped-int-{n:03d}').write_text(code,encoding='utf-8')
for path in D.glob('INT-???.test.tsx'):path.unlink()
for n in range(1,41):(D/f'.grouped-int-{n:03d}').replace(D/f'INT-{n:03d}.test.tsx')

head=['Proponent','Test Case ID','Module Name','Integration Process','Connected Module','Precondition','Expected Result','Actual Result','Result']
md=['# ElderCareAI Integration Testing','','40 visible-outcome cases grouped by module. Automated fixtures and source checks are separate from live screenshots.','','| '+' | '.join(head)+' |','| '+' | '.join(['---']*9)+' |']
md+=['| '+' | '.join(str(v).replace('|','/') for v in row)+' |' for row,_ in records]
md+=['','*Passed* means automated verification only; live screenshots remain to be captured.*']
(R/'docs/INTEGRATION_TEST_TABLE.md').write_text('\n'.join(md)+'\n',encoding='utf-8')

d=Document();s=d.sections[0];s.orientation=WD_ORIENT.LANDSCAPE;s.page_width=Inches(11);s.page_height=Inches(8.5);s.left_margin=s.right_margin=Inches(.48);s.top_margin=s.bottom_margin=Inches(.55)
p=d.add_paragraph('ElderCareAI Integration Testing');p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.runs[0].bold=True;p.runs[0].font.size=Pt(15)
p=d.add_paragraph('Forty visible-outcome cases, grouped by module and numbered in file order.');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
t=d.add_table(rows=1,cols=9);t.style='Table Grid';t.autofit=False
for j,v in enumerate(head):t.rows[0].cells[j].text=v
for row,_ in records:
 cells=t.add_row().cells
 for j,v in enumerate(row):cells[j].text=str(v)
widths=[.65,.70,1.25,1.75,1.15,1.50,1.75,.85,.65]
for col,w in zip(t.columns,widths):col.width=Inches(w)
for i,row in enumerate(t.rows):
 row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
 if i==0:row._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
 for cell,w in zip(row.cells,widths):
  cell.width=Inches(w)
  if i==0:
   sh=OxmlElement('w:shd');sh.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill','D9E9D4');cell._tc.get_or_add_tcPr().append(sh)
  for p in cell.paragraphs:
   p.paragraph_format.space_after=Pt(0)
   for run in p.runs:run.font.name='Times New Roman';run.font.size=Pt(7.4);run.bold=i==0
d.add_paragraph('* Automated pass is separate from a live screenshot. Source checks do not prove device delivery or backend behavior.')
out=O/'ElderCareAI_Integration_Testing_40_Cases.docx';d.save(out);(R/'docs/INTEGRATION_TEST_TABLE.docx').write_bytes(out.read_bytes())
print('Wrote 40 grouped integration cases')
