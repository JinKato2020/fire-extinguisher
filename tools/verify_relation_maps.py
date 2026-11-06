"""Browser verification of diagram text and actual-screen DOM previews (not device QA)."""
from pathlib import Path
import json
from PIL import Image
from playwright.sync_api import sync_playwright

R = Path(__file__).resolve().parents[1]
DOCS, TMP = R/'docs/relation-maps', R/'tmp/relation-redesign'
data = json.loads((DOCS/'structure.json').read_text(encoding='utf8'))
checks, screens = [], []
with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe', headless=True)
    page = browser.new_page()
    for chapter in data['chapters']:
        gallery = []
        for diagram in chapter['diagrams']:
            for suffix in ('', '-dark'):
                path = R/'assets/relation-maps'/(diagram['asset'] + suffix + '.svg')
                with Image.open(path.with_suffix('.png')) as png: assert png.size == (diagram['width'], diagram['height'])
                xml = path.read_text(encoding='utf8')
                page.set_viewport_size(dict(width=diagram['width'], height=diagram['height']))
                page.set_content('<style>body{margin:0}</style>'+xml)
                page.evaluate('document.fonts.ready')
                escaped = page.locator('g[id^="node-"]').evaluate_all('''nodes => nodes.flatMap(g => {
                  const r=g.querySelector('rect').getBBox();
                  return [...g.querySelectorAll('text')].filter(t=>{const b=t.getBBox();return b.x<r.x+8||b.x+b.width>r.x+r.width-8||b.y<r.y||b.y+b.height>r.y+r.height}).map(t=>t.textContent);
                })''')
                assert not escaped, (path.name, 'text outside node', escaped)
                boxes = page.locator('svg text').evaluate_all('nodes => nodes.map(n => {const r=n.getBBox();return {text:n.textContent,x:r.x,y:r.y,w:r.width,h:r.height}})')
                for i, a in enumerate(boxes):
                    assert a['x']>=0 and a['y']>=0 and a['x']+a['w']<=diagram['width'] and a['y']+a['h']<=diagram['height'], (path.name,a)
                    for b in boxes[i+1:]:
                        overlap = min(a['x']+a['w'],b['x']+b['w']) > max(a['x'],b['x']) and min(a['y']+a['h'],b['y']+b['h']) > max(a['y'],b['y'])
                        assert not overlap, (path.name,a['text'],b['text'])
                checks.append(dict(file=path.name,textCount=len(boxes),withinCanvas=True,withinNode=True,noTextOverlap=True))
                if not suffix: gallery.append('<section><h2>'+diagram['title']+'</h2>'+xml+'</section>')
        page.set_viewport_size(dict(width=720 * len(gallery),height=1700))
        page.set_content('<style>body{margin:0;display:flex;font-family:Meiryo}section{width:720px}h2{padding:16px;margin:0}</style>'+''.join(gallery))
        page.screenshot(path=str(TMP/f'chapter{chapter["chapter"]}-gallery.png'),full_page=True)
    for preview in json.loads((TMP/'previews.json').read_text(encoding='utf8')):
        page.set_viewport_size(dict(width=preview['width'],height=844))
        page.goto((TMP/(preview['name']+'.html')).as_uri())
        page.evaluate('document.fonts.ready')
        overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
        assert not overflow, preview
        page.screenshot(path=str(DOCS/(preview['name']+'.png')),full_page=True)
        screens.append(dict(**preview,noHorizontalOverflow=True))
    browser.close()
(DOCS/'verification.json').write_text(json.dumps(dict(verifiedOn='2026-11-07',chapters=6,diagrams=19,svgCount=len(checks),pngCount=len(checks),checks=checks,screens=screens,physicalDeviceTested=False),ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
print(f'PASS: {len(checks)} SVG/PNG pairs; text in bounds and no overlaps; {len(screens)} screen previews without horizontal overflow')
