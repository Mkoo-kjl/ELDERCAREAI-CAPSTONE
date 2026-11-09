import {appointmentPhase,careZonedInstant,formatCareTime,medicationDayDoses,nextMedicationAt,parseCareTime} from '@/src/lib/care-time';

import {vitalStatus} from '@/src/lib/vital-status';

import {metricRecords} from '@/src/lib/monitoring-records';

import {NoticeQueue} from '@/src/lib/notice-queue';

import {prescriptionDrafts} from '@/src/lib/prescription';

import type {VitalLog} from '@/src/providers/HealthDataProvider';

const medication={id:'med',frequency:'Daily',times_of_day:['08:00','20:00'],start_date:'2026-11-08',end_date:'2026-11-10',timezone:'Asia/Manila'};

test.each([['00:00','12:00 AM'],['12:00','12:00 PM'],['17:05:00','5:05 PM'],['1:09','1:09 AM'],['23:59','11:59 PM']])('database clock %s displays as %s',(clock,expected)=>expect(formatCareTime(clock)).toBe(expected));

test.each(['24:00','12:70','-1:00','noon','2026-11-08T10:00:00Z'])('invalid wall clock %s is rejected',clock=>expect(parseCareTime(clock)).toBeNull());
