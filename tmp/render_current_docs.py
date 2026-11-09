from pathlib import Path
import pypdfium2 as pdfium
from PIL import Image, ImageOps, ImageDraw

root = Path('C:/ELDERCAREAI-CAPSTONE/tmp/current-system-doc-qa')
for pdf in root.glob('*.pdf'):
    doc = pdfium.PdfDocument(pdf)
    thumbs = []
    for i, page in enumerate(doc):
        image = page.render(scale=2).to_pil().convert('RGB')
        image.save(root / f'{pdf.stem}_page_{i+1}.png')
        image.thumbnail((650, 850))
        canvas = Image.new('RGB', (670, 890), 'white')
        canvas.paste(image, ((670-image.width)//2, 25))
        ImageDraw.Draw(canvas).text((12, 6), f'{pdf.stem} page {i+1}', fill='black')
        thumbs.append(canvas)
    if thumbs:
        sheet = Image.new('RGB', (670*2, 890*((len(thumbs)+1)//2)), '#cccccc')
        for i, thumb in enumerate(thumbs):
            sheet.paste(thumb, ((i%2)*670, (i//2)*890))
        sheet.save(root / f'{pdf.stem}_contact.png')
