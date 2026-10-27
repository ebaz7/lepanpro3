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

  // 3.5. Remove heavy installer files (dist/downloads, dist/assets/aistudio) from dist before copying to Android APK assets
  const distDownloadsDir = path.join(__dirname, 'dist', 'downloads');
  if (fs.existsSync(distDownloadsDir)) {
    fs.rmSync(distDownloadsDir, { recursive: true, force: true });
    console.log('   🧹 پوشه dist/downloads از باندل اندروید حذف شد تا حجم APK و مصرف رم Gradle بهینه شود.');
  }
  const distAiStudioAssetsDir = path.join(__dirname, 'dist', 'assets', 'aistudio');
  if (fs.existsSync(distAiStudioAssetsDir)) {
    fs.rmSync(distAiStudioAssetsDir, { recursive: true, force: true });
  }

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

  // Clean any leftover downloads or large installer files inside android/app/src/main/assets/public
  const androidAssetsDownloadsDir = path.join(androidDir, 'app', 'src', 'main', 'assets', 'public', 'downloads');
  if (fs.existsSync(androidAssetsDownloadsDir)) {
    fs.rmSync(androidAssetsDownloadsDir, { recursive: true, force: true });
  }
  const androidAssetsAiStudioDir = path.join(androidDir, 'app', 'src', 'main', 'assets', 'public', 'assets', 'aistudio');
  if (fs.existsSync(androidAssetsAiStudioDir)) {
    fs.rmSync(androidAssetsAiStudioDir, { recursive: true, force: true });
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

  // 6. Ensure AndroidManifest.xml is AGP 8+ compliant (no package="..." attribute) and Cleartext (HTTP) traffic is enabled
  const manifestPath = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
  if (fs.existsSync(manifestPath)) {
    let manifestContent = fs.readFileSync(manifestPath, 'utf8');
    let modified = false;

    // Remove deprecated package="..." attribute from <manifest> tag (forbidden in AGP 8+)
    if (/<manifest[^>]*\s+package\s*=\s*["'][^"']*["']/.test(manifestContent)) {
      manifestContent = manifestContent.replace(
        /(<manifest[^>]*?)\s+package\s*=\s*["'][^"']*["']([^>]*>)/,
        '$1$2'
      );
      modified = true;
      console.log('   ✅ ویژگی قدیمی package از AndroidManifest.xml برای سازگاری با Gradle جدید حذف شد.');
    }

    // Ensure MainActivity points to the actual Java source package if com/payment/system/MainActivity.java exists
    const legacyMainActivityJava = path.join(androidDir, 'app', 'src', 'main', 'java', 'com', 'payment', 'system', 'MainActivity.java');
    if (fs.existsSync(legacyMainActivityJava) && manifestContent.includes('android:name=".MainActivity"')) {
      manifestContent = manifestContent.replace(
        'android:name=".MainActivity"',
        'android:name="com.payment.system.MainActivity"'
      );
      modified = true;
    }

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

  // 6.5. Fix google-services.json package_name mismatch & guard build.gradle
  const appBuildGradlePath = path.join(androidDir, 'app', 'build.gradle');
  let appPackageName = 'com.dikam.paymentorder';
  if (fs.existsSync(appBuildGradlePath)) {
    let gradleText = fs.readFileSync(appBuildGradlePath, 'utf8');
    let gradleModified = false;
    const appIdMatch = gradleText.match(/applicationId\s+["']([^"']+)["']/);
    if (appIdMatch && appIdMatch[1]) {
      appPackageName = appIdMatch[1].trim();
    }

    // Ensure aaptOptions skips re-compressing heavy binary/wasm/archive extensions to prevent CompressAssetsWorkAction OOM
    if (!gradleText.includes('noCompress')) {
      gradleText = gradleText.replace(
        /ignoreAssetsPattern\s+["'][^"']+["']/,
        `ignoreAssetsPattern "!.svn:!.git:!.ds_store:!*.scc:.*:g*.tbi:f*.tbi:!downloads:!*.apk:!*.exe:!*.msi"\n             noCompress "wasm", "gz", "traineddata", "apk", "exe", "msi", "zip", "mp4", "mp3"`
      );
      gradleModified = true;
    }

    // Ensure google-services plugin is only applied if google-services.json matches appPackageName
    const unsafeGoogleServicesRegex = /if\s*\(\s*servicesJSON\.text\s*\)\s*\{\s*apply\s+plugin:\s*['"]com\.google\.gms\.google-services['"]\s*\}/;
    if (unsafeGoogleServicesRegex.test(gradleText)) {
      gradleText = gradleText.replace(
        unsafeGoogleServicesRegex,
        `if (servicesJSON.exists() && servicesJSON.text && servicesJSON.text.contains('"${appPackageName}"')) {\n        apply plugin: 'com.google.gms.google-services'\n    }`
      );
      gradleModified = true;
    }

    if (gradleModified) {
      fs.writeFileSync(appBuildGradlePath, gradleText, 'utf8');
    }
  }

  const googleServicesPath = path.join(androidDir, 'app', 'google-services.json');
  if (fs.existsSync(googleServicesPath)) {
    try {
      const gsRaw = fs.readFileSync(googleServicesPath, 'utf8');
      const gsJson = JSON.parse(gsRaw);
      if (gsJson && Array.isArray(gsJson.client) && gsJson.client.length > 0) {
        const hasMatchingClient = gsJson.client.some(
          c => c?.client_info?.android_client_info?.package_name === appPackageName
        );
        if (!hasMatchingClient) {
          const clonedClient = JSON.parse(JSON.stringify(gsJson.client[0]));
          if (!clonedClient.client_info) clonedClient.client_info = {};
          if (!clonedClient.client_info.android_client_info) clonedClient.client_info.android_client_info = {};
          clonedClient.client_info.android_client_info.package_name = appPackageName;
          gsJson.client.push(clonedClient);
          fs.writeFileSync(googleServicesPath, JSON.stringify(gsJson, null, 2) + '\n', 'utf8');
          console.log(`   ✅ فایل google-services.json به‌صورت خودکار با پکیج (${appPackageName}) همگام‌سازی شد.`);
        }
      }
    } catch (gsErr) {
      console.warn('⚠️ فایل google-services.json نامعتبر بود؛ نادیده گرفته شد.');
    }
  }

  // 6.8. Ensure gradle.properties has sufficient heap memory (4GB) and capped workers to prevent OOM in compressReleaseAssets
  const gradlePropsPath = path.join(androidDir, 'gradle.properties');
  if (fs.existsSync(gradlePropsPath)) {
    let gradleProps = fs.readFileSync(gradlePropsPath, 'utf8');
    let propsModified = false;
    if (/org\.gradle\.jvmargs\s*=/.test(gradleProps)) {
      if (!gradleProps.includes('-Xmx4096m')) {
        gradleProps = gradleProps.replace(
          /org\.gradle\.jvmargs\s*=.*/,
          'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8'
        );
        propsModified = true;
      }
    } else {
      gradleProps += '\norg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8\n';
      propsModified = true;
    }
    if (!gradleProps.includes('org.gradle.workers.max')) {
      gradleProps += '\norg.gradle.workers.max=2\n';
      propsModified = true;
    }
    if (propsModified) {
      fs.writeFileSync(gradlePropsPath, gradleProps, 'utf8');
    }
  }

  // Remove any accidental .apk, .exe, .msi, or unused tesseract wasm.js duplicates inside android/app/src/main/assets/public
  const assetsPublicDir = path.join(androidDir, 'app', 'src', 'main', 'assets', 'public');
  function purgeHeavyBinariesFromAssets(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'downloads' || entry.name === 'backups' || entry.name === 'uploads' || entry.name === 'chat_uploads') {
          fs.rmSync(fullPath, { recursive: true, force: true });
        } else {
          purgeHeavyBinariesFromAssets(fullPath);
        }
      } else if (/\.(apk|exe|msi|zip|rar|7z|bak)$/i.test(entry.name)) {
        fs.rmSync(fullPath, { force: true });
      } else if (/^tesseract-core.*\.wasm\.js$/i.test(entry.name)) {
        // Modern Android WebView supports WebAssembly (.wasm) natively; the huge base64 .wasm.js fallback files (~60MB total) are unnecessary and cause Gradle CompressAssets OOM
        fs.rmSync(fullPath, { force: true });
      }
    }
  }
  purgeHeavyBinariesFromAssets(assetsPublicDir);

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
  const extraEnv = {
    ...(sdkPath ? { ANDROID_HOME: sdkPath, ANDROID_SDK_ROOT: sdkPath } : {}),
    GRADLE_OPTS: '-Dorg.gradle.jvmargs="-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8" -Dorg.gradle.workers.max=2'
  };
  try {
    execSync(`${gradlew} --stop`, { cwd: androidDir, stdio: 'ignore', env: { ...process.env, ...extraEnv } });
  } catch (_) {}
  runCommand(`${gradlew} assemble${buildType} --max-workers=2`, androidDir, extraEnv);

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
