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
        # Force a modern iOS deployment target
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.0'
        
        # Fix the "implicit int" and "non-modular include" errors
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        config.build_settings['USE_HEADERMAP'] = 'NO'
        
        # Ensure OTHER_CFLAGS is a string and append our suppression flags
        current_cflags = config.build_settings['OTHER_CFLAGS'] || '$(inherited)'
        if current_cflags.is_a?(Array)
          config.build_settings['OTHER_CFLAGS'] << '-Wno-error=non-modular-include-in-framework-module'
          config.build_settings['OTHER_CFLAGS'] << '-Wno-implicit-int'
        else
          config.build_settings['OTHER_CFLAGS'] = "#{current_cflags} -Wno-error=non-modular-include-in-framework-module -Wno-implicit-int"
        end

        # Fix for gRPC/Protobuf
        current_defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
        current_defs = [current_defs] if current_defs.is_a?(String)
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = current_defs << 'GPB_USE_PROTOBUF_FRAMEWORK_IMPORTS=1'
      end
    end
`;

      if (!contents.includes('USE_HEADERMAP')) {
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
