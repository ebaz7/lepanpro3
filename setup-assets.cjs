const { execSync } = require('child_process');

console.log('[Assets Setup] Delegating to generate-all-icons.cjs...');
try {
  execSync('node generate-all-icons.cjs', { stdio: 'inherit', cwd: __dirname });
} catch (err) {
  console.error('[Assets Setup] Failed to generate assets:', err);
  process.exit(1);
}
