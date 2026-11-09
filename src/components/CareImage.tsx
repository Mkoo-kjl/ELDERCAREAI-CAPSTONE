import {useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Image,Pressable,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {AppText as Text} from './AppText';
import {CareArtwork} from './CareArtwork';
import {careFileUrl} from '@/src/lib/care-files';
import {useAuth} from '@/src/providers/AuthProvider';
import {palette} from '@/src/theme/colors';
import type {LocalPhoto} from './ProfilePhotoPicker';
export async function chooseCareImage(camera=false):Promise<LocalPhoto|null>{
  const permission=camera?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(!permission.granted)throw Error(`Allow ${camera?'camera':'photo'} access in phone settings to continue.`);
  const options={mediaTypes:['images'] as ImagePicker.MediaType[],allowsEditing:false,quality:0.95};
  const result=camera?await ImagePicker.launchCameraAsync(options):await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled?null:{uri:result.assets[0].uri,mimeType:result.assets[0].mimeType};
}
export function CareImage({path,uri,size=56}:{path?:string|null;uri?:string|null;size?:number}){
  const {session}=useAuth();const user=session?.user.id;
  const [remote,setRemote]=useState<{path:string;url:string}|null>(null),[failed,setFailed]=useState(false);
  useEffect(()=>{let active=true;setRemote(null);setFailed(false);if(path&&user)void careFileUrl(path,user).then(url=>{if(active)setRemote({path,url});}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[path,user,uri]);
  const url=uri??(remote&&remote.path===path?remote.url:null);
  return <View style={{width:size,height:size,borderRadius:12,overflow:'hidden',alignItems:'center',justifyContent:'center',backgroundColor:palette.aquaSurface}}>
    {url&&!failed?<Image accessibilityLabel="Medication or prescription image" source={{uri:url}} style={{width:size,height:size}} resizeMode="contain" onError={()=>setFailed(true)}/>:
      path&&!failed?<ActivityIndicator color={palette.primaryDark}/>:<CareArtwork kind="medication" size={Math.min(size,52)}/>}
    {failed?<Text accessibilityRole="text" style={{fontSize:9,color:palette.primaryDark}}>Image unavailable</Text>:null}
  </View>;
}
export function CareImagePicker({path,value,onChange,label='Medication image'}:{path?:string|null;value:LocalPhoto|null;onChange:(value:LocalPhoto|null)=>void;label?:string}){
  const pick=async(camera:boolean)=>{try{const photo=await chooseCareImage(camera);if(photo)onChange(photo);}catch(error){Alert.alert('Image unavailable',error instanceof Error?error.message:'Try again.');}};
  return <View style={{flexDirection:'row',alignItems:'center',gap:12,marginVertical:12,flexWrap:'wrap'}}><CareImage path={path} uri={value?.uri} size={76}/><View style={{gap:6}}><Text style={{color:palette.primaryDark}}>{label} · optional</Text><View style={{flexDirection:'row',gap:12}}><Pressable accessibilityRole="button" onPress={()=>void pick(false)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:palette.primaryDark}}><Ionicons name="image-outline"/> Select</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>void pick(true)} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:palette.primaryDark}}><Ionicons name="camera-outline"/> Camera</Text></Pressable>{value?<Pressable accessibilityLabel="Remove selected image" onPress={()=>onChange(null)} style={{minHeight:44,justifyContent:'center'}}><Text>Undo</Text></Pressable>:null}</View></View></View>;
}
