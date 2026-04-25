const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withAllowNonModularIncludes = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(file, 'utf8');

      const addition = `
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
`;

      if (!contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
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

module.exports = withAllowNonModularIncludes;
