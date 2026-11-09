# Run the screenshotable tests

Open PowerShell in `C:\ELDERCAREAI-CAPSTONE`.

```powershell
cd C:\ELDERCAREAI-CAPSTONE
npm ci
```

Install dependencies only when the project has not already been set up. Run all selected unit and integration tests together:

```powershell
npm test -- --silent
```

The selected set has `CASE-001.test.tsx` through `CASE-100.test.tsx` in `__tests__`, and `INT-001.test.tsx` through `INT-040.test.tsx` in `integration testing`. The files remain flat and in the same module and case order as the Word tables.

To run one unit case, replace the number in the path:

```powershell
npm test -- --runTestsByPath .\__tests__\CASE-001.test.tsx
```

To run one integration case:

```powershell
npm test -- --runTestsByPath '.\integration testing\INT-001.test.tsx'
```

To run all unit files or all integration files separately:

```powershell
npx jest __tests__/CASE- --runInBand --silent
npx jest 'integration testing/INT-' --runInBand --silent
```

For a visible list of the numbered files:

```powershell
Get-ChildItem .\__tests__\CASE-*.test.tsx | Sort-Object Name | Select-Object Name
Get-ChildItem '.\integration testing\INT-*.test.tsx' | Sort-Object Name | Select-Object Name
```

Run the TypeScript check after code changes:

```powershell
npm run typecheck
```

For evidence, run the case and capture its terminal `PASS`, then capture the matching visible result on the installed phone app, watch, or signed-in admin portal. The tables use the requested nine-column format. For states that depend on saved readings, alerts, or appointments, use a real record belonging to the selected patient. Do not enter invented medical readings merely to make a screenshot.

The automated tests use controlled fixtures for sensors, Supabase, notifications, and other external services. New UI contract cases check current phone, watch, or admin source controls; they do not run those screens. A terminal pass is distinct from a live screenshot or proof of end-to-end delivery. In particular, appointment and medication notification delivery, GPS movement, Samsung Health sync, and watch sensor accuracy require live checks.

