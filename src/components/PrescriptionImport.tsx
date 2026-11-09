import {useState} from 'react';
import {ActivityIndicator,Alert,Image,Modal,Pressable,ScrollView,View,useColorScheme} from 'react-native';
import {AppText as Text} from './AppText';
import {CareImage,chooseCareImage} from './CareImage';
import type {LocalPhoto} from './ProfilePhotoPicker';
import {uploadCareFile} from '@/src/lib/care-files';
import {prescriptionDrafts,type PrescriptionDraft} from '@/src/lib/prescription';
import {supabase} from '@/src/lib/supabase';
import {useAuth} from '@/src/providers/AuthProvider';
import {useHealthData} from '@/src/providers/HealthDataProvider';
import {getTheme,palette} from '@/src/theme/colors';
export function PrescriptionImport({visible,onClose,onDrafts}:{visible:boolean;onClose:()=>void;onDrafts:(drafts:PrescriptionDraft[],path:string)=>void}){
  const theme=getTheme(useColorScheme()==='dark');const {session}=useAuth();const {elderly}=useHealthData();
  const [photo,setPhoto]=useState<LocalPhoto|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const pick=async(camera:boolean)=>{try{const selected=await chooseCareImage(camera);if(selected){setPhoto(selected);setError('');}}catch(error){setError(error instanceof Error?error.message:'Image selection failed.');}};
  const extract=async()=>{
    if(!photo||!session||!elderly||busy)return;setBusy(true);setError('');
    try{
      const path=await uploadCareFile(session.user.id,elderly.elderly_id,'prescription',photo);
      const result=await supabase.functions.invoke('prescription-draft',{body:{path,elderly_id:elderly.elderly_id}});
      if(result.error){const response=(result.error as {context?:Response}).context;const detail=response?await response.json().catch(()=>null):null;throw Error(detail?.error??'Extraction is unavailable. Retry or enter the prescription manually.');}
      const drafts=prescriptionDrafts(result.data);
      if(!drafts.length)throw Error('No readable medications found. Try a clearer image or use manual entry.');
      onDrafts(drafts,path);setPhoto(null);
    }catch(error){setError(error instanceof Error?error.message:'Extraction did not finish. No medication was created.');}
    finally{setBusy(false);}
  };
  const confirm=()=>Alert.alert('Create an AI draft?','The prescription image will be stored privately and sent to the configured Google Gemini service for extraction. Review every field against the original before saving. No medication will be activated by extraction.',[{text:'Cancel',style:'cancel'},{text:'Extract draft',onPress:()=>void extract()}]);
  return <Modal visible={visible} animationType="slide" onRequestClose={()=>{if(!busy)onClose();}}><ScrollView contentContainerStyle={{padding:24,paddingTop:55,gap:18,backgroundColor:theme.background,flexGrow:1,maxWidth:760,width:'100%',alignSelf:'center'}}>
    <View style={{flexDirection:"row",alignItems:"center",gap:14}}><Image accessibilityLabel="Elle prescription assistant" source={require("@/assets/images/elle-happy.png")} resizeMode="contain" style={{width:76,height:88}}/><View style={{flex:1,gap:5}}><Text style={{fontSize:25,color:theme.text}}>Import prescription</Text><Text style={{color:palette.primaryDark}}>Let Elle prepare a draft for your review.</Text></View></View><Text style={{color:theme.subtitle,lineHeight:22}}>Optional: capture or select a clear prescription image. Extraction creates editable drafts only. Keep manual entry for unclear or unsupported instructions.</Text>
    {photo?<CareImage uri={photo.uri} size={290}/>:null}
    <View style={{flexDirection:'row',gap:18,flexWrap:'wrap'}}><Pressable disabled={busy} onPress={()=>void pick(true)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:palette.primaryDark}}>Take photo</Text></Pressable><Pressable disabled={busy} onPress={()=>void pick(false)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:palette.primaryDark}}>Select image</Text></Pressable></View>
    {error?<Text accessibilityRole="alert" style={{color:palette.error}}>{error}</Text>:null}
    <Pressable disabled={!photo||busy} onPress={confirm} style={{padding:17,borderRadius:14,backgroundColor:palette.primaryDark,opacity:!photo||busy?0.5:1}}>{busy?<ActivityIndicator color="white"/>:<Text style={{color:'white',textAlign:'center'}}>Extract editable drafts</Text>}</Pressable>
    <Pressable disabled={busy} onPress={onClose} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:theme.subtitle,textAlign:'center'}}>Close · use manual entry</Text></Pressable>
  </ScrollView></Modal>;
}
