import {requireOptionalNativeModule} from 'expo';
export type SamsungHealthSource={id:string;name:string;model:string;manufacturer:string};
export type ImportedHealthSample={metric:'sleep_hours'|'spo2_percent';value:number;measured_at:string;source_record_key:string;source_group_key:string;source_revision_at:string;session_start_at?:string;session_end_at?:string;minutes_asleep?:number;minutes_in_sleep_period?:number};
type SamsungHealthNative={getAccess?():Promise<{sleep:boolean;oxygen:boolean}>;requestAccess():Promise<{sleep:boolean;oxygen:boolean}>;sources():Promise<SamsungHealthSource[]>;
  readPage(kind:'sleep'|'oxygen',sourceId:string,from:string,until:string,cursor:string|null):Promise<{records:ImportedHealthSample[];cursor:string|null}>};
export default requireOptionalNativeModule<SamsungHealthNative>('SamsungHealth');
