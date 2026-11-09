# ElderCareAI Integration Testing

40 visible-outcome cases grouped by module. Automated fixtures and source checks are separate from live screenshots.

| Proponent | Test Case ID | Module Name | Integration Process | Connected Module | Precondition | Expected Result | Actual Result | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | INT-001 | Authentication Module | Route a signed-in caregiver with an incomplete profile. | Onboarding | Session exists; caregiver setup is incomplete. | Caregiver setup opens. | Jest PASS | Passed* |
|  | INT-002 | Authentication Module | Route a signed-in caregiver after all setup steps. | Home | Session and onboarding are complete. | Home route opens. | Jest PASS | Passed* |
|  | INT-003 | Authentication Module | Open admin sign-in and recovery. | Admin recovery | Portal is available. | Sign-in and reset-code forms appear. | Source PASS | Passed* |
|  | INT-004 | Health Monitoring and Analytics Module | Display synchronized heart rate and oxygen. | Health Vitals | Patient has a saved vital reading. | Health shows both measurements. | Jest PASS | Passed* |
|  | INT-005 | Health Monitoring and Analytics Module | Interpret recorded sleep duration. | Health Vitals | Latest sleep duration is 5.5 hours. | Health shows the below-guide context label. | Jest PASS | Passed* |
|  | INT-006 | Health Monitoring and Analytics Module | Analyze low blood oxygen. | Health Insights | Latest SpO₂ is 92%. | Attention insight appears. | Jest PASS | Passed* |
|  | INT-007 | Health Monitoring and Analytics Module | Request a trend with limited history. | Health Predictions | Only two distinct readings exist. | Prediction remains pending. | Jest PASS | Passed* |
|  | INT-008 | Health Monitoring and Analytics Module | Project a trend from saved readings. | Health Predictions | Four distinct readings exist. | Heart-rate trend card appears. | Jest PASS | Passed* |
|  | INT-009 | Health Monitoring and Analytics Module | Flag abnormal readings. | Health Anomalies | Latest heart rate is 118 bpm and SpO₂ is 92%. | Both thresholds appear as anomalies. | Jest PASS | Passed* |
|  | INT-010 | Health Monitoring and Analytics Module | Export patient-scoped readings. | PDF Reports | Patient has synchronized vital history. | PDF contains patient and reading data and opens sharing. | Jest PASS | Passed* |
|  | INT-011 | Health Monitoring and Analytics Module | Supabase returns saved readings and a new event. | Analytics chart | Controlled test fixture exists | Actual values, timestamps and live updates appear; foreign rows are omitted. | Jest PASS | Passed* |
|  | INT-012 | Health Monitoring and Analytics Module | Daily step RPC returns a saved total, then a higher update. | Daily history | Controlled test fixture exists | One displayed day changes to the new total without double-counting. | Jest PASS | Passed* |
|  | INT-013 | Health Monitoring and Analytics Module | Open vitals and saved analytics. | Date-filtered chart | A patient has saved readings. | Health cards and analytics date filter appear. | Source PASS | Passed* |
|  | INT-014 | Health Monitoring and Analytics Module | Select a health record from the chart. | Recorded detail | Saved readings exist. | Chart selection and original reading time appear. | Source PASS | Passed* |
|  | INT-015 | Medication and Care Plan Module | Show an as-needed medication in the care plan. | Dose Status | As-needed schedule is saved. | Medication and as-needed status appear. | Jest PASS | Passed* |
|  | INT-016 | Medication and Care Plan Module | Apply a taken log to a saved schedule. | Dose Status | Today's taken log matches the medication. | Care plan shows Taken today. | Jest PASS | Passed* |
|  | INT-017 | Medication and Care Plan Module | Save an as-needed medication. | Medication Schedules | Caregiver enters a medication name. | Schedule saves with no timed notification. | Jest PASS | Passed* |
|  | INT-018 | Medication and Care Plan Module | Record a medication dose. | Medication Logs | Active schedule is visible. | Taken log saves and status refreshes. | Jest PASS | Passed* |
|  | INT-019 | Medication and Care Plan Module | Export patient medication entries. | PDF Reports | Medication schedule exists. | PDF contains the medication and instructions and opens sharing. | Jest PASS | Passed* |
|  | INT-020 | Medication and Care Plan Module | Caregiver edits extracted text, adds a photo and confirms. | Medication save | Controlled test fixture exists | No medication saves before confirmation; corrected fields are saved. | Jest PASS | Passed* |
|  | INT-021 | Medication and Care Plan Module | Load past, future and completed visits into Schedule. | Appointments | Controlled test fixture exists | Upcoming visits sort by date/time and completed activity is separate. | Jest PASS | Passed* |
|  | INT-022 | Medication and Care Plan Module | Add a medication with a reminder time. | Care plan | Patient is selected. | Editor time control and Care plan medication tab are visible. | Source PASS | Passed* |
|  | INT-023 | Medication and Care Plan Module | Choose a medication image and review schedule. | Medication card | Medication editor is open. | Image picker and medication card are visible. | Source PASS | Passed* |
|  | INT-024 | Medication and Care Plan Module | Scan a prescription and review its draft. | Medication editor | Caregiver selects a prescription. | Scan entry and original-prescription review appear. | Source PASS | Passed* |
|  | INT-025 | Appointments and Reminders Module | Save a future visit. | Notifications | Caregiver enters a visit title and doctor. | Patient-named appointment reminder is scheduled. | Jest PASS | Passed* |
|  | INT-026 | Appointments and Reminders Module | Load a scheduled future visit. | Notifications | Visit and notification permission exist. | Appointment reminder includes patient, doctor, and clinic. | Jest PASS | Passed* |
|  | INT-027 | Appointments and Reminders Module | Open appointments and see reminder details. | Appointment alert | A future visit is saved. | Appointment form and notification details are available. | Source PASS | Passed* |
|  | INT-028 | Elle Assistant Module | Handle an assistant service failure. | Chat Persistence | AI endpoint returns an error. | Friendly error appears; no false reply is saved. | Jest PASS | Passed* |
|  | INT-029 | Elle Assistant Module | Follow a medication action in an assistant reply. | Care Navigation | Reply mentions the medication schedule. | Open Meds routes to the medication tab. | Jest PASS | Passed* |
|  | INT-030 | Emergency and Alerts Module | Two local care reminders fire together while app is open. | Foreground queue | Controlled test fixture exists | Medication and appointment each show a separate popup and play audio. | Jest PASS | Passed* |
|  | INT-031 | Emergency and Alerts Module | Open contact priority and choose caregiver. | Dial action | Controlled test fixture exists | Priority list appears and only selected number opens the dialer. | Jest PASS | Passed* |
|  | INT-032 | Emergency and Alerts Module | Expand vital rules and open alert details. | Alert response | A saved alert exists. | Rules and alert response screen are visible. | Source PASS | Passed* |
|  | INT-033 | Location and Safety Module | Open patient safe zone. | Live location | Watch location exists. | Radius controls and live map are visible. | Source PASS | Passed* |
|  | INT-034 | Location and Safety Module | Set a safe zone and view watch movement. | Live map | Watch has a location fix. | Radius control and map follow control appear. | Source PASS | Passed* |
|  | INT-035 | Galaxy Watch6 Module | Open the watch pairing screen from phone setup. | Phone pairing | Watch is not yet paired. | Phone setup and watch code entry are both visible. | Source PASS | Passed* |
|  | INT-036 | Galaxy Watch6 Module | Start monitoring on the paired watch. | Phone vitals | Watch is paired and app is signed in. | Watch monitoring control and phone vital cards are visible. | Source PASS | Passed* |
|  | INT-037 | Galaxy Watch6 Module | Open Medications on watch. | Dose confirmation | A dose is scheduled. | Watch shows Taken control and care plan shows medication status. | Source PASS | Passed* |
|  | INT-038 | Galaxy Watch6 Module | Open watch oxygen and phone oxygen card. | Blood oxygen | Watch monitoring is active. | Spot-check control and phone oxygen card appear. | Source PASS | Passed* |
|  | INT-039 | Administration Module | Open admin system monitor. | Saved health sync | Admin has signed in. | Overview and recent sync sections are visible. | Source PASS | Passed* |
|  | INT-040 | Administration Module | Open account and security management. | Admin security | Admin is signed in. | Account records and security controls appear. | Source PASS | Passed* |

*Passed* means automated verification only; live screenshots remain to be captured.*
