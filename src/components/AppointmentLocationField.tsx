import {useEffect,useState} from 'react';
import {ActivityIndicator,Keyboard,Modal,Pressable,StyleSheet,TextInput,View,useColorScheme} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {AppText as Text} from './AppText';
import {AppointmentMap} from './AppointmentMap';
import {decodeAppointmentLocation,encodeAppointmentLocation,isAppointmentCoordinate,type AppointmentCoordinate} from '@/src/lib/appointment-location';
import {getTheme,palette} from '@/src/theme/colors';
import {fontFamily,typeScale} from '@/src/theme/typography';

export function AppointmentLocationField({value,onChange,initialCenter=null}: {
  value:string; onChange:(value:string)=>void; initialCenter?:AppointmentCoordinate | null;
}) {
  const theme=getTheme(useColorScheme()==='dark'),insets=useSafeAreaInsets();
  const saved=decodeAppointmentLocation(value);
  const [open,setOpen]=useState(false),[point,setPoint]=useState<AppointmentCoordinate | null>(null);
  const [attempt,setAttempt]=useState(0),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!open||ready||failed)return;
    const timer=setTimeout(()=>setFailed(true),20000);
    return()=>clearTimeout(timer);
  },[open,ready,failed,attempt]);
  const begin=()=>{Keyboard.dismiss();setPoint(saved.point);setReady(false);setFailed(false);setAttempt(0);setOpen(true);};
  const inputStyle=[styles.input,{color:theme.text,borderColor:theme.border,backgroundColor:theme.card}];
  return <View style={styles.field}>
    <Text style={[styles.label,{color:theme.subtitle}]}>LOCATION</Text>
    <TextInput accessibilityLabel="Location" placeholder="Type a clinic, hospital or address" placeholderTextColor={theme.subtitle}
      value={saved.label} onChangeText={text=>onChange(encodeAppointmentLocation(text,saved.point))} style={inputStyle}/>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open appointment location map" onPress={begin} style={[styles.mapButton,{backgroundColor:palette.aquaSurface}]}>
        <Ionicons name="map-outline" size={19} color={palette.primaryDark}/><Text style={styles.buttonText}>{saved.point?'Change map location':'Open map'}</Text>
      </Pressable>
      {saved.point?<Pressable accessibilityRole="button" onPress={()=>onChange(saved.label)} style={styles.clear}><Text style={{color:palette.error}}>Remove map pin</Text></Pressable>:null}
    </View>
    <Text style={[styles.hint,{color:theme.subtitle}]}>{saved.point?`Map pin saved · ${saved.point.latitude.toFixed(5)}, ${saved.point.longitude.toFixed(5)}`:'Type the location, choose it on the map, or use both.'}</Text>
    <Modal visible={open} animationType="slide" onRequestClose={()=>setOpen(false)}>
      <View style={[styles.screen,{backgroundColor:theme.background,paddingTop:Math.max(insets.top,16),paddingBottom:Math.max(insets.bottom,16)}]}>
        <View style={styles.header}><Text style={[styles.title,{color:theme.text}]}>Appointment location</Text><Pressable accessibilityRole="button" onPress={()=>setOpen(false)} style={styles.clear}><Text style={styles.buttonText}>Cancel</Text></Pressable></View>
        <Text style={[styles.instructions,{color:theme.subtitle}]}>Pan and zoom to the destination, then tap to place a pin. Drag the pin to adjust it. Your selection is saved only when you confirm.</Text>
        <View style={styles.map}>
          {open&&!failed?<AppointmentMap key={attempt} center={isAppointmentCoordinate(initialCenter)?initialCenter:null} selected={point} onSelect={setPoint} onReady={()=>setReady(true)} onError={()=>setFailed(true)}/>:null}
          {!ready&&!failed?<View pointerEvents="none" style={[styles.loading,{backgroundColor:theme.card}]}><ActivityIndicator color={palette.primaryDark}/><Text style={{color:theme.text}}>Loading map…</Text></View>:null}
          {failed?<View style={styles.error}><Text style={{color:theme.text,textAlign:'center'}}>Map unavailable. Check your internet connection, or cancel and type the address.</Text><Pressable accessibilityRole="button" onPress={()=>{setFailed(false);setReady(false);setAttempt(v=>v+1);}} style={styles.mapButton}><Text style={styles.buttonText}>Retry map</Text></Pressable></View>:null}
        </View>
        <View style={styles.footer}>
          <Text accessibilityLiveRegion="polite" style={{color:theme.subtitle}}>{point?`Selected: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`:'No destination selected. Tap the map to choose one.'}</Text>
          <Pressable accessibilityRole="button" disabled={!point} onPress={()=>{if(point){onChange(encodeAppointmentLocation(saved.label,point));setOpen(false);}}} style={[styles.confirm,{backgroundColor:palette.primaryDark,opacity:point?1:0.45}]}><Text style={styles.confirmText}>Use this location</Text></Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles=StyleSheet.create({
  field:{gap:8,marginBottom:16},label:{...typeScale.eyebrow},input:{borderWidth:1,borderRadius:12,padding:13,minHeight:48,fontFamily:fontFamily.regular,fontSize:15},
  actions:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:8},mapButton:{minHeight:44,padding:12,borderRadius:12,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center'},
  buttonText:{color:palette.primaryDark,fontFamily:fontFamily.semiBold},clear:{minHeight:44,padding:10,justifyContent:'center'},hint:{fontSize:12},
  screen:{flex:1},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:18},title:{...typeScale.sectionTitle,flexShrink:1},
  instructions:{fontSize:13,lineHeight:20,paddingHorizontal:18,marginBottom:14},map:{flex:1,minHeight:180,overflow:'hidden',backgroundColor:'#e4eeeb'},
  loading:{position:'absolute',top:14,alignSelf:'center',flexDirection:'row',gap:10,padding:12,borderRadius:12},error:{flex:1,padding:24,justifyContent:'center',alignItems:'center',gap:10},
  footer:{gap:12,padding:18},confirm:{padding:16,borderRadius:14,minHeight:48},confirmText:{color:'white',fontFamily:fontFamily.semiBold,textAlign:'center'},
});
