import {vitalReviewWarnings} from '@/src/lib/vital-review';

test.each([50,100,110])('%s BPM does not cross the configured heart-rate rule',value=>{
  expect(vitalReviewWarnings({heart_rate_bpm:value})).toEqual([]);
});
test.each([49,111,150])('%s BPM crosses the configured heart-rate rule',value=>{
  expect(vitalReviewWarnings({heart_rate_bpm:value})).toHaveLength(1);
});
test('oxygen uses a strict below-95 boundary and ignores invalid values',()=>{
  expect(vitalReviewWarnings({spo2_percent:95})).toEqual([]);
  expect(vitalReviewWarnings({spo2_percent:94.9})[0].metric).toBe('spo2_percent');
  expect(vitalReviewWarnings({heart_rate_bpm:NaN,spo2_percent:0})).toEqual([]);
});
