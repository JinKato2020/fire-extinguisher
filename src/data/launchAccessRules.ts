export type LaunchPolicy = { schema: 1; campaignId: string; enrollmentOpen: boolean };
export type LaunchGrant = { schema: 1; campaignId: string; grantedAt: string };

export function parseLaunchPolicy(value: unknown): LaunchPolicy | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Partial<LaunchPolicy>;
  return p.schema === 1 && typeof p.campaignId === 'string' && p.campaignId.length > 0
    && typeof p.enrollmentOpen === 'boolean' ? p as LaunchPolicy : null;
}
export function parseLaunchGrant(value: unknown): LaunchGrant | null {
  if (!value || typeof value !== 'object') return null;
  const g = value as Partial<LaunchGrant>;
  return g.schema === 1 && typeof g.campaignId === 'string' && g.campaignId.length > 0
    && typeof g.grantedAt === 'string' && Number.isFinite(Date.parse(g.grantedAt)) ? g as LaunchGrant : null;
}
export function enrollLaunchAccess(existing: LaunchGrant | null, freshPolicy: LaunchPolicy | null, now: number): LaunchGrant | null {
  // Closing enrollment must never revoke an already stored grant.
  if (existing) return existing;
  if (!freshPolicy?.enrollmentOpen) return null;
  return { schema: 1, campaignId: freshPolicy.campaignId, grantedAt: new Date(now).toISOString() };
}
