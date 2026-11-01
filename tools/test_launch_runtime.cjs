const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
function load(file, mocks, extras = {}) {
  const module = { exports: {} };
  const code = transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' }).code;
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout, clearTimeout, AbortController, Date,
    require(name) { if (name in mocks) return mocks[name]; throw new Error(name); }, ...extras });
  return module.exports;
}
const rules = load('src/data/launchAccessRules.ts', {});
const feedbackRules = load('src/data/feedbackRules.ts', {});
function access(storage = new Map(), { open = true, offline = false, failWrite = false } = {}) {
  let requests = 0;
  const api = load('src/data/launchAccess.ts', {
    '@react-native-async-storage/async-storage': {
      async getItem(k) { return storage.get(k) ?? null; },
      async setItem(k, v) { if (failWrite) throw new Error('disk full'); storage.set(k, v); },
    }, './launchAccessRules': rules,
  }, { fetch: async () => {
    requests++;
    if (offline) throw new Error('offline');
    return { ok: true, json: async () => ({ schema: 1, campaignId: 'launch', enrollmentOpen: open }) };
  } });
  return { api, storage, requests: () => requests };
}
(async () => {
  const original = access();
  await Promise.all([original.api.initLaunchAccess(), original.api.initLaunchAccess()]);
  assert.equal(original.requests(), 1);
  assert.equal(original.api.isLaunchFreeActive(), true);
  const returning = access(original.storage, { open: false, offline: true });
  await returning.api.initLaunchAccess();
  assert.equal(returning.api.isLaunchFreeActive(), true);
  assert.equal(returning.requests(), 0); // Previously enrolled users never depend on the policy server.
  const newcomer = access(new Map(), { open: false });
  await newcomer.api.initLaunchAccess();
  assert.equal(newcomer.api.isLaunchFreeActive(), false);
  assert.equal(newcomer.api.launchAccessStatus(), 'ready');
  const offline = access(new Map(), { offline: true });
  await offline.api.initLaunchAccess();
  assert.equal(offline.api.isLaunchFreeActive(), false);
  assert.equal(offline.api.launchAccessStatus(), 'error');
  const diskFull = access(new Map(), { failWrite: true });
  await diskFull.api.initLaunchAccess();
  assert.equal(diskFull.api.isLaunchFreeActive(), false);
  const corrupt = access(new Map([['fire6:launch-access:v1', 'broken json']]));
  await corrupt.api.initLaunchAccess();
  assert.equal(corrupt.api.isLaunchFreeActive(), true);

  let charged = 0;
  const sdk = { configure() {}, addCustomerInfoUpdateListener() {},
    async getCustomerInfo() { return { entitlements: { all: {}, active: {} } }; },
    async purchasePackage() { charged++; return { customerInfo: { entitlements: { all: {}, active: { pro: {} } } } }; },
  };
  const purchasesFor = launch => load('src/data/purchases.ts', {
    'react-native': { Platform: { OS: 'ios' } }, 'react-native-purchases': sdk, './launchAccess': launch,
  }, { __DEV__: false });
  const freePurchases = purchasesFor(returning.api);
  await freePurchases.initPurchases();
  assert.equal(freePurchases.isProActive(), true);
  assert.equal(await freePurchases.purchasePro({}), true);
  assert.equal(charged, 0); // Never charge a granted installation.
  const blocked = purchasesFor(offline.api);
  await assert.rejects(() => blocked.purchasePro({}), /無料開放/);
  assert.equal(charged, 0);
  const paidPurchases = purchasesFor(newcomer.api);
  await paidPurchases.initPurchases();
  await newcomer.api.initLaunchAccess(); // Checkout stays blocked until the fresh policy check finishes.
  assert.equal(await paidPurchases.purchasePro({}), true);
  assert.equal(charged, 1); // Later users can buy the existing product normally.

  let now = Date.UTC(2026, 10, 1), reviews = 0, mailUrl = '', available = true, alerts = 0;
  class Clock extends Date { static now() { return now; } }
  const storage = new Map();
  const feedback = load('src/data/feedback.ts', {
    '@react-native-async-storage/async-storage': {
      async getItem(k) { return storage.get(k) ?? null; }, async setItem(k, v) { storage.set(k, v); },
    },
    'react-native': { Platform: { OS: 'ios' }, Alert: { alert() { alerts++; } }, Linking: { async openURL(url) { mailUrl = url; } } },
    'expo-store-review': { async isAvailableAsync() { return available; }, async requestReview() { reviews++; } },
    'expo-application': { nativeApplicationVersion: '1.3.0', nativeBuildVersion: 'test' },
    './feedbackRules': feedbackRules,
  }, { Date: Clock, __DEV__: false });
  await feedback.initFeedback();
  assert.equal(await feedback.offerFeedback(), false); // No startup prompt.
  for (let i = 1; i <= 4; i++) {
    now += feedbackRules.FEEDBACK_INTERVAL_MS;
    const results = await Promise.all([feedback.offerFeedback(), feedback.offerFeedback()]);
    assert.equal(results.filter(Boolean).length, 1); // No duplicate checkpoint prompt.
    assert.equal(reviews, Math.min(i, 3));
  }
  now += feedbackRules.FEEDBACK_INTERVAL_MS;
  available = false;
  assert.equal(await feedback.offerFeedback(), true); // Mail remains available without StoreKit review.
  await feedback.openRequestEmail();
  assert.ok(mailUrl.startsWith('mailto:contact@safa-lang.com?'));
  assert.ok(decodeURIComponent(mailUrl).includes('ご意見・ご要望'));
  assert.ok(decodeURIComponent(mailUrl).includes('1.3.0'));
  await feedback.openAppReview();
  assert.equal(mailUrl, 'https://apps.apple.com/app/id6823598014?action=write-review');
  const savedSchedule = storage.get('fire6:feedback:v1');
  assert.equal(await feedback.feedbackDevToolsAvailable(), true); // TestFlight can use diagnostics without a purchase.
  await feedback.triggerReviewForDevelopment();
  assert.equal(alerts, 1); // Explain Apple's TestFlight restriction instead of silently failing.
  assert.equal(reviews, 3);
  available = true;
  assert.equal(await feedback.feedbackDevToolsAvailable(), false); // Production excludes these diagnostics.
  await feedback.triggerReviewForDevelopment();
  assert.equal(reviews, 3);
  assert.equal(storage.get('fire6:feedback:v1'), savedSchedule); // No effect on the normal schedule.
  console.log('PASS: launch rights, payment guards, feedback interval/cap, email, review link, TestFlight diagnostics and production exclusion');
})().catch(error => { console.error(error); process.exitCode = 1; });
