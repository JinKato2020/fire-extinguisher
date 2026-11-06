import { AppState } from 'react-native';
import { offerFeedback, recordFeedbackStudy } from './feedback';

let studying = 0, blocked = 0, hosts = 0, generation = 0;
let foregroundGeneration = 0;
let pending = false;
let timer: ReturnType<typeof setTimeout> | null = null;
function cancelTimer() { if (timer) clearTimeout(timer); timer = null; }
function eligible() { return !studying && !blocked && hosts > 0 && AppState.currentState === 'active'; }
function schedule() {
  cancelTimer();
  if (!pending || !eligible()) return;
  const expected = generation;
  timer = setTimeout(() => {
    timer = null;
    if (!eligible() || generation !== expected) return;
    pending = false;
    void offerFeedback(() => eligible() && generation === expected);
  }, 2000);
}
/** Any interaction restarts the quiet period; asynchronous availability checks are cancelled too. */
export function noteFeedbackInteraction() { generation++; schedule(); }
export function blockStudyFeedback(): () => void {
  blocked++; generation++; pending = false; schedule();
  return () => { blocked--; generation++; schedule(); };
}
export function beginStudyFeedback(): (qualified: boolean) => void {
  studying++; generation++; schedule();
  let ended = false;
  return qualified => {
    if (ended) return;
    ended = true; studying--; generation++;
    if (qualified) {
      const foregroundAtExit = foregroundGeneration;
      const activeAtExit = AppState.currentState === 'active';
      void recordFeedbackStudy().then(() => {
        // Never turn returning to the foreground into an unsolicited review checkpoint.
        if (activeAtExit && foregroundAtExit === foregroundGeneration && AppState.currentState === 'active' && !blocked) pending = true;
        schedule();
      });
    }
    schedule();
  };
}
export function startStudyFeedback(): () => void {
  hosts++;
  const subscription = AppState.addEventListener('change', () => {
    generation++; foregroundGeneration++;
    if (AppState.currentState !== 'active') pending = false;
    schedule();
  });
  schedule();
  return () => { hosts--; generation++; subscription.remove(); if (!hosts) pending = false; schedule(); };
}
