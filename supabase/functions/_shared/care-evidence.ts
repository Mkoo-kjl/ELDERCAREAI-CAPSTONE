/** References are built from authorized database rows, never from model-provided IDs. */
export const evidenceMetrics = {
  heart_rate_bpm:{label:'Heart rate',unit:'BPM'},spo2_percent:{label:'Blood oxygen',unit:'%'},
  hrv_rmssd_ms:{label:'HRV (RMSSD)',unit:'ms'},stress_score:{label:'Experimental stress index',unit:'/100'},
  skin_temp_celsius:{label:'Wrist skin temperature',unit:'°C'},steps_count:{label:'Monitored steps',unit:'steps'},sleep_hours:{label:'Sleep duration',unit:'hours'},
} as const;
export type EvidenceMetric=keyof typeof evidenceMetrics;
export type CareEvidence={reference:string;record_id:string;metric:EvidenceMetric;label:string;value:number;unit:string;measured_at:string;source:string;origin:string|null};
export type EvidenceSummary={scope:string;timezone:string;from:string|null;until:string|null;generated_at:string;metric:EvidenceMetric;sample_count:number;matching_count:number;threshold:number;comparison:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function buildEvidence(rows:Record<string,any>[],metrics:EvidenceMetric[]=Object.keys(evidenceMetrics) as EvidenceMetric[],limit=18):CareEvidence[]{
  const result:CareEvidence[]=[],seen=new Set<string>();
  const ordered=rows.slice().sort((a,b)=>Date.parse(b.recorded_at)-Date.parse(a.recorded_at));
  // Round-robin metrics prevents frequently updated heart rate from hiding sleep/oxygen evidence.
  for(let index=0;index<ordered.length&&result.length<limit;index++)for(const metric of metrics){
    const matches=ordered.filter(row=>typeof row[metric]==='number'&&Number.isFinite(row[metric]));
    const row=matches[index];if(!row||!uuid.test(row.id??'')||row.source!=='galaxy_watch'||row.is_superseded===true)continue;
    const measured=row.measurement_times?.[metric]??row.recorded_at;
    if(typeof measured!=='string'||!Number.isFinite(Date.parse(measured)))continue;
    const key=`${metric}:${measured}`;if(seen.has(key))continue;seen.add(key);
    result.push({reference:`V${result.length+1}`,record_id:row.id,metric,...evidenceMetrics[metric],value:row[metric],measured_at:measured,source:row.source,origin:typeof row.measurement_origin==='string'?row.measurement_origin:null});
    if(result.length>=limit)break;
  }
  return result;
}
export function citedEvidence(reply:string,pool:CareEvidence[]){
  const allowed=new Map(pool.map(item=>[item.reference,item]));const cited=new Set<string>();
  const content=reply.replace(/\[V(\d+)\]/g,(token,number:string)=>{const ref=`V${number}`;if(!allowed.has(ref))return '';cited.add(ref);return token;});
  return {reply:content.trim(),evidence:pool.filter(item=>cited.has(item.reference))};
}
export function stripEvidenceReferences(content:string){return content.replace(/\[V\d+\]/g,'');}
