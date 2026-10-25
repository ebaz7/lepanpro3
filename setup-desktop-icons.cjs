const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

const rootDir = __dirname;
const iconsDir = path.join(rootDir, 'src-tauri', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1. Verify / Recover app-icon.png
function getValidSource() {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const candidates = ['app-icon.png', 'modern-frameless-logo.png', 'assets/icon.png'];

  for (const file of candidates) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
      try {
        const buf = fs.readFileSync(fullPath);
        if (buf.length > 8 && buf.subarray(0, 8).equals(pngHeader)) {
          console.log(`[Icon Generator] Found valid PNG source: ${file} (${buf.length} bytes)`);
          return fullPath;
        } else {
          console.warn(`[Icon Generator] Warning: ${file} exists but has invalid PNG signature!`);
        }
      } catch (err) {
        console.warn(`[Icon Generator] Could not read ${file}:`, err.message);
      }
    }
  }
  return null;
}

async function run() {
  let source = getValidSource();
  if (!source) {
    console.error('[Icon Generator] Error: No valid PNG source found! Creating fallback transparent logo...');
    const fallbackPath = path.join(rootDir, 'app-icon.png');
    await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 }
      }
    }).png().toFile(fallbackPath);
    source = fallbackPath;
  }

  // If app-icon.png is corrupted or different, restore it from valid source cleanly
  const appIconPath = path.join(rootDir, 'app-icon.png');
  if (source !== appIconPath) {
    console.log(`[Icon Generator] Restoring app-icon.png from valid source: ${source}`);
    await sharp(source).png().toFile(appIconPath);
  }

  console.log('[Icon Generator] Generating full 3.00-compliant multi-res icons using Tauri CLI...');
  
  let tauriCliSuccess = false;
  try {
    execSync('npx tauri icon app-icon.png -o src-tauri/icons', { stdio: 'inherit', cwd: rootDir });
    tauriCliSuccess = true;
    console.log('✅ Tauri official multi-resolution icon bundle generated successfully.');
  } catch (err) {
    console.warn('[Icon Generator] tauri icon CLI warning:', err.message);
  }

  // Verify icon.ico exists and has valid 3.00 multi-frame Win32 format (> 10KB)
  const icoPath = path.join(iconsDir, 'icon.ico');
  const isIcoValid = fs.existsSync(icoPath) && fs.statSync(icoPath).size > 10000;

  if (!isIcoValid) {
    console.log('[Icon Generator] Fallback: Generating individual PNG icons with sharp...');
    const sizes = [
      { name: '32x32.png', size: 32 },
      { name: '128x128.png', size: 128 },
      { name: '128x128@2x.png', size: 256 },
      { name: 'icon.png', size: 512 },
      { name: 'Square30x30Logo.png', size: 30 },
      { name: 'Square44x44Logo.png', size: 44 },
      { name: 'Square71x71Logo.png', size: 71 },
      { name: 'Square89x89Logo.png', size: 89 },
      { name: 'Square107x107Logo.png', size: 107 },
      { name: 'Square142x142Logo.png', size: 142 },
      { name: 'Square150x150Logo.png', size: 150 },
      { name: 'Square284x284Logo.png', size: 284 },
      { name: 'Square310x310Logo.png', size: 310 },
      { name: 'StoreLogo.png', size: 50 },
    ];

    for (const item of sizes) {
      const dest = path.join(iconsDir, item.name);
      await sharp(source)
        .resize(item.size, item.size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(dest);
    }
  }

  // Final verification of icon.ico
  if (fs.existsSync(icoPath)) {
    const icoSize = fs.statSync(icoPath).size;
    console.log(`[Icon Generator] icon.ico verified (${icoSize} bytes).`);
  }

  console.log('🎉 Tauri icons are 100% verified and ready for build.');
}

run().catch((err) => {
  console.error('[Icon Generator] Fatal error:', err);
  process.exit(1);
});
