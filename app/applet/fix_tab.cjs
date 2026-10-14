const fs = require('fs');

let code = fs.readFileSync('components/WarehouseOverviewTab.tsx', 'utf8');

// Replace the broken line
if (code.includes("NaN")) {
    code = code.replace(
        /return '';\s*};\s*NaN\s*const sumYarns =/,
        `return '';
        };

        const calculateCustomTableSum = (items, field) => {
            if (!items || !Array.isArray(items)) return 0;
            return items.reduce((sum, item) => {
                let val = item[field];
                if (val === undefined && field === 'container') val = item['containers'];
                if (val === undefined && field === 'containers') val = item['container'];
                const num = parseFloat(String(val || 0));
                return sum + (isNaN(num) ? 0 : num);
            }, 0);
        };

        const getItemCategory = (code) => {
            return itemCategories[code] || 'raw';
        };

        const handleCategoryChange = (code, cat) => {
            setItemCategories(prev => ({ ...prev, [code]: cat }));
        };

        const handleCellChange = (itemName, isLastYear, field, value) => {
            const numVal = parseFloat(value) || 0;
            if (isLastYear) {
                setLastYearOverrides(prev => ({
                    ...prev,
                    [itemName]: {
                        ...(prev[itemName] || {}),
                        [field]: numVal
                    }
                }));
            } else {
                setCurrentOverrides(prev => ({
                    ...prev,
                    [itemName]: {
                        ...(prev[itemName] || {}),
                        [field]: numVal
                    }
                }));
            }
        };

        const allActiveRawItems = alignedImported || [];
        const allActiveFactoryItems = alignedYarns || [];

        const calculateTotalSayanSum = (isLastYear, field) => {
            const sumYarns =`
    );
    fs.writeFileSync('components/WarehouseOverviewTab.tsx', code, 'utf8');
    console.log('Fixed WarehouseOverviewTab.tsx successfully!');
} else {
    console.log('NaN not found in WarehouseOverviewTab.tsx');
}
