const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

const TRANSPARENT_BG = { r: 0, g: 0, b: 0, alpha: 0 };
const rootDir = __dirname;

const ANDROID_MIPMAPS = [
  { folder: 'mipmap-ldpi', legacySize: 36, adaptiveSize: 81 },
  { folder: 'mipmap-mdpi', legacySize: 48, adaptiveSize: 108 },
  { folder: 'mipmap-hdpi', legacySize: 72, adaptiveSize: 162 },
  { folder: 'mipmap-xhdpi', legacySize: 96, adaptiveSize: 216 },
  { folder: 'mipmap-xxhdpi', legacySize: 144, adaptiveSize: 324 },
  { folder: 'mipmap-xxxhdpi', legacySize: 192, adaptiveSize: 432 },
];

const SPLASH_DRAWABLE_FOLDERS = [
  'drawable',
  'drawable-night',
  'drawable-port-mdpi',
  'drawable-port-hdpi',
  'drawable-port-xhdpi',
  'drawable-port-xxhdpi',
  'drawable-port-xxxhdpi',
  'drawable-land-mdpi',
  'drawable-land-hdpi',
  'drawable-land-xhdpi',
  'drawable-land-xxhdpi',
  'drawable-land-xxxhdpi'
];

const TAURI_PNG_SIZES = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
  { name: 'StoreLogo.png', size: 50 },
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
];

/**
 * Scans root and subfolders for any image file named app-icon.* or app_icon.* or icon.*
 * Sorts by modification time (mtimeMs) DESCENDING to ALWAYS select the newest user file.
 */
async function findLatestUserAppIcon() {
  const searchDirs = [rootDir, path.join(rootDir, 'public'), path.join(rootDir, 'assets')];
  const validExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.bmp', '.tiff'];
  
  const candidates = [];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        const baseName = path.basename(file, ext).toLowerCase();

        if (['app-icon', 'app_icon', 'icon', 'appicon'].includes(baseName) || baseName.startsWith('app-icon')) {
          const fullPath = path.join(dir, file);
          try {
            const stats = fs.statSync(fullPath);
            if (stats.isFile() && stats.size > 50) {
              // Verify it's a readable image with Sharp
              const meta = await sharp(fullPath).metadata();
              if (meta && meta.width && meta.height) {
                candidates.push({
                  fullPath,
                  mtimeMs: stats.mtimeMs,
                  size: stats.size,
                  width: meta.width,
                  height: meta.height,
                  format: meta.format
                });
              }
            }
          } catch (_) {
            // Ignore non-image files or unreadable files
          }
        }
      }
    } catch (_) {}
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort candidates by modification time descending (newest file first)
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const selected = candidates[0];
  console.log(`🔍 Found latest icon file: "${path.relative(rootDir, selected.fullPath)}" (${selected.format}, ${selected.width}x${selected.height}, modified: ${new Date(selected.mtimeMs).toLocaleString()})`);
  return selected.fullPath;
}

async function generateAllIcons() {
  console.log('\n🚀 Starting Icon Generator (Zero Background / Pure Transparency)...\n');

  const sourcePath = await findLatestUserAppIcon();
  if (!sourcePath) {
    console.error('❌ Error: Could not find any app-icon file in the project folder!');
    console.error('👉 Please place your image named "app-icon.png" or "app-icon.jpg" in the project root directory.');
    process.exit(1);
  }

  // Normalize source into clean 1024x1024 transparent RGBA PNG at root/app-icon.png
  const rootAppIconPng = path.join(rootDir, 'app-icon.png');
  const tmpNormalizedPath = path.join(rootDir, 'app-icon-normalized.tmp.png');

  console.log('🔄 Normalizing source image to 1024x1024 PNG with transparent background...');
  await sharp(sourcePath)
    .ensureAlpha()
    .resize(1024, 1024, {
      fit: 'contain',
      background: TRANSPARENT_BG
    })
    .png({ compressionLevel: 9, force: true })
    .toFile(tmpNormalizedPath);

  if (fs.existsSync(rootAppIconPng) && sourcePath !== rootAppIconPng) {
    try { fs.unlinkSync(rootAppIconPng); } catch (_) {}
  }
  fs.renameSync(tmpNormalizedPath, rootAppIconPng);
  console.log('✅ Updated root "app-icon.png" successfully.');

  // 1. PUBLIC FOLDER (Web / PWA / Favicons)
  console.log('\n📁 Updating Web & Public assets (public/)...');
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const webIcons = [
    { name: 'app-icon.png', size: 1024 },
    { name: 'icon.png', size: 512 },
    { name: 'favicon.png', size: 32 },
    { name: 'favicon.ico', size: 32 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'pwa-192x192.png', size: 192 },
    { name: 'pwa-512x512.png', size: 512 }
  ];

  for (const { name, size } of webIcons) {
    const targetFile = path.join(publicDir, name);
    if (name.endsWith('.ico')) {
      await sharp(rootAppIconPng)
        .ensureAlpha()
        .resize(size, size, { fit: 'contain', background: TRANSPARENT_BG })
        .png()
        .toFile(targetFile);
    } else {
      await sharp(rootAppIconPng)
        .ensureAlpha()
        .resize(size, size, { fit: 'contain', background: TRANSPARENT_BG })
        .png()
        .toFile(targetFile);
    }
  }
  console.log('✅ Public web & PWA icons generated (no solid background added).');

  // 2. ASSETS FOLDER
  console.log('\n📁 Updating Assets folder (assets/)...');
  const assetsDir = path.join(rootDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  await sharp(rootAppIconPng)
    .ensureAlpha()
    .resize(1024, 1024, { fit: 'contain', background: TRANSPARENT_BG })
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));

  await sharp(rootAppIconPng)
    .ensureAlpha()
    .resize(1024, 1024, { fit: 'contain', background: TRANSPARENT_BG })
    .png()
    .toFile(path.join(assetsDir, 'icon-only.png'));

  await sharp(rootAppIconPng)
    .ensureAlpha()
    .resize(1024, 1024, { fit: 'contain', background: TRANSPARENT_BG })
    .png()
    .toFile(path.join(assetsDir, 'icon-foreground.png'));

  // Fully transparent background asset
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: TRANSPARENT_BG
    }
  })
    .png()
    .toFile(path.join(assetsDir, 'icon-background.png'));

  // Transparent splash screen
  await sharp(rootAppIconPng)
    .ensureAlpha()
    .resize(512, 512, { fit: 'contain', background: TRANSPARENT_BG })
    .extend({
      top: 256,
      bottom: 256,
      left: 256,
      right: 256,
      background: TRANSPARENT_BG
    })
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));

  await sharp(rootAppIconPng)
    .ensureAlpha()
    .resize(512, 512, { fit: 'contain', background: TRANSPARENT_BG })
    .extend({
      top: 256,
      bottom: 256,
      left: 256,
      right: 256,
      background: TRANSPARENT_BG
    })
    .png()
    .toFile(path.join(assetsDir, 'splash-dark.png'));

  console.log('✅ Assets folder icons updated.');

  // 3. TAURI DESKTOP ICONS (src-tauri/icons/)
  console.log('\n🖥️ Generating Tauri Desktop Icons (src-tauri/icons/)...');
  const tauriIconsDir = path.join(rootDir, 'src-tauri', 'icons');
  if (!fs.existsSync(tauriIconsDir)) {
    fs.mkdirSync(tauriIconsDir, { recursive: true });
  }

  for (const { name, size } of TAURI_PNG_SIZES) {
    await sharp(rootAppIconPng)
      .ensureAlpha()
      .resize(size, size, { fit: 'contain', background: TRANSPARENT_BG })
      .png()
      .toFile(path.join(tauriIconsDir, name));
  }

  // Run `npx tauri icon` to generate icon.ico and icon.icns if Tauri CLI is available
  try {
    console.log('⚙️ Executing "npx tauri icon" to compile icon.ico & icon.icns...');
    execSync('npx tauri icon app-icon.png -o src-tauri/icons', { stdio: 'ignore', cwd: rootDir });
    console.log('✅ Tauri icon.ico & icon.icns generated via Tauri CLI.');
  } catch (err) {
    console.warn('⚠️ Warning: "npx tauri icon" failed or Tauri CLI not installed, using fallback ico generator.');
    // Fallback: copy 32x32 PNG to icon.ico or icon.png
    try {
      await sharp(rootAppIconPng)
        .ensureAlpha()
        .resize(256, 256, { fit: 'contain', background: TRANSPARENT_BG })
        .toFile(path.join(tauriIconsDir, 'icon.ico'));
    } catch (_) {}
  }

  // 4. ANDROID RESOURCES (android/app/src/main/res/)
  const androidResDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(androidResDir)) {
    console.log('\n📱 Generating Android Icons & Splash Screens (android/app/src/main/res/)...');

    for (const { folder, legacySize, adaptiveSize } of ANDROID_MIPMAPS) {
      const targetDir = path.join(androidResDir, folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Legacy launcher icons (transparent BG)
      await sharp(rootAppIconPng)
        .ensureAlpha()
        .resize(legacySize, legacySize, { fit: 'contain', background: TRANSPARENT_BG })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher.png'));

      await sharp(rootAppIconPng)
        .ensureAlpha()
        .resize(legacySize, legacySize, { fit: 'contain', background: TRANSPARENT_BG })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_round.png'));

      // Adaptive foreground
      const fgInner = Math.round(adaptiveSize * 0.75);
      const pad = Math.floor((adaptiveSize - fgInner) / 2);

      await sharp(rootAppIconPng)
        .ensureAlpha()
        .resize(fgInner, fgInner, { fit: 'contain', background: TRANSPARENT_BG })
        .extend({
          top: pad,
          bottom: adaptiveSize - fgInner - pad,
          left: pad,
          right: adaptiveSize - fgInner - pad,
          background: TRANSPARENT_BG
        })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

      // Adaptive background (100% TRANSPARENT - NO SOLID COLOR!)
      await sharp({
        create: {
          width: adaptiveSize,
          height: adaptiveSize,
          channels: 4,
          background: TRANSPARENT_BG
        }
      })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_background.png'));
    }

    // Remove mipmap-anydpi-v26 XML wrappers if they force solid background
    const anyDpiDir = path.join(androidResDir, 'mipmap-anydpi-v26');
    if (fs.existsSync(anyDpiDir)) {
      for (const xmlFile of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
        const xmlPath = path.join(anyDpiDir, xmlFile);
        if (fs.existsSync(xmlPath)) {
          try { fs.unlinkSync(xmlPath); } catch (_) {}
        }
      }
      try {
        if (fs.readdirSync(anyDpiDir).length === 0) {
          fs.rmdirSync(anyDpiDir);
        }
      } catch (_) {}
    }

    // Splash drawables (transparent centered icon)
    const splashBuf = await sharp(rootAppIconPng)
      .ensureAlpha()
      .resize(280, 280, { fit: 'contain', background: TRANSPARENT_BG })
      .extend({
        top: 260,
        bottom: 260,
        left: 260,
        right: 260,
        background: TRANSPARENT_BG
      })
      .png()
      .toBuffer();

    for (const drawableFolder of SPLASH_DRAWABLE_FOLDERS) {
      const targetDir = path.join(androidResDir, drawableFolder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(path.join(targetDir, 'splash.png'), splashBuf);
    }

    console.log('✅ Android icons & splashes replaced with transparent versions.');
  }

  console.log('\n✨ ALL ICONS GENERATED SUCCESSFULLY WITH ZERO BACKGROUND BACKGROUNDS!');
  console.log('----------------------------------------------------------------------');
  console.log('📌 Next time you want to update icons:');
  console.log('   1. Drop your new image named "app-icon.png" (or .jpg, .svg, etc.) into the root folder.');
  console.log('   2. Run: npm run generate-icons');
  console.log('----------------------------------------------------------------------\n');
}

generateAllIcons().catch((err) => {
  console.error('❌ Fatal error in generate-all-icons script:', err);
  process.exit(1);
});
