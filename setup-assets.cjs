const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

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

function findUserAppIcon() {
  const rootDir = __dirname;
  const candidates = [
    path.join(rootDir, 'app-icon.png'),
    path.join(rootDir, 'public', 'app-icon.png'),
    path.join(rootDir, 'public', 'icon.png')
  ];

  for (const fullPath of candidates) {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() && fs.statSync(fullPath).size > 100) {
      return fullPath;
    }
  }

  return null;
}

async function prepareAssets() {
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const rawSource = findUserAppIcon();
  if (!rawSource) {
    console.error('❌ Error: Could not find app-icon in the root folder!');
    process.exit(1);
  }

  console.log(`🎨 Using user app-icon from root folder: ${rawSource}`);

  // Normalize user's app-icon into a clean 1024x1024 RGBA PNG in root (app-icon.png)
  const normalizedAppIcon = path.join(__dirname, 'app-icon.png');
  const tmpNormalized = normalizedAppIcon + '.tmp';
  await sharp(rawSource)
    .ensureAlpha()
    .resize(1024, 1024, { fit: 'contain', background: TRANSPARENT_BG })
    .png()
    .toFile(tmpNormalized);
  fs.renameSync(tmpNormalized, normalizedAppIcon);

  const sourceIcon = normalizedAppIcon;

  // Sync to public folder as well
  const publicDir = path.join(__dirname, 'public');
  if (fs.existsSync(publicDir)) {
    fs.copyFileSync(sourceIcon, path.join(publicDir, 'app-icon.png'));
    fs.copyFileSync(sourceIcon, path.join(publicDir, 'icon.png'));
  }

  // 1. Generate 1024x1024 icon.png and icon-only.png
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

  // 2. Generate icon-foreground.png and transparent icon-background.png
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

  // 3. Directly populate Android mipmap directories
  const androidResDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
  if (fs.existsSync(androidResDir)) {
    for (const { folder, legacySize, adaptiveSize } of ANDROID_MIPMAPS) {
      const targetDir = path.join(androidResDir, folder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

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

    // 4. Populate Android splash screen drawables from app-icon
    console.log('🖼️ Generating Android splash screens from app-icon...');
    const splashBuf = await sharp(sourceIcon)
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

  // 5. Generate root assets splash
  await sharp(sourceIcon)
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

  await sharp(sourceIcon)
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

  console.log('🎉 Android & Web assets generated strictly from your app-icon.');
}

prepareAssets().catch((err) => {
  console.error('Failed generating assets:', err);
  process.exit(1);
});
