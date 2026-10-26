const { execSync } = require('child_process');
const path = require('path');

console.log('[Desktop Icons Setup] Delegating to generate-all-icons.cjs...');
try {
  execSync('node generate-all-icons.cjs', { stdio: 'inherit', cwd: __dirname });
} catch (err) {
  console.error('[Desktop Icons Setup] Failed to generate icons:', err);
  process.exit(1);
}
