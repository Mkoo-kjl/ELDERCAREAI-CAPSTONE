# Unit test evidence

The current unit table contains 100 selected cases. Each CASE-### row matches one file in `__tests__`. The full focused run passed 187 tests in 130 suites on 9 November 2026.

For one case, run `npm test -- --runTestsByPath "__tests__/CASE-001.test.tsx"` from the project root, replacing the number. Capture the terminal `PASS` result and, for a visible UI case, the corresponding screen from the installed app. Logic-only tests do not have a phone screenshot.

See the [detailed commands](../output/documents/2026-11-09-focused-testing/TESTING_INSTRUCTIONS.md) and the [user guide](ELDERCAREAI_USER_GUIDE.docx) for screenshot locations. Automated tests use controlled service fixtures, so watch GPS, sensors and phone push delivery need device evidence.
