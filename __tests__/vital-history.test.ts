import {parseVitalHistoryQuery,factualVitalHistoryAnswer} from '../supabase/functions/_shared/vital-history';
test('threshold questions recognize inclusive 100 BPM and supported date ranges',()=>{
  expect(parseVitalHistoryQuery('Did my patient reach BPM of 100 and above today?')).toMatchObject({metric:'heart_rate_bpm',threshold:100,comparison:'gte',range:'today',factual:true});
  expect(parseVitalHistoryQuery('Did blood oxygen fall below 95 yesterday?')).toMatchObject({metric:'spo2_percent',threshold:95,comparison:'lt',range:'yesterday'});
  expect(parseVitalHistoryQuery('How many heart rate readings were above 100 from 2026-11-01 to 2026-11-02?')).toMatchObject({start:'2026-11-01',end:'2026-11-02',range:'dates',comparison:'gt'});
  expect(parseVitalHistoryQuery('What should I do if heart rate is above 100?').factual).toBe(false);
  expect(parseVitalHistoryQuery('Did heart rate exceed 100 in the past two days?').factual).toBe(false);
  expect(parseVitalHistoryQuery('Did heart rate exceed 100 this morning?').factual).toBe(false);
});
test('verified history reports older peaks and distinguishes no records from no matches',()=>{
  const query=parseVitalHistoryQuery('Did the patient ever reach 100 BPM and above?');
  const history={scope:'all',timezone:'Asia/Manila',metrics:{heart_rate_bpm:{count:200,max:119,min:70,latest:{value:80}}},threshold:{metric:'heart_rate_bpm',value:100,comparison:'gte',count:26,first_at:'2026-11-02T08:09:44Z'}};
  expect(factualVitalHistoryAnswer(query,history)).toContain('119 BPM');
  expect(factualVitalHistoryAnswer(query,history)).toContain('26 recorded');
  expect(factualVitalHistoryAnswer(query,{...history,threshold:{...history.threshold,count:0}})).toContain('monitoring gaps');
  expect(factualVitalHistoryAnswer(query,{...history,metrics:{heart_rate_bpm:{count:0}}})).toContain('No recorded');
});
