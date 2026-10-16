// 問題データのアクセサ。同梱(BUNDLED)＋OTA override から、問題セットと問題本体を引く。
// 問題本体は content/questions/<file>、目次は content/quizzes.json。すべてR2 OTAで差し替え可能。
import { getContent } from './contentStore';

export type Question = {
  id: string;
  chapter: string;
  topic?: string;
  type: 'choice';
  stem: string;
  choices: string[];
  answer: number;        // 正解の選択肢index(0始まり)
  explain?: string;      // 正答の理由
  whyWrong?: string[];   // 各選択肢が誤りの理由(任意)
  figure?: string | null;
  source?: string;
  reviewed?: string;
};

export type QuizSet = {
  id: string;
  chapter: string;
  title: string;
  file: string;          // content/questions/<x>.json
  count: number;
};

type QuizzesFile = { sets: QuizSet[] };

/** 問題セットの目次（章別）。 */
export function getQuizSets(): QuizSet[] {
  const q = getContent<QuizzesFile>('content/quizzes.json');
  return q?.sets ?? [];
}

/** 1セット分の問題配列を引く（file はセットの file キー）。 */
export function getQuestions(file: string): Question[] {
  const arr = getContent<Question[]>(file);
  return Array.isArray(arr) ? arr : [];
}

/** 全問題をまとめて引く（弱点復習などで使う）。 */
export function getAllQuestions(): Question[] {
  const out: Question[] = [];
  for (const s of getQuizSets()) out.push(...getQuestions(s.file));
  return out;
}
