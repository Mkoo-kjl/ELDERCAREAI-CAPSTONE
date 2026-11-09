import {appointmentPhase,careZonedInstant,formatCareTime,medicationDayDoses,nextMedicationAt,parseCareTime} from '@/src/lib/care-time';

import {vitalStatus} from '@/src/lib/vital-status';

import {metricRecords} from '@/src/lib/monitoring-records';

import {NoticeQueue} from '@/src/lib/notice-queue';

import {prescriptionDrafts} from '@/src/lib/prescription';

import type {VitalLog} from '@/src/providers/HealthDataProvider';

const medication={id:'med',frequency:'Daily',times_of_day:['08:00','20:00'],start_date:'2026-11-08',end_date:'2026-11-10',timezone:'Asia/Manila'};

test('two simultaneous notices display one at a time, retain identities and ignore duplicates',()=>{
  jest.useFakeTimers();const shown:string[]=[],callbacks:(()=>void)[]=[];
  const queue=new NoticeQueue<{id:string}>((item,done)=>{shown.push(item.id);callbacks.push(done);});
  queue.push({id:'med-a'});queue.push({id:'med-b'});queue.push({id:'med-b'});expect(shown).toEqual(['med-a']);
  callbacks[0]();callbacks[0]();jest.advanceTimersByTime(250);expect(shown).toEqual(['med-a','med-b']);queue.stop();jest.useRealTimers();
});
