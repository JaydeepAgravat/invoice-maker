const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');

/**
 * Web-only dependencies that native builds never execute. Swapping them for
 * stubs keeps them out of the bundle (Metro does not tree-shake).
 */
const STUBS = {
  '@revenuecat/purchases-js-hybrid-mappings': path.resolve(
    __dirname,
    'babel/stubs/purchases-web.js',
  ),
};

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * withSentryConfig stamps a debug ID into each bundle so release crash
 * stack traces can be matched to their source maps.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) =>
      platform !== 'web' && STUBS[moduleName]
        ? { type: 'sourceFile', filePath: STUBS[moduleName] }
        : context.resolveRequest(context, moduleName, platform),
  },
};

module.exports = withSentryConfig(mergeConfig(getDefaultConfig(__dirname), config));
