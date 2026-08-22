const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase JS SDK doesn't declare a "react-native" export condition, so
// Metro's newer package-exports resolution picks the browser build and auth
// persistence silently breaks. Falling back to the "main"/"react-native"
// fields keeps the RN-specific build Firebase actually ships.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
