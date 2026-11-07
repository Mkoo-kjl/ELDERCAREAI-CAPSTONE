import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { AppText as Text } from '@/src/components/AppText';
import { liveMapHtml, mapPayload, type MapPosition } from '@/src/lib/location-map';
import type {ZoneOverlay} from '@/src/lib/safe-zone';

export function LiveLocationMap({ position, points = [], live = false, compact = false, style,safeZone=null,selecting=false,onCoordinateSelect }: {
  position: MapPosition; points?: MapPosition[]; live?: boolean; compact?: boolean; style?: StyleProp<ViewStyle>;
  safeZone?:ZoneOverlay|null;selecting?:boolean;onCoordinateSelect?:(point:{latitude:number;longitude:number})=>void;
}) {
  const web = useRef<WebView>(null);
  const source = useRef({ html: liveMapHtml(position, compact) });
  const ready = useRef(false);
  const latest = useRef(mapPayload(position, points, live,safeZone,selecting));
  latest.current = mapPayload(position, points, live,safeZone,selecting);
  const [error, setError] = useState(false);
  const [following, setFollowing] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const send = useCallback(() => {
    if (ready.current) web.current?.injectJavaScript(`window.updatePosition&&window.updatePosition(${JSON.stringify(latest.current).replace(/</g,String.fromCharCode(92)+'u003c')});true;`);
  }, []);
  useEffect(send, [position, points, live,safeZone,selecting, send]);
  const retry = () => { ready.current = false; setError(false); setAttempt((value)=>value+1); };
  return <View style={[styles.root, style]}>
    {error ? <View style={styles.error}><Text style={styles.message}>Map unavailable. Check your internet connection.</Text>{!compact ? <Pressable accessibilityRole="button" onPress={retry} style={styles.button}><Text style={styles.buttonText}>Retry map</Text></Pressable> : null}</View> : <WebView
      key={attempt} ref={web} source={source.current} style={StyleSheet.absoluteFillObject} pointerEvents={compact ? 'none' : 'auto'}
      originWhitelist={['*']} javaScriptEnabled mixedContentMode="never" scrollEnabled={false}
      onError={()=>setError(true)} onHttpError={()=>setError(true)}
      onMessage={(event)=>{ try { const message=JSON.parse(event.nativeEvent.data);
        if(message.type==='ready'){ready.current=true;send();}
        else if(message.type==='error')setError(true);
        else if(message.type==='follow')setFollowing(Boolean(message.value));
        else if(message.type==='coordinate'&&selecting&&Number.isFinite(message.value?.latitude)&&Math.abs(message.value.latitude)<=90&&Number.isFinite(message.value?.longitude)&&Math.abs(message.value.longitude)<=180)onCoordinateSelect?.(message.value);
      } catch { /* Ignore unrelated WebView messages. */ } }} />}
    {!compact && !following && !error ? <Pressable accessibilityRole="button" accessibilityLabel="Follow latest location" style={[styles.button, styles.follow]} onPress={()=>web.current?.injectJavaScript('window.followLatest&&window.followLatest();true;')}><Text style={styles.buttonText}>Follow location</Text></Pressable> : null}
  </View>;
}
const styles=StyleSheet.create({root:{overflow:'hidden',backgroundColor:'#e4eeeb'},error:{flex:1,alignItems:'center',justifyContent:'center',padding:20},message:{color:'#397F88',textAlign:'center',fontSize:12},button:{backgroundColor:'#397F88',paddingHorizontal:16,paddingVertical:10,borderRadius:18,marginTop:12},buttonText:{color:'white',fontSize:12},follow:{position:'absolute',right:12,bottom:25}});
