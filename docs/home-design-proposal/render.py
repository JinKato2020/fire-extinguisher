from pathlib import Path
from playwright.sync_api import sync_playwright
import json

root = Path(__file__).resolve().parent
errors = []
outputs = []
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe', headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1100}, device_scale_factor=1.5)
    page.on('pageerror', lambda error: errors.append(str(error)))
    for query, name, width in [
        ('compare', 'home-comparison.png', 1440),
        ('detail', 'home-layout.png', 1280),
        ('settings', 'hero-picker.png', 1280),
        ('single&style=anime', 'home-anime.png', 450),
        ('single&style=photo', 'home-photo.png', 450),
        ('single&style=calm', 'home-calm.png', 450),
        ('full&style=anime', 'home-full.png', 450),
    ]:
        page.set_viewport_size({'width': width, 'height': 900})
        page.goto((root / 'proposal.html').as_uri() + '?mode=' + query)
        page.wait_for_function('Array.from(document.images).every(img => img.complete && img.naturalWidth > 0)')
        page.evaluate('document.fonts.ready')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), query
        overflow = page.evaluate('Array.from(document.querySelectorAll("button")).filter(x=>x.scrollWidth>x.clientWidth+1).map(x=>x.textContent)')
        assert not overflow, (query, overflow)
        if query.startswith('single'):
            cta = page.locator('.resume .primary').bounding_box()
            assert cta['y'] + cta['height'] < 600, cta
        page.locator('.board').screenshot(path=str(root / name))
        outputs.append(name)
    assert not errors, errors
    (root / 'render-check.json').write_text(json.dumps({'screenshots': outputs, 'errors': errors, 'illustrativeData': True, 'appImplemented': False}, ensure_ascii=False, indent=2) + '\n', encoding='utf8', newline='\n')
    browser.close()
print('Rendered', len(outputs), 'proposal images; no overflow or JavaScript errors')
