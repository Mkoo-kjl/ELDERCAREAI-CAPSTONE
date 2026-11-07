import {useEffect,useState} from 'react';
import {Pressable,StyleSheet,TextInput,View,useColorScheme} from 'react-native';
import {router} from 'expo-router';
import {AppText as Text} from '@/src/components/AppText';
import {FeatureButton,FeatureCard,FeatureMessage,FeatureStatus} from '@/src/components/CareFeature';
import type {useSafeZone} from '@/src/hooks/useSafeZone';
import {type MapPosition} from '@/src/lib/location-map';
import {SAFE_ZONE_RADIUS,safeZoneAccuracyLimit,safeZoneGpsHint,safeZoneStatus,type ZoneOverlay,zoneInputError} from '@/src/lib/safe-zone';
import {getTheme,palette} from '@/src/theme/colors';
import {typeScale} from '@/src/theme/typography';

export function SafeZonePanel({care,fix,picked,onPickRequest,onPreview,monitoring}:{care:ReturnType<typeof useSafeZone>;fix:MapPosition|null;picked:{latitude:number;longitude:number}|null;onPickRequest:()=>void;onPreview:(zone:ZoneOverlay|null)=>void;monitoring?:boolean}){
  const theme=getTheme(useColorScheme()==='dark');
  const [editing,setEditing]=useState(false),[name,setName]=useState('Home'),[lat,setLat]=useState(''),[lng,setLng]=useState(''),[radius,setRadius]=useState(String(SAFE_ZONE_RADIUS.default)),[error,setError]=useState<string|null>(null);
  const radiusMeters=Number(radius);
  const accuracyLimit=safeZoneAccuracyLimit(Number.isInteger(radiusMeters)&&radiusMeters>=SAFE_ZONE_RADIUS.min&&radiusMeters<=SAFE_ZONE_RADIUS.max?radiusMeters:SAFE_ZONE_RADIUS.default);
  const canUseFix=(maxAccuracy:number)=>{
    const age=fix?Date.now()-Date.parse(fix.measured_at):Infinity;
    return fix?.location_source==='watch_gps'&&fix.accuracy_m!=null&&fix.accuracy_m>=0&&fix.accuracy_m<=maxAccuracy&&age>=-10_000&&age<90_000;
  };
  const usableFix=canUseFix(accuracyLimit);
  useEffect(()=>{if(editing&&picked){setLat(String(picked.latitude));setLng(String(picked.longitude));}},[editing,picked]);
  useEffect(()=>{
    const candidate={name:name.trim(),latitude:Number(lat),longitude:Number(lng),radius_m:Number(radius),enabled:true};
    onPreview(editing&&lat.trim()&&lng.trim()&&!zoneInputError(candidate.name,candidate.latitude,candidate.longitude,candidate.radius_m)?candidate:null);
  },[editing,name,lat,lng,radius,onPreview]);
  const begin=()=>{const zone=care.zone,meters=zone?.radius_m??SAFE_ZONE_RADIUS.default;const useFix=canUseFix(safeZoneAccuracyLimit(meters));setName(zone?.name??'Home');setLat(zone?String(zone.latitude):useFix?String(fix!.latitude):'');setLng(zone?String(zone.longitude):useFix?String(fix!.longitude):'');setRadius(String(meters));setError(null);setEditing(true);};
  const save=async(enabled:boolean)=>{
    setError(null);
    const candidate=editing?{name,latitude:lat.trim()?Number(lat):NaN,longitude:lng.trim()?Number(lng):NaN,radius_m:Number(radius),enabled}:care.zone?{...care.zone,enabled}:null;
    if(!candidate)return;
    const invalid=zoneInputError(candidate.name,candidate.latitude,candidate.longitude,candidate.radius_m);if(invalid){setError(invalid);return;}
    try{await care.save(candidate);setEditing(false);}catch(e){setError(e instanceof Error?e.message:'Unable to save safe zone.');}
  };
  const status=safeZoneStatus(care.zone,care.state,Date.now(),monitoring);
  const gpsHint=safeZoneGpsHint(care.zone,fix,monitoring);
  const inputStyle=[styles.input,{color:theme.text,borderColor:theme.border,backgroundColor:theme.card}];
  return <FeatureCard>
    <View style={styles.heading}><View style={{flex:1}}><Text style={[typeScale.eyebrow,{color:palette.primaryDark}]}>LOCATION SAFETY</Text><Text style={[typeScale.sectionTitle,{color:theme.text,marginTop:4}]}>Patient safe zone</Text></View><FeatureStatus label={status} color={status==='Outside safe zone'?palette.warning:palette.primaryDark}/></View>
    {care.loading?<FeatureMessage loading message="Loading your safe zone…"/>:null}
    {care.error?<><FeatureMessage error message={care.error}/><FeatureButton secondary label="Retry safe zone" onPress={()=>void care.refresh()}/></>:null}
    {care.zone&&!editing?<><Text style={[typeScale.cardTitle,{color:theme.text}]}>{care.zone.name} · {care.zone.radius_m.toLocaleString()} m radius</Text><Text style={[typeScale.subhead,{color:theme.subtitle}]}>{care.zone.enabled?'Boundary changes are checked on the server as watch GPS arrives.':'Boundary alerts are paused.'}{care.state?.last_fix_at?` Last qualifying GPS: ${new Date(care.state.last_fix_at).toLocaleString()}.`:''}</Text></>:null}
    {!care.zone&&!editing?<Text style={[typeScale.body,{color:theme.subtitle}]}>Choose a familiar place. You’ll receive an alert when the watch confirms that the patient has left, and a notice when they return.</Text>:null}
    {care.zone&&!editing?<Text style={[typeScale.caption,{color:theme.subtitle}]}>The circle stays centered on your saved place. To center it on the watch’s current position, tap Edit safe zone → Use watch GPS → Save and enable safe zone.</Text>:null}
    {gpsHint&&!editing?<FeatureMessage message={gpsHint}/>:null}
    {editing?<>
      <Text style={[typeScale.subhead,{color:theme.text}]}>Place name</Text><TextInput accessibilityLabel="Safe-zone name" value={name} onChangeText={setName} maxLength={80} style={inputStyle}/>
      <View style={styles.row}><FeatureButton secondary disabled={!fix} label="Choose on map" icon="map-outline" onPress={onPickRequest}/><FeatureButton secondary disabled={!usableFix} label="Use watch GPS" icon="locate-outline" onPress={()=>{if(fix){setLat(String(fix.latitude));setLng(String(fix.longitude));}}}/></View>
      <Text style={[typeScale.caption,{color:theme.subtitle}]}>Tap the map to choose the fixed center, or enter coordinates. “Use watch GPS” needs a fresh satellite fix with accuracy of {accuracyLimit} m or better.</Text>
      <View style={styles.row}><View style={styles.field}><Text style={[typeScale.caption,{color:theme.subtitle}]}>Latitude</Text><TextInput accessibilityLabel="Safe-zone latitude" keyboardType="numbers-and-punctuation" value={lat} onChangeText={setLat} style={inputStyle}/></View><View style={styles.field}><Text style={[typeScale.caption,{color:theme.subtitle}]}>Longitude</Text><TextInput accessibilityLabel="Safe-zone longitude" keyboardType="numbers-and-punctuation" value={lng} onChangeText={setLng} style={inputStyle}/></View></View>
      <Text style={[typeScale.subhead,{color:theme.text}]}>Radius in meters · 10–5,000 m</Text><View style={styles.row}>{SAFE_ZONE_RADIUS.presets.map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:radius===String(value)}} onPress={()=>setRadius(String(value))} style={[styles.preset,{backgroundColor:radius===String(value)?palette.primaryDark:theme.card}]}><Text style={[typeScale.caption,{color:radius===String(value)?'#FFF':theme.text}]}>{value.toLocaleString()} m</Text></Pressable>)}</View><TextInput accessibilityLabel="Safe-zone radius" keyboardType="number-pad" value={radius} onChangeText={setRadius} style={inputStyle}/>
      <Text style={[typeScale.caption,{color:theme.subtitle}]}>Watch GPS needs accuracy of {accuracyLimit} m or better for this radius.</Text>
      <FeatureMessage message="Saving starts a new check. An exit or return needs at least 3 accurate watch GPS fixes spanning 20 seconds. GPS accuracy and a boundary buffer reduce false alerts, so crossing the circle does not immediately trigger an alert. Fused positions, stale fixes and uncertain boundary positions do not confirm an exit."/>
      <FeatureButton label="Save and enable safe zone" busy={care.saving} onPress={()=>void save(true)}/><FeatureButton secondary label="Cancel editing" disabled={care.saving} onPress={()=>{setEditing(false);setError(null);}}/>
    </>:<View style={styles.row}><FeatureButton label={care.zone?'Edit safe zone':'Set up safe zone'} disabled={care.loading||Boolean(care.error)||care.saving} icon="shield-checkmark-outline" onPress={begin}/>{care.zone?<FeatureButton secondary label={care.zone.enabled?'Pause alerts':'Resume alerts'} busy={care.saving} onPress={()=>void save(!care.zone!.enabled)}/>:null}</View>}
    {error?<FeatureMessage error message={error}/>:null}
    {(editing?radiusMeters:care.zone?.radius_m??Infinity)<50?<Text style={[typeScale.caption,{color:theme.subtitle}]}>Small zones need very accurate satellite GPS. GPS cannot reliably follow house walls or doorways and may be unavailable indoors. An exit can be confirmed farther beyond the circle because of GPS uncertainty.</Text>:null}
    {care.events.length?<><Text style={[typeScale.eyebrow,{color:theme.subtitle}]}>RECENT BOUNDARY EVENTS</Text>{care.events.map(event=><Pressable key={event.id} accessibilityRole={event.alert_id?'button':undefined} disabled={!event.alert_id} onPress={()=>router.push({pathname:'/alert-response',params:{id:event.alert_id!}})} style={[styles.event,{borderColor:theme.border}]}><View style={{flex:1}}><Text style={[typeScale.subhead,{color:theme.text}]}>{event.direction==='outside'?'Left':'Returned to'} {event.zone_name}</Text><Text style={[typeScale.caption,{color:theme.subtitle}]}>{new Date(event.measured_at).toLocaleString()}</Text></View>{event.alert_id?<Text style={[typeScale.caption,{color:palette.primaryDark}]}>Review ›</Text>:null}</Pressable>)}</>:null}
    <Text style={[typeScale.caption,{color:theme.subtitle}]}>Keep monitoring, location and internet enabled on the watch. A missing GPS fix means the current position is unknown. Safe zones support care and cannot guarantee a person’s safety.</Text>
  </FeatureCard>;
}
const styles=StyleSheet.create({heading:{gap:12},row:{flexDirection:'row',flexWrap:'wrap',gap:8},field:{flex:1,minWidth:120,gap:4},input:{minHeight:48,borderWidth:1,borderRadius:12,paddingHorizontal:12,paddingVertical:10,...typeScale.body},preset:{minHeight:44,borderRadius:12,paddingHorizontal:12,justifyContent:'center'},event:{borderTopWidth:StyleSheet.hairlineWidth,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:8}});
