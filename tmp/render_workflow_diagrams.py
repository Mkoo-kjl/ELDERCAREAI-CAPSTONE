from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from docx import Document

ROOT=Path('C:/ELDERCAREAI-CAPSTONE')
doc=Document(ROOT/'output/documents/2026-11-08-current-system/ElderCareAI_Workflows_Current.docx')
out=ROOT/'output/diagrams/revised_2026-11-08'
font_path='C:/Windows/Fonts/segoeui.ttf'
bold_path='C:/Windows/Fonts/segoeuib.ttf'
font=ImageFont.truetype(font_path,22)
small=ImageFont.truetype(font_path,18)
bold=ImageFont.truetype(bold_path,26)
title_font=ImageFont.truetype(bold_path,42)

def wrap(draw,text,max_width,face):
    lines=[];line=''
    for word in text.split():
        next_line=(line+' '+word).strip()
        if line and draw.textlength(next_line,font=face)>max_width:
            lines.append(line);line=word
        else:line=next_line
    if line:lines.append(line)
    return lines

def center_text(draw,box,text,face,color):
    x1,y1,x2,y2=box
    lines=wrap(draw,text,x2-x1-36,face)
    gap=face.size+7
    start=(y1+y2-len(lines)*gap)/2
    for i,line in enumerate(lines):
        width=draw.textlength(line,font=face)
        draw.text(((x1+x2-width)/2,start+i*gap),line,font=face,fill=color)

def arrow(draw,points,color,width=4):
    draw.line(points,fill=color,width=width,joint='curve')
    x,y=points[-1];px,py=points[-2]
    if x>px:tip=[(x,y),(x-12,y-7),(x-12,y+7)]
    elif x<px:tip=[(x,y),(x+12,y-7),(x+12,y+7)]
    else:tip=[(x,y),(x-7,y-12),(x+7,y-12)]
    draw.polygon(tip,fill=color)

for name,table in [('program-workflow',doc.tables[0]),('admin-workflow',doc.tables[1])]:
    rows=[[cell.text for cell in row.cells] for row in table.rows[1:]]
    width=1600;top=190;step=202;height=top+len(rows)*step+100
    image=Image.new('RGB',(width,height),'#FFFFFF');draw=ImageDraw.Draw(image)
    heading='Program Workflow' if name.startswith('program') else 'Administrator Workflow'
    draw.text((80,55),f'ElderCareAI {heading}',font=title_font,fill='#173D42')
    draw.text((80,115),'Follow the Yes or No outcome at each numbered decision.',font=font,fill='#425A5C')
    for index,(number,decision,yes,no) in enumerate(rows):
        if name=='program-workflow':
            decision={'8':'Watch location accurate?', '12':'Prescription reviewed and confirmed?'}.get(number,decision)
        y=top+index*step
        if index<len(rows)-1:arrow(draw,[(800,y+143),(800,y+step-18)],'#568891',3)
        # Decision diamond with outcome boxes on either side.
        draw.polygon([(800,y),(1000,y+68),(800,y+136),(600,y+68)],fill='#E8F2E9',outline='#3E7854',width=3)
        center_text(draw,(660,y+13,940,y+121),f'{number}. {decision}',small,'#173D42')
        draw.rounded_rectangle((55,y+15,520,y+130),radius=20,fill='#FFF4ED',outline='#BB765A',width=3)
        draw.rounded_rectangle((1080,y+15,1545,y+130),radius=20,fill='#EAF6F7',outline='#347E89',width=3)
        center_text(draw,(67,y+20,508,y+125),no,font,'#553E33')
        center_text(draw,(1092,y+20,1533,y+125),yes,font,'#173D42')
        arrow(draw,[(600,y+68),(525,y+68)],'#BB765A')
        arrow(draw,[(1000,y+68),(1075,y+68)],'#347E89')
        draw.text((538,y+30),'NO',font=bold,fill='#984B30')
        draw.text((1017,y+30),'YES',font=bold,fill='#246775')
    draw.text((700,height-70),'END OF WORKFLOW',font=bold,fill='#173D42')
    image.save(out/f'{name}.png')
    print(out/f'{name}.png')
