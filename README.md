# ElderCareAI

Expo SDK 54 / React Native app for caregivers. It includes Supabase Google sign-in, persisted onboarding, real Google Health API v4 authorization/synchronization, foreground-only phone-location consent, a Leaflet last-sync map, health dashboards, data-driven health analysis, SOS/event logging, care-management CRUD, a static-response AI chat demo, exports, and settings.

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

The repository contains three ordered migrations. They are additive to the existing ElderCareAI tables in the project:

- `supabase/migrations/20260922000000_create_profiles.sql`
- `supabase/migrations/20260922010000_add_onboarding.sql`
- `supabase/migrations/20260922020000_app_rls.sql`

Apply them with the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

The onboarding migration extends the existing tables, creates `onboarding_progress`, creates the `profile-photos` Storage bucket and policies, and creates `wearable_sync_locations`. The final migration adds ownership-based RLS policies for vitals, medications, appointments, notes, alerts, notifications, emergencies, and chatbot data. These migrations do not replace the schema supplied with the project. Supabase Auth stores the canonical Google email in `auth.users`; the trigger also ensures the user exists in `caregivers` and the app writes their completed details there.

### Google Health Edge Functions

Store the OAuth web-client credentials as server-side Supabase secrets. Never put the client secret in `.env` or the mobile bundle.

```bash
npx supabase secrets set GOOGLE_HEALTH_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com GOOGLE_HEALTH_CLIENT_SECRET=YOUR_WEB_CLIENT_SECRET
npx supabase functions deploy google-health-oauth-start
npx supabase functions deploy google-health-oauth-callback --no-verify-jwt
npx supabase functions deploy google-health-sync
npx supabase functions deploy google-health-disconnect
```

The callback must be public because Google calls it without a Supabase user JWT. OAuth `state` and PKCE protect the callback, and tokens are written by the service role into the RLS-protected `google_health_tokens` table. Authenticated mobile clients cannot read that table.

The connection and sync functions call these real v4 endpoints:

- `GET https://health.googleapis.com/v4/users/me/identity`
- `GET https://health.googleapis.com/v4/users/me/pairedDevices`
- `GET https://health.googleapis.com/v4/users/me/dataTypes/{dataType}/dataPoints`

The sync function requests `heart-rate`, `oxygen-saturation`, `daily-oxygen-saturation`, `sleep`, `steps`, `daily-sleep-temperature-derivations`, and `heart-rate-variability`, then writes one consolidated row to `vital_sign_logs`. Stress is explicitly a demo derivation from HRV, not a raw Google Health measurement or medical assessment.

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
7. Caregiver, older-adult, wearable, and location-consent completion timestamps are persisted separately.
8. Completed users enter `/home`, which redirects into the protected dashboard tabs. Skipped or unpaired wearables display a disconnected state and empty readings.

## Location behavior

The app requests only foreground/“when in use” location access. It does not register a background task, request background permission, or track continuously. After a real Google Health connection, granting consent records one phone-location event. A later successful foreground synchronization can record another event if permission remains granted. This is explicitly the phone’s location, never the watch’s claimed live GPS position.

The Home screen links to a last-sync location screen. It renders the newest authorized `wearable_sync_locations` row with Leaflet inside `react-native-webview`, using OpenStreetMap tiles and attribution. No Google Maps API key is required. Leaflet tiles require an internet connection, and adding `react-native-webview` requires a new development build.

## Health analysis behavior

- **AI Insights** compare the newest measurements with recent personal averages.
- **Predictions** apply simple linear regression to at least four distinct readings and display the sample-based confidence level.
- **Anomalies** combine explicit review thresholds with two-standard-deviation changes from the available personal baseline.

These calculations use synchronized database history and are no longer static cards, but they are still statistical decision support—not a trained clinical model, medical diagnosis, or substitute for professional assessment. The Elle chatbot remains a separate keyword-based demo.

## Live dashboard and reports

While the app is active and Google Health is authorized, `HealthDataProvider` checks for updated readings every 60 seconds and immediately when the app returns to the foreground. `vital_sign_logs` is also included in the Supabase Realtime publication, so inserts or updates made by a server process are reflected without waiting for the next poll. Pull-to-refresh and the Home refresh button remain available as manual fallbacks. This is foreground synchronization; closing the app stops its one-minute poll.

Each Home vital card opens a detail sheet with Elle, the latest value, up to seven recent values, an explanation of the metric and its source, and a metric-specific caution. Overnight skin temperature is explicitly identified as a sleep-time skin measurement rather than current or core body temperature.

Settings → Data Management generates shareable PDF files through `expo-print` and `expo-sharing`. Health and medication reports include branded headers, patient/profile details, generated timestamps, organized tables, summary totals, and safety notes.

## Required values and redirect checklist

- Mobile `.env`: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Supabase Edge Function secrets: `GOOGLE_HEALTH_CLIENT_ID`, `GOOGLE_HEALTH_CLIENT_SECRET`
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
