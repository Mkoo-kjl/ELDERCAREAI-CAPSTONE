import {safeZoneAccuracyLimit,safeZoneGpsHint,safeZoneStatus,type SafeZone} from '@/src/lib/safe-zone';

const zone={enabled:true,radius_m:20} as SafeZone;
const now=Date.parse('2026-11-10T12:00:00Z');
test.each(['watch_gps','fused','network'])('%s is eligible for a safe-zone check with fresh usable accuracy',location_source=>{
  expect(safeZoneGpsHint(zone,{location_source,accuracy_m:30,measured_at:new Date(now).toISOString()},true,now)).toBeNull();
});
test('safe-zone UI explains poor estimates, stale data, paused monitoring and confirmation',()=>{
  expect(safeZoneAccuracyLimit(20)).toBe(50);
  expect(safeZoneAccuracyLimit(200)).toBe(100);
  expect(safeZoneGpsHint(zone,{location_source:'network',accuracy_m:500,measured_at:new Date(now).toISOString()},true,now)).toContain('50 m or better');
  expect(safeZoneGpsHint(zone,{location_source:'fused',accuracy_m:5,measured_at:new Date(now-120000).toISOString()},true,now)).toContain('too old');
  expect(safeZoneStatus(zone,null,now,false)).toBe('Monitoring paused');
  expect(safeZoneStatus(zone,null,now,true)).toBe('Waiting for location');
  expect(safeZoneStatus(zone,{elderly_id:'patient',status:'inside',last_fix_at:new Date(now).toISOString(),confirmed_at:null,distance_m:25,last_check:'Confirming outside position',candidate:'outside',candidate_count:2},now,true)).toBe('Confirming location');
});
