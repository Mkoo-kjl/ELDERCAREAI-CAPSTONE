# ElderCareAI Galaxy Watch6

This standalone Wear OS app uploads directly to the linked Supabase project. Pair it in the phone app under Profile → Connect or change watch. Google caregiver sign-in remains separate from watch data.

For v1.4 SOS, medication notifications and Taken acknowledgements, the experimental stress index, foreground automatic SpO₂ checks and Firebase prerequisites, see [WATCH_CARE_SETUP.md](WATCH_CARE_SETUP.md).

## Watch design

The native watch screens use the ElderCareAI logo, aqua/sage/charcoal palette and Manrope typography. The dashboard keeps heart rate and the monitoring action above the individual vital cards. Sensor controls and diagnostics sit below location and sharing status. The launcher uses the same logo.

## Measurements

| Reading | Collection | Notes |
| --- | --- | --- |
| Heart rate | Continuous while monitoring | Samsung tracker with standard Android heart-sensor fallback; actual event timestamps |
| Wrist skin temperature | Samsung continuous tracker | Watch6 supported; requires valid wrist contact; not core temperature or a fever reading |
| HRV | Estimated RMSSD | Computed from quality-approved Samsung beat intervals over 30–60 seconds, refreshed at most every 5 seconds; not a proprietary Samsung stress score |
| Steps | Watch step counter | Counts increments during monitoring today; excludes steps before monitoring and while stopped |
| SpO₂ | Manual or foreground automatic spot checks | Optional five-minute waits between checks while the oxygen screen stays open; each attempt up to 30 seconds; continuous optical trackers pause during it |
| Location | Hybrid GPS, fused and network | Fused may use the paired phone; original source, accuracy and measurement time accompany fixes |
| Sleep | Imported by the phone | Samsung’s live sensor SDK does not expose sleep; the phone's Samsung Health Data SDK imports the selected watch's actual sleep sessions after synchronization |

The hardware controls sample timing. Continuous monitoring and GPS consume battery; they do not guarantee gap-free clinical monitoring. The process is not automatically restarted after a reboot or force stop.

## Build

1. Download Samsung Health Sensor SDK v1.4.1 from [Samsung Developer](https://developer.samsung.com/health/sensor/overview.html), review its license and copy `samsung-health-sensor-api-1.4.1.aar` into `wearos/app/libs/`. The proprietary library is ignored by Git.
2. Open `C:\ELDERCAREAI-CAPSTONE\wearos` in Android Studio. Install SDK 36 and select JDK 17 or later.
3. Build `app`, select Galaxy Watch6 and Run. Updating an existing installation preserves its pairing.
4. On the watch, open Settings → Apps → Health Sensor Service (older name: Health Platform). Tap its title about ten times. Open Developer mode, review Samsung’s agreement and enable it for this test app. Public distribution requires Samsung partner registration of the app package and signing certificate.
5. Start monitoring from the watch screen and grant heart-rate, skin-temperature, location, background health and physical-activity permissions. Blood oxygen asks for its permission when selected.

```powershell
cd C:\ELDERCAREAI-CAPSTONE\wearos
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

APK: `wearos/app/build/outputs/apk/debug/app-debug.apk`.

## Backend

```powershell
cd C:\ELDERCAREAI-CAPSTONE
npx supabase db push
npx supabase functions deploy galaxy-watch --no-verify-jwt
npx supabase functions deploy ai-care-assistant
```

The migrations are `20261102000000_galaxy_watch_live.sql`, `20261102010000_galaxy_watch_sensor_history.sql` and `20261102020000_watch_location_trail.sql`. Review the pending migration list. The second migration makes Galaxy Watch the provider, clears retired cloud OAuth credentials and adds individual sensor history. The third stores received GPS positions with caregiver access controls and Realtime updates. Existing medical logs are preserved.

The old wearable OAuth/sync/webhook functions should be deleted from the linked project. The mobile app no longer invokes them.

## Pair, monitor and verify

Generate an eight-digit code in the phone app’s Galaxy Watch setup, enter it on the watch, and tap Pair. Start monitoring. The watch shows individual sensor statuses, upload age and queued samples. HRV needs at least 30 seconds of valid beat intervals; poor contact or motion restarts that window. SpO₂ requires its own button and a still arm.

The watch persists **each valid delivered vital event** to a per-device SQLite outbox. Batches contain at most 120 samples. The server commits one sparse `vital_sign_logs` row per new measurement timestamp; unchanged numeric values with new timestamps are logged. Sample IDs and device/metric/time uniqueness prevent retry duplicates. Each metric updates its live field independently. Offline samples retain their original times and cannot overwrite newer live data. Keep monitoring running with internet until queued samples reach zero; unsent samples remain across process death. A new pairing never uploads another device’s queue.

Verify real database rows with source `galaxy_watch`, metric-specific `measurement_times` and `watch_sample_id`. Normal heart-rate samples appear about once per sensor event, rather than once per minute. The phone retains thirty recent samples **per metric** in memory; the database retains all accepted rows. Supabase Realtime updates open connected apps; closed-app server push alerts are not implemented by this integration.

## Live movement tracking

Version 1.4.5 restores simultaneous satellite GPS (1 s), fused and network (2 s) subscriptions. Continuous requests remain active and selected fixes retain their real source. Fresh current-location probes and long-silence recovery remain, without repeatedly interrupting normal acquisition every 30 seconds. The temporary Live walk client was removed. Actual sensor timing, network and database delivery may be slower than requested intervals. Offline GPS remains a latest-position snapshot rather than a lossless route archive.

The Stress level card displays an experimental, non-medical-grade 0–100 HRV index after collecting a personal reference. It retains raw HRV in milliseconds and does not claim a validated stress measurement or Samsung stress score. See the care setup guide for its formula and calibration requirements.

## Location diagnostics

Enable precise Location on the watch and Location on the paired phone for hybrid estimates. Satellite GPS needs a clear sky view. The watch displays the selected source, accuracy, measured time and satellite diagnostics. A fused position can be derived from the paired phone; if that phone stays behind, it is not proof of the wearer’s position. Only qualified watch satellite fixes confirm the safe zone. Direct watch Wi-Fi, supported LTE or paired-phone networking supplies internet for uploads.

## Checks

- `npm run typecheck`
- `npx jest __tests__/galaxy-watch.test.ts __tests__/vital-auto-sync.test.tsx --runInBand`
- `node test-support/galaxy-watch-migration.mjs` (optional isolated PGlite runtime under `tmp/watch-db-check`)
- `node test-support/live-map-runtime.mjs`
- Android assemble, unit tests and lint above
- Physical watch: permissions, fresh location, real temperature/IBI events, offline queue/retry, screen-off monitoring and spot SpO₂

## References

- [Samsung sensor specifications](https://developer.samsung.com/health/sensor/guide/data-specifications.html)
- [Samsung permissions](https://developer.samsung.com/health/sensor/guide/permission-request.html)
- [Samsung sensor developer mode](https://developer.samsung.com/health/sensor/guide/developer-mode.html)
- [Wear OS location](https://developer.android.com/training/wearables/apps/location-detection)

## Uploads and map updates

Watch v1.4.5 keeps validated Wi-Fi requested while monitoring and routes uploads directly through that network. System networking remains available when watch Wi-Fi is unavailable. The sharing card shows the connection and last successful upload separately from the location timestamp. Receiving an estimate and delivering it to the phone are independent prerequisites.

Phone v1.3.4 chooses the newest saved estimate from both route and snapshot streams, with a three-second incremental route reconciliation while the map is active. GPS, fused and network estimates retain their source labels. A phone-assisted estimate can represent the paired phone even when the wearer leaves that phone behind.


## Hybrid restoration in v1.4.5

Watch v1.4.5 uses the Samsung Sensor SDK and Google Play services location client. The temporary Health Services ExerciseClient and Live walk UI were removed after its session was explicitly stopped. Normal Start monitoring controls the restored hybrid feed.

Phone v1.3.4 and the deployed ingest function accept GPS, fused and network estimates with original source labels. The phone compares both route and snapshot streams and reconciles the route every three seconds while active. The saved safe-zone center is preserved; its confirmation rule still requires watch GPS rather than an ambiguous phone-assisted estimate.
