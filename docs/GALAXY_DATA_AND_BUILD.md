# Galaxy Watch vital history and self-build guide

Phone source version: **1.3.4**. Watch source version: **1.4.5 (12)**. Hybrid location is restored: watch satellite GPS, fused and network estimates are collected with their true source, accuracy and original measurement time. The temporary Live walk mode is removed. All existing vital, care and safe-zone features remain included; new zones default to 20 m with a 10 m minimum.

**Install phone v1.3.4 and watch v1.4.5 for this update.** The supplied watch was updated without clearing pairing. Build the phone APK yourself with the command below; older watch-GPS-only phone builds hide the restored fused/network estimates.

## Build the phone APK

Run in PowerShell:

```powershell
cd C:\ELDERCAREAI-CAPSTONE
npx eas-cli@latest build --platform android --profile preview
```

Download the APK from the completed EAS build and install it over the existing ElderCareAI phone app. Preview embeds its JavaScript and does not need Metro or reload. Keep the existing signing credentials to retain the update path and app data.

If a previous v1.3.0 build failed to resolve `supabase/functions/_shared/care-evidence`, rebuild from the corrected source. The phone now defines its evidence response types and metric labels in `src/lib/care-evidence.ts` independently of backend files excluded from the EAS upload. The Supabase deployment does not need changing for this packaging fix.

The Samsung Health Data SDK library is already copied to `modules/samsung-health/android/libs/samsung-health-data-api-1.1.0.aar`. It is ignored by Git but included in the EAS upload. If building on another computer, download the SDK from [Samsung](https://developer.samsung.com/health/data/overview.html), review its license and copy that AAR to the same directory first. The phone now requires Android 10/API 29 or later. EAS runs the configured native prebuild; an old locally generated `android` folder must also be regenerated or updated before a local phone build.

## Build the watch APK only for a first installation or an older watch version

**Skip this section if your watch already has ElderCareAI Watch v1.4.5 installed.** These commands are included for installing the watch app initially or updating an older version. You can check the installed version in the watch's app information screen.

```powershell
cd C:\ELDERCAREAI-CAPSTONE\wearos
$env:JAVA_HOME='C:\Program Files\Java\jdk-22'
$env:ANDROID_HOME='C:\Users\cedri\AppData\Local\Android\Sdk'
.\gradlew.bat :app:assembleDebug
```

Output: `C:\ELDERCAREAI-CAPSTONE\wearos\app\build\outputs\apk\debug\app-debug.apk`.

Turn on watch Wi-Fi and Wireless debugging. Use the current **connection address** from its main debugging screen, rather than its separate pairing port:

```powershell
$adb='C:\Users\cedri\AppData\Local\Android\Sdk\platform-tools\adb.exe'
& $adb connect 'WATCH_IP:CONNECTION_PORT'
& $adb -s 'WATCH_IP:CONNECTION_PORT' install -r 'C:\ELDERCAREAI-CAPSTONE\wearos\app\build\outputs\apk\debug\app-debug.apk'
```

Replace both address placeholders. Keep the same debug signing key. An update retains pairing; after installing, open ElderCareAI on the watch and start monitoring again. Allow sensors, location and activity permissions. The [watch guide](../wearos/README.md) covers Health Sensor Service test mode and GPS operation.

## Connect sleep and overnight oxygen for this developer test

Use the same Android phone paired to the **patient's** watch through Galaxy Wearable, with Samsung Health installed and synchronized. Samsung Health Data SDK is separate from the watch Sensor SDK. This path reads Samsung records directly and does not use Google Health or Health Connect.

1. Update Samsung Health on the phone and open it. Confirm the patient's sleep is visible there first.
2. For this developer test, follow [Samsung's Data SDK developer-mode instructions](https://developer.samsung.com/health/data/guide/developer-mode.html): Samsung Health **⋮ → Settings → About Samsung Health**, tap the version line at least ten times, open **Developer mode (Samsung Health Data SDK)**, review its notice and enable **Developer Mode for Data Read**. Samsung restricts this mode to developer testing; public distribution requires partner registration of the package and release signature.
3. Open the updated ElderCareAI phone app and sign in. Go to **Profile → Health history → Connect Health history**.
4. Grant **Sleep** and **Blood oxygen** read access. Choose the patient's Galaxy Watch source and confirm the records belong to that patient. Initial import checks the last 30 days of sleep and seven days of oxygen, extending the lookback when recovering from an older successful sync.
5. Tap **Sync Health history now**. Check the sleep and SpO₂ cards and their measurement times. The app checks on opening/resuming and about every minute while open. Android may schedule background checks with a minimum requested interval of 15 minutes; this is best effort and is not an exact timer.
6. For future overnight oxygen, enable blood oxygen during sleep in the watch's Samsung Health settings, wear the watch to sleep, and let Samsung Health synchronize after waking. Only records Samsung makes available through the SDK can be imported. If Samsung Health has not received a sleep or oxygen record, ElderCareAI cannot invent it.

## What gets recorded

| Vital | Collection and database behavior |
| --- | --- |
| Heart rate | Each valid delivered sensor update is queued with its original time, including readings at or above 100 BPM. The watch tries the Android heart sensor if Samsung stops delivering valid heart-rate data. |
| SpO₂ | Manual spot measurement or foreground automatic spot checks on the watch; saved Samsung Health oxygen series can also import from the selected watch. Samsung's on-demand sensor is not a continuous background oxygen stream. |
| Steps | New step-counter updates while monitoring; this is the monitored daily total, not an invented estimate for time monitoring was off. |
| Skin temperature | Valid wrist skin measurements while monitoring and in contact with skin; this is not core body temperature. |
| HRV / stress | Valid beat intervals produce rolling RMSSD HRV. Each delivered HRV result is logged. Once the personal reference is ready, its derived 0–100 stress index, baseline and model version are saved on the same row. The index is experimental and **not medical grade**. |
| Sleep | Actual sleep duration and session boundaries imported after Samsung Health provides the record; it does not stream second by second or necessarily appear immediately on waking. |

Each event has its own `vital_sign_logs` row. Other metric columns are blank because those sensors did not necessarily measure at that moment. Do not expect a heart-rate row to contain fresh oxygen, sleep and temperature values too. `recorded_at` is the measurement time; `synced_at` is the database upload time. Watch samples stay in the local outbox until acknowledged, and duplicate retries do not add duplicate history.

Imported records include `measurement_origin`, `source_device_id`, provider record keys and provider revision times. If Samsung corrects a session, both versions remain in the audit history and the earlier version is marked `is_superseded=true`. Cards and Elle use current versions only. Historical data from the previous provider is preserved; it is not used as current Galaxy Watch data.

## Verify history and Elle

### Care workflow additions in phone v1.3.0

**Alert response:** Open **Alerts → Review and respond** on a real saved warning or SOS. Tap **Acknowledge alert**, enter what you did, and tap **Save note and resolve**. The database records the caregiver and server time for each transition. Reading or clearing a notification does not acknowledge the alert. A resolution note is final, and repeated requests do not create duplicate response events. Linked SOS history resolves with the alert even after its notification is cleared. Older resolved alerts may have no response details from this version.

**Safe zones:** Open the location map from the dashboard. Under **Patient safe zone**, select **Set up safe zone**. Name the place, choose its fixed center on the map or use a fresh watch satellite position, choose a 10–5,000 m radius, then explicitly save. New zones start at 20 m; editing keeps an existing zone’s saved radius until you change it. Coordinates can also be entered when no watch position is available. The green circle previews the boundary; editing alone does not save it. Pause or resume alerts from the same card. One zone is supported per patient, with separate settings and history for each account.

Only fresh watch satellite GPS positions with accuracy at most 100 m (and at most half the radius) can confirm a boundary. At least three qualifying fixes spanning 20 seconds are required. The boundary margin is one-quarter of the radius, capped at 25 m, plus the reported GPS accuracy. For a 50 m zone the fix must have accuracy of 25 m or better, and the margin is 12.5 m. With 10 m accuracy, an exit needs distance greater than 72.5 m from the center across the confirmation period. Crossing the drawn circle alone does not immediately trigger an alert. Poor fixes, missing monitoring, offline periods and uncertain boundary positions do not establish a crossing. Old or excessively future-dated fixes cannot move the confirmation forward. Initial inside confirmation is not a return event. An exit creates a saved alert, notification and background push job; a confirmed return creates a notification and boundary event. Returning, changing the zone, pausing it or acknowledging its alert cancels queued obsolete exit pushes. Previously displayed messages cannot be withdrawn.

To test on the actual watch, enable monitoring and internet, choose an appropriate radius, and first wait for **Inside safe zone**. Then take the watch clearly beyond the circle, accuracy buffer and margin; keep receiving accurate satellite fixes for at least 20 seconds. Check **Alerts**, **Notifications**, and the safe-zone card. Walk back well inside and wait for confirmation. Do this with a consenting, supervised tester. A stale position is labeled as waiting for GPS, rather than proof of current safety. With background notifications enabled, repeat with the phone app swiped away; Android force-stop and disabled internet can prevent delivery.

**Elle source readings:** Ask **“Did my patient ever go above 110 BPM?”** or add a supported date range. The response includes a database-check panel with the number of saved samples checked and matched, plus up to eight matching example readings. Tap one to inspect its original values, measurement times, origin and record ID. The aggregate covers the full saved query, not just the examples. A query with no matches shows its checked scope without inventing a matching source. General AI answers show source cards when the model cites a supplied reading; invalid reference IDs are discarded. Links identify saved consumer-wearable records and do not medically validate AI advice. All source detail queries remain scoped to the signed-in patient.

The restored hybrid stream needs watch v1.4.5 and phone v1.3.4. The phone and backend now accept all three source types without calling a fused estimate watch GPS. Use Start monitoring; there is no separate walking session.

### Verify account switching and saved cards

1. Install the new phone APK over the existing app, using the same signing credentials. Keep the existing app data.
2. Sign in to account 1 and open Health. The sleep card and its detail view should both show that patient's latest saved sleep, with its original measurement time, even when there is no current watch snapshot.
3. In Profile, the account's previously selected Health history source restores automatically. The new phone build checks existing read permissions without opening a permission prompt. If access was revoked, reconnect Health history and grant the required read access.
4. Sign out, sign in to account 2, and pair/select only that patient's watch. Sign out again and return to account 1. Its saved vital cards and history source should return independently of account 2.
5. Tap **Sync Health history now**. “No new records” means the provider has no additional records to import; it does not erase or hide previously saved records. New uploads require the correct linked source, permissions, internet connection and an active watch pairing. Replacing a watch snapshot does not erase patient history.

Sign-out pauses the background import and retains separate account/patient source settings. **Disconnect history import** explicitly unlinks the selected account's source while retaining its saved readings. Sync requests are scoped to the caregiver, patient and source; a previous account's pending SDK read cannot reuse the newly signed-in account's upload credential.

### Verify database history

In Supabase's table editor, filter `vital_sign_logs` by the patient's `elderly_id`, `source = galaxy_watch` and `is_superseded = false`. Sort by `recorded_at` descending and filter a particular metric to **is not null**. This prevents high-frequency BPM rows from hiding less frequent oxygen or sleep events.

For one row per patient with the latest available values together, open the **vital_sign_latest** database view. Each metric retains its own measurement timestamp. This view follows the underlying table's caregiver access controls. Raw logs intentionally remain separate measurement events.

The production schema requires `sleep_history` even on oxygen rows. The import now supplies an empty array for non-sleep events; existing failed oxygen batches retry from the SDK without generating synthetic readings. The isolated PostgreSQL test includes that NOT NULL requirement and verifies oxygen import and retry deduplication.

The **Alerts → Automatic vital alerts** card lists the configured app review rules. Threshold crossings create saved entries under both **Alerts** and **Notifications**. A queued notification wakes the push worker immediately after its database transaction commits. The minute scheduler remains as recovery and for medication/appointment due times. Delivery uses Expo Push Service and Firebase Cloud Messaging on Android. Enable **Alerts → Enable background notifications** once on each caregiver phone and allow notification permission. Push requires the new APK with the EAS Firebase `google-services.json` file and FCM v1 service-account credential configured. Android and network conditions can still delay delivery.

Phone v1.2.3 plays a short alarm and shows a saved vital warning while the app is open, including when Firebase registration has not been enabled yet. It deduplicates Realtime and push delivery of the same notice. New notification channels restore the configured custom sounds without changing older APKs' channel mapping. Use **Alerts → Health alert sound settings** to manage the Android channel; keep notification volume on for background alerts and media volume on while the app is open.

Medication and appointment saves now treat reminder setup separately from the committed database write. A notification setup failure closes the successfully saved form and displays a reminder warning; it does not report that the medication failed to save. A rejected database write keeps the draft available for retry. If an earlier APK showed a save error, inspect the medication list before adding the same entry again.

Current rules: heart rate **below 50 or above 110 BPM**; SpO₂ **below 95%**; a recorded sleep session **below 5 hours**; wrist skin-temperature change **at least 0.8°C and at least 2 standard deviations** from at least five recent same-watch readings (up to seven in the last 24 hours). Repeated live crossings while a rule remains active are limited to one notification per hour; the reading must return to range and cross again to reset. Sleep and skin alerts wait until those records sync. These are app review thresholds, not medical limits. Experimental stress/HRV and steps have **no automatic threshold** because the app has no validated or user-configured rule. SpO₂ is a spot/sleep reading, not continuous medical monitoring.

Ask Elle **“Did my patient ever reach 100 BPM and above?”** It now queries all matching saved history rather than only the newest seven samples. You can add **today**, **yesterday**, **last 7 days**, **last 30 days**, **this/last week**, **this/last month**, or explicit `YYYY-MM-DD` dates. Counts represent samples, not separate clinical episodes; missing measurements cannot establish that something never happened.

Samsung permission prompts, overnight record availability, Android background timing and end-to-end push delivery depend on your phone and network after you build and install the update. The watch APK does not need rebuilding for this phone/backend change. Push sends to Expo Push Service, which forwards Android messages through your configured Firebase Cloud Messaging v1 credentials; acceptance by the push service does not guarantee Android displayed the message.


## Operate restored hybrid tracking

1. Install phone v1.3.4. Watch v1.4.5 is already installed on the supplied watch. Enable Location on both the watch and its paired phone, allow precise Location for ElderCareAI Watch, and tap Start monitoring.
2. Keep watch internet available. The app retains direct validated Wi-Fi while monitoring and uses the system network if Wi-Fi is unavailable. Wi-Fi must cover a phone-independent walking route, unless the watch has supported LTE or a nearby hotspot.
3. The watch requests satellite GPS at a one-second interval and fused/network estimates at two-second intervals. It selects fresh, valid fixes, protects a very recent precise GPS point from a much poorer alternative, and preserves each selected source. Requested intervals are not a guarantee of delivery frequency.
4. Build/install phone v1.3.4 to show the restored estimates. The map uses the newest received point from the live snapshot or route records. A three-second incremental foreground query recovers missed Realtime messages. GPS/fused/network source changes break the trail into separate segments.
5. Read the source and accuracy above the map. Fused location may use the paired phone. If the phone stays at home, a phone-assisted estimate may show the phone’s location rather than the wearer’s position. Network estimates can be approximate. Adding these sources cannot guarantee 10–20 m wearer accuracy.
6. Keep your manually selected house center for the zone. Only fresh, sufficiently accurate watch satellite GPS fixes confirm zone exits/returns, as before the watch-only update. Fused/network markers can appear on the map while the safe-zone card waits for qualified GPS. A 20 m zone requires accuracy of 10 m or better; a 10 m zone requires 5 m or better, plus the existing margin and sustained confirmation.
7. Use Retry location if permissions/providers have changed. A successful upload and a current position are different conditions; the screen displays location age separately from upload age. Stop monitoring when finished.

The temporary Health Services walking session was stopped before the hybrid watch update. Its SDK and control were removed. The earlier per-app battery-optimization exemption and direct Wi-Fi support remain to support screen-off monitoring; this can increase battery use while monitoring. The app-specific exemption can be removed with `adb shell cmd deviceidle whitelist -com.eldercareai.watch` if desired.
