const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const oldStr = "WHERE t11.Field_003 = '${fyCode}' AND t10.Field_004 = '${fyCode}'";
const newStr = "WHERE CAST(t11.Field_003 AS INT) <= ${fyCode} AND CAST(t10.Field_004 AS INT) <= ${fyCode}";

if (code.includes(oldStr)) {
    code = code.replace(oldStr, newStr);
    fs.writeFileSync('server.js', code, 'utf8');
    console.log('Successfully fixed server.js!');
} else {
    console.log('Old string not found.');
}
