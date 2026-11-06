"""Validate authored retrieval cues and produce safe text for older lesson readers."""
import re

RECALL = re.compile(r'\{\{([^{}\n]+?)::(key|num|trap)\}\}')


def reading_markdown(body: str) -> str:
    """V2 keeps interactive checks, without V3-only recall or choice metadata."""
    block = None
    in_code = False
    for line in body.splitlines():
        if line.lstrip().startswith('```'):
            in_code = not in_code
        if line.startswith(':::'):
            block = None if line.strip() == ':::' else line
        if '{{' in line or '}}' in line:
            if block or in_code or line.startswith(('#', '|', '[[', '> [!', '```')):
                raise ValueError('暗記マーカーは本文・箇条書き・囲みの本文に記載してください: ' + line)
            plain = RECALL.sub(lambda m: m[1], line)
            if '{{' in plain or '}}' in plain or any(not m[1].strip() for m in RECALL.finditer(line)):
                raise ValueError('暗記マーカーの形式が不正です: ' + line)
    for match in re.finditer(r'^:::check ([^\n]+)\n(.*?)^:::[ \t]*$', body, re.M | re.S):
        title, text = match.groups()
        if '@choice' not in text:
            continue
        lines = text.splitlines()
        meta = re.fullmatch(r'@choice: ([1-4])', lines[0])
        if not meta or sum('@choice' in line for line in lines) != 1:
            raise ValueError('選択問題の正解指定が不正です: ' + title)
        question, separator, answer = '\n'.join(lines[1:]).partition('\n---\n')
        options = re.findall(r'^([1-4])\. (.+)$', question, re.M)
        prompt = re.sub(r'^[1-4]\. .+$', '', question, flags=re.M).strip()
        if (not separator or not answer.strip() or not prompt or not 2 <= len(options) <= 4
                or [int(n) for n, _ in options] != list(range(1, len(options) + 1))
                or int(meta[1]) > len(options)):
            raise ValueError('選択問題には問題文・順番どおりの選択肢・正解・解説が必要です: ' + title)
    stripped = RECALL.sub(lambda m: m[1], body)
    # Only validated metadata at the start of a check may be stripped.
    stripped = re.sub(r'(^:::check [^\n]+\n)@choice: [1-4]\n', r'\1', stripped, flags=re.M)
    if '@choice' in stripped:
        raise ValueError('確認問題以外に選択問題の指定があります')
    return stripped
