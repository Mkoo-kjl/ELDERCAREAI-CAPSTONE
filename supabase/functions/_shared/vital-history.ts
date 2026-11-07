export type HistoryMetric='heart_rate_bpm'|'spo2_percent'|'hrv_rmssd_ms'|'skin_temp_celsius'|'steps_count'|'sleep_hours'|'stress_score';
export type HistoryQuery={metric:HistoryMetric|null;threshold:number|null;comparison:'gte'|'gt'|'lte'|'lt'|'eq';range:string;start:string|null;end:string|null;factual:boolean};
const metricPatterns:[HistoryMetric,RegExp][]=[
  ['hrv_rmssd_ms',/\bhrv\b|heart rate variability|\brmssd\b/i],['heart_rate_bpm',/\bbpm\b|\bbm\b|heart\s*rate|heartbeats?|pulse/i],
  ['spo2_percent',/spo[₂2]|blood oxygen|oxygen saturation/i],['skin_temp_celsius',/skin\s*temp|wrist\s*temp|temperature/i],
  ['steps_count',/\bsteps?\b/i],['sleep_hours',/\bsleep\b|slept/i],['stress_score',/stress\s*(?:score|level|index|estimate)?/i],
];
export function parseVitalHistoryQuery(message:string):HistoryQuery{
  const text=message.toLowerCase();
  const candidates=metricPatterns.filter(([metric,pattern])=>pattern.test(metric==='heart_rate_bpm'?text.replace(/heart rate variability/g,''):text));
  const metric=candidates.length===1?candidates[0][0]:null;
  let range='all',start:string|null=null,end:string|null=null;
  const dates=text.match(/\b\d{4}-\d{2}-\d{2}\b/g)?.filter(date=>{const parsed=new Date(date+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;})??[];
  if(dates.length){range='dates';start=dates[0];end=dates[1]??dates[0];}
  else if(/yesterday|kahapon/.test(text))range='yesterday';
  else if(/today|ngayon/.test(text))range='today';
  else if(/(?:last|past)\s+(?:7|seven)\s+days/.test(text))range='last_7_days';
  else if(/(?:last|past)\s+(?:30|thirty)\s+days/.test(text))range='last_30_days';
  else if(/last week/.test(text))range='last_week';else if(/this week/.test(text))range='this_week';
  else if(/last month/.test(text))range='last_month';else if(/this month/.test(text))range='this_month';
  const numbers=text.replace(/\d{4}-\d{2}-\d{2}/g,'').replace(/(?:last|past)\s+\d+\s+days/g,'').replace(/spo2/g,'oxygen').match(/\b\d+(?:\.\d+)?\b/g)??[];
  const threshold=numbers.length===1?Number(numbers[0]):null;
  let comparison:HistoryQuery['comparison']='gte';
  if(/at most|at or below|or (?:less|lower)|<=/.test(text))comparison='lte';
  else if(/at least|at or above|or (?:more|higher)|and above|>=|\d+\s*(?:bpm\s*)?above/.test(text))comparison='gte';
  else if(/below|under|less than|lower than|</.test(text))comparison='lt';
  else if(/above|over|more than|higher than|exceed|>/.test(text))comparison='gt';
  else if(/exactly|equal to/.test(text))comparison='eq';
  const timeRemainder=text.replace(/(?:last|past)\s+(?:7|seven|30|thirty)\s+days/g,'');
  const unresolvedTime=/\b(?:since|before|after|ago|morning|afternoon|evening|night|tonight|hours?|minutes?|seconds?)\b|(?:last|past|previous|next)\s+\S+\s+(?:days?|weeks?|months?)\b|\bon (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\b(?:january|february|march|april|june|july|august|september|october|november|december)\b|\bon may\b/.test(timeRemainder.replace(/sleep\s+(?:duration\s+)?(?:of\s+)?\d+(?:\.\d+)?\s*hours?/g,''));
  const factual=Boolean(metric&&threshold!==null&&!unresolvedTime&&/\bdid\b|\bhas\b|\bhave\b|ever|reach|hit|\bwas\b|\bwere\b|how many/.test(text)&&!/(should|what if|danger|safe|normal|diagnos|treat|medicine|medication)/.test(text));
  return{metric,threshold,comparison,range,start,end,factual};
}
const labels:Record<HistoryMetric,[string,string]>={heart_rate_bpm:['heart rate','BPM'],spo2_percent:['blood oxygen','%'],hrv_rmssd_ms:['HRV','ms'],skin_temp_celsius:['skin temperature','°C'],steps_count:['steps','steps'],sleep_hours:['sleep duration','hours'],stress_score:['experimental stress index','/100']};
export function factualVitalHistoryAnswer(query:HistoryQuery,history:Record<string,any>):string|null{
  if(!query.factual||!query.metric||query.threshold===null||!history.threshold)return null;
  const result=history.threshold,metric=history.metrics?.[query.metric];
  if(result.metric!==query.metric||result.value!==query.threshold||result.comparison!==query.comparison||!metric)return null;
  const [label,unit]=labels[query.metric];
  const comparison={gte:'at or above',gt:'above',lte:'at or below',lt:'below',eq:'equal to'}[query.comparison];
  const period=history.scope==='all'?'across all saved Galaxy Watch history':history.scope==='dates'?`for ${query.start}${query.end!==query.start?` through ${query.end}`:''}`:`for ${String(history.scope).replaceAll('_',' ')}`;
  if(metric.count===0)return `No recorded ${label} measurements are available ${period}. Missing data cannot establish whether the patient reached ${query.threshold} ${unit}.`;
  if(result.count===0)return `There are no saved ${label} measurements ${comparison} ${query.threshold} ${unit} ${period}. This covers recorded data only; monitoring gaps may have missed readings.`;
  const stamp=new Intl.DateTimeFormat('en-US',{timeZone:history.timezone,year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date(result.first_at));
  const extra=query.comparison==='gte'||query.comparison==='gt'?` The highest recorded value was ${metric.max} ${unit}.`:query.comparison==='lt'||query.comparison==='lte'?` The lowest recorded value was ${metric.min} ${unit}.`:'';
  return `Yes. The patient has ${result.count.toLocaleString()} recorded ${label} measurements ${comparison} ${query.threshold} ${unit} ${period}; the first matching record was ${stamp} (${history.timezone}).${extra} These are individual samples, not a count of separate episodes.${query.metric==='stress_score'?' The stress index is experimental and not medical grade.':''}`;
}
