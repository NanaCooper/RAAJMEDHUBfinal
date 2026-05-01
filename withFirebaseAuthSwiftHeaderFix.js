const { withPodfile } = require('@expo/config-plugins');

// ─── Sentinel strings ────────────────────────────────────────────────────────
const PRE_START  = '# BEGIN RNFirebase pre_install fix';
const PRE_END    = '# END RNFirebase pre_install fix';
const POST_START = '# BEGIN RNFirebase post_install fix';
const POST_END   = '# END RNFirebase post_install fix';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function lineStart(str, idx) {
  const n = str.lastIndexOf('\n', idx);
  return n === -1 ? 0 : n + 1;
}
function lineEnd(str, idx) {
  const n = str.indexOf('\n', idx);
  return n === -1 ? str.length : n + 1;
}
function replaceBlock(contents, startTag, endTag, block) {
  const si = contents.indexOf(startTag);
  const ei = contents.indexOf(endTag);
  if (si === -1 || ei === -1) return null;
  return (
    contents.slice(0, lineStart(contents, si)) +
    block +
    contents.slice(lineEnd(contents, ei + endTag.length))
  );
}

// ─── pre_install block ───────────────────────────────────────────────────────
// Forces ALL RNFB pods to be static libraries so the bridge macros
// (RCT_EXPORT_MODULE, RCT_EXPORT_METHOD) resolve correctly under
// useFrameworks: static + New Architecture.
function buildPreInstallBlock() {
  return [
    `${PRE_START}`,
    `pre_install do |installer|`,
    `  installer.pod_targets.each do |pod|`,
    `    if pod.name.start_with?('RNFB')`,
    `      def pod.build_type`,
    `        Pod::BuildType.static_library`,
    `      end`,
    `    end`,
    `  end`,
    `end`,
    `${PRE_END}`,
    ``,
  ].join('\n');
}

// ─── post_install block ──────────────────────────────────────────────────────
// Applies comprehensive build-setting fixes to every pod that needs them.
function buildPostInstallBlock() {
  return [
    `  ${POST_START}`,
    `  installer.pods_project.targets.each do |target|`,
    `    target.build_configurations.each do |config|`,
    `      # 1. Allow non-modular headers globally (SDWebImage, Firebase, etc.)`,
    `      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'`,
    `      config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'`,
    `      # 2. Never treat warnings as errors in third-party pods`,
    `      config.build_settings['GCC_TREAT_WARNINGS_AS_ERRORS'] = 'NO'`,
    `      # 3. Enforce a consistent deployment target across all pods`,
    `      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'`,
    `      # 4. Expose SDWebImage public headers to all pods that import them`,
    `      existing = (config.build_settings['HEADER_SEARCH_PATHS'] || '$(inherited)').to_s`,
    `      sdwi = '"$(PODS_ROOT)/Headers/Public/SDWebImage"'`,
    `      unless existing.include?('SDWebImage')`,
    `        config.build_settings['HEADER_SEARCH_PATHS'] = "#{existing} #{sdwi}"`,
    `      end`,
    `      # 5. Enable Clang modules for pods that need Swift<->ObjC or bridge-macro resolution`,
    `      needs_modules = target.name.start_with?('RNFB') ||`,
    `                      ['SDWebImageWebPCoder', 'FirebaseAuth', 'RNWorklets', 'RNReanimated'].include?(target.name)`,
    `      config.build_settings['CLANG_ENABLE_MODULES'] = needs_modules ? 'YES' : 'NO'`,
    `      # 6. Add -Wno-implicit-int as a compiler flag safety-net`,
    `      cflags = (config.build_settings['OTHER_CFLAGS'] || '$(inherited)').to_s`,
    `      unless cflags.include?('-Wno-implicit-int')`,
    `        config.build_settings['OTHER_CFLAGS'] = "#{cflags} -Wno-implicit-int -Wno-error=non-modular-include-in-framework-module"`,
    `      end`,
    `    end`,
    `    # 7. Ensure FirebaseAuth exports its Swift-to-ObjC bridging header`,
    `    next unless target.name == 'FirebaseAuth'`,
    `    target.build_configurations.each do |config|`,
    `      config.build_settings['DEFINES_MODULE'] = 'YES'`,
    `      config.build_settings['SWIFT_INSTALL_OBJC_HEADER'] = 'YES'`,
    `      config.build_settings['SWIFT_OBJC_INTERFACE_HEADER_NAME'] = 'FirebaseAuth-Swift.h'`,
    `    end`,
    `  end`,
    `  ${POST_END}`,
    ``,
  ].join('\n');
}

// ─── Injection helpers ───────────────────────────────────────────────────────
function injectPreInstall(contents, block) {
  // Insert the pre_install block before the first `target '...' do` line
  const re = /(\n\s*target\s+['"][^'"]+['"]\s+do\s*\n)/;
  if (re.test(contents)) {
    return contents.replace(re, `\n${block}$1`);
  }
  // Fallback: prepend
  return `${block}\n${contents}`;
}

function injectPostInstall(contents, block) {
  // Insert right after: post_install do |installer|
  const re = /(\n\s*post_install\s+do\s+\|installer\|\s*\n)/;
  if (re.test(contents)) return contents.replace(re, `$1${block}`);
  // No post_install found — append one
  return `${contents}\npost_install do |installer|\n${block}\nend\n`;
}

// ─── Plugin ──────────────────────────────────────────────────────────────────
const withFirebaseAuthSwiftHeaderFix = (config) =>
  withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    // ── pre_install ──────────────────────────────────────────────────────────
    const preBlock = buildPreInstallBlock();
    const replacedPre = replaceBlock(contents, PRE_START, PRE_END, preBlock);
    if (replacedPre) {
      contents = replacedPre;
    } else {
      contents = injectPreInstall(contents, preBlock);
    }

    // ── post_install ─────────────────────────────────────────────────────────
    const postBlock = buildPostInstallBlock();
    const replacedPost = replaceBlock(contents, POST_START, POST_END, postBlock);
    if (replacedPost) {
      contents = replacedPost;
    } else {
      contents = injectPostInstall(contents, postBlock);
    }

    config.modResults.contents = contents;
    return config;
  });

module.exports = withFirebaseAuthSwiftHeaderFix;
