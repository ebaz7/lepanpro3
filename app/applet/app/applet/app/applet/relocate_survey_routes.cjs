const fs = require('fs');

const serverPath = '/app/applet/server.js';
let content = fs.readFileSync(serverPath, 'utf8');

const surveyBlockStart = '// --- PUBLIC CUSTOMER SURVEY ENDPOINTS ---';
const listenMarker = 'if (isExplicitDev || !fs.existsSync(DIST_DIR)) {';

if (content.includes(surveyBlockStart) && content.includes(listenMarker)) {
    const startIdx = content.indexOf(surveyBlockStart);
    const surveyCode = content.substring(startIdx);
    
    // Remove survey code from the end
    content = content.substring(0, startIdx);
    
    // Insert survey code right before listenMarker
    const insertIdx = content.indexOf(listenMarker);
    if (insertIdx !== -1) {
        content = content.substring(0, insertIdx) + surveyCode + '\n\n' + content.substring(insertIdx);
        fs.writeFileSync(serverPath, content, 'utf8');
        console.log('Successfully relocated survey endpoints before Vite middleware in server.js');
    } else {
        console.log('listenMarker not found');
    }
} else {
    console.log('Markers not found in server.js');
}
