import {appointmentPhase,careZonedInstant,formatCareTime,medicationDayDoses,nextMedicationAt,parseCareTime} from '@/src/lib/care-time';

import {vitalStatus} from '@/src/lib/vital-status';

import {metricRecords} from '@/src/lib/monitoring-records';

import {NoticeQueue} from '@/src/lib/notice-queue';

import {prescriptionDrafts} from '@/src/lib/prescription';

import type {VitalLog} from '@/src/providers/HealthDataProvider';

const medication={id:'med',frequency:'Daily',times_of_day:['08:00','20:00'],start_date:'2026-11-08',end_date:'2026-11-10',timezone:'Asia/Manila'};

test('prescription normalization leaves missing medical fields empty rather than inventing instructions',()=>{
  const [draft]=prescriptionDrafts({medications:[{medication_name:'Prescription text',dosage:null,frequency:'Twice daily'}]});
  expect(draft.dosage).toBe('');expect(draft.times_of_day).toEqual([]);expect(draft.start_date).toBe('');expect(draft.prescribed_by).toBe('');
  expect(()=>prescriptionDrafts({})).toThrow();
});
