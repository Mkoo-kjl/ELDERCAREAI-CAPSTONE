import {Ionicons} from '@expo/vector-icons';
import type {PropsWithChildren} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,View,useColorScheme} from 'react-native';
import {AppText as Text} from '@/src/components/AppText';
import {getTheme,palette} from '@/src/theme/colors';
import {corners,space} from '@/src/theme/layout';
import {typeScale} from '@/src/theme/typography';

export function FeatureCard({children}:PropsWithChildren){const theme=getTheme(useColorScheme()==='dark');return <View style={[styles.card,{backgroundColor:theme.cardElevated,borderColor:theme.border}]}>{children}</View>;}
export function FeatureButton({label,onPress,busy=false,disabled=false,secondary=false,icon}:{label:string;onPress:()=>void;busy?:boolean;disabled?:boolean;secondary?:boolean;icon?:keyof typeof Ionicons.glyphMap}){
  const color=secondary?palette.primaryDark:palette.cardElevated;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:disabled||busy,busy}} disabled={disabled||busy} onPress={onPress}
    style={({pressed})=>[styles.button,{backgroundColor:secondary?palette.aquaSurface:palette.primaryDark,opacity:(disabled||busy)?0.5:pressed?0.8:1}]}>
    {busy?<ActivityIndicator color={color}/>:icon?<Ionicons name={icon} size={18} color={color}/>:null}<Text style={[typeScale.button,{color}]}>{label}</Text>
  </Pressable>;
}
export function FeatureStatus({label,color=palette.primaryDark}:{label:string;color?:string}){return <View style={[styles.status,{backgroundColor:`${color}14`}]}><View style={[styles.dot,{backgroundColor:color}]}/><Text style={[typeScale.caption,{color}]}>{label}</Text></View>;}
export function FeatureMessage({message,error=false,loading=false}:{message:string;error?:boolean;loading?:boolean}){const theme=getTheme(useColorScheme()==='dark');return <View style={styles.message}>
  {loading?<ActivityIndicator color={palette.primaryDark}/>:<Ionicons name={error?'alert-circle-outline':'information-circle-outline'} color={error?palette.error:palette.primaryDark} size={19}/>}
  <Text accessibilityRole={error?'alert':undefined} style={[typeScale.subhead,{color:error?palette.error:theme.subtitle,flex:1}]}>{message}</Text>
</View>;}
const styles=StyleSheet.create({card:{padding:space.lg,borderRadius:corners.card,borderWidth:StyleSheet.hairlineWidth,gap:space.md},button:{minHeight:48,paddingHorizontal:space.lg,paddingVertical:space.md,borderRadius:corners.control,flexDirection:'row',gap:space.sm,alignItems:'center',justifyContent:'center'},status:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:space.sm,borderRadius:corners.control,paddingHorizontal:space.md,paddingVertical:space.sm},dot:{width:6,height:6,borderRadius:3},message:{flexDirection:'row',alignItems:'flex-start',gap:space.sm}});
