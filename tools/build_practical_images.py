"""Only encode reviewed PNG masters for delivery; never redraw or crop their content."""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parent.parent
policy = json.loads((ROOT / 'figures-tools/image-style.json').read_text(encoding='utf8'))
for name in ['powder', 'co2', 'gauges', 'cap', 'tools', 'fires']:
    with Image.open(ROOT / f'docs/practical-masters/{name}.png') as master:
        assert master.size == (policy['newRasterMaster']['width'], policy['newRasterMaster']['height'])
        master.convert('RGB').save(ROOT / f'assets/figures/practical_{name}.jpg',
                                  quality=policy['delivery']['quality'], subsampling=0, optimize=True)
print('6 reviewed plates encoded at native 1536 x 1024; no crop or upscale')
