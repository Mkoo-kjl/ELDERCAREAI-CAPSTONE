# ElderCareAI

## Landing website

The standalone landing page is at [website/index.html](website/index.html). It works as a static site without starting the Expo app. See [website/README.md](website/README.md) for team photo placeholders and contact details.

## Unit and component tests

Run all Jest cases with `npm test`; run coverage with `npm run test:coverage`.
Each test has its own `__tests__/CASE-###.test.tsx` file for evidence capture. For example,
`npm test -- --runTestsByPath __tests__/CASE-001.test.tsx --verbose` runs the first login case.
The tests mock Supabase, Google sign-in, Gemini, and notification APIs; they verify
app logic and React Native component behavior, not live service availability or
pixel-level device appearance. Capture device UI screenshots separately for the
relevant screen cases.

Expo SDK 54 / React Native app for caregivers. It includes Supabase Google sign-in, persisted onboarding, real Google Health API v4 authorization/synchronization, foreground-only phone-location consent, a Leaflet last-sync map, health dashboards, data-driven health analysis, SOS/event logging, care-management CRUD, a Gemini-powered caregiver assistant, exports, and settings.

## Device notifications

The app uses `expo-notifications` to schedule local device notifications that continue to fire when the app is closed:

- Appointments notify at their scheduled date and time.
- Daily medication schedules notify at the selected 24-hour time.
- Twice-daily medication schedules notify at the selected time and 12 hours later.
- Weekly medication schedules notify on the schedule's start-date weekday.
- As-needed medication does not create an automatic reminder.
- Abnormal synchronized heart-rate or SpO₂ readings create an immediate local warning when notification permission is already enabled, with a one-hour duplicate cooldown.

Editing an appointment or medication replaces its previous device schedule; deleting it cancels the schedule. Tapping a notification opens the corresponding Care or Alerts tab. Notification permission can also be managed under **Settings → Preferences → Care notifications**.

Because `expo-notifications` and the Android exact-alarm permission are native configuration, install a new development APK after pulling this change. Later TypeScript or styling changes do not require another APK unless the native configuration changes again.

## 1. Install

```bash
npm install
```

Copy `.env.example` to `.env` and set:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

Use the publishable key from **Supabase Dashboard → Project Settings → API**. A legacy `anon` key also works. Never put the service-role/secret key in a mobile app.

## 2. Configure Supabase and Google

### Google Cloud / Google Auth Platform

1. Create an OAuth client of type **Web application**.
2. Enable **Google Health API** in the same Google Cloud project.
3. Add both exact **Authorized redirect URIs**, replacing the project ref:

   `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-health-oauth-callback`

4. Under **Google Auth Platform → Data Access**, add these Google Health API scopes:

   - `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`
   - `https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly`
   - `https://www.googleapis.com/auth/googlehealth.sleep.readonly`
   - `https://www.googleapis.com/auth/googlehealth.settings.readonly`

5. Copy the Google Client ID and Client Secret into **Supabase Dashboard → Authentication → Providers → Google**, then enable Google.
6. Configure the OAuth consent screen and add test users while the Google app is in testing mode.

Do not add `eldercareai://auth/callback` to Google Cloud. Google returns to Supabase first; Supabase then deep-links back to the app.

### Supabase Auth URL configuration

In **Authentication → URL Configuration** add this **Redirect URL**:

`eldercareai://auth/callback`

For local development you can instead allow `eldercareai://**`, but prefer the exact callback for production.

### Database and Storage

The repository contains ordered migrations. They are additive to the existing ElderCareAI tables in the project:

- `supabase/migrations/20260922000000_create_profiles.sql`
- `supabase/migrations/20260922010000_add_onboarding.sql`
- `supabase/migrations/20260922020000_app_rls.sql`
- `supabase/migrations/20260922030000_fix_profile_photo_rls.sql`
- `supabase/migrations/20260922040000_enable_vitals_realtime.sql`
- `supabase/migrations/20261003050000_add_doctor_contacts.sql`
- `supabase/migrations/20261004090000_add_raw_hrv_to_vitals.sql`
- `supabase/migrations/20261004100000_add_intro_onboarding_step.sql`
- `supabase/migrations/20261008000000_vital_measurement_times.sql`

Apply them with the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The onboarding migration extends the existing tables, creates `onboarding_progress`, creates the `profile-photos` Storage bucket and policies, and creates `wearable_sync_locations`. Later migrations add ownership-based RLS policies for vitals, medications, appointments, notes, alerts, notifications, emergencies, and chatbot data, plus doctor contacts, raw HRV storage, and the intro-screen completion flag. These migrations do not replace the schema supplied with the project. Supabase Auth stores the canonical Google email in `auth.users`; the trigger also ensures the user exists in `caregivers` and the app writes their completed details there.

### Google Health Edge Functions

Store the OAuth web-client credentials as server-side Supabase secrets. Never put the client secret in `.env` or the mobile bundle.

```bash
npx supabase secrets set GOOGLE_HEALTH_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com GOOGLE_HEALTH_CLIENT_SECRET=YOUR_WEB_CLIENT_SECRET
npx supabase functions deploy google-health-oauth-start
npx supabase functions deploy google-health-oauth-callback --no-verify-jwt
npx supabase functions deploy google-health-sync
npx supabase functions deploy google-health-disconnect
npx supabase secrets set GOOGLE_HEALTH_WEBHOOK_SECRET="Bearer YOUR_LONG_RANDOM_WEBHOOK_TOKEN"
npx supabase functions deploy google-health-webhook --no-verify-jwt
```

The callback must be public because Google calls it without a Supabase user JWT. OAuth `state` and PKCE protect the callback, and tokens are written by the service role into the RLS-protected `google_health_tokens` table. Authenticated mobile clients cannot read that table.

The connection and sync functions call these real v4 endpoints:

- `GET https://health.googleapis.com/v4/users/me/identity`
- `GET https://health.googleapis.com/v4/users/me/pairedDevices`
- `GET https://health.googleapis.com/v4/users/me/dataTypes/{dataType}/dataPoints`

The sync function requests `heart-rate`, `oxygen-saturation`, `daily-oxygen-saturation`, `sleep`, `steps`, `daily-sleep-temperature-derivations`, and `heart-rate-variability`, then writes one consolidated row to `vital_sign_logs`. HRV is stored as the raw RMSSD value from Google Health in milliseconds, without converting it into a synthetic score.

To activate server-side updates, register an `AUTOMATIC` subscriber in the same Google Cloud project through the [Google Health Subscribers API](https://developers.google.com/health/webhooks). Use your Google Cloud **project number**, an HTTPS `endpointUri` of `https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-health-webhook`, and the **same** `endpointAuthorization.secret` set as `GOOGLE_HEALTH_WEBHOOK_SECRET` above. Configure only data types supported by your project's Google Health webhook access. The Google Health API checks the endpoint twice at registration: the authorized verification request must return 200 or 201, and the unauthenticated one must return 401 or 403. The endpoint validates both the shared secret and Google's rotating public-key signature on actual notifications. Automatic subscriptions also require each user's consent to the corresponding scopes; registering the endpoint alone does not create new wearable data.

The callback stores the Google Health `healthUserId` with each caregiver's OAuth tokens and performs one initial sync after connection. Subsequent automatic updates come from the webhook: it maps that ID to the caregiver, fetches the newest health points, and writes a vital row only when a value or its measurement timestamp changed. Supabase Realtime then pushes that row to the open app. `measurement_times` records the timestamp of each metric separately; `synced_at` is only the last successful API check. Existing historical rows without measurement timestamps display **Sample time unavailable** rather than falsely claiming they were measured just now.

### Gemini care assistant Edge Function

Elle uses a Supabase Edge Function so the Gemini API key never ships in the mobile app. Store the key as a server-side secret and deploy the function:

```bash
npx supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY
npx supabase functions deploy ai-care-assistant
```

Optionally set `GEMINI_MODEL` as a Supabase secret to override the default model. The assistant reads the signed-in caregiver profile, patient profile, saved doctor contact, recent vitals, today's readings, medications, appointments, notes, and alerts from Supabase before calling Gemini. Its prompt explicitly says Elle is not a medical-grade AI, must not diagnose or prescribe, and must refer to patient readings as the patient's vitals or sleep rather than "your vitals."

## 3. Run with a development build

OAuth and the native location permission should be tested in a development build, not Expo Go. Rebuild the development client after adding `expo-location`.

### Physical Android phone — EAS build (easiest)

Yes, a development build runs on a real phone. Enable installation from the browser/download app when Android asks, then:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile development --platform android
```

Open the EAS result link on the phone and install the generated internal-development APK. On the computer, start Metro:

```bash
npm start
```

Keep the phone and computer on the same Wi-Fi. If LAN discovery fails, use:

```bash
npx expo start --dev-client --tunnel
```

Open the installed **ElderCareAI** development client and select the running project/QR code.

### Physical Android phone — USB local build

Prerequisites: Android Studio/SDK, Developer Options and USB debugging enabled on the phone, and the phone authorized for the computer.

```bash
npm install
adb devices
npx expo run:android --device
```

Choose the phone when prompted. After the development client is installed, later JavaScript-only runs need only:

```bash
npm start
```

For iOS, use `npx expo run:ios --device` on macOS or create an EAS iOS development build. A physical iPhone build requires an Apple Developer account and device provisioning. The registered native identifiers are `com.eldercareai.mobile` for both platforms.

## Authentication flow

1. The app requests Google OAuth from Supabase with PKCE and opens the system auth browser.
2. Google redirects to Supabase at `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
3. Supabase redirects to `eldercareai://auth/callback?code=...`.
4. The app exchanges the one-time code for a persisted session.
5. The database trigger and client upsert synchronize the user's email/profile.
6. Expo Router loads `onboarding_progress` and routes to the first unfinished step.
7. Intro, caregiver, older-adult, wearable, and location-consent completion timestamps are persisted separately.
8. Completed users enter `/home`, which redirects into the protected dashboard tabs. Skipped or unpaired wearables display a disconnected state and empty readings.

## Location behavior

The app requests only foreground/“when in use” location access. It does not register a background task, request background permission, or track continuously. After a real Google Health connection, granting consent records one phone-location event. A later successful foreground synchronization can record another event if permission remains granted. This is explicitly the phone’s location, never the watch’s claimed live GPS position.

The Home screen links to a last-sync location screen. It renders the newest authorized `wearable_sync_locations` row with Leaflet inside `react-native-webview`, using OpenStreetMap tiles and attribution. No Google Maps API key is required. Leaflet tiles require an internet connection, and adding `react-native-webview` requires a new development build.

## Health analysis behavior

- **AI Insights** compare the newest measurements with recent personal averages.
- **Predictions** apply simple linear regression to at least four distinct readings and display the sample-based confidence level.
- **Anomalies** combine explicit review thresholds with two-standard-deviation changes from the available personal baseline.

These calculations use synchronized database history and are no longer static cards, but they are still statistical decision support—not a trained clinical model, medical diagnosis, or substitute for professional assessment. The Elle chatbot is a separate Gemini-powered caregiver assistant with the same non-diagnostic safety boundary.

## Live dashboard and reports

With the subscriber registered, Google Health notifications trigger a server-side sync even when the app is closed. While the app is open, Supabase Realtime updates the cards as soon as a changed row arrives. **The app does not periodically poll Google Health.** On app launch or return to the foreground, it silently reconciles from Google Health to catch up after a missed webhook or offline period. A caregiver-initiated **Sync now** or pull-to-refresh still shows a spinner. This is not a continuous Fitbit heart-rate stream: the watch must first upload a new reading to Google Health, and notification delivery depends on Google's availability and supported data types. Android background or battery restrictions on the Google Health app can delay that watch-to-cloud upload; ElderCareAI cannot force another app to sync its device.

The app-initiated sync also reads Google Health's paired-device `lastSyncTime` (without returning device identifiers or MAC addresses). Home shows when the tracker last synced and, after an hour without a device sync, offers Android background-sync troubleshooting steps. A missing device-status permission does not block vitals. Google Health's `settings.readonly` scope is already requested during connection. The watch must be near the paired phone with Bluetooth and internet available. On that phone, allow the Google Health app's background battery usage and background data, grant Nearby devices, and disable Battery Saver while testing. These phone settings cannot be changed by ElderCareAI or its webhook.

To verify on a device, note a heart-rate value and its **Measured** time on Home, then obtain a *new* reading on the connected Fitbit and allow it to sync to Google Health. Confirm that a new/updated `vital_sign_logs` row has a later `measurement_times.heart_rate_bpm` value, and that the open Home screen changes its bpm/time without tapping refresh or showing the top pull indicator. If Google Health still returns the same 81 bpm sample, Home should keep 81 and show an increasing measurement age. Check the `google-health-webhook` function logs if no row appears; if a row appears but Home stays stale, check the Supabase Realtime publication and the caregiver's RLS access. A real end-to-end check requires the subscriber registration, deployed function, connected account, and a wearable-produced new reading.

Each Home vital card opens a detail sheet with Elle, the latest value, up to seven recent values, an explanation of the metric and its source, and a metric-specific caution. Overnight skin temperature is explicitly identified as a sleep-time skin measurement rather than current or core body temperature.

Settings → Data Management generates shareable PDF files through `expo-print` and `expo-sharing`. Health and medication reports include branded headers, patient/profile details, generated timestamps, organized tables, summary totals, and safety notes.

## Required values and redirect checklist

- Mobile `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Supabase Edge Function secrets: `GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET`, `GOOGLE_HEALTH_WEBHOOK_SECRET`, `GEMINI_API_KEY`
- Supabase Auth redirect allow-list: `eldercareai://auth/callback`
- Google OAuth web-client redirects:
  - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
  - `https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-health-oauth-callback`
- Never ship `SUPABASE_SERVICE_ROLE_KEY` or the Google client secret in Expo environment variables.

## Useful checks

```bash
npm run typecheck
npm run lint
npx expo-doctor
```
