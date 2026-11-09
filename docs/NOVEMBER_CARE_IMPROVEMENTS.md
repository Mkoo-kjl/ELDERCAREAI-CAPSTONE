# ElderCareAI care improvements — 8 November 2026

Phone source version: **1.4.1**. Watch remains **1.4.5**; no watch rebuild is needed for these changes. Build the phone APK yourself as requested.

## Implemented behavior

| Area | Result |
|---|---|
| Live vital cards | Shared accessible text/icon/color badges on Dashboard, Health and vital details. Labels derive from the displayed measurement and update with incoming watch readings. Original measurement times remain visible. Missing readings and insufficient baselines are explicit. |
| Preventive insights | A section for all six metrics, with record timestamps, context, recent changes where meaningful and conservative wellness suggestions. No diagnosis, invented measurement, medication recommendation or automatic dose change. |
| Medication images | Each schedule has its own optional image. Camera and gallery selection reuse the existing image-picker dependency. Cards on Care, Dashboard and Health Records show a private signed image or the existing medication illustration. |
| Medication entry | Manual entry remains available. Editable dose times, start/end dates, prescriber and instructions are retained. Separate prescribed times are required for twice-daily entry; the app does not silently choose the second time. |
| Time handling | Canonical local `HH:mm` storage, explicit 12-hour AM/PM display, schedule timezone preservation, date boundaries and weekly weekdays. Parsing also handles database clocks with seconds. DST gaps are rejected rather than silently moved. |
| Care schedule | A timeline includes seven days of medication occurrences and appointment history. Ongoing/due, upcoming, past-for-review and completed activities have explicit labels. Upcoming events sort by actual date and time; same-day entries sort by time. Edits and rescheduling refresh the list. |
| Appointment reminders | NULL status is treated as upcoming. Reminders occur 15 minutes before and at the appointment time, include patient/purpose/date/time/doctor/location, deduplicate per appointment occurrence and stop for completed/cancelled/rescheduled appointments. Completion is now available in Care. |
| Simultaneous notifications | Local notifications use distinct identifiers per entity/occurrence. Server reminders retain separate event keys and per-notification display tags/collapse IDs; retries retain the same event identity. Foreground dialogs queue, including dismissal handling, so one event does not overwrite another. In-flight local reminders are cancelled when sign-out clears schedules. |
| Reminder restoration | A root observer reconciles saved care schedules on startup, resume and changes. Local reminders are used when server push is not confirmed; a stale local push flag is checked against the current account's backend registration. |
| Emergency contacts | Settings stores three ordered contacts per patient: caregiver → family member → doctor. The emergency screen shows name, relationship and number with individual dial actions. SOS logs its event and opens the priority list; it no longer automatically calls an ambiguous legacy contact. |
| Analytics | Health → Analytics queries actual Supabase measurements with date-range and metric filters, original timestamps, chronological records, live updates, an interactive recorded-value chart and min/max/mean/change summaries. Superseded and foreign-patient rows are excluded. |
| Prescription drafts | Camera/gallery prescription images are private. The authenticated Edge Function uses the existing Gemini configuration and returns extraction drafts only. Missing fields stay empty. Caregivers inspect the original, correct fields, choose missing times/dates and explicitly confirm each medication before it is saved and reminders activate. |
| Linked medication action | Caregivers can explicitly link existing prescriptions to vital cards. A threshold popup offers **View linked medications** only when that patient has a matching active schedule; saved alert cards offer the same action. The filtered list can return to all medications. This never instructs an extra dose. |

## Status rules and alerts

These are app review/wellness rules, not individualized medical limits. A label describes the recorded value, not a diagnosis or proof of current safety.

| Vital | Display context | Automatic threshold notification |
|---|---|---|
| Heart rate | Below 50: Low / Attention required. Above 110: High / Attention required. 50–79: Good / App band. 80–110: High / App band. These selected display bands are not clinical normal ranges. | Strictly below 50 or above 110 BPM, preserving the previously approved threshold. Exactly 110 does not cross it. |
| SpO₂ | At least 95: Normal range. Above 92 but below 95: Attention required. At or below 92: Critical / Recheck now. Invalid values are withheld. | Below 95%; a new critical-level reading can escalate a recent warning without waiting for the normal reminder cooldown. Confirm wrist readings and obtain appropriate professional help. |
| Sleep | Below 5 h: Short / Attention required. 5–under 7 h: Fair / Short duration. 7–9 h: Good duration. Above 9 h: Longer duration. This does not grade sleep quality. | Recorded sleep below 5 h, subject to existing record-age/deduplication rules. Sleep is imported after it is recorded and synchronized; it is not a live sleep-stage stream. |
| Skin temperature | Learning baseline until five prior samples within 24 h exist. Attention when the existing ≥0.8°C and ≥2-standard-deviation rule is crossed; otherwise near recent baseline. | Existing personal-baseline rule. This is wrist temperature, not fever/core temperature. |
| Stress / HRV | Learning baseline until the existing experimental score is available. Score <40: Low estimate; 40–under 70: Moderate estimate; ≥70: Elevated estimate. | Visual wellness context only; no new clinical stress alarm or universal HRV cutoff was invented. |
| Steps | No steps recorded / Activity recorded. One current daily maximum of monitored steps is retained per patient/calendar day in Asia/Manila; unmonitored activity can still be missing. | No universal emergency step threshold was invented. Follow the patient's agreed activity plan. |

General references: [NIA sleep guidance](https://www.nia.nih.gov/health/sleep), [MedlinePlus pulse oximetry](https://www.medlineplus.gov/lab-tests/pulse-oximetry/), [AHA heart-rate context](https://www.heart.org/en/healthy-living/exercise-and-physical-activity/fitness-basics/target-heart-rates). The selected display bands and configured BPM alert thresholds are not the AHA's clinical definition of normal resting heart rate.

## Database changes — no new tables

Applied migrations: `supabase/migrations/20261108000000_care_usability_and_reminders.sql` and `supabase/migrations/20261108010000_daily_watch_steps.sql`.

- Existing `medication_schedules`: `image_path`, `prescription_path`, `prescription_reviewed_at`, `related_vitals`; owner/patient path and confirmation constraints.
- Existing `elderly_profiles`: `emergency_contacts` JSON array, at most three contacts. Legacy family-contact fields remain supported.
- Existing `appointments`: `timezone`, with existing timestamps preserved.
- Existing `vital_sign_logs`: `steps_day`, a partial unique daily-step index, daily-step upserts in the existing ingestion function, and an authenticated `daily_step_history` RPC. Older duplicate step snapshots are preserved as superseded records; no rows were deleted.
- Existing `care_vital_rule_state`: `last_severity` for critical oxygen escalation.
- Replaced existing scheduling, reminder-eligibility and vital-review functions. Preserved the current safe-zone/resolved-alert wrapper.
- Added a **private Storage bucket row** named `care-files` and owner/patient/active-caregiver policies on the existing Storage objects table. This creates no database table. Images use expiring signed URLs; prescriptions are not put in a public bucket.
- The deployment transaction checked that the public table count did not change and medication/appointment record counts did not decrease. Recorded the migration in the existing migration-history table.

## Services and dependencies

No new package dependency. Reused Expo Image Picker, Notifications, Audio, the existing theme and Supabase client on SDK 54.

- Deployed `prescription-draft` v1, ACTIVE, gateway JWT verification enabled plus active-caregiver/patient ownership checks in the handler.
- Deployed `care-notification-worker` v5, ACTIVE. Preserved its existing server-secret authentication; added explicit per-kind sound payloads and distinct event identities using [Expo’s documented tag/collapse fields](https://docs.expo.dev/push-notifications/sending-notifications/).
- Prescription extraction reuses existing `GEMINI_API_KEY` and `GEMINI_MODEL`; optional `PRESCRIPTION_MODEL` can override the model. No AI key is embedded in the phone app.
- Existing Firebase Android client and EAS FCM credentials must be valid in the APK. After installation, use **Alerts → Enable background notifications**. The database currently has **zero registered push devices**, so closed-app delivery is not yet verified on this phone.

## Validation

- Final complete app test run: **272 cases / 141 suites passed, zero failures** (`tmp/care-ui-tests-final.json`).
- Isolated PostgreSQL/PGlite executed all watch/care migrations and the new migration. Covered same-time medications/appointments, NULL appointment status, advance reminders, duplicate retries, completion/cancellation/rescheduling, end dates, critical oxygen escalation, private-file ownership and unchanged table count.
- Existing GPS/safe-zone, vital history, SOS, per-dose Taken, account isolation and evidence-query regressions passed.
- Actual push payload runtime verified separate simultaneous event identities, stable retry identity, per-kind sound and compatibility with older channels.
- Actual prescription-handler runtime tested authentication, foreign-owner rejection, private image reads, draft-only prompt, missing dosage preservation and absence of medication writes. External AI transcription accuracy was not claimed as tested.
- Frontend cases cover private image upload/display, caregiver correction and confirmation, failed-save draft retention, emergency contact ordering/calling/saving, real-record analytics/live updates, readable time formatting, timezone/DST handling, simultaneous notification identities and queued threshold popups.
- Daily-step PostgreSQL cases also passed: backfill preserves row/table counts, one current daily row, maximum rather than cumulative summation, original sample timestamps, Manila midnight reset, late/repeated/archived uploads, all BPM events retained, and owner-only date-filtered reads. Production verification found zero duplicate current step days.
- TypeScript and Expo lint passed; Android production JavaScript export completed under the actual EAS ignore rules (1,399 modules, 73 assets).
- Browser visual automation was attempted but stopped: the in-app browser could not reach the local preview and Computer Use could not verify the Windows browser URL. No successful visual review is claimed. The temporary preview config and servers were removed/stopped; synthetic fixtures were not sent to production.

## Build and phone checks

```powershell
cd C:\ELDERCAREAI-CAPSTONE
npx eas-cli@latest build --platform android --profile preview
```

1. Install the phone update and confirm Profile → About shows 1.4.1. Keep watch 1.4.5 and normal monitoring.
2. Enable background notifications in Alerts and allow notification permission. This registers the phone with the existing push backend. Use Android's notification/channel settings to allow sounds; check volume and Do Not Disturb.
3. In Settings → Emergency contacts, save caregiver, family and doctor details. Open Emergency contacts and inspect the priority order. Calling occurs only after the corresponding Call button is tapped.
4. In Care, create/edit an actual prescribed medication. Choose its image, explicit times, start/end dates, prescriber and optional related vital. Verify the 12-hour labels and the seven-day Schedule timeline.
5. Review an upcoming appointment's date/time/purpose. Reminders are scheduled 15 minutes before and at its time; completion/rescheduling should invalidate the older reminder. Test simultaneous reminders in a separate test patient/account rather than changing a patient's care plan just for a notification test.
6. Open Health → Analytics, choose the metric and date range, inspect a chart point and compare its timestamp/value with the saved records. Live updates must retain the selected patient and filters.
7. Open Health → AI Insights and a vital detail card. Verify the timestamp, status and wellness context match the actual measurement. Threshold links appear only for caregiver-linked prescriptions.
8. Optionally import a clear JPG/PNG/WebP prescription. Check the original image at full size, correct every extracted field and confirm each draft before saving. Extraction alone must not create medication records.

## Remaining limits

- The phone APK has not been built or installed by the agent, per the owner's instruction. Physical-device notifications, sounds, camera/gallery behavior and a real prescription transcription still need device verification after installation.
- Android Force stop, disabled notifications, Do Not Disturb, missing Firebase credentials or lack of internet can prevent push delivery. Server scheduling runs once a minute; it is not a guaranteed exact-second alarm.
- Local fallback uses a 28-day rolling window for date-bounded or different-timezone schedules, refreshed on startup/resume and periodically while open. Enable server push for long periods without opening the app.
- Analytics caps a request at the latest 5,000 records and explicitly labels partial statistics. The chart shows up to 40 real points and retains record timestamps. Narrow the range when necessary.
- No source change makes all watch sensors instantaneous. Sleep/history import and HRV baseline/window requirements remain. Experimental stress, wrist temperature and sleep-duration labels are not medical diagnoses.
- Camera/gallery prescription images are supported; PDF prescription upload is not included. AI can misread text; caregiver confirmation remains mandatory.

## Modified and new source/test files

The following list excludes generated build bundles, local preview fixtures and test logs under `tmp/`.

- `__tests__/CASE-032.test.tsx` (modified)
- `__tests__/CASE-041.test.tsx` (modified)
- `__tests__/CASE-042.test.tsx` (modified)
- `__tests__/CASE-043.test.tsx` (modified)
- `__tests__/CASE-044.test.tsx` (modified)
- `__tests__/CASE-046.test.tsx` (modified)
- `__tests__/CASE-055.test.tsx` (modified)
- `__tests__/CASE-065.test.tsx` (modified)
- `__tests__/care-images-analytics.test.tsx` (new)
- `__tests__/care-save-flow.test.tsx` (modified)
- `__tests__/care-timeline.test.tsx` (new)
- `__tests__/care-usability.test.ts` (new)
- `__tests__/emergency-contacts.test.tsx` (new)
- `__tests__/health-records-route.test.tsx` (modified)
- `__tests__/intro-layout.test.tsx` (modified)
- `__tests__/medication-editor.test.tsx` (new)
- `__tests__/notification-sounds.test.tsx` (modified)
- `__tests__/sleep-score.test.tsx` (modified)
- `__tests__/vital-detail-insight.test.tsx` (modified)
- `__tests__/watch-sos-observer.test.tsx` (modified)
- `app.json` (modified)
- `app/(tabs)/alerts.tsx` (modified)
- `app/(tabs)/care.tsx` (modified)
- `app/(tabs)/dashboard.tsx` (modified)
- `app/(tabs)/health.tsx` (modified)
- `app/(tabs)/profile.tsx` (modified)
- `app/_layout.tsx` (modified)
- `app/health-records.tsx` (modified)
- `docs/NOVEMBER_CARE_IMPROVEMENTS.md` (new)
- `integration testing/INT-004.test.tsx` (modified)
- `integration testing/INT-005.test.tsx` (modified)
- `integration testing/INT-011.test.tsx` (modified)
- `integration testing/INT-025.test.tsx` (modified)
- `jest.config.js` (modified)
- `src/components/CareImage.tsx` (new)
- `src/components/CareScheduleObserver.tsx` (new)
- `src/components/EmergencyContacts.tsx` (new)
- `src/components/HealthAnalytics.tsx` (new)
- `src/components/MedicationEditor.tsx` (new)
- `src/components/MetricCard.tsx` (modified)
- `src/components/PickerModal.tsx` (modified)
- `src/components/PrescriptionImport.tsx` (new)
- `src/components/RelatedMedications.tsx` (new)
- `src/components/VitalDetailModal.tsx` (modified)
- `src/components/VitalStatusBadge.tsx` (new)
- `src/components/WatchCareObserver.tsx` (modified)
- `src/lib/care-files.ts` (new)
- `src/lib/care-status.ts` (modified)
- `src/lib/care-time.ts` (new)
- `src/lib/health-analysis.ts` (modified)
- `src/lib/medication.ts` (new)
- `src/lib/monitoring-records.ts` (new)
- `src/lib/notice-queue.ts` (new)
- `src/lib/notifications.ts` (modified)
- `src/lib/pdf-reports.ts` (modified)
- `src/lib/prescription.ts` (new)
- `src/lib/sleep-score.ts` (modified)
- `src/lib/vital-status.ts` (new)
- `src/lib/watch-push.ts` (modified)
- `src/providers/HealthDataProvider.tsx` (modified)
- `supabase/config.toml` (modified)
- `supabase/functions/_shared/care-push.ts` (modified)
- `supabase/functions/prescription-draft/index.ts` (new)
- `supabase/migrations/20261108000000_care_usability_and_reminders.sql` (new)
- `test-support/care-push-runtime.mjs` (new)
- `test-support/care-usability-cases.mjs` (new)
- `test-support/galaxy-watch-migration.mjs` (modified)
- `test-support/integration/care-workflow-harness.tsx` (modified)
- `test-support/jest-native-setup.ts` (new)
- `test-support/prescription-runtime.mjs` (new)


## Phone 1.4.1 UI and simultaneous-reminder follow-up

- Care plan tabs scroll horizontally and keep each label on one line, so Appointments no longer wraps inside a fixed-width tab. Medication titles/status badges/actions can wrap cleanly on narrow screens.
- Elle’s existing face appears on the optional prescription-entry card and import header. Camera/gallery, private files, editable drafts and caregiver confirmation remain the same.
- Analytics offers Line and Bar modes. Bars are 1–6 points wide, and the chart fits up to 160 actual sample points, retaining extrema and endpoints when reducing larger datasets. Tap the plot or use Previous/Next to read the original value/time. Summary statistics and record lists use the full queried data, not the reduced chart samples.
- Step analytics requests paginated daily records by calendar date in Asia/Manila, shows one maximum monitored cumulative count per day, and updates that day as new steps arrive. It never sums repeated cumulative snapshots. Missing monitoring periods or watch resets are not filled with invented steps.
- Automatic vital alerts starts collapsed. Tap it to read rules and sound settings; the compact form leaves more space for emergency contacts and SOS.
- BPM display changes with the live value: below 50 Low / Attention required; 50–79 Good / App band; 80–110 High / App band; above 110 High / Attention required. The notification boundary remains strictly above 110, as approved.

### Root cause and reminder behavior

The reported collision happened while the app was open. The foreground observer queued server reminders only after confirmed push registration. Locally scheduled medication/appointment notifications did not enter that queue. The phone had no registered Firebase/Expo push token.

New local alarms carry caregiver, patient and entity ownership metadata. A verified local delivery enters the existing serial popup/audio queue directly, without requiring Firebase registration. Two simultaneous medication/appointment events retain separate identifiers and appear in sequence: dismiss or open the first to see the next. Duplicate delivery of the same event is ignored. Repeating medication alarms have distinct delivery identities on different days. Wrong-account and wrong-patient notifications cannot open a popup.

In the foreground, the queue owns the local popup and sound, avoiding a second competing OS banner/sound. Every notification remains in the system notification list. In the background, Android still owns the distinct local notifications and their sounds. Existing server push, queueing and unique push tags/collapse IDs are preserved. No new database table or package dependency was needed.

### Test on the new phone APK

1. Build/install phone **1.4.1** and open it once. Keep the watch on **1.4.5**. Accept Android notifications and keep media volume audible for open-app popups.
2. Open Care plan. Swipe the tab strip: each complete label should be readable. The prescription card should show Elle; opening it should show the original draft-review workflow.
3. Open Health → Analytics, choose a metric/date range, switch Line/Bar, and inspect original readings/times using the plot or arrow buttons. Choose Steps: one record per day should increase as the watch wearer walks, rather than adding multiple copies of the cumulative count.
4. Open Alerts. Rules should be collapsed initially. Expand/collapse Automatic vital alerts; emergency contacts and SOS should remain easy to reach.
5. Set a medication reminder and an appointment to the same upcoming clock time (several minutes ahead). Keep the app open. At the due time, one popup should appear with sound. Dismiss it: the second should appear with its own sound. Repeat using two different medications at the same time. Remove demo schedules afterward.
6. View genuine incoming BPM readings: the label changes at 80, while 110 does not create a high-heart-rate warning and a fresh value above 110 does. Do not deliberately induce an abnormal heart rate to test; boundary logic is covered by isolated tests.
7. For closed-app remote delivery, separately enable **Alerts → Enable background notifications** on the Firebase-enabled phone APK and allow Android notification sounds. Remote delivery on the physical phone remains unverified until a device is registered and tested; Android force-stop and disabled notifications prevent delivery.

### Files changed for this follow-up

- `app.json`
- `app/(tabs)/care.tsx`, `app/(tabs)/alerts.tsx`
- `src/components/PrescriptionEntryCard.tsx` (new), `PrescriptionImport.tsx`
- `src/components/AutomaticVitalAlerts.tsx` (new)
- `src/components/MonitoringChart.tsx` (new), `HealthAnalytics.tsx`
- `src/components/WatchCareObserver.tsx`, `CareScheduleObserver.tsx`, `MedicationEditor.tsx`
- `src/lib/monitoring-chart.ts` (new), `monitoring-records.ts`, `vital-status.ts`
- `src/lib/local-care-notice.ts` (new), `notifications.ts`
- `src/providers/HealthDataProvider.tsx` (daily-step date type)
- `supabase/migrations/20261108010000_daily_watch_steps.sql` (new, applied)
- `test-support/daily-steps-cases.mjs` (new), `galaxy-watch-migration.mjs`
- `__tests__/care-ui-updates.test.tsx`, `monitoring-chart.test.tsx` (new at the time of this update)

### Test filenames as of 9 November 2026

The feature-named test files listed above were reorganized into numbered files. The focused unit test files are `__tests__/CASE-001.test.tsx` through `CASE-100.test.tsx`; the integration test files are `integration testing/INT-001.test.tsx` through `INT-030.test.tsx`. The focused Jest run passed 187 tests in 130 suites on 9 November 2026. The Word tables document all 100 unit and 30 integration files.
- Updated analytics, vital band, foreground popup, local sound/ownership and appointment integration tests.

The code-level and database checks do not constitute a physical-phone visual or notification-delivery test. No new phone APK was built or installed by the agent; the user is handling that build.

