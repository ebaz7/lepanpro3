const fs = require('fs');

// 1. DigitalCardModule.tsx
if (fs.existsSync('components/DigitalCardModule.tsx')) {
    let cardContent = fs.readFileSync('components/DigitalCardModule.tsx', 'utf8');
    cardContent = cardContent.replace("toast.info('در حال آپلود فایل کاتالوگ...');", "toast('در حال آپلود فایل کاتالوگ...');");
    fs.writeFileSync('components/DigitalCardModule.tsx', cardContent, 'utf8');
    console.log('✓ Fixed DigitalCardModule.tsx toast.info');
}

// 2. types.ts
if (fs.existsSync('types.ts')) {
    let typesContent = fs.readFileSync('types.ts', 'utf8');
    if (!typesContent.includes('salesManagerWhatsapp?:')) {
        typesContent = typesContent.replace('export interface SystemSettings {', 'export interface SystemSettings {\n  salesManagerWhatsapp?: string;\n  customerSurveyUrl?: string;');
        fs.writeFileSync('types.ts', typesContent, 'utf8');
        console.log('✓ Added salesManagerWhatsapp & customerSurveyUrl to SystemSettings in types.ts');
    }
}

// 3. ChequeReceiptDetailModal.tsx
if (fs.existsSync('components/sayan-cheques/ChequeReceiptDetailModal.tsx')) {
    let modalContent = fs.readFileSync('components/sayan-cheques/ChequeReceiptDetailModal.tsx', 'utf8');
    if (!modalContent.includes('Zap,')) {
        modalContent = modalContent.replace("import {", "import { Zap,");
        fs.writeFileSync('components/sayan-cheques/ChequeReceiptDetailModal.tsx', modalContent, 'utf8');
        console.log('✓ Added Zap import to ChequeReceiptDetailModal.tsx');
    }
}
