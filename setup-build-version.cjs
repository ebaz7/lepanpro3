const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rootDir = __dirname;
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const packageJsonPath = path.join(rootDir, 'package.json');
const buildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
const dbJsonPath = path.join(rootDir, 'db.json');
const updateServicePath = path.join(rootDir, 'services', 'updateService.ts');

function getArgVersion() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ver' || args[i] === '-v' || args[i] === '--version') {
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        return args[i + 1].trim();
      }
    } else if (args[i].startsWith('--ver=')) {
      return args[i].split('=')[1].trim();
    } else if (args[i].startsWith('--version=')) {
      return args[i].split('=')[1].trim();
    } else if (/^\d+\.\d+\.\d+$/.test(args[i])) {
      return args[i].trim();
    }
  }
  return null;
}

function getStoredServerVersion() {
  try {
    if (fs.existsSync(dbJsonPath)) {
      const db = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
      if (db.settings?.systemVersion) return db.settings.systemVersion.trim();
      if (db.settings?.desktopLatestVersion) return db.settings.desktopLatestVersion.trim();
    }
  } catch (_) {}

  try {
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (pkg.version) return pkg.version.trim();
    }
  } catch (_) {}

  return '1.0.0';
}

function syncVersionFiles(versionStr) {
  const cleanVer = versionStr.replace(/[^0-9.]/g, '') || '1.0.0';
  console.log(`\n====================================================`);
  console.log(`🚀 [Build Version Synchronizer] Setting version: v${cleanVer}`);
  console.log(`====================================================\n`);

  // 1. Update src-tauri/tauri.conf.json
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

  // 2. Update package.json
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

  // 3. Update android/app/build.gradle
  if (fs.existsSync(buildGradlePath)) {
    try {
      let gradleContent = fs.readFileSync(buildGradlePath, 'utf8');
      const versionParts = cleanVer.split('.').map(n => parseInt(n, 10) || 0);
      const versionCode = (versionParts[0] || 1) * 10000 + (versionParts[1] || 0) * 100 + (versionParts[2] || 0);

      gradleContent = gradleContent.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
      gradleContent = gradleContent.replace(/versionName\s+"[^"]+"/, `versionName "${cleanVer}"`);
      fs.writeFileSync(buildGradlePath, gradleContent, 'utf8');
      console.log(`✅ Updated android/app/build.gradle -> versionName = "${cleanVer}", versionCode = ${versionCode}`);
    } catch (e) {
      console.warn('⚠️ Could not update android/app/build.gradle:', e.message);
    }
  }

  // 4. Update services/updateService.ts
  if (fs.existsSync(updateServicePath)) {
    try {
      let serviceContent = fs.readFileSync(updateServicePath, 'utf8');
      serviceContent = serviceContent.replace(/version:\s*['"][^'"]+['"]/, `version: '${cleanVer}'`);
      fs.writeFileSync(updateServicePath, serviceContent, 'utf8');
      console.log(`✅ Updated services/updateService.ts -> CURRENT_CLIENT_BUILD.version = '${cleanVer}'`);
    } catch (e) {
      console.warn('⚠️ Could not update updateService.ts:', e.message);
    }
  }

  // 5. Update db.json settings
  if (fs.existsSync(dbJsonPath)) {
    try {
      const db = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
      if (!db.settings) db.settings = {};
      db.settings.systemVersion = cleanVer;
      db.settings.desktopLatestVersion = cleanVer;
      fs.writeFileSync(dbJsonPath, JSON.stringify(db, null, 2), 'utf8');
      console.log(`✅ Saved version v${cleanVer} to db.json settings.`);
    } catch (e) {
      console.warn('⚠️ Could not update db.json:', e.message);
    }
  }

  console.log(`\n🎉 All build configurations synchronized to v${cleanVer}!\n`);
}

async function run() {
  let ver = getArgVersion();

  if (!ver && process.stdout.isTTY) {
    const defaultVer = getStoredServerVersion();
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    ver = await new Promise(resolve => {
      rl.question(`\n📌 لطفاً شماره نسخه بیلد جدید را وارد کنید (پیش‌فرض: ${defaultVer}): `, answer => {
        rl.close();
        resolve(answer.trim() || defaultVer);
      });
    });
  }

  if (!ver) {
    ver = getStoredServerVersion();
  }

  syncVersionFiles(ver);
}

run().catch(err => {
  console.error('Fatal error setting build version:', err);
  process.exit(1);
});
