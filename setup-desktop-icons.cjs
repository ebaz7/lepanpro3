const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');
const { findSourceAppIcon, syncNormalizedMasterIcon } = require('./resolve-app-icon.cjs');

const rootDir = __dirname;
const iconsDir = path.join(rootDir, 'src-tauri', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function run() {
  console.log('====================================================');
  console.log('   🖥️ Desktop / Tauri Icon Generator (Auto-Sync)   ');
  console.log('====================================================');

  const sourceIcon = findSourceAppIcon(rootDir);
  if (!sourceIcon) {
    console.error('❌ Error: No icon or logo file found in project!');
    process.exit(1);
  }

  // 1. Normalize and sync 1024x1024 master icon
  const masterAppIcon = await syncNormalizedMasterIcon(sourceIcon, rootDir);

  // 2. Generate all Tauri desktop icons (.ico, .icns, .png)
  console.log('[Icon Generator] Generating Tauri desktop icons from master app-icon...');
  try {
    execSync(`npx tauri icon "${masterAppIcon}" -o src-tauri/icons`, {
      stdio: 'inherit',
      cwd: rootDir
    });
  } catch (tauriIconErr) {
    console.warn('[Icon Generator] npx tauri icon encountered an issue, falling back to sharp manual generation:', tauriIconErr.message);

    const sizes = [
      { name: '32x32.png', width: 32, height: 32 },
      { name: '128x128.png', width: 128, height: 128 },
      { name: '128x128@2x.png', width: 256, height: 256 },
      { name: 'icon.png', width: 512, height: 512 },
      { name: 'Square30x30Logo.png', width: 30, height: 30 },
      { name: 'Square44x44Logo.png', width: 44, height: 44 },
      { name: 'Square71x71Logo.png', width: 71, height: 71 },
      { name: 'Square89x89Logo.png', width: 89, height: 89 },
      { name: 'Square107x107Logo.png', width: 107, height: 107 },
      { name: 'Square142x142Logo.png', width: 142, height: 142 },
      { name: 'Square150x150Logo.png', width: 150, height: 150 },
      { name: 'Square284x284Logo.png', width: 284, height: 284 },
      { name: 'Square310x310Logo.png', width: 310, height: 310 },
      { name: 'StoreLogo.png', width: 50, height: 50 }
    ];

    for (const size of sizes) {
      await sharp(masterAppIcon)
        .resize(size.width, size.height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(path.join(iconsDir, size.name));
    }
  }

  // 3. Verify icon.ico exists and has content
  const icoPath = path.join(iconsDir, 'icon.ico');
  if (fs.existsSync(icoPath)) {
    const icoSize = fs.statSync(icoPath).size;
    console.log(`✅ src-tauri/icons/icon.ico verified (${icoSize} bytes).`);
  } else {
    // Generate fallback ico if needed
    console.log('Generating fallback icon.ico...');
    const icoBuf = await sharp(masterAppIcon).resize(256, 256).png().toBuffer();
    fs.writeFileSync(icoPath, icoBuf);
  }

  console.log('🎉 Tauri desktop icons successfully generated from your chosen image!\n');
}

run().catch((err) => {
  console.error('[Icon Generator] Fatal error:', err);
  process.exit(1);
});
