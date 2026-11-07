/** Mobile response contract. Supabase functions are excluded from EAS uploads. */
export const evidenceMetrics = {
  heart_rate_bpm:{label:'Heart rate',unit:'BPM'},spo2_percent:{label:'Blood oxygen',unit:'%'},
  hrv_rmssd_ms:{label:'HRV (RMSSD)',unit:'ms'},stress_score:{label:'Experimental stress index',unit:'/100'},
  skin_temp_celsius:{label:'Wrist skin temperature',unit:'°C'},steps_count:{label:'Monitored steps',unit:'steps'},sleep_hours:{label:'Sleep duration',unit:'hours'},
} as const;

export type EvidenceMetric=keyof typeof evidenceMetrics;
export type CareEvidence={reference:string;record_id:string;metric:EvidenceMetric;label:string;value:number;unit:string;measured_at:string;source:string;origin:string|null};
export type EvidenceSummary={scope:string;timezone:string;from:string|null;until:string|null;generated_at:string;metric:EvidenceMetric;sample_count:number;matching_count:number;threshold:number;comparison:string};
