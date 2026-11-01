import AsyncStorage from '@react-native-async-storage/async-storage';
import { enrollLaunchAccess, parseLaunchGrant, parseLaunchPolicy, type LaunchGrant } from './launchAccessRules';

const KEY = 'fire6:launch-access:v1';
const POLICY_URL = 'https://content.safa-lang.com/fire6/content/access-policy.json';
let grant: LaunchGrant | null = null;
let status: 'checking' | 'ready' | 'error' = 'checking';
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => { for (const fn of listeners) fn(); };
export const isLaunchFreeActive = () => grant !== null;
export const launchAccessStatus = () => status;
export function subscribeLaunchAccess(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

export function initLaunchAccess(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    status = 'checking'; notify();
    try {
      const raw = await AsyncStorage.getItem(KEY);
      try { grant = parseLaunchGrant(JSON.parse(raw ?? 'null')); } catch { grant = null; }
      if (grant) { status = 'ready'; notify(); return; }
      // Enrollment uses a fresh server response, never a stale bundled/OTA cache.
      // This prevents a later offline installation from enrolling after closure.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(`${POLICY_URL}?t=${Date.now()}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Policy unavailable');
        const policy = parseLaunchPolicy(await response.json());
        if (!policy) throw new Error('Invalid policy');
        const next = enrollLaunchAccess(grant, policy, Date.now());
        if (next) {
          await AsyncStorage.setItem(KEY, JSON.stringify(next));
          grant = next; // Only promise indefinite access after persistence succeeds.
        }
        status = 'ready';
      } finally { clearTimeout(timer); }
    } catch { status = 'error'; }
    notify();
  })().finally(() => { inflight = null; });
  return inflight;
}
