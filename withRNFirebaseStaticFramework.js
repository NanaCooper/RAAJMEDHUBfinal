const { withPodfile } = require('@expo/config-plugins');

function insertAfterPlatform(contents, insertion) {
  const platformRegex = /(\n\s*platform\s*:ios[^\n]*\n)/;
  if (platformRegex.test(contents)) {
    return contents.replace(platformRegex, `$1${insertion}`);
  }
  return null;
}

/**
 * Ensures React Native Firebase is integrated as static frameworks.
 * Fixes: 'FirebaseAuth/FirebaseAuth-Swift.h' file not found (RNFBStorage).
 */
const withRNFirebaseStaticFramework = (config) =>
  withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    const rnFirebaseFlag = '$RNFirebaseAsStaticFramework = true';

    // Ensure the RNFirebase flag is set.
    if (!contents.includes(rnFirebaseFlag)) {
      const insertion = `\n${rnFirebaseFlag}\n`;
      const updated = insertAfterPlatform(contents, insertion);
      contents = updated ?? `${insertion}${contents}`;
    }

    // Ensure we use frameworks (static linkage) if not already present.
    // Note: expo-build-properties may add this too; we only add it if missing.
    if (!contents.includes('use_frameworks!')) {
      const insertion = `\nuse_frameworks! :linkage => :static\n`;
      const updated = insertAfterPlatform(contents, insertion);
      contents = updated ?? `${insertion}${contents}`;
    }

    config.modResults.contents = contents;
    return config;
  });

module.exports = withRNFirebaseStaticFramework;
