/**
 * Unified Icon & Asset Generator (Android + Tauri + Web PWA)
 * Usage:
 *   npm run icons
 *   node setup-assets.cjs
 *   node setup-icons.cjs
 *   build-icons.bat
 *
 * Reads `app-icon.png` (or .webp / .jpg / .svg) from the root directory.
 * CRITICAL RULE:
 *   - Automatically detects if the source `app-icon` has a transparent background
 *     or a solid/colored background by sampling corner and edge pixels.
 *   - If `app-icon` has a transparent background: generates all Android, Tauri,
 *     and Web icons WITH a transparent background (no artificial fill).
 *   - If `app-icon` has a colored background: preserves that exact background color
 *     across all Android (legacy, round, adaptive background layer, splash),
 *     Tauri (32x32, 128x128, 256x256, icon.png, icon.ico, icon.icns), and Web icons.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const ROOT_DIR = __dirname;
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const TAURI_ICONS_DIR = path.join(ROOT_DIR, 'src-tauri', 'icons');
const ANDROID_RES_DIR = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');

function findSourceIcon() {
  const candidates = [
    path.join(ROOT_DIR, 'app-icon.png'),
    path.join(ROOT_DIR, 'app-icon.webp'),
    path.join(ROOT_DIR, 'app-icon.jpg'),
    path.join(ROOT_DIR, 'app-icon.jpeg'),
    path.join(ROOT_DIR, 'app-icon.svg'),
    path.join(ROOT_DIR, 'icon.png'),
    path.join(PUBLIC_DIR, 'app-icon.png'),
    path.join(PUBLIC_DIR, 'icon.png'),
    path.join(PUBLIC_DIR, 'pwa-512x512.png')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile() && fs.statSync(candidate).size > 100) {
      return candidate;
    }
  }
  return null;
}

/**
 * Inspects the outer border/corner pixels of the image to determine whether
 * the icon has a transparent background or a solid/colored background.
 */
async function detectIconBackground(imagePath) {
  const image = sharp(imagePath).ensureAlpha();
  const { data, info } = await image
    .resize(64, 64, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const getPixel = (x, y) => {
    const idx = (y * w + x) * 4;
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3]
    };
  };

  // Sample 12 border & corner points
  const sampleCoords = [
    [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1],
    [1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2],
    [Math.floor(w / 2), 0], [Math.floor(w / 2), h - 1],
    [0, Math.floor(h / 2)], [w - 1, Math.floor(h / 2)]
  ];

  const samples = sampleCoords.map(([x, y]) => getPixel(x, y));
  const transparentCount = samples.filter(p => p.a < 40).length;

  // If corners/edges are predominantly transparent -> No background (transparent mode)
  if (transparentCount >= 4) {
    return {
      hasBackground: false,
      rgba: { r: 0, g: 0, b: 0, alpha: 0 },
      hex: '#00000000'
    };
  }

  // Otherwise compute average RGB of opaque border pixels
  const opaqueSamples = samples.filter(p => p.a >= 40);
  const avg = opaqueSamples.reduce(
    (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
    { r: 0, g: 0, b: 0 }
  );
  const count = Math.max(1, opaqueSamples.length);
  const r = Math.round(avg.r / count);
  const g = Math.round(avg.g / count);
  const b = Math.round(avg.b / count);
  const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();

  return {
    hasBackground: true,
    rgba: { r, g, b, alpha: 1 },
    hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`
  };
}

/**
 * Builds a valid Windows .ico container embedding PNG images (256x256, 48x48, 32x32, 16x16)
 * so Tauri / Windows builds always have a crisp multi-resolution icon.ico with exact transparency/background.
 */
async function createIcoFromPngBuffer(masterPngBuffer, bgRgba) {
  const sizes = [256, 48, 32, 16];
  const pngBuffers = [];

  for (const sz of sizes) {
    const buf = await sharp(masterPngBuffer)
      .resize(sz, sz, { fit: 'contain', background: bgRgba })
      .png()
      .toBuffer();
    pngBuffers.push({ size: sz, buffer: buf });
  }

  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + numImages * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(numImages, 4);

  const dirEntries = [];
  for (const item of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(item.size === 256 ? 0 : item.size, 0);
    entry.writeUInt8(item.size === 256 ? 0 : item.size, 1);
    entry.writeUInt8(0, 2); // Palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += item.buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map(p => p.buffer)]);
}

async function generateAllIcons() {
  console.log('==============================================================');
  console.log('🎨 شروع ساخت یکپارچه آیکون‌ها برای اندروید، تائوری و وب');
  console.log('==============================================================');

  const sourceIcon = findSourceIcon();
  if (!sourceIcon) {
    console.error('❌ فایل app-icon.png در پوشه اصلی سرور یافت نشد!');
    console.error('لطفاً فایل آیکون خود را با نام app-icon.png در پوشه اصلی قرار دهید.');
    process.exit(1);
  }

  console.log(`📌 فایل مبدا شناسایی شد: ${path.basename(sourceIcon)} (${sourceIcon})`);

  const bgInfo = await detectIconBackground(sourceIcon);
  if (bgInfo.hasBackground) {
    console.log(`🎨 وضعیت پس‌زمینه: دارای پس‌زمینه رنگی (${bgInfo.hex}) -> تمام آیکون‌های اندروید و تائوری با همین رنگ بک‌گراند ساخته می‌شوند.`);
  } else {
    console.log(`✨ وضعیت پس‌زمینه: بدون پس‌زمینه (Transparent) -> تمام آیکون‌های اندروید و تائوری بدون بک‌گراند (شفاف) ساخته می‌شوند.`);
  }

  // Ensure directories exist
  [ASSETS_DIR, PUBLIC_DIR, TAURI_ICONS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Prepare 1024x1024 master buffer preserving exact background state
  const master1024Buffer = await sharp(sourceIcon)
    .ensureAlpha()
    .resize(1024, 1024, {
      fit: 'contain',
      background: bgInfo.rgba
    })
    .png()
    .toBuffer();

  // Keep root app-icon.png synced in clean 1024x1024 RGBA format
  const rootAppIconPng = path.join(ROOT_DIR, 'app-icon.png');
  const tmpRootIcon = rootAppIconPng + '.tmp';
  fs.writeFileSync(tmpRootIcon, master1024Buffer);
  fs.renameSync(tmpRootIcon, rootAppIconPng);

  // ------------------------------------------------------------------------
  // 1. WEB & PWA ICONS (public/)
  // ------------------------------------------------------------------------
  console.log('\n🌐 [1/3] در حال ساخت آیکون‌های وب و PWA در پوشه public...');
  await sharp(master1024Buffer)
    .resize(512, 512, { fit: 'contain', background: bgInfo.rgba })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'app-icon.png'));

  await sharp(master1024Buffer)
    .resize(512, 512, { fit: 'contain', background: bgInfo.rgba })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'icon.png'));

  await sharp(master1024Buffer)
    .resize(512, 512, { fit: 'contain', background: bgInfo.rgba })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'pwa-512x512.png'));

  await sharp(master1024Buffer)
    .resize(192, 192, { fit: 'contain', background: bgInfo.rgba })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'pwa-192x192.png'));

  await sharp(master1024Buffer)
    .resize(180, 180, { fit: 'contain', background: bgInfo.rgba })
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));

  const faviconIco = await createIcoFromPngBuffer(master1024Buffer, bgInfo.rgba);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), faviconIco);
  console.log('   ✅ آیکون‌های وب و PWA در مسیر public/ ساخته شدند.');

  // ------------------------------------------------------------------------
  // 2. TAURI DESKTOP ICONS (src-tauri/icons/)
  // ------------------------------------------------------------------------
  console.log('\n🖥️ [2/3] در حال ساخت آیکون‌های دسکتاپ تائوری در src-tauri/icons...');
  let tauriCliSucceeded = false;
  try {
    execSync(`npx tauri icon "${rootAppIconPng}" -o src-tauri/icons`, { stdio: 'ignore', cwd: ROOT_DIR });
    tauriCliSucceeded = true;
  } catch (_) {}

  const tauriPngSizes = [
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
    { name: 'StoreLogo.png', size: 50 }
  ];

  for (const item of tauriPngSizes) {
    await sharp(master1024Buffer)
      .resize(item.size, item.size, { fit: 'contain', background: bgInfo.rgba })
      .png()
      .toFile(path.join(TAURI_ICONS_DIR, item.name));
  }

  const tauriIcoBuffer = await createIcoFromPngBuffer(master1024Buffer, bgInfo.rgba);
  fs.writeFileSync(path.join(TAURI_ICONS_DIR, 'icon.ico'), tauriIcoBuffer);
  if (!fs.existsSync(path.join(TAURI_ICONS_DIR, 'icon.icns'))) {
    await sharp(master1024Buffer)
      .resize(512, 512, { fit: 'contain', background: bgInfo.rgba })
      .png()
      .toFile(path.join(TAURI_ICONS_DIR, 'icon.icns'));
  }
  console.log(`   ✅ تمام آیکون‌های تائوری (${tauriCliSucceeded ? 'Tauri CLI + Sharp' : 'Sharp Direct'}) در مسیر src-tauri/icons/ ساخته شدند.`);

  // ------------------------------------------------------------------------
  // 3. ANDROID CAPACITOR ICONS & SPLASH (assets/ + android/app/src/main/res/)
  // ------------------------------------------------------------------------
  console.log('\n🤖 [3/3] در حال ساخت تمام آیکون‌های اندروید در پوشه‌های mipmap و drawable...');

  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.png'), master1024Buffer);
  fs.writeFileSync(path.join(ASSETS_DIR, 'icon-only.png'), master1024Buffer);

  const paddedLogo740 = await sharp(master1024Buffer)
    .resize(740, 740, { fit: 'contain', background: bgInfo.rgba })
    .png()
    .toBuffer();

  const adaptiveForeground1024 = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: bgInfo.rgba
    }
  })
    .composite([{ input: paddedLogo740, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(ASSETS_DIR, 'icon-foreground.png'), adaptiveForeground1024);

  const adaptiveBackground1024 = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: bgInfo.rgba
    }
  })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(ASSETS_DIR, 'icon-background.png'), adaptiveBackground1024);

  // Splash screen (2732x2732)
  const splashBgRgba = bgInfo.hasBackground ? bgInfo.rgba : { r: 15, g: 23, b: 42, alpha: 1 };
  const splashLogo = await sharp(master1024Buffer)
    .resize(640, 640, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const splash2732 = await sharp({
    create: {
      width: 2732,
      height: 2732,
      channels: 4,
      background: splashBgRgba
    }
  })
    .composite([{ input: splashLogo, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(ASSETS_DIR, 'splash.png'), splash2732);
  fs.writeFileSync(path.join(ASSETS_DIR, 'splash-dark.png'), splash2732);

  if (fs.existsSync(ANDROID_RES_DIR)) {
    const mipmapSpecs = [
      { folder: 'mipmap-ldpi', legacySize: 36, fgSize: 81 },
      { folder: 'mipmap-mdpi', legacySize: 48, fgSize: 108 },
      { folder: 'mipmap-hdpi', legacySize: 72, fgSize: 162 },
      { folder: 'mipmap-xhdpi', legacySize: 96, fgSize: 216 },
      { folder: 'mipmap-xxhdpi', legacySize: 144, fgSize: 324 },
      { folder: 'mipmap-xxxhdpi', legacySize: 192, fgSize: 432 }
    ];

    for (const spec of mipmapSpecs) {
      const targetDir = path.join(ANDROID_RES_DIR, spec.folder);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      // 1) ic_launcher.png (preserves exact background or transparency)
      await sharp(master1024Buffer)
        .resize(spec.legacySize, spec.legacySize, { fit: 'contain', background: bgInfo.rgba })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher.png'));

      // 2) ic_launcher_round.png
      if (bgInfo.hasBackground) {
        const circleSvg = Buffer.from(
          `<svg width="${spec.legacySize}" height="${spec.legacySize}"><circle cx="${spec.legacySize / 2}" cy="${spec.legacySize / 2}" r="${spec.legacySize / 2}" fill="white"/></svg>`
        );
        const resizedSquare = await sharp(master1024Buffer)
          .resize(spec.legacySize, spec.legacySize, { fit: 'contain', background: bgInfo.rgba })
          .png()
          .toBuffer();

        await sharp(resizedSquare)
          .composite([{ input: circleSvg, blend: 'dest-in' }])
          .png()
          .toFile(path.join(targetDir, 'ic_launcher_round.png'));
      } else {
        await sharp(master1024Buffer)
          .resize(spec.legacySize, spec.legacySize, { fit: 'contain', background: bgInfo.rgba })
          .png()
          .toFile(path.join(targetDir, 'ic_launcher_round.png'));
      }

      // 3) ic_launcher_foreground.png
      await sharp(adaptiveForeground1024)
        .resize(spec.fgSize, spec.fgSize, { fit: 'contain', background: bgInfo.rgba })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

      // 4) ic_launcher_background.png
      await sharp(adaptiveBackground1024)
        .resize(spec.fgSize, spec.fgSize, { fit: 'contain', background: bgInfo.rgba })
        .png()
        .toFile(path.join(targetDir, 'ic_launcher_background.png'));
    }

    const valuesDir = path.join(ANDROID_RES_DIR, 'values');
    if (!fs.existsSync(valuesDir)) fs.mkdirSync(valuesDir, { recursive: true });
    const bgXmlPath = path.join(valuesDir, 'ic_launcher_background.xml');
    const colorValue = bgInfo.hasBackground ? bgInfo.hex : '#00000000';
    const bgXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${colorValue}</color>
</resources>
`;
    fs.writeFileSync(bgXmlPath, bgXmlContent, 'utf8');

    // If transparent background, remove mipmap-anydpi-v26 XML wrappers so Android launchers never force a white circle plate behind the transparent PNG
    const anyDpiDir = path.join(ANDROID_RES_DIR, 'mipmap-anydpi-v26');
    if (!bgInfo.hasBackground) {
      if (fs.existsSync(anyDpiDir)) {
        for (const xmlFile of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
          const xmlPath = path.join(anyDpiDir, xmlFile);
          if (fs.existsSync(xmlPath)) {
            try { fs.unlinkSync(xmlPath); } catch (_) {}
          }
        }
      }
    } else {
      if (!fs.existsSync(anyDpiDir)) fs.mkdirSync(anyDpiDir, { recursive: true });
      const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
      fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
      fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');
    }

    // Update Android splash drawables
    const drawableDirs = [
      { folder: 'drawable', w: 480, h: 800 },
      { folder: 'drawable-night', w: 480, h: 800 },
      { folder: 'drawable-port-mdpi', w: 320, h: 480 },
      { folder: 'drawable-port-hdpi', w: 480, h: 800 },
      { folder: 'drawable-port-xhdpi', w: 720, h: 1280 },
      { folder: 'drawable-port-xxhdpi', w: 960, h: 1600 },
      { folder: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
      { folder: 'drawable-land-mdpi', w: 480, h: 320 },
      { folder: 'drawable-land-hdpi', w: 800, h: 480 },
      { folder: 'drawable-land-xhdpi', w: 1280, h: 720 },
      { folder: 'drawable-land-xxhdpi', w: 1600, h: 960 },
      { folder: 'drawable-land-xxxhdpi', w: 1920, h: 1280 }
    ];

    for (const d of drawableDirs) {
      const dPath = path.join(ANDROID_RES_DIR, d.folder);
      if (!fs.existsSync(dPath)) fs.mkdirSync(dPath, { recursive: true });
      const logoSize = Math.round(Math.min(d.w, d.h) * 0.38);
      const centeredLogo = await sharp(master1024Buffer)
        .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      await sharp({
        create: {
          width: d.w,
          height: d.h,
          channels: 4,
          background: splashBgRgba
        }
      })
        .composite([{ input: centeredLogo, gravity: 'center' }])
        .png()
        .toFile(path.join(dPath, 'splash.png'));
    }

    console.log(`   ✅ تمام آیکون‌های اندروید در مسیر android/app/src/main/res/mipmap-* با پس‌زمینه (${colorValue}) ساخته شدند.`);
  } else {
    console.warn('   ⚠️ پوشه android/app/src/main/res یافت نشد؛ فایل‌های آماده در assets/ ذخیره شدند.');
  }

  console.log('\n==============================================================');
  console.log('🎉 عملیات ساخت آیکون‌ها با موفقیت کامل شد! مسیرهای خروجی:');
  console.log('   1) وب و PWA:      public/app-icon.png , public/pwa-512x512.png , public/favicon.ico');
  console.log('   2) دسکتاپ تائوری: src-tauri/icons/icon.ico , src-tauri/icons/icon.png , 32x32, 128x128');
  console.log('   3) اندروید:       android/app/src/main/res/mipmap-mdpi ... mipmap-xxxhdpi');
  console.log('==============================================================');
}

if (require.main === module) {
  generateAllIcons().catch(err => {
    console.error('❌ خطا در ساخت آیکون‌ها:', err);
    process.exit(1);
  });
}

module.exports = { generateAllIcons, detectIconBackground };
