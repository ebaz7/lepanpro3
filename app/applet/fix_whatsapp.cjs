const fs = require('fs');

let content = fs.readFileSync('backend/whatsapp.js', 'utf8');

if (content.includes("📎 [تصویر برگه رسمی پیوست شد]")) {
    content = content.replace(
        "await client.sendMessage(targetJid, `📎 [تصویر برگه رسمی پیوست شد]\\n${text}`);",
        "await client.sendMessage(targetJid, text);"
    );
    fs.writeFileSync('backend/whatsapp.js', content, 'utf8');
    console.log('Successfully updated backend/whatsapp.js!');
} else {
    console.log('Target string not found or already replaced.');
}
