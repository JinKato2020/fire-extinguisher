import unittest
from gen_exam_guide import generate, SOURCE

class ExamGuideTests(unittest.TestCase):
    def test_key_facts_and_emphasis_are_authored(self):
        data = generate(SOURCE.read_text(encoding='utf8'))
        self.assertEqual([s['value'] for s in data['stats']], ['30', '5', '105'])
        self.assertIn('科目免除がない場合::trap', data['body'])
        self.assertIn('40%以上::num', data['body'])
        self.assertEqual(data['body'].count('60%以上::num'), 2)
        self.assertIn('参考採点::key', data['body'])
        self.assertIn('提出までは正誤・解説を表示しません::trap', data['body'])
        self.assertEqual(data['body'].count('https://www.shoubo-shiken.or.jp/'), 2)

    def test_reject_invalid_metadata(self):
        source = SOURCE.read_text(encoding='utf8')
        for broken in [source.replace('概要：', '不明：', 1), source.replace('"30"', '30', 1), source.replace('"detail"', '"typo"', 1)]:
            with self.assertRaises(ValueError): generate(broken)

if __name__ == '__main__': unittest.main()
