import {buildEvidence,citedEvidence,stripEvidenceReferences,evidenceMetrics as serverMetrics} from '../supabase/functions/_shared/care-evidence';
import {evidenceMetrics as phoneMetrics} from '@/src/lib/care-evidence';
import {safeZoneAccuracyLimit,safeZoneStatus,zoneInputError,type SafeZone} from '@/src/lib/safe-zone';
const row={id:'11111111-1111-4111-8111-111111111111',source:'galaxy_watch',heart_rate_bpm:118,recorded_at:'2026-11-07T01:01:00Z',measurement_times:{heart_rate_bpm:'2026-11-07T01:00:59Z'}};
test('the independently packaged phone and backend agree on metric names and units',()=>{
  expect(phoneMetrics).toEqual(serverMetrics);
});
test('source cards retain original times and cannot use fabricated or replaced records',()=>{
  const pool=buildEvidence([row,{...row,id:'made-up'},{...row,is_superseded:true},{...row,source:'other'}]);
  expect(pool).toHaveLength(1);expect(pool[0]).toMatchObject({record_id:row.id,value:118,measured_at:'2026-11-07T01:00:59Z'});
  expect(citedEvidence('Reading [V1]. Unsupported [V99].',pool)).toEqual({reply:'Reading [V1]. Unsupported .',evidence:pool});
  expect(citedEvidence('General advice.',pool).evidence).toEqual([]);
  expect(stripEvidenceReferences('Previous reading [V1]')).toBe('Previous reading ');
});
test('sparse measurements retain evidence for different metrics',()=>{
  const pool=buildEvidence([row,{...row,heart_rate_bpm:null,sleep_hours:7.3,measurement_times:{sleep_hours:'2026-11-06T22:00:00Z'}}]);
  expect(pool.map(p=>p.metric)).toEqual(['heart_rate_bpm','sleep_hours']);
});
test('safe-zone state never labels a stale or absent fix as a current inside position',()=>{
  const now=Date.parse('2026-11-07T01:00:00Z'),zone={enabled:true} as SafeZone;
  expect(safeZoneStatus(zone,{status:'inside',last_fix_at:'2026-11-07T00:55:00Z'} as any,now)).toBe('Waiting for watch GPS');
  expect(safeZoneStatus(zone,{status:'inside',last_fix_at:'2026-11-07T00:59:55Z'} as any,now)).toBe('Inside safe zone');
  expect(safeZoneStatus({...zone,enabled:false},null,now)).toBe('Paused');
  expect(safeZoneStatus(zone,{status:'inside',last_fix_at:'2026-11-07T00:59:55Z'} as any,now,false)).toBe('Monitoring paused');
  expect(safeZoneStatus(zone,{status:'inside',last_fix_at:'2026-11-07T00:59:55Z',last_check:'Near the boundary; waiting for a clearer position'} as any,now)).toBe('Near boundary · checking');
  expect(zoneInputError('Home',NaN,123,300)).toMatch(/valid center/);
  expect(zoneInputError('Home',10,123,9)).toMatch(/radius/);
  expect(zoneInputError('Home',10,123,10)).toBeNull();
  expect(zoneInputError('Home',10,123,20)).toBeNull();
  expect(zoneInputError('Home',10,123,50)).toBeNull();
  expect(zoneInputError('Home',10,123,100)).toBeNull();
  expect(zoneInputError('Home',10,123,5000)).toBeNull();
  expect(zoneInputError('Home',10,123,5001)).toMatch(/radius/);
  expect(safeZoneAccuracyLimit(50)).toBe(25);
  expect(safeZoneAccuracyLimit(10)).toBe(5);
  expect(safeZoneAccuracyLimit(20)).toBe(10);
  expect(safeZoneAccuracyLimit(300)).toBe(100);
  expect(zoneInputError('Home',10,123,300)).toBeNull();
});
