const fetch = require('node-fetch');

async function testFetch() {
    try {
        console.log("Fetching Sayan warehouse inventory...");
        const res = await fetch('http://localhost:3000/api/sayan/warehouse-inventory?refresh=true');
        const data = await res.json();
        console.log("Success:", data.success);
        console.log("Is Live:", data.isLive);
        
        const currentStock = data.currentStock || [];
        console.log(`Total current stock items: ${currentStock.length}`);

        const groupSums = {};
        currentStock.forEach(item => {
            const code = String(item.itemCode || '');
            const prefix = code.substring(0, 4);
            if (!groupSums[prefix]) {
                groupSums[prefix] = { name: item.groupName || prefix, totalStock: 0, count: 0 };
            }
            groupSums[prefix].totalStock += Number(item.stockQty || 0);
            groupSums[prefix].count += 1;
        });

        console.log("\n--- Sayan Current Warehouse Stock Group Totals ---");
        Object.keys(groupSums).sort().forEach(prefix => {
            const g = groupSums[prefix];
            console.log(`Group [${prefix}] ${g.name}: Stock = ${g.totalStock.toLocaleString('fa-IR')} kg (${g.count} items)`);
        });

        console.log("\n--- First 10 Items ---");
        currentStock.slice(0, 10).forEach(item => {
            console.log(`Code: ${item.itemCode} | Name: ${item.itemName} | Stock: ${item.stockQty} kg | Inflow: ${item.inflowQty} | Outflow: ${item.outflowQty}`);
        });
    } catch (e) {
        console.error("Error fetching Sayan stock:", e);
    }
}

testFetch();
