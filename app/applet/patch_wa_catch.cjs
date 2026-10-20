const fs = require('fs');

let code = fs.readFileSync('backend/whatsapp.js', 'utf8');

const targetCatch = `client.initialize().catch(e => {
            console.error("WA Init Fail:", e.message);
            isInitializing = false;
            lastError = e.message;
            addDiagnosticLog('error', 'INIT', \`خطا در اجرای پپتیر واتساپ: \${e.message}\`, e.stack);
        });`;

const replacementCatch = `client.initialize().catch(e => {
            console.error("WA Init Fail:", e.message);
            isInitializing = false;
            lastError = e.message;
            addDiagnosticLog('error', 'INIT', \`خطا در اجرای پپتیر واتساپ: \${e.message}\`, e.stack);
            
            // Automatic self-healing on Chrome lock or process collision
            if (e.message.includes('already running') || e.message.includes('userDataDir') || e.message.includes('EPERM') || e.message.includes('Code: 0')) {
                console.log(">>> [WhatsApp Auto-Healing] Clearing Chrome locks and retrying initialization...");
                addDiagnosticLog('warn', 'INIT', 'تشخیص قفل مرورگر؛ پاکسازی خودکار فرآیندها و تلاش مجدد برای راه‌اندازی...');
                cleanSessionLocks(absoluteAuthDir, 'session-main_session');
                setTimeout(() => {
                    if (!isReady && !isInitializing) {
                        initWhatsApp(authDir);
                    }
                }, 3000);
            }
        });`;

if (code.includes('client.initialize().catch')) {
    code = code.replace(targetCatch, replacementCatch);
    fs.writeFileSync('backend/whatsapp.js', code, 'utf8');
    console.log('Successfully added auto-healing to client.initialize() in backend/whatsapp.js!');
} else {
    console.error('Could not find client.initialize().catch');
}
