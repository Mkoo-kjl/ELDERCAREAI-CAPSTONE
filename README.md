# ElderCareAI

## Galaxy Watch6 vitals and location

The standalone Wear OS project is in [`wearos`](wearos/README.md). Open that folder in Android Studio. Its guide covers backend deployment, pairing, permissions, installation and physical-device verification. This version streams heart rate and the watch's GPS only; it does not collect the other health metrics. The backend migration must be applied before running the updated phone app.

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

Expo SDK 54 / React Native app for caregivers. It includes Supabase Google sign-in, persisted onboarding, direct Galaxy Watch6 sensor uploads, explicit watch monitoring, a Leaflet location map, health dashboards, data-driven health analysis, SOS/event logging, care-management CRUD, a Gemini-powered caregiver assistant, exports, and settings.

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

### Installed APK says Supabase setup is needed

An installed preview/production APK uses the JavaScript bundle created during its build. Restarting Metro or editing the local `.env` cannot change an APK already on a phone. This project's `eas.json` includes the public Supabase URL and publishable key in every build profile so EAS cloud builds can inline them even though `.env` is git-ignored. These two values are public client configuration, **not** a service-role or Google/Gemini secret. If the Supabase project or publishable key changes, update the build profiles and local `.env` together.

Rebuild an installable Android APK and install the new build on the phone:

```bash
npx eas-cli@latest build --platform android --profile preview
```

Open the resulting EAS build link on the phone and install it over the old app. The `production` profile is for store distribution; its Android output is normally an AAB, not the direct-install preview APK. An old APK cannot be repaired by `npm start` or by reopening it.

## 2. Configure Supabase and Google

### Google sign-in

Create a Google OAuth Web application client for caregiver **sign-in**, enable it in Supabase Authentication, and register `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback` as its redirect. Health data comes directly from the paired Galaxy Watch. Sign-in uses the normal profile/email scopes.

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

### Galaxy Watch endpoint

Follow [the watch setup guide](wearos/README.md) to install Samsung’s sensor SDK, apply the watch migrations and deploy `galaxy-watch`. Device credentials are scoped to the paired patient; no service key is placed in the watch app. The sensor-history migration retires the previous provider and clears its stored OAuth credentials while preserving existing medical history.

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

The user starts a foreground monitoring session on Galaxy Watch. The watch requests satellite GPS and Wear OS fused location, which may use the paired phone. The map labels source, accuracy, actual measurement time and freshness. Old fixes are never relabeled as current. Location problems do not stop working heart-rate collection. No map API key is required; tiles need internet.

## Health analysis behavior

- **AI Insights** compare the newest measurements with recent personal averages.
- **Predictions** apply simple linear regression to at least four distinct readings and display the sample-based confidence level.
- **Anomalies** combine explicit review thresholds with two-standard-deviation changes from the available personal baseline.

These calculations use synchronized database history and are no longer static cards, but they are still statistical decision support—not a trained clinical model, medical diagnosis, or substitute for professional assessment. The Elle chatbot is a separate Gemini-powered caregiver assistant with the same non-diagnostic safety boundary.

## Live dashboard and reports

Supabase Realtime pushes watch measurements to the open caregiver app. Every delivered valid vital event is saved to the watch’s SQLite outbox, uploaded in batches approximately every five seconds, and inserted into `vital_sign_logs` with its own measurement time. Acknowledged samples leave the outbox; retries are deduplicated. Each metric has a separate history cache so frequent heart-rate events cannot evict a spot oxygen result.

Supported readings are heart rate, wrist skin temperature, rolling RMSSD HRV from valid inter-beat intervals, monitored steps today, and spot SpO₂. Samsung Health Data SDK imports actual sleep sessions and available oxygen history from the explicitly selected patient's watch. The HRV card includes an experimental personal-baseline stress index labeled **not medical grade**; its provenance is saved with each new HRV event once calibrated. Skin temperature is not core temperature. Test builds require the respective Samsung developer modes; public distribution requires Samsung partner registration.

See [Galaxy data and self-build setup](docs/GALAXY_DATA_AND_BUILD.md) for the phone v1.2.3 and watch v1.4.1 commands, sleep permissions, background alerts, logging behavior and full-history Elle queries.

Settings → Data Management exports saved health and medication records to PDF. Earlier medical history remains available as historical records.

## Required values and redirect checklist

- Mobile `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Supabase Edge Function secrets: `GEMINI_API_KEY` (watch server credentials are managed by Supabase)
- Supabase Auth redirect allow-list: `eldercareai://auth/callback`
- Google OAuth web-client redirects:
  - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
- Never ship `SUPABASE_SERVICE_ROLE_KEY` or the Google client secret in Expo environment variables.

## Useful checks

```bash
npm run typecheck
npm run lint
npx expo-doctor
```
