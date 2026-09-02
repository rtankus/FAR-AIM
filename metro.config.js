// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Let Metro bundle our SQLite content file (assets/content/faraim.db) as a
// binary asset, same as an image, so it ships inside the app install.
config.resolver.assetExts.push("db");

module.exports = config;
