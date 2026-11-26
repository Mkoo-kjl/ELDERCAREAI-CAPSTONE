import {useMemo,useRef,useState} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {Pressable,ScrollView,StyleSheet,View,useColorScheme} from 'react-native';
import {AppText as Text} from './AppText';
import {chartCoordinates,chartReadings,chartTimeTicks,chartZoomOffset,type ChartReading,type ChartSpacing} from '@/src/lib/monitoring-chart';
import {formatCareDateTime} from '@/src/lib/care-time';
import {getTheme,palette} from '@/src/theme/colors';
import {corners,space} from '@/src/theme/layout';
import {fontFamily,typeScale} from '@/src/theme/typography';

const PLOT_HEIGHT=224;
const ZOOMS=[1,2,4,8,16,32] as const;
const number=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:2});
const axisNumber=(value:number)=>value.toLocaleString(undefined,{maximumFractionDigits:6});

export function MonitoringChart({records,unit,daily=false}:{records:ChartReading[];unit:string;daily?:boolean}){
  const dark=useColorScheme()==='dark',theme=getTheme(dark);
  const ink=dark?palette.primary:palette.primaryDark,selectionInk=dark?'#C7B8EF':palette.purple;
  const [mode,setMode]=useState<'line'|'bar'>('line');
  const [spacing,setSpacing]=useState<ChartSpacing>('readings');
  const [viewport,setViewport]=useState(240),[zoom,setZoom]=useState<number>(4);
  const [selected,setSelected]=useState<string|null>(null);
  const scroller=useRef<ScrollView>(null),offset=useRef(0),pendingOffset=useRef<number|'end'|null>('end');
  // Each metric/patient gets its own chart state (the parent keys this component).
  const ordered=useMemo(()=>records.filter(item=>Number.isFinite(item.value)&&Number.isFinite(Date.parse(item.at)))
    .sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id)),[records]);
  const width=viewport*zoom;
  const geometry=useMemo(()=>chartCoordinates(ordered,width,PLOT_HEIGHT,daily||mode==='bar',spacing),[ordered,width,daily,mode,spacing]);
  const sampled=useMemo(()=>chartReadings(ordered,Math.max(160,Math.floor(width/7))),[ordered,width]);
  const sampledIds=useMemo(()=>new Set(sampled.map(item=>item.id)),[sampled]);
  const points=geometry.points.filter(point=>sampledIds.has(point.id)||point.id===selected);
  const selectedIndex=ordered.findIndex(item=>item.id===selected);
  const index=selectedIndex<0?ordered.length-1:selectedIndex;
  const picked=ordered[index],marker=geometry.points[index];
  const ticks=useMemo(()=>chartTimeTicks(ordered,width,spacing),[ordered,width,spacing]);
  const axisWidth=Math.max(48,Math.min(96,Math.max(...geometry.ticks.map(value=>axisNumber(value).length))*8+12));
  if(!picked)return null;

  function scrollTo(x:number){
    offset.current=Math.max(0,Math.min(width-viewport,x));
    scroller.current?.scrollTo({x:offset.current,animated:false});
  }
  function applyPendingScroll(){
    if(pendingOffset.current===null)return;
    scrollTo(pendingOffset.current==='end'?width-viewport:pendingOffset.current);
    pendingOffset.current=null;
  }
  function changeZoom(next:number){
    pendingOffset.current=chartZoomOffset(width,viewport,offset.current,viewport*next,marker.x);
    setZoom(next);
  }
  function selectReading(next:number){
    setSelected(ordered[next].id);
    scrollTo(geometry.points[next].x-viewport/2);
  }
  const barWidth=Math.min(6,Math.max(2,(width-24)/Math.max(1,points.length)*0.6));
  const zeroY=geometry.bottom-(0-geometry.low)/(geometry.high-geometry.low)*(geometry.bottom-geometry.top);
  const zoomIndex=ZOOMS.indexOf(zoom as typeof ZOOMS[number]);
  const tickStyle=[styles.axisLabel,{color:theme.subtitle}];

  return <View style={[styles.card,{backgroundColor:theme.cardElevated,borderColor:theme.border}]}>
    <View style={styles.heading}>
      <Text style={[styles.title,{color:theme.text}]}>Recorded trend</Text>
      <View accessibilityRole="tablist" style={[styles.switch,{backgroundColor:theme.card}]}>
        {(['line','bar'] as const).map(type=><Pressable key={type} accessibilityRole="tab" accessibilityLabel={`${type==='line'?'Line':'Bar'} chart`} accessibilityState={{selected:mode===type}} onPress={()=>setMode(type)} style={[styles.choice,mode===type&&{backgroundColor:palette.aquaSurface}]}>
          <Ionicons name={type==='line'?'trending-up-outline':'bar-chart-outline'} color={mode===type?palette.primaryDark:theme.subtitle} size={18}/>
          <Text style={[styles.controlText,{color:mode===type?palette.primaryDark:theme.text}]}>{type==='line'?'Line':'Bar'}</Text>
        </Pressable>)}
      </View>
    </View>
    <Text style={[styles.caption,{color:theme.subtitle}]}>{points.length.toLocaleString()} plotted {daily?'days':'readings'}{points.length<ordered.length?` from ${ordered.length.toLocaleString()} records; endpoints and extremes retained`:''}. Tap to inspect.</Text>

    <View style={styles.toolbar}>
      <View style={[styles.zoom,{backgroundColor:theme.card}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom out chart" accessibilityState={{disabled:zoomIndex===0}} disabled={zoomIndex===0} onPress={()=>changeZoom(ZOOMS[zoomIndex-1])} style={styles.iconButton}>
          <Ionicons name="remove-outline" size={22} color={zoomIndex===0?theme.subtitle:ink}/>
        </Pressable>
        <Text accessibilityLabel={`Chart zoom ${zoom} times`} style={[styles.controlText,styles.zoomValue,{color:theme.text}]}>{zoom}×</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom in chart" accessibilityState={{disabled:zoomIndex===ZOOMS.length-1}} disabled={zoomIndex===ZOOMS.length-1} onPress={()=>changeZoom(ZOOMS[zoomIndex+1])} style={styles.iconButton}>
          <Ionicons name="add-outline" size={22} color={zoomIndex===ZOOMS.length-1?theme.subtitle:ink}/>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Fit entire chart" onPress={()=>changeZoom(1)} style={styles.textButton}><Text style={[styles.controlText,{color:ink}]}>Fit all</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Show latest chart reading" onPress={()=>selectReading(ordered.length-1)} style={styles.textButton}><Text style={[styles.controlText,{color:ink}]}>Latest</Text></Pressable>
    </View>

    <View style={styles.spacing}>
      <Text style={[styles.caption,{color:theme.subtitle}]}>Spacing</Text>
      {(['readings','time'] as const).map(value=><Pressable key={value} accessibilityRole="radio" accessibilityLabel={value==='readings'?'Space chart by reading':'Space chart by elapsed time'} accessibilityState={{selected:spacing===value}} onPress={()=>{pendingOffset.current='end';setSpacing(value);scrollTo(width-viewport);}} style={[styles.spacingChoice,{borderColor:spacing===value?ink:theme.border,backgroundColor:spacing===value?theme.card:theme.cardElevated}]}>
        <Text style={[styles.controlText,{color:spacing===value?ink:theme.subtitle}]}>{value==='readings'?'Readings':'Time'}</Text>
      </Pressable>)}
    </View>
    <Text style={[styles.caption,{color:theme.subtitle}]}>{spacing==='readings'?'Evenly spaced readings; time gaps vary.':'Position follows elapsed time; gaps have no readings.'} {zoom>1?'Swipe left or right to explore.':'Zoom in for more detail.'}</Text>

    <View style={styles.axisHeading}><Text style={[styles.axisLabel,{color:theme.subtitle}]}>{spacing==='readings'?'Recorded readings →':'Date / time →'}</Text><Text style={[styles.controlText,{color:theme.text}]}>{unit}</Text></View>
    <View style={styles.chartRow}>
      <ScrollView ref={scroller} testID="monitoring-chart-scroll" horizontal nestedScrollEnabled directionalLockEnabled showsHorizontalScrollIndicator persistentScrollbar bounces={false} style={styles.scroll}
        onLayout={event=>{const measured=Math.round(event.nativeEvent.layout.width);if(measured>0&&measured!==viewport){pendingOffset.current='end';setViewport(measured);}}}
        onScroll={event=>{offset.current=event.nativeEvent.contentOffset.x;}} scrollEventThrottle={32}
        onContentSizeChange={applyPendingScroll}>
        <View style={{width}}>
          <Pressable testID="monitoring-chart-plot" accessibilityRole="image" accessibilityLabel={`${mode} chart of ${ordered.length} ${daily?'daily totals':'recorded measurements'}. Selected ${number(picked.value)} ${unit}, ${formatCareDateTime(picked.at)}.`}
            accessibilityHint="Use the zoom buttons and swipe horizontally. Tap a reading, or use Previous and Next below."
            onPress={event=>{const x=event.nativeEvent.locationX;const nearest=geometry.points.reduce((a,b)=>Math.abs(a.x-x)<=Math.abs(b.x-x)?a:b);setSelected(nearest.id);}}
            style={{width,height:PLOT_HEIGHT,overflow:'hidden'}}>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {geometry.ticks.map(value=><View key={`grid:${value}`} style={[styles.horizontalGrid,{top:geometry.bottom-(value-geometry.low)/(geometry.high-geometry.low)*(geometry.bottom-geometry.top),borderTopColor:theme.border}]}/>)}
              {ticks.map((tick,i)=><View key={`time:${i}`} style={[styles.verticalGrid,{left:tick.x,top:geometry.top,bottom:PLOT_HEIGHT-geometry.bottom,borderLeftColor:theme.border}]}/>)}
              {mode==='line'?points.slice(1).map((point,i)=>{
                const prior=points[i],dx=point.x-prior.x,dy=point.y-prior.y,length=Math.hypot(dx,dy);
                return <View key={point.id} testID="monitoring-line-segment" style={{position:'absolute',width:length,height:2.5,left:(prior.x+point.x)/2-length/2,top:(prior.y+point.y)/2-1.25,backgroundColor:ink,transform:[{rotate:`${Math.atan2(dy,dx)}rad`}]}}/>;
              }):points.map(point=><View key={point.id} testID="monitoring-thin-bar" style={{position:'absolute',width:barWidth,height:Math.max(2,Math.abs(zeroY-point.y)),left:point.x-barWidth/2,top:Math.min(zeroY,point.y),backgroundColor:point.id===picked.id?selectionInk:ink,borderRadius:2}}/>)}
              <View testID="monitoring-selection-guide" style={[styles.crosshair,{left:marker.x,top:geometry.top,bottom:PLOT_HEIGHT-geometry.bottom,borderLeftColor:selectionInk}]}/>
              {mode==='line'&&points.length<80?points.map(point=><View key={`dot:${point.id}`} style={[styles.dot,{left:point.x-2,top:point.y-2,backgroundColor:ink}]}/>):null}
              <View style={[styles.marker,{left:marker.x-5,top:marker.y-5,backgroundColor:selectionInk,borderColor:theme.cardElevated}]}/>
            </View>
          </Pressable>
          <View pointerEvents="none" style={styles.timeAxis}>
            {ticks.map((tick,i)=>{
              const date=new Date(tick.at),timeZone=daily?'Asia/Manila':undefined;
              return <View key={i} style={[styles.timeTick,{left:Math.max(0,Math.min(width-100,tick.x-50))}]}>
                <Text style={tickStyle}>{date.toLocaleDateString(undefined,{month:'short',day:'numeric',timeZone})}</Text>
                <Text style={tickStyle}>{daily?date.toLocaleDateString(undefined,{year:'numeric',timeZone}):date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',timeZone})}</Text>
              </View>;
            })}
          </View>
        </View>
      </ScrollView>
      <View pointerEvents="none" testID="monitoring-value-axis" style={[styles.valueAxis,{width:axisWidth,height:PLOT_HEIGHT,borderLeftColor:theme.border}]}>
        {geometry.ticks.map(value=><Text key={value} style={[styles.valueTick,...tickStyle,{top:geometry.bottom-(value-geometry.low)/(geometry.high-geometry.low)*(geometry.bottom-geometry.top)-9}]}>{axisNumber(value)}</Text>)}
      </View>
    </View>
    <View style={[styles.selection,{backgroundColor:theme.card}]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous chart reading" accessibilityState={{disabled:index===0}} disabled={index===0} onPress={()=>selectReading(index-1)} style={styles.iconButton}><Ionicons name="chevron-back" color={index===0?theme.subtitle:ink} size={22}/></Pressable>
      <View style={styles.copy}>
        <Text style={[styles.value,{color:theme.text}]}>{number(picked.value)} {unit}</Text>
        <Text style={[styles.caption,styles.center,{color:theme.subtitle}]}>{daily?new Date(picked.at).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Manila'}):formatCareDateTime(picked.at)}</Text>
        <Text style={[styles.caption,{color:theme.subtitle}]}>{daily?'Day':'Reading'} {index+1} of {ordered.length.toLocaleString()}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Next chart reading" accessibilityState={{disabled:index===ordered.length-1}} disabled={index===ordered.length-1} onPress={()=>selectReading(index+1)} style={styles.iconButton}><Ionicons name="chevron-forward" color={index===ordered.length-1?theme.subtitle:ink} size={22}/></Pressable>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  card:{padding:space.md,borderWidth:1,borderRadius:corners.card,gap:space.sm},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.sm,flexWrap:'wrap'},
  title:{...typeScale.cardTitle,fontSize:17},
  switch:{flexDirection:'row',padding:3,borderRadius:corners.control},
  choice:{minHeight:48,paddingHorizontal:space.md,borderRadius:corners.control,flexDirection:'row',gap:space.xs,alignItems:'center'},
  controlText:{fontFamily:fontFamily.semiBold,fontSize:13,lineHeight:19},
  caption:{...typeScale.subhead,lineHeight:19,flexShrink:1},
  toolbar:{flexDirection:'row',alignItems:'center',gap:4,flexWrap:'wrap'},
  zoom:{flexDirection:'row',alignItems:'center',borderRadius:corners.control},
  zoomValue:{minWidth:32,textAlign:'center',fontVariant:['tabular-nums']},
  iconButton:{minHeight:48,minWidth:44,alignItems:'center',justifyContent:'center'},
  textButton:{minHeight:48,paddingHorizontal:10,alignItems:'center',justifyContent:'center'},
  spacing:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},
  spacingChoice:{minHeight:44,paddingHorizontal:12,borderWidth:1,borderRadius:corners.control,justifyContent:'center'},
  axisHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},
  axisLabel:{fontFamily:fontFamily.medium,fontSize:12,lineHeight:18,fontVariant:['tabular-nums']},
  chartRow:{flexDirection:'row',alignItems:'flex-start'},
  scroll:{flex:1,minWidth:0},
  horizontalGrid:{position:'absolute',left:0,right:0,borderTopWidth:1},
  verticalGrid:{position:'absolute',borderLeftWidth:1,opacity:0.65},
  crosshair:{position:'absolute',borderLeftWidth:1,borderStyle:'dashed',opacity:0.8},
  dot:{position:'absolute',width:4,height:4,borderRadius:2},
  marker:{position:'absolute',width:10,height:10,borderRadius:5,borderWidth:2},
  timeAxis:{height:60,paddingTop:6},
  timeTick:{position:'absolute',top:6,width:100,alignItems:'center'},
  valueAxis:{borderLeftWidth:1},
  valueTick:{position:'absolute',left:6,right:0,textAlign:'right'},
  selection:{flexDirection:'row',alignItems:'center',borderRadius:corners.control},
  copy:{flex:1,alignItems:'center',paddingVertical:space.sm,gap:2},
  center:{textAlign:'center'},
  value:{...typeScale.sectionTitle,fontVariant:['tabular-nums']},
});
