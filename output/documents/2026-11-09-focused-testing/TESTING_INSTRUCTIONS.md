# Run the focused tests

Open PowerShell in `C:\ELDERCAREAI-CAPSTONE`.

```powershell
cd C:\ELDERCAREAI-CAPSTONE
npm ci
```

Install dependencies only when the project has not already been set up. Run all selected unit and integration tests together:

```powershell
npm test -- --silent
```

The selected set has `CASE-001.test.tsx` through `CASE-100.test.tsx` in `__tests__`, and `INT-001.test.tsx` through `INT-030.test.tsx` in `integration testing`. Each table row in the Word files matches one numbered file.

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

The Jest tests use controlled fixtures for native sensors, Supabase, notifications and other external services. For the project demo, also verify real watch vital updates, GPS movement, Samsung Health sleep sync, and phone alerts on your devices. The user guide lists the screens to capture.
