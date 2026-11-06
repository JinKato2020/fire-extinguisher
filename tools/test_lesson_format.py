import unittest
from lesson_format import reading_markdown


class LessonFormatTests(unittest.TestCase):
    def test_reading_fallback(self):
        text = '### Heading\n\n**{{用語::key}}**は{{10秒::num}}。\n\n:::check Q\n@choice: 2\nどれですか。\n1. A\n2. B\n---\n答え B\n:::'
        plain = reading_markdown(text)
        self.assertIn('**用語**は10秒。', plain)
        self.assertIn(':::check Q\nどれですか。', plain)
        self.assertNotIn('@choice', plain)

    def test_invalid_markers(self):
        for text in ['{{x::bad}}', '{{::num}}', '{{x::key}', '# {{見出し::key}}', '| {{表::num}} |', '```\n{{code::key}}\n```', ':::check Q\n{{答え::key}}\n---\nA\n:::']:
            with self.subTest(text=text), self.assertRaises(ValueError):
                reading_markdown(text)

    def test_invalid_choices(self):
        for question in ['@choice: 5\nQ\n1. A\n2. B', '@choice: 1\n1. A\n2. B', '@choice: 3\nQ\n1. A\n2. B', '@choice: 1\nQ\n1. A\n3. B']:
            with self.subTest(question=question), self.assertRaises(ValueError):
                reading_markdown(f':::check Q\n{question}\n---\nA\n:::')

    def test_written_subquestions(self):
        text = ':::check 記述\n1. 名称は？\n2. 理由は？\n---\n1はA、2はB。\n:::'
        self.assertEqual(reading_markdown(text), text)


if __name__ == '__main__':
    unittest.main()
