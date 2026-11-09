# ElderCareAI Integration testing

30 selected cases, verified 9 November 2026. Each ID matches one numbered `.test.tsx` file.

| Proponent | Test Case ID | Module 1 | Integration Process | Module 2 | Precondition | Expected Result | Actual Result | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | INT-001 | Authentication | Route a signed-in caregiver with an incomplete profile. | Onboarding | Session exists; caregiver setup is incomplete. | Caregiver setup opens. | Performed as expected | Passed |
|  | INT-002 | Authentication | Route a signed-in caregiver after all setup steps. | Home | Session and onboarding are complete. | Home route opens. | Performed as expected | Passed |
|  | INT-003 | Health Data | Display synchronized heart rate and oxygen. | Health Vitals | Patient has a saved vital reading. | Health shows both measurements. | Performed as expected | Passed |
|  | INT-004 | Health Data | Interpret recorded sleep duration. | Health Vitals | Latest sleep duration is 5.5 hours. | Health shows the below-guide context label. | Performed as expected | Passed |
|  | INT-005 | Health Data | Analyze low blood oxygen. | Health Insights | Latest SpO₂ is 92%. | Attention insight appears. | Performed as expected | Passed |
|  | INT-006 | Health Data | Request a trend with limited history. | Health Predictions | Only two distinct readings exist. | Prediction remains pending. | Performed as expected | Passed |
|  | INT-007 | Health Data | Project a trend from saved readings. | Health Predictions | Four distinct readings exist. | Heart-rate trend card appears. | Performed as expected | Passed |
|  | INT-008 | Health Data | Flag abnormal readings. | Health Anomalies | Latest heart rate is 118 bpm and SpO₂ is 92%. | Both thresholds appear as anomalies. | Performed as expected | Passed |
|  | INT-009 | Medication Schedules | Show an as-needed medication in the care plan. | Dose Status | As-needed schedule is saved. | Medication and as-needed status appear. | Performed as expected | Passed |
|  | INT-010 | Medication Logs | Apply a taken log to a saved schedule. | Dose Status | Today's taken log matches the medication. | Care plan shows Taken today. | Performed as expected | Passed |
|  | INT-011 | Medication Schedules | Load an active schedule and set its reminder. | Notifications | Active schedule and permission exist. | Patient-specific native reminder is scheduled and stored. | Performed as expected | Passed |
|  | INT-012 | Care Plan | Save an as-needed medication. | Medication Schedules | Caregiver enters a medication name. | Schedule saves with no timed notification. | Performed as expected | Passed |
|  | INT-013 | Care Plan | Record a medication dose. | Medication Logs | Active schedule is visible. | Taken log saves and status refreshes. | Performed as expected | Passed |
|  | INT-014 | Care Plan | Delete an active medication. | Notifications | Schedule has a saved reminder. | Schedule deactivates and reminder is canceled. | Performed as expected | Passed |
|  | INT-015 | Appointments | Save a future visit. | Notifications | Caregiver enters a visit title and doctor. | Patient-named appointment reminder is scheduled. | Performed as expected | Passed |
|  | INT-016 | Health Data | Export patient-scoped readings. | PDF Reports | Patient has synchronized vital history. | PDF contains patient and reading data and opens sharing. | Performed as expected | Passed |
|  | INT-017 | Medication Schedules | Export patient medication entries. | PDF Reports | Medication schedule exists. | PDF contains the medication and instructions and opens sharing. | Performed as expected | Passed |
|  | INT-018 | Elle Chat | Handle an assistant service failure. | Chat Persistence | AI endpoint returns an error. | Friendly error appears; no false reply is saved. | Performed as expected | Passed |
|  | INT-019 | Appointments | Load a scheduled future visit. | Notifications | Visit and notification permission exist. | Appointment reminder includes patient, doctor, and clinic. | Performed as expected | Passed |
|  | INT-020 | Appointments | Delete a scheduled visit. | Notifications | Visit has a saved reminder. | Visit disappears and reminder is canceled. | Performed as expected | Passed |
|  | INT-021 | Elle Chat | Follow a medication action in an assistant reply. | Care Navigation | Reply mentions the medication schedule. | Open Meds routes to the medication tab. | Performed as expected | Passed |
|  | INT-022 | Care Plan | Save a twice-daily medication. | Notifications | Caregiver selects twice daily. | 08:00 and 20:00 save and both reminders are scheduled. | Performed as expected | Passed |
|  | INT-023 | Watch alert | Two local care reminders fire together while app is open. | Foreground queue | Controlled test fixture exists | Medication and appointment each show a separate popup and play audio. | Performed as expected | Passed |
|  | INT-024 | Notification owner | A reminder carries a different account or patient. | Caregiver session | Controlled test fixture exists | No foreign-account or foreign-patient popup appears. | Performed as expected | Passed |
|  | INT-025 | Monitoring records | Supabase returns saved readings and a new event. | Analytics chart | Controlled test fixture exists | Actual values, timestamps and live updates appear; foreign rows are omitted. | Performed as expected | Passed |
|  | INT-026 | Watch steps | Daily step RPC returns a saved total, then a higher update. | Daily history | Controlled test fixture exists | One displayed day changes to the new total without double-counting. | Performed as expected | Passed |
|  | INT-027 | Medication image | Save an image and request its display URL. | Private storage | Controlled test fixture exists | Owner and patient path is used; an expiring signed URL loads it. | Performed as expected | Passed |
|  | INT-028 | Prescription draft | Caregiver edits extracted text, adds a photo and confirms. | Medication save | Controlled test fixture exists | No medication saves before confirmation; corrected fields are saved. | Performed as expected | Passed |
|  | INT-029 | Emergency contacts | Open contact priority and choose caregiver. | Dial action | Controlled test fixture exists | Priority list appears and only selected number opens the dialer. | Performed as expected | Passed |
|  | INT-030 | Care plan | Load past, future and completed visits into Schedule. | Appointments | Controlled test fixture exists | Upcoming visits sort by date/time and completed activity is separate. | Performed as expected | Passed |

See [testing instructions](../output/documents/2026-11-09-focused-testing/TESTING_INSTRUCTIONS.md) for individual and full-suite commands.
