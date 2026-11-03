"""Build SVG, PNG and embedded app data from docs/relation-maps/structure.json.
Requires Pillow, playwright and a local Chrome install (--browser can override).
"""
from pathlib import Path
from html import escape as E
import argparse, json, subprocess, sys
from PIL import ImageFont
R = Path(__file__).resolve().parents[1]
ASSETS = R / 'assets/relation-maps'
DOCS = R / 'docs/relation-maps'
data = json.loads((DOCS / 'structure.json').read_text(encoding='utf8'))
maps = data['chapters']
parser = argparse.ArgumentParser()
parser.add_argument('--svg-only', action='store_true', help='Skip PNG previews explicitly')
parser.add_argument('--browser', default='C:/Program Files/Google/Chrome/Application/chrome.exe')
args = parser.parse_args()
LIGHT=['#326F9B','#527D94','#398574','#AF792D','#B46758','#7D8951']
DARK=['#81B9E2','#96B8CF','#7FCBB9','#E2B269','#E29D8F','#B5C38A']
metrics=[]
def svg(m,dark=False):
 bg,fg,muted,center,edge=('#0C1623','#E4EDF5','#A3B4C5','#14283B','#35536B') if dark else ('#FFFFFF','#233C50','#647B8C','#F1F6FA','#CFDFEC')
 colors=DARK if dark else LIGHT
 pieces=[f'<svg xmlns="http://www.w3.org/2000/svg" width="3400" height="2200" viewBox="0 0 3400 2200" role="img" aria-labelledby="title desc">',f'<title id="title">第{m["chapter"]}章 {E(m["title"])}の相関図</title>',f'<desc id="desc">中央の{E(m["center"])}から6つのテーマと18の主要項目へ枝分かれする相関図。</desc>',f'<metadata>{E(json.dumps(m,ensure_ascii=False))}</metadata>',f'<rect width="3400" height="2200" fill="{bg}"/>',f'<g font-family="Meiryo, Noto Sans CJK JP, sans-serif" fill="{fg}" stroke-linecap="round" stroke-linejoin="round">']
 def path(d,c,w,op=1):pieces.append(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" opacity="{op}"/>')
 def text(x,y,label,size=32,weight=500,anchor='start',color=fg,max_width=None):
  if max_width:
   while size>25 and ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',size).getlength(label)>max_width:size-=1
   width=ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc',size).getlength(label)
   assert width<=max_width,(m['chapter'],label,width,max_width)
   metrics.append(dict(chapter=m['chapter'],theme='dark' if dark else 'light',text=label,fontSize=size,width=round(width,1),available=max_width))
  pieces.append(f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="{size}" font-weight="{weight}" fill="{color}">{E(label)}</text>')
 text(1700,78,f'第{m["chapter"]}章  {m["title"]}',44,700,'middle')
 text(1700,138,'中心から外へ、用語の役割とつながりをたどる',30,500,'middle',muted)
 for i,br in enumerate(m['branches']):
  left=i<3;row=i%3; y=430+row*660;c=colors[i]
  if left:
   path(f'M 1510 1100 C 1440 1100 1450 {y} 1390 {y} L 1080 {y}',c,17)
   text(1090,y-28,br['title'],48,700,color=c,max_width=300)
  else:
   path(f'M 1890 1100 C 1960 1100 1950 {y} 2010 {y} L 2320 {y}',c,17)
   text(2310,y-28,br['title'],48,700,'end',c,300)
  for j,topic in enumerate(br['topics']):
   ty=y-210+j*220
   if left:
    path(f'M 1080 {y} C 1025 {y} 1040 {ty} 990 {ty} L 740 {ty}',c,7,.85)
    text(755,ty-18,topic['name'],36,700,color=c,max_width=230)
   else:
    path(f'M 2320 {y} C 2375 {y} 2360 {ty} 2410 {ty} L 2660 {ty}',c,7,.85)
    text(2645,ty-18,topic['name'],36,700,'end',c,230)
   for k,line in enumerate(topic['lines']):
    ly=ty+(k-(len(topic['lines'])-1)/2)*64
    if left:
     path(f'M 740 {ty} C 690 {ty} 695 {ly} 640 {ly} L 90 {ly}',c,4,.8)
     text(108,ly-14,line,32,max_width=535)
    else:
     path(f'M 2660 {ty} C 2710 {ty} 2705 {ly} 2760 {ly} L 3310 {ly}',c,4,.8)
     text(3292,ly-14,line,32,anchor='end',max_width=535)
 pieces.append(f'<circle cx="1700" cy="1100" r="200" fill="{center}" stroke="{edge}" stroke-width="3"/>')
 text(1700,1025,m['center'],48,700,'middle',fg,370)
 for k,line in enumerate(m['summary']):text(1700,1080+k*50,line,29,600,'middle',fg,355)
 # Small line icons are deliberately secondary to the concepts.
 if m['chapter'] in (1,5):
  path('M 1655 1162 L 1724 1162 L 1754 1192 L 1754 1252 L 1655 1252 Z M 1724 1162 L 1724 1192 L 1754 1192 M 1672 1206 L 1736 1206 M 1672 1224 L 1708 1224',colors[0],5)
  path('M 1701 1236 L 1715 1248 L 1740 1224',colors[2],5)
 elif m['chapter']==3:
  path('M 1620 1220 L 1780 1220 M 1700 1175 L 1700 1220 M 1640 1220 L 1623 1250 L 1657 1250 Z',colors[0],5)
  pieces.append(f'<rect x="1728" y="1184" width="36" height="36" rx="3" fill="{colors[3]}"/>')
 elif m['chapter']==2:
  path('M 1630 1245 L 1630 1188 L 1700 1155 L 1770 1188 L 1770 1245 Z M 1680 1245 L 1680 1205 L 1720 1205 L 1720 1245',colors[0],5)
 elif m['chapter']==4:
  pieces.append(f'<rect x="1675" y="1175" width="60" height="78" rx="15" fill="none" stroke="{colors[4]}" stroke-width="5"/>')
  path('M 1690 1175 L 1690 1160 L 1730 1150 M 1690 1160 L 1735 1170 M 1675 1185 C 1635 1185 1640 1210 1640 1240 L 1652 1240',colors[0],5)
 else:
  pieces.append(f'<circle cx="1680" cy="1195" r="34" fill="none" stroke="{colors[0]}" stroke-width="5"/>')
  path('M 1705 1220 L 1745 1260',colors[0],7)
 pieces.append('</g></svg>')
 return '\n'.join(pieces)+'\n'

for m in maps:
    assert len(m['branches']) == 6
    body = (R.parent / m['source']).read_text(encoding='utf8')
    for branch in m['branches']:
        assert len(branch['topics']) == 3
        for topic in branch['topics']:
            for ref in topic['references']: assert ref in body, (m['chapter'], ref)
    for dark in (False, True):
        name = f"chapter{m['chapter']}_relation_map" + ('-dark' if dark else '') + '.svg'
        (ASSETS / name).write_text(svg(m, dark), encoding='utf8', newline='\n')
(DOCS / 'text-layout-validation.json').write_text(json.dumps({'textCount':len(metrics),'allWithinBounds':True,'text':metrics},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
if not args.svg_only:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=args.browser, headless=True)
        page = browser.new_page(viewport={'width':3400,'height':2200}, device_scale_factor=1)
        for path in sorted(ASSETS.glob('*.svg')):
            page.set_content('<style>html,body{margin:0;padding:0;overflow:hidden}</style>' + path.read_text(encoding='utf8'))
            page.evaluate('document.fonts.ready')
            page.screenshot(path=str(path.with_suffix('.png')))
        browser.close()
subprocess.run([sys.executable, str(R/'tools/gen_relmaps.py')], cwd=R, check=True)
print('Validated and generated 6 chapters / 12 themed SVGs' + ('' if args.svg_only else ' and PNGs'))
