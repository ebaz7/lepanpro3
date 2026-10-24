const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function prepareAssets() {
  const assetsDir = path.join(__dirname, 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const sourceIcon = fs.existsSync('app-icon.png') ? 'app-icon.png' : 'modern-frameless-logo.png';
  console.log(`Using source icon: ${sourceIcon}`);

  // 1. Generate 1024x1024 icon.png and icon-only.png
  await sharp(sourceIcon)
    .resize(1024, 1024, { fit: 'contain', background: { r: 15, g: 23, b: 42, alpha: 1 } })
    .toFile(path.join(assetsDir, 'icon.png'));

  await sharp(sourceIcon)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile(path.join(assetsDir, 'icon-only.png'));

  // 2. Generate icon-foreground.png and icon-background.png for Android Adaptive Icons
  await sharp(sourceIcon)
    .resize(800, 800, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 112,
      bottom: 112,
      left: 112,
      right: 112,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .toFile(path.join(assetsDir, 'icon-foreground.png'));

  // Solid dark background for adaptive icon
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // slate-900
    }
  })
  .png()
  .toFile(path.join(assetsDir, 'icon-background.png'));

  // 3. Generate 2732x2732 Splash Screens
  await sharp(sourceIcon)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 1110,
      bottom: 1110,
      left: 1110,
      right: 1110,
      background: { r: 15, g: 23, b: 42, alpha: 1 }
    })
    .toFile(path.join(assetsDir, 'splash.png'));

  await sharp(sourceIcon)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: 1110,
      bottom: 1110,
      left: 1110,
      right: 1110,
      background: { r: 15, g: 23, b: 42, alpha: 1 }
    })
    .toFile(path.join(assetsDir, 'splash-dark.png'));

  console.log('✅ Assets generated in ./assets directory:');
  console.log(fs.readdirSync(assetsDir));
}

prepareAssets().catch(err => {
  console.error('Failed generating assets:', err);
});
