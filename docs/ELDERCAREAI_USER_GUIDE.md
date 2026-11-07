# ElderCareAI Caregiver User Guide

This guide explains how a caregiver uses the ElderCareAI mobile application after installing a configured build. Each numbered figure identifies the screen to capture, followed by the actions and results the reader should understand. Insert your screenshots at the marked locations after capturing them from the current app build.

Health readings depend on a connected Google Health account and available synchronized wearable data. Empty values do not mean that a measurement was taken and found normal. The app's analysis and Elle assistant support care decisions but do not diagnose conditions or replace professional advice. Use demonstration data or conceal identifying information in any figure shared outside the care team.

## 1 Sign In

*Insert screenshot here: the ElderCareAI login screen with the Sign in with Google button visible.*

**Figure 1. Caregiver sign in**

- Open ElderCareAI and tap **Sign in with Google**. Use the Google account authorized for the caregiver's Google Health connection.
- Complete the provider's authorization flow. A returning caregiver with completed setup opens Home; an incomplete setup resumes at its next step.

## 2 Introduction to Care Setup

*Insert screenshot here: the first Care setup introduction slide.*

**Figure 2. Care setup introduction**

- Read the three introductory slides about the wearable, synchronized readings, and the care workflow. Tap **Continue** to move through them or **Skip** to go directly to caregiver information.

## 3 Caregiver Information

*Insert screenshot here: the caregiver information form, with personal details concealed.*

**Figure 3. Caregiver information**

- Enter the requested caregiver contact and personal details. Tap **Next** to save them and continue to the older adult profile.
- Later changes are available from **Settings > Caregiver information**.

## 4 Older Adult Information

*Insert screenshot here: the older adult profile form, with health and contact details concealed.*

**Figure 4. Older adult information**

- Complete the older adult's basic, physical, medical, and emergency contact fields. Tap **Save profile** to continue.
- The saved emergency contact number is used by the SOS calling flow. Review it for accuracy before relying on that action.

## 5 Connect Google Health

*Insert screenshot here: the wearable setup screen showing Connect with Google Health and Skip for now.*

**Figure 5. Google Health connection**

- Tap **Connect with Google Health** and approve the requested access if you want wearable readings to appear in the app. The paired wearable must upload new data to Google Health before ElderCareAI can display it.
- Tap **Skip for now** when no compatible connection is available. You can return through **Settings > Google Health API v4**.

## 6 Phone Location Consent

*Insert screenshot here: the location setup screen showing both location choices.*

**Figure 6. Phone location choice**

- Tap **Allow phone location** to let the app save the caregiver phone's position when a supported synchronization occurs, or **Continue without location** to proceed without this feature.
- Location is requested for foreground use; the Last sync location is not live watch tracking.

## 7 Home Dashboard

*Insert screenshot here: the Home tab with the older adult card, Health vitals, and Care plan visible.*

**Figure 7. Home dashboard**

- Home gathers the older adult profile, recent health values, a care-plan preview, and the day's attention summary. Scroll to see the other sections.
- Tap the refresh icon in **Health vitals** to request a Google Health check. When no data exists, the cards show empty values and connection guidance.

## 8 Health Vitals

*Insert screenshot here: Health > Vitals with one synchronized reading and its measurement time.*

**Figure 8. Health vitals**

- Open **Health** and choose **Vitals** to review heart rate, blood oxygen, sleep, steps, overnight skin temperature, and HRV when each measurement is available.
- Check the measurement time and tap a metric card for its detail view. A recent sync check does not make an older wearable sample current.

## 9 AI Insights

*Insert screenshot here: Health > AI Insights with a sample insight card.*

**Figure 9. Health insights**

- Select **AI Insights** to compare the most recent measurements with the available personal history. Read the context and any caution shown on the card.
- Treat these summaries as decision support, not a diagnosis.

## 10 Predictions

*Insert screenshot here: Health > Predictions with a trend card or its pending state.*

**Figure 10. Health predictions**

- Select **Predictions** to view a trend projection when enough distinct readings have been synchronized. With insufficient history, the screen shows a pending state.
- The displayed confidence concerns the available sample and fit; it is not a clinical forecast.

## 11 Anomalies

*Insert screenshot here: Health > Anomalies showing either a review item or the normal empty state.*

**Figure 11. Health anomalies**

- Select **Anomalies** to review measurements that meet a review threshold or deviate from the available personal baseline.
- Confirm a concerning wearable result and seek appropriate professional help when symptoms or other concerns are present.

## 12 Last Sync Location

*Insert screenshot here: Home > Last sync location; hide coordinates and the map marker if using real data.*

**Figure 12. Last sync location**

- From Home, open **Last sync location** to see the latest phone position saved with a successful wearable synchronization.
- If the screen says **No sync location yet**, grant foreground location consent and synchronize while the app is open. The marker is the phone's past position, not the watch's current position.

## 13 Medication List

*Insert screenshot here: Care > Medications with a saved sample medication and its status.*

**Figure 13. Medication schedule**

- Open **Care > Medications** to review active schedules, dose status, and reminder times. Tap **Taken** to record a dose or **Edit** to change a schedule.
- Deleting a schedule deactivates it and cancels its scheduled device reminder after confirmation.

## 14 Add Medication

*Insert screenshot here: Care > Medications > plus button, with the Add Medication form open.*

**Figure 14. Add medication form**

- Enter the medication name, dosage, frequency, and optional instructions. Choose a reminder time for a scheduled medication and tap **Save**.
- **Twice daily** schedules a second reminder 12 hours after the chosen time. **As needed** creates no scheduled reminder. The app warns if notification permission prevents reminder scheduling.

## 15 Appointments

*Insert screenshot here: Care > Appointments with the Add Appointment form open.*

**Figure 15. Appointment form**

- In **Care > Appointments**, tap the plus button to enter a title, future date and time, and optional doctor, location, and notes. Tap **Save**.
- The appointment appears in the care plan. A device reminder is scheduled when notifications are permitted; editing or deleting the visit updates or cancels its reminder.

## 16 Caregiver Notes

*Insert screenshot here: Care > Notes with a saved sample note.*

**Figure 16. Caregiver notes**

- Open **Care > Notes** and tap the plus button to record a handoff note. Add content, optionally add a title, then tap **Save**.
- Use the pin icon to keep a note prominent. Edit or delete a note from its card when it is no longer current.

## 17 Alerts and SOS

*Insert screenshot here: Alerts > Alerts with the SOS button visible; do not activate SOS just to capture the figure.*

**Figure 17. Health alerts and SOS**

- Open **Alerts > Alerts** to read health alerts, mark them read, or resolve them. The SOS button opens a confirmation before creating an emergency event.
- **Activate SOS** logs an event and opens a call to the saved emergency contact. It is not a substitute for calling local emergency services directly.

## 18 Notifications

*Insert screenshot here: Alerts > Notifications with one demonstration notification visible.*

**Figure 18. Caregiver notifications**

- Select **Notifications** to view saved messages. Tap a message to mark it read, clear one message, or use **Clear all** after reviewing them.
- Clearing saved notifications does not remove health alerts or emergency history.

## 19 Elle Care Assistant

*Insert screenshot here: the Elle tab with a demonstration question and reply; conceal personal details.*

**Figure 19. Elle care assistant**

- Open **Elle**, choose a suggested topic or type a question, and send it. The reply may include links to relevant care screens.
- Tap **New Chat** to start another conversation. Check important care details against the saved record and professional guidance.

## 20 Settings and Doctor Contact

*Insert screenshot here: Settings showing Manage Profiles, Doctor Contact, and Google Health API v4.*

**Figure 20. Settings and doctor contact**

- Use **Settings** to edit the caregiver and older adult profiles, add or edit the doctor's phone number, manage the Google Health connection, and choose Dark Mode.
- The Home doctor card offers a call action when a doctor number has been saved.

## 21 Health Records

*Insert screenshot here: Settings > Manage health records, showing medical history and checkup history.*

**Figure 21. Health records**

- Open **Manage health records** to maintain caregiver-entered medical history and completed checkups. Tap **Add** in Checkup history to save a visit.
- These entries are caregiver records and should be checked against clinical documents when accuracy matters.

## 22 Reports and Permissions

*Insert screenshot here: the lower part of Settings showing Data Management and App Permissions.*

**Figure 22. Reports and permissions**

- In **Data Management**, tap **Health vitals PDF** or **Medication schedule PDF** to generate and share a report. A report requires the relevant saved readings or medication schedule.
- In **App Permissions**, manage **Care notifications** and **Phone location**. Review these settings if a reminder is not appearing or a location was not recorded. Tap **Log out** when the session should end.
