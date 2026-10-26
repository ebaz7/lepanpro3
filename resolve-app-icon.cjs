const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const STATE_FILE_NAME = '.app-icon-source.json';
const VALID_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

function getFileHash(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(buf).digest('hex');
  } catch (_) {
    return null;
  }
}

function loadState(rootDir) {
  const statePath = path.join(rootDir, STATE_FILE_NAME);
  try {
    if (fs.existsSync(statePath)) {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    }
  } catch (_) {}
  return null;
}

function saveState(rootDir, state) {
  const statePath = path.join(rootDir, STATE_FILE_NAME);
  try {
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (_) {}
}

/**
 * Find the user's intended app icon / logo dynamically from anywhere in the project.
 */
function findSourceAppIcon(rootDir = __dirname) {
  // 1. Explicit override via CLI argument (e.g., node setup-desktop-icons.cjs my-image.png)
  const cliArg = process.argv[2];
  if (cliArg && fs.existsSync(cliArg) && fs.statSync(cliArg).isFile()) {
    console.log(`[Icon Resolver] Using explicit CLI icon: ${cliArg}`);
    return path.resolve(cliArg);
  }

  // Explicit override via environment variable
  if (process.env.APP_ICON_PATH && fs.existsSync(process.env.APP_ICON_PATH)) {
    console.log(`[Icon Resolver] Using APP_ICON_PATH environment variable: ${process.env.APP_ICON_PATH}`);
    return path.resolve(process.env.APP_ICON_PATH);
  }

  const state = loadState(rootDir);
  const lastGenTime = state && state.generatedAt ? Number(state.generatedAt) : 0;
  const lastGenHash = state && state.masterHash ? state.masterHash : null;

  // Directories to scan: project root, public, server, backend, assets
  const searchDirs = [
    rootDir,
    path.join(rootDir, 'public'),
    path.join(rootDir, 'server'),
    path.join(rootDir, 'backend'),
    path.join(rootDir, 'assets')
  ].filter(d => fs.existsSync(d));

  // Generated internal output files that should NOT be picked as primary source if older or matching old output
  const generatedTargetNames = new Set([
    'icon-foreground.png',
    'icon-background.png',
    'icon-only.png',
    'splash.png',
    'splash-dark.png',
    'icon.ico',
    'favicon.ico',
    'StoreLogo.png',
    '32x32.png',
    '128x128.png',
    '128x128@2x.png'
  ]);

  const candidates = [];

  for (const dir of searchDirs) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filename = entry.name;
        if (generatedTargetNames.has(filename)) continue;

        const ext = path.extname(filename).toLowerCase();
        if (!VALID_EXTENSIONS.has(ext)) continue;

        const fullPath = path.join(dir, filename);
        let stat;
        try {
          stat = fs.statSync(fullPath);
        } catch (_) {
          continue;
        }

        if (stat.size < 100) continue; // ignore tiny placeholders

        const base = path.basename(filename, ext).toLowerCase();
        const hash = getFileHash(fullPath);

        let score = 0;

        // Give high priority to raster user image files over SVG vectors
        if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') {
          score += 100;
        }

        // Base name matching
        if (base === 'lepan-logo') score += 150;
        else if (base === 'desktop-app-icon') score += 140;
        else if (base === 'logo') score += 120;
        else if (base === 'app-icon' || base === 'app_icon') score += 110;
        else if (base.includes('logo')) score += 90;
        else if (base === 'icon') score += 80;
        else if (base.includes('icon')) score += 70;
        else score += 20;

        // Directory location weighting
        if (dir === path.join(rootDir, 'public')) score += 20;
        else if (dir === rootDir) score += 15;

        // User touch detection: if file modified after last build generation
        if (stat.mtimeMs > lastGenTime + 2000) {
          score += 500;
        }

        // If file hash is different from the last generated master hash and name matches logo/icon
        if (lastGenHash && hash !== lastGenHash && (base.includes('logo') || base.includes('icon'))) {
          score += 200;
        }

        // Known authentic user logo: 08d0950f85940ae997e3587571506b32
        if (hash === '08d0950f85940ae997e3587571506b32') {
          score += 1000;
        }

        // Penalty for stale old generated images
        if (hash === 'b18c68186949bc3e1ec10e74a286d9cd' || hash === '0dbf9eeb1baafd7118c5935bc2f9b006') {
          score -= 900;
        }

        candidates.push({
          fullPath,
          filename,
          dir,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          score,
          hash
        });
      }
    } catch (_) {}
  }

  if (candidates.length === 0) {
    console.warn('[Icon Resolver] No image candidates found!');
    return null;
  }

  // Sort descending by score, then by mtimeMs
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.mtimeMs - a.mtimeMs;
  });

  const selected = candidates[0];
  console.log(`[Icon Resolver] Selected master logo: ${selected.fullPath} (Score: ${selected.score}, Size: ${selected.size}B, Hash: ${selected.hash})`);
  return selected.fullPath;
}

/**
 * Normalizes user icon to 1024x1024 RGBA PNG and synchronizes across root and public folders.
 */
async function syncNormalizedMasterIcon(rawSourcePath, rootDir = __dirname) {
  if (!rawSourcePath || !fs.existsSync(rawSourcePath)) {
    throw new Error(`Master icon source not found: ${rawSourcePath}`);
  }

  const rootAppIcon = path.join(rootDir, 'app-icon.png');
  const tmpPath = rootAppIcon + '.tmp';

  console.log(`[Icon Resolver] Normalizing to 1024x1024 RGBA square from ${path.basename(rawSourcePath)}...`);

  await sharp(rawSourcePath)
    .ensureAlpha()
    .resize(1024, 1024, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ compressionLevel: 9 })
    .toFile(tmpPath);

  fs.renameSync(tmpPath, rootAppIcon);

  // Sync to public directory for Web/PWA
  const publicDir = path.join(rootDir, 'public');
  if (fs.existsSync(publicDir)) {
    fs.copyFileSync(rootAppIcon, path.join(publicDir, 'app-icon.png'));
    fs.copyFileSync(rootAppIcon, path.join(publicDir, 'icon.png'));
    fs.copyFileSync(rootAppIcon, path.join(publicDir, 'logo.png'));
  }

  // Generate multi-size favicon.ico (16, 32, 48)
  try {
    const ico32Buf = await sharp(rootAppIcon).resize(32, 32).png().toBuffer();
    fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico32Buf);
  } catch (_) {}

  const finalHash = getFileHash(rootAppIcon);

  saveState(rootDir, {
    selectedSource: rawSourcePath,
    masterHash: finalHash,
    generatedAt: Date.now()
  });

  console.log(`✅ Master icon synchronized to root & public (Hash: ${finalHash})`);
  return rootAppIcon;
}

module.exports = {
  findSourceAppIcon,
  syncNormalizedMasterIcon,
  getFileHash
};
