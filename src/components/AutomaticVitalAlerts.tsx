import {useState} from 'react';
import {Alert,Pressable,StyleSheet,View,useColorScheme} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {AppText as Text} from './AppText';
import {VITAL_REVIEW_RULES as rules} from '@/src/lib/vital-review';
import {openHealthSoundSettings} from '@/src/lib/notifications';
import {getTheme,palette} from '@/src/theme/colors';
import {corners,space} from '@/src/theme/layout';
import {typeScale} from '@/src/theme/typography';
export function AutomaticVitalAlerts(){
  const [expanded,setExpanded]=useState(false);const theme=getTheme(useColorScheme()==='dark');
  return <View style={[styles.card,{backgroundColor:theme.cardElevated,borderColor:theme.border}]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Automatic vital alerts" accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={styles.toggle}>
      <View style={styles.icon}><Ionicons name="pulse-outline" size={22} color={palette.primaryDark}/></View><View style={styles.copy}><Text style={[styles.title,{color:theme.text}]}>Automatic vital alerts</Text><Text style={[styles.caption,{color:theme.subtitle}]}>{expanded?'Rules and sound settings':'Tap to view rules and sounds'}</Text></View><Ionicons name={expanded?'chevron-up':'chevron-down'} size={19} color={theme.subtitle}/>
    </Pressable>
    {expanded?<View style={[styles.details,{borderTopColor:theme.border}]}>
      <Text style={[styles.body,{color:theme.subtitle}]}>Heart rate: below {rules.heartRateLow} or above {rules.heartRateHigh} BPM. SpO₂: below {rules.oxygenLow}%. Sleep: a recorded session below {rules.sleepHoursLow} hours.</Text>
      <Text style={[styles.body,{color:theme.subtitle}]}>Wrist temperature: a change of at least {rules.skinTemperatureChangeC}°C and {rules.skinTemperatureStandardDeviations} standard deviations after {rules.skinTemperatureMinimumReferences} recent same-watch readings. This is not core temperature.</Text>
      <Text style={[styles.body,{color:theme.subtitle}]}>These are app review rules, not medical limits. New qualifying readings save an alert and notification. HRV/stress and steps have no automatic threshold. Sleep and wrist temperature alerts depend on recorded data arriving.</Text>
      <Pressable accessibilityRole="button" onPress={()=>void openHealthSoundSettings().catch(()=>Alert.alert('Sound settings','Open Android Settings → Apps → ElderCareAI → Notifications → Health reading warnings.'))} style={styles.button}><Ionicons name="volume-high-outline" size={18} color={palette.primaryDark}/><Text style={{color:palette.primaryDark}}>Health alert sound settings</Text></Pressable>
      <Text style={[styles.caption,{color:theme.subtitle}]}>Background alerts use notification volume; alerts while the app is open use media volume.</Text>
    </View>:null}
  </View>;
}
const styles=StyleSheet.create({card:{marginHorizontal:18,borderWidth:1,borderRadius:corners.card,overflow:'hidden'},toggle:{minHeight:72,padding:space.md,flexDirection:'row',alignItems:'center',gap:space.md},icon:{height:38,width:38,borderRadius:corners.control,backgroundColor:palette.aquaSurface,alignItems:'center',justifyContent:'center'},copy:{flex:1,gap:space.xs},title:{...typeScale.cardTitle},caption:{...typeScale.caption,lineHeight:18},body:{...typeScale.subhead,lineHeight:22},details:{borderTopWidth:1,padding:space.lg,gap:space.md},button:{minHeight:48,flexDirection:'row',alignItems:'center',gap:space.sm,backgroundColor:palette.aquaSurface,borderRadius:corners.control,paddingHorizontal:space.md}});
