import unittest
from gen_glossary import generate, SOURCE

class GlossaryGeneratorTests(unittest.TestCase):
    def setUp(self):
        self.body = SOURCE.read_text(encoding='utf8')

    def test_canonical_and_legacy(self):
        self.assertEqual(len(generate(self.body)['terms']), 106)
        old = '版：1\n\n## old\n用語：旧用語\n章：1\n\n### 解説\n旧版の説明。\n'
        self.assertEqual(generate(old)['terms'][0]['def'], '旧版の説明。')

    def test_reject_broken_authoring(self):
        for bad in [self.body.replace('教材：2', '教材：999', 1),
                    self.body.replace('図：ch1_f05', '図：missing-file', 1),
                    self.body.replace('図の説明：建物だけでなく山林や舟車も含む点に注目。\n', '', 1),
                    self.body.replace('### ひとことで', '### 未知の節', 1),
                    self.body.replace('関連：', '関連：["未定義"]\n別名：', 1),
                    self.body.replace('教材：2', '教材：true', 1),
                    self.body.replace('### 具体例', '### 解説', 1)]:
            with self.subTest(bad=bad[:100]):
                with self.assertRaises(ValueError): generate(bad)

if __name__ == '__main__': unittest.main()
