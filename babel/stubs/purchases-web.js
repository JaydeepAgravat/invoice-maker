// Android build stand-in for @revenuecat/purchases-js-hybrid-mappings.
// react-native-purchases only uses it in "browser mode" (Expo Go / web),
// which never happens in this app because the native module is always linked.
// Keeping it out of the bundle saves about 1 MB of JavaScript.
function unavailable() {
  throw new Error('RevenueCat browser mode is not available in this build');
}
module.exports = new Proxy({}, { get: () => unavailable });
