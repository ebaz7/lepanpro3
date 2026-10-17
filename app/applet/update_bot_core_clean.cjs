const fs = require('fs');

const filePath = '/app/applet/backend/bot-core.js';
let content = fs.readFileSync(filePath, 'utf8');

const targetStr = "settings.customerSurveyUrl || 'https://survey.porsline.ir/s/lepan-baft-survey'";
const replacementStr = "(settings.appBaseUrl || 'https://dlkam.ir').replace(/\\/+$/, '') + '/#customer-survey?id=' + p.permitNumber";

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully updated survey link in bot-core.js');
} else {
    console.log('Target string not found in bot-core.js');
}
