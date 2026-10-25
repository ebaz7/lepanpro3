const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

const rootDir = __dirname;
const iconsDir = path.join(rootDir, 'src-tauri', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function getValidSource() {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const candidates = [
    'public/assets/aistudio/image_ac0aff99.png',
    'app-icon.png',
    'public/app-icon.png'
  ];

  for (const file of candidates) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
      try {
        const buf = fs.readFileSync(fullPath);
        if (buf.length > 8 && buf.subarray(0, 8).equals(pngHeader)) {
          console.log(`[Icon Generator] Strictly using user PNG source: ${file} (${buf.length} bytes)`);
          return fullPath;
        }
      } catch (err) {
        console.warn(`[Icon Generator] Could not read ${file}:`, err.message);
      }
    }
  }
  return null;
}

async function run() {
  const rawSource = getValidSource();
  if (!rawSource) {
    console.error('[Icon Generator] Error: No valid user app-icon.png found!');
    process.exit(1);
  }

  const appIconPath = path.join(rootDir, 'app-icon.png');
  
  // Always prepare pristine 1024x1024 1:1 square PNG from user image (required by Tauri CLI)
  console.log(`[Icon Generator] Converting user logo to 1024x1024 square PNG...`);
  await sharp(rawSource)
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(appIconPath + '.tmp');

  fs.renameSync(appIconPath + '.tmp', appIconPath);
  console.log('✅ app-icon.png converted to 1024x1024 square format.');

  // Also sync to public folder for Web/PWA
  fs.copyFileSync(appIconPath, path.join(rootDir, 'public', 'app-icon.png'));
  fs.copyFileSync(appIconPath, path.join(rootDir, 'public', 'icon.png'));

  console.log('[Icon Generator] Building Tauri desktop icons using Tauri CLI...');
  execSync('npx tauri icon app-icon.png -o src-tauri/icons', { stdio: 'inherit', cwd: rootDir });

  const icoPath = path.join(iconsDir, 'icon.ico');
  if (fs.existsSync(icoPath)) {
    const icoSize = fs.statSync(icoPath).size;
    console.log(`✅ icon.ico built strictly from user logo (${icoSize} bytes).`);
  }

  console.log('🎉 Tauri icons updated strictly from user logo!');
}

run().catch((err) => {
  console.error('[Icon Generator] Fatal error:', err);
  process.exit(1);
});
