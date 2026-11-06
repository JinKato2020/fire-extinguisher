import { createContext, useContext } from 'react';
import type { RecallBlank } from './recall';

export type CheckResult = 'correct' | 'review' | 'self' | 'seen';
export type StudyRecall = {
  selected: Map<string, RecallBlank>; revealed: Set<string>;
  toggle: (id: string) => void; report: (id: string, result: CheckResult | null) => void;
};
export const StudyRecallContext = createContext<StudyRecall | null>(null);
export const useStudyRecall = () => useContext(StudyRecallContext);
