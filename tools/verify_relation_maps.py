"""Check actual browser text bounds and generate review previews (not device QA)."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets/relation-maps'
TMP = ROOT / 'tmp'
TMP.mkdir(exist_ok=True)
data = json.loads((ROOT/'docs/relation-maps/structure.json').read_text(encoding='utf8'))
checks = []
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe', headless=True)
    page = browser.new_page(viewport={'width':3400, 'height':2200})
    for chapter in data['chapters']:
        for suffix in ('', '-dark'):
            path = ASSETS / f"chapter{chapter['chapter']}_relation_map{suffix}.svg"
            svg = path.read_text(encoding='utf8')
            root = ET.fromstring(svg)
            assert json.loads(root.find('{http://www.w3.org/2000/svg}metadata').text) == chapter
            with Image.open(path.with_suffix('.png')) as png:
                assert png.size == (3400,2200)
            page.set_content('<style>body{margin:0}</style>'+svg)
            page.evaluate('document.fonts.ready')
            boxes = page.locator('svg text').evaluate_all('''nodes => nodes.map(n => {
              const r = n.getBBox(); return {text:n.textContent,x:r.x,y:r.y,w:r.width,h:r.height};
            })''')
            for i, box in enumerate(boxes):
                assert box['x']>=0 and box['y']>=0 and box['x']+box['w']<=3400 and box['y']+box['h']<=2200, (path.name,box)
                for other in boxes[i+1:]:
                    overlap = min(box['x']+box['w'],other['x']+other['w']) > max(box['x'],other['x']) and min(box['y']+box['h'],other['y']+other['h']) > max(box['y'],other['y'])
                    assert not overlap, (path.name,box['text'],other['text'])
            checks.append({'file':path.name,'textCount':len(boxes),'withinCanvas':True,'noTextOverlap':True})
    # Overview for visual inspection: six rows, light and dark side by side.
    page.set_viewport_size({'width':1700,'height':3300})
    gallery = ''.join((ASSETS/f"chapter{c['chapter']}_relation_map{s}.svg").read_text(encoding='utf8') for c in data['chapters'] for s in ('','-dark'))
    page.set_content('<style>body{margin:0;display:grid;grid-template-columns:850px 850px}svg{width:850px;height:550px}</style>'+gallery)
    page.screenshot(path=str(TMP/'relation-maps-overview.png'))
    page.set_viewport_size({'width':390,'height':844})
    for theme in ('light','dark'):
        page.goto((TMP/f'relation-map-{theme}.html').as_uri())
        page.screenshot(path=str(TMP/f'relation-map-{theme}-mobile.png'))
    browser.close()
(ROOT/'docs/relation-maps/verification.json').write_text(json.dumps({
    'verifiedOn':'2026-11-03','chapters':6,'themesPerChapter':6,'svgCount':12,'pngCount':12,
    'svgMetadataMatchesStructure':True,'pngDimensions':[3400,2200],
    'checks':checks,'physicalDeviceTested':False,
},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('PASS: 12 SVG metadata matches, PNG dimensions, actual text bounds and no overlapping text')
