export type ChartReading={id:string;value:number;at:string};
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
export function chartCoordinates(points:ChartReading[],width:number,height:number,zeroBaseline=false){
  if(!points.length)return {low:0,high:0,points:[]};
  const values=points.map(item=>item.value),low=zeroBaseline?Math.min(0,...values):Math.min(...values),high=Math.max(...values);
  const span=high-low||Math.max(Math.abs(high)*0.1,1),start=Date.parse(points[0]?.at??''),last=Date.parse(points.at(-1)?.at??'');
  const inset=7,usable=Math.max(1,width-2*inset);
  return {low,high,points:points.map((item,index)=>({...item,x:inset+(last>start?(Date.parse(item.at)-start)/(last-start):points.length>1?index/(points.length-1):0.5)*usable,y:height-8-(item.value-low)/span*(height-20)}))};
}
