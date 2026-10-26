const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const rootDir = process.cwd();
const tauriIconsDir = path.join(rootDir, 'src-tauri', 'icons');
const sourceIconPath = path.join(rootDir, 'app-icon.png');

if (!fs.existsSync(tauriIconsDir)) {
  fs.mkdirSync(tauriIconsDir, { recursive: true });
}

async function generateTauriIcons() {
  console.log('[Tauri Icon Generator] Re-encoding PNG icons safely...');

  let inputBuffer;
  try {
    if (fs.existsSync(sourceIconPath)) {
      inputBuffer = fs.readFileSync(sourceIconPath);
      await sharp(inputBuffer).metadata();
    }
  } catch (err) {
    console.warn('[Tauri Icon Generator] app-icon.png was corrupted or unreadable. Generating fresh icon...');
    inputBuffer = null;
  }

  if (!inputBuffer) {
    const svgIcon = `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#1d4ed8"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="220" fill="url(#bgGrad)"/>
      <circle cx="512" cy="512" r="380" fill="none" stroke="url(#accentGrad)" stroke-width="32" opacity="0.4"/>
      <path d="M350 320 L670 320 L670 420 L450 420 L450 500 L640 500 L640 600 L450 600 L450 700 L350 700 Z" fill="url(#accentGrad)"/>
    </svg>`;
    inputBuffer = Buffer.from(svgIcon);
    await sharp(inputBuffer).png().toFile(sourceIconPath);
    console.log('[Tauri Icon Generator] Created fresh app-icon.png!');
  } else {
    const cleanBuffer = await sharp(inputBuffer).resize(1024, 1024).png({ compressionLevel: 9 }).toBuffer();
    fs.writeFileSync(sourceIconPath, cleanBuffer);
  }

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
    const targetFile = path.join(tauriIconsDir, size.name);
    await sharp(sourceIconPath)
      .resize(size.width, size.height)
      .png({ compressionLevel: 9 })
      .toFile(targetFile);
  }

  const icoFile = path.join(tauriIconsDir, 'icon.ico');
  const ico256 = await sharp(sourceIconPath).resize(256, 256).png().toBuffer();
  fs.writeFileSync(icoFile, ico256);

  console.log('✅ Tauri icons successfully generated in src-tauri/icons!');
}

generateTauriIcons().catch(err => {
  console.error('❌ Error generating Tauri icons:', err);
});
