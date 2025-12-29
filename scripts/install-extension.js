const { execSync } = require('child_process');
const { name, version } = require('../package.json');

const vsixFile = `${name}-${version}.vsix`;

try {
  execSync(`code --install-extension "${vsixFile}"`, { stdio: 'inherit' });
  console.log(`Successfully installed ${vsixFile}`);
} catch (error) {
  console.error(`Failed to install extension: ${error.message}`);
  process.exit(1);
}
