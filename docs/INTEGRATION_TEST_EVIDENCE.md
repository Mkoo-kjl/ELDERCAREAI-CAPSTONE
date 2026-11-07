# Integration test evidence

Use the [integration testing table](INTEGRATION_TEST_TABLE.md) for the 25 verified case descriptions and results. Enter the proponent in the final report.

## Capture each case separately

1. Open the matching `integration testing/INT-###.test.tsx` file and capture the test block.
2. From the project root, run `npm test -- --runTestsByPath 'integration testing/INT-001.test.tsx' --verbose --cacheDirectory node_modules/.cache/jest`, replacing the case ID. Capture the Jest `PASS` line and case name.
3. For a visible screen case, reproduce that state in the Android development build and capture the screen separately. Jest output is evidence of automated behavior, not a device screenshot.
4. For reminders and PDF generation, capture the Jest assertion and a separate device demonstration if available. Native delivery and sharing are mocked in Jest.

| Case IDs | App screen or evidence target |
| --- | --- |
| INT-001 to INT-002 | Login redirect and onboarding or Home destination. Live Google sign-in is not exercised. |
| INT-003 to INT-009 | Health Vitals, AI Insights, Predictions, and Anomalies tabs with suitable saved readings. |
| INT-010 to INT-015 | Care plan medication list, taken state, and reminder or deletion actions. |
| INT-016, INT-021 to INT-022 | Care plan appointments and reminder actions. |
| INT-017 to INT-018 | Settings > Data Management and a device-generated report, when available. |
| INT-019 to INT-020, INT-024 | Elle chat reply, service error, and Open Meds action. |
| INT-023 | Care plan Notes tab after saving a handoff note. |
| INT-025 | Twice-daily medication form and reminders. |

These cases use controlled service responses. They do not verify live Supabase policies, Google Health synchronization, AI availability, physical notification delivery, PDF sharing on a device, or performance under load.
