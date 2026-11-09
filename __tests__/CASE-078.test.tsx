import {appointmentPhase,careZonedInstant,formatCareTime,medicationDayDoses,nextMedicationAt,parseCareTime} from '@/src/lib/care-time';

import {vitalStatus} from '@/src/lib/vital-status';

import {metricRecords} from '@/src/lib/monitoring-records';

import {NoticeQueue} from '@/src/lib/notice-queue';

import {prescriptionDrafts} from '@/src/lib/prescription';

import type {VitalLog} from '@/src/providers/HealthDataProvider';

const medication={id:'med',frequency:'Daily',times_of_day:['08:00','20:00'],start_date:'2026-11-08',end_date:'2026-11-10',timezone:'Asia/Manila'};

test('schedule respects start/end dates and sorts same-day clock times',()=>{
  expect(medicationDayDoses(medication,'2026-11-07')).toEqual([]);expect(medicationDayDoses(medication,'2026-11-11')).toEqual([]);
  expect(medicationDayDoses({...medication,times_of_day:['20:00','08:00']},'2026-11-08').map(x=>x.toISOString())).toEqual(['2026-11-08T00:00:00.000Z','2026-11-08T12:00:00.000Z']);
  expect(nextMedicationAt(medication,new Date('2026-11-08T01:00:00Z'))?.toISOString()).toBe('2026-11-08T12:00:00.000Z');
  expect(nextMedicationAt(medication,new Date('2026-11-11T01:00:00Z'))).toBeNull();
});

test('appointment lifecycle uses actual scheduled time and duration',()=>{
  const now=new Date('2026-11-08T02:00:00Z');
  expect(appointmentPhase({appointment_at:'2026-11-08T02:10:00Z'},now)).toBe('Upcoming');
  expect(appointmentPhase({appointment_at:'2026-11-08T01:50:00Z',duration_min:30},now)).toBe('Ongoing');
  expect(appointmentPhase({appointment_at:'2026-11-08T01:00:00Z',duration_min:30},now)).toBe('Past · review');
  expect(appointmentPhase({appointment_at:'2026-11-08T02:10:00Z',status:'completed'},now)).toBe('Completed');
});
