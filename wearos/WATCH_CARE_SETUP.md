# Watch care features, v1.4

The phone and watch both need the updated APKs. Existing pairing and sensor history are retained by an update installation. Keep monitoring running for schedule changes to sync, normally about every 15 seconds while connected. SOS and Taken actions also initiate their own upload.

## Stress estimate

The HRV card displays an experimental 0–100 index with **not medical grade** on the card and details. It is not a validated stress measurement, a diagnosis, or Samsung's stress score. Raw RMSSD in milliseconds is retained. The reference is the median of completed five-minute average HRV periods from the last seven days for this watch. At least 12 periods are required, usually an hour or longer. Until then it displays baseline learning. The formula is `clamp(round(50 + 50 * log2(reference / current RMSSD)), 0, 100)`; the scale and thresholds are illustrative. Activity, illness, sleep, medication and measurement conditions can affect HRV. No HRV estimate should be used alone to infer emotional state or decide treatment.

## Blood oxygen

Open **Measure blood oxygen**. The manual button is retained. Optionally enable **Auto checks · every 5 min**. It measures once immediately and waits five minutes after each completed attempt before another. This mode keeps the display on and operates only while the oxygen screen stays open. Leaving it stops auto checks. Each spot attempt can take up to 30 seconds and temporarily pauses heart rate, HRV and skin temperature. It does not implement unattended overnight or background SpO2. Samsung restricts the on-demand tracker to foreground measurement: https://developer.samsung.com/health/sensor/guide/data-specifications.html

## Medication reminders and Taken

1. Create medication schedules in **Care → Medications** in the phone app.
2. Start watch monitoring and open **Medications → Refresh schedule**. The watch uses its own timezone; check that the date, time and timezone are correct.
3. Allow watch notifications. Under **Watch settings → Reminder timing permission**, allow alarms/reminders for precise timing. Without this, Android may delay reminders. Do Not Disturb and notification settings can also silence alerts.
4. The watch caches the schedule and schedules local reminders, including with the screen off. Open the reminder and tap **Taken**, or use the watch Medications screen. This records the user's report; it does not independently establish medication ingestion.
5. The phone care list refreshes through Realtime and foreground reconciliation. Each scheduled dose is separate. A repeated tap/retry from phone or watch creates only one dose confirmation. The phone asks which scheduled dose was taken.

An offline Taken action is saved on the watch and retried using network-aware Android jobs. Until the server acknowledges it, the watch says confirmation pending. Rejected or expired confirmations are not shown as saved. Cached reminders use the last received schedule; keep the watch online to receive edits and cancellations. The watch offers recent and upcoming doses; server confirmation accepts only matching scheduled doses within two days and no more than five minutes early.

## SOS

Tap **SOS · request help** and confirm. A successful server response means the emergency event, critical alert and caregiver notification are saved. The phone presents a sound, vibration and alert while open, and its Alerts/Emergency lists refresh. With no internet, the action remains queued and the watch reports it as pending. This feature does not place a call to emergency services and cannot guarantee delivery or a caregiver response.

**Closed-app Android SOS notifications are not enabled until Firebase is configured.** The code includes Expo push registration and server submission, but this project currently has no Firebase client configuration or FCM service-account credential.

To finish closed-app notification setup:

1. In https://console.firebase.google.com/ create or select a project and register Android package **com.eldercareai.mobile**.
2. Download its Android client **google-services.json**. Supply it to the linked EAS project's preview environment as a **file** variable named **GOOGLE_SERVICES_JSON**. `app.config.js` uses the file only when supplied.
3. In Firebase **Project settings → Service accounts**, generate the FCM service-account JSON key. Upload that private key through **EAS credentials → Android → Google Service Account → Push notifications (FCM V1)**. Do not put the private key in source files, chat messages, or app assets.
4. Build/install the updated phone APK with that Firebase client file. In **Alerts**, tap **Enable background watch SOS alerts** and grant notifications.
5. Test on the actual phone with the app backgrounded and closed. Registration or an Expo push ticket alone does not establish device delivery. Internet, app permissions, device restrictions and correct FCM credentials are required.

Official setup: https://docs.expo.dev/push-notifications/fcm-credentials/

## Validation

`node test-support/galaxy-watch-migration.mjs` verifies scoped SOS, transactional records, retry deduplication, dose matching, cross-patient denial, phone/watch duplicate confirmations, and the stress reference calculation in isolated PostgreSQL. Native unit tests cover timezone-specific dose planning, weekly rules, expiry, and existing sensor/GPS behavior. A live SOS or a real medication Taken action should be tested only deliberately; automated checks do not create false emergencies or dose records in the production database.
