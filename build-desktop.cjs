const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;

console.log('========================================================');
console.log('  🖥️  DLKAM - AUTOMATED TAURI DESKTOP BUILDER & PUBLISHER');
console.log('========================================================\n');

try {
  // 1. Auto-increment and sync version across all files
  console.log('🔢 [1/5] Auto-incrementing and synchronizing build version...');
  execSync('node setup-build-version.cjs --platform=desktop', { stdio: 'inherit', cwd: rootDir });

  // Read the newly bumped version from package.json
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const currentVersion = pkg.version || '1.0.7';

  // 2. Write memory-safe Cargo.toml with the exact bumped version
  console.log(`⚙️  [2/5] Configuring src-tauri/Cargo.toml with version v${currentVersion}...`);
  const cargoTomlContent = `[package]
name = "sayan-warehouse"
version = "${currentVersion}"
description = "Dlkam warehouse desktop"
authors = ["Dlkam Team"]
edition = "2021"
rust-version = "1.65"

[build-dependencies]
tauri-build = { version = "1.4", features = [] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]

[dependencies]
serde_json = "1.0"
serde = { version = "1.0", features = ["derive"] }
tauri = { version = "1.4", default-features = false, features = ["wry", "custom-protocol", "shell-open", "http-request"] }
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }
reqwest = { version = "0.11", default-features = false, features = ["json", "blocking", "native-tls"] }
axum = { version = "0.6", default-features = false, features = ["http1", "json", "tokio"] }
tower = { version = "0.4", default-features = false, features = ["util"] }
tower-http = { version = "0.4", default-features = false, features = ["cors", "fs"] }

[profile.release]
panic = "abort"
opt-level = 1
codegen-units = 1
lto = false
incremental = false
strip = true
`;
  fs.writeFileSync(path.join(rootDir, 'src-tauri', 'Cargo.toml'), cargoTomlContent, 'utf8');

  const cargoDir = path.join(rootDir, 'src-tauri', '.cargo');
  if (!fs.existsSync(cargoDir)) {
    fs.mkdirSync(cargoDir, { recursive: true });
  }
  const cargoConfigContent = `[build]
jobs = 1

[env]
CARGO_BUILD_JOBS = "1"

[target.x86_64-pc-windows-msvc]
rustflags = ["-C", "link-args=/STACK:16777216"]
`;
  fs.writeFileSync(path.join(cargoDir, 'config.toml'), cargoConfigContent, 'utf8');

  // 3. Generate transparent desktop icons from app-icon
  console.log('🎨 [3/5] Generating desktop icons from app-icon...');
  execSync('node generate-all-icons.cjs', { stdio: 'inherit', cwd: rootDir });

  // 4. Compile Tauri Desktop App
  console.log(`🔨 [4/5] Compiling Tauri Desktop v${currentVersion}...`);
  execSync('npx tauri build -- --jobs 1', {
    stdio: 'inherit',
    cwd: rootDir,
    env: {
      ...process.env,
      CARGO_BUILD_JOBS: '1',
      RUSTFLAGS: '-C link-args=/STACK:16777216',
      CARGO_PROFILE_RELEASE_CODEGEN_UNITS: '1',
      CARGO_PROFILE_RELEASE_OPT_LEVEL: '1',
      CARGO_PROFILE_RELEASE_LTO: 'false',
      _CL_: '/Zm2000'
    }
  });

  // 5. Copy compiled .msi / .exe to downloads/ & public/downloads/ and notify live server
  console.log('📦 [5/5] Copying installer to final download folder and broadcasting update...');
  execSync('node publish-build-artifacts.cjs', { stdio: 'inherit', cwd: rootDir });

  console.log('\n========================================================');
  console.log(`🎉 SUCCESS! TAURI DESKTOP v${currentVersion} BUILT & PUBLISHED!`);
  console.log(`🌐 Download URL: /downloads/dlkam-desktop-setup.msi`);
  console.log('========================================================\n');
} catch (error) {
  console.error('\n❌ Tauri Desktop build failed:', error.message || error);
  process.exit(1);
}
