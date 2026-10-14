const fs = require('fs');

const file = 'components/sayan-cheques/ChequeReceiptDetailModal.tsx';
if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace("import { Zap, createPortal } from 'react-dom';", "import { createPortal } from 'react-dom';");
    if (!content.includes("Zap,")) {
        content = content.replace("FileText,", "Zap, FileText,");
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log('✓ Successfully fixed Zap import in ChequeReceiptDetailModal.tsx');
}
