"""Hierarchical storyboard logic for each ElderCareAI screen."""

LOGIC = {
1: """
1. The app checks for an existing caregiver session when the sign-in screen opens.
1.1. If a valid session exists, the app resolves the next onboarding step or opens Home.
1.2. If no session exists, the Google sign-in control remains available.
2. The caregiver taps Google sign-in and completes the account flow.
2.1. If the flow is cancelled or fails, the app shows a readable error and stays on sign-in.
2.2. If authentication succeeds, the app restores the caregiver account context.
3. The app checks the caregiver, older-adult, watch, and location setup progress.
3.1. If a required profile step is incomplete, the app opens that setup screen.
3.2. If setup is complete, the app opens Home for the selected older adult.
4. On a later launch, the app checks the saved session again before displaying patient data.
""",
2: """
1. The app opens the caregiver form for the signed-in account.
1.1. If a profile already exists, its editable details are loaded into the form.
1.2. The authenticated email is displayed but cannot be changed here.
2. The caregiver may select a photo and enters full name, phone, age, and sex or gender.
3. The caregiver taps Next or Save changes.
3.1. The app checks that required values are present and that phone and age values are valid.
3.1.1. If a value is invalid, its field shows feedback and the entered data remains available.
3.1.2. If fields are valid, the app submits the profile for the current account.
3.2. If saving fails, the app reports the error without advancing.
4. If saving succeeds, onboarding advances to older-adult setup; edit mode returns with the revised profile.
""",
3: """
1. The app opens the older-adult form for the current caregiver.
1.1. In edit mode, it loads the existing patient's saved details.
2. The caregiver enters full name and either a date of birth or the alternate age.
2.1. Selecting a birth date displays the calculated age and replaces the manual age entry.
3. The caregiver selects gender and blood type and enters weight and height in the shown units.
3.1. Medical conditions and current medications may be added when known.
4. The caregiver enters the emergency contact name and phone number, then taps Save profile.
4.1. The app checks required fields, age or birth date, physical values, and contact information.
4.1.1. If validation fails, the affected fields show feedback and the form remains open.
4.1.2. If validation passes, the app saves the profile under the current caregiver.
4.2. If the database save fails, the app retains the form for correction or retry.
5. After a successful save, the app advances to Galaxy Watch6 setup.
""",
4: """
1. The app opens watch setup for the selected older adult.
1.1. If a watch is already associated, the connection state is shown.
2. The caregiver chooses Connect or change watch to obtain a pairing code.
2.1. The phone shows the code and the patient account it will connect to.
3. On the watch, the wearer opens ElderCareAI, enters the eight digits, and taps Pair watch.
3.1. If the code is invalid, expired, or cannot reach the service, pairing fails visibly.
3.2. If the code is accepted, the watch is associated with that patient and the phone shows Connected.
4. The caregiver may choose Set up later.
4.1. The app can continue, but watch-dependent vitals and location remain unavailable until pairing.
5. A later watch change must be paired to the intended patient profile again.
""",
5: """
1. The paired watch opens its dashboard and displays the latest available readings.
1.1. A card without a valid reading shows its empty or waiting state.
2. The wearer taps Start monitoring.
2.1. The watch requests required sensor and location permissions.
2.1.1. If a permission is denied or a sensor is unavailable, the watch displays a status message.
2.1.2. If access is granted, the foreground monitoring service requests measurements and location.
3. As accepted measurements arrive, the corresponding cards update with value, unit, and age.
3.1. The watch queues accepted readings for upload when internet access is available.
3.2. If upload fails, queued data is retried after connectivity returns.
4. If location has no fresh fix, the wearer may tap Retry location and check the status text.
5. The wearer may open Medications, the SOS confirmation, or a blood-oxygen spot check.
6. Tapping Stop monitoring ends the active session; saved readings finish uploading when possible.
""",
6: """
1. The wearer starts monitoring and opens the Blood oxygen screen.
1.1. If monitoring is inactive, the screen asks the wearer to start it first.
2. The wearer keeps the watch snug, rests the arm, and taps Measure blood oxygen.
2.1. The screen shows progress while the sensor attempts a spot measurement.
2.1.1. If the sensor disconnects, times out, or returns no usable value, an error appears and retry remains possible.
2.1.2. If a usable value arrives, the screen shows the SpO2 result and queues it for upload.
3. The wearer may enable Auto checks every 5 min.
3.1. The next attempt occurs only while this screen remains active and the watch stays awake.
3.2. Leaving the screen or stopping monitoring cancels the repeat checks.
4. Back to dashboard returns to the regular monitoring view.
""",
7: """
1. Home loads the signed-in caregiver and selected older-adult profile.
1.1. If the patient context is missing, the app directs the caregiver to the relevant setup step.
2. The app requests the patient's latest saved vitals and care tasks.
2.1. Each available reading displays its value, unit, status text, and measurement time.
2.2. Missing or stale data is labeled without substituting a zero or another patient's reading.
3. The caregiver may tap Sync now to request a fresh update.
3.1. If refresh succeeds, changed cards and timestamps appear.
3.2. If refresh fails, the last received readings remain visible with an error note.
4. Tapping a vital card opens its detail; tapping a care preview opens the related Care plan tab.
5. The doctor call action appears only when a doctor contact has been saved.
""",
8: """
1. The caregiver opens Health and selects Vitals.
2. The app loads the latest recorded values for the selected patient.
2.1. It maps heart rate, blood oxygen, sleep, steps, skin temperature, and stress to separate cards.
2.2. If a metric has no reading, that card displays a missing-data state.
3. For a recorded metric, the app shows the value, unit, measurement time, and readable status label.
3.1. The label appears with color so meaning does not depend on color alone.
4. When a newer accepted reading arrives, the relevant card and its status update.
5. Tapping a card opens its detail for that metric.
6. Analytics, AI Insights, Predictions, and Anomalies tabs open their corresponding views.
""",
9: """
1. The caregiver taps a metric card from Home or Health.
1.1. The detail view receives that metric and the selected patient context.
2. The app displays the latest available value, unit, status, and recorded time.
2.1. If a live value is absent, it must not claim that an old saved value was just measured.
3. The app loads available saved history for that metric.
3.1. If history exists, its real readings and times are shown.
3.2. If history is empty, the view explains that no record is available.
4. Source or freshness context is shown when available.
5. The caregiver closes the detail view to return to the prior screen.
""",
10: """
1. The caregiver selects a metric and chooses From and To dates.
1.1. The app keeps date selection in the user's local calendar context.
2. The caregiver taps Refresh to load saved readings for that patient and range.
2.1. If loading fails, an error is shown and no fabricated chart is drawn.
2.2. If no readings match, the view explains that the range is empty.
3. If readings exist, the app plots actual values and displays their original timestamps.
3.1. Minimum, maximum, mean, and change are calculated from the displayed records.
3.2. For daily steps, one saved total per day is used rather than summing cumulative samples.
4. The caregiver switches between Line and Bar without changing the source records.
5. Tapping a plotted point shows its value and recorded date and time.
6. The caregiver may reverse the record list order or show more records when available.
""",
11: """
1. The caregiver opens AI Insights, Predictions, or Anomalies under Health.
2. The app reads available patient measurements and their recorded times.
2.1. If a metric has no usable reading, the view shows a waiting or missing-data state.
2.2. If a prediction lacks enough distinct readings, the prediction remains pending.
3. With sufficient records, the app displays a trend, status, or anomaly derived from those records.
3.1. A concerning measurement is presented as an app review finding, not a medical diagnosis.
3.2. Experimental estimates are identified as such.
4. General wellness guidance may suggest confirming a concerning reading or contacting a professional.
5. The caregiver can return to Vitals or Analytics to inspect the underlying recorded values.
""",
12: """
1. The caregiver opens Health records or the Health History area for the selected patient.
1.1. Saved checkups and history are loaded from that patient's records.
2. The caregiver may tap Sync health history to request available sleep records.
2.1. The phone must have the required Samsung Health connection and patient watch association.
2.2. If authorization or upload fails, the app shows status feedback without deleting saved history.
3. If a new sleep session is available, it is imported under the selected patient with its date and time.
3.1. A repeated sync does not need to create a second display entry for the same saved session.
3.2. If no new session exists, the app distinguishes that result from having no saved records at all.
4. The caregiver can inspect existing checkups and edit permitted records through the available form.
""",
13: """
1. The caregiver opens Live location tracking for the selected patient and paired watch.
2. The app checks for an accepted watch position.
2.1. If none exists, it shows waiting or stale status instead of using the caregiver phone as the patient marker.
2.2. If one exists, it shows the marker with reported source, age, and accuracy when available.
3. The caregiver places the safe-zone center on the intended home location and chooses a radius.
3.1. The zone is stored for the selected patient, not for another account.
4. As accepted watch positions arrive, the marker and recent route update.
4.1. If the caregiver pans away, Follow location returns the map to the latest marker.
4.2. If the watch loses internet or location, the map retains context but indicates the age of the last fix.
5. A safe-zone crossing should be interpreted with GPS accuracy in mind before the caregiver acts.
""",
14: """
1. The caregiver opens Care plan and selects Medications for the current patient.
2. The app loads active medication schedules and each patient's recorded dose status.
2.1. Each card shows its own image or a placeholder, name, dosage, frequency, and instructions when present.
2.2. Scheduled medicines show reminder times in a readable 12-hour format.
3. The caregiver taps Add or Edit to enter or correct a medication.
3.1. If required details or times are invalid, the editor explains the issue without discarding the draft.
3.2. If saving succeeds, the card updates and applicable reminders are prepared.
4. The caregiver taps Taken after a dose is actually taken.
4.1. The app saves that confirmation and refreshes the displayed dose status.
5. If Delete is selected, the app asks for confirmation before deactivating the schedule.
5.1. Applicable reminders are cancelled after the schedule is removed.
6. If no medications exist, the app shows its empty-state prompt.
""",
15: """
1. The caregiver opens the optional prescription import from Care plan.
2. The caregiver takes a clear photo or selects an existing prescription image.
2.1. Without a selected image, extraction remains unavailable.
3. The app extracts readable information into an editable draft.
3.1. If text is unclear or a field is missing, that value stays blank or is marked for review.
3.2. Extraction never activates a schedule by itself.
4. The caregiver opens the original image and compares every draft field with it.
4.1. Name, dosage, frequency, times, dates, instructions, and prescriber can be corrected.
4.2. If the original is unclear, the caregiver can use manual entry or consult the prescriber.
5. The caregiver checks the confirmation only after reviewing the original prescription.
5.1. Without confirmation, Confirm and save medication remains blocked.
5.2. With confirmation and valid fields, the app saves the medication and applicable schedule.
6. The saved medication appears in Care plan with its reminders when scheduled.
""",
16: """
1. The caregiver opens Care plan and selects Appointments.
2. The caregiver taps Add and enters a title, appointment date, and appointment time.
2.1. Doctor name, location, and notes can be added when known.
3. The caregiver taps Save.
3.1. If a required value or date is invalid, the form remains open with feedback.
3.2. If the database save fails, the entered draft remains available for retry.
3.3. If saving succeeds, the new appointment appears in the list.
4. When notification permission and delivery are available, an appointment reminder is prepared for the saved time.
5. A visit may be edited, marked Complete, or deleted through its visible actions.
5.1. Changes to the visit update its displayed date and time and applicable reminder.
6. The Schedule tab orders upcoming doses and visits by actual date and time and distinguishes completed activity.
""",
17: """
1. The caregiver opens Alerts to review health warnings, notifications, and emergency history.
2. A wearer who needs help opens SOS on the watch.
2.1. Opening the watch screen does not send an SOS; the wearer must tap Send SOS.
2.2. If the watch has no pairing or internet, it reports the problem and the wearer should contact help directly.
3. On the phone, tapping SOS also requires explicit confirmation.
3.1. After a successful request, the event appears in the selected patient's emergency history.
3.2. If the request fails, the app shows an error instead of claiming delivery.
4. With configured push, allowed notifications, and internet, the caregiver phone may receive a background alert.
5. The contact list shows caregiver first, family second, and doctor third when numbers are saved.
5.1. The caregiver chooses a contact; the app opens a supported dial action rather than placing a call silently.
6. The caregiver opens Review and respond to record an action or resolve the saved event.
""",
18: """
1. The caregiver opens Elle for the selected patient context.
2. The caregiver types a question or taps a quick topic.
2.1. Empty input is ignored and no assistant request is sent.
3. While the request is pending, Elle shows a thinking state.
3.1. If the service fails, a readable error appears and no false answer is presented.
3.2. If a reply succeeds, the question and answer appear in the conversation.
4. When a response uses saved patient data, available evidence appears with the reply.
4.1. Missing health data is not replaced with invented measurements.
5. If the reply offers a related action, tapping it opens the relevant care screen.
6. Tapping New Chat clears the current view and starts a fresh conversation session.
""",
19: """
1. Profile opens with the current caregiver account and selected older adult.
2. The app shows account identity and available Galaxy Watch6 connection status.
2.1. Contact cards show saved doctor and emergency information when present.
3. The caregiver may edit a contact or patient detail through the corresponding form.
3.1. Invalid fields or a failed save keep the form available for correction.
4. The caregiver may tap Sync health history for available recorded sleep data.
4.1. A sync error displays a status message while existing saved records remain available.
5. The caregiver selects Health vitals PDF or Medication schedule PDF.
5.1. If the selected patient or required records are missing, the app shows guidance.
5.2. If records exist, a patient-scoped PDF is generated and the share sheet opens.
6. Sign out ends the active account session before another caregiver signs in.
""",
20: """
1. The administrator opens the web portal and enters username or email and password.
2. The administrator submits Sign in.
2.1. If credentials are invalid or the account lacks administrator access, the portal shows an error and stays at sign-in.
2.2. If authorization succeeds, the portal opens Overview.
3. Forgot password opens the supported recovery form when needed.
3.1. The administrator follows the code verification and password-reset steps shown there.
4. Overview requests caregiver, older-adult, connected-device, and suspended-account counts.
4.1. If an API request fails, a visible status is shown rather than an invented count.
5. Recent alerts and emergencies appear when saved data is available.
6. The sidebar opens Accounts, System monitor, Alerts and notifications, Reports, or Security.
7. Sign out ends the administrator session.
""",
21: """
1. The administrator opens Accounts and loads the current page of caregiver records.
1.1. If no records exist, the table shows its empty state.
2. Selecting a caregiver loads the older adults linked to that caregiver.
2.1. The administrator can open permitted edit forms for caregiver or patient information.
2.2. If a field is invalid or saving fails, the form shows feedback without claiming an update.
3. The administrator opens System monitor to review connected-device state and recent saved health syncs.
3.1. Saved at is the database write time; Measured at is the reading time.
3.2. The device table reflects reported onboarding connection state, not live sensor telemetry.
4. Refresh requests updated administration data.
4.1. If the API fails, show a visible error while retaining the current page context.
5. Reports, Alerts, and Security provide their own administrative actions through the sidebar.
""",
}

assert len(LOGIC)==21
