const { withPodfile } = require('@expo/config-plugins');

const START = '# BEGIN RNFirebase iOS Fix';
const END = '# END RNFirebase iOS Fix';

function findLineStart(contents, index) {
  const prevNewline = contents.lastIndexOf('\n', index);
  return prevNewline === -1 ? 0 : prevNewline + 1;
}

function findLineEnd(contents, index) {
  const nextNewline = contents.indexOf('\n', index);
  return nextNewline === -1 ? contents.length : nextNewline + 1;
}

function replaceExistingBlock(contents, block) {
  const startIndex = contents.indexOf(START);
  const endIndex = contents.indexOf(END);
  if (startIndex === -1 || endIndex === -1) return null;
  const blockStart = findLineStart(contents, startIndex);
  const blockEnd = findLineEnd(contents, endIndex + END.length);
  return `${contents.slice(0, blockStart)}${block}${contents.slice(blockEnd)}`;
}

// This Ruby block is injected into the post_install hook of the generated Podfile.
// It fixes header visibility and modular include issues for ALL pods, which is the
// correct approach when using useFrameworks: static with the New Architecture.
function buildFixBlock() {
  const lines = [
    `  ${START}`,
    `  installer.pods_project.targets.each do |target|`,
    `    target.build_configurations.each do |config|`,
    `      # Allow non-modular headers for ALL pods to prevent "file not found" errors`,
    `      # when using useFrameworks: static with Firebase and New Architecture.`,
    `      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'`,
    `      config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'`,
    `      config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'`,
    ``,
    `      # Ensure the deployment target is consistent for all pods`,
    `      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'`,
    ``,
    `      # Ensure SDWebImage public headers are visible to pods that depend on it`,
    `      existing_paths = config.build_settings['HEADER_SEARCH_PATHS'] || '$(inherited)'`,
    `      sdwebimage_path = '"$(PODS_ROOT)/Headers/Public/SDWebImage"'`,
    `      unless existing_paths.to_s.include?('SDWebImage')`,
    `        config.build_settings['HEADER_SEARCH_PATHS'] = "#{existing_paths} #{sdwebimage_path}"`,
    `      end`,
    ``,
    `      # Enable Clang modules for pods that require Swift <-> ObjC interop`,
    `      if ['RNFBFirestore', 'SDWebImageWebPCoder', 'FirebaseAuth'].include?(target.name)`,
    `        config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'`,
    `      end`,
    `    end`,
    ``,
    `    # Ensure FirebaseAuth generates and exports its Swift-to-ObjC bridging header`,
    `    next unless target.name == 'FirebaseAuth'`,
    `    target.build_configurations.each do |config|`,
    `      config.build_settings['DEFINES_MODULE'] = 'YES'`,
    `      config.build_settings['SWIFT_INSTALL_OBJC_HEADER'] = 'YES'`,
    `      config.build_settings['SWIFT_OBJC_INTERFACE_HEADER_NAME'] = 'FirebaseAuth-Swift.h'`,
    `    end`,
    `  end`,
    `  ${END}`,
    ``,
  ];
  return lines.join('\n');
}

function buildPostInstallWrapper(innerBlock) {
  return `\npost_install do |installer|\n${innerBlock}\nend\n`;
}

function insertIntoPostInstall(contents, block) {
  const re = /(\n\s*post_install\s+do\s+\|installer\|\s*\n)/;
  if (!re.test(contents)) return null;
  return contents.replace(re, `$1${block}`);
}

const withFirebaseAuthSwiftHeaderFix = (config) =>
  withPodfile(config, (config) => {
    let contents = config.modResults.contents;
    const block = buildFixBlock();

    // If the block already exists, replace it so updates to this plugin take effect.
    const replaced = replaceExistingBlock(contents, block);
    if (replaced) {
      config.modResults.contents = replaced;
      return config;
    }

    const updated = insertIntoPostInstall(contents, block);
    if (updated) {
      contents = updated;
    } else {
      // No post_install block found — append our own.
      contents = `${contents}${buildPostInstallWrapper(block)}`;
    }

    config.modResults.contents = contents;
    return config;
  });

module.exports = withFirebaseAuthSwiftHeaderFix;
