import {appointmentPhase,careZonedInstant,formatCareTime,medicationDayDoses,nextMedicationAt,parseCareTime} from '@/src/lib/care-time';

import {vitalStatus} from '@/src/lib/vital-status';

import {metricRecords} from '@/src/lib/monitoring-records';

import {NoticeQueue} from '@/src/lib/notice-queue';

import {prescriptionDrafts} from '@/src/lib/prescription';

import type {VitalLog} from '@/src/providers/HealthDataProvider';

const medication={id:'med',frequency:'Daily',times_of_day:['08:00','20:00'],start_date:'2026-11-08',end_date:'2026-11-10',timezone:'Asia/Manila'};

test('live BPM display bands change at 80 while alert boundary stays above 110',()=>{
  expect(vitalStatus('heart_rate_bpm',{heart_rate_bpm:50}).label).toContain('Good');
  expect(vitalStatus('heart_rate_bpm',{heart_rate_bpm:79}).label).toContain('Good');
  for(const bpm of [80,90,110]){expect(vitalStatus('heart_rate_bpm',{heart_rate_bpm:bpm}).tone).toBe('attention');expect(vitalStatus('heart_rate_bpm',{heart_rate_bpm:bpm}).label).toContain('High');}
  expect(vitalStatus('heart_rate_bpm',{heart_rate_bpm:111}).label).toContain('High');
  expect(vitalStatus('heart_rate_bpm',{heart_rate_bpm:49}).tone).toBe('attention');
  expect(vitalStatus('heart_rate_bpm',{heart_rate_bpm:null}).label).toBe('No reading');
});
