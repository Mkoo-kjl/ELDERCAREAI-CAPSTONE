export type ChartReading={id:string;value:number;at:string};
export type ChartSpacing='readings'|'time';

/** Keep a visible selected reading under the same screen position while zooming. */
export function chartZoomOffset(width:number,viewport:number,offset:number,nextWidth:number,selectedX:number){
  const pivot=selectedX>=offset&&selectedX<=offset+viewport?selectedX:offset+viewport/2;
  const ratio=(pivot-12)/Math.max(1,width-24);
  return Math.max(0,Math.min(nextWidth-viewport,12+ratio*(nextWidth-24)-(pivot-offset)));
}

export function chartScale(points:ChartReading[],zeroBaseline=false){
  if(!points.length)return {low:0,high:1,ticks:[0,0.25,0.5,0.75,1]};
  const values=points.map(item=>item.value),min=Math.min(...values),max=Math.max(...values);
  const padding=Math.max((max-min)*0.04,Math.abs(max)*0.01,0.1);
  const bottom=zeroBaseline?Math.min(0,min):min-padding,top=zeroBaseline?Math.max(0,max):max+padding;
  const rough=(top-bottom||1)/5,power=10**Math.floor(Math.log10(rough));
  const step=([1,2,2.5,5,10].find(value=>value*power>=rough)??10)*power;
  const low=Math.floor(bottom/step)*step,high=Math.max(low+step,Math.ceil(top/step)*step);
  const ticks=Array.from({length:Math.round((high-low)/step)+1},(_,index)=>Number((low+index*step).toPrecision(12)));
  return {low,high,ticks};
}
/** Retain actual extrema and endpoints instead of inventing averaged readings. */
export function chartReadings(points:ChartReading[],limit=160){
  if(points.length<=limit)return points;
  const buckets=Math.max(1,Math.floor(limit/4)),chosen=new Map<string,ChartReading>();
  for(let index=0;index<buckets;index++){
    const group=points.slice(Math.floor(index*points.length/buckets),Math.floor((index+1)*points.length/buckets));
    if(!group.length)continue;
    const min=group.reduce((a,b)=>a.value<=b.value?a:b),max=group.reduce((a,b)=>a.value>=b.value?a:b);
    for(const item of [group[0],min,max,group[group.length-1]])chosen.set(item.id,item);
  }
  return [...chosen.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id));
}
export function chartCoordinates(points:ChartReading[],width:number,height:number,zeroBaseline=false,spacing:ChartSpacing='time'){
  const scale=chartScale(points,zeroBaseline);
  const span=scale.high-scale.low,start=Date.parse(points[0]?.at??''),last=Date.parse(points.at(-1)?.at??'');
  const inset=12,usable=Math.max(1,width-2*inset),top=12,bottom=height-12;
  return {...scale,top,bottom,points:points.map((item,index)=>({...item,
    x:inset+(spacing==='time'&&last>start?(Date.parse(item.at)-start)/(last-start):points.length>1?index/(points.length-1):0.5)*usable,
    y:bottom-(item.value-scale.low)/span*(bottom-top),
  }))};
}

/** Label actual readings in reading mode; uniform elapsed-time ticks in time mode. */
export function chartTimeTicks(points:ChartReading[],width:number,spacing:ChartSpacing){
  if(!points.length)return [];
  const count=Math.max(1,Math.floor((width-24)/110)),start=Date.parse(points[0].at),end=Date.parse(points.at(-1)!.at);
  if(points.length===1)return [{x:width/2,at:points[0].at}];
  if(spacing==='time'&&end>start)return Array.from({length:count+1},(_,index)=>({x:12+index/count*(width-24),at:new Date(start+index/count*(end-start)).toISOString()}));
  const indices=[...new Set(Array.from({length:Math.min(count,points.length-1)+1},(_,index)=>Math.round(index/Math.min(count,points.length-1)*(points.length-1))))];
  return indices.map(index=>({x:12+index/(points.length-1)*(width-24),at:points[index].at}));
}
