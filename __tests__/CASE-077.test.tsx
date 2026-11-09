import {appointmentPhase,careZonedInstant,formatCareTime,medicationDayDoses,nextMedicationAt,parseCareTime} from '@/src/lib/care-time';

import {vitalStatus} from '@/src/lib/vital-status';

import {metricRecords} from '@/src/lib/monitoring-records';

import {NoticeQueue} from '@/src/lib/notice-queue';

import {prescriptionDrafts} from '@/src/lib/prescription';

import type {VitalLog} from '@/src/providers/HealthDataProvider';

const medication={id:'med',frequency:'Daily',times_of_day:['08:00','20:00'],start_date:'2026-11-08',end_date:'2026-11-10',timezone:'Asia/Manila'};

test('Manila wall clocks are not interpreted as UTC; DST gaps are rejected',()=>{
  expect(careZonedInstant('2026-11-08','08:00','Asia/Manila')?.toISOString()).toBe('2026-11-08T00:00:00.000Z');
  expect(careZonedInstant('2026-03-08','02:30','America/New_York')).toBeNull();
});
