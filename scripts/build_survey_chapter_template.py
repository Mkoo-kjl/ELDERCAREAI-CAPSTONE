"""Chapter IV template derived from the two actual ElderCareAI survey forms."""
from pathlib import Path
import json
from docx import Document
from docx.shared import Inches,Pt,RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT,WD_CELL_VERTICAL_ALIGNMENT,WD_ROW_HEIGHT_RULE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/documents/2026-11-10-survey-chapter';OUT.mkdir(parents=True,exist_ok=True)
forms=[json.loads((ROOT/f'tmp/survey-chapter/form-{i}-data.json').read_text(encoding='utf-8'))[1][1] for i in (1,2)]
profiles=[[q for q in form if q[3] in (2,4)] for form in forms]
grids=[[q for q in form if q[3]==7] for form in forms]
assert [len(x) for x in profiles]==[5,7]
assert [[len(q[4]) for q in group] for group in grids]==[[7,6],[8,7,12]]

d=Document();sec=d.sections[0];sec.page_width=Inches(8.5);sec.page_height=Inches(11)
sec.left_margin=Inches(1.5);sec.right_margin=Inches(1);sec.top_margin=Inches(.85);sec.bottom_margin=Inches(.8)
normal=d.styles['Normal'];normal.font.name='Times New Roman';normal.font.size=Pt(12);normal.font.color.rgb=RGBColor(0,0,0)
normal.paragraph_format.line_spacing=1.5;normal.paragraph_format.space_after=Pt(6)
for name in ['Title','Heading 1','Heading 2']:
 st=d.styles[name];st.font.name='Times New Roman';st.font.size=Pt(12);st.font.bold=True;st.font.color.rgb=RGBColor(0,0,0)
 st.paragraph_format.space_after=Pt(6);st.paragraph_format.space_before=Pt(4);st.paragraph_format.keep_with_next=True
 for child in list(st._element.get_or_add_pPr()):
  if child.tag.endswith('pBdr'):st._element.get_or_add_pPr().remove(child)
table_no=0;figure_no=0;pending_page=False

def body(text,indent=True):
 p=d.add_paragraph(text);p.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
 if indent:p.paragraph_format.first_line_indent=Inches(.35)
 return p
def small(text):
 p=d.add_paragraph(text);p.paragraph_format.line_spacing=1.1;p.paragraph_format.space_after=Pt(5)
 for r in p.runs:r.font.size=Pt(10)
 return p
def heading(text,level=1):
 global pending_page
 p=d.add_paragraph(text,style=f'Heading {level}')
 if pending_page:p.paragraph_format.page_break_before=True;pending_page=False
 return p
def page():
 global pending_page
 pending_page=True
def caption(number,title,kind='Figure'):
 p=d.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.line_spacing=1.1;p.paragraph_format.keep_with_next=True
 p.add_run(f'{kind} {number}: ');r=p.add_run(title);r.bold=True;r.underline=True
 return p
def table(title,columns,rows,widths,font=10,compact=False):
 global table_no
 table_no+=1;p=d.add_paragraph(f'Table {table_no}');p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.line_spacing=1;p.paragraph_format.keep_with_next=True
 p=d.add_paragraph(title);p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.line_spacing=1;p.paragraph_format.keep_with_next=True
 t=d.add_table(rows=1,cols=len(columns));t.style='Table Grid';t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.autofit=False
 for c,text in zip(t.rows[0].cells,columns):c.text=str(text)
 for row in rows:
  for c,text in zip(t.add_row().cells,row):c.text=str(text)
 for col,w in zip(t.columns,widths):col.width=Inches(w)
 for ri,row in enumerate(t.rows):
  prop=row._tr.get_or_add_trPr();prop.append(OxmlElement('w:cantSplit'))
  if ri==0:
   header=OxmlElement('w:tblHeader');header.set(qn('w:val'),'true');prop.append(header)
  for ci,(c,w) in enumerate(zip(row.cells,widths)):
   c.width=Inches(w);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
   if len(columns)>3:
    margins=OxmlElement('w:tcMar')
    for side in ('left','right'):
     margin=OxmlElement('w:'+side);margin.set(qn('w:w'),'40');margin.set(qn('w:type'),'dxa');margins.append(margin)
    c._tc.get_or_add_tcPr().append(margins)
   for p in c.paragraphs:
    p.paragraph_format.line_spacing=1;p.paragraph_format.space_after=Pt(1 if compact else 3);p.paragraph_format.space_before=Pt(1 if compact else 3)
    p.alignment=WD_ALIGN_PARAGRAPH.LEFT if ci==0 or (len(columns)>3 and ci==1) else WD_ALIGN_PARAGRAPH.CENTER
    for r in p.runs:r.font.name='Times New Roman';r.font.size=Pt(font);r.bold=ri==0
 return t
def link(p,label,url):
 h=OxmlElement('w:hyperlink');h.set(qn('r:id'),p.part.relate_to(url,RT.HYPERLINK,is_external=True));r=OxmlElement('w:r');pr=OxmlElement('w:rPr');color=OxmlElement('w:color');color.set(qn('w:val'),'0563C1');pr.append(color);r.append(pr);t=OxmlElement('w:t');t.text=label;r.append(t);h.append(r);p._p.append(h)

p=d.add_paragraph('CHAPTER IV',style='Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p=d.add_paragraph('PRESENTATION ANALYSIS AND INTERPRETATION OF DATA',style='Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
body('This chapter presents the profile and survey responses of elderly patients and caregivers regarding the existing caregiving process and the proposed ElderCareAI system. The findings are organized by respondent group and questionnaire section, with figures, frequency tables and a discussion for each topic.')
small('RESULTS TEMPLATE — Replace bracketed fields with verified survey results. No response counts, percentages, means, rankings or research findings have been supplied or assumed.')
heading('Profile of the respondents')
body('The elderly respondent profile covers age, sex, length of stay at the home of the aged, reported health conditions and comfort with wearing a tracker. The caregiver profile covers age, sex, years of experience, educational attainment, number of patients, familiarity with work-related mobile applications and health indicators that are challenging to monitor manually. These variables provide context for the needs and expectations expressed in the two forms.')
table('Respondent groups and usable survey records',['Respondent group','Usable responses','Excluded records'],[['Elderly patients — Form A','[N_A]','[n]'],['Caregivers — Form B','[N_B]','[n]']],[3.5,1.3,1.2])
small('Record exclusions and their reasons after checking consent, eligibility, duplicates and incomplete responses. Each group has its own denominator; do not assume equal group sizes or that the same people answered both forms.')
small('Presentation sequence: elderly profile; caregiver profile; existing-care ratings; proposed-system ratings; caregiver feature ratings; recommendations; synthesis. Begin with Figure 1 and Table 1 here, then renumber consistently when this chapter is merged into the thesis.')

profile_info=[
 [('Age of Elderly Respondents','Age distribution of elderly respondents','The age distribution describes the older adults represented in the survey. It can inform how the team plans readable screens and assisted use, but age alone does not establish a participant’s ability to use a wearable.'),
  ('Sex of Elderly Respondents','Sex distribution of elderly respondents','This distribution describes the composition of the elderly respondent group. It should not be used on its own to claim differences in health status or technology acceptance.'),
  ('Length of Stay at the Home of the Aged','Length of stay of elderly respondents','Length of stay provides context for participants’ experience with the facility’s existing care arrangements. A longer stay does not itself demonstrate better or poorer care.'),
  ('Reported Health Conditions','Health conditions reported by elderly respondents','These are self-reported conditions, not diagnoses established by the survey or ElderCareAI. They describe care context and do not establish disease prevalence beyond the participating respondents.'),
  ('Comfort with Wearing a Wristband or Tracker','Elderly respondents’ comfort with wearing a tracker','Reported comfort helps identify acceptance concerns that may need explanation, fit adjustments or assisted use. An expression of comfort does not confirm long-term use or clinical benefit.')],
 [('Age of Caregiver Respondents','Age distribution of caregiver respondents','The caregiver age distribution provides context for the respondent group. Avoid assuming digital skill from age; the form asks separately about mobile-application familiarity.'),
  ('Sex of Caregiver Respondents','Sex distribution of caregiver respondents','The distribution describes who participated in the caregiver survey. It does not establish differences in monitoring performance or caregiving ability.'),
  ('Years of Caregiving Experience','Years of experience of caregiver respondents','Experience describes the respondents’ exposure to caregiving work. Interpret it alongside their responses about workload and monitoring practices rather than treating it as proof of expertise.'),
  ('Highest Educational Attainment','Educational attainment of caregiver respondents','Educational attainment describes the group’s reported educational background. Because this question is optional, disclose missing responses and use the valid-answer count for percentages.'),
  ('Number of Elderly Patients Under Care','Patient workload reported by caregiver respondents','The patient-count categories describe reported workload. They can contextualize responses about simultaneous monitoring, but the survey does not establish that workload caused a specific problem.'),
  ('Familiarity with Work Related Mobile Applications','Caregiver familiarity with work-related mobile applications','The responses describe familiarity with work-related apps. Use the actual four options in the form; no Neutral option was provided for this question.'),
  ('Health Indicators Challenging to Monitor Manually','Health indicators caregivers find challenging to monitor manually','Selections identify areas of reported difficulty and can inform feature priorities. They do not establish that ElderCareAI measures each indicator continuously or with medical accuracy.')]
]

for group_index,qs in enumerate(profiles):
 group='elderly' if group_index==0 else 'caregiver';symbol='N_A' if group_index==0 else 'N_B'
 for j,q in enumerate(qs):
  page();title,fig_title,context=profile_info[group_index][j];heading(('Profile of elderly respondents' if group_index==0 else 'Profile of caregiver respondents') if j==0 else title)
  if j==0:heading(title,2)
  small('Survey item: '+q[1])
  opts=[('Other (specified)' if item[4:5]==[1] else item[0].lstrip(') ')) for item in q[4][0][1]]
  multi=q[3]==4
  figure_no+=1
  t=d.add_table(rows=1,cols=1);t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.columns[0].width=Inches(5.85);t.rows[0].height=Inches(1.8);t.rows[0].height_rule=WD_ROW_HEIGHT_RULE.EXACTLY
  c=t.cell(0,0);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
  pr=c._tc.get_or_add_tcPr();shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'F4F7F2');pr.append(shade)
  c.text='INSERT VERIFIED '+('HORIZONTAL BAR CHART' if multi or len(opts)>4 else 'BAR CHART')+'\n'+fig_title+'\nCategories shown below • frequency and percentage labels'
  for p in c.paragraphs:
   p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.line_spacing=1.2
   for r in p.runs:r.font.size=Pt(11);r.font.color.rgb=RGBColor.from_string('46633B')
  caption(figure_no,fig_title)
  rows=[[option,'[n]','[%]'] for option in opts]
  if not multi:rows.append(['Total valid answers','[n_valid]','[%]'])
  table(fig_title,['Category','Frequency','Percentage'],rows,[3.6,1.2,1.2])
  small(f'Base: [{symbol}] usable {group} records; this item has [n_valid] valid answers and [n_missing] unanswered records.')
  if multi:
   small('Multiple responses allowed. Percentage = respondents selecting a category ÷ valid respondents answering this item × 100. Percentages can exceed 100% in total; do not divide by the total number of selections. Code specific Other answers before combining them.')
   if group_index==0:small('The form has no explicit None option for health conditions. Do not interpret an unselected checkbox or missing answer as proof of no condition.')
   body(f'Figure {figure_no} presents the {group} respondents’ selections. The most frequently selected category was [category], identified by [n] respondents ([%]), followed by [category] with [n] ([%]). [Describe any ties or other notable selections using the actual counts.] '+context)
  else:
   small('Percentage = category frequency ÷ valid answers to this item × 100. Keep the category order shown in the questionnaire and label the frequency axis from zero.')
   body(f'Figure {figure_no} shows the distribution of {group} respondents for this item. Of [n_valid] valid answers, [n] ([%]) fell under [category], while [n] ([%]) were in [category]. [State the largest group only after checking for ties.] '+context)

page();heading('Ratings of the current caregiving process and proposed system')
body('Present the response distributions for each statement separately for elderly patients and caregivers. The tables below retain the statements as administered. They describe respondents’ opinions and expectations, rather than measured changes in health outcomes or proven system performance.')
table('Coding for the five point agreement scale',['Response','Score'],[['Strongly Agree (SA)','5'],['Agree (A)','4'],['Neutral (N)','3'],['Disagree (D)','2'],['Strongly Disagree (SD)','1']],[4.6,1.4])
body('For each statement, report the five response counts, the number of valid answers and the item mean. Item mean = (5 × SA + 4 × A + 3 × N + 2 × D + 1 × SD) ÷ valid answers to that statement. Retain blank or missing answers separately; do not code them as Neutral or zero.')
small('Optional interpretation bands for this template: 4.21–5.00 Strongly Agree; 3.41–4.20 Agree; 2.61–3.40 Neutral; 1.81–2.60 Disagree; 1.00–1.80 Strongly Disagree. Use these only if they match the approved methodology. Classify the unrounded mean and then display it to two decimals.')
heading('Direction of the statements',2)
small('Elderly negative statements: A-B5 (delays), A-B7 (monitoring problems) and A-C5 (concern about all-day wear). Caregiver negative statements: B-B2 (tracking difficulty), B-B5 (time-consuming monitoring), B-B6 (overwhelmed) and B-B7 (process problems). Higher raw scores indicate stronger agreement with those concerns.')
small('Do not average mixed-direction items and call the result satisfaction or effectiveness. If a composite is justified by the methodology and scale validation, reverse the negative items using 6 − original score, define the construct, and disclose the recoding. Otherwise report the item distributions without a composite.')

rating_groups=[(0,0,'Elderly Ratings of the Current Monitoring Process','A-B'),(1,0,'Caregiver Ratings of the Current Caregiving Process','B-B'),(0,1,'Elderly Perceptions of a Health Monitoring Wearable','A-C'),(1,1,'Caregiver Perceptions of the Proposed System','B-C'),(1,2,'Caregiver Ratings of Proposed Key Features','B-D')]
negative={'A-B':{5,7},'B-B':{2,5,6,7},'A-C':{5}}
for gi,grid_index,title,prefix in rating_groups:
 page();heading(title)
 small('Source: '+('Form A — elderly patients' if gi==0 else 'Form B — caregivers')+'. Report each item using its own valid-response count. SA/A/N/D/SD are counts; M is the item mean; VI is the verbal interpretation.')
 entries=grids[gi][grid_index][4];rows=[]
 for i,entry in enumerate(entries,1):
  text=entry[3][0]
  if i in negative.get(prefix,set()):text+=' [negative]'
  rows.append([f'{prefix}{i}',text,'[ ]','[ ]','[ ]','[ ]','[ ]','[ ]','[ ]'])
 table(title,['Item','Statement','SA','A','N','D','SD','M','VI'],rows,[.48,2.77,.31,.31,.31,.31,.31,.53,.67],font=9,compact=prefix=='B-D')
 small('For every row: valid n = SA + A + N + D + SD. If item denominators differ, state the valid n beside its result or in a table note. [negative] is an analysis marker, not part of the original survey wording.')
 body(f'Table {table_no} presents the responses to these statements. The highest raw item mean was [M] for [item], interpreted as [VI], while [item] had [M]. [Describe the observed response distribution and any ties.] Interpret the statement’s wording before discussing agreement; agreement with a negative statement indicates a reported concern.')
 if prefix=='A-B':small('Discussion focus: reported regularity of checks, perceived monitoring coverage, communication of health changes, safety, delays, adequacy and problems. The existing-care question mentions blood pressure; this is not a claim that ElderCareAI currently measures blood pressure.')
 elif prefix=='B-B':small('Discussion focus: coverage of multiple patients, emergency communication, adequacy of existing tools, time burden, workload and documentation. Do not describe these baseline opinions as a post-deployment evaluation.')
 elif prefix=='A-C':small('Discussion focus: willingness to wear a smartwatch, expected support and safety, alert expectations and concern about prolonged wear. A-C5 measures concern; it must not be counted as positive acceptance without an explicitly justified reversal.')
 elif prefix=='B-C':small('Discussion focus: expected usefulness of smartwatch monitoring, AI guidance, predictions, notifications and more complete records. Agreement expresses expectations; it does not prove improved accuracy, prevented complications or faster emergency response.')
 else:small('Discussion focus: heart rate, sleep, SpO2, stress, wrist temperature, activity, AI insights, predictions, anomaly flags, notifications, Elle summaries and reports. Keep the original statements in the results table even where their proposed capabilities exceed what has been clinically demonstrated.')

page();heading('Respondent recommendations')
body('Both forms include an optional recommendations field. Summarize the submitted suggestions by theme, keeping elderly and caregiver responses identifiable as separate groups. Omit names, health identifiers and recognizable personal details from quotations. Do not treat a blank field as a recommendation or as satisfaction.')
table('Themes from optional respondent recommendations',['Respondent group','Theme','Respondents mentioning theme','Anonymous supporting excerpt'],[['Elderly patients','[theme]','[n]','[verified excerpt]'],['Caregivers','[theme]','[n]','[verified excerpt]']],[1.1,1.2,1.3,2.4],font=10)
small('Count distinct respondents mentioning a theme, rather than repeated words in the same response. A response can contain several themes, so theme counts may overlap. If no recommendations were submitted, report zero submitted comments and omit unsupported themes.')
body('Among [n] submitted recommendation responses from elderly patients and [n] from caregivers, the recurring themes were [themes]. [Describe only themes supported by the actual comments.] These suggestions can inform practical improvements, but they do not substitute for technical tests or professional clinical assessment.')
heading('Synthesis of survey findings')
body('The elderly profile indicates [supported profile finding], while the caregiver profile indicates [supported profile finding]. The current-process ratings identify [documented strength or concern]. Responses about the proposed system indicate [supported expectation or concern]. The recommendations emphasize [verified themes]. These findings provide context for system design and further evaluation; they do not demonstrate clinical effectiveness.')
small('Keep the two respondent groups separate. Their age categories, roles and most statements differ. Do not report a pooled overall mean or present unmatched statements as a direct statistical comparison.')

page();heading('Reporting notes and questionnaire sources')
table('What to present from the two forms',['Data to show','Recommended presentation'],[['Elderly profile — 5 items','Figures 1–5 and frequency/percentage tables'],['Caregiver profile — 7 items','Figures 6–12 and frequency/percentage tables'],['Existing process — 7 elderly and 8 caregiver items','Separate five-category distributions and item means'],['Proposed system — 6 elderly and 7 caregiver items','Separate agreement tables with direction notes'],['Proposed key features — 12 caregiver items','Caregiver-only agreement table'],['Optional recommendations — both forms','Anonymous themes and respondent counts']],[3.15,2.85])
small('No city, address, income, religion, patient diagnosis confirmation, measured response time, SUS score or ISO quality score is collected in these two forms. Do not add such findings without another identified data source. Names and contact details should not appear in respondent-profile charts.')
small('Minor display cleanup: the caregiver experience option “) 6–10 years” is shown as “6–10 years”; “Strongly DIsagree” is standardized to “Strongly Disagree.” These changes do not change the category or response coding. Preserve meaningful Other responses and document their grouping.')
small('Clinical interpretation: wrist skin temperature is not core temperature or a fever diagnosis; the HRV-derived stress index is experimental; recorded sleep is imported after synchronization. Responses about cardiac irregularities, prediction accuracy or prevention of complications are perceptions and must not be presented as validated medical outcomes.')
small('Replace each interpretation prompt only after calculating the results. Add verified relevant literature if required by the thesis format; do not reuse the energy-monitoring references or numerical findings from the sample PDF.')
p=d.add_paragraph();link(p,'Survey Form A for elderly patients','https://docs.google.com/forms/d/e/1FAIpQLSfmC_JVnp73DxfhWCBgZSQDCTBikmxTMxgdxMLWrt1OX6kRcA/viewform')
p=d.add_paragraph();link(p,'Survey Form B for caregivers','https://docs.google.com/forms/d/e/1FAIpQLScVihhsqvZKaLG7OxsO6zdMbNzW6lxv9fUJno9LCk6Q154BtA/viewform')
small('Format reference: 228.pdf supplied by the researchers. Form structure checked on 10 November 2026. All bracketed results remain blank for the actual response exports.')
header=sec.header.paragraphs[0];header.alignment=WD_ALIGN_PARAGRAPH.RIGHT
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');header._p.append(field)
for r in header.runs:r.font.name='Times New Roman';r.font.size=Pt(10)
d.core_properties.title='ElderCareAI Chapter IV Survey Results Template'
d.core_properties.subject='Respondent profiles and agreement survey results based on Forms A and B'
path=OUT/'ElderCareAI_Chapter_IV_Survey_Template.docx';d.save(path)
assert figure_no==12
print(path,'figures',figure_no,'tables',table_no,'rating statements',sum(len(q[4]) for group in grids for q in group))
