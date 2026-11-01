import { useEffect } from 'react';
import { AppState } from 'react-native';
import { StudyExposure } from '../data/feedbackRules';
import { beginStudyFeedback } from '../data/studyFeedback';

/** A study ends on exit, scope change, or completion, never just at 30 seconds. */
export function useStudyFeedback(scope: string, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const clock = new StudyExposure(Date.now(), AppState.currentState === 'active');
    const end = beginStudyFeedback();
    const subscription = AppState.addEventListener('change', state => clock.setActive(Date.now(), state === 'active'));
    return () => {
      subscription.remove();
      end(clock.finish(Date.now()));
    };
  }, [scope, enabled]);
}
