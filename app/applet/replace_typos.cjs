const fs = require('fs');

const files = [
    'App.tsx',
    'types.ts',
    'components/WarehouseOverviewTab.tsx',
    'backend/ai-service.js'
];

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        if (content.includes('لپان بافت')) {
            content = content.replace(/لپان بافت/g, 'لیان بافت');
            fs.writeFileSync(file, content, 'utf8');
            console.log(`✓ Replaced 'لپان بافت' -> 'لیان بافت' in ${file}`);
        }
    }
});
