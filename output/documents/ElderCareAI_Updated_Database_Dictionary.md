# ElderCareAI Core Database Dictionary

Updated 7 November 2026

18 core tables and 245 fields. Latest verified migration: 20261107000000.

## caregivers

Stores caregiver identity, contact information and profile details linked to the authenticated account.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| age | INTEGER | No | Age in years. | Yes | No | No |
| created_at | TIMESTAMPTZ | No | Date and time the database record was created. | No | No | No |
| email | TEXT | No | Caregiver's account email address. | Yes | No | No |
| full_name | TEXT | No | Caregiver's full name shown across the app. | No | No | No |
| id | UUID | Yes | Unique identifier for this caregiver. | No | Yes | Yes |
| phone | TEXT | No | Caregiver's contact telephone number. | Yes | No | No |
| photo_url | TEXT | No | URL of the caregiver's profile photo. | Yes | No | No |
| sex | TEXT | No | Caregiver's recorded sex. | Yes | No | No |
| updated_at | TIMESTAMPTZ | No | Date and time the record was last updated. | No | No | No |


## elderly_profiles

Stores the older adult profile, health background and emergency contacts managed by a caregiver.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| age | INTEGER | No | Older adult's age in years. | Yes | No | No |
| blood_type | TEXT | No | Recorded blood group and Rh type. | Yes | No | No |
| caregiver_id | UUID | No | Caregiver account associated with this record. | No | No | Yes |
| created_at | TIMESTAMPTZ | No | Date and time the database record was created. | No | No | No |
| date_of_birth | DATE | No | Older adult's date of birth. | Yes | No | No |
| elderly_id | UUID | Yes | Patient profile associated with this record. | No | Yes | No |
| emergency_contact | TEXT | No | Name of the emergency contact. | Yes | No | No |
| emergency_contact_phone | TEXT | No | Emergency contact's telephone number. | Yes | No | No |
| full_name | TEXT | No | Older adult's full name shown in care views. | No | No | No |
| gender | TEXT | No | Older adult's recorded gender. | Yes | No | No |
| height_cm | NUMERIC(5,2) | No | Recorded height in centimeters. | Yes | No | No |
| medical_conditions | TEXT | No | Recorded medical conditions or history. | Yes | No | No |
| medications | TEXT | No | Medication information entered in the profile. | Yes | No | No |
| photo_url | TEXT | No | URL of the older adult's profile photo. | Yes | No | No |
| updated_at | TIMESTAMPTZ | No | Date and time the record was last updated. | No | No | No |
| weight_kg | NUMERIC(5,2) | No | Recorded weight in kilograms. | Yes | No | No |


## wearable_devices

Registers the Galaxy Watch paired to a patient and protects its device access credential. Device registration is managed by the backend.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| caregiver_id | UUID | No | Caregiver account associated with this record. | No | No | Yes |
| device_name | TEXT | No | Display name reported for the paired watch. | No | No | No |
| elderly_id | UUID | * | Patient profile associated with this record. | No | No | Yes |
| expires_at | TIMESTAMPTZ | No | Time after which the watch credential is no longer accepted. | No | No | No |
| id | UUID | Yes | Unique identifier assigned to the paired Galaxy Watch. | No | Yes | No |
| last_history_at | TIMESTAMPTZ | No | Time of the latest accepted Health history import for this watch. | Yes | No | No |
| last_seen_at | TIMESTAMPTZ | No | Latest time an authenticated request was received from the watch. | Yes | No | No |
| paired_at | TIMESTAMPTZ | No | Time this watch was paired with the patient account. | No | No | No |
| revoked_at | TIMESTAMPTZ | No | Time the watch registration was revoked, if disconnected. | Yes | No | No |
| token_hash | TEXT | Yes | Unique hash of the watch access credential; not the raw credential. | No | No | No |

The unique index on elderly_id applies only while revoked_at is NULL. Historical revoked registrations can remain for the same patient.
The raw watch access token is not stored in this table. Backend functions validate the stored hash and credential expiry.

## wearable_live_state

Stores the latest watch telemetry for the live dashboard. Each vital and GPS position retains its own measurement time; a row is not evidence that all sensors measured simultaneously.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| accuracy_m | DOUBLE PRECISION | No | Reported horizontal position accuracy in meters. | Yes | No | No |
| battery_percent | INTEGER | No | Watch battery level from 0 to 100 percent. | Yes | No | No |
| device_id | UUID | No | Registered watch associated with this record. | No | No | Yes |
| elderly_id | UUID | Yes | Patient identifier and primary key; one live-state row per patient. | No | Yes | Yes |
| gps_measured_at | TIMESTAMPTZ | No | Original measurement time of the displayed location. | Yes | No | No |
| gps_status | TEXT | No | Human-readable GPS availability or positioning status. | Yes | No | No |
| heart_rate_bpm | DOUBLE PRECISION | No | Heart-rate measurement in beats per minute. | Yes | No | No |
| heart_rate_measured_at | TIMESTAMPTZ | No | Original measurement time of the heart-rate value. | Yes | No | No |
| hrv_measured_at | TIMESTAMPTZ | No | Original measurement time of the HRV result. | Yes | No | No |
| hrv_rmssd_ms | DOUBLE PRECISION | No | Heart-rate variability calculated as RMSSD, in milliseconds. | Yes | No | No |
| latitude | DOUBLE PRECISION | No | Latitude in decimal degrees, from -90 to 90. | Yes | No | No |
| location_source | TEXT | No | Position provider: watch_gps, fused or network. | Yes | No | No |
| longitude | DOUBLE PRECISION | No | Longitude in decimal degrees, from -180 to 180. | Yes | No | No |
| monitoring | BOOLEAN | No | Whether the watch reports that monitoring is running. | No | No | No |
| received_at | TIMESTAMPTZ | No | Time the backend received the watch telemetry. | No | No | No |
| sensor_status | JSONB | No | JSON object containing availability or collection status for each sensor. | No | No | No |
| skin_temp_celsius | DOUBLE PRECISION | No | Wrist skin temperature in degrees Celsius; not core body temperature. | Yes | No | No |
| skin_temp_measured_at | TIMESTAMPTZ | No | Original measurement time of the wrist skin temperature. | Yes | No | No |
| sleep_hours | DOUBLE PRECISION | No | Recorded sleep duration in hours, imported after Health history sync. | Yes | No | No |
| sleep_measured_at | TIMESTAMPTZ | No | Measurement time associated with the imported sleep duration. | Yes | No | No |
| spo2_measured_at | TIMESTAMPTZ | No | Original measurement time of the oxygen reading. | Yes | No | No |
| spo2_percent | DOUBLE PRECISION | No | Blood-oxygen saturation reading as a percentage. | Yes | No | No |
| status_at | TIMESTAMPTZ | No | Original timestamp of the watch monitoring and battery status. | No | No | No |
| steps_count | INTEGER | No | Step total measured during watch monitoring periods. | Yes | No | No |
| steps_measured_at | TIMESTAMPTZ | No | Original measurement time of the step total. | Yes | No | No |
| stress_baseline_rmssd | DOUBLE PRECISION | No | Personal HRV reference used to derive the experimental stress index. | Yes | No | No |
| stress_reference_count | INTEGER | No | Number of reference measurements used for the stress estimate. | No | No | No |
| stress_score | INTEGER | No | Experimental HRV-based stress index from 0 to 100; not medical grade. | Yes | No | No |

This table supports the live display. It does not replace the individual measurement records in vital_sign_logs or the route points in watch_location_points.
Blank values or older per-metric timestamps must not be interpreted as fresh readings from every sensor.

## vital_sign_logs

Keeps timestamped vital measurements and imported sleep or oxygen history. Current Galaxy Watch uploads and Health history imports both use source galaxy_watch; measurement_origin distinguishes their collection paths.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| active_minutes | INTEGER | No | Legacy optional activity-duration field; current watch uploads do not populate it. | Yes | No | No |
| ai_risk_score | NUMERIC(5,2) | No | Optional stored indicative risk score; not a clinical risk assessment. | Yes | No | No |
| elderly_id | UUID | * | Patient profile associated with this record. | No | No | Yes |
| heart_rate_bpm | NUMERIC(6,2) | No | Heart-rate measurement in beats per minute. | Yes | No | No |
| hrv_rmssd_ms | NUMERIC | No | Heart-rate variability calculated as RMSSD, in milliseconds. | Yes | No | No |
| id | UUID | Yes | Unique identifier for a saved vital measurement or imported history record. | No | Yes | No |
| is_superseded | BOOLEAN | No | Whether a newer imported revision replaced this record in current history. | No | No | No |
| measurement_origin | TEXT | No | Collection path: watch_sensor or samsung_health. | Yes | No | No |
| measurement_times | JSONB | No | JSON object mapping metric names to their original measurement timestamps. | No | No | No |
| overall_status | TEXT | No | Stored app status field; not a diagnosis or a clinical classification. | Yes | No | No |
| recorded_at | TIMESTAMPTZ | No | Original measurement time used to order this event in saved history. | No | No | No |
| skin_temp_celsius | NUMERIC(5,2) | No | Wrist skin temperature in degrees Celsius; not core body temperature. | Yes | No | No |
| sleep_history | JSONB | No | JSON array of sleep-session details; empty for records without sleep-session data. | No | No | No |
| sleep_hours | NUMERIC(5,2) | No | Recorded sleep duration in hours, imported after Health history sync. | Yes | No | No |
| source | TEXT | No | Data-source family. Current watch and Health history paths explicitly write galaxy_watch. | Yes | No | No |
| source_device_id | TEXT | * | Provider device identifier selected for the Health history import. | Yes | No | No |
| source_group_key | TEXT | No | Provider group or session key linking related imported measurements. | Yes | No | No |
| source_record_key | TEXT | * | Provider record key used to identify an imported measurement. | Yes | No | No |
| source_revision_at | TIMESTAMPTZ | * | Provider modification time identifying the imported record revision. | Yes | No | No |
| spo2_percent | NUMERIC(5,2) | No | Blood-oxygen saturation reading as a percentage. | Yes | No | No |
| steps_count | INTEGER | No | Step total measured during watch monitoring periods. | Yes | No | No |
| stress_baseline_rmssd | DOUBLE PRECISION | No | Personal HRV reference used to derive the experimental stress index. | Yes | No | No |
| stress_model_version | TEXT | No | Version identifier of the experimental stress-scoring method. | Yes | No | No |
| stress_reference_count | INTEGER | No | Number of reference measurements used for the stress estimate. | Yes | No | No |
| stress_score | INTEGER | No | Experimental HRV-based stress index from 0 to 100; not medical grade. | Yes | No | No |
| synced_at | TIMESTAMPTZ | No | Time this measurement was saved or synchronized to the backend. | Yes | No | No |
| watch_device_id | UUID | * | Registered watch that produced or supplied this measurement. | Yes | No | Yes |
| watch_measured_at | TIMESTAMPTZ | * | Original event timestamp used in watch measurement deduplication. | Yes | No | No |
| watch_metric | TEXT | * | Metric represented by the saved watch or imported measurement event. | Yes | No | No |
| watch_sample_id | UUID | * | Identifier of the delivered watch sensor event, used to deduplicate retries. | Yes | No | No |

A sparse row can contain one measured vital and NULL in other vital columns. NULL means no value was recorded in that row; it is not a zero reading.
For current history, filter source to galaxy_watch and is_superseded to false. Keep replaced import revisions for history review.
The source column retains a legacy database default. Current ingestion explicitly supplies galaxy_watch, and measurement_origin distinguishes direct watch data from Health history imports.
A stress score is derived from HRV and personal references. It is experimental and not a medical-grade stress measurement.

## watch_location_points

Keeps timestamped positions received from the watch for the movement trail and safe-zone evaluation. location_source distinguishes satellite GPS, fused and network positions.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| accuracy_m | DOUBLE PRECISION | No | Reported horizontal position accuracy in meters. | No | No | No |
| device_id | UUID | * | Registered watch associated with this record. | No | No | Yes |
| elderly_id | UUID | No | Patient profile associated with this record. | No | No | Yes |
| id | UUID | Yes | Unique identifier for a received watch position. | No | Yes | No |
| latitude | DOUBLE PRECISION | No | Latitude in decimal degrees, from -90 to 90. | No | No | No |
| location_source | TEXT | No | Position provider: watch_gps, fused or network. | No | No | No |
| longitude | DOUBLE PRECISION | No | Longitude in decimal degrees, from -180 to 180. | No | No | No |
| measured_at | TIMESTAMPTZ | * | Original time the position was measured. | No | No | No |
| received_at | TIMESTAMPTZ | No | Time the backend received the watch telemetry. | No | No | No |

Safe-zone confirmation uses fresh, accurate watch_gps positions and a running monitoring session. Fused or network points may appear on the map but do not confirm a boundary crossing.

## medication_schedules

Stores patient medication plans, scheduled reminder times and the time zone used to calculate doses.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| caregiver_id | UUID | No | Caregiver account associated with this record. | No | No | Yes |
| color_tag | TEXT | No | Display color selected for the medicine. | Yes | No | No |
| created_at | TIMESTAMPTZ | No | Date and time the database record was created. | Yes | No | No |
| dosage | TEXT | No | Dose amount or strength entered by the caregiver. | Yes | No | No |
| elderly_id | UUID | No | Patient profile associated with this record. | No | No | Yes |
| end_date | DATE | No | Date the schedule ends, if set. | Yes | No | No |
| form | TEXT | No | Medication form, such as tablet or liquid. | Yes | No | No |
| frequency | TEXT | No | How often the medicine should be taken. | No | No | No |
| id | UUID | Yes | Unique identifier for this medication schedule. | No | Yes | No |
| instructions | TEXT | No | Administration instructions. | Yes | No | No |
| is_active | BOOLEAN | No | Whether the record is currently active. | Yes | No | No |
| medication_name | TEXT | No | Name of the prescribed or tracked medicine. | No | No | No |
| prescribed_by | TEXT | No | Prescriber name, when provided. | Yes | No | No |
| reminder_enabled | BOOLEAN | No | Whether medication reminders are enabled. | Yes | No | No |
| start_date | DATE | No | Date the schedule begins. | No | No | No |
| times_of_day | TEXT[] | No | Array of daily reminder times, normally in HH:mm format. | Yes | No | No |
| timezone | TEXT | No | IANA time-zone name used to calculate reminder and dose times. | No | No | No |
| updated_at | TIMESTAMPTZ | No | Date and time the record was last updated. | Yes | No | No |


## medication_logs

Records the outcome of an individual scheduled dose, including doses marked taken on the phone or watch.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| created_at | TIMESTAMPTZ | No | Date and time the database record was created. | Yes | No | No |
| dose_key | TEXT | * | Stable per-dose key used to prevent duplicate phone or watch confirmations. | Yes | No | No |
| elderly_id | UUID | No | Patient profile associated with this record. | No | No | Yes |
| id | UUID | Yes | Unique identifier for this medication log. | No | Yes | No |
| notes | TEXT | No | Optional free-text notes. | Yes | No | No |
| recorded_by | UUID | No | Caregiver who entered the dose status. | Yes | No | Yes |
| schedule_id | UUID | * | Medication schedule being recorded. | No | No | Yes |
| scheduled_time | TIMESTAMPTZ | No | Planned dose date and time. | No | No | No |
| status | TEXT | No | Dose state, such as taken or missed. | Yes | No | No |
| taken_at | TIMESTAMPTZ | No | Time the dose was marked taken. | Yes | No | No |
| watch_device_id | UUID | No | Watch that marked the dose taken; blank for a phone-only confirmation. | Yes | No | Yes |

The unique schedule_id and dose_key combination applies only when dose_key is not NULL, preventing repeated confirmations of the same dose.

## appointments

Stores scheduled care appointments and the information used by appointment reminders.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| appointment_at | TIMESTAMPTZ | No | Scheduled appointment date and time. | No | No | No |
| caregiver_id | UUID | No | Caregiver account associated with this record. | No | No | Yes |
| created_at | TIMESTAMPTZ | No | Date and time the database record was created. | Yes | No | No |
| doctor_name | TEXT | No | Doctor named for this appointment. | Yes | No | No |
| duration_min | INTEGER | No | Planned length in minutes. | Yes | No | No |
| elderly_id | UUID | No | Patient profile associated with this record. | No | No | Yes |
| id | UUID | Yes | Unique identifier for this appointment. | No | Yes | No |
| location | TEXT | No | Appointment venue or address. | Yes | No | No |
| notes | TEXT | No | Optional free-text notes. | Yes | No | No |
| reminder_sent | BOOLEAN | No | Whether a reminder was sent. | Yes | No | No |
| status | TEXT | No | Appointment state. | Yes | No | No |
| title | TEXT | No | Short title shown in the app. | No | No | No |
| updated_at | TIMESTAMPTZ | No | Date and time the record was last updated. | Yes | No | No |


## caregiver_notes

Stores patient care notes and pinned information entered by the caregiver.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| caregiver_id | UUID | No | Caregiver account associated with this record. | No | No | Yes |
| content | TEXT | No | Caregiver's note text. | No | No | No |
| created_at | TIMESTAMPTZ | No | Date and time the database record was created. | Yes | No | No |
| elderly_id | UUID | No | Patient profile associated with this record. | No | No | Yes |
| id | UUID | Yes | Unique identifier for this caregiver note. | No | Yes | No |
| is_pinned | BOOLEAN | No | Whether this note is pinned above others. | Yes | No | No |
| title | TEXT | No | Short title shown in the app. | Yes | No | No |
| updated_at | TIMESTAMPTZ | No | Date and time the record was last updated. | Yes | No | No |


## health_alerts

Stores vital warnings, SOS alerts and safe-zone exit alerts. Reading, acknowledgment and resolution are separate states.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| acknowledged_at | TIMESTAMPTZ | No | Server-recorded time the caregiver acknowledged the alert. | Yes | No | No |
| acknowledged_by | UUID | No | Authenticated user who acknowledged the alert. | Yes | No | Yes |
| ai_generated | BOOLEAN | No | Whether the stored alert was flagged as AI generated. Threshold and safe-zone rules are deterministic. | Yes | No | No |
| alert_type | TEXT | No | Kind of vital or care alert. | No | No | No |
| elderly_id | UUID | No | Patient profile associated with this record. | No | No | Yes |
| emergency_event_id | UUID | No | Linked SOS event, retained independently of inbox notifications. | Yes | No | Yes |
| id | UUID | Yes | Unique identifier for this health alert. | No | Yes | No |
| is_read | BOOLEAN | No | Whether the alert was marked read; this does not acknowledge it. | Yes | No | No |
| is_resolved | BOOLEAN | No | Whether the alert has been resolved. | Yes | No | No |
| message | TEXT | No | Explanation presented with the alert. | No | No | No |
| metric_unit | TEXT | No | Unit of the observed value. | Yes | No | No |
| metric_value | NUMERIC | No | Observed value that triggered the alert. | Yes | No | No |
| resolution_note | TEXT | No | Final caregiver action note, limited to 2,000 characters. | Yes | No | No |
| resolved_at | TIMESTAMPTZ | No | Server-recorded resolution time; final for the response workflow. | Yes | No | No |
| resolved_by | UUID | No | Caregiver who resolved the alert. | Yes | No | Yes |
| severity | TEXT | No | Alert urgency level. | No | No | No |
| threshold_value | NUMERIC | No | Comparison threshold used for the alert. | Yes | No | No |
| title | TEXT | No | Short title shown in the app. | No | No | No |
| triggered_at | TIMESTAMPTZ | No | Time the alert was triggered. | Yes | No | No |

The response workflow progresses from New to Acknowledged to Resolved. Marking a notice read does not acknowledge or resolve its alert.
respond_to_care_alert records the responder and server time, requires a 3 to 2,000 character resolution note, and keeps the final response unchanged on retries.

## alert_response_events

Keeps server-recorded acknowledgment and resolution events for an alert, including the responder, response time and final note.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| action | TEXT | * | Response transition: acknowledged or resolved. | No | No | No |
| actor_id | UUID | No | Authenticated user responsible for the response; may become blank if the account is deleted. | Yes | No | Yes |
| alert_id | UUID | * | Health alert to which the response belongs. | No | No | Yes |
| elderly_id | UUID | No | Patient profile associated with this record. | No | No | Yes |
| id | UUID | Yes | Unique identifier for the recorded alert response event. | No | Yes | No |
| note | TEXT | No | Action note saved with resolution, up to 2,000 characters. | Yes | No | No |
| occurred_at | TIMESTAMPTZ | No | Server timestamp of the acknowledgment or resolution. | No | No | No |

The unique alert_id and action pair allows one acknowledgment and one resolution event per alert. Caregivers read the audit history; backend triggers create the events.

## caregiver_notifications

Stores the caregiver notification inbox and related push-delivery status. A notification may reference a saved health alert.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| alert_id | UUID | No | Related health alert, if any. | Yes | No | Yes |
| body | TEXT | No | Full message shown to the caregiver. | No | No | No |
| caregiver_id | UUID | * | Caregiver account associated with this record. | No | No | Yes |
| channel | TEXT | No | Delivery channel, such as in-app. | Yes | No | No |
| data | JSONB | No | JSON payload containing routing, source-record and related care-event identifiers. | Yes | No | No |
| delivery_status | TEXT | No | Stored notification delivery state; not proof that a caregiver saw the message. | Yes | No | No |
| elderly_id | UUID | No | Patient profile associated with this record. | Yes | No | Yes |
| event_key | TEXT | * | Stable event identifier used to prevent duplicate notifications for a caregiver. | Yes | No | No |
| id | UUID | Yes | Unique identifier for this caregiver notification. | No | Yes | No |
| is_read | BOOLEAN | No | Whether the notification has been read. | Yes | No | No |
| notification_type | TEXT | No | Notification category. | No | No | No |
| push_error | TEXT | No | Latest recorded push-provider or delivery-processing error, if any. | Yes | No | No |
| push_status | TEXT | No | Push-registration or delivery-processing status; separate from inbox read state. | No | No | No |
| read_at | TIMESTAMPTZ | No | Time the notification was read. | Yes | No | No |
| sent_at | TIMESTAMPTZ | No | Time the notification was sent. | Yes | No | No |
| title | TEXT | No | Short title shown in the app. | No | No | No |

A unique caregiver_id and event_key combination prevents repeated notices when event_key is present. Push-provider acceptance is separate from human acknowledgment.
Push retries and device delivery tokens are maintained in supporting delivery tables outside this core dictionary.

## emergency_events

Records SOS requests and emergency response details, including any captured vital snapshot.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| description | TEXT | No | Optional details of the event. | Yes | No | No |
| elderly_id | UUID | No | Patient profile associated with this record. | No | No | Yes |
| event_type | TEXT | No | Type of emergency or SOS event. | No | No | No |
| id | UUID | Yes | Unique identifier for this emergency event. | No | Yes | No |
| is_resolved | BOOLEAN | No | Whether the event has been resolved. | Yes | No | No |
| location | TEXT | No | Recorded location text, if available. | Yes | No | No |
| resolution_notes | TEXT | No | Notes about the event resolution. | Yes | No | No |
| responded_at | TIMESTAMPTZ | No | Time a caregiver responded. | Yes | No | No |
| responded_by | UUID | No | Caregiver who responded. | Yes | No | Yes |
| response_time_s | INTEGER | No | Elapsed response time in seconds. | Yes | No | No |
| severity | TEXT | No | Emergency urgency level. | No | No | No |
| triggered_at | TIMESTAMPTZ | No | Time the emergency was triggered. | Yes | No | No |
| vital_snapshot | JSONB | No | Vital values captured with the event. | Yes | No | No |

health_alerts.emergency_event_id links an SOS event to its alert response. Clearing an inbox notification does not remove that relationship.

## ai_chatbot_sessions

Groups Elle conversation messages by caregiver and patient.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| caregiver_id | UUID | No | Caregiver account associated with this record. | No | No | Yes |
| context_type | TEXT | No | Scope of care context for the conversation. | Yes | No | No |
| elderly_id | UUID | No | Patient profile associated with this record. | No | No | Yes |
| ended_at | TIMESTAMPTZ | No | Time the conversation ended. | Yes | No | No |
| id | UUID | Yes | Unique identifier for this Elle chat session. | No | Yes | No |
| is_active | BOOLEAN | No | Whether the conversation is still active. | Yes | No | No |
| session_title | TEXT | No | Title shown in chat history. | Yes | No | No |
| started_at | TIMESTAMPTZ | No | Time the conversation began. | Yes | No | No |
| total_messages | INTEGER | No | Number of stored messages in the session. | Yes | No | No |


## ai_chatbot_messages

Stores chat messages and the source-reading references or aggregate-history evidence returned with an assistant response.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| content | TEXT | No | Message text. | No | No | No |
| created_at | TIMESTAMPTZ | No | Date and time the database record was created. | Yes | No | No |
| evidence | JSONB | No | JSON array of source-reading references returned with the assistant reply; defaults to an empty array. | No | No | No |
| evidence_summary | JSONB | No | JSON object describing a factual history check, its scope and sample counts. | Yes | No | No |
| has_health_data | BOOLEAN | No | Whether the response used care or vital data. | Yes | No | No |
| id | UUID | Yes | Unique identifier for this Elle chat message. | No | Yes | No |
| is_flagged | BOOLEAN | No | Whether the message was flagged for review. | Yes | No | No |
| role | TEXT | No | Speaker role, such as user or assistant. | No | No | No |
| session_id | UUID | No | Conversation to which this message belongs. | No | No | Yes |
| tokens_used | INTEGER | No | Model token count, when recorded. | Yes | No | No |

evidence items include reference, record_id, metric, label, value, unit, measured_at, source and origin. record_id is a JSON reference, not a declared foreign-key column.
evidence_summary records scope, timezone, from, until, generated_at, metric, sample_count, matching_count, threshold and comparison. The examples do not replace the complete aggregate count.

## patient_safe_zones

Stores one configured safe-zone center and radius per patient, including whether boundary alerts are enabled.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| caregiver_id | UUID | No | Caregiver account associated with this record. | No | No | Yes |
| elderly_id | UUID | Yes | Patient identifier and primary key; only one configured zone per patient. | No | Yes | Yes |
| enabled | BOOLEAN | No | Whether boundary checks are enabled; false means alerts are paused. | No | No | No |
| latitude | DOUBLE PRECISION | No | Latitude in decimal degrees, from -90 to 90. | No | No | No |
| longitude | DOUBLE PRECISION | No | Longitude in decimal degrees, from -180 to 180. | No | No | No |
| name | TEXT | No | User-defined place name, from 1 to 80 trimmed characters. | No | No | No |
| radius_m | INTEGER | No | Safe-zone radius in whole meters, from 100 to 5,000. | No | No | No |
| revision | UUID | No | Configuration version changed on saving, used to invalidate obsolete notifications. | No | No | No |
| updated_at | TIMESTAMPTZ | No | Date and time the record was last updated. | No | No | No |

Changes are saved through save_patient_safe_zone after patient ownership is checked. Saving resets confirmation and changes the configuration revision.
An exit or return needs at least three qualifying watch GPS fixes spanning 20 seconds. Accuracy, boundary margins and monitoring status are checked by the backend; a missing fix does not prove the patient is inside.

## safe_zone_events

Keeps confirmed exits and returns with the zone configuration, measured distance and accuracy recorded at that event.

| Column | PostgreSQL type | U | Description | Nullable | PK | FK |
|---|---|---|---|---|---|---|
| accuracy_m | DOUBLE PRECISION | No | Reported horizontal position accuracy in meters. | No | No | No |
| alert_id | UUID | No | Exit warning associated with this event; normally blank for a return. | Yes | No | Yes |
| created_at | TIMESTAMPTZ | No | Date and time the database record was created. | No | No | No |
| direction | TEXT | No | Confirmed boundary transition: outside or inside. | No | No | No |
| distance_m | DOUBLE PRECISION | No | Measured distance in meters from the configured zone center. | No | No | No |
| elderly_id | UUID | No | Patient profile associated with this record. | No | No | Yes |
| id | UUID | Yes | Unique identifier for a confirmed boundary event. | No | Yes | No |
| measured_at | TIMESTAMPTZ | No | Watch timestamp of the fix that completed boundary confirmation. | No | No | No |
| zone_name | TEXT | No | Snapshot of the place name when the boundary event occurred. | No | No | No |
| zone_revision | UUID | No | Snapshot of the zone configuration version used for this event. | No | No | No |

zone_revision and zone_name preserve the historical configuration. They are snapshots, not foreign keys to a previous configuration row.
A confirmed exit creates a health alert and notification. A confirmed return creates a boundary event and notification; it does not automatically resolve the earlier exit warning.
