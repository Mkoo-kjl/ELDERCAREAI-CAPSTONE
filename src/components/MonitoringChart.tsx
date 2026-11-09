import {useMemo,useState} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,View,useColorScheme} from 'react-native';
import {AppText as Text} from './AppText';
import {chartCoordinates,chartReadings,type ChartReading} from '@/src/lib/monitoring-chart';
import {formatCareDateTime} from '@/src/lib/care-time';
import {getTheme,palette} from '@/src/theme/colors';
import {corners,space} from '@/src/theme/layout';
import {fontFamily,typeScale} from '@/src/theme/typography';

export function MonitoringChart({records,unit,daily=false}:{records:ChartReading[];unit:string;daily?:boolean}){
  const theme=getTheme(useColorScheme()==='dark');
  const [mode,setMode]=useState<'line'|'bar'>('line'),[width,setWidth]=useState(300),[selected,setSelected]=useState<string|null>(null);
  const sampled=useMemo(()=>chartReadings(records),[records]);
  const geometry=useMemo(()=>chartCoordinates(sampled,width,176,daily),[sampled,width,daily]);
  const picked=sampled.find(item=>item.id===selected)??sampled.at(-1),index=Math.max(0,sampled.findIndex(item=>item.id===picked?.id));
  const number=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:2});
  if(!sampled.length)return null;
  const barWidth=Math.min(6,Math.max(1,(width-14)/Math.max(1,sampled.length)*0.55));
  return <View style={[styles.card,{backgroundColor:theme.cardElevated,borderColor:theme.border}]}>
    <View style={styles.heading}><Text style={[styles.title,{color:theme.text}]}>Recorded trend</Text><View accessibilityRole="tablist" style={[styles.switch,{backgroundColor:theme.card}]}>{(['line','bar'] as const).map(type=><Pressable key={type} accessibilityRole="tab" accessibilityLabel={`${type==='line'?'Line':'Bar'} chart`} accessibilityState={{selected:mode===type}} onPress={()=>setMode(type)} style={[styles.choice,mode===type&&{backgroundColor:palette.aquaSurface}]}><Ionicons name={type==='line'?'trending-up-outline':'bar-chart-outline'} color={mode===type?palette.primaryDark:theme.subtitle} size={17}/><Text style={{color:mode===type?palette.primaryDark:theme.text,fontFamily:fontFamily.semiBold}}>{type==='line'?'Line':'Bar'}</Text></Pressable>)}</View></View>
    <Text style={[styles.caption,{color:theme.subtitle}]}>{sampled.length.toLocaleString()} plotted {daily?'days':'readings'}{sampled.length<records.length?` from ${records.length.toLocaleString()} records; endpoints and extremes retained`:''} · tap the chart to inspect</Text>
    <Text style={[styles.caption,{color:theme.subtitle}]}>Scale {number(geometry.low)}–{number(geometry.high)} {unit}</Text>
    <Pressable accessibilityRole="image" accessibilityLabel={`${mode} chart of ${sampled.length} ${daily?'daily totals':'recorded measurements'}. ${picked?`Selected ${number(picked.value)} ${unit}, ${formatCareDateTime(picked.at)}.`:''}`} onLayout={event=>setWidth(event.nativeEvent.layout.width)} onPress={event=>{const x=event.nativeEvent.locationX;const nearest=geometry.points.reduce((a,b)=>Math.abs(a.x-x)<Math.abs(b.x-x)?a:b);setSelected(nearest.id);}} style={styles.plot}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {[0,1,2,3].map(row=><View key={row} style={{position:'absolute',left:0,right:0,top:8+row*52,borderTopWidth:1,borderTopColor:theme.border}}/>)}
        {mode==='line'?geometry.points.slice(1).map((point,index)=>{const prior=geometry.points[index],dx=point.x-prior.x,dy=point.y-prior.y,length=Math.sqrt(dx*dx+dy*dy);return <View key={point.id} testID="monitoring-line-segment" style={{position:'absolute',width:length,height:2,left:(prior.x+point.x)/2-length/2,top:(prior.y+point.y)/2-1,backgroundColor:palette.primaryDark,transform:[{rotate:`${Math.atan2(dy,dx)}rad`}]}}/>;}):geometry.points.map(point=><View key={point.id} testID="monitoring-thin-bar" style={{position:'absolute',width:barWidth,height:Math.max(2,168-point.y),left:point.x-barWidth/2,bottom:8,backgroundColor:point.id===picked?.id?palette.purple:palette.primaryDark,borderRadius:2}}/>)}
        {geometry.points.filter(point=>point.id===picked?.id||mode==='line'&&geometry.points.length<25).map(point=><View key={`dot:${point.id}`} style={{position:'absolute',width:point.id===picked?.id?9:5,height:point.id===picked?.id?9:5,left:point.x-(point.id===picked?.id?4.5:2.5),top:point.y-(point.id===picked?.id?4.5:2.5),borderRadius:6,backgroundColor:point.id===picked?.id?palette.purple:palette.primaryDark}}/>)}
      </View>
    </Pressable>
    <View style={styles.endpoints}><Text style={[styles.caption,{color:theme.subtitle}]}>{formatCareDateTime(sampled[0].at)}</Text><Text style={[styles.caption,{color:theme.subtitle,textAlign:'right'}]}>{formatCareDateTime(sampled.at(-1)!.at)}</Text></View>
    {picked?<View style={[styles.selection,{backgroundColor:theme.card}]}><Pressable accessibilityLabel="Previous chart reading" disabled={index===0} onPress={()=>setSelected(sampled[index-1].id)} style={styles.arrow}><Ionicons name="chevron-back" color={index===0?theme.border:palette.primaryDark} size={22}/></Pressable><View style={styles.copy}><Text style={[styles.value,{color:theme.text}]}>{number(picked.value)} {unit}</Text><Text style={[styles.caption,{color:theme.subtitle}]}>{formatCareDateTime(picked.at)}</Text></View><Pressable accessibilityLabel="Next chart reading" disabled={index===sampled.length-1} onPress={()=>setSelected(sampled[index+1].id)} style={styles.arrow}><Ionicons name="chevron-forward" color={index===sampled.length-1?theme.border:palette.primaryDark} size={22}/></Pressable></View>:null}
  </View>;
}
const styles=StyleSheet.create({card:{padding:space.lg,borderWidth:1,borderRadius:corners.card,gap:space.sm},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.sm,flexWrap:'wrap'},title:{...typeScale.cardTitle},switch:{flexDirection:'row',padding:3,borderRadius:corners.control},choice:{minHeight:44,paddingHorizontal:space.md,borderRadius:corners.control,flexDirection:'row',gap:space.xs,alignItems:'center'},caption:{...typeScale.caption,lineHeight:18,flexShrink:1},plot:{height:176,width:'100%'},endpoints:{flexDirection:'row',justifyContent:'space-between',gap:space.sm},selection:{flexDirection:'row',alignItems:'center',borderRadius:corners.control},arrow:{minHeight:48,minWidth:44,alignItems:'center',justifyContent:'center'},copy:{flex:1,alignItems:'center',paddingVertical:space.sm},value:{...typeScale.cardTitle}});
