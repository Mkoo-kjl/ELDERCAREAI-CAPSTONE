import {useWalkthroughAnchor} from '@/src/providers/WalkthroughProvider';
import {useEffect,useRef,useState} from 'react';
import {router} from 'expo-router';
import {ActivityIndicator,Modal,Pressable,ScrollView,TextInput,View,useColorScheme} from 'react-native';
import {AppText as Text} from './AppText';
import {useAuth} from '@/src/providers/AuthProvider';
import {useHealthData} from '@/src/providers/HealthDataProvider';
import {supabase} from '@/src/lib/supabase';
import {DEFAULT_PATIENT_THRESHOLDS,patientThresholds,thresholdFields,thresholdDraftError,type ThresholdKey,type PatientThresholds} from '@/src/lib/vital-thresholds';
import {getTheme,palette} from '@/src/theme/colors';
const toDraft=(value:PatientThresholds)=>Object.fromEntries(Object.entries(value).map(([key,n])=>[key,n===null?'':String(n)])) as Record<ThresholdKey,string>;
export function VitalThresholdSettings(){
  const {session}=useAuth(),{elderly,refresh,loading,error:profileError}=useHealthData(),theme=getTheme(useColorScheme()==='dark');
  const [open,setOpen]=useState(false),[draft,setDraft]=useState(toDraft(DEFAULT_PATIENT_THRESHOLDS)),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const thresholdAnchor=useWalkthroughAnchor('settings-thresholds');
  const formPatient=useRef<string|null>(null);
  useEffect(()=>{if(!open){formPatient.current=null;return;}if(elderly&&formPatient.current!==elderly.elderly_id){setDraft(toDraft(patientThresholds(elderly.vital_thresholds)));formPatient.current=elderly.elderly_id;}},[open,elderly]);
  const save=async()=>{
    if(busy||!session||!elderly)return;const invalid=thresholdDraftError(draft);if(invalid){setError(invalid);return;}
    setBusy(true);setError('');
    try{const values=Object.fromEntries(Object.entries(draft).map(([key,text])=>[key,text.trim()?Number(text):null]));
      const result=await supabase.from('elderly_profiles').update({vital_thresholds:values,updated_at:new Date().toISOString()}).eq('elderly_id',elderly.elderly_id).eq('caregiver_id',session.user.id).select('elderly_id').single();
      if(result.error)throw result.error;await refresh(false);setOpen(false);
    }catch{setError('Thresholds could not save. Your changes are retained; check your connection and retry.');}finally{setBusy(false);}
  };
  return <><Pressable ref={thresholdAnchor} collapsable={false} accessibilityRole="button" onPress={()=>{setError('');setOpen(true);}} style={{padding:16,borderRadius:13,backgroundColor:theme.cardElevated,minHeight:50}}><Text style={{color:theme.text}}>Health alert thresholds</Text><Text style={{color:theme.subtitle,marginTop:6}}>Personal settings for {elderly?.full_name?.trim()||'your patient'}</Text></Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={()=>{if(!busy)setOpen(false);}}>{!elderly?<ScrollView contentContainerStyle={{padding:24,paddingTop:55,gap:18,flexGrow:1,backgroundColor:theme.background}}><Text style={{fontSize:25,color:theme.text}}>Health alert thresholds</Text><Text accessibilityRole="alert" style={{color:theme.subtitle}}>{loading?'Loading your patient profile…':profileError||'Your patient profile is not available yet. Retry loading it or finish the older adult information in Settings.'}</Text>{loading?<ActivityIndicator color={palette.primaryDark}/>:<Pressable accessibilityRole="button" onPress={()=>void refresh(false)} style={{padding:16,minHeight:48,backgroundColor:palette.aquaSurface,borderRadius:12}}><Text style={{color:palette.primaryDark}}>Retry patient profile</Text></Pressable>}<Pressable accessibilityRole="button" onPress={()=>{setOpen(false);router.push('/setup/elderly?mode=edit');}} style={{padding:16,minHeight:48}}><Text style={{color:palette.primaryDark}}>Open older adult information</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>setOpen(false)} style={{padding:16,minHeight:48}}><Text style={{color:theme.subtitle}}>Close</Text></Pressable></ScrollView>:<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:24,paddingTop:55,paddingBottom:55,gap:16,backgroundColor:theme.background,flexGrow:1,maxWidth:760,width:'100%',alignSelf:'center'}}><Text style={{fontSize:25,color:theme.text}}>Health alert thresholds</Text><Text style={{color:theme.subtitle,lineHeight:22}}>These readings and settings apply only to {elderly.full_name?.trim()||'your patient'} under your caregiver account. Start with the app defaults and use the patient’s clinician-agreed targets. These are review alerts, not a diagnosis. Changes apply to new measurements; saved alerts stay in history.</Text>
      {thresholdFields.map(([key,label])=><View key={key} style={{gap:7}}><Text style={{color:theme.text}}>{label}</Text><TextInput editable={!busy} accessibilityLabel={label} keyboardType="decimal-pad" value={draft[key]} onChangeText={text=>setDraft(current=>({...current,[key]:text}))} placeholder="Off" placeholderTextColor={theme.subtitle} style={{color:theme.text,padding:14,borderWidth:1,borderColor:theme.border,borderRadius:12}}/></View>)}
      <Text style={{color:theme.subtitle,lineHeight:21}}>Leave optional fields blank to disable them. Stress is experimental. A steps alert checks an upper activity limit during monitoring; it cannot establish inactivity. Wrist temperature uses a recent same-watch baseline, not a fever reading.</Text>
      {error?<Text accessibilityRole="alert" style={{color:palette.error}}>{error}</Text>:null}<Pressable disabled={busy} onPress={()=>void save()} style={{padding:17,borderRadius:13,backgroundColor:palette.primaryDark}}>{busy?<ActivityIndicator color="white"/>:<Text style={{color:'white',textAlign:'center'}}>Save patient thresholds</Text>}</Pressable><Pressable disabled={busy} onPress={()=>setDraft(toDraft(DEFAULT_PATIENT_THRESHOLDS))} style={{padding:14}}><Text style={{color:palette.primaryDark}}>Restore app defaults in this form</Text></Pressable><Pressable disabled={busy} onPress={()=>setOpen(false)} style={{padding:14}}><Text style={{color:theme.subtitle}}>Cancel</Text></Pressable>
    </ScrollView>}</Modal></>;
}
