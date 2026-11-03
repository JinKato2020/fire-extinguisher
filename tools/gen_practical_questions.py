"""Original practical-question source. Regenerates the five practical groups in each mock.

The legacy choice fields remain valid for older OTA clients; practical-aware clients
use the original SVG and subquestions. Official exam artwork is never copied.
Run from the app directory: python tools/gen_practical_questions.py [--check]
"""
import argparse
import html
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INK = '#172b43'
SYMBOLS = 'アイウエオカ'


def text(x, y, value, size=24):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{INK}" font-family="sans-serif">{html.escape(str(value))}</text>'


def svg(body):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="#fff"/>' + body + '</svg>'


def label(letter, x, y, target_x, target_y):
    # A leader terminates in a dot precisely on the part, with a large letter at its start.
    return (f'<path d="M{x+20},{y-10} L{target_x},{target_y}" stroke="{INK}" stroke-width="3" fill="none"/>'
            f'<circle cx="{target_x}" cy="{target_y}" r="5" fill="{INK}"/>' + text(x, y, letter, 32))


def powder():
    return svg('<rect x="222" y="142" width="130" height="220" rx="34" fill="#d8383d" stroke="#172b43" stroke-width="4"/>'
        '<rect x="256" y="116" width="60" height="30" fill="#aaa" stroke="#172b43" stroke-width="3"/>'
        '<path d="M270 116 L270 89 L353 89 L353 102 L294 102" fill="#545f70" stroke="#172b43" stroke-width="3"/>'
        '<circle cx="259" cy="83" r="13" fill="none" stroke="#e0a100" stroke-width="6"/>'
        '<path d="M269 84 L283 99" stroke="#e0a100" stroke-width="5"/>'
        '<circle cx="278" cy="136" r="18" fill="#fff" stroke="#172b43" stroke-width="3"/>'
        '<path d="M278 136 L278 122" stroke="#172b43" stroke-width="3"/>'
        '<path d="M316 123 C411 112 404 205 397 276" fill="none" stroke="#252b35" stroke-width="14"/>'
        '<path d="M387 270 L407 270 L411 321 L386 321 Z" fill="#242a34"/>'
        + label('A', 90, 55, 259, 70) + label('B', 82, 153, 278, 136)
        + label('C', 465, 184, 406, 190) + label('D', 468, 320, 400, 305)
        + label('E', 78, 315, 240, 289) + label('F', 465, 67, 330, 95))


def co2():
    return svg('<rect x="215" y="132" width="130" height="230" rx="35" fill="#23965d" stroke="#172b43" stroke-width="4"/>'
        '<path d="M216 277 H344 V323 H216 Z" fill="#d8383d"/>'
        '<rect x="263" y="101" width="35" height="32" fill="#777"/>'
        '<path d="M280 101 V78 H354 V91 H298" fill="#555" stroke="#172b43" stroke-width="3"/>'
        '<path d="M294 116 C407 100 419 149 420 199" fill="none" stroke="#252b35" stroke-width="13"/>'
        '<path d="M408 194 H432 L456 300 H385 Z" fill="#272e39"/>'
        + label('A', 490, 325, 423, 263) + label('B', 85, 303, 243, 247)
        + label('C', 87, 63, 321, 84) + label('D', 482, 132, 400, 129))


def gauge(position):
    def point(degree, radius):
        a = math.radians(degree)
        return 300 + radius * math.cos(a), 237 + radius * math.sin(a)
    a, b = point(-110, 91), point(-70, 91)
    end = point([-135, -90, -45][position], 86)
    return svg('<circle cx="300" cy="237" r="125" fill="#f4f6f9" stroke="#172b43" stroke-width="7"/>'
        '<path d="M192 175 A125 125 0 0 1 408 175" fill="none" stroke="#d8dee7" stroke-width="22"/>'
        f'<path d="M{a[0]} {a[1]} A91 91 0 0 1 {b[0]} {b[1]}" fill="none" stroke="#23965d" stroke-width="26"/>'
        f'<path d="M300 237 L{end[0]} {end[1]}" stroke="#172b43" stroke-width="6"/>'
        '<circle cx="300" cy="237" r="9" fill="#172b43"/>'
        + text(164, 293, '低', 22) + text(411, 293, '高', 22)
        + label('A', 60, 242, 175, 237) + text(185, 45, '緑色帯と指針に注目', 22))


def cap():
    return svg('<path d="M148 274 V151 H440 V274 H398 V200 H190 V274 Z" fill="#bec8d4" stroke="#172b43" stroke-width="4"/>'
        '<path d="M190 201 H398 V355 H365 V235 H224 V355 H190 Z" fill="#e5eaf0" stroke="#172b43" stroke-width="4"/>'
        '<path d="M151 218 H190 M151 235 H190 M398 218 H437 M398 235 H437" stroke="#172b43" stroke-width="3"/>'
        '<rect x="398" y="246" width="42" height="13" fill="#fff"/>'
        '<path d="M398 246 H440 M398 259 H440" stroke="#172b43" stroke-width="3"/>'
        + label('A', 65, 69, 300, 161) + label('B', 492, 292, 424, 252)
        + text(160, 389, 'かん合部を拡大した断面模式図', 18))


def tools():
    return svg(
        '<path d="M65 156 H220 V178 H65 Z M91 156 V91 H117 V156 M177 156 V91 H201 V156" fill="#737f90" stroke="#172b43" stroke-width="3"/>'
        '<path d="M117 117 L145 135 L177 117 M145 135 V91 M131 91 H161" fill="none" stroke="#172b43" stroke-width="6"/>'
        '<path d="M378 113 A49 49 0 1 1 411 60 M378 113 L458 180" stroke="#647387" stroke-width="15" fill="none"/>'
        '<rect x="74" y="302" width="156" height="53" rx="8" fill="#bcc9d9" stroke="#172b43" stroke-width="3"/>'
        '<rect x="107" y="255" width="88" height="47" rx="8" fill="#d8383d"/>'
        '<rect x="126" y="320" width="55" height="21" fill="#fff" stroke="#172b43"/>'
        '<circle cx="411" cy="286" r="51" fill="#fff" stroke="#172b43" stroke-width="6"/>'
        '<path d="M411 286 L428 253 M411 337 V365" stroke="#172b43" stroke-width="5"/>'
        + text(50, 52, 'A', 32) + text(326, 52, 'B', 32) + text(50, 238, 'C', 32) + text(326, 238, 'D', 32))


def plan(area, base, unit):
    return svg('<rect x="68" y="70" width="462" height="215" fill="#eef5fb" stroke="#172b43" stroke-width="4"/>'
        '<path d="M271 285 H331" stroke="#fff" stroke-width="8"/>'
        + text(110, 132, f'床面積 {area} m²', 32) + text(110, 196, f'算定基準面積 {base} m²', 27)
        + text(110, 248, '面積の緩和・付加能力は考慮しない', 19)
        + text(100, 340, f'設置する消火器：能力単位 {unit} ／本', 25))


def mass(total, tare):
    return svg('<rect x="80" y="92" width="98" height="177" rx="26" fill="#23965d" stroke="#172b43" stroke-width="3"/>'
        '<rect x="81" y="210" width="96" height="40" fill="#d8383d"/>'
        '<rect x="115" y="69" width="30" height="25" fill="#666"/>'
        '<rect x="48" y="270" width="167" height="75" rx="8" fill="#c4cdda" stroke="#172b43" stroke-width="3"/>'
        '<rect x="77" y="290" width="107" height="33" fill="#fff"/>'
        + text(86, 315, f'{total:g} kg', 23) + text(252, 123, '二酸化炭素消火器', 27)
        + text(252, 186, f'現在の総質量：{total:g} kg', 23)
        + text(252, 243, f'容器・弁等の質量：{tare:g} kg', 21)
        + text(252, 292, '差が現在の薬剤質量である', 19))


def marks():
    return svg('<rect x="45" y="88" width="145" height="215" rx="10" fill="#f3f5f8" stroke="#172b43" stroke-width="3"/>'
        '<rect x="227" y="88" width="145" height="215" rx="10" fill="#f3f5f8" stroke="#172b43" stroke-width="3"/>'
        '<rect x="409" y="88" width="145" height="215" rx="10" fill="#f3f5f8" stroke="#172b43" stroke-width="3"/>'
        + text(96, 151, 'A', 44) + text(277, 151, 'B', 44) + text(459, 151, 'C', 44)
        + '<path d="M78 212 L157 241 M78 241 L157 212" stroke="#765238" stroke-width="16"/>'
        + '<path d="M266 211 H329 V264 H266 Z M275 211 V197 H300 V211" fill="#d29c32" stroke="#172b43" stroke-width="3"/>'
        + '<path d="M453 209 H513 V244 H453 Z M467 209 V187 M499 209 V187 M483 244 V272" fill="#587caa" stroke="#172b43" stroke-width="5"/>'
        + text(68, 349, '火災区分の対応を示した学習用の表示図', 22))


def short(identifier, prompt, answers, explain):
    return dict(id=identifier, prompt=prompt, kind='text', answers=answers, explain=explain)


def symbol(identifier, prompt, options, correct, explain, rotation):
    shifted = options[rotation % len(options):] + options[:rotation % len(options)]
    return dict(id=identifier, prompt=prompt, kind='symbol',
        options=[dict(symbol=SYMBOLS[i], text=value) for i, value in enumerate(shifted)],
        answers=[SYMBOLS[shifted.index(correct)]], explain=explain)


def make(family, variant):
    if family == 0:
        names = [('安全栓', ['安全ピン'], '不意にレバーが操作されることを防ぐ'),
            ('指示圧力計', ['圧力計', '圧力ゲージ'], '本体容器内の圧力の状態を示す'),
            ('ホース', ['放射ホース'], '消火薬剤をノズルまで導く'),
            ('ノズル', ['放射ノズル'], '消火薬剤を火元に向けて放射する'),
            ('本体容器', ['消火器本体', '容器'], '消火薬剤を収容する'),
            ('レバー', ['上レバー', '操作レバー'], '握る操作で放射を開始する')]
        letter = variant % len(names); name, aliases, purpose = names[letter]
        image = powder()
        stem = f'図は蓄圧式の粉末消火器の外観模式図である。記号{chr(65+letter)}の部分に関する各設問に答えなさい。'
        parts = [short('name', f'{chr(65+letter)}で示す部分の名称を記入しなさい。', [name] + aliases, f'{name}は、{purpose}部分である。'),
            symbol('function', 'その部分の主な働きを語群から選びなさい。', [x[2] for x in names], purpose, f'{name}の働きは「{purpose}」である。', variant)]
    elif family == 1:
        image = co2(); letter = variant % 3
        name, aliases = [('ホーン', ['放射ホーン', 'ラッパ状ホーン']), ('本体容器', ['容器', '消火器本体']), ('レバー', ['上レバー', '操作レバー'])][letter]
        stem = f'図の消火器には指示圧力計がなく、本体の緑色部分は表面積の2分の1以上を占める。各設問に答えなさい。'
        parts = [short('name', f'{chr(65+letter)}で示す部分の名称を記入しなさい。', [name]+aliases, '大きなラッパ状の放射部がホーンである。図の記号が指す位置を確認する。'),
            short('type', 'この消火器の種類を記入しなさい。', ['二酸化炭素消火器', 'CO2消火器', '二酸化炭素'], '二酸化炭素消火器には放射ホーンがあり、薬剤量は総質量等で確認する。'),
            symbol('method', '薬剤量の確認に用いる測定を選びなさい。', ['総質量を測る', '指示圧力計の緑色範囲だけを見る', '本体の高さを測る'], '総質量を測る', '二酸化炭素消火器では質量を測定して薬剤量を確認する。', variant)]
    elif family == 2:
        position = variant % 3; image = gauge(position)
        state = ['緑色範囲の下限より低い', '緑色範囲内にある', '緑色範囲の上限より高い'][position]
        stem = '図は蓄圧式消火器の圧力を確認する部品の模式図である。指針と緑色帯の位置を見て答えなさい。'
        parts = [short('name', 'Aで示す部品全体の名称を記入しなさい。', ['指示圧力計', '圧力計', '圧力ゲージ'], '指示圧力計は、蓄圧式消火器の圧力の状態を示す。'),
            symbol('state', '図の指針の状態を選びなさい。', ['緑色範囲の下限より低い', '緑色範囲内にある', '緑色範囲の上限より高い'], state, f'指針は「{state}」。緑色範囲外の場合は異常の確認が必要である。', variant)]
    elif family == 3:
        image = cap(); stem = '図は消火器のキャップとかん合部の断面を単純化したものである。各設問に答えなさい。'
        parts = [short('name', 'Aの部品名を記入しなさい。', ['キャップ', '消火器キャップ'], 'Aは本体容器の口金に取り付けるキャップである。'),
            short('hole', 'Bの孔の名称を記入しなさい。', ['減圧孔', '減圧穴', 'げんあつこう'], 'Bはキャップを取り外す途中で内部圧力を逃がすための減圧孔である。'),
            symbol('function', 'Bの主な目的を選びなさい。', ['キャップを外す途中で内部圧力を逃がす', '消火薬剤を火元へ放射する', '薬剤量を目視で測定する'], 'キャップを外す途中で内部圧力を逃がす', 'キャップ等には取り外す途中で有効に減圧できる構造が必要である。実際の分解・整備は有資格者が適切な手順で行う。', variant)]
    elif family == 4:
        image = tools(); letter = variant % 4
        name, aliases, purpose = [('クランプ台', ['消火器クランプ台', 'クランプ'], '本体容器を固定する'),
            ('キャップスパナ', ['キャップ用スパナ'], 'キャップを回して開閉する'),
            ('はかり', ['秤', '重量計', '質量計', '台はかり', '台秤'], '消火器の質量を測る'),
            ('標準圧力計', [], '指示圧力計の指示を比較点検する')][letter]
        stem = f'図は消火器の点検・整備に使う器具の模式図である。記号{chr(65+letter)}に関する各設問に答えなさい。'
        parts = [short('name', f'{chr(65+letter)}の器具名を記入しなさい。', [name]+aliases, f'{name}は「{purpose}」ための器具である。'),
            symbol('purpose', 'その器具の用途を語群から選びなさい。', ['本体容器を固定する', 'キャップを回して開閉する', '消火器の質量を測る', '指示圧力計の指示を比較点検する'], purpose, f'名称と用途を対応させる。{name}は「{purpose}」。', variant)]
    elif family == 5:
        area = 350 + variant * 50; base = 100; unit = 2 + variant % 3
        ability = math.ceil(area/base); count = math.ceil(ability/unit)
        image = plan(area, base, unit); stem = '図の条件だけを用いて必要な能力単位と本数を計算しなさい。面積による緩和・付加能力・歩行距離等の条件は考慮しない。端数は切り上げる。'
        parts = [short('ability', '必要な能力単位を整数で記入しなさい。', [str(ability), f'{ability}単位'], f'{area}÷{base}={area/base:g}。切り上げて{ability}単位。'),
            short('count', '図の消火器を用いる場合の最少本数を記入しなさい。', [str(count), f'{count}本'], f'{ability}÷{unit}を切り上げ、{count}本となる。実際の設置は面積以外の条件も確認する。'),
            symbol('round', '計算で整数未満の端数が出る場合の処理を選びなさい。', ['切り上げる', '四捨五入する', '切り捨てる'], '切り上げる', '必要量を下回らないよう、ここでは問題の条件に従って切り上げる。', variant)]
    elif family == 6:
        tare = 8; charge = 2 + variant % 8; total = tare + charge
        image = mass(total, tare); stem = '図の二酸化炭素消火器について、記載された質量だけを用いて答えなさい。容器・弁等の質量には薬剤を含まない。'
        parts = [short('charge', '現在の薬剤質量をkg単位で記入しなさい。', [str(charge), f'{charge}.0', f'{charge}kg', f'{charge}.0kg', f'{charge}キログラム'], f'総質量{total}kgから容器・弁等{tare}kgを差し引き、{charge}kg。'),
            symbol('tool', 'この測定に適した器具を選びなさい。', ['はかり', '標準圧力計', 'キャップスパナ'], 'はかり', '質量の確認にははかりを用い、圧力計とは区別する。', variant)]
    else:
        image = marks(); fire = [('A', '普通火災', ['A火災', '普通火災用']), ('B', '油火災', ['B火災', '油火災用']), ('C', '電気火災', ['C火災', '電気火災用'])][variant % 3]
        stem = '図は消火器の適応火災区分の対応を整理した学習用表示図である。各設問に答えなさい。'
        parts = [short('fire', f'{fire[0]}に対応する火災の名称を記入しなさい。', [fire[1]]+fire[2], f'{fire[0]}は{fire[1]}に対応する。'),
            symbol('unit', '電気火災の適応表示と能力単位の扱いについて正しいものを選びなさい。', ['電気火災では適応の有無を示し、能力単位の数値は定めない', '電気火災は必ず能力単位3と表示する', '電気火災用の表示があれば普通火災にも必ず使える'], '電気火災では適応の有無を示し、能力単位の数値は定めない', 'A・Bの能力単位の数値と、Cの適応の有無は区別する。', variant)]
    return dict(stem=stem, image=image, caption='自作の模式図。実物と形状・縮尺が異なる部分があります。', parts=parts)


def main():
    check = argparse.ArgumentParser(); check.add_argument('--check', action='store_true'); args = check.parse_args()
    changed = 0
    for mock in range(1, 13):
        path = ROOT / 'content' / 'questions' / f'mock{mock}.json'
        questions = json.loads(path.read_text(encoding='utf-8'))
        practical = [q for q in questions if str(q['chapter']) == '6']
        assert len(questions) == 35 and len(practical) == 5
        for i, q in enumerate(practical):
            q['id'] = q['id'].removesuffix('-practical-v1') + '-practical-v1'
            q['practical'] = make(((mock-1)*3+i) % 8, (mock-1)*5+i)
            q['topic'] = '鑑別等（図解・複数設問）'
        generated = json.dumps(questions, ensure_ascii=False, indent=2 if mock >= 9 else None,
                               separators=None if mock >= 9 else (',', ':')) + '\n'
        if path.read_text(encoding='utf-8') != generated:
            changed += 1
            if not args.check: path.write_bytes(generated.encode('utf-8'))
    print(f'practical: 12 mocks / 60 groups, changed={changed}')
    if args.check and changed: raise SystemExit(1)
    if not args.check:
        items = [make(i, i) for i in range(8)]
        body = ''.join('<article><h2>' + str(i+1) + '</h2>' + q['image'] + '<p>' + html.escape(q['stem']) + '</p></article>' for i, q in enumerate(items))
        page = '<!doctype html><meta charset="utf-8"><style>body{font:16px Meiryo;margin:20px;background:#edf1f6}main{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}article{background:white;border-radius:12px;padding:10px}h2{margin:0;font-size:16px}svg{width:100%;height:230px}p{font-size:13px;line-height:1.6}</style><h1>鑑別問題：自作模式図の確認</h1><main>' + body + '</main>'
        (ROOT / 'docs' / 'practical-figures-review.html').write_bytes(page.encode('utf-8'))


if __name__ == '__main__':
    main()
