const { withPodfile } = require('@expo/config-plugins');

const START = '# BEGIN FirebaseAuth Swift header fix';
const END = '# END FirebaseAuth Swift header fix';

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

function buildFixBlock() {
  return [
    `  ${START}`,
    "  installer.pods_project.targets.each do |target|",
    "    if target.name.start_with?('RNFB')",
    "      target.build_configurations.each do |config|",
    "        # RNFirebase + static frameworks can trigger -Wnon-modular-include-in-framework-module (often treated as -Werror).",
    "        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'",
    "        # RNFBFirestore contains Swift sources and needs Clang modules enabled for the Swift importer.",
    "        # Other RNFB targets are Objective-C/ObjC++ and have historically hit macro parsing issues",
    "        # (e.g. RCT_EXPORT_*) when treated as fully modular in Expo prebuilds.",
    "        if target.name == 'RNFBFirestore'",
    "          config.build_settings['CLANG_ENABLE_MODULES'] = 'YES'",
    "        else",
    "          config.build_settings['CLANG_ENABLE_MODULES'] = 'NO'",
    "        end",
    "      end",
    "    end",
    "",
    "    next unless target.name == 'FirebaseAuth'",
    "    target.build_configurations.each do |config|",
    "      # Ensure the generated Swift-to-ObjC header is produced and exported.",
    "      config.build_settings['DEFINES_MODULE'] = 'YES'",
    "      config.build_settings['SWIFT_INSTALL_OBJC_HEADER'] = 'YES'",
    "      config.build_settings['SWIFT_OBJC_INTERFACE_HEADER_NAME'] = 'FirebaseAuth-Swift.h'",
    "    end",
    "  end",
    "",
    "  # Fix RNFBFirestore modular import errors by importing React bridge types via RNFBAppModule.",
    "  # This avoids: 'declaration of RCTBridgeModule must be imported from module RNFBApp.RNFBAppModule'",
    "  firestore_headers = [",
    "    '../node_modules/@react-native-firebase/firestore/ios/RNFBFirestore/RNFBFirestoreCommon.h',",
    "    '../node_modules/@react-native-firebase/firestore/ios/RNFBFirestore/RNFBFirestoreModule.h',",
    "    '../node_modules/@react-native-firebase/firestore/ios/RNFBFirestore/RNFBFirestoreCollectionModule.h',",
    "    '../node_modules/@react-native-firebase/firestore/ios/RNFBFirestore/RNFBFirestoreDocumentModule.h',",
    "    '../node_modules/@react-native-firebase/firestore/ios/RNFBFirestore/RNFBFirestoreQuery.h',",
    "    '../node_modules/@react-native-firebase/firestore/ios/RNFBFirestore/RNFBFirestoreSerialize.h',",
    "    '../node_modules/@react-native-firebase/firestore/ios/RNFBFirestore/RNFBFirestoreTransactionModule.h',",
    "  ]",
    "",
    "  firestore_headers.each do |relative_path|",
    "    next unless File.exist?(relative_path)",
    "    contents = File.read(relative_path)",
    "    updated = contents.gsub('#import <React/RCTBridgeModule.h>', '#import <RNFBApp/RNFBAppModule.h>')",
    "    File.write(relative_path, updated) if updated != contents",
    "  end",
    "",
    "  # Ensure RNFBFirestore Obj-C sources see RCT_EXTERN / RCT_CONCAT definitions.",
    "  firestore_sources = Dir.glob('../node_modules/@react-native-firebase/firestore/ios/RNFBFirestore/*.{m,mm}')",
    "  firestore_sources.each do |relative_path|",
    "    next unless File.exist?(relative_path)",
    "    contents = File.read(relative_path)",
    "    next unless contents.include?('RCT_EXPORT_')",
    "    next if contents.include?('RCTDefines.h')",
    "",
    "    updated = contents",
    "    if updated.include?('#import <React/RCTUtils.h>')",
    "      updated = updated.gsub('#import <React/RCTUtils.h>', '#import <React/RCTUtils.h>\n#import <React/RCTDefines.h>')",
    "    else",
    "      # Fallback: insert after the first React import if present (avoid regex for Ruby portability).",
    "      lines = updated.lines",
    "      insert_at = nil",
    "      lines.each_with_index do |line, idx|",
    "        if line.start_with?('#import <React/')",
    "          insert_at = idx + 1",
    "          break",
    "        end",
    "      end",
    "      if insert_at",
    "        lines.insert(insert_at, '#import <React/RCTDefines.h>\\n')",
    "        updated = lines.join",
    "      end",
    "    end",
    "",
    "    File.write(relative_path, updated) if updated != contents",
    "  end",
    `  ${END}`,
    '',
  ].join('\n');
}

function buildPostInstallWrapper(innerBlock) {
  return ['\npost_install do |installer|', innerBlock, 'end', ''].join('\n');
}

function insertIntoPostInstall(contents, block) {
  // Insert right after: post_install do |installer|
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
      // Some generated Podfiles may not include a post_install block.
      // In that case, append our own post_install wrapper.
      contents = `${contents}${buildPostInstallWrapper(block)}`;
    }

    config.modResults.contents = contents;
    return config;
  });

module.exports = withFirebaseAuthSwiftHeaderFix;
