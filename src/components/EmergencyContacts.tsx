import {useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Linking,Modal,Pressable,ScrollView,TextInput,View,useColorScheme} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {AppText as Text} from './AppText';
import {useAuth} from '@/src/providers/AuthProvider';
import {useHealthData} from '@/src/providers/HealthDataProvider';
import {supabase} from '@/src/lib/supabase';
import {getTheme,palette} from '@/src/theme/colors';
export type EmergencyContact={role:'caregiver'|'family'|'doctor';name:string;relationship:string;phone:string};
const roles=[['caregiver','Caregiver'],['family','Family member'],['doctor','Doctor']] as const;
export function orderedEmergencyContacts(value:unknown):EmergencyContact[]{
  const rows=Array.isArray(value)?value:[];
  return roles.map(([role,label])=>{const row=rows.find(row=>row&&row.role===role);return {role,name:typeof row?.name==='string'?row.name:'',relationship:typeof row?.relationship==='string'?row.relationship:label,phone:typeof row?.phone==='string'?row.phone:''};});
}
export function EmergencyContacts({editable=false,openRequest=0}:{editable?:boolean;openRequest?:number}){
  const [open,setOpen]=useState(false),[contacts,setContacts]=useState<EmergencyContact[]>(orderedEmergencyContacts(null)),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const {session}=useAuth();const {elderly,refresh}=useHealthData();const theme=getTheme(useColorScheme()==='dark');
  const userId=session?.user.id,patientId=elderly?.elderly_id,savedContacts=JSON.stringify(elderly?.emergency_contacts??[]),familyName=elderly?.emergency_contact??'',familyPhone=elderly?.emergency_contact_phone??'';
  useEffect(()=>{if(openRequest>0)setOpen(true);},[openRequest]);
  useEffect(()=>{if(!open||!userId||!patientId)return;let active=true;setBusy(true);setError('');
    setContacts(orderedEmergencyContacts(JSON.parse(savedContacts)).map(row=>row.role==='family'&&!row.name&&!row.phone?{...row,name:familyName,phone:familyPhone}:row));
    void Promise.all([supabase.from('caregivers').select('full_name,phone').eq('id',userId).maybeSingle(),supabase.from('doctor_contacts').select('full_name,phone').eq('caregiver_id',userId).eq('elderly_id',patientId).maybeSingle()]).then(([caregiver,doctor])=>{if(!active)return;const rows=orderedEmergencyContacts(JSON.parse(savedContacts));setContacts(rows.map(row=>row.phone||row.name?row:row.role==='caregiver'?{...row,name:caregiver.data?.full_name??'',phone:caregiver.data?.phone??''}:row.role==='doctor'?{...row,name:doctor.data?.full_name??'',phone:doctor.data?.phone??''}:{...row,name:familyName,phone:familyPhone}));if(caregiver.error||doctor.error)setError('Some fallback contacts could not load. Saved priority contacts remain available.');}).catch(()=>{if(active)setError('Contact details could not refresh. Try again.');}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};
  },[open,userId,patientId,savedContacts,familyName,familyPhone]);
  const save=async()=>{
    if(!elderly||!session||busy)return;
    if(contacts.some(row=>(row.name||row.phone)&&(!row.name.trim()||!/^\+?[\d ()-]{7,25}$/.test(row.phone)||row.phone.replace(/\D/g,'').length<7))){setError('For each contact, enter a name and valid phone number, or leave both fields blank.');return;}
    setBusy(true);setError('');const family=contacts[1];
    try{
    const normalized=contacts.map(row=>({...row,name:row.name.trim(),relationship:row.relationship.trim(),phone:row.phone.trim()}));
    const {error}=await supabase.from('elderly_profiles').update({emergency_contacts:normalized,emergency_contact:family.name.trim()||null,emergency_contact_phone:family.phone.trim()||null,updated_at:new Date().toISOString()}).eq('elderly_id',elderly.elderly_id).eq('caregiver_id',session.user.id);
    if(error)setError('Contacts could not be saved. Your changes are retained.');else{await refresh(false);setOpen(false);}
    }catch{setError('Contacts could not be saved. Check your connection and retry; your edits are retained.');}finally{setBusy(false);}
  };
  const call=async(contact:EmergencyContact)=>{const number=contact.phone.replace(/[^+\d]/g,'');if(!number){Alert.alert('Number not saved','Add this contact in Settings → Emergency contacts.');return;}try{await Linking.openURL(`tel:${number}`);}catch{Alert.alert('Calling unavailable',`Call ${contact.name||contact.relationship} at ${contact.phone} using another phone.`);}};
  return <><Pressable accessibilityRole="button" onPress={()=>setOpen(true)} style={{padding:15,minHeight:50,borderRadius:13,backgroundColor:editable?theme.cardElevated:palette.error,flexDirection:'row',alignItems:'center',gap:10}}><Ionicons name={editable?'people-outline':'call-outline'} size={21} color={editable?palette.primaryDark:'white'}/><Text style={{color:editable?theme.text:'white',flexShrink:1}}>{editable?'Emergency contacts · priority and phone numbers':'Emergency contacts · call for help'}</Text></Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={()=>{if(!busy)setOpen(false);}}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:22,paddingTop:55,paddingBottom:50,gap:15,backgroundColor:theme.background,flexGrow:1,maxWidth:760,width:'100%',alignSelf:'center'}}><Text style={{fontSize:25,color:theme.text}}>Emergency contacts</Text><Text style={{color:theme.subtitle,lineHeight:22}}>Contact the caregiver first, then a family member, then the doctor if further help is needed. For immediate danger, contact local emergency services directly. This screen does not place calls automatically.</Text>{busy?<ActivityIndicator color={palette.primaryDark}/>:null}
      {contacts.map((contact,index)=><View key={contact.role} style={{padding:16,borderRadius:14,backgroundColor:theme.cardElevated,borderLeftWidth:4,borderLeftColor:index===0?palette.error:palette.primaryDark,gap:9}}><Text style={{color:index===0?palette.error:palette.primaryDark,fontSize:18}}>{index+1}. {roles[index][1]}</Text>{editable?(['name','relationship','phone'] as const).map(key=><View key={key}><Text style={{color:theme.subtitle,marginBottom:5}}>{key==='phone'?'Phone number':key==='name'?'Contact name':'Relationship'}</Text><TextInput accessibilityLabel={`${roles[index][1]} ${key}`} keyboardType={key==='phone'?'phone-pad':'default'} value={contact[key]} onChangeText={value=>setContacts(rows=>rows.map(row=>row.role===contact.role?{...row,[key]:value}:row))} style={{padding:12,minHeight:48,color:theme.text,borderWidth:1,borderColor:theme.border,borderRadius:10}}/></View>):<><Text style={{color:theme.text,fontSize:18}}>{contact.name||'Contact not configured'}</Text><Text style={{color:theme.subtitle}}>{contact.relationship}</Text><Text selectable style={{color:theme.text}}>{contact.phone||'Add a number in Settings'}</Text><Pressable accessibilityRole="button" disabled={!contact.phone} onPress={()=>void call(contact)} style={{padding:14,borderRadius:10,backgroundColor:contact.phone?(index===0?palette.error:palette.primaryDark):theme.card}}><Text style={{color:contact.phone?'white':theme.subtitle,textAlign:'center'}}>Call {roles[index][1].toLowerCase()}</Text></Pressable></>}</View>)}
      {error?<Text accessibilityRole="alert" style={{color:palette.error}}>{error}</Text>:null}{editable?<Pressable disabled={busy} onPress={()=>void save()} style={{padding:17,backgroundColor:palette.primaryDark,borderRadius:13}}><Text style={{color:'white',textAlign:'center'}}>Save priority contacts</Text></Pressable>:null}<Pressable disabled={busy} onPress={()=>setOpen(false)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:theme.subtitle,textAlign:'center'}}>Close</Text></Pressable>
    </ScrollView></Modal></>;
}
