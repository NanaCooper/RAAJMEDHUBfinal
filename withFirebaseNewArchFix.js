const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withFirebaseNewArchFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(file, 'utf8');

      const addition = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Force a modern iOS deployment target (Fixes the "too many errors" issue)
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.0'
        
        # Allow non-modular includes
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        
        # Disable warnings-as-errors for specific issues
        config.build_settings['OTHER_CFLAGS'] ||= ['$(inherited)']
        config.build_settings['OTHER_CFLAGS'] << '-Wno-error=non-modular-include-in-framework-module'
        
        # Fix for gRPC/Protobuf in New Architecture
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'GPB_USE_PROTOBUF_FRAMEWORK_IMPORTS=1'
      end
    end
`;

      if (!contents.includes('IPHONEOS_DEPLOYMENT_TARGET')) {
        contents = contents.replace(
          /post_install do \|installer\|/g,
          `post_install do |installer|${addition}`
        );
        fs.writeFileSync(file, contents);
      }
      return config;
    },
  ]);
};

module.exports = withFirebaseNewArchFix;
