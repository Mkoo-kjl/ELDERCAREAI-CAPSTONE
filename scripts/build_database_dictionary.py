"""Create the core-table dictionary from a verified metadata snapshot and DOCX reference.

Run using the bundled document Python runtime. This script performs no database writes.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
from zipfile import ZipFile

from lxml import etree

W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS={'w':W}
def tag(name):return f'{{{W}}}{name}'

CORE_TABLES=[
    'caregivers','elderly_profiles','wearable_devices','wearable_live_state',
    'vital_sign_logs','watch_location_points','medication_schedules','medication_logs',
    'appointments','caregiver_notes','health_alerts','alert_response_events',
    'caregiver_notifications','emergency_events','ai_chatbot_sessions','ai_chatbot_messages',
    'patient_safe_zones','safe_zone_events',
]

PURPOSE={
    'caregivers':'Stores caregiver identity, contact information and profile details linked to the authenticated account.',
    'elderly_profiles':'Stores the older adult profile, health background and emergency contacts managed by a caregiver.',
    'wearable_devices':'Registers the Galaxy Watch paired to a patient and protects its device access credential. Device registration is managed by the backend.',
    'wearable_live_state':'Stores the latest watch telemetry for the live dashboard. Each vital and GPS position retains its own measurement time; a row is not evidence that all sensors measured simultaneously.',
    'vital_sign_logs':'Keeps timestamped vital measurements and imported sleep or oxygen history. Current Galaxy Watch uploads and Health history imports both use source galaxy_watch; measurement_origin distinguishes their collection paths.',
    'watch_location_points':'Keeps timestamped positions received from the watch for the movement trail and safe-zone evaluation. location_source distinguishes satellite GPS, fused and network positions.',
    'medication_schedules':'Stores patient medication plans, scheduled reminder times and the time zone used to calculate doses.',
    'medication_logs':'Records the outcome of an individual scheduled dose, including doses marked taken on the phone or watch.',
    'appointments':'Stores scheduled care appointments and the information used by appointment reminders.',
    'caregiver_notes':'Stores patient care notes and pinned information entered by the caregiver.',
    'health_alerts':'Stores vital warnings, SOS alerts and safe-zone exit alerts. Reading, acknowledgment and resolution are separate states.',
    'alert_response_events':'Keeps server-recorded acknowledgment and resolution events for an alert, including the responder, response time and final note.',
    'caregiver_notifications':'Stores the caregiver notification inbox and related push-delivery status. A notification may reference a saved health alert.',
    'emergency_events':'Records SOS requests and emergency response details, including any captured vital snapshot.',
    'ai_chatbot_sessions':'Groups Elle conversation messages by caregiver and patient.',
    'ai_chatbot_messages':'Stores chat messages and the source-reading references or aggregate-history evidence returned with an assistant response.',
    'patient_safe_zones':'Stores one configured safe-zone center and radius per patient, including whether boundary alerts are enabled.',
    'safe_zone_events':'Keeps confirmed exits and returns with the zone configuration, measured distance and accuracy recorded at that event.',
}

COMMON={
    'created_at':'Date and time the database record was created.',
    'updated_at':'Date and time the record was last updated.',
    'caregiver_id':'Caregiver account associated with this record.',
    'elderly_id':'Patient profile associated with this record.',
    'device_id':'Registered watch associated with this record.',
    'watch_device_id':'Registered watch that produced or supplied this measurement.',
    'heart_rate_bpm':'Heart-rate measurement in beats per minute.',
    'heart_rate_measured_at':'Original measurement time of the heart-rate value.',
    'spo2_percent':'Blood-oxygen saturation reading as a percentage.',
    'spo2_measured_at':'Original measurement time of the oxygen reading.',
    'skin_temp_celsius':'Wrist skin temperature in degrees Celsius; not core body temperature.',
    'skin_temp_measured_at':'Original measurement time of the wrist skin temperature.',
    'hrv_rmssd_ms':'Heart-rate variability calculated as RMSSD, in milliseconds.',
    'hrv_measured_at':'Original measurement time of the HRV result.',
    'stress_score':'Experimental HRV-based stress index from 0 to 100; not medical grade.',
    'stress_baseline_rmssd':'Personal HRV reference used to derive the experimental stress index.',
    'stress_reference_count':'Number of reference measurements used for the stress estimate.',
    'steps_count':'Step total measured during watch monitoring periods.',
    'steps_measured_at':'Original measurement time of the step total.',
    'sleep_hours':'Recorded sleep duration in hours, imported after Health history sync.',
    'sleep_measured_at':'Measurement time associated with the imported sleep duration.',
    'latitude':'Latitude in decimal degrees, from -90 to 90.',
    'longitude':'Longitude in decimal degrees, from -180 to 180.',
    'accuracy_m':'Reported horizontal position accuracy in meters.',
    'location_source':'Position provider: watch_gps, fused or network.',
    'measured_at':'Original time the position was measured.',
    'received_at':'Time the backend received the watch telemetry.',
    'monitoring':'Whether the watch reports that monitoring is running.',
    'status_at':'Original timestamp of the watch monitoring and battery status.',
    'sensor_status':'JSON object containing availability or collection status for each sensor.',
}

DETAILS={
    'wearable_devices':{
        'id':'Unique identifier assigned to the paired Galaxy Watch.',
        'device_name':'Display name reported for the paired watch.',
        'token_hash':'Unique hash of the watch access credential; not the raw credential.',
        'expires_at':'Time after which the watch credential is no longer accepted.',
        'revoked_at':'Time the watch registration was revoked, if disconnected.',
        'paired_at':'Time this watch was paired with the patient account.',
        'last_seen_at':'Latest time an authenticated request was received from the watch.',
        'last_history_at':'Time of the latest accepted Health history import for this watch.',
    },
    'wearable_live_state':{
        'elderly_id':'Patient identifier and primary key; one live-state row per patient.',
        'gps_measured_at':'Original measurement time of the displayed location.',
        'battery_percent':'Watch battery level from 0 to 100 percent.',
        'gps_status':'Human-readable GPS availability or positioning status.',
    },
    'vital_sign_logs':{
        'id':'Unique identifier for a saved vital measurement or imported history record.',
        'active_minutes':'Legacy optional activity-duration field; current watch uploads do not populate it.',
        'overall_status':'Stored app status field; not a diagnosis or a clinical classification.',
        'ai_risk_score':'Optional stored indicative risk score; not a clinical risk assessment.',
        'source':'Data-source family. Current watch and Health history paths explicitly write galaxy_watch.',
        'recorded_at':'Original measurement time used to order this event in saved history.',
        'synced_at':'Time this measurement was saved or synchronized to the backend.',
        'measurement_times':'JSON object mapping metric names to their original measurement timestamps.',
        'sleep_history':'JSON array of sleep-session details; empty for records without sleep-session data.',
        'watch_sample_id':'Identifier of the delivered watch sensor event, used to deduplicate retries.',
        'watch_metric':'Metric represented by the saved watch or imported measurement event.',
        'watch_measured_at':'Original event timestamp used in watch measurement deduplication.',
        'stress_model_version':'Version identifier of the experimental stress-scoring method.',
        'is_superseded':'Whether a newer imported revision replaced this record in current history.',
        'measurement_origin':'Collection path: watch_sensor or samsung_health.',
        'source_device_id':'Provider device identifier selected for the Health history import.',
        'source_record_key':'Provider record key used to identify an imported measurement.',
        'source_group_key':'Provider group or session key linking related imported measurements.',
        'source_revision_at':'Provider modification time identifying the imported record revision.',
    },
    'watch_location_points':{
        'id':'Unique identifier for a received watch position.',
    },
    'medication_schedules':{
        'timezone':'IANA time-zone name used to calculate reminder and dose times.',
        'times_of_day':'Array of daily reminder times, normally in HH:mm format.',
    },
    'medication_logs':{
        'dose_key':'Stable per-dose key used to prevent duplicate phone or watch confirmations.',
        'watch_device_id':'Watch that marked the dose taken; blank for a phone-only confirmation.',
    },
    'health_alerts':{
        'is_read':'Whether the alert was marked read; this does not acknowledge it.',
        'acknowledged_at':'Server-recorded time the caregiver acknowledged the alert.',
        'acknowledged_by':'Authenticated user who acknowledged the alert.',
        'resolved_at':'Server-recorded resolution time; final for the response workflow.',
        'resolved_by':'Caregiver who resolved the alert.',
        'emergency_event_id':'Linked SOS event, retained independently of inbox notifications.',
        'resolution_note':'Final caregiver action note, limited to 2,000 characters.',
        'ai_generated':'Whether the stored alert was flagged as AI generated. Threshold and safe-zone rules are deterministic.',
    },
    'alert_response_events':{
        'id':'Unique identifier for the recorded alert response event.',
        'alert_id':'Health alert to which the response belongs.',
        'actor_id':'Authenticated user responsible for the response; may become blank if the account is deleted.',
        'action':'Response transition: acknowledged or resolved.',
        'note':'Action note saved with resolution, up to 2,000 characters.',
        'occurred_at':'Server timestamp of the acknowledgment or resolution.',
    },
    'caregiver_notifications':{
        'data':'JSON payload containing routing, source-record and related care-event identifiers.',
        'event_key':'Stable event identifier used to prevent duplicate notifications for a caregiver.',
        'push_status':'Push-registration or delivery-processing status; separate from inbox read state.',
        'push_error':'Latest recorded push-provider or delivery-processing error, if any.',
        'delivery_status':'Stored notification delivery state; not proof that a caregiver saw the message.',
    },
    'ai_chatbot_messages':{
        'evidence':'JSON array of source-reading references returned with the assistant reply; defaults to an empty array.',
        'evidence_summary':'JSON object describing a factual history check, its scope and sample counts.',
    },
    'patient_safe_zones':{
        'elderly_id':'Patient identifier and primary key; only one configured zone per patient.',
        'name':'User-defined place name, from 1 to 80 trimmed characters.',
        'radius_m':'Safe-zone radius in whole meters, from 100 to 5,000.',
        'enabled':'Whether boundary checks are enabled; false means alerts are paused.',
        'revision':'Configuration version changed on saving, used to invalidate obsolete notifications.',
    },
    'safe_zone_events':{
        'id':'Unique identifier for a confirmed boundary event.',
        'zone_revision':'Snapshot of the zone configuration version used for this event.',
        'zone_name':'Snapshot of the place name when the boundary event occurred.',
        'direction':'Confirmed boundary transition: outside or inside.',
        'distance_m':'Measured distance in meters from the configured zone center.',
        'measured_at':'Watch timestamp of the fix that completed boundary confirmation.',
        'alert_id':'Exit warning associated with this event; normally blank for a return.',
    },
}

NOTES={
    'wearable_devices':[
        'The unique index on elderly_id applies only while revoked_at is NULL. Historical revoked registrations can remain for the same patient.',
        'The raw watch access token is not stored in this table. Backend functions validate the stored hash and credential expiry.',
    ],
    'wearable_live_state':[
        'This table supports the live display. It does not replace the individual measurement records in vital_sign_logs or the route points in watch_location_points.',
        'Blank values or older per-metric timestamps must not be interpreted as fresh readings from every sensor.',
    ],
    'vital_sign_logs':[
        'A sparse row can contain one measured vital and NULL in other vital columns. NULL means no value was recorded in that row; it is not a zero reading.',
        'For current history, filter source to galaxy_watch and is_superseded to false. Keep replaced import revisions for history review.',
        'The source column retains a legacy database default. Current ingestion explicitly supplies galaxy_watch, and measurement_origin distinguishes direct watch data from Health history imports.',
        'A stress score is derived from HRV and personal references. It is experimental and not a medical-grade stress measurement.',
    ],
    'watch_location_points':[
        'Safe-zone confirmation uses fresh, accurate watch_gps positions and a running monitoring session. Fused or network points may appear on the map but do not confirm a boundary crossing.',
    ],
    'medication_logs':[
        'The unique schedule_id and dose_key combination applies only when dose_key is not NULL, preventing repeated confirmations of the same dose.',
    ],
    'health_alerts':[
        'The response workflow progresses from New to Acknowledged to Resolved. Marking a notice read does not acknowledge or resolve its alert.',
        'respond_to_care_alert records the responder and server time, requires a 3 to 2,000 character resolution note, and keeps the final response unchanged on retries.',
    ],
    'alert_response_events':[
        'The unique alert_id and action pair allows one acknowledgment and one resolution event per alert. Caregivers read the audit history; backend triggers create the events.',
    ],
    'caregiver_notifications':[
        'A unique caregiver_id and event_key combination prevents repeated notices when event_key is present. Push-provider acceptance is separate from human acknowledgment.',
        'Push retries and device delivery tokens are maintained in supporting delivery tables outside this core dictionary.',
    ],
    'emergency_events':[
        'health_alerts.emergency_event_id links an SOS event to its alert response. Clearing an inbox notification does not remove that relationship.',
    ],
    'ai_chatbot_messages':[
        'evidence items include reference, record_id, metric, label, value, unit, measured_at, source and origin. record_id is a JSON reference, not a declared foreign-key column.',
        'evidence_summary records scope, timezone, from, until, generated_at, metric, sample_count, matching_count, threshold and comparison. The examples do not replace the complete aggregate count.',
    ],
    'patient_safe_zones':[
        'Changes are saved through save_patient_safe_zone after patient ownership is checked. Saving resets confirmation and changes the configuration revision.',
        'An exit or return needs at least three qualifying watch GPS fixes spanning 20 seconds. Accuracy, boundary margins and monitoring status are checked by the backend; a missing fix does not prove the patient is inside.',
    ],
    'safe_zone_events':[
        'zone_revision and zone_name preserve the historical configuration. They are snapshots, not foreign keys to a previous configuration row.',
        'A confirmed exit creates a health alert and notification. A confirmed return creates a boundary event and notification; it does not automatically resolve the earlier exit warning.',
    ],
}

def words(value):return value.replace('_',' ')
def yes(value):return 'Yes' if value else 'No'
def display_type(value):
    return {'timestamp with time zone':'TIMESTAMPTZ','timestamp without time zone':'TIMESTAMP'}.get(value,value.upper())

def descriptions_for(schema,old):
    result={}
    for table in schema:
        name=table['name'];mapping={}
        for col in table['columns']:
            key=col['name']
            value=DETAILS.get(name,{}).get(key) or COMMON.get(key) or old.get(name,{}).get(key)
            if not value:raise ValueError(f'Missing field description: {name}.{key}')
            mapping[key]=value
        result[name]=mapping
    return result

def unique_specs(table):
    result=[]
    for index in table['indexes']:
        definition=index['definition']
        if 'UNIQUE INDEX' not in definition or index['name'].endswith('_pkey'):continue
        match=re.search(r'USING btree \((.*?)\)(?: WHERE (.*))?$',definition)
        if not match:raise ValueError(f'Unrecognized unique index: {definition}')
        result.append((match[1].split(', '),match[2]))
    return result

def flags(table,column):
    name=column['name']
    primary=any(c['kind']=='p' and name in c['columns'] for c in table['constraints'])
    foreign=any(c['kind']=='f' and name in c['columns'] for c in table['constraints'])
    unique='Yes' if primary else 'No'
    for cols,predicate in unique_specs(table):
        if name in cols:
            if len(cols)==1 and predicate is None:unique='Yes'
            elif unique!='Yes':unique='*'
    return unique,yes(column['nullable']),yes(primary),yes(foreign)

def plain_text(element,text,bold=None,size=None,italic=None):
    para=element if element.tag==tag('p') else element.find(tag('p'))
    if para is None:para=etree.SubElement(element,tag('p'))
    original=para.find(tag('r'))
    props=deepcopy(original.find(tag('rPr'))) if original is not None and original.find(tag('rPr')) is not None else etree.Element(tag('rPr'))
    for child in list(para):
        if child.tag!=tag('pPr'):para.remove(child)
    run=etree.SubElement(para,tag('r'));run.append(props)
    if bold is not None:
        item=props.find(tag('b'))
        if item is not None:props.remove(item)
        etree.SubElement(props,tag('b')).set(tag('val'),'1' if bold else '0')
    if italic is not None:
        item=props.find(tag('i'))
        if item is not None:props.remove(item)
        etree.SubElement(props,tag('i')).set(tag('val'),'1' if italic else '0')
    if size:
        for k in ['sz','szCs']:
            item=props.find(tag(k))
            if item is None:item=etree.SubElement(props,tag(k))
            item.set(tag('val'),str(size))
    color=props.find(tag('color'))
    if color is not None:props.remove(color)
    etree.SubElement(props,tag('color')).set(tag('val'),'000000')
    fonts=props.find(tag('rFonts'))
    if fonts is not None:props.remove(fonts)
    fonts=etree.SubElement(props,tag('rFonts'));fonts.set(tag('ascii'),'Times New Roman');fonts.set(tag('hAnsi'),'Times New Roman')
    text_node=etree.SubElement(run,tag('t'));text_node.set('{http://www.w3.org/XML/1998/namespace}space','preserve');text_node.text=text
    return para

def paragraph(template,text,center=False,bold=False,size=18,before=0,after=70,keep=False,style=None,italic=False):
    p=deepcopy(template);plain_text(p,text,bold,size,italic)
    props=p.find(tag('pPr'))
    if props is None:props=etree.Element(tag('pPr'));p.insert(0,props)
    for name in ['jc','spacing','keepNext','keepLines','pageBreakBefore','pBdr','pStyle']:
        for old in props.findall(tag(name)):props.remove(old)
    etree.SubElement(props,tag('jc')).set(tag('val'),'center' if center else 'left')
    spacing=etree.SubElement(props,tag('spacing'));spacing.set(tag('before'),str(before));spacing.set(tag('after'),str(after));spacing.set(tag('line'),'240');spacing.set(tag('lineRule'),'auto')
    if keep:etree.SubElement(props,tag('keepNext'))
    etree.SubElement(props,tag('keepLines'))
    if style:etree.SubElement(props,tag('pStyle')).set(tag('val'),style)
    return p

def build(args):
    source=Path(args.reference);source_bytes=source.read_bytes()
    snapshot=json.loads(Path(args.schema).read_text(encoding='utf-8'))
    old=json.loads(Path(args.descriptions).read_text(encoding='utf-8'))
    available={t['name']:t for t in snapshot['relations']}
    tables=[available[name] for name in CORE_TABLES]
    descriptions=descriptions_for(tables,old)
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(source) as archive:
        root=etree.fromstring(archive.read('word/document.xml'))
        body=root.find('w:body',NS);section=deepcopy(body.find(tag('sectPr')))
        template_p=body.find(tag('p'));template_table=deepcopy(body.find(tag('tbl')))
        for node in list(body):body.remove(node)
        intro=[
            ('ElderCareAI Core Database Dictionary',28,True,'Title'),
            ('Updated 7 November 2026',18,False,None),
            (f'This dictionary describes the 18 main tables supporting ElderCareAI patient care, Galaxy Watch monitoring, GPS tracking, care plans, alerts, Elle and safe zones. It documents {sum(len(t["columns"]) for t in tables)} fields from the deployed Supabase PostgreSQL schema.',18,False,None),
            ('The core tables are shown below. Supabase Auth and supporting onboarding, provider-link, delivery-queue, internal state and legacy tables are outside this document. Excluding a table here does not remove it from the database.',18,False,None),
            ('PK means primary key; FK means a declared foreign key. U means uniqueness: Yes is individually unique, No has no listed uniqueness rule, and * is part of a composite or conditional unique index described below its table. Nullable Yes means the database permits NULL; it does not mean a measured value of zero.',18,False,None),
            ('TIMESTAMPTZ stores a timestamp with a time-zone-aware instant. NUMERIC precision and scale are shown exactly. Field names remain database identifiers. All listed core tables have row-level security enabled; backend-managed writes and ownership rules still apply.',18,False,None),
            ('Schema reference migration 20261107000000',16,False,None),
        ]
        for text,size,bold,style in intro:body.append(paragraph(template_p,text,center=bool(style) or text.startswith('Updated '),bold=bold,size=size,after=120,style=style))
        for number,table in enumerate(tables,23):
            name=table['name']
            body.append(paragraph(template_p,f'Table {number}',True,True,before=180,after=25,keep=True))
            body.append(paragraph(template_p,'DATA DICTIONARY OF '+words(name).upper(),True,True,after=80,keep=True))
            body.append(paragraph(template_p,f'public.{name}. '+PURPOSE[name],size=18,after=90,keep=True))
            grid=deepcopy(template_table)
            rows=grid.findall(tag('tr'));header=rows[0];row_template=deepcopy(rows[1])
            for row in rows[1:]:grid.remove(row)
            hp=header.find(tag('trPr'))
            if hp is None:hp=etree.Element(tag('trPr'));header.insert(0,hp)
            if hp.find(tag('tblHeader')) is None:etree.SubElement(hp,tag('tblHeader'))
            for idx,label in enumerate(['Column Name','Data Type','U','Description','Nullable','PK','FK']):plain_text(header.findall(tag('tc'))[idx],label,True,16)
            for col in sorted(table['columns'],key=lambda c:c['name']):
                row=deepcopy(row_template)
                props=row.find(tag('trPr'))
                if props is None:props=etree.Element(tag('trPr'));row.insert(0,props)
                for name_to_remove in ['trHeight','tblHeader']:
                    for item in props.findall(tag(name_to_remove)):props.remove(item)
                if props.find(tag('cantSplit')) is None:etree.SubElement(props,tag('cantSplit'))
                u,null,pk,fk=flags(table,col)
                values=[col['name'],display_type(col['type']),u,descriptions[name][col['name']],null,pk,fk]
                for index,(cell,value) in enumerate(zip(row.findall(tag('tc')),values)):
                    p=plain_text(cell,value,False,16)
                    pp=p.find(tag('pPr'))
                    if pp is None:pp=etree.Element(tag('pPr'));p.insert(0,pp)
                    for old_prop in pp.findall(tag('keepNext')):pp.remove(old_prop)
                    for old_prop in pp.findall(tag('jc')):pp.remove(old_prop)
                    etree.SubElement(pp,tag('jc')).set(tag('val'),'left' if index in (0,3) else 'center')
                grid.append(row)
            body.append(grid)
            foreigns=[c for c in table['constraints'] if c['kind']=='f']
            if foreigns:
                text='Foreign keys: '+'; '.join(', '.join(c['columns'])+' references '+c['ref_schema']+'.'+c['ref_table']+'('+', '.join(c['ref_columns'])+')' for c in foreigns)+'.'
                body.append(paragraph(template_p,text,size=16,before=50,after=50))
            for cols,predicate in unique_specs(table):
                if len(cols)==1 and predicate is None:text='Unique field: '+cols[0]+'.'
                else:text='Unique combination: '+', '.join(cols)+('.' if not predicate else ' only when '+predicate+'.')
                body.append(paragraph(template_p,text,size=16,after=50))
            for note in NOTES.get(name,[]):body.append(paragraph(template_p,note,size=16,after=50))
            if not table['client_select']:access='Access: backend managed; direct authenticated table access is not granted.'
            elif not table['client_insert'] and not table['client_update'] and not table['client_delete']:access='Access: caregiver reads are subject to patient ownership policies; writes use backend functions or triggers.'
            else:access='Access: row-level security policies govern caregiver operations.'
            body.append(paragraph(template_p,access,size=16,italic=True,after=85))
        body.append(section)
        xml=etree.tostring(root,xml_declaration=True,encoding='UTF-8',standalone=True)
        settings=etree.fromstring(archive.read('word/settings.xml'))
        update=settings.find(tag('updateFields'))
        if update is None:update=etree.SubElement(settings,tag('updateFields'))
        update.set(tag('val'),'true')
        patches={'word/document.xml':xml,'word/settings.xml':etree.tostring(settings,xml_declaration=True,encoding='UTF-8',standalone=True)}
        with ZipFile(output,'w') as result:
            for info in archive.infolist():result.writestr(info,patches.get(info.filename,archive.read(info.filename)))
    assert source.read_bytes()==source_bytes,'Reference changed during authoring'
    markdown=['# ElderCareAI Core Database Dictionary','', 'Updated 7 November 2026','',f'18 core tables and {sum(len(t["columns"]) for t in tables)} fields. Latest verified migration: {snapshot["latest_migration"]}.','']
    for table in tables:
        name=table['name'];markdown.extend(['## '+name,'',PURPOSE[name],'','| Column | PostgreSQL type | U | Description | Nullable | PK | FK |','|---|---|---|---|---|---|---|'])
        for col in sorted(table['columns'],key=lambda c:c['name']):
            u,null,pk,fk=flags(table,col)
            markdown.append('| '+' | '.join([col['name'],display_type(col['type']),u,descriptions[name][col['name']],null,pk,fk])+' |')
        markdown.extend(['']+NOTES.get(name,[])+[''])
    output.with_suffix('.md').write_text('\n'.join(markdown),encoding='utf-8')
    manifest={'reference_sha256':hashlib.sha256(source_bytes).hexdigest(),'latest_migration':snapshot['latest_migration'],'tables':CORE_TABLES,'columns':sum(len(t['columns']) for t in tables),'output':str(output.resolve())}
    Path(args.manifest).write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps(manifest,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--schema',required=True);parser.add_argument('--descriptions',required=True)
    parser.add_argument('--reference',required=True);parser.add_argument('--output',required=True);parser.add_argument('--manifest',required=True)
    build(parser.parse_args())
