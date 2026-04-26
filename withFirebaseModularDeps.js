const { withPodfile } = require('@expo/config-plugins');

const PODFILE_BLOCK_START = "# BEGIN Firebase modular headers";
const PODFILE_BLOCK_END = "# END Firebase modular headers";

function buildPodfileBlock() {
  const pods = [
    'GoogleUtilities',
    'FirebaseAuthInterop',
    'FirebaseAppCheckInterop',
    'RecaptchaInterop',
    'FirebaseMessagingInterop',
    'FirebaseFirestoreInternal',
  ];

  const lines = [
    `  ${PODFILE_BLOCK_START}`,
    '  # CocoaPods: allow Swift Firebase pods to be integrated as static libraries',
    "  # by generating module maps for non-modular transitive deps.",
    ...pods.map((pod) => `  pod '${pod}', :modular_headers => true`),
    `  ${PODFILE_BLOCK_END}`,
    '',
  ];

  return `\n${lines.join('\n')}`;
}

function insertAfterUseExpoModules(contents, block) {
  // Typical Expo prebuild Podfile has `use_expo_modules!` inside the target.
  const useExpoModulesRegex = /(\n\s*use_expo_modules!\s*\n)/;
  if (useExpoModulesRegex.test(contents)) {
    return contents.replace(useExpoModulesRegex, `$1${block}`);
  }
  return null;
}

function insertAfterTargetStart(contents, block) {
  // Fallback: insert right after the first target declaration.
  const targetRegex = /(\n\s*target\s+['"][^'"]+['"]\s+do\s*\n)/;
  if (targetRegex.test(contents)) {
    return contents.replace(targetRegex, `$1${block}`);
  }
  return null;
}

const withFirebaseModularDeps = (config) =>
  withPodfile(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes(PODFILE_BLOCK_START) || contents.includes(PODFILE_BLOCK_END)) {
      return config;
    }

    const block = buildPodfileBlock();

    let updated = insertAfterUseExpoModules(contents, block);
    if (!updated) {
      updated = insertAfterTargetStart(contents, block);
    }

    if (updated && updated !== contents) {
      contents = updated;
    }

    config.modResults.contents = contents;
    return config;
  });

module.exports = withFirebaseModularDeps;
