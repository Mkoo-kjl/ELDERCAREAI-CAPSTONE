# Integration testing

Each `INT-###.test.tsx` file contains one integration case. The cases exercise real ElderCareAI screens together with their internal routing, analysis, care status, notification, report, or chat logic. Test doubles in `test-support/integration/` replace external Supabase responses and native device services.

Run this folder with:

```powershell
npm test -- --testPathPattern 'integration testing' --cacheDirectory node_modules/.cache/jest
```

See [the integration test table](../docs/INTEGRATION_TEST_TABLE.md) for case descriptions and results.
