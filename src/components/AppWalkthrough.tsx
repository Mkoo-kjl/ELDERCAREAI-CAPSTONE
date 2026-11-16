import {useCallback,useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,BackHandler,Keyboard,Pressable,ScrollView,StyleSheet,View,useColorScheme,useWindowDimensions} from 'react-native';
import Animated,{Easing,FadeIn,ReduceMotion} from 'react-native-reanimated';
import {sameWalkthroughRect,spotlightMask,spotlightCorners} from '@/src/lib/walkthrough-layout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {router,useGlobalSearchParams,usePathname,type Href} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {AppText as Text} from './AppText';
import {useAuth} from '@/src/providers/AuthProvider';
import {useHealthData} from '@/src/providers/HealthDataProvider';
import {useWalkthroughRegistry,type WalkthroughRect} from '@/src/providers/WalkthroughProvider';
import {walkthroughSteps,spotlightGeometry,coachmarkGeometry} from '@/src/lib/walkthrough';
import {getTheme,palette} from '@/src/theme/colors';
export {walkthroughSteps} from '@/src/lib/walkthrough';
const enter=FadeIn.duration(150).easing(Easing.bezier(0.23,1,0.32,1)).reduceMotion(ReduceMotion.System);
export function AppWalkthrough(){
  const {session,onboarding}=useAuth(),{elderly}=useHealthData(),path=usePathname(),params=useGlobalSearchParams<{walkthrough?:string;tab?:string}>(),insets=useSafeAreaInsets(),theme=getTheme(useColorScheme()==='dark'),windowSize=useWindowDimensions();
  const [overlaySize,setOverlaySize]=useState<{width:number;height:number}|null>(null),[failed,setFailed]=useState(false);
  const viewport=overlaySize??windowSize;
  const currentRoute=useRef({path,tab:params.tab});currentRoute.current={path,tab:params.tab};
  const registry=useWalkthroughRegistry(),measure=registry?.measure;
  const key=session&&elderly?`walkthrough-v1:${session.user.id}:${elderly.elderly_id}`:null;
  const identity=useRef(key);identity.current=key;
  const [step,setStep]=useState<number|null>(null),[receipt,setReceipt]=useState<string|null>(null),[error,setError]=useState(''),[position,setPosition]=useState<{target:string;rect:WalkthroughRect}|null>(null),[cardHeight,setCardHeight]=useState(180),[retry,setRetry]=useState(0);
  const replay=useRef('');
  useEffect(()=>{setStep(null);setReceipt(null);setError('');if(!key)return;let active=true;void AsyncStorage.getItem(key).then(value=>{if(active){setReceipt(key);if(!value)setStep(0);}}).catch(()=>{if(active)setReceipt(key);});return()=>{active=false;};},[key]);
  useEffect(()=>{if(key&&receipt===key&&params.walkthrough&&replay.current!==params.walkthrough){replay.current=params.walkthrough;setStep(0);}},[key,receipt,params.walkthrough]);
  const eligible=!!key&&receipt===key&&!!onboarding?.completed_at;
  const finish=useCallback(async()=>{if(!key)return;try{await AsyncStorage.setItem(key,'complete');if(identity.current===key){setStep(null);setError('');}}catch{setError('Could not save tour progress. Try again.');}},[key]);
  const advance=()=>{if(step===null)return;if(step===walkthroughSteps.length-1)void finish();else setStep(step+1);};
  useEffect(()=>{
    if(!eligible||step===null)return;
    Keyboard.dismiss();
    const [nextPath,query]=walkthroughSteps[step].route.split('?'),tab=query?.split('tab=')[1];
    if(currentRoute.current.path!==nextPath||(tab&&currentRoute.current.tab!==tab))router.replace(walkthroughSteps[step].route as Href);
    AccessibilityInfo.announceForAccessibility?.(`${step+1} of ${walkthroughSteps.length}. ${walkthroughSteps[step].title}`);
  },[eligible,step]);
  useEffect(()=>{
    if(!eligible||step===null||!measure||path!==walkthroughSteps[step].route.split('?')[0])return;
    const target=walkthroughSteps[step].target;
    let active=true,timer:ReturnType<typeof setTimeout>|undefined,frame:number|undefined,previous:WalkthroughRect|null=null,revealed=false;
    setPosition(null);setFailed(false);
    const fallback=setTimeout(()=>{if(active)setFailed(true);},800);
    const locate=async()=>{
      const rect=await measure(target,!revealed);revealed=true;if(!active)return;
      if(rect&&sameWalkthroughRect(rect,previous)){
        clearTimeout(fallback);setFailed(false);
        setPosition(current=>current?.target===target&&sameWalkthroughRect(current.rect,rect)?current:{target,rect});
        // Keep following real layout changes (insets, keyboard dismissal and delayed screen layout).
        timer=setTimeout(()=>void locate(),180);
      }else if(rect){previous=rect;frame=requestAnimationFrame(()=>void locate());}
      else{previous=null;setPosition(null);timer=setTimeout(()=>void locate(),64);}
    };
    frame=requestAnimationFrame(()=>void locate());
    return()=>{active=false;clearTimeout(fallback);if(timer)clearTimeout(timer);if(frame!==undefined)cancelAnimationFrame(frame);};
  },[eligible,step,path,params.tab,measure,registry?.revision,retry,viewport.width,viewport.height,windowSize.fontScale]);
  useEffect(()=>{if(!eligible||step===null)return;const back=BackHandler.addEventListener('hardwareBackPress',()=>{if(step>0)setStep(step-1);else void finish();return true;});return()=>back.remove();},[eligible,step,finish]);
  if(!eligible||step===null||path.startsWith('/setup')||['/login','/','/auth/callback'].includes(path))return null;
  const item=walkthroughSteps[step],circle='circle' in item&&item.circle;
  const rect=position?.target===item.target&&path===item.route.split('?')[0]?position.rect:null;
  const spot=rect?spotlightGeometry(rect,viewport.width,viewport.height,circle):null;
  const card=coachmarkGeometry(spot,viewport.width,viewport.height,cardHeight,insets.top,insets.bottom);
  return <View ref={registry?.setOverlay} collapsable={false} onLayout={event=>{const {width,height}=event.nativeEvent.layout;if(width>0&&height>0)setOverlaySize(current=>current?.width===width&&current?.height===height?current:{width,height});}} accessibilityViewIsModal accessibilityLabel="New user walkthrough" style={[StyleSheet.absoluteFillObject,{zIndex:1000,elevation:1000,overflow:'hidden'}]}>
    <View accessibilityLabel="Walkthrough background" onStartShouldSetResponder={()=>true} style={StyleSheet.absoluteFillObject}/>
    {spot?<>
      <View pointerEvents="none" testID="walkthrough-dimmer" style={StyleSheet.absoluteFillObject}>
        {spotlightMask(spot,viewport.width,viewport.height).map((block,index)=><View key={index} style={{position:'absolute',left:block.x,top:block.y,width:block.width,height:block.height,backgroundColor:'rgba(8,24,24,0.68)'}}/>)}
        {spotlightCorners(spot).map((corner,index)=><View key={`corner:${index}`} style={{position:'absolute',left:corner.x,top:corner.y,width:corner.r,height:corner.r,overflow:'hidden'}}><View style={{position:'absolute',left:corner.dx,top:corner.dy,width:corner.r*4,height:corner.r*4,borderWidth:corner.r,borderRadius:corner.r*2,borderColor:'rgba(8,24,24,0.68)'}}/></View>)}
      </View>
      <Animated.View key={`ring:${item.target}`} entering={enter} pointerEvents="none" style={{position:'absolute',left:spot.x,top:spot.y,width:spot.width,height:spot.height,borderRadius:spot.radius,borderWidth:2,borderColor:'#FFFFFF'}}/>
      <Pressable accessibilityRole="button" accessibilityLabel="Highlighted feature · continue tour" testID="walkthrough-highlight" onPress={advance} style={{position:'absolute',left:spot.x,top:spot.y,width:spot.width,height:spot.height,borderRadius:spot.radius}}/>
    </>:<View pointerEvents="none" testID="walkthrough-dimmer" style={[StyleSheet.absoluteFillObject,{backgroundColor:'rgba(8,24,24,0.68)'}]}/>}
    {!spot&&measure&&!failed?<Pressable accessibilityRole="button" accessibilityLabel="Skip tour" onPress={()=>void finish()} style={{position:'absolute',top:insets.top+12,right:16,minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:24,color:'white'}}>×</Text></Pressable>:null}
    {spot||!measure||failed?<Animated.View key={`tip:${step}:${rect?Math.round(rect.x):'pending'}:${rect?Math.round(rect.y):'pending'}`} entering={enter} testID="walkthrough-tooltip" onLayout={event=>setCardHeight(event.nativeEvent.layout.height)} style={{position:'absolute',left:card.x,top:card.y,width:card.width,maxHeight:Math.min(280,(viewport.height-insets.top-insets.bottom)*0.45),padding:12,gap:4,borderRadius:12,backgroundColor:theme.cardElevated,shadowColor:'#000000',shadowOpacity:0.18,shadowRadius:10,elevation:12}}>
      {spot?<View pointerEvents="none" testID="walkthrough-arrow" style={{position:'absolute',left:card.arrowX-7,top:card.above?cardHeight-1:-9,width:0,height:0,borderLeftWidth:7,borderRightWidth:7,borderLeftColor:'transparent',borderRightColor:'transparent',...(card.above?{borderTopWidth:10,borderTopColor:theme.cardElevated}:{borderBottomWidth:10,borderBottomColor:theme.cardElevated})}}/>:null}
      <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.4} style={{flex:1,fontSize:15,lineHeight:20,color:theme.text}}>{item.title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip tour" onPress={()=>void finish()} hitSlop={4} style={{width:36,minHeight:40,justifyContent:'center',alignItems:'center'}}><Text maxFontSizeMultiplier={1.2} style={{color:theme.subtitle,fontSize:23,lineHeight:26}}>×</Text></Pressable>
      </View>
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" style={{flexGrow:0,flexShrink:1}} contentContainerStyle={{gap:6}}>
        <Text maxFontSizeMultiplier={1.4} style={{fontSize:13,lineHeight:18,color:theme.subtitle}}>{item.body}</Text>
        {error?<Text accessibilityRole="alert" style={{fontSize:12,color:palette.error}}>{error}</Text>:null}
      </ScrollView>
      <View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:4}}>
        <Text accessibilityLabel={`Step ${step+1} of ${walkthroughSteps.length}`} maxFontSizeMultiplier={1.3} style={{flex:1,fontSize:11,color:theme.subtitle}}>{step+1} / {walkthroughSteps.length}</Text>
        {measure&&!spot?<Pressable accessibilityRole="button" accessibilityLabel="Find highlighted feature" onPress={()=>setRetry(value=>value+1)} style={{minHeight:44,paddingHorizontal:7,justifyContent:'center'}}><Text maxFontSizeMultiplier={1.3} style={{fontSize:12,color:theme.subtitle}}>Find</Text></Pressable>:null}
        {step>0?<Pressable accessibilityRole="button" onPress={()=>setStep(step-1)} style={{paddingHorizontal:8,minHeight:44,justifyContent:'center'}}><Text maxFontSizeMultiplier={1.3} style={{fontSize:12,color:theme.subtitle}}>Back</Text></Pressable>:null}
        <Pressable accessibilityRole="button" onPress={advance} style={{paddingHorizontal:14,minHeight:44,borderRadius:8,backgroundColor:palette.primaryDark,justifyContent:'center'}}><Text maxFontSizeMultiplier={1.3} style={{color:'white',fontSize:12}}>{step===walkthroughSteps.length-1?'Done':'Next →'}</Text></Pressable>
      </View>
    </Animated.View>:null}
  </View>;
}
