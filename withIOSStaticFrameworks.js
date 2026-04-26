const { withPodfile } = require('@expo/config-plugins');

function insertAfterPlatform(contents, insertion) {
  const platformRegex = /(\n\s*platform\s*:ios[^\n]*\n)/;
  if (platformRegex.test(contents)) {
    return contents.replace(platformRegex, `$1${insertion}`);
  }
  return null;
}

const withIOSStaticFrameworks = (config) =>
  withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    // Ensure RNFirebase uses static frameworks so Firebase Swift headers are generated.
    const wantFrameworksLine = 'use_frameworks! :linkage => :static';
    const wantRNFirebaseLine = '$RNFirebaseAsStaticFramework = true';

    const needsFrameworks = !contents.includes('use_frameworks!');
    const needsRNFirebaseFlag = !contents.includes(wantRNFirebaseLine);

    if (needsFrameworks || needsRNFirebaseFlag) {
      const lines = [];
      if (needsFrameworks) lines.push(wantFrameworksLine);
      if (needsRNFirebaseFlag) lines.push(wantRNFirebaseLine);
      const insertion = `\n${lines.join('\n')}\n`;

      // Prefer inserting after the platform line (top-level).
      const updated = insertAfterPlatform(contents, insertion);
      contents = updated ?? `${insertion}${contents}`;
    }

    config.modResults.contents = contents;
    return config;
  });

module.exports = withIOSStaticFrameworks;
