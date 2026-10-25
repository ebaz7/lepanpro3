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
  // 1. Check root directory for any file named app-icon or app-icon.* (e.g. app-icon.png, app-icon.jpg, app-icon.webp, app-icon.png.png, app-icon)
  const searchDirs = [rootDir, path.join(rootDir, 'public')];
  const exactPreferred = [
    'app-icon.png',
    'app-icon.webp',
    'app-icon.jpg',
    'app-icon.jpeg',
    'app-icon.ico',
    'app-icon.svg',
    'app-icon'
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;

    // Check preferred names first
    for (const name of exactPreferred) {
      const fullPath = path.join(dir, name);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() && fs.statSync(fullPath).size > 100) {
        console.log(`[Icon Generator] Found user app-icon file: ${fullPath}`);
        return fullPath;
      }
    }

    // Also match any app-icon* file (e.g. if Windows Explorer added a double extension like app-icon.png.png or app-icon.jpg)
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (/^app-icon(\.[a-z0-9]+)*$/i.test(file) && !file.endsWith('.tmp')) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isFile() && fs.statSync(fullPath).size > 100) {
          console.log(`[Icon Generator] Auto-detected user app-icon file: ${fullPath}`);
          return fullPath;
        }
      }
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
