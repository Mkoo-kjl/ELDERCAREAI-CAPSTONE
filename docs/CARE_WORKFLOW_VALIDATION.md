# Care workflow update — 7 November 2026

Phone source: **1.3.4**. Installed watch source: **1.4.5 (12)**.

Current scope: caregiver acknowledgment and final response notes; one configurable safe zone per patient with 10/20 m radius options; original-reading links in Elle’s answers; restored hybrid GPS/fused/network map tracking with watch-GPS-only boundary confirmation. Phone APK builds remain with the project owner. Watch v1.4.5 is installed. Earlier version sections below are an investigation history; the final restoration section describes the current behavior.

## Automated verification

- Targeted Jest tests passed for response notes, failed-save recovery, duplicate requests, safe-zone configuration, source-card navigation and persistence, unavailable sources, account-specific health history, medication saves, notification clearing, audio delivery, map updates and existing chatbot behavior.
- Notification routing tests verify that GPS notices open the map, unsupported URLs are rejected, and a cold-start tap waits for session restoration.
- `node test-support/galaxy-watch-migration.mjs` passed all existing watch migrations and the new PostgreSQL cases: owner-only access, idempotent audit events, immutable resolution time/note, SOS linkage after clearing notifications, GPS-only boundaries, accuracy margins, three-fix confirmation, boundary jitter, old/future fixes, return events, pausing, obsolete-push cancellation and authorized evidence selection.
- `node test-support/live-map-runtime.mjs` passed the actual map script, including stable map tiles, movement, follow controls, escaped safe-zone names, overlay changes independent of GPS time and coordinate selection only during editing.
- `node test-support/ai-evidence-runtime.mjs` passed the actual Edge handler using isolated fixtures: factual answers use saved matching readings, source times are preserved, invalid model reference IDs are discarded, foreign chat sessions are denied and inactive caregivers are denied.
- TypeScript and Expo lint checks passed.

These checks use isolated fixtures and do not send simulated emergencies, health readings or push messages to patient accounts.

## Backend rollout

Migration `20261107000000_care_workflow_safe_zones_evidence.sql` was first executed against the linked production schema inside a rolled-back transaction. The validated migration and its migration-history entry were then committed together using Supabase’s HTTPS query interface because direct database DNS resolution failed.

Post-deployment verification confirmed all four new Realtime tables, authenticated access to the two owner-checking caregiver RPCs, no client insert permission on the response audit, and no client access to the service-only evidence RPC. No patient safe zones were created during deployment.

`ai-care-assistant` was deployed through Supabase’s HTTPS bundling API and confirmed **ACTIVE**, version **21**, with JWT verification enabled. Existing watch ingestion and push worker deployments were retained.

## Device verification still required

Build and install phone v1.3.2 using the [self-build and feature guide](GALAXY_DATA_AND_BUILD.md). Check a real saved alert response, a supervised outdoor GPS exit/return, source-card details, and background notification delivery on the physical devices. Notification permission, internet, active watch monitoring and accurate GPS remain required. Watch v1.4.2 is already installed; the user confirmed the watch is currently indoors, so no outdoor fix or real boundary crossing is claimed as verified.

## Earlier 50-meter update (superseded by 10/20-meter options below)

Migration `20261107010000_safe_zone_fifty_meter_radius.sql` lowers the database constraint and owner-checked save RPC minimum to 50 m. The phone starts new zones at 50 m, includes 50/100 m presets and draws the smaller circle. Editing an existing zone preserves its saved radius. About now displays the configured phone version.

For radii below 100 m, the confirmation margin scales to one-quarter of the radius, while larger zones keep the existing 25 m margin. A 50 m zone requires GPS accuracy of 25 m or better and uses a 12.5 m boundary margin. Three qualifying fixes spanning at least 20 seconds remain required. The editor uses the same accuracy limit for centering from watch GPS and rejects stale or future-dated center fixes.

Isolated PostgreSQL checks verify the 49 m rejection through both RPC and table constraint, 50 m acceptance, inside confirmation at the maximum permitted GPS uncertainty, boundary jitter suppression, rejection of poor fixes, one queued exit push and a confirmed return that cancels an obsolete exit push. Existing larger-zone tests also pass. The production schema accepted the migration in a rolled-back transaction before the migration and history entry were committed together. Physical GPS and notification delivery still require the device checks above.

## Phone build packaging regression

The initial cloud build exposed a runtime import from the mobile evidence contract into `supabase/functions`, a folder intentionally excluded by `.easignore`. Local type checking and screen tests did not detect the missing-upload-file failure. The mobile contract is now self-contained, with a regression test that makes backend imports fail and a separate compatibility check for the phone/server metric definitions.

The production Android bundling check below rejects project runtime files excluded by the actual `.easignore` rules. It checks JavaScript and assets locally without starting an EAS cloud build or generating an APK:

```powershell
npx expo export:embed --eager --platform android --dev false --config test-support/metro-eas-check.config.cjs --bundle-output tmp/phone-eas-bundle-check/index.android.bundle --assets-dest tmp/phone-eas-bundle-check/assets --sourcemap-output tmp/phone-eas-bundle-check/index.android.bundle.map --max-workers 2 --reset-cache
```

## Watch-only GPS and 10/20-meter zones

Migration `20261107020000_safe_zone_small_radius.sql` permits radii from 10 to 5,000 m and preserves existing settings. New phone zones default to 20 m. The existing scaled boundary margin, half-radius accuracy limit and three-fix/20-second confirmation remain active. Both the isolated PostgreSQL cases and deployed metadata confirm the new minimum. The production migration was first checked in a rolled-back transaction, then committed atomically with its migration-history entry.

Watch v1.4.2 requests Android’s local GPS provider only. Fused/network requests and the Play services location dependency were removed. Satellite acquisition is kept active while monitoring; lack of a first fix no longer restarts the request every 30 seconds. Optional satellite-diagnostics failure cannot prevent the GPS subscription. The phone ignores legacy fused/unknown snapshots and filters route queries and Realtime merges by patient, device and explicit watch GPS source. Small zones show their required accuracy and explain indoor limitations and the fixed center.

The deployed `galaxy-watch` Edge Function is ACTIVE, version 8. Its existing `verify_jwt=false` metadata was verified before and after deployment; scoped watch credentials and caregiver authentication checks remain in the handler. The upload validator strips fused/network/unknown coordinates while preserving and acknowledging valid vital batches. Historical location records were not deleted.

Verification: 31 targeted Jest tests passed, the actual upload-handler runtime cases passed, the actual Leaflet map script passed, all isolated PostgreSQL migration cases passed including 10/20 m inside/exit/return and push-queue cases, TypeScript/Expo lint passed, and production Android JS bundling passed with the real EAS exclusion rules (1,377 modules, 71 assets). Android assemble, all 18 native unit tests and native lint passed; existing native lint warnings remain.

Physical device verification: installation returned Success on the supplied SM-R930 and package metadata confirmed v1.4.2 (9). The app opened successfully, monitoring was started from its visible button, the foreground health/location service was confirmed, and Android diagnostics showed a persistent 1-second GPS subscription for ElderCareAI with no fused subscription. The user confirmed the device remains indoors. Outdoor satellite acquisition, an actual safe-zone crossing and resulting phone delivery remain to be tested after installing phone v1.3.2.

## Independent live-movement update

Phone v1.3.3 selects the newest valid watch GPS point from both the live snapshot and route records. A three-second foreground incremental route query recovers missed Realtime events. The location screen displays GPS age separately from upload age and does not label a fresh upload containing an old fix as live GPS.

Watch v1.4.3 holds a validated saved Wi-Fi request while monitoring and uses that network explicitly for HTTP uploads. The default system connection remains a fallback. Satellite collection remains independent of the paired phone. A current-GPS probe is attempted when fixes are stale, at most once per 30 seconds; continuous acquisition is not stopped for these probes. Receiver restarts require 15 minutes of silence so slow first acquisition can complete. Existing watch diagnostics reported historical first-fix times averaging roughly 399 seconds during investigation.

Validation: 29 targeted Jest cases passed across route filtering/polling, actual location-screen selection and freshness, map updates, watch payloads and safe-zone controls. The actual Leaflet runtime passed, including selection of a newer route point and rejection of fused/future points. Android assemble, all 21 native unit cases and native lint passed. TypeScript, Expo lint and the Android production JS bundle with EAS exclusion checks passed. No backend schema or function change was required for this iteration.

The tested APK was installed over the existing watch app, retaining pairing, and monitoring was restarted. Direct watch Wi-Fi and successful uploads were observed on the physical SM-R930. Initial production diagnostics showed fresh uploads with a GPS fix older than 12 minutes and no newly saved route points. The user then moved the watch outdoors; satellite signals became visible but fresh position acquisition remained under investigation. No actual walking trajectory or map movement is claimed until new original GPS timestamps and route coordinates are observed. GPS assistance/time refresh and a brief Location off/on cycle were requested without clearing pairing or medical records.

## Watch-only live walking verification

Watch v1.4.4 adds an explicit Live walk control backed by Wear Health Services ExerciseClient. It requests WALKING/LOCATION with GPS enabled and no auto-pause, refuses another or unknown workout owner, resumes only its own session, and releases that session on Stop live walk or Stop monitoring. Async generation guards protect stop/restart races. Location timestamps come from the original WHS boot-relative measurement time; reported horizontal accuracy is preserved. Android GPS remains the fallback and the cloud protocol stays `watch_gps`.

The Health Services 1.1.0 published IntDef for exercise ownership is annotated library-only despite its use in the documented public ExerciseInfo contract. The RestrictedApi/WrongConstant suppression is confined to WatchWalkOwnership.decide; other lint checks remain enabled. Two real-SDK ownership cases verify refusal of foreign/unknown statuses and start/resume for free/owned statuses. Native tests now total 23, with Android assemble and lint passing. Phone validation remains 29 targeted Jest cases plus actual map runtime, TypeScript, Expo lint and the production Android JS bundle.

The user confirmed that the watch was outdoors under clear sky, then confirmed the brother was walking while the caregiver phone stayed indoors and home Wi-Fi covered the route. Watch v1.4.4 was installed with pairing retained; the user activated Start live walk. The watch reported ACQUIRED_UNTETHERED and a fresh original GPS time while direct watch Wi-Fi uploads continued. One measured one-minute window contained seven saved GPS positions, with a mean saved interval of 9.5 seconds, about 44.5 m coordinate spread and 11.1 m mean reported uncertainty. Coordinate spread is not a verified travel distance and does not remove GPS error.

An ElderCareAI-only Doze whitelist entry was applied after idle-mode diagnosis; device-wide power saving was retained. The native wakelock, direct Wi-Fi network and cloud uploads were verified. Physical measurement frequency is not guaranteed to equal the requested one-second sensor or two-second upload interval. Phone v1.3.3 remains for the user to build/install; final phone-map observation and small-zone boundary testing remain distinct from saved GPS delivery.

## Final requested restoration: hybrid tracking

The user requested the pre-watch-only GPS/fused/network behavior after the phone map moved but the wearer’s reported position remained roughly 100–500 m off. The user confirmed that the paired phone stays indoors and the house center was selected manually. A measured snapshot was 122 m from the saved 20 m zone, with 25 m reported uncertainty. These observations were not treated as proof of accurate wearer tracking.

Watch v1.4.5 restores all three providers and their source labels. The temporary walking session was explicitly stopped through the app’s STOP_WALK action and its stopped status was verified before removing its SDK, control and implementation. Normal monitoring, direct Wi-Fi, original measurement times and long-silence recovery remain. Phone v1.3.4 restores hybrid route/snapshot selection and source explanations. Unknown-source coordinates are withheld while valid vital samples remain accepted. The backend restores explicit fused/network ingestion with authentication unchanged. Safe-zone confirmation remains watch-GPS-only as in the previous hybrid implementation.

Verification: 31 targeted phone cases, TypeScript, the actual ingest-handler and Leaflet runtime cases passed. Android assemble, all 22 native tests and lint passed. Source switches remain separate route segments and foreign patient/device records remain excluded. Phone builds remain with the user; the current guide explains that phone v1.3.4 is needed because prior watch-only builds filter fused/network points. No claim is made that hybrid estimates guarantee house-level accuracy or that a paired-phone estimate tracks a wearer who leaves that phone behind.

Final deployment check: the galaxy-watch Edge function is ACTIVE at version 9 with its existing authentication configuration preserved. The signed watch update installed successfully and package metadata confirms versionName 1.4.5 / versionCode 12. Monitoring resumed and diagnostics showed a fresh network estimate with direct watch Wi-Fi and successful uploads. Expo lint passed; the Android production JavaScript bundle completed with the EAS ignore rules applied (1,377 modules and 71 assets). This validates compilation and the observed upload path, not physical position accuracy. The phone APK itself remains for the owner to build and install.
