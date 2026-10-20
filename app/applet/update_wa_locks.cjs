const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let code = fs.readFileSync('backend/whatsapp.js', 'utf8');

// 1. Locate cleanSessionLocks
const startLocks = code.indexOf('export const cleanSessionLocks =');
const endLocks = code.indexOf('export const recoverActivePage =');

if (startLocks === -1 || endLocks === -1) {
    console.error('Could not find markers');
    process.exit(1);
}

const newCleanLocks = `export const cleanSessionLocks = (authDir = currentAuthDir, sessionName = 'session-main_session') => {
    try {
        if (!authDir) return;
        const targetDir = path.resolve(authDir);
                
        // 1. Terminate orphaned Chrome processes holding this session
        try {
            if (process.platform === 'win32') {
                const cmds = [
                    'powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -match \'chrome|edge\' -and ($_.CommandLine -like \'*' + sessionName + '*\' -or $_.CommandLine -like \'*wauth*\') } | Stop-Process -Force -ErrorAction SilentlyContinue"',
                    'cmd /c taskkill /F /FI "COMMANDLINE eq *' + sessionName + '*" >nul 2>&1',
                    'cmd /c taskkill /F /FI "COMMANDLINE eq *wauth*" >nul 2>&1'
                ];
                for (const cmd of cmds) {
                    try { execSync(cmd, { stdio: 'ignore', timeout: 5000 }); } catch(e) {}
                }
            } else {
                execSync('pkill -9 -f "' + sessionName + '" 2>/dev/null || true', { stdio: 'ignore', timeout: 5000 });
                execSync('pkill -9 -f "wauth" 2>/dev/null || true', { stdio: 'ignore', timeout: 5000 });
            }
        } catch (e) {}

        // 2. Remove Chrome Singleton lock symlinks and stale files
        const sessionDir = path.join(targetDir, sessionName);
        if (fs.existsSync(sessionDir)) {
            const removeLocksRecursively = (dir) => {
                try {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            removeLocksRecursively(fullPath);
                        } else {
                            const nameLower = entry.name.toLowerCase();
                            if (
                                nameLower.includes('singleton') ||
                                nameLower === 'devtoolsactiveport' ||
                                nameLower === 'lockfile' ||
                                nameLower === 'lock' ||
                                nameLower.endsWith('.lock')
                            ) {
                                try {
                                    fs.unlinkSync(fullPath);
                                    console.log(\`>>> WhatsApp: Cleaned stale browser lock: \${fullPath}\`);
                                    addDiagnosticLog('info', 'INIT', \`قفل قدیمی مرورگر با موفقیت پاکسازی شد: \${entry.name}\`);
                                } catch (e) {}
                            }
                        }
                    }
                } catch(e) {}
            };
            removeLocksRecursively(sessionDir);
        }
    } catch (err) {
        console.warn(">>> WhatsApp cleanSessionLocks error:", err.message);
    }
};\n\n`;

code = code.substring(0, startLocks) + newCleanLocks + code.substring(endLocks);

// 2. Locate restartSession and update wipe logic
const oldRestartStr = "if (clean) {";
const restartIdx = code.indexOf('export const restartSession =');
if (restartIdx !== -1) {
    const cleanIdx = code.indexOf(oldRestartStr, restartIdx);
    if (cleanIdx !== -1) {
        const nextSetTimeout = code.indexOf('setTimeout(() => { initWhatsApp', cleanIdx);
        if (nextSetTimeout !== -1) {
            const newCleanBlock = `if (clean) {
        try {
            const absoluteAuthDir = path.resolve(authDir);
            let wiped = false;
            for (let attempt = 1; attempt <= 5; attempt++) {
                try {
                    cleanSessionLocks(authDir, 'session-main_session');
                    if (fs.existsSync(absoluteAuthDir)) {
                        fs.rmSync(absoluteAuthDir, { recursive: true, force: true });
                        console.log(">>> Cleared WhatsApp session files:", absoluteAuthDir);
                        addDiagnosticLog('info', 'INIT', \`پوشه ذخیره‌سازی نشست قبلی پاکسازی شد: \${absoluteAuthDir}\`);
                        wiped = true;
                        break;
                    }
                } catch (err) {
                    console.warn(\`>>> Retry \${attempt}/5 clearing auth directory (\${err.message})...\`);
                }
            }
            if (!wiped && fs.existsSync(absoluteAuthDir)) {
                try {
                    const sessionDir = path.join(absoluteAuthDir, 'session-main_session');
                    if (fs.existsSync(sessionDir)) {
                        cleanSessionLocks(authDir, 'session-main_session');
                        fs.rmSync(sessionDir, { recursive: true, force: true });
                    }
                } catch(e) {}
            }
        } catch (err) {
            console.error(">>> Error clearing auth directory:", err.message);
            addDiagnosticLog('error', 'INIT', \`خطا در پاکسازی پوشه نشست: \${err.message}\`);
        }
    }\n\n    `;
            code = code.substring(0, cleanIdx) + newCleanBlock + code.substring(nextSetTimeout);
        }
    }
}

fs.writeFileSync('backend/whatsapp.js', code, 'utf8');
console.log('Update complete!');
