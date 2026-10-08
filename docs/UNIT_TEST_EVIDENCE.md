# Unit test evidence

Use the [unit testing table](UNIT_TEST_TABLE.md) for the case descriptions and results. Enter the proponent and date tested in the final report.

## Capture one test case at a time

1. Open the matching `__tests__/CASE-###.test.tsx` file and screenshot the complete test block.
2. From the project root, run `npm test -- --runTestsByPath __tests__/CASE-001.test.tsx --verbose`, replacing the case ID. Screenshot the Jest line that shows `PASS` and the same ID.
3. For a visible screen case, reproduce the state in the Android development build and screenshot that screen separately. Do not label a Jest component tree as a phone screenshot.
4. For pure calculations or background notification scheduling, write "UI screenshot: Not applicable (logic-only case)" instead of inventing a screen result.

## Where to capture the app UI

| Case IDs | Screen or evidence target |
| --- | --- |
| CASE-001 to CASE-004 | Google sign-in and first-run introduction. Live Google OAuth is not exercised by Jest. |
| CASE-005 to CASE-010 | Introduction and setup screens; route assertions are logic-only, so a matching setup screen is contextual evidence. |
| CASE-011 to CASE-013 | Caregiver or older-adult setup fields. |
| CASE-014 to CASE-018 | Caregiver setup form and its validation messages. |
| CASE-019 to CASE-024 | Older-adult setup form and its validation messages. |
| CASE-025 to CASE-027 | Home vital cards and vital detail. |
| CASE-028 to CASE-035 | Health insights and readings; calculations are logic-only and require synced records for a visual example. |
| CASE-036 to CASE-040 | Elle chat welcome, reply, friendly failure, and New Chat. Gemini is mocked by Jest. |
| CASE-041 to CASE-044 | Care Plan, medication form, or note form. Native validation alerts can be photographed. |
| CASE-045 to CASE-053 | Care Plan medication status; status calculations are logic-only and require suitable saved schedules/logs for a visual example. |
| CASE-054 to CASE-059 | Care reminder settings/schedules; most assertions are logic-only, not device notification delivery. |
| CASE-060 to CASE-063 | Settings > Doctor Contact, empty and saved states. |

The automated suite uses mocks for Supabase, Google sign-in, Gemini, and native notification APIs. Its pass result verifies the app logic and React Native component behavior asserted in each test; it does not verify production credentials, live database policies, real notification delivery, or pixel-level device layout.
