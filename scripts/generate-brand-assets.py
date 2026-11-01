"""Generate deterministic favicon and social card from the existing compass identity."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'dist' / 'assets'
NAVY = '#103f4f'
MINT = '#9bd5cd'
WHITE = '#ffffff'
def compass(draw, cx, cy, radius):
    draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius),outline=WHITE,width=max(2,round(radius*.025)))
    r=radius*.78;s=radius*.18
    draw.polygon([(cx,cy-r),(cx+s,cy-s),(cx+r,cy),(cx+s,cy+s),(cx,cy+r),(cx-s,cy+s),(cx-r,cy),(cx-s,cy-s)],fill=WHITE)
    draw.polygon([(cx,cy-r),(cx,cy),(cx+s,cy-s)],fill=MINT)
    draw.polygon([(cx,cy+r),(cx,cy),(cx-s,cy+s)],fill=MINT)
    d=radius*.09
    draw.ellipse((cx-d,cy-d,cx+d,cy+d),fill=NAVY)
icon=Image.new('RGB',(512,512),NAVY)
compass(ImageDraw.Draw(icon),256,256,196)
icon.save(ASSETS/'favicon.ico',format='ICO',sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
icon.resize((32,32),Image.Resampling.LANCZOS).save(ASSETS/'favicon-32.png')
icon.resize((180,180),Image.Resampling.LANCZOS).save(ASSETS/'apple-touch-icon.png')
card=Image.new('RGB',(1200,630),NAVY);d=ImageDraw.Draw(card)
def font(size,bold=False):
    return ImageFont.truetype(str(ASSETS/('font-5.ttf' if bold else 'font-2.ttf')),size)
d.text((80,74),'ESTUDIA EN TU MÓVIL',font=font(21,True),fill=MINT)
d.text((76,197),'Bitácora PER',font=font(87,True),fill=WHITE)
d.text((80,317),'Patrón de Embarcaciones de Recreo',font=font(28),fill=WHITE)
d.line((80,425,1120,425),fill='#52707a',width=1)
d.text((80,474),'Tests de 10  ·  Simulacros de 45',font=font(29,True),fill=WHITE)
d.text((80,542),'py-qwerty.github.io/bitacora-per',font=font(19),fill=MINT)
compass(d,1000,264,112)
card.save(ASSETS/'share-cover-v1.png',optimize=True)
print('Created favicon.ico, favicon-32.png, apple-touch-icon.png and share-cover-v1.png')
