import {Ionicons} from '@expo/vector-icons';
import {Image,Pressable,StyleSheet,View,useColorScheme} from 'react-native';
import {AppText as Text} from './AppText';
import {getTheme,palette} from '@/src/theme/colors';
import {corners,space} from '@/src/theme/layout';
import {fontFamily,typeScale} from '@/src/theme/typography';

export function PrescriptionEntryCard({onPress}:{onPress:()=>void}){
  const theme=getTheme(useColorScheme()==='dark');
  return <Pressable accessibilityRole="button" accessibilityLabel="Scan or upload a prescription with Elle" onPress={onPress} style={[styles.card,{backgroundColor:theme.cardElevated,borderColor:theme.border}]}>
    <View style={styles.portrait}><Image accessibilityLabel="Elle, your care assistant" source={require('@/assets/images/elle-happy.png')} style={styles.face} resizeMode="contain"/></View>
    <View style={styles.copy}><Text style={styles.eyebrow}>ELLE’S PRESCRIPTION HELPER</Text><Text style={[styles.title,{color:theme.text}]}>Scan or upload a prescription</Text><Text style={[styles.description,{color:theme.subtitle}]}>Optional · Review Elle’s draft before saving.</Text></View>
    <Ionicons name="chevron-forward" size={19} color={palette.primaryDark}/>
  </Pressable>;
}
const styles=StyleSheet.create({card:{borderWidth:1,borderRadius:corners.card,padding:space.md,flexDirection:'row',alignItems:'center',gap:space.md,marginBottom:space.md},portrait:{width:64,height:76,borderRadius:corners.control,backgroundColor:palette.aquaSurface,alignItems:'center',justifyContent:'center'},face:{width:62,height:72},copy:{flex:1,minWidth:0,gap:space.xs},eyebrow:{color:palette.primaryDark,fontSize:10,fontFamily:fontFamily.bold,letterSpacing:0.6},title:{...typeScale.cardTitle},description:{...typeScale.caption,lineHeight:18}});
