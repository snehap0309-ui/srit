const { spawnSync } = require('child_process');
const path = require('path');

const androidDir = path.resolve(__dirname, '..', 'android');
const wrapper = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const args = process.argv.slice(2);

const result = spawnSync(wrapper, args, {
  cwd: androidDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
