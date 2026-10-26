const fs = require('fs');
const path = require('path');
const http = require('http');

const rootDir = __dirname;
const downloadsDir = path.join(rootDir, 'downloads');
const publicDownloadsDir = path.join(rootDir, 'public', 'downloads');
const versionJsonPath = path.join(rootDir, 'version.json');
const packageJsonPath = path.join(rootDir, 'package.json');
const databaseJsonPath = path.join(rootDir, 'database.json');

for (const dir of [downloadsDir, publicDownloadsDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function findNewestFileWithExt(dirs, extensions) {
  const candidates = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      for (const name of entries) {
        const lower = name.toLowerCase();
        if (extensions.some(ext => lower.endsWith(ext))) {
          const fullPath = path.join(dir, name);
          try {
            const stat = fs.statSync(fullPath);
            if (stat.isFile() && stat.size > 10000) {
              candidates.push({ fullPath, name, mtimeMs: stat.mtimeMs, size: stat.size });
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0] || null;
}

function notifyServer(version, buildNumber) {
  return new Promise((resolve) => {
    const shamsiNow = new Date().toLocaleString('fa-IR');
    const payload = JSON.stringify({
      version,
      buildNumber,
      title: `نسخه جدید v${version}`,
      releaseNotes: `فایل نصبی نسخه v${version} (${shamsiNow}) آماده دانلود و نصب خودکار است.`,
      sendToBots: false
    });

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: process.env.PORT || 3000,
        path: '/api/version/publish',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 2500
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve());
      }
    );
    req.on('error', () => resolve());
    req.on('timeout', () => {
      req.destroy();
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

async function publishArtifacts() {
  console.log('\n======================================================');
  console.log('📦 [Artifact Publisher] Publishing Final Build Outputs');
  console.log('======================================================\n');

  // 1. Locate & Copy Tauri Desktop Installers (.msi / .exe)
  const msiSearchDirs = [
    path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'msi'),
    path.join(rootDir, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'bundle', 'msi')
  ];
  const nsisSearchDirs = [
    path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis'),
    path.join(rootDir, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'bundle', 'nsis')
  ];

  const newestMsi = findNewestFileWithExt(msiSearchDirs, ['.msi']);
  const newestExe = findNewestFileWithExt(nsisSearchDirs, ['.exe']);

  let desktopPublished = false;

  if (newestMsi) {
    const msiTargets = [
      path.join(downloadsDir, 'dlkam-desktop-setup.msi'),
      path.join(publicDownloadsDir, 'dlkam-desktop-setup.msi'),
      path.join(rootDir, 'dlkam-desktop-setup.msi')
    ];
    for (const target of msiTargets) {
      try {
        fs.copyFileSync(newestMsi.fullPath, target);
        console.log(`✅ Copied Tauri MSI (${(newestMsi.size / 1024 / 1024).toFixed(2)} MB) ➔ ${path.relative(rootDir, target)}`);
        desktopPublished = true;
      } catch (e) {
        console.warn(`⚠️ Failed copying MSI to ${target}:`, e.message);
      }
    }
  }

  if (newestExe) {
    const exeTargets = [
      path.join(downloadsDir, 'dlkam-desktop-setup.exe'),
      path.join(publicDownloadsDir, 'dlkam-desktop-setup.exe'),
      path.join(rootDir, 'dlkam-desktop-setup.exe')
    ];
    // If no MSI was built, also place at .msi fallback path so direct links never 404
    if (!newestMsi) {
      exeTargets.push(path.join(downloadsDir, 'dlkam-desktop-setup.msi'));
      exeTargets.push(path.join(publicDownloadsDir, 'dlkam-desktop-setup.msi'));
    }
    for (const target of exeTargets) {
      try {
        fs.copyFileSync(newestExe.fullPath, target);
        console.log(`✅ Copied Tauri EXE (${(newestExe.size / 1024 / 1024).toFixed(2)} MB) ➔ ${path.relative(rootDir, target)}`);
        desktopPublished = true;
      } catch (e) {
        console.warn(`⚠️ Failed copying EXE to ${target}:`, e.message);
      }
    }
  }

  // 2. Locate & Copy Android APK
  const apkSearchDirs = [
    path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'release'),
    path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug')
  ];
  const newestApk = findNewestFileWithExt(apkSearchDirs, ['.apk']);
  let androidPublished = false;

  if (newestApk) {
    const apkTargets = [
      path.join(downloadsDir, 'dlkam-android-latest.apk'),
      path.join(publicDownloadsDir, 'dlkam-android-latest.apk'),
      path.join(rootDir, 'dlkam-android-latest.apk'),
      path.join(rootDir, 'payment-system-release.apk'),
      path.join(rootDir, 'payment-system-latest.apk')
    ];
    for (const target of apkTargets) {
      try {
        if (path.resolve(newestApk.fullPath) !== path.resolve(target)) {
          fs.copyFileSync(newestApk.fullPath, target);
        }
        console.log(`✅ Copied Android APK (${(newestApk.size / 1024 / 1024).toFixed(2)} MB) ➔ ${path.relative(rootDir, target)}`);
        androidPublished = true;
      } catch (e) {
        console.warn(`⚠️ Failed copying APK to ${target}:`, e.message);
      }
    }
  }

  // 3. Update version.json & database.json timestamps so clients detect the fresh build
  let currentVersion = '1.0.7';
  let currentBuild = String(Date.now());
  try {
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.version) currentVersion = pkg.version;
    }
  } catch (_) {}

  const now = Date.now();
  const versionParts = currentVersion.replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const numericBuild = (versionParts[0] || 1) * 10000 + (versionParts[1] || 0) * 100 + (versionParts[2] || 0);
  currentBuild = String(numericBuild);

  try {
    let manifest = {};
    if (fs.existsSync(versionJsonPath)) {
      try { manifest = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8')); } catch (_) {}
    }
    manifest.version = currentVersion;
    manifest.buildNumber = currentBuild;
    manifest.versionCode = numericBuild;
    manifest.timestamp = now;
    manifest.updatedAtIso = new Date(now).toISOString();
    manifest.updatedAtShamsi = new Date(now).toLocaleString('fa-IR');
    if (desktopPublished) manifest.desktopUpdatedAt = now;
    if (androidPublished) manifest.androidUpdatedAt = now;
    manifest.androidDownloadUrl = '/downloads/dlkam-android-latest.apk';
    manifest.desktopDownloadUrl = '/downloads/dlkam-desktop-setup.msi';

    fs.writeFileSync(versionJsonPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`✅ Updated version.json manifest (v${currentVersion}, timestamp: ${now})`);
  } catch (e) {
    console.warn('⚠️ Could not update version.json:', e.message);
  }

  try {
    if (fs.existsSync(databaseJsonPath)) {
      const db = JSON.parse(fs.readFileSync(databaseJsonPath, 'utf8'));
      if (!db.settings) db.settings = {};
      db.settings.systemVersion = currentVersion;
      db.settings.desktopLatestVersion = currentVersion;
      db.settings.systemBuildNumber = currentBuild;
      db.settings.systemUpdatePublishedAt = now;
      fs.writeFileSync(databaseJsonPath, JSON.stringify(db, null, 2), 'utf8');
    }
  } catch (_) {}

  await notifyServer(currentVersion, currentBuild);

  console.log('\n🎉 Final download files are in place and live update broadcast is active!\n');
}

publishArtifacts().catch(err => {
  console.error('❌ Error publishing artifacts:', err);
  process.exit(1);
});
