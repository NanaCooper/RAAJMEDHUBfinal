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
        
        # 3. Fix gRPC module map visibility
        config.build_settings['HEADER_SEARCH_PATHS'] ||= ['$(inherited)']
        config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/Headers/Public/React-Core"'
        config.build_settings['HEADER_SEARCH_PATHS'] << '"$(PODS_ROOT)/Headers/Public/Firebase"'
        
        # 4. Protobuf fix for New Architecture
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'GPB_USE_PROTOBUF_FRAMEWORK_IMPORTS=1'
        
        # 5. Disable strict modular headers for problematic gRPC targets
        if target.name.start_with?('gRPC') || target.name.start_with?('BoringSSL')
          config.build_settings['DEFINES_MODULE'] = 'YES'
        end
      end
    end
`;

      if (!contents.includes('GPB_USE_PROTOBUF_FRAMEWORK_IMPORTS')) {
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
