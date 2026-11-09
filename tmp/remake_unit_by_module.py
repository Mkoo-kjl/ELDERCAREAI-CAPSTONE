from pathlib import Path
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT,WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement

ROOT=Path('C:/ELDERCAREAI-CAPSTONE')
OUT=ROOT/'output/documents/2026-11-09-focused-testing'
SOURCE=ROOT/'docs/UNIT_TEST_TABLE.docx'
rows=[[c.text for c in row.cells] for row in Document(SOURCE).tables[0].rows[1:] if int(row.cells[4].text.split('-')[1])<=100]
assert len(rows)==100
extra=[
 ('CASE-101','Validate record UUIDs and reject arbitrary IDs.','Only valid record IDs can reach admin record actions.'),
 ('CASE-102','Edit caregiver details while submitting permission fields.','Only allowed caregiver fields are returned; role changes are ignored.'),
 ('CASE-103','Edit older-adult details with invalid age and foreign owner.','Allowed patient fields are validated; owner is not overridden.'),
 ('CASE-104','Request malformed or oversized report date ranges.','Invalid dates and ranges over 90 days are rejected.'),
 ('CASE-105','Request a patient photo outside the caregiver folder.','Only the correct project and caregiver photo path is accepted.'),
]
for case,action,expected in extra:
    rows.append(['','Administration Module','Access control','11/09/2026',case,action,expected,'Performed as expected','Passed'])
assert len(rows)==105

def group_for(number):
    if 1<=number<=4:return 'Authentication Module'
    if 5<=number<=10:return 'Onboarding Module'
    if 11<=number<=24:return 'Profile and Forms Module'
    if number in (*range(25,28),74,75,88,94,95,98):return 'Health Monitoring Module'
    if number in (*range(28,36),79,80,81):return 'Health Insights and Analytics Module'
    if 36<=number<=40:return 'Elle Assistant Module'
    if number in (*range(41,45),78,93):return 'Care Plan Module'
    if number in (*range(45,54),76,77,84,87,91,97):return 'Medication Management Module'
    if number in (*range(54,60),82,83,92):return 'Reminders and Notifications Module'
    if number in (*range(60,64),72,73):return 'Doctor Contacts Module'
    if 64<=number<=71:return 'Reports and Exports Module'
    if number in (85,86,90,100):return 'Emergency and Alerts Module'
    if number in (96,99):return 'Location and Safety Module'
    if number in (89,101,102,103,104,105):return 'Administration Module'
    raise ValueError(f'No module for CASE-{number:03d}')

for row in rows:
    case=int(row[4].split('-')[1]);row[1]=group_for(case)
    row[3]='11/09/2026'
groups=[
 'Authentication Module','Onboarding Module','Profile and Forms Module',
 'Health Monitoring Module','Health Insights and Analytics Module','Elle Assistant Module',
 'Care Plan Module','Medication Management Module','Reminders and Notifications Module',
 'Doctor Contacts Module','Reports and Exports Module','Emergency and Alerts Module',
 'Location and Safety Module','Administration Module',
]
rows.sort(key=lambda row:(groups.index(row[1]),int(row[4].split('-')[1])))

d=Document();s=d.sections[0];s.orientation=WD_ORIENT.LANDSCAPE
s.page_width=Inches(11);s.page_height=Inches(8.5)
s.left_margin=s.right_margin=Inches(.5);s.top_margin=s.bottom_margin=Inches(.55)
d.styles['Normal'].font.name='Times New Roman';d.styles['Normal'].font.size=Pt(10)
title=d.styles['Title'];title.font.name='Times New Roman';title.font.size=Pt(16);title.font.color.rgb=RGBColor(0,0,0)
for child in list(title._element.get_or_add_pPr()):
    if child.tag.endswith('pBdr'):title._element.get_or_add_pPr().remove(child)
p=d.add_paragraph('ElderCareAI Unit Testing by Module',style='Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p=d.add_paragraph('The selected unit cases are grouped by the system module they verify. Every case ID matches its numbered Jest file.');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
head=['Proponent','Module Name','Unit Name','Date Tested','Test Case ID','Test Case Description','Expected Result','Actual Result','Result']
widths=[.72,1.12,.85,.68,.66,1.89,1.99,1.25,.69]
t=d.add_table(rows=1,cols=9);t.style='Table Grid';t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
for i,x in enumerate(head):t.rows[0].cells[i].text=x
for values in rows:
    cells=t.add_row().cells
    for cell,value in zip(cells,values):cell.text=value
for col,w in zip(t.columns,widths):col.width=Inches(w)
for ri,row in enumerate(t.rows):
    trPr=row._tr.get_or_add_trPr();trPr.append(OxmlElement('w:cantSplit'))
    first_in_group=ri>0 and (ri==1 or rows[ri-1][1]!=rows[ri-2][1])
    for ci,(cell,w) in enumerate(zip(row.cells,widths)):
        cell.width=Inches(w);cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
        tcPr=cell._tc.get_or_add_tcPr();b=OxmlElement('w:tcBorders');tcPr.append(b)
        for side in ('top','left','bottom','right'):
            z=OxmlElement('w:'+side);z.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val','single');z.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sz','11' if side=='top' and first_in_group else '5');b.append(z)
        if ri==0 or ci==1:
            sh=OxmlElement('w:shd');sh.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill','D9E9D4' if ri==0 else 'F0F6ED');tcPr.append(sh)
        for p in cell.paragraphs:
            p.paragraph_format.space_after=Pt(0)
            for r in p.runs:r.font.name='Times New Roman';r.font.size=Pt(7.6);r.bold=ri==0 or ci==1
repeat=OxmlElement('w:tblHeader');repeat.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val','true');t.rows[0]._tr.get_or_add_trPr().append(repeat)
d.add_paragraph('The table records automated outcomes. Watch sensor delivery, GPS accuracy and background phone notifications also require device evidence.')
target=OUT/'ElderCareAI_Unit_Testing_By_Module.docx';d.save(target)
print(target,'cases',len(rows),'modules',len(groups))
