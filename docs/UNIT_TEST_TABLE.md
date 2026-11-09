# ElderCareAI Unit Testing

Automated results use controlled fixtures or UI source checks. Capture the corresponding visible screen separately for presentation.

| Proponent | Module Name | Unit Name | Date Tested | Test Case ID | Test Case Description | Expected Result | Actual Result | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | Authentication Module | Google Sign-In | 11/09/2026 | CASE-001 | Open the login screen. | Google sign-in button is visible. | Jest PASS | Passed* |
|  | Authentication Module | Google Sign-In | 11/09/2026 | CASE-002 | Return a failed mocked sign-in result. | Error appears and the login screen remains open. | Jest PASS | Passed* |
|  | Authentication Module | Session Routing | 11/09/2026 | CASE-003 | Open login with an existing caregiver session. | App redirects to the introduction screen. | Jest PASS | Passed* |
|  | Authentication Module | Sign-in screen | 11/09/2026 | CASE-004 | Open the admin web portal. | Username, password, and recovery controls appear. | Source PASS | Passed* |
|  | Authentication Module | Admin reset | 11/09/2026 | CASE-005 | Open Forgot password. | Reset code form appears. | Source PASS | Passed* |
|  | Authentication Module | Admin invitation | 11/09/2026 | CASE-006 | Open administrator invitation. | Set password form appears. | Source PASS | Passed* |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-007 | Open the app as a new caregiver. | Introduction screen opens first. | Jest PASS | Passed* |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-008 | Leave caregiver information incomplete. | Caregiver setup remains the next step. | Jest PASS | Passed* |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-009 | Leave older-adult information incomplete. | Older-adult setup remains the next step. | Jest PASS | Passed* |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-010 | Leave wearable setup incomplete. | Wearable setup remains the next step. | Jest PASS | Passed* |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-011 | Leave location consent incomplete. | Home access is deferred until location setup. | Jest PASS | Passed* |
|  | Onboarding Module | Setup Routing | 11/09/2026 | CASE-012 | Complete every onboarding step. | Home screen becomes the next route. | Jest PASS | Passed* |
|  | Onboarding Module | Introduction | 11/09/2026 | CASE-013 | Open introduction. | Heart rate and sleep are introduced. | Source PASS | Passed* |
|  | Onboarding Module | Location consent | 11/09/2026 | CASE-014 | Open location setup. | Watch location sharing guidance appears. | Source PASS | Passed* |
|  | Profile and Forms Module | Form Field | 11/09/2026 | CASE-015 | Render a field with validation feedback. | Error appears beside the related input. | Jest PASS | Passed* |
|  | Profile and Forms Module | Form Field | 11/09/2026 | CASE-016 | Render the authenticated email field. | Email value cannot be edited. | Jest PASS | Passed* |
|  | Profile and Forms Module | Caregiver Setup | 11/09/2026 | CASE-017 | Submit missing required caregiver details. | Field errors appear and no profile is saved. | Jest PASS | Passed* |
|  | Profile and Forms Module | Caregiver Setup | 11/09/2026 | CASE-018 | Enter an invalid caregiver phone number. | Profile save is blocked. | Jest PASS | Passed* |
|  | Profile and Forms Module | Caregiver Setup | 11/09/2026 | CASE-019 | Submit valid caregiver details. | Profile saves and older-adult setup opens. | Jest PASS | Passed* |
|  | Profile and Forms Module | Older Adult Setup | 11/09/2026 | CASE-020 | Submit missing required older-adult details. | Required-field guidance appears. | Jest PASS | Passed* |
|  | Profile and Forms Module | Older Adult Setup | 11/09/2026 | CASE-021 | Enter implausible weight and height. | Profile save is blocked. | Jest PASS | Passed* |
|  | Profile and Forms Module | Older Adult Setup | 11/09/2026 | CASE-022 | Select a birth date from the calendar. | The selected date is saved and determines the older adult's age. | Jest PASS | Passed* |
|  | Profile and Forms Module | Older Adult Setup | 11/09/2026 | CASE-023 | Enter an invalid emergency phone number. | Profile save is blocked. | Jest PASS | Passed* |
|  | Profile and Forms Module | Older Adult Setup | 11/09/2026 | CASE-024 | Submit valid older-adult details. | Profile saves and wearable setup opens. | Jest PASS | Passed* |
|  | Health Monitoring Module | Vital Card | 11/09/2026 | CASE-025 | Render a patient vital card. | Patient reading and timestamp are shown. | Jest PASS | Passed* |
|  | Health Monitoring Module | Vital Card | 11/09/2026 | CASE-026 | Tap the patient vital card. | Reading detail action is called. | Jest PASS | Passed* |
|  | Health Monitoring Module | Vital Card | 11/09/2026 | CASE-027 | Render a full-width vital card. | Card uses the readable row layout. | Jest PASS | Passed* |
|  | Health Monitoring Module | BPM display bands | 11/09/2026 | CASE-028 | Compare 49, 50, 79, 80, 110 and 111 BPM. | Labels change at 50 and 80; warning remains strictly above 110. | Jest PASS | Passed* |
|  | Health Monitoring Module | Other status labels | 11/09/2026 | CASE-029 | Check saved oxygen, sleep, activity, HRV stress and skin temperature. | Each metric has a readable label with an appropriate state. | Jest PASS | Passed* |
|  | Health Monitoring Module | Patient isolation | 11/09/2026 | CASE-030 | Switch accounts and restore saved sleep. | Each patient sees only their own recorded sleep. | Jest PASS | Passed* |
|  | Health Monitoring Module | Saved history | 11/09/2026 | CASE-031 | Load saved history, checkups and schedules. | Existing database records appear without fabricated values. | Jest PASS | Passed* |
|  | Health Monitoring Module | Card timestamp | 11/09/2026 | CASE-032 | Open a vital card. | The reading timestamp is displayed. | Source PASS | Passed* |
|  | Health Monitoring Module | Card unit | 11/09/2026 | CASE-033 | Open a vital card. | Measurement unit accompanies value. | Source PASS | Passed* |
|  | Health Monitoring Module | Status badge | 11/09/2026 | CASE-034 | Open a vital card with status. | Status has readable text. | Source PASS | Passed* |
|  | Health Monitoring Module | Vital detail | 11/09/2026 | CASE-035 | Open vital detail. | Detail modal provides reading context. | Source PASS | Passed* |
|  | Health Insights and Analytics Module | Insight Generation | 11/09/2026 | CASE-036 | Calculate insight with no reading history. | Waiting insight is returned. | Jest PASS | Passed* |
|  | Health Insights and Analytics Module | Chart controls | 11/09/2026 | CASE-037 | Switch line and thin bar display and inspect a reading. | Both chart modes and original timestamps are available. | Jest PASS | Passed* |
|  | Health Insights and Analytics Module | Chart modes | 11/09/2026 | CASE-038 | Open monitoring analytics. | Line and bar choices appear. | Source PASS | Passed* |
|  | Health Insights and Analytics Module | Chart date | 11/09/2026 | CASE-039 | Inspect a chart point. | Reading date or time is shown. | Source PASS | Passed* |
|  | Health Insights and Analytics Module | Analytics filter | 11/09/2026 | CASE-040 | Open analytics filters. | Date range controls appear. | Source PASS | Passed* |
|  | Elle Assistant Module | Chat Screen | 11/09/2026 | CASE-041 | Open Elle chat. | Non-medical assistant disclaimer is visible. | Jest PASS | Passed* |
|  | Elle Assistant Module | Chat Reply | 11/09/2026 | CASE-042 | Send one question with a mocked assistant reply. | Question and reply render once. | Jest PASS | Passed* |
|  | Elle Assistant Module | New Chat | 11/09/2026 | CASE-043 | Start a new chat after previous messages. | Old replies clear and welcome text returns. | Jest PASS | Passed* |
|  | Elle Assistant Module | Quick topics | 11/09/2026 | CASE-044 | Open Elle. | Vitals and medication topic chips appear. | Source PASS | Passed* |
|  | Elle Assistant Module | Thinking state | 11/09/2026 | CASE-045 | Send Elle a question. | Thinking state is visible. | Source PASS | Passed* |
|  | Care Plan Module | Medication List | 11/09/2026 | CASE-046 | Open an empty medication list. | Clear empty state appears. | Jest PASS | Passed* |
|  | Care Plan Module | Medication Form | 11/09/2026 | CASE-047 | Save a medication without a name. | Save is rejected with validation feedback. | Jest PASS | Passed* |
|  | Care Plan Module | Medication Form | 11/09/2026 | CASE-048 | Choose a medication reminder time with the picker. | The selected time appears in the form without manual entry. | Jest PASS | Passed* |
|  | Care Plan Module | Caregiver Note | 11/09/2026 | CASE-049 | Save an empty caregiver note. | Empty note is rejected. | Jest PASS | Passed* |
|  | Care Plan Module | Care tabs | 11/09/2026 | CASE-050 | Open Care plan. | Appointments and medication tabs are present. | Source PASS | Passed* |
|  | Care Plan Module | Schedule | 11/09/2026 | CASE-051 | Open the schedule. | Care activities are shown by date. | Source PASS | Passed* |
|  | Care Plan Module | Prescription entry | 11/09/2026 | CASE-052 | Open scan or upload. | Prescription entry control is visible. | Source PASS | Passed* |
|  | Care Plan Module | Notes | 11/09/2026 | CASE-053 | Open caregiver notes. | Notes section is visible. | Source PASS | Passed* |
|  | Medication Management Module | Dose Status | 11/09/2026 | CASE-054 | Check an as-needed medication. | No scheduled dose is shown. | Jest PASS | Passed* |
|  | Medication Management Module | Dose Status | 11/09/2026 | CASE-055 | Check a medication taken today. | Dose is marked taken. | Jest PASS | Passed* |
|  | Medication Management Module | Dose Status | 11/09/2026 | CASE-056 | Check a dose due within 30 minutes. | Status is due now. | Jest PASS | Passed* |
|  | Medication Management Module | Dose Status | 11/09/2026 | CASE-057 | Check a dose due within three hours. | Status is due soon. | Jest PASS | Passed* |
|  | Medication Management Module | Dose Status | 11/09/2026 | CASE-058 | Check a later scheduled dose. | Status is upcoming. | Jest PASS | Passed* |
|  | Medication Management Module | Dose Status | 11/09/2026 | CASE-059 | Check a dose whose time has passed. | Status says due earlier. | Jest PASS | Passed* |
|  | Medication Management Module | Time parsing | 11/09/2026 | CASE-060 | Convert midnight, noon and database seconds into 12-hour time. | AM/PM values are correct and invalid times rejected. | Jest PASS | Passed* |
|  | Medication Management Module | Elle entry | 11/09/2026 | CASE-061 | Open optional prescription scan from Elle card. | Elle illustration and draft-review entry are visible. | Jest PASS | Passed* |
|  | Medication Management Module | Medication image | 11/09/2026 | CASE-062 | Edit medication image. | Image picker is shown. | Source PASS | Passed* |
|  | Medication Management Module | Prescription review | 11/09/2026 | CASE-063 | Review extracted prescription. | Original image and verification notice appear. | Source PASS | Passed* |
|  | Medication Management Module | Dose date | 11/09/2026 | CASE-064 | Edit medication dates. | Start and end date controls appear. | Source PASS | Passed* |
|  | Reminders and Notifications Module | Tap routing | 11/09/2026 | CASE-065 | Tap a notification before session restoration. | Correct patient page opens after sign in. | Jest PASS | Passed* |
|  | Reminders and Notifications Module | Medication reminder | 11/09/2026 | CASE-066 | Open medication editor. | Prescribed reminder times are shown. | Source PASS | Passed* |
|  | Reminders and Notifications Module | Notification controls | 11/09/2026 | CASE-067 | Open alerts notification setup. | Background notification controls appear. | Source PASS | Passed* |
|  | Doctor Contacts Module | Doctor Settings | 11/09/2026 | CASE-068 | Open Settings without a saved doctor. | Empty doctor contact state appears. | Jest PASS | Passed* |
|  | Doctor Contacts Module | Doctor Settings | 11/09/2026 | CASE-069 | Save a doctor without a name. | Save is blocked. | Jest PASS | Passed* |
|  | Doctor Contacts Module | Doctor Settings | 11/09/2026 | CASE-070 | Save a doctor with an invalid phone number. | Save is blocked. | Jest PASS | Passed* |
|  | Doctor Contacts Module | Doctor Settings | 11/09/2026 | CASE-071 | Save a valid doctor contact. | Doctor appears in Settings after save. | Jest PASS | Passed* |
|  | Doctor Contacts Module | Doctor Settings | 11/09/2026 | CASE-072 | Edit a saved doctor contact. | Existing record is updated for the same caregiver and older adult. | Jest PASS | Passed* |
|  | Reports and Exports Module | Health Report Export | 11/09/2026 | CASE-073 | Export health vitals without an older-adult profile. | Export is blocked and profile guidance appears. | Jest PASS | Passed* |
|  | Reports and Exports Module | Health Report Export | 11/09/2026 | CASE-074 | Export health vitals with no synchronized readings. | Empty-history guidance appears and no PDF is created. | Jest PASS | Passed* |
|  | Reports and Exports Module | Health Report Export | 11/09/2026 | CASE-075 | Export a synchronized health reading. | Patient-scoped recent history is sent to the PDF exporter. | Jest PASS | Passed* |
|  | Reports and Exports Module | Medication Report Export | 11/09/2026 | CASE-076 | Export an empty medication schedule. | Add-medication guidance appears and no PDF is created. | Jest PASS | Passed* |
|  | Reports and Exports Module | Medication Report Export | 11/09/2026 | CASE-077 | Export a saved medication schedule. | Caregiver- and patient-scoped schedules are sent to the PDF exporter. | Jest PASS | Passed* |
|  | Emergency and Alerts Module | Contact priority | 11/09/2026 | CASE-078 | Read contacts stored in an arbitrary order. | Caregiver, family member and doctor are always ordered 1 to 3. | Jest PASS | Passed* |
|  | Emergency and Alerts Module | Collapsible rules | 11/09/2026 | CASE-079 | Open and close automatic vital alerts. | Rules begin collapsed and are accessible when expanded. | Jest PASS | Passed* |
|  | Emergency and Alerts Module | Response | 11/09/2026 | CASE-080 | Acknowledge and resolve a saved warning. | Response note and status save once; failed saves can retry. | Jest PASS | Passed* |
|  | Emergency and Alerts Module | Foreground alert | 11/09/2026 | CASE-081 | Receive SOS and vital warnings. | Alert sounds once; duplicates and stale events are ignored. | Jest PASS | Passed* |
|  | Emergency and Alerts Module | Emergency list | 11/09/2026 | CASE-082 | Open emergency contacts. | Contact names and call controls appear. | Source PASS | Passed* |
|  | Emergency and Alerts Module | Alert details | 11/09/2026 | CASE-083 | Open automatic vital alerts. | Rules can be expanded. | Source PASS | Passed* |
|  | Location and Safety Module | Map update | 11/09/2026 | CASE-084 | Receive a fix before the map initializes. | Newest valid watch marker appears after map initialization. | Jest PASS | Passed* |
|  | Location and Safety Module | Movement recovery | 11/09/2026 | CASE-085 | Read saved positions when realtime events stop. | Only the selected patient and watch route updates. | Jest PASS | Passed* |
|  | Location and Safety Module | Safe zone | 11/09/2026 | CASE-086 | Open safe-zone controls. | Safe-zone radius control appears. | Source PASS | Passed* |
|  | Location and Safety Module | Map | 11/09/2026 | CASE-087 | Open live location. | Location map is rendered. | Source PASS | Passed* |
|  | Galaxy Watch6 Module | Monitoring dashboard | 11/09/2026 | CASE-088 | Open the watch dashboard. | Heart rate and Start monitoring are visible. | Source PASS | Passed* |
|  | Galaxy Watch6 Module | SOS confirmation | 11/09/2026 | CASE-089 | Open SOS on the watch. | Send SOS and Cancel are visible before sending. | Source PASS | Passed* |
|  | Galaxy Watch6 Module | Oxygen measurement | 11/09/2026 | CASE-090 | Open the blood oxygen screen. | Spot measurement and auto-check controls are visible. | Source PASS | Passed* |
|  | Galaxy Watch6 Module | Pairing | 11/09/2026 | CASE-091 | Open watch pairing. | Eight-digit code entry appears. | Source PASS | Passed* |
|  | Galaxy Watch6 Module | Readings | 11/09/2026 | CASE-092 | Scroll watch readings. | Stress and skin temperature cards appear. | Source PASS | Passed* |
|  | Galaxy Watch6 Module | Medication dose | 11/09/2026 | CASE-093 | Open watch medications. | Taken and Refresh schedule controls appear. | Source PASS | Passed* |
|  | Administration Module | Overview | 11/09/2026 | CASE-094 | Sign in to the admin portal. | Overview metrics and recent activity sections appear. | Source PASS | Passed* |
|  | Administration Module | System monitor | 11/09/2026 | CASE-095 | Open System monitor. | Connected devices and recent health syncs appear. | Source PASS | Passed* |
|  | Administration Module | Reports | 11/09/2026 | CASE-096 | Open Reports. | Report type and date range controls appear. | Source PASS | Passed* |
|  | Administration Module | Security | 11/09/2026 | CASE-097 | Open Security. | Admin invite and account protection controls appear. | Source PASS | Passed* |
|  | Administration Module | Accounts | 11/09/2026 | CASE-098 | Open admin Accounts. | Caregiver and older-adult lists appear. | Source PASS | Passed* |
|  | Administration Module | Alerts | 11/09/2026 | CASE-099 | Open admin Alerts. | Health alerts and emergency history appear. | Source PASS | Passed* |
|  | Administration Module | Activity | 11/09/2026 | CASE-100 | Open admin Security. | Administrative activity list appears. | Source PASS | Passed* |

*Passed* means automated verification only; live screenshots remain to be captured.*
