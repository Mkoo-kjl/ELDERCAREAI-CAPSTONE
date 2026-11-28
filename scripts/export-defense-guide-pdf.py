"""Typeset the current eight-section Markdown defense guide without changing it."""
from pathlib import Path
import re
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Flowable, Frame, PageBreak, PageTemplate, Paragraph,
    Spacer, Table, TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/ELDERCAREAI_SYSTEM_GUIDE_FOR_DEFENSE.md'
OUTPUT = ROOT / 'output/pdf/ElderCareAI_System_Guide_for_Defense.pdf'
FONT = ROOT / 'website/assets/fonts'
for family, filename in [('Inter', 'inter-regular.ttf'), ('InterBold', 'inter-bold.ttf'), ('InterMedium', 'inter-medium.ttf')]:
    pdfmetrics.registerFont(TTFont(family, str(FONT / filename)))
pdfmetrics.registerFontFamily('Inter', normal='Inter', bold='InterBold', italic='Inter', boldItalic='InterBold')

INK = colors.HexColor('#193B40')
TEAL = colors.HexColor('#167E80')
TEXT = colors.HexColor('#283C43')
MUTED = colors.HexColor('#62777C')
LINE = colors.HexColor('#D6E3E5')
PALE = colors.HexColor('#EDF5F5')
W, H = A4
MARGIN = 18 * mm
CW = W - MARGIN * 2

def style(name, size, leading, **kw):
    return ParagraphStyle(name, fontName='Inter', fontSize=size, leading=leading,
                          textColor=TEXT, spaceAfter=6, allowWidows=0, allowOrphans=0,
                          splitLongWords=True, bulletFontName='Inter', bulletFontSize=size, **kw)

S = {
    'body': style('body', 9.1, 13.4),
    'small': style('small', 8.1, 11.6),
    'h1': style('section', 18, 22, spaceBefore=4, keepWithNext=True),
    'h2': style('subsection', 11, 14.5, spaceBefore=10, keepWithNext=True),
    'table': style('table', 8, 11.2),
    'th': style('table-heading', 8.1, 11.3),
    'bullet': style('bullet', 9.1, 13.4, leftIndent=12, firstLineIndent=0, bulletIndent=1),
    'order': style('order', 9.1, 13.4, leftIndent=19, firstLineIndent=0, bulletIndent=0),
    'cover-title': style('cover-title', 34, 39),
    'cover-sub': style('cover-subtitle', 17, 23),
    'kicker': style('kicker', 8.3, 12),
    'toc': style('toc', 10.1, 15.4, spaceBefore=7),
}
for name in ['h1', 'h2', 'cover-title']:
    S[name].fontName = 'InterBold'
    S[name].textColor = INK
S['th'].fontName = 'InterBold'
S['th'].textColor = INK
S['kicker'].fontName = 'InterBold'
S['kicker'].textColor = TEAL

def normalize(text):
    for dash in '\u2010\u2011\u2012\u2013\u2014\u2212':
        text = text.replace(dash, '-')
    return text.replace('\u2192', ' -> ')

def inline(text):
    # Protect link/code fragments before parsing emphasis.
    slots = []
    def save(value):
        slots.append(value)
        return f'ZZSLOT{len(slots)-1}ZZ'
    def link(match):
        label, target = match.groups()
        if target.startswith('https://'):
            return save(f'<link href="{escape(target, {chr(34): "&quot;"})}" color="#167E80">{escape(label)}</link>')
        portable = target.replace('C:/ELDERCAREAI-CAPSTONE/', '')
        return save(f'{escape(label)} <font size="7.2" color="#62777C">({escape(portable)})</font>')
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link, normalize(text))
    text = re.sub(r'`([^`]+)`', lambda m: save('<font name="InterMedium">'+escape(m.group(1))+'</font>'), text)
    text = escape(text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    for i, value in enumerate(slots):
        text = text.replace(f'ZZSLOT{i}ZZ', value)
    return text

def para(text, kind='body', **kwargs):
    return Paragraph(inline(text), S[kind], **kwargs)

class Architecture(Flowable):
    """Vector version of the source's Mermaid architecture, grouped by workflow."""
    def __init__(self):
        super().__init__()
        self.width = CW
        self.height = 558

    def draw(self):
        c = self.canv
        paths = [
            ('IDENTITY', ['Caregiver app', 'Supabase Auth', 'Google sign-in'], 'Session authorizes subsequent caregiver requests.'),
            ('WATCH TELEMETRY', ['Galaxy Watch', 'galaxy-watch', 'PostgreSQL', 'Caregiver app'], 'Scoped credential -> validated records -> Realtime / authenticated reads.'),
            ('HISTORY IMPORT', ['Samsung Health', 'Phone native SDK', 'galaxy-watch', 'PostgreSQL'], 'Explicitly selected source; sleep / oxygen records retain original times.'),
            ('REMOTE ALERTS', ['PostgreSQL events', 'Notifications / jobs', 'Worker + Expo / FCM', 'Caregiver app'], 'Saved alert -> durable queue -> submission / receipts -> device handling.'),
            ('ELLE ASSISTANT', ['Caregiver app', 'Assistant + DB context', 'Gemini', 'Answer + references'], 'Authorized database context informs the request; answers return to the app.'),
            ('PRESCRIPTION DRAFT', ['App / private Storage', 'prescription-draft', 'Gemini', 'Review + SQL save'], 'The backend downloads the image; a person reviews the draft before saving.'),
            ('ADMINISTRATION', ['Admin web portal', 'admin-portal', 'PostgreSQL + audit'], 'A separate active administrator role is checked on every request.'),
            ('PLACE SEARCH', ['Caregiver app', 'appointment-places', 'Photon', 'Search results'], 'User-submitted destination query; no patient medical record is sent.'),
        ]
        c.setFillColor(MUTED)
        c.setFont('Inter', 8)
        c.drawString(0, self.height - 11, 'Read each row from left to right. Repeated labels refer to the same component.')
        y = self.height - 31
        for title, nodes, note in paths:
            c.setFont('InterBold', 8)
            c.setFillColor(TEAL)
            c.drawString(0, y, title)
            box_y = y - 36
            gap = 18
            bw = (CW - gap * (len(nodes)-1)) / len(nodes)
            for i, label in enumerate(nodes):
                x = i * (bw + gap)
                c.setFillColor(PALE)
                c.setStrokeColor(LINE)
                c.roundRect(x, box_y, bw, 28, 5, stroke=1, fill=1)
                p = Paragraph(escape(label), ParagraphStyle('node', fontName='InterMedium',fontSize=7.8,leading=9.5,textColor=INK,alignment=1))
                _, ph = p.wrap(bw - 8, 25)
                p.drawOn(c, x+4, box_y+(28-ph)/2)
                if i < len(nodes)-1:
                    a, b, mid = x+bw+3, x+bw+gap-3, box_y+14
                    c.setStrokeColor(TEAL)
                    c.setLineWidth(0.9)
                    c.line(a, mid, b, mid)
                    c.line(b-3, mid+2, b, mid)
                    c.line(b-3, mid-2, b, mid)
            c.setFont('Inter', 7.2)
            c.setFillColor(MUTED)
            c.drawString(0, box_y-11, note)
            y -= 65

def table(rows):
    count = len(rows[0])
    head = rows[0][0]
    if count == 3:
        ratios = [.08,.46,.46] if head == 'Step' else [.18,.40,.42]
    else:
        ratios = [.27,.73]
    data = [[para(cell, 'th' if i == 0 else 'table') for cell in row] for i,row in enumerate(rows)]
    t = Table(data,colWidths=[CW*r for r in ratios],repeatRows=1,hAlign='LEFT',splitByRow=1)
    t.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor('#DBECEB')),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#F6F9FA')]),
        ('VALIGN',(0,0),(-1,-1),'TOP'),
        ('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),
        ('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7),
        ('LINEBELOW',(0,0),(-1,0),0.6,LINE),
        ('LINEBELOW',(0,1),(-1,-1),0.25,LINE),
    ]))
    return t

class GuideDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(filename,pagesize=A4,leftMargin=MARGIN,rightMargin=MARGIN,
                         topMargin=21*mm,bottomMargin=19*mm,title='ElderCareAI - System Guide for Defense',
                         author='Team SPARTAN',pageCompression=1)
        self.addPageTemplates(PageTemplate('guide',frames=[Frame(MARGIN,19*mm,CW,H-40*mm,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=self.chrome))

    def chrome(self,c,doc):
        c.saveState()
        if doc.page > 1:
            c.setFont('InterMedium',7.4)
            c.setFillColor(MUTED)
            c.drawString(MARGIN,H-12*mm,'ELDERCAREAI / SYSTEM GUIDE FOR DEFENSE')
            c.setStrokeColor(LINE)
            c.line(MARGIN,H-15*mm,W-MARGIN,H-15*mm)
        c.setStrokeColor(LINE)
        c.line(MARGIN,14*mm,W-MARGIN,14*mm)
        c.setFont('Inter',7)
        c.setFillColor(MUTED)
        c.drawString(MARGIN,9.5*mm,'Source review: 27 November 2026 | Code baseline: 9bb0dd4')
        c.drawRightString(W-MARGIN,9.5*mm,str(doc.page))
        c.restoreState()

    def afterFlowable(self,flowable):
        if hasattr(flowable,'section_key'):
            key=flowable.section_key
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(flowable.getPlainText(),key,0,False)
            self.notify('TOCEntry',(0,escape(flowable.getPlainText()),self.page,key))

def build():
    text=SOURCE.read_text(encoding='utf8')
    story=[Spacer(1,13*mm),para('TEAM SPARTAN / CAPSTONE SYSTEM GUIDE','kicker'),
           para('ElderCareAI','cover-title'),
           para('An AI-Driven IoT System for Elderly Monitoring and Caregiver Support','cover-sub'),
           Spacer(1,5*mm),para('System Guide for Defense','h2'),
           para('Architecture, workflows, operation, limitations and panel preparation.'),
           Spacer(1,9*mm),para('CONTENTS','kicker')]
    toc=TableOfContents()
    toc.levelStyles=[S['toc']]
    toc.dotsMinLevel=0
    story.extend([toc,Spacer(1,10*mm),para('Prepared from the existing Markdown guide. The diagram is typeset as grouped data paths; the technical scope and all eight sections are preserved.','small'),PageBreak()])
    lines=text.splitlines()
    i=0
    section=0
    while i<len(lines):
        line=lines[i].strip()
        if not line or line.startswith('# '):
            i+=1;continue
        if line.startswith('## '):
            section+=1
            if section>1:story.append(PageBreak())
            p=para(line[3:],'h1');p.section_key=f'section-{section}'
            story.extend([p,Spacer(1,3*mm)])
            i+=1;continue
        if line.startswith('### '):
            story.append(para(line[4:],'h2'));i+=1;continue
        if line.startswith('```mermaid'):
            i+=1
            while i<len(lines) and not lines[i].startswith('```'):i+=1
            story.extend([Architecture(),Spacer(1,6)])
            i+=1;continue
        if line.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].lstrip().startswith('|'):
                cells=[x.strip() for x in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?',x.replace(' ','')) for x in cells):rows.append(cells)
                i+=1
            story.extend([table(rows),Spacer(1,8)]);continue
        if line.startswith('- '):
            story.append(para(line[2:],'bullet',bulletText='\u2022'));i+=1;continue
        ordered=re.match(r'^(\d+)\. (.+)',line)
        if ordered:
            story.append(para(ordered.group(2),'order',bulletText=ordered.group(1)+'.'));i+=1;continue
        block=[line];i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^(#{1,3} |\||- |\d+\. |```)',lines[i].strip()):
            block.append(lines[i].strip());i+=1
        story.append(para(' '.join(block)))
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    GuideDoc(str(OUTPUT)).multiBuild(story)
    print(OUTPUT)

if __name__=='__main__':build()
