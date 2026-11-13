import {createElement,useEffect,useRef,useState} from 'react';
import {appointmentMapHtml,isAppointmentCoordinate} from '@/src/lib/appointment-location';
import type {AppointmentMapProps} from './AppointmentMap';

export function AppointmentMap({center,selected,onSelect,onReady,onError}:AppointmentMapProps) {
  const frame=useRef<HTMLIFrameElement>(null);
  const [html]=useState(()=>appointmentMapHtml(center,selected));
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.data?.channel!=='appointment-map')return;
      if(event.data.type==='ready')onReady();
      else if(event.data.type==='error')onError();
      else if(event.data.type==='coordinate'&&isAppointmentCoordinate(event.data.value))onSelect(event.data.value);
    };
    window.addEventListener('message',receive);
    return()=>window.removeEventListener('message',receive);
  },[onSelect,onReady,onError]);
  return createElement('iframe',{ref:frame,title:'Choose appointment location',srcDoc:html,sandbox:'allow-scripts allow-popups',style:{border:0,width:'100%',height:'100%',minHeight:240,flex:1},onError});
}
