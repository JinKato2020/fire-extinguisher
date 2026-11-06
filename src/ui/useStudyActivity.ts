import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { activityRevision, initActivity, recordActivity, subscribeActivity, type ActivityKind } from '../data/studyActivity';
import { StudyExposure } from '../data/feedbackRules';

export function useActivity() {
  useEffect(() => { void initActivity(); }, []);
  return useSyncExternalStore(subscribeActivity, activityRevision, activityRevision);
}
/** Records exposure, never claims that the reader understood or completed a lesson. */
export function useReadingActivity(kind: ActivityKind, id: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const clock = new StudyExposure(Date.now(), AppState.currentState === 'active');
    const sub = AppState.addEventListener('change', state => clock.setActive(Date.now(), state === 'active'));
    return () => { sub.remove(); if (clock.finish(Date.now())) void recordActivity(kind, id); };
  }, [kind, id, enabled]);
}
