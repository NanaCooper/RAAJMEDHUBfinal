const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(file, 'utf8');

      // Add use_modular_headers! globally at the top of the Podfile
      if (!contents.includes('use_modular_headers!')) {
        contents = "use_modular_headers!\n" + contents;
        fs.writeFileSync(file, contents);
      }
      
      return config;
    },
  ]);
};

module.exports = withModularHeaders;
