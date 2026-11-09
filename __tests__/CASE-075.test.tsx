import {appointmentPhase,careZonedInstant,formatCareTime,medicationDayDoses,nextMedicationAt,parseCareTime} from '@/src/lib/care-time';

import {vitalStatus} from '@/src/lib/vital-status';

import {metricRecords} from '@/src/lib/monitoring-records';

import {NoticeQueue} from '@/src/lib/notice-queue';

import {prescriptionDrafts} from '@/src/lib/prescription';

import type {VitalLog} from '@/src/providers/HealthDataProvider';

const medication={id:'med',frequency:'Daily',times_of_day:['08:00','20:00'],start_date:'2026-11-08',end_date:'2026-11-10',timezone:'Asia/Manila'};

test('oxygen, sleep, steps and experimental stress have appropriate distinct statuses',()=>{
  expect(vitalStatus('spo2_percent',{spo2_percent:92}).tone).toBe('critical');
  expect(vitalStatus('spo2_percent',{spo2_percent:94}).tone).toBe('attention');
  expect(vitalStatus('sleep_hours',{sleep_hours:8}).label).toBe('Good duration');
  expect(vitalStatus('sleep_hours',{sleep_hours:6}).label).toContain('Fair');
  expect(vitalStatus('steps_count',{steps_count:0}).tone).toBe('neutral');
  expect(vitalStatus('hrv_rmssd_ms',{hrv_rmssd_ms:40}).label).toBe('Learning baseline');
  expect(vitalStatus('hrv_rmssd_ms',{hrv_rmssd_ms:20,stress_score:80}).label).toBe('Elevated estimate');
  expect(vitalStatus('skin_temp_celsius',{skin_temp_celsius:35}).label).toBe('Learning baseline');
});
