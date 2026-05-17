// Learn more https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// three.js and @react-three/* ship ESM with subpath "exports" maps
// (e.g. @react-three/fiber/native). Ensure Metro resolves them.
config.resolver.unstable_enablePackageExports = true
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs']

module.exports = config
