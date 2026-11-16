import {createClient} from 'npm:@supabase/supabase-js@2';
import {corsHeaders,json} from '../_shared/cors.ts';
import {isActiveCaregiver} from '../_shared/caregiver-access.ts';
const cache=new Map<string,{until:number;places:unknown[]}>(),lastRequest=new Map<string,number>();
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)return json({error:'Place search unavailable'},503);
  const db=createClient(url,key,{auth:{persistSession:false}});
  try{
    const bearer=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
    if(!bearer)return json({error:'Sign in first'},401);
    const auth=await db.auth.getUser(bearer),user=auth.data?.user;
    if(auth.error||!user)return json({error:'Sign in again'},401);
    if(!await isActiveCaregiver(db,user.id))return json({error:'Caregiver access required'},403);
    const body=await request.json(),query=typeof body?.query==='string'?body.query.trim():'';
    if(query.length<3||query.length>180)return json({error:'Enter a place name from 3 to 180 characters'},400);
    const endpoint=new URL(Deno.env.get('PHOTON_SEARCH_URL')??'https://photon.komoot.io/api/');
    endpoint.searchParams.set('q',query);endpoint.searchParams.set('limit','6');endpoint.searchParams.set('lang','en');
    const lat=body.center?.latitude,lon=body.center?.longitude;
    if(typeof lat==='number'&&Number.isFinite(lat)&&Math.abs(lat)<=90&&typeof lon==='number'&&Number.isFinite(lon)&&Math.abs(lon)<=180){endpoint.searchParams.set('lat',lat.toFixed(3));endpoint.searchParams.set('lon',lon.toFixed(3));}
    const cacheKey=endpoint.toString(),cached=cache.get(cacheKey);
    if(cached&&cached.until>Date.now())return json({places:cached.places});
    if((lastRequest.get(user.id)??0)>Date.now()-2000)return json({error:'Wait a moment before searching again'},429);
    lastRequest.set(user.id,Date.now());if(lastRequest.size>1000)lastRequest.delete(lastRequest.keys().next().value!);
    // Search is user-submitted; no patient identifiers or health data leave the server.
    const response=await fetch(endpoint,{headers:{'User-Agent':'ElderCareAI/1.0 appointment destination search'},signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw Error('Search failed');
    const data=await response.json(),places=[];
    for(const feature of (Array.isArray(data.features)?data.features:[]).slice(0,6)){
      const [longitude,latitude]=feature.geometry?.coordinates??[],p=feature.properties??{};
      if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)continue;
      const label=[p.name,[p.housenumber,p.street].filter(Boolean).join(' '),p.city??p.town??p.village,p.state,p.country].filter((text,index,all)=>typeof text==='string'&&text&&all.indexOf(text)===index).join(', ').slice(0,500);
      if(label)places.push({latitude,longitude,label});
    }
    if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(cacheKey,{until:Date.now()+86400000,places});
    return json({places});
  }catch{return json({error:'Search unavailable. Use the map or manual address.'},502);}
});
