from zipfile import ZipFile
from pathlib import Path
from lxml import etree as E
from difflib import SequenceMatcher
import json,re

SRC=Path('C:/Users/cedri/Downloads/REVISED USE CASE.docx')
OUT=Path('C:/ELDERCAREAI-CAPSTONE/output/documents/2026-11-10-use-cases');OUT.mkdir(parents=True,exist_ok=True)
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
changes={
7:"The overview identifies the Caregiver, Elderly Person, and Administrator roles, including watch monitoring, care plans, health review, emergency support, and system administration.",
20:'The caregiver opens ElderCareAI and selects Sign in with Google.',
29:'1. Open the app and select Sign in with Google.',
66:'4. Select the Sign in button.',
78:'A newly authenticated caregiver completes the introduction, caregiver and patient profiles, Galaxy Watch pairing, and watch-location sharing setup.',
86:'A newly authenticated caregiver completes the introduction, caregiver and patient profiles, Galaxy Watch pairing, and watch-location sharing setup.',
92:'Completed setup steps are saved and the caregiver enters Home; watch pairing may be completed later.',
114:'7. Connect Galaxy Watch6 using the phone-generated code, or skip pairing.',
117:'9. Review watch location sharing and select Finish setup.',
129:'8. Save the watch pairing state and paired-device count when available.',
132:'10. Complete setup and open Home; location permission is requested on the watch when monitoring starts.',
136:'The caregiver reviews current readings, measurement times, care tasks, doctor shortcuts, watch upload status, and the latest received watch location.',
144:'The caregiver reviews current readings, measurement times, care tasks, doctor shortcuts, watch upload status, and the latest received watch location.',
169:'2. Load profiles, care tasks, doctor contacts, current vitals, and watch status.',
171:'4. Refresh saved watch data and available Health History imports.',
172:'    4.1. If newer records exist, display their values and original measurement times.',
173:'    4.2. Else, retain saved values and identify missing, stale, or disconnected data.',
195:'Selected alerts are reviewed or resolved; notifications are marked read or cleared as permitted.',
204:'5. Review alert details and available response actions.6. Mark a notification read, resolve an alert with a response note, or clear a notification.',
205:"2. Load alerts and notifications; display an empty state when none exist.4. Show severity, original time, status, and linked medications when available.",
213:'The caregiver reviews recorded vital values, readable status labels, recent changes, and general preventive care guidance for available metrics.',
221:'The caregiver reviews recorded vital values, readable status labels, recent changes, and general preventive care guidance for available metrics.',
223:'The caregiver opens Health and selects AI Insights.',
232:'1. Open Health and select AI Insights.',
234:'3. Review heart rate, SpO2, sleep, daily steps, wrist temperature, or experimental HRV-based stress summaries.',
246:'4. Derive status labels and recent changes from available recorded measurements.',
247:'    4.1. If readings exist, show dated values and supported changes with general wellness guidance.',
248:'    4.2. Else, identify the missing metric without inventing measurements or advice.',
250:'6. Show live values, saved history, and a stable Elle insight with manual refresh.',
599:'The patient wears Galaxy Watch6 running ElderCareAI, paired directly to the patient profile; monitoring uploads measurements to Supabase.',
607:'The elderly person wears the paired Galaxy Watch6 and starts ElderCareAI monitoring to collect supported vital and location measurements.',
609:'The elderly person wears the configured watch and starts monitoring.',
611:'Galaxy Watch6 is charged, paired to the ElderCareAI patient profile, and has the required permissions.',
613:'Available measurements update watch cards and are uploaded to Supabase; unsent vital events remain queued for retry.',
618:'1. Wear Galaxy Watch6 with suitable wrist contact.',
620:'3. Tap Start monitoring; keep location, sensor permissions, and internet available.',
622:'5. Request a blood-oxygen spot check when desired; foreground auto checks are optional.',
624:'2. Request supported vital measurements and GPS, fused, or network locations.',
626:'4. Show sensor, location-source, accuracy, and upload status.',
629:'6. Save accepted vital events and share current values with the caregiver app; import recorded sleep separately through Samsung Health.',
631:'7. If the watch is off or monitoring stops, no new live events are collected; queued vital uploads retry when possible.',
635:'Galaxy Watch6 uploads measurements directly to Supabase. Realtime and reconciliation refresh the caregiver view; Health History imports recorded sleep and supported oxygen.',
643:'The elderly person views available readings on the ElderCareAI watch dashboard and checks their measurement age or sensor status.',
645:'The elderly person opens ElderCareAI on the watch to inspect a reading.',
647:'The watch is paired and the selected metric has a usable current or saved reading.',
649:'The watch displays the available reading and status while accepted measurements are recorded through monitoring.',
654:'1. Wake Galaxy Watch6 and open ElderCareAI.',
656:'2. View the dashboard or open a blood-oxygen spot check.',
664:'7. Continue monitoring and keep internet available for uploads.',
667:'3. Display available heart rate, wrist temperature, monitored steps, oxygen, or HRV-based stress estimate.',
669:'4. If a valid reading is unavailable, show waiting, missing-data, or retry feedback.',
718:'The caregiver manages medications and appointments, optionally reviews a prescription draft, and receives reminders; phone or watch dose confirmations update saved records.',
726:'The caregiver manages medications and appointments, optionally reviews a prescription draft, and receives reminders; phone or watch dose confirmations update saved records.',
732:'Care items, images, times, and confirmed doses are saved; eligible reminders use local scheduling and server push.',
737:'1. Open Care and add or edit a medication or appointment; review any prescription draft before confirming it.',
749:'5. Confirm the corresponding dose as Taken on the phone or watch after medication is taken.',
751:'7. Review reminder, permission, and confirmation status.',
753:'2. Validate required fields, local schedule dates, and AM/PM reminder times.',
757:'4. Save the schedule and prepare eligible local, server-push, or watch reminders.',
758:'    4.1. If delivery is enabled, schedule each due event separately, including events at the same time.',
759:'    4.2. Else, retain the schedule and explain the missing permission or registration.',
761:'6. Save one confirmation per scheduled dose and update the phone and watch after synchronization.',
767:'The caregiver views watch-uploaded GPS, fused, or network estimates on a live map and configures the patient safe zone.',
775:'The caregiver views watch-uploaded GPS, fused, or network estimates on a live map and configures the patient safe zone.',
777:'The caregiver opens Live location tracking or receives a safe-zone notification.',
779:'A patient watch is paired; fresh locations require monitoring, location access, and internet on the watch.',
781:'The map shows the latest location source, age, accuracy, and saved zone; qualifying estimated crossings create alerts.',
786:'1. Enable location on the watch and tap Start monitoring.',
788:'3. Choose the home center and zone radius, then save and enable the zone.',
795:'5. Open Live location tracking and review marker movement.',
797:'2. Receive watch fixes with source, time, and accuracy.',
800:'4. Save the zone and check fresh locations.',
801:'    4.1. If 3 usable outside fixes span 20 seconds, save an estimated-exit alert and queue push.',
802:'    4.2. Else, show checking, waiting, or accuracy status.',
804:'6. Show current watch state and saved watch_location_points in Leaflet.',
805:'    6.1. If available, show source, age, accuracy, route, and zone; fused may use the paired phone.',
806:'    6.2. Else, show that location is unavailable.',
810:'The caregiver or watch wearer confirms SOS to save emergency records and notify the caregiver; the phone offers priority contacts for an explicit dial action.',
816:'Caregiver, Elderly Person',
818:'The caregiver or watch wearer confirms SOS to save emergency records and notify the caregiver; the phone offers priority contacts for an explicit dial action.',
820:'The caregiver confirms phone SOS or the watch wearer selects Send SOS.',
822:'A patient profile or paired watch exists; delivery requires internet and enabled phone notifications.',
824:'Emergency records are saved and an eligible push is queued; the caregiver chooses whether to dial a priority contact.',
829:'1. Press phone SOS or open watch SOS and review the confirmation.',
836:'3. Confirm activation or tap Send SOS on the watch.',
839:'5. Choose a caregiver, family member, or doctor to contact.',
849:'2. Require explicit confirmation before creating SOS records.',
851:'    2.2. Else, cancel without creating records or opening the dialer.',
853:'4. Save the emergency and available vital context; provide send, pending, or error feedback.',
855:'6. Save a critical alert and notification; queue push and display priority contacts on the phone.',
856:'    6.1. If the caregiver selects a saved number, open the supported dial action.',
857:'    6.2. Else, retain emergency records without claiming that a call occurred.',
859:'8. Save the caregiver response or resolution while retaining emergency history.',
862:'Figure 36: Manage Care Notes',
865:'MANAGE CARE NOTES',
867:'Manage Care Notes',
949:'The caregiver manages Galaxy Watch pairing, Health History access, emergency contacts, care notifications, theme, and account sign-out in Settings.',
957:'The caregiver manages Galaxy Watch pairing, Health History access, emergency contacts, care notifications, theme, and account sign-out in Settings.',
970:'3. Manage Galaxy Watch pairing, Health History access, emergency contacts, or care-notification permissions.',
976:'2. Load watch, Health History, notification, contact, and theme status.',
994:'The administrator opens Alerts and notifications or follows an Overview activity link.',
1003:'1. Open Alerts and notifications and review emergency history.',
1112:'5. Select Accounts, System monitor, Alerts and notifications, Reports, or Security.',
}

def replace_span(ts,start,end,value):
 offsets=[];pos=0
 for t in ts:offsets.append((pos,pos+len(t.text or '')));pos+=len(t.text or '')
 if start==end:
  k=next((i for i,(a,b) in enumerate(offsets) if a<=start<=b),len(ts)-1)
  a,b=offsets[k];s=ts[k].text or '';ts[k].text=s[:start-a]+value+s[start-a:];return
 hits=[i for i,(a,b) in enumerate(offsets) if a<end and b>start]
 first,last=hits[0],hits[-1];a,_=offsets[first];_,b=offsets[last]
 prefix=(ts[first].text or '')[:start-a];suffix=(ts[last].text or '')[end-offsets[last][0]:]
 ts[first].text=prefix+value+(suffix if first==last else '')
 for k in hits[1:]:ts[k].text=suffix if k==last else ''

with ZipFile(SRC) as z:
 original=z.read('word/document.xml');root=E.fromstring(original);paras=root.xpath('//w:p',namespaces=NS)
 log=[]
 for i,new in changes.items():
  ts=paras[i].xpath('.//w:t',namespaces=NS);old=''.join(t.text or '' for t in ts)
  assert ts and old,(i,new)
  for op,a,b,c,d in reversed(SequenceMatcher(None,old,new,autojunk=False).get_opcodes()):
   if op!='equal':replace_span(ts,a,b,new[c:d])
  assert ''.join(t.text or '' for t in ts)==new,i
  for t in ts:
   if t.text and (t.text[0].isspace() or t.text[-1].isspace()):t.set('{http://www.w3.org/XML/1998/namespace}space','preserve')
  log.append({'paragraph':i,'old':old,'new':new})
 alltext=' '.join(root.xpath('//w:t/text()',namespaces=NS))
 assert 'Google Health' not in alltext
 # Preserve every structural/style node and all ZIP entries; only text and
 # selected same-size diagram label assets are substituted.
 modified=E.tostring(root,encoding='UTF-8',xml_declaration=True,standalone=True)
 imagepaths={name:Path('tmp/use-case-review/diagrams')/name.split('/')[-1] for name in ['word/media/image7.png','word/media/image19.png','word/media/image23.png','word/media/image25.png','word/media/image26.png']}
 target=OUT/'REVISED_USE_CASE_Current_System.docx'
 with ZipFile(target,'w') as out:
  for info in z.infolist():
   content=modified if info.filename=='word/document.xml' else imagepaths[info.filename].read_bytes() if info.filename in imagepaths and imagepaths[info.filename].exists() else z.read(info.filename)
   out.writestr(info,content)
 # Formatting verification ignores only textual content and XML space attrs.
 def structure(xml):
  r=E.fromstring(xml)
  for t in r.xpath('//w:t',namespaces=NS):t.text='';t.attrib.pop('{http://www.w3.org/XML/1998/namespace}space',None)
  return E.tostring(r)
 assert structure(original)==structure(modified),'Document structure or formatting changed'
 (OUT/'wording_changes.json').write_text(json.dumps(log,ensure_ascii=False,indent=2),encoding='utf-8')
 print(target, len(log),'paragraphs revised; formatting structure verified')
