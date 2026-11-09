import {useEffect,useState} from 'react';
import {Pressable,View} from 'react-native';
import {router} from 'expo-router';
import {AppText as Text} from './AppText';
import {useAuth} from '@/src/providers/AuthProvider';
import {useHealthData} from '@/src/providers/HealthDataProvider';
import {supabase} from '@/src/lib/supabase';
import {vitalForRule} from '@/src/lib/medication';
import {palette} from '@/src/theme/colors';
export function RelatedMedications({rule}:{rule?:string}){
  const {session}=useAuth();const {elderly}=useHealthData();const metric=vitalForRule(rule);const userId=session?.user.id,patientId=elderly?.elderly_id;const [count,setCount]=useState(0);
  useEffect(()=>{let active=true;setCount(0);if(metric&&userId&&patientId)void supabase.from('medication_schedules').select('id').eq('caregiver_id',userId).eq('elderly_id',patientId).eq('is_active',true).contains('related_vitals',[metric]).then(({data,error})=>{if(active&&!error)setCount(data?.length??0);});return()=>{active=false;};},[metric,userId,patientId]);
  return count&&metric?<View style={{marginTop:10,gap:6}}><Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/care',params:{tab:'Medications',metric}})} style={{padding:13,minHeight:44,borderRadius:10,backgroundColor:palette.aquaSurface}}><Text style={{color:palette.primaryDark}}>View linked medications ({count})</Text></Pressable><Text style={{color:palette.subtitle,fontSize:12}}>Existing prescriptions linked by the caregiver. An alert is not an instruction to take an extra dose.</Text></View>:null;
}
