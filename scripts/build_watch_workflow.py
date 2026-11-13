"""Build matching editable draw.io XML and a PNG from one watch workflow."""
from pathlib import Path
from xml.etree import ElementTree as E
from PIL import Image,ImageDraw,ImageFont
import math

OUT=Path(__file__).resolve().parents[1]/'output/diagrams/watch-workflow-2026-11-10'
OUT.mkdir(parents=True,exist_ok=True)
W,H=1860,2180
nodes={}
edges=[]
def n(key,label,x,y,w=340,h=90,kind='process'):
 nodes[key]=dict(label=label,x=x,y=y,w=w,h=h,kind=kind)
def edge(a,b,points,label='',at=None):edges.append(dict(a=a,b=b,points=points,label=label,at=at))
n('start','START',300,130,190,72,'terminal')
n('open','Open ElderCareAI\non Galaxy Watch6',300,260)
n('paired','Watch already\npaired?',300,410,280,130,'decision')
n('code','Enter 8-digit code\nfrom the phone app',300,590)
n('valid','Pairing\nsuccessful?',300,760,280,130,'decision')
n('error','Show error\nand retry pairing',300,930)
n('permissions','Required permissions\ngranted?',300,1120,320,150,'decision')
n('settings','Allow sensor, activity\nand location permissions',300,1330,370,100)
n('startmonitor','Tap Start monitoring',300,1520,350,90)
n('service','Start monitoring service',930,260,350)
n('collect','Request sensor readings\nand hybrid location',930,430,350)
n('data','New valid\ndata available?',930,610,290,140,'decision')
n('wait','Show waiting status;\nkeep requesting data',1500,610,350)
n('display','Update watch cards;\nqueue vital measurements',930,810,370,100)
n('internet','Internet\navailable?',930,1000,290,140,'decision')
n('offline','Keep queued vitals;\nretry when connected',1500,1000,350,100)
n('upload','Upload available vitals\nand latest location',930,1190,370,100)
n('saved','Upload\nsuccessful?',930,1380,290,140,'decision')
n('retry','Keep unsent data;\nshow retry status',1500,1380,350,100)
n('phone','Save accepted data;\nupdate caregiver app',930,1570,370,100)
n('action','Use an optional\nwatch action?',1500,1570,300,140,'decision')
n('care','Blood oxygen: manual spot check\nor auto checks while screen is open\n\nMedications: view reminders;\ntap Taken to sync confirmation\n\nSOS: confirm Send SOS;\nsend caregiver alert',1500,1810,460,240)
n('continue','Continue\nmonitoring?',930,1780,290,140,'decision')
n('stop','Tap Stop monitoring',930,1940,350,80)
n('end','FINISH',930,2080,190,72,'terminal')

edge('start','open',[(300,166),(300,215)])
edge('open','paired',[(300,305),(300,345)])
edge('paired','code',[(300,475),(300,545)],'No',(328,505))
edge('paired','permissions',[(160,410),(65,410),(65,1120),(140,1120)],'Yes',(102,450))
edge('code','valid',[(300,635),(300,695)])
edge('valid','error',[(300,825),(300,885)],'No',(328,852))
edge('error','code',[(470,930),(535,930),(535,590),(470,590)],'Retry',(493,658))
edge('valid','permissions',[(160,760),(110,760),(110,1020),(300,1020),(300,1045)],'Yes',(148,985))
edge('permissions','settings',[(300,1195),(300,1280)],'No',(328,1230))
edge('settings','permissions',[(115,1330),(65,1330),(65,1120),(140,1120)],'Retry',(90,1280))
edge('permissions','startmonitor',[(460,1120),(525,1120),(525,1520),(475,1520)],'Yes',(495,1170))
edge('startmonitor','service',[(300,1565),(300,1630),(600,1630),(600,260),(755,260)])
edge('service','collect',[(930,305),(930,385)])
edge('collect','data',[(930,475),(930,540)])
edge('data','wait',[(1075,610),(1325,610)],'No',(1200,580))
edge('wait','collect',[(1500,565),(1500,430),(1105,430)])
edge('data','display',[(930,680),(930,760)],'Yes',(960,710))
edge('display','internet',[(930,860),(930,930)])
edge('internet','offline',[(1075,1000),(1325,1000)],'No',(1200,970))
edge('internet','upload',[(930,1070),(930,1140)],'Yes',(960,1100))
edge('offline','continue',[(1675,1000),(1780,1000),(1780,2020),(1180,2020),(1180,1780),(1075,1780)])
edge('upload','saved',[(930,1240),(930,1310)])
edge('saved','retry',[(1075,1380),(1325,1380)],'No',(1200,1350))
edge('retry','continue',[(1675,1380),(1780,1380),(1780,2020),(1180,2020),(1180,1780),(1075,1780)])
edge('saved','phone',[(930,1450),(930,1520)],'Yes',(960,1480))
edge('phone','continue',[(930,1620),(930,1710)])
edge('service','action',[(1105,260),(1815,260),(1815,1570),(1650,1570)],'Optional',(1730,300))
edge('action','care',[(1500,1640),(1500,1690)],'Yes',(1532,1665))
edge('action','continue',[(1350,1570),(1230,1570),(1230,1665),(930,1665),(930,1710)],'No',(1182,1632))
edge('care','continue',[(1270,1810),(1220,1810),(1220,1780),(1075,1780)])
edge('continue','collect',[(785,1780),(665,1780),(665,430),(755,430)],'Yes',(701,1730))
edge('continue','stop',[(930,1850),(930,1900)],'No',(960,1875))
edge('stop','end',[(930,1980),(930,2044)])

mx=E.Element('mxfile',host='app.diagrams.net',type='device',version='24.7.17')
page=E.SubElement(mx,'diagram',id='watch-workflow',name='Watch Workflow')
model=E.SubElement(page,'mxGraphModel',grid='1',gridSize='10',page='1',pageScale='1',pageWidth=str(W),pageHeight=str(H),connect='1',arrows='1',math='0',shadow='0')
root=E.SubElement(model,'root');E.SubElement(root,'mxCell',id='0');E.SubElement(root,'mxCell',id='1',parent='0')
heading=E.SubElement(root,'mxCell',id='title',value='ElderCareAI Watch Workflow',vertex='1',parent='1',style='text;html=0;align=center;fontFamily=Times New Roman;fontSize=32;fontStyle=1;strokeColor=none;fillColor=none;')
E.SubElement(heading,'mxGeometry',x='500',y='28',width='900',height='55',attrib={'as':'geometry'})
for key,v in nodes.items():
 style='whiteSpace=wrap;html=0;align=center;verticalAlign=middle;fontFamily=Times New Roman;fontSize=24;fontStyle=1;strokeColor=#111111;strokeWidth=2;'
 style+=('ellipse;fillColor=#008000;fontColor=#FFFFFF;' if v['kind']=='terminal' else ('rhombus;' if v['kind']=='decision' else 'rounded=0;')+'fillColor=#D6E8D2;fontColor=#111111;')
 c=E.SubElement(root,'mxCell',id=key,value=v['label'],vertex='1',parent='1',style=style)
 E.SubElement(c,'mxGeometry',x=str(v['x']-v['w']/2),y=str(v['y']-v['h']/2),width=str(v['w']),height=str(v['h']),attrib={'as':'geometry'})
for i,v in enumerate(edges):
 a,b=nodes[v['a']],nodes[v['b']];p0,p1=v['points'][0],v['points'][-1]
 port=lambda n,p:((p[0]-n['x']+n['w']/2)/n['w'],(p[1]-n['y']+n['h']/2)/n['h'])
 sx,sy=port(a,p0);tx,ty=port(b,p1)
 style=f'edgeStyle=none;rounded=0;html=0;endArrow=block;endFill=1;strokeColor=#111111;strokeWidth=2;fontFamily=Times New Roman;fontSize=23;labelBackgroundColor=#FFFFFF;exitX={sx};exitY={sy};entryX={tx};entryY={ty};'
 c=E.SubElement(root,'mxCell',id=f'edge-{i}',value=v['label'],edge='1',parent='1',source=v['a'],target=v['b'],style=style)
 g=E.SubElement(c,'mxGeometry',relative='1',attrib={'as':'geometry'})
 arr=E.SubElement(g,'Array',attrib={'as':'points'})
 for x,y in v['points'][1:-1]:E.SubElement(arr,'mxPoint',x=str(x),y=str(y))
 if v['label'] and v['at']:
  # Absolute labels remain editable and match the PNG even on long return edges.
  c.set('value','');label=E.SubElement(root,'mxCell',id=f'label-{i}',value=v['label'],vertex='1',parent='1',style='text;align=center;verticalAlign=middle;fontFamily=Times New Roman;fontSize=23;fontStyle=1;fillColor=#FFFFFF;strokeColor=none;')
  x,y=v['at'];E.SubElement(label,'mxGeometry',x=str(x-30),y=str(y-16),width='60',height='32',attrib={'as':'geometry'})
E.indent(mx)
for ext in ['drawio','xml']:E.ElementTree(mx).write(OUT/f'ElderCareAI_Watch_Workflow.{ext}',encoding='utf-8',xml_declaration=True)

image=Image.new('RGB',(W,H),'white');draw=ImageDraw.Draw(image)
font=ImageFont.truetype('C:/Windows/Fonts/timesbd.ttf',24);titlefont=ImageFont.truetype('C:/Windows/Fonts/timesbd.ttf',34)
draw.text((W/2,48),'ElderCareAI Watch Workflow',font=titlefont,anchor='mm',fill='black')
for v in edges:
 pts=v['points'];draw.line(pts,fill='black',width=2)
 (x0,y0),(x,y)=pts[-2:];ang=math.atan2(y-y0,x-x0);size=13
 draw.polygon([(x,y),(x-size*math.cos(ang-.45),y-size*math.sin(ang-.45)),(x-size*math.cos(ang+.45),y-size*math.sin(ang+.45))],fill='black')
for v in nodes.values():
 x,y,w,h=v['x'],v['y'],v['w'],v['h'];bounds=(x-w/2,y-h/2,x+w/2,y+h/2)
 if v['kind']=='terminal':draw.ellipse(bounds,fill='#008000',outline='black',width=2)
 elif v['kind']=='decision':draw.polygon([(x,y-h/2),(x+w/2,y),(x,y+h/2),(x-w/2,y)],fill='#D6E8D2',outline='black',width=2)
 else:draw.rectangle(bounds,fill='#D6E8D2',outline='black',width=2)
 draw.multiline_text((x,y),v['label'],font=font,anchor='mm',align='center',spacing=6,fill='white' if v['kind']=='terminal' else 'black')
for v in edges:
 if v['label'] and v['at']:
  x,y=v['at'];bbox=draw.textbbox((x,y),v['label'],font=font,anchor='mm');draw.rectangle((bbox[0]-4,bbox[1]-3,bbox[2]+4,bbox[3]+3),fill='white');draw.text((x,y),v['label'],font=font,anchor='mm',fill='black')
image.save(OUT/'ElderCareAI_Watch_Workflow.png')
assert all(v['a'] in nodes and v['b'] in nodes for v in edges)
for k,v in nodes.items():
 if v['kind']=='decision':assert {e['label'] for e in edges if e['a']==k}=={'Yes','No'},k
print(OUT, len(nodes),'editable nodes',len(edges),'connectors')
