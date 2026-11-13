import {runInNewContext} from 'node:vm';
import {appointmentMapHtml} from '@/src/lib/appointment-location';

test('the actual map script selects and drags a single marker without preselecting the viewport',()=>{
  const messages:any[]=[],events:Record<string,(event?:any)=>void>={};
  let coordinates=[0,0];
  const marker:any={addTo:()=>marker,on:(name:string,fn:any)=>{events[`marker:${name}`]=fn;return marker;},setLatLng:(point:number[])=>{coordinates=point;return marker;},getLatLng:()=>({lat:coordinates[0],lng:coordinates[1]})};
  const makeMarker=jest.fn((point:number[])=>{coordinates=point;return marker;});
  const map:any={setView:()=>map,on:(name:string,fn:any)=>{events[name]=fn;}};
  const tiles:any={addTo:()=>tiles,on:jest.fn()};
  const context={L:{map:()=>map,tileLayer:()=>tiles,divIcon:(options:any)=>options,marker:makeMarker},window:{ReactNativeWebView:{postMessage:(message:string)=>messages.push(JSON.parse(message))}}};
  const html=appointmentMapHtml({latitude:10,longitude:123},null);
  const scripts=Array.from(html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g),match=>match[1]).join('\n');
  runInNewContext(scripts,context);
  expect(messages).toEqual([{channel:'appointment-map',type:'ready'}]);
  expect(makeMarker).not.toHaveBeenCalled();
  events.click({latlng:{lat:10.2,lng:123.4}});
  expect(messages.at(-1)).toEqual({channel:'appointment-map',type:'coordinate',value:{latitude:10.2,longitude:expect.closeTo(123.4,6)}});
  events.click({latlng:{lat:10.3,lng:123.5}});
  expect(makeMarker).toHaveBeenCalledTimes(1);
  coordinates=[10.4,123.6];events['marker:dragend']();
  expect(messages.at(-1).value).toEqual({latitude:10.4,longitude:expect.closeTo(123.6,6)});
});
