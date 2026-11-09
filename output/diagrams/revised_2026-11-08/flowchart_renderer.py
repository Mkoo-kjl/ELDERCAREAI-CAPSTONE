"""Render the ElderCareAI program/admin flowcharts and matching Mermaid sources.

Run with Python 3 and Pillow from any working directory. The PNG and .mmd
files are generated from the same nodes and directed edges below.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LOGO = ROOT / 'assets/images/eldercare-logo.png'
FONT = 'C:/Windows/Fonts/segoeui.ttf'
BOLD = 'C:/Windows/Fonts/segoeuib.ttf'


def node(kind, x, y, w, h, label):
    return dict(kind=kind, x=x, y=y, w=w, h=h, label=label)


def edge(src, dst, points, label='', label_at=None):
    return dict(src=src, dst=dst, points=points, label=label, label_at=label_at)


ADMIN_NODES = {
    'start': node('terminal', 950, 150, 210, 68, 'START'),
    'login': node('action', 950, 270, 340, 78, 'Sign in as administrator'),
    'auth': node('decision', 950, 425, 350, 120, 'Sign in successful?'),
    'retry': node('action', 310, 425, 300, 76, 'Check details and retry'),
    'role': node('decision', 950, 595, 350, 120, 'Active admin role?'),
    'denied': node('action', 1530, 595, 270, 76, 'Access denied'),
    'denied_end': node('terminal', 1530, 750, 195, 64, 'FINISH'),
    'dashboard': node('action', 950, 785, 430, 82, 'Open admin dashboard'),
    'accounts': node('action', 420, 970, 410, 86, 'Review caregiver and patient records'),
    'monitor': node('action', 1470, 970, 430, 86, 'Review sync, alerts and security'),
    'change': node('decision', 420, 1140, 350, 120, 'Change an account?'),
    'confirm': node('decision', 420, 1320, 350, 120, 'Change confirmed?'),
    'save': node('action', 420, 1490, 370, 84, 'Save change and audit action'),
    'report': node('decision', 1470, 1140, 350, 120, 'Export or change access?'),
    'valid': node('decision', 1470, 1320, 350, 120, 'Valid and confirmed?'),
    'export': node('action', 1470, 1490, 370, 84, 'Export CSV or update access'),
    'more': node('decision', 950, 1690, 350, 120, 'Another admin task?'),
    'finish': node('terminal', 950, 1870, 210, 68, 'FINISH'),
}

ADMIN_EDGES = [
    edge('start','login',[(950,184),(950,231)]),
    edge('login','auth',[(950,309),(950,365)]),
    edge('auth','retry',[(775,425),(460,425)],'No',(620,392)),
    edge('retry','login',[(160,425),(125,425),(125,270),(780,270)],'Retry',(210,245)),
    edge('auth','role',[(950,485),(950,535)],'Yes',(975,505)),
    edge('role','denied',[(1125,595),(1395,595)],'No',(1250,562)),
    edge('denied','denied_end',[(1530,633),(1530,718)]),
    edge('role','dashboard',[(950,655),(950,744)],'Yes',(975,691)),
    edge('dashboard','accounts',[(950,826),(950,885),(420,885),(420,927)],'Accounts',(540,855)),
    edge('dashboard','monitor',[(950,885),(1470,885),(1470,927)],'Monitor / reports',(1240,855)),
    edge('accounts','change',[(420,1013),(420,1080)]),
    edge('change','confirm',[(420,1200),(420,1260)],'Yes',(445,1220)),
    edge('confirm','save',[(420,1380),(420,1448)],'Yes',(445,1408)),
    edge('change','more',[(245,1140),(135,1140),(135,1600),(950,1600),(950,1630)],'No',(175,1108)),
    edge('confirm','more',[(245,1320),(185,1320),(185,1600),(950,1600),(950,1630)],'No',(195,1284)),
    edge('save','more',[(420,1532),(420,1600),(950,1600),(950,1630)]),
    edge('monitor','report',[(1470,1013),(1470,1080)]),
    edge('report','valid',[(1470,1200),(1470,1260)],'Yes',(1495,1220)),
    edge('valid','export',[(1470,1380),(1470,1448)],'Yes',(1495,1408)),
    edge('report','more',[(1645,1140),(1770,1140),(1770,1600),(950,1600),(950,1630)],'No',(1670,1108)),
    edge('valid','more',[(1645,1320),(1720,1320),(1720,1600),(950,1600),(950,1630)],'No',(1670,1284)),
    edge('export','more',[(1470,1532),(1470,1600),(950,1600),(950,1630)]),
    edge('more','dashboard',[(1125,1690),(1840,1690),(1840,785),(1165,785)],'Yes',(1145,1650)),
    edge('more','finish',[(950,1750),(950,1836)],'No',(975,1780)),
]

PROGRAM_NODES = {
    'start': node('terminal',1000,145,210,68,'START'),
    'login': node('action',1000,265,350,80,'Sign in as caregiver'),
    'auth': node('decision',1000,420,350,120,'Sign in successful?'),
    'retry': node('action',340,420,300,78,'Check details and retry'),
    'profile': node('decision',1000,585,350,120,'Profiles complete?'),
    'setup': node('action',340,585,350,84,'Complete caregiver and patient setup'),
    'watch': node('decision',1000,750,350,120,'Galaxy Watch6 ready?'),
    'pair': node('action',340,750,350,84,'Pair watch and allow permissions'),
    'dashboard': node('action',1000,920,420,84,'Open caregiver dashboard'),
    'monitor': node('action',1000,1055,370,84,'Start watch monitoring'),
    'data': node('decision',1000,1215,350,120,'Fresh watch data available?'),
    'waiting': node('action',340,1215,330,84,'Show waiting or offline status'),
    'save': node('action',1000,1385,440,90,'Save patient-scoped vitals and GPS'),
    'vitals': node('action',455,1550,430,86,'Update vitals, history and insights'),
    'location': node('action',1545,1550,430,86,'Update watch map and safe zone'),
    'threshold': node('decision',455,1720,350,120,'Vital threshold crossed?'),
    'accuracy': node('decision',1545,1720,350,120,'GPS fix reliable?'),
    'vital_alert': node('action',455,1880,380,84,'Save vital alert and notify'),
    'zone': node('decision',1545,1880,350,120,'Outside safe zone?'),
    'location_alert': node('action',1545,2035,380,84,'Save location alert and notify'),
    'due': node('decision',1000,2200,350,120,'Care reminder due?'),
    'remind': node('action',1545,2200,370,84,'Queue each medication or visit alert'),
    'action': node('decision',1000,2390,350,120,'Caregiver chooses action?'),
    'care': node('action',370,2575,500,100,'Manage medications, visits and prescription draft'),
    'insights': node('action',1000,2575,390,100,'Review trends, Elle and history'),
    'sos': node('decision',1630,2575,350,120,'SOS confirmed?'),
    'rx': node('decision',370,2760,350,120,'Prescription verified?'),
    'rx_save': node('action',370,2915,390,84,'Save corrected medication schedule'),
    'emergency': node('action',1630,2760,410,88,'Save SOS and show priority contacts'),
    'continue': node('decision',1000,3130,350,120,'Continue monitoring?'),
    'finish': node('terminal',1000,3300,210,68,'FINISH'),
}

PROGRAM_EDGES = [
    edge('start','login',[(1000,179),(1000,225)]),
    edge('login','auth',[(1000,305),(1000,360)]),
    edge('auth','retry',[(825,420),(490,420)],'No',(650,387)),
    edge('retry','login',[(190,420),(130,420),(130,265),(825,265)],'Retry',(230,240)),
    edge('auth','profile',[(1000,480),(1000,525)],'Yes',(1025,495)),
    edge('profile','setup',[(825,585),(515,585)],'No',(650,552)),
    edge('setup','profile',[(340,627),(340,665),(760,665),(760,585),(825,585)],'Retry',(620,637)),
    edge('profile','watch',[(1000,645),(1000,690)],'Yes',(1025,660)),
    edge('watch','pair',[(825,750),(515,750)],'No',(650,717)),
    edge('pair','watch',[(340,792),(340,830),(760,830),(760,750),(825,750)],'Retry',(620,802)),
    edge('watch','dashboard',[(1000,810),(1000,878)],'Yes',(1025,832)),
    edge('dashboard','monitor',[(1000,962),(1000,1013)]),
    edge('monitor','data',[(1000,1097),(1000,1155)]),
    edge('data','waiting',[(825,1215),(505,1215)],'No',(650,1182)),
    edge('waiting','monitor',[(175,1215),(135,1215),(135,1055),(815,1055)],'Retry',(220,1030)),
    edge('data','save',[(1000,1275),(1000,1340)],'Yes',(1025,1300)),
    edge('save','vitals',[(1000,1430),(1000,1480),(455,1480),(455,1507)],'Vitals',(560,1450)),
    edge('save','location',[(1000,1480),(1545,1480),(1545,1507)],'Location',(1370,1450)),
    edge('vitals','threshold',[(455,1593),(455,1660)]),
    edge('threshold','vital_alert',[(455,1780),(455,1838)],'Yes',(480,1800)),
    edge('threshold','due',[(280,1720),(190,1720),(190,2125),(1000,2125),(1000,2140)],'No',(220,1688)),
    edge('vital_alert','due',[(455,1922),(455,2125),(1000,2125),(1000,2140)]),
    edge('location','accuracy',[(1545,1593),(1545,1660)]),
    edge('accuracy','zone',[(1545,1780),(1545,1820)],'Yes',(1570,1790)),
    edge('accuracy','due',[(1720,1720),(1840,1720),(1840,2125),(1000,2125),(1000,2140)],'No',(1740,1688)),
    edge('zone','location_alert',[(1545,1940),(1545,1993)],'Yes',(1570,1955)),
    edge('zone','due',[(1720,1880),(1790,1880),(1790,2125),(1000,2125),(1000,2140)],'No',(1730,1848)),
    edge('location_alert','due',[(1545,2077),(1545,2125),(1000,2125),(1000,2140)]),
    edge('due','remind',[(1175,2200),(1360,2200)],'Yes',(1240,2165)),
    edge('remind','action',[(1545,2242),(1545,2300),(1000,2300),(1000,2330)]),
    edge('due','action',[(1000,2260),(1000,2330)],'No',(1025,2280)),
    edge('action','care',[(825,2390),(370,2390),(370,2525)],'Care plan',(530,2355)),
    edge('action','insights',[(1000,2450),(1000,2525)],'Review',(1025,2470)),
    edge('action','sos',[(1175,2390),(1630,2390),(1630,2515)],'SOS',(1390,2355)),
    edge('care','rx',[(370,2625),(370,2700)]),
    edge('rx','rx_save',[(370,2820),(370,2873)],'Yes',(395,2836)),
    edge('rx','continue',[(195,2760),(135,2760),(135,3050),(1000,3050),(1000,3070)],'No',(155,2728)),
    edge('rx_save','continue',[(370,2957),(370,3050),(1000,3050),(1000,3070)]),
    edge('insights','continue',[(1000,2625),(1000,3070)]),
    edge('sos','emergency',[(1630,2635),(1630,2716)],'Yes',(1655,2660)),
    edge('sos','continue',[(1805,2575),(1865,2575),(1865,3050),(1000,3050),(1000,3070)],'No',(1810,2538)),
    edge('emergency','continue',[(1630,2804),(1630,3050),(1000,3050),(1000,3070)]),
    edge('continue','monitor',[(1175,3130),(1940,3130),(1940,1055),(1185,1055)],'Yes',(1200,3095)),
    edge('continue','finish',[(1000,3190),(1000,3266)],'No',(1025,3210)),
]


def load_font(path, size):
    return ImageFont.truetype(path, size)


def wrap(draw, text, font, max_width):
    lines=[];current=''
    for word in text.split():
        next_line=(current+' '+word).strip()
        if current and draw.textlength(next_line,font=font)>max_width:
            lines.append(current);current=word
        else:current=next_line
    if current:lines.append(current)
    return lines


def draw_node(draw, spec):
    x,y,w,h=spec['x'],spec['y'],spec['w'],spec['h']
    left,top,right,bottom=x-w/2,y-h/2,x+w/2,y+h/2
    kind=spec['kind']
    if kind=='terminal':
        draw.ellipse((left,top,right,bottom),fill='#AAEF9B',outline='#173D42',width=4)
    elif kind=='decision':
        draw.polygon([(x,top),(right,y),(x,bottom),(left,y)],fill='#FFFFFF',outline='#173D42',width=4)
    else:
        draw.rectangle((left,top,right,bottom),fill='#FFFFFF',outline='#173D42',width=4)
    font=load_font(BOLD if kind=='terminal' else FONT,24 if kind=='terminal' else 21)
    max_width=w*(.62 if kind=='decision' else .88)
    lines=wrap(draw,spec['label'],font,max_width)
    line_height=font.size+5
    first=y-len(lines)*line_height/2
    for index,line in enumerate(lines):
        text_width=draw.textlength(line,font=font)
        draw.text((x-text_width/2,first+index*line_height),line,font=font,fill='#142D31')


def draw_edge(draw, spec):
    pts=spec['points']
    draw.line(pts,fill='#263B3F',width=4,joint='curve')
    x,y=pts[-1]; px,py=pts[-2]
    if x>px: triangle=[(x,y),(x-14,y-8),(x-14,y+8)]
    elif x<px: triangle=[(x,y),(x+14,y-8),(x+14,y+8)]
    elif y>py: triangle=[(x,y),(x-8,y-14),(x+8,y-14)]
    else: triangle=[(x,y),(x-8,y+14),(x+8,y+14)]
    draw.polygon(triangle,fill='#263B3F')
    if spec['label']:
        lx,ly=spec['label_at']
        label_font=load_font(BOLD,19)
        tw=draw.textlength(spec['label'],font=label_font)
        draw.rectangle((lx-4,ly-2,lx+tw+4,ly+25),fill='white')
        draw.text((lx,ly),spec['label'],font=label_font,fill='#174F5A')


def mermaid(nodes, edges, title):
    lines=['---',f'title: ElderCareAI {title} Workflow','---','flowchart TD']
    for name,spec in nodes.items():
        text=spec['label'].replace('"','')
        shape=spec['kind']
        if shape=='decision': lines.append(f'  {name}{{"{text}"}}')
        elif shape=='terminal': lines.append(f'  {name}(["{text}"])')
        else: lines.append(f'  {name}["{text}"]')
    for spec in edges:
        connector=f'-->|{spec["label"]}|' if spec['label'] else '-->'
        lines.append(f'  {spec["src"]} {connector} {spec["dst"]}')
    lines.extend([
        '  classDef terminal fill:#AAEF9B,stroke:#173D42,color:#142D31;',
        '  classDef decision fill:#FFFFFF,stroke:#173D42,color:#142D31;',
        '  classDef action fill:#FFFFFF,stroke:#173D42,color:#142D31;',
        '  class '+','.join(k for k,v in nodes.items() if v['kind']=='terminal')+' terminal;',
        '  class '+','.join(k for k,v in nodes.items() if v['kind']=='decision')+' decision;',
        '  class '+','.join(k for k,v in nodes.items() if v['kind']=='action')+' action;',
    ])
    return '\n'.join(lines)+'\n'


def render(filename, title, nodes, edges, width, height):
    image=Image.new('RGB',(width,height),'white')
    draw=ImageDraw.Draw(image)
    logo=Image.open(LOGO).convert('RGBA')
    logo.thumbnail((112,112))
    image.paste(logo,(70,44),logo)
    draw.text((210,58),f'ElderCareAI {title} Workflow',font=load_font(BOLD,44),fill='#142D31')
    for spec in edges:draw_edge(draw,spec)
    for spec in nodes.values():draw_node(draw,spec)
    image.save(HERE/f'{filename}.png')
    (HERE/f'{filename}.mmd').write_text(mermaid(nodes,edges,title),encoding='utf8')
    print(HERE/f'{filename}.png')
    print(HERE/f'{filename}.mmd')


if __name__=='__main__':
    render('admin-workflow','Administrator',ADMIN_NODES,ADMIN_EDGES,1900,1970)
    render('program-workflow','Program',PROGRAM_NODES,PROGRAM_EDGES,2000,3400)
