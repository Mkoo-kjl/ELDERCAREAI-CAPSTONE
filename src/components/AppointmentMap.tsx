import {useState} from 'react';
import {StyleSheet} from 'react-native';
import {WebView} from 'react-native-webview';
import {appointmentMapHtml,isAppointmentCoordinate,type AppointmentCoordinate} from '@/src/lib/appointment-location';

export type AppointmentMapProps = {
  center:AppointmentCoordinate | null; selected:AppointmentCoordinate | null;
  onSelect:(point:AppointmentCoordinate)=>void; onReady:()=>void; onError:()=>void;
};

export function AppointmentMap({center,selected,onSelect,onReady,onError}:AppointmentMapProps) {
  // Selection is a draft within the map. Updating its marker must not reload tiles.
  const [initial] = useState(() => ({html:appointmentMapHtml(center,selected)}));
  return <WebView testID="appointment-map" source={initial} style={styles.map}
    originWhitelist={['*']} javaScriptEnabled mixedContentMode="never" scrollEnabled={false}
    onError={onError} onHttpError={onError}
    onMessage={({nativeEvent}) => {
      try {
        const message=JSON.parse(nativeEvent.data);
        if(message.channel!=='appointment-map')return;
        if(message.type==='ready')onReady();
        else if(message.type==='error')onError();
        else if(message.type==='coordinate'&&isAppointmentCoordinate(message.value))onSelect(message.value);
      } catch { /* Ignore unrelated messages. */ }
    }}/>;
}
const styles=StyleSheet.create({map:{flex:1, backgroundColor:'#e4eeeb'}});
