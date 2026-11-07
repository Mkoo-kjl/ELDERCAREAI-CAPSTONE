import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=join(root,'output/diagrams/database_2026-11-07');mkdirSync(out,{recursive:true});
const snapshot=JSON.parse(readFileSync(join(root,'tmp/database-dictionary/schema.json'),'utf8'));
const names=JSON.parse(readFileSync(join(root,'tmp/database-dictionary/manifest.json'),'utf8')).tables;
const tables=new Map(names.map(name=>[name,snapshot.relations.find(t=>t.name===name)]));
if(names.length!==18||[...tables.values()].some(t=>!t))throw Error('The diagrams must use the dictionary’s 18 core tables.');
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const quoted=v=>String(v).replaceAll('\\','\\\\').replaceAll("'","\\'").replaceAll('\n',' ');
const compactType=t=>({'timestamp with time zone':'timestamptz','timestamp without time zone':'timestamp','double precision':'float8'}[t]??t);
const pk=t=>t.constraints.find(c=>c.kind==='p')?.columns??[];
const fk=(t,name)=>t.constraints.find(c=>c.kind==='f'&&c.columns.includes(name));
const fullUnique=(t,name)=>pk(t).length===1&&pk(t)[0]===name||t.constraints.some(c=>c.kind==='u'&&c.columns.length===1&&c.columns[0]===name);
const colors={identity:'#397F88',watch:'#3F779E',care:'#756793',alert:'#A16B3E',ai:'#806A94',zone:'#4F805C'};
const group=name=>name==='caregivers'||name==='elderly_profiles'?'identity':/^(wearable|watch_|vital_)/.test(name)?'watch':/^(medication|appointments|caregiver_notes)/.test(name)?'care':/^ai_/.test(name)?'ai':/safe_zone/.test(name)?'zone':'alert';
const refs=[];const external=[];
for(const table of tables.values())for(const c of table.constraints.filter(c=>c.kind==='f')){
  if(c.columns.length!==1||c.ref_columns.length!==1)throw Error('Composite FK needs a diagram port group.');
  const ref={id:c.name,parent:c.ref_table,child:table.name,parentField:c.ref_columns[0],childField:c.columns[0]};
  (c.ref_schema==='public'&&tables.has(c.ref_table)?refs:external).push(ref);
}
const svgStart=(w,h)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="white"/><style>text{font-family:Arial,Helvetica,sans-serif;fill:#203431}.edge{fill:none;stroke-linejoin:round;stroke-linecap:round}</style>`;
const text=(x,y,value,size=14,anchor='start',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" ${extra}>${esc(value)}</text>`;
const path=points=>points.map((p,i)=>`${i?'L':'M'} ${p.x??p[0]} ${p.y??p[1]}`).join(' ');
const save=(name,content)=>writeFileSync(join(out,name),content,'utf8');

function dbml(){
  const lines=["Project ElderCareAI {", "  database_type: 'PostgreSQL'", "  Note: '18 core tables verified on 7 November 2026. Supabase Auth and supporting internal tables are outside this diagram.'",'}',''];
  for(const t of tables.values()){
    lines.push(`Table public.${t.name} {`);
    for(const col of t.columns){
      const options=[];if(pk(t).includes(col.name))options.push('pk');if(!col.nullable)options.push('not null');
      if(!pk(t).includes(col.name)&&fullUnique(t,col.name))options.push('unique');
      if(col.default!==null)options.push('default: `'+col.default+'`');
      const ref=fk(t,col.name);if(ref&&ref.ref_schema!=='public')options.push(`note: '${quoted('External FK: '+ref.ref_schema+'.'+ref.ref_table+'('+ref.ref_columns.join(', ')+')')}'`);
      lines.push(`  ${col.name} ${compactType(col.type)}${options.length?' ['+options.join(', ')+']':''}`);
    }
    const composite=t.indexes.filter(i=>i.definition.includes('UNIQUE INDEX')&&!i.name.endsWith('_pkey')&&!i.definition.includes(' WHERE '))
      .map(i=>i.definition.match(/USING btree \(([^)]+)\)/)?.[1]).filter(cols=>cols?.includes(','));
    if(composite.length){lines.push('  indexes {');for(const columns of composite)lines.push(`    (${columns}) [unique]`);lines.push('  }');}
    const notes=t.indexes.filter(i=>i.definition.includes('UNIQUE INDEX')&&i.definition.includes(' WHERE ')).map(i=>i.definition);
    if(notes.length)lines.push(`  Note: '${quoted('Conditional unique indexes: '+notes.join('; '))}'`);
    lines.push('}','');
  }
  for(const ref of refs){
    // DBML short-form 1:1 syntax treats the second endpoint as the FK.
    if(fullUnique(tables.get(ref.child),ref.childField))lines.push(`Ref: public.${ref.parent}.${ref.parentField} - public.${ref.child}.${ref.childField}`);
    else lines.push(`Ref: public.${ref.child}.${ref.childField} > public.${ref.parent}.${ref.parentField}`);
  }
  save('ElderCareAI_Database_Design_UPDATED.dbml',lines.join('\n'));
}

async function physical(){
  const width=480,row=24,header=48,leftMargin=84,topMargin=180,pitch=696,gap=144;
  const columns=[
    ['caregivers','elderly_profiles','medication_schedules','medication_logs'],
    ['wearable_devices','wearable_live_state','watch_location_points','vital_sign_logs'],
    ['appointments','caregiver_notes','ai_chatbot_sessions','ai_chatbot_messages','patient_safe_zones'],
    ['emergency_events','health_alerts','alert_response_events','caregiver_notifications','safe_zone_events'],
  ];
  const nodes=new Map();let bottom=0;
  columns.forEach((names,column)=>{let y=topMargin;for(const name of names){const t=tables.get(name),height=header+t.columns.length*row+12;nodes.set(name,{x:leftMargin+column*pitch,y,width,height,column});y+=height+gap;bottom=Math.max(bottom,y-gap);}});
  if(nodes.size!==tables.size)throw Error('A core table is missing from the database design.');
  const w=leftMargin*2+pitch*3+width,h=bottom+108;
  const router=orthogonalRouter(w,h,12,[...nodes.values()].map(n=>({x:n.x,y:n.y,w:n.width,h:n.height})),14);
  const svg=[svgStart(w,h),text(40,46,'ElderCareAI Database Design',30,'start','font-weight="700"'),text(40,77,'18 core tables  |  245 fields  |  34 declared foreign keys within the model  |  7 November 2026',15),
    text(40,108,'PK primary key     FK foreign key     FK* external Auth reference     NN not nullable     1 and N show maximum cardinality',14),
    text(40,134,'Every field matches the updated dictionary. Lines join the referenced parent key to its foreign-key field. Supabase Auth is outside the 18-table scope.',13)];
  const parentLabels=new Set();
  for(const r of refs){
    const a=nodes.get(r.parent),b=nodes.get(r.child),ta=tables.get(r.parent),tb=tables.get(r.child);
    const ay=a.y+header+ta.columns.findIndex(c=>c.name===r.parentField)*row+row/2;
    const by=b.y+header+tb.columns.findIndex(c=>c.name===r.childField)*row+row/2;
    const same=a.column===b.column,fromRight=same||a.x<b.x,toRight=same||b.x<a.x;
    const start={x:a.x+(fromRight?width:0),y:ay},end={x:b.x+(toRight?width:0),y:by};
    const outsideA={x:start.x+(fromRight?12:-12),y:ay},outsideB={x:end.x+(toRight?12:-12),y:by};
    const points=[start,...router(outsideA,outsideB),end];
    svg.push(`<path d="${path(points)}" class="edge" stroke="${colors[group(r.child)]}" stroke-width="1.6" opacity=".75"/>`);
    const labelId=r.parent+'.'+r.parentField+'.'+fromRight;
    if(!parentLabels.has(labelId)){svg.push(text(start.x+(fromRight?8:-8),ay-6,'1',11,fromRight?'start':'end','style="fill:#50615E"'));parentLabels.add(labelId);}
    svg.push(text(end.x+(toRight?9:-9),by-6,fullUnique(tb,r.childField)?'1':'N',11,toRight?'start':'end','style="fill:#50615E"'));
  }
  for(const [name,node] of nodes){
    const t=tables.get(name),{x,y}=node;
    svg.push(`<g id="table-${t.name}"><rect x="${x}" y="${y}" width="${width}" height="${node.height}" rx="7" fill="#FFF" stroke="#BACBC5" stroke-width="1.4"/><path d="M${x+7} ${y}H${x+width-7}Q${x+width} ${y} ${x+width} ${y+7}V${y+40}H${x}V${y+7}Q${x} ${y} ${x+7} ${y}" fill="${colors[group(t.name)]}"/>`);
    svg.push(text(x+15,y+27,t.name,17,'start','font-weight="700" style="fill:white"'));
    t.columns.forEach((c,i)=>{
      const top=y+header+i*row,cy=top+17;
      if(i%2===0)svg.push(`<rect x="${x+1}" y="${top}" width="${width-2}" height="${row}" fill="#F4F8F6"/>`);
      const reference=fk(t,c.name),external=reference&&reference.ref_schema!=='public';
      const key=[pk(t).includes(c.name)?'PK':null,reference?(external?'FK*':'FK'):null].filter(Boolean).join('/');
      svg.push(text(x+12,cy,key,10,'start',`font-weight="700" style="fill:${colors[group(t.name)]}"`),text(x+64,cy,c.name,13),text(x+width-42,cy,compactType(c.type),12,'end','style="fill:#5C6E69"'),text(x+width-13,cy,c.nullable?'':'NN',10,'end','style="fill:#5C6E69"'));
    });svg.push('</g>');
  }
  svg.push(text(40,h-52,'NN indicates required fields. Nullable foreign keys may be absent. Uniqueness conditions and the complete key definitions are included in the DBML source.',13),text(40,h-26,'Same 18 main tables as the core database dictionary. Supporting delivery, provider-status and legacy tables are omitted.',13),'</svg>');
  save('ElderCareAI_Database_Design_UPDATED.svg',svg.join('\n'));
  return {width:w,height:h,tables:nodes.size,fields:[...tables.values()].reduce((s,t)=>s+t.columns.length,0),foreignKeys:refs.length};
}

const clusterW=760,clusterH=320,colPitch=1000,rowPitch=560,left=80,top=220;
const slots=[
  ['caregivers','elderly_profiles','wearable_devices','wearable_live_state'],
  ['medication_schedules','medication_logs','vital_sign_logs','watch_location_points'],
  ['appointments','caregiver_notes','patient_safe_zones','safe_zone_events'],
  ['emergency_events','health_alerts','alert_response_events','caregiver_notifications'],
  [null,'ai_chatbot_sessions','ai_chatbot_messages',null],
];
const attributes={
  caregivers:['id','full_name','email','phone','age','sex'],
  elderly_profiles:['elderly_id','caregiver_id','full_name','date_of_birth','medical_conditions','emergency_contact_phone'],
  wearable_devices:['id','elderly_id','device_name','paired_at','expires_at','revoked_at'],
  wearable_live_state:['elderly_id','device_id','heart_rate_bpm','gps_measured_at','monitoring','battery_percent'],
  vital_sign_logs:['id','elderly_id','heart_rate_bpm','spo2_percent','skin_temp_celsius','hrv_rmssd_ms','stress_score','steps_count','sleep_hours','recorded_at'],
  watch_location_points:['id','elderly_id','device_id','latitude','longitude','measured_at'],
  medication_schedules:['id','elderly_id','medication_name','dosage','times_of_day','timezone'],
  medication_logs:['id','schedule_id','scheduled_time','taken_at','status','dose_key'],
  appointments:['id','elderly_id','title','doctor_name','appointment_at','status'],
  caregiver_notes:['id','elderly_id','caregiver_id','title','content','is_pinned'],
  patient_safe_zones:['elderly_id','name','latitude','longitude','radius_m','enabled'],
  safe_zone_events:['id','elderly_id','alert_id','direction','distance_m','measured_at'],
  emergency_events:['id','elderly_id','event_type','triggered_at','is_resolved','resolution_notes'],
  health_alerts:['id','elderly_id','severity','acknowledged_at','is_resolved','resolution_note'],
  alert_response_events:['id','alert_id','actor_id','action','note','occurred_at'],
  caregiver_notifications:['id','caregiver_id','alert_id','notification_type','is_read','push_status'],
  ai_chatbot_sessions:['id','elderly_id','caregiver_id','session_title','started_at','is_active'],
  ai_chatbot_messages:['id','session_id','role','content','evidence','evidence_summary'],
};
const verticalSlot=(col,row)=>({x:left+col*colPitch+clusterW+120,y:top+row*rowPitch+160});
const horizontalSlot=(col,row)=>({x:left+col*colPitch+380,y:top+row*rowPitch+440});
const relations=[
  ['caregivers','elderly_profiles','caregiver_id','cares for',verticalSlot(0,0)],
  ['elderly_profiles','wearable_devices','elderly_id','pairs with',verticalSlot(1,0)],
  ['wearable_devices','wearable_live_state','device_id','streams',verticalSlot(2,0)],
  ['elderly_profiles','vital_sign_logs','elderly_id','records',horizontalSlot(2,0)],
  ['wearable_devices','watch_location_points','device_id','sends',horizontalSlot(3,0)],
  ['elderly_profiles','medication_schedules','elderly_id','plans',horizontalSlot(0,0)],
  ['medication_schedules','medication_logs','schedule_id','tracks dose',verticalSlot(0,1)],
  ['elderly_profiles','appointments','elderly_id','attends',horizontalSlot(0,1)],
  ['elderly_profiles','caregiver_notes','elderly_id','has notes',horizontalSlot(1,1)],
  ['elderly_profiles','patient_safe_zones','elderly_id','sets zone',horizontalSlot(2,1)],
  ['elderly_profiles','safe_zone_events','elderly_id','has boundary',horizontalSlot(3,1)],
  ['health_alerts','safe_zone_events','alert_id','links',horizontalSlot(3,2)],
  ['elderly_profiles','emergency_events','elderly_id','requests help',horizontalSlot(0,2)],
  ['emergency_events','health_alerts','emergency_event_id','raises',verticalSlot(0,3)],
  ['elderly_profiles','health_alerts','elderly_id','generates',horizontalSlot(1,2)],
  ['health_alerts','alert_response_events','alert_id','has response',verticalSlot(1,3)],
  ['health_alerts','caregiver_notifications','alert_id','notifies',horizontalSlot(3,3)],
  ['elderly_profiles','ai_chatbot_sessions','elderly_id','discusses',horizontalSlot(1,3)],
  ['ai_chatbot_sessions','ai_chatbot_messages','session_id','contains',verticalSlot(1,4)],
];

class Heap{
  a=[];
  push(value){const a=this.a;a.push(value);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].priority<=value.priority)break;a[i]=a[p];i=p;}a[i]=value;}
  pop(){const a=this.a;if(!a.length)return null;const first=a[0],last=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let j=2*i+1;if(j+1<a.length&&a[j+1].priority<a[j].priority)j++;if(a[j].priority>=last.priority)break;a[i]=a[j];i=j;}a[i]=last;}return first;}
}

function orthogonalRouter(width,height,step,obstacles,minY){
  const cols=Math.ceil(width/step)+1,rows=Math.ceil(height/step)+1;
  const blocked=new Uint8Array(cols*rows),used=new Uint16Array(cols*rows);
  for(const b of obstacles)for(let y=Math.ceil(b.y/step);y<=Math.floor((b.y+b.h)/step);y++)for(let x=Math.ceil(b.x/step);x<=Math.floor((b.x+b.w)/step);x++)blocked[y*cols+x]=1;
  return function route(start,end){
    const startKey=Math.round(start.y/step)*cols+Math.round(start.x/step),endKey=Math.round(end.y/step)*cols+Math.round(end.x/step);
    if(blocked[startKey]||blocked[endKey])throw Error('Routing port is blocked '+JSON.stringify({start,end}));
    const distance=new Float64Array(cols*rows*5);distance.fill(Infinity);const previous=new Int32Array(cols*rows*5);previous.fill(-1);const open=new Heap();
    const begin=startKey*5+4;distance[begin]=0;open.push({key:begin,priority:0,cost:0});
    const ex=endKey%cols,ey=Math.floor(endKey/cols);let found=-1;
    const moves=[[1,0],[-1,0],[0,1],[0,-1]];
    while(open.a.length){
      const item=open.pop(),state=item.key;if(item.cost!==distance[state])continue;
      const key=Math.floor(state/5),dir=state%5;if(key===endKey){found=state;break;}
      const x=key%cols,y=Math.floor(key/cols);
      for(let direction=0;direction<4;direction++){
        const [dx,dy]=moves[direction],nx=x+dx,ny=y+dy;if(nx<1||nx>=cols-1||ny<minY||ny>=rows-2)continue;
        const next=ny*cols+nx;if(blocked[next])continue;const nextState=next*5+direction;
        const turn=dir===4||dir===direction?0:5;
        const cost=item.cost+1+turn+Math.min(used[next],12)*.4;
        if(cost<distance[nextState]){distance[nextState]=cost;previous[nextState]=state;open.push({key:nextState,cost,priority:cost+Math.abs(nx-ex)+Math.abs(ny-ey)});}
      }
    }
    if(found<0)throw Error('Unable to route relationship');
    const all=[];for(let state=found;state!==-1;state=previous[state]){const key=Math.floor(state/5);all.push({x:key%cols*step,y:Math.floor(key/cols)*step});used[key]++;}all.reverse();
    return all.filter((p,i)=>i===0||i===all.length-1||(all[i-1].x===p.x)!==(p.x===all[i+1].x));
  };
}

function chen(){
  const w=3920,h=2940;
  const nodes=new Map(),diamonds=[],shapes=[],links=[],vertices=[],edges=[],obstacles=[];
  const uid=s=>s.replaceAll('.','-');
  function vertex(id,value,style,x,y,width,height){vertices.push(`<mxCell id="${esc(id)}" value="${esc(value)}" style="${esc(style)}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell>`);}
  function edge(id,from,to,points,color,width=1.5){edges.push(`<mxCell id="${esc(id)}" style="edgeStyle=none;html=1;endArrow=none;strokeColor=${color};strokeWidth=${width};" edge="1" parent="1" source="${esc(from)}" target="${esc(to)}"><mxGeometry relative="1" as="geometry"><Array as="points">${points.slice(1,-1).map(p=>`<mxPoint x="${p.x??p[0]}" y="${p.y??p[1]}"/>`).join('')}</Array></mxGeometry></mxCell>`);}
  const textStyle='text;html=1;strokeColor=none;fillColor=none;fontFamily=Arial;fontColor=#203431;';
  vertex('title','ElderCareAI Chen ERD',textStyle+'fontSize=30;fontStyle=1;',80,30,1800,48);
  vertex('subtitle','18 core entities | Selected attributes | Relationships are named inside diamonds | 7 November 2026',textStyle+'fontSize=16;',80,87,2700,35);
  vertex('legend','Rectangle = entity   Oval = attribute   Underlined = primary key   FK = foreign key   1 and N show maximum cardinality',textStyle+'fontSize=15;',80,130,3400,32);
  for(let row=0;row<slots.length;row++)for(let col=0;col<4;col++){
    const name=slots[row][col];if(!name)continue;const table=tables.get(name),x=left+col*colPitch,y=top+row*rowPitch;
    const node={name,x,y,w:clusterW,h:clusterH,cx:x+380,cy:y+160,ex:x+230,ey:y+132,ew:300,eh:56,col,row};nodes.set(name,node);obstacles.push({x,y,w:clusterW,h:clusterH});
    const color=colors[group(name)];
    vertex(name,name,`rounded=0;whiteSpace=wrap;html=1;fillColor=#DFF0DE;strokeColor=${color};strokeWidth=2;fontFamily=Arial;fontSize=17;fontStyle=1;`,node.ex,node.ey,node.ew,node.eh);
    shapes.push(`<rect x="${node.ex}" y="${node.ey}" width="300" height="56" fill="#DFF0DE" stroke="${color}" stroke-width="2"/>`,text(node.cx,node.cy+6,name,17,'middle','font-weight="700"'));
    const fields=attributes[name];const split=Math.ceil(fields.length/2);
    for(let i=0;i<fields.length;i++){
      const field=fields[i],column=table.columns.find(c=>c.name===field);if(!column)throw Error('Unknown Chen attribute '+name+'.'+field);
      const upper=i<split,count=upper?split:fields.length-split,index=upper?i:i-split;
      const ovalW=(clusterW-(count-1)*12)/count,ax=x+index*(ovalW+12),ay=y+(upper?20:256),cx=ax+ovalW/2,cy=ay+22;
      const primary=pk(table).includes(field),foreign=Boolean(fk(table,field));const label=field+(foreign?' FK':'');const font=count>3?11:12;
      links.push(`<path d="M${node.cx} ${upper?node.ey:node.ey+node.eh}L${cx} ${upper?ay+44:ay}" class="edge" stroke="#A2BEAC" stroke-width="1.2"/>`);
      shapes.push(`<ellipse cx="${cx}" cy="${cy}" rx="${ovalW/2}" ry="22" fill="${foreign?'#ECF6E9':'#F8FCF7'}" stroke="#84A68E" stroke-width="1.2"/>`,text(cx,cy+4,label,font,'middle',primary?'text-decoration="underline" font-weight="700"':''));
      const id=uid(name+'-'+field);vertex(id,label,`ellipse;whiteSpace=wrap;html=1;fillColor=${foreign?'#ECF6E9':'#F8FCF7'};strokeColor=#84A68E;fontFamily=Arial;fontSize=${font};fontStyle=${primary?'5':'0'};`,ax,ay,ovalW,44);
      edge('attribute-'+id,name,id,[{x:node.cx,y:upper?node.ey:node.ey+node.eh},{x:cx,y:upper?ay+44:ay}],'#A2BEAC',1.2);
    }
  }
  relations.forEach(([parent,child,field,label,point],index)=>{
    if(!refs.some(r=>r.parent===parent&&r.child===child&&r.childField===field))throw Error('Chen relationship lacks its declared FK: '+parent+' '+child+' '+field);
    const d={...point,w:160,h:80,id:'relationship-'+index,parent,child,field,label};diamonds.push(d);obstacles.push({x:d.x-80,y:d.y-40,w:160,h:80});
    vertex(d.id,label,'rhombus;whiteSpace=wrap;html=1;fillColor=#E5EFF8;strokeColor=#5B879E;strokeWidth=1.8;fontFamily=Arial;fontSize=14;fontStyle=1;',d.x-80,d.y-40,160,80);
    shapes.push(`<polygon points="${d.x},${d.y-40} ${d.x+80},${d.y} ${d.x},${d.y+40} ${d.x-80},${d.y}" fill="#E5EFF8" stroke="#5B879E" stroke-width="1.8"/>`);
    const words=label.split(' ');if(words.length===1)shapes.push(text(d.x,d.y+5,label,14,'middle','font-weight="700"'));
    else{shapes.push(text(d.x,d.y-4,words[0],14,'middle','font-weight="700"'),text(d.x,d.y+14,words.slice(1).join(' '),14,'middle','font-weight="700"'));}
  });
  const route=orthogonalRouter(w,h,20,obstacles,9);
  const diamondPorts=d=>[
    {side:'left',point:{x:d.x-80,y:d.y},outside:{x:d.x-100,y:d.y}},
    {side:'right',point:{x:d.x+80,y:d.y},outside:{x:d.x+100,y:d.y}},
    {side:'top',point:{x:d.x,y:d.y-40},outside:{x:d.x,y:d.y-60}},
    {side:'bottom',point:{x:d.x,y:d.y+40},outside:{x:d.x,y:d.y+60}},
  ];
  for(const d of diamonds){
    const options=diamondPorts(d);let best=null;
    for(const a of options)for(const b of options){if(a.side===b.side)continue;const parent=nodes.get(d.parent),child=nodes.get(d.child);const cost=Math.abs(parent.cx-a.point.x)+Math.abs(parent.cy-a.point.y)+Math.abs(child.cx-b.point.x)+Math.abs(child.cy-b.point.y);if(!best||cost<best.cost)best={cost,parent:a,child:b};}
    d.ports=best;
  }
  for(const d of diamonds)for(const [which,name] of [['parent',d.parent],['child',d.child]]){
    const n=nodes.get(name),right=d.x>=n.cx,entityPoint={x:right?n.ex+n.ew:n.ex,y:n.cy},outside={x:right?n.x+clusterW+20:n.x-20,y:n.cy};
    const port=d.ports[which],end=port.outside,diamondPoint=port.point;
    const points=[entityPoint,...route(outside,end),diamondPoint];
    links.push(`<path d="${path(points)}" class="edge" stroke="#5A7884" stroke-width="1.7" opacity=".85"/>`);
    edge(d.id+'-'+which,name,d.id,points,'#5A7884',1.7);
    const card=which==='parent'?'1':fullUnique(tables.get(d.child),d.field)?'1':'N';
    const labelX=diamondPoint.x+(port.side==='left'?-18:port.side==='right'?18:-16);
    const labelY=diamondPoint.y+(port.side==='bottom'?25:-8);
    shapes.push(`<rect x="${labelX-12}" y="${labelY-15}" width="24" height="20" fill="white"/>`,text(labelX,labelY,card,14,'middle','font-weight="700"'));
    vertex(d.id+'-'+which+'-card',card,textStyle+'fontSize=14;fontStyle=1;align=center;',labelX-12,labelY-15,24,20);

  }
  const svg=[svgStart(w,h),text(80,70,'ElderCareAI Chen ERD',30,'start','font-weight="700"'),text(80,108,'18 core entities  |  Selected attributes  |  Relationships are named inside diamonds  |  7 November 2026',16),text(80,148,'Rectangle = entity     Oval = attribute     Underlined = primary key     FK = foreign key     1 and N show maximum cardinality',15),...links,...shapes,
    text(80,h-92,'This conceptual ERD shows 19 main declared relationships. The database design contains all 245 fields and all 34 foreign keys between the 18 core tables.',14),
    text(80,h-63,'Optionality and supporting ownership links appear in the database design. A zone is optional; only one configured safe zone and one live-state row are stored per patient.',14),
    text(80,h-34,'zone_revision and zone_name in safe_zone_events are historical snapshots. The diagram does not invent a foreign key from those snapshots to the current zone configuration.',14),'</svg>'];
  save('ElderCareAI_Chen_ERD_UPDATED.svg',svg.join('\n'));
  vertex('footer','19 main declared relationships. Selected attributes; see database design for every field and foreign key.',textStyle+'fontSize=14;',80,h-100,3600,40);
  save('ElderCareAI_Chen_ERD_UPDATED.drawio',`<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net"><diagram id="core-chen" name="ElderCareAI Chen ERD"><mxGraphModel page="1" pageWidth="${w}" pageHeight="${h}" grid="1" gridSize="10"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${edges.join('')}${vertices.join('')}</root></mxGraphModel></diagram></mxfile>`);
  return {width:w,height:h,entities:nodes.size,attributes:Object.values(attributes).reduce((n,a)=>n+a.length,0),diamonds:diamonds.length};
}

dbml();const physicalResult=await physical();const chenResult=chen();
save('core-schema.json',JSON.stringify({...snapshot,relations:[...tables.values()],functions:undefined},null,2));
save('diagram-validation.json',JSON.stringify({database:physicalResult,chen:chenResult,externalAuthReferences:external},null,2));
save('README.md',`# ElderCareAI Updated Database Diagrams\n\nVerified schema date: 7 November 2026. Both diagrams use the dictionary’s 18 core tables.\n\n- Database design: all 245 fields and 34 declared foreign keys within the core model. Five external references to Supabase Auth are marked on the fields without adding another application table.\n- Chen ERD: rectangles for entities, ovals for selected attributes, underlined primary keys and 19 named relationship diamonds. Cardinality labels show maximum 1 or N. Optionality and all supporting ownership links are available in the database design.\n- A patient can have historical watch registrations but only one active registration. A patient has at most one safe-zone configuration and one live-state row.\n- Safe-zone event configuration names and revisions are snapshots, not declared foreign keys. AI evidence record IDs are JSON references, not relational FK columns.\n\nEdit the database source by importing the DBML into dbdiagram.io. Edit the Chen source by opening its DRAWIO file in diagrams.net. SVG files remain sharp when zoomed or placed into a manuscript; PNG files are provided for direct insertion.\n`);
console.log(JSON.stringify({output:out,database:physicalResult,chen:chenResult},null,2));
