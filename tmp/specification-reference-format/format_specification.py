from pathlib import Path
from copy import deepcopy
import re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT = Path(r'C:\ELDERCAREAI-CAPSTONE')
SOURCE = ROOT / 'output/documents/ElderCareAI_Revised_Implementation_and_System_Specifications.docx'
OUTPUT = ROOT / 'output/documents/ElderCareAI_Revised_Specifications_Reference_Format.docx'
source = Document(SOURCE)
doc = Document(SOURCE)
body = doc._element.body
for node in list(body):
    if node.tag != qn('w:sectPr'): body.remove(node)
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.5), Inches(11)
sec.top_margin = sec.bottom_margin = Inches(1)
sec.left_margin = sec.right_margin = Inches(1)
sec.header_distance = sec.footer_distance = Inches(0.4)
for pp in sec.header.paragraphs: pp.clear()

for name in ('Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3','Caption'):
    sty = doc.styles[name]
    sty.font.name = 'Times New Roman'
    sty.font.size = Pt(11)
    sty.font.color.rgb = RGBColor(0,0,0)
    sty.font.italic = False
    rpr = sty._element.get_or_add_rPr()
    fonts = rpr.rFonts
    for key in list(fonts.attrib):
        if 'theme' in key.lower(): del fonts.attrib[key]
    for key in ('ascii','hAnsi','eastAsia','cs'): fonts.set(qn('w:'+key),'Times New Roman')
    for node in list(rpr):
        if node.tag in (qn('w:spacing'),qn('w:kern')): rpr.remove(node)
    ppr = sty._element.find(qn('w:pPr'))
    if ppr is not None:
        for node in list(ppr):
            if node.tag in (qn('w:pBdr'),qn('w:numPr')): ppr.remove(node)
    sty.paragraph_format.space_before = Pt(0)
    sty.paragraph_format.space_after = Pt(0)
    sty.paragraph_format.line_spacing = 1.5
for name in ('Title','Heading 1','Heading 2','Heading 3'):
    doc.styles[name].font.bold = True
    doc.styles[name].paragraph_format.keep_with_next = True
    doc.styles[name].paragraph_format.space_before = Pt(7)
doc.styles['Normal'].font.bold = False
doc.styles['Caption'].font.bold = False
doc.styles['Caption'].paragraph_format.keep_with_next = True

paras = [pp.text for pp in source.paragraphs if pp.text.strip()]
def original(starts):
    return next(t for t in paras if t.startswith(starts))

def para(text='', indent=False, after=4, line=1.5, size=11, bold=False, keep=False):
    pp = doc.add_paragraph()
    pp.add_run(text).bold = bold
    pp.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    pp.paragraph_format.first_line_indent = Inches(.5) if indent else Inches(0)
    pp.paragraph_format.line_spacing = line
    pp.paragraph_format.space_after = Pt(after)
    pp.paragraph_format.keep_with_next = keep
    pp.paragraph_format.widow_control = True
    for r in pp.runs: r.font.size = Pt(size)
    return pp

def head(text, new_page=False, title=False):
    pp = doc.add_paragraph(text, 'Title' if title else 'Heading 1')
    pp.paragraph_format.page_break_before = new_page
    pp.paragraph_format.line_spacing = 1.2
    pp.paragraph_format.space_after = Pt(3)
    return pp

def centered(text, keep=True, after=0):
    pp = para(text, line=1.15, after=after, keep=keep)
    pp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    return pp

def dash(text):
    pp = para('–\t' + text, after=5, line=1.15)
    pp.paragraph_format.left_indent = Inches(.25)
    pp.paragraph_format.first_line_indent = Inches(-.13)
    pp.paragraph_format.tab_stops.add_tab_stop(Inches(.25))
    pp.paragraph_format.keep_together = True
    return pp

def set_shade(cell, fill):
    tcpr = cell._tc.get_or_add_tcPr()
    for node in list(tcpr):
        if node.tag == qn('w:shd'): tcpr.remove(node)
    sh = OxmlElement('w:shd'); sh.set(qn('w:fill'), fill); tcpr.append(sh)

def cell_text(cell, text, bold=False, italic=False, align=WD_ALIGN_PARAGRAPH.LEFT, size=11):
    cell.text = text
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    for pp in cell.paragraphs:
        pp.alignment = align
        pp.paragraph_format.space_after = Pt(0)
        pp.paragraph_format.space_before = Pt(0)
        pp.paragraph_format.line_spacing = 1.05
        for run in pp.runs:
            run.font.name = 'Times New Roman'; run.font.size = Pt(size)
            run.font.bold = bold; run.font.italic = italic
            run.font.color.rgb = RGBColor(0,0,0)

def make_table(widths, headers=None, rows=(), shade=None, centers=(), font=11, pad=55):
    tt = doc.add_table(rows=0, cols=len(widths))
    tt.alignment = WD_TABLE_ALIGNMENT.CENTER; tt.autofit = False
    for col,width in zip(tt.columns,widths): col.width = Inches(width)
    pr = tt._tbl.tblPr
    for node in list(pr):
        if node.tag in (qn('w:tblBorders'),qn('w:tblCellMar')): pr.remove(node)
    borders = OxmlElement('w:tblBorders')
    for side in ('top','left','bottom','right','insideH','insideV'):
        e = OxmlElement('w:'+side)
        for key,val in [('val','single'),('sz','6'),('color','000000')]: e.set(qn('w:'+key),val)
        borders.append(e)
    pr.append(borders)
    margins = OxmlElement('w:tblCellMar')
    for side,width in [('top',pad),('bottom',pad),('left',75),('right',75)]:
        e=OxmlElement('w:'+side); e.set(qn('w:w'),str(width)); e.set(qn('w:type'),'dxa'); margins.append(e)
    pr.append(margins)
    all_rows = ([headers] if headers else []) + list(rows)
    for i,values in enumerate(all_rows):
        row = tt.add_row()
        row_pr = row._tr.get_or_add_trPr()
        row_pr.append(OxmlElement('w:cantSplit'))
        if i==0 and headers:
            row_pr.append(OxmlElement('w:tblHeader'))
        for j,(cell,value) in enumerate(zip(row.cells,values)):
            cell.width = Inches(widths[j])
            cell_text(cell,str(value),bold=bool(headers and i==0),align=WD_ALIGN_PARAGRAPH.CENTER if j in centers else WD_ALIGN_PARAGRAPH.LEFT,size=font)
            set_shade(cell,shade if i==0 and headers and shade else 'FFFFFF')
    return tt

def spacer(after=3):
    return para('',after=after,line=1,size=2)

def add_links_from_source(index):
    pp = doc.add_paragraph()
    original_pp = [p for p in source.paragraphs if p.text.startswith('Technical references:')][index]
    for node in original_pp._p:
        if node.tag == qn('w:pPr'): continue
        copy = deepcopy(node)
        if node.tag == qn('w:hyperlink'):
            rid = node.get(qn('r:id'))
            copy.set(qn('r:id'), doc.part.relate_to(source.part.rels[rid].target_ref,RT.HYPERLINK,is_external=True))
        pp._p.append(copy)
    pp.paragraph_format.line_spacing = 1
    pp.paragraph_format.space_before = Pt(5)
    pp.paragraph_format.space_after = Pt(5)
    for r in pp.runs: r.font.size = Pt(9.5)
    return pp

# Retain the revised budget, restyled as a conventional academic table.
head('Implementation Budget / Cost Specification', title=True)
para(original('The following budget covers'),indent=True,line=1.15,after=6,size=11)
budget_rows = [[c.text for c in row.cells] for row in source.tables[0].rows[1:]]
bt = make_table([2.95,2.05,1.5],headers=['Item','Cost Basis','Amount'],rows=budget_rows,font=10.5,pad=55)
for index in (4,10,14,15):
    for cell in bt.rows[index].cells:
        for pp in cell.paragraphs:
            for run in pp.runs: run.bold=True
for row in bt.rows[1:]: row.cells[2].paragraphs[0].alignment=WD_ALIGN_PARAGRAPH.RIGHT
spacer()
for starts in ('The laptop and phone amounts','Internet and electricity total','Zero-cost software entries'):
    para(original(starts),indent=True,line=1.1,size=11,after=5)
add_links_from_source(0)

# Two-column software table with the merged gray heading in the reference.
head('Software Specification',new_page=True)
para('The system is to be implemented with the following software specifications:',indent=True,after=4)
centered('Table 32')
centered('SOFTWARE SPECIFICATION AND HARDWARE SPECIFICATION',after=5)
st = make_table([3.1,3.4])
row = st.add_row(); merged=row.cells[0].merge(row.cells[1])
cell_text(merged,'ElderCareAI: An AI-Driven IoT System for Elderly Monitoring and Caregiver Support\nSOFTWARE DEVELOPMENT REQUIREMENT SPECIFICATION',bold=True)
set_shade(merged,'D9D9D9')
row._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
software_groups=[
    ('Back-end:',[
        ('DBMS','PostgreSQL (Supabase)'),
        ('Server-side Programming','TypeScript / Deno-compatible Supabase Edge Functions; PostgreSQL SQL functions'),
        ('Cloud Service','Supabase Cloud (Auth, Realtime, Storage)'),
        ('AI Service','Gemini API through server-side functions'),
        ('Notification Service','Expo Push Service and Firebase Cloud Messaging v1'),
    ]),
    ('Front-end:',[
        ('Platform Technologies','Custom Android APK with native modules'),
        ('Programming / Scripting Language','TypeScript / JavaScript'),
        ('Software Framework','React Native, Expo'),
        ('UI Environment','Android mobile phone'),
        ('Administration Portal','HTML, CSS and JavaScript in a modern web browser'),
    ]),
    ('Watch and Health Integration:',[
        ('Watch Application','Kotlin, Android SDK and Wear OS'),
        ('Live Sensor Integration','Samsung Health Sensor SDK; watch GPS for location'),
        ('Health History Integration','Samsung Health Data SDK: sleep and recorded oxygen'),
        ('Development Tools','Visual Studio Code, Android Studio, Android SDK, Gradle, JDK and Node.js'),
    ]),
]
for group,values in software_groups:
    row=st.add_row(); cell=row.cells[0].merge(row.cells[1]); cell_text(cell,group,align=WD_ALIGN_PARAGRAPH.CENTER)
    row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
    for label,value in values:
        row=st.add_row(); row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
        cell_text(row.cells[0],label); cell_text(row.cells[1],value)
spacer()
para('A custom APK supplies native health access and push support; Expo Go cannot load these modules. Configure Google sign-in, Samsung SDK access, backend secrets and Firebase/Expo credentials. Public Samsung SDK distribution has separate registration requirements. Retain compatible signing credentials for updates. Node.js is a development tool; Edge Functions use a Deno-compatible runtime.',indent=True,line=1.15,size=11,after=5)
add_links_from_source(1)

# Preserve a single minimum-versus-recommended grid, as in the screenshots.
head('Hardware Specification',new_page=True)
para('The system is to be implemented with the following hardware specifications:',indent=True,after=5)
hardware=[
    ('Development CPU','Compatible 64-bit processor; virtualization support for emulator use','Recent Intel Core i5 / AMD Ryzen 5 class or better'),
    ('Development Memory (RAM)','8 GB RAM for Android Studio without an emulator','16 GB for physical-device work; 32 GB for heavier emulator use'),
    ('Development Storage','Space for Android Studio, SDKs, Gradle caches and project files','SSD with at least 32 GB free for tools, plus project and build space'),
    ('Development Display','1280 × 800 pixels; USB or wireless debugging access','1920 × 1080 pixels or higher; stable internet and USB access'),
    ('Development Operating System','64-bit Windows 10 supported by the tools','A currently supported 64-bit Windows release'),
    ('Phone Operating System','Android 10 / API 29 or later','Android 13 or later, with current permission controls'),
    ('Input Devices','Touchscreen controls on the Android phone and watch','Readable, accessible touch controls on both devices'),
    ('Output Devices','Display, speaker and vibration','Display, sound and vibration with permitted Android push notifications'),
    ('Wearable IoT Device','Samsung Galaxy Watch6 with the ElderCareAI Wear OS APK','Updated watch software and Health Sensor Service; enabled sensor and location permissions'),
    ('Health and Location Sensing','Supported heart rate, SpO₂, wrist skin-temperature, motion and GPS readings','Valid sensor contact and GPS fix; sleep imported after recording and stress derived from HRV'),
    ('Phone Health Integration','Samsung Health 6.30.2 or later and Galaxy Wearable on the paired phone','Patient’s watch paired to the same phone; required sleep and oxygen read permissions granted'),
    ('Bluetooth and Messaging','Watch–phone pairing; Google Play services on the phone for FCM','Stable pairing with notification registration and permission enabled'),
    ('Cloud Server','Supabase Cloud with PostgreSQL','Supabase Authentication, Realtime, Storage and Edge Functions'),
    ('Internet Connection','Internet access for uploads and cloud services','Stable Wi-Fi or mobile data for watch / phone synchronization and caregiver access'),
    ('Power Supply','Rechargeable phone and smartwatch batteries with appropriate chargers','Routine charging; sufficient charge for active sensor and GPS use'),
    ('Administrator Device','Laptop or desktop with a modern browser and internet connection','Secure, updated browser access to the administration portal'),
]
make_table([1.3,2.6,2.6],headers=['Component','Minimum Requirement','Recommended Requirement'],rows=hardware,font=11,pad=55)
spacer()
para('The development computer and runtime devices have different requirements, as identified in the component labels. Sensor updates and GPS depend on permissions, contact, signal and connectivity; active monitoring increases battery use. Other watch models require separate compatibility testing.',indent=True,line=1.15,size=11)
add_links_from_source(2)

# Original plain bold role headings and indented descriptions.
head('Human Resource Specification')
para('The research study, ElderCareAI, was designed to address the needs of the following users:',indent=True)
roles=[('1.  Caregiver','The caregiver manages the assigned'),('2.  System Administrator','The administrator uses the web portal'),('3.  Older Adult / Watch Wearer','The older adult wears the Galaxy Watch6')]
for title,starts in roles:
    pp=para(title,after=0,keep=True)
    pp.paragraph_format.left_indent=Inches(.2)
    para(original(starts),indent=True,after=5)

# Convert FR/NFR codes into the dash-list format shown by the user.
head('Program Specification',new_page=True)
para('The system is to be implemented with the following program specifications:',indent=True)
head('Functional Requirements')
para('ElderCareAI is expected to perform the following functionalities:',after=7,line=1.15)
for item in paras:
    if item.startswith('FR-'):
        dash(re.sub(r'^FR-\d+\.\s*','',item))
head('Data Collection and Update Behavior')
make_table([1.35,5.15],headers=['Data','Collection and Update Behavior'],rows=[[c.text for c in row.cells] for row in source.tables[4].rows[1:]],font=11,pad=55)
spacer()
para(original('Live updates are limited'),indent=True,line=1.15,size=11)
add_links_from_source(3)
head('Automatic Vital Review Rules')
para(original('The following are the current application review rules'),indent=True,line=1.15)
make_table([1.2,2.2,3.1],headers=['Metric','Warning Condition','Evaluation Basis'],rows=[[c.text for c in row.cells] for row in source.tables[5].rows[1:]],font=11,pad=55)
spacer()
para(original('A qualifying reading can create'),indent=True,line=1.15,size=11)
head('Nonfunctional Requirements')
para('ElderCareAI is designed to operate under the following parameters:',after=7,line=1.15)
for item in paras:
    if item.startswith('NFR-'):
        dash(re.sub(r'^NFR-\d+\.\s*','',item))

# Green header, domain rows, merged proponents and per-proponent points.
head('List of modules',new_page=True)
para('The table below presents the proposed module assignments. Each proponent is responsible for implementing, testing and improving six modules of the updated ElderCareAI system.',indent=True,after=5,line=1.15)
para('An asterisk identifies use or participation, including wearing the watch. It does not grant permissions. Participation totals overlap when modules serve several user groups.',indent=True,after=5,line=1.15)
centered('Table 31')
centered('LIST OF MODULES',after=5)
mt=make_table([1.6,2.75,.65,.8,.7],headers=['Proponents','Modules','Elderly','Caregiver','Admin'],shade='82DE8C',font=11,pad=40)
module_rows=[]
for row in source.tables[6].rows[1:]:
    cells=[c.text for c in row.cells]
    module_rows.append(cells)
domains=['Authentication & User Management Modules','Health Monitoring Modules','Emergency & Monitoring Modules']
for block in range(3):
    category=mt.add_row(); category._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
    cell_text(category.cells[0],'')
    merged=category.cells[1].merge(category.cells[4]); cell_text(merged,domains[block],bold=True,italic=True)
    start=len(mt.rows)
    for vals in module_rows[block*6:block*6+6]:
        row=mt.add_row(); row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
        cell_text(row.cells[0],'')
        cell_text(row.cells[1],vals[1])
        for j in (2,3,4): cell_text(row.cells[j],'*' if vals[j]=='Yes' else '',align=WD_ALIGN_PARAGRAPH.CENTER)
    namecell=mt.cell(start,0).merge(mt.cell(start+5,0))
    cell_text(namecell,module_rows[block*6][0])
    points=mt.add_row(); points._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
    pointlabel=points.cells[0].merge(points.cells[1]); cell_text(pointlabel,'No. of Points (1 point per module)')
    for j in (2,3,4):
        count=sum(v[j]=='Yes' for v in module_rows[block*6:block*6+6])
        cell_text(points.cells[j],str(count),align=WD_ALIGN_PARAGRAPH.CENTER)

spacer()
para('Total assigned modules: 18 (six per proponent). Participation totals: Elderly 7, Caregiver 14, Administrator 10.',line=1.15,size=11)

doc.core_properties.title='ElderCareAI Revised Implementation and System Specifications'
doc.core_properties.subject='Revised specifications in the supplied academic table and list format'
doc.core_properties.comments=''
doc.save(OUTPUT)
assert 30000+14000+4500+1699+3000+2000==55199
assert [sum(row[j]=='Yes' for row in module_rows) for j in (2,3,4)]==[7,14,10]
print(OUTPUT)
