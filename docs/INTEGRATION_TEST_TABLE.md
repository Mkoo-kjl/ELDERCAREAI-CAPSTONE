# Integration Testing

Integration testing checks how ElderCareAI modules work together in caregiver workflows. These 25 Jest and React Native Testing Library cases connect authentication to onboarding, health readings to analysis, care entries to reminders, and saved data to reports and Elle. Every case passed in the automated run.

Supabase responses, the AI endpoint, and native notification, printing, and sharing services use controlled test doubles. These results verify the application interfaces and behavior asserted below; they do not establish live service availability, device delivery, security policy enforcement, or performance under load. Proponent is blank for the final report.

| Proponent | Test Case ID | Module 1 | Integration Process | Module 2 | Pre-condition | Expected Result | Result | Remarks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | INT-001 | Authentication | Route a signed-in caregiver with an incomplete profile. | Onboarding | Session exists; caregiver setup is incomplete. | Caregiver setup opens. | Performed as expected | Passed |
|  | INT-002 | Authentication | Route a signed-in caregiver after all setup steps. | Home | Session and onboarding are complete. | Home route opens. | Performed as expected | Passed |
|  | INT-003 | Health Data | Display synchronized heart rate and oxygen. | Health Vitals | Patient has a saved vital reading. | Health shows both measurements. | Performed as expected | Passed |
|  | INT-004 | Health Data | Interpret recorded sleep duration. | Health Vitals | Latest sleep duration is 5.5 hours. | Health shows the below-guide context label. | Performed as expected | Passed |
|  | INT-005 | Health Data | Analyze low blood oxygen. | Health Insights | Latest SpO₂ is 92%. | Attention insight appears. | Performed as expected | Passed |
|  | INT-006 | Health Data | Request a trend with limited history. | Health Predictions | Only two distinct readings exist. | Prediction remains pending. | Performed as expected | Passed |
|  | INT-007 | Health Data | Project a trend from saved readings. | Health Predictions | Four distinct readings exist. | Heart-rate trend card appears. | Performed as expected | Passed |
|  | INT-008 | Health Data | Flag abnormal readings. | Health Anomalies | Latest heart rate is 118 bpm and SpO₂ is 92%. | Both thresholds appear as anomalies. | Performed as expected | Passed |
|  | INT-009 | Health Data | Review normal readings. | Health Anomalies | Latest reading is within app thresholds. | No current anomaly is reported. | Performed as expected | Passed |
|  | INT-010 | Medication Schedules | Show an as-needed medication in the care plan. | Dose Status | As-needed schedule is saved. | Medication and as-needed status appear. | Performed as expected | Passed |
|  | INT-011 | Medication Logs | Apply a taken log to a saved schedule. | Dose Status | Today's taken log matches the medication. | Care plan shows Taken today. | Performed as expected | Passed |
|  | INT-012 | Medication Schedules | Load an active schedule and set its reminder. | Notifications | Active schedule and permission exist. | Patient-specific native reminder is scheduled and stored. | Performed as expected | Passed |
|  | INT-013 | Care Plan | Save an as-needed medication. | Medication Schedules | Caregiver enters a medication name. | Schedule saves with no timed notification. | Performed as expected | Passed |
|  | INT-014 | Care Plan | Record a medication dose. | Medication Logs | Active schedule is visible. | Taken log saves and status refreshes. | Performed as expected | Passed |
|  | INT-015 | Care Plan | Delete an active medication. | Notifications | Schedule has a saved reminder. | Schedule deactivates and reminder is canceled. | Performed as expected | Passed |
|  | INT-016 | Appointments | Save a future visit. | Notifications | Caregiver enters a visit title and doctor. | Patient-named appointment reminder is scheduled. | Performed as expected | Passed |
|  | INT-017 | Health Data | Export patient-scoped readings. | PDF Reports | Patient has synchronized vital history. | PDF contains patient and reading data and opens sharing. | Performed as expected | Passed |
|  | INT-018 | Medication Schedules | Export patient medication entries. | PDF Reports | Medication schedule exists. | PDF contains the medication and instructions and opens sharing. | Performed as expected | Passed |
|  | INT-019 | Elle Chat | Send a question to the assistant. | Chat Persistence | Caregiver and patient profiles exist. | Session opens, AI reply appears, and both messages save. | Performed as expected | Passed |
|  | INT-020 | Elle Chat | Handle an assistant service failure. | Chat Persistence | AI endpoint returns an error. | Friendly error appears; no false reply is saved. | Performed as expected | Passed |
|  | INT-021 | Appointments | Load a scheduled future visit. | Notifications | Visit and notification permission exist. | Appointment reminder includes patient, doctor, and clinic. | Performed as expected | Passed |
|  | INT-022 | Appointments | Delete a scheduled visit. | Notifications | Visit has a saved reminder. | Visit disappears and reminder is canceled. | Performed as expected | Passed |
|  | INT-023 | Care Plan | Save a caregiver handoff note. | Notes List | Caregiver enters title and content. | Note saves for the patient and appears in the list. | Performed as expected | Passed |
|  | INT-024 | Elle Chat | Follow a medication action in an assistant reply. | Care Navigation | Reply mentions the medication schedule. | Open Meds routes to the medication tab. | Performed as expected | Passed |
|  | INT-025 | Care Plan | Save a twice-daily medication. | Notifications | Caregiver selects twice daily. | 08:00 and 20:00 save and both reminders are scheduled. | Performed as expected | Passed |
