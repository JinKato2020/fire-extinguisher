import { AppState } from 'react-native';
import { offerFeedback } from './feedback';

let studying = 0;
let pending = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function schedule() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!pending || studying || AppState.currentState !== 'active' || !listeners.size) return;
  // Let the navigation finish. Never prompt over another active study screen.
  timer = setTimeout(() => {
    timer = null;
    if (studying || AppState.currentState !== 'active') return;
    pending = false;
    void offerFeedback().then(show => { if (show) for (const fn of listeners) fn(); });
  }, 400);
}

export function beginStudyFeedback(): (qualified: boolean) => void {
  studying++;
  schedule();
  let ended = false;
  return qualified => {
    if (ended) return;
    ended = true;
    studying--;
    pending ||= qualified;
    schedule();
  };
}

export function subscribeStudyFeedback(fn: () => void): () => void {
  listeners.add(fn);
  const subscription = AppState.addEventListener('change', schedule);
  schedule();
  return () => { listeners.delete(fn); subscription.remove(); schedule(); };
}
