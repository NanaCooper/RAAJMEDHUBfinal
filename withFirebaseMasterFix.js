const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withFirebaseMasterFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(file, 'utf8');

      const masterFix = `
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # 1. Force iOS 13.0 for all pods to ensure header compatibility
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.0'
        
        # 2. Allow non-modular includes (Crucial for Firebase + New Arch)
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        
        # 3. Comprehensive Header Search Paths for React and Firebase
        config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
        config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/Headers/Public/React-Core"'
        config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/Headers/Public/Firebase"'
        config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_CONFIGURATION_BUILD_DIR)/React-Core/React.framework/Headers"'
        
        # 4. Protobuf fix for New Architecture
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'GPB_USE_PROTOBUF_FRAMEWORK_IMPORTS=1'
        
        # 5. Fix Swift visibility for React Native modules
        if target.name.start_with?('RNFB') || target.name.start_with?('gRPC')
          config.build_settings['DEFINES_MODULE'] = 'YES'
          config.build_settings['OTHER_SWIFT_FLAGS'] ||= ['$(inherited)']
          # USE PARENTHESES INSTEAD OF CURLY BRACES SO JS DOESN'T INTERPOLATE
          config.build_settings['OTHER_SWIFT_FLAGS'] << '-Xcc -fmodule-map-file="$(PODS_ROOT)/Headers/Public/React-Core/React.modulemap"'
        end
      end
    end
`;

      if (!contents.includes('DEFINES_MODULE')) {
        contents = contents.replace(
          /post_install do \|installer\|/g,
          `post_install do |installer|${masterFix}`
        );
        fs.writeFileSync(file, contents);
      }
      return config;
    },
  ]);
};

module.exports = withFirebaseMasterFix;
