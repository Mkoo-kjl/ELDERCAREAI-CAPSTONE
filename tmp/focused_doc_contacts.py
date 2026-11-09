from pathlib import Path
import pypdfium2 as pdfium
from PIL import Image,ImageDraw

root=Path('C:/ELDERCAREAI-CAPSTONE/tmp/focused-doc-qa')
for pdf in root.glob('*.pdf'):
    pages=[]
    doc=pdfium.PdfDocument(pdf)
    for i,page in enumerate(doc):
        image=page.render(scale=1.4).to_pil().convert('RGB')
        image.save(root/f'{pdf.stem}_page_{i+1}.png')
        image.thumbnail((590,760))
        tile=Image.new('RGB',(610,800),'white')
        tile.paste(image,((610-image.width)//2,24))
        ImageDraw.Draw(tile).text((10,6),f'{pdf.stem} page {i+1}',fill='black')
        pages.append(tile)
    for start in range(0,len(pages),4):
        sheet=Image.new('RGB',(1220,1600),'#dddddd')
        for k,tile in enumerate(pages[start:start+4]):sheet.paste(tile,((k%2)*610,(k//2)*800))
        sheet.save(root/f'{pdf.stem}_contact_{start//4+1}.png')
