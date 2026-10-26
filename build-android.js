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

const { generateAllIcons } = require('./setup-assets.cjs');
const { syncBuildVersion } = require('./setup-build-version.cjs');

function runCommand(command, cwd = process.cwd(), extraEnv = {}) {
  console.log(`\n⏳ Running: ${command}`);
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096', ...extraEnv }
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

  const args = process.argv.slice(2).filter(a => a !== '--release' && a !== '--debug');
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
    await generateAllIcons();
  }

  // 5. Auto-detect Android SDK and configure local.properties if needed
  const isWindows = process.platform === 'win32';
  const localPropertiesPath = path.join(androidDir, 'local.properties');
  let sdkPath = '';
  if (isWindows) {
    const candidates = [
      'C:\\Users\\Factorythird\\AppData\\Local\\Android\\Sdk',
      path.join(process.env.USERPROFILE || 'C:\\', 'AppData', 'Local', 'Android', 'Sdk'),
      'C:\\Android\\Sdk',
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) {
        sdkPath = c;
        break;
      }
    }
  } else {
    const candidates = [
      path.join(process.env.HOME || '/', 'Android', 'Sdk'),
      path.join(process.env.HOME || '/', 'Library', 'Android', 'sdk'),
      process.env.ANDROID_HOME,
      process.env.ANDROID_SDK_ROOT
    ];
    for (const c of candidates) {
      if (c && fs.existsSync(c)) {
        sdkPath = c;
        break;
      }
    }
  }

  if (sdkPath && !fs.existsSync(localPropertiesPath)) {
    const formattedPath = sdkPath.replace(/\\/g, '/');
    fs.writeFileSync(localPropertiesPath, `sdk.dir=${formattedPath}\n`, 'utf8');
  }

  // 6. Ensure Cleartext (HTTP) traffic is enabled for local enterprise servers
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
    }
  }

  // 7. Compile Signed APK using Gradle
  const isRelease = !process.argv.includes('--debug');
  const keystorePath = path.join(androidDir, 'app', 'release-key.keystore');
  if (isRelease && !fs.existsSync(keystorePath)) {
    try {
      let keytoolCmd = 'keytool';
      const keytoolCandidates = [
        process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', isWindows ? 'keytool.exe' : 'keytool') : '',
        'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe',
        'C:\\Program Files\\Android\\Android Studio\\jre\\bin\\keytool.exe'
      ].filter(Boolean);
      for (const cand of keytoolCandidates) {
        if (fs.existsSync(cand)) {
          keytoolCmd = `"${cand}"`;
          break;
        }
      }
      execSync(`${keytoolCmd} -genkeypair -v -keystore "${keystorePath}" -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000 -storepass 123456 -keypass 123456 -dname "CN=Dlkam, OU=IT, O=Dlkam, L=Tehran, S=Tehran, C=IR"`, { stdio: 'inherit' });
    } catch (_) {}
  }

  const gradlew = isWindows ? 'gradlew.bat' : './gradlew';
  if (!isWindows) {
    runCommand('chmod +x gradlew', androidDir);
  }

  const buildType = isRelease ? 'Release' : 'Debug';
  console.log(`\n🔨 مرحله ۴: کامپایل فایل نصبی APK (${buildType}) با Gradle...`);
  const extraEnv = sdkPath ? { ANDROID_HOME: sdkPath, ANDROID_SDK_ROOT: sdkPath } : {};
  runCommand(`${gradlew} assemble${buildType}`, androidDir, extraEnv);

  const releaseSignedPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
  const releaseUnsignedPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
  const debugApkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

  let apkSourcePath = null;
  if (isRelease && fs.existsSync(releaseSignedPath)) {
    apkSourcePath = releaseSignedPath;
  } else if (isRelease && fs.existsSync(releaseUnsignedPath)) {
    apkSourcePath = releaseUnsignedPath;
  } else if (fs.existsSync(debugApkPath)) {
    apkSourcePath = debugApkPath;
  }

  if (apkSourcePath && fs.existsSync(apkSourcePath)) {
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
      path.join(__dirname, 'payment-system-release.apk'),
      path.join(__dirname, 'dlkam-android-latest.apk')
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
