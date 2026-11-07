import {useState} from 'react';
import {Pressable,StyleSheet,View,useColorScheme} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {AppText as Text} from '@/src/components/AppText';
import type {CareEvidence,EvidenceSummary} from '@/src/lib/care-evidence';
import {getTheme,palette} from '@/src/theme/colors';
import {typeScale} from '@/src/theme/typography';

export function EvidenceReadings({evidence=[],summary}:{evidence?:CareEvidence[];summary?:EvidenceSummary|null}){
  const theme=getTheme(useColorScheme()==='dark');const [expanded,setExpanded]=useState(false);
  if(!evidence.length&&!summary)return null;
  return <View style={[styles.root,{borderColor:theme.border}]}>
    <View style={styles.heading}><Ionicons name="document-text-outline" size={16} color={palette.primaryDark}/><Text style={[typeScale.eyebrow,{color:palette.primaryDark}]}>{summary?'DATABASE CHECK':'SOURCE READINGS'}</Text></View>
    {summary?<><Text style={[typeScale.caption,{color:theme.subtitle}]}>{summary.sample_count.toLocaleString()} saved samples checked · {summary.matching_count.toLocaleString()} matched · {summary.scope.replaceAll('_',' ')} ({summary.timezone})</Text><Text style={[typeScale.caption,{color:theme.subtitle}]}>Checked {new Date(summary.generated_at).toLocaleString()}. {summary.from?`From ${new Date(summary.from).toLocaleString()}. `:''}{summary.until?`Before ${new Date(summary.until).toLocaleString()}.`:''} Gaps in recorded data may miss readings.</Text></>:null}
    {(expanded?evidence:evidence.slice(0,3)).map(item=><Pressable key={item.reference} accessibilityRole="button" accessibilityLabel={`Open source ${item.reference}: ${item.label} ${item.value} ${item.unit}`} onPress={()=>router.push({pathname:'/vital-evidence',params:{id:item.record_id,metric:item.metric}})} style={[styles.reading,{backgroundColor:theme.cardElevated}]}>
      <View style={{flex:1,gap:3}}><Text style={[typeScale.subhead,{color:theme.text}]}>[{item.reference}] {item.label} · {item.value.toLocaleString()} {item.unit}</Text><Text style={[typeScale.caption,{color:theme.subtitle}]}>{new Date(item.measured_at).toLocaleString()}</Text></View><Ionicons name="chevron-forward" size={16} color={palette.primaryDark}/>
    </Pressable>)}
    {evidence.length>3?<Pressable accessibilityRole="button" onPress={()=>setExpanded(!expanded)} style={{paddingVertical:8}}><Text style={[typeScale.caption,{color:palette.primaryDark}]}>{expanded?'Show fewer readings':`Show all ${evidence.length} source readings`}</Text></Pressable>:null}
    {evidence.length?<Text style={[typeScale.caption,{color:theme.subtitle}]}>{summary?'Showing example matching records. Counts above cover the full saved query.':'Tap a source to inspect the saved reading. References identify app records; they do not validate medical advice.'}</Text>:null}
  </View>;
}
const styles=StyleSheet.create({root:{marginTop:12,paddingTop:12,borderTopWidth:StyleSheet.hairlineWidth,gap:8},heading:{flexDirection:'row',alignItems:'center',gap:6},reading:{padding:10,borderRadius:10,flexDirection:'row',gap:6,alignItems:'center'}});
