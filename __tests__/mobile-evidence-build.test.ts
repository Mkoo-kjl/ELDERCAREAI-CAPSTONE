import {evidenceMetrics} from '@/src/lib/care-evidence';

// The backend is absent in the mobile build archive. Any runtime dependency on
// it must fail here too, even though the file exists in the development checkout.
jest.mock('../supabase/functions/_shared/care-evidence',()=>{
  throw new Error('Backend functions are not present in the EAS phone upload.');
});

test('phone evidence definitions load without any backend function files',()=>{
  expect(evidenceMetrics.heart_rate_bpm).toEqual({label:'Heart rate',unit:'BPM'});
  expect(Object.keys(evidenceMetrics)).toHaveLength(7);
});
