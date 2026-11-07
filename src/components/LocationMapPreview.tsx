import { StyleSheet } from 'react-native';
import { LiveLocationMap } from '@/src/components/LiveLocationMap';
export function LocationMapPreview({latitude,longitude,recordedAt,accuracy,source='fused'}:{latitude:number;longitude:number;recordedAt?:string;accuracy?:number|null;source?:'watch_gps'|'fused'|'network'}){
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
  return <LiveLocationMap compact style={StyleSheet.absoluteFillObject} position={{latitude,longitude,accuracy_m:accuracy??null,measured_at:recordedAt??'1970-01-01T00:00:00.000Z',location_source:source}} />;
}
