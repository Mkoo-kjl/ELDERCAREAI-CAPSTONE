import {useCallback,useEffect,useRef,useState} from 'react';
import {ScrollView,StyleSheet,View,useColorScheme} from 'react-native';
import {Redirect,Stack,useLocalSearchParams} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppText as Text} from '@/src/components/AppText';
import {FeatureButton,FeatureCard,FeatureMessage,FeatureStatus} from '@/src/components/CareFeature';
import {evidenceMetrics,type EvidenceMetric} from '@/src/lib/care-evidence';
import {validRecordId} from '@/src/lib/care-workflow';
import {supabase} from '@/src/lib/supabase';
import {useAuth} from '@/src/providers/AuthProvider';
import {useHealthData,type VitalLog} from '@/src/providers/HealthDataProvider';
import {getTheme,palette} from '@/src/theme/colors';
import {typeScale} from '@/src/theme/typography';

type SavedReading=VitalLog&{is_superseded?:boolean;created_at?:string};
export default function VitalEvidenceScreen(){
  const {id,metric}=useLocalSearchParams<{id?:string;metric?:string}>();const {session}=useAuth();const {elderly}=useHealthData();
  const theme=getTheme(useColorScheme()==='dark'),insets=useSafeAreaInsets();
  const owner=`${session?.user.id}:${elderly?.elderly_id}:${id}`;const current=useRef(owner);current.current=owner;
  const [reading,setReading]=useState<SavedReading|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{
    if(!session||!elderly||!validRecordId(id)){setLoading(false);return;}
    const identity=owner;setLoading(true);setError(null);
    try{const result=await supabase.from('vital_sign_logs').select('*').eq('id',id).eq('elderly_id',elderly.elderly_id).eq('source','galaxy_watch').maybeSingle();
      if(current.current!==identity)return;if(result.error)throw result.error;setReading(result.data as SavedReading|null);
    }catch{if(current.current===identity)setError('This source reading could not load. Check your connection and retry.');}
    finally{if(current.current===identity)setLoading(false);}
  },[session,elderly,id,owner]);
  useEffect(()=>{current.current=owner;setReading(null);void load();return()=>{current.current='';};},[load,owner]);
  if(!session)return <Redirect href="/login"/>;
  const keys=(Object.keys(evidenceMetrics) as EvidenceMetric[]).sort((a,b)=>a===metric?-1:b===metric?1:0);
  return <><Stack.Screen options={{headerShown:true,title:'Source reading',headerStyle:{backgroundColor:theme.background},headerTintColor:theme.text}}/>
    <ScrollView style={{backgroundColor:theme.background}} contentContainerStyle={[styles.content,{paddingBottom:insets.bottom+24}]}>
      {loading?<FeatureMessage loading message="Loading the original saved reading…"/>:null}
      {error?<><FeatureMessage error message={error}/><FeatureButton label="Retry reading" onPress={()=>void load()}/></>:null}
      {!loading&&!error&&!reading?<FeatureMessage message="This reading is unavailable for the signed-in patient."/>:null}
      {reading?<><FeatureCard><FeatureStatus label="Saved Galaxy Watch record"/><Text style={[typeScale.sectionTitle,{color:theme.text}]}>{elderly?.full_name}</Text><Text style={[typeScale.subhead,{color:theme.subtitle}]}>This page shows the recorded values and their original measurement times, rather than a live measurement.</Text>{reading.is_superseded?<FeatureMessage message="A newer imported revision replaced this record. Elle’s new answers exclude replaced records."/>:null}</FeatureCard>
        {keys.map(key=>{const value=reading[key as keyof VitalLog];if(typeof value!=='number'||!Number.isFinite(value))return null;const details=evidenceMetrics[key];const measured=reading.measurement_times?.[key as keyof NonNullable<VitalLog['measurement_times']>]??reading.recorded_at;
          return <FeatureCard key={key}><Text style={[typeScale.eyebrow,{color:theme.subtitle}]}>{details.label.toUpperCase()}</Text><Text style={[typeScale.screenTitle,{color:palette.primaryDark}]}>{value.toLocaleString()} <Text style={typeScale.body}>{details.unit}</Text></Text><Text style={[typeScale.subhead,{color:theme.subtitle}]}>{new Date(measured).toLocaleString()}</Text>{key==='stress_score'?<FeatureMessage message="Experimental HRV-based stress estimate, not a medical-grade stress measurement."/>:key==='skin_temp_celsius'?<FeatureMessage message="Wrist skin temperature is different from core body temperature."/>:null}</FeatureCard>;
        })}
        <FeatureCard><Text style={[typeScale.cardTitle,{color:theme.text}]}>Record details</Text><Text selectable style={[typeScale.caption,{color:theme.subtitle}]}>Record ID: {reading.id}</Text><Text style={[typeScale.subhead,{color:theme.subtitle}]}>Origin: {reading.measurement_origin??'Watch monitoring'}{reading.synced_at?`\nReceived: ${new Date(reading.synced_at).toLocaleString()}`:''}</Text><View><FeatureMessage message="Consumer wearable readings support care review. They do not establish a diagnosis or replace professional assessment."/></View></FeatureCard>
      </>:null}
    </ScrollView></>;
}
const styles=StyleSheet.create({content:{padding:16,gap:16}});
