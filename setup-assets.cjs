const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { findSourceAppIcon, syncNormalizedMasterIcon } = require('./resolve-app-icon.cjs');

const TRANSPARENT_BG = { r: 0, g: 0, b: 0, alpha: 0 };
const DARK_SLATE_BG = { r: 15, g: 23, b: 42, alpha: 1 };

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

async function prepareAssets() {
  const rootDir = __dirname;
  const assetsDir = path.join(rootDir, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  console.log('====================================================');
  console.log('   📱 Android / Capacitor Assets Generator (Sync)   ');
  console.log('====================================================');

  const sourceIcon = findSourceAppIcon(rootDir);
  if (!sourceIcon) {
    console.error('❌ Error: Could not find user logo or icon in project!');
    process.exit(1);
  }

  // 1. Normalize and sync 1024x1024 master icon across root and public folders
  const normalizedAppIcon = await syncNormalizedMasterIcon(sourceIcon, rootDir);

  // 2. Generate Capacitor 1024x1024 icon.png and icon-only.png
  console.log('🎨 Generating Capacitor assets in ./assets folder...');
  await sharp(normalizedAppIcon)
    .ensureAlpha()
    .resize(1024, 1024, { fit: 'contain', background: TRANSPARENT_BG })
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));

  await sharp(normalizedAppIcon)
    .ensureAlpha()
    .resize(1024, 1024, { fit: 'contain', background: TRANSPARENT_BG })
    .png()
    .toFile(path.join(assetsDir, 'icon-only.png'));

  // 3. Generate icon-foreground.png and transparent icon-background.png
  await sharp(normalizedAppIcon)
    .ensureAlpha()
    .resize(860, 860, { fit: 'contain', background: TRANSPARENT_BG })
    .extend({
      top: 82,
      bottom: 82,
      left: 82,
      right: 82,
      background: TRANSPARENT_BG,
    })
    .png()
    .toFile(path.join(assetsDir, 'icon-foreground.png'));

  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: TRANSPARENT_BG,
    },
  })
    .png()
    .toFile(path.join(assetsDir, 'icon-background.png'));

  // 4. Directly populate Android mipmap directories
  const androidResDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(androidResDir)) {
    console.log('🤖 Generating Android mipmap icons across all DPI resolutions...');
    for (const { folder, legacySize, adaptiveSize } of ANDROID_MIPMAPS) {
      const targetDir = path.join(androidResDir, folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      await sharp(normalizedAppIcon)
        .ensureAlpha()
        .resize(legacySize, legacySize, { fit: 'contain', background: TRANSPARENT_BG })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher.png'));

      await sharp(normalizedAppIcon)
        .ensureAlpha()
        .resize(legacySize, legacySize, { fit: 'contain', background: TRANSPARENT_BG })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_round.png'));

      const fgInner = Math.round(adaptiveSize * 0.78);
      const padTop = Math.floor((adaptiveSize - fgInner) / 2);
      const padBottom = adaptiveSize - fgInner - padTop;
      const padLeft = padTop;
      const padRight = padBottom;

      await sharp(normalizedAppIcon)
        .ensureAlpha()
        .resize(fgInner, fgInner, { fit: 'contain', background: TRANSPARENT_BG })
        .extend({
          top: padTop,
          bottom: padBottom,
          left: padLeft,
          right: padRight,
          background: TRANSPARENT_BG,
        })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

      await sharp({
        create: {
          width: adaptiveSize,
          height: adaptiveSize,
          channels: 4,
          background: TRANSPARENT_BG,
        },
      })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_background.png'));
    }

    // Remove mipmap-anydpi-v26 wrappers so launcher renders PNG icons directly
    const anyDpiDir = path.join(androidResDir, 'mipmap-anydpi-v26');
    if (fs.existsSync(anyDpiDir)) {
      for (const xmlFile of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
        const xmlPath = path.join(anyDpiDir, xmlFile);
        if (fs.existsSync(xmlPath)) {
          fs.unlinkSync(xmlPath);
        }
      }
      try {
        if (fs.readdirSync(anyDpiDir).length === 0) {
          fs.rmdirSync(anyDpiDir);
        }
      } catch (_) {}
    }

    // 5. Populate Android splash screen drawables from app-icon
    console.log('🖼️ Generating Android splash screens from master icon...');
    const splashBuf = await sharp(normalizedAppIcon)
      .ensureAlpha()
      .resize(280, 280, { fit: 'contain', background: TRANSPARENT_BG })
      .extend({
        top: 260,
        bottom: 260,
        left: 260,
        right: 260,
        background: DARK_SLATE_BG,
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
    console.log('✅ Android launcher icons & splash screens updated across all drawables.');
  }

  // 6. Generate root assets splash
  await sharp(normalizedAppIcon)
    .ensureAlpha()
    .resize(512, 512, { fit: 'contain', background: TRANSPARENT_BG })
    .extend({
      top: 1110,
      bottom: 1110,
      left: 1110,
      right: 1110,
      background: DARK_SLATE_BG,
    })
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));

  await sharp(normalizedAppIcon)
    .ensureAlpha()
    .resize(512, 512, { fit: 'contain', background: TRANSPARENT_BG })
    .extend({
      top: 1110,
      bottom: 1110,
      left: 1110,
      right: 1110,
      background: DARK_SLATE_BG,
    })
    .png()
    .toFile(path.join(assetsDir, 'splash-dark.png'));

  console.log('🎉 Android & Web assets successfully generated from your chosen image!\n');
}

prepareAssets().catch((err) => {
  console.error('Failed generating assets:', err);
  process.exit(1);
});
