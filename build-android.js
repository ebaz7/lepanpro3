/**
 * Automated Android APK Builder & Publisher
 * Usage:
 *   npm run release:android               -> Automatically bumps patch version, generates icons, builds signed APK, copies to downloads/
 *   npm run release:android -- 1.2.0      -> Sets version to 1.2.0, builds signed APK, copies to downloads/
 *   npm run build:apk                     -> Builds APK and places it in downloads/
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { generateAllIcons } = require('./setup-icons.cjs');
const { syncBuildVersion } = require('./setup-build-version.cjs');

function runCommand(command, cwd = process.cwd()) {
  console.log(`\n⏳ Running: ${command}`);
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' }
    });
  } catch (error) {
    console.error(`\n❌ Error executing command: ${command}`);
    process.exit(1);
  }
}

async function buildAndroid() {
  console.log('====================================================================');
  console.log('🚀 شروع فرآیند خودکار ساخت و انتشار نسخه اندروید (APK)');
  console.log('====================================================================');

  const args = process.argv.slice(2);
  const noBump = args.includes('--no-bump') || args.includes('--same-version');
  const explicitVersion = args.find(a => !a.startsWith('-'));

  // 1. Bump / Sync Version across package.json, build.gradle, release-version.json, and database.json
  const verInfo = syncBuildVersion({
    bump: !noBump && !explicitVersion,
    explicitVersion,
    platform: 'android'
  });
  console.log(`✅ نسخه جدید اندروید ثبت شد: v${verInfo.version} (کد بیلد: ${verInfo.versionCode})`);

  // 2. Generate all icons preserving exact background color or transparency
  await generateAllIcons();

  // 3. Build web assets
  console.log('\n📦 مرحله ۱: ساخت فایل‌های وب (Vite Build)...');
  runCommand('npm run build');

  // 4. Add or sync android platform
  const androidDir = path.join(__dirname, 'android');
  if (!fs.existsSync(androidDir)) {
    console.log('\n📱 مرحله ۲: افزودن پلتفرم اندروید Capacitor...');
    runCommand('npx cap add android');
    await generateAllIcons();
  } else {
    console.log('\n🔄 مرحله ۲: همگام‌سازی فایل‌ها با پلتفرم اندروید (Capacitor Sync)...');
    runCommand('npx cap sync android');
    // Re-apply icons after cap sync to ensure mipmap resources stay untouched
    await generateAllIcons();
  }

  // 5. Ensure Cleartext (HTTP) traffic is enabled for local enterprise servers
  console.log('\n🔓 مرحله ۳: بررسی تنظیمات شبکه در AndroidManifest.xml...');
  const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (fs.existsSync(manifestPath)) {
    let manifestContent = fs.readFileSync(manifestPath, 'utf8');
    let modified = false;

    if (!manifestContent.includes('android:usesCleartextTraffic="true"')) {
      manifestContent = manifestContent.replace(
        '<application',
        '<application\n        android:usesCleartextTraffic="true"'
      );
      modified = true;
    }

    if (!manifestContent.includes('REQUEST_INSTALL_PACKAGES')) {
      manifestContent = manifestContent.replace(
        '<application',
        '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    <application'
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(manifestPath, manifestContent, 'utf8');
      console.log('✅ تنظیمات AndroidManifest.xml بروزرسانی شد.');
    }
  }

  // 6. Compile signed APK using Gradle
  console.log('\n🔨 مرحله ۴: کامپایل فایل نصبی APK با Gradle...');
  const isWindows = process.platform === 'win32';
  const gradlew = isWindows ? 'gradlew.bat' : './gradlew';

  if (!isWindows) {
    runCommand('chmod +x gradlew', androidDir);
  }

  runCommand(`${gradlew} assembleDebug`, androidDir);

  const apkSourcePath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  if (fs.existsSync(apkSourcePath)) {
    const downloadsDir = path.join(__dirname, 'downloads');
    const publicDownloadsDir = path.join(__dirname, 'public', 'downloads');

    [downloadsDir, publicDownloadsDir].forEach(d => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    const targets = [
      path.join(downloadsDir, 'dlkam-android-latest.apk'),
      path.join(downloadsDir, 'sayan-android-latest.apk'),
      path.join(downloadsDir, `dlkam-android-v${verInfo.version}.apk`),
      path.join(publicDownloadsDir, 'dlkam-android-latest.apk'),
      path.join(publicDownloadsDir, 'sayan-android-latest.apk'),
      path.join(__dirname, 'dlkam-app.apk')
    ];

    for (const target of targets) {
      fs.copyFileSync(apkSourcePath, target);
    }

    console.log('\n====================================================================');
    console.log(`🎉 نسخه v${verInfo.version} اندروید با موفقیت ساخته شد و در پوشه دانلود قرار گرفت!`);
    console.log(`📂 مسیر فایل در سرور: downloads/dlkam-android-latest.apk`);
    console.log(`📂 مسیر نسخه آرشیوی: downloads/dlkam-android-v${verInfo.version}.apk`);
    console.log('🔔 تمام کلاینت‌های اندروید در بررسی خودکار بعدی، پیشنهاد آپدیت به این نسخه را دریافت خواهند کرد.');
    console.log('====================================================================');
  } else {
    console.error('\n❌ ساخت APK به پایان رسید اما فایل خروجی در مسیر مورد انتظار یافت نشد.');
    process.exit(1);
  }
}

buildAndroid().catch(err => {
  console.error('❌ خطای غیرمنتظره در ساخت اندروید:', err);
  process.exit(1);
});
