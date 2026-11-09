import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,KeyboardAvoidingView,Linking,Modal,Platform,Pressable,ScrollView,TextInput,View,useColorScheme} from 'react-native';
import {AppText as Text} from './AppText';
import {CareImage,CareImagePicker} from './CareImage';
import {PickerModal} from './PickerModal';
import type {LocalPhoto} from './ProfilePhotoPicker';
import type {PrescriptionDraft} from '@/src/lib/prescription';
import {careFileUrl,uploadCareFile} from '@/src/lib/care-files';
import {formatCareTime,localDateKey,parseCareTime,validDateKey} from '@/src/lib/care-time';
import {medicationVitalOptions,type MedicationRecord} from '@/src/lib/medication';
import type {VitalMetric} from '@/src/lib/vital-time';
import {cancelCareNotifications,scheduleMedicationNotifications} from '@/src/lib/notifications';
import {isCarePushRegistered} from '@/src/lib/watch-push';
import {supabase} from '@/src/lib/supabase';
import {useAuth} from '@/src/providers/AuthProvider';
import {useHealthData} from '@/src/providers/HealthDataProvider';
import {getTheme,palette} from '@/src/theme/colors';

const frequencies=['Daily','Twice daily','Weekly','Custom','As needed'];
export function MedicationEditor({visible,item,draft,prescriptionPath,onClose,onSaved}:{visible:boolean;item:MedicationRecord|null;draft?:PrescriptionDraft|null;prescriptionPath?:string|null;onClose:()=>void;onSaved:()=>void}){
  const theme=getTheme(useColorScheme()==='dark');const {session}=useAuth();const {elderly}=useHealthData();
  const [name,setName]=useState(''),[dosage,setDosage]=useState(''),[frequency,setFrequency]=useState('Daily'),[instructions,setInstructions]=useState(''),[prescriber,setPrescriber]=useState('');
  const [times,setTimes]=useState<string[]>(['08:00']),[start,setStart]=useState(''),[end,setEnd]=useState(''),[photo,setPhoto]=useState<LocalPhoto|null>(null),[related,setRelated]=useState<VitalMetric[]>([]),[confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[timeIndex,setTimeIndex]=useState<number|null>(null),[dateField,setDateField]=useState<'start'|'end'|null>(null);
  const saving=useRef(false);const owner=useRef('');owner.current=`${session?.user.id}:${elderly?.elderly_id}`;
  useEffect(()=>{if(!visible)return;setName(draft?.medication_name??item?.medication_name??'');setDosage(draft?.dosage??item?.dosage??'');
    const raw=draft?.frequency??item?.frequency??'Daily';setFrequency(frequencies.find(value=>value.toLowerCase()===raw.toLowerCase())??'Custom');
    setInstructions(draft?.instructions??item?.instructions??'');setPrescriber(draft?.prescribed_by??item?.prescribed_by??'');setTimes(draft?draft.times_of_day:(item?.times_of_day??['08:00']));setStart(draft?.start_date??item?.start_date??localDateKey());setEnd(draft?.end_date??item?.end_date??'');setPhoto(null);setRelated(item?.related_vitals??[]);setConfirmed(false);setError('');setTimeIndex(null);setDateField(null);
  },[visible,item,draft]);
  const sourcePath=prescriptionPath??item?.prescription_path;
  const save=async()=>{
    if(saving.current||!session||!elderly)return;
    const normalized=times.map(value=>parseCareTime(value)?.canonical);
    if(!name.trim()){setError('Enter the medication name exactly as prescribed.');return;}
    if(frequency!=='As needed'&&(!times.length||normalized.some(value=>!value)||new Set(normalized).size!==normalized.length)){setError('Add valid, distinct schedule times.');return;}
    if(frequency==='Twice daily'&&times.length!==2){setError('Choose both prescribed times for twice-daily medication.');return;}
    if(!validDateKey(start)||(end&&!validDateKey(end))||(end&&end<start)){setError('Choose valid start and end dates; end must be on or after start.');return;}
    if(draft&&!confirmed){setError('Compare the draft with the original prescription and confirm it before saving.');return;}
    saving.current=true;setBusy(true);setError('');const atStart=owner.current;
    let uploaded:string|null=null;
    try{
      uploaded=photo?await uploadCareFile(session.user.id,elderly.elderly_id,'medication',photo):null;
      if(owner.current!==atStart)throw Error('The selected account or patient changed. Reopen this form.');
      const payload={elderly_id:elderly.elderly_id,caregiver_id:session.user.id,medication_name:name.trim(),dosage:dosage.trim()||null,frequency,
        times_of_day:frequency==='As needed'?[]:(normalized as string[]).sort(),start_date:start,end_date:end||null,instructions:instructions.trim()||null,prescribed_by:prescriber.trim()||null,
        timezone:item?.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone??'Asia/Manila',reminder_enabled:frequency!=='As needed',is_active:true,color_tag:item?.color_tag??palette.primary,
        image_path:uploaded??item?.image_path??null,prescription_path:sourcePath??null,prescription_reviewed_at:draft?new Date().toISOString():item?.prescription_reviewed_at??null,related_vitals:related,updated_at:new Date().toISOString()};
      const result=item?await supabase.from('medication_schedules').update(payload).eq('id',item.id).eq('caregiver_id',session.user.id).eq('elderly_id',elderly.elderly_id).select('id').single():await supabase.from('medication_schedules').insert(payload).select('id').single();
      if(result.error)throw result.error;
      try{if(await isCarePushRegistered())await cancelCareNotifications('medication',result.data.id);else if(!await scheduleMedicationNotifications({caregiverId:session.user.id,elderlyId:elderly.elderly_id,id:result.data.id,medicationName:payload.medication_name,dosage:payload.dosage,frequency,timesOfDay:payload.times_of_day,elderlyName:elderly.full_name,startDate:start,timezone:payload.timezone,endDate:end,reminderEnabled:payload.reminder_enabled}))Alert.alert('Saved — reminder setup needs attention','Enable notifications in Alerts to receive reminders.');}catch{Alert.alert('Saved — reminder setup needs attention','Reminder registration needs attention. Open Alerts and enable background notifications.');}
      if(owner.current===atStart)onSaved();
    }catch(error){setError(error instanceof Error?error.message:'Medication could not be saved. Your draft is retained.');}
    finally{saving.current=false;setBusy(false);}
  };
  const input=(label:string,value:string,change:(value:string)=>void,multiline=false)=><View style={{gap:7,marginBottom:15}}><Text style={{color:theme.subtitle}}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} multiline={multiline} style={{borderWidth:1,borderColor:theme.border,borderRadius:12,padding:13,color:theme.text,backgroundColor:theme.card,minHeight:multiline?78:48}}/></View>;
  const time=new Date();const parsed=parseCareTime(times[timeIndex??0]);time.setHours(parsed?.hour??8,parsed?.minute??0,0,0);
  const close=()=>{if(busy)return;if(draft)Alert.alert('Discard this prescription draft?','This draft has not been saved. Other medications must also be reviewed individually.',[{text:'Keep editing',style:'cancel'},{text:'Discard draft',style:'destructive',onPress:onClose}]);else onClose();};
  return <Modal visible={visible} animationType="slide" onRequestClose={close}><KeyboardAvoidingView style={{flex:1,backgroundColor:theme.background}} behavior={Platform.OS==='ios'?'padding':'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:22,paddingTop:50,paddingBottom:50,maxWidth:760,width:'100%',alignSelf:'center'}}>
    <Text style={{color:theme.text,fontSize:25,marginBottom:18}}>{draft?'Review prescription draft':item?'Edit Medication':'Add Medication'}</Text>
    {draft?<View style={{gap:10,padding:14,backgroundColor:theme.card,borderRadius:14,marginBottom:18}}><Text style={{color:palette.warning}}>AI draft · not verified medical instructions</Text><CareImage path={sourcePath} size={260}/><Pressable onPress={()=>void (session&&sourcePath?careFileUrl(sourcePath,session.user.id).then(url=>Linking.openURL(url)).catch(()=>Alert.alert('Image unavailable','Try again.')):Promise.resolve())} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:palette.primaryDark}}>Open original prescription at full size</Text></Pressable><Text style={{color:theme.text}}>{draft.original_text||'No reliable text excerpt extracted.'}</Text><Text style={{color:theme.subtitle}}>Written frequency: {draft.frequency||'Not readable — confirm manually'}</Text>{draft.uncertainties.map((value,index)=><Text key={index} style={{color:palette.warning}}>Review: {value}</Text>)}</View>:null}
    {input('Medication name',name,setName)}{input('Dosage',dosage,setDosage)}<CareImagePicker value={photo} path={item?.image_path} onChange={setPhoto}/>
    <Text style={{color:theme.subtitle,marginBottom:8}}>Frequency</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:18}}>{frequencies.map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{selected:frequency===value}} onPress={()=>setFrequency(value)} style={{padding:12,borderRadius:12,backgroundColor:value===frequency?palette.aquaSurface:theme.card}}><Text style={{color:value===frequency?palette.primaryDark:theme.text}}>{value}</Text></Pressable>)}</View>
    {frequency!=='As needed'?<><Text style={{color:theme.subtitle}}>Prescribed reminder times · {item?.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone}</Text>{times.map((clock,index)=><View key={index} style={{flexDirection:'row',gap:12,alignItems:'center'}}><Pressable accessibilityLabel={index===0?"Choose medication reminder time":`Choose dose time ${index+1}`} onPress={()=>setTimeIndex(index)} style={{padding:14,minHeight:48}}><Text style={{color:palette.primaryDark}}>{formatCareTime(clock)}</Text></Pressable><Pressable accessibilityLabel={`Remove dose time ${index+1}`} onPress={()=>setTimes(values=>values.filter((_,i)=>i!==index))} style={{padding:12}}><Text style={{color:palette.error}}>Remove</Text></Pressable></View>)}<Pressable onPress={()=>{if(times.length<12)setTimes([...times,'08:00']);}} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:palette.primaryDark}}>+ Add prescribed time</Text></Pressable></>:<Text style={{color:theme.subtitle,marginBottom:16}}>As-needed medication has no scheduled reminder.</Text>}
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,marginVertical:16}}><Pressable onPress={()=>setDateField('start')} style={{padding:12,backgroundColor:theme.card,borderRadius:12}}><Text style={{color:theme.text}}>Start: {start||'Choose date'}</Text></Pressable><Pressable onPress={()=>setDateField('end')} style={{padding:12,backgroundColor:theme.card,borderRadius:12}}><Text style={{color:theme.text}}>End: {end||'Not specified'}</Text></Pressable>{end?<Pressable onPress={()=>setEnd('')} style={{padding:12}}><Text style={{color:palette.primaryDark}}>Clear end</Text></Pressable>:null}</View>
    {input('Administration instructions',instructions,setInstructions,true)}{input('Prescribing doctor',prescriber,setPrescriber)}
    <Text style={{color:theme.text}}>Related vital cards · optional</Text><Text style={{color:theme.subtitle,marginTop:6}}>Link only an existing prescription to its care-plan purpose. A threshold alert never recommends taking or changing a dose.</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:12}}>{medicationVitalOptions.map(([key,label])=><Pressable key={key} accessibilityRole="checkbox" accessibilityState={{checked:related.includes(key)}} onPress={()=>setRelated(values=>values.includes(key)?values.filter(x=>x!==key):[...values,key])} style={{padding:12,borderRadius:12,backgroundColor:related.includes(key)?palette.aquaSurface:theme.card}}><Text style={{color:related.includes(key)?palette.primaryDark:theme.text}}>{related.includes(key)?'✓ ':''}{label}</Text></Pressable>)}</View>
    {draft?<Pressable accessibilityRole="checkbox" accessibilityState={{checked:confirmed}} onPress={()=>setConfirmed(!confirmed)} style={{padding:15,backgroundColor:theme.card,borderRadius:12,marginVertical:15}}><Text style={{color:theme.text}}>{confirmed?'☑':'☐'} I compared every field with the original prescription and confirm this schedule. AI has not prescribed or changed the dose.</Text></Pressable>:null}
    {error?<Text accessibilityRole="alert" style={{color:palette.error,marginVertical:15}}>{error}</Text>:null}
    <Pressable disabled={busy||(!!draft&&!confirmed)} onPress={()=>void save()} style={{padding:17,borderRadius:14,backgroundColor:palette.primaryDark,opacity:busy||(draft&&!confirmed)?0.5:1}}>{busy?<ActivityIndicator color="white"/>:<Text style={{color:'white',textAlign:'center'}}>{draft?'Confirm and save medication':'Save'}</Text>}</Pressable><Pressable disabled={busy} onPress={close} style={{padding:17,minHeight:48}}><Text style={{color:theme.subtitle,textAlign:'center'}}>Cancel</Text></Pressable>
  </ScrollView></KeyboardAvoidingView>
    <PickerModal visible={timeIndex!==null} mode="time" title="Prescribed medication time" value={time} onChange={date=>{if(timeIndex!==null)setTimes(values=>values.map((value,index)=>index===timeIndex?`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`:value));}} onClose={()=>setTimeIndex(null)}/>
    <PickerModal visible={dateField!==null} mode="date" title={`${dateField==='end'?'End':'Start'} date`} value={new Date(`${(dateField==='end'?end:start)||localDateKey()}T12:00:00`)} onChange={date=>dateField==='end'?setEnd(localDateKey(date)):setStart(localDateKey(date))} onClose={()=>setDateField(null)}/>
  </Modal>;
}
