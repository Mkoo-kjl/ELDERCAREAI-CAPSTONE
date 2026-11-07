import {createContext,useCallback,useContext,useEffect,useRef,useState,type PropsWithChildren} from 'react';
import {Alert,AppState,Modal,Pressable,ScrollView,StyleSheet,View,useColorScheme} from 'react-native';
import {AppText as Text} from '@/src/components/AppText';
import NativeSamsungHealth,{type SamsungHealthSource} from '@/modules/samsung-health';
import {connectSamsungHealth,disconnectSamsungHealth,restoreSamsungHealthLink,syncSamsungHealth} from '@/src/lib/samsung-health-sync';
import {useAuth} from '@/src/providers/AuthProvider';
import {useHealthData} from '@/src/providers/HealthDataProvider';
import {getTheme,palette} from '@/src/theme/colors';
type Value={connected:boolean;busy:boolean;status:string;connect:()=>Promise<void>;disconnect:()=>Promise<void>;sync:()=>Promise<void>};
const Context=createContext<Value>({connected:false,busy:false,status:'Not connected',connect:async()=>{},disconnect:async()=>{},sync:async()=>{}});
export const useSamsungHealth=()=>useContext(Context);
export function SamsungHealthProvider({children}:PropsWithChildren){
  const {session}=useAuth();const {elderly,refresh}=useHealthData();
  const userId=session?.user.id,patient=elderly?.elderly_id;
  const identity=useRef('');identity.current=`${userId}:${patient}`;
  const theme=getTheme(useColorScheme()==='dark');
  const [connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState('Not connected');
  const [sources,setSources]=useState<SamsungHealthSource[]>([]);
  const permissions=useRef({sleep:false,oxygen:false});const syncing=useRef<string|null>(null);
  useEffect(()=>{identity.current=`${userId}:${patient}`;return()=>{identity.current='';};},[userId,patient]);
  const sync=useCallback(async()=>{
    if(!userId||!patient||!NativeSamsungHealth)return;
    const version=`${userId}:${patient}`;if(syncing.current===version)return;
    syncing.current=version;setBusy(true);setStatus('Checking Health history for new sleep and oxygen records…');
    try{
      const link=await restoreSamsungHealthLink(userId,patient);if(identity.current!==version)return;
      if(!link){setConnected(false);setStatus('Connect Health history to import new sleep and oxygen records. Previously saved readings are still available.');return;}
      setConnected(true);
      const inserted=await syncSamsungHealth(userId,patient);if(identity.current!==version)return;
      setStatus(`${link.sourceName}: ${inserted?`synchronized ${inserted} new records`:'no new records; previously saved readings are still available'}. Sleep and overnight oxygen update after the watch’s health app syncs.`);
      await refresh(false,true);
    }catch(error){if(identity.current===version){
      setStatus(error instanceof Error?error.message:'Health history could not sync. Retrying when the app opens.');
      // An earlier batch can commit before a later batch fails. Display those
      // saved records even when the Realtime connection missed the update.
      await refresh(false,true);
    }}
    finally{if(syncing.current===version)syncing.current=null;if(identity.current===version)setBusy(false);}
  },[userId,patient,refresh]);
  useEffect(()=>{
    setConnected(false);setBusy(false);setStatus('Not connected');setSources([]);
    void sync();
    const timer=setInterval(()=>{if(AppState.currentState==='active')void sync();},60_000);
    const resume=AppState.addEventListener('change',state=>{if(state==='active')void sync();});
    return()=>{clearInterval(timer);resume.remove();};
  },[userId,patient,sync]);
  const connect=async()=>{
    if(!NativeSamsungHealth)throw Error('Install the updated phone app to enable Health history.');
    if(!userId||!patient)throw Error('Sign in and set up the patient profile first.');
    const version=`${userId}:${patient}`;setBusy(true);
    try{const granted=await NativeSamsungHealth.requestAccess();if(identity.current!==version)return;
      permissions.current=granted;
      if(!granted.sleep&&!granted.oxygen)throw Error('Allow Sleep or Blood oxygen access in Health history to connect.');
      const devices=await NativeSamsungHealth.sources();if(!devices.length)throw Error('No watch sources found. Sync the patient’s Galaxy Watch with its health app on this phone first.');
      if(identity.current===version)setSources(devices);
    }catch(error){if(identity.current!==version)return;throw Error(`${error instanceof Error?error.message:'Health history is not ready.'} Open the watch’s health app on this phone and allow access. For this developer build, follow the health-history setup guide.`);}
    finally{if(identity.current===version)setBusy(false);}
  };
  const choose=(source:SamsungHealthSource)=>Alert.alert('Confirm the patient’s watch',`Import sleep from the last 30 days and available oxygen history from ${source.name} (${source.model}) for ${elderly?.full_name??'the patient'}? Confirm these records belong to this patient.`,[
    {text:'Cancel',style:'cancel'},{text:'Connect watch',onPress:()=>void(async()=>{
      const version=`${userId}:${patient}`;
      if(!userId||!patient||identity.current!==version)return;setSources([]);setBusy(true);
      try{await connectSamsungHealth(userId,patient,source,permissions.current);if(identity.current!==version)return;setConnected(true);await sync();}
      catch(error){if(identity.current===version)setStatus(error instanceof Error?error.message:'Connection failed.');}
      finally{if(identity.current===version)setBusy(false);}
    })()},
  ]);
  const disconnect=async()=>{
    if(!userId||!patient)return;const version=`${userId}:${patient}`;
    await disconnectSamsungHealth(userId,patient);if(identity.current!==version)return;
    setConnected(false);setStatus('Disconnected. Previously saved health records are retained.');
  };
  return <Context.Provider value={{connected,busy,status,connect,disconnect,sync}}>{children}
    <Modal visible={sources.length>0} transparent animationType="slide" onRequestClose={()=>setSources([])}><View style={styles.overlay}><View style={[styles.sheet,{backgroundColor:theme.cardElevated}]}>
      <Text style={[styles.title,{color:theme.text}]}>Choose the patient’s watch</Text><Text style={[styles.copy,{color:theme.subtitle}]}>Select the Health history source for this patient, rather than another person’s device.</Text>
      <ScrollView>{sources.map(source=><Pressable key={source.id} accessibilityRole="button" onPress={()=>choose(source)} style={[styles.option,{backgroundColor:theme.card}]}><Text style={{color:theme.text}}>{source.name||source.model}</Text><Text style={[styles.copy,{color:theme.subtitle}]}>{source.manufacturer} · {source.model}</Text></Pressable>)}</ScrollView>
      <Pressable accessibilityRole="button" onPress={()=>setSources([])} style={styles.option}><Text style={{color:palette.primaryDark}}>Cancel</Text></Pressable>
    </View></View></Modal>
  </Context.Provider>;
}
export function SamsungHealthConnection(){
  const health=useSamsungHealth();const theme=getTheme(useColorScheme()==='dark');
  const run=(operation:()=>Promise<void>)=>void operation().catch(error=>Alert.alert('Health history connection',error.message));
  return <View style={[styles.connection,{backgroundColor:theme.cardElevated}]}><Text style={[styles.title,{color:theme.text}]}>Sleep and overnight oxygen</Text><Text style={[styles.copy,{color:theme.subtitle}]}>{health.status}</Text>
    <Pressable accessibilityRole="button" disabled={health.busy} onPress={()=>run(health.connected?health.sync:health.connect)} style={styles.action}><Text style={{color:palette.primaryDark}}>{health.busy?'Syncing…':health.connected?'Sync Health history now':'Connect Health history'}</Text></Pressable>
    {health.connected?<Pressable accessibilityRole="button" disabled={health.busy} onPress={()=>run(health.disconnect)}><Text style={[styles.copy,{color:palette.error}]}>Disconnect history import</Text></Pressable>:null}
    <Text style={[styles.copy,{color:theme.subtitle}]}>Imports recorded data from the selected watch. Checks on opening the app and periodically when Android permits background work; wake-up delivery is not instantaneous.</Text>
  </View>;
}
const styles=StyleSheet.create({connection:{padding:16,borderRadius:16},title:{fontSize:16,fontWeight:'600'},copy:{fontSize:12,lineHeight:18,marginTop:7},action:{minHeight:44,justifyContent:'center',marginVertical:6},overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'#0008'},sheet:{padding:22,paddingBottom:35,borderTopLeftRadius:22,borderTopRightRadius:22,maxHeight:'80%'},option:{padding:16,borderRadius:12,marginTop:8}});
