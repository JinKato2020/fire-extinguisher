// RevenueCat(買い切りPro)ラッパー。
// - Entitlement = 'pro' / Offering = 'default' / Store product = 'EF_Pro'(非消耗型)。
// - 公開SDKキーはクライアント埋め込み前提(漏れても権限操作は不可)。
// - 課金未設定・オフライン・非iOSでも落とさない(try/catchで握り、pro=falseのまま継続)。
import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

const IOS_API_KEY = 'appl_uVNmkvjaLpbsDuwWWtuwhQhdHWR';
export const PRO_ENTITLEMENT = 'pro';
export const OFFERING_ID = 'default';

let proActive = false;
let configured = false;
const listeners = new Set<() => void>();

export function isProActive(): boolean { return proActive; }

export function subscribePro(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function applyInfo(info: CustomerInfo): void {
  const active = !!info.entitlements.active[PRO_ENTITLEMENT];
  if (active !== proActive) {
    proActive = active;
    for (const l of listeners) l();
  }
}

/** 起動時に1回。iOS以外・未設定でも安全に握りつぶす。 */
export async function initPurchases(): Promise<void> {
  if (Platform.OS !== 'ios') return; // 現状iOSのみ配信
  try {
    Purchases.configure({ apiKey: IOS_API_KEY });
    configured = true;
    Purchases.addCustomerInfoUpdateListener(applyInfo);
    const info = await Purchases.getCustomerInfo();
    applyInfo(info);
  } catch {
    // 課金が使えない環境でもアプリは動かす(pro=falseのまま)
  }
}

/** Offering 'default' の先頭パッケージ(=EF_Pro)。取得できなければ null。 */
export async function getProPackage(): Promise<PurchasesPackage | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const off = offerings.all[OFFERING_ID] ?? offerings.current;
    return off?.availablePackages?.[0] ?? null;
  } catch {
    return null;
  }
}

/** 購入。成功でtrue、ユーザーキャンセルでfalse、失敗はthrow。 */
export async function purchasePro(pkg: PurchasesPackage): Promise<boolean> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    applyInfo(customerInfo);
    return !!customerInfo.entitlements.active[PRO_ENTITLEMENT];
  } catch (e) {
    if (e && typeof e === 'object' && (e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

/** 購入を復元。Proが有効になったらtrue。 */
export async function restorePro(): Promise<boolean> {
  if (!configured) return false;
  const info = await Purchases.restorePurchases();
  applyInfo(info);
  return !!info.entitlements.active[PRO_ENTITLEMENT];
}
