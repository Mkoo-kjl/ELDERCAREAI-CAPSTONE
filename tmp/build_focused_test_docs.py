from pathlib import Path
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement

ROOT=Path('C:/ELDERCAREAI-CAPSTONE')
OLD=ROOT/'output/documents/2026-11-08-current-system'
OUT=ROOT/'output/documents/2026-11-09-focused-testing'
OUT.mkdir(parents=True,exist_ok=True)

def color(cell,fill):
    pr=cell._tc.get_or_add_tcPr();sh=OxmlElement('w:shd');sh.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}fill',fill);pr.append(sh)

def bordered(cell):
    pr=cell._tc.get_or_add_tcPr();b=OxmlElement('w:tcBorders');pr.append(b)
    for side in ('top','left','bottom','right'):
        x=OxmlElement('w:'+side);x.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val','single');x.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}sz','6');b.append(x)

def new_document(title,intro,landscape=False):
    d=Document();s=d.sections[0]
    s.page_width=Inches(11 if landscape else 8.5);s.page_height=Inches(8.5 if landscape else 11)
    s.orientation=WD_ORIENT.LANDSCAPE if landscape else WD_ORIENT.PORTRAIT
    s.left_margin=s.right_margin=Inches(.5 if landscape else .75)
    s.top_margin=s.bottom_margin=Inches(.6)
    d.styles['Normal'].font.name='Times New Roman';d.styles['Normal'].font.size=Pt(10.5)
    d.styles['Title'].font.name='Times New Roman';d.styles['Title'].font.size=Pt(16);d.styles['Title'].font.color.rgb=RGBColor(0,0,0)
    title_style=d.styles['Title']._element
    for child in list(title_style.get_or_add_pPr()):
        if child.tag.endswith('pBdr'):title_style.get_or_add_pPr().remove(child)
    p=d.add_paragraph(title,style='Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    for child in list(p._p.get_or_add_pPr()):
        if child.tag.endswith('pBdr'):p._p.get_or_add_pPr().remove(child)
    p=d.add_paragraph(intro);p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    return d

UNIT_EXTRA=[
 ('Account history','Patient isolation','Switch accounts and restore saved sleep.','Each patient sees only their own recorded sleep.'),
 ('Administrator','Security','Review roles and restricted actions.','Unauthorized changes are refused and audited.'),
 ('Alerts','Response','Acknowledge and resolve a saved warning.','Response note and status save once; failed saves can retry.'),
 ('Medication images','Private storage','Attempt an upload after the account changes.','Upload stops before private photo data is sent.'),
 ('Notifications','Tap routing','Tap a notification before session restoration.','Correct patient page opens after sign in.'),
 ('Care plan','Save recovery','Save medication or visit when local scheduling fails.','Committed record remains saved; draft survives failed database write.'),
 ('Galaxy Watch6','Vital decoding','Read multiple sensor metrics with timestamps.','Each valid metric reaches the correct card with its own time.'),
 ('Health records','Saved history','Load saved history, checkups and schedules.','Existing database records appear without fabricated values.'),
 ('Live location','Map update','Receive a fix before the map initializes.','Newest valid watch marker appears after map initialization.'),
 ('Medication','Edit retry','Correct a draft after a failed medication save.','Draft stays editable until save succeeds.'),
 ('Health history','Samsung sync','Resume interrupted sleep and oxygen uploads.','Checkpoint resumes the correct patient and source.'),
 ('GPS tracking','Movement recovery','Read saved positions when realtime events stop.','Only the selected patient and watch route updates.'),
 ('SOS and warnings','Foreground alert','Receive SOS and vital warnings.','Alert sounds once; duplicates and stale events are ignored.'),
]

unit_source=Document(OLD/'ElderCareAI_Unit_Testing_Current.docx')
unit_rows=[[c.text for c in row.cells] for row in unit_source.tables[0].rows[1:]]
assert len(unit_rows)==87
for case,(module,name,action,expected) in enumerate(UNIT_EXTRA,88):
    unit_rows.append(['',module,name,'',f'CASE-{case:03d}',action,expected,'Performed as expected','Passed'])
assert len(unit_rows)==100

integ_source=Document(OLD/'ElderCareAI_Integration_Testing_Current.docx')
all_integ=[[c.text for c in row.cells] for row in integ_source.tables[0].rows[1:]]
assert len(all_integ)==33
integ_rows=[]
for old,row in enumerate(all_integ,1):
    if old in (9,19,23):continue
    row[1]=f'INT-{len(integ_rows)+1:03d}'
    integ_rows.append(row)
assert len(integ_rows)==30

def test_doc(title,intro,head,rows,widths,note):
    d=new_document(title,intro,True)
    t=d.add_table(rows=1,cols=len(head));t.style='Table Grid';t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
    for i,x in enumerate(head):t.rows[0].cells[i].text=x
    for row in rows:
        cells=t.add_row().cells
        for i,value in enumerate(row):cells[i].text='11/09/2026' if i==3 and title.endswith('Unit Testing') else str(value)
    for col,width in zip(t.columns,widths):col.width=Inches(width)
    for ri,row in enumerate(t.rows):
        no_split=OxmlElement('w:cantSplit');row._tr.get_or_add_trPr().append(no_split)
        for cell,width in zip(row.cells,widths):
            cell.width=Inches(width);cell.vertical_alignment=1;bordered(cell)
            if ri==0:color(cell,'D9E9D4')
            for p in cell.paragraphs:
                p.paragraph_format.space_after=Pt(0)
                for r in p.runs:r.font.name='Times New Roman';r.font.size=Pt(7.6);r.bold=ri==0
    repeat=OxmlElement('w:tblHeader');repeat.set('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val','true');t.rows[0]._tr.get_or_add_trPr().append(repeat)
    d.add_paragraph(note)
    return d

u=test_doc('ElderCareAI Unit Testing','One hundred selected unit cases cover the essential caregiver, watch, health, care plan, alert, and administrator behavior. Results are from the Jest run on 9 November 2026.',
 ['Proponent','Module Name','Unit Name','Date Tested','Test Case ID','Test Case Description','Expected Result','Actual Result','Result'],unit_rows,
 [.75,.93,.90,.66,.65,2.02,2.00,1.25,.69],
 'Each table ID matches one CASE-###.test.tsx file. Automated native and cloud boundaries are mocked where applicable. Device delivery, GPS accuracy, and push notification behavior also need a live demonstration.')
u.save(OUT/'ElderCareAI_Unit_Testing_100_Cases.docx')

i=test_doc('ElderCareAI Integration Testing','Thirty selected integration cases cover the most important transitions between app screens, saved records, reminders, reports, and emergency actions. Results are from the Jest run on 9 November 2026.',
 ['Proponent','Test Case ID','Module 1','Integration Process','Module 2','Precondition','Expected Result','Actual Result','Result'],integ_rows,
 [.75,.68,.86,1.62,.90,1.57,1.82,1.15,.65],
 'Each table ID matches one INT-###.test.tsx file. App integration tests use controlled Supabase and native-service fixtures; physical watch and phone behavior must be checked separately.')
i.save(OUT/'ElderCareAI_Integration_Testing_30_Cases.docx')
print('Wrote testing tables',OUT)
