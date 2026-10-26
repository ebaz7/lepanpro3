const fs = require('fs');
const path = require('path');
const http = require('http');

const rootDir = __dirname;
const versionJsonPath = path.join(rootDir, 'version.json');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
const packageJsonPath = path.join(rootDir, 'package.json');
const buildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
const databaseJsonPath = path.join(rootDir, 'database.json');
const updateServicePath = path.join(rootDir, 'services', 'updateService.ts');

function compareSemVer(v1, v2) {
  const p1 = String(v1 || '0.0.0').replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = String(v2 || '0.0.0').replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function incrementPatchVersion(versionStr) {
  const parts = String(versionStr || '1.0.0')
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map(n => parseInt(n, 10) || 0);
  const major = parts[0] || 1;
  const minor = parts[1] || 0;
  const patch = (parts[2] || 0) + 1;
  return `${major}.${minor}.${patch}`;
}

function getArgOptions() {
  const args = process.argv.slice(2);
  let explicitVer = null;
  let syncOnly = false;
  let platform = 'all';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--sync-only' || arg === '--no-bump') {
      syncOnly = true;
    } else if (arg.startsWith('--platform=')) {
      platform = arg.split('=')[1].trim();
    } else if (arg === '--ver' || arg === '-v' || arg === '--version') {
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        explicitVer = args[i + 1].trim();
      }
    } else if (arg.startsWith('--ver=')) {
      explicitVer = arg.split('=')[1].trim();
    } else if (arg.startsWith('--version=')) {
      explicitVer = arg.split('=')[1].trim();
    } else if (/^\d+\.\d+\.\d+$/.test(arg)) {
      explicitVer = arg.trim();
    }
  }

  return { explicitVer, syncOnly, platform };
}

function getHighestCurrentVersion() {
  const versions = ['1.0.0'];

  try {
    if (fs.existsSync(versionJsonPath)) {
      const vData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      if (vData.version) versions.push(vData.version.trim());
    }
  } catch (_) {}

  try {
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.version) versions.push(pkg.version.trim());
    }
  } catch (_) {}

  try {
    if (fs.existsSync(tauriConfPath)) {
      const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
      if (tauriConf.package?.version) versions.push(tauriConf.package.version.trim());
    }
  } catch (_) {}

  try {
    if (fs.existsSync(databaseJsonPath)) {
      const db = JSON.parse(fs.readFileSync(databaseJsonPath, 'utf8'));
      if (db.settings?.systemVersion) versions.push(db.settings.systemVersion.trim());
      if (db.settings?.desktopLatestVersion) versions.push(db.settings.desktopLatestVersion.trim());
    }
  } catch (_) {}

  versions.sort(compareSemVer);
  return versions[versions.length - 1] || '1.0.6';
}

function notifyRunningServer(version, buildNumber, title, releaseNotes) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      version,
      buildNumber,
      title,
      releaseNotes,
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
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`✅ Live running server notified of v${version} (${buildNumber})`);
          }
          resolve();
        });
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

async function syncVersionFiles(versionStr, platform = 'all') {
  const cleanVer = versionStr.replace(/[^0-9.]/g, '') || '1.0.0';
  const versionParts = cleanVer.split('.').map(n => parseInt(n, 10) || 0);
  const numericBuild = (versionParts[0] || 1) * 10000 + (versionParts[1] || 0) * 100 + (versionParts[2] || 0);
  const now = Date.now();
  const buildNumber = String(numericBuild);
  const shamsiNow = new Date().toLocaleString('fa-IR');
  const releaseTitle = `نسخه جدید v${cleanVer}`;
  const releaseNotes = `بیلد خودکار (${shamsiNow}) - آماده دریافت و بروزرسانی`;

  console.log(`\n====================================================`);
  console.log(`🚀 [Auto Version Engine] Synchronizing Version: v${cleanVer} (Build #${buildNumber})`);
  console.log(`====================================================\n`);

  // 1. Write version.json (Live Disk Manifest read directly by server.js)
  try {
    let existingManifest = {};
    if (fs.existsSync(versionJsonPath)) {
      try {
        existingManifest = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      } catch (_) {}
    }
    const newManifest = {
      ...existingManifest,
      version: cleanVer,
      buildNumber,
      versionCode: numericBuild,
      title: releaseTitle,
      releaseNotes,
      timestamp: now,
      updatedAtIso: new Date(now).toISOString(),
      updatedAtShamsi: shamsiNow,
      lastBuildPlatform: platform,
      androidDownloadUrl: '/downloads/dlkam-android-latest.apk',
      desktopDownloadUrl: '/downloads/dlkam-desktop-setup.msi'
    };
    fs.writeFileSync(versionJsonPath, JSON.stringify(newManifest, null, 2), 'utf8');
    console.log(`✅ Updated version.json -> v${cleanVer} (buildNumber: ${buildNumber})`);
  } catch (e) {
    console.warn('⚠️ Could not update version.json:', e.message);
  }

  // 2. Update src-tauri/tauri.conf.json
  if (fs.existsSync(tauriConfPath)) {
    try {
      const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
      if (!tauriConf.package) tauriConf.package = {};
      tauriConf.package.version = cleanVer;
      fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2), 'utf8');
      console.log(`✅ Updated src-tauri/tauri.conf.json -> package.version = "${cleanVer}"`);
    } catch (e) {
      console.warn('⚠️ Could not update tauri.conf.json:', e.message);
    }
  }

  // 3. Update src-tauri/Cargo.toml
  if (fs.existsSync(cargoTomlPath)) {
    try {
      let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
      cargoContent = cargoContent.replace(/^version\s*=\s*"[^"]*"/m, `version = "${cleanVer}"`);
      fs.writeFileSync(cargoTomlPath, cargoContent, 'utf8');
      console.log(`✅ Updated src-tauri/Cargo.toml -> version = "${cleanVer}"`);
    } catch (e) {
      console.warn('⚠️ Could not update src-tauri/Cargo.toml:', e.message);
    }
  }

  // 4. Update package.json
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      pkg.version = cleanVer;
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2), 'utf8');
      console.log(`✅ Updated package.json -> version = "${cleanVer}"`);
    } catch (e) {
      console.warn('⚠️ Could not update package.json:', e.message);
    }
  }

  // 5. Update android/app/build.gradle
  if (fs.existsSync(buildGradlePath)) {
    try {
      let gradleContent = fs.readFileSync(buildGradlePath, 'utf8');
      gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${numericBuild}`);
      gradleContent = gradleContent.replace(/versionName\s+"[^"]+"/, `versionName "${cleanVer}"`);
      fs.writeFileSync(buildGradlePath, gradleContent, 'utf8');
      console.log(`✅ Updated android/app/build.gradle -> versionName = "${cleanVer}", versionCode = ${numericBuild}`);
    } catch (e) {
      console.warn('⚠️ Could not update android/app/build.gradle:', e.message);
    }
  }

  // 6. Update services/updateService.ts
  if (fs.existsSync(updateServicePath)) {
    try {
      let serviceContent = fs.readFileSync(updateServicePath, 'utf8');
      serviceContent = serviceContent.replace(/version:\s*['"][^'"]+['"]/, `version: '${cleanVer}'`);
      serviceContent = serviceContent.replace(/buildNumber:\s*['"][^'"]+['"]/, `buildNumber: '${buildNumber}'`);
      fs.writeFileSync(updateServicePath, serviceContent, 'utf8');
      console.log(`✅ Updated services/updateService.ts -> CURRENT_CLIENT_BUILD = v${cleanVer} (#${buildNumber})`);
    } catch (e) {
      console.warn('⚠️ Could not update updateService.ts:', e.message);
    }
  }

  // 7. Update database.json (Real Backend DB)
  if (fs.existsSync(databaseJsonPath)) {
    try {
      const db = JSON.parse(fs.readFileSync(databaseJsonPath, 'utf8'));
      if (!db.settings) db.settings = {};
      db.settings.systemVersion = cleanVer;
      db.settings.desktopLatestVersion = cleanVer;
      db.settings.systemBuildNumber = buildNumber;
      db.settings.releaseTitle = releaseTitle;
      db.settings.releaseNotes = releaseNotes;
      db.settings.desktopReleaseNotes = releaseNotes;
      db.settings.systemUpdatePublishedAt = now;
      fs.writeFileSync(databaseJsonPath, JSON.stringify(db, null, 2), 'utf8');
      console.log(`✅ Updated database.json -> systemVersion & desktopLatestVersion = "${cleanVer}"`);
    } catch (e) {
      console.warn('⚠️ Could not update database.json:', e.message);
    }
  }

  // 8. Notify running server on localhost:3000 so in-memory state updates immediately
  await notifyRunningServer(cleanVer, buildNumber, releaseTitle, releaseNotes);

  console.log(`\n🎉 All build & server version files synchronized to v${cleanVer}!\n`);
}

async function run() {
  const { explicitVer, syncOnly, platform } = getArgOptions();
  const currentHighest = getHighestCurrentVersion();

  let targetVer = explicitVer;
  if (!targetVer) {
    if (syncOnly) {
      targetVer = currentHighest;
    } else {
      // Automatically increment patch version on every build!
      targetVer = incrementPatchVersion(currentHighest);
      console.log(`📈 Auto-incrementing version: v${currentHighest} ➔ v${targetVer}`);
    }
  }

  await syncVersionFiles(targetVer, platform);
}

run().catch(err => {
  console.error('Fatal error setting build version:', err);
  process.exit(1);
});
