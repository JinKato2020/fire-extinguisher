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
from practical_art import plan
from practical_rubrics import explanation

SYMBOLS = 'アイウエオカ'


def short(identifier, prompt, answers, explain):
    return dict(id=identifier, prompt=prompt, kind='text', category='calculation' if identifier in ('ability', 'count', 'charge') else 'name', answers=answers, explain=explain)


def symbol(identifier, prompt, options, correct, explain, rotation):
    shifted = options[rotation % len(options):] + options[:rotation % len(options)]
    return dict(id=identifier, prompt=prompt, kind='symbol', category='selection',
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
        image = ''
        stem = f'図は蓄圧式の粉末消火器の外観図である。記号{chr(65+letter)}の部分に関する各設問に答えなさい。'
        parts = [short('name', f'{chr(65+letter)}で示す部分の名称を記入しなさい。', [name] + aliases, f'{name}は、{purpose}部分である。'),
            symbol('function', 'その部分の主な働きを語群から選びなさい。', [x[2] for x in names], purpose, f'{name}の働きは「{purpose}」である。', variant)]
    elif family == 1:
        image = ''; letter = variant % 3
        name, aliases = [('ホーン', ['放射ホーン', 'ラッパ状ホーン']), ('本体容器', ['容器', '消火器本体']), ('レバー', ['上レバー', '操作レバー'])][letter]
        stem = f'図の消火器の外観と放射部の形状を観察し、各設問に答えなさい。'
        parts = [short('name', f'{chr(65+letter)}で示す部分の名称を記入しなさい。', [name]+aliases, f'{chr(65+letter)}は{name}である。Aはラッパ状の放射ホーン、Bは薬剤を収容する本体容器、Cは操作レバーを指す。'),
            short('type', 'この消火器の種類を記入しなさい。', ['二酸化炭素消火器', 'CO2消火器', '二酸化炭素'], '二酸化炭素消火器には放射ホーンがあり、薬剤量は総質量等で確認する。'),
            symbol('method', '薬剤量の確認に用いる測定を選びなさい。', ['総質量を測る', '指示圧力計の緑色範囲だけを見る', '本体の高さを測る'], '総質量を測る', '二酸化炭素消火器では質量を測定して薬剤量を確認する。', variant)]
    elif family == 2:
        position = variant % 3; image = ''
        state = ['緑色範囲の下限より低い', '緑色範囲内にある', '緑色範囲の上限より高い'][position]
        # On the shared three-gauge plate A=low, B=normal, C=high.
        stem = f'図は蓄圧式消火器に取り付けられた部品を拡大したものである。{chr(65+position)}の指針と緑色帯の位置を見て答えなさい。'
        parts = [short('name', '図に示す部品全体の名称を記入しなさい。', ['指示圧力計', '圧力計', '圧力ゲージ'], '指示圧力計は、蓄圧式消火器の圧力の状態を示す。'),
            symbol('state', '図の指針の状態を選びなさい。', ['緑色範囲の下限より低い', '緑色範囲内にある', '緑色範囲の上限より高い'], state, f'指針は「{state}」。緑色範囲外の場合は異常の確認が必要である。', variant)]
    elif family == 3:
        image = ''; stem = '図は消火器の口金から取り外した部品の外観を示す。Bは側面に設けられた孔である。各設問に答えなさい。'
        parts = [short('name', 'Aの部品名を記入しなさい。', ['キャップ', '消火器キャップ'], 'Aは本体容器の口金に取り付けるキャップである。'),
            short('hole', 'Bの孔の名称を記入しなさい。', ['減圧孔', '減圧穴', 'げんあつこう'], 'Bはキャップを取り外す途中で内部圧力を逃がすための減圧孔である。'),
            symbol('function', 'Bの主な目的を選びなさい。', ['キャップを外す途中で内部圧力を逃がす', '消火薬剤を火元へ放射する', '薬剤量を目視で測定する'], 'キャップを外す途中で内部圧力を逃がす', 'キャップ等には取り外す途中で有効に減圧できる構造が必要である。実際の分解・整備は有資格者が適切な手順で行う。', variant)]
    elif family == 4:
        letter = variant % 4; image = ''
        name, aliases, purpose = [('クランプ台', ['消火器クランプ台', '消火器保持具', '本体容器保持具', 'クランプ'], '本体容器を固定する'),
            ('キャップスパナ', ['キャップ用スパナ'], 'キャップを回して開閉する'),
            ('はかり', ['秤', '重量計', '質量計', '台はかり', '台秤'], '消火器の質量を測る'),
            ('標準圧力計', [], '指示圧力計の指示を比較点検する')][letter]
        stem = f'図は消火器の点検・整備に使う器具の外観図である。記号{chr(65+letter)}に関する各設問に答えなさい。'
        parts = [short('name', f'{chr(65+letter)}の器具名を記入しなさい。', [name]+aliases, f'{name}は「{purpose}」ための器具である。'),
            symbol('purpose', 'その器具の用途を語群から選びなさい。', ['本体容器を固定する', 'キャップを回して開閉する', '消火器の質量を測る', '指示圧力計の指示を比較点検する'], purpose, f'名称と用途を対応させる。{name}は「{purpose}」。', variant)]
    elif family == 5:
        area = 350 + variant * 50; base = 100; unit = 2 + variant % 3
        ability = math.ceil(area/base); count = math.ceil(ability/unit)
        image = plan(area, base, unit); stem = '図の階に設置する消火器について、必要な能力単位と最少本数を求めなさい。算定基準面積は図示の値とし、面積の緩和・付加能力・歩行距離による追加設置は考慮しない。'
        parts = [short('ability', '必要な能力単位を整数で記入しなさい。', [str(ability), f'{ability}単位'], f'{area}÷{base}={area/base:g}。切り上げて{ability}単位。'),
            short('count', '図の消火器を用いる場合の最少本数を記入しなさい。', [str(count), f'{count}本'], f'{ability}÷{unit}を切り上げ、{count}本となる。実際の設置は面積以外の条件も確認する。'),
            symbol('round', '計算で整数未満の端数が出る場合の処理を選びなさい。', ['切り上げる', '四捨五入する', '切り捨てる'], '切り上げる', '必要量を下回る端数処理はできない。必要能力単位と本数は、整数未満の端数を切り上げる。', variant)]
    elif family == 6:
        tare = 8; charge = 2 + variant % 8; total = tare + charge
        image = ''; stem = f'図の二酸化炭素消火器を測定したところ、総質量は{total}kgであった。薬剤を除いた容器・弁等の質量は{tare}kgである。これらの測定値を用いて答えなさい。'
        parts = [short('charge', '現在の薬剤質量をkg単位で記入しなさい。', [str(charge), f'{charge}.0', f'{charge}kg', f'{charge}.0kg', f'{charge}キログラム'], f'総質量{total}kgから容器・弁等{tare}kgを差し引き、{charge}kg。'),
            symbol('tool', 'この測定に適した器具を選びなさい。', ['はかり', '標準圧力計', 'キャップスパナ'], 'はかり', '質量の確認にははかりを用い、圧力計とは区別する。', variant)]
    else:
        image = ''; fire = [('A', '普通火災', ['A火災', '普通火災用']), ('B', '油火災', ['B火災', '油火災用']), ('C', '電気火災', ['C火災', '電気火災用'])][variant % 3]
        stem = f'図の{fire[0]}の状況で発生している火災について答えなさい。Aは木材、Bは油、Cは通電中の電気設備である。図は火災の状況であり、消火器本体の適応火災マークではない。'
        parts = [short('fire', f'{fire[0]}の火災の区分名を記入しなさい。', [fire[1]]+fire[2], f'{fire[0]}は{fire[1]}に対応する。'),
            symbol('unit', '電気火災の適応表示と能力単位の扱いについて正しいものを選びなさい。', ['電気火災では適応の有無を示し、能力単位の数値は定めない', '電気火災は必ず能力単位3と表示する', '電気火災用の表示があれば普通火災にも必ず使える'], '電気火災では適応の有無を示し、能力単位の数値は定めない', 'A・Bの能力単位の数値と、Cの適応の有無は区別する。', variant)]
    parts.append(explanation(family))
    result = dict(stem=stem, image=image, caption='教材と共通の画風による自作図です。実物写真ではなく、製品によって形状が異なります。', parts=parts)
    asset = ['powder', 'co2', 'gauges', 'cap', 'tools', None, 'co2', 'fires'][family]
    if asset:
        result['imageAsset'] = asset
        # Legacy SvgXml clients receive the same reviewed plate through R2.
        # New clients use bundled Image assets and work offline.
        result['image'] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="white"/><image href="https://content.safa-lang.com/fire6/figures/practical_' + asset + '.jpg" x="0" y="0" width="600" height="400"/></svg>'
    return result


def question_variants():
    """Cycle within each family: a global modulo used to omit half the tools/parts."""
    counts = [0] * 8
    for mock in range(1, 13):
        for i in range(5):
            family = ((mock-1)*3+i) % 8
            yield mock, i, make(family, counts[family])
            counts[family] += 1


def main():
    check = argparse.ArgumentParser(); check.add_argument('--check', action='store_true'); args = check.parse_args()
    changed = 0
    variants = {(mock, i): q for mock, i, q in question_variants()}
    for mock in range(1, 13):
        path = ROOT / 'content' / 'questions' / f'mock{mock}.json'
        questions = json.loads(path.read_text(encoding='utf-8'))
        practical = [q for q in questions if str(q['chapter']) == '6']
        assert len(questions) == 35 and len(practical) == 5
        for i, q in enumerate(practical):
            q['id'] = q['id'].removesuffix('-practical-v1').removesuffix('-practical-v2') + '-practical-v2'
            q['practical'] = variants[mock, i]
            q['topic'] = '鑑別等（図解・複数設問）'
        generated = json.dumps(questions, ensure_ascii=False, indent=2 if mock >= 9 else None,
                               separators=None if mock >= 9 else (',', ':')) + '\n'
        if path.read_text(encoding='utf-8') != generated:
            changed += 1
            if not args.check: path.write_bytes(generated.encode('utf-8'))
    print(f'practical: 12 mocks / 60 groups, changed={changed}')
    if args.check and changed: raise SystemExit(1)
    if not args.check:
        cards = []
        for mock in range(1, 13):
            for i in range(5):
                q = variants[mock, i]
                questions = ''.join('<li>' + html.escape(p['prompt']) + '<details><summary>解答・解説</summary>' + html.escape(' / '.join(p['answers']) + '：' + p['explain']) + '</details></li>' for p in q['parts'])
                art = '<img src="../assets/figures/practical_' + q['imageAsset'] + '.jpg" alt="問題図">' if q.get('imageAsset') else q['image']
                cards.append(f'<article><h2>第{mock}回・鑑別{i+1}</h2>' + art + '<p>' + html.escape(q['stem']) + '</p><ol>' + questions + '</ol></article>')
        page = '<!doctype html><meta charset="utf-8"><title>鑑別60大問・全図レビュー</title><style>body{font:16px Meiryo;margin:20px;background:#edf1f6}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px}article{background:white;border-radius:12px;padding:16px;break-inside:avoid}h2{margin:0;font-size:18px}svg,img{width:100%;height:auto}p,li{line-height:1.8}details{color:#36536b}summary{cursor:pointer}</style><h1>鑑別60大問・全図レビュー</h1><p>オリジナル練習問題。公式問題の写真・図の転載ではありません。</p><main>' + ''.join(cards) + '</main>'
        (ROOT / 'docs' / 'practical-figures-review.html').write_bytes(page.encode('utf-8'))


if __name__ == '__main__':
    main()
