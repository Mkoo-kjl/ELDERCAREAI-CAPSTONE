import {Ionicons} from '@expo/vector-icons';
import {Redirect,Stack,router,useLocalSearchParams} from 'expo-router';
import {useCallback,useEffect,useRef,useState} from 'react';
import {RefreshControl,ScrollView,StyleSheet,TextInput,View,useColorScheme} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppText as Text} from '@/src/components/AppText';
import {FeatureButton,FeatureCard,FeatureMessage,FeatureStatus} from '@/src/components/CareFeature';
import {useCareRefresh} from '@/src/hooks/useCareRefresh';
import {alertResponseStatus,responseNoteError,responseTimeLabel,validRecordId,type AlertResponseEvent,type CareAlert} from '@/src/lib/care-workflow';
import {formatDateTime} from '@/src/lib/format';
import {supabase} from '@/src/lib/supabase';
import {useAuth} from '@/src/providers/AuthProvider';
import {useHealthData} from '@/src/providers/HealthDataProvider';
import {getTheme,palette} from '@/src/theme/colors';
import {corners,space} from '@/src/theme/layout';
import {typeScale} from '@/src/theme/typography';

export default function AlertResponseScreen(){
  const {id}=useLocalSearchParams<{id?:string}>();const {session}=useAuth();const {elderly}=useHealthData();
  const owner=`${session?.user.id}:${elderly?.elderly_id}:${id}`,identity=useRef(owner);identity.current=owner;
  const theme=getTheme(useColorScheme()==='dark'),insets=useSafeAreaInsets();
  const [alert,setAlert]=useState<CareAlert|null>(null),[events,setEvents]=useState<AlertResponseEvent[]>([]),[note,setNote]=useState('');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const [notification,setNotification]=useState<{data?:{vital_log_id?:string};push_status?:string}|null>(null);const saving=useRef<string|null>(null),fetchId=useRef(0);
  const load=useCallback(async()=>{
    if(!session||!elderly||!validRecordId(id)){setLoading(false);return;}const version=owner,sequence=++fetchId.current;
    try{const [a,e,n]=await Promise.all([
      supabase.from('health_alerts').select('*').eq('id',id).eq('elderly_id',elderly.elderly_id).maybeSingle(),
      supabase.from('alert_response_events').select('*').eq('alert_id',id).eq('elderly_id',elderly.elderly_id).order('occurred_at'),
      supabase.from('caregiver_notifications').select('data,push_status').eq('alert_id',id).eq('caregiver_id',session.user.id).order('sent_at',{ascending:false}).limit(1).maybeSingle(),
    ]);if(identity.current!==version||sequence!==fetchId.current)return;if(a.error||e.error||n.error)throw a.error??e.error??n.error;
      setAlert(a.data as CareAlert|null);setEvents((e.data??[]) as AlertResponseEvent[]);setNotification(n.data);setError(null);
    }catch{if(identity.current===version&&sequence===fetchId.current)setError('The response history could not refresh. Check your connection and try again.');}
    finally{if(identity.current===version&&sequence===fetchId.current)setLoading(false);}
  },[session,elderly,id,owner]);
  useEffect(()=>{identity.current=owner;fetchId.current++;saving.current=null;setBusy(false);setAlert(null);setEvents([]);setNotification(null);setNote('');setError(null);setLoading(true);void load();return()=>{identity.current='';};},[load,owner]);
  useCareRefresh(elderly?.elderly_id,load);
  const respond=async(action:'acknowledge'|'resolve')=>{
    if(!alert||saving.current)return;const version=owner;
    if(action==='resolve'){const validation=responseNoteError(note);if(validation){setError(validation);return;}}
    const operation=`${owner}:${Date.now()}`;saving.current=operation;setBusy(true);setError(null);
    try{const {data,error:writeError}=await supabase.rpc('respond_to_care_alert',{p_alert:alert.id,p_action:action,p_note:action==='resolve'?note.trim():null});
      if(writeError)throw writeError;if(identity.current!==version)return;setAlert(data as CareAlert);await load();
    }catch{if(identity.current===version)setError('Your response was not saved. Keep your note and try again when connected.');}
    finally{if(saving.current===operation){saving.current=null;if(identity.current===version)setBusy(false);}}
  };
  if(!session)return <Redirect href="/login"/>;
  const status=alert?alertResponseStatus(alert):'New';
  return <><Stack.Screen options={{headerShown:true,title:'Alert response',headerStyle:{backgroundColor:theme.background},headerTintColor:theme.text}}/>
    <ScrollView style={{backgroundColor:theme.background}} contentContainerStyle={[styles.content,{paddingBottom:insets.bottom+space.section}]} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={()=>{setLoading(true);void load();}} colors={[palette.primaryDark]}/>}> 
      {!validRecordId(id)?<FeatureMessage error message="Choose a valid alert from the Alerts screen."/>:loading&&!alert?<FeatureMessage loading message="Loading alert and response history…"/>:null}
      {error&&!alert?<><FeatureMessage error message={error}/><FeatureButton secondary label="Retry alert" onPress={()=>void load()}/></>:null}
      {!loading&&!error&&!alert?<FeatureMessage message="This alert is unavailable for the signed-in patient."/>:null}
      {alert?<>
        <FeatureCard><View style={styles.row}><FeatureStatus label={status} color={alert.is_resolved?palette.accentDark:alert.acknowledged_at?palette.primaryDark:palette.warning}/><Text style={[typeScale.eyebrow,{color:theme.subtitle}]}>{alert.severity.toUpperCase()}</Text></View>
          <Text style={[typeScale.sectionTitle,{color:theme.text}]}>{alert.title}</Text><Text selectable style={[typeScale.body,{color:theme.text}]}>{alert.message}</Text>
          <Text style={[typeScale.caption,{color:theme.subtitle}]}>{elderly?.full_name} · {formatDateTime(alert.triggered_at)}</Text>
        </FeatureCard>
        <FeatureCard><Text style={[typeScale.cardTitle,{color:theme.text}]}>Response progress</Text>
          <View style={styles.progress}>{['New','Acknowledged','Resolved'].map((step,index)=>{const done=index===0||index===1&&Boolean(alert.acknowledged_at)||index===2&&alert.is_resolved;return <View key={step} style={styles.stage}>
            <View style={[styles.step,{backgroundColor:done?palette.primaryDark:theme.card}]}><Ionicons name={done?'checkmark':'ellipse-outline'} size={17} color={done?palette.cardElevated:theme.subtitle}/></View>
            <Text style={[typeScale.caption,{color:done?theme.text:theme.subtitle}]}>{step}</Text></View>;})}</View>
          <Text style={[typeScale.caption,{color:theme.subtitle}]}>{responseTimeLabel(alert.triggered_at,alert.acknowledged_at)}</Text>
          {!alert.is_resolved&&!alert.acknowledged_at?<FeatureButton label="Acknowledge alert" icon="hand-left-outline" busy={busy} onPress={()=>void respond('acknowledge')}/>:null}
          {alert.is_resolved?<><Text style={[typeScale.cardTitle,{color:theme.text}]}>Action recorded</Text><Text selectable style={[typeScale.body,{color:theme.text}]}>{alert.resolution_note??'No response note was recorded in the earlier app.'}</Text></>:<>
            <Text style={[typeScale.cardTitle,{color:theme.text}]}>What action did you take?</Text>
            <TextInput accessibilityLabel="Response note" placeholder="For example: Called the patient and checked in." placeholderTextColor={theme.subtitle} value={note} onChangeText={setNote} maxLength={2000} multiline textAlignVertical="top"
              style={[styles.input,{color:theme.text,backgroundColor:theme.card,borderColor:theme.border}]}/>
            <Text style={[typeScale.caption,{color:theme.subtitle}]}>{note.length}/2000 · {alert.acknowledged_at?'Save a note to complete this response.':'Acknowledge first, then record your action.'}</Text>
            <FeatureButton label="Save note and resolve" icon="checkmark-done-outline" disabled={!alert.acknowledged_at} busy={busy} onPress={()=>void respond('resolve')}/>
          </>}
          {error?<FeatureMessage error message={error}/>:null}
        </FeatureCard>
        <FeatureCard><Text style={[typeScale.cardTitle,{color:theme.text}]}>Response history</Text>
          {events.length?events.map(event=><View key={event.id} style={[styles.event,{borderColor:theme.border}]}><Ionicons name={event.action==='resolved'?'checkmark-circle-outline':'hand-left-outline'} size={20} color={palette.primaryDark}/><View style={{flex:1}}>
            <Text style={[typeScale.body,{color:theme.text}]}>{event.action==='resolved'?'Resolved':'Acknowledged'} · {event.actor_id===session.user.id?'You':event.actor_id?'Caregiver':'System or former account'}</Text>
            <Text style={[typeScale.caption,{color:theme.subtitle}]}>{formatDateTime(event.occurred_at)}</Text>{event.note?<Text style={[typeScale.body,{color:theme.text}]}>{event.note}</Text>:null}</View></View>)
            :<Text style={[typeScale.subhead,{color:theme.subtitle}]}>No caregiver response recorded yet. Reading a notification does not acknowledge the alert.</Text>}
        </FeatureCard>
        {validRecordId(notification?.data?.vital_log_id)?<FeatureButton label="View triggering reading" secondary icon="pulse-outline" onPress={()=>router.push({pathname:'/vital-evidence',params:{id:notification!.data!.vital_log_id!}})}/>:null}
        {notification?<Text style={[typeScale.caption,{color:theme.subtitle}]}>Push status: {notification.push_status??'unknown'}. Provider acceptance is separate from a caregiver response.</Text>:null}
      </>:null}
    </ScrollView></>;
}
const styles=StyleSheet.create({content:{padding:space.lg,gap:space.lg},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.sm},progress:{flexDirection:'row',justifyContent:'space-between',gap:space.sm},stage:{flex:1,alignItems:'center',gap:space.sm},step:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center'},input:{minHeight:112,borderRadius:corners.control,padding:space.md,borderWidth:1,...typeScale.body},event:{flexDirection:'row',gap:space.md,borderTopWidth:StyleSheet.hairlineWidth,paddingTop:space.md}});
