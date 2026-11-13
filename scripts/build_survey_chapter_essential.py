"""Focused Chapter IV presentation without duplicating every survey question."""
from pathlib import Path
source=Path(__file__).with_name('build_survey_chapter_template.py')
# Reuse the already verified reference-style document helpers and form extraction.
exec(compile(source.read_text(encoding='utf-8').split("p=d.add_paragraph('CHAPTER IV'")[0],str(source),'exec'))

p=d.add_paragraph('CHAPTER IV',style='Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
p=d.add_paragraph('PRESENTATION ANALYSIS AND INTERPRETATION OF DATA',style='Title');p.alignment=WD_ALIGN_PARAGRAPH.CENTER
body('This chapter presents the respondent characteristics, monitoring needs and expected care support most relevant to ElderCareAI. Elderly and caregiver results are reported separately. Replace the bracketed fields with verified results.')
small('Report these items whether results support or challenge the system. Retain the complete questionnaire and remaining results in the appendix.')
heading('Profile of the respondents')
body('The profile focuses on elderly age, health conditions and wearable comfort, plus caregiver workload, app familiarity and monitoring difficulties.')

chosen=[
 (0,0,'Age of Elderly Respondents','Age distribution of elderly respondents','This describes the older adults represented and provides context for readable screens and assisted use. Age alone does not establish digital ability.'),
 (0,3,'Reported Health Conditions','Reported health conditions of elderly respondents','This provides care context for health monitoring. Conditions are self-reported; they are not diagnoses established by the survey or app.'),
 (0,4,'Comfort with Wearing a Tracker','Elderly respondents’ comfort with wearing a tracker','This describes the practical acceptability of wearing Galaxy Watch6. Report discomfort as clearly as comfort.'),
 (1,4,'Number of Elderly Patients Under Care','Patient workload reported by caregivers','Workload provides context for reviewing patient records and receiving alerts. It does not prove that the system reduces workload.'),
 (1,5,'Familiarity with Work Related Mobile Applications','Caregiver familiarity with work-related applications','This helps contextualize onboarding and interface accessibility. Preserve the four response options; this question has no Neutral category.'),
 (1,6,'Health Indicators Challenging to Monitor Manually','Health indicators caregivers find challenging to monitor','This identifies reported monitoring difficulties relevant to the vital cards. It does not establish clinical accuracy or prove that every metric is continuously available.')]
for index,(group,item,title,figtitle,context) in enumerate(chosen):
 if index:page()
 heading(title,2 if index==0 else 1)
 q=profiles[group][item];opts=[('Other (specified)' if opt[4:5]==[1] else opt[0]) for opt in q[4][0][1]]
 multi=q[3]==4;figure_no+=1
 small(('Form A — elderly respondents. ' if group==0 else 'Form B — caregivers. ')+'Usable group responses: [N]. Valid answers to this item: [n_valid].')
 t=d.add_table(rows=1,cols=1);t.alignment=WD_TABLE_ALIGNMENT.CENTER;t.columns[0].width=Inches(6)
 t.rows[0].height=Inches(1.2 if index==0 else 1.8);t.rows[0].height_rule=WD_ROW_HEIGHT_RULE.EXACTLY
 c=t.cell(0,0);c.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER;c.text='INSERT VERIFIED BAR CHART\n'+figtitle+'\nUse the categories and actual counts below'
 shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'F4F7F2');c._tc.get_or_add_tcPr().append(shade)
 for p in c.paragraphs:
  p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.line_spacing=1.1
  for r in p.runs:r.font.size=Pt(11);r.font.color.rgb=RGBColor.from_string('46633B')
 caption(figure_no,figtitle)
 rows=[[opt,'[n]','[%]'] for opt in opts]
 if not multi:rows.append(['Total valid answers','[n_valid]','[%]'])
 table(figtitle,['Category','Frequency','Percentage'],rows,[3.6,1.2,1.2])
 small('Percentage = category frequency ÷ valid respondents answering this item × 100. Show the actual group denominator and any missing responses; start the bar-chart frequency axis at zero.')
 if multi:
  small('Multiple answers allowed: percentages can total more than 100%. Count respondents selecting each option, not the total number of selections. Preserve or code specific Other answers.')
  if group==0:small('The form has no explicit None option. Missing or unselected health-condition answers do not prove absence of a condition.')
 body(f'Figure {figure_no} shows that [category] was reported by [n] respondents ([%]), compared with [n] ([%]) for [category]. [Describe the largest category and any ties after verifying the counts.] '+context)

def selected_rows(specs):
 rows=[]
 for group,grid,item,code,negative in specs:
  statement=grids[group][grid][4][item-1][3][0]
  rows.append([code,statement+(' [negative]' if negative else ''),'[ ]','[ ]','[ ]','[ ]','[ ]','[ ]'])
 return rows

page();heading('Key findings on the existing monitoring process')
body('These selected baseline items describe monitoring coverage and burden. They include positive and negative statements, so the discussion can identify both current strengths and difficulties. A denotes elderly respondents and B denotes caregivers; their results must not be pooled.')
small('SA = Strongly Agree (5); A = Agree (4); N = Neutral (3); D = Disagree (2); SD = Strongly Disagree (1). Each response column contains a count. M = item mean.')
table('Selected existing process ratings',['Item','Statement','SA','A','N','D','SD','M'],selected_rows([
 (0,0,1,'A-B1',False),(0,0,5,'A-B5',True),(1,0,1,'B-B1',False),(1,0,2,'B-B2',True),(1,0,5,'B-B5',True)]),[.5,3,.4,.4,.4,.4,.4,.5],font=9.5)
body('Table 7 indicates that elderly respondents reported [finding about regular checks and delays]. Caregivers reported [finding about monitoring coverage, simultaneous tracking or time burden]. These findings describe the current care setting and provide context for ElderCareAI; they are not evidence of improvement after deployment.')
small('Mean = (5×SA + 4×A + 3×N + 2×D + SD) ÷ valid answers to that item. Report missing answers separately. Higher agreement with [negative] items indicates a greater reported problem. Do not calculate a combined satisfaction mean from these mixed-direction items.')
small('A-B1 mentions blood pressure in the existing care process. ElderCareAI does not currently measure blood pressure. Retain the original question wording when presenting survey results.')

page();heading('Acceptance and expected support for care tasks')
body('Present willingness, concerns and expected usefulness as perceptions. These selected items support discussion of wearable adoption, Elle assistance and a consolidated view of available health information.')
table('Selected acceptance and expected usefulness ratings',['Item','Statement','SA','A','N','D','SD','M'],selected_rows([
 (0,1,1,'A-C1',False),(0,1,5,'A-C5',True),(1,1,5,'B-C5',False),(1,1,7,'B-C7',False)]),[.5,3,.4,.4,.4,.4,.4,.5],font=9.5)
small('A-C5 is a concern about wearing a device all day. Report it separately from willingness; do not describe agreement with that concern as positive acceptance.')
table('Selected expected benefits of key features',['Item','Statement','SA','A','N','D','SD','M'],selected_rows([
 (1,2,2,'B-D2',False),(1,2,10,'B-D10',False),(1,2,12,'B-D12',False)]),[.5,3,.4,.4,.4,.4,.4,.5],font=9.5,compact=True)
body('Tables 8 and 9 show [supported findings about willingness and concerns], while caregivers expected [supported usefulness findings]. Report any neutral or unfavorable responses. These opinions concern proposed benefits; they do not demonstrate better sleep assessment, faster emergency response or less documentation time in actual use.')
small('Use item means and five-category counts without an overall composite. Preserve the statements as administered. Only available recorded sleep and supported measurements can be shown by the app; the experimental stress estimate is not a clinical assessment.')
small('Optional: if relevant comments were actually submitted, add one short paragraph summarizing recurring anonymous recommendations. Omit it when there are no comments; do not add invented themes.')
p=small('Questionnaires: ');link(p,'Form A elderly','https://docs.google.com/forms/d/e/1FAIpQLSfmC_JVnp73DxfhWCBgZSQDCTBikmxTMxgdxMLWrt1OX6kRcA/viewform');p.add_run(' | ');link(p,'Form B caregivers','https://docs.google.com/forms/d/e/1FAIpQLScVihhsqvZKaLG7OxsO6zdMbNzW6lxv9fUJno9LCk6Q154BtA/viewform')
header=sec.header.paragraphs[0];header.alignment=WD_ALIGN_PARAGRAPH.RIGHT;field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');header._p.append(field)
d.core_properties.title='ElderCareAI Essential Chapter IV Survey Template'
path=OUT/'ElderCareAI_Chapter_IV_Essential_Template.docx';d.save(path)
assert figure_no==6 and table_no==9
print(path,'6 profile topics; 12 selected rating statements; 9 tables')
