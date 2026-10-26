const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

const rootDir = __dirname;
const iconsDir = path.join(rootDir, 'src-tauri', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function findUserAppIcon() {
  const candidates = [
    path.join(rootDir, 'app-icon.png'),
    path.join(rootDir, 'public', 'app-icon.png'),
    path.join(rootDir, 'public', 'icon.png')
  ];

  for (const fullPath of candidates) {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() && fs.statSync(fullPath).size > 100) {
      console.log(`[Icon Generator] Found user app-icon file: ${fullPath}`);
      return fullPath;
    }
  }

  return null;
}

async function run() {
  const rawSource = findUserAppIcon();
  if (!rawSource) {
    console.error('[Icon Generator] Error: Could not find app-icon in the project root folder!');
    process.exit(1);
  }

  const appIconPath = path.join(rootDir, 'app-icon.png');
  const tmpPath = appIconPath + '.tmp';

  // Always prepare a 1024x1024 1:1 square RGBA PNG from the user's app-icon file (required by Tauri CLI)
  console.log(`[Icon Generator] Normalizing user app-icon (${path.basename(rawSource)}) to 1024x1024 RGBA PNG...`);
  await sharp(rawSource)
    .ensureAlpha()
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(tmpPath);

  fs.renameSync(tmpPath, appIconPath);
  console.log('✅ app-icon.png prepared in 1024x1024 square format.');

  // Sync to public folder for Web/PWA & Desktop runtime window icon
  const publicDir = path.join(rootDir, 'public');
  if (fs.existsSync(publicDir)) {
    fs.copyFileSync(appIconPath, path.join(publicDir, 'app-icon.png'));
    fs.copyFileSync(appIconPath, path.join(publicDir, 'icon.png'));
  }

  console.log('[Icon Generator] Building all Tauri desktop icons (.ico, .icns, .png) from app-icon.png...');
  execSync('npx tauri icon app-icon.png -o src-tauri/icons', { stdio: 'inherit', cwd: rootDir });

  const icoPath = path.join(iconsDir, 'icon.ico');
  if (fs.existsSync(icoPath)) {
    const icoSize = fs.statSync(icoPath).size;
    console.log(`✅ src-tauri/icons/icon.ico generated (${icoSize} bytes).`);
  }

  console.log('🎉 Tauri desktop icons successfully generated from your app-icon!');
}

run().catch((err) => {
  console.error('[Icon Generator] Fatal error:', err);
  process.exit(1);
});
