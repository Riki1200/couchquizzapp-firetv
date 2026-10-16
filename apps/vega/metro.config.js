// Metro configuration for the Vega app in this Yarn workspace.
// https://facebook.github.io/metro/docs/configuration
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/** @type {import('metro-config').MetroConfig} */
const config = {
  watchFolders: [path.resolve(__dirname, '../../packages/shared-ui'), path.resolve(__dirname, '../../packages/protocol')],
  resolver: {
    unstable_enableSymlinks: true,
    // `*.vega.ts(x)` files replace their web/Android counterparts on Vega (e.g. sounds.vega.ts).
    sourceExts: ['vega.tsx', 'vega.ts', 'vega.js', 'tsx', 'ts', 'jsx', 'js', 'json'],
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules'), path.resolve(__dirname, '../../node_modules')],
    // Always use the Vega app's React / React Native, even from the shared packages.
    extraNodeModules: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
      '@babel/runtime': path.resolve(__dirname, 'node_modules/@babel/runtime'),
      '@couch-quiz/protocol': path.resolve(__dirname, '../../packages/protocol'),
    },
    resolverMainFields: ['react-native', 'browser', 'main'],
    platforms: ['native', 'ios', 'android', 'tv'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
