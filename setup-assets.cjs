const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const TRANSPARENT_BG = { r: 0, g: 0, b: 0, alpha: 0 };

const ANDROID_MIPMAPS = [
  { folder: 'mipmap-ldpi', legacySize: 36, adaptiveSize: 81 },
  { folder: 'mipmap-mdpi', legacySize: 48, adaptiveSize: 108 },
  { folder: 'mipmap-hdpi', legacySize: 72, adaptiveSize: 162 },
  { folder: 'mipmap-xhdpi', legacySize: 96, adaptiveSize: 216 },
  { folder: 'mipmap-xxhdpi', legacySize: 144, adaptiveSize: 324 },
  { folder: 'mipmap-xxxhdpi', legacySize: 192, adaptiveSize: 432 },
];

async function prepareAssets() {
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const sourceIcon = fs.existsSync(path.join(__dirname, 'app-icon.png'))
    ? path.join(__dirname, 'app-icon.png')
    : path.join(__dirname, 'modern-frameless-logo.png');
  console.log(`Using source icon (transparent/frameless): ${sourceIcon}`);

  // 1. Generate 1024x1024 icon.png and icon-only.png WITH TRANSPARENT BACKGROUND (NO SOLID BACK)
  await sharp(sourceIcon)
    .ensureAlpha()
    .resize(1024, 1024, { fit: 'contain', background: TRANSPARENT_BG })
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));

  await sharp(sourceIcon)
    .ensureAlpha()
    .resize(1024, 1024, { fit: 'contain', background: TRANSPARENT_BG })
    .png()
    .toFile(path.join(assetsDir, 'icon-only.png'));

  // 2. Generate icon-foreground.png and 100% transparent icon-background.png
  await sharp(sourceIcon)
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

  // Transparent background for adaptive icon (never create a solid box behind the icon)
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

  // 3. Directly populate Android mipmap directories with frameless transparent icons
  const androidResDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(androidResDir)) {
    for (const { folder, legacySize, adaptiveSize } of ANDROID_MIPMAPS) {
      const targetDir = path.join(androidResDir, folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // ic_launcher.png & ic_launcher_round.png (full frameless transparent icon)
      await sharp(sourceIcon)
        .ensureAlpha()
        .resize(legacySize, legacySize, { fit: 'contain', background: TRANSPARENT_BG })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher.png'));

      await sharp(sourceIcon)
        .ensureAlpha()
        .resize(legacySize, legacySize, { fit: 'contain', background: TRANSPARENT_BG })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_round.png'));

      // ic_launcher_foreground.png (transparent foreground)
      const fgInner = Math.round(adaptiveSize * 0.78);
      const padTop = Math.floor((adaptiveSize - fgInner) / 2);
      const padBottom = adaptiveSize - fgInner - padTop;
      const padLeft = padTop;
      const padRight = padBottom;

      await sharp(sourceIcon)
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

      // ic_launcher_background.png (100% transparent, no background box)
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

    // Remove mipmap-anydpi-v26 adaptive-icon XML wrappers so Android launchers render the frameless transparent PNG directly without adding a forced background plate
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
    console.log('✅ Android mipmap icons updated (100% transparent background, frameless).');
  }

  // 4. Generate 2732x2732 Splash Screens
  await sharp(sourceIcon)
    .ensureAlpha()
    .resize(512, 512, { fit: 'contain', background: TRANSPARENT_BG })
    .extend({
      top: 1110,
      bottom: 1110,
      left: 1110,
      right: 1110,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    })
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));

  await sharp(sourceIcon)
    .ensureAlpha()
    .resize(512, 512, { fit: 'contain', background: TRANSPARENT_BG })
    .extend({
      top: 1110,
      bottom: 1110,
      left: 1110,
      right: 1110,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    })
    .png()
    .toFile(path.join(assetsDir, 'splash-dark.png'));

  console.log('✅ Assets generated in ./assets directory:');
  console.log(fs.readdirSync(assetsDir));
}

prepareAssets().catch((err) => {
  console.error('Failed generating assets:', err);
});
