const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const code = transformSync(fs.readFileSync('src/data/purchases.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
const info = (sandbox, active = true) => {
  const entitlement = { isSandbox: sandbox };
  return { entitlements: { all: { pro: entitlement }, active: active ? { pro: entitlement } : {} } };
};
function load(customerInfo) {
  let notify;
  const calls = { purchase: 0, restore: 0 };
  const sdk = {
    configure() {}, addCustomerInfoUpdateListener(cb) { notify = cb; },
    async getCustomerInfo() { return customerInfo; },
    async purchasePackage() { calls.purchase++; return { customerInfo }; },
    async restorePurchases() { calls.restore++; return customerInfo; },
  };
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, __DEV__: false,
    require(name) {
      if (name === 'react-native') return { Platform: { OS: 'ios' } };
      if (name === 'react-native-purchases') return sdk;
      throw new Error(name);
    },
  });
  return { api: module.exports, calls, refresh: value => notify(value) };
}
(async () => {
  const test = load(info(true)); const p = test.api;
  await p.initPurchases();
  assert.equal(p.isProActive(), true);
  assert.equal(p.canUseFreePreview(), true);
  let changes = 0; const unsub = p.subscribePro(() => changes++);
  p.setFreePreviewEnabled(true);
  assert.equal(p.isProActive(), false);
  test.refresh(info(true)); // SDK refresh cannot override the requested free preview.
  assert.equal(p.isProActive(), false);
  await assert.rejects(() => p.purchasePro({}), /無料状態/);
  await assert.rejects(() => p.restorePro(), /無料状態/);
  assert.deepEqual(test.calls, { purchase: 0, restore: 0 });
  p.setFreePreviewEnabled(false);
  assert.equal(p.isProActive(), true);
  assert.equal(changes, 2);
  unsub();
  p.setFreePreviewEnabled(true);
  test.refresh(info(false)); // Switching to a production entitlement clears the override.
  assert.equal(p.isFreePreviewEnabled(), false);
  assert.equal(p.isProActive(), true);
  assert.equal(p.canUseFreePreview(), false);
  p.setFreePreviewEnabled(true);
  assert.equal(p.isProActive(), true);
  const restarted = load(info(true)).api;
  await restarted.initPurchases();
  assert.equal(restarted.isFreePreviewEnabled(), false);
  assert.equal(restarted.isProActive(), true);
  const free = load(info(true, false)).api;
  await free.initPurchases();
  free.setFreePreviewEnabled(true); free.setFreePreviewEnabled(false);
  assert.equal(free.isProActive(), false); // The toggle never grants Pro.
  console.log('PASS: free restrictions, live refresh, purchase/restore guard, production exclusion, restart and genuine entitlement restoration');
})().catch(error => { console.error(error); process.exitCode = 1; });
