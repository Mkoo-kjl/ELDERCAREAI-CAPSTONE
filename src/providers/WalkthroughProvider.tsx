import {createContext,forwardRef,useCallback,useContext,useEffect,useMemo,useRef,useState,type PropsWithChildren,type RefObject} from 'react';
import {ScrollView,View,type ScrollViewProps,type ViewProps} from 'react-native';
import {relativeWalkthroughRect} from '@/src/lib/walkthrough-layout';
export type WalkthroughRect={x:number;y:number;width:number;height:number};
type Entry={node:()=>View|null;reveal:()=>Promise<void>};
type Registry={register:(id:string,entry:Entry)=>()=>void;measure:(id:string,reveal?:boolean)=>Promise<WalkthroughRect|null>;setOverlay:(node:View|null)=>void;revision:number};
const RegistryContext=createContext<Registry|null>(null);
const RevealContext=createContext<((node:View)=>Promise<void>)|null>(null);
const windowRect=(node:View|null)=>new Promise<WalkthroughRect|null>(resolve=>{
  if(!node){resolve(null);return;}let settled=false;
  const timer=setTimeout(()=>{if(!settled){settled=true;resolve(null);}},150);
  node.measureInWindow((x,y,width,height)=>{if(settled)return;settled=true;clearTimeout(timer);resolve(width>0&&height>0?{x,y,width,height}:null);});
});
export function WalkthroughProvider({children}:PropsWithChildren){
  const root=useRef<View>(null),overlay=useRef<View|null>(null),entries=useRef(new Map<string,Entry>()),[revision,setRevision]=useState(0);
  const setOverlay=useCallback((node:View|null)=>{overlay.current=node;},[]);
  const register=useCallback((id:string,entry:Entry)=>{entries.current.set(id,entry);setRevision(value=>value+1);return()=>{if(entries.current.get(id)===entry){entries.current.delete(id);setRevision(value=>value+1);}};},[]);
  const measure=useCallback(async(id:string,reveal=false)=>{
    const entry=entries.current.get(id);if(!entry)return null;if(reveal)await entry.reveal();
    if(entries.current.get(id)!==entry)return null;
    const [rect,origin]=await Promise.all([windowRect(entry.node()),windowRect(overlay.current??root.current)]);
    return relativeWalkthroughRect(rect,origin);
  },[]);
  const value=useMemo(()=>({register,measure,setOverlay,revision}),[register,measure,setOverlay,revision]);
  return <RegistryContext.Provider value={value}><View ref={root} collapsable={false} style={{flex:1}}>{children}</View></RegistryContext.Provider>;
}
export function useWalkthroughRegistry(){return useContext(RegistryContext);}
export function useWalkthroughAnchor(id?:string){
  const registry=useContext(RegistryContext),reveal=useContext(RevealContext),node=useRef<View>(null),register=registry?.register;
  useEffect(()=>{if(!id||!register)return;return register(id,{node:()=>node.current,reveal:async()=>{if(node.current&&reveal)await reveal(node.current);}});},[id,register,reveal]);
  return node;
}
export function WalkthroughTarget({id,...props}:ViewProps&{id:string}){const ref=useWalkthroughAnchor(id);return <View {...props} testID={props.testID??`walkthrough-target:${id}`} ref={ref} collapsable={false}/>;}
/** Reveal offscreen settings/cards before measuring their actual screen position. */
export const WalkthroughScrollView=forwardRef<ScrollView,ScrollViewProps>(function WalkthroughScrollView({children,...props},forwarded){
  const scroll=useRef<ScrollView|null>(null),inner=useRef<View>(null);
  const reveal=useCallback((target:View)=>new Promise<void>(resolve=>{
    const content=inner.current??(scroll.current as (ScrollView&{getInnerViewRef?:()=>View|null})|null)?.getInnerViewRef?.();
    if(!content||!scroll.current){resolve();return;}
    let finished=false;const done=()=>{if(!finished){finished=true;resolve();}};const timer=setTimeout(done,400);
    target.measureLayout(content,(_x,y)=>{scroll.current?.scrollTo({y:Math.max(0,y-100),animated:true});clearTimeout(timer);setTimeout(done,80);},()=>{clearTimeout(timer);done();});
  }),[]);
  return <RevealContext.Provider value={reveal}><ScrollView {...props} removeClippedSubviews={false} innerViewRef={inner as RefObject<View>} ref={node=>{scroll.current=node;if(typeof forwarded==='function')forwarded(node);else if(forwarded)forwarded.current=node;}}>{children}</ScrollView></RevealContext.Provider>;
});
