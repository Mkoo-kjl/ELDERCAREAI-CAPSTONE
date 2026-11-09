# ElderCareAI Unit testing

100 selected cases, verified 9 November 2026. Each ID matches one numbered `.test.tsx` file.

| Proponent | Module Name | Unit Name | Date Tested | Test Case ID | Test Case Description | Expected Result | Actual Result | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | Authentication Module | Google Sign-In | 11/09/2026 | CASE-001 | Open the login screen. | Google sign-in button is visible. | Performed as expected | Passed |
|  | Authentication Module | Google Sign-In | 11/09/2026 | CASE-002 | Tap Google sign-in and return a successful mocked result. | Sign-in starts and the app redirects to the route resolver. | Performed as expected | Passed |
|  | Authentication Module | Google Sign-In | 11/09/2026 | CASE-003 | Return a failed mocked sign-in result. | Error appears and the login screen remains open. | Performed as expected | Passed |
|  | Authentication Module | Session Routing | 11/09/2026 | CASE-004 | Open login with an existing caregiver session. | App redirects to the introduction screen. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-005 | Open the app as a new caregiver. | Introduction screen opens first. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-006 | Leave caregiver information incomplete. | Caregiver setup remains the next step. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-007 | Leave older-adult information incomplete. | Older-adult setup remains the next step. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-008 | Leave wearable setup incomplete. | Wearable setup remains the next step. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-009 | Leave location consent incomplete. | Home access is deferred until location setup. | Performed as expected | Passed |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-010 | Complete every onboarding step. | Home screen becomes the next route. | Performed as expected | Passed |
|  | Form Components Module | Form Field | 11/09/2026 | CASE-011 | Render a field with validation feedback. | Error appears beside the related input. | Performed as expected | Passed |
|  | Form Components Module | Form Field | 11/09/2026 | CASE-012 | Render the authenticated email field. | Email value cannot be edited. | Performed as expected | Passed |
|  | Form Components Module | Choice Field | 11/09/2026 | CASE-013 | Select an available choice. | Component reports the selected option. | Performed as expected | Passed |
|  | Caregiver Profile Module | Caregiver Setup | 11/09/2026 | CASE-014 | Submit missing required caregiver details. | Field errors appear and no profile is saved. | Performed as expected | Passed |
|  | Caregiver Profile Module | Caregiver Setup | 11/09/2026 | CASE-015 | Enter an invalid caregiver phone number. | Profile save is blocked. | Performed as expected | Passed |
|  | Caregiver Profile Module | Caregiver Setup | 11/09/2026 | CASE-016 | Enter a caregiver age below the allowed minimum. | Form rejects the age and does not save. | Performed as expected | Passed |
|  | Caregiver Profile Module | Caregiver Setup | 11/09/2026 | CASE-017 | Submit valid caregiver details. | Profile saves and older-adult setup opens. | Performed as expected | Passed |
|  | Caregiver Profile Module | Caregiver Setup | 11/09/2026 | CASE-018 | Return a mocked database error during caregiver save. | Error appears and setup does not advance. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup | 11/09/2026 | CASE-019 | Submit missing required older-adult details. | Required-field guidance appears. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup | 11/09/2026 | CASE-020 | Enter implausible weight and height. | Profile save is blocked. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup | 11/09/2026 | CASE-021 | Select a birth date from the calendar. | The selected date is saved and determines the older adult's age. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup | 11/09/2026 | CASE-022 | Enter an invalid emergency phone number. | Profile save is blocked. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup | 11/09/2026 | CASE-023 | Submit valid older-adult details. | Profile saves and wearable setup opens. | Performed as expected | Passed |
|  | Older Adult Profile Module | Older Adult Setup | 11/09/2026 | CASE-024 | Return a mocked database error during older-adult save. | Error appears and setup does not advance. | Performed as expected | Passed |
|  | Vitals Module | Vital Card | 11/09/2026 | CASE-025 | Render a patient vital card. | Patient reading and timestamp are shown. | Performed as expected | Passed |
|  | Vitals Module | Vital Card | 11/09/2026 | CASE-026 | Tap the patient vital card. | Reading detail action is called. | Performed as expected | Passed |
|  | Vitals Module | Vital Card | 11/09/2026 | CASE-027 | Render a full-width vital card. | Card uses the readable row layout. | Performed as expected | Passed |
|  | Health Insights Module | Insight Generation | 11/09/2026 | CASE-028 | Calculate insight with no reading history. | Waiting insight is returned. | Performed as expected | Passed |
|  | Health Insights Module | Insight Generation | 11/09/2026 | CASE-029 | Analyze a low oxygen reading. | Critical oxygen insight is returned. | Performed as expected | Passed |
|  | Health Insights Module | Insight Generation | 11/09/2026 | CASE-030 | Analyze short sleep duration. | Sleep warning insight is returned. | Performed as expected | Passed |
|  | Health Insights Module | Trend Analysis | 11/09/2026 | CASE-031 | Request a trend with fewer than four distinct readings. | Prediction waits for more data. | Performed as expected | Passed |
|  | Health Insights Module | Trend Analysis | 11/09/2026 | CASE-032 | Analyze four distinct readings. | Labeled statistical trend is returned. | Performed as expected | Passed |
|  | Health Insights Module | Anomaly Detection | 11/09/2026 | CASE-033 | Analyze abnormal heart rate and oxygen together. | Both measurements are flagged. | Performed as expected | Passed |
|  | Health Insights Module | Anomaly Detection | 11/09/2026 | CASE-034 | Analyze a normal latest reading. | No anomaly is claimed. | Performed as expected | Passed |
|  | Health Insights Module | HRV Insight | 11/09/2026 | CASE-035 | Calculate an HRV insight. | Raw RMSSD is reported in milliseconds. | Performed as expected | Passed |
|  | Elle Assistant Module | Chat Screen | 11/09/2026 | CASE-036 | Open Elle chat. | Non-medical assistant disclaimer is visible. | Performed as expected | Passed |
|  | Elle Assistant Module | Message Input | 11/09/2026 | CASE-037 | Try to send a blank message. | Assistant request is not called. | Performed as expected | Passed |
|  | Elle Assistant Module | Chat Reply | 11/09/2026 | CASE-038 | Send one question with a mocked assistant reply. | Question and reply render once. | Performed as expected | Passed |
|  | Elle Assistant Module | Chat Error | 11/09/2026 | CASE-039 | Return a mocked service failure. | Friendly message appears without raw Bad Request text. | Performed as expected | Passed |
|  | Elle Assistant Module | New Chat | 11/09/2026 | CASE-040 | Start a new chat after previous messages. | Old replies clear and welcome text returns. | Performed as expected | Passed |
|  | Care Plan Module | Medication List | 11/09/2026 | CASE-041 | Open an empty medication list. | Clear empty state appears. | Performed as expected | Passed |
|  | Care Plan Module | Medication Form | 11/09/2026 | CASE-042 | Save a medication without a name. | Save is rejected with validation feedback. | Performed as expected | Passed |
|  | Care Plan Module | Medication Form | 11/09/2026 | CASE-043 | Choose a medication reminder time with the picker. | The selected time appears in the form without manual entry. | Performed as expected | Passed |
|  | Care Plan Module | Caregiver Note | 11/09/2026 | CASE-044 | Save an empty caregiver note. | Empty note is rejected. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status | 11/09/2026 | CASE-045 | Check an as-needed medication. | No scheduled dose is shown. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status | 11/09/2026 | CASE-046 | Check a medication taken today. | Dose is marked taken. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status | 11/09/2026 | CASE-047 | Check yesterday's or another medication's log. | It is not counted as taken today. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status | 11/09/2026 | CASE-048 | Check a medicine without reminder time. | Status is unscheduled. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status | 11/09/2026 | CASE-049 | Check a dose due within 30 minutes. | Status is due now. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status | 11/09/2026 | CASE-050 | Check a dose due within three hours. | Status is due soon. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status | 11/09/2026 | CASE-051 | Check a later scheduled dose. | Status is upcoming. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Status | 11/09/2026 | CASE-052 | Check a dose whose time has passed. | Status says due earlier. | Performed as expected | Passed |
|  | Medication Tracking Module | Dose Sorting | 11/09/2026 | CASE-053 | Sort missed and upcoming doses. | Missed doses appear first. | Performed as expected | Passed |
|  | Reminders Module | Time Validation | 11/09/2026 | CASE-054 | Enter valid 24-hour reminder times. | Valid times are accepted. | Performed as expected | Passed |
|  | Reminders Module | Time Validation | 11/09/2026 | CASE-055 | Enter malformed or out-of-range times. | Invalid times are rejected. | Performed as expected | Passed |
|  | Reminders Module | Reminder Schedule | 11/09/2026 | CASE-056 | Calculate the second daily reminder from 20:30. | Second reminder time wraps to 08:30. | Performed as expected | Passed |
|  | Reminders Module | Medication Alert | 11/09/2026 | CASE-057 | Schedule an as-needed medication. | No timed alert is created. | Performed as expected | Passed |
|  | Reminders Module | Appointment Alert | 11/09/2026 | CASE-058 | Deny notification permission. | App does not claim an appointment alert was set. | Performed as expected | Passed |
|  | Reminders Module | Appointment Alert | 11/09/2026 | CASE-059 | Permit an appointment alert for a patient. | Alert text names the patient. | Performed as expected | Passed |
|  | Doctor Contact Module | Doctor Settings | 11/09/2026 | CASE-060 | Open Settings without a saved doctor. | Empty doctor contact state appears. | Performed as expected | Passed |
|  | Doctor Contact Module | Doctor Settings | 11/09/2026 | CASE-061 | Save a doctor without a name. | Save is blocked. | Performed as expected | Passed |
|  | Doctor Contact Module | Doctor Settings | 11/09/2026 | CASE-062 | Save a doctor with an invalid phone number. | Save is blocked. | Performed as expected | Passed |
|  | Doctor Contact Module | Doctor Settings | 11/09/2026 | CASE-063 | Save a valid doctor contact. | Doctor appears in Settings after save. | Performed as expected | Passed |
|  | Data Management Module | Health Report Export | 11/09/2026 | CASE-064 | Export health vitals without an older-adult profile. | Export is blocked and profile guidance appears. | Performed as expected | Passed |
|  | Data Management Module | Health Report Export | 11/09/2026 | CASE-065 | Export health vitals with no synchronized readings. | Empty-history guidance appears and no PDF is created. | Performed as expected | Passed |
|  | Data Management Module | Health Report Export | 11/09/2026 | CASE-066 | Export a synchronized health reading. | Patient-scoped recent history is sent to the PDF exporter. | Performed as expected | Passed |
|  | Data Management Module | Health Report Export | 11/09/2026 | CASE-067 | Return a database error while loading health readings. | Error is shown and no PDF is created. | Performed as expected | Passed |
|  | Data Management Module | Medication Report Export | 11/09/2026 | CASE-068 | Export an empty medication schedule. | Add-medication guidance appears and no PDF is created. | Performed as expected | Passed |
|  | Data Management Module | Medication Report Export | 11/09/2026 | CASE-069 | Export a saved medication schedule. | Caregiver- and patient-scoped schedules are sent to the PDF exporter. | Performed as expected | Passed |
|  | Data Management Module | Medication Report Export | 11/09/2026 | CASE-070 | Return a database error while loading medication schedules. | Error is shown and no PDF is created. | Performed as expected | Passed |
|  | Data Management Module | Health Report Export | 11/09/2026 | CASE-071 | Fail PDF generation after loading a health reading. | Caregiver sees the export error. | Performed as expected | Passed |
|  | Doctor Contact Module | Doctor Settings | 11/09/2026 | CASE-072 | Return a database error while saving a doctor contact. | Error appears and the edit form stays open. | Performed as expected | Passed |
|  | Doctor Contact Module | Doctor Settings | 11/09/2026 | CASE-073 | Edit a saved doctor contact. | Existing record is updated for the same caregiver and older adult. | Performed as expected | Passed |
|  | Vitals | BPM display bands | 11/09/2026 | CASE-074 | Compare 49, 50, 79, 80, 110 and 111 BPM. | Labels change at 50 and 80; warning remains strictly above 110. | Performed as expected | Passed |
|  | Vitals | Other status labels | 11/09/2026 | CASE-075 | Check saved oxygen, sleep, activity, HRV stress and skin temperature. | Each metric has a readable label with an appropriate state. | Performed as expected | Passed |
|  | Medication | Time parsing | 11/09/2026 | CASE-076 | Convert midnight, noon and database seconds into 12-hour time. | AM/PM values are correct and invalid times rejected. | Performed as expected | Passed |
|  | Medication | Time zone boundaries | 11/09/2026 | CASE-077 | Convert Manila medication times and reject DST gaps. | Saved wall clocks are not interpreted as UTC. | Performed as expected | Passed |
|  | Care plan | Chronology | 11/09/2026 | CASE-078 | Sort same-day dose times and appointment phases. | Events use actual date and time; completed status is distinct. | Performed as expected | Passed |
|  | Analytics | Chart integrity | 11/09/2026 | CASE-079 | Reduce 200 readings for display. | Original endpoints and extremes remain; no average is invented. | Performed as expected | Passed |
|  | Analytics | Chart controls | 11/09/2026 | CASE-080 | Switch line and thin bar display and inspect a reading. | Both chart modes and original timestamps are available. | Performed as expected | Passed |
|  | Steps | Daily total | 11/09/2026 | CASE-081 | Read cumulative step samples around Manila midnight. | One maximum per calendar day; samples are not summed. | Performed as expected | Passed |
|  | Reminders | Local ownership | 11/09/2026 | CASE-082 | Deliver repeating reminders to account and patient scope. | Different delivery dates have distinct IDs; foreign scope is rejected. | Performed as expected | Passed |
|  | Reminders | Popup queue | 11/09/2026 | CASE-083 | Queue two events with one duplicate. | Each unique event appears once in sequence. | Performed as expected | Passed |
|  | Medication | Prescription draft | 11/09/2026 | CASE-084 | Normalize incomplete extracted prescription fields. | Unknown times, dose and prescriber stay blank. | Performed as expected | Passed |
|  | Emergency | Contact priority | 11/09/2026 | CASE-085 | Read contacts stored in an arbitrary order. | Caregiver, family member and doctor are always ordered 1 to 3. | Performed as expected | Passed |
|  | Alerts | Collapsible rules | 11/09/2026 | CASE-086 | Open and close automatic vital alerts. | Rules begin collapsed and are accessible when expanded. | Performed as expected | Passed |
|  | Prescription | Elle entry | 11/09/2026 | CASE-087 | Open optional prescription scan from Elle card. | Elle illustration and draft-review entry are visible. | Performed as expected | Passed |
|  | Account history | Patient isolation | 11/09/2026 | CASE-088 | Switch accounts and restore saved sleep. | Each patient sees only their own recorded sleep. | Performed as expected | Passed |
|  | Administrator | Security | 11/09/2026 | CASE-089 | Review roles and restricted actions. | Unauthorized changes are refused and audited. | Performed as expected | Passed |
|  | Alerts | Response | 11/09/2026 | CASE-090 | Acknowledge and resolve a saved warning. | Response note and status save once; failed saves can retry. | Performed as expected | Passed |
|  | Medication images | Private storage | 11/09/2026 | CASE-091 | Attempt an upload after the account changes. | Upload stops before private photo data is sent. | Performed as expected | Passed |
|  | Notifications | Tap routing | 11/09/2026 | CASE-092 | Tap a notification before session restoration. | Correct patient page opens after sign in. | Performed as expected | Passed |
|  | Care plan | Save recovery | 11/09/2026 | CASE-093 | Save medication or visit when local scheduling fails. | Committed record remains saved; draft survives failed database write. | Performed as expected | Passed |
|  | Galaxy Watch6 | Vital decoding | 11/09/2026 | CASE-094 | Read multiple sensor metrics with timestamps. | Each valid metric reaches the correct card with its own time. | Performed as expected | Passed |
|  | Health records | Saved history | 11/09/2026 | CASE-095 | Load saved history, checkups and schedules. | Existing database records appear without fabricated values. | Performed as expected | Passed |
|  | Live location | Map update | 11/09/2026 | CASE-096 | Receive a fix before the map initializes. | Newest valid watch marker appears after map initialization. | Performed as expected | Passed |
|  | Medication | Edit retry | 11/09/2026 | CASE-097 | Correct a draft after a failed medication save. | Draft stays editable until save succeeds. | Performed as expected | Passed |
|  | Health history | Samsung sync | 11/09/2026 | CASE-098 | Resume interrupted sleep and oxygen uploads. | Checkpoint resumes the correct patient and source. | Performed as expected | Passed |
|  | GPS tracking | Movement recovery | 11/09/2026 | CASE-099 | Read saved positions when realtime events stop. | Only the selected patient and watch route updates. | Performed as expected | Passed |
|  | SOS and warnings | Foreground alert | 11/09/2026 | CASE-100 | Receive SOS and vital warnings. | Alert sounds once; duplicates and stale events are ignored. | Performed as expected | Passed |

See [testing instructions](../output/documents/2026-11-09-focused-testing/TESTING_INSTRUCTIONS.md) for individual and full-suite commands.
