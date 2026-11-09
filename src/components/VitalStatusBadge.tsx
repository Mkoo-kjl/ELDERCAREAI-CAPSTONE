import {Ionicons} from '@expo/vector-icons';
import {StyleSheet,View} from 'react-native';
import {AppText as Text} from './AppText';
import type {VitalStatus} from '@/src/lib/vital-status';
import {fontFamily} from '@/src/theme/typography';
export const vitalStatusColors={normal:{ink:'#245C38',surface:'#E6F3EA'},attention:{ink:'#79500A',surface:'#FFF1D3'},critical:{ink:'#9C252A',surface:'#FCE8E9'},neutral:{ink:'#385A66',surface:'#E9F1F4'}};
export function VitalStatusBadge({status}:{status:VitalStatus}){
  const colors=vitalStatusColors[status.tone];
  return <View accessible accessibilityLabel={`${status.label}. ${status.detail}`} style={[styles.badge,{backgroundColor:colors.surface}]}>
    <Ionicons name={status.tone==='critical'?'alert-circle':status.tone==='attention'?'warning-outline':status.tone==='normal'?'checkmark-circle-outline':'information-circle-outline'} color={colors.ink} size={15}/>
    <Text style={[styles.text,{color:colors.ink}]}>{status.label}</Text>
  </View>;
}
const styles=StyleSheet.create({badge:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:5,paddingVertical:5,paddingHorizontal:8,borderRadius:9,marginTop:7,maxWidth:'100%'},text:{fontFamily:fontFamily.bold,fontSize:12,flexShrink:1,lineHeight:18}});
