"""Style B: deterministic 2D calculation plates. Style A objects use raster masters."""
import html


def plan(area, base, unit):
    def text(x, y, value, size=25):
        return f'<text x="{x}" y="{y}" font-size="{size}" fill="#103e63" font-family="sans-serif">{html.escape(str(value))}</text>'
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">'
        '<rect width="600" height="400" fill="white"/>'
        '<rect x="44" y="32" width="512" height="203" fill="#f1f7fc"/>'
        '<path d="M250 235 H44 V32 H556 V235 H348" fill="none" stroke="#103e63" stroke-width="4"/>'
        '<path d="M250 235 V165 M250 165 A70 70 0 0 1 320 235" fill="none" stroke="#7394ad" stroke-width="2"/>'
        + text(189, 100, '対象となる階', 28) + text(145, 158, f'床面積 {area} m²', 34)
        + text(50, 294, f'算定基準面積：{base} m²')
        + text(50, 346, f'消火器1本の能力単位：{unit}') + '</svg>')
